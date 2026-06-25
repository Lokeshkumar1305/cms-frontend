import { Component, OnInit, DestroyRef, inject, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ConfigurationService, CaseConfiguration, NotificationSettings, UserDefinition, CommunicationChannel } from '../../services/configuration.service';
import { TenantContextService } from '../../services/tenant-context.service';

export interface ApprovalTierState {
  tierName: string;
  strictBinding: boolean;
  authorizedGroups: string[];
  authorizedUsers: UserDefinition[];
  softReminderMinutes: number | null;
  softReminderChannels: { EMAIL: boolean; SMS: boolean; WHATSAPP: boolean };
  hardSlaBreachMinutes: number | null;
  hardSlaAction: string;
  newGroup: string;
  newUserId: string;
  newUserFullName: string;
  newUserEmail: string;
  newUserMobileNumber: string;
  newUserPrefEmail: boolean;
  newUserPrefSMS: boolean;
  newUserPrefWhatsApp: boolean;
}

export interface TreeNode {
  nodeName: string;
  currentDepthLevel: number;
  requiresCustomWorkflow: boolean;
  workflowKey: string;
  children: TreeNode[];
  communicationRequired?: boolean;
  tiers?: ApprovalTierState[];
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

  readonly hardSlaActions = [
    { value: 'ROTATE_ROUND_ROBIN',          label: 'Rotate Round Robin' },
    { value: 'ROTATE_RANDOM',               label: 'Rotate Random' },
    { value: 'ESCALATE_TO_FALLBACK_ADMIN',  label: 'Escalate to Fallback Admin' },
    { value: 'AUTO_APPROVE',                label: 'Auto Approve' }
  ];

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
      case 2: return ['nodeName', 'configPath'].every(c => this.createForm.get(c)?.valid);
      case 3: return ['fallbackAdminUserId', 'fallbackAdminGroupId'].every(c => this.createForm.get(c)?.valid);
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
    const s2 = ['nodeName', 'configPath'];
    const s3 = ['fallbackAdminUserId', 'fallbackAdminGroupId'];
    const s4 = ['notifyEnabled', 'notifyEmail', 'notifyMobile'];

    for (const ctrl of s1) { if (this.createForm.get(ctrl)?.invalid) return 1; }
    for (const ctrl of s2) { if (this.createForm.get(ctrl)?.invalid) return 2; }
    for (const ctrl of s3) { if (this.createForm.get(ctrl)?.invalid) return 3; }
    for (const ctrl of s4) { if (this.createForm.get(ctrl)?.invalid) return 4; }
    if (this.approvalTiers.length === 0) return 5;
    return null;
  }

  editMode = false;
  editConfigId = '';
  createForm!: FormGroup;
  children: TreeNode[] = [];

  get liveConfigPath(): string { return this.createForm?.get('configPath')?.value || ''; }
  get liveNodeName():   string { return this.createForm?.get('nodeName')?.value   || ''; }

  get maxTreeDepth(): number {
    const depth = (nodes: TreeNode[]): number =>
      nodes.length ? 1 + Math.max(...nodes.map(n => depth(n.children))) : 0;
    return depth(this.children);
  }

  get totalDepth(): number { return this.maxTreeDepth + 1; }

  approvalTiers: ApprovalTierState[] = [];

  createBlankTierState(): ApprovalTierState {
    return {
      tierName: '', strictBinding: false,
      authorizedGroups: [], authorizedUsers: [],
      softReminderMinutes: null,
      softReminderChannels: { EMAIL: false, SMS: false, WHATSAPP: false },
      hardSlaBreachMinutes: null,
      hardSlaAction: 'ROTATE_ROUND_ROBIN',
      newGroup: '', newUserId: '', newUserFullName: '',
      newUserEmail: '', newUserMobileNumber: '',
      newUserPrefEmail: false, newUserPrefSMS: false, newUserPrefWhatsApp: false
    };
  }

  addApprovalTier(): void {
    this.approvalTiers.push(this.createBlankTierState());
    this.approvalTiersError = '';
  }

  removeApprovalTier(i: number): void { this.approvalTiers.splice(i, 1); }

  addGroupToTier(i: number): void {
    const val = this.approvalTiers[i].newGroup.trim().toUpperCase();
    if (val && !this.approvalTiers[i].authorizedGroups.includes(val)) {
      this.approvalTiers[i].authorizedGroups.push(val);
    }
    this.approvalTiers[i].newGroup = '';
  }

  removeGroupFromTier(i: number, j: number): void { this.approvalTiers[i].authorizedGroups.splice(j, 1); }

  toggleTierChannel(i: number, ch: 'EMAIL' | 'SMS' | 'WHATSAPP'): void {
    this.approvalTiers[i].softReminderChannels[ch] = !this.approvalTiers[i].softReminderChannels[ch];
    this.cdr.detectChanges();
  }

  addUserToTier(i: number): void {
    const tier = this.approvalTiers[i];
    const userId = tier.newUserId.trim();
    if (!userId || tier.authorizedUsers.some(u => u.userId === userId)) return;
    tier.authorizedUsers.push({
      userId, fullName: tier.newUserFullName.trim(),
      email: tier.newUserEmail.trim(), mobileNumber: tier.newUserMobileNumber.trim(),
      preferences: { EMAIL: tier.newUserPrefEmail, SMS: tier.newUserPrefSMS, WHATSAPP: tier.newUserPrefWhatsApp }
    });
    tier.newUserId = tier.newUserFullName = tier.newUserEmail = tier.newUserMobileNumber = '';
    tier.newUserPrefEmail = tier.newUserPrefSMS = tier.newUserPrefWhatsApp = false;
  }

  removeUserFromTier(i: number, j: number): void { this.approvalTiers[i].authorizedUsers.splice(j, 1); }

  // ── Per-node tier management ─────────────────────────────────────────────

  toggleNodeCustomWorkflow(node: TreeNode): void {
    node.requiresCustomWorkflow = !node.requiresCustomWorkflow;
    if (node.requiresCustomWorkflow && (!node.tiers || node.tiers.length === 0)) {
      node.tiers = [this.createBlankTierState()];
      node.communicationRequired = false;
    }
    this.cdr.detectChanges();
  }

  addNodeTier(node: TreeNode): void {
    if (!node.tiers) node.tiers = [];
    node.tiers.push(this.createBlankTierState());
    this.cdr.detectChanges();
  }

  removeNodeTier(node: TreeNode, i: number): void {
    node.tiers?.splice(i, 1);
    this.cdr.detectChanges();
  }

  addGroupToNodeTier(node: TreeNode, i: number): void {
    const tier = node.tiers![i];
    const val = tier.newGroup.trim().toUpperCase();
    if (val && !tier.authorizedGroups.includes(val)) tier.authorizedGroups.push(val);
    tier.newGroup = '';
  }

  removeGroupFromNodeTier(node: TreeNode, i: number, j: number): void {
    node.tiers![i].authorizedGroups.splice(j, 1);
  }

  addUserToNodeTier(node: TreeNode, i: number): void {
    const tier = node.tiers![i];
    const userId = tier.newUserId.trim();
    if (!userId || tier.authorizedUsers.some(u => u.userId === userId)) return;
    tier.authorizedUsers.push({
      userId, fullName: tier.newUserFullName.trim(),
      email: tier.newUserEmail.trim(), mobileNumber: tier.newUserMobileNumber.trim(),
      preferences: { EMAIL: tier.newUserPrefEmail, SMS: tier.newUserPrefSMS, WHATSAPP: tier.newUserPrefWhatsApp }
    });
    tier.newUserId = tier.newUserFullName = tier.newUserEmail = tier.newUserMobileNumber = '';
    tier.newUserPrefEmail = tier.newUserPrefSMS = tier.newUserPrefWhatsApp = false;
  }

  removeUserFromNodeTier(node: TreeNode, i: number, j: number): void {
    node.tiers![i].authorizedUsers.splice(j, 1);
  }

  // ────────────────────────────────────────────────────────────────────────

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
      productId:              ['', [Validators.required]],
      userId:                 ['', [Validators.required]],
      configPath:             ['', [Validators.required]],
      nodeName:               ['', [Validators.required]],
      currentDepthLevel:      [0],
      fallbackAdminUserId:    ['', [Validators.required]],
      fallbackAdminGroupId:   ['', [Validators.required]],
      notifyEnabled:          [false],
      notifyEmail:            ['', [Validators.email, Validators.pattern(/^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/)]],
      notifyMobile:           ['', [Validators.pattern(/^[6-9]\d{9}$/), Validators.maxLength(10)]],
      notifySMSChannel:       [false],
      notifyEmailChannel:     [false],
      notifyWhatsAppChannel:  [false],
      communicationRequired:  [false]
    });
  }

  private mapConfigChildren(children: any[]): TreeNode[] {
    return children.map(c => {
      const node: TreeNode = {
        nodeName:               c.nodeName,
        currentDepthLevel:      c.currentDepthLevel,
        requiresCustomWorkflow: c.requiresCustomWorkflow ?? false,
        workflowKey:            c.workflowKey || '',
        children:               this.mapConfigChildren(c.children || [])
      };
      if (c.requiresCustomWorkflow && c.approvalSettings) {
        node.communicationRequired = c.approvalSettings.communicationRequired ?? false;
        node.tiers = (c.approvalSettings.tiers || []).map((t: any) => ({
          tierName:         t.tierName,
          strictBinding:    t.strictBinding ?? false,
          authorizedGroups: [...(t.authorizedGroups || [])],
          authorizedUsers:  (t.authorizedUsers || []).map((u: any) => ({
            userId: u.userId, fullName: u.fullName || '',
            email: u.email || '', mobileNumber: u.mobileNumber || '',
            preferences: { EMAIL: u.preferences?.EMAIL ?? false, SMS: u.preferences?.SMS ?? false, WHATSAPP: u.preferences?.WHATSAPP ?? false }
          })),
          softReminderMinutes:  t.softReminderMinutes ?? null,
          softReminderChannels: {
            EMAIL:    (t.softReminderChannels || []).includes('EMAIL'),
            SMS:      (t.softReminderChannels || []).includes('SMS'),
            WHATSAPP: (t.softReminderChannels || []).includes('WHATSAPP')
          },
          hardSlaBreachMinutes: t.hardSlaBreachMinutes ?? null,
          hardSlaAction:        t.hardSlaAction || 'ROTATE_ROUND_ROBIN',
          newGroup: '', newUserId: '', newUserFullName: '', newUserEmail: '',
          newUserMobileNumber: '', newUserPrefEmail: false, newUserPrefSMS: false, newUserPrefWhatsApp: false
        } as ApprovalTierState));
      }
      return node;
    });
  }

  private prefillForm(config: CaseConfiguration): void {
    this.children = this.mapConfigChildren(config.children || []);
    const notify = config.notificationSettings;
    this.createForm.patchValue({
      productId:              config.productId || '',
      userId:                 'system_admin',
      configPath:             config.configPath,
      nodeName:               config.nodeName,
      currentDepthLevel:      config.currentDepthLevel,
      fallbackAdminUserId:    config.fallbackAdminUserId,
      fallbackAdminGroupId:   config.fallbackAdminGroupId,
      notifyEnabled:          notify?.enabled ?? false,
      notifyEmail:            notify?.targetEmailId ?? '',
      notifyMobile:           notify?.targetMobileNumber ?? '',
      notifySMSChannel:       notify?.channels?.includes('SMS') ?? false,
      notifyEmailChannel:     notify?.channels?.includes('EMAIL') ?? false,
      notifyWhatsAppChannel:  notify?.channels?.includes('WHATSAPP') ?? false,
      communicationRequired:  config.approvalSettings?.communicationRequired ?? false
    });

    this.approvalTiers = (config.approvalSettings?.tiers || []).map(t => ({
      tierName:         t.tierName,
      strictBinding:    t.strictBinding ?? false,
      authorizedGroups: [...(t.authorizedGroups || [])],
      authorizedUsers:  (t.authorizedUsers || []).map(u => ({
        userId: u.userId, fullName: u.fullName || '',
        email: u.email || '', mobileNumber: u.mobileNumber || '',
        preferences: { EMAIL: u.preferences?.EMAIL ?? false, SMS: u.preferences?.SMS ?? false, WHATSAPP: u.preferences?.WHATSAPP ?? false }
      })),
      softReminderMinutes:  (t as any).softReminderMinutes ?? null,
      softReminderChannels: {
        EMAIL:    ((t as any).softReminderChannels || []).includes('EMAIL'),
        SMS:      ((t as any).softReminderChannels || []).includes('SMS'),
        WHATSAPP: ((t as any).softReminderChannels || []).includes('WHATSAPP')
      },
      hardSlaBreachMinutes: (t as any).hardSlaBreachMinutes ?? null,
      hardSlaAction:        (t as any).hardSlaAction || 'ROTATE_ROUND_ROBIN',
      newGroup: '', newUserId: '', newUserFullName: '', newUserEmail: '',
      newUserMobileNumber: '', newUserPrefEmail: false, newUserPrefSMS: false, newUserPrefWhatsApp: false
    } as ApprovalTierState));
  }

  addTreeNodeChild(parent: TreeNode): void {
    if (!parent.children) parent.children = [];
    parent.children.push({
      nodeName: '', currentDepthLevel: parent.currentDepthLevel + 1,
      requiresCustomWorkflow: false, workflowKey: '', children: []
    });
    this.cdr.detectChanges();
  }

  addRootChildNode(): void {
    this.children.push({
      nodeName: '', currentDepthLevel: 1,
      requiresCustomWorkflow: false, workflowKey: '', children: []
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
    return { background: bg, color, border: `1px solid ${color}40` };
  }

  private buildTiers(tiers: ApprovalTierState[], commRequired: boolean): any[] {
    return tiers.map((t, idx) => {
      const slaChannels: CommunicationChannel[] = [];
      if (t.softReminderChannels.EMAIL)    slaChannels.push('EMAIL');
      if (t.softReminderChannels.SMS)      slaChannels.push('SMS');
      if (t.softReminderChannels.WHATSAPP) slaChannels.push('WHATSAPP');
      return {
        level:            idx + 1,
        tierName:         t.tierName,
        strictBinding:    t.strictBinding ?? false,
        authorizedGroups: t.authorizedGroups,
        authorizedUsers:  t.authorizedUsers.map(u => ({
          userId:       u.userId,
          fullName:     u.fullName,
          email:        u.email,
          mobileNumber: u.mobileNumber,
          preferences: {
            EMAIL:    commRequired ? !!u.preferences?.EMAIL    : false,
            SMS:      commRequired ? !!u.preferences?.SMS      : false,
            WHATSAPP: commRequired ? !!u.preferences?.WHATSAPP : false
          }
        })),
        softReminderMinutes:  t.softReminderMinutes  ?? 0,
        softReminderChannels: slaChannels,
        hardSlaBreachMinutes: t.hardSlaBreachMinutes ?? 0,
        hardSlaAction:        t.hardSlaAction
      };
    });
  }

  private buildChildren(nodes: TreeNode[]): any[] {
    return nodes.map(n => {
      const child: any = {
        nodeName:          n.nodeName,
        currentDepthLevel: n.currentDepthLevel,
        workflowKey:       n.workflowKey || '',
        children:          this.buildChildren(n.children || [])
      };
      if (n.requiresCustomWorkflow && n.tiers && n.tiers.length > 0) {
        const commRequired = n.communicationRequired ?? false;
        child.approvalSettings = {
          totalRequiredLevels:   n.tiers.length,
          communicationRequired: commRequired,
          tiers:                 this.buildTiers(n.tiers, commRequired)
        };
      }
      return child;
    });
  }

  onSubmit(): void {
    this.errorMessage = '';
    this.approvalTiersError = '';

    if (this.createForm.invalid) {
      this.createForm.markAllAsTouched();
      const errorStep = this.findInvalidStep();
      if (errorStep !== null) this.activeStep = errorStep;
      return;
    }

    if (this.approvalTiers.length === 0) {
      this.approvalTiersError = 'At least one approval tier is required.';
      this.activeStep = 5;
      return;
    }

    for (let i = 0; i < this.approvalTiers.length; i++) {
      if (this.approvalTiers[i].newGroup.trim())  this.addGroupToTier(i);
      if (this.approvalTiers[i].newUserId.trim()) this.addUserToTier(i);
    }

    this.isSubmitting = true;
    const formVal    = this.createForm.value;
    const productId  = formVal.productId || this.activeProductId;
    const userId     = formVal.userId    || 'system_admin';

    const channels: CommunicationChannel[] = [];
    if (formVal.notifySMSChannel)      channels.push('SMS');
    if (formVal.notifyEmailChannel)    channels.push('EMAIL');
    if (formVal.notifyWhatsAppChannel) channels.push('WHATSAPP');

    const notificationSettings: NotificationSettings = {
      enabled:           formVal.notifyEnabled,
      channels,
      targetEmailId:     formVal.notifyEmail,
      targetMobileNumber: formVal.notifyMobile
    };

    const payload = {
      configPath:              formVal.configPath,
      nodeName:                formVal.nodeName,
      currentDepthLevel:       0,
      workflowKey:             '',
      fallbackAdminUserId:     formVal.fallbackAdminUserId,
      fallbackAdminGroupId:    formVal.fallbackAdminGroupId,
      notificationSettings,
      approvalSettings: {
        totalRequiredLevels:   this.approvalTiers.length,
        communicationRequired: formVal.communicationRequired,
        tiers:                 this.buildTiers(this.approvalTiers, formVal.communicationRequired)
      },
      children: this.buildChildren(this.children)
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
