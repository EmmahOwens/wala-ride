import { supabase } from '../../config/supabase';
import type { IAuthService, SignUpParams } from '../interfaces/IAuthService';
import type { UserProfile, UserRoleType } from '../../types/domain';

export const getAppRedirectUrl = (): string => {
  const envUrl = import.meta.env.VITE_SITE_URL || (import.meta.env as any).VITE_PUBLIC_SITE_URL;
  if (envUrl && typeof envUrl === 'string' && envUrl.startsWith('http')) {
    return envUrl;
  }
  if (typeof window !== 'undefined') {
    // If running in browser on vercel or non-localhost domain, use current origin
    if (window.location.origin.includes('vercel.app') || (!window.location.origin.includes('localhost') && !window.location.origin.includes('127.0.0.1'))) {
      return window.location.origin;
    }
  }
  // Default to live Vercel production app so verification emails work anywhere
  return 'https://wala-ride.vercel.app';
};

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

  async verifyOtp(phone: string, token: string): Promise<{ user: any | null; session: any | null; error: Error | null }> {
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        phone,
        token,
        type: 'sms',
      });
      return { user: data.user, session: data.session, error: error ? new Error(error.message) : null };
    } catch (err: any) {
      return { user: null, session: null, error: new Error(err.message || 'Failed to verify OTP') };
    }
  }

  async sendEmailOtp(email: string): Promise<{ error: Error | null }> {
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: true,
          emailRedirectTo: getAppRedirectUrl(),
        },
      });
      return { error: error ? new Error(error.message) : null };
    } catch (err: any) {
      return { error: new Error(err.message || 'Failed to send email verification code') };
    }
  }

  async verifyEmailOtp(
    email: string,
    token: string,
    type: 'email' | 'signup' = 'email'
  ): Promise<{ user: any | null; session: any | null; error: Error | null }> {
    try {
      let res = await supabase.auth.verifyOtp({
        email,
        token,
        type,
      });

      // If the primary type fails, try fallback between 'email' and 'signup'
      if (res.error) {
        const alternateType = type === 'email' ? 'signup' : 'email';
        const fallbackRes = await supabase.auth.verifyOtp({
          email,
          token,
          type: alternateType,
        });
        if (!fallbackRes.error) {
          res = fallbackRes;
        }
      }

      return {
        user: res.data?.user || null,
        session: res.data?.session || null,
        error: res.error ? new Error(res.error.message) : null,
      };
    } catch (err: any) {
      return { user: null, session: null, error: new Error(err.message || 'Failed to verify email code') };
    }
  }

  async signInWithPassword(email: string, password: string): Promise<{ user: any | null; session: any | null; error: Error | null }> {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      return { user: data.user, session: data.session, error: error ? new Error(error.message) : null };
    } catch (err: any) {
      return { user: null, session: null, error: new Error(err.message || 'Login failed') };
    }
  }

  async signUpWithPassword(
    paramsOrEmail: string | SignUpParams,
    passwordArg?: string,
    phoneArg?: string,
    firstNameArg?: string,
    lastNameArg?: string,
    roleArg?: UserRoleType
  ): Promise<{ user: any | null; session: any | null; error: Error | null }> {
    try {
      let email = '';
      let password = '';
      let phone: string | undefined;
      let firstName: string | undefined;
      let lastName: string | undefined;
      let role: UserRoleType = 'passenger';

      if (typeof paramsOrEmail === 'string') {
        email = paramsOrEmail;
        password = passwordArg || '';
        phone = phoneArg;
        firstName = firstNameArg;
        lastName = lastNameArg;
        role = roleArg || 'passenger';
      } else {
        email = paramsOrEmail.email;
        password = paramsOrEmail.password;
        phone = paramsOrEmail.phone;
        firstName = paramsOrEmail.firstName;
        lastName = paramsOrEmail.lastName;
        role = paramsOrEmail.role || 'passenger';
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            first_name: firstName,
            last_name: lastName,
            phone: phone,
            role: role,
          },
          emailRedirectTo: getAppRedirectUrl(),
        },
      });

      return { user: data.user, session: data.session, error: error ? new Error(error.message) : null };
    } catch (err: any) {
      return { user: null, session: null, error: new Error(err.message || 'Sign up failed') };
    }
  }

  async signInWithMagicLink(email: string): Promise<{ error: Error | null }> {
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: getAppRedirectUrl(),
        },
      });
      return { error: error ? new Error(error.message) : null };
    } catch (err: any) {
      return { error: new Error(err.message || 'Failed to send magic link') };
    }
  }

  async signInWithOAuth(provider: 'google'): Promise<{ error: Error | null }> {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: getAppRedirectUrl(),
        },
      });
      return { error: error ? new Error(error.message) : null };
    } catch (err: any) {
      return { error: new Error(err.message || 'OAuth sign in failed') };
    }
  }

  async resetPasswordForEmail(email: string): Promise<{ error: Error | null }> {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${getAppRedirectUrl()}?reset_password=true`,
      });
      return { error: error ? new Error(error.message) : null };
    } catch (err: any) {
      return { error: new Error(err.message || 'Failed to send password reset email') };
    }
  }

  async updatePassword(newPassword: string): Promise<{ error: Error | null }> {
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      return { error: error ? new Error(error.message) : null };
    } catch (err: any) {
      return { error: new Error(err.message || 'Failed to update password') };
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
    // 1. Try secure assign_user_role RPC first
    try {
      const { error: rpcError } = await (supabase.rpc as any)('assign_user_role', {
        p_role: role,
      });

      if (!rpcError) return true;
    } catch (e) {
      // Fallback
    }

    // 2. Direct upsert fallback
    const { error } = await supabase
      .from('user_roles')
      .upsert({ user_id: userId, role } as any, { onConflict: 'user_id,role' });

    return !error;
  }
}

export const authService = new SupabaseAuthService();

