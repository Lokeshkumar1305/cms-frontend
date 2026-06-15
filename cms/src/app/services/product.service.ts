import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface ProductWorkspace {
  id: string;
  productId: string;
  productName: string;
  sourceSystemCode: string;
  description: string;
  status: string;
  createdDate: string;
  lastModifiedDate: string;
  modifiedByUser: string;
}

@Injectable({
  providedIn: 'root'
})
export class ProductService {
  private apiUrl = `${environment.apiUrl}/cms/product`;

  // In-memory mock database for fallback
  private mockProducts: ProductWorkspace[] = [
    {
      id: '6a2cfeb44aafa147d6f19218',
      productId: 'PRD-D7F1A6A2',
      productName: 'Commercial & Consumer Lending Vertical',
      sourceSystemCode: 'LENDING-CORE',
      description: 'Master multi-tenant isolated container partition for corporate and retail credit flows.',
      status: 'ACTIVE',
      createdDate: '2026-06-15T10:20:00.000Z',
      lastModifiedDate: '2026-06-15T10:20:00.000Z',
      modifiedByUser: 'system_architect'
    }
  ];

  constructor(private http: HttpClient) {
    const cached = localStorage.getItem('mock_products');
    if (cached) {
      this.mockProducts = JSON.parse(cached);
    }
  }

  private saveToCache(): void {
    localStorage.setItem('mock_products', JSON.stringify(this.mockProducts));
  }

  // Fetch all products (POST http://192.168.100.61:8091/api/cms/product/getall)
  getProducts(productId: string = '', page: number = 1, size: number = 10, sortField: string = 'createdDate', sortOrder: 'ASC' | 'DESC' = 'DESC'): Observable<any> {
    let headers = new HttpHeaders()
      .set('Content-Type', 'application/json')
      .set('X-User-Id', 'system_admin');
    if (productId) {
      headers = headers.set('X-Product-Id', productId);
    }

    const payload = { page, size, sortField, sortOrder };

    return this.http.post<any>(`${this.apiUrl}/getall`, payload, { headers }).pipe(
      map(res => {
        if (res && res.success && res.responseObject && Array.isArray(res.responseObject)) {
          for (const product of res.responseObject) {
            this.syncLocalProduct(product);
          }
        }
        return res;
      }),
      catchError(err => {
        console.warn('Backend API offline, using mock product list.', err);

        // Sort mock data
        const sorted = [...this.mockProducts].sort((a, b) => {
          const valA = (a as any)[sortField] || '';
          const valB = (b as any)[sortField] || '';
          if (typeof valA === 'string' && typeof valB === 'string') {
            return sortOrder === 'ASC' ? valA.localeCompare(valB) : valB.localeCompare(valA);
          }
          return 0;
        });

        // Paginate
        const start = (page - 1) * size;
        const pageItems = sorted.slice(start, start + size);

        return of({
          success: true,
          message: pageItems.length > 0 ? 'Success' : 'No data found',
          responseObject: pageItems,
          statusCode: 200,
          totalCount: sorted.length
        });
      })
    );
  }

  // Create Product Workspace (POST http://192.168.100.61:8091/api/cms/product/create)
  createProductWorkspace(name: string, code: string, description: string): Observable<any> {
    const headers = new HttpHeaders({
      'X-User-Id': 'system_admin',
      'Content-Type': 'application/json'
    });
    
    const payload = {
      requestObject: {
        productName: name,
        sourceSystemCode: code,
        description: description
      }
    };

    return this.http.post<any>(`${this.apiUrl}/create`, payload, { headers }).pipe(
      map(res => {
        if (res && res.success) {
          const newProduct: ProductWorkspace = {
            id: res.responseObject?.id || Math.random().toString(16).substring(2, 14) + Math.random().toString(16).substring(2, 14),
            productId: res.responseObject?.productId || `PRD-${Math.random().toString(16).substring(2, 10).toUpperCase()}`,
            productName: name,
            sourceSystemCode: code.toUpperCase(),
            description: description,
            status: 'ACTIVE',
            createdDate: res.responseObject?.createdDate || new Date().toISOString(),
            lastModifiedDate: res.responseObject?.lastModifiedDate || new Date().toISOString(),
            modifiedByUser: res.responseObject?.modifiedByUser || 'system_architect',
            ...(res.responseObject || {})
          };
          this.syncLocalProduct(newProduct);
          res.responseObject = newProduct;
        }
        return res;
      }),
      catchError(err => {
        console.warn('Backend API offline, using mock service fallback.', err);
        
        // Simulating the 201 Created response from backend payload specifications
        const randomId = Math.random().toString(16).substring(2, 10).toUpperCase();
        const mongoId = Math.random().toString(16).substring(2, 14) + Math.random().toString(16).substring(2, 14);
        
        const newProduct: ProductWorkspace = {
          id: mongoId,
          productId: `PRD-${randomId}`,
          productName: name,
          sourceSystemCode: code.toUpperCase(),
          description: description,
          status: 'ACTIVE',
          createdDate: new Date().toISOString(),
          lastModifiedDate: new Date().toISOString(),
          modifiedByUser: 'system_architect'
        };

        this.mockProducts.push(newProduct);
        this.saveToCache();

        const mockResponse = {
          success: true,
          message: 'Product workspace provisioned successfully (Mock Fallback)',
          responseObject: newProduct,
          statusCode: 201,
          totalCount: 1
        };

        return of(mockResponse);
      })
    );
  }

  private syncLocalProduct(product: ProductWorkspace): void {
    const idx = this.mockProducts.findIndex(p => p.productId === product.productId);
    if (idx !== -1) {
      this.mockProducts[idx] = product;
    } else {
      this.mockProducts.push(product);
    }
    this.saveToCache();
  }
}
