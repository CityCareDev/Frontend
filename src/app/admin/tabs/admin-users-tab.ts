
import { Component, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AdminService, CreateUserRequest } from '../../services/admin.service';
import { FacilityService } from '../../services/facility.service';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';
import { User } from '../../../models/user.model';

@Component({
  selector: 'app-admin-users-tab',
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './admin-users-tab.html',
  styleUrl: '../admin.css'
})
export class AdminUsersTab {
  users: User[] = [];
  allUsers: User[] = [];
  paginatedUsers: User[] = [];
  userPage = 0;
  userSize = 10;
  userTotalPages = 0;
  userTotalElements = 0;
  showAddUser = false;
  isSubmitting = false;
  errorMsg = '';
  userSort: { key: 'userId' | 'name' | 'email' | 'role' | 'status'; direction: 'asc' | 'desc' } = {
    key: 'userId',
    direction: 'asc'
  };
  userForm: FormGroup;

  facilities: any[] = [];

  constructor(
    public adminService: AdminService,
    public auth: AuthService,
    private toastService: ToastService,
    private fb: FormBuilder,
    private facilityService: FacilityService,
    private router: Router,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef
  ) {
    this.userForm = this.fb.group({
      name: ['', [Validators.required, Validators.pattern(/^[A-Za-z\s]+$/)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8), Validators.pattern(/^(?=.*[A-Z])(?=.*[a-z])(?=.*\d).+$/)]],
      phone: ['', [Validators.required, Validators.pattern(/^[0-9]{10}$/)]],
      role: ['', Validators.required],
      facilityId: [null]
    });
    this.loadUsers();
    this.loadFacilities();
  }

  loadFacilities() {
    this.facilityService.getAllFacilities().subscribe({
      next: data => { this.facilities = data; this.cdr.markForCheck(); },
      error: () => { this.facilities = []; this.cdr.markForCheck(); }
    });
  }

  loadUsers() {
    this.adminService.getAllUsers().subscribe({
      next: data => {
        this.allUsers = data;
        this.applyUserSort();
        this.applyPagination();
        this.cdr.markForCheck();
      },
      error: () => {
        this.allUsers = [];
        this.users = [];
        this.paginatedUsers = [];
        this.userPage = 0;
        this.userTotalPages = 0;
        this.userTotalElements = 0;
        this.cdr.markForCheck();
      }
    });
  }

  toggleAddUser() {
    this.showAddUser = !this.showAddUser;
    if (this.showAddUser) {
      this.userForm.reset();
      this.errorMsg = '';
    }
  }

  addUser() {
    if (this.userForm.invalid) {
      this.userForm.markAllAsTouched();
      this.errorMsg = 'Please fill all required fields correctly';
      return;
    }
    this.isSubmitting = true;
    const formValue = this.userForm.value;
    const payload: CreateUserRequest = {
      name: formValue.name,
      email: formValue.email,
      password: formValue.password,
      phone: formValue.phone,
      role: formValue.role
    };

    let request$;
    if (formValue.role === 'DOCTOR' || formValue.role === 'DISPATCHER') {
      if (!formValue.facilityId) {
        this.errorMsg = 'Please select a facility for this role';
        this.isSubmitting = false;
        return;
      }
      request$ = this.adminService.createStaffViaFacility({
        ...payload,
        facilityId: Number(formValue.facilityId)
      });
    } else if (formValue.role === 'COMPLIANCE_OFFICER') {
      request$ = this.adminService.createComplianceOfficer(payload);
    } else {
      this.errorMsg = 'Invalid role selected';
      this.isSubmitting = false;
      return;
    }

    request$
      .subscribe({
        next: () => {
          this.toastService.showSuccess('User added successfully');
          this.showAddUser = false;
          this.loadUsers();
        },
        error: err => {
          this.errorMsg = err?.error?.message || 'Failed to add user';
        }
      }).add(() => {
        this.isSubmitting = false;
        this.cdr.markForCheck();
      });
  }

  sortUsersBy(column: 'userId' | 'name' | 'email' | 'role' | 'status') {
    if (this.userSort.key === column) {
      this.userSort.direction = this.userSort.direction === 'asc' ? 'desc' : 'asc';
    } else {
      this.userSort = { key: column, direction: 'asc' };
    }
    this.applyUserSort();
  }

  applyUserSort() {
    const { key, direction } = this.userSort;
    const dir = direction === 'asc' ? 1 : -1;
    this.users = [...this.allUsers].sort((a, b) => {
      const aValue = (a as any)?.[key];
      const bValue = (b as any)?.[key];
      if (aValue == null && bValue == null) return 0;
      if (aValue == null) return -1;
      if (bValue == null) return 1;
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return (aValue - bValue) * dir;
      }
      return String(aValue).localeCompare(String(bValue), undefined, { numeric: true, sensitivity: 'base' }) * dir;
    });
    this.applyPagination();
  }

  applyPagination() {
    this.userTotalElements = this.users.length;
    this.userTotalPages = this.userTotalElements > 0 ? Math.ceil(this.userTotalElements / this.userSize) : 0;
    // Clamp page if it exceeds available pages (e.g. after filtering or when entries < page size)
    if (this.userPage >= this.userTotalPages) {
      this.userPage = Math.max(0, this.userTotalPages - 1);
    }
    const start = this.userPage * this.userSize;
    const end = start + this.userSize;
    this.paginatedUsers = this.users.slice(start, end);
  }

  goToPreviousUserPage() {
    if (this.userPage <= 0) return;
    this.userPage--;
    this.applyPagination();
  }

  goToNextUserPage() {
    if (this.userPage + 1 >= this.userTotalPages) return;
    this.userPage++;
    this.applyPagination();
  }

  onUserPageSizeChange(size: string | number) {
    const parsed = Number(size);
    this.userSize = Number.isFinite(parsed) && parsed > 0 ? parsed : 10;
    this.userPage = 0;
    this.applyPagination();
  }

  get userRangeStart(): number {
    if (this.userTotalElements === 0) return 0;
    return (this.userPage * this.userSize) + 1;
  }

  get userRangeEnd(): number {
    return Math.min((this.userPage + 1) * this.userSize, this.userTotalElements);
  }

  trackByUserId(_index: number, user: User): number {
    return user.userId || user.id;
  }

  viewUserDetails(user: User) {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: 'userDetail', userId: user.userId || user.id },
      queryParamsHandling: 'merge'
    });
  }
}
