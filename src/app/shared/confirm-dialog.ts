import { Component, Injectable } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject } from 'rxjs';

export interface ConfirmDialogOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info';
}

@Injectable({ providedIn: 'root' })
export class ConfirmDialogService {
  private dialogSubject = new Subject<{ options: ConfirmDialogOptions; resolve: (value: boolean) => void }>();
  dialog$ = this.dialogSubject.asObservable();

  confirm(options: ConfirmDialogOptions): Promise<boolean> {
    return new Promise(resolve => {
      this.dialogSubject.next({ options, resolve });
    });
  }
}

@Component({
  selector: 'app-confirm-dialog',
  imports: [CommonModule],
  template: `
    @if (visible) {
      <div class="dialog-overlay" (click)="cancel()">
        <div class="dialog-panel" [class]="options.type || 'info'" (click)="$event.stopPropagation()">
          <div class="dialog-header">
            <span class="dialog-icon">
              @if (options.type === 'danger') {
                <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>
              } @else if (options.type === 'warning') {
                <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
              } @else {
                <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
              }
            </span>
            <h3>{{ options.title }}</h3>
          </div>
          <p class="dialog-message">{{ options.message }}</p>
          <div class="dialog-actions">
            <button class="btn-dialog-cancel" (click)="cancel()">{{ options.cancelText || 'Cancel' }}</button>
            <button class="btn-dialog-confirm" [class]="options.type || 'info'" (click)="confirmAction()">{{ options.confirmText || 'Confirm' }}</button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .dialog-overlay {
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(15, 23, 42, 0.6);
      backdrop-filter: blur(4px);
      z-index: 10000;
      display: flex;
      align-items: center;
      justify-content: center;
      animation: fadeIn 0.15s ease-out;
    }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes slideUp { from { opacity: 0; transform: translateY(10px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }

    .dialog-panel {
      background: white;
      border-radius: 12px;
      padding: 24px;
      max-width: 420px;
      width: 90%;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      animation: slideUp 0.2s ease-out;
    }
    .dialog-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 12px;
    }
    .dialog-header h3 {
      font-size: 1.125rem;
      font-weight: 700;
      color: #0f172a;
      margin: 0;
    }
    .dialog-icon {
      width: 40px; height: 40px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .dialog-panel.danger .dialog-icon { background: #fef2f2; color: #dc2626; }
    .dialog-panel.warning .dialog-icon { background: #fffbeb; color: #d97706; }
    .dialog-panel.info .dialog-icon { background: #eff6ff; color: #2563eb; }

    .dialog-message {
      color: #475569;
      font-size: 0.875rem;
      line-height: 1.6;
      margin-bottom: 20px;
      padding-left: 52px;
    }
    .dialog-actions {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
    }
    .btn-dialog-cancel {
      padding: 8px 16px;
      border: 1px solid #e2e8f0;
      background: white;
      color: #475569;
      border-radius: 6px;
      font-weight: 600;
      font-size: 0.875rem;
      cursor: pointer;
      transition: all 0.15s;
    }
    .btn-dialog-cancel:hover { background: #f8fafc; border-color: #cbd5e1; }
    .btn-dialog-confirm {
      padding: 8px 16px;
      border: none;
      border-radius: 6px;
      font-weight: 600;
      font-size: 0.875rem;
      cursor: pointer;
      color: white;
      transition: all 0.15s;
    }
    .btn-dialog-confirm.danger { background: #dc2626; }
    .btn-dialog-confirm.danger:hover { background: #b91c1c; }
    .btn-dialog-confirm.warning { background: #d97706; }
    .btn-dialog-confirm.warning:hover { background: #b45309; }
    .btn-dialog-confirm.info { background: #2563eb; }
    .btn-dialog-confirm.info:hover { background: #1d4ed8; }

    :host-context([data-theme="dark"]) .dialog-panel { background: #1e293b; }
    :host-context([data-theme="dark"]) .dialog-header h3 { color: #f8fafc; }
    :host-context([data-theme="dark"]) .dialog-message { color: #94a3b8; }
    :host-context([data-theme="dark"]) .btn-dialog-cancel { background: #334155; border-color: #475569; color: #e2e8f0; }
    :host-context([data-theme="dark"]) .btn-dialog-cancel:hover { background: #475569; }
  `]
})
export class ConfirmDialogComponent {
  visible = false;
  options: ConfirmDialogOptions = { title: '', message: '' };
  private resolve: ((value: boolean) => void) | null = null;

  constructor(private dialogService: ConfirmDialogService) {
    this.dialogService.dialog$.subscribe(({ options, resolve }) => {
      this.options = options;
      this.resolve = resolve;
      this.visible = true;
    });
  }

  confirmAction() {
    this.visible = false;
    this.resolve?.(true);
  }

  cancel() {
    this.visible = false;
    this.resolve?.(false);
  }
}

