const jwt = require('jsonwebtoken');
const mysql = require('mysql');
const bcrypt = require('bcryptjs');

const JWT_SECRET = 'your-secret-key'; // Change this to a secure key in production

const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'test',
    connectionLimit: 10
});

// Web authentication middleware
const authenticateUser = (req, res, next) => {
    const token = req.cookies.token;
    if (!token) return res.redirect('/login');

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        res.clearCookie('token');
        return res.redirect('/login');
    }
};

// ESP32 authentication middleware  
const authenticateDevice = async (req, res, next) => {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey) return res.status(401).json({ error: 'No API key provided' });

    try {
        const device = await new Promise((resolve, reject) => {
            pool.query(
                'SELECT d.*, u.id as user_id FROM devices d ' +
                'JOIN users u ON d.user_id = u.id ' +
                'WHERE d.api_key = ? AND d.status = "active"', 
                [apiKey],
                (err, results) => {
                    if (err) reject(err);
                    resolve(results[0]);
                }
            );
        });

        if (!device) {
            return res.status(401).json({ error: 'Invalid or inactive API key' });
        }
        
        req.device = device;
        next();
    } catch (err) {
        console.error('Device authentication error:', err);
        return res.status(500).json({ error: 'Authentication error' });
    }
};

// Generate API key for devices
const generateApiKey = () => {
    return require('crypto').randomBytes(32).toString('hex');
};

module.exports = { 
    authenticateUser, 
    authenticateDevice, 
    generateApiKey,
    JWT_SECRET 
};
