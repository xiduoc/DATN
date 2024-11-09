const express = require('express');
const mysql = require('mysql');
const bodyParser = require('body-parser');
const cors = require('cors');
const { authenticateDevice } = require('./middleware/auth');

const app = express();
const port = 3000;

// Configure CORS
app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// MySQL connection pool
const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'sensor_data',
    connectionLimit: 10
});

// Promisify database queries
const query = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        pool.query(sql, params, (error, results) => {
            if (error) reject(error);
            resolve(results);
        });
    });
};

// API endpoint to receive data from ESP32
app.post('/insert', authenticateDevice, async (req, res) => {
    const { 
        Humidity, 
        Temperature, 
        Conductivity, 
        pH, 
        Nitrogen, 
        Phosphorus, 
        Potassium, 
        Latitude, 
        Longitude 
    } = req.body;
    
    try {
        await query(`
            INSERT INTO readnpk 
            (humidity, temperature, conductivity, ph, nitrogen, phosphorus, potassium, 
             latitude, longitude, user_id, device_id) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            Humidity,
            Temperature,
            Conductivity,
            pH,
            Nitrogen,
            Phosphorus,
            Potassium,
            Latitude, 
            Longitude,
            req.device.user_id,
            req.device.id
        ]);

        res.json({ 
            message: 'Data inserted successfully',
            device_id: req.device.id,
            user_id: req.device.user_id
        });
    } catch (error) {
        console.error('Error inserting data:', error);
        res.status(500).json({ error: 'Error inserting data' });
    }
});

// Get latest data for a specific device
app.get('/latest/:deviceId', authenticateDevice, async (req, res) => {
    try {
        const results = await query(`
            SELECT 
                humidity as Humidity,
                temperature as Temperature,
                conductivity as Conductivity,
                ph as pH,
                nitrogen as Nitrogen,
                phosphorus as Phosphorus,
                potassium as Potassium,
                latitude as Latitude, 
                longitude as Longitude,
                timestamp
            FROM readnpk 
            WHERE device_id = ?
            ORDER BY timestamp DESC 
            LIMIT 1
        `, [req.params.deviceId]);

        if (results.length === 0) {
            return res.status(404).json({ error: 'No data found for this device' });
        }

        res.json(results[0]);
    } catch (error) {
        console.error('Error fetching latest data:', error);
        res.status(500).json({ error: 'Error fetching data' });
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    pool.query('SELECT 1', (err) => {
        if (err) {
            console.error('Database connection error:', err);
            res.status(500).json({ status: 'error', message: 'Database connection failed' });
        } else {
            res.json({ status: 'healthy', message: 'Server and database are running' });
        }
    });
});

// Start server
app.listen(port, () => {
    console.log(`API Server running at http://localhost:${port}`);
});
