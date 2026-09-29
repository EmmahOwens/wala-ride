import { supabase } from '../../config/supabase';
import type { IAdminService, PendingDriverVerification } from '../interfaces/IAdminService';
import type { DriverProfile, DriverDocument, UserProfile, Vehicle } from '../../types/domain';

export class SupabaseAdminService implements IAdminService {
  async getPendingDrivers(): Promise<PendingDriverVerification[]> {
    // 1. Fetch driver profiles that are pending
    const { data: drivers, error: driversErr } = await supabase
      .from('driver_profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (driversErr || !drivers) return [];

    const results: PendingDriverVerification[] = [];

    for (const d of drivers) {
      // Fetch associated profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', d.user_id)
        .maybeSingle();

      // Fetch documents
      const { data: documents } = await supabase
        .from('driver_documents')
        .select('*')
        .eq('driver_id', d.id);

      // Fetch vehicles
      const { data: vehicles } = await supabase
        .from('vehicles')
        .select('*')
        .eq('primary_driver_id', d.id);

      results.push({
        driver: d as unknown as DriverProfile,
        profile: (profile || {
          id: d.user_id,
          first_name: 'Driver',
          last_name: '',
          phone: '',
          email: '',
          profile_photo_url: null,
          account_status: 'active',
          created_at: d.created_at,
          updated_at: d.created_at,
        }) as UserProfile,
        documents: (documents || []) as unknown as DriverDocument[],
        vehicles: (vehicles || []) as unknown as Vehicle[],
      });
    }

    return results;
  }

  async updateDriverStatus(driverId: string, status: 'verified' | 'rejected' | 'pending'): Promise<boolean> {
    const { error } = await supabase
      .from('driver_profiles')
      .update({ verification_status: status })
      .eq('id', driverId);

    return !error;
  }

  async updateDocumentStatus(
    documentId: string,
    status: 'verified' | 'rejected',
    rejectionReason?: string
  ): Promise<boolean> {
    const { error } = await supabase
      .from('driver_documents')
      .update({
        verification_status: status,
        reject_reason: rejectionReason || null,
        verified_at: status === 'verified' ? new Date().toISOString() : null,
      })
      .eq('id', documentId);

    return !error;
  }

  async getSignedDocumentUrl(filePath: string): Promise<string | null> {
    // Generate a secure signed URL valid for 1 hour to preview private KYC docs
    const { data, error } = await supabase.storage
      .from('kyc-documents')
      .createSignedUrl(filePath, 3600);

    if (error || !data) return null;
    return data.signedUrl;
  }
}

export const adminService = new SupabaseAdminService();
