const express = require('express');
const crypto = require('crypto');
const { detectIntent, isConfirmText, isCancelText, normalizeText } = require('../utils/chatbotText');
const { upsertLineUser, getLineUser, updateFlowState, clearFlowState } = require('../models/userModel');
const { createBooking, getBooking, cancelBooking, buildBookingSummaryText } = require('../controllers/bookingController');
const { createOrder, getProducts, buildOrderSummaryText } = require('../controllers/orderController');
const { replyToLine } = require('../utils/lineClient');
const { generateGeneralAnswer } = require('../services/llm');
const { buildBookingConfirmationFlex, buildBookingSuccessFlex } = require('../flex/bookingFlex');
const { buildOrderConfirmationFlex, buildOrderSuccessFlex } = require('../flex/orderFlex');
const { buildProductCarouselFlex } = require('../flex/productFlex');
const { buildContactFlex } = require('../flex/messages');

const router = express.Router();

function verifySignature(rawBody, signature) {
  const secret = String(process.env.LINE_CHANNEL_SECRET || '').trim();
  if (!secret || !rawBody || !signature) return false;
  const digest = crypto.createHmac('sha256', secret).update(rawBody).digest('base64');
  return digest === String(signature).trim();
}

function parseJson(value) {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

function buildText(text) {
  return { type: 'text', text: String(text || '') };
}

function firstMissing(keys, data) {
  return keys.find((key) => !data[key]);
}

function promptForBookingField(field) {
  const prompts = {
    name: 'กรุณาระบุชื่อผู้จอง',
    phone: 'กรุณาระบุเบอร์โทรศัพท์',
    riceType: 'กรุณาระบุประเภทข้าว',
    quantityKg: 'กรุณาระบุจำนวนกิโลกรัม',
    desiredDate: 'กรุณาระบุวันที่ต้องการสีข้าว',
    dropoffTime: 'กรุณาระบุเวลานำข้าวมาส่ง',
    riceMill: 'กรุณาเลือกโรงสีที่ต้องการ (เช่น โรงสี A, โรงสี B)',
  };
  return prompts[field] || 'กรุณาระบุข้อมูลเพิ่มเติม';
}

function promptForOrderField(field) {
  const prompts = {
    productName: 'กรุณาระบุชื่อสินค้า',
    quantity: 'กรุณาระบุจำนวนสินค้า',
    customerName: 'กรุณาระบุชื่อผู้สั่ง',
    phone: 'กรุณาระบุเบอร์โทรศัพท์',
    address: 'กรุณาระบุที่อยู่จัดส่ง',
  };
  return prompts[field] || 'กรุณาระบุข้อมูลเพิ่มเติม';
}

// Thai month name → month number mapping
const THAI_MONTHS = {
  'มกราคม': 1, 'กุมภาพันธ์': 2, 'มีนาคม': 3, 'เมษายน': 4,
  'พฤษภาคม': 5, 'มิถุนายน': 6, 'กรกฎาคม': 7, 'สิงหาคม': 8,
  'กันยายน': 9, 'ตุลาคม': 10, 'พฤศจิกายน': 11, 'ธันวาคม': 12,
  'ม.ค.': 1, 'ก.พ.': 2, 'มี.ค.': 3, 'เม.ย.': 4,
  'พ.ค.': 5, 'มิ.ย.': 6, 'ก.ค.': 7, 'ส.ค.': 8,
  'ก.ย.': 9, 'ต.ค.': 10, 'พ.ย.': 11, 'ธ.ค.': 12,
};

function extractPhone(text) {
  const match = String(text || '').match(/(?:\+?66|0)\d[\d\s-]{7,12}/);
  return match ? match[0].replace(/\D/g, '') : '';
}

function extractQuantity(text) {
  const t = String(text || '');
  // Remove phone numbers first so we don't accidentally match them
  const noPhone = t.replace(/(?:\+?66|0)\d[\d\s-]{7,12}/g, '');
  // Look for number followed by kg/กก/กิโล unit words
  const withUnit = noPhone.match(/(\d+(?:\.\d+)?)\s*(?:กก\.?|กิโลกรัม|กิโล|kg)/i);
  if (withUnit) return Number(withUnit[1]);
  // Fallback: smallest standalone number (avoid accidentally grabbing big phone-like numbers)
  const nums = [...noPhone.matchAll(/(\d+(?:\.\d+)?)/g)].map((m) => Number(m[1]));
  if (!nums.length) return 0;
  // Pick the number most likely to be a quantity (≤ 9999)
  const plausible = nums.filter((n) => n > 0 && n <= 9999);
  return plausible.length ? plausible[0] : 0;
}

function extractDate(text) {
  const value = normalizeText(text);

  if (value.includes('วันนี้')) return new Date().toISOString().slice(0, 10);
  if (value.includes('พรุ่งนี้')) {
    const date = new Date();
    date.setDate(date.getDate() + 1);
    return date.toISOString().slice(0, 10);
  }
  if (value.includes('มะรืน') || value.includes('มะรืนนี้')) {
    const date = new Date();
    date.setDate(date.getDate() + 2);
    return date.toISOString().slice(0, 10);
  }

  // ISO format: 2026-06-15
  const iso = value.match(/(\d{4}-\d{2}-\d{2})/);
  if (iso) return iso[1];

  // Thai month name: "11 เมษายน 2569" or "11 เมษายน"
  const thaiMonthEntry = Object.entries(THAI_MONTHS).find(([name]) => value.includes(name));
  if (thaiMonthEntry) {
    const [monthName, monthNum] = thaiMonthEntry;
    // Try to find day before the month name
    const beforeMonth = value.slice(0, value.indexOf(monthName));
    const dayM = beforeMonth.match(/(\d{1,2})\s*$/);
    if (dayM) {
      const day = Number(dayM[1]);
      const yearMatch = value.slice(value.indexOf(monthName)).match(/(\d{4})/);
      let year = yearMatch ? Number(yearMatch[1]) : new Date().getFullYear() + 543;
      if (year > 2400) year -= 543; // Convert Buddhist Era to CE
      else if (year < 100) year += new Date().getFullYear();
      return `${year}-${String(monthNum).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  // Numeric: DD/MM/YY or DD/MM/YYYY or DD-MM-YY
  const dmy = value.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (dmy) {
    let year = Number(dmy[3]);
    if (year < 100) year += 2500; // two-digit Buddhist Era short form e.g. 69 → 2569
    if (year > 2400) year -= 543;  // Convert Buddhist Era to CE
    const month = Number(dmy[2]);
    const day = Number(dmy[1]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  return '';
}

function extractTime(text) {
  const value = normalizeText(text);
  // HH:MM or HH.MM format
  const time = value.match(/(\d{1,2})[:.](\d{2})/);
  if (time) return `${String(time[1]).padStart(2, '0')}:${time[2]}`;
  // "10 โมง", "10 นาฬิกา", "บ่าย 2"
  const hourOnly = value.match(/(\d{1,2})\s*(?:โมง|นาฬิกา)/);
  if (hourOnly) {
    let h = Number(hourOnly[1]);
    if (value.includes('บ่าย') && h < 7) h += 12;
    if (value.includes('ค่ำ') && h < 7) h += 12;
    return `${String(h).padStart(2, '0')}:00`;
  }
  // "บ่ายสอง", "บ่ายสาม" etc. (Thai word hours)
  const thaiHours = { 'หนึ่ง': 1, 'สอง': 2, 'สาม': 3, 'สี่': 4, 'ห้า': 5, 'หก': 6 };
  for (const [word, num] of Object.entries(thaiHours)) {
    if (value.includes('บ่าย' + word) || value.includes('เย็น' + word)) {
      return `${String(num + 12).padStart(2, '0')}:00`;
    }
    if (value.includes('เช้า' + word) || value.includes('ตี' + word)) {
      return `${String(num).padStart(2, '0')}:00`;
    }
  }
  return '';
}

function extractNameFromText(text) {
  const match = String(text || '').match(/(?:ชื่อ(?:ผู้จอง|ผู้นำส่ง|ลูกค้า)?|ชื่อ)[:\s]+([^\n,0-9]{2,})/i);
  if (match) return match[1].trim();
  const cleaned = text.trim();
  if (cleaned && cleaned.length <= 40 && !/\d{4,}/.test(cleaned)) {
    return cleaned;
  }
  return '';
}

function extractRiceType(text) {
  const value = normalizeText(text).toLowerCase();
  if (value.includes('หอมมะลิ')) return 'ข้าวหอมมะลิ';
  if (value.includes('กล้อง')) return 'ข้าวกล้อง';
  if (value.includes('ข้าวสาร')) return 'ข้าวสาร';
  if (value.includes('ข้าวเปลือก')) return 'ข้าวเปลือก';
  if (value.includes('ข้าวขาว')) return 'ข้าวขาว';
  if (value.includes('รำ')) return 'รำข้าว';
  if (value.includes('ปลาย')) return 'ปลายข้าว';
  if (value.includes('แกลบ')) return 'แกลบ';
  if (value.includes('ข้าว')) return 'ข้าว';
  return '';
}

// Extract rice mill selection from text
function extractRiceMill(text) {
  const value = normalizeText(text).toLowerCase();
  const candidates = ['โรงสี a', 'โรงสี b', 'โรงสี c', 'โรงสี a', 'โรงสี b', 'โรงสี c'];
  // Simple heuristic: look for "โรงสี" followed by a letter or name
  const match = value.match(/โรงสี\s*([a-z0-9ก-ฮ]+)/i);
  if (match) return `โรงสี ${match[1].trim()}`;
  // fallback: any known name in text
  for (const name of candidates) {
    if (value.includes(name)) return name;
  }
  return '';
}

function extractBookingFields(text, seed = {}) {
  const data = { ...seed };
  if (!data.name) data.name = extractNameFromText(text);
  if (!data.phone) data.phone = extractPhone(text);
  if (!data.riceType) data.riceType = extractRiceType(text);
  if (!data.riceMill) data.riceMill = extractRiceMill(text);
  if (!data.quantityKg) data.quantityKg = extractQuantity(text);
  if (!data.desiredDate) data.desiredDate = extractDate(text);
  if (!data.dropoffTime) data.dropoffTime = extractTime(text);
  return data;
}

function extractOrderFields(text, seed = {}, products = []) {
  const data = { ...seed };
  if (!data.productName) {
    const names = products.map((product) => String(product.product_name_th || product.product_name || '').trim()).filter(Boolean);
    const lower = normalizeText(text).toLowerCase();
    data.productName = names.find((name) => lower.includes(name.toLowerCase())) || '';
  }
  if (!data.quantity) data.quantity = extractQuantity(text);
  if (!data.customerName) {
    const match = String(text || '').match(/(?:ชื่อ(?:ผู้สั่ง)?|ชื่อ)[:\s]*([^\n,]+)/i);
    data.customerName = match ? match[1].trim() : '';
  }
  if (!data.phone) data.phone = extractPhone(text);
  if (!data.address) {
    const match = String(text || '').match(/(?:ที่อยู่|address)[:\s]*([\s\S]+)/i);
    data.address = match ? match[1].trim() : '';
  }
  return data;
}

async function reply(replyToken, messages) {
  return replyToLine(replyToken, Array.isArray(messages) ? messages : [messages]);
}

async function handleBookingFlow(user, text) {
  const flowData = parseJson(user.flow_data);

  // ─── Handle "แก้ไขข้อมูล" button → clear flow and restart ───────────────
  if (normalizeText(text) === 'แก้ไขข้อมูล') {
    await clearFlowState(user.line_user_id);
    return [buildText('ยกเลิกข้อมูลเดิมแล้ว กรุณาเริ่มการจองใหม่ พิมพ์ "จองสีข้าว" เพื่อเริ่มต้น')];
  }

  if (isCancelText(text)) {
    await clearFlowState(user.line_user_id);
    return [buildText('ยกเลิกขั้นตอนการจองแล้ว')];
  }

  // ─── Per-field direct-answer capture ────────────────────────────────────
  // When we are waiting for a specific field, accept the raw reply directly
  // and avoid re-running extraction logic that might grab the wrong value.
  const missingBefore = firstMissing(
    ['name', 'phone', 'riceType', 'riceMill', 'quantityKg', 'desiredDate', 'dropoffTime'],
    flowData
  );

  if (missingBefore && !isConfirmText(text)) {
    switch (missingBefore) {
      case 'name': {
        const match = String(text || '').match(/(?:ชื่อ(?:ผู้จอง|ผู้นำส่ง)?|ชื่อ)[:\s]+([^\n,0-9]{2,})/i);
        flowData.name = match ? match[1].trim() : text.trim();
        break;
      }
      case 'phone': {
        const ph = extractPhone(text);
        if (ph) flowData.phone = ph;
        else if (/^[\d\s\-+]{8,}$/.test(text.trim())) flowData.phone = text.trim().replace(/\D/g, '');
        break;
      }
      case 'riceMill': {
        const rm = extractRiceMill(text);
        flowData.riceMill = rm || text.trim();
        break;
      }
      case 'riceType': {
        const rt = extractRiceType(text);
        flowData.riceType = rt || text.trim();
        break;
      }
      case 'quantityKg': {
        const qty = extractQuantity(text);
        if (qty > 0) flowData.quantityKg = qty;
        break;
      }
      case 'desiredDate': {
        const dt = extractDate(text);
        if (dt) flowData.desiredDate = dt;
        break;
      }
      case 'dropoffTime': {
        const tm = extractTime(text);
        if (tm) flowData.dropoffTime = tm;
        break;
      }
    }
  }

  // Run full extraction on any remaining unfilled fields
  const merged = extractBookingFields(text, flowData);
  const missing = firstMissing(
    ['name', 'phone', 'riceType', 'riceMill', 'quantityKg', 'desiredDate', 'dropoffTime'],
    merged
  );

  // ─── ยืนยันการจอง: ส่ง success flex + ข้อความยืนยัน ───────────────────
  if (isConfirmText(text) && !missing) {
    const booking = await createBooking({
      lineUserId: user.line_user_id,
      name: merged.name,
      phone: merged.phone,
      riceType: merged.riceType,
      riceMill: merged.riceMill,
      quantityKg: merged.quantityKg,
      desiredDate: merged.desiredDate,
      dropoffTime: merged.dropoffTime,
    });
    await clearFlowState(user.line_user_id);
    return [
      buildBookingSuccessFlex(booking),
      buildText(`✅ จองคิวเรียบร้อยแล้ว!\nเลขที่จอง: ${booking.booking_number}\nขอบคุณที่ใช้บริการโรงสีข้าวของเรา 🌾`),
    ];
  }

  // ─── ยืนยันแต่ข้อมูลยังไม่ครบ ─────────────────────────────────────────
  if (isConfirmText(text) && missing) {
    await updateFlowState(user.line_user_id, 'booking', merged);
    return [buildText(`ข้อมูลยังไม่ครบ\n${promptForBookingField(missing)}`)];
  }

  if (missing) {
    await updateFlowState(user.line_user_id, 'booking', merged);
    return [buildText(promptForBookingField(missing))];
  }

  await updateFlowState(user.line_user_id, 'booking', { ...merged, awaitingConfirmation: true });
  return [buildBookingConfirmationFlex(merged), buildText('พิมพ์ "ยืนยัน" เพื่อบันทึกการจอง')];
}

async function handleOrderFlow(user, text) {
  const products = await getProducts({ limit: 20 });
  const flowData = parseJson(user.flow_data);

  // Fallback: If we were waiting for name or address, and the user replied, accept their input directly
  const missingBefore = firstMissing(['productName', 'quantity', 'customerName', 'phone', 'address'], flowData);
  if (missingBefore === 'customerName' && !isCancelText(text)) {
    const match = String(text || '').match(/(?:ชื่อ(?:ผู้สั่ง)?|ชื่อ)[:\s]*([^\n,]+)/i);
    flowData.customerName = match ? match[1].trim() : text.trim();
  } else if (missingBefore === 'address' && !isCancelText(text)) {
    const match = String(text || '').match(/(?:ที่อยู่|address)[:\s]*([\s\S]+)/i);
    flowData.address = match ? match[1].trim() : text.trim();
  }

  const merged = extractOrderFields(text, flowData, products);
  const missing = firstMissing(['productName', 'quantity', 'customerName', 'phone', 'address'], merged);

  if (isCancelText(text)) {
    await clearFlowState(user.line_user_id);
    return [buildText('ยกเลิกขั้นตอนการสั่งซื้อแล้ว')];
  }

  if (isConfirmText(text) && !missing) {
    const order = await createOrder({
      lineUserId: user.line_user_id,
      productName: merged.productName,
      quantity: merged.quantity,
      customerName: merged.customerName,
      phone: merged.phone,
      address: merged.address,
    });
    await clearFlowState(user.line_user_id);
    return [buildOrderSuccessFlex(order), buildText(`บันทึกเลขที่สั่งซื้อเรียบร้อย: ${order.order_number}`)];
  }

  if (missing) {
    await updateFlowState(user.line_user_id, 'order', merged);
    return [buildText(promptForOrderField(missing))];
  }

  await updateFlowState(user.line_user_id, 'order', { ...merged, awaitingConfirmation: true });
  return [buildOrderConfirmationFlex(merged), buildText('พิมพ์ "ยืนยัน" เพื่อบันทึกคำสั่งซื้อ')];
}

async function handleGeneral(user, text) {
  const intent = detectIntent(text);

  if (intent.intent === 'create_booking') {
    const merged = extractBookingFields(text, {});
    const missing = firstMissing(['name', 'phone', 'riceType', 'riceMill', 'quantityKg', 'desiredDate', 'dropoffTime'], merged);
    await updateFlowState(user.line_user_id, 'booking', merged);
    if (missing) return [buildText(promptForBookingField(missing))];
    return [buildBookingConfirmationFlex(merged), buildText('พิมพ์ "ยืนยัน" เพื่อบันทึกการจอง')];
  }

  if (intent.intent === 'create_order') {
    const products = await getProducts({ limit: 20 });
    const merged = extractOrderFields(text, {}, products);
    const missing = firstMissing(['productName', 'quantity', 'customerName', 'phone', 'address'], merged);
    await updateFlowState(user.line_user_id, 'order', merged);
    if (missing) return [buildText(promptForOrderField(missing))];
    return [buildOrderConfirmationFlex(merged), buildText('พิมพ์ "ยืนยัน" เพื่อบันทึกคำสั่งซื้อ')];
  }

  if (intent.intent === 'check_booking') {
    const bookingNumber = text.match(/RM\d{12}/i)?.[0] || '';
    const bookings = await getBooking({ bookingNumber, lineUserId: user.line_user_id });
    const booking = Array.isArray(bookings) ? bookings[0] : bookings;
    if (!booking) return [buildText('ไม่พบข้อมูลคิว กรุณาส่งเลขที่จอง RM202606040001')];
    return [buildText(buildBookingSummaryText(booking))];
  }

  if (intent.intent === 'cancel_booking') {
    const bookingNumber = text.match(/RM\d{12}/i)?.[0] || '';
    const bookings = await getBooking({ bookingNumber, lineUserId: user.line_user_id });
    const booking = Array.isArray(bookings) ? bookings[0] : bookings;
    if (!booking) return [buildText('ไม่พบคิวที่ต้องการยกเลิก กรุณาส่งเลขที่จอง RM202606040001')];
    await cancelBooking({ bookingNumber: booking.booking_number, lineUserId: user.line_user_id, reason: 'ยกเลิกผ่าน LINE' });
    await clearFlowState(user.line_user_id);
    return [buildText(`ยกเลิกคิวเรียบร้อยแล้ว: ${booking.booking_number}`)];
  }

  if (intent.intent === 'get_products') {
    const products = await getProducts({ limit: 10 });
    return [buildProductCarouselFlex(products)];
  }

  if (intent.intent === 'contact') {
    return [buildContactFlex()];
  }

  const llmAnswer = await generateGeneralAnswer(text);
  if (llmAnswer) {
    return [buildText(llmAnswer)];
  }

  return [buildText('ผมช่วยได้เรื่องจองสีข้าว สั่งซื้อสินค้า ดูรายการสินค้า ตรวจสอบคิว และยกเลิกคิว')];
}

router.get('/', (req, res) => {
  res.json({ success: true, message: 'LINE webhook ready' });
});

router.post('/', async (req, res) => {
  const signature = req.get('x-line-signature');
  const rawBody = req.rawBody || Buffer.from(JSON.stringify(req.body || {}));

  if (!verifySignature(rawBody, signature)) {
    return res.status(401).json({ success: false, message: 'Invalid LINE signature' });
  }

  const events = Array.isArray(req.body?.events) ? req.body.events : [];

  try {
    for (const event of events) {
      const userId = event?.source?.userId;
      if (!userId) continue;

      await upsertLineUser({ lineUserId: userId });
      const user = await getLineUser(userId);
      if (!user) continue;

      if (event.type === 'follow') {
        await reply(event.replyToken, [{ type: 'text', text: 'ยินดีต้อนรับสู่ LINE Chatbot โรงสีข้าว พิมพ์ "จองสีข้าว" หรือ "สั่งซื้อสินค้า" เพื่อเริ่มต้นได้เลย' }]);
        continue;
      }

      if (event.type === 'message' && event.message?.type === 'text') {
        const messages = String(user.current_flow || '').trim() === 'booking'
          ? await handleBookingFlow(user, event.message.text)
          : String(user.current_flow || '').trim() === 'order'
            ? await handleOrderFlow(user, event.message.text)
            : await handleGeneral(user, event.message.text);
        await reply(event.replyToken, messages);
        continue;
      }

      if (event.type === 'postback') {
        await reply(event.replyToken, [{ type: 'text', text: 'ได้รับข้อมูลจากปุ่มเรียบร้อยแล้ว' }]);
      }
    }

    return res.json({ success: true });
  } catch (error) {
    console.error('LINE webhook error:', error);
    return res.status(500).json({ success: false, message: 'Webhook processing failed' });
  }
});

module.exports = router;