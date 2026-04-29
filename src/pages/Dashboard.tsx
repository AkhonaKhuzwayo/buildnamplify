import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { signOut } from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  LogOut, UserCircle, Briefcase, TrendingUp, 
  MapPin, ShieldCheck, ChevronRight, Menu,
  Download, Plus, LayoutDashboard, Target,
  Loader2, BarChart3, ListChecks, AlertCircle
} from 'lucide-react';
import ClockIn from '../components/ClockIn';
import ActivationForm from '../components/ActivationForm';
import DocumentUpload from '../components/DocumentUpload';
import { motion, AnimatePresence } from 'motion/react';
import { doc, getDoc, updateDoc, collection, query, where, onSnapshot } from 'firebase/firestore';
import { X, Calendar, Mail, Shield, User, MapPin as MapPinIcon, CreditCard, Save } from 'lucide-react';
import { getActivationCollectionName } from '../lib/activationCollections';
import { getSouthAfricaDateKey, getSouthAfricaDateKeyFromTimestamp } from '../lib/dateKey';

const CAMPAIGN_LOGO_FALLBACKS: Record<string, string> = {
  'spot-money': '/spot-logo.jpeg',
  spot: '/spot-logo.jpeg',
  gumtree: '/gumtree-logo.jpeg'
};

const getActivationRate = (activation: any) => {
  if (typeof activation?.rate === 'number') return activation.rate;
  if (activation?.activationType === 'card-sim') return 110;
  if (activation?.activationType === 'card-only') return 100;
  if (activation?.activationType === 'account-advert') return 85;
  if (activation?.activationType === 'account-only') return 80;
  return 100;
};

export default function Dashboard() {
  const { profile, selectedCampaignId, setSelectedCampaignId } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [campaign, setCampaign] = useState<any>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [profileData, setProfileData] = useState({
    idNumber: profile?.idNumber || '',
    homeAddress: profile?.homeAddress || ''
  });
  const [saveLoading, setSaveLoading] = useState(false);
  const [dailyCount, setDailyCount] = useState(0);
  const [totalAccumulated, setTotalAccumulated] = useState(0);
  const [dailyEarnings, setDailyEarnings] = useState(0);
  const [totalEarnings, setTotalEarnings] = useState(0);
  const [performanceZone, setPerformanceZone] = useState<'normal' | 'green' | 'orange' | 'disabled'>('normal');

  useEffect(() => {
    if (profile) {
      setProfileData({
        idNumber: profile.idNumber || '',
        homeAddress: profile.homeAddress || ''
      });
      setPerformanceZone(profile.performanceZone || 'normal');
    }
  }, [profile]);

  useEffect(() => {
    const routeCampaignId = location.pathname === '/dashboard/spot'
      ? 'spot-money'
      : location.pathname === '/dashboard/gumtree'
        ? 'gumtree'
        : null;

    if (routeCampaignId && selectedCampaignId !== routeCampaignId) {
      setSelectedCampaignId(routeCampaignId);
    }
  }, [location.pathname, selectedCampaignId, setSelectedCampaignId]);

  useEffect(() => {
    if (!profile?.uid || !selectedCampaignId) return;
    const activationCollection = getActivationCollectionName(selectedCampaignId);
    const todayKey = getSouthAfricaDateKey();

    // Real-time listener: all activations for this user in the active campaign
    const totalQ = query(
      collection(db, activationCollection),
      where('userId', '==', profile.uid),
      where('campaignId', '==', selectedCampaignId)
    );

    const unsubTotal = onSnapshot(totalQ, (snap) => {
      let dailyItems = 0;
      let dailyAmount = 0;

      snap.docs.forEach((d) => {
        const data = d.data();
        const activationDateKey = data.submissionDateKey || getSouthAfricaDateKeyFromTimestamp(data.timestamp);
        const amount = getActivationRate(data);
        if (activationDateKey === todayKey) {
          dailyItems += 1;
          dailyAmount += amount;
        }
      });

      setTotalAccumulated(snap.size);
      setTotalEarnings(snap.docs.reduce((sum, d) => sum + getActivationRate(d.data()), 0));
      setDailyCount(dailyItems);
      setDailyEarnings(dailyAmount);
    });

    return () => {
      unsubTotal();
    };
  }, [profile?.uid, selectedCampaignId]);

  const handleSaveProfile = async () => {
    if (!profile) return;
    
    // Simple SA ID validation
    if (profileData.idNumber && !/^\d{13}$/.test(profileData.idNumber)) {
      alert("Invalid ID Number. Must be exactly 13 digits.");
      return;
    }

    setSaveLoading(true);
    try {
      const profileRef = doc(db, 'profiles', profile.uid);
      await updateDoc(profileRef, {
        idNumber: profileData.idNumber,
        homeAddress: profileData.homeAddress,
        updatedAt: new Date()
      });
      setIsEditing(false);
    } catch (err) {
      console.error("Failed to update profile:", err);
      alert("Failed to save profile changes.");
    } finally {
      setSaveLoading(false);
    }
  };

  useEffect(() => {
    const fetchCampaign = async () => {
      if (selectedCampaignId) {
        const docRef = doc(db, 'campaigns', selectedCampaignId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setCampaign({ id: docSnap.id, ...docSnap.data() });
        } else {
          setCampaign(null);
        }
      } else {
        setCampaign(null);
      }
    };
    fetchCampaign();
  }, [selectedCampaignId]);

  const handleSignOut = () => {
    signOut(auth);
    navigate('/');
  };

  const campaignLogo = CAMPAIGN_LOGO_FALLBACKS[campaign?.id || selectedCampaignId || ''] || campaign?.logo;

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="w-[240px] bg-card border-r border-border p-6 flex flex-col">
        <div className="flex items-center gap-3 mb-10">
          <img
            src="/BnA%20Logo.jpg"
            alt="BNA Logo"
            className="w-10 h-10 rounded-lg object-cover border border-border"
          />
          <div className="text-accent font-extrabold text-xl tracking-wider">
            BNA SYSTEM
          </div>
        </div>

        <nav className="flex flex-col gap-8">
          <div className="nav-group">
            <div className="text-[10px] uppercase text-text-s tracking-widest mb-3">General</div>
            <div className="flex flex-col">
              <button className="nav-item active">
                <LayoutDashboard size={18} /> Dashboard
              </button>
              <button onClick={() => setShowProfile(true)} className="nav-item">
                <ShieldCheck size={18} /> Documents & Profile
              </button>
            </div>
          </div>
          
          <button 
            onClick={handleSignOut}
            className="flex items-center gap-3 py-2 text-red-500/60 hover:text-red-500 transition-colors text-sm font-medium mt-4"
          >
            <LogOut size={18} /> Logout
          </button>
        </nav>

        <div className="mt-auto pt-4 border-t border-border/30 text-[11px] text-text-s">
          v2.4.0 (Stable)
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto bg-bg p-6 space-y-8">
        <header className="flex items-center justify-between pb-4 border-b border-white/[0.05]">
          <div className="flex items-center gap-6">
            {campaignLogo && (
              <div 
                className="w-16 h-16 rounded-xl border border-white/10 p-2 flex items-center justify-center bg-white/[0.02]"
                style={{ borderColor: campaign?.color ? `${campaign.color}33` : undefined }}
              >
                <img 
                  src={campaignLogo} 
                  alt={campaign?.name || 'Campaign Logo'} 
                  className="w-full h-full object-contain"
                  referrerPolicy="no-referrer"
                />
              </div>
            )}
            <div className="campaign-info">
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-2xl font-black uppercase tracking-tighter" style={{ color: campaign?.color || 'inherit' }}>
                  {campaign?.name || 'Initialization...'}
                </h1>
                <button 
                  onClick={() => navigate('/selector')}
                  className="px-2 py-0.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded text-[9px] text-text-s font-bold uppercase tracking-widest transition-all flex items-center gap-1.5"
                >
                  <Target size={10} />
                  Switch
                </button>
              </div>
              <p className="text-text-s text-[10px] uppercase font-bold tracking-[0.2em]">Live Operational Workspace</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setShowProfile(true)}
              className="user-badge flex items-center gap-3 bg-card px-3 py-1.5 rounded-full border border-border hover:border-accent/50 transition-colors"
            >
              <div className="text-right">
                <p className="text-[13px] font-semibold leading-tight">{profile?.displayName || 'Employee'}</p>
                <p className="text-[11px] text-text-s leading-tight text-right uppercase">{profile?.role}</p>
              </div>
              <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center text-accent font-bold">
                {profile?.displayName?.charAt(0) || 'E'}
              </div>
            </button>
          </div>
        </header>

        {/* User-Specific Stat Grid */}
        <section className="stat-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="stat-card bna-card p-6 flex items-center justify-between group hover:border-accent/30 transition-all border-l-4 border-l-accent">
            <div>
              <p className="text-[10px] uppercase text-text-s font-bold tracking-[0.2em] mb-2">Daily Submissions</p>
              <div className="flex items-baseline gap-2">
                <div className="text-accent font-black text-4xl tracking-tighter">{dailyCount}</div>
                <div className="text-[10px] text-text-s font-bold">/ 30 Target</div>
              </div>
              <div className="w-full h-1 bg-white/5 mt-3 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-accent transition-all duration-1000" 
                  style={{ width: `${Math.min((dailyCount / 30) * 100, 100)}%` }}
                />
              </div>
            </div>
            <div className="w-12 h-12 rounded-xl bg-accent/5 flex items-center justify-center text-accent group-hover:scale-110 transition-transform">
              <BarChart3 size={24} />
            </div>
          </div>

          <div className="stat-card bna-card p-6 flex items-center justify-between group hover:border-accent/30 transition-all">
            <div>
              <p className="text-[10px] uppercase text-text-s font-bold tracking-[0.2em] mb-2">Total Accumulated</p>
              <div className="text-text-p font-black text-4xl tracking-tighter">{totalAccumulated}</div>
            </div>
            <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center text-text-s group-hover:scale-110 transition-transform">
              <ListChecks size={24} />
            </div>
          </div>

          <div className={`stat-card bna-card p-6 border-l-4 transition-all ${
            performanceZone === 'disabled' ? 'border-l-red-500 bg-red-500/5' :
            performanceZone === 'orange' ? 'border-l-orange-500 bg-orange-500/5' :
            performanceZone === 'green' ? 'border-l-green-500 bg-green-500/5' :
            'border-l-accent'
          }`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] uppercase text-text-s font-bold tracking-[0.2em] mb-2">Performance Zone</p>
                <div className={`text-xl font-black uppercase tracking-tighter ${
                  performanceZone === 'disabled' ? 'text-red-500' :
                  performanceZone === 'orange' ? 'text-orange-500' :
                  performanceZone === 'green' ? 'text-green-500' :
                  'text-accent'
                }`}>
                  {performanceZone === 'normal' ? 'Optimized' : performanceZone + ' Zone'}
                </div>
                <p className="text-[9px] text-text-s mt-1 font-bold uppercase">
                  {performanceZone === 'normal' ? 'Target Compliance: 100%' :
                   performanceZone === 'green' ? 'Warning: Target Missed (1 Day)' :
                   performanceZone === 'orange' ? 'Critical: Target Missed (3 Days)' :
                   'Account Status: Restricted'}
                </p>
              </div>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                performanceZone === 'disabled' ? 'bg-red-500/20 text-red-500' :
                performanceZone === 'orange' ? 'bg-orange-500/20 text-orange-500' :
                performanceZone === 'green' ? 'bg-green-500/20 text-green-500' :
                'bg-accent/20 text-accent'
              }`}>
                {performanceZone === 'disabled' ? <AlertCircle size={20} /> : <TrendingUp size={20} />}
              </div>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="stat-card bna-card p-6 flex items-center justify-between group hover:border-green-500/30 transition-all border-l-4 border-l-green-500">
            <div>
              <p className="text-[10px] uppercase text-text-s font-bold tracking-[0.2em] mb-2">Daily Rate Total</p>
              <div className="text-green-400 font-black text-4xl tracking-tighter">R{dailyEarnings.toFixed(2)}</div>
              <p className="text-[10px] text-text-s font-bold mt-2 uppercase tracking-widest">Today's activation payout</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center text-green-400 group-hover:scale-110 transition-transform">
              <Briefcase size={24} />
            </div>
          </div>

          <div className="stat-card bna-card p-6 flex items-center justify-between group hover:border-green-500/30 transition-all border-l-4 border-l-green-500/70">
            <div>
              <p className="text-[10px] uppercase text-text-s font-bold tracking-[0.2em] mb-2">Total Rate Total</p>
              <div className="text-green-400 font-black text-4xl tracking-tighter">R{totalEarnings.toFixed(2)}</div>
              <p className="text-[10px] text-text-s font-bold mt-2 uppercase tracking-widest">Lifetime activation payout</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center text-green-400 group-hover:scale-110 transition-transform">
              <TrendingUp size={24} />
            </div>
          </div>
        </section>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Operational Side - Attendance */}
          <div className="w-full space-y-6">
            <ClockIn />
          </div>
        </div>

        {/* Bulk Data Entry Section - MOVED TO BOTTOM */}
        <section id="activation-portal" className="border-t border-border pt-8">
          <div className="mb-6">
            <h2 className="text-xl font-black uppercase tracking-tighter inline-flex items-center gap-3">
              <Plus className="text-accent" size={24} />
              Submit New Activations
            </h2>
            <p className="text-text-s text-[10px] uppercase tracking-widest font-bold mt-1">Field Operation Resource Management</p>
          </div>
          <ActivationForm />
        </section>
      </main>

      <AnimatePresence>
        {showProfile && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowProfile(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-lg max-h-[90vh] bg-card border border-border rounded-2xl overflow-y-auto shadow-2xl no-scrollbar"
            >
              <div className="h-32 bg-gradient-to-r from-accent/20 to-purple-500/20 relative">
                <button 
                  onClick={() => setShowProfile(false)}
                  className="absolute top-4 right-4 p-2 bg-black/20 hover:bg-black/40 rounded-full transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
              
              <div className="px-8 pb-8">
                <div className="relative -mt-12 mb-6">
                  <div className="w-24 h-24 rounded-2xl bg-card border-4 border-card p-1 shadow-xl">
                    <div className="w-full h-full rounded-xl bg-accent/10 flex items-center justify-center text-accent text-3xl font-black">
                      {profile?.displayName?.charAt(0) || 'E'}
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="flex justify-between items-start">
                    <div>
                      <h2 className="text-2xl font-black uppercase tracking-tighter">{profile?.displayName}</h2>
                      <p className="text-accent text-xs font-bold uppercase tracking-widest">{profile?.role} Protocol Active</p>
                    </div>
                    <button 
                      onClick={() => setIsEditing(!isEditing)}
                      className="text-[10px] font-bold uppercase tracking-widest text-accent hover:underline"
                    >
                      {isEditing ? 'Cancel' : 'Edit Details'}
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <p className="text-[10px] uppercase text-text-s font-bold tracking-widest">Employee ID</p>
                      <div className="flex items-center gap-2 text-sm font-mono text-text-p">
                        <Shield size={14} className="text-accent" />
                        {profile?.employeeId || <span className="text-red-500/50 italic">Not Assigned</span>}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] uppercase text-text-s font-bold tracking-widest">Email Address</p>
                      <div className="flex items-center gap-2 text-sm text-text-p">
                        <Mail size={14} className="text-accent" />
                        {profile?.email}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] uppercase text-text-s font-bold tracking-widest">Gender</p>
                      <div className="flex items-center gap-2 text-sm text-text-p">
                        <User size={14} className="text-accent" />
                        {profile?.gender ? `${profile.gender.charAt(0).toUpperCase()}${profile.gender.slice(1)}` : <span className="text-red-500/50 italic">Not Assigned</span>}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] uppercase text-text-s font-bold tracking-widest">Age</p>
                      <div className="flex items-center gap-2 text-sm text-text-p">
                        <Calendar size={14} className="text-accent" />
                        {typeof profile?.age === 'number' ? profile.age : <span className="text-red-500/50 italic">Not Assigned</span>}
                      </div>
                    </div>
                    
                    {isEditing ? (
                      <>
                        <div className="col-span-2 space-y-2">
                          <p className="text-[10px] uppercase text-text-s font-bold tracking-widest">South African ID Number</p>
                          <input 
                            type="text" 
                            maxLength={13}
                            className="w-full bna-input text-sm font-mono"
                            placeholder="13-digit ID"
                            value={profileData.idNumber}
                            onChange={e => setProfileData(p => ({ ...p, idNumber: e.target.value.replace(/\D/g, '') }))}
                          />
                        </div>
                        <div className="col-span-2 space-y-2">
                          <p className="text-[10px] uppercase text-text-s font-bold tracking-widest">Home Address</p>
                          <textarea 
                            className="w-full bna-input text-sm min-h-[80px] py-2"
                            placeholder="Enter full physical address"
                            value={profileData.homeAddress}
                            onChange={e => setProfileData(p => ({ ...p, homeAddress: e.target.value }))}
                          />
                          <button 
                            disabled={saveLoading}
                            onClick={handleSaveProfile}
                            className="w-full mt-2 bna-button py-2 text-[10px] flex items-center justify-center gap-2"
                          >
                            {saveLoading ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />}
                            Save Personal Details
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="col-span-2 space-y-1">
                          <p className="text-[10px] uppercase text-text-s font-bold tracking-widest">Identity Number</p>
                          <div className="flex items-center gap-2 text-sm text-text-p font-mono">
                            <CreditCard size={14} className="text-accent" />
                            {profile?.idNumber || <span className="text-red-500/50 italic">Not Assigned</span>}
                          </div>
                        </div>
                        <div className="col-span-2 space-y-1">
                          <p className="text-[10px] uppercase text-text-s font-bold tracking-widest">Home Address</p>
                          <div className="flex items-start gap-2 text-sm text-text-p">
                            <MapPinIcon size={14} className="text-accent mt-0.5" />
                            <span className="whitespace-pre-wrap">
                              {profile?.homeAddress || <span className="text-red-500/50 italic">Unspecified</span>}
                            </span>
                          </div>
                        </div>
                      </>
                    )}

                    <div className="space-y-1">
                      <p className="text-[10px] uppercase text-text-s font-bold tracking-widest">Operational Status</p>
                      <div className="flex items-center gap-2 text-sm text-text-p">
                        <div className="w-2 h-2 rounded-full bg-accent" />
                        Online & Active
                      </div>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] uppercase text-text-s font-bold tracking-widest">Joined Collective</p>
                      <div className="flex items-center gap-2 text-sm text-text-p">
                        <Calendar size={14} className="text-accent" />
                        {profile?.createdAt?.toDate ? profile.createdAt.toDate().toLocaleDateString() : 'Pending'}
                      </div>
                    </div>
                  </div>

                  <div className="pt-6 border-t border-border/50">
                    <p className="text-[10px] uppercase text-text-s font-bold tracking-widest mb-4">Supporting Documents</p>
                    <DocumentUpload variant="profile" />
                  </div>

                  <div className="pt-6 border-t border-border/50">
                    <button 
                      onClick={handleSignOut}
                      className="w-full py-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-xl text-xs font-bold uppercase tracking-[0.3em] transition-all flex items-center justify-center gap-2"
                    >
                      <LogOut size={16} />
                      Terminate Session
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

