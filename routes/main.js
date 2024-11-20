import express from 'express';
import { authenticateUser } from '../middleware/auth.js';
import { query } from '../config/database.js';
import config from '../config/config.js';

const router = express.Router();

// Dashboard
router.get('/', authenticateUser, async (req, res) => {
    try {
        const { fromDate = config.DEFAULT_DATE_RANGE.start, toDate = config.DEFAULT_DATE_RANGE.end } = req.query;
        
        const results = await query(
            `SELECT r.*, DATE_FORMAT(r.created_at, "%Y-%m-%d %H:%i:%s") as formatted_timestamp 
             FROM readnpk r
             LEFT JOIN devices d ON r.device_id = d.id
             WHERE (d.user_id = ? OR r.user_id = ?) AND r.created_at BETWEEN ? AND ?`,
            [req.user.id, req.user.id, fromDate, toDate]
        );
        
        res.render('index', { data: results });
    } catch (error) {
        console.error('Index route error:', error);
        res.status(500).send('Server error');
    }
});

// Map view
router.get('/map', authenticateUser, async (req, res) => {
    try {
        const { fromDate = config.DEFAULT_DATE_RANGE.start, toDate = config.DEFAULT_DATE_RANGE.end } = req.query;

        const results = await query(`
            WITH RankedData AS (
                SELECT 
                    r.*,
                    DATE_FORMAT(r.created_at, '%Y-%m-%d %H:%i:%s') as formatted_timestamp,
                    ROW_NUMBER() OVER (PARTITION BY r.latitude, r.longitude ORDER BY r.created_at DESC) as rn
                FROM readnpk r
                LEFT JOIN devices d ON r.device_id = d.id
                WHERE (d.user_id = ? OR r.user_id = ?) 
                    AND r.latitude IS NOT NULL 
                    AND r.longitude IS NOT NULL
                    AND r.created_at BETWEEN ? AND ?
            )
            SELECT * FROM RankedData WHERE rn = 1
        `, [req.user.id, req.user.id, fromDate, toDate]);
        
        res.render('map', { points: results });
    } catch (error) {
        console.error('Map route error:', error);
        res.status(500).send('Server error');
    }
});

// Chart view
router.get('/chart', authenticateUser, (req, res) => {
    res.render('chart');
});

export default router;
