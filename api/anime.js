const express = require('express');
const https   = require('https');
const http    = require('http');
const router  = express.Router();

const API_BASE = process.env.API_BASE || 'https://www.sankavollerei.com/anime/oploverz';

function apiFetch(url) {
    return new Promise((resolve, reject) => {
        const client = url.startsWith('https') ? https : http;
        const req = client.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try { resolve(JSON.parse(data)); }
                catch(e) { reject(new Error('Invalid JSON response')); }
            });
        });
        req.on('error', reject);
        req.setTimeout(10000, () => { req.destroy(); reject(new Error('Request timeout')); });
    });
}

router.get('/home', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const data = await apiFetch(`${API_BASE}/home?page=${page}`);
        res.json({ status: true, ...data });
    } catch (e) { res.status(500).json({ status: false, message: e.message }); }
});

router.get('/schedule', async (req, res) => {
    try {
        const data = await apiFetch(`${API_BASE}/schedule`);
        res.json({ status: true, ...data });
    } catch (e) { res.status(500).json({ status: false, message: e.message }); }
});

router.get('/search', async (req, res) => {
    try {
        const { q = '', page = 1 } = req.query;
        if (!q.trim()) return res.status(400).json({ status: false, message: 'Query tidak boleh kosong' });
        const data = await apiFetch(`${API_BASE}/search?q=${encodeURIComponent(q)}&page=${page}`);
        res.json({ status: true, ...data });
    } catch (e) { res.status(500).json({ status: false, message: e.message }); }
});

router.get('/anime/:slug', async (req, res) => {
    try {
        const data = await apiFetch(`${API_BASE}/anime/${req.params.slug}`);
        res.json({ status: true, ...data });
    } catch (e) { res.status(500).json({ status: false, message: e.message }); }
});

router.get('/detail/:slug', async (req, res) => {
    try {
        const data = await apiFetch(`${API_BASE}/detail/${req.params.slug}`);
        res.json({ status: true, ...data });
    } catch (e) { res.status(500).json({ status: false, message: e.message }); }
});

router.get('/watch/:slug', async (req, res) => {
    try {
        const data = await apiFetch(`${API_BASE}/watch/${req.params.slug}`);
        res.json({ status: true, ...data });
    } catch (e) { res.status(500).json({ status: false, message: e.message }); }
});

module.exports = router;
