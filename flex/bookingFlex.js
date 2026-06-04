function buildBookingConfirmationFlex(data = {}) {
  return {
    type: 'flex',
    altText: 'ยืนยันการจองคิวสีข้าว',
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
        ],
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        paddingAll: '18px',
        contents: [
          { type: 'text', text: `ชื่อ : ${data.name || data.customer_name || '-'}`, wrap: true, size: 'sm' },
          { type: 'text', text: `เบอร์โทร : ${data.phone || '-'}`, wrap: true, size: 'sm' },
          { type: 'text', text: `ประเภทข้าว : ${data.riceType || data.rice_type || '-'}`, wrap: true, size: 'sm' },
          { type: 'text', text: `จำนวน : ${data.quantityKg || data.quantity_kg || '-'}`, wrap: true, size: 'sm' },
          { type: 'text', text: `วันที่ : ${data.desiredDate || data.desired_date || '-'}`, wrap: true, size: 'sm' },
          { type: 'text', text: `เวลา : ${data.dropoffTime || data.dropoff_time || '-'}`, wrap: true, size: 'sm' },
        ],
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        paddingAll: '16px',
        contents: [
          { type: 'button', style: 'primary', color: '#1F4E3D', action: { type: 'message', label: 'ยืนยัน', text: 'ยืนยัน' } },
          { type: 'button', style: 'secondary', action: { type: 'message', label: 'แก้ไขข้อมูล', text: 'แก้ไขข้อมูล' } },
        ],
      },
    },
  };
}

function buildBookingSuccessFlex(booking = {}) {
  return {
    type: 'flex',
    altText: 'ยืนยันการจองสำเร็จ',
    contents: {
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#285943',
        paddingAll: '18px',
        contents: [
          { type: 'text', text: 'จองคิวสำเร็จ', weight: 'bold', color: '#FFFFFF', size: 'xl' },
          { type: 'text', text: booking.booking_number || booking.bookingNumber || '-', color: '#D9F7E8', size: 'sm', margin: 'sm' },
        ],
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        paddingAll: '18px',
        contents: [
          { type: 'text', text: `ชื่อ : ${booking.customer_name || booking.customerName || '-'}`, wrap: true, size: 'sm' },
          { type: 'text', text: `ประเภทข้าว : ${booking.rice_type || booking.riceType || '-'}`, wrap: true, size: 'sm' },
          { type: 'text', text: `จำนวน : ${booking.quantity_kg || booking.quantityKg || '-'}`, wrap: true, size: 'sm' },
          { type: 'text', text: `วันที่ : ${booking.desired_date || booking.desiredDate || '-'}`, wrap: true, size: 'sm' },
          { type: 'text', text: `เวลา : ${booking.dropoff_time || booking.dropoffTime || '-'}`, wrap: true, size: 'sm' },
        ],
      },
    },
  };
}

module.exports = {
  buildBookingConfirmationFlex,
  buildBookingSuccessFlex,
};