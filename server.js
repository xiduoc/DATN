import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import { authenticateDevice } from './middleware/auth.js';
import { initializeDatabase } from './database/init.js';
import { pool, query } from './config/database.js';

const app = express();
const port = 3000;

// Configure CORS
app.use(cors());

// Configure body parsers before routes
// Support URL-encoded bodies
app.use(bodyParser.urlencoded({ extended: true }));
// Support JSON-encoded bodies
app.use(bodyParser.json());

// API endpoint to receive data from ESP32
app.post('/insert', authenticateDevice, async (req, res) => {
    console.log('Received request body:', req.body); // Debug log
    console.log('Received query params:', req.query); // Debug log

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

// Initialize database and start server
async function startServer() {
    try {
        // Initialize database tables
        await initializeDatabase();
        
        // Start server
        app.listen(port, () => {
            console.log(`API Server running at http://localhost:${port}`);
        });
    } catch (error) {
        console.error('Failed to initialize database:', error);
        process.exit(1);
    }
}

// Start the server
startServer();
