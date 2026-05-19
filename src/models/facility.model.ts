export enum FacilityType {
  HOSPITAL = 'HOSPITAL',
  CLINIC = 'CLINIC'
}

export enum FacilityStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  MAINTENANCE = 'MAINTENANCE'
}

export enum AmbulanceStatus {
  AVAILABLE = 'AVAILABLE',
  DISPATCHED = 'DISPATCHED',
  MAINTENANCE = 'MAINTENANCE'
}

export interface Facility {
  facilityId: number;
  name: string;
  type: FacilityType;
  location: string;
  capacity: number;
  status: FacilityStatus;
  createdAt?: string;
  updatedAt?: string;
  staffCount?: number;
}

export interface FacilityRequest {
  name: string;
  type: FacilityType;
  location: string;
  capacity: number;
  status: FacilityStatus;
}

export interface Ambulance {
  ambulanceId: number;
  facilityId?: number;
  vehicleNumber: string;
  model?: string;
  status: AmbulanceStatus;
  createdAt?: string;
}

export interface AmbulanceRequest {
  vehicleNumber: string;
  model?: string;
  facilityId?: number;
}
