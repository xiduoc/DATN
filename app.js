const express = require('express');
const mysql = require('mysql');
const path = require('path');
const bodyParser = require('body-parser');
const ExcelJS = require('exceljs');
const fetch = require('node-fetch');

// Configuration constants
const CONFIG = {
    PORT: 3001,
    DB: {
        host: 'localhost',
        user: 'root',
        password: '',
        database: 'test'
    },
    LOCATION_UPDATE_INTERVAL: 60000, // 1 minute
    DEFAULT_DATE_RANGE: {
        start: '2000-01-01',
        end: '2100-01-01'
    }
};

// Initialize Express app
const app = express();

// App configuration
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true }));

// Database connection pool instead of single connection
const pool = mysql.createPool({
    ...CONFIG.DB,
    connectionLimit: 10,
    waitForConnections: true,
    queueLimit: 0
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

// Location cache to reduce API calls
const locationCache = new Map();

// Enhanced location name fetching with caching
async function getLocationName(latitude, longitude) {
    const cacheKey = `${latitude},${longitude}`;
    
    if (locationCache.has(cacheKey)) {
        return locationCache.get(cacheKey);
    }

    try {
        const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
            {
                headers: { 'User-Agent': 'SensorDataApp/1.0' },
                timeout: 5000
            }
        );
        
        if (!response.ok) throw new Error('Location API request failed');
        
        const data = await response.json();
        const locationName = formatLocationName(data);
        
        locationCache.set(cacheKey, locationName);
        return locationName;
    } catch (error) {
        console.error('Location fetch error:', error);
        return 'Unknown Location';
    }
}

function formatLocationName(data) {
    if (!data.address) return 'Unknown Location';
    
    const parts = [
        data.address.road,
        data.address.suburb,
        data.address.city || data.address.town,
        data.address.state
    ].filter(Boolean);
    
    return parts.join(', ') || data.display_name || 'Unknown Location';
}

// Optimized location update function
async function updateLocations() {
    try {
        const results = await query(
            'SELECT id, latitude, longitude FROM readnpk WHERE location IS NULL OR location = ""'
        );

        for (const row of results) {
            await new Promise(resolve => setTimeout(resolve, 1000)); // Rate limiting
            const locationName = await getLocationName(row.latitude, row.longitude);
            
            await query('UPDATE readnpk SET location = ? WHERE id = ?', [locationName, row.id])
                .catch(err => console.error(`Location update failed for ID ${row.id}:`, err));
        }
    } catch (error) {
        console.error('Location update error:', error);
    }
}

// Routes
app.get('/', async (req, res) => {
    try {
        const { fromDate = CONFIG.DEFAULT_DATE_RANGE.start, toDate = CONFIG.DEFAULT_DATE_RANGE.end } = req.query;
        
        const results = await query(
            'SELECT *, DATE_FORMAT(timestamp, "%Y-%m-%d %H:%i:%s") as formatted_timestamp FROM readnpk WHERE timestamp BETWEEN ? AND ?',
            [fromDate, toDate]
        );
        
        res.render('index', { data: results });
    } catch (error) {
        console.error('Index route error:', error);
        res.status(500).send('Server error');
    }
});

app.get('/map', async (req, res) => {
    try {
        const results = await query(`
            WITH RankedData AS (
                SELECT 
                    *,
                    DATE_FORMAT(timestamp, '%Y-%m-%d %H:%i:%s') as formatted_timestamp,
                    ROW_NUMBER() OVER (PARTITION BY latitude, longitude ORDER BY timestamp DESC) as rn
                FROM readnpk
                WHERE latitude IS NOT NULL AND longitude IS NOT NULL
            )
            SELECT * FROM RankedData WHERE rn = 1
        `);
        
        res.render('map', { points: results });
    } catch (error) {
        console.error('Map route error:', error);
        res.status(500).send('Server error');
    }
});

app.get('/getdata-chart', async (req, res) => {
    try {
        const { start = CONFIG.DEFAULT_DATE_RANGE.start, end = CONFIG.DEFAULT_DATE_RANGE.end } = req.query;
        
        const results = await query(`
            SELECT 
                timestamp,
                humidity,
                temperature,
                conductivity,
                ph,
                nitrogen,
                phosphorus,
                potassium,
                location
            FROM readnpk 
            WHERE timestamp BETWEEN ? AND ?
            ORDER BY timestamp DESC
            LIMIT 100
        `, [start, end]);
        
        res.json(results);
    } catch (error) {
        console.error('Chart data error:', error);
        res.status(500).json({ error: 'Failed to fetch chart data' });
    }
});

app.get('/chart', (req, res) => res.render('chart'));

app.get('/export', async (req, res) => {
    try {
        const { fromDate = CONFIG.DEFAULT_DATE_RANGE.start, toDate = CONFIG.DEFAULT_DATE_RANGE.end } = req.query;
        
        const results = await query(
            'SELECT * FROM readnpk WHERE timestamp BETWEEN ? AND ?',
            [fromDate, toDate]
        );

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
            const timestamp = new Date(row.timestamp);
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

// Initialize location updates
setInterval(updateLocations, CONFIG.LOCATION_UPDATE_INTERVAL);
setTimeout(updateLocations, 1000);

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Application error:', err);
    res.status(500).send('Internal Server Error');
});

// Start server
app.listen(CONFIG.PORT, () => {
    console.log(`Server running at http://localhost:${CONFIG.PORT}`);
});
