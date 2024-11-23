import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import config from '../config/config.js';
import { pool, query } from '../config/database.js';

// Use ADMIN_JWT_SECRET from config
const { ADMIN_JWT_SECRET } = config;

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

export { 
    authenticateAdmin,
    ADMIN_JWT_SECRET,
    query
};
