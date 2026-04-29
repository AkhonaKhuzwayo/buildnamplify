import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, onSnapshot, collection, query, where, getDocs, updateDoc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

export type UserRole = 'admin' | 'official' | 'guest';

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  employeeId?: string;
  username?: string;
  forcePasswordResetRequired?: boolean;
  passwordSetupPending?: boolean;
  passwordMode?: 'generated' | 'custom';
  passwordUpdatedAt?: { toDate?: () => Date };
  gender?: string;
  age?: number | null;
  role: UserRole;
  campaignId?: string;
  isActive?: boolean;
  idNumber?: string;
  homeAddress?: string;
  performanceZone?: 'normal' | 'green' | 'orange' | 'disabled';
  createdAt?: { toDate?: () => Date };
}

interface AuthContextType {
  user: FirebaseUser | null;
  profile: UserProfile | null;
  loading: boolean;
  isOffline: boolean;
  selectedCampaignId: string | null;
  setSelectedCampaignId: (id: string | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(false);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(localStorage.getItem('selectedCampaignId'));

  useEffect(() => {
    let profileTimeout: ReturnType<typeof setTimeout>;

    // Hard timeout: if still loading after 8s, force-stop regardless of Firebase state
    const hardTimeout = setTimeout(() => {
      console.warn("⚠️ Firebase timed out after 8s. Forcing loading=false.");
      setLoading(false);
    }, 8000);

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        const userDocRef = doc(db, 'profiles', firebaseUser.uid);

        // If Firestore doesn't respond within 6s, stop loading
        profileTimeout = setTimeout(() => {
          console.warn("⚠️ Firestore profile listener timed out. Forcing loading=false.");
          setLoading(false);
        }, 6000);
        
        const setupProfileListener = () => {
          return onSnapshot(userDocRef, async (docSnap) => {
            clearTimeout(profileTimeout);
            clearTimeout(hardTimeout);
            setIsOffline(false);
            
            if (docSnap.exists()) {
              const data = docSnap.data() as UserProfile;
              setProfile({ ...data, uid: firebaseUser.uid });
              
              if (data.role === 'guest' && data.campaignId) {
                setSelectedCampaignId(data.campaignId);
              }
              setLoading(false);
            } else {
              console.warn("No profile found for current auth UID. Trying email-based recovery.");
              try {
                const normalizedEmail = firebaseUser.email?.toLowerCase();
                const q = query(collection(db, 'profiles'), where('email', '==', normalizedEmail));
                const querySnap = await getDocs(q);
                
                if (!querySnap.empty) {
                  const orphanedDoc = querySnap.docs[0];
                  const data = orphanedDoc.data();
                  
                  const batch = writeBatch(db);
                  batch.set(doc(db, 'profiles', firebaseUser.uid), {
                    ...data,
                    uid: firebaseUser.uid,
                    lastLogin: serverTimestamp()
                  });
                  batch.delete(orphanedDoc.ref);
                  
                  await batch.commit();
                } else {
                  console.error("No user profile found in Firestore for the authenticated user.");
                  setProfile(null);
                  setLoading(false);
                }
              } catch (err) {
                console.error("Error searching for provisioned profile:", err);
                setProfile(null);
                setLoading(false);
              }
            }
          }, (error) => {
            clearTimeout(profileTimeout);
            clearTimeout(hardTimeout);
            console.error("Error fetching profile:", error);
            if (error.code === 'unavailable') {
              setIsOffline(true);
            }
            setLoading(false);
          });
        };

        const unsubscribeProfile = setupProfileListener();
        return () => {
          clearTimeout(profileTimeout);
          unsubscribeProfile();
        };
      } else {
        clearTimeout(hardTimeout);
        setProfile(null);
        setSelectedCampaignId(null);
        localStorage.removeItem('selectedCampaignId');
        setLoading(false);
        setIsOffline(false);
      }
    });

    return () => {
      clearTimeout(hardTimeout);
      clearTimeout(profileTimeout);
      unsubscribeAuth();
    };
  }, []);

  useEffect(() => {
    if (selectedCampaignId) {
      localStorage.setItem('selectedCampaignId', selectedCampaignId);
    } else {
      localStorage.removeItem('selectedCampaignId');
    }
  }, [selectedCampaignId]);

  return (
    <AuthContext.Provider value={{ user, profile, loading, isOffline, selectedCampaignId, setSelectedCampaignId }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
