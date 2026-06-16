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

  nodeWorkflows: { nodeName: string; bpmnFile: string }[] = [
    { nodeName: 'LOAN',    bpmnFile: 'universal-case-flow' },
    { nodeName: 'RETAIL',  bpmnFile: '' },
    { nodeName: 'EXPRESS', bpmnFile: 'retail-express-flow' }
  ];

  substageEntries: { name: string; bpmnFile: string }[] = [];

  mainUploadStates: boolean[] = [];
  subUploadStates: boolean[] = [];

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
      notifyEmail:             ['', [Validators.email]],
      notifyMobile:            [''],
      notifySMSChannel:        [false],
      notifyEmailChannel:      [false],
      notifyWhatsAppChannel:   [false]
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
        updated.push({ nodeName: node, bpmnFile: defaultBpmn });
      }
    }
    this.nodeWorkflows = updated;
  }

  addSubstage(): void {
    this.substageEntries.push({ name: '', bpmnFile: '' });
  }

  removeSubstage(idx: number): void {
    this.substageEntries.splice(idx, 1);
  }

  onBpmnFileSelect(event: Event, wIdx: number): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    const file = input.files[0];
    input.value = '';

    this.mainUploadStates[wIdx] = true;
    this.configService.deployBpmnFile(this.activeProductId, 'system_admin', file).subscribe({
      next: (res) => {
        this.mainUploadStates[wIdx] = false;
        this.nodeWorkflows[wIdx].bpmnFile = res?.responseObject?.processKey || file.name.replace(/\.(bpmn|xml)$/i, '');
      },
      error: () => {
        this.mainUploadStates[wIdx] = false;
        this.nodeWorkflows[wIdx].bpmnFile = file.name.replace(/\.(bpmn|xml)$/i, '');
      }
    });
  }

  onSubstageBpmnUpload(event: Event, idx: number): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    const file = input.files[0];
    input.value = '';

    this.subUploadStates[idx] = true;
    this.configService.deployBpmnFile(this.activeProductId, 'system_admin', file).subscribe({
      next: (res) => {
        this.subUploadStates[idx] = false;
        this.substageEntries[idx].bpmnFile = res?.responseObject?.processKey || file.name.replace(/\.(bpmn|xml)$/i, '');
      },
      error: () => {
        this.subUploadStates[idx] = false;
        this.substageEntries[idx].bpmnFile = file.name.replace(/\.(bpmn|xml)$/i, '');
      }
    });
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
    }
    for (const sub of this.substageEntries) {
      if (sub.name.trim() && sub.bpmnFile.trim()) {
        workflowKeys[sub.name.trim()] = sub.bpmnFile.trim();
      }
    }

    const channels: string[] = [];
    if (formVal.notifySMSChannel)      channels.push('SMS');
    if (formVal.notifyEmailChannel)   channels.push('EMAIL');
    if (formVal.notifyWhatsAppChannel) channels.push('WHATSAPP');

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
