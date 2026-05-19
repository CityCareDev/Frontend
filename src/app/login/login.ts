import { Component, ChangeDetectorRef, NgZone } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, CommonModule],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {
  isRegister = false;
  error = '';
  loading = false;

  loginForm: FormGroup;
  registerForm: FormGroup;

  constructor(
    private auth: AuthService,
    private fb: FormBuilder,
    private cdr: ChangeDetectorRef,
    private zone: NgZone
  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required]]
    });

    this.registerForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2), Validators.pattern(/^[a-zA-Z\s]+$/)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8), Validators.pattern(/^(?=.*[0-9])(?=.*[a-z])(?=.*[A-Z]).{8,}$/)]],
      phone: ['', [Validators.required, Validators.pattern(/^\d{10}$/)]],
      role: ['CITIZEN']
    });
  }

  private handleError(e: any, fallback: string) {
    this.zone.run(() => {
      this.loading = false;
      const body = e?.error;
      if (typeof body === 'string') {
        this.error = body || fallback;
      } else if (body?.message) {
        this.error = body.message;
      } else if (typeof e?.message === 'string') {
        this.error = e.message;
      } else {
        this.error = fallback;
      }
      this.cdr.detectChanges();
    });
  }

  onSubmit() {
    this.error = '';

    if (this.isRegister) {
      if (this.registerForm.invalid) {
        this.registerForm.markAllAsTouched();
        return;
      }
      this.loading = true;
      this.auth.register(this.registerForm.value).subscribe({
        next: () => this.auth.redirectByRole(),
        error: (e: any) => this.handleError(e, 'Registration failed')
      });
    } else {
      if (this.loginForm.invalid) {
        this.loginForm.markAllAsTouched();
        return;
      }
      this.loading = true;
      const { email, password } = this.loginForm.value;
      this.auth.login(email, password).subscribe({
        next: () => this.auth.redirectByRole(),
        error: (e: any) => this.handleError(e, 'Login failed')
      });
    }
  }

  get f() { return this.loginForm.controls; }
  get r() { return this.registerForm.controls; }
}
