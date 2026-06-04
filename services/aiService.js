const https = require('https');
const pool = require('../database/mysql');
const bookingController = require('../controllers/bookingController');
const orderController = require('../controllers/orderController');
const { buildBookingSummaryFlex, buildContactFlex, buildOrderSummaryFlex, buildProductsFlex } = require('../flex/messages');
const { buildTextMessage, isCancelText, isConfirmText } = require('../utils/line');

const BOOKING_FIELDS = ['customer_name', 'phone', 'rice_type', 'quantity_kg', 'desired_date', 'dropoff_time'];
const ORDER_FIELDS = ['product_name', 'quantity', 'customer_name', 'phone', 'address'];

function normalizeText(value) {
  return String(value || '').trim();
}

function normalizePhone(text) {
  const raw = normalizeText(text).replace(/[\s-]/g, '');
  const thaiPhone = raw.match(/^(?:\+66|66|0)(\d{8,9})$/);
  if (thaiPhone) {
    return `0${thaiPhone[1].slice(-9)}`;
  }
  const digits = raw.replace(/\D/g, '');
  if (/^0\d{8,9}$/.test(digits)) return digits;
  if (/^66\d{8,9}$/.test(digits)) return `0${digits.slice(2)}`;
  return raw;
}

function normalizeQuantity(text) {
  const match = normalizeText(text).match(/(\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) : null;
}

function parseDateInput(text) {
  const input = normalizeText(text);
  if (!input) return null;

  const iso = input.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const dmY = input.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (dmY) {
    let year = Number(dmY[3]);
    if (year > 2400) year -= 543;
    if (year < 100) year += 2000;
    return `${String(year).padStart(4, '0')}-${String(dmY[2]).padStart(2, '0')}-${String(dmY[1]).padStart(2, '0')}`;
  }

  return null;
}

function parseTimeInput(text) {
  const input = normalizeText(text);
  const time = input.match(/^(\d{1,2})[:.](\d{2})$/);
  if (time) return `${String(Number(time[1])).padStart(2, '0')}:${time[2]}`;
  return input || null;
}

function extractRiceType(text) {
  const input = normalizeText(text).toLowerCase();
  const options = [
    'ข้าวหอมมะลิ',
    'หอมมะลิ',
    'ข้าวกล้อง',
    'กล้อง',
    'ข้าวเหนียว',
    'ข้าวเปลือก',
    'ปลายข้าว',
    'แกลบ',
  ];
  const found = options.find((item) => input.includes(item));
  return found ? found.replace(/^ข้าว/, '') : null;
}

function extractOrderProduct(text) {
  const input = normalizeText(text).toLowerCase();
  const options = ['ข้าวหอมมะลิ', 'ข้าวกล้อง', 'รำข้าว', 'ปลายข้าว', 'แกลบ'];
  return options.find((item) => input.includes(item)) || null;
}

function extractBookingFields(text, existing = {}) {
  const fields = { ...existing };
  const input = normalizeText(text);

  const nameMatch = input.match(/(?:ชื่อ(?:ผู้จอง)?|ชื่อ)\s*[:=]\s*([^\n,]+)|^([^\n,]{2,40})$/i);
  if (!fields.customer_name && nameMatch) {
    fields.customer_name = normalizeText(nameMatch[1] || nameMatch[2]);
  }

  if (!fields.phone) {
    const phoneMatch = input.match(/(?:โทร|เบอร์|phone)\s*[:=]?\s*((?:\+?66|0)\d[\d\s-]{7,12})/i) || input.match(/(?:\+?66|0)\d{8,9}/);
    if (phoneMatch) fields.phone = normalizePhone(phoneMatch[1] || phoneMatch[0]);
  }

  if (!fields.rice_type) {
    const riceType = extractRiceType(input);
    if (riceType) fields.rice_type = riceType;
  }

  if (!fields.quantity_kg) {
    const qtyMatch = input.match(/(\d+(?:\.\d+)?)\s*(?:กก\.?|กิโล(?:กรัม)?|kg|kilogram)/i);
    if (qtyMatch) fields.quantity_kg = Number(qtyMatch[1]);
  }

  if (!fields.desired_date) {
    const date = parseDateInput(input);
    if (date) fields.desired_date = date;
  }

  if (!fields.dropoff_time) {
    const timeMatch = input.match(/(\d{1,2}[:.\-]\d{2})/);
    if (timeMatch) fields.dropoff_time = parseTimeInput(timeMatch[1]);
  }

  return fields;
}

function extractOrderFields(text, existing = {}) {
  const fields = { ...existing };
  const input = normalizeText(text);

  if (!fields.product_name) {
    const product = extractOrderProduct(input);
    if (product) fields.product_name = product;
  }

  if (!fields.quantity) {
    const qtyMatch = input.match(/(\d+(?:\.\d+)?)\s*(?:กก\.?|กิโล(?:กรัม)?|kg|ถุง|กระสอบ)/i);
    if (qtyMatch) fields.quantity = Number(qtyMatch[1]);
  }

  if (!fields.customer_name) {
    const nameMatch = input.match(/(?:ชื่อ(?:ผู้สั่ง)?|ชื่อ)\s*[:=]\s*([^\n,]+)|^([^\n,]{2,40})$/i);
    if (nameMatch) fields.customer_name = normalizeText(nameMatch[1] || nameMatch[2]);
  }

  if (!fields.phone) {
    const phoneMatch = input.match(/(?:โทร|เบอร์|phone)\s*[:=]?\s*((?:\+?66|0)\d[\d\s-]{7,12})/i) || input.match(/(?:\+?66|0)\d{8,9}/);
    if (phoneMatch) fields.phone = normalizePhone(phoneMatch[1] || phoneMatch[0]);
  }

  if (!fields.address) {
    const addressMatch = input.match(/(?:ที่อยู่|address)\s*[:=]\s*([\s\S]+)/i);
    if (addressMatch) fields.address = normalizeText(addressMatch[1]);
  }

  return fields;
}

function detectIntent(text) {
  const input = normalizeText(text).toLowerCase();

  if (!input) return { intent: 'general', confidence: 0 };
  if (['ยืนยัน', 'confirm', 'ตกลง', 'ใช่'].some((word) => input.includes(word))) {
    return { intent: 'confirm', confidence: 0.95 };
  }
  if (['ยกเลิก', 'cancel', 'ไม่เอา', 'แก้ไข'].some((word) => input.includes(word))) {
    return { intent: 'cancel', confidence: 0.95 };
  }
  if (input.includes('ยกเลิกคิว') || input.includes('ยกเลิกการจอง')) {
    return { intent: 'cancel_booking', confidence: 0.95 };
  }
  if (input.includes('ตรวจสอบคิว') || input.includes('เช็คคิว') || input.includes('ดูคิว') || input.includes('สถานะคิว')) {
    return { intent: 'check_booking', confidence: 0.95 };
  }
  if (input.includes('ดูรายการสินค้า') || input.includes('รายการสินค้า') || input.includes('สินค้าอะไร')) {
    return { intent: 'get_products', confidence: 0.95 };
  }
  if (input.includes('ติดต่อ') || input.includes('สอบถามทั่วไป') || input.includes('เบอร์โรงสี') || input.includes('line')) {
    return { intent: 'contact', confidence: 0.8 };
  }
  if (input.includes('สั่งซื้อ') || input.includes('สั่งสินค้า') || input.includes('order') || input.includes('ซื้อสินค้า')) {
    return { intent: 'create_order', confidence: 0.9 };
  }
  if (input.includes('จอง') || input.includes('จองคิว') || input.includes('สีข้าว') || input.includes('คิวสี')) {
    return { intent: 'create_booking', confidence: 0.9 };
  }

  return { intent: 'general', confidence: 0.2 };
}

async function callOpenAI({ text, userState }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const payload = JSON.stringify({
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    temperature: 0.2,
    messages: [
      {
        role: 'system',
        content: [
          'You are an intent router for a Thai LINE chatbot for a rice mill.',
          'Return JSON only with keys: intent, confidence, reply, fields, need_more_info.',
          'Allowed intents: create_booking, check_booking, cancel_booking, create_order, get_products, contact, general.',
          'If the message is unclear, set need_more_info true and provide a short Thai clarification in reply.',
        ].join(' '),
      },
      {
        role: 'user',
        content: JSON.stringify({ text, user_state: userState || {} }),
      },
    ],
    response_format: { type: 'json_object' },
  });

  return new Promise((resolve, reject) => {
    const req = https.request(
      'https://api.openai.com/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'Content-Length': Buffer.byteLength(payload),
        },
      },
      (res) => {
        let data = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            try {
              const parsed = JSON.parse(data);
              const content = parsed && parsed.choices && parsed.choices[0] && parsed.choices[0].message && parsed.choices[0].message.content;
              resolve(content ? JSON.parse(content) : null);
            } catch (err) {
              resolve(null);
            }
            return;
          }
          reject(new Error(`OpenAI request failed: ${res.statusCode} ${data}`));
        });
      }
    );

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function buildMissingFieldQuestion(intent, missingField) {
  const bookingQuestions = {
    customer_name: 'กรุณาส่งชื่อผู้จอง',
    phone: 'กรุณาส่งเบอร์โทรศัพท์',
    rice_type: 'กรุณาระบุประเภทข้าว',
    quantity_kg: 'กรุณาระบุจำนวนกิโลกรัม',
    desired_date: 'กรุณาระบุวันที่ต้องการสีข้าว',
    dropoff_time: 'กรุณาระบุเวลานำข้าวมาส่ง',
  };

  const orderQuestions = {
    product_name: 'กรุณาระบุชื่อสินค้า',
    quantity: 'กรุณาระบุจำนวนสินค้า',
    customer_name: 'กรุณาส่งชื่อผู้สั่ง',
    phone: 'กรุณาส่งเบอร์โทรศัพท์',
    address: 'กรุณาส่งที่อยู่จัดส่ง',
  };

  const map = intent === 'create_order' ? orderQuestions : bookingQuestions;
  return map[missingField] || 'กรุณาส่งข้อมูลเพิ่มเติม';
}

function buildContactText() {
  return [
    'ติดต่อโรงสีข้าว',
    '',
    'โทร: 08x-xxx-xxxx',
    'LINE: @rice-mill',
    'เวลาทำการ: 08:00 - 17:00',
    'ที่อยู่: กรุณาใส่ข้อมูลโรงสีจริงใน .env หรือไฟล์แสดงผล',
  ].join('\n');
}

function buildGeneralFallback() {
  return [
    'ผมช่วยได้ 7 เรื่องหลัก:',
    '1) จองสีข้าว',
    '2) ตรวจสอบคิว',
    '3) ยกเลิกคิว',
    '4) สั่งซื้อสินค้า',
    '5) ดูรายการสินค้า',
    '6) ติดต่อโรงสี',
    '7) สอบถามทั่วไป',
    '',
    'พิมพ์สิ่งที่ต้องการมาได้เลย',
  ].join('\n');
}

async function loadUserState(lineUserId) {
  const [rows] = await pool.query('SELECT * FROM users WHERE line_user_id = ? LIMIT 1', [String(lineUserId || '').trim()]);
  return rows && rows[0] ? rows[0] : null;
}

async function persistState(lineUserId, state, profile = {}) {
  const current = await loadUserState(lineUserId);
  const displayName = String(profile.display_name || (current && current.display_name) || '').trim();
  const phone = String(profile.phone || (current && current.phone) || '').trim();
  await pool.execute(
    `INSERT INTO users (line_user_id, display_name, phone, role, chat_state_json, pending_intent, pending_payload_json, last_active_at)
     VALUES (?, ?, ?, 'customer', ?, ?, ?, NOW())
     ON DUPLICATE KEY UPDATE
       display_name = COALESCE(NULLIF(VALUES(display_name), ''), display_name),
       phone = COALESCE(NULLIF(VALUES(phone), ''), phone),
       chat_state_json = VALUES(chat_state_json),
       pending_intent = VALUES(pending_intent),
       pending_payload_json = VALUES(pending_payload_json),
       last_active_at = VALUES(last_active_at)` ,
    [
      String(lineUserId || '').trim(),
      displayName,
      phone,
      JSON.stringify(state || {}),
      state && state.intent ? state.intent : null,
      state && state.data ? JSON.stringify(state.data) : null,
    ]
  );
}

function buildNextBookingState(existingState, text) {
  const current = existingState && existingState.data ? { ...existingState.data } : {};
  const merged = extractBookingFields(text, current);
  const missingField = BOOKING_FIELDS.find((field) => !merged[field]);
  if (!missingField) {
    return {
      intent: 'create_booking',
      stage: 'confirming',
      data: merged,
    };
  }

  return {
    intent: 'create_booking',
    stage: 'collecting',
    nextField: missingField,
    data: merged,
  };
}

function buildNextOrderState(existingState, text) {
  const current = existingState && existingState.data ? { ...existingState.data } : {};
  const merged = extractOrderFields(text, current);
  const missingField = ORDER_FIELDS.find((field) => !merged[field]);
  if (!missingField) {
    return {
      intent: 'create_order',
      stage: 'confirming',
      data: merged,
    };
  }

  return {
    intent: 'create_order',
    stage: 'collecting',
    nextField: missingField,
    data: merged,
  };
}

function buildBookingResponse(state, userState) {
  const data = state.data || {};
  const missingField = state.nextField || BOOKING_FIELDS.find((field) => !data[field]);
  if (missingField) {
    return {
      messages: [buildTextMessage(buildMissingFieldQuestion('create_booking', missingField))],
      state,
    };
  }

  const summaryText = bookingController.buildBookingSummaryText(data);
  return {
    messages: [buildTextMessage(summaryText), buildBookingSummaryFlex({ ...data, booking_number: userState && userState.booking_number ? userState.booking_number : '' })],
    state: {
      ...state,
      stage: 'confirming',
    },
  };
}

function buildOrderResponse(state) {
  const data = state.data || {};
  const missingField = state.nextField || ORDER_FIELDS.find((field) => !data[field]);
  if (missingField) {
    return {
      messages: [buildTextMessage(buildMissingFieldQuestion('create_order', missingField))],
      state,
    };
  }

  const summaryText = orderController.buildOrderSummaryText(data);
  return {
    messages: [buildTextMessage(summaryText), buildOrderSummaryFlex({ ...data, order_number: '' })],
    state: {
      ...state,
      stage: 'confirming',
    },
  };
}

async function handleIncomingMessage({ lineUserId, text, profile = {} }) {
  const messageText = normalizeText(text);
  if (!messageText) {
    return { messages: [buildTextMessage(buildGeneralFallback())] };
  }

  const currentUser = await loadUserState(lineUserId);
  const existingState = currentUser && currentUser.chat_state_json
    ? (typeof currentUser.chat_state_json === 'string' ? JSON.parse(currentUser.chat_state_json) : currentUser.chat_state_json)
    : null;

  if (existingState && existingState.intent === 'create_booking' && existingState.stage === 'confirming') {
    if (isConfirmText(messageText)) {
      const booking = await bookingController.createBooking({
        ...existingState.data,
        line_user_id: lineUserId,
        display_name: profile.display_name || currentUser.display_name || existingState.data.customer_name,
      });
      const confirmedState = { intent: 'create_booking', stage: 'completed', data: booking };
      await persistState(lineUserId, confirmedState, profile);
      return {
        messages: [
          buildTextMessage(`บันทึกการจองเรียบร้อยแล้ว\nเลขที่จอง: ${booking.booking_number}`),
          buildBookingSummaryFlex(booking),
        ],
        state: confirmedState,
      };
    }

    if (isCancelText(messageText)) {
      const clearedState = { intent: null, stage: 'idle', data: {} };
      await persistState(lineUserId, clearedState, profile);
      return { messages: [buildTextMessage('ยกเลิกการจองชั่วคราวแล้ว หากต้องการเริ่มใหม่ พิมพ์