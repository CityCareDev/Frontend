export type Role = 'CITIZEN' | 'DOCTOR' | 'DISPATCHER' | 'ADMIN' | 'COMPLIANCE_OFFICER';

export interface User {
  id: number;
  userId: number;
  name: string;
  email: string;
  role: Role;
  phone?: string;
  status?: 'ACTIVE' | 'INACTIVE';
}

// Backend returns a flat AuthResponse; we normalise it in AuthService
export interface AuthResponse {
  token: string;
  user: User;
}
