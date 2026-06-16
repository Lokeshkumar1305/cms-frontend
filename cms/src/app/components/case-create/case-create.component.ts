import { Component, OnInit, DestroyRef, inject } from '@angular/core';
import { Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ConfigurationService, CaseConfiguration, NotificationSettings } from '../../services/configuration.service';
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
  approvalTiersError = '';

  editMode = false;
  editConfigId = '';

  createForm!: FormGroup;
  nodes: string[] = [];
  newNodeName = '';

  nodeWorkflows: { nodeName: string; bpmnFile: string }[] = [];
  substageEntries: { name: string; bpmnFile: string }[] = [];

  mainUploadStates: boolean[] = [];
  subUploadStates: boolean[] = [];
  mainUploadedStates: boolean[] = [];
  subUploadedStates: boolean[] = [];

  approvalTiers: {
    tierName: string;
    authorizedGroups: string[];
    authorizedUsers: string[];
    strictBinding: boolean;
    newGroup: string;
    newUser: string;
  }[] = [];

  addApprovalTier(): void {
    this.approvalTiers.push({ tierName: '', authorizedGroups: [], authorizedUsers: [], strictBinding: true, newGroup: '', newUser: '' });
    this.approvalTiersError = '';
  }

  removeApprovalTier(i: number): void {
    this.approvalTiers.splice(i, 1);
  }

  addGroupToTier(i: number): void {
    const val = this.approvalTiers[i].newGroup.trim().toUpperCase();
    if (val && !this.approvalTiers[i].authorizedGroups.includes(val)) {
      this.approvalTiers[i].authorizedGroups.push(val);
    }
    this.approvalTiers[i].newGroup = '';
  }

  removeGroupFromTier(i: number, j: number): void {
    this.approvalTiers[i].authorizedGroups.splice(j, 1);
  }

  addUserToTier(i: number): void {
    const val = this.approvalTiers[i].newUser.trim();
    if (val && !this.approvalTiers[i].authorizedUsers.includes(val)) {
      this.approvalTiers[i].authorizedUsers.push(val);
    }
    this.approvalTiers[i].newUser = '';
  }

  removeUserFromTier(i: number, j: number): void {
    this.approvalTiers[i].authorizedUsers.splice(j, 1);
  }

  private destroyRef = inject(DestroyRef);

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private configService: ConfigurationService,
    private tenantContext: TenantContextService
  ) {}

  ngOnInit(): void {
    const navState = history.state as { config?: CaseConfiguration; mode?: string };
    if (navState?.mode === 'edit' && navState?.config) {
      this.editMode = true;
      this.editConfigId = navState.config.id;
      this.initForm();
      this.prefillForm(navState.config);
    } else {
      this.initForm();
    }

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
      configPath:              ['', [Validators.required]],
      nodeName:                ['', [Validators.required]],
      currentDepthLevel:       [null, [Validators.required, Validators.min(1)]],
      globalSlaTimeoutMinutes: [null, [Validators.required, Validators.min(1)]],
      fallbackAdminUserId:     ['', [Validators.required]],
      fallbackAdminGroupId:    ['', [Validators.required]],
      notifyEnabled:           [false],
      notifyEmail:             ['', [Validators.email, Validators.pattern(/^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/)]],
      notifyMobile:            ['', [Validators.pattern(/^[6-9]\d{9}$/), Validators.maxLength(10)]],
      notifySMSChannel:        [false],
      notifyEmailChannel:      [false],
      notifyWhatsAppChannel:   [false]
    });
  }

  private prefillForm(config: CaseConfiguration): void {
    this.nodes = config.configPath ? config.configPath.split('.') : [];
    this.nodeWorkflows = this.nodes.map(node => ({
      nodeName: node,
      bpmnFile: config.workflowKeys?.[node] || ''
    }));

    const notify = config.notificationSettings;
    this.createForm.patchValue({
      configPath:              config.configPath,
      nodeName:                config.nodeName,
      currentDepthLevel:       config.currentDepthLevel,
      globalSlaTimeoutMinutes: config.globalSlaTimeoutMinutes,
      fallbackAdminUserId:     config.fallbackAdminUserId,
      fallbackAdminGroupId:    config.fallbackAdminGroupId,
      notifyEnabled:           notify?.enabled ?? false,
      notifyEmail:             notify?.targetEmailId ?? '',
      notifyMobile:            notify?.targetMobileNumber ?? '',
      notifySMSChannel:        notify?.channels?.includes('SMS') ?? false,
      notifyEmailChannel:      notify?.channels?.includes('EMAIL') ?? false,
      notifyWhatsAppChannel:   notify?.channels?.includes('WHATSAPP') ?? false
    });

    this.approvalTiers = (config.approvalSettings?.tiers || []).map(t => ({
      tierName:         t.tierName,
      authorizedGroups: [...(t.authorizedGroups || [])],
      authorizedUsers:  [...(t.authorizedUsers || [])],
      strictBinding:    t.strictBinding,
      newGroup:         '',
      newUser:          ''
    }));
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
        updated.push({ nodeName: node, bpmnFile: '' });
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
    this.mainUploadedStates[wIdx] = false;
    this.configService.deployBpmnFile(this.activeProductId, 'system_admin', file).subscribe({
      next: (res) => {
        this.mainUploadStates[wIdx] = false;
        if (res?.status === 'SUCCESS' && res?.resourceName) {
          this.nodeWorkflows[wIdx].bpmnFile = res.resourceName.replace(/\.(bpmn|xml)$/i, '');
          this.mainUploadedStates[wIdx] = true;
        } else {
          this.nodeWorkflows[wIdx].bpmnFile = file.name.replace(/\.(bpmn|xml)$/i, '');
        }
      },
      error: () => {
        this.mainUploadStates[wIdx] = false;
        this.nodeWorkflows[wIdx].bpmnFile = file.name.replace(/\.(bpmn|xml)$/i, '');
      }
    });
  }

  clearMainUpload(wIdx: number): void {
    this.nodeWorkflows[wIdx].bpmnFile = '';
    this.mainUploadedStates[wIdx] = false;
  }

  onSubstageBpmnUpload(event: Event, idx: number): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    const file = input.files[0];
    input.value = '';

    this.subUploadStates[idx] = true;
    this.subUploadedStates[idx] = false;
    this.configService.deployBpmnFile(this.activeProductId, 'system_admin', file).subscribe({
      next: (res) => {
        this.subUploadStates[idx] = false;
        if (res?.status === 'SUCCESS' && res?.resourceName) {
          this.substageEntries[idx].bpmnFile = res.resourceName.replace(/\.(bpmn|xml)$/i, '');
          this.subUploadedStates[idx] = true;
        } else {
          this.substageEntries[idx].bpmnFile = file.name.replace(/\.(bpmn|xml)$/i, '');
        }
      },
      error: () => {
        this.subUploadStates[idx] = false;
        this.substageEntries[idx].bpmnFile = file.name.replace(/\.(bpmn|xml)$/i, '');
      }
    });
  }

  clearSubUpload(idx: number): void {
    this.substageEntries[idx].bpmnFile = '';
    this.subUploadedStates[idx] = false;
  }

  onSubmit(): void {
    this.errorMessage = '';
    this.approvalTiersError = '';

    if (this.createForm.invalid) {
      this.createForm.markAllAsTouched();
      return;
    }

    if (this.approvalTiers.length === 0) {
      this.approvalTiersError = 'At least one approval tier is required.';
      return;
    }

    // Flush any pending group/user inputs that weren't explicitly added
    for (let i = 0; i < this.approvalTiers.length; i++) {
      if (this.approvalTiers[i].newGroup.trim()) this.addGroupToTier(i);
      if (this.approvalTiers[i].newUser.trim())  this.addUserToTier(i);
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
      configPath:              this.nodes.join('.'),
      nodeName:                formVal.nodeName,
      currentDepthLevel:       formVal.currentDepthLevel,
      globalSlaTimeoutMinutes: formVal.globalSlaTimeoutMinutes,
      fallbackAdminUserId:     formVal.fallbackAdminUserId,
      fallbackAdminGroupId:    formVal.fallbackAdminGroupId,
      workflowKeys,
      notificationSettings,
      approvalSettings: {
        totalRequiredLevels: this.approvalTiers.length,
        tiers: this.approvalTiers.map((t, idx) => ({
          level: idx + 1,
          tierName: t.tierName,
          authorizedGroups: t.authorizedGroups,
          authorizedUsers: t.authorizedUsers,
          strictBinding: t.strictBinding
        }))
      }
    };

    const request$ = this.editMode
      ? this.configService.updateCaseConfiguration(this.editConfigId, payload, this.activeProductId)
      : this.configService.createCaseConfiguration(this.activeProductId, payload);

    request$.subscribe({
      next: (res) => {
        this.isSubmitting = false;
        if (res.success || this.editMode) {
          this.router.navigate(['/case-config']);
        } else {
          this.errorMessage = res.message || 'Failed to create configuration.';
        }
      },
      error: (err) => {
        this.isSubmitting = false;
        this.errorMessage = this.editMode ? 'An error occurred while updating.' : 'An error occurred during workflow registration.';
        console.error(err);
      }
    });
  }

  cancel(): void {
    this.router.navigate(['/case-config']);
  }
}
