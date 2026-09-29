import { supabase } from '../../config/supabase';
import type { IDriverService } from '../interfaces/IDriverService';
import type { DriverProfile, DriverDocument, Vehicle } from '../../types/domain';

export class SupabaseDriverService implements IDriverService {
  async getDriverProfile(userId: string): Promise<DriverProfile | null> {
    const { data, error } = await supabase
      .from('driver_profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error || !data) return null;
    return data as unknown as DriverProfile;
  }

  async createDriverProfile(userId: string, data: Partial<DriverProfile>): Promise<DriverProfile | null> {
    const { data: profile, error } = await supabase.rpc('register_driver_profile' as any, {
      p_user_id: userId,
      p_license_number: data.license_number,
      p_license_class: data.license_class,
      p_national_id: data.national_id,
    });

    if (error || !profile) {
      console.error('Error creating driver profile:', error);
      return null;
    }
    return profile as unknown as DriverProfile;
  }

  async getDriverDocuments(driverId: string): Promise<DriverDocument[]> {
    const { data, error } = await supabase
      .from('driver_documents')
      .select('*')
      .eq('driver_id', driverId)
      .order('created_at', { ascending: false });

    if (error || !data) return [];
    return data as unknown as DriverDocument[];
  }

  async uploadDocument(
    userId: string,
    driverId: string,
    documentType: string,
    file: File
  ): Promise<{ path: string; document: DriverDocument | null; error: Error | null }> {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${userId}/${documentType}_${Date.now()}.${fileExt}`;

      // Upload to private bucket kyc-documents
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('kyc-documents')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: true,
        });

      if (uploadError || !uploadData) {
        return { path: '', document: null, error: new Error(uploadError?.message || 'Upload failed') };
      }

      // Record in driver_documents table
      const { data: docRecord, error: recordError } = await supabase
        .from('driver_documents')
        .insert({
          driver_id: driverId,
          document_type: documentType,
          file_path: uploadData.path,
          verification_status: 'pending',
        } as any)
        .select()
        .single();

      if (recordError || !docRecord) {
        return { path: uploadData.path, document: null, error: new Error(recordError?.message || 'Failed to save document metadata') };
      }

      return { path: uploadData.path, document: docRecord as unknown as DriverDocument, error: null };
    } catch (err: any) {
      return { path: '', document: null, error: err };
    }
  }

  async registerVehicle(
    driverId: string,
    vehicleData: {
      make: string;
      model: string;
      year?: number;
      license_plate: string;
      capacity_seats: number;
      color?: string;
    }
  ): Promise<Vehicle | null> {
    const { data, error } = await supabase.rpc('register_vehicle' as any, {
      p_driver_id: driverId,
      p_make: vehicleData.make,
      p_model: vehicleData.model,
      p_year: vehicleData.year || 2020,
      p_license_plate: vehicleData.license_plate.toUpperCase().trim(),
      p_capacity_seats: vehicleData.capacity_seats,
      p_color: vehicleData.color || 'White',
    });

    if (error || !data) {
      console.error('Error registering vehicle:', error);
      return null;
    }
    return data as unknown as Vehicle;
  }

  async getDriverVehicles(driverId: string): Promise<Vehicle[]> {
    const { data, error } = await supabase
      .from('vehicles')
      .select('*')
      .eq('primary_driver_id', driverId);

    if (error || !data) return [];
    return data as unknown as Vehicle[];
  }
}

export const driverService = new SupabaseDriverService();
