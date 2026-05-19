import { Component, HostListener } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import { AsyncPipe, CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';
import { environment } from '../../environments/environment';

interface OmniSearchResult {
  title: string;
  subtitle: string;
  route: string;
  queryParams?: Record<string, any>;
  action?: 'toggleTheme';
}

@Component({
  selector: 'app-navbar',
  imports: [AsyncPipe, CommonModule, FormsModule],
  templateUrl: './navbar.html',
  styleUrl: './navbar.css',
})
export class Navbar {
  user$;
  isDarkMode = false;
  showCommandPalette = false;
  omniQuery = '';
  omniLoading = false;
  omniResults: OmniSearchResult[] = [];
  private omniSearchTimer: ReturnType<typeof setTimeout> | null = null;
  private omniRequestSequence = 0;

  constructor(public auth: AuthService, private router: Router, private http: HttpClient) {
    this.user$ = this.auth.user$;
    this.isDarkMode = localStorage.getItem('theme') === 'dark' || 
      (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (this.isDarkMode) {
      document.documentElement.setAttribute('data-theme', 'dark');
    }
  }

  private get headers() {
    return new HttpHeaders({ Authorization: `Bearer ${this.auth.getToken()}` });
  }

  openCommandPalette() {
    this.showCommandPalette = true;
    this.omniQuery = '';
    this.omniResults = this.getQuickActions('');
    this.omniLoading = false;

    setTimeout(() => {
      const input = document.getElementById('omni-search-input') as HTMLInputElement | null;
      input?.focus();
    }, 10);
  }

  closeCommandPalette() {
    this.showCommandPalette = false;
    this.omniLoading = false;
    this.omniQuery = '';
    this.omniResults = [];
    if (this.omniSearchTimer) {
      clearTimeout(this.omniSearchTimer);
      this.omniSearchTimer = null;
    }
  }

  @HostListener('window:keydown', ['$event'])
  onGlobalShortcut(event: KeyboardEvent) {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      if (this.showCommandPalette) {
        this.closeCommandPalette();
      } else {
        this.openCommandPalette();
      }
      return;
    }

    if (event.key === 'Escape' && this.showCommandPalette) {
      this.closeCommandPalette();
    }
  }

  onOmniQueryChange() {
    const query = this.omniQuery.trim();
    const quickActions = this.getQuickActions(query);

    if (!query || query.length < 2) {
      this.omniResults = quickActions;
      this.omniLoading = false;
      return;
    }

    this.omniLoading = true;
    if (this.omniSearchTimer) {
      clearTimeout(this.omniSearchTimer);
    }

    this.omniSearchTimer = setTimeout(() => {
      this.searchDynamicEntities(query, quickActions);
    }, 220);
  }

  onOmniEnter() {
    if (this.omniResults.length > 0) {
      this.executeOmniResult(this.omniResults[0]);
    }
  }

  executeOmniResult(result: OmniSearchResult) {
    if (result.action === 'toggleTheme') {
      this.toggleTheme();
      this.closeCommandPalette();
      return;
    }

    this.closeCommandPalette();
    if (result.queryParams) {
      this.router.navigate([result.route], { queryParams: result.queryParams });
      return;
    }
    this.router.navigate([result.route]);
  }

  private searchDynamicEntities(query: string, quickActions: OmniSearchResult[]) {
    const requestId = ++this.omniRequestSequence;
    const lower = query.toLowerCase();
    const role = this.auth.getUser()?.role;

    if (role !== 'ADMIN') {
      this.omniResults = quickActions.slice(0, 10);
      this.omniLoading = false;
      return;
    }

    const users$ = this.http.get<any>(`${environment.apiBaseUrl}/admin/users`, { headers: this.headers }).pipe(
      map(res => {
        const raw = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
        return raw
          .filter((u: any) => String(u?.name ?? '').toLowerCase().includes(lower) || String(u?.email ?? '').toLowerCase().includes(lower))
          .slice(0, 4)
          .map((u: any) => ({
            title: `User: ${u.name}`,
            subtitle: `${u.role || 'USER'} • ${u.email || 'No email'}`,
            route: '/admin',
            queryParams: { tab: 'userDetail', userId: (u.userId || u.id) }
          } as OmniSearchResult));
      }),
      catchError(() => of([] as OmniSearchResult[]))
    );

    const facilities$ = this.http.get<any>(`${environment.apiBaseUrl}/facilities`, { headers: this.headers }).pipe(
      map(res => {
        const raw = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
        return raw
          .filter((f: any) => String(f?.name ?? '').toLowerCase().includes(lower) || String(f?.location ?? '').toLowerCase().includes(lower))
          .slice(0, 4)
          .map((f: any) => ({
            title: `Facility: ${f.name}`,
            subtitle: `${f.type || 'Facility'} • ${f.location || 'Unknown location'}`,
            route: '/admin',
            queryParams: { tab: 'facilities' }
          } as OmniSearchResult));
      }),
      catchError(() => of([] as OmniSearchResult[]))
    );

    const patients$ = this.http.get<any>(`${environment.apiBaseUrl}/patients`, { headers: this.headers }).pipe(
      map(res => {
        const raw = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
        return raw
          .filter((p: any) => String(p?.patientId ?? '').includes(query) || String(p?.status ?? '').toLowerCase().includes(lower))
          .slice(0, 3)
          .map((p: any) => ({
            title: `Patient #${p.patientId}`,
            subtitle: `${p.status || 'Unknown status'} • Citizen #${p.citizenId ?? 'N/A'}`,
            route: '/admin',
            queryParams: { tab: 'patientsManagement' }
          } as OmniSearchResult));
      }),
      catchError(() => of([] as OmniSearchResult[]))
    );

    forkJoin([users$, facilities$, patients$]).subscribe({
      next: ([users, facilities, patients]) => {
        if (requestId !== this.omniRequestSequence) return;
        this.omniResults = [...quickActions, ...users, ...facilities, ...patients].slice(0, 12);
        this.omniLoading = false;
      },
      error: () => {
        if (requestId !== this.omniRequestSequence) return;
        this.omniResults = quickActions.slice(0, 10);
        this.omniLoading = false;
      }
    });
  }

  private getQuickActions(query: string): OmniSearchResult[] {
    const role = this.auth.getUser()?.role;
    const all: OmniSearchResult[] = [
      { title: 'Go to Overview', subtitle: 'Dashboard home', route: role === 'ADMIN' ? '/admin' : (role === 'CITIZEN' ? '/citizen' : '/login'), queryParams: role === 'ADMIN' ? { tab: 'overview' } : undefined },
      { title: 'Toggle Dark Mode', subtitle: 'Theme preference', route: this.router.url || '/admin', action: 'toggleTheme' },
    ];

    if (role === 'ADMIN') {
      all.push(
        { title: 'System Health', subtitle: 'Observability command center', route: '/admin', queryParams: { tab: 'systemHealth' } },
        { title: 'Facilities Management', subtitle: 'Facility registry and status', route: '/admin', queryParams: { tab: 'facilities' } },
        { title: 'User Management', subtitle: 'Staff and account operations', route: '/admin', queryParams: { tab: 'users' } },
        { title: 'Patient Admissions', subtitle: 'Patients and admissions workflow', route: '/admin', queryParams: { tab: 'patientsManagement' } },
      );
    } else if (role === 'COMPLIANCE_OFFICER') {
      all.push(
        { title: 'Compliance Records', subtitle: 'Review records', route: '/compliance', queryParams: { tab: 'records' } },
        { title: 'Audit Logs Timeline', subtitle: 'Operational ledger view', route: '/compliance', queryParams: { tab: 'logs' } },
      );
    }

    const lower = query.toLowerCase();
    const filtered = all.filter(item =>
      !query || item.title.toLowerCase().includes(lower) || item.subtitle.toLowerCase().includes(lower)
    );

    return filtered;
  }

  toggleTheme() {
    this.isDarkMode = !this.isDarkMode;
    if (this.isDarkMode) {
      document.documentElement.setAttribute('data-theme', 'dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
      localStorage.setItem('theme', 'light');
    }
  }
  logout() { this.auth.logout(); }
}
