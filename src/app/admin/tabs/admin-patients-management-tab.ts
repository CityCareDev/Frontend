import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { AdminDashboard } from '../admin';

@Component({
  selector: 'app-admin-patients-management-tab',
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './admin-patients-management-tab.html',
  styleUrl: '../admin.css'
})
export class AdminPatientsManagementTab {
  readonly vm = inject(AdminDashboard);
}
