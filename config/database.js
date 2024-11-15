const mysql = require('mysql');
const fs = require('fs');
const path = require('path');
const config = require('./config');

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

module.exports = {
    pool,
    query
};
