import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { authService } from '../../services/supabase/SupabaseAuthService';
import { X, Phone, Mail, Lock, User, ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react';
import type { UserRoleType } from '../../types/domain';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const { user, signInWithOtp, verifyOtp, signInWithPassword, signUpWithPassword, assignRole, refreshProfile } = useAuth();

  const [authMode, setAuthMode] = useState<'otp' | 'password'>('otp');
  const [step, setStep] = useState<'phone' | 'verify' | 'role_select'>('phone');
  const [phone, setPhone] = useState<string>('+2567');
  const [otpToken, setOtpToken] = useState<string>('');

  // Password mode states
  const [isSignUp, setIsSignUp] = useState<boolean>(false);
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');

  // Onboarding role state
  const [selectedRole, setSelectedRole] = useState<UserRoleType>('passenger');
  const [firstName, setFirstName] = useState<string>('');
  const [lastName, setLastName] = useState<string>('');

  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setLoading(true);

    const formattedPhone = phone.trim().replace(/\s+/g, '');
    if (!formattedPhone.startsWith('+256') || formattedPhone.length < 12) {
      setErrorMessage('Please enter a valid Ugandan phone number e.g. +256701234567');
      setLoading(false);
      return;
    }

    const { error } = await signInWithOtp(formattedPhone);
    setLoading(false);

    if (error) {
      setErrorMessage(error.message);
    } else {
      setStep('verify');
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setLoading(true);

    const { error } = await verifyOtp(phone.trim(), otpToken.trim());
    setLoading(false);

    if (error) {
      setErrorMessage(error.message);
    } else {
      setStep('role_select');
    }
  };

  const handlePasswordAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setLoading(true);

    if (isSignUp) {
      const { error } = await signUpWithPassword(email.trim(), password.trim(), phone.trim());
      setLoading(false);
      if (error) {
        setErrorMessage(error.message);
      } else {
        setStep('role_select');
      }
    } else {
      const { error } = await signInWithPassword(email.trim(), password.trim());
      setLoading(false);
      if (error) {
        setErrorMessage(error.message);
      } else {
        onClose();
      }
    }
  };

  const handleCompleteOnboarding = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (user && (firstName.trim() || lastName.trim())) {
        await authService.updateProfile(user.id, {
          first_name: firstName.trim() || undefined,
          last_name: lastName.trim() || undefined,
        });
      }
      await assignRole(selectedRole);
      await refreshProfile();
      setLoading(false);
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to complete profile');
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Close Button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            background: 'var(--color-canvas-soft)',
            border: 'none',
            borderRadius: 'var(--radius-pill)',
            width: '36px',
            height: '36px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <X size={18} />
        </button>

        {/* STEP 1: Phone / Password Selection */}
        {step === 'phone' && (
          <div>
            <div style={{ marginBottom: '24px' }}>
              <h2 className="display-lg">Welcome to Wala Ride</h2>
              <p className="body-md" style={{ marginTop: '6px' }}>
                Long-distance travel across Uganda made seamless.
              </p>
            </div>

            {/* Auth Mode Toggle */}
            <div style={{
              display: 'flex',
              backgroundColor: 'var(--color-canvas-soft)',
              padding: '4px',
              borderRadius: 'var(--radius-pill)',
              marginBottom: '20px',
            }}>
              <button
                type="button"
                className={`btn btn-sm ${authMode === 'otp' ? 'btn-primary' : 'btn-subtle'}`}
                style={{ flex: 1 }}
                onClick={() => setAuthMode('otp')}
              >
                <Phone size={14} /> Phone OTP
              </button>
              <button
                type="button"
                className={`btn btn-sm ${authMode === 'password' ? 'btn-primary' : 'btn-subtle'}`}
                style={{ flex: 1 }}
                onClick={() => setAuthMode('password')}
              >
                <Mail size={14} /> Email / Pass
              </button>
            </div>

            {errorMessage && (
              <div style={{
                backgroundColor: 'var(--color-danger-bg)',
                color: 'var(--color-danger)',
                padding: '12px 16px',
                borderRadius: 'var(--radius-lg)',
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '16px',
              }}>
                <AlertCircle size={16} />
                <span>{errorMessage}</span>
              </div>
            )}

            {authMode === 'otp' ? (
              <form onSubmit={handleSendOtp}>
                <div className="form-group">
                  <label className="form-label">Phone Number (MTN / Airtel Uganda)</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="tel"
                      className="input-field"
                      placeholder="+256 701 234 567"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      required
                    />
                  </div>
                  <span className="body-sm" style={{ marginTop: '4px' }}>
                    We'll send you an SMS with a 6-digit confirmation code.
                  </span>
                </div>

                <button
                  type="submit"
                  className="btn btn-primary btn-lg btn-full"
                  disabled={loading}
                  style={{ marginTop: '16px' }}
                >
                  {loading ? 'Sending code...' : 'Continue with Phone'}
                  <ArrowRight size={18} />
                </button>
              </form>
            ) : (
              <form onSubmit={handlePasswordAuth}>
                <div className="form-group">
                  <label className="form-label">Email Address</label>
                  <input
                    type="email"
                    className="input-field"
                    placeholder="driver@walaride.ug"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Password</label>
                  <input
                    type="password"
                    className="input-field"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>

                <button
                  type="submit"
                  className="btn btn-primary btn-lg btn-full"
                  disabled={loading}
                  style={{ marginTop: '16px' }}
                >
                  {loading ? 'Signing in...' : isSignUp ? 'Create Account' : 'Sign In'}
                  <ArrowRight size={18} />
                </button>

                <div style={{ textAlign: 'center', marginTop: '16px' }}>
                  <button
                    type="button"
                    style={{ background: 'none', border: 'none', color: 'var(--color-body)', fontSize: '13px', cursor: 'pointer', textDecoration: 'underline' }}
                    onClick={() => setIsSignUp(!isSignUp)}
                  >
                    {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* STEP 2: OTP Verification */}
        {step === 'verify' && (
          <div>
            <div style={{ marginBottom: '24px' }}>
              <h2 className="display-lg">Verify your number</h2>
              <p className="body-md" style={{ marginTop: '6px' }}>
                Enter the 6-digit verification code sent to <strong>{phone}</strong>.
              </p>
            </div>

            {errorMessage && (
              <div style={{
                backgroundColor: 'var(--color-danger-bg)',
                color: 'var(--color-danger)',
                padding: '12px 16px',
                borderRadius: 'var(--radius-lg)',
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '16px',
              }}>
                <AlertCircle size={16} />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleVerifyOtp}>
              <div className="form-group">
                <label className="form-label">6-digit Code</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="123456"
                  maxLength={6}
                  value={otpToken}
                  onChange={(e) => setOtpToken(e.target.value)}
                  style={{ fontSize: '24px', letterSpacing: '8px', textAlign: 'center' }}
                  required
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary btn-lg btn-full"
                disabled={loading || otpToken.length < 6}
                style={{ marginTop: '16px' }}
              >
                {loading ? 'Verifying...' : 'Confirm & Continue'}
              </button>

              <div style={{ textAlign: 'center', marginTop: '16px' }}>
                <button
                  type="button"
                  style={{ background: 'none', border: 'none', color: 'var(--color-body)', fontSize: '13px', cursor: 'pointer' }}
                  onClick={() => setStep('phone')}
                >
                  Change phone number
                </button>
              </div>
            </form>
          </div>
        )}

        {/* STEP 3: Role Selection / Onboarding */}
        {step === 'role_select' && (
          <div>
            <div style={{ marginBottom: '24px' }}>
              <h2 className="display-lg">Choose how you'll use Wala</h2>
              <p className="body-md" style={{ marginTop: '6px' }}>
                You can switch between travel and driving at any time.
              </p>
            </div>

            <form onSubmit={handleCompleteOnboarding}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">First Name</label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="e.g. Ronald"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                  />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Last Name</label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="e.g. Mukasa"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
                <div
                  onClick={() => setSelectedRole('passenger')}
                  style={{
                    border: `2px solid ${selectedRole === 'passenger' ? '#000000' : 'var(--color-card-border)'}`,
                    borderRadius: 'var(--radius-xl)',
                    padding: '16px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    backgroundColor: selectedRole === 'passenger' ? 'var(--color-canvas-soft)' : 'transparent',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: 'var(--radius-pill)', backgroundColor: '#000000', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <User size={20} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '15px' }}>Passenger</div>
                      <div className="body-sm">Search and book scheduled intercity journeys</div>
                    </div>
                  </div>
                  {selectedRole === 'passenger' && <CheckCircle2 size={20} color="#000000" />}
                </div>

                <div
                  onClick={() => setSelectedRole('driver')}
                  style={{
                    border: `2px solid ${selectedRole === 'driver' ? '#000000' : 'var(--color-card-border)'}`,
                    borderRadius: 'var(--radius-xl)',
                    padding: '16px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    backgroundColor: selectedRole === 'driver' ? 'var(--color-canvas-soft)' : 'transparent',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: 'var(--radius-pill)', backgroundColor: '#000000', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Lock size={20} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '15px' }}>Driver / Operator</div>
                      <div className="body-sm">Publish trips, fill empty seats & receive leads</div>
                    </div>
                  </div>
                  {selectedRole === 'driver' && <CheckCircle2 size={20} color="#000000" />}
                </div>
              </div>

              <button
                type="submit"
                className="btn btn-primary btn-lg btn-full"
                disabled={loading}
              >
                {loading ? 'Saving...' : 'Get Started'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
