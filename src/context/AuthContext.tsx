import React, { createContext, useContext, useEffect, useState, useTransition } from 'react';
import { supabase } from '../config/supabase';
import { authService } from '../services/supabase/SupabaseAuthService';
import { driverService } from '../services/supabase/SupabaseDriverService';
import type { SignUpParams } from '../services/interfaces/IAuthService';
import type { UserProfile, UserRoleType, DriverProfile } from '../types/domain';

interface AuthContextType {
  user: any | null;
  profile: UserProfile | null;
  roles: UserRoleType[];
  activeRole: UserRoleType;
  setActiveRole: (role: UserRoleType) => void;
  driverProfile: DriverProfile | null;
  loading: boolean;
  isPasswordRecovery: boolean;
  setIsPasswordRecovery: (isRecovery: boolean) => void;
  signInWithOtp: (phone: string) => Promise<{ error: Error | null }>;
  verifyOtp: (phone: string, token: string) => Promise<{ error: Error | null }>;
  sendEmailOtp: (email: string) => Promise<{ error: Error | null }>;
  verifyEmailOtp: (email: string, token: string, type?: 'email' | 'signup') => Promise<{ error: Error | null }>;
  signInWithPassword: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUpWithPassword: (
    paramsOrEmail: string | SignUpParams,
    password?: string,
    phone?: string,
    firstName?: string,
    lastName?: string,
    role?: UserRoleType
  ) => Promise<{ error: Error | null; requiresEmailConfirmation?: boolean }>;
  signInWithMagicLink: (email: string) => Promise<{ error: Error | null }>;
  signInWithOAuth: (provider: 'google') => Promise<{ error: Error | null }>;
  resetPasswordForEmail: (email: string) => Promise<{ error: Error | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: Error | null }>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  assignRole: (role: UserRoleType) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [roles, setRoles] = useState<UserRoleType[]>([]);
  const [activeRole, setActiveRole] = useState<UserRoleType>('passenger');
  const [driverProfile, setDriverProfile] = useState<DriverProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const urlParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    return urlParams.get('reset_password') === 'true' || hashParams.get('type') === 'recovery';
  });
  const [, startTransition] = useTransition();

  const loadUserData = async (currentUser: any) => {
    if (!currentUser) {
      setUser(null);
      setProfile(null);
      setRoles([]);
      setDriverProfile(null);
      setActiveRole('passenger');
      setLoading(false);
      return;
    }

    setUser(currentUser);
    try {
      let [fetchedProfile, fetchedRoles] = await Promise.all([
        authService.getProfile(currentUser.id),
        authService.getUserRoles(currentUser.id),
      ]);

      // If profile record isn't found in profiles table yet, synthesize from metadata
      if (!fetchedProfile) {
        fetchedProfile = {
          id: currentUser.id,
          first_name: currentUser.user_metadata?.first_name || null,
          last_name: currentUser.user_metadata?.last_name || null,
          phone: currentUser.phone || currentUser.user_metadata?.phone || null,
          email: currentUser.email || null,
          profile_photo_url: currentUser.user_metadata?.avatar_url || currentUser.user_metadata?.picture || null,
          account_status: 'active',
          created_at: currentUser.created_at || new Date().toISOString(),
          updated_at: currentUser.updated_at || new Date().toISOString(),
        };
      }

      // If user has no roles yet, ensure passenger role is assigned
      if (!fetchedRoles || fetchedRoles.length === 0) {
        await authService.assignRole(currentUser.id, 'passenger');
        fetchedRoles = ['passenger'];
      }

      setProfile(fetchedProfile);
      setRoles(fetchedRoles);

      // Determine initial active role
      if (fetchedRoles.includes('admin')) {
        setActiveRole('admin');
      } else if (fetchedRoles.includes('driver')) {
        setActiveRole('driver');
      } else {
        setActiveRole('passenger');
      }

      // If user has driver role, fetch driver profile
      if (fetchedRoles.includes('driver')) {
        const dProfile = await driverService.getDriverProfile(currentUser.id);
        setDriverProfile(dProfile);
      }
    } catch (err) {
      console.error('Error loading user profile & roles:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Initial session check
    supabase.auth.getSession().then(({ data: { session } }) => {
      startTransition(() => {
        loadUserData(session?.user || null);
      });
    });

    // Listen to auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsPasswordRecovery(true);
      }
      startTransition(() => {
        loadUserData(session?.user || null);
      });
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signInWithOtp = async (phone: string) => {
    return await authService.signInWithOtp(phone);
  };

  const verifyOtp = async (phone: string, token: string) => {
    const res = await authService.verifyOtp(phone, token);
    if (res.user) {
      await loadUserData(res.user);
    }
    return { error: res.error };
  };

  const sendEmailOtp = async (email: string) => {
    return await authService.sendEmailOtp(email);
  };

  const verifyEmailOtp = async (email: string, token: string, type: 'email' | 'signup' = 'email') => {
    const res = await authService.verifyEmailOtp(email, token, type);
    if (res.user) {
      await loadUserData(res.user);
    }
    return { error: res.error };
  };

  const signInWithPassword = async (email: string, password: string) => {
    const res = await authService.signInWithPassword(email, password);
    if (res.user) {
      await loadUserData(res.user);
    }
    return { error: res.error };
  };

  const signUpWithPassword = async (
    paramsOrEmail: string | SignUpParams,
    password?: string,
    phone?: string,
    firstName?: string,
    lastName?: string,
    role?: UserRoleType
  ) => {
    const res = await authService.signUpWithPassword(
      paramsOrEmail,
      password,
      phone,
      firstName,
      lastName,
      role
    );
    if (res.user) {
      await loadUserData(res.user);
    }
    const requiresEmailConfirmation = Boolean(res.user && !res.session);
    return { error: res.error, requiresEmailConfirmation };
  };

  const signInWithMagicLink = async (email: string) => {
    return await authService.signInWithMagicLink(email);
  };

  const signInWithOAuth = async (provider: 'google') => {
    return await authService.signInWithOAuth(provider);
  };

  const resetPasswordForEmail = async (email: string) => {
    return await authService.resetPasswordForEmail(email);
  };

  const updatePassword = async (newPassword: string) => {
    const res = await authService.updatePassword(newPassword);
    if (!res.error) {
      setIsPasswordRecovery(false);
      // Clean up URL if recovery hash/params are present
      if (window.history?.replaceState) {
        const cleanUrl = window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);
      }
    }
    return res;
  };

  const updateProfile = async (updates: Partial<UserProfile>) => {
    if (!user) return { error: new Error('Not authenticated') };
    try {
      const updated = await authService.updateProfile(user.id, updates);
      if (updated) {
        setProfile(updated);
        return { error: null };
      }
      return { error: new Error('Failed to update profile') };
    } catch (err: any) {
      return { error: new Error(err.message || 'Failed to update profile') };
    }
  };

  const signOut = async () => {
    await authService.signOut();
    setUser(null);
    setProfile(null);
    setRoles([]);
    setDriverProfile(null);
    setActiveRole('passenger');
  };

  const refreshProfile = async () => {
    if (user) {
      await loadUserData(user);
    }
  };

  const assignRole = async (role: UserRoleType): Promise<boolean> => {
    if (!user) return false;
    const success = await authService.assignRole(user.id, role);
    if (success) {
      const updatedRoles = await authService.getUserRoles(user.id);
      setRoles(updatedRoles);
      setActiveRole(role);
      if (role === 'driver') {
        const dProfile = await driverService.getDriverProfile(user.id);
        setDriverProfile(dProfile);
      }
    }
    return success;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        roles,
        activeRole,
        setActiveRole,
        driverProfile,
        loading,
        isPasswordRecovery,
        setIsPasswordRecovery,
        signInWithOtp,
        verifyOtp,
        sendEmailOtp,
        verifyEmailOtp,
        signInWithPassword,
        signUpWithPassword,
        signInWithMagicLink,
        signInWithOAuth,
        resetPasswordForEmail,
        updatePassword,
        updateProfile,
        signOut,
        refreshProfile,
        assignRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

