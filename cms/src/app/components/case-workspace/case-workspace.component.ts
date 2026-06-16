import { Component, OnInit, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CaseService, CaseWorkflow, CaseQueuePayload, CaseSearchCriteria } from '../../services/case.service';
import { TenantContextService } from '../../services/tenant-context.service';
import { Sort } from '@angular/material/sort';

@Component({
  selector: 'app-case-workspace',
  standalone: false,
  templateUrl: './case-workspace.component.html',
  styleUrls: ['./case-workspace.component.scss']
})
export class CaseWorkspaceComponent implements OnInit {
  activeProductId = '';
  activeProductName = '';

  displayedColumns = ['caseId', 'configPath', 'currentLevel', 'status', 'actions'];

  // Data Queue
  casesQueue: CaseWorkflow[] = [];
  totalCount = 0;

  // Pagination & Sorting State
  page = 1;
  size = 5;
  sortField = 'createdDate';
  sortOrder: 'ASC' | 'DESC' = 'DESC';

  // Search parameters
  searchStatus = '';
  searchPath = '';

  // Selected Detail
  selectedCase: CaseWorkflow | null = null;
  isLoading = false;

  // Ingestion Form fields
  showIngestForm = false;
  isIngesting = false;
  ingestError = '';
  ingestConfigPath = '';
  ingestSubstage = '';
  ingestPayloadRows: { key: string; value: string }[] = [];

  addPayloadRow(): void { this.ingestPayloadRows.push({ key: '', value: '' }); }
  removePayloadRow(i: number): void { this.ingestPayloadRows.splice(i, 1); }

  private destroyRef = inject(DestroyRef);

  constructor(
    private caseService: CaseService,
    private tenantContext: TenantContextService
  ) {}

  ngOnInit(): void {
    this.tenantContext.activeTenant$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(tenant => {
      if (tenant) {
        this.activeProductId = tenant.productId;
        this.activeProductName = tenant.productName;
        this.resetQueueFilters();
        this.loadQueue();
      } else {
        this.activeProductId = '';
        this.activeProductName = '';
        this.casesQueue = [];
        this.totalCount = 0;
      }
      this.selectedCase = null;
    });
  }

  resetQueueFilters(): void {
    this.page = 1;
    this.searchStatus = '';
    this.searchPath = '';
  }

  loadQueue(): void {
    if (!this.activeProductId) return;
    this.isLoading = true;

    // Check if search filters are active
    const hasSearchFilters = this.searchStatus || this.searchPath;

    if (hasSearchFilters) {
      const criteriaList: CaseSearchCriteria[] = [];
      if (this.searchStatus) {
        criteriaList.push({ field: 'status', operator: 'EQUALS', value: this.searchStatus });
      }
      if (this.searchPath) {
        criteriaList.push({ field: 'configPath', operator: 'LIKE', value: this.searchPath });
      }

      const searchPayload = {
        page: this.page,
        size: this.size,
        criteriaList: criteriaList
      };

      this.caseService.searchCases(this.activeProductId, searchPayload).subscribe({
        next: (res) => {
          this.isLoading = false;
          this.casesQueue = res.responseObject || [];
          this.totalCount = res.totalCount || 0;
        },
        error: () => (this.isLoading = false)
      });
    } else {
      const queuePayload: CaseQueuePayload = {
        page: this.page,
        size: this.size,
        sortField: this.sortField,
        sortOrder: this.sortOrder
      };

      this.caseService.getWorkspaceQueue(this.activeProductId, queuePayload).subscribe({
        next: (res) => {
          this.isLoading = false;
          this.casesQueue = res.responseObject || [];
          this.totalCount = res.totalCount || 0;
        },
        error: () => (this.isLoading = false)
      });
    }
  }

  applySearch(): void {
    this.page = 1;
    this.loadQueue();
  }

  clearSearch(): void {
    this.resetQueueFilters();
    this.loadQueue();
  }

  changeSort(field: string): void {
    if (this.sortField === field) {
      this.sortOrder = this.sortOrder === 'ASC' ? 'DESC' : 'ASC';
    } else {
      this.sortField = field;
      this.sortOrder = 'DESC';
    }
    this.page = 1;
    this.loadQueue();
  }

  changePage(p: number): void {
    this.page = p;
    this.loadQueue();
  }

  onSizeChange(newSize: number): void {
    this.size = newSize;
    this.page = 1;
    this.loadQueue();
  }

  pageSizeOptions = [5, 10, 25];

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

  openIngestForm(): void {
    this.selectedCase = null;
    this.showIngestForm = !this.showIngestForm;
  }

  viewDetails(item: CaseWorkflow): void {
    this.showIngestForm = false;
    this.selectedCase = item;
  }

  triggerIngest(): void {
    if (!this.activeProductId || !this.ingestConfigPath.trim()) return;

    const transactionPayload: { [key: string]: any } = {};
    for (const row of this.ingestPayloadRows) {
      if (row.key.trim()) transactionPayload[row.key.trim()] = row.value;
    }

    this.isIngesting = true;
    this.ingestError = '';

    this.caseService.createCase(
      this.activeProductId,
      'system_admin',
      this.ingestConfigPath.trim(),
      this.ingestSubstage,
      Object.keys(transactionPayload).length > 0 ? transactionPayload : undefined
    ).subscribe({
      next: (res) => {
        this.isIngesting = false;
        if (res.success !== false) {
          this.ingestConfigPath = '';
          this.ingestSubstage = '';
          this.ingestPayloadRows = [];
          this.showIngestForm = false;
          this.loadQueue();
        } else {
          this.ingestError = res.message || 'Failed to create case.';
        }
      },
      error: () => {
        this.isIngesting = false;
        this.ingestError = 'An error occurred while creating the case.';
      }
    });
  }

  onSortChange(sort: Sort): void {
    this.sortField = sort.active || 'createdDate';
    this.sortOrder = sort.direction === 'asc' ? 'ASC' : 'DESC';
    this.page = 1;
    this.loadQueue();
  }
}
