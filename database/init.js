import fs from 'fs';
import path from 'path';
import mysql from 'mysql';
import { fileURLToPath } from 'url';

// Get current file's directory name in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create a connection for database creation (without database selected)
const initialConnection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: ''
});

// Read the SQL initialization file
const initSQL = fs.readFileSync(path.join(__dirname, 'init.sql'), 'utf8');

// Split the SQL file into individual statements
const statements = initSQL
    .split(';')
    .map(statement => statement.trim())
    .filter(statement => statement.length > 0);

async function initializeDatabase() {
    return new Promise((resolve, reject) => {
        // First create database if it doesn't exist
        initialConnection.connect(err => {
            if (err) {
                console.error('Error connecting to MySQL:', err);
                reject(err);
                return;
            }

            console.log('Connected to MySQL server');

            // Execute each SQL statement in sequence
            let currentStatement = 0;
            
            function executeNextStatement() {
                if (currentStatement >= statements.length) {
                    initialConnection.end();
                    console.log('Database initialization completed successfully');
                    resolve();
                    return;
                }

                const statement = statements[currentStatement];
                initialConnection.query(statement, (err) => {
                    if (err) {
                        // Ignore "database already exists" error
                        if (err.code === 'ER_DB_CREATE_EXISTS') {
                            console.log('Database already exists, continuing...');
                        }
                        // Ignore "table already exists" error
                        else if (err.code === 'ER_TABLE_EXISTS_ERROR') {
                            console.log(`Table already exists, continuing...`);
                        }
                        else {
                            console.error('Error executing SQL statement:', err);
                            initialConnection.end();
                            reject(err);
                            return;
                        }
                    }
                    currentStatement++;
                    executeNextStatement();
                });
            }

            executeNextStatement();
        });
    });
}

export { initializeDatabase };
