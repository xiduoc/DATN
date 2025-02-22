import express from 'express';
import { authenticateUser } from '../../middleware/auth.js';
import { query } from '../../config/database.js';
import config from '../../config/config.js';
import ExcelJS from 'exceljs';

const router = express.Router();

// Get dashboard data
router.get('/dashboard', authenticateUser, async (req, res) => {
    try {
        const { fromDate = config.DEFAULT_DATE_RANGE.start, toDate = config.DEFAULT_DATE_RANGE.end } = req.query;
        
        const results = await query(
            `SELECT r.*, DATE_FORMAT(r.created_at, "%Y-%m-%d %H:%i:%s") as formatted_timestamp 
             FROM readnpk r
             LEFT JOIN devices d ON r.device_id = d.id
             WHERE (d.user_id = ? OR r.user_id = ?) AND r.created_at BETWEEN ? AND ?`,
            [req.user.id, req.user.id, fromDate, toDate]
        );
        
        res.json(results);
    } catch (error) {
        console.error('Dashboard data error:', error);
        res.status(500).json({ error: 'Failed to fetch dashboard data' });
    }
});

// Get map data
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
        
        res.json(results);
    } catch (error) {
        console.error('Map data error:', error);
        res.status(500).json({ error: 'Failed to fetch map data' });
    }
});

// Get chart data
router.get('/chart', authenticateUser, async (req, res) => {
    try {
        const { start = config.DEFAULT_DATE_RANGE.start, end = config.DEFAULT_DATE_RANGE.end } = req.query;
        
        const results = await query(`
            SELECT 
                r.created_at as timestamp,
                r.humidity,
                r.temperature,
                r.conductivity,
                r.ph,
                r.nitrogen,
                r.phosphorus,
                r.potassium,
                r.location
            FROM readnpk r
            LEFT JOIN devices d ON r.device_id = d.id
            WHERE (d.user_id = ? OR r.user_id = ?) AND r.created_at BETWEEN ? AND ?
            ORDER BY r.created_at DESC
            LIMIT 15
        `, [req.user.id, req.user.id, start, end]);
        
        res.json(results);
    } catch (error) {
        console.error('Chart data error:', error);
        res.status(500).json({ error: 'Failed to fetch chart data' });
    }
});

// Update data
router.put('/:id', authenticateUser, async (req, res) => {
    const { id } = req.params;
    const { humidity, temperature, conductivity, ph, nitrogen, phosphorus, potassium, location } = req.body;

    try {
        // Verify the data belongs to the user
        const [data] = await query(
            `SELECT r.* FROM readnpk r
             LEFT JOIN devices d ON r.device_id = d.id
             WHERE r.id = ? AND (d.user_id = ? OR r.user_id = ?)`,
            [id, req.user.id, req.user.id]
        );

        if (!data) {
            return res.status(404).json({ error: 'Data not found or unauthorized' });
        }

        await query(
            `UPDATE readnpk SET 
             humidity = ?, temperature = ?, conductivity = ?, ph = ?,
             nitrogen = ?, phosphorus = ?, potassium = ?, location = ?
             WHERE id = ?`,
            [humidity, temperature, conductivity, ph, nitrogen, phosphorus, potassium, location, id]
        );

        res.json({ message: 'Data updated successfully' });
    } catch (error) {
        console.error('Error updating data:', error);
        res.status(500).json({ error: 'Failed to update data' });
    }
});

// Delete data
router.delete('/:id', authenticateUser, async (req, res) => {
    const { id } = req.params;

    try {
        // Verify the data belongs to the user
        const [data] = await query(
            `SELECT r.* FROM readnpk r
             LEFT JOIN devices d ON r.device_id = d.id
             WHERE r.id = ? AND (d.user_id = ? OR r.user_id = ?)`,
            [id, req.user.id, req.user.id]
        );

        if (!data) {
            return res.status(404).json({ error: 'Data not found or unauthorized' });
        }

        await query('DELETE FROM readnpk WHERE id = ?', [id]);
        res.json({ message: 'Data deleted successfully' });
    } catch (error) {
        console.error('Error deleting data:', error);
        res.status(500).json({ error: 'Failed to delete data' });
    }
});

// Add new data
router.post('/', authenticateUser, async (req, res) => {
    const { humidity, temperature, conductivity, ph, nitrogen, phosphorus, potassium, location } = req.body;

    try {
        // Get the user's first active device
        const [device] = await query(
            'SELECT id FROM devices WHERE user_id = ? AND status = "active" LIMIT 1',
            [req.user.id]
        );

        const result = await query(
            `INSERT INTO readnpk 
             (device_id, user_id, humidity, temperature, conductivity, ph, nitrogen, phosphorus, potassium, location)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [device ? device.id : null, req.user.id, humidity, temperature, conductivity, ph, nitrogen, phosphorus, potassium, location]
        );

        res.json({ 
            message: 'Data added successfully',
            id: result.insertId
        });
    } catch (error) {
        console.error('Error adding data:', error);
        res.status(500).json({ error: 'Failed to add data' });
    }
});

// Export data
router.get('/export', authenticateUser, async (req, res) => {
    try {
        const { fromDate = config.DEFAULT_DATE_RANGE.start, toDate = config.DEFAULT_DATE_RANGE.end } = req.query;
        
        const results = await query(`
            SELECT r.* 
            FROM readnpk r
            LEFT JOIN devices d ON r.device_id = d.id
            WHERE (d.user_id = ? OR r.user_id = ?) AND r.created_at BETWEEN ? AND ?
        `, [req.user.id, req.user.id, fromDate, toDate]);

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Sensor Data');

        worksheet.columns = [
            { header: 'Date', key: 'date', width: 15 },
            { header: 'Time', key: 'time', width: 15 },
            { header: 'Humidity', key: 'humidity', width: 15 },
            { header: 'Temperature', key: 'temperature', width: 15 },
            { header: 'Conductivity', key: 'conductivity', width: 15 },
            { header: 'pH', key: 'ph', width: 15 },
            { header: 'Nitrogen', key: 'nitrogen', width: 15 },
            { header: 'Phosphorus', key: 'phosphorus', width: 15 },
            { header: 'Potassium', key: 'potassium', width: 15 },
            { header: 'Location', key: 'location', width: 20 }
        ];

        results.forEach(row => {
            const timestamp = new Date(row.created_at);
            worksheet.addRow({
                date: timestamp.toLocaleDateString(),
                time: timestamp.toLocaleTimeString(),
                humidity: row.humidity,
                temperature: row.temperature,
                conductivity: row.conductivity,
                ph: row.ph,
                nitrogen: row.nitrogen,
                phosphorus: row.phosphorus,
                potassium: row.potassium,
                location: row.location
            });
        });

        res.setHeader('Content-Disposition', 'attachment; filename="sensor_data.xlsx"');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        
        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error('Export error:', error);
        res.status(500).send('Export failed');
    }
});

export default router;
