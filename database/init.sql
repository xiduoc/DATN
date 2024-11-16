-- Create database if it doesn't exist
CREATE DATABASE IF NOT EXISTS data;
USE data;

-- Set character set
SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;

-- Create users table first since it's referenced by other tables
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status ENUM('active', 'inactive') DEFAULT 'active'
);

-- Create admin table
CREATE TABLE IF NOT EXISTS admin (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default admin user (password will be hashed during first login)
INSERT INTO admin (username, password) VALUES ('admin', 'admin')
ON DUPLICATE KEY UPDATE id=id;

-- Create devices table which references users
CREATE TABLE IF NOT EXISTS devices (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    api_key VARCHAR(64) UNIQUE NOT NULL,
    user_id INT NOT NULL,
    status ENUM('active', 'inactive') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Create readnpk table which references both users and devices
CREATE TABLE IF NOT EXISTS readnpk (
    id INT AUTO_INCREMENT PRIMARY KEY,
    humidity FLOAT NOT NULL,
    temperature FLOAT NOT NULL,
    conductivity FLOAT NOT NULL,
    ph FLOAT NOT NULL,
    nitrogen FLOAT NOT NULL,
    phosphorus FLOAT NOT NULL,
    potassium FLOAT NOT NULL,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    location VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_vietnamese_ci DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    user_id INT,
    device_id INT,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE SET NULL
);

-- Create growing_areas table which references users
CREATE TABLE IF NOT EXISTS growing_areas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    name VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_vietnamese_ci NOT NULL,
    description TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_vietnamese_ci,
    location VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_vietnamese_ci NOT NULL,
    area FLOAT NOT NULL,
    crop_type VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_vietnamese_ci NOT NULL,
    status ENUM('active', 'inactive') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS password_resets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    token VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NULL,
    used BOOLEAN DEFAULT FALSE,
    INDEX (email),
    INDEX (token)
);
