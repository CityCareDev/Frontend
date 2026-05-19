import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface Toast {
  id: number;
  message: string;
  type: 'error' | 'success' | 'warning' | 'info';
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private toasts$ = new BehaviorSubject<Toast[]>([]);
  private idCounter = 0;

  getToasts() {
    return this.toasts$.asObservable();
  }

  showError(message: string) {
    this.show(message, 'error');
  }

  showSuccess(message: string) {
    this.show(message, 'success');
  }

  showWarning(message: string) {
    this.show(message, 'warning');
  }

  showInfo(message: string) {
    this.show(message, 'info');
  }

  private show(message: string, type: Toast['type']) {
    if (!message || message.trim() === '') return;
    const toast: Toast = { id: ++this.idCounter, message, type };
    const current = this.toasts$.value;
    this.toasts$.next([...current, toast]);

    setTimeout(() => this.remove(toast.id), 5000);
  }

  remove(id: number) {
    const current = this.toasts$.value;
    this.toasts$.next(current.filter(t => t.id !== id));
  }
}
