import type { DriverProfile, DriverDocument, Vehicle } from '../../types/domain';

export interface IDriverService {
  getDriverProfile(userId: string): Promise<DriverProfile | null>;
  createDriverProfile(userId: string, data: Partial<DriverProfile>): Promise<DriverProfile | null>;
  getDriverDocuments(driverId: string): Promise<DriverDocument[]>;
  uploadDocument(
    userId: string,
    driverId: string,
    documentType: string,
    file: File
  ): Promise<{ path: string; document: DriverDocument | null; error: Error | null }>;
  registerVehicle(
    driverId: string,
    vehicleData: {
      make: string;
      model: string;
      year?: number;
      license_plate: string;
      capacity_seats: number;
      color?: string;
    }
  ): Promise<Vehicle | null>;
  getDriverVehicles(driverId: string): Promise<Vehicle[]>;
}
