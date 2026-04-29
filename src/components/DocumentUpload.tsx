import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { Download, Plus, Check, Loader2, FileText, AlertCircle } from 'lucide-react';
import imageCompression from 'browser-image-compression';
import { motion, AnimatePresence } from 'motion/react';

const DOC_TYPES = [
  { label: 'ID Copy', value: 'ID' },
  { label: 'Proof of Bank', value: 'Bank Proof' },
  { label: 'Proof of Address', value: 'Residence' },
  { label: 'Signed Contract', value: 'Contract' }
] as const;

const UPLOAD_TIMEOUT_MS = 45000;
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export default function DocumentUpload({ variant = 'default' }: { variant?: 'default' | 'profile' }) {
  const { profile } = useAuth();
  const [documents, setDocuments] = useState<any[]>([]);
  const [uploading, setUploading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!uploading) return;
    const failSafe = setTimeout(() => {
      setUploading(null);
      setUploadStatus(null);
      setError('Upload took too long and was reset. Please try again.');
    }, 90000);
    return () => clearTimeout(failSafe);
  }, [uploading]);

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

  const withTimeout = async <T,>(promise: Promise<T>, ms: number): Promise<T> => {
    return new Promise<T>((resolve, reject) => {
      const timeoutId = setTimeout(() => reject(new Error('Upload timed out. Please retry.')), ms);
      promise
        .then((result) => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch((err) => {
          clearTimeout(timeoutId);
          reject(err);
        });
    });
  };

  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    docType: (typeof DOC_TYPES)[number]
  ) => {
    const file = e.target.files?.[0];
    if (!file || !profile) return;

    if (file.size > MAX_UPLOAD_BYTES) {
      setError(`File is too large (${(file.size / (1024 * 1024)).toFixed(1)}MB). Max allowed is 5MB.`);
      e.target.value = '';
      return;
    }

    setUploading(docType.value);
    setError(null);
    setUploadStatus(`Preparing ${docType.label}...`);

    try {
      await withTimeout((async () => {
        let fileToUpload = file;
        if (file.type.startsWith('image/')) {
          setUploadStatus(`Compressing ${docType.label}...`);
          const options = {
            maxSizeMB: 0.19,
            maxWidthOrHeight: 1280,
            useWebWorker: true
          };
          fileToUpload = await withTimeout(imageCompression(file, options), UPLOAD_TIMEOUT_MS);
        }

        setUploadStatus(`Uploading ${docType.label}...`);
        const storageRef = ref(storage, `documents/${profile.uid}/${docType.value.replace(/\s+/g, '_')}_${Date.now()}_${file.name}`);
        const snapshot = await withTimeout(uploadBytes(storageRef, fileToUpload), UPLOAD_TIMEOUT_MS);
        const url = await withTimeout(getDownloadURL(snapshot.ref), UPLOAD_TIMEOUT_MS);

        setUploadStatus(`Saving ${docType.label} record...`);
        await withTimeout(addDoc(collection(db, 'documents'), {
          userId: profile.uid,
          userName: profile.displayName || profile.email,
          type: docType.value,
          label: docType.label,
          url,
          status: 'pending_review',
          timestamp: serverTimestamp()
        }), UPLOAD_TIMEOUT_MS);
      })(), UPLOAD_TIMEOUT_MS + 5000);

      setUploadStatus(`${docType.label} uploaded successfully.`);

    } catch (err: any) {
      console.error("Upload failed:", err);
      const details = err?.code || err?.message || 'Unknown error';
      setError(`Failed to upload ${docType.label}. ${details}`);
      setUploadStatus(null);
    } finally {
      setUploading(null);
      e.target.value = '';
      setTimeout(() => setUploadStatus((prev) => (prev?.includes('successfully') ? null : prev)), 2500);
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
        {uploadStatus && (
          <div className="bg-accent/10 border border-accent/30 text-accent p-2 rounded text-[10px] font-medium">
            {uploadStatus}
          </div>
        )}
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {DOC_TYPES.map((docType) => {
            const existingDoc = documents.find(d => d.type === docType.value);
            const isUploading = uploading === docType.value;

            return (
              <div 
                key={docType.value}
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
                    <h4 className="font-bold text-xs">{docType.label}</h4>
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
                      onChange={(e) => handleFileUpload(e, docType)}
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
