import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface WorkflowKeys {
  [key: string]: string;
}

export type CommunicationChannel = 'EMAIL' | 'SMS' | 'WHATSAPP';
export type EscalationMode = 'DIRECT_TO_ADMIN' | 'ROUND_ROBIN' | 'RANDOM';

export interface UserDefinition {
  userId: string;
  fullName: string;
  email: string;
  mobileNumber: string;
  preferences: {
    EMAIL?: boolean;
    SMS?: boolean;
    WHATSAPP?: boolean;
  };
}

export interface ApprovalTier {
  level: number;
  tierName: string;
  authorizedGroups: string[];
  authorizedUsers: UserDefinition[];
  strictBinding: boolean;
  softReminderMinutes?: number;
  softReminderChannels?: CommunicationChannel[];
  hardSlaBreachMinutes?: number;
  hardSlaAction?: string;
}

export interface ApprovalSettings {
  totalRequiredLevels: number;
  tiers: ApprovalTier[];
  communicationRequired: boolean;
}

export interface EscalationStrategySettings {
  hardEscalationMode: EscalationMode;
}

export interface NotificationSettings {
  enabled: boolean;
  channels: CommunicationChannel[];
  targetEmailId: string;
  targetMobileNumber: string;
}

export interface CaseConfigurationChild {
  nodeName: string;
  currentDepthLevel: number;
  requiresCustomWorkflow?: boolean;
  workflowKey: string;
  children: CaseConfigurationChild[];
  approvalSettings?: ApprovalSettings;
}

export interface CaseConfiguration {
  id: string;
  productId: string;
  configPath: string;
  nodeName: string;
  parentConfigurationId?: string | null;
  currentDepthLevel: number;
  requiresCustomWorkflow?: boolean;
  globalSlaTimeoutMinutes?: number;
  fallbackAdminUserId: string;
  fallbackAdminGroupId: string;
  workflowKey: string;
  children?: CaseConfigurationChild[];
  approvalSettings: ApprovalSettings;
  notificationSettings: NotificationSettings;
  escalationStrategySettings?: EscalationStrategySettings;
  createdDate: string;
  lastModifiedDate: string;
  modifiedByUser: string;
}

@Injectable({
  providedIn: 'root'
})
export class ConfigurationService {
  private apiUrl = `${environment.apiUrl}/cms/configuration`;

  // In-memory mock database for case configurations
  private mockConfigs: CaseConfiguration[] = [
    {
      id: '6a2d0382079f626ec6259270',
      productId: 'PRD-D7F1A6A2',
      configPath: 'LOAN',
      nodeName: 'LOAN_ROOT',
      parentConfigurationId: null,
      currentDepthLevel: 0,
      globalSlaTimeoutMinutes: 1440,
      fallbackAdminUserId: 'retail_operations_manager',
      fallbackAdminGroupId: 'RETAIL_ADMIN_GP',
      workflowKey: 'universal-case-flow',
      children: [
        {
          nodeName: 'PERSONAL_LOAN',
          currentDepthLevel: 1,
          workflowKey: '',
          children: [
            {
              nodeName: 'UNSECURED',
              currentDepthLevel: 2,
              workflowKey: '',
              children: []
            }
          ]
        },
        {
          nodeName: 'MORTGAGE',
          currentDepthLevel: 1,
          workflowKey: 'special-mortgage-flow',
          children: [
            {
              nodeName: 'COMMERCIAL_PROPERTY',
              currentDepthLevel: 2,
              workflowKey: 'commercial-heavy-flow',
              children: []
            },
            {
              nodeName: 'RESIDENTIAL_PROPERTY',
              currentDepthLevel: 2,
              workflowKey: '',
              children: []
            }
          ]
        }
      ],
      approvalSettings: {
        totalRequiredLevels: 2,
        communicationRequired: true,
        tiers: [
          {
            level: 1,
            tierName: 'Automated Score Validation Check',
            authorizedGroups: ['EXPRESS_MAKER_GP'],
            authorizedUsers: [
              {
                userId: 'retail_agent_01',
                fullName: 'Ramana Yadavalli',
                email: 'ramana@toucanint.com',
                mobileNumber: '9999988888',
                preferences: { EMAIL: true, SMS: false, WHATSAPP: true }
              }
            ],
            strictBinding: true
          },
          {
            level: 2,
            tierName: 'Manager Final Audit Confirmation',
            authorizedGroups: ['EXPRESS_CHECKER_GP'],
            authorizedUsers: [
              {
                userId: 'retail_agent_02',
                fullName: 'Lokesh Kumar',
                email: 'lokesh@toucanint.com',
                mobileNumber: '8514785625',
                preferences: { EMAIL: false, SMS: true, WHATSAPP: false }
              }
            ],
            strictBinding: true
          }
        ]
      },
      notificationSettings: {
        enabled: true,
        channels: ['EMAIL', 'SMS', 'WHATSAPP'],
        targetEmailId: 'retail-alerts@toucan.com',
        targetMobileNumber: '+1234567890'
      },
      escalationStrategySettings: {
        hardEscalationMode: 'ROUND_ROBIN'
      },
      createdDate: '2026-06-15T10:21:14.067Z',
      lastModifiedDate: '2026-06-15T10:21:14.067Z',
      modifiedByUser: 'system_architect'
    }
  ];

  constructor(private http: HttpClient) {
    const cached = localStorage.getItem('mock_configs');
    if (cached) {
      this.mockConfigs = JSON.parse(cached);
    }
  }

  private saveToCache(): void {
    localStorage.setItem('mock_configs', JSON.stringify(this.mockConfigs));
  }

  // Get configuration nodes filtered by product tenant (POST /api/cms/configuration/search)
  getConfigurationsByProduct(productId: string, page: number = 1, size: number = 10, sortField: string = 'createdDate', sortOrder: 'ASC' | 'DESC' = 'DESC', userId = 'system_admin'): Observable<any> {
    const headers = new HttpHeaders()
      .set('Content-Type', 'application/json')
      .set('X-User-Id', userId)
      .set('X-Product-Id', productId);

    const payload = { criteriaList: [], page, size, sortField, sortOrder };

    return this.http.post<any>(`${this.apiUrl}/search`, payload, { headers }).pipe(
      map(res => {
        if (res && res.success && res.responseObject && Array.isArray(res.responseObject)) {
          for (const cfg of res.responseObject) {
            this.syncLocalConfig(cfg);
          }
        }
        return res;
      }),
      catchError(err => {
        console.warn('Backend API offline, utilizing mock configurations list.', err);
        const filtered = this.mockConfigs.filter(c => c.productId === productId);

        // Sort
        const sorted = [...filtered].sort((a, b) => {
          const valA = (a as any)[sortField] || '';
          const valB = (b as any)[sortField] || '';
          if (typeof valA === 'string' && typeof valB === 'string') {
            return sortOrder === 'ASC' ? valA.localeCompare(valB) : valB.localeCompare(valA);
          }
          return 0;
        });

        // Paginate
        const start = (page - 1) * size;
        const pageItems = sorted.slice(start, start + size);

        return of({
          success: true,
          message: pageItems.length > 0 ? 'Success' : 'No data found',
          responseObject: pageItems,
          statusCode: 200,
          totalCount: sorted.length
        });
      })
    );
  }

  // Create Case Configuration (POST http://localhost:8091/api/cms/configuration/create)
  createCaseConfiguration(productId: string, config: Omit<CaseConfiguration, 'id' | 'productId' | 'createdDate' | 'lastModifiedDate' | 'modifiedByUser'>, userId = 'system_admin', groupId = ''): Observable<any> {
    let headers = new HttpHeaders({
      'X-User-Id':    userId,
      'X-Product-Id': productId,
      'Content-Type': 'application/json'
    });
    if (groupId) headers = headers.set('X-Group-Id', groupId);

    const payload = {
      requestObject: config
    };

    return this.http.post<any>(`${this.apiUrl}/create`, payload, { headers }).pipe(
      map(res => {
        if (res && res.success) {
          const newConfig: CaseConfiguration = {
            ...config,
            id: res.responseObject?.id || Math.random().toString(16).substring(2, 14) + Math.random().toString(16).substring(2, 14),
            productId: productId,
            createdDate: res.responseObject?.createdDate || new Date().toISOString(),
            lastModifiedDate: res.responseObject?.lastModifiedDate || new Date().toISOString(),
            modifiedByUser: res.responseObject?.modifiedByUser || 'system_architect',
            ...(res.responseObject || {})
          };
          this.syncLocalConfig(newConfig);
          res.responseObject = newConfig;
        }
        return res;
      }),
      catchError(err => {
        console.warn('Backend API offline, utilizing mock configuration creator.', err);
        
        const mongoId = Math.random().toString(16).substring(2, 14) + Math.random().toString(16).substring(2, 14);
        
        const newConfig: CaseConfiguration = {
          ...config,
          id: mongoId,
          productId: productId,
          createdDate: new Date().toISOString(),
          lastModifiedDate: new Date().toISOString(),
          modifiedByUser: 'system_architect'
        };

        this.mockConfigs.push(newConfig);
        this.saveToCache();

        return of({
          success: true,
          message: 'Configuration created successfully (Mock Fallback)',
          responseObject: newConfig,
          statusCode: 201,
          totalCount: 1
        });
      })
    );
  }

  // Update Case Configuration (POST /api/cms/configuration/update)
  updateCaseConfiguration(configId: string, updateData: { [key: string]: any }, productId?: string, userId = 'system_admin', groupId = ''): Observable<any> {
    let headers = new HttpHeaders({
      'X-User-Id':    userId,
      'X-Product-Id': productId || '',
      'Content-Type': 'application/json'
    });
    if (groupId) headers = headers.set('X-Group-Id', groupId);

    const payload = {
      keyValue: configId,
      requestObject: updateData
    };

    return this.http.post<any>(`${this.apiUrl}/update`, payload, { headers }).pipe(
      map(res => {
        if (res && res.success) {
          const idx = this.mockConfigs.findIndex(c => c.id === configId);
          if (idx !== -1) {
            const current = this.mockConfigs[idx];
            const updated: CaseConfiguration = {
              ...current,
              ...updateData,
              ...(res.responseObject || {}),
              lastModifiedDate: new Date().toISOString()
            };
            this.mockConfigs[idx] = updated;
            this.saveToCache();
            res.responseObject = updated;
          } else if (res.responseObject) {
            this.syncLocalConfig(res.responseObject);
          }
        }
        return res;
      }),
      catchError(err => {
        console.warn('Backend API offline, executing mock configuration update.', err);
        
        const idx = this.mockConfigs.findIndex(c => c.id === configId);
        if (idx !== -1) {
          const current = this.mockConfigs[idx];
          const updated: CaseConfiguration = {
            ...current,
            ...updateData,
            lastModifiedDate: new Date().toISOString()
          };
          this.mockConfigs[idx] = updated;
          this.saveToCache();

          return of({
            success: true,
            message: 'Configuration updated successfully (Mock Fallback)',
            responseObject: updated,
            statusCode: 200,
            totalCount: 1
          });
        }

        return of({
          success: false,
          message: 'Target configuration not found in mock store.',
          statusCode: 404
        });
      })
    );
  }

  // Deploy BPMN file (POST /api/cms/process/deploy)
  deployBpmnFile(productId: string, userId: string, file: File): Observable<any> {
    const headers = new HttpHeaders()
      .set('X-Product-Id', productId)
      .set('X-User-Id', userId);

    const formData = new FormData();
    formData.append('file', file);

    return this.http.post<any>(`${environment.apiUrl}/cms/process/deploy`, formData, { headers }).pipe(
      catchError(err => {
        console.warn('BPMN deploy API failed:', err);
        return of({
          success: false,
          message: 'BPMN deploy failed'
        });
      })
    );
  }

  // Inquire Case Configuration (POST /api/cms/configuration/inq)
  inquireCaseConfiguration(configId: string, productId?: string, userId = 'system_admin'): Observable<any> {
    const headers = new HttpHeaders({
      'X-User-Id':    userId,
      'X-Product-Id': productId || '',
      'Content-Type': 'application/json'
    });

    const payload = {
      keyValue: configId
    };

    return this.http.post<any>(`${this.apiUrl}/inq`, payload, { headers }).pipe(
      catchError(err => {
        console.warn('Backend API offline, utilizing mock configuration inquirer.', err);
        const config = this.mockConfigs.find(c => c.id === configId);
        if (config) {
          return of({
            success: true,
            message: 'Configuration retrieved successfully (Mock Fallback)',
            responseObject: config,
            statusCode: 200
          });
        }
        return of({
          success: false,
          message: 'Target configuration not found in mock store.',
          statusCode: 404
        });
      })
    );
  }

  // Search Case Configurations (POST /api/cms/configuration/search)
  searchCaseConfigurations(criteria: any, productId?: string, userId = 'system_admin'): Observable<any> {
    const headers = new HttpHeaders({
      'X-User-Id':    userId,
      'X-Product-Id': productId || '',
      'Content-Type': 'application/json'
    });

    return this.http.post<any>(`${this.apiUrl}/search`, criteria, { headers }).pipe(
      catchError(err => {
        console.warn('Backend API offline, utilizing mock configuration search.', err);
        let results = [...this.mockConfigs];
        if (productId) {
          results = results.filter(c => c.productId === productId);
        }

        // Apply configPath filter if present
        const pathCriteria = criteria.criteriaList?.find((c: any) => c.field === 'configPath');
        if (pathCriteria) {
          if (pathCriteria.operator === 'EQUALS') {
            results = results.filter(c => c.configPath === pathCriteria.value);
          }
        }

        // Sort
        results.sort((a, b) => {
          const valA = (a as any)[criteria.sortField] || '';
          const valB = (b as any)[criteria.sortField] || '';
          if (typeof valA === 'string' && typeof valB === 'string') {
            return criteria.sortOrder === 'ASC' ? valA.localeCompare(valB) : valB.localeCompare(valA);
          }
          return 0;
        });

        // Paginate
        const start = (criteria.page - 1) * criteria.size;
        const pageItems = results.slice(start, start + criteria.size);

        return of({
          success: true,
          message: 'Search completed (Mock Fallback)',
          responseObject: pageItems,
          statusCode: 200,
          totalCount: results.length
        });
      })
    );
  }

  private syncLocalConfig(config: CaseConfiguration): void {
    const idx = this.mockConfigs.findIndex(c => c.id === config.id);
    if (idx !== -1) {
      this.mockConfigs[idx] = config;
    } else {
      this.mockConfigs.push(config);
    }
    this.saveToCache();
  }
}
