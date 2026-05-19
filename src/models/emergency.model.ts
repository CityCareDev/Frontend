export enum EmergencyType {
  ACCIDENT = 'ACCIDENT',
  HEART_ATTACK = 'HEART_ATTACK',
  FIRE = 'FIRE',
  STROKE = 'STROKE',
  FALL = 'FALL',
  OTHER = 'OTHER'
}

export enum EmergencyStatus {
  REPORTED = 'REPORTED',
  DISPATCHED = 'DISPATCHED',
  IN_TRANSIT = 'IN_TRANSIT',
  ON_SCENE = 'ON_SCENE',
  PATIENT_TRANSPORTED = 'PATIENT_TRANSPORTED',
  FACILITY_ARRIVED = 'FACILITY_ARRIVED',
  CLOSED = 'CLOSED'
}

export interface Emergency {
  emergencyId: number;
  citizenId: number;
  citizenName?: string;
  type: EmergencyType;
  location: string;
  description?: string;
  date: string;
  status: EmergencyStatus;
  dispatcherId?: number;
  ambulanceId?: number;
  dispatchedAt?: string;
  reportedAt?: string;
  resolvedAt?: string;
  priority?: number;
}

export interface EmergencyRequest {
  type: EmergencyType;
  location: string;
  description: string;
}

export interface EmergencyResponse {
  emergencyId: number;
  citizenId: number;
  type: string;
  location: string;
  status: string;
  reportedAt: string;
}
