import React, { useEffect, useRef, useState } from 'react';
import { collection, query, orderBy, limit, onSnapshot, addDoc, serverTimestamp, setDoc, doc, deleteDoc, where, getDocs, updateDoc } from 'firebase/firestore';
import { createUserWithEmailAndPassword, signOut, updatePassword } from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { 
  Users, BarChart3, AlertCircle,
  Search, Plus, Download,
  Trash2, UserPlus, Shield, LogOut,
  Briefcase, Eye, EyeOff, Loader2, TrendingUp
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getAllActivationCollectionNames } from '../lib/activationCollections';
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

const normalizeCampaignStatus = (campaign: any) => {
  const rawStatus = typeof campaign?.status === 'string' ? campaign.status.trim().toLowerCase() : '';
  if (rawStatus) return rawStatus;
  if (campaign?.isActive === false) return 'inactive';
  if (campaign?.id === 'spot' || campaign?.id === 'spot-money' || campaign?.id === 'gumtree') return 'active';
  return 'inactive';
};

const getPasswordStatusMeta = (user: any) => {
  if (user.forcePasswordResetRequired) {
    return {
      label: 'Reset Required',
      detail: 'Must change password on next login',
      className: 'bg-red-500/10 text-red-500 border-red-500/30'
    };
  }

  if (user.passwordMode === 'custom') {
    return {
      label: 'Custom',
      detail: 'User-defined password active',
      className: 'bg-green-500/10 text-green-400 border-green-500/30'
    };
  }

  return {
    label: 'Generated',
    detail: 'Admin-issued password active',
    className: 'bg-amber-500/10 text-amber-400 border-amber-500/30'
  };
};

const getEffectivePerformanceZone = (user: any): 'normal' | 'green' | 'orange' | 'disabled' => {
  if (FORCE_NORMAL_PERFORMANCE && user?.role !== 'admin') return 'normal';
  if (user?.isActive === false) return 'disabled';
  if (user?.performanceZone === 'disabled') return 'orange';
  if (user?.performanceZone === 'green' || user?.performanceZone === 'orange' || user?.performanceZone === 'normal') {
    return user.performanceZone;
  }
  return 'normal';
};

interface LiveStaffStat {
  dailyCount: number;
  totalAccumulated: number;
  cardOnlyCount: number;
  cardSimCount: number;
  totalEarnings: number;
}

const REQUIRED_DOCUMENT_TYPES = [
  { label: 'ID Copy', value: 'ID' },
  { label: 'Proof of Bank', value: 'Bank Proof' },
  { label: 'Proof of Address', value: 'Residence' },
  { label: 'Signed Contract', value: 'Contract' }
] as const;

const AUDIT_WINDOW_DAYS = 4;
const MIN_DAILY_TARGET = 8;
const FORCE_NORMAL_PERFORMANCE = true;

const normalizeCampaignId = (campaignId?: string | null) => {
  const normalized = (campaignId || '').trim().toLowerCase();
  if (!normalized) return '';
  if (normalized.includes('spot')) return 'spot';
  if (normalized.includes('gumtree')) return 'gumtree';
  return normalized;
};

const isAssignedToCampaign = (userCampaignId?: string | null, campaignId?: string | null) => {
  return normalizeCampaignId(userCampaignId) === normalizeCampaignId(campaignId);
};

export default function Admin() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'employees' | 'campaigns' | 'reports' | 'logistics'>('dashboard');
  const [activations, setActivations] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddUser, setShowAddUser] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [selectedUserDocs, setSelectedUserDocs] = useState<any[]>([]);
  const [userToDelete, setUserToDelete] = useState<any | null>(null);
  const [selectedActivation, setSelectedActivation] = useState<any | null>(null);
  const [selectedUserClockIns, setSelectedUserClockIns] = useState<any[]>([]);
  const [clockHistoryFilter, setClockHistoryFilter] = useState<'today' | 'week' | 'all'>('all');
  const [newUser, setNewUser] = useState({
    email: '',
    password: '',
    role: 'guest',
    displayName: '',
    campaignId: '',
    username: '',
    employeeId: '',
    gender: '',
    isStakeholder: false,
    age: '',
    predictedPerformance: ''
  });
  const [loading, setLoading] = useState(false);
  const [generatedCreds, setGeneratedCreds] = useState<{ u: string, p: string, username: string, employeeId: string } | null>(null);
  const [showSelfPasswordReset, setShowSelfPasswordReset] = useState(false);
  const [selfPassword, setSelfPassword] = useState('');
  const [selfPasswordConfirm, setSelfPasswordConfirm] = useState('');
  const [showSelfPassword, setShowSelfPassword] = useState(false);
  const [showSelfPasswordConfirm, setShowSelfPasswordConfirm] = useState(false);
  const [selfPasswordError, setSelfPasswordError] = useState('');
  const [selfPasswordLoading, setSelfPasswordLoading] = useState(false);
  const [auditLoading, setAuditLoading] = useState(false);
  const [globalDailyCount, setGlobalDailyCount] = useState(0);
  const [globalTotalCount, setGlobalTotalCount] = useState(0);
  const [globalDailyEarnings, setGlobalDailyEarnings] = useState(0);
  const [globalTotalEarnings, setGlobalTotalEarnings] = useState(0);
  const [dailyLoginCount, setDailyLoginCount] = useState(0);
  const [totalLoginCount, setTotalLoginCount] = useState(0);
  const [dailyClockInCount, setDailyClockInCount] = useState(0);
  const [dailyClockOutCount, setDailyClockOutCount] = useState(0);
  const [latestClockCampaignByUser, setLatestClockCampaignByUser] = useState<Record<string, string>>({});
  const hasRunAdminIdMigration = useRef(false);
  const hasRunPerformanceZoneMigration = useRef(false);

  const [liveReportStats, setLiveReportStats] = useState<Record<string, LiveStaffStat>>({});


  useEffect(() => {
    const todayKey = getSouthAfricaDateKey();
    const dailyRef = doc(db, 'system_metrics', `daily_${todayKey}`);
    const overallRef = doc(db, 'system_metrics', 'overall');

    const unsubDaily = onSnapshot(dailyRef, (snap) => {
      const data = snap.data() || {};
      setGlobalDailyCount(Number(data.activationsCount || 0));
      setGlobalDailyEarnings(Number(data.activationsEarnings || 0));
      setDailyLoginCount(Number(data.loginCount || 0));
      setDailyClockInCount(Number(data.clockInCount || 0));
      setDailyClockOutCount(Number(data.clockOutCount || 0));
    });

    const unsubOverall = onSnapshot(overallRef, (snap) => {
      const data = snap.data() || {};
      setGlobalTotalCount(Number(data.totalActivationsCount || 0));
      setGlobalTotalEarnings(Number(data.totalActivationsEarnings || 0));
      setTotalLoginCount(Number(data.totalLoginCount || 0));
    });

    return () => {
      unsubDaily();
      unsubOverall();
    };
  }, []);

  // Live per-user stats for the Reports tab
  useEffect(() => {
    if (activeTab !== 'reports') return;

    const activationCollections = getAllActivationCollectionNames();
    const todayKey = getSouthAfricaDateKey();

    // Hold latest snapshot docs per collection so we can remerge on any update
    const allDocsByCollection: Record<string, any[]> = {};

    const recompute = () => {
      const allDocs = Object.values(allDocsByCollection).flat();
      const statsMap: Record<string, LiveStaffStat> = {};
      allDocs.forEach((d) => {
        const data = d.data();
        const uid = data.userId as string;
        if (!uid) return;
        if (!statsMap[uid]) {
          statsMap[uid] = { dailyCount: 0, totalAccumulated: 0, cardOnlyCount: 0, cardSimCount: 0, totalEarnings: 0 };
        }
        const s = statsMap[uid];
        s.totalAccumulated += 1;
        s.totalEarnings += getActivationRate(data);
        if (data.activationType === 'card-only') s.cardOnlyCount += 1;
        if (data.activationType === 'card-sim') s.cardSimCount += 1;
        const dateKey = data.submissionDateKey || getSouthAfricaDateKeyFromTimestamp(data.timestamp);
        if (dateKey === todayKey) s.dailyCount += 1;
      });
      setLiveReportStats(statsMap);
    };

    const unsubs = activationCollections.map((collectionName) =>
      onSnapshot(query(collection(db, collectionName)), (snap) => {
        allDocsByCollection[collectionName] = snap.docs;
        recompute();
      })
    );

    return () => unsubs.forEach((unsub) => unsub());
  }, [activeTab]);

  const performStaffAudit = async () => {
    setAuditLoading(true);
    try {
      const staff = users.filter(u => u.role !== 'admin');
      for (const user of staff) {
        const id = user.id || user.uid;
        if (!id) continue;

        const stats = await getStaffPerformanceStats(id);
        
        let zone: 'normal' | 'green' | 'orange' | 'disabled' = 'normal';
        const active = user.isActive !== false;
        
        if (FORCE_NORMAL_PERFORMANCE) {
          zone = 'normal';
        } else {
          // Performance audits should not auto-disable accounts; disabling remains a manual admin action.
          if (stats.misses >= 3) {
            zone = 'orange';
          } else if (stats.misses >= 1) {
            zone = 'green';
          } else {
            zone = 'normal';
          }
        }
        
        await updateDoc(doc(db, 'profiles', id), {
          performanceZone: zone,
          isActive: active,
          dailyCount: stats.dailyCount,
          totalAccumulated: stats.totalCount,
          cardOnlyCount: stats.cardOnlyCount,
          cardSimCount: stats.cardSimCount,
          totalEarnings: stats.totalEarnings,
          lastAudit: serverTimestamp()
        });
      }
      alert("Performance audit completed. System zones and reports metrics updated.");
    } catch (err) {
      console.error("Audit failed:", err);
      alert("Audit process failed. Check console for details.");
    } finally {
      setAuditLoading(false);
    }
  };

  const getStaffPerformanceStats = async (userId: string) => {
    const activationCollections = getAllActivationCollectionNames();
    const today = new Date();
    const todayKey = getSouthAfricaDateKey(today);
    
    // Total
    const totalSnaps = await Promise.all(
      activationCollections.map((collectionName) =>
        getDocs(query(collection(db, collectionName), where('userId', '==', userId)))
      )
    );
    const totalDocs = totalSnaps.flatMap((snap) => snap.docs);
    const totalCount = totalDocs.length;
    const cardOnlyCount = totalDocs.filter(d => {
      const t = d.data().activationType;
      return t === 'card-only' || t === 'account-only';
    }).length;
    const cardSimCount = totalDocs.filter(d => {
      const t = d.data().activationType;
      return t === 'card-sim' || t === 'account-advert';
    }).length;
    const totalEarnings = totalDocs.reduce((sum, d) => sum + getActivationRate(d.data()), 0);
    
    const dayCounts: {[key: string]: number} = {};
    totalDocs.forEach((d) => {
      const data = d.data();
      const dateKey = data.submissionDateKey || getSouthAfricaDateKeyFromTimestamp(data.timestamp);
      if (!dateKey) return;
      dayCounts[dateKey] = (dayCounts[dateKey] || 0) + 1;
    });

    const dailyCount = dayCounts[todayKey] || 0;

    let misses = 0;
    for (let i = 1; i <= AUDIT_WINDOW_DAYS; i++) {
        const checkDay = new Date(today);
        checkDay.setDate(checkDay.getDate() - i);
        const key = getSouthAfricaDateKey(checkDay);
      if ((dayCounts[key] || 0) < MIN_DAILY_TARGET) {
            misses++;
        }
    }
    return { misses, dailyCount, totalCount, cardOnlyCount, cardSimCount, totalEarnings };
  };

  const generatePassword = () => {
    const rawName = (newUser.displayName || '').toLowerCase();
    const baseName = rawName.replace(/[^a-z0-9]/g, '');

    if (!baseName) {
      alert('Enter employee full name first to auto-generate password.');
      return;
    }

    if (newUser.role === 'admin') {
      setNewUser(prev => ({ ...prev, password: `${baseName}@00` }));
      return;
    }

    const sameNameEmployeeCount = users.filter((u) => {
      const existingName = (u.displayName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      return existingName === baseName && u.role !== 'admin';
    }).length;

    const sequence = String(sameNameEmployeeCount + 1).padStart(2, '0');
    const password = `${baseName}@${sequence}`;

    setNewUser(prev => ({ ...prev, password }));
  };

  const normalizeIdentityToken = (value: string) => value.toLowerCase().replace(/[^a-z0-9_-]/g, '');

  const getStructuredFirstName = () => {
    const firstRaw = (newUser.displayName || '').trim().split(/\s+/)[0] || 'Staff';
    const lettersOnly = firstRaw.replace(/[^a-zA-Z]/g, '');
    if (!lettersOnly) return 'Staff';
    return `${lettersOnly.charAt(0).toUpperCase()}${lettersOnly.slice(1).toLowerCase()}`;
  };

  const getGenderDigit = () => {
    if (newUser.gender === 'male') return '8';
    if (newUser.gender === 'female') return '2';
    return '0';
  };

  const getBenchmarkPrediction = () => {
    const age = Number(newUser.age);
    if (!Number.isFinite(age)) return 'high';
    if (age >= 21 && age <= 35) return 'high';
    return 'lower';
  };

  // High performer = 1, Lower performer = 2.
  const getPerformancePredictionDigit = () => {
    const selectedPrediction = newUser.predictedPerformance || getBenchmarkPrediction();
    return selectedPrediction === 'high' ? '1' : '2';
  };

  // Spot = 1, Gumtree = 2
  const getGuestCampaignDigit = () => {
    const id = (newUser.campaignId || '').toLowerCase();
    if (id.includes('spot')) return '1';
    if (id.includes('gumtree')) return '2';
    return '0';
  };

  const buildRepFiveDigitCode = () => {
    const stakeholderDigit = newUser.isStakeholder ? '1' : '0';
    const executiveDigit = '0'; // always 0 for official reps
    const genderDigit = getGenderDigit();
    const campaignAccessDigit = '9'; // universal for official BnA reps
    const performanceDigit = getPerformancePredictionDigit();
    return `${stakeholderDigit}${executiveDigit}${genderDigit}${campaignAccessDigit}${performanceDigit}`;
  };

  const generateStructuredIdentity = () => {
    const firstName = getStructuredFirstName();

    if (newUser.role === 'admin') {
      // Format: admin_<adminName>_<index> starting at 01
      const adminName = normalizeIdentityToken(newUser.displayName).replace(/[_\- ]+/g, '') || 'admin';
      const existingAdminCount = users.filter(
        (u) => u.role === 'admin' && typeof u.employeeId === 'string' && u.employeeId.startsWith(`admin_${adminName}_`)
      ).length;
      const index = String(existingAdminCount + 1).padStart(2, '0');
      const adminId = `admin_${adminName}_${index}`;
      setNewUser(prev => ({ ...prev, username: adminId, employeeId: adminId }));
      return;
    }

    if (newUser.role === 'official') {
      if (!newUser.gender) {
        alert('Select gender first to generate official rep ID correctly.');
        return;
      }
      // Format: rep_<FirstName>_<ABCDE> — 5-digit logic applies only here
      const repCode = buildRepFiveDigitCode();
      const repId = `rep_${firstName}_${repCode}`;
      setNewUser(prev => ({ ...prev, username: repId, employeeId: repId }));
      return;
    }

    // Guest format: <FirstName>_000<campaignDigit><individualNumber>
    // 000 = guest identifier, campaignDigit = 1 (Spot) or 2 (Gumtree)
    // individualNumber = sequential count of all guests across the system
    if (!newUser.campaignId) {
      alert('Select a campaign first to generate guest ID (Spot=1, Gumtree=2).');
      return;
    }
    const campaignDigit = getGuestCampaignDigit();
    if (campaignDigit === '0') {
      alert('Selected campaign is not mapped. Use Spot or Gumtree.');
      return;
    }
    const existingGuestCount = users.filter((u) => u.role === 'guest').length;
    const individualNumber = existingGuestCount + 1;
    const guestId = `${firstName}_000${campaignDigit}${individualNumber}`;
    setNewUser(prev => ({ ...prev, username: guestId, employeeId: guestId }));
  };

  const validateIdentityForRole = (role: string, username: string, employeeId: string) => {
    if (!username || !employeeId) return 'Username and Employee ID are required.';
    if (/\s/.test(username)) return 'Username cannot contain spaces.';
    if (username !== employeeId) return 'Username and Employee ID must match.';

    if (role === 'admin') {
      // Format: admin_<adminName>_<NN>
      if (!/^admin_[a-z0-9]+_\d{2}$/.test(username)) return 'Admin ID must match: admin_<name>_<NN> (e.g. admin_akhona_01).';
      return null;
    }

    if (role === 'official') {
      // Format: rep_<FirstName>_<ABCDE>
      if (!/^rep_[A-Za-z]+_\d{5}$/.test(username)) return 'Official rep ID must match: rep_<FirstName>_<ABCDE> (e.g. rep_Sarah_00291).';
      const codeFromUsername = username.split('_')[2] || '';
      const expectedCode = buildRepFiveDigitCode();
      if (codeFromUsername !== expectedCode) {
        return `Official rep 5-digit code must follow A-B-C-D-E rules. Expected: ${expectedCode}.`;
      }
      return null;
    }

    if (role === 'guest') {
      // Format: <FirstName>_000<campaignDigit><individualNumber>
      if (!/^[A-Za-z]+_000[12]\d+$/.test(username)) return 'Guest ID must match: <FirstName>_000<campaignDigit><number> (e.g. Sisanda_00011).';
      return null;
    }

    return 'Unsupported role for identity validation.';
  };

  const sendCredentialsToEmployeeEmail = (creds: { u: string, p: string, username: string, employeeId: string }) => {
    const loginUrl = `${window.location.origin}/login`;
    const subject = 'BNA System Login Credentials';
    const body = [
      'Hello,',
      '',
      'Your BNA account has been provisioned.',
      '',
      `Login URL: ${loginUrl}`,
      `Login ID (Employee ID): ${creds.employeeId}`,
      `Password: ${creds.p}`,
      '',
      'Internal auth email (system use):',
      `${creds.u}`,
      '',
      `Username: ${creds.username}`,
      `Employee ID: ${creds.employeeId}`,
      '',
      'Please log in using Employee ID and Password only.',
      'Do not share these credentials with unauthorized users.'
    ].join('\n');

    const mailtoUrl = `mailto:${encodeURIComponent(creds.u)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailtoUrl;
  };

  const toggleUserStatus = async (targetUser: any) => {
    const userId = targetUser.id || targetUser.uid;
    if (!userId) return;

    try {
      await updateDoc(doc(db, 'profiles', userId), {
        isActive: !targetUser.isActive,
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      console.error('Failed to toggle status:', err);
      alert('Failed to update status. Check your permissions and try again.');
    }
  };

  const changeUserRole = async (targetUser: any, nextRole: 'admin' | 'official' | 'guest') => {
    const userId = targetUser.id || targetUser.uid;
    if (!userId) return;

    try {
      await updateDoc(doc(db, 'profiles', userId), {
        role: nextRole,
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      console.error('Failed to update role:', err);
      alert('Failed to update role. Check your permissions and try again.');
    }
  };

  const executeDeleteUser = async () => {
    if (!userToDelete) return;
    const { id, displayName: name } = userToDelete;
    
    console.log("EXECUTE_DELETE started for:", { id, name });
    console.log("Current admin info:", profile);

    setLoading(true);
    try {
      const userRef = doc(db, 'profiles', id);
      console.log("Calling deleteDoc for path: profiles/" + id);
      await deleteDoc(userRef);
      console.log("DeleteDoc SUCCESS for:", id);
      setUserToDelete(null);
    } catch (err: any) {
      console.error("DeleteDoc FAILED:", err);
      let msg = "Failed to delete user.";
      if (err.code === 'permission-denied' || err.message?.includes('permissions')) {
        msg = "Permission Denied: You don't have permission to delete this record. Your 'admin' role might not be synchronized yet.";
      }
      alert(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleAdminSelfPasswordReset = async () => {
    setSelfPasswordError('');

    if (selfPassword.length < 8) {
      setSelfPasswordError('Password must be at least 8 characters.');
      return;
    }

    if (selfPassword !== selfPasswordConfirm) {
      setSelfPasswordError('Passwords do not match.');
      return;
    }

    if (!auth.currentUser || !profile?.uid) {
      setSelfPasswordError('Session expired. Please sign in again.');
      return;
    }

    setSelfPasswordLoading(true);
    try {
      await updatePassword(auth.currentUser, selfPassword);
      await updateDoc(doc(db, 'profiles', profile.uid), {
        forcePasswordResetRequired: false,
        passwordSetupPending: false,
        passwordMode: 'custom',
        passwordUpdatedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      setShowSelfPasswordReset(false);
      setSelfPassword('');
      setSelfPasswordConfirm('');
      alert('Your admin password has been updated successfully.');
    } catch (err: any) {
      console.error('Admin password reset failed:', err);
      if (err?.code === 'auth/requires-recent-login') {
        setSelfPasswordError('For security, please sign in again and retry.');
      } else {
        setSelfPasswordError('Failed to update password. Please try again.');
      }
    } finally {
      setSelfPasswordLoading(false);
    }
  };

  const handleDeleteUser = (id: string, name: string) => {
    console.log("INIT_DELETE triggered for:", { id, name });
    if (!profile || profile.role !== 'admin') {
      console.warn("Delete aborted: User is not admin or profile is missing", profile);
      alert("Error: You are not recognized as an Admin in the database.");
      return;
    }
    setUserToDelete({ id, displayName: name });
  };

  useEffect(() => {
    if (hasRunAdminIdMigration.current) return;
    if (!profile || profile.role !== 'admin') return;
    if (users.length === 0) return;

    hasRunAdminIdMigration.current = true;

    const migrate = async () => {
      try {
        const adminUsers = users.filter((u) => u.role === 'admin' && (u.id || u.uid));
        const byNameCounters: Record<string, number> = {};
        const sortedAdmins = [...adminUsers].sort((a, b) => {
          const aTime = a.createdAt?.seconds ?? 0;
          const bTime = b.createdAt?.seconds ?? 0;
          return aTime - bTime;
        });

        let updatedCount = 0;
        for (const adminUser of sortedAdmins) {
          const docId = adminUser.id || adminUser.uid;
          if (!docId) continue;

          const rawName = String(adminUser.displayName || 'admin');
          const baseName = normalizeIdentityToken(rawName).replace(/[_-]+/g, '') || 'admin';
          byNameCounters[baseName] = (byNameCounters[baseName] || 0) + 1;
          const index = String(byNameCounters[baseName]).padStart(2, '0');
          const newAdminId = `admin_${baseName}_${index}`;

          const currentUsername = String(adminUser.username || '');
          const currentEmployeeId = String(adminUser.employeeId || '');
          if (currentUsername === newAdminId && currentEmployeeId === newAdminId) continue;

          await updateDoc(doc(db, 'profiles', docId), {
            username: newAdminId,
            employeeId: newAdminId,
            updatedAt: serverTimestamp()
          });
          updatedCount += 1;
        }

        if (updatedCount > 0) {
          alert(`Admin ID format updated for ${updatedCount} existing profile(s).`);
        }
      } catch (err) {
        console.error('Admin ID migration failed:', err);
      }
    };

    migrate();
  }, [users, profile]);

  useEffect(() => {
    if (hasRunPerformanceZoneMigration.current) return;
    if (!profile || profile.role !== 'admin') return;
    if (users.length === 0) return;

    hasRunPerformanceZoneMigration.current = true;

    const migrateLegacyPerformanceZones = async () => {
      try {
        const staleUsers = users.filter((u) => {
          if (u.role === 'admin') return false;
          if (!(u.id || u.uid)) return false;
          if (FORCE_NORMAL_PERFORMANCE) return u.performanceZone !== 'normal';
          return u.isActive !== false && u.performanceZone === 'disabled';
        });

        if (staleUsers.length === 0) return;

        await Promise.all(
          staleUsers.map((u) => {
            const userId = u.id || u.uid;
            return updateDoc(doc(db, 'profiles', userId), {
              performanceZone: FORCE_NORMAL_PERFORMANCE ? 'normal' : 'orange',
              updatedAt: serverTimestamp()
            });
          })
        );
      } catch (err) {
        console.error('Legacy performance zone migration failed:', err);
      }
    };

    migrateLegacyPerformanceZones();
  }, [users, profile]);

  useEffect(() => {
    const unsubClockIns = onSnapshot(
      query(collection(db, 'clock-ins'), orderBy('timestamp', 'desc'), limit(1000)),
      (snap) => {
        const byUser: Record<string, string> = {};
        snap.docs.forEach((clockDoc) => {
          const data = clockDoc.data() as any;
          const uid = (data.userId || '').toString();
          const campaignId = (data.campaignId || '').toString();
          if (!uid || !campaignId) return;
          if (!byUser[uid]) byUser[uid] = campaignId;
        });
        setLatestClockCampaignByUser(byUser);
      }
    );

    const activationCollections = getAllActivationCollectionNames();
    const activationBatches: Record<string, any[]> = {};

    const activationUnsubs = activationCollections.map((collectionName) =>
      onSnapshot(
        query(collection(db, collectionName), orderBy('timestamp', 'desc'), limit(10)),
        (snap) => {
          activationBatches[collectionName] = snap.docs.map((activationDoc) => ({
            id: `${collectionName}:${activationDoc.id}`,
            ...activationDoc.data()
          }));

          const merged = Object.values(activationBatches)
            .flat()
            .sort((a, b) => {
              const aTime = a.timestamp?.toDate ? a.timestamp.toDate().getTime() : 0;
              const bTime = b.timestamp?.toDate ? b.timestamp.toDate().getTime() : 0;
              return bTime - aTime;
            })
            .slice(0, 10);

          setActivations(merged);
        }
      )
    );

    const unsubUsers = onSnapshot(collection(db, 'profiles'), (snap) => {
      setUsers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubCampaigns = onSnapshot(collection(db, 'campaigns'), (snap) => {
      setCampaigns(
        snap.docs.map((campaignDoc) => {
          const campaign = { id: campaignDoc.id, ...campaignDoc.data() };
          return {
            ...campaign,
            status: normalizeCampaignStatus(campaign)
          };
        })
      );
    });

    return () => {
      unsubClockIns();
      activationUnsubs.forEach((unsub) => unsub());
      unsubUsers();
      unsubCampaigns();
    };
  }, []);

  const getEffectiveUserCampaignId = (user: any) => {
    const uid = (user.id || user.uid || '').toString();
    if (uid && latestClockCampaignByUser[uid]) return latestClockCampaignByUser[uid];
    return user.campaignId || null;
  };

  useEffect(() => {
    if (selectedUser) {
      const q = query(
        collection(db, 'documents'),
        where('userId', '==', selectedUser.uid || selectedUser.id)
      );
      const unsub = onSnapshot(q, (snap) => {
        setSelectedUserDocs(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      });
      return () => unsub();
    } else {
      setSelectedUserDocs([]);
    }
  }, [selectedUser]);

  useEffect(() => {
    if (!selectedUser) {
      setSelectedUserClockIns([]);
      return;
    }

    const uid = selectedUser.uid || selectedUser.id;
    const q = query(
      collection(db, 'clock-ins'),
      where('userId', '==', uid),
      orderBy('timestamp', 'desc'),
      limit(30)
    );

    const unsub = onSnapshot(q, (snap) => {
      setSelectedUserClockIns(snap.docs.map((clockDoc) => ({ id: clockDoc.id, ...clockDoc.data() })));
    });

    return () => unsub();
  }, [selectedUser]);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedUsername = newUser.username.trim();
    const normalizedEmployeeId = newUser.employeeId.trim();
    const normalizedEmail = newUser.email.trim().toLowerCase();
    if (!normalizedEmail || !/^[^@]+@[^@]+\.[^@]+$/.test(normalizedEmail)) {
      alert('Please enter a valid email address for the employee.');
      return;
    }

    if (newUser.role === 'guest' && !newUser.campaignId) {
      alert('Please select a campaign for guest staff.');
      return;
    }

    if (!newUser.gender) {
      alert('Please select employee gender before provisioning.');
      return;
    }

    const identityError = validateIdentityForRole(newUser.role, normalizedUsername, normalizedEmployeeId);
    if (identityError) {
      alert(identityError);
      return;
    }
    
    setLoading(true);
    try {
      const [usernameSnap, employeeIdSnap] = await Promise.all([
        getDocs(query(collection(db, 'profiles'), where('username', '==', normalizedUsername))),
        getDocs(query(collection(db, 'profiles'), where('employeeId', '==', normalizedEmployeeId)))
      ]);

      if (!usernameSnap.empty) {
        alert('This username already exists. Use a different username.');
        setLoading(false);
        return;
      }

      if (!employeeIdSnap.empty) {
        alert('This employee ID already exists. Use a different employee ID.');
        setLoading(false);
        return;
      }

      // Create Firebase Auth user
      console.log("Creating Firebase Auth user for:", normalizedEmail);
      const userCredential = await createUserWithEmailAndPassword(auth, normalizedEmail, newUser.password);
      const uid = userCredential.user.uid;
      
      // Create Firestore profile with matching UID
      console.log("Creating Firestore profile for UID:", uid);
      await setDoc(doc(db, 'profiles', uid), {
        uid: uid,
        email: normalizedEmail,
        displayName: newUser.displayName.trim(),
        username: normalizedUsername,
        employeeId: normalizedEmployeeId,
        role: newUser.role,
        forcePasswordResetRequired: newUser.role === 'admin' || newUser.role === 'official',
        passwordSetupPending: newUser.role === 'guest',
        passwordMode: 'generated',
        campaignId: newUser.campaignId,
        gender: newUser.gender,
        isStakeholder: newUser.isStakeholder,
        age: Number(newUser.age) || null,
        predictedPerformance: newUser.predictedPerformance,
        performancePrediction: getPerformancePredictionDigit(),
        isActive: true,
        createdAt: serverTimestamp()
      });
      
      const creds = { u: normalizedEmail, p: newUser.password, username: normalizedUsername, employeeId: normalizedEmployeeId };
      setGeneratedCreds(creds);
      setNewUser({
        email: '',
        password: '',
        role: 'guest',
        displayName: '',
        campaignId: '',
        username: '',
        employeeId: '',
        gender: '',
        isStakeholder: false,
        age: '',
        predictedPerformance: ''
      });

      if (window.confirm('Employee account created. Send credentials to the employee email now?')) {
        sendCredentialsToEmployeeEmail(creds);
      }

      alert(`✅ Employee account created successfully!\n\nLogin ID: ${normalizedEmployeeId}\nPassword: ${newUser.password}\n\nShare these credentials with the employee.`);
    } catch (err: any) {
      console.error("Error adding user:", err);
      let message = "Failed to create account.";
      if (err.code === 'auth/email-already-in-use') {
        message = "This email is already registered. Use a different email address.";
      } else if (err.code === 'auth/weak-password') {
        message = "Password is too weak. Use at least 6 characters.";
      } else if (err.code === 'permission-denied') {
        message = "Permission denied. Check Firestore rules.";
      }
      alert(message);
    } finally {
      setLoading(false);
    }
  };

  const getFilteredClockHistory = () => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfWeekWindow = startOfToday - (6 * 24 * 60 * 60 * 1000);

    return selectedUserClockIns.filter((entry) => {
      const entryMs = entry.timestamp?.toDate ? entry.timestamp.toDate().getTime() : 0;
      if (!entryMs) return false;
      if (clockHistoryFilter === 'today') return entryMs >= startOfToday;
      if (clockHistoryFilter === 'week') return entryMs >= startOfWeekWindow;
      return true;
    });
  };

  const exportSelectedUserAttendanceCsv = () => {
    if (!selectedUser) return;

    const filteredEntries = getFilteredClockHistory();
    if (filteredEntries.length === 0) {
      alert('No attendance records available for the selected filter.');
      return;
    }

    const rows = filteredEntries.map((entry) => [
      selectedUser.displayName || 'Unknown',
      selectedUser.employeeId || selectedUser.uid || selectedUser.id || '',
      (entry.type || '').toString().toUpperCase(),
      entry.location || '',
      entry.campaignId || '',
      entry.timestamp?.toDate ? entry.timestamp.toDate().toISOString() : ''
    ]);

    const csv = [
      ['Employee Name', 'Employee ID', 'Type', 'Location', 'Campaign ID', 'Timestamp (ISO)'],
      ...rows
    ].map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('hidden', '');
    a.setAttribute('href', url);
    a.setAttribute('download', `attendance_${selectedUser.employeeId || selectedUser.id || 'user'}_${clockHistoryFilter}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const filteredClockHistory = getFilteredClockHistory();

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
              <button 
                onClick={() => setActiveTab('dashboard')}
                className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
              >
                <BarChart3 size={18} /> Dashboard
              </button>
              <button 
                onClick={() => setActiveTab('campaigns')}
                className={`nav-item ${activeTab === 'campaigns' ? 'active' : ''}`}
              >
                <Briefcase size={18} /> Campaigns
              </button>
              <button 
                onClick={() => setActiveTab('reports')}
                className={`nav-item ${activeTab === 'reports' ? 'active' : ''}`}
              >
                <AlertCircle size={18} /> Reports
              </button>
            </div>
          </div>

          <div className="nav-group">
            <div className="text-[10px] uppercase text-text-s tracking-widest mb-3">Management</div>
            <div className="flex flex-col">
              <button 
                onClick={() => setActiveTab('employees')}
                className={`nav-item ${activeTab === 'employees' ? 'active' : ''}`}
              >
                <Users size={18} /> Employees
              </button>
              <button 
                onClick={() => setActiveTab('logistics')}
                className={`nav-item ${activeTab === 'logistics' ? 'active' : ''}`}
              >
                <Plus size={18} /> Logistics
              </button>
            </div>
          </div>
          
          <button 
              onClick={async () => {
                navigate('/', { replace: true });
                try {
                  await signOut(auth);
                } catch (err) {
                  console.error('Sign out failed:', err);
                }
              }}
            className="flex items-center gap-3 py-2 text-red-500/60 hover:text-red-500 transition-colors text-sm font-medium mt-4"
          >
            <LogOut size={18} /> Logout
          </button>
        </nav>

        <div className="mt-auto pt-4 border-t border-border/30 text-[11px] text-text-s">
          v2.4.0 (Stable)
        </div>
      </aside>

      {/* Main Panel */}
      <main className="flex-1 overflow-y-auto bg-bg p-6 flex flex-col gap-6">
        <header className="flex items-center justify-between pb-4 border-b border-border">
          <div className="campaign-info">
            <h1 className="text-[22px] font-bold">Administrative Overview</h1>
            <p className="text-text-s text-xs mt-1">Real-time metrics for all campaigns across KZN.</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3 bg-card px-3 py-1.5 rounded-full border border-border">
              <div className="text-right">
                <p className="text-[13px] font-semibold leading-tight">Admin Console</p>
                <p className="text-[11px] text-text-s leading-tight text-right">{profile?.displayName || 'Admin'}</p>
              </div>
              <span className="role-tag">ADMIN</span>
            </div>
            <button 
              onClick={() => setShowAddUser(true)}
              className="bna-input w-auto h-auto py-1.5 px-3 flex items-center gap-2"
            >
              <UserPlus size={16} /> Add Employee
            </button>
            <button
              onClick={() => setShowSelfPasswordReset(true)}
              className="bna-input w-auto h-auto py-1.5 px-3 flex items-center gap-2"
            >
              <Shield size={16} /> Reset My Password
            </button>
            <button 
              onClick={performStaffAudit}
              disabled={auditLoading || users.length === 0}
              className="bna-button py-1.5 h-auto flex items-center gap-2"
            >
              {auditLoading ? <Loader2 className="animate-spin" size={16} /> : <TrendingUp size={16} />}
              Run Performance Audit
            </button>
            <button className="bna-button py-1.5 h-auto flex items-center gap-2">
              <Download size={16} /> Export
            </button>
          </div>
        </header>

        {activeTab === 'dashboard' && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
              {[
                { label: 'Total Activations', val: globalTotalCount, change: 'Historical', icon: BarChart3 },
                { label: 'Active Staff', val: users.filter(u => u.isActive !== false).length, change: 'Live', icon: Users },
                { label: 'Daily Target (All)', val: globalDailyCount, change: 'Today', icon: Shield },
                { label: 'Daily Rate Total', val: `R${globalDailyEarnings.toFixed(2)}`, change: 'Today', icon: Briefcase },
                { label: 'Total Rate Total', val: `R${globalTotalEarnings.toFixed(2)}`, change: 'Aggregate', icon: TrendingUp }
              ].map((stat, i) => (
                <motion.div 
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="bna-card p-4"
                >
                  <div className="text-accent font-bold text-2xl mb-1">{stat.val}</div>
                  <div className="text-text-s text-xs">{stat.label}</div>
                </motion.div>
              ))}
            </div>

            {/* Charts & Content Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
              <div className="lg:col-span-2 bna-card flex flex-col overflow-hidden">
                <div className="section-title">
                  Recent Activations 
                  <span className="text-[11px] font-normal text-accent">Real-time Feed</span>
                </div>
                <div className="overflow-x-auto flex-1">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-white/[0.02] text-text-s uppercase text-[10px] tracking-wider">
                      <tr>
                        <th className="px-4 py-3 font-medium">Customer Name</th>
                        <th className="px-4 py-3 font-medium">Type</th>
                        <th className="px-4 py-3 font-medium">Rate</th>
                        <th className="px-4 py-3 font-medium">Employee</th>
                        <th className="px-4 py-3 font-medium">Photos</th>
                        <th className="px-4 py-3 font-medium text-right">Time</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {activations.map((act, i) => (
                        <tr key={i} className="hover:bg-white/[0.01] transition-colors">
                          <td className="px-4 py-3 font-medium">{act.firstName} {act.surname}</td>
                          <td className="px-4 py-3">
                            <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wide ${
                              act.activationType === 'card-sim' ? 'bg-purple-500/10 text-purple-400' : 'bg-accent/10 text-accent'
                            }`}>
                              {act.activationType === 'card-sim' ? 'Card + SIM' : 'Card Only'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-accent font-bold font-mono">R{act.rate ?? (act.activationType === 'card-sim' ? 110 : 100)}.00</td>
                          <td className="px-4 py-3">{act.userName || 'K. Molefe'}</td>
                          <td className="px-4 py-3">
                            {act.prizePhoto || act.summaryPhoto ? (
                              <button
                                onClick={() => setSelectedActivation(act)}
                                className="text-[10px] px-2 py-1 rounded bg-accent/10 text-accent hover:bg-accent/20 font-bold uppercase tracking-wide"
                              >
                                View
                              </button>
                            ) : (
                              <span className="text-[10px] text-text-s">N/A</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right text-accent/80">{act.timestamp?.toDate ? act.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Pending'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex flex-col gap-4">
                <div className="bna-card p-5 flex-1 text-center flex flex-col items-center justify-center border-dashed">
                  <div className="w-12 h-12 bg-accent/10 rounded-full flex items-center justify-center text-accent mb-4">
                    <Plus size={24} />
                  </div>
                  <h3 className="text-sm font-bold mb-1">New Site Launch</h3>
                  <p className="text-text-s text-[10px] uppercase tracking-widest leading-relaxed">System ready for additional<br/>campaign nodes.</p>
                </div>
              </div>
            </div>
          </>
        )}

        {activeTab === 'employees' && (
          <div className="bna-card flex-1 flex flex-col overflow-hidden">
            <div className="section-title flex justify-between items-center pr-4">
              <div>
                Employee Database
                <span className="text-[11px] font-normal text-text-s ml-2">Total: {users.length} Records</span>
              </div>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-s" />
                <input 
                  type="text" 
                  placeholder="Search by name or email..." 
                  className="bna-input pl-10 h-9 w-[300px] text-xs"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-left text-xs">
                <thead className="bg-white/[0.02] text-text-s uppercase text-[10px] tracking-wider sticky top-0 z-10">
                  <tr>
                    <th className="px-6 py-4 font-medium">Full Name</th>
                    <th className="px-6 py-4 font-medium">Email / Username</th>
                    <th className="px-6 py-4 font-medium">Role</th>
                    <th className="px-6 py-4 font-medium">Password Security</th>
                    <th className="px-6 py-4 font-medium">Set Role</th>
                    <th className="px-6 py-4 font-medium">Performance</th>
                    <th className="px-6 py-4 font-medium">Status</th>
                    <th className="px-6 py-4 font-medium">Status Control</th>
                    <th className="px-6 py-4 font-medium">Joined</th>
                    <th className="px-6 py-4 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {users
                    .filter(u => 
                      u.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                      u.email?.toLowerCase().includes(searchTerm.toLowerCase())
                    )
                    .map((u, i) => {
                      const passwordStatus = getPasswordStatusMeta(u);
                      const effectiveZone = getEffectivePerformanceZone(u);
                      const updatedAt = u.passwordUpdatedAt?.toDate
                        ? u.passwordUpdatedAt.toDate().toLocaleDateString()
                        : 'Not updated';
                      return (
                    <tr key={i} className="hover:bg-white/[0.01] transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center text-accent font-bold">
                            {u.displayName?.charAt(0) || 'U'}
                          </div>
                          <span className="font-bold">{u.displayName || 'Unnamed'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-text-s">{u.email}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          u.role === 'admin' ? 'bg-red-500/10 text-red-500' : 
                          u.role === 'official' ? 'bg-accent/10 text-accent' : 
                          'bg-blue-500/10 text-blue-500'
                        }`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1">
                          <span className={`w-fit px-2 py-0.5 rounded border text-[10px] font-bold uppercase tracking-wide ${passwordStatus.className}`}>
                            {passwordStatus.label}
                          </span>
                          <span className="text-[10px] text-text-s">{passwordStatus.detail}</span>
                          <span className="text-[9px] uppercase tracking-wider text-text-s/80">Updated: {updatedAt}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <select
                          className="bna-input bna-select h-8 text-[11px]"
                          value={u.role || 'guest'}
                          onChange={e => changeUserRole(u, e.target.value as 'admin' | 'official' | 'guest')}
                        >
                          <option value="admin">Admin</option>
                          <option value="official">Official</option>
                          <option value="guest">Guest</option>
                        </select>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${
                            effectiveZone === 'disabled' ? 'bg-red-500 shadow-[0_0_5px_red]' :
                            effectiveZone === 'orange' ? 'bg-orange-500 shadow-[0_0_5px_orange]' :
                            effectiveZone === 'green' ? 'bg-green-500 shadow-[0_0_5px_green]' :
                            'bg-accent'
                          }`} />
                          <span className={`text-[10px] font-bold uppercase tracking-wider ${
                            effectiveZone === 'disabled' ? 'text-red-500' :
                            effectiveZone === 'orange' ? 'text-orange-500' :
                            effectiveZone === 'green' ? 'text-green-500' :
                            'text-accent'
                          }`}>
                            {effectiveZone}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className={`w-1.5 h-1.5 rounded-full ${u.isActive ? 'bg-accent' : 'bg-red-500'}`} />
                          <span className={u.isActive ? 'text-accent' : 'text-red-500'}>
                            {u.isActive ? 'Active' : 'Disabled'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => toggleUserStatus(u)}
                          className={`text-[10px] px-3 py-1 rounded font-bold uppercase tracking-widest ${u.isActive ? 'bg-red-500/10 text-red-500 hover:bg-red-500/20' : 'bg-accent/10 text-accent hover:bg-accent/20'}`}
                        >
                          {u.isActive ? 'Disable' : 'Enable'}
                        </button>
                      </td>
                      <td className="px-6 py-4 text-text-s">
                        {u.createdAt?.toDate ? u.createdAt.toDate().toLocaleDateString() : 'N/A'}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2 text-text-s">
                          <button onClick={() => setSelectedUser(u)} className="p-2 hover:text-accent transition-colors"><Eye size={16} /></button>
                          <button onClick={() => handleDeleteUser(u.id, u.displayName)} className="p-2 hover:text-red-500 transition-colors"><Trash2 size={16} /></button>
                        </div>
                      </td>
                    </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'reports' && (
          <div className="flex-1 flex flex-col gap-6 overflow-hidden">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
              <div className="bna-card p-6 border-l-4 border-l-accent">
                <p className="text-[10px] uppercase text-text-s font-bold tracking-widest mb-2">Audit Window</p>
                <div className="text-2xl font-black uppercase tracking-tighter">Last 24 Hours</div>
                <p className="text-[10px] text-text-s mt-1 uppercase">Performance Snapshot</p>
              </div>
              <div className="bna-card p-6 border-l-4 border-l-blue-500">
                <p className="text-[10px] uppercase text-text-s font-bold tracking-widest mb-2">Daily Logins</p>
                <div className="text-2xl font-black uppercase tracking-tighter">{dailyLoginCount}</div>
                <p className="text-[10px] text-text-s mt-1 uppercase">Today Auth Successes</p>
              </div>
              <div className="bna-card p-6 border-l-4 border-l-indigo-500">
                <p className="text-[10px] uppercase text-text-s font-bold tracking-widest mb-2">Total Logins</p>
                <div className="text-2xl font-black uppercase tracking-tighter">{totalLoginCount}</div>
                <p className="text-[10px] text-text-s mt-1 uppercase">All-Time Auth Events</p>
              </div>
              <div className="bna-card p-6 border-l-4 border-l-green-500">
                <p className="text-[10px] uppercase text-text-s font-bold tracking-widest mb-2">Top Performer</p>
                <div className="text-2xl font-black uppercase tracking-tighter truncate">
                  {[...users].sort((a, b) => (b.dailyCount || 0) - (a.dailyCount || 0))[0]?.displayName || 'System Idle'}
                </div>
                <p className="text-[10px] text-text-s mt-1 uppercase">Highest Daily Volume</p>
              </div>
              <div className="bna-card p-6 border-l-4 border-l-red-500">
                <p className="text-[10px] uppercase text-text-s font-bold tracking-widest mb-2">At-Risk Accounts</p>
                <div className="text-2xl font-black uppercase tracking-tighter">
                  {users.filter(u => {
                    const zone = getEffectivePerformanceZone(u);
                    return zone === 'orange' || zone === 'disabled';
                  }).length}
                </div>
                <p className="text-[10px] text-text-s mt-1 uppercase">Below Threshold Balance</p>
              </div>
            </div>

            <div className="bna-card flex-1 flex flex-col overflow-hidden">
              <div className="section-title flex justify-between items-center pr-4">
                <div>
                  Collective Performance Summary
                  <span className="text-[11px] font-normal text-text-s ml-2 italic font-serif">Staff Integrity Audit</span>
                </div>
                <button 
                  onClick={() => {
                    const csv = [
                      ['SYSTEM DAILY', '', '', '', '', '', '', '', ''],
                      ['Date', 'Daily Activations', 'Daily Logins', 'Daily Clock-ins', 'Daily Clock-outs', 'Daily Earnings (ZAR)', '', '', ''],
                      [getSouthAfricaDateKey(), globalDailyCount, dailyLoginCount, dailyClockInCount, dailyClockOutCount, globalDailyEarnings.toFixed(2), '', '', ''],
                      ['SYSTEM ACCUMULATING', '', '', '', '', '', '', '', ''],
                      ['Total Activations', 'Total Logins', 'Total Earnings (ZAR)', '', '', '', '', '', ''],
                      [globalTotalCount, totalLoginCount, globalTotalEarnings.toFixed(2), '', '', '', '', '', ''],
                      ['', '', '', '', '', '', '', '', ''],
                      ['Employee Name', 'Email', 'Role', 'Zone', 'Daily Count', 'Card Only', 'Card+SIM', 'Total Earnings (ZAR)', 'Status'],
                      ...users.map(u => {
                        const uid = u.id || u.uid;
                        const ls: LiveStaffStat = liveReportStats[uid] || { dailyCount: 0, totalAccumulated: 0, cardOnlyCount: 0, cardSimCount: 0, totalEarnings: 0 };
                        const zone = getEffectivePerformanceZone(u);
                        return [
                          u.displayName, u.email, u.role, zone,
                          ls.dailyCount ?? 0, ls.cardOnlyCount ?? 0, ls.cardSimCount ?? 0,
                          (ls.totalEarnings ?? 0).toFixed(2), u.isActive ? 'Active' : 'Disabled'
                        ];
                      })
                    ].map(e => e.join(",")).join("\n");
                    const blob = new Blob([csv], { type: 'text/csv' });
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.setAttribute('hidden', '');
                    a.setAttribute('href', url);
                    a.setAttribute('download', `bna_report_${new Date().toISOString().split('T')[0]}.csv`);
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                  }}
                  className="text-[10px] bg-accent/10 text-accent px-3 py-1.5 rounded font-black uppercase tracking-widest hover:bg-accent hover:text-white transition-all flex items-center gap-2"
                >
                  <Download size={14} /> Generate CSV Audit
                </button>
              </div>
              <div className="overflow-x-auto flex-1">
                <table className="w-full text-left text-xs">
                  <thead className="bg-white/[0.02] text-text-s uppercase text-[10px] tracking-wider sticky top-0 z-10">
                    <tr>
                      <th className="px-6 py-4 font-serif italic low-case opacity-60">staff.identity</th>
                      <th className="px-6 py-4 font-serif italic low-case opacity-60">metrics.daily</th>
                      <th className="px-6 py-4 font-serif italic low-case opacity-60">metrics.accumulated</th>
                      <th className="px-6 py-4 font-serif italic low-case opacity-60">card.only</th>
                      <th className="px-6 py-4 font-serif italic low-case opacity-60">card.sim</th>
                      <th className="px-6 py-4 font-serif italic low-case opacity-60">earnings.total</th>
                      <th className="px-6 py-4 font-serif italic low-case opacity-60">threshold.zone</th>
                      <th className="px-6 py-4 font-serif italic low-case opacity-60">system.status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {users.map((u, i) => {
                      const uid = u.id || u.uid;
                      const zone = getEffectivePerformanceZone(u);
                      const ls: LiveStaffStat = liveReportStats[uid] ?? { dailyCount: 0, totalAccumulated: 0, cardOnlyCount: 0, cardSimCount: 0, totalEarnings: 0 };
                      return (
                      <tr key={i} className="hover:bg-white/[0.05] transition-all group">
                        <td className="px-6 py-4 font-mono uppercase tracking-tighter">
                          <div className="flex flex-col">
                            <span className="text-white font-bold group-hover:text-accent transition-colors">{u.displayName}</span>
                            <span className="text-[9px] opacity-40">{u.email}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 font-mono text-base">{ls.dailyCount}</td>
                        <td className="px-6 py-4 font-mono text-base text-text-s">{ls.totalAccumulated}</td>
                        <td className="px-6 py-4 font-mono text-base text-accent">{ls.cardOnlyCount}</td>
                        <td className="px-6 py-4 font-mono text-base text-purple-400">{ls.cardSimCount}</td>
                        <td className="px-6 py-4 font-mono text-base text-green-400 font-bold">R{ls.totalEarnings.toFixed(2)}</td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-0.5 rounded-[2px] font-mono text-[10px] border ${
                            zone === 'disabled' ? 'border-red-500 text-red-500 bg-red-500/10' :
                            zone === 'orange' ? 'border-orange-500 text-orange-500 bg-orange-500/10' :
                            zone === 'green' ? 'border-green-500 text-green-500 bg-green-500/10' :
                            'border-accent text-accent bg-accent/10'
                          }`}>
                            {zone}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                             <div className={`w-1 h-1 rounded-full ${u.isActive ? 'bg-accent shadow-[0_0_8px_#00A8A8]' : 'bg-red-500 shadow-[0_0_8px_red]'}`} />
                             <span className="font-mono text-[10px] opacity-60 uppercase">{u.isActive ? 'Operation: Active' : 'Operation: Halted'}</span>
                          </div>
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'campaigns' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 bna-card flex flex-col">
              <div className="section-title">Active Campaign Nodes</div>
              <div className="overflow-x-auto flex-1">
                <table className="w-full text-left text-xs">
                  <thead className="bg-white/[0.02] text-text-s uppercase text-[10px] tracking-wider">
                    <tr>
                      <th className="px-6 py-4 font-medium">Brand</th>
                      <th className="px-6 py-4 font-medium">Status</th>
                      <th className="px-6 py-4 font-medium">Color</th>
                      <th className="px-6 py-4 font-medium text-right">Manage</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {campaigns.map((c, i) => {
                      const campaignLogo = CAMPAIGN_LOGO_FALLBACKS[c.id] || c.logo;
                      return (
                      <tr key={i} className="hover:bg-white/[0.01] transition-colors">
                        <td className="px-6 py-4 font-bold flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg border border-white/10 bg-white/[0.03] flex items-center justify-center flex-shrink-0 p-1.5">
                            {campaignLogo
                              ? <img src={campaignLogo} alt={c.name} className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                              : <Briefcase size={18} className="text-text-s" />
                            }
                          </div>
                          {c.name}
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-accent text-[10px] uppercase font-bold tracking-widest">{c.status}</span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="w-4 h-4 rounded" style={{ backgroundColor: c.color }} />
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button className="text-text-s hover:text-white transition-colors">Configure</button>
                        </td>
                      </tr>
                      );
                    })}
                    {campaigns.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-6 py-12 text-center text-text-s italic text-xs">
                          No campaigns initialized. Use the Selector page to seed default nodes.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bna-card p-6 flex flex-col items-center justify-center text-center opacity-50 cursor-not-allowed">
              <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center text-text-s mb-4">
                <Plus size={20} />
              </div>
              <h3 className="font-bold mb-2">Initialize Node</h3>
              <p className="text-[10px] text-text-s uppercase tracking-widest leading-relaxed">Campaign creation is restricted<br/>to master config.</p>
            </div>
          </div>
        )}

        {activeTab === 'logistics' && (
          <div className="flex-1 flex flex-col gap-6 overflow-hidden">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bna-card p-4">
                <p className="text-[10px] uppercase tracking-widest text-text-s">Live Campaigns</p>
                <p className="text-2xl font-bold text-accent mt-1">{campaigns.filter(c => c.status === 'active').length}</p>
              </div>
              <div className="bna-card p-4">
                <p className="text-[10px] uppercase tracking-widest text-text-s">Officials Assigned</p>
                <p className="text-2xl font-bold text-accent mt-1">{users.filter(u => u.role === 'official' && u.isActive !== false).length}</p>
              </div>
              <div className="bna-card p-4">
                <p className="text-[10px] uppercase tracking-widest text-text-s">Guests Assigned</p>
                <p className="text-2xl font-bold text-accent mt-1">{users.filter(u => u.role === 'guest' && u.isActive !== false).length}</p>
              </div>
              <div className="bna-card p-4">
                <p className="text-[10px] uppercase tracking-widest text-text-s">Disabled Staff</p>
                <p className="text-2xl font-bold text-red-500 mt-1">{users.filter(u => u.isActive === false).length}</p>
              </div>
            </div>

            <div className="bna-card flex-1 flex flex-col overflow-hidden">
              <div className="section-title flex justify-between items-center pr-4">
                <div>
                  Campaign Coverage Matrix
                  <span className="text-[11px] font-normal text-text-s ml-2">Staff allocation by campaign</span>
                </div>
                <button
                  onClick={() => {
                    const rows = campaigns.map(c => {
                      const assignedOfficials = users.filter(
                        u => u.role === 'official' && isAssignedToCampaign(getEffectiveUserCampaignId(u), c.id) && u.isActive !== false
                      ).length;
                      const assignedGuests = users.filter(
                        u => u.role === 'guest' && isAssignedToCampaign(getEffectiveUserCampaignId(u), c.id) && u.isActive !== false
                      ).length;
                      return [c.name, c.status || 'unknown', assignedOfficials, assignedGuests, assignedOfficials + assignedGuests];
                    });
                    const csv = [
                      ['Campaign', 'Status', 'Officials', 'Guests', 'Total Assigned'],
                      ...rows
                    ].map(r => r.join(',')).join('\n');

                    const blob = new Blob([csv], { type: 'text/csv' });
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.setAttribute('href', url);
                    a.setAttribute('download', `campaign_coverage_${new Date().toISOString().split('T')[0]}.csv`);
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                  }}
                  className="text-[10px] bg-accent/10 text-accent px-3 py-1.5 rounded font-black uppercase tracking-widest hover:bg-accent hover:text-white transition-all flex items-center gap-2"
                >
                  <Download size={14} /> Export Coverage CSV
                </button>
              </div>

              <div className="overflow-x-auto flex-1">
                <table className="w-full text-left text-xs">
                  <thead className="bg-white/[0.02] text-text-s uppercase text-[10px] tracking-wider sticky top-0 z-10">
                    <tr>
                      <th className="px-6 py-4 font-medium">Campaign</th>
                      <th className="px-6 py-4 font-medium">Status</th>
                      <th className="px-6 py-4 font-medium">Officials</th>
                      <th className="px-6 py-4 font-medium">Guests</th>
                      <th className="px-6 py-4 font-medium">Total Assigned</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {campaigns.map((campaign, i) => {
                      const assignedOfficials = users.filter(
                        u => u.role === 'official' && isAssignedToCampaign(getEffectiveUserCampaignId(u), campaign.id) && u.isActive !== false
                      ).length;
                      const assignedGuests = users.filter(
                        u => u.role === 'guest' && isAssignedToCampaign(getEffectiveUserCampaignId(u), campaign.id) && u.isActive !== false
                      ).length;
                      return (
                        <tr key={i} className="hover:bg-white/[0.01] transition-colors">
                          <td className="px-6 py-4 font-bold">{campaign.name}</td>
                          <td className="px-6 py-4">
                            <span className={`text-[10px] uppercase font-bold tracking-widest ${campaign.status === 'active' ? 'text-accent' : 'text-text-s'}`}>
                              {campaign.status || 'unknown'}
                            </span>
                          </td>
                          <td className="px-6 py-4">{assignedOfficials}</td>
                          <td className="px-6 py-4">{assignedGuests}</td>
                          <td className="px-6 py-4 font-bold text-accent">{assignedOfficials + assignedGuests}</td>
                        </tr>
                      );
                    })}
                    {campaigns.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-text-s italic text-xs">
                          No campaign data available for logistics planning.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

      </main>


      {/* View User Modal */}
      <AnimatePresence>
        {selectedUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedUser(null)}
              className="absolute inset-0 bg-[#0A0A0A]/80 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-md max-h-[90vh] bna-card p-8 shadow-3xl shadow-teal-500/10 overflow-y-auto no-scrollbar"
            >
              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 rounded-full bg-accent/20 flex items-center justify-center text-accent text-2xl font-bold">
                  {selectedUser.displayName?.charAt(0) || 'U'}
                </div>
                <div>
                  <h2 className="text-xl font-bold">{selectedUser.displayName || 'Unnamed User'}</h2>
                  <p className="text-text-s text-sm uppercase tracking-widest">{selectedUser.role}</p>
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t border-border">
                <div>
                  <label className="text-[10px] uppercase text-text-s font-bold tracking-widest block mb-1">Email / Username</label>
                  <p className="text-sm font-medium">{selectedUser.email}</p>
                </div>
                <div>
                  <label className="text-[10px] uppercase text-text-s font-bold tracking-widest block mb-1">Status</label>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${selectedUser.isActive ? 'bg-accent/10 text-accent' : 'bg-red-500/10 text-red-500'}`}>
                    {selectedUser.isActive ? 'Active' : 'Disabled'}
                  </span>
                </div>
                <div>
                  <label className="text-[10px] uppercase text-text-s font-bold tracking-widest block mb-1">ID Number</label>
                  <p className="text-sm font-medium font-mono">{selectedUser.idNumber || 'Not provided'}</p>
                </div>
                <div>
                  <label className="text-[10px] uppercase text-text-s font-bold tracking-widest block mb-1">Home Address</label>
                  <p className="text-sm font-medium whitespace-pre-line">{selectedUser.homeAddress || 'Not provided'}</p>
                </div>
                {selectedUser.campaignId && (
                  <div>
                    <label className="text-[10px] uppercase text-text-s font-bold tracking-widest block mb-1">Active Campaign</label>
                    <p className="text-sm font-medium">{selectedUser.campaignId}</p>
                  </div>
                )}
                {selectedUser.username && (
                  <div>
                    <label className="text-[10px] uppercase text-text-s font-bold tracking-widest block mb-1">Username</label>
                    <p className="text-sm font-medium font-mono">{selectedUser.username}</p>
                  </div>
                )}
                {selectedUser.employeeId && (
                  <div>
                    <label className="text-[10px] uppercase text-text-s font-bold tracking-widest block mb-1">Employee ID</label>
                    <p className="text-sm font-medium font-mono">{selectedUser.employeeId}</p>
                  </div>
                )}
                <div>
                  <label className="text-[10px] uppercase text-text-s font-bold tracking-widest block mb-1">Account Created</label>
                  <p className="text-sm font-medium">
                    {selectedUser.createdAt?.toDate ? selectedUser.createdAt.toDate().toLocaleString() : 'N/A'}
                  </p>
                </div>
                {selectedUser.lastLogin && (
                  <div>
                    <label className="text-[10px] uppercase text-text-s font-bold tracking-widest block mb-1">Last Active</label>
                    <p className="text-sm font-medium">
                      {selectedUser.lastLogin?.toDate ? selectedUser.lastLogin.toDate().toLocaleString() : 'N/A'}
                    </p>
                  </div>
                )}
                
                <div className="pt-4">
                  <label className="text-[10px] uppercase text-text-s font-bold tracking-widest block mb-2">Verification Documents</label>
                  <div className="grid grid-cols-2 gap-2">
                    {REQUIRED_DOCUMENT_TYPES.map((docType) => {
                      const doc = [...selectedUserDocs]
                        .filter((d) => d.type === docType.value || d.type === docType.label || d.label === docType.label)
                        .sort((a, b) => {
                          const aMs = a.timestamp?.toDate ? a.timestamp.toDate().getTime() : 0;
                          const bMs = b.timestamp?.toDate ? b.timestamp.toDate().getTime() : 0;
                          return bMs - aMs;
                        })[0];
                      return (
                        <div key={docType.value} className={`p-2 rounded border text-[10px] flex items-center justify-between ${doc ? 'border-accent/30 bg-accent/5' : 'border-white/5 opacity-50'}`}>
                          <span className="font-bold">{docType.label}</span>
                          {doc ? (
                            <a href={doc.url} target="_blank" rel="noreferrer" className="text-accent hover:underline flex items-center gap-1">
                              View <Download size={10} />
                            </a>
                          ) : (
                            <span className="text-text-s italic text-[9px]">Missing</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-4 border-t border-border/60">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <label className="text-[10px] uppercase text-text-s font-bold tracking-widest block">Clock In / Out History</label>
                    <button
                      onClick={exportSelectedUserAttendanceCsv}
                      className="text-[10px] px-2 py-1 rounded border border-accent/40 text-accent hover:bg-accent/10 font-bold uppercase tracking-wide"
                    >
                      Export CSV
                    </button>
                  </div>
                  <div className="flex items-center gap-2 mb-3">
                    {[
                      { label: 'Today', value: 'today' as const },
                      { label: 'This Week', value: 'week' as const },
                      { label: 'All', value: 'all' as const }
                    ].map((option) => (
                      <button
                        key={option.value}
                        onClick={() => setClockHistoryFilter(option.value)}
                        className={`text-[10px] px-2 py-1 rounded border font-bold uppercase tracking-wide ${
                          clockHistoryFilter === option.value
                            ? 'border-accent/50 bg-accent/10 text-accent'
                            : 'border-border text-text-s hover:border-accent/30'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                  <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                    {filteredClockHistory.length > 0 ? (
                      filteredClockHistory.map((entry) => (
                        <div key={entry.id} className="p-2 rounded border border-border/70 bg-white/[0.02] flex items-start justify-between gap-3">
                          <div>
                            <p className={`text-[10px] font-bold uppercase tracking-widest ${entry.type === 'in' ? 'text-green-400' : 'text-red-400'}`}>
                              {entry.type === 'in' ? 'Clock In' : 'Clock Out'}
                            </p>
                            <p className="text-[10px] text-text-s mt-1">{entry.location || 'Unknown location'}</p>
                          </div>
                          <p className="text-[10px] text-text-s text-right">
                            {entry.timestamp?.toDate ? entry.timestamp.toDate().toLocaleString() : 'Pending'}
                          </p>
                        </div>
                      ))
                    ) : (
                      <p className="text-[10px] text-text-s italic">No clock-in records found for this filter.</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="pt-8">
                <button 
                  onClick={() => setSelectedUser(null)}
                  className="w-full bna-button"
                >
                  Close Profile
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Activation Photos Modal */}
      <AnimatePresence>
        {selectedActivation && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedActivation(null)}
              className="absolute inset-0 bg-black/85 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className="relative w-full max-w-3xl max-h-[90vh] bna-card p-6 overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold">Activation Photos</h3>
                  <p className="text-xs text-text-s mt-1">
                    {selectedActivation.firstName} {selectedActivation.surname} • {selectedActivation.userName || 'Unknown employee'}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedActivation(null)}
                  className="px-3 py-1.5 rounded border border-border text-xs font-bold uppercase tracking-widest hover:bg-white/5"
                >
                  Close
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <p className="text-[10px] uppercase tracking-widest text-text-s font-bold">Customer Receiving Prize</p>
                  {selectedActivation.prizePhoto ? (
                    <img src={selectedActivation.prizePhoto} alt="Prize handover" className="w-full rounded border border-border object-cover" />
                  ) : (
                    <div className="h-48 rounded border border-border flex items-center justify-center text-text-s text-xs">No prize photo</div>
                  )}
                </div>
                <div className="space-y-2">
                  <p className="text-[10px] uppercase tracking-widest text-text-s font-bold">Account Summary</p>
                  {selectedActivation.summaryPhoto ? (
                    <img src={selectedActivation.summaryPhoto} alt="Account summary" className="w-full rounded border border-border object-cover" />
                  ) : (
                    <div className="h-48 rounded border border-border flex items-center justify-center text-text-s text-xs">No account summary photo</div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {userToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !loading && setUserToDelete(null)}
              className="absolute inset-0 bg-black/90 backdrop-blur-xl"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-sm bna-card border-red-500/30 p-8 shadow-2xl shadow-red-500/5"
            >
              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center text-red-500 mb-6 border border-red-500/20">
                  <AlertCircle size={32} />
                </div>
                <h2 className="text-xl font-bold mb-2 uppercase tracking-tighter">Confirm Deletion</h2>
                <p className="text-text-s text-xs leading-relaxed mb-8">
                  You are about to permanently remove <span className="text-white font-bold">{userToDelete.displayName}</span> from the BNA system. This action is <span className="text-red-500 font-bold uppercase underline">irreversible</span>.
                </p>

                <div className="grid grid-cols-2 gap-4 w-full">
                  <button 
                    disabled={loading}
                    onClick={() => setUserToDelete(null)}
                    className="py-3 px-4 rounded font-bold text-xs uppercase tracking-widest border border-border hover:bg-white/5 transition-colors disabled:opacity-30"
                  >
                    Cancel
                  </button>
                  <button 
                    disabled={loading}
                    onClick={executeDeleteUser}
                    className="py-3 px-4 rounded font-bold text-xs uppercase tracking-widest bg-red-500 hover:bg-red-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {loading ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      'Delete Now'
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add User Modal */}
      <AnimatePresence>
        {showAddUser && (
          <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center px-4 py-6 overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddUser(false)}
              className="absolute inset-0 bg-[#0A0A0A]/80 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-lg max-h-[90vh] bna-card p-8 shadow-3xl shadow-teal-500/10 overflow-y-auto"
            >
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                <UserPlus className="text-teal-500" />
                Add New Employee
              </h2>
              
              <form onSubmit={handleAddUser} className="space-y-4">
                {generatedCreds ? (
                  <div className="bg-accent/10 border border-accent/20 rounded p-6 text-center space-y-4">
                    <div className="w-16 h-16 bg-accent/20 rounded-full flex items-center justify-center mx-auto text-accent">
                      <Shield size={32} />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold">Profile Initialized</h3>
                      <p className="text-text-s text-xs mt-1">Credentials generated successfully.</p>
                    </div>
                    <div className="bg-black/40 p-4 rounded text-left space-y-3 font-mono">
                      <div>
                        <span className="text-[10px] text-text-s block uppercase">Registered Email</span>
                        <span className="text-white text-sm select-all">{generatedCreds.u}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-text-s block uppercase">Username</span>
                        <span className="text-white text-sm select-all">{generatedCreds.username}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-text-s block uppercase">Employee ID</span>
                        <span className="text-white text-sm select-all">{generatedCreds.employeeId}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-text-s block uppercase">Initial Password</span>
                        <span className="text-accent text-sm select-all">{generatedCreds.p}</span>
                      </div>
                    </div>
                    <div className="bg-teal-500/10 border border-teal-500/20 p-3 rounded text-[10px] text-teal-400 text-left">
                      <strong>Activation Steps:</strong>
                      <ol className="list-decimal ml-4 mt-2 space-y-1">
                        <li>Send these credentials to the employee.</li>
                        <li>Ask them to go directly to the <strong>Login</strong> page.</li>
                        <li>They must use the exact Employee ID and password shown above.</li>
                        <li>After first login, they can begin clock-ins and activation submissions.</li>
                      </ol>
                    </div>
                    <p className="text-[10px] text-text-s leading-relaxed italic">
                      Note: Registration is no longer required for admin-provisioned accounts.
                    </p>
                    <button
                      type="button"
                      onClick={() => generatedCreds && sendCredentialsToEmployeeEmail(generatedCreds)}
                      className="w-full py-2.5 rounded border border-accent/40 text-accent hover:bg-accent/10 text-xs font-bold uppercase tracking-widest transition-all"
                    >
                      Send To Employee Email
                    </button>
                    <button 
                      type="button"
                      onClick={() => { setShowAddUser(false); setGeneratedCreds(null); }}
                      className="bna-button w-full"
                    >
                      Close & Finish
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs uppercase text-gray-500 mb-1 block font-bold tracking-widest">Full Name</label>
                        <input 
                          type="text" 
                          required 
                          className="w-full bna-input text-sm"
                          value={newUser.displayName}
                          onChange={e => setNewUser(p => ({ ...p, displayName: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label className="text-xs uppercase text-gray-500 mb-1 block font-bold tracking-widest">Role</label>
                        <select 
                          className="w-full bna-input bna-select text-sm"
                          value={newUser.role}
                          onChange={e => setNewUser(p => ({
                            ...p,
                            role: e.target.value,
                            username: '',
                            employeeId: ''
                          }))}
                        >
                          <option value="guest">Guest Employee</option>
                          <option value="official">BnA Official</option>
                          <option value="admin">Admin</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs uppercase text-gray-500 mb-1 block font-bold tracking-widest">Gender</label>
                        <select
                          className="w-full bna-input bna-select text-sm"
                          value={newUser.gender}
                          onChange={e => setNewUser(p => ({ ...p, gender: e.target.value }))}
                        >
                          <option value="">Select Gender</option>
                          <option value="female">Female (Digit 2)</option>
                          <option value="male">Male (Digit 8)</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs uppercase text-gray-500 mb-1 block font-bold tracking-widest">Age</label>
                        <input
                          type="number"
                          min={18}
                          max={75}
                          className="w-full bna-input text-sm"
                          value={newUser.age}
                          onChange={e => setNewUser(p => ({ ...p, age: e.target.value }))}
                          placeholder="e.g. 27"
                        />
                      </div>
                      <div>
                        <label className="text-xs uppercase text-gray-500 mb-1 block font-bold tracking-widest">Performance Prediction</label>
                        <select
                          className="w-full bna-input bna-select text-sm"
                          value={newUser.predictedPerformance}
                          onChange={e => setNewUser(p => ({ ...p, predictedPerformance: e.target.value }))}
                        >
                          <option value="">Auto (Benchmark)</option>
                          <option value="high">High Performer (Digit 1)</option>
                          <option value="lower">Lower Performer (Digit 2)</option>
                        </select>
                      </div>
                      <div className="col-span-2 flex items-center justify-between rounded border border-border px-3 py-2 bg-bg/40">
                        <div>
                          <p className="text-xs uppercase text-gray-500 font-bold tracking-widest">Stakeholder Status</p>
                          <p className="text-[10px] text-text-s mt-1">A digit currently defaults to 0 unless manually overridden later.</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setNewUser(p => ({ ...p, isStakeholder: !p.isStakeholder }))}
                          className={`text-[10px] px-3 py-1 rounded font-bold uppercase tracking-widest ${newUser.isStakeholder ? 'bg-accent/20 text-accent border border-accent/50' : 'bg-white/5 text-text-s border border-border'}`}
                        >
                          {newUser.isStakeholder ? 'Stakeholder' : 'Not Stakeholder'}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="text-xs uppercase text-gray-500 font-bold tracking-widest mb-1 block">Employee Email</label>
                        <input 
                          type="email"
                          required
                          className="w-full bna-input text-sm"
                          value={newUser.email}
                          onChange={e => setNewUser(p => ({ ...p, email: e.target.value }))}
                          placeholder="employee@example.com"
                        />
                      </div>

                      <div>
                        <div className="flex justify-between items-end mb-1">
                          <label className="text-xs uppercase text-gray-500 font-bold tracking-widest">Username (Structured)</label>
                          <button
                            type="button"
                            onClick={generateStructuredIdentity}
                            className="text-[10px] text-accent hover:underline"
                          >
                            Generate Structured ID
                          </button>
                        </div>
                        <input
                          type="text"
                          required
                          className="w-full bna-input text-sm font-mono"
                          value={newUser.username}
                          onChange={e => setNewUser(p => ({ ...p, username: e.target.value.replace(/\s+/g, '_') }))}
                        />
                        <p className="text-[10px] text-text-s mt-1">
                          admin: admin_&lt;name&gt;_01 | official: rep_&lt;FirstName&gt;_&lt;ABCDE&gt; | guest: &lt;FirstName&gt;_000&lt;campaignDigit&gt;&lt;number&gt;
                        </p>
                      </div>

                      <div>
                        <label className="text-xs uppercase text-gray-500 font-bold tracking-widest mb-1 block">Employee ID</label>
                        <input
                          type="text"
                          required
                          className="w-full bna-input text-sm font-mono"
                          value={newUser.employeeId}
                          onChange={e => setNewUser(p => ({ ...p, employeeId: e.target.value.trim() }))}
                        />
                        <p className="text-[10px] text-text-s mt-1">
                          Official ABCDE: A=stakeholder (0/1), B=always 0, C=gender (male=8/female=2), D=9 (universal access), E=prediction (high=1/lower=2). Guest: 000=guest ID, 4th digit=campaign (Spot=1, Gumtree=2), 5th=individual #
                        </p>
                        {newUser.role === 'official' && (
                          <p className="text-[10px] text-accent mt-1 font-mono">
                            Expected 5-digit code: {buildRepFiveDigitCode()}
                          </p>
                        )}
                      </div>

                      <div>
                        <div className="flex justify-between items-end mb-1">
                          <label className="text-xs uppercase text-gray-500 font-bold tracking-widest">Password</label>
                          <button 
                            type="button" 
                            onClick={generatePassword}
                            className="text-[10px] text-accent hover:underline"
                          >
                            Auto-Generate (name@NN)
                          </button>
                        </div>
                        <input 
                          type="text" 
                          required 
                          className="w-full bna-input text-sm font-mono"
                          value={newUser.password}
                          onChange={e => setNewUser(p => ({ ...p, password: e.target.value }))}
                        />
                      </div>
                    </div>

                    {newUser.role === 'guest' && (
                      <div>
                        <label className="text-xs uppercase text-gray-500 mb-1 block font-bold tracking-widest">Assigned Campaign</label>
                        <select 
                          required 
                          className="w-full bna-input bna-select text-sm"
                          value={newUser.campaignId}
                          onChange={e => setNewUser(p => ({ ...p, campaignId: e.target.value }))}
                        >
                          <option value="">Select Campaign</option>
                          {campaigns.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div className="pt-6 flex gap-4">
                      <button 
                        type="button" 
                        onClick={() => setShowAddUser(false)}
                        className="flex-1 py-3 text-sm font-bold text-gray-500 hover:text-white transition-colors"
                      >
                        Cancel
                      </button>
                      <button 
                        type="submit" 
                        disabled={loading}
                        className="flex-3 bna-button flex items-center justify-center gap-2"
                      >
                        {loading ? 'Processing...' : 'Provision Account'}
                      </button>
                    </div>
                  </>
                )}
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Admin Self Password Reset Modal */}
      <AnimatePresence>
        {showSelfPasswordReset && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !selfPasswordLoading && setShowSelfPasswordReset(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className="relative w-full max-w-md bna-card p-6"
            >
              <h3 className="text-lg font-bold mb-2 uppercase tracking-tight">Reset Admin Password</h3>
              <p className="text-xs text-text-s mb-4">Set a new password for your currently signed-in admin account.</p>

              {selfPasswordError && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-2 rounded text-xs mb-3">
                  {selfPasswordError}
                </div>
              )}

              <div className="space-y-3">
                <div className="relative">
                  <input
                    type={showSelfPassword ? 'text' : 'password'}
                    className="bna-input pr-10"
                    placeholder="New password"
                    autoComplete="new-password"
                    value={selfPassword}
                    onChange={(e) => setSelfPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowSelfPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-s hover:text-accent"
                    aria-label={showSelfPassword ? 'Hide new password' : 'Show new password'}
                  >
                    {showSelfPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showSelfPasswordConfirm ? 'text' : 'password'}
                    className="bna-input pr-10"
                    placeholder="Confirm new password"
                    autoComplete="new-password"
                    value={selfPasswordConfirm}
                    onChange={(e) => setSelfPasswordConfirm(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowSelfPasswordConfirm((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-s hover:text-accent"
                    aria-label={showSelfPasswordConfirm ? 'Hide confirm password' : 'Show confirm password'}
                  >
                    {showSelfPasswordConfirm ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              <div className="flex gap-3 mt-5">
                <button
                  type="button"
                  onClick={() => setShowSelfPasswordReset(false)}
                  disabled={selfPasswordLoading}
                  className="flex-1 py-2.5 rounded border border-border text-xs font-bold uppercase tracking-widest hover:bg-white/5 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAdminSelfPasswordReset}
                  disabled={selfPasswordLoading}
                  className="flex-1 bna-button py-2.5 h-auto text-xs"
                >
                  {selfPasswordLoading ? 'Updating...' : 'Update Password'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
