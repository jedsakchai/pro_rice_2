-- Rice Mill DB (MAMP/MySQL)
-- Use UTF-8 for Thai

CREATE DATABASE IF NOT EXISTS rice_mill_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

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

-- Orders
CREATE TABLE IF NOT EXISTS orders (
  order_id INT PRIMARY KEY AUTO_INCREMENT,
  order_number VARCHAR(60) NOT NULL UNIQUE,
  mill_id INT NULL,
  customer_name VARCHAR(120) NOT NULL,
  villager_id INT NULL,
  phone VARCHAR(30) NOT NULL,
  address VARCHAR(500) NOT NULL,
  shipping_method ENUM('delivery','pickup') NOT NULL DEFAULT 'delivery',
  shipping_fee DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  payment_method ENUM('bank_transfer','cod','promptpay') NOT NULL DEFAULT 'bank_transfer',
  payment_proof_url VARCHAR(255) NULL,
  note VARCHAR(500) NULL,
  cancel_reason TEXT NULL,
  cancelled_at TIMESTAMP NULL,
  total DECIMAL(12,2) NOT NULL,
  status ENUM('pending','accepted','pending_payment','payment_review','paid','preparing','awaiting_pickup','ready_to_ship','shipping','completed','cancelled') DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_orders_mill_id (mill_id),
  INDEX idx_orders_villager_id (villager_id),
  INDEX idx_orders_status (status),
  CONSTRAINT fk_orders_mill_id FOREIGN KEY (mill_id) REFERENCES mills(mill_id)
    ON DELETE SET NULL
    ON UPDATE CASCADE,
  CONSTRAINT fk_orders_villager_id FOREIGN KEY (villager_id) REFERENCES villagers(villager_id)
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

-- เจ้าของโรงสี
CREATE TABLE IF NOT EXISTS owners (
  owner_id INT PRIMARY KEY AUTO_INCREMENT,
  owner_name VARCHAR(120) NOT NULL,
  mill_name VARCHAR(120) NOT NULL,
  mill_id INT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_owner_name (owner_name),
  INDEX idx_mill_id (mill_id),
  CONSTRAINT fk_owners_mill_id FOREIGN KEY (mill_id) REFERENCES mills(mill_id)
    ON DELETE SET NULL
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ชาวบ้าน
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
  cancel_reason TEXT NULL,
  cancelled_at TIMESTAMP NULL,
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

-- Notifications table for pushing status updates to villagers
CREATE TABLE IF NOT EXISTS notifications (
  notification_id INT PRIMARY KEY AUTO_INCREMENT,
  villager_id INT NULL,
  type ENUM('order','milling') NOT NULL,
  resource_id INT NOT NULL,
  status VARCHAR(60) NULL,
  message VARCHAR(255) NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_notifications_villager (villager_id),
  CONSTRAINT fk_notifications_villager FOREIGN KEY (villager_id) REFERENCES villagers(villager_id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Status history for timeline rendering
CREATE TABLE IF NOT EXISTS status_history (
  history_id INT PRIMARY KEY AUTO_INCREMENT,
  resource_type ENUM('order','milling') NOT NULL,
  resource_id INT NOT NULL,
  from_status VARCHAR(60) NULL,
  to_status VARCHAR(60) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_status_history_lookup (resource_type, resource_id, created_at),
  INDEX idx_status_history_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Cancellation requests
CREATE TABLE IF NOT EXISTS cancellation_requests (
  id INT PRIMARY KEY AUTO_INCREMENT,
  order_id INT NULL,
  milling_request_id INT NULL,
  user_id INT NOT NULL,
  cancellation_reason TEXT NOT NULL,
  additional_note TEXT NULL,
  resource_status VARCHAR(60) NULL,
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

-- ตาราผลิตภัณฑ์
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

-- Seed mills if empty
INSERT INTO mills (mill_id, mill_name, mill_name_th, location, location_th, phone, email, capacity_per_day, operating_hours_start, operating_hours_end)
SELECT * FROM (
    SELECT 1 AS mill_id, 'Central Mill' AS mill_name, 'โรงสีบ้านบางกระวาน' AS mill_name_th,
         '123 Thep Satit Rd., Udon Thani' AS location, '123 ถนนเทพสถิต จังหวัดอุดรธานี' AS location_th,
         '081-234-5678' AS phone, 'central@ricemillsite.com' AS email, 500 AS capacity_per_day,
         '06:00:00' AS operating_hours_start, '20:00:00' AS operating_hours_end
  UNION ALL
    SELECT 2, 'Northern Mill', 'โรงสีบ้านปรือคัน',
         '456 Mittraphap Rd., Nakhon Ratchasima', '456 ถนนมิตรภาพ จังหวัดนครราชสีมา',
         '089-345-6789', 'north@ricemillsite.com', 400, '07:00:00', '18:00:00'
  UNION ALL
    SELECT 3, 'Southern Mill', 'โรงสีบ้านเนินเเสง',
         '789 Petchkasem Rd., Songkhla', '789 ถนนเพชรเกษม จังหวัดสงขลา',
         '086-456-7890', 'south@ricemillsite.com', 450, '06:00:00', '19:00:00'
) AS seed
WHERE NOT EXISTS (SELECT 1 FROM mills);

-- Seed products if empty
INSERT INTO products (product_id, category, category_th, product_name, product_name_th, description, description_th, price, unit, unit_th, stock, image_url, mill_id)
SELECT * FROM (
  -- ข้าวสาร (White Rice)
  SELECT 1, 'white_rice', 'ข้าวสาร', 'Jasmine Rice ข้าวหอมมะลิ', 'ข้าวสาร', 'Pure white rice grains, high quality', 'เมล็ดข้าวที่ผ่านการสีลอก ความสะอาด 100% พร้อมบริโภค', 45.00, '1 kg.', '1 กก.', 120, '/images/rice-1.jpg', 1
  UNION ALL
  SELECT 2, 'white_rice', 'ข้าวสาร', 'Sticky Rice ข้าวเหนียว', 'ข้าวเหนียว', 'Sticky rice for regional dishes', 'ข้าวเหนียวเรียวว่างเหนียวปุ้ม พอ อร่อย', 50.00, '1 kg.', '1 กก.', 80, '/images/rice-sticky.jpg', 1
  UNION ALL
  SELECT 3, 'white_rice', 'ข้าวสาร', 'Broken Rice ข้าวกระดูก', 'ข้าวกระดูก', 'Premium broken rice, clean and dry', 'ครึ่งท้ายของข้าว ปลายเมล็ด ใช้สำหรับอาหารสัตว์ คุณภาพดี', 15.00, '1 kg.', '1 กก.', 200, '/images/rice-broken.jpg', 1
  UNION ALL
  -- รำข้าว (Brown Rice)
  SELECT 4, 'brown_rice', 'รำข้าว', 'Brown Rice ร้าข้าว', 'ร้าข้าว', 'Rice bran for animal feed', 'ข้าวที่ลอกเปลือกนอกออก ใช้ได้หลายทาง อาหารสัตว์ หรือแหล่งแป้ง', 20.00, '1 kg.', '1 กก.', 150, '/images/rice-2.png', 1
  UNION ALL
  SELECT 5, 'brown_rice', 'รำข้าว', 'Brown Rice High Quality ร้าข้าวคุณภาพ', 'ร้าข้าวคุณภาพ', 'High quality brown rice', 'ร้าข้าวสำหรับเบเกอรี่อาหารสัตว์ สำหรับไข่ไก่พรีเมี่ยม', 25.00, '5 kg.', '5 กก.', 100, '/images/rice-bran.jpg', 1
  UNION ALL
  -- ปลายข้าว (Broken Rice)
  SELECT 6, 'broken_rice', 'ปลายข้าว', 'Grain Fragments ปลายข้าวหอมมะลิ', 'ปลายข้าว', 'Clean and dry grain fragments', 'ครึ่งท้ายของข้าว ปลายเมล็ด ใช้สำหรับอาหารสัตว์ คุณภาพดี', 18.00, '1 kg.', '1 กก.', 100, '/images/rice-3.jpg', 1
  UNION ALL
  SELECT 7, 'broken_rice', 'ปลายข้าว', 'Broken Rice Premium ปลายข้าวพรีเมียม', 'ปลายข้าวพรีเมียม', 'Premium quality broken rice', 'สะอาก ปลดเปลือกไอใช้สำหรับ เบเกอรี่', 22.00, '5 kg.', '5 กก.', 80, '/images/broken-premium.jpg', 1
  UNION ALL
  -- แกลบ (Husk)
  SELECT 8, 'husk', 'แกลบ', 'Husk แกลบตัน', 'แกลบ', 'Rice husk for animal feed or fuel', 'เปลือกนอกของข้าว ใช้เป็นอาหารสัตว์ หรือเชื้อเพลิง ปริมาณมี', 35.00, '10 kg.', '10 กก.', 60, '/images/rice-4.jpg', 1
  UNION ALL
  SELECT 9, 'husk', 'แกลบ', 'Clean Husk แกลบสะอาด', 'แกลบสะอาด', 'Clean and sorted rice husk', 'แกลบบิดท์เอเอ่น คุณภาพดี ใช้เป็นเชื้อเพลิง', 40.00, '25 kg.', '25 กก.', 40, '/images/husk-clean.jpg', 1
) AS seed
WHERE NOT EXISTS (SELECT 1 FROM products);
