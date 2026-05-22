import { Component, OnDestroy, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { finalize, Subject, switchMap, takeUntil } from 'rxjs';
import { of } from 'rxjs';
import { AdminService } from '../../services/admin.service';
import { AuthService } from '../../services/auth.service';
import { CitizenService } from '../../services/citizen.service';
import { ToastService } from '../../services/toast.service';
import { ConfirmDialogService } from '../../shared/confirm-dialog';
import { User } from '../../../models/user.model';
import { environment } from '../../../environments/environment';
import { FacilityService } from '../../services/facility.service';

@Component({
  selector: 'app-admin-user-detail-tab',
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './admin-user-detail-tab.html',
  styleUrl: '../admin.css'
})
export class AdminUserDetailTab implements OnInit, OnDestroy {
  selectedUser: User | null = null;
  userExtraDetails: any = null;
  userDocuments: any[] = [];
  userDocPreviewUrl: SafeResourceUrl | null = null;
  previewingUserDocId: number | null = null;
  userDocIsImage = false;
  isLoadingUserDoc = false;
  errorMsg = '';
  
  facilities: any[] = [];

  private userCitizenId: number | null = null;
  private readonly actionInFlight = new Set<string>();
  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly http: HttpClient,
    public auth: AuthService,
    private readonly adminService: AdminService,
    private readonly citizenService: CitizenService,
    private readonly toastService: ToastService,
    private readonly confirmDialog: ConfirmDialogService,
    private readonly sanitizer: DomSanitizer,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly facilityService: FacilityService,
    private readonly cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.facilityService.getAllFacilities().subscribe(data => { this.facilities = data; this.cdr.markForCheck(); });

    this.route.queryParamMap
      .pipe(
        takeUntil(this.destroy$),
        switchMap(params => {
          const userId = params.get('userId');
          if (!userId) {
            this.selectedUser = null;
            return of(null);
          }
          return this.adminService.getUserById(Number(userId));
        })
      )
      .subscribe({
        next: user => {
          if (!user) {
            this.selectedUser = null;
            this.cdr.markForCheck();
            return;
          }
          this.selectedUser = { ...user, userId: user.userId || user.id, id: user.id || user.userId };
          this.errorMsg = '';
          this.loadRoleSpecificDetails(this.selectedUser.role, this.selectedUser.userId!);
          this.cdr.markForCheck();
        },
        error: () => {
          this.errorMsg = 'Unable to load user details';
          this.selectedUser = null;
          this.cdr.markForCheck();
        }
      });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  getFacilityName(facilityId: number): string {
    const facility = this.facilities.find(f => f.facilityId === facilityId);
    return facility ? facility.name : `Facility #${facilityId}`;
  }

  setTab(tab: string) {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: tab, userId: null },
      queryParamsHandling: 'merge'
    });
  }

  async activateUser(userId: number) {
    const actionKey = this.userActionKey('activate', userId);
    if (!this.beginAction(actionKey)) return;

    this.adminService.activateUser(userId)
      .pipe(finalize(() => { this.endAction(actionKey); this.cdr.markForCheck(); }))
      .subscribe({
        next: () => {
          this.toastService.showSuccess('User activated successfully');
          if (this.selectedUser && (this.selectedUser.userId === userId || this.selectedUser.id === userId)) {
            this.selectedUser = { ...this.selectedUser, status: 'ACTIVE' };
          }
        },
        error: err => this.toastService.showError(this.extractErrorMessage(err, 'Failed to activate user'))
      });
  }

  async deactivateUser(userId: number) {
    const confirmed = await this.confirmDialog.confirm({
      title: 'Deactivate User',
      message: 'Are you sure you want to deactivate this user? They will no longer be able to access the system.',
      confirmText: 'Deactivate',
      type: 'warning'
    });
    if (!confirmed) return;

    const actionKey = this.userActionKey('deactivate', userId);
    if (!this.beginAction(actionKey)) return;

    this.adminService.deactivateUser(userId)
      .pipe(finalize(() => { this.endAction(actionKey); this.cdr.markForCheck(); }))
      .subscribe({
        next: () => {
          this.toastService.showSuccess('User deactivated successfully');
          if (this.selectedUser && (this.selectedUser.userId === userId || this.selectedUser.id === userId)) {
            this.selectedUser = { ...this.selectedUser, status: 'INACTIVE' };
          }
        },
        error: err => this.toastService.showError(this.extractErrorMessage(err, 'Failed to deactivate user'))
      });
  }

  async removeUser(userId: number) {
    const currentUserId = this.auth.getUser()?.userId || this.auth.getUser()?.id;

    if (userId === currentUserId) {
      this.toastService.showError('You cannot remove your own account');
      return;
    }

    const role = this.selectedUser?.role || '';
    const isStaffRole = role === 'DOCTOR' || role === 'DISPATCHER';

    const confirmed = await this.confirmDialog.confirm({
      title: 'Remove User',
      message: 'This will permanently remove the user account. This action cannot be undone.',
      confirmText: 'Remove',
      type: 'warning'
    });
    if (!confirmed) return;

    const actionKey = this.userActionKey('remove', userId);
    if (!this.beginAction(actionKey)) return;

    const finalizeUserRemoval = () => {
      this.selectedUser = null;
      this.userExtraDetails = null;
      this.userDocuments = [];
      this.userDocPreviewUrl = null;
      this.setTab('users');
      this.toastService.showSuccess('User removed successfully');
    };

    const deleteAuthUser = () => {
      this.adminService.deleteUser(userId)
        .pipe(finalize(() => this.endAction(actionKey)))
        .subscribe({
          next: () => finalizeUserRemoval(),
          error: err => {
            if (err?.status === 404) {
              finalizeUserRemoval();
              return;
            }
            this.toastService.showError(this.extractErrorMessage(err, 'Failed to remove user'));
          }
        });
    };

    if (!isStaffRole) {
      deleteAuthUser();
      return;
    }

    this.adminService.deleteStaffRecord(userId).subscribe({
      next: () => deleteAuthUser(),
      error: err => {
        if (err?.status === 404) {
          deleteAuthUser();
          return;
        }
        this.toastService.showError(this.extractErrorMessage(err, 'Failed to remove staff record'));
        this.endAction(actionKey);
      }
    });
  }

  previewUserDocument(doc: any) {
    if (!this.selectedUser || !this.userCitizenId) return;
    this.isLoadingUserDoc = true;
    this.userDocPreviewUrl = null;
    this.userDocIsImage = false;
    this.previewingUserDocId = doc.documentId;

    this.citizenService.getDocumentBlob(this.userCitizenId, doc.documentId).subscribe({
      next: blob => {
        const url = URL.createObjectURL(blob);
        this.userDocIsImage = blob.type.startsWith('image/');
        this.userDocPreviewUrl = this.sanitizer.bypassSecurityTrustResourceUrl(url);
        this.isLoadingUserDoc = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.toastService.showError('Failed to load document');
        this.isLoadingUserDoc = false;
        this.cdr.markForCheck();
      }
    });
  }

  isActionInFlight(actionKey: string): boolean {
    return this.actionInFlight.has(actionKey);
  }

  userActionKey(action: 'activate' | 'deactivate' | 'remove', userId: number): string {
    return `user:${action}:${userId}`;
  }

  private beginAction(actionKey: string): boolean {
    if (this.actionInFlight.has(actionKey)) {
      return false;
    }
    this.actionInFlight.add(actionKey);
    return true;
  }

  private endAction(actionKey: string): void {
    this.actionInFlight.delete(actionKey);
  }

  private extractErrorMessage(err: any, fallback: string): string {
    return err?.error?.message || err?.message || fallback;
  }

  private loadRoleSpecificDetails(role: string, userId: number) {
    const token = this.auth.getToken();
    const headers = token
      ? new HttpHeaders({ Authorization: `Bearer ${token}` })
      : new HttpHeaders();

    switch (role) {
      case 'CITIZEN':
        this.http.get<any>(`${environment.apiBaseUrl}/api/citizens/${userId}`, { headers })
          .subscribe({
            next: res => {
              const citizen = res?.data ?? res;
              if (citizen && citizen.citizenId) {
                this.userExtraDetails = citizen;
                this.userCitizenId = citizen.citizenId;
                this.cdr.markForCheck();
                this.http.get<any>(`${environment.apiBaseUrl}/api/citizens/${citizen.citizenId}/documents`, { headers })
                  .subscribe({
                    next: docRes => {
                      this.userDocuments = docRes?.data ?? docRes;
                      this.cdr.markForCheck();
                    },
                    error: () => {
                      this.userDocuments = [];
                      this.cdr.markForCheck();
                    }
                  });
              } else {
                this.fallbackToUserTable(userId);
              }
            },
            error: () => this.fallbackToUserTable(userId)
          });
        break;

      case 'DOCTOR':
      case 'DISPATCHER':
        this.http.get<any>(`${environment.apiBaseUrl}/staff/${userId}`, { headers })
          .subscribe({
            next: res => {
              const staff = res?.data ?? res;
              if (staff && (staff.staffId || staff.name)) {
                this.userExtraDetails = staff;
              } else {
                this.fallbackToUserTable(userId);
              }
              this.cdr.markForCheck();
            },
            error: () => { this.fallbackToUserTable(userId); }
          });
        break;

      case 'COMPLIANCE_OFFICER':
      case 'ADMIN':
      default:
        this.fallbackToUserTable(userId);
        break;
    }
  }

  private fallbackToUserTable(userId: number) {
    this.adminService.getUserById(userId).subscribe({
      next: user => {
        this.userExtraDetails = user;
        this.cdr.markForCheck();
      },
      error: () => {
        this.userExtraDetails = null;
        this.cdr.markForCheck();
      }
    });
  }
}
