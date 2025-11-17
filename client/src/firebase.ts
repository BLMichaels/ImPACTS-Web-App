import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';

// Firebase configuration - only used for authentication
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY || "AIzaSyCRhd9Mr1QB5qWwU57_I7UoLmeW6egGSDI",
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || "impacts-tracker.firebaseapp.com",
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID || "impacts-tracker",
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || "impacts-tracker.firebasestorage.app",
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || "936816429135",
  appId: process.env.REACT_APP_FIREBASE_APP_ID || "1:936816429135:web:07d8511644e90e042e823a",
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID || "G-J02HGC65WX"
};

const app = firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

export { auth, db };
export default app;
