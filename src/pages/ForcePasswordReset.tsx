import React, { useState } from 'react';
import { updatePassword } from 'firebase/auth';
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { ShieldAlert, Lock, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { auth, db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const STRONG_PASSWORD_RULE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9])\S{10,}$/;

export default function ForcePasswordReset() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!STRONG_PASSWORD_RULE.test(newPassword)) {
      setError('Use 10+ chars with uppercase, lowercase, number, and symbol (no spaces).');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (!auth.currentUser || !profile?.uid) {
      setError('Session expired. Please sign in again.');
      return;
    }

    setLoading(true);
    try {
      await updatePassword(auth.currentUser, newPassword);
      await updateDoc(doc(db, 'profiles', profile.uid), {
        forcePasswordResetRequired: false,
        passwordMode: 'custom',
        passwordUpdatedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      const recipient = profile?.email || auth.currentUser?.email;
      if (recipient) {
        const loginUrl = `${window.location.origin}/login`;
        const subject = 'BNA System Password Updated';
        const body = [
          'Hello,',
          '',
          'Your BNA account password was successfully updated.',
          '',
          `Login URL: ${loginUrl}`,
          `Login ID (Employee ID): ${profile?.employeeId || 'Use your assigned employee ID'}`,
          `New Password: ${newPassword}`,
          '',
          'If you did not perform this update, contact your administrator immediately.'
        ].join('\n');
        const mailtoUrl = `mailto:${encodeURIComponent(recipient)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        window.location.href = mailtoUrl;
      }

      navigate('/home', { replace: true });
    } catch (err: any) {
      if (err?.code === 'auth/requires-recent-login') {
        setError('For security, please sign in again and retry.');
      } else {
        setError('Failed to update password. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-bg">
      <div className="w-full max-w-md bna-card p-8 shadow-2xl shadow-accent/5">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-accent/10 text-accent flex items-center justify-center">
            <Lock size={18} />
          </div>
          <div>
            <h1 className="text-lg font-black uppercase tracking-tight">Password Reset Required</h1>
            <p className="text-[11px] text-text-s uppercase tracking-widest">Security hardening step</p>
          </div>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-3 rounded flex items-center gap-2 mb-4 text-xs">
            <ShieldAlert size={14} />
            {error}
          </div>
        )}

        <p className="text-xs text-text-s mb-5">
          Your account is configured to require a password update before accessing the system.
        </p>
        <p className="text-[10px] text-text-s uppercase tracking-wider mb-4">
          Strong password required: 10+ chars, uppercase, lowercase, number, symbol, no spaces.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <input
              type={showNewPassword ? 'text' : 'password'}
              className="bna-input pr-10"
              placeholder="New password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
              required
            />
            <button
              type="button"
              onClick={() => setShowNewPassword((prev) => !prev)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-s hover:text-accent"
              aria-label={showNewPassword ? 'Hide new password' : 'Show new password'}
            >
              {showNewPassword ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
          <div className="relative">
            <input
              type={showConfirmPassword ? 'text' : 'password'}
              className="bna-input pr-10"
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              required
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword((prev) => !prev)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-s hover:text-accent"
              aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
            >
              {showConfirmPassword ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bna-button h-11 uppercase tracking-widest text-xs font-bold flex items-center justify-center gap-2"
          >
            {loading ? 'Updating...' : <><CheckCircle2 size={14} /> Set New Password</>}
          </button>
        </form>
      </div>
    </div>
  );
}
