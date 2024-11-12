const jwt = require('jsonwebtoken');
const mysql = require('mysql');
const bcrypt = require('bcryptjs');

const ADMIN_JWT_SECRET = 'admin-secret-key'; // Change this in production

const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'data',
    connectionLimit: 10
});

// Admin authentication middleware
const authenticateAdmin = (req, res, next) => {
    const token = req.cookies.adminToken;
    if (!token) return res.redirect('/admin/login');

    try {
        const decoded = jwt.verify(token, ADMIN_JWT_SECRET);
        req.admin = decoded;
        next();
    } catch (err) {
        res.clearCookie('adminToken');
        return res.redirect('/admin/login');
    }
};

// Query helper
const query = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        pool.query(sql, params, (error, results) => {
            if (error) reject(error);
            resolve(results);
        });
    });
};

module.exports = { 
    authenticateAdmin,
    ADMIN_JWT_SECRET,
    query
};
