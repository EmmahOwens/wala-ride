import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  X,
  User,
  Mail,
  Phone,
  Shield,
  Car,
  KeyRound,
  LogOut,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Edit2,
  Check,
} from 'lucide-react';

interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSwitchToDriver?: () => void;
}

export const AccountModal: React.FC<AccountModalProps> = ({
  isOpen,
  onClose,
  onSwitchToDriver,
}) => {
  const {
    user,
    profile,
    roles,
    activeRole,
    setActiveRole,
    driverProfile,
    updateProfile,
    updatePassword,
    assignRole,
    signOut,
  } = useAuth();

  const [activeTab, setActiveTab] = useState<'profile' | 'security'>('profile');

  // Edit profile state
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [firstName, setFirstName] = useState<string>(profile?.first_name || '');
  const [lastName, setLastName] = useState<string>(profile?.last_name || '');
  const [phone, setPhone] = useState<string>(profile?.phone || '');

  // Password change state
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);

  // Status feedback
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!isOpen || !user) return null;

  const fullName = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') ||
    user.email?.split('@')[0] ||
    user.phone ||
    'Wala Traveler';

  const userInitials = (profile?.first_name?.[0] || user.email?.[0] || 'W').toUpperCase();

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setLoading(true);

    const { error } = await updateProfile({
      first_name: firstName.trim() || undefined,
      last_name: lastName.trim() || undefined,
      phone: phone.trim() || undefined,
    });

    setLoading(false);

    if (error) {
      setErrorMessage(error.message);
    } else {
      setSuccessMessage('Profile details updated successfully.');
      setIsEditing(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (newPassword.length < 6) {
      setErrorMessage('New password must be at least 6 characters.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    setLoading(true);
    const { error } = await updatePassword(newPassword.trim());
    setLoading(false);

    if (error) {
      setErrorMessage(error.message);
    } else {
      setSuccessMessage('Password changed successfully.');
      setNewPassword('');
      setConfirmPassword('');
    }
  };

  const handleUpgradeToDriver = async () => {
    setLoading(true);
    const success = await assignRole('driver');
    setLoading(false);
    if (success) {
      setActiveRole('driver');
      setSuccessMessage('Driver role activated! Welcome to the driver portal.');
      if (onSwitchToDriver) onSwitchToDriver();
    } else {
      setErrorMessage('Failed to activate driver role.');
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '520px', padding: '28px' }}
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
          }}
        >
          <X size={18} />
        </button>

        {/* User Card Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
          <div
            style={{
              width: '60px',
              height: '60px',
              borderRadius: 'var(--radius-pill)',
              backgroundColor: '#000000',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '22px',
              fontWeight: 800,
              boxShadow: '0 4px 14px rgba(0, 0, 0, 0.2)',
              flexShrink: 0,
            }}
          >
            {userInitials}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <h2 className="display-md" style={{ margin: 0, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
              {fullName}
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px', flexWrap: 'wrap' }}>
              {user.email && (
                <span className="body-sm" style={{ color: 'var(--color-body)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <Mail size={13} /> {user.email}
                </span>
              )}
              {profile?.phone && (
                <span className="body-sm" style={{ color: 'var(--color-body)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <Phone size={13} /> {profile.phone}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Feedback Banners */}
        {errorMessage && (
          <div
            style={{
              backgroundColor: 'var(--color-danger-bg)',
              color: 'var(--color-danger)',
              padding: '10px 14px',
              borderRadius: 'var(--radius-md)',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '16px',
            }}
          >
            <AlertCircle size={16} />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div
            style={{
              backgroundColor: 'var(--color-success-bg)',
              color: 'var(--color-success)',
              padding: '10px 14px',
              borderRadius: 'var(--radius-md)',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '16px',
            }}
          >
            <CheckCircle2 size={16} />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Tabs: Profile vs Security */}
        <div
          style={{
            display: 'flex',
            backgroundColor: 'var(--color-canvas-soft)',
            padding: '3px',
            borderRadius: 'var(--radius-pill)',
            marginBottom: '20px',
          }}
        >
          <button
            type="button"
            className={`btn btn-sm ${activeTab === 'profile' ? 'btn-primary' : 'btn-subtle'}`}
            style={{ flex: 1, fontSize: '13px' }}
            onClick={() => {
              setActiveTab('profile');
              setErrorMessage(null);
              setSuccessMessage(null);
            }}
          >
            <User size={14} /> Profile & Roles
          </button>
          <button
            type="button"
            className={`btn btn-sm ${activeTab === 'security' ? 'btn-primary' : 'btn-subtle'}`}
            style={{ flex: 1, fontSize: '13px' }}
            onClick={() => {
              setActiveTab('security');
              setErrorMessage(null);
              setSuccessMessage(null);
            }}
          >
            <KeyRound size={14} /> Security
          </button>
        </div>

        {/* TAB 1: PROFILE & ROLES */}
        {activeTab === 'profile' && (
          <div>
            {/* Roles Section */}
            <div style={{ marginBottom: '22px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-body)' }}>
                  Active Workspace Role
                </span>
                <span style={{ fontSize: '12px', color: 'var(--color-body)' }}>
                  Current: <strong style={{ textTransform: 'capitalize' }}>{activeRole}</strong>
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setActiveRole('passenger')}
                  style={{
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-lg)',
                    border: `2px solid ${activeRole === 'passenger' ? '#000000' : 'var(--color-card-border)'}`,
                    backgroundColor: activeRole === 'passenger' ? 'var(--color-canvas-soft)' : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: 600,
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <User size={15} /> Passenger
                  </span>
                  {activeRole === 'passenger' && <Check size={14} />}
                </button>

                {roles.includes('driver') ? (
                  <button
                    type="button"
                    onClick={() => setActiveRole('driver')}
                    style={{
                      padding: '10px 14px',
                      borderRadius: 'var(--radius-lg)',
                      border: `2px solid ${activeRole === 'driver' ? '#000000' : 'var(--color-card-border)'}`,
                      backgroundColor: activeRole === 'driver' ? 'var(--color-canvas-soft)' : 'transparent',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      fontSize: '13px',
                      fontWeight: 600,
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Car size={15} /> Driver
                    </span>
                    {activeRole === 'driver' && <Check size={14} />}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleUpgradeToDriver}
                    disabled={loading}
                    style={{
                      padding: '10px 14px',
                      borderRadius: 'var(--radius-lg)',
                      border: '1px dashed var(--color-hairline-mid)',
                      backgroundColor: 'transparent',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      cursor: 'pointer',
                      fontSize: '13px',
                      fontWeight: 600,
                      color: 'var(--color-primary)',
                    }}
                  >
                    <Car size={15} /> + Become Driver
                  </button>
                )}

                {roles.includes('admin') && (
                  <button
                    type="button"
                    onClick={() => setActiveRole('admin')}
                    style={{
                      padding: '10px 14px',
                      borderRadius: 'var(--radius-lg)',
                      border: `2px solid ${activeRole === 'admin' ? '#000000' : 'var(--color-card-border)'}`,
                      backgroundColor: activeRole === 'admin' ? 'var(--color-canvas-soft)' : 'transparent',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      fontSize: '13px',
                      fontWeight: 600,
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Shield size={15} /> Admin
                    </span>
                    {activeRole === 'admin' && <Check size={14} />}
                  </button>
                )}
              </div>

              {roles.includes('driver') && driverProfile && (
                <div
                  style={{
                    marginTop: '10px',
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--color-canvas-soft)',
                    fontSize: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <span style={{ color: 'var(--color-body)' }}>Driver KYC Status</span>
                  <span
                    style={{
                      textTransform: 'capitalize',
                      fontWeight: 600,
                      color: driverProfile.verification_status === 'verified' ? 'var(--color-success)' : 'var(--color-warning)',
                    }}
                  >
                    {driverProfile.verification_status}
                  </span>
                </div>
              )}
            </div>

            {/* Profile Information */}
            <div style={{ borderTop: '1px solid var(--color-hairline)', paddingTop: '18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-body)' }}>
                  Personal Information
                </span>
                {!isEditing ? (
                  <button
                    type="button"
                    onClick={() => {
                      setFirstName(profile?.first_name || '');
                      setLastName(profile?.last_name || '');
                      setPhone(profile?.phone || '');
                      setIsEditing(true);
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--color-primary)',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <Edit2 size={13} /> Edit
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--color-body)',
                      fontSize: '13px',
                      cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                )}
              </div>

              {isEditing ? (
                <form onSubmit={handleSaveProfile}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">First Name</label>
                      <input
                        type="text"
                        className="input-field"
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
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="form-group" style={{ marginBottom: '16px' }}>
                    <label className="form-label">Phone Number (MTN / Airtel)</label>
                    <input
                      type="tel"
                      className="input-field"
                      placeholder="+256 701 234 567"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                  </div>

                  <button
                    type="submit"
                    className="btn btn-primary btn-md btn-full"
                    disabled={loading}
                  >
                    {loading ? 'Saving...' : 'Save Profile Changes'}
                  </button>
                </form>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                    <span style={{ color: 'var(--color-body)' }}>Name</span>
                    <span style={{ fontWeight: 600 }}>{fullName}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                    <span style={{ color: 'var(--color-body)' }}>Email</span>
                    <span style={{ fontWeight: 600 }}>{user.email || 'None'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                    <span style={{ color: 'var(--color-body)' }}>Phone</span>
                    <span style={{ fontWeight: 600 }}>{profile?.phone || user.phone || 'None'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                    <span style={{ color: 'var(--color-body)' }}>User ID</span>
                    <span style={{ fontFamily: 'monospace', fontSize: '11px', color: 'var(--color-body)' }}>
                      {user.id.slice(0, 16)}...
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: SECURITY */}
        {activeTab === 'security' && (
          <div>
            <div style={{ marginBottom: '20px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '6px' }}>
                Change Account Password
              </h3>
              <p className="body-sm" style={{ color: 'var(--color-body)', margin: 0 }}>
                Set a new password to protect your bookings and driver earnings.
              </p>
            </div>

            <form onSubmit={handleUpdatePassword}>
              <div className="form-group">
                <label className="form-label">New Password</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="input-field"
                    placeholder="At least 6 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
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
                className="btn btn-primary btn-md btn-full"
                disabled={loading || newPassword.length < 6}
                style={{ marginTop: '12px' }}
              >
                {loading ? 'Updating Password...' : 'Update Password'}
              </button>
            </form>
          </div>
        )}

        {/* Sign Out Button */}
        <div style={{ borderTop: '1px solid var(--color-hairline)', paddingTop: '20px', marginTop: '24px' }}>
          <button
            type="button"
            onClick={async () => {
              await signOut();
              onClose();
            }}
            className="btn btn-subtle btn-md btn-full"
            style={{
              color: 'var(--color-danger)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}
          >
            <LogOut size={16} />
            Sign Out of Wala Ride
          </button>
        </div>
      </div>
    </div>
  );
};
