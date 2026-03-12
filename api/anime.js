// ============================================
//  ANIME API PROXY
//  Semua request ke sumber di-forward di sini
//  sehingga API key & CORS aman di server
// ============================================

const express = require('express');
const fetch   = require('node-fetch');
const router  = express.Router();

const API_BASE = process.env.API_BASE || 'https://www.sankavollerei.com/anime/oploverz';

// Helper fetch dengan timeout
async function apiFetch(url) {
    const controller = new AbortController();
    const timeout    = setTimeout(() => controller.abort(), 10000);
    try {
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) throw new Error(`Upstream error: ${res.status}`);
        return await res.json();
    } finally {
        clearTimeout(timeout);
    }
}

// ── GET /api/anime/home?page=1 ──
router.get('/home', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const data = await apiFetch(`${API_BASE}/home?page=${page}`);
        res.json({ status: true, ...data });
    } catch (e) {
        res.status(500).json({ status: false, message: e.message });
    }
});

// ── GET /api/anime/search?q=naruto&page=1 ──
router.get('/search', async (req, res) => {
    try {
        const { q = '', page = 1 } = req.query;
        if (!q.trim()) return res.status(400).json({ status: false, message: 'Query tidak boleh kosong' });
        const data = await apiFetch(`${API_BASE}/search?q=${encodeURIComponent(q)}&page=${page}`);
        res.json({ status: true, ...data });
    } catch (e) {
        res.status(500).json({ status: false, message: e.message });
    }
});

// ── GET /api/anime/detail/:slug ──
router.get('/detail/:slug', async (req, res) => {
    try {
        const data = await apiFetch(`${API_BASE}/detail/${req.params.slug}`);
        res.json({ status: true, ...data });
    } catch (e) {
        res.status(500).json({ status: false, message: e.message });
    }
});

// ── GET /api/anime/watch/:slug ──
router.get('/watch/:slug', async (req, res) => {
    try {
        const data = await apiFetch(`${API_BASE}/watch/${req.params.slug}`);
        res.json({ status: true, ...data });
    } catch (e) {
        res.status(500).json({ status: false, message: e.message });
    }
});

module.exports = router;
