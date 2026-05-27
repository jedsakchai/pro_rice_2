document.addEventListener('DOMContentLoaded', () => {
  const session = window.OwnerSession?.get?.();
  if (!session || !session.mill_id) {
    window.location.href = '/login.html';
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');

  const orderNumberEl = document.getElementById('order-number');
  const customerNameEl = document.getElementById('customer-name');
  const customerPhoneEl = document.getElementById('customer-phone');
  const customerAddressEl = document.getElementById('customer-address');
  const shippingMethodEl = document.getElementById('shipping-method');
  const shippingFeeEl = document.getElementById('shipping-fee');
  const paymentMethodEl = document.getElementById('payment-method');
  const orderStatusEl = document.getElementById('order-status');
  const orderNoteEl = document.getElementById('order-note');
  const orderItemsEl = document.getElementById('order-items');
  const subtotalEl = document.getElementById('subtotal');
  const summaryShippingEl = document.getElementById('summary-shipping');
  const grandTotalEl = document.getElementById('grand-total');
  const statusSelect = document.getElementById('order-status-select');
  const btnSave = document.getElementById('btn-save');
  const paymentProofLink = document.getElementById('payment-proof');
  const paymentProofEmpty = document.getElementById('payment-proof-empty');

  const toast = (message, type = 'success') => {
    if (window.FormUtils?.showToast) {
      window.FormUtils.showToast(message, type);
      return;
    }
    alert(message);
  };

  const esc = (value) => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

  const formatMoney = (value) => `฿${Number(value || 0).toFixed(2)}`;

  const translateShipping = (value) => value === 'pickup' ? 'มารับเองที่โรงสี' : 'รับส่งถึงที่';
  const translatePayment = (value) => ({
    bank_transfer: 'โอนเงินผ่านธนาคาร',
    cod: 'ชำระปลายทาง (COD)',
    promptpay: 'QR PromptPay'
  }[value] || value || '-');

  const statusLabel = (status) => ({
    pending: 'รอดำเนินการ',
    accepted: 'ยอมรับคำสั่งซื้อแล้ว',
    pending_payment: 'รอชำระเงิน',
    payment_review: 'รอตรวจสอบการชำระเงิน',
    paid: 'ชำระเงินแล้ว',
    preparing: 'กำลังเตรียมสินค้า',
    ready_to_ship: 'พร้อมจัดส่ง',
    shipping: 'จัดส่งแล้ว',
    completed: 'สำเร็จ',
    cancelled: 'ยกเลิก'
  }[status] || status || '-');

  const setDisabled = (disabled) => {
    if (statusSelect) statusSelect.disabled = disabled;
    if (btnSave) btnSave.disabled = disabled;
  };

  const renderItems = (items) => {
    if (!orderItemsEl) return;
    if (!items || items.length === 0) {
      orderItemsEl.innerHTML = '<div class="text-gray-600">ไม่มีรายการสินค้า</div>';
      return;
    }

    orderItemsEl.innerHTML = items.map((item) => `
      <div class="flex items-start justify-between gap-4 border border-gray-200 rounded-lg p-4 bg-white/70">
        <div>
          <div class="font-medium">${esc(item.product_name_th)}</div>
          <div class="text-gray-600 text-sm">${esc(item.quantity)} x ${formatMoney(item.price)}</div>
        </div>
        <div class="font-semibold text-field-700">${formatMoney(item.subtotal)}</div>
      </div>
    `).join('');
  };

  const applyOrderData = (data) => {
    if (orderNumberEl) orderNumberEl.textContent = data.order_number || '-';
    if (customerNameEl) customerNameEl.textContent = data.customer_name || '-';
    if (customerPhoneEl) customerPhoneEl.textContent = data.phone || '-';
    if (customerAddressEl) customerAddressEl.textContent = data.address || '-';
    if (shippingMethodEl) shippingMethodEl.textContent = translateShipping(data.shipping_method);
    if (shippingFeeEl) shippingFeeEl.textContent = formatMoney(data.shipping_fee);
    if (paymentMethodEl) paymentMethodEl.textContent = translatePayment(data.payment_method);
    if (orderStatusEl) orderStatusEl.textContent = statusLabel(data.status);
    if (orderNoteEl) orderNoteEl.textContent = data.note || '-';
    if (subtotalEl) subtotalEl.textContent = formatMoney((data.items || []).reduce((sum, item) => sum + (Number(item.price || 0) * Number(item.quantity || 0)), 0));
    if (summaryShippingEl) summaryShippingEl.textContent = formatMoney(data.shipping_fee);
    if (grandTotalEl) grandTotalEl.textContent = formatMoney(data.total);
    if (statusSelect) {
      const aliases = {
        awaiting_payment: 'payment_review',
        confirmed: 'accepted',
        shipped: 'shipping'
      };
      statusSelect.value = aliases[data.status] || data.status || 'pending';
    }

    if (data.payment_proof_url) {
      paymentProofLink.href = data.payment_proof_url;
      paymentProofLink.classList.remove('hidden');
      paymentProofEmpty.classList.add('hidden');
    } else {
      paymentProofLink.classList.add('hidden');
      paymentProofEmpty.classList.remove('hidden');
      paymentProofEmpty.textContent = '-';
    }

    renderItems(data.items || []);
  };

  const fetchDetail = async () => {
    if (!id) {
      toast('ไม่พบรหัสคำสั่งซื้อ', 'error');
      setDisabled(true);
      return;
    }

    setDisabled(true);

    try {
      const resp = await fetch(`/api/orders/${encodeURIComponent(id)}`);
      const json = await resp.json();
      if (!resp.ok || !json || json.success !== true) {
        throw new Error(json?.message || 'ไม่สามารถดึงข้อมูลได้');
      }

      const data = json.data || {};
      if (Number(data.mill_id) !== Number(session.mill_id)) {
        toast('คุณไม่มีสิทธิ์ดูคำสั่งซื้อนี้', 'error');
        return;
      }

      applyOrderData(data);
      setDisabled(false);
    } catch (err) {
      console.error(err);
      toast(err.message || 'ดึงข้อมูลไม่สำเร็จ', 'error');
      setDisabled(true);
    }
  };

  const save = async () => {
    if (!id) return;
    try {
      setDisabled(true);
      const resp = await fetch(`/api/orders/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: statusSelect ? statusSelect.value : 'pending' })
      });
      const json = await resp.json().catch(() => null);
      if (!resp.ok || !json || json.success !== true) {
        throw new Error(json?.message || 'บันทึกไม่สำเร็จ');
      }

      toast('ยอมรับคำสั่งซื้อเรียบร้อย', 'success');
      setTimeout(() => {
        window.location.href = '/owner-orders.html';
      }, 600);
    } catch (err) {
      console.error(err);
      toast(err.message || 'บันทึกไม่สำเร็จ', 'error');
      setDisabled(false);
    }
  };

  btnSave?.addEventListener('click', (e) => {
    e.preventDefault();
    save();
  });

  fetchDetail();
});
