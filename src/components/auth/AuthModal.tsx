import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { authService } from '../../services/supabase/SupabaseAuthService';
import {
  X,
  Mail,
  Lock,
  User,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Sparkles,
  KeyRound,
  RefreshCw,
  Car,
  ChevronLeft,
} from 'lucide-react';
import type { UserRoleType } from '../../types/domain';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'email_otp' | 'password';
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  initialMode = 'email_otp',
}) => {
  const {
    user,
    profile,
    isPasswordRecovery,
    setIsPasswordRecovery,
    sendEmailOtp,
    verifyEmailOtp,
    signInWithPassword,
    signUpWithPassword,
    signInWithOAuth,
    resetPasswordForEmail,
    updatePassword,
    assignRole,
    refreshProfile,
  } = useAuth();

  // Mode: 'email_otp' | 'password' | 'verify_otp' | 'forgot_password' | 'recovery'
  const [authMode, setAuthMode] = useState<'email_otp' | 'password' | 'verify_otp' | 'forgot_password' | 'recovery'>(
    isPasswordRecovery ? 'recovery' : initialMode
  );

  const [email, setEmail] = useState<string>('');
  const [otpToken, setOtpToken] = useState<string>('');
  const [countdown, setCountdown] = useState<number>(0);

  // Password mode states
  const [isSignUp, setIsSignUp] = useState<boolean>(false);
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [signUpPhone, setSignUpPhone] = useState<string>('');

  // Onboarding / Role state
  const [step, setStep] = useState<'auth' | 'onboarding'>('auth');
  const [selectedRole, setSelectedRole] = useState<UserRoleType>('passenger');
  const [firstName, setFirstName] = useState<string>('');
  const [lastName, setLastName] = useState<string>('');

  // Status indicators
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Sync recovery state when isPasswordRecovery triggers
  useEffect(() => {
    if (isPasswordRecovery) {
      setAuthMode('recovery');
    }
  }, [isPasswordRecovery]);

  // Resend OTP countdown timer
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    if (countdown > 0) {
      timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [countdown]);

  // Format Ugandan phone number
  const formatUgandaPhone = (input: string): string => {
    let cleaned = input.trim().replace(/[\s\-()]/g, '');
    if (cleaned.startsWith('0')) {
      cleaned = '+256' + cleaned.slice(1);
    } else if (cleaned.startsWith('256')) {
      cleaned = '+' + cleaned;
    } else if (!cleaned.startsWith('+') && cleaned.length > 0) {
      cleaned = '+256' + cleaned;
    }
    return cleaned;
  };

  const formatAuthErrorMessage = (msg: string): string => {
    if (msg.toLowerCase().includes('error sending confirmation email') || msg.includes('535') || msg.includes('BadCredentials')) {
      return 'Email delivery failed: Supabase Custom SMTP authentication was rejected. If using Gmail, use an App Password, or turn off "Enable Custom SMTP" in Supabase to use the default mailer.';
    }
    return msg;
  };

  // SEND EMAIL OTP
  const handleSendEmailOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setLoading(true);

    const cleanEmail = email.trim();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setErrorMessage('Please enter a valid email address.');
      setLoading(false);
      return;
    }

    const { error } = await sendEmailOtp(cleanEmail);
    setLoading(false);

    if (error) {
      setErrorMessage(formatAuthErrorMessage(error.message));
    } else {
      setAuthMode('verify_otp');
      setCountdown(60);
      setSuccessMessage(`We sent a 6-digit verification code to ${cleanEmail}.`);
    }
  };

  // RESEND EMAIL OTP
  const handleResendOtp = async () => {
    if (countdown > 0 || loading) return;
    setErrorMessage(null);
    setLoading(true);

    const cleanEmail = email.trim();
    const { error } = await sendEmailOtp(cleanEmail);
    setLoading(false);

    if (error) {
      setErrorMessage(formatAuthErrorMessage(error.message));
    } else {
      setCountdown(60);
      setSuccessMessage(`A new 6-digit code was sent to ${cleanEmail}.`);
    }
  };

  // VERIFY EMAIL OTP
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setLoading(true);

    const cleanEmail = email.trim();
    const { error } = await verifyEmailOtp(cleanEmail, otpToken.trim(), isSignUp ? 'signup' : 'email');
    setLoading(false);

    if (error) {
      setErrorMessage(error.message || 'Invalid or expired verification code.');
    } else {
      if (profile && (profile.first_name || profile.last_name)) {
        onClose();
      } else {
        setStep('onboarding');
      }
    }
  };

  // PASSWORD AUTH (SIGN IN / SIGN UP)
  const handlePasswordAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setLoading(true);

    if (isSignUp) {
      if (password.length < 6) {
        setErrorMessage('Password must be at least 6 characters long.');
        setLoading(false);
        return;
      }

      if (password !== confirmPassword) {
        setErrorMessage('Passwords do not match.');
        setLoading(false);
        return;
      }

      const formattedPhone = signUpPhone.trim() ? formatUgandaPhone(signUpPhone) : undefined;

      const { error, requiresEmailConfirmation } = await signUpWithPassword({
        email: email.trim(),
        password: password.trim(),
        firstName: firstName.trim() || undefined,
        lastName: lastName.trim() || undefined,
        phone: formattedPhone,
        role: selectedRole,
      });

      setLoading(false);

      if (error) {
        setErrorMessage(formatAuthErrorMessage(error.message));
      } else if (requiresEmailConfirmation) {
        // Automatically switch to Email OTP Verification code entry!
        setAuthMode('verify_otp');
        setCountdown(60);
        setSuccessMessage(`Account created! A 6-digit verification code has been sent to ${email.trim()}.`);
      } else {
        setSuccessMessage('Account created and verified successfully!');
        setTimeout(() => onClose(), 600);
      }
    } else {
      const { error } = await signInWithPassword(email.trim(), password.trim());
      setLoading(false);

      if (error) {
        setErrorMessage(error.message || 'Invalid email or password.');
      } else {
        onClose();
      }
    }
  };

  // FORGOT PASSWORD
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setLoading(true);

    const { error } = await resetPasswordForEmail(email.trim());
    setLoading(false);

    if (error) {
      setErrorMessage(error.message);
    } else {
      setSuccessMessage('Password reset email sent! Please check your inbox.');
    }
  };

  // PASSWORD RECOVERY / SET NEW PASSWORD
  const handlePasswordRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (password.length < 6) {
      setErrorMessage('New password must be at least 6 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    setLoading(true);
    const { error } = await updatePassword(password.trim());
    setLoading(false);

    if (error) {
      setErrorMessage(error.message);
    } else {
      setSuccessMessage('Password updated successfully! Welcome back.');
      setIsPasswordRecovery(false);
      setTimeout(() => {
        onClose();
      }, 1000);
    }
  };

  // GOOGLE OAUTH
  const handleGoogleOAuth = async () => {
    setErrorMessage(null);
    setLoading(true);
    const { error } = await signInWithOAuth('google');
    if (error) {
      setErrorMessage(error.message);
      setLoading(false);
    }
  };

  // ONBOARDING PROFILE COMPLETION
  const handleCompleteOnboarding = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
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

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '460px', padding: '28px' }}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          aria-label="Close modal"
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
            transition: 'background 0.2s',
          }}
        >
          <X size={18} />
        </button>

        {/* FEEDBACK NOTICES */}
        {errorMessage && (
          <div
            style={{
              backgroundColor: 'var(--color-danger-bg)',
              color: 'var(--color-danger)',
              padding: '12px 14px',
              borderRadius: 'var(--radius-md)',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px',
              marginBottom: '18px',
              border: '1px solid rgba(220, 38, 38, 0.2)',
            }}
          >
            <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
            <span style={{ lineHeight: 1.4 }}>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div
            style={{
              backgroundColor: 'var(--color-success-bg)',
              color: 'var(--color-success)',
              padding: '12px 14px',
              borderRadius: 'var(--radius-md)',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px',
              marginBottom: '18px',
              border: '1px solid rgba(14, 131, 69, 0.2)',
            }}
          >
            <CheckCircle2 size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
            <span style={{ lineHeight: 1.4 }}>{successMessage}</span>
          </div>
        )}

        {/* STEP: ONBOARDING / PROFILE COMPLETION */}
        {step === 'onboarding' ? (
          <div>
            <div style={{ marginBottom: '22px' }}>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: 'var(--color-canvas-soft)',
                  padding: '4px 10px',
                  borderRadius: 'var(--radius-pill)',
                  fontSize: '12px',
                  fontWeight: 600,
                  marginBottom: '10px',
                }}
              >
                <Sparkles size={13} color="var(--color-primary)" />
                One last step
              </div>
              <h2 className="display-lg" style={{ margin: 0 }}>
                Complete your profile
              </h2>
              <p className="body-md" style={{ marginTop: '6px', color: 'var(--color-body)' }}>
                How would you like to be known on Wala Ride?
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
                    required
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
                    required
                  />
                </div>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label className="form-label" style={{ marginBottom: '8px', display: 'block' }}>
                  Choose your primary role
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div
                    onClick={() => setSelectedRole('passenger')}
                    style={{
                      border: `2px solid ${selectedRole === 'passenger' ? '#000000' : 'var(--color-card-border)'}`,
                      borderRadius: 'var(--radius-lg)',
                      padding: '14px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      backgroundColor: selectedRole === 'passenger' ? 'var(--color-canvas-soft)' : 'transparent',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div
                        style={{
                          width: '38px',
                          height: '38px',
                          borderRadius: 'var(--radius-pill)',
                          backgroundColor: '#000000',
                          color: '#ffffff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <User size={18} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '14px' }}>Passenger</div>
                        <div className="body-sm">Search and book scheduled intercity journeys</div>
                      </div>
                    </div>
                    {selectedRole === 'passenger' && <CheckCircle2 size={18} color="#000000" />}
                  </div>

                  <div
                    onClick={() => setSelectedRole('driver')}
                    style={{
                      border: `2px solid ${selectedRole === 'driver' ? '#000000' : 'var(--color-card-border)'}`,
                      borderRadius: 'var(--radius-lg)',
                      padding: '14px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      backgroundColor: selectedRole === 'driver' ? 'var(--color-canvas-soft)' : 'transparent',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div
                        style={{
                          width: '38px',
                          height: '38px',
                          borderRadius: 'var(--radius-pill)',
                          backgroundColor: '#000000',
                          color: '#ffffff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Car size={18} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '14px' }}>Driver / Operator</div>
                        <div className="body-sm">Publish trips, fill empty seats & earn fares</div>
                      </div>
                    </div>
                    {selectedRole === 'driver' && <CheckCircle2 size={18} color="#000000" />}
                  </div>
                </div>
              </div>

              <button
                type="submit"
                className="btn btn-primary btn-lg btn-full"
                disabled={loading}
              >
                {loading ? 'Saving Profile...' : 'Finish Setup'}
                <ArrowRight size={18} />
              </button>
            </form>
          </div>
        ) : authMode === 'verify_otp' ? (
          /* STEP: 6-DIGIT EMAIL OTP VERIFICATION */
          <div>
            <div style={{ textAlign: 'center', marginBottom: '22px' }}>
              <div
                style={{
                  width: '50px',
                  height: '50px',
                  borderRadius: 'var(--radius-pill)',
                  backgroundColor: 'var(--color-canvas-soft)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 12px',
                }}
              >
                <Mail size={24} />
              </div>
              <h2 className="display-md" style={{ margin: 0 }}>
                Verify your email
              </h2>
              <p className="body-sm" style={{ marginTop: '6px', color: 'var(--color-body)' }}>
                Enter the 6-digit verification code sent to
              </p>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontWeight: 700,
                  fontSize: '15px',
                  marginTop: '4px',
                }}
              >
                <span>{email}</span>
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('email_otp');
                    setOtpToken('');
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--color-link)',
                    fontSize: '12px',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                  }}
                >
                  Edit
                </button>
              </div>
            </div>

            <form onSubmit={handleVerifyOtp}>
              <div className="form-group">
                <input
                  type="text"
                  className="input-field"
                  placeholder="123456"
                  maxLength={6}
                  autoFocus
                  value={otpToken}
                  onChange={(e) => setOtpToken(e.target.value.replace(/\D/g, ''))}
                  style={{
                    fontSize: '28px',
                    letterSpacing: '10px',
                    textAlign: 'center',
                    fontFamily: 'monospace',
                    fontWeight: 700,
                  }}
                  required
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary btn-lg btn-full"
                disabled={loading || otpToken.length < 6}
                style={{ marginTop: '16px' }}
              >
                {loading ? 'Verifying code...' : 'Confirm & Continue'}
              </button>

              <div style={{ textAlign: 'center', marginTop: '16px' }}>
                {countdown > 0 ? (
                  <span style={{ fontSize: '13px', color: 'var(--color-body)' }}>
                    Resend code in {countdown}s
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    disabled={loading}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--color-primary)',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <RefreshCw size={13} />
                    Resend Email Code
                  </button>
                )}
              </div>
            </form>
          </div>
        ) : authMode === 'recovery' ? (
          /* STEP: PASSWORD RECOVERY */
          <div>
            <div style={{ marginBottom: '22px' }}>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: 'var(--color-canvas-soft)',
                  padding: '4px 10px',
                  borderRadius: 'var(--radius-pill)',
                  fontSize: '12px',
                  fontWeight: 600,
                  marginBottom: '10px',
                }}
              >
                <KeyRound size={13} color="var(--color-primary)" />
                Security
              </div>
              <h2 className="display-lg" style={{ margin: 0 }}>
                Set a new password
              </h2>
              <p className="body-md" style={{ marginTop: '6px', color: 'var(--color-body)' }}>
                Please choose a strong password for your Wala Ride account.
              </p>
            </div>

            <form onSubmit={handlePasswordRecovery}>
              <div className="form-group">
                <label className="form-label">New Password</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="input-field"
                    placeholder="At least 6 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    style={{ paddingRight: '40px' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: 'absolute',
                      right: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--color-body)',
                    }}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Confirm New Password</label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="input-field"
                  placeholder="Repeat new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary btn-lg btn-full"
                disabled={loading || password.length < 6}
                style={{ marginTop: '16px' }}
              >
                {loading ? 'Updating Password...' : 'Save New Password'}
              </button>
            </form>
          </div>
        ) : authMode === 'forgot_password' ? (
          /* STEP: FORGOT PASSWORD */
          <div>
            <div style={{ marginBottom: '22px' }}>
              <button
                type="button"
                onClick={() => setAuthMode('password')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--color-body)',
                  fontSize: '13px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: 0,
                  marginBottom: '14px',
                }}
              >
                <ChevronLeft size={16} />
                Back to Sign In
              </button>
              <h2 className="display-lg" style={{ margin: 0 }}>
                Reset your password
              </h2>
              <p className="body-md" style={{ marginTop: '6px', color: 'var(--color-body)' }}>
                Enter the email address associated with your account and we'll send you a reset link.
              </p>
            </div>

            <form onSubmit={handleForgotPassword}>
              <div className="form-group">
                <label className="form-label">Email Address</label>
                <input
                  type="email"
                  className="input-field"
                  placeholder="you@domain.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary btn-lg btn-full"
                disabled={loading || !email.trim()}
                style={{ marginTop: '16px' }}
              >
                {loading ? 'Sending link...' : 'Send Reset Link'}
                <ArrowRight size={18} />
              </button>
            </form>
          </div>
        ) : (
          /* STEP: PRIMARY AUTH METHODS (EMAIL OTP / PASSWORD) */
          <div>
            {/* Header Branding */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '22px' }}>
              <img
                src="/wala-ride.jpeg"
                alt="Wala Ride"
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '12px',
                  objectFit: 'cover',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
                }}
              />
              <div>
                <h2 className="display-lg" style={{ margin: 0 }}>
                  Welcome to Wala Ride
                </h2>
                <p className="body-sm" style={{ margin: '3px 0 0', color: 'var(--color-body)' }}>
                  Intercity travel across Uganda made seamless.
                </p>
              </div>
            </div>

            {/* Auth Method Navigation Tabs */}
            <div
              style={{
                display: 'flex',
                backgroundColor: 'var(--color-canvas-soft)',
                padding: '4px',
                borderRadius: 'var(--radius-pill)',
                marginBottom: '20px',
                gap: '4px',
              }}
            >
              <button
                type="button"
                className={`btn btn-sm ${authMode === 'email_otp' ? 'btn-primary' : 'btn-subtle'}`}
                style={{ flex: 1, fontSize: '13px', padding: '8px 12px' }}
                onClick={() => {
                  setAuthMode('email_otp');
                  setErrorMessage(null);
                  setSuccessMessage(null);
                }}
              >
                <Mail size={14} /> Email OTP
              </button>
              <button
                type="button"
                className={`btn btn-sm ${authMode === 'password' ? 'btn-primary' : 'btn-subtle'}`}
                style={{ flex: 1, fontSize: '13px', padding: '8px 12px' }}
                onClick={() => {
                  setAuthMode('password');
                  setErrorMessage(null);
                  setSuccessMessage(null);
                }}
              >
                <Lock size={14} /> Password
              </button>
            </div>

            {/* 1. EMAIL OTP AUTH (6-DIGIT CODE SENT TO EMAIL) */}
            {authMode === 'email_otp' && (
              <form onSubmit={handleSendEmailOtp}>
                <div className="form-group">
                  <label className="form-label">Email Address</label>
                  <input
                    type="email"
                    className="input-field"
                    placeholder="you@domain.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                  <span className="body-sm" style={{ marginTop: '6px', display: 'block', color: 'var(--color-body)' }}>
                    We'll send a 6-digit verification code to your email for instant sign in.
                  </span>
                </div>

                <button
                  type="submit"
                  className="btn btn-primary btn-lg btn-full"
                  disabled={loading || !email.trim()}
                  style={{ marginTop: '16px' }}
                >
                  {loading ? 'Sending verification code...' : 'Continue with Email'}
                  <ArrowRight size={18} />
                </button>
              </form>
            )}

            {/* 2. PASSWORD AUTH (SIGN IN & CREATE ACCOUNT) */}
            {authMode === 'password' && (
              <div>
                {/* Segmented Sign In vs Sign Up */}
                <div
                  style={{
                    display: 'flex',
                    borderBottom: '1px solid var(--color-hairline)',
                    marginBottom: '18px',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setIsSignUp(false);
                      setErrorMessage(null);
                    }}
                    style={{
                      flex: 1,
                      padding: '10px',
                      background: 'none',
                      border: 'none',
                      borderBottom: !isSignUp ? '2px solid #000000' : '2px solid transparent',
                      fontWeight: !isSignUp ? 700 : 500,
                      color: !isSignUp ? '#000000' : 'var(--color-body)',
                      cursor: 'pointer',
                      fontSize: '14px',
                    }}
                  >
                    Sign In
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsSignUp(true);
                      setErrorMessage(null);
                    }}
                    style={{
                      flex: 1,
                      padding: '10px',
                      background: 'none',
                      border: 'none',
                      borderBottom: isSignUp ? '2px solid #000000' : '2px solid transparent',
                      fontWeight: isSignUp ? 700 : 500,
                      color: isSignUp ? '#000000' : 'var(--color-body)',
                      cursor: 'pointer',
                      fontSize: '14px',
                    }}
                  >
                    Create Account
                  </button>
                </div>

                <form onSubmit={handlePasswordAuth}>
                  {isSignUp && (
                    <>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '14px' }}>
                        <div className="form-group" style={{ margin: 0 }}>
                          <label className="form-label">First Name</label>
                          <input
                            type="text"
                            className="input-field"
                            placeholder="e.g. Ronald"
                            value={firstName}
                            onChange={(e) => setFirstName(e.target.value)}
                            required
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
                            required
                          />
                        </div>
                      </div>

                      <div className="form-group">
                        <label className="form-label">Phone Number (Optional)</label>
                        <input
                          type="tel"
                          className="input-field"
                          placeholder="+256 701 234 567"
                          value={signUpPhone}
                          onChange={(e) => setSignUpPhone(e.target.value)}
                        />
                      </div>
                    </>
                  )}

                  <div className="form-group">
                    <label className="form-label">Email Address</label>
                    <input
                      type="email"
                      className="input-field"
                      placeholder="you@domain.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <label className="form-label" style={{ margin: 0 }}>
                        Password
                      </label>
                      {!isSignUp && (
                        <button
                          type="button"
                          onClick={() => {
                            setAuthMode('forgot_password');
                            setErrorMessage(null);
                          }}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--color-body)',
                            fontSize: '12px',
                            cursor: 'pointer',
                            textDecoration: 'underline',
                            padding: 0,
                          }}
                        >
                          Forgot password?
                        </button>
                      )}
                    </div>
                    <div style={{ position: 'relative' }}>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        className="input-field"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        style={{ paddingRight: '40px' }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        style={{
                          position: 'absolute',
                          right: '12px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: 'var(--color-body)',
                        }}
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  {isSignUp && (
                    <>
                      <div className="form-group">
                        <label className="form-label">Confirm Password</label>
                        <input
                          type={showPassword ? 'text' : 'password'}
                          className="input-field"
                          placeholder="••••••••"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          required
                        />
                      </div>

                      {/* Role selection toggle */}
                      <div className="form-group">
                        <label className="form-label">I want to register as:</label>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                          <button
                            type="button"
                            onClick={() => setSelectedRole('passenger')}
                            style={{
                              padding: '10px',
                              borderRadius: 'var(--radius-md)',
                              border: `2px solid ${selectedRole === 'passenger' ? '#000000' : 'var(--color-card-border)'}`,
                              background: selectedRole === 'passenger' ? 'var(--color-canvas-soft)' : 'transparent',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '6px',
                              fontSize: '13px',
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            <User size={15} />
                            Passenger
                          </button>
                          <button
                            type="button"
                            onClick={() => setSelectedRole('driver')}
                            style={{
                              padding: '10px',
                              borderRadius: 'var(--radius-md)',
                              border: `2px solid ${selectedRole === 'driver' ? '#000000' : 'var(--color-card-border)'}`,
                              background: selectedRole === 'driver' ? 'var(--color-canvas-soft)' : 'transparent',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '6px',
                              fontSize: '13px',
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            <Car size={15} />
                            Driver / Operator
                          </button>
                        </div>
                      </div>
                    </>
                  )}

                  <button
                    type="submit"
                    className="btn btn-primary btn-lg btn-full"
                    disabled={loading}
                    style={{ marginTop: '16px' }}
                  >
                    {loading
                      ? isSignUp
                        ? 'Creating Account...'
                        : 'Signing In...'
                      : isSignUp
                      ? 'Create Account'
                      : 'Sign In'}
                    <ArrowRight size={18} />
                  </button>
                </form>
              </div>
            )}

            {/* DIVIDER */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                margin: '22px 0 16px',
                color: 'var(--color-mute)',
                fontSize: '12px',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--color-hairline)' }} />
              <span style={{ padding: '0 12px' }}>or continue with</span>
              <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--color-hairline)' }} />
            </div>

            {/* GOOGLE OAUTH BUTTON */}
            <button
              type="button"
              onClick={handleGoogleOAuth}
              disabled={loading}
              className="btn btn-secondary btn-full"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                padding: '12px',
                borderRadius: 'var(--radius-lg)',
                fontSize: '14px',
                fontWeight: 600,
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              Google
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
