-- Create Database
CREATE DATABASE IF NOT EXISTS twende_tours;
USE twende_tours;

-- Users Table
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role ENUM('client', 'staff', 'manager') NOT NULL,
    phone VARCHAR(20),
    interest VARCHAR(50),
    is_approved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Fleet Table
CREATE TABLE IF NOT EXISTS fleet (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(50) NOT NULL,
    rate DECIMAL(10,2) NOT NULL,
    status ENUM('Available', 'Booked', 'Maintenance', 'Repair') DEFAULT 'Available',
    seats INT DEFAULT 6,
    bags INT DEFAULT 4,
    image_url TEXT,
    description TEXT
);

-- Bookings Table
CREATE TABLE IF NOT EXISTS bookings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    vehicle_id INT,
    destination VARCHAR(100),
    start_date DATE,
    end_date DATE,
    travelers INT DEFAULT 1,
    notes TEXT,
    status ENUM('Pending', 'Confirmed', 'Completed', 'Cancelled') DEFAULT 'Pending',
    amount DECIMAL(10,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (vehicle_id) REFERENCES fleet(id) ON DELETE SET NULL
);

-- Inquiries Table
CREATE TABLE IF NOT EXISTS inquiries (
    id INT AUTO_INCREMENT PRIMARY KEY,
    client_name VARCHAR(100) NOT NULL,
    client_email VARCHAR(100) NOT NULL,
    client_phone VARCHAR(20),
    destination VARCHAR(100),
    notes TEXT,
    source VARCHAR(50) DEFAULT 'Website',
    status ENUM('NO ACTION', 'Replied', 'Converted') DEFAULT 'NO ACTION',
    assigned_to INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    replied_at TIMESTAMP NULL,
    FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL
);

-- Payments Table
CREATE TABLE IF NOT EXISTS payments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    booking_id INT,
    amount DECIMAL(10,2),
    method VARCHAR(50),
    status VARCHAR(20) DEFAULT 'Success',
    reference VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE SET NULL
);

-- Insert Default Admin (password: 123)
INSERT INTO users (name, email, password, role, is_approved) 
VALUES ('Manager', 'admin@twende.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'manager', TRUE)
ON DUPLICATE KEY UPDATE name=name;

-- Insert Sample Fleet (with proper working image URLs)
INSERT INTO fleet (name, type, rate, status, seats, bags, image_url, description) VALUES
('Safari Van', 'Van', 18000, 'Available', 8, 8, 'https://images.unsplash.com/photo-1566008885171-2a2dd16688a3?w=400&h=300&fit=crop', 'Perfect for budget-friendly group safaris'),
('Land Cruiser Prado', 'SUV', 25000, 'Available', 6, 6, 'https://images.unsplash.com/photo-1596707328637-409869323520?w=400&h=300&fit=crop', 'Comfortable mid-size SUV'),
('Land Cruiser 70', '4x4', 30000, 'Booked', 7, 4, 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=400&h=300&fit=crop', 'Classic rugged 4x4'),
('Land Cruiser V8', '4x4', 35000, 'Available', 6, 6, 'https://images.unsplash.com/photo-1570125909232-eb263c188f7e?w=400&h=300&fit=crop', 'Luxury safari vehicle'),
('Toyota Hiace', 'Bus', 22000, 'Available', 14, 10, 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=400&h=300&fit=crop', 'Large capacity van'),
('Land Cruiser VX', 'SUV', 40000, 'Maintenance', 7, 7, 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=300&fit=crop', 'Top-of-the-line luxury SUV')
ON DUPLICATE KEY UPDATE image_url=VALUES(image_url);