import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { AdminDashboard } from '../admin';

@Component({
  selector: 'app-admin-pending-docs-tab',
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './admin-pending-docs-tab.html',
  styleUrl: '../admin.css'
})
export class AdminPendingDocsTab {
  readonly vm = inject(AdminDashboard);
}
