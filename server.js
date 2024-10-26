const express = require('express');
const mysql = require('mysql');
const bodyParser = require('body-parser');
const cors = require('cors');
const app = express();
const port = 3000;

// Cấu hình CORS
app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Kết nối đến cơ sở dữ liệu MySQL
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'test'
});

// Kiểm tra kết nối
db.connect(err => {
    if (err) {
        console.error('Error connecting to MySQL:', err);
        return;
    }
    console.log('Connected to MySQL');
});

// Định nghĩa endpoint để nhận dữ liệu từ ESP32
app.post('/insert', (req, res) => {
    const { Humidity, Temperature, Conductivity, pH, Nitrogen, Phosphorus, Potassium, Latitude, Longitude } = req.body;
    
    const sql = `
        INSERT INTO readnpk 
        (humidity, temperature, conductivity, ph, nitrogen, phosphorus, potassium, latitude, longitude) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    db.query(sql, [
        Humidity,
        Temperature,
        Conductivity,
        pH,
        Nitrogen,
        Phosphorus,
        Potassium,
        Latitude, 
        Longitude
    ], (err, result) => {
        if (err) {
            console.error('Error inserting data:', err);
            return res.status(500).json({ error: 'Error inserting data' });
        }
        res.json({ message: 'Data inserted successfully' });
    });
});

// Endpoint để lấy dữ liệu mới nhất
app.get('/latest', (req, res) => {
    const sql = `
        SELECT 
            humidity as Humidity,
            temperature as Temperature,
            conductivity as Conductivity,
            ph as pH,
            nitrogen as Nitrogen,
            phosphorus as Phosphorus,
            potassium as Potassium,
            latitude as Latitude, 
            longitude as Longitude,
            timestamp
        FROM readnpk 
        ORDER BY timestamp DESC 
        LIMIT 1
    `;
    
    db.query(sql, (err, result) => {
        if (err) {
            console.error('Error fetching data:', err);
            return res.status(500).json({ error: 'Error fetching data' });
        }
        res.json(result[0]);
    });
});

// Khởi động server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});