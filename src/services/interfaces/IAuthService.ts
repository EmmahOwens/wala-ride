import type { UserProfile, UserRoleType } from '../../types/domain';

export interface SignUpParams {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  role?: UserRoleType;
}

export interface IAuthService {
  signInWithOtp(phone: string): Promise<{ error: Error | null }>;
  verifyOtp(phone: string, token: string): Promise<{ user: any | null; session: any | null; error: Error | null }>;
  sendEmailOtp(email: string): Promise<{ error: Error | null }>;
  verifyEmailOtp(email: string, token: string, type?: 'email' | 'signup'): Promise<{ user: any | null; session: any | null; error: Error | null }>;
  signInWithPassword(email: string, password: string): Promise<{ user: any | null; session: any | null; error: Error | null }>;
  signUpWithPassword(
    paramsOrEmail: string | SignUpParams,
    password?: string,
    phone?: string,
    firstName?: string,
    lastName?: string,
    role?: UserRoleType
  ): Promise<{ user: any | null; session: any | null; error: Error | null }>;
  signInWithMagicLink(email: string): Promise<{ error: Error | null }>;
  signInWithOAuth(provider: 'google'): Promise<{ error: Error | null }>;
  resetPasswordForEmail(email: string): Promise<{ error: Error | null }>;
  updatePassword(newPassword: string): Promise<{ error: Error | null }>;
  signOut(): Promise<void>;
  getSession(): Promise<{ user: any | null; session: any | null }>;
  getProfile(userId: string): Promise<UserProfile | null>;
  updateProfile(userId: string, updates: Partial<UserProfile>): Promise<UserProfile | null>;
  getUserRoles(userId: string): Promise<UserRoleType[]>;
  assignRole(userId: string, role: UserRoleType): Promise<boolean>;
}

