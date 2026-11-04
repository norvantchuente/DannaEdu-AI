const bcrypt = require('bcryptjs');
const pool = require('../config/db');

// Render registration page
exports.renderRegister = (req, res) => {
    res.render('register', { title: 'DannaEdu AI - Register', error: null });
};

// Handle registration
exports.handleRegister = async (req, res) => {
    try {
        const { name, email, password, language, level } = req.body;

        // Check if email already exists
        const [existing] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
        if (existing.length > 0) {
            return res.render('register', { title: 'DannaEdu AI - Register', error: 'This email is already in use.' });
        }

        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Insert into database
        await pool.query(
            'INSERT INTO users (name, email, password_hash, language, level) VALUES (?, ?, ?, ?, ?)',
            [name, email, hashedPassword, language || 'English', level || 'Beginner']
        );

        res.redirect('/login');
    } catch (err) {
        console.error("Registration error:", err.message);
        res.render('register', { title: 'DannaEdu AI - Register', error: 'An error occurred during registration.' });
    }
};

// Render login page
exports.renderLogin = (req, res) => {
    res.render('login', { title: 'DannaEdu AI - Login', error: null });
};

// Handle login
exports.handleLogin = async (req, res) => {
    try {
        const { email, password } = req.body;

        const [users] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
        if (users.length === 0) {
            return res.render('login', { title: 'DannaEdu AI - Login', error: 'Invalid email or password.' });
        }

        const user = users[0];
        const isMatch = await bcrypt.compare(password, user.password_hash);

        if (!isMatch) {
            return res.render('login', { title: 'DannaEdu AI - Login', error: 'Invalid email or password.' });
        }

        // Save user into session
        req.session.user = {
            id: user.id,
            name: user.name,
            email: user.email,
            language: user.language,
            level: user.level
        };

        res.redirect('/');
    } catch (err) {
        console.error("Login error:", err.message);
        res.render('login', { title: 'DannaEdu AI - Login', error: 'An error occurred during login.' });
    }
};

// Logout
exports.handleLogout = (req, res) => {
    req.session.destroy(() => {
        res.redirect('/login');
    });
};