import React, { useState } from 'react';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { useNavigate, Link } from 'react-router-dom';
import { UserPlus, ShieldAlert, Check, Loader2, ShieldCheck, Eye, EyeOff } from 'lucide-react';
import { motion } from 'motion/react';

export default function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState<'admin' | 'official' | 'guest'>('admin');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const normalizedEmail = email.trim().toLowerCase();
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, normalizedEmail, password);
      const user = userCredential.user;

      // Update auth profile
      await updateProfile(user, { displayName: displayName.trim() });

      // Create Firestore profile
      console.log("Creating Firestore profile for UID:", user.uid);
      await setDoc(doc(db, 'profiles', user.uid), {
        uid: user.uid,
        email: normalizedEmail,
        displayName: displayName.trim(),
        role,
        isActive: true,
        createdAt: serverTimestamp()
      });

      console.log("Registration successful");
      navigate('/');
    } catch (err: any) {
      console.error("Registration Error Detail:", err);
      let message = 'Failed to register';
      
      if (err.code === 'auth/email-already-in-use') {
        message = 'This email is already registered. Please login instead.';
      } else if (err.code === 'auth/weak-password') {
        message = 'Password is too weak. Please use at least 6 characters.';
      } else if (err.code === 'auth/invalid-email') {
        message = 'The email address is not valid.';
      } else if (err.code === 'permission-denied' || err.message?.includes('Missing or insufficient permissions')) {
        message = 'Account created, but database profile setup failed. You might need to contact an administrator.';
      } else {
        message = err.message || 'An unexpected error occurred during registration.';
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
          <p className="text-text-s text-[10px] uppercase tracking-[0.2em] font-medium">Create New Account</p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-3 rounded flex items-center gap-3 mb-6 text-xs font-medium">
            <ShieldAlert size={16} />
            {error}
          </div>
        )}

        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label className="block text-[11px] font-bold text-text-s uppercase tracking-wider mb-2">Full Name</label>
            <input 
              type="text" 
              className="bna-input"
              placeholder="e.g. John Doe"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-text-s uppercase tracking-wider mb-2">Email Address</label>
            <input 
              type="email" 
              className="bna-input"
              placeholder="e.g. administrator@bna.co.za"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
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
          
          <div>
            <label className="block text-[11px] font-bold text-text-s uppercase tracking-wider mb-2">Assign Role</label>
            <div className="grid grid-cols-3 gap-2">
              {(['admin', 'official', 'guest'] as const).map(r => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  className={`py-2 px-1 rounded text-[9px] font-bold uppercase tracking-wider transition-all border ${
                    role === r 
                    ? 'bg-accent/10 border-accent text-accent' 
                    : 'bg-black border-border text-text-s hover:border-accent/30'
                  }`}
                >
                  {r === 'admin' && <ShieldCheck size={10} className="inline mr-1 mb-0.5" />}
                  {r}
                </button>
              ))}
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bna-button mt-4 h-11 uppercase tracking-widest text-xs font-bold flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : 'Create Account'}
          </button>
        </form>

        <div className="mt-8 text-center">
          <p className="text-text-s text-[11px]">
            Already have an account? {' '}
            <Link to="/login" className="text-accent hover:underline font-bold">Sign In</Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
