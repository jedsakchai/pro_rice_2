function buildOrderConfirmationFlex(data = {}) {
  return {
    type: 'flex',
    altText: 'ยืนยันคำสั่งซื้อสินค้า',
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
        ],
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        paddingAll: '18px',
        contents: [
          { type: 'text', text: `สินค้า : ${data.productName || data.product_name || '-'}`, wrap: true, size: 'sm' },
          { type: 'text', text: `จำนวน : ${data.quantity || '-'}`, wrap: true, size: 'sm' },
          { type: 'text', text: `ชื่อผู้สั่ง : ${data.customerName || data.customer_name || '-'}`, wrap: true, size: 'sm' },
          { type: 'text', text: `เบอร์โทร : ${data.phone || '-'}`, wrap: true, size: 'sm' },
          { type: 'text', text: `ที่อยู่จัดส่ง : ${data.address || data.shipping_address || '-'}`, wrap: true, size: 'sm' },
        ],
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        paddingAll: '16px',
        contents: [
          { type: 'button', style: 'primary', color: '#A16207', action: { type: 'message', label: 'ยืนยัน', text: 'ยืนยัน' } },
          { type: 'button', style: 'secondary', action: { type: 'message', label: 'แก้ไขข้อมูล', text: 'แก้ไขข้อมูล' } },
        ],
      },
    },
  };
}

function buildOrderSuccessFlex(order = {}) {
  return {
    type: 'flex',
    altText: 'ยืนยันคำสั่งซื้อสำเร็จ',
    contents: {
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#285943',
        paddingAll: '18px',
        contents: [
          { type: 'text', text: 'สั่งซื้อสำเร็จ', weight: 'bold', color: '#FFFFFF', size: 'xl' },
          { type: 'text', text: order.order_number || order.orderNumber || '-', color: '#D9F7E8', size: 'sm', margin: 'sm' },
        ],
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        paddingAll: '18px',
        contents: [
          { type: 'text', text: `สินค้า : ${order.product_name || order.productName || '-'}`, wrap: true, size: 'sm' },
          { type: 'text', text: `จำนวน : ${order.quantity || '-'}`, wrap: true, size: 'sm' },
          { type: 'text', text: `ยอดรวม : ${order.total_price || order.totalPrice || 0} บาท`, wrap: true, size: 'sm' },
          { type: 'text', text: `ชื่อผู้สั่ง : ${order.customer_name || order.customerName || '-'}`, wrap: true, size: 'sm' },
        ],
      },
    },
  };
}

module.exports = {
  buildOrderConfirmationFlex,
  buildOrderSuccessFlex,
};