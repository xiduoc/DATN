# Smart Agriculture System API Documentation

## Overview
This system provides a REST API for managing agricultural sensor data, including temperature, humidity, conductivity, pH, and NPK (Nitrogen, Phosphorus, Potassium) readings. The API supports both web interface users and IoT devices (ESP32).

## Setup Instructions

### Prerequisites
- Node.js
- MySQL database
- npm or yarn package manager

### Installation
1. Clone the repository
2. Install dependencies:
```bash
npm install
```
3. Configure environment variables in config/config.js
4. Initialize database:
```bash
node database/init.js
```
5. Start the server:
```bash
npm start
```

## Authentication

### Web Authentication
- Uses JWT (JSON Web Token) based authentication
- Token is stored in cookies
- Protected routes require valid JWT token

### Device Authentication
- Uses API key authentication
- API key can be provided in two ways:
  1. URL query parameter: `?api_key=YOUR_API_KEY`
  2. Request header: `X-API-Key: YOUR_API_KEY`

## API Endpoints

### Dashboard Data
```
GET /api/data/dashboard
Authentication: Required (JWT)
Query Parameters:
  - fromDate (optional): Start date range (YYYY-MM-DD)
  - toDate (optional): End date range (YYYY-MM-DD)
Response: Array of sensor readings with timestamps
```

### Map Data
```
GET /api/data/map
Authentication: Required (JWT)
Query Parameters:
  - fromDate (optional): Start date range (YYYY-MM-DD)
  - toDate (optional): End date range (YYYY-MM-DD)
Response: Latest sensor readings with geographical coordinates
```

### Chart Data
```
GET /api/data/chart
Authentication: Required (JWT)
Query Parameters:
  - start (optional): Start date range (YYYY-MM-DD)
  - end (optional): End date range (YYYY-MM-DD)
Response: Last 15 sensor readings with timestamps
```

### Add New Reading
```
POST /api/data
Authentication: Required (JWT)
Body Parameters:
{
  "humidity": number,
  "temperature": number,
  "conductivity": number,
  "ph": number,
  "nitrogen": number,
  "phosphorus": number,
  "potassium": number,
  "location": string
}
Response: 
{
  "message": "Data added successfully",
  "id": number
}
```

### Update Reading
```
PUT /api/data/:id
Authentication: Required (JWT)
URL Parameters:
  - id: Reading ID
Body Parameters:
{
  "humidity": number,
  "temperature": number,
  "conductivity": number,
  "ph": number,
  "nitrogen": number,
  "phosphorus": number,
  "potassium": number,
  "location": string
}
Response: 
{
  "message": "Data updated successfully"
}
```

### Delete Reading
```
DELETE /api/data/:id
Authentication: Required (JWT)
URL Parameters:
  - id: Reading ID
Response:
{
  "message": "Data deleted successfully"
}
```

### Export Data
```
GET /api/data/export
Authentication: Required (JWT)
Query Parameters:
  - fromDate (optional): Start date range (YYYY-MM-DD)
  - toDate (optional): End date range (YYYY-MM-DD)
Response: Excel file download (sensor_data.xlsx)
```

## Data Models

### Sensor Reading (readnpk)
```
{
  id: number (auto-increment)
  device_id: number (foreign key to devices)
  user_id: number (foreign key to users)
  humidity: number
  temperature: number
  conductivity: number
  ph: number
  nitrogen: number
  phosphorus: number
  potassium: number
  location: string
  created_at: timestamp
}
```

### Device
```
{
  id: number (auto-increment)
  user_id: number (foreign key to users)
  api_key: string
  status: enum('active', 'inactive')
}
```

## Error Responses
All error responses follow this format:
```
{
  "error": "Error message description"
}
```

Common HTTP status codes:
- 200: Success
- 400: Bad Request
- 401: Unauthorized
- 404: Not Found
- 500: Internal Server Error

## Rate Limiting
Currently, there are no rate limits implemented on the API endpoints.

## Notes
- All timestamps are in UTC
- Temperature is in Celsius
- Humidity is in percentage
- Conductivity is in μS/cm
- pH ranges from 0-14
- NPK values are in mg/kg (parts per million)
