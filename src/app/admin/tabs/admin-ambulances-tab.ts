import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { finalize } from 'rxjs/operators';
import { AmbulanceService, FacilityService } from '../../services/facility.service';
import { ToastService } from '../../services/toast.service';
import { ConfirmDialogService } from '../../shared/confirm-dialog';
import { Ambulance, Facility } from '../../../models/facility.model';

@Component({
  selector: 'app-admin-ambulances-tab',
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './admin-ambulances-tab.html',
  styleUrl: '../admin.css'
})
export class AdminAmbulancesTab implements OnInit {
  ambulances: Ambulance[] = [];
  facilities: Facility[] = [];
  errorMsg = '';
  isRegisteringAmbulance = false;
  ambulanceForm: FormGroup;
  private readonly actionInFlight = new Set<string>();

  constructor(
    private readonly ambulanceService: AmbulanceService,
    private readonly facilityService: FacilityService,
    private readonly toastService: ToastService,
    private readonly confirmDialog: ConfirmDialogService,
    private readonly fb: FormBuilder,
    private readonly cdr: ChangeDetectorRef
  ) {
    this.ambulanceForm = this.fb.group({
      vehicleNumber: ['', [Validators.required, Validators.pattern(/^[A-Z]{2,4}-\d{2,4}$/), Validators.minLength(4), Validators.maxLength(10)]],
      model: ['', Validators.maxLength(50)],
      facilityId: [null, Validators.required]
    });
  }

  ngOnInit() {
    this.loadAmbulances();
    this.loadFacilities();
  }

  loadAmbulances() {
    this.ambulanceService.getAllAmbulances().subscribe({
      next: data => {
        this.ambulances = data;
        this.cdr.markForCheck();
      },
      error: () => {
        this.ambulances = [];
        this.cdr.markForCheck();
      }
    });
  }

  loadFacilities() {
    this.facilityService.getAllFacilities().subscribe({
      next: data => {
        this.facilities = data;
        this.cdr.markForCheck();
      },
      error: () => {
        this.facilities = [];
        this.cdr.markForCheck();
      }
    });
  }

  registerAmbulance() {
    if (this.isRegisteringAmbulance) return;
    const actionKey = 'ambulance-register';
    if (!this.beginAction(actionKey)) return;

    if (this.ambulanceForm.invalid) {
      this.ambulanceForm.markAllAsTouched();
      this.toastService.showError('Vehicle number is required');
      this.endAction(actionKey);
      return;
    }

    this.isRegisteringAmbulance = true;
    this.ambulanceService.createAmbulance(this.ambulanceForm.value)
      .pipe(finalize(() => {
        this.isRegisteringAmbulance = false;
        this.endAction(actionKey);
        this.cdr.markForCheck();
      }))
      .subscribe({
        next: () => {
          this.ambulanceForm.reset({ vehicleNumber: '', model: '', facilityId: null });
          this.toastService.showSuccess('Ambulance registered successfully');
          this.loadAmbulances();
        },
        error: err => {
          this.toastService.showError(this.extractErrorMessage(err, 'Failed to register ambulance'));
        }
      });
  }

  updateAmbulanceStatus(id: number, status: string) {
    const actionKey = `ambulance-status:${id}`;
    if (!this.beginAction(actionKey)) return;

    const ambulance = this.ambulances.find(a => a.ambulanceId === id);
    const previousStatus = ambulance?.status;

    // Optimistic update
    if (ambulance) {
      (ambulance as any).status = status;
    }

    this.ambulanceService.updateAmbulanceStatus(id, status)
      .pipe(finalize(() => { this.endAction(actionKey); this.cdr.markForCheck(); }))
      .subscribe({
        next: () => {
          this.toastService.showSuccess('Ambulance status updated');
        },
        error: err => {
          // Revert on failure
          if (ambulance && previousStatus) {
            (ambulance as any).status = previousStatus;
          }
          this.toastService.showError(this.extractErrorMessage(err, 'Failed to update ambulance status'));
        }
      });
  }

  async removeAmbulance(ambulance: Ambulance) {
    if (ambulance.status === 'DISPATCHED') {
      this.toastService.showError('Cannot remove an ambulance that is currently dispatched');
      return;
    }

    const confirmed = await this.confirmDialog.confirm({
      title: 'Remove Ambulance',
      message: `Are you sure you want to remove ambulance ${ambulance.vehicleNumber}? This action cannot be undone.`,
      confirmText: 'Remove',
      type: 'warning'
    });

    if (!confirmed) return;

    const actionKey = this.ambulanceRemoveActionKey(ambulance.ambulanceId);
    if (!this.beginAction(actionKey)) return;

    // Optimistic removal
    const index = this.ambulances.findIndex(a => a.ambulanceId === ambulance.ambulanceId);
    if (index !== -1) {
      this.ambulances.splice(index, 1);
    }

    this.ambulanceService.deleteAmbulance(ambulance.ambulanceId)
      .pipe(finalize(() => { this.endAction(actionKey); this.cdr.markForCheck(); }))
      .subscribe({
        next: () => {
          this.toastService.showSuccess('Ambulance removed successfully');
        },
        error: err => {
          // Revert on failure
          if (index !== -1) {
            this.ambulances.splice(index, 0, ambulance);
          }
          this.toastService.showError(this.extractErrorMessage(err, 'Failed to remove ambulance'));
        }
      });
  }

  getFacilityName(facilityId: number): string {
    const facility = this.facilities.find(f => f.facilityId === facilityId);
    return facility ? facility.name : `Facility #${facilityId}`;
  }

  isActionInFlight(actionKey: string): boolean {
    return this.actionInFlight.has(actionKey);
  }

  ambulanceStatusActionKey(ambulanceId: number): string {
    return `ambulance-status:${ambulanceId}`;
  }

  ambulanceRemoveActionKey(ambulanceId: number): string {
    return `ambulance-remove:${ambulanceId}`;
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
}
