import { Component, OnInit, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ProductService, ProductWorkspace } from '../../services/product.service';
import { TenantContextService } from '../../services/tenant-context.service';
import { Sort } from '@angular/material/sort';

@Component({
  selector: 'app-product-config',
  standalone: false,
  templateUrl: './product-config.component.html',
  styleUrls: ['./product-config.component.scss']
})
export class ProductConfigComponent implements OnInit {
  productForm!: FormGroup;
  workspaces: ProductWorkspace[] = [];
  activeProductId = '';
  isSubmitting = false;
  isLoading = false;
  successMessage = '';
  errorMessage = '';

  // Table columns
  displayedColumns = ['productId', 'productName', 'sourceSystemCode', 'status', 'createdDate', 'actions'];

  // Pagination & Sorting
  page = 1;
  size = 10;
  sortField = 'createdDate';
  sortOrder: 'ASC' | 'DESC' = 'DESC';
  totalCount = 0;
  pageSizeOptions = [5, 10, 25];

  // Create form toggle
  showCreateForm = false;

  private destroyRef = inject(DestroyRef);

  constructor(
    private fb: FormBuilder,
    private productService: ProductService,
    private tenantContext: TenantContextService
  ) {}

  ngOnInit(): void {
    this.productForm = this.fb.group({
      productName: ['', [Validators.required, Validators.minLength(3)]],
      sourceSystemCode: ['', [Validators.required, Validators.pattern(/^[A-Z0-9_-]+$/)]],
      description: ['', [Validators.required, Validators.maxLength(200)]]
    });

    this.tenantContext.activeTenant$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(tenant => {
      this.activeProductId = tenant ? tenant.productId : '';
      this.page = 1;
      this.loadWorkspaces();
    });
  }

  loadWorkspaces(): void {
    this.isLoading = true;
    this.productService.getProducts(this.activeProductId, this.page, this.size, this.sortField, this.sortOrder).subscribe({
      next: (res) => {
        this.isLoading = false;
        this.workspaces = res.responseObject || [];
        this.totalCount = res.totalCount || 0;
      },
      error: () => {
        this.isLoading = false;
      }
    });
  }

  selectTenant(ws: ProductWorkspace): void {
    this.tenantContext.setTenant(ws.productId, ws.productName);
    this.successMessage = `Active workspace switched to: ${ws.productName}`;
    setTimeout(() => (this.successMessage = ''), 3000);
  }

  onSubmit(): void {
    this.successMessage = '';
    this.errorMessage = '';

    if (this.productForm.invalid) {
      this.productForm.markAllAsTouched();
      return;
    }

    this.isSubmitting = true;
    const { productName, sourceSystemCode, description } = this.productForm.value;

    this.productService.createProductWorkspace(productName, sourceSystemCode, description).subscribe({
      next: (res) => {
        this.isSubmitting = false;
        if (res.success) {
          this.successMessage = res.message;
          this.productForm.reset();
          this.showCreateForm = false;
          this.page = 1;
          // Set tenant with the newly created productId — this triggers the subscription
          // which updates activeProductId and auto-reloads the table with X-Product-Id header
          if (res.responseObject) {
            this.tenantContext.setTenant(res.responseObject.productId, res.responseObject.productName);
          } else {
            this.loadWorkspaces();
          }
        } else {
          this.errorMessage = res.message || 'Failed to create product workspace.';
        }
      },
      error: (err) => {
        this.isSubmitting = false;
        this.errorMessage = 'An error occurred while provisioning the workspace.';
        console.error(err);
      }
    });
  }

  // Sorting
  onSortChange(sort: Sort): void {
    this.sortField = sort.active || 'createdDate';
    this.sortOrder = sort.direction === 'asc' ? 'ASC' : 'DESC';
    this.page = 1;
    this.loadWorkspaces();
  }

  // Pagination
  changePage(p: number): void {
    this.page = p;
    this.loadWorkspaces();
  }

  onSizeChange(newSize: number): void {
    this.size = newSize;
    this.page = 1;
    this.loadWorkspaces();
  }

  get totalPages(): number {
    return Math.ceil(this.totalCount / this.size) || 1;
  }

  get startItem(): number {
    return this.totalCount === 0 ? 0 : (this.page - 1) * this.size + 1;
  }

  get endItem(): number {
    return Math.min(this.page * this.size, this.totalCount);
  }

  get pageNumbers(): number[] {
    const total = this.totalPages;
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const pages: number[] = [1];
    if (this.page > 3) pages.push(-1);
    for (let i = Math.max(2, this.page - 1); i <= Math.min(total - 1, this.page + 1); i++) {
      pages.push(i);
    }
    if (this.page < total - 2) pages.push(-1);
    pages.push(total);
    return pages;
  }
}
