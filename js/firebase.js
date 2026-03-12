// ── FIREBASE CONFIG ──
// Menggunakan CDN langsung, expose ke window global

(async function() {
    const { initializeApp }          = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js");
    const { getAuth, onAuthStateChanged, signInWithEmailAndPassword,
            createUserWithEmailAndPassword, signInWithPopup,
            GoogleAuthProvider, signOut, updateProfile }
        = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js");
    const { getFirestore, doc, setDoc, getDoc, updateDoc, serverTimestamp }
        = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");

    const firebaseConfig = {
        apiKey:            "AIzaSyAqhahm0Vp_InpPzqn-niUnismdSfjO5gY",
        authDomain:        "anime-d0055.firebaseapp.com",
        projectId:         "anime-d0055",
        storageBucket:     "anime-d0055.firebasestorage.app",
        messagingSenderId: "271967142358",
        appId:             "1:271967142358:web:e863d464499ff44f9fe477"
    };

    const app            = initializeApp(firebaseConfig);
    const auth           = getAuth(app);
    const db             = getFirestore(app);
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
                photoURL:    user.photoURL || null,
                createdAt:   serverTimestamp(),
                watchlist:   [],
                watchedCount: 0,
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

    function friendlyError(code) {
        const map = {
            'auth/user-not-found':         'Email tidak terdaftar',
            'auth/wrong-password':         'Password salah',
            'auth/invalid-credential':     'Email atau password salah',
            'auth/email-already-in-use':   'Email sudah dipakai',
            'auth/invalid-email':          'Format email tidak valid',
            'auth/weak-password':          'Password terlalu lemah',
            'auth/too-many-requests':      'Terlalu banyak percobaan, coba lagi nanti',
            'auth/network-request-failed': 'Cek koneksi internet kamu',
            'auth/popup-closed-by-user':   '',
        };
        return map[code] || 'Terjadi kesalahan, coba lagi';
    }

    // Expose ke window global
    window.FB = {
        auth, db, googleProvider,
        onAuthStateChanged,
        signInWithEmailAndPassword,
        createUserWithEmailAndPassword,
        signInWithPopup,
        signOut,
        updateProfile,
        createUserProfile,
        getUserProfile,
        updateUserProfile,
        friendlyError,
        doc, setDoc, getDoc, updateDoc, serverTimestamp,
    };

    // Dispatch event supaya halaman tahu Firebase udah siap
    window.dispatchEvent(new Event('firebase-ready'));
})();
