/* My History Combined - Orders + Milling Requests */

document.addEventListener('DOMContentLoaded', () => {
  // Tab switching
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabName = btn.getAttribute('data-tab');
      
      // Remove active from all
      tabBtns.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));
      
      // Add active to clicked
      btn.classList.add('active');
      document.getElementById(tabName).classList.add('active');
    });
  });

  // Toast helper
  const toast = (message, type = 'success') => {
    if (window.FormUtils?.showToast) {
      window.FormUtils.showToast(message, type);
    } else {
      alert(message);
    }
  };

  // Escape HTML
  const esc = (value) => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

  // Format currency
  const formatMoney = (value) => `฿${Number(value || 0).toFixed(2)}`;

  // Format date
  const formatDate = (value) => {
    if (!value) return '-';
    try {
      return new Date(value).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
      return String(value);
    }
  };

  // Order status
  const orderStatusLabel = (status) => {
    const map = {
      pending: 'รอดำเนินการ',
      accepted: 'ยอมรับคำสั่งซื้อแล้ว',
      pending_payment: 'รอชำระเงิน',
      payment_review: 'รอตรวจสอบการชำระเงิน',
      paid: 'ชำระเงินแล้ว',
      preparing: 'กำลังเตรียมสินค้า',
      awaiting_pickup: 'รอลูกค้ามารับสินค้า',
      ready_to_ship: 'พร้อมจัดส่ง',
      shipping: 'จัดส่งแล้ว',
      completed: 'สำเร็จ',
      cancelled: 'ยกเลิกคำสั่งซื้อสินค้าแล้ว'
    };
    return map[status] || map[String(status || '').trim()] || status || '-';
  };

  const orderStatusClass = (status) => {
    if (status === 'pending') return 'border border-gray-300 bg-gray-50 text-gray-700';
    if (status === 'accepted') return 'border border-sky-200 bg-sky-50 text-sky-800';
    if (status === 'cancelled') return 'border border-gray-300 bg-rice-50 text-red-700';
    if (status === 'completed') return 'border border-green-200 bg-green-50 text-green-800';
    if (['shipping','ready_to_ship','awaiting_pickup','preparing'].includes(status)) return 'border border-blue-200 bg-blue-50 text-blue-800';
    if (status === 'paid') return 'border border-amber-200 bg-amber-50 text-amber-800';
    if (status === 'payment_review') return 'border border-orange-200 bg-orange-50 text-orange-800';
    return 'border border-rice-700 bg-grain-100 text-grain-600';
  };

  // Milling status
  const millingStatusLabel = (status) => {
    const map = {
      pending_review: 'รอตรวจสอบ',
      accepted: 'รับคำสั่งแล้ว',
      awaiting_pickup: 'รอไปรับข้าว',
      received: 'รับข้าวแล้ว',
      queued: 'รอคิวสี',
      milling: 'กำลังสีข้าว',
      packing: 'กำลังแพ็ก',
      ready: 'พร้อมรับ/จัดส่ง',
      shipping: 'กำลังจัดส่ง',
      delivered: 'ส่งมอบแล้ว',
      cancelled: 'ยกเลิกคำขอสีข้าวแล้ว'
    };
    return map[status] || map[String(status || '').trim()] || status || '-';
  };

  const millingStatusClass = (status) => {
    if (status === 'cancelled') return 'border border-gray-300 bg-rice-50 text-red-700';
    if (status === 'delivered') return 'border border-green-200 bg-green-50 text-green-800';
    if (['shipping','packing','milling','queued','received','awaiting_pickup','accepted','pending_review'].includes(status)) return 'border border-blue-200 bg-blue-50 text-blue-800';
    return 'border border-amber-200 bg-amber-50 text-amber-800';
  };

  // Render orders
  const renderOrders = (rows) => {
    const tableBody = document.getElementById('orders-rows');
    const emptyState = document.getElementById('orders-empty');

    if (!tableBody) return;

    if (!rows || rows.length === 0) {
      tableBody.innerHTML = '';
      if (emptyState) emptyState.classList.remove('hidden');
      return;
    }

    if (emptyState) emptyState.classList.add('hidden');

    let html = '';
    rows.forEach((row, idx) => {
      const badge = `<span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs ${orderStatusClass(row.status)}">${esc(orderStatusLabel(row.status))}</span>`;
      const millName = esc(row.mill_name_th || row.mill_name || '-');
      const itemCount = row.item_count || 0;

      html += `
        <tr class="odd:bg-white even:bg-rice-50">
          <td class="border border-slate-300 px-3 py-2">${idx + 1}</td>
          <td class="border border-slate-300 px-3 py-2 font-medium">${esc(row.order_number)}</td>
          <td class="border border-slate-300 px-3 py-2">${millName}</td>
          <td class="border border-slate-300 px-3 py-2 text-center">${itemCount}</td>
          <td class="border border-slate-300 px-3 py-2 font-medium">${formatMoney(row.total)}</td>
          <td class="border border-slate-300 px-3 py-2">${badge}</td>
          <td class="border border-slate-300 px-3 py-2">${formatDate(row.created_at)}</td>
        </tr>
      `;
    });

    tableBody.innerHTML = html;
  };

  // Render milling requests
  const renderMilling = (rows) => {
    const tableBody = document.getElementById('milling-rows');
    const emptyState = document.getElementById('milling-empty');

    if (!tableBody) return;

    if (!rows || rows.length === 0) {
      tableBody.innerHTML = '';
      if (emptyState) emptyState.classList.remove('hidden');
      return;
    }

    if (emptyState) emptyState.classList.add('hidden');

    let html = '';
    rows.forEach((row, idx) => {
      const badge = `<span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs ${millingStatusClass(row.status)}">${esc(millingStatusLabel(row.status))}</span>`;
      const millName = esc(row.mill_name_th || row.mill_name || '-');

      html += `
        <tr class="odd:bg-white even:bg-rice-50">
          <td class="border border-slate-300 px-3 py-2">${idx + 1}</td>
          <td class="border border-slate-300 px-3 py-2">${millName}</td>
          <td class="border border-slate-300 px-3 py-2">${esc(row.rice_type)}</td>
          <td class="border border-slate-300 px-3 py-2 text-center">${Number(row.sacks || 0)}</td>
          <td class="border border-slate-300 px-3 py-2">${formatDate(row.dropoff_date)}</td>
          <td class="border border-slate-300 px-3 py-2">${badge}</td>
        </tr>
      `;
    });

    tableBody.innerHTML = html;
  };

  // Fetch orders
  const fetchOrders = async () => {
    try {
      const session = window.OwnerSession?.get?.();
      const villager_id = session?.villager_id;
      
      if (!villager_id) {
        toast('ไม่พบข้อมูลผู้ใช้ กรุณาล็อคอินใหม่', 'error');
        return;
      }
      // Fetch only completed and cancelled orders for history
      const respCompleted = await fetch(`/api/orders?limit=100&offset=0&villager_id=${villager_id}&status=completed`);
      const jsonCompleted = await respCompleted.json().catch(() => ({ data: [] }));

      const respCancelled = await fetch(`/api/orders?limit=100&offset=0&villager_id=${villager_id}&status=cancelled`);
      const jsonCancelled = await respCancelled.json().catch(() => ({ data: [] }));

      const allOrders = [...(jsonCompleted.data || []), ...(jsonCancelled.data || [])];
      allOrders.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      renderOrders(allOrders);
    } catch (err) {
      console.error('Fetch orders error:', err);
      toast('ดึงข้อมูลคำสั่งซื้อไม่สำเร็จ', 'error');
    }
  };

  // Fetch milling requests
  const fetchMilling = async () => {
    try {
      const respCompleted = await fetch(`/api/milling-requests/my-requests?limit=100&offset=0&status=delivered`);
      const jsonCompleted = await respCompleted.json().catch(() => ({ data: [] }));

      const respCancelled = await fetch(`/api/milling-requests/my-requests?limit=100&offset=0&status=cancelled`);
      const jsonCancelled = await respCancelled.json().catch(() => ({ data: [] }));

      const all = [...(jsonCompleted.data || []), ...(jsonCancelled.data || [])];
      all.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      renderMilling(all);
    } catch (err) {
      console.error('Fetch milling error:', err);
      toast('ดึงข้อมูลการสีข้าวไม่สำเร็จ', 'error');
    }
  };

  // Initial load
  fetchOrders();
  fetchMilling();
});
