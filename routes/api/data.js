const express = require('express');
const router = express.Router();
const { authenticateUser } = require('../../middleware/auth');
const { query } = require('../../config/database');
const config = require('../../config/config');
const ExcelJS = require('exceljs');

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
            JOIN devices d ON r.device_id = d.id
            WHERE d.user_id = ? AND r.created_at BETWEEN ? AND ?
            ORDER BY r.created_at DESC
            LIMIT 100
        `, [req.user.id, start, end]);
        
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
             JOIN devices d ON r.device_id = d.id
             WHERE r.id = ? AND d.user_id = ?`,
            [id, req.user.id]
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
             JOIN devices d ON r.device_id = d.id
             WHERE r.id = ? AND d.user_id = ?`,
            [id, req.user.id]
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

        if (!device) {
            return res.status(400).json({ error: 'No active device found' });
        }

        const result = await query(
            `INSERT INTO readnpk 
             (device_id, humidity, temperature, conductivity, ph, nitrogen, phosphorus, potassium, location)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [device.id, humidity, temperature, conductivity, ph, nitrogen, phosphorus, potassium, location]
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
            JOIN devices d ON r.device_id = d.id
            WHERE d.user_id = ? AND r.created_at BETWEEN ? AND ?
        `, [req.user.id, fromDate, toDate]);

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

module.exports = router;
