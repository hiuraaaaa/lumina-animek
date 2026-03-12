// ============================================
//  SERVER.JS — Anime Streaming App
// ============================================

require('dotenv').config();

const express = require('express');
const cors    = require('cors');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ──
app.set('json spaces', 2);
app.set('trust proxy', true);
app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// ── Static Files ──
// CSS & JS bisa diakses dari /css dan /js
app.use('/css',    express.static(path.join(__dirname, 'css')));
app.use('/js',     express.static(path.join(__dirname, 'js')));
app.use('/assets', express.static(path.join(__dirname, 'assets')));

// ── API Routes ──
app.use('/api/anime', require('./api/anime'));

// ── HTML Routes ──
const pub = (file) => path.join(__dirname, 'public', file);

app.get('/',        (req, res) => res.sendFile(pub('index.html')));
app.get('/search',  (req, res) => res.sendFile(pub('search.html')));
app.get('/detail',  (req, res) => res.sendFile(pub('detail.html')));
app.get('/watch',   (req, res) => res.sendFile(pub('watch.html')));

// ── 404 ──
app.use((req, res) => {
    res.status(404).json({ status: false, message: 'Not Found' });
});

// ── 500 ──
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ status: false, message: 'Internal Server Error' });
});

app.listen(PORT, () => {
    console.log(`\n🚀 Server running at http://localhost:${PORT}`);
    console.log(`   ENV      : ${process.env.NODE_ENV || 'development'}`);
    console.log(`   API Base : ${process.env.API_BASE || 'https://www.sankavollerei.com/anime/oploverz'}\n`);
});

module.exports = app;
