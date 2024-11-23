import jwt from 'jsonwebtoken';
import mysql from 'mysql';
import bcrypt from 'bcryptjs';
import config from '../config/config.js';

// Use ADMIN_JWT_SECRET from config
const { ADMIN_JWT_SECRET } = config;

// Use database configuration from config
const pool = mysql.createPool(config.DB);

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

export { 
    authenticateAdmin,
    ADMIN_JWT_SECRET,
    query
};
