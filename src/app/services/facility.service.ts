import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { Facility, FacilityRequest, Ambulance, AmbulanceRequest, FacilityStatus } from '../../models/facility.model';
import { ApiResponse } from '../../models/api-response.model';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class FacilityService {
  private readonly API = `${environment.apiBaseUrl}/facilities`;

  constructor(private http: HttpClient) {}

  createFacility(request: FacilityRequest): Observable<Facility> {
    return this.http.post<ApiResponse<Facility>>(this.API, request)
      .pipe(map(res => res.data));
  }

  getAllFacilities(): Observable<Facility[]> {
    return this.http.get<ApiResponse<Facility[]>>(this.API)
      .pipe(map(res => res.data));
  }

  getFacilityById(id: number): Observable<Facility> {
    return this.http.get<ApiResponse<Facility>>(`${this.API}/${id}`)
      .pipe(map(res => res.data));
  }

  updateFacility(id: number, request: FacilityRequest): Observable<Facility> {
    return this.http.put<ApiResponse<Facility>>(`${this.API}/${id}`, request)
      .pipe(map(res => res.data));
  }

  updateFacilityStatus(id: number, status: FacilityStatus): Observable<Facility> {
    return this.http.patch<ApiResponse<Facility>>(`${this.API}/${id}/status?status=${status}`, {})
      .pipe(map(res => res.data));
  }

  getFacilityStaff(id: number): Observable<any[]> {
    return this.http.get<ApiResponse<any[]>>(`${this.API}/${id}/staff`)
      .pipe(map(res => res.data));
  }

  getFacilitiesByType(type: string): Observable<Facility[]> {
    return this.http.get<ApiResponse<Facility[]>>(`${this.API}/type/${type}`)
      .pipe(map(res => res.data));
  }

  getFacilitiesByStatus(status: FacilityStatus): Observable<Facility[]> {
    return this.http.get<ApiResponse<Facility[]>>(`${this.API}/status/${status}`)
      .pipe(map(res => res.data));
  }
}

@Injectable({ providedIn: 'root' })
export class AmbulanceService {
  private readonly API = `${environment.apiBaseUrl}/emergencies/admin/ambulances`;

  constructor(private http: HttpClient) {}

  createAmbulance(request: AmbulanceRequest): Observable<Ambulance> {
    return this.http.post<ApiResponse<Ambulance>>(this.API, request)
      .pipe(map(res => res.data));
  }

  getAllAmbulances(): Observable<Ambulance[]> {
    return this.http.get<ApiResponse<Ambulance[]>>(this.API)
      .pipe(map(res => res.data));
  }

  getAvailableAmbulances(): Observable<Ambulance[]> {
    return this.http.get<ApiResponse<Ambulance[]>>(`${this.API}/available`)
      .pipe(map(res => res.data));
  }

  updateAmbulanceStatus(id: number, status: string): Observable<Ambulance> {
    return this.http.patch<ApiResponse<Ambulance>>(`${this.API}/${id}/status?status=${status}`, {})
      .pipe(map(res => res.data));
  }

  deleteAmbulance(id: number): Observable<any> {
    return this.http.delete<ApiResponse<any>>(`${this.API}/${id}`)
      .pipe(map(res => res.data));
  }
}

