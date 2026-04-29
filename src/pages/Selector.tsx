import React, { useEffect, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Target, ArrowRight, LayoutDashboard, Database, ShieldCheck, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { setDoc, doc, serverTimestamp } from 'firebase/firestore';

interface Campaign {
  id: string;
  name: string;
  status: string;
  logo?: string;
  color?: string;
  description?: string;
}

const CAMPAIGN_LOGO_FALLBACKS: Record<string, string> = {
  'spot-money': '/spot-logo.jpeg',
  spot: '/spot-logo.jpeg',
  gumtree: '/gumtree-logo.jpeg'
};

const getDashboardPathForCampaign = (campaignId?: string | null) => {
  if (campaignId === 'spot-money' || campaignId === 'spot') return '/dashboard/spot';
  if (campaignId === 'gumtree') return '/dashboard/gumtree';
  return '/dashboard';
};

export default function Selector() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const { profile, selectedCampaignId, setSelectedCampaignId } = useAuth();
  const navigate = useNavigate();

  const fetchCampaigns = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'campaigns'), where('status', '==', 'active'));
      const querySnapshot = await getDocs(q);
      const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Campaign));
      setCampaigns(data);
    } catch (err) {
      console.error("Error fetching campaigns:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const handleSeedCampaigns = async () => {
    setSeeding(true);
    try {
      const seedData = [
        {
          id: 'spot-money',
          name: 'Spot - Money',
          status: 'active',
          logo: '/spot-logo.jpeg',
          color: '#00D1D1',
          description: 'South Africa\'s first mobile-only bank and payment ecosystem.'
        },
        {
          id: 'gumtree',
          name: 'Gumtree',
          status: 'active',
          logo: '/gumtree-logo.jpeg',
          color: '#7FFF00',
          description: 'The largest local classifieds site in South Africa.'
        }
      ];

      for (const campaign of seedData) {
        await setDoc(doc(db, 'campaigns', campaign.id), {
          ...campaign,
          updatedAt: serverTimestamp()
        });
      }
      
      await fetchCampaigns();
    } catch (err) {
      console.error("Seeding failed:", err);
      alert("Failed to seed campaigns. Check permissions.");
    } finally {
      setSeeding(false);
    }
  };

  const handleSelect = async (id: string) => {
    try {
      if (profile?.uid) {
        await setDoc(
          doc(db, 'profiles', profile.uid),
          {
            campaignId: id,
            updatedAt: serverTimestamp()
          },
          { merge: true }
        );
      }
    } catch (err) {
      console.error('Failed to persist selected campaign on profile:', err);
    }

    setSelectedCampaignId(id);
    navigate(getDashboardPathForCampaign(id));
  };

  return (
    <div className="min-h-screen bg-bg text-text-p p-6 md:p-12 flex flex-col items-center">
      <header className="mb-16 text-center max-w-2xl">
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex justify-center mb-6"
        >
          <div className="w-14 h-14 rounded-2xl bg-accent/20 border border-accent/30 flex items-center justify-center text-accent shadow-2xl shadow-accent/20">
            <Zap size={32} />
          </div>
        </motion.div>
        <motion.h1 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-4xl font-black mb-4 tracking-tighter uppercase"
        >
          Control Center
        </motion.h1>
        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="text-text-s text-sm uppercase tracking-[0.2em] font-medium"
        >
          Select an active campaign to initialize your terminal
        </motion.p>
      </header>

      {loading ? (
        <div className="flex-1 flex items-center">
          <div className="flex flex-col items-center gap-4">
            <div className="w-10 h-10 border-4 border-accent border-t-transparent rounded-full animate-spin"></div>
            <p className="text-[10px] uppercase tracking-widest text-accent font-bold">Retrieving Data Nodes</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-5xl">
          <AnimatePresence>
            {campaigns.map((campaign, idx) => {
              const isSpotCampaign = campaign.id === 'spot-money';
              const isGumtreeCampaign = campaign.id === 'gumtree';
              const campaignLogo = isSpotCampaign
                ? '/spot-logo.jpeg'
                : isGumtreeCampaign
                  ? '/gumtree-logo.jpeg'
                  : (campaign.logo || CAMPAIGN_LOGO_FALLBACKS[campaign.id]);

              return (
                <motion.button
                  key={campaign.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  onClick={() => handleSelect(campaign.id)}
                  className="group relative bna-card overflow-hidden h-[240px] text-left transition-all hover:border-accent/50 hover:shadow-2xl hover:shadow-accent/5"
                >
                  {/* Background Decor */}
                  <div 
                    className="absolute top-0 right-0 w-32 h-32 opacity-10 blur-3xl rounded-full"
                    style={{ backgroundColor: campaign.color || '#00A8A8' }}
                  />
                  
                  <div className="relative h-full p-8 flex flex-col">
                    <div className="flex justify-between items-start mb-auto">
                      <div className="w-16 h-16 bg-card/50 rounded-xl border border-border p-3 flex items-center justify-center group-hover:bg-card transition-all">
                        {campaignLogo ? (
                          <img 
                            src={campaignLogo} 
                            alt={campaign.name} 
                            className="w-full h-full object-contain"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <Target className="text-text-s group-hover:text-accent" size={32} />
                        )}
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="text-[10px] font-black uppercase tracking-widest text-accent border border-accent/30 px-2 py-1 rounded">
                          Active
                        </span>
                      </div>
                    </div>

                    <div className="mt-4">
                      <h3 className="font-black text-2xl mb-2 uppercase tracking-tighter group-hover:text-accent transition-colors">
                        {campaign.name}
                      </h3>
                      <p className="text-text-s text-xs leading-relaxed max-w-[80%]">
                        {campaign.description || "Deploy enterprise-scale activation protocols for this campaign node."}
                      </p>
                    </div>

                    <div className="mt-6 pt-4 border-t border-border/60 flex items-center justify-between text-accent opacity-0 group-hover:opacity-100 transition-all transform translate-y-2 group-hover:translate-y-0 text-[10px] font-bold uppercase tracking-widest">
                      Initialize Terminal
                      <ArrowRight size={14} />
                    </div>
                  </div>
                </motion.button>
              );
            })}
          </AnimatePresence>
          
          {campaigns.length === 0 && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="col-span-1 md:col-span-2 flex flex-col items-center justify-center p-20 bna-card border-dashed border-border"
            >
              <div className="w-16 h-16 bg-card rounded-full border border-border flex items-center justify-center text-text-s mb-6">
                <Database size={32} />
              </div>
              <p className="text-text-s text-center mb-8 italic">No campaign nodes found in the current sector.</p>
              
              {profile && (
                <button 
                  onClick={handleSeedCampaigns}
                  disabled={seeding}
                  className="bna-button w-64 flex items-center justify-center gap-2"
                >
                  {seeding ? <div className="animate-spin w-4 h-4 border-2 border-current/40 border-t-current rounded-full"></div> : <ShieldCheck size={18} />}
                  {seeding ? 'Seeding Nodes...' : 'Initialize Default Nodes'}
                </button>
              )}
            </motion.div>
          )}
        </div>
      )}

      {campaigns.length > 0 && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-16 pt-8 border-t border-border w-full max-w-sm"
        >
          <button 
            onClick={() => navigate(getDashboardPathForCampaign(selectedCampaignId || campaigns[0]?.id))}
            className="w-full py-4 text-text-s hover:text-accent flex items-center justify-center gap-3 transition-all text-xs font-bold uppercase tracking-[0.3em]"
          >
            <LayoutDashboard size={16} />
            Bypass Selection
          </button>
        </motion.div>
      )}
    </div>
  );
}
