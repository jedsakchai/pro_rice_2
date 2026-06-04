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

function extractPhone(text) {
  const match = String(text || '').match(/(?:\+?66|0)\d[\d\s-]{7,12}/);
  return match ? match[0].replace(/\D/g, '') : '';
}

function extractQuantity(text) {
  const match = String(text || '').match(/(\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) : 0;
}

function extractDate(text) {
  const value = normalizeText(text);
  if (value.includes('วันนี้')) return new Date().toISOString().slice(0, 10);
  if (value.includes('พรุ่งนี้')) {
    const date = new Date();
    date.setDate(date.getDate() + 1);
    return date.toISOString().slice(0, 10);
  }
  const iso = value.match(/(\d{4}-\d{2}-\d{2})/);
  if (iso) return iso[1];
  const dmy = value.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (dmy) {
    let year = Number(dmy[3]);
    if (year < 100) year += 2000;
    if (year > 2400) year -= 543;
    return `${year}-${String(dmy[2]).padStart(2, '0')}-${String(dmy[1]).padStart(2, '0')}`;
  }
  return '';
}

function extractTime(text) {
  const value = normalizeText(text);
  const time = value.match(/(\d{1,2})[:.](\d{2})/);
  if (time) return `${String(time[1]).padStart(2, '0')}:${time[2]}`;
  const hourOnly = value.match(/(\d{1,2})\s*(?:โมง|นาฬิกา)/);
  if (hourOnly) return `${String(hourOnly[1]).padStart(2, '0')}:00`;
  return '';
}

function extractRiceType(text) {
  const value = normalizeText(text).toLowerCase();
  const items = ['ข้าวหอมมะลิ', 'ข้าวกล้อง', 'รำข้าว', 'ปลายข้าว', 'แกลบ'];
  return items.find((item) => value.includes(item)) || '';
}

function extractBookingFields(text, seed = {}) {
  const data = { ...seed };
  if (!data.name) {
    const match = String(text || '').match(/(?:ชื่อ(?:ผู้จอง)?|ชื่อ)[:\s]*([^\n,]+)/i);
    data.name = match ? match[1].trim() : '';
  }
  if (!data.phone) data.phone = extractPhone(text);
  if (!data.riceType) data.riceType = extractRiceType(text);
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
  const merged = extractBookingFields(text, flowData);
  const missing = firstMissing(['name', 'phone', 'riceType', 'quantityKg', 'desiredDate', 'dropoffTime'], merged);

  if (isCancelText(text)) {
    await clearFlowState(user.line_user_id);
    return [buildText('ยกเลิกขั้นตอนการจองแล้ว')];
  }

  if (isConfirmText(text) && !missing) {
    const booking = await createBooking({
      lineUserId: user.line_user_id,
      name: merged.name,
      phone: merged.phone,
      riceType: merged.riceType,
      quantityKg: merged.quantityKg,
      desiredDate: merged.desiredDate,
      dropoffTime: merged.dropoffTime,
    });
    await clearFlowState(user.line_user_id);
    return [buildBookingSuccessFlex(booking), buildText(`บันทึกเลขที่จองเรียบร้อย: ${booking.booking_number}`)];
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
    const missing = firstMissing(['name', 'phone', 'riceType', 'quantityKg', 'desiredDate', 'dropoffTime'], merged);
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