import React from 'react';
import { useAuth } from '../context/AuthContext';
import { signOut } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { Database, LogOut, ShieldAlert, Key, UserCircle, Check, AlertCircle } from 'lucide-react';
import { motion } from 'motion/react';
import firebaseConfig from '../../firebase-applet-config.json';

export default function ProfileError() {
  const { user, profile, isOffline } = useAuth();
  const isDisabled = profile?.isActive === false && profile?.role !== 'admin';

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-6">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-2xl bna-card p-0 overflow-hidden"
      >
        <div className={`${isDisabled ? 'bg-red-600/10 border-red-600/20' : 'bg-red-500/10 border-red-500/20'} border-b p-6 flex items-center gap-4`}>
          <div className={`w-12 h-12 ${isDisabled ? 'bg-red-600/20 text-red-600' : 'bg-red-500/20 text-red-500'} rounded-full flex items-center justify-center shrink-0`}>
            <ShieldAlert size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-red-500">{isDisabled ? 'Account Access Restricted' : 'Profile Synchronization Error'}</h1>
            <p className="text-text-s text-xs uppercase tracking-widest mt-0.5">
              {isDisabled ? 'Performance Threshold Violation' : isOffline ? 'Database Connection Failed' : 'Missing Firestore Record'}
            </p>
          </div>
        </div>

        <div className="p-8 space-y-8">
          {isDisabled ? (
            <div className="space-y-6">
              <div className="bg-red-500/10 border border-red-500/30 p-5 rounded-xl">
                 <h3 className="text-red-500 font-bold mb-2 flex items-center gap-2">
                   <AlertCircle size={18} />
                   Critical Implementation Notice
                 </h3>
                 <p className="text-sm text-red-200/80 leading-relaxed">
                   Your account has been automatically disabled by the <span className="text-white font-mono">Performance Monitoring Engine</span>. 
                   Records indicate a repeated failure to meet the minimum daily activation target of <span className="text-white font-bold underline">20 Uploads</span> over a 4-day assessment window.
                 </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-black/40 border border-border rounded-lg">
                  <p className="text-[10px] uppercase text-text-s font-bold tracking-widest mb-1">Status Code</p>
                  <p className="text-xs font-mono text-red-500">AUTH_DISABLED_THRESHOLD_FAIL</p>
                </div>
                <div className="p-4 bg-black/40 border border-border rounded-lg">
                  <p className="text-[10px] uppercase text-text-s font-bold tracking-widest mb-1">System Action</p>
                  <p className="text-xs font-mono text-white">Logins Terminated</p>
                </div>
              </div>

              <div className="text-center p-6">
                <p className="text-sm text-text-s">Your profile remains in the collective database for audit purposes but active operations are locked. Contact your supervisor for reinstatement.</p>
              </div>
            </div>
          ) : (
            <>
              {isOffline && (
                <div className="bg-red-500/20 border border-red-500/40 p-4 rounded-lg flex gap-4 items-center">
                  <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
                  <p className="text-sm text-red-200">
                    <span className="font-bold">Operational Alert:</span> The application cannot reach the Cloud Firestore backend. 
                    Please check your internet connection or ensure the Firebase project is configured for your region.
                  </p>
                </div>
              )}

              <div className="flex gap-6 items-start">
                <div className="w-10 h-10 bg-accent/10 rounded flex items-center justify-center text-accent shrink-0 mt-1">
                  <Database size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-lg mb-2">What happened?</h3>
                  <p className="text-text-s text-sm leading-relaxed">
                    {isOffline ? (
                      <>
                        The system is currently <span className="text-red-400 font-bold">Offline</span>. 
                        Firestore refused the connection. This may be a temporary network issue or a configuration mismatch with the <span className="text-white">Database ID</span>.
                      </>
                    ) : (
                      <>
                        You have successfully authenticated with Firebase Auth, but the system cannot find your 
                        <span className="text-white font-bold px-1">Role & Permissions</span> record in the database. 
                        Access is restricted until this profile is created.
                      </>
                    )}
                  </p>
                </div>
              </div>
            </>
          )}

          <div className="bg-black/40 border border-border p-6 rounded-lg space-y-4">
            <h3 className="text-xs uppercase font-bold tracking-[0.2em] text-accent mb-4">Manual Setup Guide</h3>
            
            <div className="space-y-6">
              <div className="flex gap-4">
                <div className="w-6 h-6 bg-accent/20 rounded-full flex items-center justify-center text-[10px] font-bold border border-accent/30 text-accent">1</div>
                <div className="flex-1">
                  <p className="text-sm font-medium mb-1 flex items-center gap-2">
                    Verify Your Identity
                  </p>
                  <div className="bg-black/60 rounded border border-border overflow-hidden">
                    <div className="p-3 border-b border-border flex justify-between items-center">
                      <span className="text-[10px] uppercase tracking-widest text-text-s">Logged in as</span>
                      <span className="text-[10px] font-mono text-accent">{user?.email}</span>
                    </div>
                    <div className="p-3 bg-accent/5">
                      <span className="text-[10px] uppercase tracking-widest text-text-s block mb-1">Your Unique ID (UID)</span>
                      <code className="block text-accent text-xs break-all font-mono select-all">
                        {user?.uid}
                      </code>
                    </div>
                    <div className="p-3 border-t border-border flex justify-between items-center">
                      <span className="text-[10px] uppercase tracking-widest text-text-s">Active Database</span>
                      <span className="text-[10px] font-mono text-white bg-white/10 px-2 py-0.5 rounded">{firebaseConfig.firestoreDatabaseId}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="w-6 h-6 bg-white/5 rounded-full flex items-center justify-center text-[10px] font-bold border border-border text-text-s">2</div>
                <div className="flex-1">
                  <p className="text-sm font-medium mb-1">Check Firestore Document</p>
                  <p className="text-[11px] text-text-s leading-relaxed">
                    In your screenshot, make sure the document ID matches your <span className="text-white">UID</span> exactly. 
                    If the ID in Firestore is different, the app will be blocked for security.
                  </p>
                  <p className="text-[10px] text-text-s mt-1">
                    Collection Name must be: <span className="text-accent font-bold">profiles</span>
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 flex flex-col gap-3">
            <button 
              onClick={() => window.location.reload()}
              className="w-full bna-button h-12"
            >
              Verify Sync
            </button>
            <div className="flex gap-3">
              <button 
                onClick={() => {
                  localStorage.clear();
                  sessionStorage.clear();
                  signOut(auth);
                }}
                className="flex-1 py-3 bg-white/5 border border-border rounded text-xs uppercase tracking-widest font-bold hover:bg-white/10 flex items-center justify-center gap-2 transition-all"
              >
                <LogOut size={14} /> Clear Session
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
