import { Component, OnInit, DestroyRef, inject } from '@angular/core';
import { Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ConfigurationService, NotificationSettings } from '../../services/configuration.service';
import { TenantContextService } from '../../services/tenant-context.service';

@Component({
  selector: 'app-case-create',
  standalone: false,
  templateUrl: './case-create.component.html',
  styleUrls: ['./case-create.component.scss']
})
export class CaseCreateComponent implements OnInit {
  activeProductId = '';
  activeProductName = '';
  isSubmitting = false;
  errorMessage = '';

  createForm!: FormGroup;
  nodes: string[] = ['LOAN', 'RETAIL', 'EXPRESS'];
  newNodeName = '';

  nodeWorkflows: {
    nodeName: string;
    bpmnFile: string;
    substageOverrides: { substage: string; bpmnFile: string }[];
  }[] = [
    { nodeName: 'LOAN',    bpmnFile: 'universal-case-flow',  substageOverrides: [] },
    { nodeName: 'RETAIL',  bpmnFile: '',                     substageOverrides: [] },
    { nodeName: 'EXPRESS', bpmnFile: 'retail-express-flow',  substageOverrides: [] }
  ];

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
      } else {
        this.activeProductId = '';
        this.activeProductName = '';
      }
    });
  }

  initForm(): void {
    this.createForm = this.fb.group({
      configPath:              ['LOAN.RETAIL.EXPRESS',              [Validators.required]],
      nodeName:                ['Retail Express Micro Pathway Node', [Validators.required]],
      currentDepthLevel:       [3,                                  [Validators.required, Validators.min(1)]],
      globalSlaTimeoutMinutes: [1440,                               [Validators.required, Validators.min(1)]],
      fallbackAdminUserId:     ['retail_operations_manager',        [Validators.required]],
      fallbackAdminGroupId:    ['RETAIL_ADMIN_GP',                  [Validators.required]],
      notifyEnabled:           [true],
      notifyEmail:             ['retail-alerts@toucan.com',         [Validators.email]],
      notifyMobile:            ['+1234567890'],
      notifySMSChannel:        [true],
      notifyEmailChannel:      [true]
    });
  }

  addNode(): void {
    const val = this.newNodeName.trim().toUpperCase();
    if (val && !this.nodes.includes(val) && /^[A-Z0-9_-]+$/.test(val)) {
      this.nodes.push(val);
      this.newNodeName = '';
      this.updateConfigPath();
    }
  }

  removeNode(index: number): void {
    this.nodes.splice(index, 1);
    this.updateConfigPath();
  }

  private updateConfigPath(): void {
    this.createForm.patchValue({ configPath: this.nodes.join('.') });
    this.syncWorkflows();
  }

  private syncWorkflows(): void {
    const updated: typeof this.nodeWorkflows = [];
    for (const node of this.nodes) {
      const existing = this.nodeWorkflows.find(w => w.nodeName === node);
      if (existing) {
        updated.push(existing);
      } else {
        let defaultBpmn = '';
        if (node === 'LOAN')    defaultBpmn = 'universal-case-flow';
        if (node === 'EXPRESS') defaultBpmn = 'retail-express-flow';
        updated.push({ nodeName: node, bpmnFile: defaultBpmn, substageOverrides: [] });
      }
    }
    this.nodeWorkflows = updated;
  }

  addSubstageOverride(wIdx: number): void {
    this.nodeWorkflows[wIdx].substageOverrides.push({ substage: '', bpmnFile: '' });
  }

  removeSubstageOverride(wIdx: number, oIdx: number): void {
    this.nodeWorkflows[wIdx].substageOverrides.splice(oIdx, 1);
  }

  onSubmit(): void {
    this.errorMessage = '';
    if (this.createForm.invalid) {
      this.createForm.markAllAsTouched();
      return;
    }

    this.isSubmitting = true;
    const formVal = this.createForm.value;

    const workflowKeys: { [key: string]: string } = {};
    for (const item of this.nodeWorkflows) {
      if (item.nodeName.trim() && item.bpmnFile.trim()) {
        workflowKeys[item.nodeName.trim()] = item.bpmnFile.trim();
      }
      for (const override of item.substageOverrides) {
        if (override.substage.trim() && override.bpmnFile.trim()) {
          workflowKeys[override.substage.trim()] = override.bpmnFile.trim();
        }
      }
    }

    const channels: string[] = [];
    if (formVal.notifySMSChannel)   channels.push('SMS');
    if (formVal.notifyEmailChannel) channels.push('EMAIL');

    const notificationSettings: NotificationSettings = {
      enabled:             formVal.notifyEnabled,
      channels,
      targetEmailId:       formVal.notifyEmail,
      targetMobileNumber:  formVal.notifyMobile
    };

    const payload = {
      configPath:              formVal.configPath,
      nodeName:                formVal.nodeName,
      parentConfigurationId:   null,
      currentDepthLevel:       formVal.currentDepthLevel,
      globalSlaTimeoutMinutes: formVal.globalSlaTimeoutMinutes,
      fallbackAdminUserId:     formVal.fallbackAdminUserId,
      fallbackAdminGroupId:    formVal.fallbackAdminGroupId,
      workflowKeys,
      approvalSettings: {
        totalRequiredLevels: 2,
        tiers: [
          { level: 1, tierName: 'Automated Score Validation Check', authorizedGroups: ['EXPRESS_MAKER_GP'],    strictBinding: true },
          { level: 2, tierName: 'Manager Final Audit Confirmation',  authorizedGroups: ['EXPRESS_CHECKER_GP'], strictBinding: true }
        ]
      },
      notificationSettings
    };

    this.configService.createCaseConfiguration(this.activeProductId, payload).subscribe({
      next: (res) => {
        this.isSubmitting = false;
        if (res.success) {
          this.router.navigate(['/case-config']);
        } else {
          this.errorMessage = res.message || 'Failed to create configuration.';
        }
      },
      error: (err) => {
        this.isSubmitting = false;
        this.errorMessage = 'An error occurred during workflow registration.';
        console.error(err);
      }
    });
  }

  cancel(): void {
    this.router.navigate(['/case-config']);
  }
}
