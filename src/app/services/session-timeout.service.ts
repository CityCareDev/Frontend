import { Injectable, NgZone } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';
import { ToastService } from './toast.service';

@Injectable({ providedIn: 'root' })
export class SessionTimeoutService {
  private timeoutMs = 30 * 60 * 1000; // 30 minutes
  private warningMs = 25 * 60 * 1000; // Warning at 25 minutes
  private timeoutId: any = null;
  private warningId: any = null;
  private initialized = false;

  constructor(
    private auth: AuthService,
    private router: Router,
    private toast: ToastService,
    private ngZone: NgZone
  ) {}

  init() {
    if (this.initialized) return;
    this.initialized = true;

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];

    this.ngZone.runOutsideAngular(() => {
      events.forEach(event => {
        document.addEventListener(event, () => this.resetTimer(), { passive: true });
      });
    });

    this.resetTimer();
  }

  private resetTimer() {
    if (!this.auth.isLoggedIn()) return;

    if (this.timeoutId) clearTimeout(this.timeoutId);
    if (this.warningId) clearTimeout(this.warningId);

    this.warningId = setTimeout(() => {
      this.ngZone.run(() => {
        this.toast.showWarning('Your session will expire in 5 minutes due to inactivity.');
      });
    }, this.warningMs);

    this.timeoutId = setTimeout(() => {
      this.ngZone.run(() => {
        this.toast.showError('Session expired due to inactivity. Please log in again.');
        this.auth.logout();
      });
    }, this.timeoutMs);
  }

  destroy() {
    if (this.timeoutId) clearTimeout(this.timeoutId);
    if (this.warningId) clearTimeout(this.warningId);
    this.initialized = false;
  }
}

