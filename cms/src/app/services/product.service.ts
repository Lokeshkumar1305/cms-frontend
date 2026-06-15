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

  // Get all workspaces (mocked / fallback)
  getProducts(): Observable<ProductWorkspace[]> {
    // Note: If there is a GET endpoint we would call it, else we return our list
    return of([...this.mockProducts]);
  }

  // Create Product Workspace (POST http://localhost:8091/api/cms/product/create)
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
