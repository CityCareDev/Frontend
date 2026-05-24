import { Component, OnInit, ChangeDetectorRef, NgZone } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { DatePipe, CommonModule } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Navbar } from '../shared/navbar';
import { AuthService } from '../services/auth.service';
import { CitizenService, CitizenProfile, CitizenDocument } from '../services/citizen.service';
import { ToastService } from '../services/toast.service';
import { Emergency } from '../../models/emergency.model';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize, timeout } from 'rxjs/operators';
import { EmergencyService } from '../services/emergency.service';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-citizen',
  imports: [FormsModule, ReactiveFormsModule, CommonModule, Navbar, DatePipe],
  templateUrl: './citizen.html',
  styleUrl: './citizen.css',
})
export class CitizenDashboard implements OnInit {
  activeTab = 'overview';
  emergencies: Emergency[] = [];
  profile: CitizenProfile | null = null;
  documents: CitizenDocument[] = [];
  selectedFile: File | null = null;
  documentPreviewUrl: SafeResourceUrl | null = null;
  documentIsImage = false;
  isEditMode = false;
  profileForm!: FormGroup;

  // Overview analytics
  personalActionQueue: Array<{ title: string; subtitle: string; severity: 'info' | 'warning' | 'success'; targetTab: string }> = [];
  recentPersonalActivity: Array<{ message: string; timestamp: Date; severity: 'info' | 'warning' | 'success' }> = [];

  emergencyForm!: FormGroup;
  emergencyTypes = ['ACCIDENT', 'HEART_ATTACK', 'FIRE', 'STROKE', 'FALL', 'OTHER'];
  errorMsg = '';
  isSavingProfile = false;
  isUploadingDoc = false;
  isReportingEmergency = false;
  todayDate = new Date().toISOString().split('T')[0];
  minDate = '1900-01-01';

  get pendingCount() { return this.emergencies.filter(e => e.status === 'REPORTED').length; }
  get activeEmergencyCount() { return this.emergencies.filter(e => String((e as any).status ?? '').toUpperCase() !== 'CLOSED').length; }
  get resolvedCount() { return this.emergencies.filter(e => e.status === 'CLOSED').length; }
  get pendingDocsCount() { return this.documents.filter(d => d.verificationStatus === 'PENDING').length; }
  get emergencyReportingBlocker() { return this.getEmergencyReportingBlocker(); }
  get isInitialProfileSetupPending() {
    return !this.citizenService.isProfileComplete();
  }

  private get headers() {
    return new HttpHeaders({ Authorization: `Bearer ${this.auth.getToken()}` });
  }

  constructor(
    private http: HttpClient,
    public auth: AuthService,
    private citizenService: CitizenService,
    private emergencyService: EmergencyService,
    private toastService: ToastService,
    private sanitizer: DomSanitizer,
    private fb: FormBuilder,
    private cdr: ChangeDetectorRef,
    private zone: NgZone,
    private route: ActivatedRoute,
    private router: Router
  ) {
    this.initForm();
  }

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      if (params['tab']) {
        this.activeTab = params['tab'];
        this.handleTabChange(this.activeTab);
      }
    });

    this.loadEmergencies();
    this.loadProfile();

    // Subscribe to profile changes
    this.citizenService.profile$.subscribe(profile => {
      if (profile) {
        this.profile = profile;
        this.cdr.markForCheck();
      }
    });

    // Subscribe to document changes
    this.citizenService.documents$.subscribe(docs => {
      this.documents = docs;
      this.cdr.markForCheck();
    });
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
    if (tab === 'profile') this.loadProfile();
    if (tab === 'documents') this.loadDocuments();
    if (tab === 'emergencies') { this.loadEmergencies(); this.loadDocuments(); }
  }

  initForm() {
    this.profileForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(50), Validators.pattern(/^[A-Za-z\s]+$/)]],
      dateOfBirth: ['', Validators.required],
      gender: ['', Validators.required],
      contactInfo: ['', [Validators.required, Validators.pattern(/^[0-9]{10}$/)]],
      address: ['', Validators.required]
    });
    this.emergencyForm = this.fb.group({
      type: ['ACCIDENT', Validators.required],
      location: ['', [Validators.required, Validators.minLength(3)]],
      description: ['']
    });
  }

  loadProfile() {
    this.citizenService.getMyProfile().subscribe({
      next: p => {
        this.profile = p;
        if (this.isInitialProfileSetupPending) {
          this.isEditMode = true;
          this.restoreRequiredValidators();
          this.patchProfileFormValues();
          this.setTab('profile');
          this.toastService.showWarning('Please complete your profile to continue.');
        }
        this.refreshOverviewInsights();
        this.loadDocuments();
      },
      error: (err) => {
        if (err.status === 404) {
          this.profile = null;
          this.isEditMode = true;
          this.setTab('profile');
          const user = this.auth.getUser();
          if (user?.name) {
            this.profileForm.patchValue({ name: user.name });
          }
          this.toastService.showWarning('Please complete your profile to continue.');
        } else {
          this.toastService.showError('Failed to load profile');
        }
        this.refreshOverviewInsights();
      }
    });
  }

  enterEditMode() {
    if (!this.profile) return;
    this.patchProfileFormValues();

    // After initial profile creation, allow partial updates
    if (this.isInitialProfileSetupPending) {
      this.restoreRequiredValidators();
    } else {
      this.removeRequiredValidators();
    }

    this.isEditMode = true;
  }

  private patchProfileFormValues() {
    // Convert date from dd-MM-yyyy to yyyy-MM-dd for HTML input
    let htmlDate = '';
    if (this.profile?.dateOfBirth) {
      const parts = this.profile.dateOfBirth.split('-');
      if (parts.length === 3) {
        const [day, month, year] = parts;
        htmlDate = `${year}-${month}-${day}`;
      }
    }

    this.profileForm.patchValue({
      name: this.profile?.name || '',
      dateOfBirth: htmlDate,
      gender: this.profile?.gender || '',
      contactInfo: this.profile?.contactInfo || '',
      address: this.profile?.address || ''
    });

    this.profileForm.markAsPristine();
    this.profileForm.markAsUntouched();
    Object.keys(this.profileForm.controls).forEach(key => {
      this.profileForm.get(key)?.markAsPristine();
      this.profileForm.get(key)?.markAsUntouched();
    });
  }

  private removeRequiredValidators() {
    this.profileForm.get('name')?.setValidators([Validators.minLength(2), Validators.maxLength(50), Validators.pattern(/^[A-Za-z\s]+$/)]);
    this.profileForm.get('dateOfBirth')?.clearValidators();
    this.profileForm.get('gender')?.clearValidators();
    this.profileForm.get('contactInfo')?.setValidators([Validators.pattern(/^[0-9]{10}$/)]);
    this.profileForm.get('address')?.clearValidators();
    Object.keys(this.profileForm.controls).forEach(key => {
      this.profileForm.get(key)?.updateValueAndValidity();
    });
  }

  private restoreRequiredValidators() {
    this.profileForm.get('name')?.setValidators([Validators.required, Validators.minLength(2), Validators.maxLength(50), Validators.pattern(/^[A-Za-z\s]+$/)]);
    this.profileForm.get('dateOfBirth')?.setValidators([Validators.required]);
    this.profileForm.get('gender')?.setValidators([Validators.required]);
    this.profileForm.get('contactInfo')?.setValidators([Validators.required, Validators.pattern(/^[0-9]{10}$/)]);
    this.profileForm.get('address')?.setValidators([Validators.required]);
    Object.keys(this.profileForm.controls).forEach(key => {
      this.profileForm.get(key)?.updateValueAndValidity();
    });
  }

  cancelEdit() {
    this.isEditMode = false;
    this.profileForm.reset();
    this.restoreRequiredValidators();
  }

  updateProfile() {
    if (this.isSavingProfile) return;
    this.errorMsg = '';
    const formValue = this.profileForm.value;
    const isInitialSetup = this.isInitialProfileSetupPending;

    // Convert date from yyyy-MM-dd to dd-MM-yyyy
    let formattedDate = '';
    if (formValue.dateOfBirth) {
      const [year, month, day] = formValue.dateOfBirth.split('-');
      formattedDate = `${day}-${month}-${year}`;
    }

    // For initial profile setup, require all fields
    if (isInitialSetup) {
      if (this.profileForm.invalid) {
        this.toastService.showError('Please fill all required fields correctly');
        return;
      }
      if (!formValue.name || !formattedDate || !formValue.gender || !formValue.contactInfo || !formValue.address) {
        this.toastService.showError('Please fill all fields for initial profile setup');
        return;
      }
    } else {
      // For partial updates, only validate fields that were actually changed
      const changedFields = Object.keys(this.profileForm.controls).filter(key => {
        const control = this.profileForm.get(key);
        return !!control?.dirty;
      });

      if (changedFields.length === 0) {
        this.toastService.showWarning('No changes detected');
        return;
      }

      // Validate only the changed fields
      const invalidFields = changedFields.filter(key => this.profileForm.get(key)?.invalid);
      if (invalidFields.length > 0) {
        this.toastService.showError('Please correct the highlighted fields');
        return;
      }
    }

    // Build payload: for partial updates (profile exists), only send changed fields
    const payload: any = {};
    if (!isInitialSetup) {
      // Only include dirty (changed) fields
      if (this.profileForm.get('name')?.dirty) {
        if (!formValue.name || !String(formValue.name).trim()) {
          this.toastService.showError('Name cannot be empty');
          return;
        }
        payload.name = String(formValue.name).trim();
      }

      if (this.profileForm.get('contactInfo')?.dirty) {
        if (!formValue.contactInfo || !String(formValue.contactInfo).trim()) {
          this.toastService.showError('Contact info cannot be empty');
          return;
        }
        payload.contactInfo = String(formValue.contactInfo).trim();
      }

      if (this.profileForm.get('dateOfBirth')?.dirty) {
        payload.dateOfBirth = formattedDate || null;
      }

      if (this.profileForm.get('gender')?.dirty) {
        payload.gender = formValue.gender || null;
      }

      if (this.profileForm.get('address')?.dirty) {
        payload.address = formValue.address ? String(formValue.address).trim() : null;
      }
    } else {
      payload.name = formValue.name;
      payload.dateOfBirth = formattedDate;
      payload.gender = formValue.gender;
      payload.contactInfo = formValue.contactInfo;
      payload.address = formValue.address;
    }

    this.isSavingProfile = true;
    this.citizenService.updateProfile(payload).subscribe({
      next: (updatedProfile) => {
        this.isSavingProfile = false;
        this.profile = updatedProfile;
        this.isEditMode = false;
        this.restoreRequiredValidators();
        this.toastService.showSuccess('Profile updated successfully!');
        // Load documents after profile is created
        if (updatedProfile.citizenId) {
          this.loadDocuments();
        }
      },
      error: (err) => {
        this.isSavingProfile = false;
        if (err.status === 409) {
          this.toastService.showError('This phone number is already registered');
          this.errorMsg = 'This phone number is already registered. Please use a different number.';
        } else {
          this.toastService.showError('Failed to update profile');
          this.errorMsg = 'Failed to update profile. Please try again.';
        }
      }
    });
  }

  loadDocuments() {
    if (!this.profile?.citizenId) {
      return;
    }
    this.citizenService.getMyDocuments(this.profile.citizenId).subscribe({
      next: d => {
        this.documents = [...d];
        this.refreshOverviewInsights();
      },
      error: () => {
        this.toastService.showError('Failed to load documents');
        this.documents = [];
        this.refreshOverviewInsights();
      }
    });
  }

  onFileSelected(event: any) {
    this.selectedFile = event.target.files[0];
  }

  uploadDocument() {
    if (this.isUploadingDoc) return;
    if (!this.selectedFile || !this.profile?.citizenId) {
      return;
    }
    this.errorMsg = '';
    this.isUploadingDoc = true;
    this.citizenService.uploadDocument(this.profile.citizenId, this.selectedFile).subscribe({
      next: () => {
        this.isUploadingDoc = false;
        this.selectedFile = null;
        const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
        this.loadDocuments(); // This will update the BehaviorSubject
        this.toastService.showSuccess('Document uploaded successfully!');
      },
      error: () => {
        this.isUploadingDoc = false;
        this.toastService.showError('Failed to upload document');
      }
    });
  }

  viewDocument(doc: CitizenDocument) {
    if (!this.profile?.citizenId) return;
    this.documentPreviewUrl = null;
    this.citizenService.getDocumentBlob(this.profile.citizenId, doc.documentId).subscribe({
      next: blob => {
        const url = URL.createObjectURL(blob);
        this.documentIsImage = blob.type.startsWith('image/');
        this.documentPreviewUrl = this.sanitizer.bypassSecurityTrustResourceUrl(url);
        this.cdr.markForCheck();
      },
      error: () => this.toastService.showError('Failed to load document')
    });
  }

  closePreview() {
    this.documentPreviewUrl = null;
  }

  loadEmergencies() {
    this.http.get<any>(`${environment.apiBaseUrl}/emergencies/my`, { headers: this.headers })
      .subscribe({
        next: d => {
          this.zone.run(() => {
            this.emergencies = d?.data ?? d;
            this.refreshOverviewInsights();
            this.cdr.detectChanges();
          });
        },
        error: () => {
          this.emergencies = [];
          this.refreshOverviewInsights();
        }
      });
  }

  private refreshOverviewInsights() {
    this.buildPersonalActionQueue();
    this.buildRecentPersonalActivity();
  }

  private buildPersonalActionQueue() {
    const queue: Array<{ title: string; subtitle: string; severity: 'info' | 'warning' | 'success'; targetTab: string }> = [];
    const emergencyReportingBlocker = this.getEmergencyReportingBlocker();

    if (emergencyReportingBlocker) {
      queue.push({
        title: emergencyReportingBlocker.title,
        subtitle: emergencyReportingBlocker.subtitle,
        severity: 'warning',
        targetTab: emergencyReportingBlocker.targetTab,
      });
    }

    if (!this.profile && emergencyReportingBlocker?.targetTab !== 'profile') {
      queue.push({
        title: 'Complete your profile',
        subtitle: 'Add required personal details to unlock emergency reporting.',
        severity: 'warning',
        targetTab: 'profile',
      });
    }

    if (this.pendingDocsCount > 0 && emergencyReportingBlocker?.targetTab !== 'documents') {
      queue.push({
        title: 'Documents under verification',
        subtitle: `${this.pendingDocsCount} document(s) pending verification.`,
        severity: 'info',
        targetTab: 'documents',
      });
    }

    const activeEmergencies = this.emergencies.filter(e => String((e as any).status ?? '').toUpperCase() !== 'CLOSED');
    if (activeEmergencies.length > 0) {
      queue.push({
        title: 'Track active emergencies',
        subtitle: `${activeEmergencies.length} emergency case(s) are still in progress.`,
        severity: 'warning',
        targetTab: 'emergencies',
      });
    }

    if (queue.length === 0) {
      queue.push({
        title: 'Everything looks good',
        subtitle: 'No pending actions right now.',
        severity: 'success',
        targetTab: 'overview',
      });
    }

    this.personalActionQueue = queue.slice(0, 5);
  }

  private buildRecentPersonalActivity() {
    const events: Array<{ message: string; timestamp: Date; severity: 'info' | 'warning' | 'success' }> = [];

    this.emergencies.forEach(e => {
      const reportedAt = this.tryParseDate((e as any).reportedAt ?? (e as any).date);
      if (reportedAt) {
        events.push({
          message: `Emergency #${e.emergencyId} reported (${(e as any).type ?? 'UNKNOWN'})`,
          timestamp: reportedAt,
          severity: 'warning',
        });
      }

      const resolvedAt = this.tryParseDate((e as any).resolvedAt);
      if (resolvedAt) {
        events.push({
          message: `Emergency #${e.emergencyId} resolved`,
          timestamp: resolvedAt,
          severity: 'success',
        });
      }
    });

    this.documents.forEach(d => {
      const ts = this.tryParseDate((d as any).uploadedDate);
      if (!ts) return;
      const status = String((d as any).verificationStatus ?? '').toUpperCase();
      events.push({
        message: `Document #${d.documentId} status: ${status || 'UPDATED'}`,
        timestamp: ts,
        severity: status === 'VERIFIED' ? 'success' : (status === 'REJECTED' ? 'warning' : 'info'),
      });
    });

    this.recentPersonalActivity = events
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 14);
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

  private getEmergencyReportingBlocker(): { title: string; subtitle: string; targetTab: string } | null {
    if (!this.citizenService.isProfileComplete()) {
      return {
        title: 'Update profile to continue',
        subtitle: 'Complete your profile details first. Emergency reporting is enabled only after profile setup and verification.',
        targetTab: 'profile',
      };
    }

    if (this.documents.length === 0) {
      return {
        title: 'Upload documents for verification',
        subtitle: 'Upload identity or medical documents so your account can be verified before emergency reporting.',
        targetTab: 'documents',
      };
    }

    if (!this.citizenService.isVerified()) {
      return {
        title: 'Await document verification',
        subtitle: 'Your documents are under review. You can report an emergency after at least one document is verified.',
        targetTab: 'documents',
      };
    }

    return null;
  }

  reportEmergency() {
    if (this.isReportingEmergency) return;
    // Step 0: Form validation
    if (this.emergencyForm.invalid) {
      this.emergencyForm.markAllAsTouched();
      this.toastService.showError('Please fill all required fields correctly');
      return;
    }

    // Step 1: Profile + verification readiness check
    const emergencyReportingBlocker = this.getEmergencyReportingBlocker();
    if (emergencyReportingBlocker) {
      this.toastService.showError(emergencyReportingBlocker.subtitle);
      this.setTab(emergencyReportingBlocker.targetTab);
      return;
    }

    // Step 2: Proceed with emergency report
    if (!this.profile?.citizenId) {
      this.toastService.showError('Profile not loaded. Please refresh the page.');
      return;
    }

    this.errorMsg = '';
    const payload = {
      ...this.emergencyForm.value,
      citizenId: this.profile.citizenId
    };

    this.isReportingEmergency = true;
    this.emergencyService.reportEmergency(payload)
      .pipe(
        timeout(15000),
        finalize(() => {
          this.isReportingEmergency = false;
        })
      )
      .subscribe({
        next: () => {
          this.emergencyForm.reset({ type: 'ACCIDENT', location: '', description: '' });
          this.loadEmergencies();
          this.toastService.showSuccess('Emergency reported successfully!');
          this.cdr.detectChanges();
        },
        error: (err) => {
          const msg = err?.error?.message || err?.message || 'Failed to report emergency';
          // this.toastService.showError(msg); // Handled by interceptor
        }
      });
  }

}

