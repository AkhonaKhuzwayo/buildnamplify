import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfigData from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfigData);

export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfigData.firestoreDatabaseId);
export const storage = getStorage(app);

// Connectivity Test (Critical Constraint)
setTimeout(async () => {
  try {
    // Attempt to reach the server to verify the database and credentials
    await getDocFromServer(doc(db, 'system', 'connection_test'));
  } catch (error: any) {
    if (error.message?.includes('the client is offline') || error.code === 'unavailable') {
      console.error("Firebase connection failed: Backend unreachable. Please verify network and Firebase project setup.");
    } else if (error.code === 'permission-denied') {
      // Permission denied is actually a good sign that the connection worked, but we couldn't read the test doc
      console.log("Firebase connection established (Status: Permission Denied for test doc - expected)");
    } else {
      console.error("Firebase connection error:", error);
    }
  }
}, 1000);

export default app;
