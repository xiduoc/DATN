const express = require('express');
const mysql = require('mysql');
const path = require('path');
const bodyParser = require('body-parser');
const ExcelJS = require('exceljs');
const fetch = require('node-fetch');
const bcrypt = require('bcryptjs');
const cookieParser = require('cookie-parser');
const { authenticateUser, generateApiKey, JWT_SECRET } = require('./middleware/auth');
const jwt = require('jsonwebtoken');

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
app.use(bodyParser.json());
app.use(cookieParser());

// Database connection pool
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
            if (row.latitude && row.longitude) {
                await new Promise(resolve => setTimeout(resolve, 1000)); // Rate limiting
                const locationName = await getLocationName(row.latitude, row.longitude);
                
                await query('UPDATE readnpk SET location = ? WHERE id = ?', [locationName, row.id])
                    .catch(err => console.error(`Location update failed for ID ${row.id}:`, err));
            }
        }
    } catch (error) {
        console.error('Location update error:', error);
    }
}

// Start location updates
setInterval(updateLocations, CONFIG.LOCATION_UPDATE_INTERVAL);
setTimeout(updateLocations, 1000); // Initial update

// Authentication Routes
app.get('/register', (req, res) => {
    res.render('register');
});

app.post('/register', async (req, res) => {
    const { username, email, password, confirm_password } = req.body;
    
    if (password !== confirm_password) {
        return res.render('register', { error: 'Passwords do not match' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        await query(
            'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
            [username, email, hashedPassword]
        );
        res.redirect('/login');
    } catch (error) {
        res.render('register', { error: 'Registration failed. Username or email may already exist.' });
    }
});

app.get('/login', (req, res) => {
    res.render('login');
});

app.post('/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        const users = await query('SELECT * FROM users WHERE username = ?', [username]);
        const user = users[0];

        if (!user || !await bcrypt.compare(password, user.password)) {
            return res.render('login', { error: 'Invalid credentials' });
        }

        const token = jwt.sign(
            { id: user.id, username: user.username },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 24 * 60 * 60 * 1000 // 24 hours
        });

        res.redirect('/');
    } catch (error) {
        console.error('Login error:', error);
        res.render('login', { error: 'Login failed' });
    }
});

app.get('/logout', (req, res) => {
    res.clearCookie('token');
    res.redirect('/login');
});

// Device Management Routes
app.get('/devices', authenticateUser, async (req, res) => {
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

app.post('/devices/new', authenticateUser, async (req, res) => {
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

app.post('/devices/:id/toggle', authenticateUser, async (req, res) => {
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

// Protected Routes
app.get('/', authenticateUser, async (req, res) => {
    try {
        const { fromDate = CONFIG.DEFAULT_DATE_RANGE.start, toDate = CONFIG.DEFAULT_DATE_RANGE.end } = req.query;
        
        const results = await query(
            `SELECT r.*, DATE_FORMAT(r.timestamp, "%Y-%m-%d %H:%i:%s") as formatted_timestamp 
             FROM readnpk r
             JOIN devices d ON r.device_id = d.id
             WHERE d.user_id = ? AND r.timestamp BETWEEN ? AND ?`,
            [req.user.id, fromDate, toDate]
        );
        
        res.render('index', { data: results });
    } catch (error) {
        console.error('Index route error:', error);
        res.status(500).send('Server error');
    }
});

app.get('/map', authenticateUser, async (req, res) => {
    try {
        const results = await query(`
            WITH RankedData AS (
                SELECT 
                    r.*,
                    DATE_FORMAT(r.timestamp, '%Y-%m-%d %H:%i:%s') as formatted_timestamp,
                    ROW_NUMBER() OVER (PARTITION BY r.latitude, r.longitude ORDER BY r.timestamp DESC) as rn
                FROM readnpk r
                JOIN devices d ON r.device_id = d.id
                WHERE d.user_id = ? AND r.latitude IS NOT NULL AND r.longitude IS NOT NULL
            )
            SELECT * FROM RankedData WHERE rn = 1
        `, [req.user.id]);
        
        res.render('map', { points: results });
    } catch (error) {
        console.error('Map route error:', error);
        res.status(500).send('Server error');
    }
});

app.get('/getdata-chart', authenticateUser, async (req, res) => {
    try {
        const { start = CONFIG.DEFAULT_DATE_RANGE.start, end = CONFIG.DEFAULT_DATE_RANGE.end } = req.query;
        
        const results = await query(`
            SELECT 
                r.timestamp,
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
            WHERE d.user_id = ? AND r.timestamp BETWEEN ? AND ?
            ORDER BY r.timestamp DESC
            LIMIT 100
        `, [req.user.id, start, end]);
        
        res.json(results);
    } catch (error) {
        console.error('Chart data error:', error);
        res.status(500).json({ error: 'Failed to fetch chart data' });
    }
});

app.get('/chart', authenticateUser, (req, res) => res.render('chart'));

app.get('/export', authenticateUser, async (req, res) => {
    try {
        const { fromDate = CONFIG.DEFAULT_DATE_RANGE.start, toDate = CONFIG.DEFAULT_DATE_RANGE.end } = req.query;
        
        const results = await query(`
            SELECT r.* 
            FROM readnpk r
            JOIN devices d ON r.device_id = d.id
            WHERE d.user_id = ? AND r.timestamp BETWEEN ? AND ?
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

// Soil classification function
function classifySoil(data) {
    const {ph, conductivity, nitrogen, phosphorus, potassium} = data;
    
    // Phân loại đất phèn
    if (ph >= 3.5 && ph <= 5.5 && conductivity > 1000) {
        return {
            soilType: 'Đất phèn',
            characteristics: `pH thấp (${ph}), độ dẫn điện cao (${conductivity}), dinh dưỡng NPK thấp`,
            recommendations: 'Cần bổ sung vôi để cải tạo độ pH, bổ sung phân bón NPK'
        };
    }
    
    // Đất chua
    if (ph < 6.5) {
        return {
            soilType: 'Đất chua',
            characteristics: `pH thấp (${ph}), khả năng giữ dinh dưỡng kém`,
            recommendations: 'Cần bổ sung vôi để tăng pH, bổ sung phân hữu cơ'
        };
    }

    // Đất phù sa
    if (ph >= 6 && ph <= 7.5 && conductivity >= 500 && conductivity <= 1000 && nitrogen >= 0.1 && phosphorus >= 0.1 && potassium >= 0.1) {
        return {
            soilType: 'Đất phù sa',
            characteristics: `pH cân bằng (${ph}), độ dẫn điện trung bình, màu mỡ`,
            recommendations: 'Duy trì cân bằng dinh dưỡng bằng phân bón định kỳ'
        };
    }

    // Đất kiềm
    if (ph > 7.5) {
        return {
            soilType: 'Đất kiềm',
            characteristics: `pH cao (${ph}), có thể thiếu một số vi chất`,
            recommendations: 'Bổ sung phân bón lưu huỳnh, bổ sung chất hữu cơ'
        };
    }

    return {
        soilType: 'Chưa xác định',
        characteristics: 'Cần thêm dữ liệu để phân tích',
        recommendations: 'Cần lấy thêm mẫu để phân tích'
    };
}

app.get('/soil-classification', authenticateUser, async (req, res) => {
    try {
        const results = await query(`
            SELECT 
                r.location,
                AVG(r.ph) as ph,
                AVG(r.conductivity) as conductivity,
                AVG(r.nitrogen) as nitrogen,
                AVG(r.phosphorus) as phosphorus,
                AVG(r.potassium) as potassium
            FROM readnpk r
            JOIN devices d ON r.device_id = d.id
            WHERE d.user_id = ? AND r.location IS NOT NULL
            GROUP BY r.location
        `, [req.user.id]);

        const soilData = results.map(row => ({
            location: row.location,
            ...classifySoil(row)
        }));

        res.render('soil-classification', { soilData });
    } catch (error) {
        console.error('Soil classification error:', error);
        res.status(500).send('Error generating soil classification');
    }
});

// Start server
app.listen(CONFIG.PORT, () => {
    console.log(`Server running at http://localhost:${CONFIG.PORT}`);
});
