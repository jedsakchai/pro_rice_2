document.addEventListener('DOMContentLoaded', () => {
  function getSessionVillagerId() {
    const session = window.OwnerSession?.get?.();
    const id = Number(session?.villager_id || 0);
    return Number.isFinite(id) && id > 0 ? id : null;
  }

  const sessionVillagerId = getSessionVillagerId();
  const orderPreviewKey = sessionVillagerId ? `rice_mill_order_preview_v_${sessionVillagerId}` : 'rice_mill_order_preview_guest';
  const cartKey = sessionVillagerId ? `rice_mill_cart_v_${sessionVillagerId}` : 'rice_mill_cart_guest';

  const summaryEl = document.getElementById('summary-items');
  const subtotalEl = document.getElementById('subtotal');
  const shippingFeeEl = document.getElementById('shipping_fee');
  const grandTotalEl = document.getElementById('grand_total');
  const btnConfirm = document.getElementById('btn_confirm');

  const shipName = document.getElementById('ship_name');
  const shipPhone = document.getElementById('ship_phone');
  const shipAddress = document.getElementById('ship_address');
  const shippingRadios = Array.from(document.querySelectorAll('input[name="shipping_method"]'));
  const paymentRadios = Array.from(document.querySelectorAll('input[name="payment_method"]'));
  const bankInfo = document.getElementById('bank-info');
  const promptpayInfo = document.getElementById('promptpay-info');
  const slipInput = document.getElementById('payment_slip');
  const slipPreview = document.getElementById('slip_preview');
  const orderNote = document.getElementById('order_note');

  const applyIfEmpty = (inputEl, value) => {
    if (!inputEl) return;
    const nextValue = String(value || '').trim();
    if (!inputEl.value.trim() && nextValue) {
      inputEl.value = nextValue;
    }
  };

  const loadCustomerProfile = async () => {
    const session = window.OwnerSession?.get?.();
    if (!session || session.role === 'owner' || !session.villager_id) return;

    applyIfEmpty(shipName, session.owner_name || session.villager_name || '');
    applyIfEmpty(shipPhone, session.phone || '');
    applyIfEmpty(shipAddress, session.address || '');

    if ((shipName && shipName.value.trim()) && (shipPhone && shipPhone.value.trim()) && (shipAddress && shipAddress.value.trim())) {
      return;
    }

    try {
      const headers = {};
      if (session) {
        headers['x-session-data'] = btoa(unescape(encodeURIComponent(JSON.stringify(session))));
      }
      const resp = await fetch('/api/auth/me', { headers });
      const json = await resp.json().catch(() => null);
      if (!resp.ok || !json || json.success !== true || !json.data) return;

      const profile = json.data || {};
      applyIfEmpty(shipName, profile.villager_name || profile.owner_name || session.owner_name || '');
      applyIfEmpty(shipPhone, profile.phone || session.phone || '');
      applyIfEmpty(shipAddress, profile.address || session.address || '');
    } catch (err) {
      console.debug('loadCustomerProfile(checkout) failed', err);
    }
  };

  const persistCustomerSession = () => {
    const session = window.OwnerSession?.get?.();
    if (!session || session.role === 'owner' || !session.villager_id) return;

    window.OwnerSession?.set?.({
      ...session,
      owner_name: shipName?.value?.trim() || session.owner_name || session.villager_name || '',
      villager_name: shipName?.value?.trim() || session.villager_name || session.owner_name || '',
      phone: shipPhone?.value?.trim() || session.phone || '',
      address: shipAddress?.value?.trim() || session.address || '',
    });
  };

  let cartRaw = localStorage.getItem(cartKey);
  if (!cartRaw) {
    const legacyCart = localStorage.getItem('rice_mill_cart');
    if (legacyCart) {
      cartRaw = legacyCart;
      localStorage.setItem(cartKey, legacyCart);
    }
  }

  let previewRaw = localStorage.getItem(orderPreviewKey);
  if (!previewRaw) {
    const legacyPreview = localStorage.getItem('rice_mill_order_preview');
    if (legacyPreview) {
      previewRaw = legacyPreview;
      localStorage.setItem(orderPreviewKey, legacyPreview);
    }
  }

  let cart = JSON.parse(cartRaw || '[]');
  let preview = JSON.parse(previewRaw || 'null');

  async function hydrateProductsForCheckout() {
    try {
      const cached = localStorage.getItem('rice_mill_products');
      let products = [];
      if (cached) {
        products = JSON.parse(cached) || [];
      } else {
        const res = await fetch('/api/products');
        const json = await res.json();
        products = Array.isArray(json?.data) ? json.data : [];
      }
      const byId = new Map(products.map(p => [Number(p.product_id), p]));
      cart = cart.map(item => {
        const product = byId.get(Number(item.product_id));
        if (!product) return item;
        return {
          ...item,
          mill_id: item.mill_id || product.mill_id || null,
          mill_name: item.mill_name || product.mill_name || '',
          mill_name_th: item.mill_name_th || product.mill_name_th || '',
          product_name_th: item.product_name_th || product.product_name_th || '',
          unit_th: item.unit_th || product.unit_th || '',
          price: Number(item.price || product.price || 0),
          stock: Number(item.stock || product.stock || 0),
          image_url: item.image_url || product.image_url || '',
          has_image: item.has_image !== undefined ? item.has_image : (product.has_image || false)
        };
      });
    } catch (err) {
      console.debug('hydrateProductsForCheckout failed', err);
    }
  }

  function formatV(n){ return '฿' + Number(n||0).toFixed(2); }

  function groupCartByMill(items) {
    const groups = new Map();
    (items || []).forEach((item) => {
      const key = item.mill_id || 'unknown';
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key).push(item);
    });
    return Array.from(groups.entries()).map(([millId, groupItems]) => ({ millId, items: groupItems }));
  }

  function renderSummary(){
    if (!cart || cart.length === 0) {
      summaryEl.innerHTML = '<div class="text-sm text-gray-600">ตะกร้าว่าง</div>';
      subtotalEl.textContent = formatV(0);
      shippingFeeEl.textContent = formatV(0);
      grandTotalEl.textContent = formatV(0);
      return;
    }
    const rows = groupCartByMill(cart).map(group => {
      const millName = group.items[0]?.mill_name_th || group.items[0]?.mill_name || `โรงสี ID: ${group.millId}`;
      const groupRows = group.items.map(it => `
        <div class="flex justify-between items-center pl-3 border-l-2 border-gray-200">
          <div class="text-sm">
            <div class="font-medium">${it.product_name_th}</div>
            <div class="text-xs text-gray-500">${it.quantity} x ${it.unit_th}</div>
          </div>
          <div class="text-sm font-medium">${formatV(it.price * it.quantity)}</div>
        </div>
      `).join('');

      return `
        <div class="space-y-2">
          <div class="text-sm font-semibold text-field-700">${millName}</div>
          <div class="space-y-2">${groupRows}</div>
        </div>
      `;
    }).join('');
    summaryEl.innerHTML = rows;

    const subtotal = cart.reduce((s,i)=>s + (Number(i.price||0)*Number(i.quantity||0)), 0);
    subtotalEl.textContent = formatV(subtotal);

    const shipMethod = (document.querySelector('input[name="shipping_method"]:checked') || {}).value || 'delivery';
    const shippingFee = shipMethod === 'delivery' ? 10.00 : 0.00;
    shippingFeeEl.textContent = formatV(shippingFee);

    const grand = subtotal + shippingFee;
    grandTotalEl.textContent = formatV(grand);
  }

  // Prefill shipping info if user logged in and stored in OwnerSession
  loadCustomerProfile();

  // If preview exists (from cart page) fill some fields
  if (preview) {
    // use preview total if available
  }

  // Show/hide payment sections
  function updatePaymentUI(){
    const pm = (document.querySelector('input[name="payment_method"]:checked') || {}).value || 'bank_transfer';
    if (pm === 'bank_transfer') { bankInfo.classList.remove('hidden'); promptpayInfo.classList.add('hidden'); }
    else if (pm === 'promptpay') { bankInfo.classList.add('hidden'); promptpayInfo.classList.remove('hidden'); }
    else { bankInfo.classList.add('hidden'); promptpayInfo.classList.add('hidden'); }
  }
  paymentRadios.forEach(r => r.addEventListener('change', updatePaymentUI));
  updatePaymentUI();

  slipInput?.addEventListener('change', () => {
    const f = slipInput.files && slipInput.files[0];
    if (!f) { slipPreview.textContent = ''; return; }
    slipPreview.textContent = `ไฟล์: ${f.name} (${Math.round(f.size/1024)} KB)`;
  });

  // initial render
  hydrateProductsForCheckout().finally(() => renderSummary());

  // confirm
  btnConfirm.addEventListener('click', async (e) => {
    e.preventDefault();

    // validations
    if (!shipName.value.trim()) { window.FormUtils.showToast('กรุณากรอกชื่อผู้รับ','error'); return; }
    if (!shipPhone.value.trim() || !window.FormUtils.isValidPhoneNumber(shipPhone.value.trim())) { window.FormUtils.showToast('กรุณากรอกเบอร์โทรศัพท์ให้ถูกต้อง','error'); return; }
    if (!shipAddress.value.trim()) { window.FormUtils.showToast('กรุณากรอกที่อยู่โดยละเอียด','error'); return; }
    if (!cart || cart.length === 0) { window.FormUtils.showToast('ตะกร้าว่าง','error'); return; }

    const shipMethod = (document.querySelector('input[name="shipping_method"]:checked') || {}).value || 'delivery';
    const paymentMethod = (document.querySelector('input[name="payment_method"]:checked') || {}).value || 'bank_transfer';
    const subtotal = cart.reduce((s,i)=>s + (Number(i.price||0)*Number(i.quantity||0)), 0);
    const shippingFee = shipMethod === 'delivery' ? 10.00 : 0.00;
    const total = subtotal + shippingFee;

    const payload = {
      customer_name: shipName.value.trim(),
      phone: shipPhone.value.trim(),
      address: shipAddress.value.trim(),
      shipping_method: shipMethod,
      shipping_fee: shippingFee,
      payment_method: paymentMethod,
      note: orderNote.value?.trim() || '',
      items: cart.map(i => ({ product_id: i.product_id, product_name_th: i.product_name_th, price: i.price, quantity: i.quantity, subtotal: i.price * i.quantity })),
      total,
      villager_id: window.OwnerSession?.get?.()?.villager_id || null
    };

    const groupedItems = groupCartByMill(cart);
    if (groupedItems.length > 1) {
      payload.orders = groupedItems.map((group, index) => {
        const subtotal = group.items.reduce((sum, item) => sum + (Number(item.price || 0) * Number(item.quantity || 0)), 0);
        const isFirstGroup = index === 0;
        const millId = group.items[0]?.mill_id || null;
        const millName = group.items[0]?.mill_name_th || group.items[0]?.mill_name || '';
        return {
          mill_id: millId,
          mill_name: millName,
          shipping_fee: isFirstGroup ? shippingFee : 0,
          total: subtotal + (isFirstGroup ? shippingFee : 0),
          items: group.items.map(i => ({
            product_id: i.product_id,
            product_name_th: i.product_name_th,
            price: i.price,
            quantity: i.quantity,
            subtotal: i.price * i.quantity,
            mill_id: i.mill_id || null,
            mill_name: i.mill_name || i.mill_name_th || ''
          }))
        };
      });
    }

    try {
      btnConfirm.disabled = true; btnConfirm.textContent = 'กำลังส่งคำสั่งซื้อ...';
      const res = await fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        window.FormUtils.showToast(json?.message || 'ส่งคำสั่งซื้อไม่สำเร็จ', 'error');
        btnConfirm.disabled = false; btnConfirm.textContent = 'ยืนยันการสั่งซื้อ';
        return;
      }

      const createdOrders = json?.orders || (json?.data?.orders || []);
      const { order_id, order_number } = json || {};

      // If bank transfer and slip attached, upload
      if (paymentMethod === 'bank_transfer' && slipInput && slipInput.files && slipInput.files[0]) {
        const form = new FormData();
        form.append('slip', slipInput.files[0]);
        const up = await fetch(`/api/orders/${order_id}/upload-slip`, { method: 'POST', body: form });
        // ignore response details for now
      }

      // Clear cart and preview
      localStorage.removeItem(cartKey);
      localStorage.removeItem(orderPreviewKey);

      // Show success message and order number
      const resultEl = document.getElementById('checkout-result');
      resultEl.classList.remove('hidden');
      if (createdOrders.length > 1) {
        resultEl.innerHTML = `
          <div class="p-4 rounded bg-green-50 text-green-800 space-y-2">
            <div class="font-semibold">สั่งซื้อสำเร็จ</div>
            <div>ระบบแยกคำสั่งซื้อเป็น ${createdOrders.length} รายการตามโรงสี</div>
            <div class="text-sm space-y-1">
              ${createdOrders.map(order => `<div>หมายเลขคำสั่งซื้อ: <strong>${order.order_number || '-'}</strong></div>`).join('')}
            </div>
            <div class="mt-2"><a href="/my-history-combined.html" class="text-field-700 hover:underline">ดูประวัติการสั่งซื้อ</a></div>
          </div>
        `;
      } else {
        resultEl.innerHTML = `
          <div class="p-4 rounded bg-green-50 text-green-800">
            <div class="font-semibold">สั่งซื้อสำเร็จ</div>
            <div>หมายเลขคำสั่งซื้อ: <strong>${order_number}</strong></div>
            <div class="mt-2"><a href="/order-status.html?order_id=${order_id}" class="text-field-700 hover:underline">ติดตามสถานะคำสั่งซื้อ</a></div>
          </div>
        `;
      }

      window.FormUtils.showToast('สั่งซื้อเรียบร้อย','success');
      persistCustomerSession();
      btnConfirm.textContent = 'ยืนยันการสั่งซื้อ';
      btnConfirm.disabled = true;

    } catch (err) {
      console.error(err);
      window.FormUtils.showToast('เกิดข้อผิดพลาด ลองใหม่อีกครั้ง', 'error');
      btnConfirm.disabled = false; btnConfirm.textContent = 'ยืนยันการสั่งซื้อ';
    }
  });

});
