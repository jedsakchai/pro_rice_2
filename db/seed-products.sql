USE rice_mill_db;

INSERT INTO products (
  product_id, category, category_th, product_name, product_name_th,
  description, description_th, price, unit, unit_th, stock, image_url, mill_id, is_available
)
SELECT * FROM (
  SELECT 1 AS product_id, 'white_rice' AS category, 'ข้าวสาร' AS category_th,
         'Jasmine Rice' AS product_name, 'ข้าวหอมมะลิ' AS product_name_th,
         'Premium jasmine rice' AS description, 'ข้าวหอมมะลิคุณภาพดี' AS description_th,
         45.00 AS price, '1 kg.' AS unit, '1 กก.' AS unit_th, 120 AS stock,
         '/images/rice-1.jpg' AS image_url, 1 AS mill_id, 1 AS is_available
  UNION ALL
  SELECT 2, 'white_rice', 'ข้าวสาร', 'Sticky Rice', 'ข้าวเหนียว',
         'Sticky rice for cooking', 'ข้าวเหนียวคุณภาพดี',
         50.00, '1 kg.', '1 กก.', 80, '/images/rice-2.png', 1, 1
  UNION ALL
       SELECT 3, 'white_rice', 'ข้าวสาร', 'Broken Rice', 'ปลายข้าว',
         'Clean broken rice', 'ปลายข้าวสะอาดพร้อมใช้งาน',
         18.00, '1 kg.', '1 กก.', 150, '/images/rice-3.jpg', 1, 1
  UNION ALL
  SELECT 4, 'brown_rice', 'รำข้าว', 'Brown Rice', 'ข้าวกล้อง',
         'Healthy brown rice', 'ข้าวกล้องคุณภาพ',
         55.00, '1 kg.', '1 กก.', 100, '/images/rice-4.jpg', 2, 1
  UNION ALL
  SELECT 5, 'rice_bran', 'รำข้าว', 'Rice Bran', 'รำข้าว',
         'Rice bran for animal feed', 'รำข้าวสำหรับสัตว์เลี้ยง',
         20.00, '5 kg.', '5 กก.', 90, '/images/rice-5.jpg', 2, 1
  UNION ALL
  SELECT 6, 'broken_rice', 'ปลายข้าว', 'Broken Rice Premium', 'ปลายข้าวพรีเมียม',
         'Premium broken rice', 'ปลายข้าวเกรดพรีเมียม',
         25.00, '5 kg.', '5 กก.', 70, '/images/rice-6.jpg', 3, 1
  UNION ALL
  SELECT 7, 'husk', 'แกลบ', 'Rice Husk', 'แกลบ',
         'Husk for fuel or compost', 'แกลบใช้เป็นเชื้อเพลิงหรือปุ๋ย',
         12.00, '10 kg.', '10 กก.', 60, '/images/rice-4.jpg', 3, 1
  UNION ALL
  SELECT 8, 'white_rice', 'ข้าวสาร', 'White Rice Family Pack', 'ข้าวสารแพ็กครอบครัว',
         'Large family pack of white rice', 'ข้าวสารแพ็กขนาดใหญ่สำหรับครอบครัว',
         160.00, '5 kg.', '5 กก.', 40, '/images/rice-1.jpg', 1, 1
  UNION ALL
  SELECT 9, 'brown_rice', 'รำข้าว', 'Healthy Brown Rice Pack', 'ข้าวกล้องเพื่อสุขภาพ',
         'Healthy brown rice pack', 'ข้าวกล้องแพ็กเพื่อสุขภาพ',
         120.00, '3 kg.', '3 กก.', 35, '/images/rice-5.jpg', 2, 1
) AS seed
WHERE NOT EXISTS (SELECT 1 FROM products);
