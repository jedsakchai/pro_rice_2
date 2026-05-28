-- Rice Mill DB (MAMP/MySQL)
-- Use UTF-8 for Thai

USE rice_mill_db;

CREATE TABLE IF NOT EXISTS mills (
  mill_id INT PRIMARY KEY AUTO_INCREMENT,
  mill_name VARCHAR(120) NOT NULL,
  mill_name_th VARCHAR(120) NOT NULL,
  location VARCHAR(255) NOT NULL DEFAULT '',
  location_th VARCHAR(255) NOT NULL DEFAULT '',
  phone VARCHAR(30) NOT NULL DEFAULT '',
  email VARCHAR(120) NULL,
  latitude DECIMAL(10, 8) NULL,
  longitude DECIMAL(11, 8) NULL,
  operating_hours_start TIME NULL,
  operating_hours_end TIME NULL,
  capacity_per_day INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT TRUE,
  INDEX idx_location (location),
  INDEX idx_phone (phone)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS orders (
  order_id INT PRIMARY KEY AUTO_INCREMENT,
  order_number VARCHAR(60) NOT NULL UNIQUE,
  mill_id INT NULL,
  customer_name VARCHAR(120) NOT NULL,
  phone VARCHAR(30) NOT NULL,
  address VARCHAR(500) NOT NULL,
  shipping_method ENUM('delivery','pickup') NOT NULL DEFAULT 'delivery',
  shipping_fee DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  payment_method ENUM('bank_transfer','cod','promptpay') NOT NULL DEFAULT 'bank_transfer',
  payment_proof_url VARCHAR(255) NULL,
  note VARCHAR(500) NULL,
  total DECIMAL(12,2) NOT NULL,
  status ENUM('pending','accepted','pending_payment','payment_review','paid','preparing','ready_to_ship','shipping','completed','cancelled') DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_orders_mill_id (mill_id),
  INDEX idx_orders_status (status),
  CONSTRAINT fk_orders_mill_id FOREIGN KEY (mill_id) REFERENCES mills(mill_id)
    ON DELETE SET NULL
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS order_items (
  order_item_id INT PRIMARY KEY AUTO_INCREMENT,
  order_id INT NOT NULL,
  product_id INT NOT NULL,
  product_name_th VARCHAR(255) NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  quantity INT NOT NULL,
  subtotal DECIMAL(12,2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_order_items_order FOREIGN KEY (order_id) REFERENCES orders(order_id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS owners (
  owner_id INT PRIMARY KEY AUTO_INCREMENT,
  owner_name VARCHAR(120) NOT NULL,
  mill_name VARCHAR(120) NOT NULL,
  mill_id INT NULL,
  role ENUM('villager','owner') NOT NULL DEFAULT 'villager',
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_owner_name (owner_name),
  INDEX idx_mill_id (mill_id),
  CONSTRAINT fk_owners_mill_id FOREIGN KEY (mill_id) REFERENCES mills(mill_id)
    ON DELETE SET NULL
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS villagers (
  villager_id INT PRIMARY KEY AUTO_INCREMENT,
  villager_name VARCHAR(120) NOT NULL,
  username VARCHAR(120) NOT NULL,
  phone VARCHAR(30) NULL,
  address VARCHAR(500) NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_villager_name (villager_name),
  UNIQUE KEY uq_villager_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS milling_requests (
  request_id INT PRIMARY KEY AUTO_INCREMENT,
  mill_id INT NULL,
  submitted_by INT NULL,
  rice_type ENUM('white_rice', 'brown_rice', 'sticky_rice') NOT NULL,
  customer_name VARCHAR(120) NOT NULL,
  phone VARCHAR(30) NOT NULL,
  address VARCHAR(500) NOT NULL DEFAULT '',
  sacks INT NOT NULL,
  weight_kg DECIMAL(10, 2) NULL,
  dropoff_date DATE NOT NULL,
  expected_return_date DATE NULL,
  status ENUM('pending_review', 'accepted', 'awaiting_pickup', 'received', 'queued', 'milling', 'packing', 'ready', 'shipping', 'delivered', 'cancelled') DEFAULT 'pending_review',
  review_status ENUM('pending_review', 'reviewed') DEFAULT 'pending_review',
  notes TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_status (status),
  INDEX idx_customer (customer_name),
  INDEX idx_date (dropoff_date),
  INDEX idx_submitted_by (submitted_by),
  CONSTRAINT fk_milling_requests_mill_id FOREIGN KEY (mill_id) REFERENCES mills(mill_id)
    ON DELETE SET NULL
    ON UPDATE CASCADE,
  CONSTRAINT fk_milling_submitted_villager FOREIGN KEY (submitted_by) REFERENCES villagers(villager_id)
    ON DELETE SET NULL
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS inquiries (
  inquiry_id INT PRIMARY KEY AUTO_INCREMENT,
  subject VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,
  customer_name VARCHAR(120) NOT NULL,
  phone VARCHAR(30) NOT NULL,
  email VARCHAR(120) NULL,
  status ENUM('new', 'read', 'replied', 'closed') DEFAULT 'new',
  reply_message TEXT NULL,
  replied_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_status (status),
  INDEX idx_customer (customer_name),
  INDEX idx_date (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS contacts (
  contact_id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(120) NOT NULL,
  phone VARCHAR(30) NULL,
  message TEXT NOT NULL,
  subject VARCHAR(200) NULL,
  status ENUM('new', 'read', 'replied', 'spam') DEFAULT 'new',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_status (status),
  INDEX idx_email (email),
  INDEX idx_date (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS cancellation_requests (
  id INT PRIMARY KEY AUTO_INCREMENT,
  order_id INT NULL,
  milling_request_id INT NULL,
  user_id INT NOT NULL,
  cancellation_reason TEXT NOT NULL,
  additional_note TEXT NULL,
  status ENUM('pending_cancel', 'approved_cancel', 'rejected_cancel') NOT NULL DEFAULT 'pending_cancel',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_cancellation_order_id (order_id),
  UNIQUE KEY uq_cancellation_milling_request_id (milling_request_id),
  INDEX idx_cancellation_status (status),
  INDEX idx_cancellation_user (user_id),
  CONSTRAINT fk_cancellation_requests_order FOREIGN KEY (order_id) REFERENCES orders(order_id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_cancellation_requests_milling FOREIGN KEY (milling_request_id) REFERENCES milling_requests(request_id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_cancellation_requests_user FOREIGN KEY (user_id) REFERENCES villagers(villager_id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT chk_cancellation_exactly_one_target CHECK (
    (order_id IS NOT NULL AND milling_request_id IS NULL)
    OR (order_id IS NULL AND milling_request_id IS NOT NULL)
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS products (
  product_id INT PRIMARY KEY AUTO_INCREMENT,
  category ENUM('white_rice', 'brown_rice', 'rice_bran', 'broken_rice', 'husk') NOT NULL,
  category_th VARCHAR(100) NOT NULL,
  product_name VARCHAR(255) NOT NULL,
  product_name_th VARCHAR(255) NOT NULL,
  description TEXT NULL,
  description_th TEXT NULL,
  price DECIMAL(10, 2) NOT NULL,
  unit VARCHAR(50) NOT NULL,
  unit_th VARCHAR(50) NOT NULL,
  stock INT NOT NULL DEFAULT 0,
  image_url VARCHAR(255) NULL,
  mill_id INT NULL,
  is_available BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_category (category),
  INDEX idx_mill_id (mill_id),
  INDEX idx_available (is_available),
  CONSTRAINT fk_products_mill_id FOREIGN KEY (mill_id) REFERENCES mills(mill_id)
    ON DELETE SET NULL
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
