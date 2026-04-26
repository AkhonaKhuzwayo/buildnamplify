import React, { useState, useEffect } from 'react';
import { addDoc, collection, serverTimestamp, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { Clock, MapPin, CheckCircle2, Navigation } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const LOCATIONS = ['DUT', 'UKZN', 'MUT'] as const;

export default function ClockIn() {
  const { profile, selectedCampaignId } = useAuth();
  const [loading, setLoading] = useState(false);
  const [lastStatus, setLastStatus] = useState<'in' | 'out' | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<typeof LOCATIONS[number]>('DUT');
  const [coords, setCoords] = useState<{ lat: number, lng: number } | null>(null);

  useEffect(() => {
    fetchLastStatus();
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        (err) => console.error("Geo error:", err)
      );
    }
  }, [profile?.uid, selectedCampaignId]);

  const fetchLastStatus = async () => {
    if (!profile?.uid || !selectedCampaignId) return;
    const q = query(
      collection(db, 'clock-ins'),
      where('userId', '==', profile.uid),
      where('campaignId', '==', selectedCampaignId),
      orderBy('timestamp', 'desc'),
      limit(1)
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      setLastStatus(snap.docs[0].data().type);
    }
  };

  const handleAction = async (type: 'in' | 'out') => {
    if (!profile || !selectedCampaignId) return;
    setLoading(true);
    try {
      await addDoc(collection(db, 'clock-ins'), {
        userId: profile.uid,
        userName: profile.displayName || profile.email,
        campaignId: selectedCampaignId,
        type,
        location: selectedLocation,
        timestamp: serverTimestamp(),
        coordinates: coords
      });
      setLastStatus(type);
    } catch (err) {
      console.error("Clock operation failed:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bna-card p-5">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-sm font-bold flex items-center gap-2 uppercase tracking-wider">
          <Clock className="text-accent" size={18} />
          Attendance
        </h2>
        <div className="flex items-center gap-2 text-[10px] text-text-s uppercase font-medium">
          <MapPin size={12} className="text-accent" />
          {coords ? "Geo-Location Active" : "Detecting..."}
        </div>
      </div>

      <div className="space-y-5">
        <div>
          <label className="text-[10px] uppercase tracking-[0.15em] text-text-s mb-2 block font-bold">Site Location</label>
          <div className="grid grid-cols-3 gap-2">
            {LOCATIONS.map(loc => (
              <button
                key={loc}
                onClick={() => setSelectedLocation(loc)}
                className={`py-2 px-3 rounded text-[11px] transition-all border font-bold uppercase tracking-wider ${
                  selectedLocation === loc 
                  ? 'bg-accent/10 border-accent text-accent' 
                  : 'bg-black border-border text-text-s hover:border-accent/30'
                }`}
              >
                {loc}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => handleAction('in')}
            disabled={loading || lastStatus === 'in'}
            className="flex-1 py-3 bna-button flex flex-col items-center gap-1 uppercase tracking-widest text-[10px] disabled:grayscale"
          >
            <Navigation size={18} className="rotate-45" />
            <span>Clock In</span>
            {lastStatus === 'in' && <span className="text-[8px] opacity-70">Active Shift</span>}
          </button>
          
          <button
            onClick={() => handleAction('out')}
            disabled={loading || !lastStatus || lastStatus === 'out'}
            className={`flex-1 py-3 flex flex-col items-center gap-1 rounded border uppercase tracking-widest text-[10px] transition-all ${
              lastStatus === 'in' 
              ? 'bg-red-500/10 border-red-500/30 text-red-500 hover:bg-red-500/20' 
              : 'bg-black border-border text-text-s opacity-50'
            }`}
          >
            <Clock size={18} />
            <span>Clock Out</span>
          </button>
        </div>
      </div>

      {lastStatus && (
        <div className="mt-5 pt-4 border-t border-border flex items-center justify-center gap-2 text-[10px] text-text-s uppercase tracking-wider font-medium">
          <CheckCircle2 size={12} className="text-accent" />
          System Status: {lastStatus === 'in' ? 'On Duty' : 'Off Duty'}
        </div>
      )}
    </div>
  );
}
