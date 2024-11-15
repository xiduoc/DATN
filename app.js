// Dependencies
const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const multer = require('multer');
const fs = require('fs');
const config = require('./config/config');
const { query } = require('./config/database');
const { updateLocations } = require('./utils/helpers');

// Import routes
const authRoutes = require('./routes/auth');
const deviceRoutes = require('./routes/devices');
const growingAreaRoutes = require('./routes/growing-areas');
const dataRoutes = require('./routes/api/data');
const mainRoutes = require('./routes/main');
const adminRoutes = require('./routes/admin');

// Initialize Express app
const app = express();

// App configuration and middleware
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(cookieParser());

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadsDir)
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
        cb(null, uniqueSuffix + path.extname(file.originalname))
    }
});

const upload = multer({ 
    storage: storage,
    fileFilter: function(req, file, cb) {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only JPEG, PNG and GIF are allowed.'));
        }
    },
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    }
});

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
