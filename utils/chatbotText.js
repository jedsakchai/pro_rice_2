function normalizeText(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function isConfirmText(text) {
  const value = normalizeText(text).toLowerCase();
  return ['ยืนยัน', 'confirm', 'ตกลง', 'ใช่', 'ok', 'yes'].some((word) => value.includes(word));
}

function isCancelText(text) {
  const value = normalizeText(text).toLowerCase();
  return ['ยกเลิก', 'cancel', 'ไม่เอา', 'แก้ไข'].some((word) => value.includes(word));
}

function detectIntent(text) {
  const value = normalizeText(text).toLowerCase();

  if (/(ตรวจสอบคิว|เช็คคิว|ดูคิว|สถานะคิว)/.test(value)) return { intent: 'check_booking', confidence: 0.95 };
  if (/(ยกเลิกคิว|ยกเลิกการจอง|cancel booking|cancel)/.test(value)) return { intent: 'cancel_booking', confidence: 0.95 };
  if (/(ดูรายการสินค้า|รายการสินค้า|สินค้าอะไร|สินค้า)/.test(value)) return { intent: 'get_products', confidence: 0.95 };
  if (/(ติดต่อ|โทร|ที่อยู่|เบอร์โรงสี)/.test(value)) return { intent: 'contact', confidence: 0.8 };
  if (/(สั่งซื้อ|order|ซื้อสินค้า|ซื้อของ)/.test(value)) return { intent: 'create_order', confidence: 0.9 };
  if (/(จอง|booking|คิวสี|สีข้าว)/.test(value)) return { intent: 'create_booking', confidence: 0.9 };
  return { intent: 'general', confidence: 0.2 };
}

module.exports = {
  detectIntent,
  isCancelText,
  isConfirmText,
  normalizeText,
};