try { require('dotenv').config(); } catch(e) {}

const express = require('express');
const cors    = require('cors');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use('/css',    express.static(path.join(__dirname, 'css')));
app.use('/js',     express.static(path.join(__dirname, 'js')));
app.use('/assets', express.static(path.join(__dirname, 'assets')));

app.use('/api/anime', require('./api/anime'));
app.use('/api/admin', require('./api/admin'));

const pub   = (file) => path.join(__dirname, 'public', file);
const pages = (file) => path.join(__dirname, 'public/pages', file);

app.get('/favicon.ico', (req, res) => res.sendFile(path.join(__dirname, 'assets', 'favicon.ico')));

// ── MAIN PAGES ──
app.get('/',            (req, res) => res.sendFile(pub('index.html')));
app.get('/ongoing',     (req, res) => res.sendFile(pub('browse.html')));
app.get('/complete',    (req, res) => res.sendFile(pub('browse.html')));
app.get('/search',      (req, res) => res.sendFile(pub('search.html')));
app.get('/detail',      (req, res) => res.sendFile(pub('detail.html')));
app.get('/watch',       (req, res) => res.sendFile(pub('watch.html')));
app.get('/schedule',    (req, res) => res.sendFile(pub('schedule.html')));
app.get('/genre',       (req, res) => res.sendFile(pub('genre.html')));
app.get('/login',       (req, res) => res.sendFile(pub('login.html')));
app.get('/profile',     (req, res) => res.sendFile(pub('profile.html')));
app.get('/watchlist',   (req, res) => res.sendFile(pub('watchlist.html')));
app.get('/list',        (req, res) => res.sendFile(pub('list.html')));
app.get('/contact',     (req, res) => res.sendFile(pub('contact.html')));
app.get('/history',     (req, res) => res.sendFile(pub('history.html')));

// ── ADMIN ──
app.get('/admin',       (req, res) => res.sendFile(pub('admin.html')));
app.get('/admin/login', (req, res) => res.sendFile(pub('admin-login.html')));

// ── PAGES ──
app.get('/about',       (req, res) => res.sendFile(pages('about.html')));
app.get('/privacy',     (req, res) => res.sendFile(pages('privacy.html')));
app.get('/terms',       (req, res) => res.sendFile(pages('terms.html')));

// ── 404 ──
app.use((req, res) => {
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({ status: false, message: 'Not Found' });
    }
    res.status(404).sendFile(pub('404.html'));
});

if (require.main === module) {
    app.listen(PORT, () => console.log(`🚀 http://localhost:${PORT}`));
}

module.exports = app;
