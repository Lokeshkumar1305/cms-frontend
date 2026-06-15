import { Component, OnInit, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CaseService, CaseWorkflow } from '../../services/case.service';
import { ProductService } from '../../services/product.service';
import { TenantContextService } from '../../services/tenant-context.service';

@Component({
  selector: 'app-dashboard',
  standalone: false,
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit {

  // Active tenant
  activeProductId = '';
  activeProductName = '';

  // KPI metrics
  totalCases = 0;
  initiatedCases = 0;
  inProgressCases = 0;
  completedCases = 0;
  failedCases = 0;
  totalProducts = 0;

  // Recent cases table
  displayedColumns = ['caseId', 'applicant', 'configPath', 'capital', 'status', 'createdDate'];
  recentCases: CaseWorkflow[] = [];
  isLoading = false;

  private destroyRef = inject(DestroyRef);

  constructor(
    private caseService: CaseService,
    private productService: ProductService,
    private tenantContext: TenantContextService
  ) {}

  ngOnInit(): void {
    // Always load product count
    this.productService.getProducts().pipe(takeUntilDestroyed(this.destroyRef)).subscribe(products => {
      this.totalProducts = products.length;
    });

    // Load case stats whenever active tenant changes
    this.tenantContext.activeTenant$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(tenant => {
      if (tenant) {
        this.activeProductId = tenant.productId;
        this.activeProductName = tenant.productName;
        this.loadSummary();
      } else {
        this.activeProductId = '';
        this.activeProductName = '';
        this.resetStats();
      }
    });
  }

  private loadSummary(): void {
    this.isLoading = true;
    this.caseService.getCaseSummary(this.activeProductId).subscribe({
      next: (summary) => {
        this.totalCases = summary.total;
        this.initiatedCases = summary.initiated;
        this.inProgressCases = summary.inProgress;
        this.completedCases = summary.completed;
        this.failedCases = summary.failed;
        this.recentCases = summary.recentCases;
        this.isLoading = false;
      },
      error: () => (this.isLoading = false)
    });
  }

  private resetStats(): void {
    this.totalCases = 0;
    this.initiatedCases = 0;
    this.inProgressCases = 0;
    this.completedCases = 0;
    this.failedCases = 0;
    this.recentCases = [];
  }
}
