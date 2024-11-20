import express from 'express';
import { authenticateUser } from '../middleware/auth.js';

const router = express.Router();

// Dashboard view
router.get('/', authenticateUser, (req, res) => {
    res.render('index');
});

// Map view
router.get('/map', authenticateUser, (req, res) => {
    res.render('map');
});

// Chart view
router.get('/chart', authenticateUser, (req, res) => {
    res.render('chart');
});

export default router;
