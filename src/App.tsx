/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Moon, Sun } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Selector from './pages/Selector';
import Admin from './pages/Admin';
import ProfileError from './pages/ProfileError';
import Register from './pages/Register';
import RoleEntry from './pages/RoleEntry';

function getDashboardPathForCampaign(campaignId?: string | null) {
  if (campaignId === 'spot-money' || campaignId === 'spot') return '/dashboard/spot';
  if (campaignId === 'gumtree') return '/dashboard/gumtree';
  return '/dashboard';
}

function ProtectedRoute({ children, allowedRoles }: { children: React.ReactNode, allowedRoles?: string[] }) {
  const { user, profile, loading, selectedCampaignId } = useAuth();
  const [showTimeout, setShowTimeout] = React.useState(false);

  React.useEffect(() => {
    if (!loading) { setShowTimeout(false); return; }
    const t = setTimeout(() => setShowTimeout(true), 5000);
    return () => clearTimeout(t);
  }, [loading]);

  console.log('ProtectedRoute state:', { loading, user: user?.email, profile });

  if (loading) return <div className="min-h-screen bg-bg flex items-center justify-center text-accent">
    <div className="flex flex-col items-center gap-4">
      <div className="w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin"></div>
      <p className="text-xs uppercase tracking-[0.3em] font-bold">Synchronizing</p>
      {showTimeout && (
        <p className="text-[10px] text-red-400 max-w-xs text-center">
          Taking longer than usual. Check your internet connection or try refreshing.
        </p>
      )}
    </div>
  </div>;
  
  if (!user) return <Navigate to="/login" />;
  
  // Handle case where user is logged in but has no Firestore profile
  if (!profile) return <ProfileError />;

  // PERFORMANCE GUARD: Prevent disabled users from accessing operational pages
  if (profile.isActive === false && profile.role !== 'admin') {
    return <ProfileError />;
  }

  if (allowedRoles && !allowedRoles.includes(profile.role)) {
    return <Navigate to="/" />;
  }

  const path = window.location.pathname;
  const isCampaignDashboardPath = path === '/dashboard/spot' || path === '/dashboard/gumtree';

  // If Official or Guest hasn't picked a campaign, force them to Selector
  if ((profile.role === 'official' || profile.role === 'guest') && !selectedCampaignId && path !== '/selector' && !isCampaignDashboardPath) {
    return <Navigate to="/selector" />;
  }

  return <>{children}</>;
}

function HomeRedirect() {
  const { profile, selectedCampaignId } = useAuth();
  if (!profile) return <Navigate to="/login" />;
  
  if (profile.role === 'admin') return <Navigate to="/admin" />;
  
  if (profile.role === 'official' || profile.role === 'guest') {
    return selectedCampaignId
      ? <Navigate to={getDashboardPathForCampaign(selectedCampaignId)} />
      : <Navigate to="/selector" />;
  }
  
  return <Navigate to={getDashboardPathForCampaign(selectedCampaignId)} />;
}

function LegacyDashboardRedirect() {
  const { selectedCampaignId } = useAuth();
  return <Navigate to={getDashboardPathForCampaign(selectedCampaignId)} />;
}

function ThemeToggle({ theme, onToggle }: { theme: 'light' | 'dark'; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
      className="fixed top-4 right-4 z-[100] flex items-center gap-2 rounded-full border border-border bg-card/95 px-3 py-2 text-xs font-bold uppercase tracking-[0.2em] text-text-p shadow-lg backdrop-blur-sm transition-all hover:border-accent hover:text-accent"
    >
      {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
      <span>{theme === 'dark' ? 'Light' : 'Dark'} Mode</span>
    </button>
  );
}

export default function App() {
  const [theme, setTheme] = React.useState<'light' | 'dark'>(() => {
    if (typeof window === 'undefined') return 'dark';
    const stored = window.localStorage.getItem('bna-theme');
    return stored === 'light' ? 'light' : 'dark';
  });

  React.useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem('bna-theme', theme);
  }, [theme]);

  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="min-h-screen bg-bg text-text-p font-sans selection:bg-accent/20 transition-colors duration-300">
          <ThemeToggle
            theme={theme}
            onToggle={() => setTheme(current => current === 'dark' ? 'light' : 'dark')}
          />
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/" element={<RoleEntry />} />
            
            <Route path="/home" element={<ProtectedRoute><HomeRedirect /></ProtectedRoute>} />
            
            <Route path="/selector" element={
              <ProtectedRoute allowedRoles={['official', 'guest']}>
                <Selector />
              </ProtectedRoute>
            } />
            
            <Route path="/dashboard" element={
              <ProtectedRoute allowedRoles={['official', 'guest']}>
                <LegacyDashboardRedirect />
              </ProtectedRoute>
            } />

            <Route path="/dashboard/spot" element={
              <ProtectedRoute allowedRoles={['official', 'guest']}>
                <Dashboard />
              </ProtectedRoute>
            } />

            <Route path="/dashboard/gumtree" element={
              <ProtectedRoute allowedRoles={['official', 'guest']}>
                <Dashboard />
              </ProtectedRoute>
            } />
            
            <Route path="/admin" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <Admin />
              </ProtectedRoute>
            } />

            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}

