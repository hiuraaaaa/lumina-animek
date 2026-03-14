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

        // Popular anime dari watchHistory semua user
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
        const snapshot = await db.collection('users').orderBy('createdAt', 'desc').get();
        const users    = snapshot.docs.map(d => {
            const data = d.data();
            // Hapus watchHistory dari response (terlalu besar)
            const { watchHistory, ...safe } = data;
            return safe;
        });
        res.json({ status: true, users });
    } catch(e) { res.status(500).json({ status: false, message: e.message }); }
});

module.exports = router;
