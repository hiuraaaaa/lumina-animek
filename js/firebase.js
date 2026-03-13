// ── FIREBASE CONFIG ──
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
                uid:          user.uid,
                email:        user.email,
                displayName:  user.displayName || extra.displayName || 'Anon',
                photoURL:     user.photoURL || null,
                createdAt:    serverTimestamp(),
                watchlist:    [],
                watchedCount: 0,
                watchHistory: [],
                bio:          '',
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

    // ── TRACK WATCHED EPISODE ──
    async function trackWatchedEpisode(uid, episode) {
        // episode = { slug, title, seriesName, seriesUrl }
        try {
            const ref  = doc(db, 'users', uid);
            const snap = await getDoc(ref);
            if (!snap.exists()) return;

            const data        = snap.data();
            const history     = data.watchHistory || [];
            const alreadySeen = history.some(h => h.slug === episode.slug);

            // Update timestamp kalau sudah ada, tambah baru kalau belum
            const newHistory = alreadySeen
                ? history.map(h => h.slug === episode.slug
                    ? { ...h, watchedAt: Date.now() }
                    : h)
                : [{ ...episode, watchedAt: Date.now() }, ...history].slice(0, 200);

            const watchedCount = alreadySeen
                ? (data.watchedCount || 0)
                : (data.watchedCount || 0) + 1;

            await updateDoc(ref, { watchHistory: newHistory, watchedCount });
        } catch(e) {
            console.warn('trackWatchedEpisode error:', e.message);
        }
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
        trackWatchedEpisode,
        friendlyError,
        doc, setDoc, getDoc, updateDoc, serverTimestamp,
    };

    window.dispatchEvent(new Event('firebase-ready'));
})();
