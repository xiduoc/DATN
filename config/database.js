import mysql from 'mysql';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import config from './config.js';

// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create connection pool
const pool = mysql.createPool({
    ...config.DB,
    connectionLimit: 10,
    waitForConnections: true,
    queueLimit: 0
});

// Database helper function
const query = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        pool.query(sql, params, (error, results) => {
            if (error) reject(error);
            resolve(results);
        });
    });
};

// Initialize admin table
const initializeAdminTable = async () => {
    try {
        const adminSQL = fs.readFileSync(path.join(__dirname, '..', 'database', 'init.sql'), 'utf8');
        const statements = adminSQL
            .split(';')
            .map(statement => statement.trim())
            .filter(statement => statement.length > 0);

        for (const statement of statements) {
            await new Promise((resolve, reject) => {
                pool.query(statement, (err) => {
                    if (err && !err.code.includes('ER_TABLE_EXISTS')) {
                        reject(err);
                    }
                    resolve();
                });
            });
        }
        console.log('Database initialized successfully');
    } catch (error) {
        console.error('Error initializing database:', error);
    }
};

// Initialize database
initializeAdminTable();

export {
    pool,
    query,
    initializeAdminTable
};
