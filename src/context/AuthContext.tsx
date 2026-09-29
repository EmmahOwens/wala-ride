import React, { createContext, useContext, useEffect, useState, useTransition } from 'react';
import { supabase } from '../config/supabase';
import { authService } from '../services/supabase/SupabaseAuthService';
import { driverService } from '../services/supabase/SupabaseDriverService';
import type { UserProfile, UserRoleType, DriverProfile } from '../types/domain';

interface AuthContextType {
  user: any | null;
  profile: UserProfile | null;
  roles: UserRoleType[];
  activeRole: UserRoleType;
  setActiveRole: (role: UserRoleType) => void;
  driverProfile: DriverProfile | null;
  loading: boolean;
  signInWithOtp: (phone: string) => Promise<{ error: Error | null }>;
  verifyOtp: (phone: string, token: string) => Promise<{ error: Error | null }>;
  signInWithPassword: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUpWithPassword: (email: string, password: string, phone?: string) => Promise<{ error: Error | null }>;
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
      const [fetchedProfile, fetchedRoles] = await Promise.all([
        authService.getProfile(currentUser.id),
        authService.getUserRoles(currentUser.id),
      ]);

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
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
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

  const signInWithPassword = async (email: string, password: string) => {
    const res = await authService.signInWithPassword(email, password);
    if (res.user) {
      await loadUserData(res.user);
    }
    return { error: res.error };
  };

  const signUpWithPassword = async (email: string, password: string, phone?: string) => {
    const res = await authService.signUpWithPassword(email, password, phone);
    if (res.user) {
      await loadUserData(res.user);
    }
    return { error: res.error };
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
        signInWithOtp,
        verifyOtp,
        signInWithPassword,
        signUpWithPassword,
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
