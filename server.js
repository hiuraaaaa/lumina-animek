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

const pub = (file) => path.join(__dirname, 'public', file);

app.get('/',          (req, res) => res.sendFile(pub('index.html')));
app.get('/search',    (req, res) => res.sendFile(pub('search.html')));
app.get('/detail',    (req, res) => res.sendFile(pub('detail.html')));
app.get('/watch',     (req, res) => res.sendFile(pub('watch.html')));
app.get('/schedule',  (req, res) => res.sendFile(pub('schedule.html')));
app.get('/genre',     (req, res) => res.sendFile(pub('genre.html')));
app.get('/login',     (req, res) => res.sendFile(pub('login.html')));
app.get('/profile',   (req, res) => res.sendFile(pub('profile.html')));
app.get('/watchlist', (req, res) => res.sendFile(pub('watchlist.html')));
app.get('/list', (req, res) => res.sendFile(pub('list.html')));
app.get('/admin',       (req, res) => res.sendFile(pub('admin.html')));
app.get('/admin/login', (req, res) => res.sendFile(pub('admin-login.html')));
app.use((req, res) => res.status(404).json({ status: false, message: 'Not Found' }));

if (require.main === module) {
    app.listen(PORT, () => console.log(`🚀 http://localhost:${PORT}`));
}

module.exports = app;
