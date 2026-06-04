CREATE DATABASE IF NOT EXISTS rice_mill_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE rice_mill_db;

CREATE TABLE IF NOT EXISTS users (
  user_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  line_user_id VARCHAR(100) NOT NULL,
  display_name VARCHAR(255) DEFAULT NULL,
  phone VARCHAR(32) DEFAULT NULL,
  role ENUM('customer', 'owner', 'admin') NOT NULL DEFAULT 'customer',
  current_flow VARCHAR(32) DEFAULT NULL,
  flow_data LONGTEXT DEFAULT NULL,
  chat_state_json LONGTEXT DEFAULT NULL,
  pending_intent VARCHAR(64) DEFAULT NULL,
  pending_payload_json LONGTEXT DEFAULT NULL,
  last_active_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id),
  UNIQUE KEY uq_users_line_user_id (line_user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS products (
  product_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  sku VARCHAR(64) DEFAULT NULL,
  category VARCHAR(100) DEFAULT NULL,
  category_th VARCHAR(100) DEFAULT NULL,
  product_name VARCHAR(255) NOT NULL,
  product_name_th VARCHAR(255) NOT NULL,
  description TEXT DEFAULT NULL,
  description_th TEXT DEFAULT NULL,
  price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  unit VARCHAR(32) NOT NULL DEFAULT 'kg',
  unit_th VARCHAR(32) NOT NULL DEFAULT 'กก.',
  stock INT NOT NULL DEFAULT 0,
  image_url VARCHAR(500) DEFAULT NULL,
  image_data LONGBLOB DEFAULT NULL,
  image_mime_type VARCHAR(100) DEFAULT NULL,
  mill_id BIGINT DEFAULT NULL,
  is_available TINYINT(1) NOT NULL DEFAULT 1,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (product_id),
  UNIQUE KEY uq_products_sku (sku),
  KEY idx_products_category (category),
  KEY idx_products_name (product_name_th, product_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS bookings (
  booking_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  booking_number VARCHAR(32) NOT NULL,
  line_user_id VARCHAR(100) NOT NULL,
  customer_name VARCHAR(255) NOT NULL,
  phone VARCHAR(32) NOT NULL,
  rice_type VARCHAR(100) NOT NULL,
  quantity_kg DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  desired_date DATE NOT NULL,
  dropoff_time VARCHAR(32) NOT NULL,
  note TEXT DEFAULT NULL,
  summary_json LONGTEXT DEFAULT NULL,
  status ENUM('pending', 'confirmed', 'completed', 'cancelled') NOT NULL DEFAULT 'confirmed',
  cancel_reason TEXT DEFAULT NULL,
  cancelled_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (booking_id),
  UNIQUE KEY uq_bookings_booking_number (booking_number),
  KEY idx_bookings_line_user_id (line_user_id),
  KEY idx_bookings_phone (phone),
  KEY idx_bookings_status (status),
  KEY idx_bookings_desired_date (desired_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS orders (
  order_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_number VARCHAR(32) NOT NULL,
  line_user_id VARCHAR(100) NOT NULL,
  customer_name VARCHAR(255) NOT NULL,
  phone VARCHAR(32) NOT NULL,
  shipping_address TEXT NOT NULL,
  product_name VARCHAR(255) NOT NULL,
  product_id BIGINT DEFAULT NULL,
  quantity DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  unit VARCHAR(32) NOT NULL DEFAULT 'kg',
  unit_price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  total_price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  shipping_method VARCHAR(32) NOT NULL DEFAULT 'delivery',
  note TEXT DEFAULT NULL,
  status ENUM('pending', 'confirmed', 'processing', 'shipped', 'completed', 'cancelled') NOT NULL DEFAULT 'confirmed',
  cancel_reason TEXT DEFAULT NULL,
  cancelled_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (order_id),
  UNIQUE KEY uq_orders_order_number (order_number),
  KEY idx_orders_line_user_id (line_user_id),
  KEY idx_orders_phone (phone),
  KEY idx_orders_status (status),
  KEY idx_orders_product_id (product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO products (
  sku, category, category_th, product_name, product_name_th, description, description_th,
  price, unit, unit_th, stock, image_url, is_available, is_active
) VALUES
  ('RICE-JASMINE', 'rice', 'ข้าว', 'Jasmine Rice', 'ข้าวหอมมะลิ', 'Premium fragrant rice', 'ข้าวหอมมะลิคุณภาพดี', 45.00, 'kg', 'กก.', 100, NULL, 1, 1),
  ('RICE-BROWN', 'rice', 'ข้าว', 'Brown Rice', 'ข้าวกล้อง', 'Healthy brown rice', 'ข้าวกล้องเพื่อสุขภาพ', 42.00, 'kg', 'กก.', 80, NULL, 1, 1),
  ('RICE-BRAN', 'byproduct', 'ผลิตภัณฑ์ข้างเคียง', 'Rice Bran', 'รำข้าว', 'Rice bran for feed', 'รำข้าวสำหรับอาหารสัตว์', 15.00, 'kg', 'กก.', 120, NULL, 1, 1),
  ('RICE-BROKEN', 'byproduct', 'ผลิตภัณฑ์ข้างเคียง', 'Broken Rice', 'ปลายข้าว', 'Broken rice for cooking', 'ปลายข้าวสำหรับทำอาหาร', 18.00, 'kg', 'กก.', 95, NULL, 1, 1),
  ('RICE-HUSK', 'byproduct', 'ผลิตภัณฑ์ข้างเคียง', 'Rice Husk', 'แกลบ', 'Rice husk for fuel or bedding', 'แกลบสำหรับเชื้อเพลิงหรือรองพื้น', 8.00, 'kg', 'กก.', 200, NULL, 1, 1)
ON DUPLICATE KEY UPDATE
  category = VALUES(category),
  category_th = VALUES(category_th),
  product_name = VALUES(product_name),
  product_name_th = VALUES(product_name_th),
  description = VALUES(description),
  description_th = VALUES(description_th),
  price = VALUES(price),
  unit = VALUES(unit),
  unit_th = VALUES(unit_th),
  stock = VALUES(stock),
  is_available = VALUES(is_available),
  is_active = VALUES(is_active);