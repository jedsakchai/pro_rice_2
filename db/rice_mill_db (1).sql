-- phpMyAdmin SQL Dump
-- version 5.1.2
-- https://www.phpmyadmin.net/
--
-- Host: localhost:3306
-- Generation Time: May 16, 2026 at 06:52 AM
-- Server version: 5.7.24
-- PHP Version: 8.3.1

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `rice_mill_db`
--

-- --------------------------------------------------------

--
-- Table structure for table `contacts`
--

CREATE TABLE `contacts` (
  `contact_id` int(11) NOT NULL,
  `name` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `phone` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `message` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `subject` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('new','read','replied','spam') COLLATE utf8mb4_unicode_ci DEFAULT 'new',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `inquiries`
--

CREATE TABLE `inquiries` (
  `inquiry_id` int(11) NOT NULL,
  `subject` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `message` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `customer_name` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `phone` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('new','read','replied','closed') COLLATE utf8mb4_unicode_ci DEFAULT 'new',
  `reply_message` text COLLATE utf8mb4_unicode_ci,
  `replied_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `milling_requests`
--

CREATE TABLE `milling_requests` (
  `request_id` int(11) NOT NULL,
  `mill_id` int(11) DEFAULT NULL,
  `submitted_by` int(11) DEFAULT NULL,
  `rice_type` enum('white_rice','brown_rice','sticky_rice') COLLATE utf8mb4_unicode_ci NOT NULL,
  `customer_name` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `phone` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `address` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `sacks` int(11) NOT NULL,
  `weight_kg` decimal(10,2) DEFAULT NULL,
  `dropoff_date` date NOT NULL,
  `expected_return_date` date DEFAULT NULL,
  `status` enum('pending','in_progress','completed','cancelled') COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  `review_status` enum('pending_review','reviewed') COLLATE utf8mb4_unicode_ci DEFAULT 'pending_review',
  `notes` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `milling_requests`
--

INSERT INTO `milling_requests` (`request_id`, `mill_id`, `submitted_by`, `rice_type`, `customer_name`, `phone`, `address`, `sacks`, `weight_kg`, `dropoff_date`, `expected_return_date`, `status`, `review_status`, `notes`, `created_at`, `updated_at`) VALUES
(1, 3, 1, 'sticky_rice', 'tfyghj', '1234567890', 'fbjjesdtfyiguhijok', 10000, NULL, '2026-05-22', NULL, 'pending', 'reviewed', NULL, '2026-05-16 05:58:43', '2026-05-16 05:59:02');

-- --------------------------------------------------------

--
-- Table structure for table `mills`
--

CREATE TABLE `mills` (
  `mill_id` int(11) NOT NULL,
  `mill_name` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `mill_name_th` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `location` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `location_th` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `phone` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `email` varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `latitude` decimal(10,8) DEFAULT NULL,
  `longitude` decimal(11,8) DEFAULT NULL,
  `operating_hours_start` time DEFAULT NULL,
  `operating_hours_end` time DEFAULT NULL,
  `capacity_per_day` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `is_active` tinyint(1) DEFAULT '1'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `mills`
--

INSERT INTO `mills` (`mill_id`, `mill_name`, `mill_name_th`, `location`, `location_th`, `phone`, `email`, `latitude`, `longitude`, `operating_hours_start`, `operating_hours_end`, `capacity_per_day`, `created_at`, `updated_at`, `is_active`) VALUES
(1, 'Central Mill', 'โรงสีกลาง', '123 Thep Satit Rd., Udon Thani', '123 ถนนเทพสถิต จังหวัดอุดรธานี', '081-234-5678', 'central@ricemillsite.com', NULL, NULL, '06:00:00', '20:00:00', 500, '2026-05-16 05:40:12', '2026-05-16 06:13:06', 1),
(2, 'Northern Mill', 'โรงสีเหนือ', '456 Chiang Mai Rd., Chiang Mai', '456 ถนนเชียงใหม่ จังหวัดเชียงใหม่', '085-987-6543', 'north@ricemillsite.com', NULL, NULL, '07:00:00', '19:00:00', 300, '2026-05-16 05:40:12', '2026-05-16 06:13:06', 1),
(3, 'Southern Mill', 'โรงสีใต้ พรีเมียม', '789 Petchkasem Rd., Songkhla', '789 ถนนเพชรเกษม จังหวัดสงขลา', '086-456-7890', 'south@ricemillsite.com', NULL, NULL, '06:00:00', '19:00:00', 450, '2026-05-16 05:40:12', '2026-05-16 06:13:06', 1);

-- --------------------------------------------------------

--
-- Table structure for table `orders`
--

CREATE TABLE `orders` (
  `order_id` int(11) NOT NULL,
  `order_number` varchar(60) COLLATE utf8mb4_unicode_ci NOT NULL,
  `mill_id` int(11) DEFAULT NULL,
  `customer_name` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `villager_id` int(11) DEFAULT NULL,
  `phone` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `address` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL,
  `shipping_method` enum('delivery','pickup') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'delivery',
  `shipping_fee` decimal(10,2) NOT NULL DEFAULT '0.00',
  `payment_method` enum('bank_transfer','cod','promptpay') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'bank_transfer',
  `payment_proof_url` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `note` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `total` decimal(12,2) NOT NULL,
  `status` enum('pending','awaiting_payment','confirmed','preparing','shipped','completed','cancelled') COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `orders`
--

INSERT INTO `orders` (`order_id`, `order_number`, `mill_id`, `customer_name`, `villager_id`, `phone`, `address`, `shipping_method`, `shipping_fee`, `payment_method`, `payment_proof_url`, `note`, `total`, `status`, `created_at`, `updated_at`) VALUES
(1, 'ORD-1778912704658-6924', 1, 'Test User', NULL, '0812345678', 'Bangkok', 'delivery', '10.00', 'cod', NULL, '', '170.00', 'pending', '2026-05-16 06:25:04', '2026-05-16 06:25:04'),
(2, 'ORD-1778912809496-6069', 2, 'จน จน', 1, '1234567890', 'ฟหกดเ้่าส', 'pickup', '0.00', 'cod', NULL, '', '175.00', 'pending', '2026-05-16 06:26:49', '2026-05-16 06:26:49'),
(3, 'ORD-1778912809497-4389', 3, 'จน จน', 1, '1234567890', 'ฟหกดเ้่าส', 'pickup', '0.00', 'cod', NULL, '', '37.00', 'pending', '2026-05-16 06:26:49', '2026-05-16 06:26:49'),
(4, 'ORD-1778913843154-1358', 1, 'จน จน', 1, '1234567890', 'หกเด้เ่้า่สาวสว', 'pickup', '0.00', 'cod', NULL, '', '205.00', 'pending', '2026-05-16 06:44:03', '2026-05-16 06:44:03'),
(5, 'ORD-1778913843156-7822', 3, 'จน จน', 1, '1234567890', 'หกเด้เ่้า่สาวสว', 'pickup', '0.00', 'cod', NULL, '', '37.00', 'pending', '2026-05-16 06:44:03', '2026-05-16 06:44:03'),
(6, 'ORD-1778913843157-5949', 2, 'จน จน', 1, '1234567890', 'หกเด้เ่้า่สาวสว', 'pickup', '0.00', 'cod', NULL, '', '140.00', 'pending', '2026-05-16 06:44:03', '2026-05-16 06:44:03');

-- --------------------------------------------------------

--
-- Table structure for table `order_items`
--

CREATE TABLE `order_items` (
  `order_item_id` int(11) NOT NULL,
  `order_id` int(11) NOT NULL,
  `product_id` int(11) NOT NULL,
  `product_name_th` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `price` decimal(10,2) NOT NULL,
  `quantity` int(11) NOT NULL,
  `subtotal` decimal(12,2) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `order_items`
--

INSERT INTO `order_items` (`order_item_id`, `order_id`, `product_id`, `product_name_th`, `price`, `quantity`, `subtotal`, `created_at`) VALUES
(1, 1, 8, '???????????????????', '160.00', 1, '160.00', '2026-05-16 06:25:04'),
(2, 2, 4, 'ข้าวกล้อง', '55.00', 1, '55.00', '2026-05-16 06:26:49'),
(3, 2, 9, 'ข้าวกล้องเพื่อสุขภาพ', '120.00', 1, '120.00', '2026-05-16 06:26:49'),
(4, 3, 6, 'ปลายข้าวพรีเมียม', '25.00', 1, '25.00', '2026-05-16 06:26:49'),
(5, 3, 7, 'แกลบ', '12.00', 1, '12.00', '2026-05-16 06:26:49'),
(6, 4, 8, 'ข้าวสารแพ็กครอบครัว', '160.00', 1, '160.00', '2026-05-16 06:44:03'),
(7, 4, 1, 'ข้าวหอมมะลิ', '45.00', 1, '45.00', '2026-05-16 06:44:03'),
(8, 5, 7, 'แกลบ', '12.00', 1, '12.00', '2026-05-16 06:44:03'),
(9, 5, 6, 'ปลายข้าวพรีเมียม', '25.00', 1, '25.00', '2026-05-16 06:44:03'),
(10, 6, 9, 'ข้าวกล้องเพื่อสุขภาพ', '120.00', 1, '120.00', '2026-05-16 06:44:03'),
(11, 6, 5, 'รำข้าว', '20.00', 1, '20.00', '2026-05-16 06:44:03');

-- --------------------------------------------------------

--
-- Table structure for table `owners`
--

CREATE TABLE `owners` (
  `owner_id` int(11) NOT NULL,
  `owner_name` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `mill_name` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `mill_id` int(11) DEFAULT NULL,
  `password_hash` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `owners`
--

INSERT INTO `owners` (`owner_id`, `owner_name`, `mill_name`, `mill_id`, `password_hash`, `created_at`, `updated_at`) VALUES
(1, 'จนมาก', '333333', 3, '$2a$10$Tv2vE9dTaEm70QspVpd4/eNfkoRYRekLRVmjCXTJBNCpeDFMClRwi', '2026-05-16 05:56:34', '2026-05-16 05:56:34'),
(2, 'Owner Tester', 'owner1', 1, '$2a$10$3zf7mPXlaBavjhr8vOa4zu.iTJ.9aT/M1XahlNC5ty4xYTlM/mBZC', '2026-05-16 06:49:21', '2026-05-16 06:49:21');

-- --------------------------------------------------------

--
-- Table structure for table `products`
--

CREATE TABLE `products` (
  `product_id` int(11) NOT NULL,
  `category` enum('white_rice','brown_rice','rice_bran','broken_rice','husk') COLLATE utf8mb4_unicode_ci NOT NULL,
  `category_th` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `product_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `product_name_th` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `description_th` text COLLATE utf8mb4_unicode_ci,
  `price` decimal(10,2) NOT NULL,
  `unit` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `unit_th` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `stock` int(11) NOT NULL DEFAULT '0',
  `image_url` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `mill_id` int(11) DEFAULT NULL,
  `is_available` tinyint(1) DEFAULT '1',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `products`
--

INSERT INTO `products` (`product_id`, `category`, `category_th`, `product_name`, `product_name_th`, `description`, `description_th`, `price`, `unit`, `unit_th`, `stock`, `image_url`, `mill_id`, `is_available`, `created_at`, `updated_at`) VALUES
(1, 'white_rice', 'ข้าวสาร', 'Jasmine Rice', 'ข้าวหอมมะลิ', 'Premium jasmine rice', 'ข้าวหอมมะลิคุณภาพดี', '45.00', '1 kg.', '1 กก.', 120, '/images/rice-1.jpg', 1, 1, '2026-05-16 06:12:15', '2026-05-16 06:12:15'),
(2, 'white_rice', 'ข้าวสาร', 'Sticky Rice', 'ข้าวเหนียว', 'Sticky rice for cooking', 'ข้าวเหนียวคุณภาพดี', '50.00', '1 kg.', '1 กก.', 80, '/images/rice-2.png', 1, 1, '2026-05-16 06:12:15', '2026-05-16 06:12:15'),
(3, 'white_rice', 'ข้าวสาร', 'Broken Rice', 'ปลายข้าว', 'Clean broken rice', 'ปลายข้าวสะอาดพร้อมใช้งาน', '18.00', '1 kg.', '1 กก.', 150, '/images/rice-3.jpg', 1, 1, '2026-05-16 06:12:15', '2026-05-16 06:12:15'),
(4, 'brown_rice', 'ข้าวกล้อง', 'Brown Rice', 'ข้าวกล้อง', 'Healthy brown rice', 'ข้าวกล้องคุณภาพ', '55.00', '1 kg.', '1 กก.', 100, '/images/rice-4.jpg', 2, 1, '2026-05-16 06:12:15', '2026-05-16 06:12:15'),
(5, 'rice_bran', 'รำข้าว', 'Rice Bran', 'รำข้าว', 'Rice bran for animal feed', 'รำข้าวสำหรับสัตว์เลี้ยง', '20.00', '5 kg.', '5 กก.', 90, '/images/rice-5.jpg', 2, 1, '2026-05-16 06:12:15', '2026-05-16 06:12:15'),
(6, 'broken_rice', 'ปลายข้าว', 'Broken Rice Premium', 'ปลายข้าวพรีเมียม', 'Premium broken rice', 'ปลายข้าวเกรดพรีเมียม', '25.00', '5 kg.', '5 กก.', 70, '/images/rice-6.jpg', 3, 1, '2026-05-16 06:12:15', '2026-05-16 06:12:15'),
(7, 'husk', 'แกลบ', 'Rice Husk', 'แกลบ', 'Husk for fuel or compost', 'แกลบใช้เป็นเชื้อเพลิงหรือปุ๋ย', '12.00', '10 kg.', '10 กก.', 60, '/images/rice-4.jpg', 3, 1, '2026-05-16 06:12:15', '2026-05-16 06:12:15'),
(8, 'white_rice', 'ข้าวสาร', 'White Rice Family Pack', 'ข้าวสารแพ็กครอบครัว', 'Large family pack of white rice', 'ข้าวสารแพ็กขนาดใหญ่สำหรับครอบครัว', '160.00', '5 kg.', '5 กก.', 40, '/images/rice-1.jpg', 1, 1, '2026-05-16 06:12:15', '2026-05-16 06:12:15'),
(9, 'brown_rice', 'ข้าวกล้อง', 'Healthy Brown Rice Pack', 'ข้าวกล้องเพื่อสุขภาพ', 'Healthy brown rice pack', 'ข้าวกล้องแพ็กเพื่อสุขภาพ', '120.00', '3 kg.', '3 กก.', 35, '/images/rice-5.jpg', 2, 1, '2026-05-16 06:12:15', '2026-05-16 06:12:15');

-- --------------------------------------------------------

--
-- Table structure for table `villagers`
--

CREATE TABLE `villagers` (
  `villager_id` int(11) NOT NULL,
  `villager_name` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `username` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `phone` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `address` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `password_hash` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `villagers`
--

INSERT INTO `villagers` (`villager_id`, `villager_name`, `username`, `phone`, `address`, `password_hash`, `created_at`, `updated_at`) VALUES
(1, 'จน จน', '222222', '1234567890', 'าา่กา่ดา่', '$2a$10$rWGrpEIONoZ4MOxE8Yclne56zWSvuL3LSfh/LeC/vO0ksOWwq1v.O', '2026-05-16 05:51:58', '2026-05-16 05:51:58');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `contacts`
--
ALTER TABLE `contacts`
  ADD PRIMARY KEY (`contact_id`),
  ADD KEY `idx_status` (`status`),
  ADD KEY `idx_email` (`email`),
  ADD KEY `idx_date` (`created_at`);

--
-- Indexes for table `inquiries`
--
ALTER TABLE `inquiries`
  ADD PRIMARY KEY (`inquiry_id`),
  ADD KEY `idx_status` (`status`),
  ADD KEY `idx_customer` (`customer_name`),
  ADD KEY `idx_date` (`created_at`);

--
-- Indexes for table `milling_requests`
--
ALTER TABLE `milling_requests`
  ADD PRIMARY KEY (`request_id`),
  ADD KEY `idx_status` (`status`),
  ADD KEY `idx_customer` (`customer_name`),
  ADD KEY `idx_date` (`dropoff_date`),
  ADD KEY `idx_submitted_by` (`submitted_by`),
  ADD KEY `fk_milling_requests_mill_id` (`mill_id`);

--
-- Indexes for table `mills`
--
ALTER TABLE `mills`
  ADD PRIMARY KEY (`mill_id`),
  ADD KEY `idx_location` (`location`),
  ADD KEY `idx_phone` (`phone`);

--
-- Indexes for table `orders`
--
ALTER TABLE `orders`
  ADD PRIMARY KEY (`order_id`),
  ADD UNIQUE KEY `order_number` (`order_number`),
  ADD KEY `idx_orders_mill_id` (`mill_id`),
  ADD KEY `idx_orders_status` (`status`),
  ADD KEY `idx_orders_villager_id` (`villager_id`);

--
-- Indexes for table `order_items`
--
ALTER TABLE `order_items`
  ADD PRIMARY KEY (`order_item_id`),
  ADD KEY `fk_order_items_order` (`order_id`);

--
-- Indexes for table `owners`
--
ALTER TABLE `owners`
  ADD PRIMARY KEY (`owner_id`),
  ADD UNIQUE KEY `uq_owner_name` (`owner_name`),
  ADD KEY `idx_mill_id` (`mill_id`);

--
-- Indexes for table `products`
--
ALTER TABLE `products`
  ADD PRIMARY KEY (`product_id`),
  ADD KEY `idx_category` (`category`),
  ADD KEY `idx_mill_id` (`mill_id`),
  ADD KEY `idx_available` (`is_available`);

--
-- Indexes for table `villagers`
--
ALTER TABLE `villagers`
  ADD PRIMARY KEY (`villager_id`),
  ADD UNIQUE KEY `uq_villager_name` (`villager_name`),
  ADD UNIQUE KEY `uq_villager_username` (`username`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `contacts`
--
ALTER TABLE `contacts`
  MODIFY `contact_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `inquiries`
--
ALTER TABLE `inquiries`
  MODIFY `inquiry_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `milling_requests`
--
ALTER TABLE `milling_requests`
  MODIFY `request_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `mills`
--
ALTER TABLE `mills`
  MODIFY `mill_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `orders`
--
ALTER TABLE `orders`
  MODIFY `order_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT for table `order_items`
--
ALTER TABLE `order_items`
  MODIFY `order_item_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=12;

--
-- AUTO_INCREMENT for table `owners`
--
ALTER TABLE `owners`
  MODIFY `owner_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `products`
--
ALTER TABLE `products`
  MODIFY `product_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=10;

--
-- AUTO_INCREMENT for table `villagers`
--
ALTER TABLE `villagers`
  MODIFY `villager_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `milling_requests`
--
ALTER TABLE `milling_requests`
  ADD CONSTRAINT `fk_milling_requests_mill_id` FOREIGN KEY (`mill_id`) REFERENCES `mills` (`mill_id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_milling_submitted_villager` FOREIGN KEY (`submitted_by`) REFERENCES `villagers` (`villager_id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Constraints for table `orders`
--
ALTER TABLE `orders`
  ADD CONSTRAINT `fk_orders_mill_id` FOREIGN KEY (`mill_id`) REFERENCES `mills` (`mill_id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_orders_villager_id` FOREIGN KEY (`villager_id`) REFERENCES `villagers` (`villager_id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Constraints for table `order_items`
--
ALTER TABLE `order_items`
  ADD CONSTRAINT `fk_order_items_order` FOREIGN KEY (`order_id`) REFERENCES `orders` (`order_id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `owners`
--
ALTER TABLE `owners`
  ADD CONSTRAINT `fk_owners_mill_id` FOREIGN KEY (`mill_id`) REFERENCES `mills` (`mill_id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Constraints for table `products`
--
ALTER TABLE `products`
  ADD CONSTRAINT `fk_products_mill_id` FOREIGN KEY (`mill_id`) REFERENCES `mills` (`mill_id`) ON DELETE SET NULL ON UPDATE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
