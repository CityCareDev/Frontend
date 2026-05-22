import { Component, OnInit } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { Navbar } from '../shared/navbar';
import { AuthService } from '../services/auth.service';
import { FacilityService } from '../services/facility.service';
import { PatientService } from '../services/patient.service';
import { EmergencyService } from '../services/emergency.service';
import { ToastService } from '../services/toast.service';
import { ActivatedRoute, Router } from '@angular/router';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-compliance',
  imports: [FormsModule, ReactiveFormsModule, Navbar, DatePipe],
  templateUrl: './compliance.html',
  styleUrl: './compliance.css',
})
export class ComplianceDashboard implements OnInit {
  activeTab = 'overview';
  complianceRecords: any[] = [];
  audits: any[] = [];
  auditLogs: any[] = [];
  facilities: any[] = [];
  patients: any[] = [];
  emergencies: any[] = [];
  entityOptions: any[] = [];

  // Overview analytics
  auditTrend7d: Array<{ dateKey: string; label: string; initiated: number; completed: number }> = [];
  pendingValidations: any[] = [];
  recentComplianceActivity: Array<{ message: string; timestamp: Date; severity: 'info' | 'warning' | 'success' }> = [];
  overviewKpis = {
    openAudits: 0,
    completedAudits: 0,
    pendingRecords: 0,
    logs7d: 0,
  };

  recordForm!: FormGroup;
  auditForm!: FormGroup;
  entityTypes = ['FACILITY', 'PATIENT', 'EMERGENCY'];
  resultOptions: Array<{ value: string; label: string }> = [
    { value: 'COMPLIANT', label: 'Compliant' },
    { value: 'NON_COMPLIANT', label: 'Non-compliant' },
    { value: 'UNDER_REVIEW', label: 'Under Review' }
  ];

  errorMsg = '';
  isCreatingRecord = false;
  isInitiatingAudit = false;

  private get headers() {
    return new HttpHeaders({ Authorization: `Bearer ${this.auth.getToken()}` });
  }

  constructor(
    private http: HttpClient,
    public auth: AuthService,
    private facilityService: FacilityService,
    private patientService: PatientService,
    private emergencyService: EmergencyService,
    private toastService: ToastService,
    private route: ActivatedRoute,
    private router: Router,
    private fb: FormBuilder
  ) {
    this.initForms();
  }

  private initForms() {
    this.recordForm = this.fb.group({
      entityId: ['', [Validators.required]],
      type: ['', Validators.required],
      result: ['', Validators.required],
      date: [this.currentDateInputValue(), Validators.required],
      notes: ['']
    });
    this.recordForm.get('type')!.valueChanges.subscribe(type => this.onEntityTypeChange(type));
    this.auditForm = this.fb.group({
      scope: ['', Validators.required],
      date: [this.currentDateInputValue(), Validators.required],
      findings: ['']
    });
  }

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      if (params['tab']) {
        this.activeTab = params['tab'];
        this.handleTabChange(this.activeTab);
      }
    });

    this.loadRecords();
    this.loadAudits();
    this.loadLogs();
    this.loadFacilities();
    this.loadPatients();
    this.loadEmergencies();
  }

  setTab(tab: string) {
    if (this.activeTab === tab) return;
    this.activeTab = tab;
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: tab },
      queryParamsHandling: 'merge'
    });
  }

  private handleTabChange(tab: string) {
    if (tab === 'records') this.loadRecords();
    if (tab === 'audits') this.loadAudits();
    if (tab === 'logs') this.loadLogs();
  }

  loadRecords() {
    this.http.get<any>(`${environment.apiBaseUrl}/compliance/records`, { headers: this.headers })
      .subscribe({
        next: d => {
          const payload = d?.data ?? d;
          this.complianceRecords = Array.isArray(payload) ? payload : (payload?.content ?? []);
          this.refreshOverviewInsights();
        },
        error: () => {
          this.complianceRecords = [];
          this.refreshOverviewInsights();
        }
      });
  }

  loadAudits() {
    this.http.get<any>(`${environment.apiBaseUrl}/compliance/audits`, { headers: this.headers })
      .subscribe({
        next: d => {
          const payload = d?.data ?? d;
          this.audits = Array.isArray(payload) ? payload : (payload?.content ?? []);
          this.refreshOverviewInsights();
        },
        error: () => {
          this.audits = [];
          this.refreshOverviewInsights();
        }
      });
  }

  loadLogs() {
    this.http.get<any>(`${environment.apiBaseUrl}/compliance/logs`, { headers: this.headers })
      .subscribe({
        next: d => {
          const payload = d?.data ?? d;
          this.auditLogs = Array.isArray(payload) ? payload : (payload?.content ?? []);
          this.refreshOverviewInsights();
        },
        error: () => {
          this.auditLogs = [];
          this.refreshOverviewInsights();
        }
      });
  }

  loadFacilities() {
    this.facilityService.getAllFacilities().subscribe({
      next: d => { this.facilities = d; this.onEntityTypeChange(this.recordForm.get('type')!.value); },
      error: () => {}
    });
  }

  loadPatients() {
    this.patientService.getAllPatients().subscribe({
      next: d => { this.patients = d; this.onEntityTypeChange(this.recordForm.get('type')!.value); },
      error: () => {}
    });
  }

  loadEmergencies() {
    this.emergencyService.getAllEmergencies().subscribe({
      next: d => { this.emergencies = d; this.onEntityTypeChange(this.recordForm.get('type')!.value); },
      error: () => {}
    });
  }

  onEntityTypeChange(type: string) {
    this.recordForm.get('entityId')!.setValue('');
    if (type === 'FACILITY') {
      this.entityOptions = this.facilities.map(f => ({ id: f.facilityId, label: f.name }));
    } else if (type === 'PATIENT') {
      this.entityOptions = this.patients.map(p => ({ id: p.patientId, label: `#${p.patientId} - ${p.name || 'Patient'} (${p.status})` }));
    } else if (type === 'EMERGENCY') {
      this.entityOptions = this.emergencies.map(e => ({ id: e.emergencyId, label: `#${e.emergencyId} - ${e.type} (${e.date || e.reportedAt})` }));
    } else {
      this.entityOptions = [];
    }
  }

  createRecord() {
    if (this.isCreatingRecord) return;
    if (this.recordForm.invalid) {
      this.recordForm.markAllAsTouched();
      this.toastService.showError('Please fill all required fields correctly');
      return;
    }
    this.isCreatingRecord = true;
    this.http.post<any>(`${environment.apiBaseUrl}/compliance/records`, this.recordForm.value, { headers: this.headers })
      .subscribe({
        next: () => { this.isCreatingRecord = false; this.recordForm.reset({ entityId: '', type: '', result: '', date: this.currentDateInputValue(), notes: '' }); this.entityOptions = []; this.loadRecords(); this.toastService.showSuccess('Compliance record created successfully'); },
        error: (err) => { this.isCreatingRecord = false; this.toastService.showError(err.error?.message || 'Failed to create record') }
      });
  }

  initiateAudit() {
    if (this.isInitiatingAudit) return;
    if (this.auditForm.invalid) {
      this.auditForm.markAllAsTouched();
      this.toastService.showError('Please fill all required fields correctly');
      return;
    }
    this.isInitiatingAudit = true;
    this.http.post<any>(`${environment.apiBaseUrl}/compliance/audits`, this.auditForm.value, { headers: this.headers })
      .subscribe({
        next: () => { this.isInitiatingAudit = false; this.auditForm.reset({ scope: '', date: this.currentDateInputValue(), findings: '' }); this.loadAudits(); this.toastService.showSuccess('Audit initiated successfully'); },
        error: (err) => { this.isInitiatingAudit = false; this.toastService.showError(err.error?.message || 'Failed to initiate audit') }
      });
  }

  private currentDateInputValue(): string {
    const now = new Date();
    const tzOffset = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - tzOffset).toISOString().slice(0, 10);
  }

  private refreshOverviewInsights() {
    this.buildOverviewKpis();
    this.buildAuditTrend7d();
    this.buildPendingValidations();
    this.buildRecentComplianceActivity();
  }

  private buildOverviewKpis() {
    const openStatuses = new Set(['INITIATED', 'IN_PROGRESS', 'PENDING']);
    const completedStatuses = new Set(['COMPLETED']);
    const pendingRecordStatuses = new Set(['PENDING', 'IN_PROGRESS', 'INITIATED']);
    const attentionResults = new Set(['FAILED', 'NEEDS_REVIEW', 'NON_COMPLIANT']);
    const rangeStart = new Date();
    rangeStart.setHours(0, 0, 0, 0);
    rangeStart.setDate(rangeStart.getDate() - 6);

    this.overviewKpis = {
      openAudits: this.audits.filter(a => openStatuses.has(String(a?.status ?? '').toUpperCase())).length,
      completedAudits: this.audits.filter(a => completedStatuses.has(String(a?.status ?? '').toUpperCase())).length,
      pendingRecords: this.complianceRecords.filter(r => {
        const status = String(r?.status ?? '').toUpperCase();
        const result = String(r?.result ?? '').toUpperCase();
        return pendingRecordStatuses.has(status) || attentionResults.has(result);
      }).length,
      logs7d: this.auditLogs.filter(l => {
        const dt = this.tryParseDate(l?.timestamp ?? l?.createdDate ?? l?.date);
        return !!dt && dt >= rangeStart;
      }).length,
    };
  }

  private buildAuditTrend7d() {
    const now = new Date();
    const buckets: Array<{ dateKey: string; label: string; initiated: number; completed: number }> = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      buckets.push({
        dateKey: this.toDateKey(d),
        label: d.toLocaleDateString(undefined, { weekday: 'short' }),
        initiated: 0,
        completed: 0,
      });
    }
    const map = new Map(buckets.map(b => [b.dateKey, b]));

    this.audits.forEach(a => {
      const initiated = this.tryParseDate(a?.initiatedDate ?? a?.date ?? a?.createdDate);
      if (initiated) {
        const bucket = map.get(this.toDateKey(initiated));
        if (bucket) bucket.initiated += 1;
      }

      const completed = this.tryParseDate(a?.completedDate);
      if (completed) {
        const bucket = map.get(this.toDateKey(completed));
        if (bucket) bucket.completed += 1;
      }
    });

    this.auditTrend7d = buckets;
  }

  private buildPendingValidations() {
    const pendingRecordStatuses = new Set(['PENDING', 'IN_PROGRESS', 'INITIATED']);
    const attentionResults = new Set(['FAILED', 'NEEDS_REVIEW', 'NON_COMPLIANT']);

    this.pendingValidations = this.complianceRecords
      .filter(r => {
        const status = String(r?.status ?? '').toUpperCase();
        const result = String(r?.result ?? '').toUpperCase();
        return pendingRecordStatuses.has(status) || attentionResults.has(result);
      })
      .sort((a, b) => {
        const aTime = this.tryParseDate(a?.recordedDate ?? a?.date)?.getTime() ?? 0;
        const bTime = this.tryParseDate(b?.recordedDate ?? b?.date)?.getTime() ?? 0;
        return bTime - aTime;
      })
      .slice(0, 8);
  }

  private buildRecentComplianceActivity() {
    const events: Array<{ message: string; timestamp: Date; severity: 'info' | 'warning' | 'success' }> = [];

    this.complianceRecords.forEach(r => {
      const ts = this.tryParseDate(r?.recordedDate ?? r?.date);
      if (!ts) return;
      const result = String(r?.result ?? '').toUpperCase();
      events.push({
        message: `Record #${r?.complianceId ?? '?'} for ${r?.type ?? 'ENTITY'}:${r?.entityId ?? '?'} marked ${r?.result ?? 'UPDATED'}`,
        timestamp: ts,
        severity: result === 'PASSED' || result === 'COMPLIANT' ? 'success' : (result === 'FAILED' || result === 'NON_COMPLIANT' ? 'warning' : 'info'),
      });
    });

    this.audits.forEach(a => {
      const initiated = this.tryParseDate(a?.initiatedDate ?? a?.date);
      if (initiated) {
        events.push({
          message: `Audit #${a?.auditId ?? '?'} initiated (${a?.scope ?? 'General scope'})`,
          timestamp: initiated,
          severity: 'info',
        });
      }

      const completed = this.tryParseDate(a?.completedDate);
      if (completed) {
        events.push({
          message: `Audit #${a?.auditId ?? '?'} completed`,
          timestamp: completed,
          severity: 'success',
        });
      }
    });

    this.auditLogs.forEach(l => {
      const ts = this.tryParseDate(l?.timestamp ?? l?.date);
      if (!ts) return;
      events.push({
        message: `Log #${l?.logId ?? l?.auditId ?? '?'}: ${l?.action ?? 'Action'} ${l?.resource ? `on ${l.resource}` : ''}`,
        timestamp: ts,
        severity: 'info',
      });
    });

    this.recentComplianceActivity = events
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 16);
  }

  getAuditTrendBarHeight(value: number, field: 'initiated' | 'completed'): number {
    const max = Math.max(...this.auditTrend7d.map(x => x.initiated + x.completed), 1);
    if (field === 'initiated') {
      return Math.max((value / max) * 100, value > 0 ? 10 : 4);
    }
    return Math.max((value / max) * 100, value > 0 ? 8 : 0);
  }

  formatActivityTime(date: Date): string {
    const diffMs = Date.now() - date.getTime();
    const mins = Math.floor(diffMs / (1000 * 60));
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  }

  getActivitySeverityClass(severity: 'info' | 'warning' | 'success'): string {
    if (severity === 'warning') return 'warning';
    if (severity === 'success') return 'success';
    return 'info';
  }

  getAuditTimelineLogs() {
    return [...this.auditLogs].sort((a, b) => {
      const aTime = this.tryParseDate(a?.timestamp ?? a?.date ?? a?.createdDate)?.getTime() ?? 0;
      const bTime = this.tryParseDate(b?.timestamp ?? b?.date ?? b?.createdDate)?.getTime() ?? 0;
      return bTime - aTime;
    });
  }

  getAuditLogKind(log: any): 'dispatch' | 'admission' | 'audit' | 'record' | 'generic' {
    const action = String(log?.action ?? '').toLowerCase();
    const resource = String(log?.resource ?? '').toLowerCase();
    const combined = `${action} ${resource}`;

    if (combined.includes('dispatch') || combined.includes('emergency')) return 'dispatch';
    if (combined.includes('admit') || combined.includes('patient')) return 'admission';
    if (combined.includes('audit')) return 'audit';
    if (combined.includes('record') || combined.includes('compliance')) return 'record';
    return 'generic';
  }

  getAuditLogTitle(log: any): string {
    const action = String(log?.action ?? '').toUpperCase();
    switch (action) {
      case 'CREATE_COMPLIANCE_RECORD':
        return 'Created a compliance record';
      case 'CREATE_AUDIT':
        return 'Initiated an audit';
      case 'UPDATE_AUDIT_STATUS':
        return 'Updated an audit status';
      case 'VIEW_COMPLIANCE_RECORD':
        return 'Opened a compliance record';
      case 'VIEW_AUDIT':
        return 'Opened an audit';
      case 'LIST_COMPLIANCE_RECORDS':
      case 'LIST_COMPLIANCE_RECORDS_BY_ENTITY':
      case 'LIST_COMPLIANCE_RECORDS_BY_TYPE':
        return 'Viewed compliance records';
      case 'LIST_AUDITS':
        return 'Viewed audits';
      case 'LIST_AUDIT_LOGS':
      case 'LIST_AUDIT_LOGS_BY_USER':
        return 'Viewed audit logs';
      default:
        return 'Compliance activity';
    }
  }

  getAuditLogDescription(log: any): string {
    const action = String(log?.action ?? '').toUpperCase();
    const actor = this.getReadableActor(log);
    const target = this.getReadableResource(log?.resource);

    if (action === 'CREATE_COMPLIANCE_RECORD') {
      return `${actor} created ${target}.`;
    }
    if (action === 'CREATE_AUDIT') {
      return `${actor} initiated ${target}.`;
    }
    if (action === 'UPDATE_AUDIT_STATUS') {
      const status = this.extractStatusFromResource(log?.resource);
      return status
        ? `${actor} updated ${target} to ${status}.`
        : `${actor} updated ${target}.`;
    }
    if (action.startsWith('VIEW_') || action.startsWith('LIST_')) {
      return `${actor} viewed ${target}.`;
    }

    return `${actor} performed an action on ${target}.`;
  }

  getAuditLogTimestamp(log: any): Date {
    return this.tryParseDate(log?.timestamp ?? log?.date ?? log?.createdDate) ?? new Date(0);
  }

  private getReadableActor(log: any): string {
    const actorId = log?.userId;
    if (!actorId) return 'System';

    const currentUserId = this.auth.getUser()?.userId ?? this.auth.getUser()?.id;
    if (currentUserId && Number(currentUserId) === Number(actorId)) return 'You';
    return `Compliance Officer #${actorId}`;
  }

  private getReadableResource(resourceRaw: any): string {
    const resource = String(resourceRaw ?? '').trim();
    if (!resource) return 'the system';

    if (resource === 'compliance_records') return 'all compliance records';
    if (resource === 'audits') return 'all audits';
    if (resource === 'audit_logs') return 'audit logs';

    if (resource.startsWith('compliance_records/entity/')) {
      const id = resource.split('/').pop();
      return `compliance records for entity #${id}`;
    }

    if (resource.startsWith('compliance_records/type/')) {
      const type = resource.split('/').pop() ?? '';
      return `${type.replace(/_/g, ' ').toLowerCase()} compliance records`;
    }

    if (resource.startsWith('compliance_records/')) {
      const id = resource.split('/').pop();
      return `compliance record #${id}`;
    }

    if (resource.startsWith('audit_logs/user/')) {
      const id = resource.split('/').pop();
      return `audit logs for user #${id}`;
    }

    if (resource.startsWith('audits/')) {
      const [path] = resource.split('?');
      const id = path.split('/').pop();
      return `audit #${id}`;
    }

    return resource.replace(/[_/]/g, ' ').toLowerCase();
  }

  private extractStatusFromResource(resourceRaw: any): string | null {
    const resource = String(resourceRaw ?? '');
    const query = resource.split('?')[1] ?? '';
    const statusPair = query.split('&').find(pair => pair.startsWith('status='));
    if (!statusPair) return null;
    const status = statusPair.split('=')[1] ?? '';
    if (!status) return null;
    return status.replace(/_/g, ' ').toLowerCase();
  }

  private tryParseDate(value: any): Date | null {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  private toDateKey(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
