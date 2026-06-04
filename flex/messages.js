const { buildBookingConfirmationFlex, buildBookingSuccessFlex } = require('./bookingFlex');
const { buildOrderConfirmationFlex, buildOrderSuccessFlex } = require('./orderFlex');
const { buildProductCarouselFlex } = require('./productFlex');

function buildContactFlex() {
  return {
    type: 'flex',
    altText: 'ติดต่อโรงสีข้าว',
    contents: {
      type: 'bubble',
      body: {
        type: 'box',
        layout: 'vertical',
        paddingAll: '18px',
        contents: [
          { type: 'text', text: 'ติดต่อโรงสีข้าว', weight: 'bold', size: 'xl', wrap: true },
          { type: 'text', text: 'โทร: 08x-xxx-xxxx', wrap: true, margin: 'md' },
          { type: 'text', text: 'LINE: @rice-mill', wrap: true },
        ],
      },
    },
  };
}

module.exports = {
  buildBookingConfirmationFlex,
  buildBookingSuccessFlex,
  buildContactFlex,
  buildOrderConfirmationFlex,
  buildOrderSuccessFlex,
  buildProductCarouselFlex,
};function buildTextBlock(text, weight = 'regular', size = 'md', color = '#1F2937') {
  return {
    type: 'text',
    text: String(text || ''),
    wrap: true,
    size,
    weight,
    color,
  };
}

function buildBookingSummaryFlex(booking) {
  const summary = booking || {};
  return {
    type: 'flex',
    altText: `ยืนยันการจองคิวสีข้าว ${summary.booking_number || ''}`.trim(),
    contents: {
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#1F4E3D',
        paddingAll: '18px',
        contents: [
          { type: 'text', text: 'ยืนยันการจองคิวสีข้าว', color: '#FFFFFF', weight: 'bold', size: 'xl', wrap: true },
          { type: 'text', text: summary.booking_number ? `เลขที่จอง ${summary.booking_number}` : 'กรุณาตรวจสอบข้อมูล', color: '#E5F3EA', size: 'sm', wrap: true },
        ],
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        paddingAll: '18px',
        contents: [
          buildTextBlock(`ชื่อ : ${summary.customer_name || '-'}`),
          buildTextBlock(`เบอร์โทร : ${summary.phone || '-'}`),
          buildTextBlock(`ประเภทข้าว : ${summary.rice_type || '-'}`),
          buildTextBlock(`จำนวน : ${summary.quantity_kg || '-'} กก.`),
          buildTextBlock(`วันที่ : ${summary.desired_date || '-'}`),
          buildTextBlock(`เวลา : ${summary.dropoff_time || '-'}`),
        ],
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        paddingAll: '16px',
        contents: [
          {
            type: 'button',
            style: 'primary',
            color: '#1F4E3D',
            action: { type: 'message', label: 'ยืนยัน', text: 'ยืนยัน' },
          },
          {
            type: 'button',
            style: 'secondary',
            action: { type: 'message', label: 'แก้ไขข้อมูล', text: 'แก้ไขข้อมูล' },
          },
        ],
      },
    },
  };
}

function buildOrderSummaryFlex(order) {
  const summary = order || {};
  return {
    type: 'flex',
    altText: `ยืนยันคำสั่งซื้อ ${summary.order_number || ''}`.trim(),
    contents: {
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#A16207',
        paddingAll: '18px',
        contents: [
          { type: 'text', text: 'ยืนยันคำสั่งซื้อสินค้า', color: '#FFFFFF', weight: 'bold', size: 'xl', wrap: true },
          { type: 'text', text: summary.order_number ? `เลขที่คำสั่งซื้อ ${summary.order_number}` : 'ตรวจสอบข้อมูลคำสั่งซื้อ', color: '#FFF7ED', size: 'sm', wrap: true },
        ],
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        paddingAll: '18px',
        contents: [
          buildTextBlock(`สินค้า : ${summary.product_name || '-'}`),
          buildTextBlock(`จำนวน : ${summary.quantity || '-'} ${summary.unit || 'kg'}`),
          buildTextBlock(`ชื่อผู้สั่ง : ${summary.customer_name || '-'}`),
          buildTextBlock(`เบอร์โทร : ${summary.phone || '-'}`),
          buildTextBlock(`ที่อยู่จัดส่ง : ${summary.address || '-'}`),
        ],
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        paddingAll: '16px',
        contents: [
          {
            type: 'button',
            style: 'primary',
            color: '#A16207',
            action: { type: 'message', label: 'ยืนยัน', text: 'ยืนยัน' },
          },
          {
            type: 'button',
            style: 'secondary',
            action: { type: 'message', label: 'แก้ไขข้อมูล', text: 'แก้ไขข้อมูล' },
          },
        ],
      },
    },
  };
}

function buildProductsFlex(products) {
  const list = Array.isArray(products) ? products.slice(0, 10) : [];
  return {
    type: 'flex',
    altText: 'รายการสินค้าโรงสีข้าว',
    contents: {
      type: 'carousel',
      contents: list.length > 0
        ? list.map((product) => ({
            type: 'bubble',
            size: 'mega',
            header: {
              type: 'box',
              layout: 'vertical',
              backgroundColor: '#1F4E3D',
              paddingAll: '16px',
              contents: [
                { type: 'text', text: product.product_name || product.product_name_th || '-', color: '#FFFFFF', weight: 'bold', size: 'lg', wrap: true },
                { type: 'text', text: product.category_th || product.category || 'สินค้า', color: '#D1FAE5', size: 'sm', wrap: true },
              ],
            },
            body: {
              type: 'box',
              layout: 'vertical',
              spacing: 'sm',
              paddingAll: '16px',
              contents: [
                buildTextBlock(product.description_th || product.description || '', 'regular', 'sm'),
                buildTextBlock(`ราคา : ${Number(product.price || 0).toLocaleString('th-TH')} บาท`, 'bold'),
                buildTextBlock(`หน่วย : ${product.unit_th || product.unit || 'kg'}`),
                buildTextBlock(`คงเหลือ : ${product.stock ?? '-'}`),
              ],
            },
          }))
        : [
            {
              type: 'bubble',
              body: {
                type: 'box',
                layout: 'vertical',
                paddingAll: '18px',
                contents: [buildTextBlock('ไม่พบรายการสินค้า', 'bold')],
              },
            },
          ],
    },
  };
}

function buildContactFlex() {
  return {
    type: 'flex',
    altText: 'ติดต่อโรงสีข้าว',
    contents: {
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#0F172A',
        paddingAll: '18px',
        contents: [
          { type: 'text', text: 'ติดต่อโรงสีข้าว', color: '#FFFFFF', weight: 'bold', size: 'xl', wrap: true },
          { type: 'text', text: 'สอบถามรายละเอียดหรือแจ้งงานได้ทันที', color: '#CBD5E1', size: 'sm', wrap: true },
        ],
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        paddingAll: '18px',
        contents: [
          buildTextBlock('โทร: 08x-xxx-xxxx', 'bold'),
          buildTextBlock('LINE: @rice-mill', 'bold'),
          buildTextBlock('ที่อยู่: โรงสีข้าวของเรา', 'regular', 'sm'),
        ],
      },
    },
  };
}

module.exports = {
  buildBookingSummaryFlex,
  buildContactFlex,
  buildOrderSummaryFlex,
  buildProductsFlex,
};