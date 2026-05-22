import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { CommonModule, DatePipe } from '@angular/common';
import { Navbar } from '../shared/navbar';
import { AuthService } from '../services/auth.service';
import { PatientService, TreatmentService, TreatmentRequest } from '../services/patient.service';
import { Patient, Treatment, PatientStatus } from '../../models/patient.model';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastService } from '../services/toast.service';
import { finalize } from 'rxjs';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-doctor',
  imports: [FormsModule, CommonModule, Navbar, DatePipe],
  templateUrl: './doctor.html',
  styleUrl: './doctor.css',
})
export class DoctorDashboard implements OnInit {
  activeTab = 'overview';
  patients: Patient[] = [];
  myPatients: Patient[] = [];
  filteredMyPatients: Patient[] = [];
  assignedPatientIds: Set<number> = new Set();
  myTreatments: Treatment[] = [];
  selectedPatient: Patient | null = null;
  citizenDetails: any = null;
  emergencyDetails: any = null;
  patientTreatments: Treatment[] = [];
  expandedPatientId: number | null = null;
  showTreatmentForm: number | null = null;
  myPatientsStatusFilter: PatientStatus | 'ALL' = 'ALL';
  patientDoctorMap: Map<number, string> = new Map();
  statusHighlight = false;
  private previousTab: string = 'patients';
  private staffFacilityId: number | null = null;
  staffFacilityName: string = '';

  // Overview analytics
  treatmentTrend7d: Array<{ dateKey: string; label: string; count: number }> = [];
  highPriorityPatients: Patient[] = [];
  recentClinicalActivity: Array<{ message: string; timestamp: Date; severity: 'info' | 'warning' | 'success' }> = [];
  overviewKpis = {
    activePatients: 0,
    observationNow: 0,
    ongoingTreatments: 0,
    completed7d: 0,
  };

  get admittedCount() { return this.patients.filter(p => p.status === 'ADMITTED').length; }

  treatmentForm: TreatmentRequest = { patientId: 0, description: '', medicationName: '', dosage: '' };
  errorMsg = '';
  isSubmittingTreatment = false;
  private updatingTreatmentIds = new Set<number>();

  private get headers() {
    return new HttpHeaders({ Authorization: `Bearer ${this.auth.getToken()}` });
  }

  constructor(
    private patientService: PatientService,
    private treatmentService: TreatmentService,
    public auth: AuthService,
    private http: HttpClient,
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

    this.loadPatients();
    this.loadMyTreatments();
  }

  setTab(tab: string) {
    if (this.activeTab === tab) return;
    this.activeTab = tab;
    this.cdr.markForCheck();
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: tab },
      queryParamsHandling: 'merge'
    });
  }

  private handleTabChange(tab: string) {
    if (tab === 'patients') this.loadPatients();
    if (tab === 'myPatients') this.loadPatients();
    if (tab === 'myTreatments') this.loadMyTreatments();
  }

  loadPatients() {
    const doctorId = this.auth.getUser()?.id;
    if (!doctorId) return;

    const loadFacilityPatients = (facilityId?: number) => {
      const patients$ = facilityId
        ? this.patientService.getPatientsByFacility(facilityId)
        : this.patientService.getAllPatients();

      patients$.subscribe({
        next: d => {
          const allFacilityPatients = d ?? [];
          this.patientDoctorMap.clear();
          this.patients = this.sortPatientsForPatientsTab(allFacilityPatients);
          this.patients.forEach(p => this.loadAssignedDoctor(p));

          this.myPatients = allFacilityPatients.filter(p => Number(p.assignedStaffId) === doctorId);
          this.assignedPatientIds = new Set(this.myPatients.map(p => p.patientId));
          this.applyMyPatientsFilter();
          this.refreshOverviewInsights();

          this.cdr.detectChanges();
        },
        error: () => {
          this.toastService.showError('Failed to load patients');
          this.myPatients = [];
          this.assignedPatientIds.clear();
          this.applyMyPatientsFilter();
          this.refreshOverviewInsights();
          this.cdr.detectChanges();
        }
      });
    };

    if (this.staffFacilityId) {
      loadFacilityPatients(this.staffFacilityId);
    } else {
      this.http.get<any>(`${environment.apiBaseUrl}/staff/${doctorId}`, { headers: this.headers }).subscribe({
        next: (res) => {
          const staff = res?.data ?? res;
          this.staffFacilityId = staff.facilityId;
          if (staff.facilityId && !this.staffFacilityName) {
            this.http.get<any>(`${environment.apiBaseUrl}/facilities/${staff.facilityId}`, { headers: this.headers }).subscribe({
              next: (fRes) => {
                const facility = fRes?.data ?? fRes;
                this.staffFacilityName = facility?.name || 'Facility #' + staff.facilityId;
                this.cdr.detectChanges();
              },
              error: () => { this.staffFacilityName = 'Facility #' + staff.facilityId; }
            });
          }
          loadFacilityPatients(this.staffFacilityId ?? undefined);
        },
        error: () => loadFacilityPatients()
      });
    }
  }

  private sortPatientsForPatientsTab(patients: Patient[]): Patient[] {
    return [...patients].sort((a, b) => {
      const aUnassigned = this.isPatientUnassigned(a);
      const bUnassigned = this.isPatientUnassigned(b);

      if (aUnassigned !== bUnassigned) {
        return aUnassigned ? -1 : 1;
      }

      const aAdmission = this.tryParseDate(a.admissionDate)?.getTime() ?? 0;
      const bAdmission = this.tryParseDate(b.admissionDate)?.getTime() ?? 0;
      return bAdmission - aAdmission;
    });
  }

  isPatientUnassigned(patient: Patient): boolean {
    return !patient.assignedStaffId;
  }

  isPatientExplicitlyUnassigned(patient: Patient): boolean {
    return !patient.assignedStaffId;
  }

  get unassignedPatients(): Patient[] {
    return this.patients.filter(p => this.isPatientExplicitlyUnassigned(p));
  }

  get assignedPatients(): Patient[] {
    return this.patients.filter(p => !this.isPatientExplicitlyUnassigned(p));
  }

  loadMyTreatments() {
    const doctorId = this.auth.getUser()?.id;
    if (!doctorId) return;
    
    this.treatmentService.getTreatmentsByDoctorId(doctorId).subscribe({
      next: d => {
        this.myTreatments = d;
        this.refreshOverviewInsights();
        this.cdr.detectChanges();
      },
      error: () => this.toastService.showError('Failed to load treatments')
    });
  }

  private refreshOverviewInsights() {
    this.buildOverviewKpis();
    this.buildTreatmentTrend7d();
    this.buildHighPriorityQueue();
    this.buildRecentClinicalActivity();
  }

  private buildOverviewKpis() {
    const rangeStart = new Date();
    rangeStart.setHours(0, 0, 0, 0);
    rangeStart.setDate(rangeStart.getDate() - 6);

    this.overviewKpis = {
      activePatients: this.myPatients.filter(p => p.status !== PatientStatus.DISCHARGED).length,
      observationNow: this.myPatients.filter(p => p.status === PatientStatus.UNDER_OBSERVATION).length,
      ongoingTreatments: this.myTreatments.filter(t => t.status === 'ONGOING' || t.status === 'PENDING').length,
      completed7d: this.myTreatments.filter(t => {
        if (t.status !== 'COMPLETED') return false;
        const dt = this.tryParseDate((t as any).endDate ?? (t as any).date ?? (t as any).startDate);
        return !!dt && dt >= rangeStart;
      }).length,
    };
  }

  private buildTreatmentTrend7d() {
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
    this.myTreatments.forEach(t => {
      const dt = this.tryParseDate((t as any).date ?? (t as any).startDate ?? (t as any).endDate);
      if (!dt) return;
      const bucket = map.get(this.toDateKey(dt));
      if (bucket) bucket.count += 1;
    });

    this.treatmentTrend7d = buckets;
  }

  private buildHighPriorityQueue() {
    const highRiskStatuses: Array<PatientStatus> = [PatientStatus.UNDER_OBSERVATION];

    this.highPriorityPatients = [...this.myPatients]
      .filter(p => highRiskStatuses.includes(p.status))
      .sort((a, b) => {
        const aTime = this.tryParseDate((a as any).admissionDate)?.getTime() ?? 0;
        const bTime = this.tryParseDate((b as any).admissionDate)?.getTime() ?? 0;
        return bTime - aTime;
      })
      .slice(0, 8);
  }

  private buildRecentClinicalActivity() {
    const events: Array<{ message: string; timestamp: Date; severity: 'info' | 'warning' | 'success' }> = [];

    this.myTreatments.forEach(t => {
      const ts = this.tryParseDate((t as any).date ?? (t as any).startDate ?? (t as any).endDate);
      if (!ts) return;
      const status = String((t as any).status ?? '').toUpperCase();
      events.push({
        message: `${t.description || 'Treatment'} for patient #${t.patientId} marked ${status || 'UPDATED'}`,
        timestamp: ts,
        severity: status === 'COMPLETED' ? 'success' : (status === 'CANCELLED' ? 'warning' : 'info'),
      });
    });

    this.myPatients.forEach(p => {
      const admitted = this.tryParseDate((p as any).admissionDate);
      if (admitted) {
        events.push({
          message: `Patient #${p.patientId} assigned${p.ward ? ` (${p.ward})` : ''}`,
          timestamp: admitted,
          severity: p.status === PatientStatus.UNDER_OBSERVATION ? 'warning' : 'info',
        });
      }

      const discharged = this.tryParseDate((p as any).dischargeDate);
      if (discharged) {
        events.push({
          message: `Patient #${p.patientId} discharged`,
          timestamp: discharged,
          severity: 'success',
        });
      }
    });

    this.recentClinicalActivity = events
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 14);
  }

  getTreatmentTrendBarHeight(count: number): number {
    const max = Math.max(...this.treatmentTrend7d.map(x => x.count), 1);
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

  getActivitySeverityClass(severity: 'info' | 'warning' | 'success'): string {
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

  applyMyPatientsFilter() {
    const activePatients = this.myPatients.filter(p => p.status !== PatientStatus.DISCHARGED);

    if (this.myPatientsStatusFilter === 'ALL') {
      this.filteredMyPatients = [...activePatients];
    } else {
      this.filteredMyPatients = activePatients.filter(p => p.status === this.myPatientsStatusFilter);
    }
  }

  get dischargedMyPatients(): Patient[] {
    return this.myPatients.filter(p => p.status === PatientStatus.DISCHARGED);
  }

  onMyPatientsFilterChange() {
    this.applyMyPatientsFilter();
  }

  togglePatientDetails(patient: Patient) {
    this.previousTab = this.activeTab;
    this.selectedPatient = patient;
    this.showTreatmentForm = null;
    this.citizenDetails = null;
    this.emergencyDetails = null;
    this.setTab('patientDetail');

    // Load detail payloads after the detail view is active so bindings update
    // as soon as each response arrives.
    this.loadPatientTreatments(patient.patientId);
    this.loadCitizenDetails(patient.citizenId);
    this.loadEmergencyDetails(patient.emergencyId);
  }

  loadPatientTreatments(patientId: number) {
    this.treatmentService.getTreatmentsByPatient(patientId).subscribe({
      next: d => {
        this.patientTreatments = d ?? [];
        if (this.activeTab === 'patientDetail' && this.selectedPatient?.patientId === patientId) {
          this.cdr.markForCheck();
        }
      },
      error: () => {
        this.patientTreatments = [];
        if (this.activeTab === 'patientDetail' && this.selectedPatient?.patientId === patientId) {
          this.cdr.markForCheck();
        }
      }
    });
  }

  loadCitizenDetails(citizenId: number) {
    this.http.get<any>(`${environment.apiBaseUrl}/api/citizens/${citizenId}`, { headers: this.headers })
      .subscribe({
        next: d => {
          this.citizenDetails = d?.data ?? d;
          if (this.activeTab === 'patientDetail' && this.selectedPatient?.citizenId === citizenId) {
            this.cdr.markForCheck();
          }
        },
        error: () => this.toastService.showError('Failed to load citizen details')
      });
  }

  loadEmergencyDetails(emergencyId: number) {
    this.http.get<any>(`${environment.apiBaseUrl}/emergencies/${emergencyId}`, { headers: this.headers })
      .subscribe({
        next: d => {
          this.emergencyDetails = d?.data ?? d;
          if (this.activeTab === 'patientDetail' && this.selectedPatient?.emergencyId === emergencyId) {
            this.cdr.markForCheck();
          }
        },
        error: () => this.toastService.showError('Failed to load emergency details')
      });
  }

  openTreatmentForm(patient: Patient) {
    this.showTreatmentForm = patient.patientId;
    this.treatmentForm = {
      patientId: patient.patientId,
      description: '',
      medicationName: '',
      dosage: ''
    };
  }

  closeTreatmentForm() {
    this.showTreatmentForm = null;
    this.treatmentForm = { patientId: 0, description: '', medicationName: '', dosage: '' };
  }

  submitTreatment() {
    if (this.isSubmittingTreatment) return;
    if (!this.treatmentForm.description) {
      this.toastService.showError('Description is required');
      return;
    }

    this.isSubmittingTreatment = true;
    this.treatmentService.addTreatment(this.treatmentForm)
      .pipe(
        finalize(() => {
          this.isSubmittingTreatment = false;
        })
      )
      .subscribe({
        next: () => {
          this.toastService.showSuccess('Treatment added successfully');
          this.closeTreatmentForm();
          this.loadMyTreatments();
          if (this.selectedPatient) {
            this.loadPatientTreatments(this.selectedPatient.patientId);
            // Auto-update patient status to UNDER_OBSERVATION
            if (this.selectedPatient.status === 'ADMITTED') {
              this.updatePatientStatus(this.selectedPatient.patientId, 'UNDER_OBSERVATION' as PatientStatus);
            }
          }
          this.loadPatients();
          this.errorMsg = '';
          this.cdr.detectChanges();
        },
        error: (err) => {
          this.toastService.showError(err.error?.message || 'Failed to add treatment');
        }
      });
  }

  updatePatientStatus(patientId: number, newStatus: PatientStatus) {
    this.patientService.updatePatientStatus(patientId, newStatus).subscribe({
      next: () => {
        this.toastService.showSuccess('Patient status updated successfully');
        this.loadPatients();
        if (this.selectedPatient?.patientId === patientId) {
          this.selectedPatient.status = newStatus;
        }
        this.statusHighlight = true;
        this.cdr.detectChanges();
        setTimeout(() => { this.statusHighlight = false; this.cdr.detectChanges(); }, 1600);
      },
      error: (err) => {
        this.toastService.showError('Failed to update status: ' + (err.error?.message || err.message));
      }
    });
  }

  goBack() {
    this.selectedPatient = null;
    this.setTab(this.previousTab || 'patients');
  }

  backToPatients() {
    this.setTab(this.previousTab || 'patients');
    this.selectedPatient = null;
    this.citizenDetails = null;
    this.emergencyDetails = null;
    this.showTreatmentForm = null;
    this.patientTreatments = [];
    this.errorMsg = '';
  }

  cancelTreatmentForm() {
    this.showTreatmentForm = null;
    this.treatmentForm = { patientId: 0, description: '', medicationName: '', dosage: '' };
    this.errorMsg = '';
  }

  updateTreatmentStatus(treatmentId: number, status: string) {
    if (this.updatingTreatmentIds.has(treatmentId)) return;

    this.updatingTreatmentIds.add(treatmentId);
    this.http.patch<any>(`${environment.apiBaseUrl}/treatments/${treatmentId}/${status}`, {}, { headers: this.headers })
      .pipe(
        finalize(() => {
          this.updatingTreatmentIds.delete(treatmentId);
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: () => {
          this.toastService.showSuccess('Treatment status updated successfully');
          if (this.selectedPatient) {
            this.loadPatientTreatments(this.selectedPatient.patientId);
          }
          this.loadMyTreatments();
        },
        error: (err) => {
          this.toastService.showError(err.error?.message || 'Failed to update treatment status');
          this.cdr.detectChanges();
        }
      });
  }

  isTreatmentUpdateInFlight(treatmentId: number): boolean {
    return this.updatingTreatmentIds.has(treatmentId);
  }

  loadAssignedDoctor(patient: Patient) {
    if (!patient.assignedStaffId) {
      this.patientDoctorMap.set(patient.patientId, 'Not assigned');
      this.refreshPatientViews(patient.patientId);
      return;
    }

    this.loadDoctorName(patient.patientId, patient.assignedStaffId);
  }

  loadDoctorName(patientId: number, doctorId: number) {
    this.http.get<any>(`${environment.apiBaseUrl}/staff/${doctorId}`, { headers: this.headers })
      .subscribe({
        next: d => {
          const staff = d?.data ?? d;
          this.patientDoctorMap.set(patientId, staff.name);
          this.refreshPatientViews(patientId);
        },
        error: () => {
          this.http.get<any>(`${environment.apiBaseUrl}/admin/users/${doctorId}`, { headers: this.headers })
            .subscribe({
              next: d => {
                const user = d?.data ?? d;
                this.patientDoctorMap.set(patientId, user.name);
                this.refreshPatientViews(patientId);
              },
              error: () => {
                this.patientDoctorMap.set(patientId, 'Unknown Doctor');
                this.refreshPatientViews(patientId);
              }
            });
        }
      });
  }

  private refreshPatientViews(patientId?: number) {
    const patientListActive = this.activeTab === 'patients' || this.activeTab === 'myPatients';
    const selectedDetailActive = this.activeTab === 'patientDetail' && (
      !patientId || this.selectedPatient?.patientId === patientId
    );
    if (patientListActive || selectedDetailActive) {
      this.cdr.markForCheck();
    }
  }

  getAssignedDoctorName(patientId: number): string {
    return this.patientDoctorMap.get(patientId) || 'Loading...';
  }
}