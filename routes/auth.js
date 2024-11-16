import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../middleware/auth.js';
import { query } from '../config/database.js';
import config from '../config/config.js';

const router = express.Router();

// Register page
router.get('/register', (req, res) => {
    res.render('register');
});

// Register handler
router.post('/register', async (req, res) => {
    const { username, email, password, confirm_password } = req.body;
    
    if (password !== confirm_password) {
        return res.render('register', { error: 'Passwords do not match' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        await query(
            'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
            [username, email, hashedPassword]
        );
        res.redirect('/login');
    } catch (error) {
        res.render('register', { error: 'Registration failed. Username or email may already exist.' });
    }
});

// Login page
router.get('/login', (req, res) => {
    res.render('login');
});

// Login handler
router.post('/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        const users = await query('SELECT * FROM users WHERE username = ?', [username]);
        const user = users[0];

        if (!user || !await bcrypt.compare(password, user.password)) {
            return res.render('login', { error: 'Invalid credentials' });
        }

        const token = jwt.sign(
            { id: user.id, username: user.username },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.cookie('token', token, {
            httpOnly: true,
            secure: config.NODE_ENV === 'production',
            maxAge: 24 * 60 * 60 * 1000 // 24 hours
        });

        res.redirect('/');
    } catch (error) {
        console.error('Login error:', error);
        res.render('login', { error: 'Login failed' });
    }
});

// Logout handler
router.get('/logout', (req, res) => {
    res.clearCookie('token');
    res.redirect('/login');
});

export default router;
