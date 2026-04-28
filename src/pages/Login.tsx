import React, { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { ShieldAlert, Eye, EyeOff, ArrowLeft } from 'lucide-react';
import { motion } from 'motion/react';

export default function Login() {
  const [searchParams] = useSearchParams();
  const [employeeId, setEmployeeId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const selectedRole = (searchParams.get('role') || '').toLowerCase();
  const roleLabel = selectedRole === 'admin'
    ? 'Admin'
    : selectedRole === 'official'
      ? 'Official Rep'
      : selectedRole === 'guest'
        ? 'Guest'
        : null;
  const backTarget = auth.currentUser ? '/home' : '/';
  const backLabel = auth.currentUser ? 'Go To Dashboard' : 'Back To Landing';

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const snap = await getDocs(
        query(collection(db, 'profiles'), where('employeeId', '==', employeeId.trim()))
      );
      if (snap.empty) {
        setError('Employee ID not found. Contact your admin if you have been provisioned an account.');
        setLoading(false);
        return;
      }
      const userEmail = snap.docs[0].data().email as string;
      await signInWithEmailAndPassword(auth, userEmail, password);
      navigate('/home');
    } catch (err: any) {
      console.error('Login Error:', err);
      let message = 'Failed to login';
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password') {
        message = 'Incorrect password. Please try again.';
      } else if (err.code === 'auth/user-not-found') {
        message = 'No account found for this Employee ID. Contact your admin.';
      } else if (err.code === 'auth/too-many-requests') {
        message = 'Too many failed attempts. Please wait before trying again.';
      } else {
        message = err.message || 'Failed to login. Please check your internet connection.';
      }
      setError(message);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-bg">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-sm bna-card p-8 shadow-2xl shadow-accent/5"
      >
        <div className="flex flex-col items-center mb-8">
          <div className="text-accent font-extrabold text-2xl tracking-widest mb-2">
            BNA SYSTEM
          </div>
          <p className="text-text-s text-[10px] uppercase tracking-[0.2em] font-medium">Enterprise Management</p>
          {roleLabel && (
            <p className="mt-3 text-[10px] uppercase tracking-[0.2em] text-accent font-bold">
              Login Profile: {roleLabel}
            </p>
          )}
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-3 rounded flex items-center gap-3 mb-6 text-xs font-medium">
            <ShieldAlert size={16} />
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          <div className="form-group">
            <label className="block text-[11px] font-bold text-text-s uppercase tracking-wider mb-2">Employee ID</label>
            <input 
              type="text" 
              className="bna-input"
              placeholder="e.g. admin_manqoba1 or 00041"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label className="block text-[11px] font-bold text-text-s uppercase tracking-wider mb-2">Password</label>
            <div className="relative">
              <input 
                type={showPassword ? "text" : "password"} 
                className="bna-input pr-10"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-s hover:text-accent"
              >
                {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>
          <button 
            type="submit" 
            disabled={loading}
            className="w-full bna-button mt-4 h-11 uppercase tracking-widest text-xs font-bold"
          >
            {loading ? 'Authenticating...' : 'Secure Login'}
          </button>
          <button
            type="button"
            onClick={() => navigate(backTarget)}
            className="w-full h-11 mt-2 border border-border rounded-lg text-text-s hover:text-accent hover:border-accent/40 transition-colors uppercase tracking-widest text-xs font-bold flex items-center justify-center gap-2"
          >
            <ArrowLeft size={14} /> {backLabel}
          </button>
        </form>

        <div className="mt-10 pt-6 border-t border-border flex flex-col items-center gap-2">
          <p className="text-[11px] text-text-s">
            Don't have an account? {' '}
            <Link to="/register" className="text-accent hover:underline font-bold">Register</Link>
          </p>
          <div className="h-4" />
          <p className="text-[10px] text-text-s uppercase tracking-widest font-medium">System Status</p>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
            <span className="text-[11px] text-accent font-bold">NODE-KZN ACTIVE</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
