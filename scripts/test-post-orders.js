const http = require('http');

const payload = {
  customer_name: 'ทดสอบ',
  phone: '0800000000',
  address: 'บางกอก',
  shipping_method: 'delivery',
  shipping_fee: 10,
  payment_method: 'bank_transfer',
  note: 'ทดสอบหลายโรงสี',
  villager_id: 1,
  orders: [
    {
      mill_id: 2,
      mill_name: 'Northern Mill',
      shipping_fee: 10,
      total: 68,
      items: [
        { product_id: 7, product_name_th: 'ข้าวหอมมะลิเหนือ', price: 48, quantity: 1, subtotal: 48 },
        { product_id: 8, product_name_th: 'ปลายข้าวเหนือ', price: 20, quantity: 1, subtotal: 20 }
      ]
    },
    {
      mill_id: 3,
      mill_name: 'Southern Mill',
      shipping_fee: 0,
      total: 36,
      items: [
        { product_id: 11, product_name_th: 'แกลบใต้', price: 14, quantity: 1, subtotal: 14 },
        { product_id: 12, product_name_th: 'รำข้าวใต้', price: 22, quantity: 1, subtotal: 22 }
      ]
    }
  ]
};

const data = JSON.stringify(payload);

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/orders',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data)
  }
};

const req = http.request(options, (res) => {
  let body = '';
  res.setEncoding('utf8');
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => {
    try {
      const j = JSON.parse(body);
      console.log('Response:', JSON.stringify(j, null, 2));
    } catch (e) {
      console.log('Non-JSON response:', body);
    }
    process.exit(0);
  });
});

req.on('error', (e) => {
  console.error('Request error', e);
  process.exit(1);
});

req.write(data);
req.end();
