import { Component, OnInit, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ConfigurationService, CaseConfiguration, NotificationSettings } from '../../services/configuration.service';
import { TenantContextService } from '../../services/tenant-context.service';
import { Sort } from '@angular/material/sort';

@Component({
  selector: 'app-case-builder',
  standalone: false,
  templateUrl: './case-builder.component.html',
  styleUrls: ['./case-builder.component.scss']
})
export class CaseBuilderComponent implements OnInit {
  activeProductId = '';
  activeProductName = '';
  configurations: CaseConfiguration[] = [];

  updateForm!: FormGroup;

  selectedConfigForUpdate: CaseConfiguration | null = null;
  isSubmitting = false;
  isLoading = false;
  successMessage = '';
  errorMessage = '';

  displayedColumns = ['configPath', 'nodeName', 'globalSlaTimeoutMinutes', 'currentDepthLevel', 'notificationSettings', 'createdDate', 'actions'];

  page = 1;
  size = 10;
  sortField = 'createdDate';
  sortOrder: 'ASC' | 'DESC' = 'DESC';
  totalCount = 0;
  pageSizeOptions = [5, 10, 25];

  private destroyRef = inject(DestroyRef);

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private configService: ConfigurationService,
    private tenantContext: TenantContextService
  ) {}

  ngOnInit(): void {
    this.initForm();

    this.tenantContext.activeTenant$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(tenant => {
      if (tenant) {
        this.activeProductId = tenant.productId;
        this.activeProductName = tenant.productName;
        this.page = 1;
        this.loadConfigurations();
      } else {
        this.activeProductId = '';
        this.activeProductName = '';
        this.configurations = [];
        this.totalCount = 0;
      }
      this.selectedConfigForUpdate = null;
    });
  }

  initForm(): void {
    this.updateForm = this.fb.group({
      nodeName:                ['', [Validators.required]],
      globalSlaTimeoutMinutes: [720, [Validators.required, Validators.min(1)]],
      notifyEnabled:           [false],
      notifyEmail:             ['', [Validators.email]],
      notifyMobile:            [''],
      notifySMSChannel:        [false],
      notifyEmailChannel:      [true]
    });
  }

  loadConfigurations(): void {
    if (!this.activeProductId) return;
    this.isLoading = true;
    this.configService.getConfigurationsByProduct(this.activeProductId, this.page, this.size, this.sortField, this.sortOrder).subscribe({
      next: (res) => {
        this.isLoading = false;
        this.configurations = res.responseObject || [];
        this.totalCount = res.totalCount || 0;
      },
      error: () => { this.isLoading = false; }
    });
  }

  navigateToEdit(config: CaseConfiguration): void {
    this.router.navigate(['/case-config/create'], { state: { config, mode: 'edit' } });
  }

  selectConfigForEdit(config: CaseConfiguration): void {
    this.selectedConfigForUpdate = config;
    this.updateForm.setValue({
      nodeName:                config.nodeName,
      globalSlaTimeoutMinutes: config.globalSlaTimeoutMinutes,
      notifyEnabled:           config.notificationSettings.enabled,
      notifyEmail:             config.notificationSettings.targetEmailId,
      notifyMobile:            config.notificationSettings.targetMobileNumber,
      notifySMSChannel:        config.notificationSettings.channels.includes('SMS'),
      notifyEmailChannel:      config.notificationSettings.channels.includes('EMAIL')
    });
  }

  closeSidePanel(): void {
    this.selectedConfigForUpdate = null;
  }

  onUpdateConfig(): void {
    if (!this.selectedConfigForUpdate) return;
    this.successMessage = '';
    this.errorMessage = '';

    if (this.updateForm.invalid) {
      this.updateForm.markAllAsTouched();
      return;
    }

    this.isSubmitting = true;
    const formVal = this.updateForm.value;

    const channels: string[] = [];
    if (formVal.notifySMSChannel)   channels.push('SMS');
    if (formVal.notifyEmailChannel) channels.push('EMAIL');

    const notificationSettings: NotificationSettings = {
      enabled:            formVal.notifyEnabled,
      channels,
      targetEmailId:      formVal.notifyEmail,
      targetMobileNumber: formVal.notifyMobile
    };

    const payload = {
      nodeName:                formVal.nodeName,
      globalSlaTimeoutMinutes: formVal.globalSlaTimeoutMinutes,
      notificationSettings
    };

    this.configService.updateCaseConfiguration(this.selectedConfigForUpdate.id, payload).subscribe({
      next: (res) => {
        this.isSubmitting = false;
        if (res.success) {
          this.successMessage = res.message;
          this.selectedConfigForUpdate = null;
          this.loadConfigurations();
        } else {
          this.errorMessage = res.message || 'Failed to update configuration.';
        }
      },
      error: (err) => {
        this.isSubmitting = false;
        this.errorMessage = 'An error occurred while editing the node.';
        console.error(err);
      }
    });
  }

  onSortChange(sort: Sort): void {
    this.sortField = sort.active || 'createdDate';
    this.sortOrder = sort.direction === 'asc' ? 'ASC' : 'DESC';
    this.page = 1;
    this.loadConfigurations();
  }

  changePage(p: number): void {
    this.page = p;
    this.loadConfigurations();
  }

  onSizeChange(newSize: number): void {
    this.size = newSize;
    this.page = 1;
    this.loadConfigurations();
  }

  get totalPages(): number { return Math.ceil(this.totalCount / this.size) || 1; }
  get startItem(): number  { return this.totalCount === 0 ? 0 : (this.page - 1) * this.size + 1; }
  get endItem(): number    { return Math.min(this.page * this.size, this.totalCount); }

  get pageNumbers(): number[] {
    const total = this.totalPages;
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const pages: number[] = [1];
    if (this.page > 3) pages.push(-1);
    for (let i = Math.max(2, this.page - 1); i <= Math.min(total - 1, this.page + 1); i++) pages.push(i);
    if (this.page < total - 2) pages.push(-1);
    pages.push(total);
    return pages;
  }
}
