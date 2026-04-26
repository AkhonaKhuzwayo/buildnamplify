import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { Download, Plus, Check, Loader2, FileText, AlertCircle } from 'lucide-react';
import imageCompression from 'browser-image-compression';
import { motion, AnimatePresence } from 'motion/react';

const DOC_TYPES = ['ID Copy', 'Proof of Bank', 'Proof of Address', 'Signed Contract'];

export default function DocumentUpload({ variant = 'default' }: { variant?: 'default' | 'profile' }) {
  const { profile } = useAuth();
  const [documents, setDocuments] = useState<any[]>([]);
  const [uploading, setUploading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;

    const q = query(
      collection(db, 'documents'),
      where('userId', '==', profile.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setDocuments(docs);
    });

    return () => unsubscribe();
  }, [profile]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: string) => {
    const file = e.target.files?.[0];
    if (!file || !profile) return;

    setUploading(type);
    setError(null);

    try {
      let fileToUpload = file;
      if (file.type.startsWith('image/')) {
        const options = {
          maxSizeMB: 0.19,
          maxWidthOrHeight: 1280,
          useWebWorker: true
        };
        fileToUpload = await imageCompression(file, options);
      }

      const storageRef = ref(storage, `documents/${profile.uid}/${type.replace(/\s+/g, '_')}_${Date.now()}_${file.name}`);
      const snapshot = await uploadBytes(storageRef, fileToUpload);
      const url = await getDownloadURL(snapshot.ref);

      await addDoc(collection(db, 'documents'), {
        userId: profile.uid,
        userName: profile.displayName || profile.email,
        type,
        url,
        status: 'pending_review',
        timestamp: serverTimestamp()
      });

    } catch (err: any) {
      console.error("Upload failed:", err);
      setError(`Failed to upload ${type}. Please try again.`);
    } finally {
      setUploading(null);
    }
  };

  const containerClass = variant === 'profile' ? 'bg-transparent border-none p-0' : 'bna-card p-0 overflow-hidden';
  const headerClass = variant === 'profile' ? 'hidden' : 'section-title';

  return (
    <div className={containerClass}>
      <div className={headerClass}>
        Compliance Documents
        <span className="text-[11px] font-normal text-text-s">Verify Identity</span>
      </div>
      <div className={`${variant === 'profile' ? 'p-0' : 'p-4'} space-y-4`}>
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-2 rounded text-[10px] flex items-center gap-2">
            <AlertCircle size={14} />
            {error}
          </div>
        )}
        
        <p className="text-xs text-text-s">Upload required compliance documents. Files must be clear and legible.</p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {DOC_TYPES.map((type) => {
            const existingDoc = documents.find(d => d.type === type);
            const isUploading = uploading === type;

            return (
              <div 
                key={type} 
                className={`p-3 bg-white/[0.02] border rounded-lg flex items-center justify-between group transition-all ${
                  existingDoc ? 'border-accent/40 shadow-lg shadow-accent/5' : 'border-border hover:border-accent/30'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded flex items-center justify-center transition-colors ${
                    existingDoc ? 'bg-accent/20 text-accent' : 'bg-white/5 text-text-s group-hover:text-accent'
                  }`}>
                    {existingDoc ? <Check size={16} /> : <FileText size={16} />}
                  </div>
                  <div>
                    <h4 className="font-bold text-xs">{type}</h4>
                    <p className={`text-[9px] uppercase font-bold ${existingDoc ? 'text-accent' : 'text-text-s'}`}>
                      {existingDoc ? existingDoc.status.replace('_', ' ') : 'Pending'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {existingDoc && (
                    <a 
                      href={existingDoc.url} 
                      target="_blank" 
                      rel="noreferrer"
                      className="p-1.5 hover:text-accent text-text-s transition-colors"
                      title="View Document"
                    >
                      <Download size={16} />
                    </a>
                  )}
                  
                  <label className={`cursor-pointer p-1.5 hover:text-accent transition-colors ${isUploading ? 'animate-pulse' : ''}`}>
                    {isUploading ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />}
                    <input 
                      type="file" 
                      className="hidden" 
                      accept="image/*,application/pdf"
                      disabled={isUploading}
                      onChange={(e) => handleFileUpload(e, type)}
                    />
                  </label>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
