import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-admin-system-health-tab',
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './admin-system-health-tab.html',
  styleUrl: '../admin.css'
})
export class AdminSystemHealthTab implements OnInit {
  systemHealthLoading = false;
  systemHealthLastUpdated: Date | null = null;
  systemServices: Array<{
    key: string;
    label: string;
    endpoint: string;
    probePath: string | null;
    status: 'UP' | 'DOWN' | 'UNKNOWN';
    responseMs: number | null;
    details?: string;
  }> = [
    { key: 'gateway', label: 'API Gateway', endpoint: '/actuator/health', probePath: `${environment.apiBaseUrl}/actuator/health`, status: 'UNKNOWN', responseMs: null },
    { key: 'auth', label: 'Auth Service', endpoint: '/admin/users', probePath: `${environment.apiBaseUrl}/admin/users`, status: 'UNKNOWN', responseMs: null },
    { key: 'citizen', label: 'Citizen Service', endpoint: '/api/citizens', probePath: `${environment.apiBaseUrl}/api/citizens`, status: 'UNKNOWN', responseMs: null },
    { key: 'emergency', label: 'Emergency Service', endpoint: '/emergencies', probePath: `${environment.apiBaseUrl}/emergencies`, status: 'UNKNOWN', responseMs: null },
    { key: 'facility', label: 'Facility Service', endpoint: '/facilities', probePath: `${environment.apiBaseUrl}/facilities`, status: 'UNKNOWN', responseMs: null },
    { key: 'patient', label: 'Patient/Treatment Service', endpoint: '/patients', probePath: `${environment.apiBaseUrl}/patients`, status: 'UNKNOWN', responseMs: null },
    { key: 'compliance', label: 'Compliance Service', endpoint: '/compliance/logs', probePath: `${environment.apiBaseUrl}/compliance/logs`, status: 'UNKNOWN', responseMs: null },
    { key: 'registry', label: 'Service Registry', endpoint: 'Inferred via Gateway discovery', probePath: null, status: 'UNKNOWN', responseMs: null },
  ];

  private get headers() {
    return new HttpHeaders({
      Authorization: `Bearer ${this.auth.getToken()}`
    });
  }

  constructor(
    private http: HttpClient,
    private auth: AuthService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadSystemHealth();
  }

  loadSystemHealth() {
    if (this.systemHealthLoading) return;

    this.systemHealthLoading = true;
    const currentUserId = this.auth.getUser()?.userId || this.auth.getUser()?.id;

    const requests = this.systemServices.map(service => {
      if (!service.probePath) {
        return of({
          key: service.key,
          status: 'UNKNOWN' as const,
          responseMs: null,
          details: 'Derived from gateway discovery status',
        });
      }

      const probeUrl = service.probePath.replace('{userId}', String(currentUserId ?? '0'));
      const startedAt = performance.now();
      return this.http.get<any>(probeUrl, {
        headers: this.headers,
        observe: 'response'
      }).pipe(
        map(res => {
          const bodyStatus = String((res as any)?.body?.status ?? '').toUpperCase();
          const isUp = (res as any)?.status >= 200 && (res as any)?.status < 300 && bodyStatus !== 'DOWN';
          return {
            key: service.key,
            status: isUp ? 'UP' as const : 'DOWN' as const,
            responseMs: Math.round(performance.now() - startedAt),
            details: bodyStatus || `HTTP ${(res as any)?.status}`,
          };
        }),
        catchError((err) => {
          const httpStatus = err?.status as number | undefined;
          const isAuthRestricted = httpStatus === 401 || httpStatus === 403;
          return of({
            key: service.key,
            status: isAuthRestricted ? 'UNKNOWN' as const : 'DOWN' as const,
            responseMs: Math.round(performance.now() - startedAt),
            details: httpStatus
              ? (isAuthRestricted ? `HTTP ${httpStatus} (Access restricted)` : `HTTP ${httpStatus}`)
              : 'Unavailable',
          });
        })
      );
    });

    forkJoin(requests).subscribe({
      next: results => {
        const resultMap = new Map(results.map(r => [r.key, r]));
        this.systemServices = this.systemServices.map(service => {
          const result = resultMap.get(service.key);
          if (!result) return service;

          if (service.key === 'registry') {
            const gateway = resultMap.get('gateway');
            if (gateway?.status === 'UP') {
              return {
                ...service,
                status: 'UP' as const,
                responseMs: gateway.responseMs,
                details: 'Gateway discovery active',
              };
            }
            return {
              ...service,
              status: 'UNKNOWN' as const,
              responseMs: null,
              details: 'Unable to infer discovery status',
            };
          }

          return {
            ...service,
            status: result.status,
            responseMs: result.responseMs,
            details: result.details,
          };
        });
        this.systemHealthLastUpdated = new Date();
        this.systemHealthLoading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.systemHealthLoading = false;
        this.cdr.markForCheck();
      }
    });
  }

  get upServicesCount() {
    return this.systemServices.filter(s => s.status === 'UP').length;
  }

  get downServicesCount() {
    return this.systemServices.filter(s => s.status === 'DOWN').length;
  }

  get averageResponseMs() {
    const samples = this.systemServices.map(s => s.responseMs).filter((v): v is number => typeof v === 'number');
    if (samples.length === 0) return 0;
    return Math.round(samples.reduce((a, b) => a + b, 0) / samples.length);
  }
}
