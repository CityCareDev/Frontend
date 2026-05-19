import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { Role } from '../../models/user.model';

export function authGuard(allowedRoles: Role[]): CanActivateFn {
  return (): boolean | UrlTree => {
    const auth = inject(AuthService);
    const router = inject(Router);

    const user = auth.getUser();
    if (!auth.isLoggedIn() || !user) {
      return router.createUrlTree(['/login']);
    }

    const role = user.role;
    if (role && allowedRoles.includes(role)) return true;

    const roleRoutes: Partial<Record<Role, string>> = {
      CITIZEN: '/citizen',
      DOCTOR: '/doctor',
      DISPATCHER: '/dispatcher',
      ADMIN: '/admin',
      COMPLIANCE_OFFICER: '/compliance',
    };

    return router.createUrlTree([roleRoutes[role] ?? '/login']);
  };
}
