import React, { useState, useEffect } from 'react';
import { addDoc, collection, serverTimestamp, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { UserPlus, X, Check, Loader2, History, Gift, ClipboardList, CreditCard, Layers } from 'lucide-react';
import imageCompression from 'browser-image-compression';
import { getActivationCollectionName } from '../lib/activationCollections';
import { getSouthAfricaDateKey } from '../lib/dateKey';


export default function ActivationForm() {
  const { profile, selectedCampaignId } = useAuth();
  const [formData, setFormData] = useState({
    firstName: '',
    surname: '',
    idNumber: ''
  });
  const [activationType, setActivationType] = useState<'card-only' | 'card-sim' | null>(null);
  const [prizePhoto, setPrizePhoto] = useState<File | null>(null);
  const [summaryPhoto, setSummaryPhoto] = useState<File | null>(null);

  const RATES = { 'card-only': 100, 'card-sim': 110 } as const;
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [recentClaims, setRecentClaims] = useState<any[]>([]);

  useEffect(() => {
    if (!profile || !selectedCampaignId) return;
    const activationCollection = getActivationCollectionName(selectedCampaignId);
    
    const q = query(
      collection(db, activationCollection),
      where('userId', '==', profile.uid),
      where('campaignId', '==', selectedCampaignId),
      orderBy('timestamp', 'desc'),
      limit(3)
    );

    const unsub = onSnapshot(q, (snap) => {
      setRecentClaims(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => unsub();
  }, [profile, selectedCampaignId]);

  const handleSlotPhoto = (e: React.ChangeEvent<HTMLInputElement>, slot: 'prize' | 'summary') => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (slot === 'prize') setPrizePhoto(file);
    else setSummaryPhoto(file);
    e.target.value = '';
  };

  const compressAndConvertToBase64 = async (file: File): Promise<string> => {
    const options = {
      maxSizeMB: 0.19,
      maxWidthOrHeight: 1280,
      useWebWorker: true
    };
    try {
      const compressedFile = await imageCompression(file, options);
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(compressedFile);
      });
    } catch (err) {
      console.error("Compression error:", err);
      throw err;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !selectedCampaignId) return;
    if (!/^\d{13}$/.test(formData.idNumber)) {
      setError('Please provide a valid 13-digit ID number.');
      return;
    }
    if (!prizePhoto) {
      setError('Please upload a photo of the customer receiving the prize.');
      return;
    }
    if (!summaryPhoto) {
      setError('Please upload a photo of the account summary.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const [prizeData, summaryData] = await Promise.all([
        compressAndConvertToBase64(prizePhoto),
        compressAndConvertToBase64(summaryPhoto)
      ]);

      const activationCollection = getActivationCollectionName(selectedCampaignId);

      await addDoc(collection(db, activationCollection), {
        ...formData,
        userId: profile.uid,
        userName: profile.displayName || profile.email,
        campaignId: selectedCampaignId,
        submissionDateKey: getSouthAfricaDateKey(),
        activationType,
        rate: RATES[activationType!],
        prizePhoto: prizeData,
        summaryPhoto: summaryData,
        timestamp: serverTimestamp()
      });

      setSuccess(true);
      setFormData({ firstName: '', surname: '', idNumber: '' });
      setActivationType(null);
      setPrizePhoto(null);
      setSummaryPhoto(null);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      console.error("Activation failed:", err);
      if (err.code === 'permission-denied') {
        setError('Permission denied. Ensure your account is active and assigned to a campaign.');
      } else if (err.code === 'storage/unauthorized') {
        setError('Photo upload failed: storage permission denied. Contact your admin.');
      } else {
        setError(err.message || 'Submission failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bna-card p-0 overflow-hidden">
      <div className="section-title">
        Activation Form
        <UserPlus className="text-accent" size={18} />
      </div>

      <form onSubmit={handleSubmit} className="p-6 space-y-5">
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded text-xs flex items-start gap-2">
            <span className="mt-0.5">⚠</span>
            <span>{error}</span>
          </div>
        )}
        <div>
          <label className="text-[11px] uppercase tracking-wider text-text-s mb-2 block font-bold">
            Activation Type <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              {
                value: 'card-only' as const,
                title: 'Bank Card Only',
                description: 'Customer receives a bank card activation.',
                icon: <CreditCard size={18} />
              },
              {
                value: 'card-sim' as const,
                title: 'Card + SIM Card',
                description: 'Customer receives bank and SIM activation.',
                icon: <Layers size={18} />
              }
            ].map((option) => {
              const isSelected = activationType === option.value;

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setActivationType(option.value)}
                  className={`text-left rounded-xl border p-4 transition-all ${
                    isSelected
                      ? 'border-accent bg-accent/10 shadow-[0_0_0_1px_rgba(255,184,0,0.3)]'
                      : 'border-border bg-white/[0.02] hover:border-accent/40 hover:bg-accent/5'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      isSelected ? 'bg-accent/20 text-accent' : 'bg-white/5 text-text-s'
                    }`}>
                      {option.icon}
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className="text-sm font-bold uppercase tracking-wide">{option.title}</div>
                    <p className="mt-1 text-[11px] text-text-s leading-relaxed">{option.description}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-[11px] uppercase tracking-wider text-text-s mb-1.5 block font-bold">First Name</label>
            <input 
              type="text" 
              required
              className="bna-input"
              placeholder="e.g. Thandiwe"
              value={formData.firstName}
              onChange={e => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-[11px] uppercase tracking-wider text-text-s mb-1.5 block font-bold">Surname</label>
            <input 
              type="text" 
              required
              className="bna-input"
              placeholder="e.g. Ndlovu"
              value={formData.surname}
              onChange={e => setFormData(prev => ({ ...prev, surname: e.target.value }))}
            />
          </div>
          <div className="md:col-span-2">
            <label className="text-[11px] uppercase tracking-wider text-text-s mb-1.5 block font-bold">ID Number</label>
            <input
              type="text"
              required
              inputMode="numeric"
              maxLength={13}
              className="bna-input"
              placeholder="e.g. 9001015009087"
              value={formData.idNumber}
              onChange={e => {
                const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, 13);
                setFormData(prev => ({ ...prev, idNumber: digitsOnly }));
              }}
            />
            <p className="text-[10px] text-text-s mt-1">Must be exactly 13 digits.</p>
          </div>
        </div>


        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Prize handover photo */}
          {[{ slot: 'prize' as const, label: 'Customer Receiving Prize', icon: <Gift size={18} className="text-text-s" />, file: prizePhoto, setter: setPrizePhoto },
            { slot: 'summary' as const, label: 'Account Summary', icon: <ClipboardList size={18} className="text-text-s" />, file: summaryPhoto, setter: setSummaryPhoto }
          ].map(({ slot, label, icon, file, setter }) => (
            <div key={slot}>
              <label className="text-[11px] uppercase tracking-wider text-text-s mb-1.5 block font-bold">
                {label} <span className="text-red-500">*</span>
              </label>
              <div className={`relative w-full h-36 rounded-lg border-2 border-dashed flex flex-col items-center justify-center transition-all overflow-hidden ${
                file ? 'border-accent/60 bg-accent/5' : 'border-border hover:border-accent/40 hover:bg-accent/5'
              }`}>
                {file ? (
                  <>
                    <img
                      src={URL.createObjectURL(file)}
                      alt={label}
                      className="absolute inset-0 w-full h-full object-cover opacity-70"
                    />
                    <button
                      type="button"
                      onClick={() => setter(null)}
                      className="absolute top-2 right-2 bg-red-500 rounded-full p-0.5 text-white shadow-lg z-10"
                    >
                      <X size={12} />
                    </button>
                    <div className="absolute bottom-2 left-2 bg-black/60 px-2 py-0.5 rounded text-[9px] text-accent font-bold uppercase tracking-widest">
                      <Check size={10} className="inline mr-1" />Uploaded
                    </div>
                  </>
                ) : (
                  <label className="flex flex-col items-center gap-2 cursor-pointer w-full h-full justify-center">
                    {icon}
                    <span className="text-[10px] text-text-s uppercase font-bold tracking-widest">Tap to upload</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={e => handleSlotPhoto(e, slot)}
                    />
                  </label>
                )}
              </div>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-text-s italic">Both photos are required. Images are auto-compressed to &lt;200KB.</p>

        <button 
          type="submit" 
          disabled={loading || !prizePhoto || !summaryPhoto || !activationType || !/^\d{13}$/.test(formData.idNumber)}
          className={`w-full py-3 h-12 bna-button flex items-center justify-center gap-2 uppercase tracking-widest text-xs ${success ? 'bg-green-600' : ''}`}
        >
          {loading ? (
            <>
              <Loader2 className="animate-spin" size={18} />
              <span>Transmitting Batch...</span>
            </>
          ) : success ? (
            <>
              <Check size={18} />
              <span>Record Secured</span>
            </>
          ) : (
            <span>Submit Activation</span>
          )}
        </button>
      </form>

      {recentClaims.length > 0 && (
        <div className="border-t border-border p-4 bg-white/[0.02]">
          <div className="flex items-center gap-2 text-[10px] uppercase font-bold text-text-s mb-3 tracking-widest">
            <History size={12} />
            Recent Bulk Records
          </div>
          <div className="space-y-2">
            {recentClaims.map((claim) => (
              <div key={claim.id} className="flex items-center justify-between p-2 bg-black/20 rounded border border-border/50">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded bg-accent/10 flex items-center justify-center text-accent">
                    <Check size={14} />
                  </div>
                  <div>
                    <p className="text-xs font-bold">{claim.firstName} {claim.surname}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-[9px] px-2 py-0.5 rounded uppercase font-bold tracking-wide ${
                        claim.activationType === 'card-sim' ? 'bg-purple-500/10 text-purple-400' : 'bg-accent/10 text-accent'
                      }`}>
                        {claim.activationType === 'card-sim' ? 'Card + SIM' : 'Card Only'}
                      </span>
                      <span className="text-[9px] text-green-400 font-bold uppercase tracking-wide">
                        R{claim.rate ?? (claim.activationType === 'card-sim' ? 110 : 100)}.00
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-1">
                  {claim.prizePhoto && <span className="text-[9px] text-accent bg-accent/10 px-2 py-0.5 rounded">Prize</span>}
                  {claim.summaryPhoto && <span className="text-[9px] text-text-s bg-white/5 px-2 py-0.5 rounded">Summary</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
