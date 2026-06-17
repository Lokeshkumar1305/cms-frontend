import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface CaseExternalMetadata {
  applicantName: string;
  requestedCapital: number;
  creditScore: number;
  tenorMonths: number;
}

export interface CaseHandOffContext {
  redirectUri: string;
  authToken: string;
  tokenExpiry: string;
}

export interface CaseHistoryEntry {
  levelActioned: number;
  tierName: string;
  actionTaken: string;
  actionedByUser: string;
  timestamp: string;
  comments: string;
}

export interface CaseWorkflow {
  id: string;
  caseId: string;
  productId: string;
  configPath: string;
  status: string;
  currentLevel: number;
  processInstanceKey: number;
  involvedUsers: string[];
  pendingGroups: string[];
  pendingUsers?: string[];
  history: CaseHistoryEntry[];
  createdByUser: string;
  createdDate: string;
  lastModifiedDate: string;
  externalMetadata?: CaseExternalMetadata;
  handOffContext?: CaseHandOffContext;
}

export interface CaseQueuePayload {
  page: number;
  size: number;
  sortField: string;
  sortOrder: 'ASC' | 'DESC';
}

export interface CaseSearchCriteria {
  field: string;
  operator: 'EQUALS' | 'LIKE' | 'GREATER_THAN' | 'LESS_THAN';
  value: any;
}

export interface CaseSearchPayload {
  page: number;
  size: number;
  criteriaList: CaseSearchCriteria[];
}

@Injectable({
  providedIn: 'root'
})
export class CaseService {
  private apiUrl = `${environment.apiUrl}/cms/cases`;

  // In-memory mock database for active workflow cases
  private mockCases: CaseWorkflow[] = [
    {
      id: '6a2d137bb3fafa076569f145',
      caseId: 'CMS-6678561B02F5',
      productId: 'PRD-D7F1A6A2',
      configPath: 'LOAN.RETAIL.EXPRESS',
      status: 'INITIATED',
      currentLevel: 1,
      processInstanceKey: 2251799813688003,
      externalMetadata: { applicantName: 'Ramana Yadavalli', requestedCapital: 35000, creditScore: 765, tenorMonths: 24 },
      handOffContext: { redirectUri: 'http://parent-bank-app/loans/retail/express/audit', authToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyZXRhaWxfYWdlbnRfMDEiOiJhdXRoIn0.signature', tokenExpiry: '2026-06-15T11:20:23.265Z' },
      involvedUsers: ['retail_agent_01'],
      pendingGroups: ['EXPRESS_MAKER_GP'],
      history: [{ levelActioned: 1, tierName: 'Ingestion', actionTaken: 'SYSTEM_STARTED', actionedByUser: 'retail_agent_01', timestamp: '2026-06-15T10:20:23.265Z', comments: 'Workflow started' }],
      createdByUser: 'retail_agent_01',
      createdDate: '2026-06-15T10:20:23.265Z',
      lastModifiedDate: '2026-06-15T10:20:23.265Z'
    },
    {
      id: '6a2d14bc4dafa178eef09822',
      caseId: 'CMS-7789452C14D1',
      productId: 'PRD-D7F1A6A2',
      configPath: 'LOAN.RETAIL.EXPRESS',
      status: 'IN_PROGRESS',
      currentLevel: 2,
      processInstanceKey: 2251799813688004,
      externalMetadata: { applicantName: 'Meera Deshmukh', requestedCapital: 120000, creditScore: 790, tenorMonths: 36 },
      handOffContext: { redirectUri: 'http://parent-bank-app/loans/retail/express/manager-audit', authToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyZXRhaWxfYWdlbnRfMDIiOiJhdXRoIn0.signature', tokenExpiry: '2026-06-15T12:00:00.000Z' },
      involvedUsers: ['retail_agent_01', 'retail_operations_manager'],
      pendingGroups: ['EXPRESS_CHECKER_GP'],
      history: [
        { levelActioned: 1, tierName: 'Ingestion', actionTaken: 'SYSTEM_STARTED', actionedByUser: 'retail_agent_01', timestamp: '2026-06-15T10:15:00.000Z', comments: 'Workflow started' },
        { levelActioned: 1, tierName: 'Automated Score Validation Check', actionTaken: 'TIER_1_APPROVED', actionedByUser: 'retail_agent_01', timestamp: '2026-06-15T10:30:00.000Z', comments: 'Credit score verified successfully.' }
      ],
      createdByUser: 'retail_agent_01',
      createdDate: '2026-06-15T10:15:00.000Z',
      lastModifiedDate: '2026-06-15T10:30:00.000Z'
    },
    {
      id: '6a2d15cd5ebfb289ffe1a933',
      caseId: 'CMS-9901274E35C8',
      productId: 'PRD-D7F1A6A2',
      configPath: 'LOAN.RETAIL.PREMIER',
      status: 'COMPLETED',
      currentLevel: 3,
      processInstanceKey: 2251799813688005,
      externalMetadata: { applicantName: 'Suresh Nambiar', requestedCapital: 250000, creditScore: 820, tenorMonths: 48 },
      handOffContext: { redirectUri: 'http://parent-bank-app/loans/retail/premier/audit', authToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.mock', tokenExpiry: '2026-06-14T18:00:00.000Z' },
      involvedUsers: ['retail_agent_02', 'retail_operations_manager', 'credit_head'],
      pendingGroups: [],
      history: [
        { levelActioned: 1, tierName: 'Ingestion', actionTaken: 'SYSTEM_STARTED', actionedByUser: 'retail_agent_02', timestamp: '2026-06-14T09:00:00.000Z', comments: 'Workflow started' },
        { levelActioned: 2, tierName: 'Credit Review', actionTaken: 'TIER_2_APPROVED', actionedByUser: 'retail_operations_manager', timestamp: '2026-06-14T11:30:00.000Z', comments: 'Credit report satisfactory.' },
        { levelActioned: 3, tierName: 'Final Sanctioning', actionTaken: 'TIER_3_APPROVED', actionedByUser: 'credit_head', timestamp: '2026-06-14T15:00:00.000Z', comments: 'Sanctioned and disbursed.' }
      ],
      createdByUser: 'retail_agent_02',
      createdDate: '2026-06-14T09:00:00.000Z',
      lastModifiedDate: '2026-06-14T15:00:00.000Z'
    },
    {
      id: '6a2d16de6fcgc39a00f2b044',
      caseId: 'CMS-3312185F46B9',
      productId: 'PRD-D7F1A6A2',
      configPath: 'LOAN.SME.STANDARD',
      status: 'COMPLETED',
      currentLevel: 2,
      processInstanceKey: 2251799813688006,
      externalMetadata: { applicantName: 'Priya Krishnaswamy', requestedCapital: 500000, creditScore: 755, tenorMonths: 60 },
      handOffContext: { redirectUri: 'http://parent-bank-app/loans/sme/standard/audit', authToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.mock2', tokenExpiry: '2026-06-13T17:00:00.000Z' },
      involvedUsers: ['sme_agent_01', 'sme_operations_manager'],
      pendingGroups: [],
      history: [
        { levelActioned: 1, tierName: 'Ingestion', actionTaken: 'SYSTEM_STARTED', actionedByUser: 'sme_agent_01', timestamp: '2026-06-13T10:00:00.000Z', comments: 'SME loan workflow initiated' },
        { levelActioned: 2, tierName: 'SME Risk Assessment', actionTaken: 'TIER_2_APPROVED', actionedByUser: 'sme_operations_manager', timestamp: '2026-06-13T14:00:00.000Z', comments: 'Business financials verified. Approved.' }
      ],
      createdByUser: 'sme_agent_01',
      createdDate: '2026-06-13T10:00:00.000Z',
      lastModifiedDate: '2026-06-13T14:00:00.000Z'
    },
    {
      id: '6a2d17ef7gdhd4ab11g3c155',
      caseId: 'CMS-5543296G57CA',
      productId: 'PRD-D7F1A6A2',
      configPath: 'LOAN.SME.STANDARD',
      status: 'FAILED',
      currentLevel: 1,
      processInstanceKey: 2251799813688007,
      externalMetadata: { applicantName: 'Vijay Raghunathan', requestedCapital: 750000, creditScore: 580, tenorMonths: 84 },
      handOffContext: { redirectUri: 'http://parent-bank-app/loans/sme/standard/audit', authToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.mock3', tokenExpiry: '2026-06-12T16:00:00.000Z' },
      involvedUsers: ['sme_agent_02'],
      pendingGroups: [],
      history: [
        { levelActioned: 1, tierName: 'Ingestion', actionTaken: 'SYSTEM_STARTED', actionedByUser: 'sme_agent_02', timestamp: '2026-06-12T09:00:00.000Z', comments: 'Workflow started' },
        { levelActioned: 1, tierName: 'Automated Score Validation Check', actionTaken: 'TIER_1_REJECTED', actionedByUser: 'sme_agent_02', timestamp: '2026-06-12T09:15:00.000Z', comments: 'Credit score below threshold. Auto-rejected.' }
      ],
      createdByUser: 'sme_agent_02',
      createdDate: '2026-06-12T09:00:00.000Z',
      lastModifiedDate: '2026-06-12T09:15:00.000Z'
    },
    {
      id: '6a2d18fg8hiei5bc22h4d266',
      caseId: 'CMS-2234107H68DB',
      productId: 'PRD-D7F1A6A2',
      configPath: 'LOAN.RETAIL.EXPRESS',
      status: 'IN_PROGRESS',
      currentLevel: 1,
      processInstanceKey: 2251799813688008,
      externalMetadata: { applicantName: 'Anita Venkataraman', requestedCapital: 80000, creditScore: 730, tenorMonths: 24 },
      handOffContext: { redirectUri: 'http://parent-bank-app/loans/retail/express/audit', authToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.mock4', tokenExpiry: '2026-06-15T20:00:00.000Z' },
      involvedUsers: ['retail_agent_03'],
      pendingGroups: ['EXPRESS_MAKER_GP'],
      history: [
        { levelActioned: 1, tierName: 'Ingestion', actionTaken: 'SYSTEM_STARTED', actionedByUser: 'retail_agent_03', timestamp: '2026-06-15T08:00:00.000Z', comments: 'Workflow started' }
      ],
      createdByUser: 'retail_agent_03',
      createdDate: '2026-06-15T08:00:00.000Z',
      lastModifiedDate: '2026-06-15T08:00:00.000Z'
    }
  ];

  constructor(private http: HttpClient) {
    const cached = localStorage.getItem('mock_cases');
    if (cached) {
      this.mockCases = JSON.parse(cached);
    }
  }

  private saveToCache(): void {
    localStorage.setItem('mock_cases', JSON.stringify(this.mockCases));
  }

  // Fetch Dynamic Workspace Queue (POST http://192.168.100.61:8091/api/cms/cases/getall)
  getWorkspaceQueue(productId: string, payload: CaseQueuePayload, groupId = '', userId = ''): Observable<any> {
    const headers = new HttpHeaders()
      .set('Content-Type', 'application/json')
      .set('X-User-Id', userId || 'system_admin')
      .set('X-Product-Id', productId)
      .set('X-Group-IDs', groupId);

    return this.http.post<any>(`${this.apiUrl}/getall`, { ...payload }, { headers }).pipe(
      catchError(err => {
        console.warn('Backend API offline, executing mock workspace queue retrieval.', err);
        
        // Filter cases by the active tenant
        const filtered = this.mockCases.filter(c => c.productId === productId);
        
        // Sort
        const sorted = filtered.sort((a, b) => {
          const field = payload.sortField as keyof CaseWorkflow;
          const valA = a[field];
          const valB = b[field];
          if (typeof valA === 'string' && typeof valB === 'string') {
            return payload.sortOrder === 'ASC' ? valA.localeCompare(valB) : valB.localeCompare(valA);
          }
          return 0;
        });

        // Paginate
        const start = (payload.page - 1) * payload.size;
        const pageItems = sorted.slice(start, start + payload.size);

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

  // Search Active Workspace Silos (POST http://192.168.100.61:8091/api/cms/cases/search)
  searchCases(productId: string, payload: CaseSearchPayload, groupId = '', userId = ''): Observable<any> {
    const headers = new HttpHeaders()
      .set('Content-Type', 'application/json')
      .set('X-User-Id', userId || 'system_admin')
      .set('X-Product-Id', productId)
      .set('X-Group-IDs', groupId);

    return this.http.post<any>(`${this.apiUrl}/search`, { ...payload }, { headers }).pipe(
      catchError(err => {
        console.warn('Backend API offline, applying mock criteria-based search filters.', err);
        
        // Filter cases by product first
        let results = this.mockCases.filter(c => c.productId === productId);

        // Apply filters in criteria list
        for (const criteria of payload.criteriaList) {
          if (!criteria.value) continue;

          results = results.filter(item => {
            const field = criteria.field as keyof CaseWorkflow;
            
            // Check status or configPath or search inside metadata
            if (field === 'status') {
              return criteria.operator === 'EQUALS' 
                ? item.status === criteria.value
                : item.status.toLowerCase().includes(criteria.value.toLowerCase());
            }
            if (field === 'configPath') {
              return criteria.operator === 'LIKE'
                ? item.configPath.toLowerCase().includes(criteria.value.toLowerCase())
                : item.configPath === criteria.value;
            }
            if (criteria.field === 'applicantName') {
              return item.externalMetadata?.applicantName?.toLowerCase().includes(criteria.value.toLowerCase()) ?? false;
            }
            return true;
          });
        }

        // Paginate
        const start = (payload.page - 1) * payload.size;
        const pageItems = results.slice(start, start + payload.size);

        return of({
          success: true,
          message: 'Success',
          responseObject: pageItems,
          statusCode: 200,
          totalCount: results.length
        });
      })
    );
  }

  // Dashboard summary — returns status breakdown + 5 most recent cases for a product
  getCaseSummary(productId: string): Observable<{
    total: number; initiated: number; inProgress: number; completed: number; failed: number;
    recentCases: CaseWorkflow[];
  }> {
    const headers = new HttpHeaders()
      .set('Content-Type', 'application/json')
      .set('X-User-Id', 'retail_agent_01')
      .set('X-Product-Id', productId);
    return this.http.post<any>(`${this.apiUrl}/getall`, { page: 1, size: 100, sortField: 'createdDate', sortOrder: 'DESC' }, { headers }).pipe(
      map(res => this.buildSummary(res.responseObject || [])),
      catchError(() => {
        const filtered = this.mockCases.filter(c => c.productId === productId);
        return of(this.buildSummary(filtered));
      })
    );
  }

  private buildSummary(cases: CaseWorkflow[]) {
    const sorted = [...cases].sort((a, b) => new Date(b.createdDate).getTime() - new Date(a.createdDate).getTime());
    return {
      total: cases.length,
      initiated: cases.filter(c => c.status === 'INITIATED').length,
      inProgress: cases.filter(c => c.status === 'IN_PROGRESS').length,
      completed: cases.filter(c => c.status === 'COMPLETED').length,
      failed: cases.filter(c => c.status === 'FAILED').length,
      recentCases: sorted.slice(0, 6)
    };
  }

  // Create case workflow (POST /api/cms/cases/create)
  createCase(productId: string, userId: string, configPath: string, substage?: string, transactionPayload?: { [key: string]: any }, groupId = ''): Observable<any> {
    const headers = new HttpHeaders({
      'X-User-Id':    userId,
      'X-Product-Id': productId,
      'X-Group-IDs':  groupId,
      'Content-Type': 'application/json'
    });

    const requestObject: any = { configPath };
    if (substage?.trim()) requestObject['substage'] = substage.trim();
    if (transactionPayload && Object.keys(transactionPayload).length > 0) {
      requestObject['transactionPayload'] = transactionPayload;
    }

    return this.http.post<any>(`${environment.apiUrl}/cms/cases/create`, { requestObject }, { headers }).pipe(
      catchError(err => {
        console.warn('Case create API failed, using mock fallback:', err);
        return of({ success: false, message: 'API unavailable' });
      })
    );
  }

  // Add dummy case trigger (facilitates UI validation check)
  addNewMockCase(productId: string, configPath: string, applicantName: string, capital: number, score: number): void {
    const randomHex = Math.random().toString(16).substring(2, 14).toUpperCase();
    const mongoId = Math.random().toString(16).substring(2, 14) + Math.random().toString(16).substring(2, 14);

    const newCase: CaseWorkflow = {
      id: mongoId,
      caseId: `CMS-${randomHex}`,
      productId: productId,
      configPath: configPath || 'LOAN.RETAIL.EXPRESS',
      status: 'INITIATED',
      currentLevel: 1,
      processInstanceKey: Math.floor(Math.random() * 900000000000000) + 1000000000000000,
      externalMetadata: {
        applicantName: applicantName,
        requestedCapital: capital,
        creditScore: score,
        tenorMonths: 36
      },
      handOffContext: {
        redirectUri: 'http://parent-bank-app/loans/retail/express/audit',
        authToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyZXRhaWxfYWdlbnRfMDEiOiJhdXRoIn0.mockSignature',
        tokenExpiry: new Date(Date.now() + 3600 * 1000).toISOString()
      },
      involvedUsers: ['retail_agent_01'],
      pendingGroups: ['EXPRESS_MAKER_GP'],
      history: [
        {
          levelActioned: 1,
          tierName: 'Ingestion',
          actionTaken: 'SYSTEM_STARTED',
          actionedByUser: 'retail_agent_01',
          timestamp: new Date().toISOString(),
          comments: 'Workflow started via provisioning form.'
        }
      ],
      createdByUser: 'retail_agent_01',
      createdDate: new Date().toISOString(),
      lastModifiedDate: new Date().toISOString()
    };

    this.mockCases.unshift(newCase);
    this.saveToCache();
  }
}
