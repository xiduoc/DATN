const express = require('express');
const router = express.Router();
const { authenticateUser, generateApiKey } = require('../middleware/auth');
const { query } = require('../config/database');

// Get all devices
router.get('/', authenticateUser, async (req, res) => {
    try {
        const devices = await query(
            'SELECT * FROM devices WHERE user_id = ? ORDER BY created_at DESC',
            [req.user.id]
        );
        res.render('devices', { devices });
    } catch (error) {
        console.error('Error fetching devices:', error);
        res.status(500).send('Error fetching devices');
    }
});

// Create new device
router.post('/new', authenticateUser, async (req, res) => {
    const { name } = req.body;
    const apiKey = generateApiKey();

    try {
        await query(
            'INSERT INTO devices (name, api_key, user_id) VALUES (?, ?, ?)',
            [name, apiKey, req.user.id]
        );
        res.redirect('/devices');
    } catch (error) {
        console.error('Error creating device:', error);
        res.status(500).send('Error creating device');
    }
});

// Toggle device status
router.post('/:id/toggle', authenticateUser, async (req, res) => {
    const deviceId = req.params.id;
    
    try {
        const [device] = await query(
            'SELECT status FROM devices WHERE id = ? AND user_id = ?',
            [deviceId, req.user.id]
        );

        if (!device) {
            return res.status(404).send('Device not found');
        }

        const newStatus = device.status === 'active' ? 'inactive' : 'active';
        
        await query(
            'UPDATE devices SET status = ? WHERE id = ?',
            [newStatus, deviceId]
        );

        res.redirect('/devices');
    } catch (error) {
        console.error('Error toggling device:', error);
        res.status(500).send('Error toggling device status');
    }
});

module.exports = router;
