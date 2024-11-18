import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';
import cryptoRandomString from 'crypto-random-string';
import { JWT_SECRET } from '../middleware/auth.js';
import { query } from '../config/database.js';
import config from '../config/config.js';

const router = express.Router();

// Email transporter setup
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: config.EMAIL.auth.user,
        pass: config.EMAIL.auth.pass
    }
});

// Validate email address
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

// Register page
router.get('/register', (req, res) => {
    res.render('register');
});

// Register handler
router.post('/register', async (req, res) => {
    const { username, email, password, confirm_password } = req.body;
    
    // Validate email
    if (!isValidEmail(email)) {
        return res.render('register', { 
            error: 'Please enter a valid email address' 
        });
    }

    if (password !== confirm_password) {
        return res.render('register', { 
            error: 'Passwords do not match' 
        });
    }

    try {
        // Check if email already exists
        const existingUsers = await query('SELECT * FROM users WHERE email = ?', [email]);
        if (existingUsers.length > 0) {
            return res.render('register', { 
                error: 'This email address is already registered' 
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        await query(
            'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
            [username, email, hashedPassword]
        );
        res.redirect('/login');
    } catch (error) {
        console.error('Registration error:', error);
        res.render('register', { 
            error: 'Registration failed. Username may already exist.' 
        });
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

// Forgot Password page
router.get('/forgot-password', (req, res) => {
    res.render('forgot-password');
});

// Forgot Password handler
router.post('/forgot-password', async (req, res) => {
    const { email } = req.body;

    // Validate email
    if (!isValidEmail(email)) {
        return res.render('forgot-password', { 
            error: 'Please enter a valid email address' 
        });
    }

    try {
        // Check if user exists
        const users = await query('SELECT * FROM users WHERE email = ?', [email]);
        if (users.length === 0) {
            return res.render('forgot-password', { 
                error: 'No account found with that email address' 
            });
        }

        // Generate reset token
        const token = cryptoRandomString({length: 32, type: 'url-safe'});
        const expiresAt = new Date(Date.now() + 3600000); // 1 hour from now

        // Save token to database
        await query(
            'INSERT INTO password_resets (email, token, expires_at) VALUES (?, ?, ?)',
            [email, token, expiresAt]
        );

        // Send reset email
        const resetLink = `${config.BASE_URL}/reset-password?token=${token}`;
        const mailOptions = {
            from: config.EMAIL.auth.user,
            to: email,
            subject: 'Password Reset Request',
            html: `
                <h1>Password Reset Request</h1>
                <p>You requested a password reset for your account. Click the link below to reset your password:</p>
                <a href="${resetLink}">${resetLink}</a>
                <p>This link will expire in 1 hour.</p>
                <p>If you didn't request this, please ignore this email.</p>
                <p>Note: This email was sent from our system account. Please do not reply to this email.</p>
            `
        };

        await transporter.sendMail(mailOptions);
        res.render('forgot-password', { 
            success: 'Password reset link has been sent to your email' 
        });

    } catch (error) {
        console.error('Forgot password error:', error);
        res.render('forgot-password', { 
            error: 'An error occurred. Please try again later.' 
        });
    }
});

// Reset Password page
router.get('/reset-password', async (req, res) => {
    const { token } = req.query;
    
    try {
        // Check if token exists and is valid
        const resets = await query(
            'SELECT * FROM password_resets WHERE token = ? AND used = FALSE AND expires_at > NOW()',
            [token]
        );

        if (resets.length === 0) {
            return res.render('forgot-password', { 
                error: 'Invalid or expired reset link. Please request a new one.' 
            });
        }

        res.render('reset-password', { token });

    } catch (error) {
        console.error('Reset password error:', error);
        res.render('forgot-password', { 
            error: 'An error occurred. Please try again later.' 
        });
    }
});

// Reset Password handler
router.post('/reset-password', async (req, res) => {
    const { token, password, confirm_password } = req.body;

    if (password !== confirm_password) {
        return res.render('reset-password', { 
            token,
            error: 'Passwords do not match' 
        });
    }

    try {
        // Get reset record and verify it's still valid
        const resets = await query(
            'SELECT * FROM password_resets WHERE token = ? AND used = FALSE AND expires_at > NOW()',
            [token]
        );

        if (resets.length === 0) {
            return res.render('forgot-password', { 
                error: 'Invalid or expired reset link. Please request a new one.' 
            });
        }

        const reset = resets[0];

        // Verify user still exists
        const users = await query('SELECT * FROM users WHERE email = ?', [reset.email]);
        if (users.length === 0) {
            return res.render('forgot-password', { 
                error: 'Account not found. Please contact support.' 
            });
        }

        // Update user's password
        const hashedPassword = await bcrypt.hash(password, 10);
        await query(
            'UPDATE users SET password = ? WHERE email = ?',
            [hashedPassword, reset.email]
        );

        // Mark reset token as used
        await query(
            'UPDATE password_resets SET used = TRUE WHERE token = ?',
            [token]
        );

        res.render('login', { 
            success: 'Password has been reset successfully. Please login with your new password.' 
        });

    } catch (error) {
        console.error('Reset password error:', error);
        res.render('reset-password', { 
            token,
            error: 'An error occurred. Please try again later.' 
        });
    }
});

// Logout handler
router.get('/logout', (req, res) => {
    res.clearCookie('token');
    res.redirect('/login');
});

export default router;
