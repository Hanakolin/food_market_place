-- Food Marketplace Database Schema
-- This file creates all the necessary tables for the food marketplace application

-- Create database if it doesn't exist
CREATE DATABASE IF NOT EXISTS food_marketplace;
USE food_marketplace;

-- Drop existing tables if they exist (for clean reinstall)
SET foreign_key_checks = 0;
DROP TABLE IF EXISTS refund_requests;
DROP TABLE IF EXISTS notifications;
DROP TABLE IF EXISTS order_items;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS cart_items;
DROP TABLE IF EXISTS reviews;
DROP TABLE IF EXISTS favorites;
DROP TABLE IF EXISTS food_items;
DROP TABLE IF EXISTS restaurants;
DROP TABLE IF EXISTS categories;
DROP TABLE IF EXISTS users;
SET foreign_key_checks = 1;

-- Users table
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    user_type ENUM('customer', 'cook', 'admin') DEFAULT 'customer',
    profile_image VARCHAR(500),
    is_active BOOLEAN DEFAULT true,
    email_verified BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_email (email),
    INDEX idx_user_type (user_type),
    INDEX idx_active (is_active)
);

-- Categories table
CREATE TABLE categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    image VARCHAR(500),
    is_active BOOLEAN DEFAULT true,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_active_sort (is_active, sort_order)
);

-- Restaurants table
CREATE TABLE restaurants (
    id INT AUTO_INCREMENT PRIMARY KEY,
    cook_id INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    cuisine_type VARCHAR(100),
    phone VARCHAR(20) NOT NULL,
    email VARCHAR(255),
    logo_image VARCHAR(500),
    banner_image VARCHAR(500),
    rating DECIMAL(3,2) DEFAULT 0.00,
    total_reviews INT DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    opening_hours JSON,
    delivery_radius INT DEFAULT 10,
    minimum_order_amount DECIMAL(10,2) DEFAULT 0.00,
    delivery_fee DECIMAL(10,2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (cook_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_active_rating (is_active, rating),
    INDEX idx_cuisine (cuisine_type),
    INDEX idx_cook (cook_id)
);

-- Food items table
CREATE TABLE food_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    restaurant_id INT NOT NULL,
    category_id INT,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    image VARCHAR(500),
    is_vegetarian BOOLEAN DEFAULT false,
    is_vegan BOOLEAN DEFAULT false,
    is_spicy BOOLEAN DEFAULT false,
    preparation_time INT DEFAULT 15,
    is_available BOOLEAN DEFAULT true,
    rating DECIMAL(3,2) DEFAULT 0.00,
    total_reviews INT DEFAULT 0,
    total_orders INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
    INDEX idx_restaurant_available (restaurant_id, is_available),
    INDEX idx_category (category_id),
    INDEX idx_rating (rating),
    INDEX idx_price (price)
);

-- Favorites table
CREATE TABLE favorites (
    id INT AUTO_INCREMENT PRIMARY KEY,
    customer_id INT NOT NULL,
    food_item_id INT,
    restaurant_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (food_item_id) REFERENCES food_items(id) ON DELETE CASCADE,
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
    UNIQUE KEY unique_customer_food (customer_id, food_item_id),
    UNIQUE KEY unique_customer_restaurant (customer_id, restaurant_id),
    INDEX idx_customer (customer_id)
);

-- Cart items table
CREATE TABLE cart_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    customer_id INT NOT NULL,
    food_item_id INT NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    special_requests TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (food_item_id) REFERENCES food_items(id) ON DELETE CASCADE,
    UNIQUE KEY unique_customer_food_item (customer_id, food_item_id),
    INDEX idx_customer (customer_id)
);

-- Orders table
CREATE TABLE orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    customer_id INT NOT NULL,
    restaurant_id INT NOT NULL,
    order_number VARCHAR(50) UNIQUE NOT NULL,
    status ENUM('pending', 'confirmed', 'preparing', 'sent_to_delivery', 'delivered', 'cancelled') DEFAULT 'pending',
    total_amount DECIMAL(10,2) NOT NULL,
    delivery_fee DECIMAL(10,2) DEFAULT 0.00,
    tax_amount DECIMAL(10,2) DEFAULT 0.00,
    discount_amount DECIMAL(10,2) DEFAULT 0.00,
    final_amount DECIMAL(10,2) NOT NULL,
    payment_method ENUM('cash', 'card', 'upi', 'wallet') NOT NULL,
    payment_status ENUM('pending', 'paid', 'failed', 'refunded') DEFAULT 'pending',
    delivery_address JSON NOT NULL,
    special_instructions TEXT,
    estimated_delivery_time DATETIME,
    delivered_at DATETIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
    INDEX idx_customer (customer_id),
    INDEX idx_restaurant (restaurant_id),
    INDEX idx_status (status),
    INDEX idx_order_number (order_number),
    INDEX idx_created_at (created_at)
);

-- Order items table
CREATE TABLE order_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    food_item_id INT NOT NULL,
    quantity INT NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    total_price DECIMAL(10,2) NOT NULL,
    special_requests TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (food_item_id) REFERENCES food_items(id) ON DELETE CASCADE,
    INDEX idx_order (order_id),
    INDEX idx_food_item (food_item_id)
);

-- Reviews table
CREATE TABLE reviews (
    id INT AUTO_INCREMENT PRIMARY KEY,
    customer_id INT NOT NULL,
    restaurant_id INT NOT NULL,
    order_id INT,
    food_item_id INT,
    rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment TEXT,
    is_approved BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL,
    FOREIGN KEY (food_item_id) REFERENCES food_items(id) ON DELETE CASCADE,
    INDEX idx_restaurant_rating (restaurant_id, rating),
    INDEX idx_food_item_rating (food_item_id, rating),
    INDEX idx_customer (customer_id),
    INDEX idx_approved (is_approved)
);

-- Notifications table
CREATE TABLE notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type ENUM('order', 'general', 'promotion', 'system') DEFAULT 'general',
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_unread (user_id, is_read),
    INDEX idx_created_at (created_at)
);

-- Refund requests table
CREATE TABLE refund_requests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    customer_id INT NOT NULL,
    reason TEXT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    status ENUM('pending', 'approved', 'rejected', 'processed') DEFAULT 'pending',
    admin_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_order (order_id),
    INDEX idx_customer (customer_id),
    INDEX idx_status (status)
);

-- Insert sample data

-- Insert admin user
INSERT INTO users (email, password_hash, first_name, last_name, user_type, email_verified) VALUES
('admin@foodmarketplace.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Admin', 'User', 'admin', true);

-- Insert sample categories
INSERT INTO categories (name, description, sort_order) VALUES
('Appetizers', 'Start your meal with our delicious appetizers', 1),
('Main Course', 'Hearty and satisfying main dishes', 2),
('Desserts', 'Sweet treats to end your meal', 3),
('Beverages', 'Refreshing drinks and beverages', 4),
('Pizza', 'Delicious pizzas with various toppings', 5),
('Pasta', 'Italian pasta dishes', 6),
('Indian', 'Traditional Indian cuisine', 7),
('Chinese', 'Authentic Chinese dishes', 8),
('Fast Food', 'Quick and tasty fast food options', 9),
('Healthy', 'Nutritious and healthy meal options', 10);

-- Insert sample cook user
INSERT INTO users (email, password_hash, first_name, last_name, user_type, phone, email_verified) VALUES
('cook@demo.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Demo', 'Cook', 'cook', '+1234567890', true);

-- Insert sample customer user
INSERT INTO users (email, password_hash, first_name, last_name, user_type, phone, email_verified) VALUES
('customer@demo.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Demo', 'Customer', 'customer', '+1234567891', true);

-- Insert sample restaurant
INSERT INTO restaurants (cook_id, name, description, cuisine_type, phone, email, rating, delivery_fee) VALUES
(2, 'Demo Restaurant', 'A fantastic restaurant serving delicious food', 'Multi-cuisine', '+1234567890', 'info@demorestaurant.com', 4.5, 2.50);

-- Insert sample food items
INSERT INTO food_items (restaurant_id, category_id, name, description, price, is_vegetarian, preparation_time, is_available) VALUES
(1, 1, 'Chicken Wings', 'Crispy chicken wings with your choice of sauce', 12.99, false, 15, true),
(1, 1, 'Mozzarella Sticks', 'Golden fried mozzarella sticks with marinara sauce', 8.99, true, 10, true),
(1, 2, 'Grilled Chicken Breast', 'Juicy grilled chicken breast with herbs and spices', 18.99, false, 25, true),
(1, 2, 'Vegetarian Pasta', 'Fresh pasta with seasonal vegetables and marinara sauce', 14.99, true, 20, true),
(1, 3, 'Chocolate Cake', 'Rich and moist chocolate cake with chocolate frosting', 6.99, true, 5, true),
(1, 4, 'Fresh Lemonade', 'Refreshing homemade lemonade', 3.99, true, 2, true),
(1, 5, 'Margherita Pizza', 'Classic pizza with tomato sauce, mozzarella, and basil', 16.99, true, 18, true),
(1, 6, 'Spaghetti Carbonara', 'Creamy pasta with bacon, eggs, and parmesan cheese', 17.99, false, 15, true);

-- Create triggers to update ratings when reviews are added/updated

DELIMITER $$

CREATE TRIGGER update_restaurant_rating_after_review_insert
AFTER INSERT ON reviews
FOR EACH ROW
BEGIN
    UPDATE restaurants 
    SET 
        rating = (SELECT AVG(rating) FROM reviews WHERE restaurant_id = NEW.restaurant_id AND is_approved = true),
        total_reviews = (SELECT COUNT(*) FROM reviews WHERE restaurant_id = NEW.restaurant_id AND is_approved = true)
    WHERE id = NEW.restaurant_id;
END$$

CREATE TRIGGER update_restaurant_rating_after_review_update
AFTER UPDATE ON reviews
FOR EACH ROW
BEGIN
    UPDATE restaurants 
    SET 
        rating = (SELECT COALESCE(AVG(rating), 0) FROM reviews WHERE restaurant_id = NEW.restaurant_id AND is_approved = true),
        total_reviews = (SELECT COUNT(*) FROM reviews WHERE restaurant_id = NEW.restaurant_id AND is_approved = true)
    WHERE id = NEW.restaurant_id;
END$$

CREATE TRIGGER update_restaurant_rating_after_review_delete
AFTER DELETE ON reviews
FOR EACH ROW
BEGIN
    UPDATE restaurants 
    SET 
        rating = (SELECT COALESCE(AVG(rating), 0) FROM reviews WHERE restaurant_id = OLD.restaurant_id AND is_approved = true),
        total_reviews = (SELECT COUNT(*) FROM reviews WHERE restaurant_id = OLD.restaurant_id AND is_approved = true)
    WHERE id = OLD.restaurant_id;
END$$

CREATE TRIGGER update_food_item_rating_after_review_insert
AFTER INSERT ON reviews
FOR EACH ROW
BEGIN
    IF NEW.food_item_id IS NOT NULL THEN
        UPDATE food_items 
        SET 
            rating = (SELECT AVG(rating) FROM reviews WHERE food_item_id = NEW.food_item_id AND is_approved = true),
            total_reviews = (SELECT COUNT(*) FROM reviews WHERE food_item_id = NEW.food_item_id AND is_approved = true)
        WHERE id = NEW.food_item_id;
    END IF;
END$$

CREATE TRIGGER update_food_item_rating_after_review_update
AFTER UPDATE ON reviews
FOR EACH ROW
BEGIN
    IF NEW.food_item_id IS NOT NULL THEN
        UPDATE food_items 
        SET 
            rating = (SELECT COALESCE(AVG(rating), 0) FROM reviews WHERE food_item_id = NEW.food_item_id AND is_approved = true),
            total_reviews = (SELECT COUNT(*) FROM reviews WHERE food_item_id = NEW.food_item_id AND is_approved = true)
        WHERE id = NEW.food_item_id;
    END IF;
END$$

CREATE TRIGGER update_food_item_rating_after_review_delete
AFTER DELETE ON reviews
FOR EACH ROW
BEGIN
    IF OLD.food_item_id IS NOT NULL THEN
        UPDATE food_items 
        SET 
            rating = (SELECT COALESCE(AVG(rating), 0) FROM reviews WHERE food_item_id = OLD.food_item_id AND is_approved = true),
            total_reviews = (SELECT COUNT(*) FROM reviews WHERE food_item_id = OLD.food_item_id AND is_approved = true)
        WHERE id = OLD.food_item_id;
    END IF;
END$$

DELIMITER ;

-- Display success message
SELECT 'Database schema created successfully!' as Status;
SELECT 'Default login credentials:' as Info;
SELECT 'Admin: admin@foodmarketplace.com / admin123' as AdminLogin;
SELECT 'Cook: cook@demo.com / password' as CookLogin;
SELECT 'Customer: customer@demo.com / password' as CustomerLogin;
