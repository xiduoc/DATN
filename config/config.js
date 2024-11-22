const config = {
    NODE_ENV: process.env.NODE_ENV || 'development',
    PORT: 3001,
    BASE_URL: 'http://localhost:3001', // Base URL for password reset links
    DB: {
        host: 'localhost',
        user: 'root',
        password: '',
        database: 'data'
    },
    EMAIL: {
        service: 'gmail',
        auth: {
            user: 'baizmeoq@gmail.com',    // System Gmail that sends reset emails
            pass: 'pwfk rxwz mofx laou'        // App password from Google Account settings
        }
    },
    LOCATION_UPDATE_INTERVAL: 60000, // 1 minute
    DEFAULT_DATE_RANGE: {
        start: '2000-01-01',
        end: '2100-01-01'
    },
};

export default config;
