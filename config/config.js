import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env file
const result = dotenv.config({ path: path.join(__dirname, '..', '.env') });

if (result.error) {
    console.error('Error loading .env file:', result.error);
    process.exit(1);
}

// Validate database configuration
const validateDbConfig = () => {
    const requiredDbVars = ['DB_HOST', 'DB_USER', 'DB_NAME'];
    const missingDbVars = requiredDbVars.filter(varName => !process.env[varName]);
    
    if (missingDbVars.length > 0) {
        console.error(`Missing required database configuration: ${missingDbVars.join(', ')}`);
        console.error('Please check your .env file');
        return false;
    }
    return true;
};

// Validate database configuration before creating config object
if (!validateDbConfig()) {
    process.exit(1);
}

const config = {
    NODE_ENV: process.env.NODE_ENV || 'development',
    PORT: parseInt(process.env.PORT) || 3001,
    BASE_URL: process.env.BASE_URL || 'http://localhost:3001',
    DB: {
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME,
        connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT) || 10
    },
    EMAIL: {
        service: process.env.EMAIL_SERVICE || 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASSWORD
        }
    },
    JWT_SECRET: process.env.JWT_SECRET,
    ADMIN_JWT_SECRET: process.env.ADMIN_JWT_SECRET,
    LOCATION_UPDATE_INTERVAL: 60000,
    DEFAULT_DATE_RANGE: {
        start: '2000-01-01',
        end: '2100-01-01'
    },
};

// Validate other required environment variables
const requiredEnvVars = [
    'JWT_SECRET',
    'ADMIN_JWT_SECRET',
    'EMAIL_USER',
    'EMAIL_PASSWORD'
];

const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0) {
    console.warn(`Warning: Missing environment variables: ${missingEnvVars.join(', ')}`);
}

// Log configuration (without sensitive data)
console.log('Environment:', config.NODE_ENV);
console.log('Database Configuration:', {
    host: config.DB.host,
    user: config.DB.user,
    database: config.DB.database,
    connectionLimit: config.DB.connectionLimit
});

export default config;
