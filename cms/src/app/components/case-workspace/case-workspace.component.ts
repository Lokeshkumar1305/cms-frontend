import { Component, OnInit, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CaseService, CaseWorkflow } from '../../services/case.service';
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

  fetchProductId = '';
  fetchUserId = '';
  dataFetched = false;

  displayedColumns = ['caseId', 'configPath', 'currentLevel', 'status', 'createdDate', 'lastModifiedDate', 'actions'];

  // Data Queue
  casesQueue: CaseWorkflow[] = [];
  totalCount = 0;

  // Pagination & Sorting State
  page = 1;
  size = 5;
  sortField = 'createdDate';
  sortOrder: 'ASC' | 'DESC' = 'DESC';

  // Search parameters
  workspaceGroupId = '';

  // Selected Detail
  selectedCase: CaseWorkflow | null = null;
  isLoading = false;

  // Assign Form fields
  showAssignForm = false;
  assignCase: CaseWorkflow | null = null;
  assignToUserId = '';
  assignGroupId = '';
  isAssigning = false;
  assignError = '';
  assignSuccess = '';

  // Action Form fields
  showActionForm = false;
  actionCase: CaseWorkflow | null = null;
  actionType = '';
  actionNotes = '';
  isActioning = false;
  actionError = '';
  actionSuccess = '';

  // Ingestion Form fields
  showIngestForm = false;
  isIngesting = false;
  ingestError = '';
  ingestProductId = '';
  ingestUserId = '';
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
    // Restore last-used fetch credentials so the table auto-loads on revisit
    const savedUser  = localStorage.getItem('cw_fetchUserId')  || '';
    const savedGroup = localStorage.getItem('cw_fetchGroupId') || '';
    if (savedUser)  this.fetchUserId      = savedUser;
    if (savedGroup) this.workspaceGroupId = savedGroup;

    this.tenantContext.activeTenant$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(tenant => {
      if (tenant) {
        this.activeProductId  = tenant.productId;
        this.activeProductName = tenant.productName;
        this.ingestProductId  = tenant.productId;
        this.fetchProductId   = tenant.productId;
        this.dataFetched = true;
        this.loadQueue();
      } else {
        this.activeProductId  = '';
        this.activeProductName = '';
        this.ingestProductId  = '';
        this.casesQueue = [];
        this.totalCount = 0;
        this.dataFetched = false;
      }
      this.selectedCase = null;
    });
  }

  fetchData(): void {
    if (!this.fetchProductId.trim()) return;
    // Persist credentials for next visit
    localStorage.setItem('cw_fetchUserId',  this.fetchUserId.trim());
    localStorage.setItem('cw_fetchGroupId', this.workspaceGroupId.trim());
    this.page = 1;
    this.dataFetched = true;
    this.loadQueue();
  }

  loadQueue(): void {
    if (!this.fetchProductId.trim()) return;
    this.isLoading = true;

    this.caseService.getDashboardSummary(
      this.fetchProductId.trim(),
      this.fetchUserId.trim(),
      this.workspaceGroupId.trim(),
      this.page,
      this.size
    ).subscribe({
      next: (res) => {
        this.isLoading = false;
        const obj = res?.responseObject || {};
        // Each queue is { totalCount, data: [...] }
        const extract = (queue: any): CaseWorkflow[] =>
          (queue?.data || []).map((c: any) => ({ ...c, escalated: c.isEscalated }));

        this.casesQueue = [
          ...extract(obj.userPending),
          ...extract(obj.userCompleted),
          ...extract(obj.groupPending),
          ...extract(obj.groupCompleted),
        ];
        this.totalCount =
          (obj.userPending?.totalCount    || 0) +
          (obj.userCompleted?.totalCount  || 0) +
          (obj.groupPending?.totalCount   || 0) +
          (obj.groupCompleted?.totalCount || 0);
      },
      error: () => (this.isLoading = false)
    });
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
    this.showActionForm = false;
    this.actionCase = null;
    this.showAssignForm = false;
    this.assignCase = null;
    this.showIngestForm = !this.showIngestForm;
  }

  viewDetails(item: CaseWorkflow): void {
    this.showIngestForm = false;
    this.showActionForm = false;
    this.actionCase = null;
    this.showAssignForm = false;
    this.assignCase = null;
    this.selectedCase = item;
  }

  openActionForm(item: CaseWorkflow): void {
    this.showIngestForm = false;
    this.selectedCase = null;
    this.showAssignForm = false;
    this.assignCase = null;
    this.actionCase = item;
    this.showActionForm = true;
    this.actionType = '';
    this.actionNotes = '';
    this.actionError = '';
    this.actionSuccess = '';
  }

  openAssignForm(item: CaseWorkflow): void {
    this.showIngestForm = false;
    this.selectedCase = null;
    this.showActionForm = false;
    this.actionCase = null;
    this.assignCase = item;
    this.showAssignForm = true;
    this.assignToUserId = item.createdByUser || '';
    this.assignGroupId = '';
    this.assignError = '';
    this.assignSuccess = '';
  }

  submitAssign(): void {
    if (!this.assignCase || !this.assignToUserId.trim()) return;
    this.isAssigning = true;
    this.assignError = '';
    this.assignSuccess = '';

    this.caseService.reassignCase(
      this.fetchProductId.trim(),
      this.fetchUserId.trim(),
      (this.assignGroupId.trim() || this.workspaceGroupId.trim()),
      this.assignCase.caseId,
      this.assignToUserId.trim()
    ).subscribe({
      next: (res) => {
        this.isAssigning = false;
        if (res.success !== false) {
          this.assignSuccess = res.message || 'Case reassigned successfully.';
          setTimeout(() => {
            this.showAssignForm = false;
            this.assignCase = null;
            this.loadQueue();
          }, 1500);
        } else {
          this.assignError = res.message || 'Failed to reassign case.';
        }
      },
      error: () => {
        this.isAssigning = false;
        this.assignError = 'An error occurred while reassigning the case.';
      }
    });
  }

  submitAction(): void {
    if (!this.actionCase || !this.actionNotes.trim()) return;
    this.isActioning = true;
    this.actionError = '';
    this.actionSuccess = '';

    this.caseService.performCaseAction(
      this.fetchProductId.trim(),
      this.fetchUserId.trim(),
      this.workspaceGroupId.trim(),
      this.actionCase.caseId,
      this.actionType,
      this.actionNotes.trim()
    ).subscribe({
      next: (res) => {
        this.isActioning = false;
        if (res.success !== false) {
          this.actionSuccess = res.message || 'Action submitted successfully.';
          setTimeout(() => {
            this.showActionForm = false;
            this.actionCase = null;
            this.loadQueue();
          }, 1500);
        } else {
          this.actionError = res.message || 'Failed to submit action.';
        }
      },
      error: () => {
        this.isActioning = false;
        this.actionError = 'An error occurred while submitting the action.';
      }
    });
  }

  triggerIngest(): void {
    if (!this.ingestProductId.trim() || !this.ingestUserId.trim() || !this.ingestConfigPath.trim()) return;

    const transactionPayload: { [key: string]: any } = {};
    for (const row of this.ingestPayloadRows) {
      if (row.key.trim()) transactionPayload[row.key.trim()] = row.value;
    }

    this.isIngesting = true;
    this.ingestError = '';

    this.caseService.createCase(
      this.ingestProductId.trim(),
      this.ingestUserId.trim(),
      this.ingestConfigPath.trim(),
      this.ingestSubstage,
      Object.keys(transactionPayload).length > 0 ? transactionPayload : undefined,
      this.workspaceGroupId.trim()
    ).subscribe({
      next: (res) => {
        this.isIngesting = false;
        if (res.success !== false) {
          this.ingestProductId = this.activeProductId;
          this.ingestUserId = '';
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
