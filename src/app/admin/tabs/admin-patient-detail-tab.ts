import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { AdminDashboard } from '../admin';

@Component({
  selector: 'app-admin-patient-detail-tab',
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './admin-patient-detail-tab.html',
  styleUrl: '../admin.css'
})
export class AdminPatientDetailTab {
  readonly vm = inject(AdminDashboard);
}
