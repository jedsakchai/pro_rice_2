const mysql = require('mysql2/promise');
require('dotenv').config();

(async () => {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'rice_mill_db'
  });

  try {
    // Create orders table if not exists
    await conn.execute(`
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
        status ENUM('pending','awaiting_payment','confirmed','preparing','shipped','completed','cancelled') DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_orders_mill_id (mill_id),
        INDEX idx_orders_status (status),
        CONSTRAINT fk_orders_mill_id FOREIGN KEY (mill_id) REFERENCES mills(mill_id)
          ON DELETE SET NULL
          ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await conn.execute(`
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
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    console.log('✅ orders and order_items tables ensured');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exitCode = 1;
  } finally {
    await conn.end();
  }
})();
