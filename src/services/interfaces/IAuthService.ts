import type { UserProfile, UserRoleType } from '../../types/domain';

export interface IAuthService {
  signInWithOtp(phone: string): Promise<{ error: Error | null }>;
  verifyOtp(phone: string, token: string): Promise<{ user: any | null; error: Error | null }>;
  signInWithPassword(email: string, password: string): Promise<{ user: any | null; error: Error | null }>;
  signUpWithPassword(email: string, password: string, phone?: string): Promise<{ user: any | null; error: Error | null }>;
  signOut(): Promise<void>;
  getSession(): Promise<{ user: any | null; session: any | null }>;
  getProfile(userId: string): Promise<UserProfile | null>;
  updateProfile(userId: string, updates: Partial<UserProfile>): Promise<UserProfile | null>;
  getUserRoles(userId: string): Promise<UserRoleType[]>;
  assignRole(userId: string, role: UserRoleType): Promise<boolean>;
}
