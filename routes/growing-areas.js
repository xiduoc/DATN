const express = require('express');
const router = express.Router();
const { authenticateUser } = require('../middleware/auth');
const { query } = require('../config/database');

// Get all growing areas
router.get('/', authenticateUser, async (req, res) => {
    try {
        const areas = await query(
            'SELECT * FROM growing_areas WHERE user_id = ? ORDER BY created_at DESC',
            [req.user.id]
        );
        res.render('growing-areas', { areas });
    } catch (error) {
        console.error('Error fetching growing areas:', error);
        res.status(500).send('Error fetching growing areas');
    }
});

// Add new growing area
router.post('/add', authenticateUser, async (req, res) => {
    const { name, description, location, area, crop_type } = req.body;
    try {
        await query(
            'INSERT INTO growing_areas (user_id, name, description, location, area, crop_type) VALUES (?, ?, ?, ?, ?, ?)',
            [req.user.id, name, description, location, area, crop_type]
        );
        res.redirect('/growing-areas');
    } catch (error) {
        console.error('Error adding growing area:', error);
        res.status(500).send('Error adding growing area');
    }
});

// Update growing area
router.post('/:id/update', authenticateUser, async (req, res) => {
    const { name, description, location, area, crop_type, status } = req.body;
    try {
        await query(
            'UPDATE growing_areas SET name = ?, description = ?, location = ?, area = ?, crop_type = ?, status = ? WHERE id = ? AND user_id = ?',
            [name, description, location, area, crop_type, status, req.params.id, req.user.id]
        );
        res.redirect('/growing-areas');
    } catch (error) {
        console.error('Error updating growing area:', error);
        res.status(500).send('Error updating growing area');
    }
});

// Delete growing area
router.post('/:id/delete', authenticateUser, async (req, res) => {
    try {
        await query(
            'DELETE FROM growing_areas WHERE id = ? AND user_id = ?',
            [req.params.id, req.user.id]
        );
        res.redirect('/growing-areas');
    } catch (error) {
        console.error('Error deleting growing area:', error);
        res.status(500).send('Error deleting growing area');
    }
});

module.exports = router;
