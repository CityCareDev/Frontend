import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { DatePipe } from '@angular/common';
import { Navbar } from '../shared/navbar';
import { AuthService } from '../services/auth.service';
import { EmergencyService } from '../services/emergency.service';
import { Emergency } from '../../models/emergency.model';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastService } from '../services/toast.service';
import { finalize, Subscription } from 'rxjs';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-dispatcher',
  imports: [FormsModule, CommonModule, Navbar, DatePipe],
  templateUrl: './dispatcher.html',
  styleUrl: './dispatcher.css',
})
export class DispatcherDashboard implements OnInit {
  activeTab = 'overview';
  pendingEmergencies: Emergency[] = [];
  dispatchedEmergencies: any[] = [];
  availableAmbulances: any[] = [];
  dispatchingEmergencyId: number | null = null;
  isSubmitting = false;
  private dispatchRequestSub: Subscription | null = null;
  private staffFacilityId: number | null = null;
  staffFacilityName: string = '';

  // Overview analytics
  dispatchTrend7d: Array<{ dateKey: string; label: string; count: number }> = [];
  recentOperations: Array<{ message: string; timestamp: Date; severity: 'info' | 'warning' | 'success' }> = [];
  overviewKpis = {
    pendingNow: 0,
    availableNow: 0,
    dispatched7d: 0,
    criticalPending: 0,
  };

  dispatchForm = { emergencyId: '', ambulanceId: '' };
  errorMsg = '';

  private get headers() {
    return new HttpHeaders({ Authorization: `Bearer ${this.auth.getToken()}` });
  }

  constructor(
    private http: HttpClient, 
    public auth: AuthService, 
    private emergencyService: EmergencyService,
    private cdr: ChangeDetectorRef,
    private route: ActivatedRoute,
    private router: Router,
    private toastService: ToastService
  ) {}

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      if (params['tab']) {
        this.activeTab = params['tab'];
        this.handleTabChange(this.activeTab);
      }
    });

    this.loadPending();
    this.loadDispatchHistory();
    this.loadAvailableAmbulances();
    this.loadStaffFacilityContext();
  }

  setTab(tab: string) {
    if (this.activeTab === tab) return;
    this.activeTab = tab;
    this.cdr.detectChanges();
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: tab },
      queryParamsHandling: 'merge'
    });
  }

  private handleTabChange(tab: string) {
    if (tab === 'overview') { this.loadPending(); this.loadAvailableAmbulances(); }
    if (tab === 'history') this.loadDispatchHistory();
  }

  loadPending() {
    this.http.get<any>(`${environment.apiBaseUrl}/emergencies/pending`, { headers: this.headers })
      .subscribe({ 
        next: d => {
          this.pendingEmergencies = d?.data ?? d;
          this.refreshOverviewInsights();
          this.cdr.detectChanges();
        }, 
        error: () => {
          this.pendingEmergencies = [];
          this.refreshOverviewInsights();
        } 
      });
  }

  loadDispatchHistory() {
    this.emergencyService.getMyDispatchHistory().subscribe({
      next: d => {
        this.dispatchedEmergencies = d ?? [];
        this.refreshOverviewInsights();
        this.cdr.detectChanges();
      },
      error: () => {
        this.dispatchedEmergencies = [];
        this.refreshOverviewInsights();
      }
    });
  }

  loadAvailableAmbulances() {
    this.http.get<any>(`${environment.apiBaseUrl}/emergencies/ambulances/available`, { headers: this.headers })
      .subscribe({ 
        next: d => {
          const allAmbulances = d?.data ?? d;
          this.availableAmbulances = allAmbulances.filter((a: any) => a.status === 'AVAILABLE');
          this.refreshOverviewInsights();
          this.cdr.detectChanges();
        }, 
        error: () => {
          this.availableAmbulances = [];
          this.refreshOverviewInsights();
          // this.toastService.showError('Failed to load ambulances');
        } 
      });
  }

  startDispatch(e: Emergency) {
    this.dispatchingEmergencyId = e.emergencyId;
    this.dispatchForm.emergencyId = String(e.emergencyId);
    this.dispatchForm.ambulanceId = '';
    this.loadAvailableAmbulances();
  }

  cancelDispatch() {
    if (this.isSubmitting) {
      if (this.dispatchRequestSub) {
        this.dispatchRequestSub.unsubscribe();
        this.clearDispatchSubmissionState();
        this.dispatchingEmergencyId = null;
        this.dispatchForm = { emergencyId: '', ambulanceId: '' };
        this.toastService.showInfo('Dispatch request cancelled');
      }
      return;
    }

    this.dispatchingEmergencyId = null;
    this.dispatchForm = { emergencyId: '', ambulanceId: '' };
  }

  confirmDispatch(e: Emergency) {
    if (!this.dispatchForm.ambulanceId) {
      // this.toastService.showError('Please select an ambulance');
      return;
    }
    if (this.isSubmitting || this.dispatchRequestSub) return;
    this.isSubmitting = true;

    this.dispatchRequestSub = this.emergencyService.dispatchAmbulance(
      e.emergencyId,
      this.auth.getUser()?.id ?? 0,
      { ambulanceId: Number(this.dispatchForm.ambulanceId) }
    )
      .pipe(
        finalize(() => this.clearDispatchSubmissionState())
      )
      .subscribe({
        next: () => { 
          this.dispatchingEmergencyId = null;
          this.dispatchForm = { emergencyId: '', ambulanceId: '' };
          this.toastService.showSuccess('Ambulance dispatched successfully');
          this.loadPending();
          this.loadDispatchHistory();
          this.loadAvailableAmbulances();
          this.cdr.detectChanges();
        },
        error: () => {
          // this.toastService.showError('Failed to dispatch ambulance');
        }
      });
  }

  private clearDispatchSubmissionState() {
    this.dispatchRequestSub = null;
    this.isSubmitting = false;
  }

  private loadStaffFacilityContext() {
    if (this.staffFacilityId && this.staffFacilityName) return;

    const currentUserId = this.auth.getUser()?.id;
    if (!currentUserId) return;

    this.http.get<any>(`${environment.apiBaseUrl}/staff/${currentUserId}`, { headers: this.headers }).subscribe({
      next: (staffRes) => {
        const staff = staffRes?.data ?? staffRes;
        const facilityId = Number(staff?.facilityId);
        if (!facilityId) return;

        this.staffFacilityId = facilityId;
        if (this.staffFacilityName) return;

        this.http.get<any>(`${environment.apiBaseUrl}/facilities/${facilityId}`, { headers: this.headers }).subscribe({
          next: (facilityRes) => {
            const facility = facilityRes?.data ?? facilityRes;
            this.staffFacilityName = facility?.name || `Facility #${facilityId}`;
            this.cdr.detectChanges();
          },
          error: () => {
            this.staffFacilityName = `Facility #${facilityId}`;
            this.cdr.detectChanges();
          }
        });
      },
      error: () => {}
    });
  }

  private refreshOverviewInsights() {
    this.buildOverviewKpis();
    this.buildDispatchTrend7d();
    this.buildRecentOperations();
  }

  private buildOverviewKpis() {
    const rangeStart = new Date();
    rangeStart.setHours(0, 0, 0, 0);
    rangeStart.setDate(rangeStart.getDate() - 6);

    const criticalTypes = new Set(['HEART_ATTACK', 'STROKE', 'ACCIDENT']);

    this.overviewKpis = {
      pendingNow: this.pendingEmergencies.length,
      availableNow: this.availableAmbulances.length,
      dispatched7d: this.dispatchedEmergencies.filter(e => {
        const dt = this.tryParseDate((e as any)?.dispatchedAt ?? (e as any)?.date);
        return !!dt && dt >= rangeStart;
      }).length,
      criticalPending: this.pendingEmergencies.filter(e => criticalTypes.has(String((e as any)?.type ?? ''))).length,
    };
  }

  private buildDispatchTrend7d() {
    const now = new Date();
    const buckets: Array<{ dateKey: string; label: string; count: number }> = [];

    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      buckets.push({
        dateKey: this.toDateKey(d),
        label: d.toLocaleDateString(undefined, { weekday: 'short' }),
        count: 0,
      });
    }

    const map = new Map(buckets.map(b => [b.dateKey, b]));
    this.dispatchedEmergencies.forEach(e => {
      const dt = this.tryParseDate((e as any)?.dispatchedAt ?? (e as any)?.date);
      if (!dt) return;
      const key = this.toDateKey(dt);
      const bucket = map.get(key);
      if (bucket) bucket.count += 1;
    });

    this.dispatchTrend7d = buckets;
  }

  private buildRecentOperations() {
    const events: Array<{ message: string; timestamp: Date; severity: 'info' | 'warning' | 'success' }> = [];

    this.pendingEmergencies.forEach(e => {
      const ts = this.tryParseDate((e as any)?.reportedAt ?? (e as any)?.date);
      if (!ts) return;
      events.push({
        message: `Pending emergency #${e.emergencyId} (${(e as any)?.type ?? 'UNKNOWN'}) at ${(e as any)?.location ?? 'Unknown location'}`,
        timestamp: ts,
        severity: 'warning',
      });
    });

    this.dispatchedEmergencies.forEach(e => {
      const ts = this.tryParseDate((e as any)?.dispatchedAt ?? (e as any)?.date);
      if (!ts) return;
      events.push({
        message: `Emergency #${e.emergencyId} dispatched${(e as any)?.ambulanceId ? ` (Ambulance #${(e as any)?.ambulanceId})` : ''}`,
        timestamp: ts,
        severity: 'success',
      });
    });

    const severityPriority: Record<'warning' | 'success' | 'info', number> = {
      warning: 0,
      success: 1,
      info: 2,
    };

    this.recentOperations = events
      .sort((a, b) => {
        const bySeverity = severityPriority[a.severity] - severityPriority[b.severity];
        if (bySeverity !== 0) return bySeverity;
        return b.timestamp.getTime() - a.timestamp.getTime();
      })
      .slice(0, 14);
  }

  getDispatchBarHeight(count: number): number {
    const max = Math.max(...this.dispatchTrend7d.map(x => x.count), 1);
    return Math.max((count / max) * 100, count > 0 ? 12 : 4);
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

  getOperationSeverityClass(severity: 'info' | 'warning' | 'success'): string {
    if (severity === 'warning') return 'warning';
    if (severity === 'success') return 'success';
    return 'info';
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
