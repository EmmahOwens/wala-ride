import type { DriverProfile, DriverDocument, UserProfile, Vehicle } from '../../types/domain';

export interface PendingDriverVerification {
  driver: DriverProfile;
  profile: UserProfile;
  documents: DriverDocument[];
  vehicles: Vehicle[];
}

export interface IAdminService {
  getPendingDrivers(): Promise<PendingDriverVerification[]>;
  updateDriverStatus(driverId: string, status: 'verified' | 'rejected' | 'pending'): Promise<boolean>;
  updateDocumentStatus(
    documentId: string,
    status: 'verified' | 'rejected',
    rejectionReason?: string
  ): Promise<boolean>;
  getSignedDocumentUrl(filePath: string): Promise<string | null>;
}
