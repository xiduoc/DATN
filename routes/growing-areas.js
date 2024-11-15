const express = require('express');
const router = express.Router();
const { authenticateUser } = require('../middleware/auth');
const { query } = require('../config/database');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure multer for file uploads
const uploadsDir = path.join(__dirname, '..', 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadsDir)
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
        cb(null, uniqueSuffix + path.extname(file.originalname))
    }
});

const upload = multer({ 
    storage: storage,
    fileFilter: function(req, file, cb) {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only JPEG, PNG and GIF are allowed.'));
        }
    },
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    }
});

// Image upload endpoint for TinyMCE
router.post('/upload-image', authenticateUser, upload.single('file'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        // Return the URL of the uploaded file
        const fileUrl = '/uploads/' + req.file.filename;
        res.json({
            location: fileUrl // TinyMCE expects the image URL in the "location" field
        });
    } catch (error) {
        console.error('Error uploading image:', error);
        res.status(500).json({ error: 'Error uploading image' });
    }
});

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
