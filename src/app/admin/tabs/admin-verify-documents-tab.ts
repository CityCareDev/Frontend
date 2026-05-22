import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { AdminDashboard } from '../admin';

@Component({
  selector: 'app-admin-verify-documents-tab',
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './admin-verify-documents-tab.html',
  styleUrl: '../admin.css'
})
export class AdminVerifyDocumentsTab {
  readonly vm = inject(AdminDashboard);
}
