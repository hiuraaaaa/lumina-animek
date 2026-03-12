// ── FIREBASE CONFIG ──
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, signOut, updateProfile } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyAqhahm0Vp_InpPzqn-niUnismdSfjO5gY",
    authDomain: "anime-d0055.firebaseapp.com",
    projectId: "anime-d0055",
    storageBucket: "anime-d0055.firebasestorage.app",
    messagingSenderId: "271967142358",
    appId: "1:271967142358:web:e863d464499ff44f9fe477"
};

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

// ── USER PROFILE ──
async function createUserProfile(user, extra = {}) {
    const ref  = doc(db, 'users', user.uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
        await setDoc(ref, {
            uid:         user.uid,
            email:       user.email,
            displayName: user.displayName || extra.displayName || 'Anon',
            photoURL:    user.photoURL    || null,
            createdAt:   serverTimestamp(),
            watchlist:   [],
            bio:         '',
        });
    }
    return (await getDoc(ref)).data();
}

async function getUserProfile(uid) {
    const snap = await getDoc(doc(db, 'users', uid));
    return snap.exists() ? snap.data() : null;
}

async function updateUserProfile(uid, data) {
    await updateDoc(doc(db, 'users', uid), data);
}

export { auth, db, googleProvider, createUserProfile, getUserProfile, updateUserProfile,
    onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword,
    signInWithPopup, signOut, updateProfile };
