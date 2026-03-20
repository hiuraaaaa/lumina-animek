// ── FIREBASE CONFIG ──
(async function() {
    const { initializeApp }          = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js");
    const { getAuth, onAuthStateChanged, signInWithEmailAndPassword,
            createUserWithEmailAndPassword, signInWithPopup,
            GoogleAuthProvider, signOut, updateProfile }
        = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js");
    const { getFirestore, doc, setDoc, getDoc, updateDoc, serverTimestamp,
            collection, query, where, orderBy, getDocs, writeBatch, addDoc }
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

    // ── BAN OVERLAY ──
    function showBanOverlay() {
        const path = window.location.pathname;
        if (path.startsWith('/login') || path.startsWith('/admin')) return;

        document.body.style.overflow = 'hidden';
        document.body.style.position = 'fixed';
        document.body.style.width    = '100%';

        const overlay = document.createElement('div');
        overlay.id = 'ban-overlay';
        overlay.style.cssText = `
            position: fixed; inset: 0; z-index: 99999;
            background: rgba(8,8,8,0.97);
            backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
            display: flex; align-items: center; justify-content: center;
            padding: 24px; overscroll-behavior: none; touch-action: none;
        `;
        overlay.innerHTML = `
            <div style="display:flex;flex-direction:column;align-items:center;gap:16px;text-align:center;max-width:320px">
                <svg width="48" height="48" fill="none" stroke="#ef4444" stroke-width="1.5" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
                </svg>
                <div style="font-family:'Outfit',sans-serif;font-size:20px;font-weight:800;color:#f0f0f0;letter-spacing:-0.3px">Akun Dibanned</div>
                <div style="width:32px;height:2px;background:rgba(239,68,68,0.5)"></div>
                <div style="font-size:13px;color:#888;line-height:1.7">Akun kamu telah dinonaktifkan oleh admin karena melanggar ketentuan layanan LunarStream.</div>
                <div style="font-size:11px;color:#444;font-family:'Outfit',sans-serif;padding:10px 14px;border:1px solid rgba(239,68,68,0.2);background:rgba(239,68,68,0.05);border-left:2px solid #ef4444;text-align:left;line-height:1.6">
                    Jika kamu merasa ini adalah kesalahan, hubungi kami melalui halaman <a href="/contact" style="color:#ef4444;text-decoration:none;font-weight:700">Hubungi Kami</a>.
                </div>
                <button onclick="window._doBanLogout()" style="width:100%;padding:13px;background:rgba(239,68,68,0.1);color:#fca5a5;border:1px solid rgba(239,68,68,0.3);font-family:'Outfit',sans-serif;font-size:11px;font-weight:800;letter-spacing:0.8px;text-transform:uppercase;cursor:pointer;">Keluar dari Akun</button>
            </div>
        `;
        document.body.appendChild(overlay);
        window._doBanLogout = async () => { await signOut(auth); window.location.href = '/login'; };
    }

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
                banned:       false,
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

    // ── NOTIFICATIONS ──
    async function getNotifications(uid) {
        try {
            const q    = query(collection(db, 'notifications', uid, 'items'), orderBy('sentAt', 'desc'));
            const snap = await getDocs(q);
            return snap.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch(e) { return []; }
    }

    async function getUnreadCount(uid) {
        try {
            const q    = query(collection(db, 'notifications', uid, 'items'), where('read', '==', false));
            const snap = await getDocs(q);
            return snap.size;
        } catch(e) { return 0; }
    }

    async function markNotifRead(uid, notifId) {
        try {
            await updateDoc(doc(db, 'notifications', uid, 'items', notifId), { read: true });
        } catch(e) {}
    }

    async function markAllNotifsRead(uid) {
        try {
            const q     = query(collection(db, 'notifications', uid, 'items'), where('read', '==', false));
            const snap  = await getDocs(q);
            const batch = writeBatch(db);
            snap.docs.forEach(d => batch.update(d.ref, { read: true }));
            await batch.commit();
        } catch(e) {}
    }

    // ── TRACK WATCHED EPISODE ──
    async function trackWatchedEpisode(uid, episode) {
        try {
            const ref  = doc(db, 'users', uid);
            const snap = await getDoc(ref);
            if (!snap.exists()) return;

            const data        = snap.data();
            const history     = data.watchHistory || [];
            const alreadySeen = history.some(h => h.slug === episode.slug);

            const newHistory = alreadySeen
                ? history.map(h => h.slug === episode.slug ? { ...h, watchedAt: Date.now() } : h)
                : [{ ...episode, watchedAt: Date.now() }, ...history].slice(0, 200);

            const watchedCount = alreadySeen ? (data.watchedCount || 0) : (data.watchedCount || 0) + 1;
            await updateDoc(ref, { watchHistory: newHistory, watchedCount });
        } catch(e) { console.warn('trackWatchedEpisode error:', e.message); }
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

    // ── WRAPPED onAuthStateChanged — auto check banned ──
    function _onAuthStateChanged(authInstance, callback) {
        return onAuthStateChanged(authInstance, async (user) => {
            if (user) {
                try {
                    const profile = await getUserProfile(user.uid);
                    if (profile?.banned === true) {
                        showBanOverlay();
                        return;
                    }
                } catch(e) { console.warn('ban check error:', e.message); }
            }
            callback(user);
        });
    }

    window.FB = {
        auth, db, googleProvider,
        onAuthStateChanged: _onAuthStateChanged,
        signInWithEmailAndPassword,
        createUserWithEmailAndPassword,
        signInWithPopup,
        signOut,
        updateProfile,
        createUserProfile,
        getUserProfile,
        updateUserProfile,
        trackWatchedEpisode,
        getNotifications,
        getUnreadCount,
        markNotifRead,
        markAllNotifsRead,
        friendlyError,
        // Firestore helpers
        doc, setDoc, getDoc, updateDoc, serverTimestamp,
        collection, query, where, orderBy, getDocs, writeBatch, addDoc,
    };

    window.dispatchEvent(new Event('firebase-ready'));
})();
