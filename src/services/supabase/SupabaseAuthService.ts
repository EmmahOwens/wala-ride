import { supabase } from '../../config/supabase';
import type { IAuthService } from '../interfaces/IAuthService';
import type { UserProfile, UserRoleType } from '../../types/domain';

export class SupabaseAuthService implements IAuthService {
  async signInWithOtp(phone: string): Promise<{ error: Error | null }> {
    try {
      const { error } = await supabase.auth.signInWithOtp({
        phone,
      });
      return { error: error ? new Error(error.message) : null };
    } catch (err: any) {
      return { error: new Error(err.message || 'Failed to send OTP') };
    }
  }

  async verifyOtp(phone: string, token: string): Promise<{ user: any | null; error: Error | null }> {
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        phone,
        token,
        type: 'sms',
      });
      return { user: data.user, error: error ? new Error(error.message) : null };
    } catch (err: any) {
      return { user: null, error: new Error(err.message || 'Failed to verify OTP') };
    }
  }

  async signInWithPassword(email: string, password: string): Promise<{ user: any | null; error: Error | null }> {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      return { user: data.user, error: error ? new Error(error.message) : null };
    } catch (err: any) {
      return { user: null, error: new Error(err.message || 'Login failed') };
    }
  }

  async signUpWithPassword(email: string, password: string, phone?: string): Promise<{ user: any | null; error: Error | null }> {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { phone },
        },
      });
      return { user: data.user, error: error ? new Error(error.message) : null };
    } catch (err: any) {
      return { user: null, error: new Error(err.message || 'Sign up failed') };
    }
  }

  async signOut(): Promise<void> {
    await supabase.auth.signOut();
  }

  async getSession(): Promise<{ user: any | null; session: any | null }> {
    const { data } = await supabase.auth.getSession();
    return { user: data.session?.user || null, session: data.session || null };
  }

  async getProfile(userId: string): Promise<UserProfile | null> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error || !data) return null;
    return data as UserProfile;
  }

  async updateProfile(userId: string, updates: Partial<UserProfile>): Promise<UserProfile | null> {
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();

    if (error || !data) return null;
    return data as UserProfile;
  }

  async getUserRoles(userId: string): Promise<UserRoleType[]> {
    const { data, error } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId);

    if (error || !data) return [];
    return data.map((r: any) => r.role as UserRoleType);
  }

  async assignRole(userId: string, role: UserRoleType): Promise<boolean> {
    const { error } = await supabase
      .from('user_roles')
      .upsert({ user_id: userId, role } as any, { onConflict: 'user_id,role' });

    return !error;
  }
}

export const authService = new SupabaseAuthService();
