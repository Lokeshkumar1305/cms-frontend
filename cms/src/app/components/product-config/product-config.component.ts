import { Component, OnInit, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ProductService, ProductWorkspace } from '../../services/product.service';
import { TenantContextService } from '../../services/tenant-context.service';

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
  successMessage = '';
  errorMessage = '';

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

    this.loadWorkspaces();
    this.tenantContext.activeTenant$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(tenant => {
      this.activeProductId = tenant ? tenant.productId : '';
    });
  }

  loadWorkspaces(): void {
    this.productService.getProducts().subscribe(list => {
      this.workspaces = list;
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
          this.loadWorkspaces();
          // Auto select the newly created tenant context
          if (res.responseObject) {
            this.tenantContext.setTenant(res.responseObject.productId, res.responseObject.productName);
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
}
