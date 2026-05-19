import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ToastComponent } from './shared/toast';
import { ConfirmDialogComponent } from './shared/confirm-dialog';
import { SessionTimeoutService } from './services/session-timeout.service';
import { AuthService } from './services/auth.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ToastComponent, ConfirmDialogComponent],
  template: '<router-outlet></router-outlet><app-toast></app-toast><app-confirm-dialog></app-confirm-dialog>',
})
export class App implements OnInit {
  constructor(
    private sessionTimeout: SessionTimeoutService,
    private auth: AuthService
  ) {}

  ngOnInit() {
    if (this.auth.isLoggedIn()) {
      this.sessionTimeout.init();
    }
    this.auth.user$.subscribe(user => {
      if (user) {
        this.sessionTimeout.init();
      } else {
        this.sessionTimeout.destroy();
      }
    });
  }
}