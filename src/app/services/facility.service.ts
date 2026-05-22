import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { Facility, FacilityRequest, Ambulance, AmbulanceRequest, FacilityStatus } from '../../models/facility.model';
import { ApiResponse, PageResponse } from '../../models/api-response.model';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class FacilityService {
  private readonly API = `${environment.apiBaseUrl}/facilities`;

  constructor(private http: HttpClient) {}

  createFacility(request: FacilityRequest): Observable<Facility> {
    return this.http.post<ApiResponse<Facility>>(this.API, request)
      .pipe(map(res => res.data));
  }

  getAllFacilities(page = 0, size = 1000): Observable<Facility[]> {
    return this.http.get<ApiResponse<Facility[] | PageResponse<Facility>>>(`${this.API}?page=${page}&size=${size}`)
      .pipe(map(res => Array.isArray(res.data) ? res.data : (res.data?.content ?? [])));
  }

  getAllFacilitiesPage(page = 0, size = 10): Observable<PageResponse<Facility>> {
    return this.http.get<ApiResponse<Facility[] | PageResponse<Facility>>>(`${this.API}?page=${page}&size=${size}`)
      .pipe(map(res => {
        if (Array.isArray(res.data)) {
          const content = res.data;
          const totalElements = content.length;
          return {
            content,
            totalElements,
            totalPages: totalElements > 0 ? 1 : 0,
            number: 0,
            size: totalElements,
            first: true,
            last: true,
            empty: totalElements === 0
          } as PageResponse<Facility>;
        }
        return res.data;
      }));
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

