# Smart Agriculture System - Technical API Documentation

## Base URL
All API endpoints are relative to: `/api/data/`

## Authentication Details

### JWT Authentication
- Token format: `Bearer <token>`
- Token expiration: Based on JWT_SECRET configuration
- Token storage: HTTP-only cookie named 'token'

### Device API Key
- Format: 64-character hexadecimal string
- Generated using crypto.randomBytes(32)
- Must be active in devices table

## Detailed Endpoint Specifications

### Dashboard Data (`GET /dashboard`)

Retrieves sensor readings within a specified date range.

```javascript
Request:
  Headers:
    Cookie: token=<jwt_token>
  Query:
    fromDate: ISO 8601 date string (optional)
    toDate: ISO 8601 date string (optional)

Response (200):
[
  {
    "id": number,
    "device_id": number,
    "user_id": number,
    "humidity": number,
    "temperature": number,
    "conductivity": number,
    "ph": number,
    "nitrogen": number,
    "phosphorus": number,
    "potassium": number,
    "location": string,
    "formatted_timestamp": string
  }
]

Error (401):
{
  "error": "Unauthorized"
}

Error (500):
{
  "error": "Failed to fetch dashboard data"
}
```

### Map Data (`GET /map`)

Retrieves latest sensor readings with geographical coordinates.

```javascript
Request:
  Headers:
    Cookie: token=<jwt_token>
  Query:
    fromDate: ISO 8601 date string (optional)
    toDate: ISO 8601 date string (optional)

Response (200):
[
  {
    "id": number,
    "device_id": number,
    "user_id": number,
    "humidity": number,
    "temperature": number,
    "conductivity": number,
    "ph": number,
    "nitrogen": number,
    "phosphorus": number,
    "potassium": number,
    "location": string,
    "latitude": number,
    "longitude": number,
    "formatted_timestamp": string
  }
]

Error (401):
{
  "error": "Unauthorized"
}

Error (500):
{
  "error": "Failed to fetch map data"
}
```

### Chart Data (`GET /chart`)

Retrieves the last 15 sensor readings for charting.

```javascript
Request:
  Headers:
    Cookie: token=<jwt_token>
  Query:
    start: ISO 8601 date string (optional)
    end: ISO 8601 date string (optional)

Response (200):
[
  {
    "timestamp": string,
    "humidity": number,
    "temperature": number,
    "conductivity": number,
    "ph": number,
    "nitrogen": number,
    "phosphorus": number,
    "potassium": number,
    "location": string
  }
]

Error (401):
{
  "error": "Unauthorized"
}

Error (500):
{
  "error": "Failed to fetch chart data"
}
```

### Add Reading (`POST /`)

Adds a new sensor reading.

```javascript
Request:
  Headers:
    Cookie: token=<jwt_token>
    Content-Type: application/json
  Body:
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

Response (200):
{
  "message": "Data added successfully",
  "id": number
}

Error (401):
{
  "error": "Unauthorized"
}

Error (500):
{
  "error": "Failed to add data"
}
```

### Update Reading (`PUT /:id`)

Updates an existing sensor reading.

```javascript
Request:
  Headers:
    Cookie: token=<jwt_token>
    Content-Type: application/json
  Parameters:
    id: number
  Body:
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

Response (200):
{
  "message": "Data updated successfully"
}

Error (401):
{
  "error": "Unauthorized"
}

Error (404):
{
  "error": "Data not found or unauthorized"
}

Error (500):
{
  "error": "Failed to update data"
}
```

### Delete Reading (`DELETE /:id`)

Deletes a sensor reading.

```javascript
Request:
  Headers:
    Cookie: token=<jwt_token>
  Parameters:
    id: number

Response (200):
{
  "message": "Data deleted successfully"
}

Error (401):
{
  "error": "Unauthorized"
}

Error (404):
{
  "error": "Data not found or unauthorized"
}

Error (500):
{
  "error": "Failed to delete data"
}
```

### Export Data (`GET /export`)

Exports sensor readings to Excel file.

```javascript
Request:
  Headers:
    Cookie: token=<jwt_token>
  Query:
    fromDate: ISO 8601 date string (optional)
    toDate: ISO 8601 date string (optional)

Response (200):
  Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
  Content-Disposition: attachment; filename="sensor_data.xlsx"
  Binary Excel file

Error (401):
{
  "error": "Unauthorized"
}

Error (500):
{
  "error": "Export failed"
}
```

## Database Schema

### readnpk Table
```sql
CREATE TABLE readnpk (
  id INT PRIMARY KEY AUTO_INCREMENT,
  device_id INT,
  user_id INT NOT NULL,
  humidity FLOAT,
  temperature FLOAT,
  conductivity FLOAT,
  ph FLOAT,
  nitrogen FLOAT,
  phosphorus FLOAT,
  potassium FLOAT,
  location VARCHAR(255),
  latitude DECIMAL(10,8),
  longitude DECIMAL(11,8),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (device_id) REFERENCES devices(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

### devices Table
```sql
CREATE TABLE devices (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  api_key VARCHAR(128) UNIQUE NOT NULL,
  status ENUM('active', 'inactive') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

## Implementation Notes

1. All numeric values are stored as FLOAT in the database
2. Timestamps are in UTC timezone
3. API key authentication is checked before any device-specific operations
4. JWT token is verified on every authenticated request
5. Database queries use parameterized statements to prevent SQL injection
6. Excel export uses ExcelJS library for file generation
7. Geographical coordinates (latitude/longitude) are optional
8. All responses use JSON format except for file downloads

## File .env
### JWT Secrets
JWT_SECRET=ad40e1eeaf00da552e4f850f32d4588052998ca5fd0a3b4f301dbf06a71309d2
ADMIN_JWT_SECRET=7cd1bf02a58d0b633e7d6c6efe7e9338a362add1bef619cf13e694ffbce59219

### Database Configuration
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=data
DB_CONNECTION_LIMIT=10

### Email Configuration
EMAIL_SERVICE=gmail
EMAIL_USER=myemail@gmail.com
EMAIL_PASSWORD=yque cetf sdxo amqa 

### Server Configuration
PORT=3001
NODE_ENV=development
BASE_URL=https://data.nguyenhoangquan.id.vn
