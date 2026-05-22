import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { finalize } from 'rxjs/operators';
import { FacilityService } from '../../services/facility.service';
import { ToastService } from '../../services/toast.service';
import { Facility, FacilityStatus, FacilityType } from '../../../models/facility.model';

@Component({
  selector: 'app-admin-facilities-tab',
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './admin-facilities-tab.html',
  styleUrl: '../admin.css'
})
export class AdminFacilitiesTab implements OnInit {
  facilities: Facility[] = [];
  filteredFacilities: Facility[] = [];
  facilityPage = 0;
  facilitySize = 10;
  facilityTotalPages = 0;
  facilityTotalElements = 0;
  showAddFacility = false;
  isSavingFacility = false;
  errorMsg = '';

  editingFacility: Facility | null = null;
  editFacilityForm: FormGroup;
  isSavingEdit = false;
  editErrorMsg = '';

  facilityStatusFilter: FacilityStatus | 'ALL' = 'ALL';
  facilitySort: { key: 'facilityId' | 'name' | 'type' | 'location' | 'capacity' | 'status'; direction: 'asc' | 'desc' } = {
    key: 'facilityId',
    direction: 'asc'
  };

  readonly FacilityStatus = FacilityStatus;
  readonly FacilityType = FacilityType;

  facilityForm: FormGroup;

  private readonly actionInFlight = new Set<string>();

  constructor(
    private readonly facilityService: FacilityService,
    private readonly toastService: ToastService,
    private readonly fb: FormBuilder,
    private readonly cdr: ChangeDetectorRef
  ) {
    this.facilityForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(100)]],
      type: [FacilityType.HOSPITAL, Validators.required],
      location: ['', Validators.required],
      capacity: [0, [Validators.required, Validators.min(0)]],
      status: [FacilityStatus.ACTIVE]
    });
    this.editFacilityForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(100)]],
      type: [FacilityType.HOSPITAL, Validators.required],
      location: ['', Validators.required],
      capacity: [0, [Validators.required, Validators.min(0)]],
      status: [FacilityStatus.ACTIVE, Validators.required]
    });
  }

  ngOnInit() {
    this.loadFacilities();
  }

  loadFacilities(page: number = this.facilityPage) {
    this.facilityService.getAllFacilitiesPage(page, this.facilitySize).subscribe({
      next: data => {
        this.facilityPage = data.number;
        this.facilitySize = data.size;
        this.facilityTotalPages = data.totalPages;
        this.facilityTotalElements = data.totalElements;
        this.facilities = data.content ?? [];
        this.applyFacilityFilter();
        this.cdr.markForCheck();
      },
      error: () => {
        this.facilityPage = 0;
        this.facilityTotalPages = 0;
        this.facilityTotalElements = 0;
        this.facilities = [];
        this.filteredFacilities = [];
        this.cdr.markForCheck();
      }
    });
  }

  goToPreviousFacilityPage() {
    if (this.facilityPage <= 0) return;
    this.loadFacilities(this.facilityPage - 1);
  }

  goToNextFacilityPage() {
    if (this.facilityPage + 1 >= this.facilityTotalPages) return;
    this.loadFacilities(this.facilityPage + 1);
  }

  onFacilityPageSizeChange(size: string | number) {
    const parsed = Number(size);
    this.facilitySize = Number.isFinite(parsed) && parsed > 0 ? parsed : 10;
    this.loadFacilities(0);
  }

  get facilityRangeStart(): number {
    if (this.facilityTotalElements === 0) return 0;
    return (this.facilityPage * this.facilitySize) + 1;
  }

  get facilityRangeEnd(): number {
    return Math.min((this.facilityPage + 1) * this.facilitySize, this.facilityTotalElements);
  }

  toggleAddFacility() {
    this.showAddFacility = !this.showAddFacility;
    if (this.showAddFacility) {
      this.errorMsg = '';
      this.facilityForm.reset({ name: '', type: FacilityType.HOSPITAL, location: '', capacity: 0, status: FacilityStatus.ACTIVE });
    }
  }

  addFacility() {
    if (this.isSavingFacility) return;
    const actionKey = 'facility-add';
    if (!this.beginAction(actionKey)) return;

    if (this.facilityForm.invalid) {
      this.facilityForm.markAllAsTouched();
      this.errorMsg = 'Please fill all required fields correctly';
      this.endAction(actionKey);
      return;
    }

    this.isSavingFacility = true;
    this.facilityService.createFacility(this.facilityForm.value)
      .pipe(finalize(() => {
        this.isSavingFacility = false;
        this.endAction(actionKey);
        this.cdr.markForCheck();
      }))
      .subscribe({
        next: () => {
          this.facilityForm.reset({ name: '', type: FacilityType.HOSPITAL, location: '', capacity: 0, status: FacilityStatus.ACTIVE });
          this.showAddFacility = false;
          this.toastService.showSuccess('Facility added successfully');
          this.loadFacilities();
        },
        error: err => {
          this.errorMsg = err?.error?.message || 'Failed to add facility';
        }
      });
  }

  onFacilityFilterChange() {
    this.applyFacilityFilter();
  }

  applyFacilityFilter() {
    if (this.facilityStatusFilter === 'ALL') {
      this.filteredFacilities = [...this.facilities];
    } else {
      this.filteredFacilities = this.facilities.filter(f => f.status === this.facilityStatusFilter);
    }
    this.applyFacilitySort();
  }

  sortFacilitiesBy(column: 'facilityId' | 'name' | 'type' | 'location' | 'capacity' | 'status') {
    if (this.facilitySort.key === column) {
      this.facilitySort.direction = this.facilitySort.direction === 'asc' ? 'desc' : 'asc';
    } else {
      this.facilitySort = { key: column, direction: 'asc' };
    }
    this.applyFacilitySort();
  }

  trackByFacilityId(_index: number, facility: Facility): number {
    return facility.facilityId;
  }

  editFacility(facility: Facility) {
    this.editingFacility = facility;
    this.editErrorMsg = '';
    this.editFacilityForm.patchValue({
      name: facility.name,
      type: facility.type,
      location: facility.location,
      capacity: facility.capacity,
      status: facility.status
    });
  }

  cancelEdit() {
    this.editingFacility = null;
    this.editErrorMsg = '';
  }

  submitEdit() {
    if (!this.editingFacility || this.isSavingEdit) return;
    if (this.editFacilityForm.invalid) {
      this.editFacilityForm.markAllAsTouched();
      this.editErrorMsg = 'Please fill all required fields correctly';
      return;
    }
    this.isSavingEdit = true;
    this.facilityService.updateFacility(this.editingFacility.facilityId, this.editFacilityForm.value)
      .pipe(finalize(() => { this.isSavingEdit = false; this.cdr.markForCheck(); }))
      .subscribe({
        next: () => {
          this.toastService.showSuccess('Facility updated successfully');
          this.editingFacility = null;
          this.loadFacilities();
        },
        error: err => {
          this.editErrorMsg = err?.error?.message || 'Failed to update facility';
        }
      });
  }

  updateFacilityStatus(facilityId: number, newStatus: FacilityStatus) {
    const actionKey = `facility-status:${facilityId}`;
    if (!this.beginAction(actionKey)) return;

    const facility = this.facilities.find(f => f.facilityId === facilityId);
    const previousStatus = facility?.status;

    // Optimistic update
    if (facility) {
      facility.status = newStatus;
      this.applyFacilityFilter();
    }

    this.facilityService.updateFacilityStatus(facilityId, newStatus)
      .pipe(finalize(() => { this.endAction(actionKey); this.cdr.markForCheck(); }))
      .subscribe({
        next: () => {
          this.toastService.showSuccess('Facility status updated successfully');
        },
        error: err => {
          // Revert on failure
          if (facility && previousStatus) {
            facility.status = previousStatus;
            this.applyFacilityFilter();
          }
          this.toastService.showError(err?.error?.message || 'Failed to update facility status');
        }
      });
  }

  isActionInFlight(actionKey: string): boolean {
    return this.actionInFlight.has(actionKey);
  }

  facilityStatusActionKey(facilityId: number): string {
    return `facility-status:${facilityId}`;
  }

  private applyFacilitySort() {
    const { key, direction } = this.facilitySort;
    const dir = direction === 'asc' ? 1 : -1;

    this.filteredFacilities = [...this.filteredFacilities].sort((a, b) => {
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
}
