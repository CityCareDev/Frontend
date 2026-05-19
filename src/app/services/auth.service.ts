import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, map, tap } from 'rxjs';
import { AuthResponse, User, Role } from '../../models/user.model';
import { ApiResponse } from '../../models/api-response.model';
import { environment } from '../../environments/environment';

// Shape the backend actually returns inside ApiResponse.data
interface BackendAuthData {
  token: string;
  userId: number;
  name: string;
  email: string;
  role: Role;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly API = environment.apiBaseUrl;
  private userSubject = new BehaviorSubject<User | null>(this.loadUser());
  user$ = this.userSubject.asObservable();

  constructor(private http: HttpClient, private router: Router) {}

  login(email: string, password: string): Observable<AuthResponse> {
    return this.http.post<ApiResponse<BackendAuthData>>(`${this.API}/auth/login`, { email, password }).pipe(
      map(res => this.normalise(res.data)),
      tap(res => this.persist(res))
    );
  }

  register(data: any): Observable<AuthResponse> {
    return this.http.post<ApiResponse<BackendAuthData>>(`${this.API}/auth/register`, data).pipe(
      map(res => this.normalise(res.data)),
      tap(res => this.persist(res))
    );
  }

  logout() {
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
    this.userSubject.next(null);
    this.router.navigate(['/login']);
  }

  getToken(): string | null { return sessionStorage.getItem('token'); }
  getUser(): User | null { return this.userSubject.value; }
  isLoggedIn(): boolean { return !!this.getToken(); }
  hasRole(role: Role): boolean { return this.getUser()?.role === role; }

  redirectByRole() {
    const role = this.getUser()?.role;
    const routes: Partial<Record<Role, string>> = {
      CITIZEN: '/citizen',
      DOCTOR: '/doctor',
      DISPATCHER: '/dispatcher',
      ADMIN: '/admin',
      COMPLIANCE_OFFICER: '/compliance',
    };
    this.router.navigate([routes[role!] ?? '/login']);
  }

  private normalise(data: BackendAuthData): AuthResponse {
    return {
      token: data.token,
      user: { id: data.userId, userId: data.userId, name: data.name, email: data.email, role: data.role }
    };
  }

  private persist(res: AuthResponse) {
    sessionStorage.setItem('token', res.token);
    sessionStorage.setItem('user', JSON.stringify(res.user));
    this.userSubject.next(res.user);
  }

  private loadUser(): User | null {
    const u = sessionStorage.getItem('user');
    return u ? JSON.parse(u) : null;
  }
}
