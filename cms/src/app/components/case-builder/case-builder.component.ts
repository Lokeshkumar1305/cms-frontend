import { Component, OnInit, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ConfigurationService, CaseConfiguration, NotificationSettings } from '../../services/configuration.service';
import { TenantContextService } from '../../services/tenant-context.service';

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

  createForm!: FormGroup;
  updateForm!: FormGroup;
  
  selectedConfigForUpdate: CaseConfiguration | null = null;
  isSubmitting = false;
  successMessage = '';
  errorMessage = '';

  // Routing path node management
  nodes: string[] = ['LOAN', 'RETAIL', 'EXPRESS'];
  newNodeName = '';

  // Workflow keys and BPMN mapping list
  nodeWorkflows: {
    nodeName: string;
    bpmnFile: string;
    substageOverrides: {
      substage: string;
      bpmnFile: string;
    }[];
  }[] = [
    {
      nodeName: 'LOAN',
      bpmnFile: 'universal-case-flow',
      substageOverrides: []
    },
    {
      nodeName: 'RETAIL',
      bpmnFile: '',
      substageOverrides: []
    },
    {
      nodeName: 'EXPRESS',
      bpmnFile: 'retail-express-flow',
      substageOverrides: []
    }
  ];

  private destroyRef = inject(DestroyRef);

  constructor(
    private fb: FormBuilder,
    private configService: ConfigurationService,
    private tenantContext: TenantContextService
  ) {}

  ngOnInit(): void {
    this.initForms();

    this.tenantContext.activeTenant$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(tenant => {
      if (tenant) {
        this.activeProductId = tenant.productId;
        this.activeProductName = tenant.productName;
        this.loadConfigurations();
      } else {
        this.activeProductId = '';
        this.activeProductName = '';
        this.configurations = [];
      }
      this.selectedConfigForUpdate = null;
    });
  }

  initForms(): void {
    // Create form initialized with standard mock data placeholders
    this.createForm = this.fb.group({
      configPath: ['LOAN.RETAIL.EXPRESS', [Validators.required]],
      nodeName: ['Retail Express Micro Pathway Node', [Validators.required]],
      currentDepthLevel: [3, [Validators.required, Validators.min(1)]],
      globalSlaTimeoutMinutes: [1440, [Validators.required, Validators.min(1)]],
      fallbackAdminUserId: ['retail_operations_manager', [Validators.required]],
      fallbackAdminGroupId: ['RETAIL_ADMIN_GP', [Validators.required]],
      
      // Notification settings
      notifyEnabled: [true],
      notifyEmail: ['retail-alerts@toucan.com', [Validators.email]],
      notifyMobile: ['+1234567890'],
      notifySMSChannel: [true],
      notifyEmailChannel: [true]
    });

    // Edit configuration form (Screen 2 Update specifications)
    this.updateForm = this.fb.group({
      nodeName: ['', [Validators.required]],
      globalSlaTimeoutMinutes: [720, [Validators.required, Validators.min(1)]],
      notifyEnabled: [false],
      notifyEmail: ['', [Validators.email]],
      notifyMobile: [''],
      notifySMSChannel: [false],
      notifyEmailChannel: [true]
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
    const compiledPath = this.nodes.join('.');
    this.createForm.patchValue({ configPath: compiledPath });
    this.syncWorkflows();
  }

  private syncWorkflows(): void {
    const updatedWorkflows: typeof this.nodeWorkflows = [];
    for (const node of this.nodes) {
      const existing = this.nodeWorkflows.find(w => w.nodeName === node);
      if (existing) {
        updatedWorkflows.push(existing);
      } else {
        let defaultBpmn = '';
        if (node === 'LOAN') defaultBpmn = 'universal-case-flow';
        if (node === 'EXPRESS') defaultBpmn = 'retail-express-flow';
        updatedWorkflows.push({
          nodeName: node,
          bpmnFile: defaultBpmn,
          substageOverrides: []
        });
      }
    }
    this.nodeWorkflows = updatedWorkflows;
  }

  addSubstageOverride(workflowIndex: number): void {
    this.nodeWorkflows[workflowIndex].substageOverrides.push({
      substage: '',
      bpmnFile: ''
    });
  }

  removeSubstageOverride(workflowIndex: number, overrideIndex: number): void {
    this.nodeWorkflows[workflowIndex].substageOverrides.splice(overrideIndex, 1);
  }

  loadConfigurations(): void {
    if (!this.activeProductId) return;
    this.configService.getConfigurationsByProduct(this.activeProductId).subscribe(list => {
      this.configurations = list;
    });
  }

  selectConfigForEdit(config: CaseConfiguration): void {
    this.selectedConfigForUpdate = config;
    
    // Set form details
    this.updateForm.setValue({
      nodeName: config.nodeName,
      globalSlaTimeoutMinutes: config.globalSlaTimeoutMinutes,
      notifyEnabled: config.notificationSettings.enabled,
      notifyEmail: config.notificationSettings.targetEmailId,
      notifyMobile: config.notificationSettings.targetMobileNumber,
      notifySMSChannel: config.notificationSettings.channels.includes('SMS'),
      notifyEmailChannel: config.notificationSettings.channels.includes('EMAIL')
    });
  }

  onCreateConfig(): void {
    this.successMessage = '';
    this.errorMessage = '';

    if (this.createForm.invalid) {
      this.createForm.markAllAsTouched();
      return;
    }

    this.isSubmitting = true;
    const formVal = this.createForm.value;

    // Build the request keys map dynamically
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

    // Build notification settings
    const channels: string[] = [];
    if (formVal.notifySMSChannel) channels.push('SMS');
    if (formVal.notifyEmailChannel) channels.push('EMAIL');

    const notificationSettings: NotificationSettings = {
      enabled: formVal.notifyEnabled,
      channels: channels,
      targetEmailId: formVal.notifyEmail,
      targetMobileNumber: formVal.notifyMobile
    };

    // Build approvalSettings tiers to match payload exactly
    const approvalSettings = {
      totalRequiredLevels: 2,
      tiers: [
        { level: 1, tierName: 'Automated Score Validation Check', authorizedGroups: ['EXPRESS_MAKER_GP'], strictBinding: true },
        { level: 2, tierName: 'Manager Final Audit Confirmation', authorizedGroups: ['EXPRESS_CHECKER_GP'], strictBinding: true }
      ]
    };

    const newConfig = {
      configPath: formVal.configPath,
      nodeName: formVal.nodeName,
      parentConfigurationId: null,
      currentDepthLevel: formVal.currentDepthLevel,
      globalSlaTimeoutMinutes: formVal.globalSlaTimeoutMinutes,
      fallbackAdminUserId: formVal.fallbackAdminUserId,
      fallbackAdminGroupId: formVal.fallbackAdminGroupId,
      workflowKeys: workflowKeys,
      approvalSettings: approvalSettings,
      notificationSettings: notificationSettings
    };

    this.configService.createCaseConfiguration(this.activeProductId, newConfig).subscribe({
      next: (res) => {
        this.isSubmitting = false;
        if (res.success) {
          this.successMessage = res.message;
          // Reset nodes and form state
          this.nodes = ['LOAN', 'RETAIL', 'EXPRESS'];
          this.newNodeName = '';
          this.syncWorkflows();
          this.createForm.reset({
            configPath: 'LOAN.RETAIL.EXPRESS',
            nodeName: 'Retail Express Micro Pathway Node',
            currentDepthLevel: 3,
            globalSlaTimeoutMinutes: 1440,
            fallbackAdminUserId: 'retail_operations_manager',
            fallbackAdminGroupId: 'RETAIL_ADMIN_GP',
            notifyEnabled: true,
            notifyEmail: 'retail-alerts@toucan.com',
            notifyMobile: '+1234567890',
            notifySMSChannel: true,
            notifyEmailChannel: true
          });
          this.loadConfigurations();
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
    if (formVal.notifySMSChannel) channels.push('SMS');
    if (formVal.notifyEmailChannel) channels.push('EMAIL');

    const notificationSettings: NotificationSettings = {
      enabled: formVal.notifyEnabled,
      channels: channels,
      targetEmailId: formVal.notifyEmail,
      targetMobileNumber: formVal.notifyMobile
    };

    const payload = {
      nodeName: formVal.nodeName,
      globalSlaTimeoutMinutes: formVal.globalSlaTimeoutMinutes,
      notificationSettings: notificationSettings
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
}
