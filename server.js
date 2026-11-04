const express = require('express');
const fs = require('fs');
const path = require('path');
const session = require('express-session');
const uploadDir = path.join(__dirname, 'public', 'uploads');
require('dotenv').config();

// Dynamic courses directory setup
const dynamicCoursesDir = path.join(__dirname, 'content/dynamic-courses');
if (!fs.existsSync(dynamicCoursesDir)) {
    fs.mkdirSync(dynamicCoursesDir, { recursive: true });
    console.log("📁 Folder content/dynamic-courses successfully created!");
}

// 1. Ensure upload directory exists at startup
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// 2. Automatic cleanup function for files older than 24 hours
function cleanOldUploads() {
    fs.readdir(uploadDir, (err, files) => {
        if (err) {
            console.error("Error reading uploads directory:", err);
            return;
        }

        const now = Date.now();
        const maxAgeMs = 24 * 60 * 60 * 1000; // 24 hours

        files.forEach(file => {
            // Ignore .gitkeep if present
            if (file === '.gitkeep') return;

            const filePath = path.join(uploadDir, file);
            fs.stat(filePath, (err, stats) => {
                if (err) return;

                // Delete if older than 24h
                if ((now - stats.mtimeMs) > maxAgeMs) {
                    fs.unlink(filePath, err => {
                        if (!err) {
                            console.log(`🗑️ [Cleanup] Expired temporary file deleted: ${file}`);
                        }
                    });
                }
            });
        });
    });
}

// Run cleanup at server startup, then every 12 hours
cleanOldUploads();
setInterval(cleanOldUploads, 12 * 60 * 60 * 1000);

const app = express();
const PORT = process.env.PORT || 5000;

// Import DB connection (to test at startup)
require('./src/config/db');

// EJS template engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'src/views'));

// Middlewares
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// Static folder for public assets (CSS, uploads, etc.)
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
    secret: 'dannaedu_secret_hackathon_2026',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false } // true if HTTPS in production
}));

// Make user available in all EJS views
app.use((req, res, next) => {
    res.locals.user = req.session.user || null;
    next();
});

// Import and use authentication routes
const authRoutes = require('./src/routes/authRoutes');
app.use('/', authRoutes);

// Import and use main application routes
const educationRoutes = require('./src/routes/educationRoutes');
app.use('/', educationRoutes);

// Global 404 error handler
app.use((req, res) => {
    res.status(404).render('index', { 
        title: 'DannaEdu AI - Page Not Found', 
        error: 'The requested page could not be found.',
        resultText: null,
        imageUrl: null,
        transcription: null,
        segmentResult: null
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 DannaEdu AI is running on http://localhost:${PORT}`);
});