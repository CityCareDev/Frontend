import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { Emergency, EmergencyRequest } from '../../models/emergency.model';
import { ApiResponse, PageResponse } from '../../models/api-response.model';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class EmergencyService {
  private readonly API = `${environment.apiBaseUrl}/emergencies`;

  constructor(private http: HttpClient) {}

  reportEmergency(request: EmergencyRequest): Observable<Emergency> {
    return this.http.post<ApiResponse<Emergency>>(`${this.API}/report`, request)
      .pipe(map(res => res.data));
  }

  getAllEmergencies(page = 0, size = 1000): Observable<Emergency[]> {
    return this.http.get<ApiResponse<Emergency[] | PageResponse<Emergency>>>(`${this.API}?page=${page}&size=${size}`)
      .pipe(map(res => Array.isArray(res.data) ? res.data : (res.data?.content ?? [])));
  }

  getMyEmergencies(): Observable<Emergency[]> {
    return this.http.get<ApiResponse<Emergency[]>>(`${this.API}/my`)
      .pipe(map(res => res.data));
  }

  getPendingEmergencies(): Observable<Emergency[]> {
    return this.http.get<ApiResponse<Emergency[]>>(`${this.API}/pending`)
      .pipe(map(res => res.data));
  }

  getAvailableAmbulances(): Observable<any[]> {
    return this.http.get<ApiResponse<any[]>>(`${this.API}/ambulances/available`)
      .pipe(map(res => res.data));
  }

  dispatchAmbulance(emergencyId: number, _dispatcherId: number, request: any): Observable<Emergency> {
    return this.http.post<ApiResponse<Emergency>>(`${this.API}/${emergencyId}/dispatch`, request)
      .pipe(map(res => res.data));
  }

  getDispatchedEmergencies(): Observable<Emergency[]> {
    return this.http.get<ApiResponse<Emergency[]>>(`${this.API}/dispatched`)
      .pipe(map(res => res.data));
  }

  getMyDispatchHistory(): Observable<Emergency[]> {
    return this.http.get<ApiResponse<Emergency[]>>(`${this.API}/my-dispatch-history`)
      .pipe(map(res => res.data));
  }

  getEmergencyById(id: number): Observable<Emergency> {
    return this.http.get<ApiResponse<Emergency>>(`${this.API}/${id}`)
      .pipe(map(res => res.data));
  }
}
