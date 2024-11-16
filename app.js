// Dependencies
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import config from './config/config.js';
import { query } from './config/database.js';
import { updateLocations } from './utils/helpers.js';

// Import routes
import authRoutes from './routes/auth.js';
import deviceRoutes from './routes/devices.js';
import growingAreaRoutes from './routes/growing-areas.js';
import dataRoutes from './routes/api/data.js';
import mainRoutes from './routes/main.js';
import adminRoutes from './routes/admin.js';

// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Express app
const app = express();

// App configuration and middleware
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(cookieParser());

// Mount routes
app.use('/', mainRoutes);
app.use('/', authRoutes);
app.use('/devices', deviceRoutes);
app.use('/growing-areas', growingAreaRoutes);
app.use('/api/data', dataRoutes);
app.use('/admin', adminRoutes);

// Initialize location updates
setInterval(() => updateLocations(query), config.LOCATION_UPDATE_INTERVAL);
setTimeout(() => updateLocations(query), 1000); // Initial update

// Start server
app.listen(config.PORT, () => {
    console.log(`Server running at http://localhost:${config.PORT}`);
});
