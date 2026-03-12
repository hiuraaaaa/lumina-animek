try { require('dotenv').config(); } catch(e) {}

const express = require('express');
const cors    = require('cors');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;

app.set('json spaces', 2);
app.set('trust proxy', true);
app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use('/css',    express.static(path.join(__dirname, 'css')));
app.use('/js',     express.static(path.join(__dirname, 'js')));
app.use('/assets', express.static(path.join(__dirname, 'assets')));

app.use('/api/anime', require('./api/anime'));

const pub = (file) => path.join(__dirname, 'public', file);

app.get('/',         (req, res) => res.sendFile(pub('index.html')));
app.get('/search',   (req, res) => res.sendFile(pub('search.html')));
app.get('/detail',   (req, res) => res.sendFile(pub('detail.html')));
app.get('/watch',    (req, res) => res.sendFile(pub('watch.html')));
app.get('/schedule', (req, res) => res.sendFile(pub('schedule.html')));

app.use((req, res) => res.status(404).json({ status: false, message: 'Not Found' }));
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ status: false, message: 'Internal Server Error' });
});

if (require.main === module) {
    app.listen(PORT, () => console.log(`🚀 http://localhost:${PORT}`));
}

module.exports = app;
