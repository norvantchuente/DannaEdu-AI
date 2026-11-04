const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

router.get('/register', authController.renderRegister);
router.post('/register', authController.handleRegister);

router.get('/login', authController.renderLogin);
router.post('/login', authController.handleLogin);

// Route de déconnexion
router.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error("Error while destroying the session:", err);
        }
        res.redirect('/login');
    });
});

module.exports = router;