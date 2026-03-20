// api/admin.js
const express  = require('express');
const admin    = require('firebase-admin');
const router   = express.Router();

// ── FIREBASE ADMIN INIT ──
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId:   process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey:  (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
        })
    });
}
const db = admin.firestore();

// ── ADMIN EMAILS dari ENV ──
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean);

// ── MIDDLEWARE: cek admin ──
function requireAdmin(req, res, next) {
    const email = (req.headers['x-user-email'] || '').toLowerCase();
    if (!email || !ADMIN_EMAILS.includes(email)) {
        return res.status(403).json({ status: false, message: 'Forbidden' });
    }
    next();
}

// ── HELPER: serialize Firestore Timestamp → ISO string ──
function serializeUser(data) {
    const { watchHistory, ...safe } = data;
    if (safe.createdAt && typeof safe.createdAt.toDate === 'function') {
        safe.createdAt = safe.createdAt.toDate().toISOString();
    }
    return safe;
}

// ── CHECK ADMIN ──
router.get('/check', (req, res) => {
    const email = (req.headers['x-user-email'] || '').toLowerCase();
    res.json({ isAdmin: ADMIN_EMAILS.includes(email) });
});

// ── STATS ──
router.get('/stats', requireAdmin, async (req, res) => {
    try {
        const snapshot = await db.collection('users').get();
        const users    = snapshot.docs.map(d => d.data());

        const totalUsers     = users.length;
        const totalWatched   = users.reduce((sum, u) => sum + (u.watchedCount || 0), 0);
        const totalWatchlist = users.reduce((sum, u) => sum + (u.watchlist?.length || 0), 0);
        const activeUsers    = users.filter(u => (u.watchHistory?.length || 0) > 0).length;

        const animeCount = {};
        for (const u of users) {
            for (const h of (u.watchHistory || [])) {
                const key = h.seriesName || h.title || 'Unknown';
                animeCount[key] = (animeCount[key] || 0) + 1;
            }
        }
        const popularAnime = Object.entries(animeCount)
            .map(([title, count]) => ({ title, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);

        res.json({ status: true, stats: { totalUsers, totalWatched, totalWatchlist, activeUsers, popularAnime } });
    } catch(e) { res.status(500).json({ status: false, message: e.message }); }
});

// ── LIST USERS ──
router.get('/users', requireAdmin, async (req, res) => {
    try {
        const snapshot = await db.collection('users').get();
        const users    = snapshot.docs
            .map(d => serializeUser(d.data()))
            .sort((a, b) => {
                const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                return tb - ta;
            });
        res.json({ status: true, users });
    } catch(e) { res.status(500).json({ status: false, message: e.message }); }
});

// ── ANNOUNCEMENT PUBLIC (no auth) ──
router.get('/announcement-public', async (req, res) => {
    try {
        const snap = await db.collection('settings').doc('announcement').get();
        const ann  = snap.exists ? snap.data() : { title: '', text: '', active: false };
        const { updatedAt, ...safe } = ann;
        res.json({ status: true, announcement: safe });
    } catch(e) { res.status(500).json({ status: false, message: e.message }); }
});

// ── ANNOUNCEMENT (admin) ──
router.get('/announcement', requireAdmin, async (req, res) => {
    try {
        const snap = await db.collection('settings').doc('announcement').get();
        const ann  = snap.exists ? snap.data() : { title: '', text: '', active: false };
        res.json({ status: true, announcement: ann });
    } catch(e) { res.status(500).json({ status: false, message: e.message }); }
});

router.post('/announcement', requireAdmin, async (req, res) => {
    try {
        const { title, text, active } = req.body;
        await db.collection('settings').doc('announcement').set({
            title:     title  || '',
            text:      text   || '',
            active:    active === true || active === 'true',
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        res.json({ status: true, message: 'Announcement updated' });
    } catch(e) { res.status(500).json({ status: false, message: e.message }); }
});

// ── NOTIFICATIONS ──
// Kirim notif ke semua user atau user tertentu
router.post('/notifications/send', requireAdmin, async (req, res) => {
    try {
        const { title, message, target, uid, type = 'info' } = req.body;
        if (!title || !message) return res.status(400).json({ status: false, message: 'title dan message wajib diisi' });

        const notif = {
            title,
            message,
            type,   // info | warning | success | anime
            read:   false,
            sentAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        if (target === 'all') {
            // Broadcast ke semua user
            const snap  = await db.collection('users').get();
            const batch = db.batch();
            snap.docs.forEach(doc => {
                const ref = db.collection('notifications').doc(doc.id).collection('items').doc();
                batch.set(ref, notif);
            });
            await batch.commit();
            res.json({ status: true, message: `Notif terkirim ke ${snap.docs.length} user` });
        } else if (target === 'user' && uid) {
            // Kirim ke user tertentu
            await db.collection('notifications').doc(uid).collection('items').add(notif);
            res.json({ status: true, message: 'Notif terkirim ke user' });
        } else {
            res.status(400).json({ status: false, message: 'target harus "all" atau "user" dengan uid' });
        }
    } catch(e) { res.status(500).json({ status: false, message: e.message }); }
});

// List notif yang sudah dikirim (10 terakhir per user = skip, ambil dari broadcast log)
router.get('/notifications/history', requireAdmin, async (req, res) => {
    try {
        const snap = await db.collection('notification_log')
            .orderBy('sentAt', 'desc')
            .limit(20)
            .get();
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        res.json({ status: true, list });
    } catch(e) { res.status(500).json({ status: false, message: e.message }); }
});

module.exports = router;
