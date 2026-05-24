import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, map, tap } from 'rxjs';
import { ApiResponse, PageResponse } from '../../models/api-response.model';
import { environment } from '../../environments/environment';

export interface CitizenProfile {
  citizenId: number;
  userId: number;
  name: string;
  dateOfBirth?: string;
  gender?: 'MALE' | 'FEMALE' | 'OTHER';
  contactInfo: string;
  address?: string;
  status: 'ACTIVE' | 'INACTIVE';
  isVerified?: boolean;
}

export interface CitizenDocument {
  documentId: number;
  uploadedDate: string;
  verificationStatus: 'PENDING' | 'VERIFIED' | 'REJECTED';
}

@Injectable({ providedIn: 'root' })
export class CitizenService {
  private readonly API = `${environment.apiBaseUrl}/api/citizens`;
  private profileSubject = new BehaviorSubject<CitizenProfile | null>(null);
  private documentsSubject = new BehaviorSubject<CitizenDocument[]>([]);
  profile$ = this.profileSubject.asObservable();
  documents$ = this.documentsSubject.asObservable();

  constructor(private http: HttpClient) {}

  getMyProfile(): Observable<CitizenProfile> {
    return this.http.get<ApiResponse<CitizenProfile>>(`${this.API}/profile`)
      .pipe(
        map(res => res.data),
        tap(profile => this.profileSubject.next(profile))
      );
  }

  updateProfile(data: Partial<CitizenProfile>): Observable<CitizenProfile> {
    return this.http.put<ApiResponse<CitizenProfile>>(`${this.API}/profile`, data)
      .pipe(
        map(res => res.data),
        tap(profile => this.profileSubject.next(profile))
      );
  }

  getCurrentProfile(): CitizenProfile | null {
    return this.profileSubject.value;
  }

  isProfileComplete(): boolean {
    const p = this.profileSubject.value;
    return !!(p?.name && p?.contactInfo && p?.address && p?.dateOfBirth && p?.gender);
  }

  isVerified(): boolean {
    const docs = this.documentsSubject.value;
    return docs.some(d => String(d.verificationStatus ?? '').toUpperCase() === 'VERIFIED');
  }

  getAllCitizens(page = 0, size = 1000): Observable<CitizenProfile[]> {
    return this.http.get<ApiResponse<CitizenProfile[] | PageResponse<CitizenProfile>>>(`${this.API}?page=${page}&size=${size}`)
      .pipe(map(res => Array.isArray(res.data) ? res.data : (res.data?.content ?? [])));
  }

  getCitizenById(id: number): Observable<CitizenProfile> {
    return this.http.get<ApiResponse<CitizenProfile>>(`${this.API}/${id}`)
      .pipe(map(res => res.data));
  }

  uploadDocument(citizenId: number, file: File): Observable<CitizenDocument> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<ApiResponse<CitizenDocument>>(`${this.API}/${citizenId}/documents`, formData)
      .pipe(
        map(res => res.data),
        tap(() => this.getMyDocuments(citizenId).subscribe())
      );
  }

  getMyDocuments(citizenId: number): Observable<CitizenDocument[]> {
    return this.http.get<ApiResponse<CitizenDocument[]>>(`${this.API}/${citizenId}/documents`)
      .pipe(
        map(res => res.data),
        tap(docs => this.documentsSubject.next(docs))
      );
  }

  verifyDocument(docId: number, status: 'VERIFIED' | 'REJECTED'): Observable<CitizenDocument> {
    return this.http.patch<ApiResponse<CitizenDocument>>(`${this.API}/documents/${docId}/verify?status=${status}`, {})       
      .pipe(map(res => res.data));
  }

  getDocumentBlob(citizenId: number, docId: number): Observable<Blob> {
    return this.http.get(`${this.API}/${citizenId}/documents/${docId}/download`, {
      responseType: 'blob'
    });
  }
}
