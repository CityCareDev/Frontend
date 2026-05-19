import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { inject } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpRequest, HttpHandlerFn, HttpErrorResponse } from '@angular/common/http';
import { catchError, throwError, timeout, TimeoutError } from 'rxjs';
import { routes } from './app.routes';
import { ToastService } from './services/toast.service';

const REQUEST_TIMEOUT_MS = 20_000;

function jwtInterceptor(req: HttpRequest<unknown>, next: HttpHandlerFn) {
  const token = sessionStorage.getItem('token');
  if (token) {
    req = req.clone({ setHeaders: {
      Authorization: `Bearer ${token}`
    }});
  }
  return next(req);
}

function timeoutInterceptor(req: HttpRequest<unknown>, next: HttpHandlerFn) {
  return next(req).pipe(timeout(REQUEST_TIMEOUT_MS));
}

function normalizeTransportError(req: HttpRequest<unknown>, err: unknown): HttpErrorResponse {
  if (err instanceof TimeoutError) {
    return new HttpErrorResponse({
      status: 408,
      statusText: 'Request Timeout',
      url: req.url,
      error: {
        message: 'Request timed out. Please try again.'
      }
    });
  }

  if (err instanceof HttpErrorResponse && err.status === 0) {
    const existingError = (err.error && typeof err.error === 'object') ? err.error : {};
    const offline = typeof navigator !== 'undefined' && navigator && navigator.onLine === false;

    return new HttpErrorResponse({
      status: 0,
      statusText: err.statusText || 'Network Error',
      url: err.url ?? req.url,
      headers: err.headers,
      error: {
        ...existingError,
        message: existingError['message'] || (offline
          ? 'Network appears offline. Please check your connection.'
          : 'Network error. Please check your connection and try again.')
      }
    });
  }

  return err instanceof HttpErrorResponse
    ? err
    : new HttpErrorResponse({
        status: 500,
        statusText: 'Unknown Error',
        url: req.url,
        error: { message: 'Unexpected error occurred.' }
      });
}

function errorInterceptor(req: HttpRequest<unknown>, next: HttpHandlerFn) {
  const toast = inject(ToastService);

  return next(req).pipe(
    catchError((err: unknown) => {
      const normalizedErr = normalizeTransportError(req, err);
      const serverMessage = normalizedErr.error?.message || normalizedErr.message || 'Request failed';

      if (normalizedErr.status === 401 && !req.url.includes('/auth/login')) {
          toast.showWarning('Session expired. Please login again.');
          sessionStorage.removeItem('token');
          sessionStorage.removeItem('user');
          window.location.href = '/login';
      }
      if (normalizedErr.status === 403) {
          toast.showError('You do not have permission to perform this action.');
          console.warn('Access denied (403):', req.url);
      }
      if (normalizedErr.status === 408 || normalizedErr.status === 0) {
          toast.showError(serverMessage);
      }
      if (normalizedErr.status >= 500) {
          toast.showError('Server error. Please try again later.');
      }
      if (normalizedErr.status >= 400 && normalizedErr.status < 500 && normalizedErr.status !== 401 && normalizedErr.status !== 403 && normalizedErr.status !== 408) {
          toast.showError(serverMessage);
      }

      return throwError(() => normalizedErr);
    })
  );
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withInterceptors([jwtInterceptor, errorInterceptor, timeoutInterceptor])),
  ]
};