import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { AdminDashboard } from '../admin';

@Component({
  selector: 'app-admin-overview-tab',
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './admin-overview-tab.html',
  styleUrl: '../admin.css'
})
export class AdminOverviewTab {
  readonly vm = inject(AdminDashboard);
}
