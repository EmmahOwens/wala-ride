import type {
  DriverProfile,
  DriverDocument,
  UserProfile,
  Vehicle,
  Town,
  Route,
  DemandAnalyticsResult,
  AdminTownInput,
  AdminRouteInput,
} from '../../types/domain';

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

  // Phase 5: Demand Analytics & Route/Town Operations
  getDemandAnalytics(days?: number): Promise<DemandAnalyticsResult | null>;
  getAllTowns(): Promise<Town[]>;
  upsertTown(input: AdminTownInput): Promise<Town | null>;
  toggleTownStatus(townId: string): Promise<boolean>;
  getAllRoutes(): Promise<Route[]>;
  upsertRoute(input: AdminRouteInput): Promise<Route | null>;
  deleteRoute(routeId: string): Promise<boolean>;
}
