import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { authenticateAdmin, ADMIN_JWT_SECRET, query } from '../middleware/adminAuth.js';

const router = express.Router();

// Admin Login Page
router.get('/login', (req, res) => {
    res.render('admin/login');
});

// Admin Login Handler
router.post('/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        const admins = await query('SELECT * FROM admin WHERE username = ?', [username]);
        const admin = admins[0];

        if (!admin) {
            return res.render('admin/login', { error: 'Invalid credentials' });
        }

        // Check if this is the first login with default credentials
        if (admin.password === 'admin' && username === 'admin' && password === 'admin') {
            // Hash the default password for security
            const hashedPassword = await bcrypt.hash('admin', 10);
            await query('UPDATE admin SET password = ? WHERE id = ?', [hashedPassword, admin.id]);
        } else {
            // Verify password
            const validPassword = await bcrypt.compare(password, admin.password);
            if (!validPassword) {
                return res.render('admin/login', { error: 'Invalid credentials' });
            }
        }

        // Create JWT token
        const token = jwt.sign(
            { id: admin.id, username: admin.username, isAdmin: true },
            ADMIN_JWT_SECRET,
            { expiresIn: '24h' }
        );

        // Set cookie
        res.cookie('adminToken', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 24 * 60 * 60 * 1000 // 24 hours
        });

        res.redirect('/admin/dashboard');
    } catch (error) {
        console.error('Admin login error:', error);
        res.render('admin/login', { error: 'Login failed' });
    }
});

// Admin Dashboard
router.get('/dashboard', authenticateAdmin, async (req, res) => {
    try {
        // Fetch users
        const users = await query('SELECT * FROM users ORDER BY created_at DESC');
        
        // Fetch devices with owner information
        const devices = await query(`
            SELECT d.*, u.username 
            FROM devices d 
            JOIN users u ON d.user_id = u.id 
            ORDER BY d.created_at DESC
        `);

        res.render('admin/dashboard', { users, devices });
    } catch (error) {
        console.error('Dashboard error:', error);
        res.status(500).send('Error loading dashboard');
    }
});

// Add New User
router.post('/users/add', authenticateAdmin, async (req, res) => {
    const { username, email, password } = req.body;

    try {
        // Check if username or email already exists
        const existingUser = await query(
            'SELECT * FROM users WHERE username = ? OR email = ?',
            [username, email]
        );

        if (existingUser.length > 0) {
            return res.status(400).send('Username or email already exists');
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Insert new user
        await query(
            'INSERT INTO users (username, email, password, status) VALUES (?, ?, ?, ?)',
            [username, email, hashedPassword, 'active']
        );

        res.redirect('/admin/dashboard');
    } catch (error) {
        console.error('Error adding user:', error);
        res.status(500).send('Error adding user');
    }
});

// Delete User
router.post('/users/:id/delete', authenticateAdmin, async (req, res) => {
    const userId = req.params.id;

    try {
        // First get all devices for this user
        const devices = await query('SELECT id FROM devices WHERE user_id = ?', [userId]);
        
        // Delete readnpk records for all user's devices
        for (const device of devices) {
            await query('DELETE FROM readnpk WHERE device_id = ?', [device.id]);
        }
        
        // Delete readnpk records associated with the user
        await query('DELETE FROM readnpk WHERE user_id = ?', [userId]);
        
        // Delete growing areas associated with the user
        await query('DELETE FROM growing_areas WHERE user_id = ?', [userId]);
        
        // Delete the devices
        await query('DELETE FROM devices WHERE user_id = ?', [userId]);
        
        // Finally delete the user
        await query('DELETE FROM users WHERE id = ?', [userId]);
        
        res.redirect('/admin/dashboard');
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).send('Error deleting user');
    }
});

// Delete Device
router.post('/devices/:id/delete', authenticateAdmin, async (req, res) => {
    const deviceId = req.params.id;

    try {
        // First get the device's user_id
        const [device] = await query('SELECT user_id FROM devices WHERE id = ?', [deviceId]);
        
        if (!device) {
            return res.status(404).send('Device not found');
        }

        // Update readnpk records to set user_id and remove device_id
        await query(
            'UPDATE readnpk SET user_id = ?, device_id = NULL WHERE device_id = ?',
            [device.user_id, deviceId]
        );
        
        // Then delete the device
        await query('DELETE FROM devices WHERE id = ?', [deviceId]);
        
        res.redirect('/admin/dashboard');
    } catch (error) {
        console.error('Error deleting device:', error);
        res.status(500).send('Error deleting device');
    }
});

// Toggle User Status
router.post('/users/:id/toggle', authenticateAdmin, async (req, res) => {
    const userId = req.params.id;
    try {
        const [user] = await query('SELECT status FROM users WHERE id = ?', [userId]);
        if (!user) {
            return res.status(404).send('User not found');
        }

        const newStatus = user.status === 'active' ? 'inactive' : 'active';
        await query('UPDATE users SET status = ? WHERE id = ?', [newStatus, userId]);
        
        res.redirect('/admin/dashboard');
    } catch (error) {
        console.error('Error toggling user status:', error);
        res.status(500).send('Error updating user status');
    }
});

// Toggle Device Status
router.post('/devices/:id/toggle', authenticateAdmin, async (req, res) => {
    const deviceId = req.params.id;
    try {
        const [device] = await query('SELECT status FROM devices WHERE id = ?', [deviceId]);
        if (!device) {
            return res.status(404).send('Device not found');
        }

        const newStatus = device.status === 'active' ? 'inactive' : 'active';
        await query('UPDATE devices SET status = ? WHERE id = ?', [newStatus, deviceId]);
        
        res.redirect('/admin/dashboard');
    } catch (error) {
        console.error('Error toggling device status:', error);
        res.status(500).send('Error updating device status');
    }
});

// Update Admin Credentials
router.post('/settings/update-credentials', authenticateAdmin, async (req, res) => {
    const { currentPassword, newUsername, newPassword, confirmPassword } = req.body;

    try {
        // Verify current admin
        const [admin] = await query('SELECT * FROM admin WHERE id = ?', [req.admin.id]);
        const validPassword = await bcrypt.compare(currentPassword, admin.password);

        if (!validPassword) {
            return res.status(400).send('Current password is incorrect');
        }

        if (newPassword !== confirmPassword) {
            return res.status(400).send('New passwords do not match');
        }

        // Update credentials
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await query(
            'UPDATE admin SET username = ?, password = ? WHERE id = ?',
            [newUsername, hashedPassword, req.admin.id]
        );

        // Clear admin token and redirect to login
        res.clearCookie('adminToken');
        res.redirect('/admin/login');
    } catch (error) {
        console.error('Error updating admin credentials:', error);
        res.status(500).send('Error updating credentials');
    }
});

// Admin Logout
router.get('/logout', (req, res) => {
    res.clearCookie('adminToken');
    res.redirect('/admin/login');
});

export default router;
