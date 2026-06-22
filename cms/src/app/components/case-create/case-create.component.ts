import { Component, OnInit, DestroyRef, inject, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ConfigurationService, CaseConfiguration, NotificationSettings, UserDefinition, CommunicationChannel } from '../../services/configuration.service';
import { TenantContextService } from '../../services/tenant-context.service';

export interface TreeNode {
  nodeName: string;
  currentDepthLevel: number;
  workflowKey: string;
  children: TreeNode[];
  bpmnFileName?: string;
}

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

  activeStep = 1;
  visitedSteps = new Set<number>();

  goToStep(step: number): void {
    if (step >= 1 && step <= 5) {
      this.visitedSteps.add(this.activeStep);
      this.activeStep = step;
    }
  }

  nextStep(): void {
    if (this.activeStep < 5) {
      this.visitedSteps.add(this.activeStep);
      this.activeStep++;
    }
  }

  prevStep(): void {
    if (this.activeStep > 1) {
      this.visitedSteps.add(this.activeStep);
      this.activeStep--;
    }
  }

  isStepComplete(step: number): boolean {
    if (!this.createForm) return false;
    switch (step) {
      case 1: return ['productId', 'userId'].every(c => this.createForm.get(c)?.valid);
      case 2: return ['nodeName', 'globalSlaTimeoutMinutes'].every(c => this.createForm.get(c)?.valid);
      case 3: return ['hardEscalationMode', 'fallbackAdminUserId'].every(c => this.createForm.get(c)?.valid);
      case 4: {
        const f = this.createForm;
        if (!f.get('notifyEnabled')?.value) return false;
        return !!(f.get('notifySMSChannel')?.value || f.get('notifyEmailChannel')?.value || f.get('notifyWhatsAppChannel')?.value);
      }
      case 5: return this.approvalTiers.length > 0 && this.approvalTiers.every(t => t.tierName.trim().length > 0);
      default: return false;
    }
  }

  findInvalidStep(): number | null {
    const s1 = ['productId', 'userId'];
    const s2 = ['nodeName', 'globalSlaTimeoutMinutes'];
    const s3 = ['hardEscalationMode', 'fallbackAdminUserId', 'fallbackAdminGroupId'];
    const s4 = ['notifyEnabled', 'notifyEmail', 'notifyMobile'];

    for (const ctrl of s1) {
      if (this.createForm.get(ctrl)?.invalid) return 1;
    }
    for (const ctrl of s2) {
      if (this.createForm.get(ctrl)?.invalid) return 2;
    }
    for (const ctrl of s3) {
      if (this.createForm.get(ctrl)?.invalid) return 3;
    }
    for (const ctrl of s4) {
      if (this.createForm.get(ctrl)?.invalid) return 4;
    }
    if (this.approvalTiers.length === 0) return 5;
    return null;
  }

  editMode = false;
  editConfigId = '';

  rootBpmnFileName = '';
  rootBpmnUploading = false;

  createForm!: FormGroup;
  children: TreeNode[] = [];

  get liveConfigPath(): string { return this.createForm?.get('configPath')?.value || ''; }
  get liveNodeName():   string { return this.createForm?.get('nodeName')?.value   || ''; }

  get maxTreeDepth(): number {
    const depth = (nodes: TreeNode[]): number =>
      nodes.length ? 1 + Math.max(...nodes.map(n => depth(n.children))) : 0;
    return depth(this.children);
  }

  get totalDepth(): number {
    return this.maxTreeDepth + 1;
  }

  approvalTiers: {
    tierName: string;
    authorizedGroups: string[];
    authorizedUsers: UserDefinition[];
    strictBinding: boolean;
    newGroup: string;
    newUserId: string;
    newUserFullName: string;
    newUserEmail: string;
    newUserMobileNumber: string;
    newUserPrefEmail: boolean;
    newUserPrefSMS: boolean;
    newUserPrefWhatsApp: boolean;
  }[] = [];

  addApprovalTier(): void {
    this.approvalTiers.push({
      tierName: '',
      authorizedGroups: [],
      authorizedUsers: [],
      strictBinding: false,
      newGroup: '',
      newUserId: '',
      newUserFullName: '',
      newUserEmail: '',
      newUserMobileNumber: '',
      newUserPrefEmail: false,
      newUserPrefSMS: false,
      newUserPrefWhatsApp: false
    });
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
    const tier = this.approvalTiers[i];
    const userId = tier.newUserId.trim();
    const fullName = tier.newUserFullName.trim();
    const email = tier.newUserEmail.trim();
    const mobileNumber = tier.newUserMobileNumber.trim();
    if (!userId) return;

    if (tier.authorizedUsers.some(u => u.userId === userId)) {
      return;
    }

    const newUser: UserDefinition = {
      userId,
      fullName,
      email,
      mobileNumber,
      preferences: {
        EMAIL: tier.newUserPrefEmail,
        SMS: tier.newUserPrefSMS,
        WHATSAPP: tier.newUserPrefWhatsApp
      }
    };

    tier.authorizedUsers.push(newUser);

    tier.newUserId = '';
    tier.newUserFullName = '';
    tier.newUserEmail = '';
    tier.newUserMobileNumber = '';
    tier.newUserPrefEmail = false;
    tier.newUserPrefSMS = false;
    tier.newUserPrefWhatsApp = false;
  }

  removeUserFromTier(i: number, j: number): void {
    this.approvalTiers[i].authorizedUsers.splice(j, 1);
  }

  private destroyRef = inject(DestroyRef);

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private configService: ConfigurationService,
    private tenantContext: TenantContextService,
    public cdr: ChangeDetectorRef
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
      this.addApprovalTier();
    }

    this.createForm.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.cdr.detectChanges();
    });

    this.tenantContext.activeTenant$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(tenant => {
      if (tenant) {
        this.activeProductId = tenant.productId;
        this.activeProductName = tenant.productName;
        if (!this.createForm.get('productId')?.value) {
          this.createForm.patchValue({ productId: tenant.productId });
        }
      } else {
        this.activeProductId = '';
        this.activeProductName = '';
      }
    });
  }

  initForm(): void {
    this.createForm = this.fb.group({
      productId:               ['', [Validators.required]],
      userId:                  ['', [Validators.required]],
      configPath:              ['', [Validators.required]],
      nodeName:                ['', [Validators.required]],
      currentDepthLevel:       [0],
      globalSlaTimeoutMinutes: [null, [Validators.required, Validators.min(1)]],
      fallbackAdminUserId:     ['', [Validators.required]],
      fallbackAdminGroupId:    ['', [Validators.required]],
      notifyEnabled:           [false],
      notifyEmail:             ['', [Validators.email, Validators.pattern(/^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/)]],
      notifyMobile:            ['', [Validators.pattern(/^[6-9]\d{9}$/), Validators.maxLength(10)]],
      notifySMSChannel:        [false],
      notifyEmailChannel:      [false],
      notifyWhatsAppChannel:   [false],
      communicationRequired:   [false],
      hardEscalationMode:      ['ROUND_ROBIN', [Validators.required]],
      workflowKey:             ['']
    });

  }

  private mapConfigChildren(children: any[]): TreeNode[] {
    return children.map(c => ({
      nodeName:          c.nodeName,
      currentDepthLevel: c.currentDepthLevel,
      workflowKey:       c.workflowKey || '',
      children:          this.mapConfigChildren(c.children || [])
    }));
  }

  private prefillForm(config: CaseConfiguration): void {
    this.children = this.mapConfigChildren(config.children || []);

    const notify = config.notificationSettings;
    this.createForm.patchValue({
      productId:               config.productId || '',
      userId:                  'system_admin',
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
      notifyWhatsAppChannel:   notify?.channels?.includes('WHATSAPP') ?? false,
      communicationRequired:   config.approvalSettings?.communicationRequired ?? false,
      hardEscalationMode:      config.escalationStrategySettings?.hardEscalationMode || 'ROUND_ROBIN',
      workflowKey:             config.workflowKey || ''
    });

    this.approvalTiers = (config.approvalSettings?.tiers || []).map(t => ({
      tierName:         t.tierName,
      authorizedGroups: [...(t.authorizedGroups || [])],
      authorizedUsers:  (t.authorizedUsers || []).map(u => ({
        userId: u.userId,
        fullName: u.fullName || '',
        email: u.email || '',
        mobileNumber: u.mobileNumber || '',
        preferences: {
          EMAIL: u.preferences?.EMAIL ?? false,
          SMS: u.preferences?.SMS ?? false,
          WHATSAPP: u.preferences?.WHATSAPP ?? false
        }
      })),
      strictBinding:    t.strictBinding ?? false,
      newGroup:         '',
      newUserId:        '',
      newUserFullName:  '',
      newUserEmail:     '',
      newUserMobileNumber: '',
      newUserPrefEmail: false,
      newUserPrefSMS:   false,
      newUserPrefWhatsApp: false
    }));
  }

  addTreeNodeChild(parent: TreeNode): void {
    if (!parent.children) {
      parent.children = [];
    }
    parent.children.push({
      nodeName: '',
      currentDepthLevel: parent.currentDepthLevel + 1,
      workflowKey: '',
      children: []
    });
    this.cdr.detectChanges();
  }

  addRootChildNode(): void {
    this.children.push({
      nodeName: '',
      currentDepthLevel: 1,
      workflowKey: '',
      children: []
    });
    this.cdr.detectChanges();
  }

  removeTreeNode(parentList: TreeNode[], idx: number): void {
    parentList.splice(idx, 1);
    this.cdr.detectChanges();
  }

  depthBadgeStyle(depth: number): { [key: string]: string } {
    const palette: Record<number, [string, string]> = {
      1: ['rgba(124,58,237,0.1)', '#7c3aed'],
      2: ['rgba(217,119,6,0.1)',  '#d97706'],
      3: ['rgba(22,163,74,0.1)',  '#16a34a'],
      4: ['rgba(13,124,102,0.1)', '#0d7c66'],
    };
    const [bg, color] = palette[depth] ?? ['rgba(107,119,148,0.1)', '#6b7794'];
    return {
      background: bg,
      color,
      border: `1px solid ${color}40`
    };
  }

  onTreeNodeBpmnSelect(event: Event, node: TreeNode): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    const file = input.files[0];
    input.value = '';
    node.bpmnFileName = 'Uploading...';
    this.cdr.detectChanges();

    this.configService.deployBpmnFile(
      this.createForm.get('productId')?.value || this.activeProductId,
      this.createForm.get('userId')?.value    || 'system_admin',
      file
    ).subscribe({
      next: (res) => {
        if (res?.status === 'SUCCESS' && res?.resourceName) {
          node.workflowKey  = res.resourceName.replace(/\.(bpmn|xml)$/i, '');
          node.bpmnFileName = res.resourceName;
        } else {
          node.workflowKey  = file.name.replace(/\.(bpmn|xml)$/i, '');
          node.bpmnFileName = file.name;
        }
        this.cdr.detectChanges();
      },
      error: () => {
        node.workflowKey  = file.name.replace(/\.(bpmn|xml)$/i, '');
        node.bpmnFileName = file.name;
        this.cdr.detectChanges();
      }
    });
  }

  clearNodeBpmn(node: TreeNode): void {
    node.workflowKey  = '';
    node.bpmnFileName = '';
    this.cdr.detectChanges();
  }

  onRootBpmnSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    const file = input.files[0];
    input.value = '';
    this.rootBpmnUploading = true;
    this.rootBpmnFileName  = 'Uploading...';

    this.configService.deployBpmnFile(
      this.createForm.get('productId')?.value || this.activeProductId,
      this.createForm.get('userId')?.value    || 'system_admin',
      file
    ).subscribe({
      next: (res) => {
        this.rootBpmnUploading = false;
        const key = (res?.status === 'SUCCESS' && res?.resourceName)
          ? res.resourceName.replace(/\.(bpmn|xml)$/i, '')
          : file.name.replace(/\.(bpmn|xml)$/i, '');
        const displayName = (res?.status === 'SUCCESS' && res?.resourceName) ? res.resourceName : file.name;
        this.createForm.patchValue({ workflowKey: key });
        this.rootBpmnFileName = displayName;
      },
      error: () => {
        this.rootBpmnUploading = false;
        this.createForm.patchValue({ workflowKey: file.name.replace(/\.(bpmn|xml)$/i, '') });
        this.rootBpmnFileName = file.name;
      }
    });
  }

  clearRootBpmn(): void {
    this.rootBpmnFileName = '';
    this.createForm.patchValue({ workflowKey: '' });
  }

  onSubmit(): void {
    this.errorMessage = '';
    this.approvalTiersError = '';

    if (this.createForm.invalid) {
      this.createForm.markAllAsTouched();
      const errorStep = this.findInvalidStep();
      if (errorStep !== null) {
        this.activeStep = errorStep;
      }
      return;
    }

    if (this.approvalTiers.length === 0) {
      this.approvalTiersError = 'At least one approval tier is required.';
      this.activeStep = 5;
      return;
    }

    // Flush any pending group/user inputs that weren't explicitly added
    for (let i = 0; i < this.approvalTiers.length; i++) {
      if (this.approvalTiers[i].newGroup.trim()) this.addGroupToTier(i);
      if (this.approvalTiers[i].newUserId.trim())  this.addUserToTier(i);
    }

    this.isSubmitting = true;
    const formVal = this.createForm.value;
    const productId: string = formVal.productId || this.activeProductId;
    const userId: string    = formVal.userId    || 'system_admin';

    const channels: CommunicationChannel[] = [];
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
      currentDepthLevel:       0,
      globalSlaTimeoutMinutes: formVal.globalSlaTimeoutMinutes,
      fallbackAdminUserId:     formVal.fallbackAdminUserId,
      fallbackAdminGroupId:    formVal.fallbackAdminGroupId,
      workflowKey:             formVal.workflowKey,
      children:                this.children,
      notificationSettings,
      escalationStrategySettings: {
        hardEscalationMode: formVal.hardEscalationMode
      },
      approvalSettings: {
        totalRequiredLevels: this.approvalTiers.length,
        communicationRequired: formVal.communicationRequired,
        tiers: this.approvalTiers.map((t, idx) => ({
          level: idx + 1,
          tierName: t.tierName,
          authorizedGroups: t.authorizedGroups,
          authorizedUsers: t.authorizedUsers.map(u => ({
            userId: u.userId,
            fullName: u.fullName,
            email: u.email,
            mobileNumber: u.mobileNumber,
            preferences: {
              EMAIL: formVal.communicationRequired ? !!u.preferences?.EMAIL : false,
              SMS: formVal.communicationRequired ? !!u.preferences?.SMS : false,
              WHATSAPP: formVal.communicationRequired ? !!u.preferences?.WHATSAPP : false
            }
          })),
          strictBinding: t.strictBinding ?? false
        }))
      }
    };

    const request$ = this.editMode
      ? this.configService.updateCaseConfiguration(this.editConfigId, payload, productId, userId)
      : this.configService.createCaseConfiguration(productId, payload, userId);

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
