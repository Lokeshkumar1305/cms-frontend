import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { distinctUntilChanged } from 'rxjs/operators';

export interface ProductTenant {
  productId: string;
  productName: string;
}

@Injectable({
  providedIn: 'root'
})
export class TenantContextService {
  private activeTenantSubject = new BehaviorSubject<ProductTenant | null>(null);
  activeTenant$: Observable<ProductTenant | null> = this.activeTenantSubject.asObservable().pipe(
    distinctUntilChanged((prev, curr) => prev?.productId === curr?.productId)
  );

  constructor() {
    const cachedId = localStorage.getItem('tenant_productId');
    const cachedName = localStorage.getItem('tenant_productName');
    if (cachedId && cachedName) {
      this.activeTenantSubject.next({ productId: cachedId, productName: cachedName });
    }
  }

  setTenant(productId: string, productName: string): void {
    const tenant = { productId, productName };
    this.activeTenantSubject.next(tenant);
    localStorage.setItem('tenant_productId', productId);
    localStorage.setItem('tenant_productName', productName);
  }

  clearTenant(): void {
    this.activeTenantSubject.next(null);
    localStorage.removeItem('tenant_productId');
    localStorage.removeItem('tenant_productName');
  }

  getTenantId(): string {
    return this.activeTenantSubject.value?.productId || '';
  }
}
