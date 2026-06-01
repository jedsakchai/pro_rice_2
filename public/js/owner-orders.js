document.addEventListener('DOMContentLoaded', () => {
  const session = window.OwnerSession?.get?.();
  if (!session || !session.mill_id) {
    window.location.href = '/login.html';
    return;
  }

  const tableBody = document.getElementById('order-rows');
  const emptyState = document.getElementById('order-empty');

  const toast = (message, type = 'success') => {
    if (window.FormUtils?.showToast) {
      window.FormUtils.showToast(message, type);
    } else {
      alert(message);
    }
  };

  const esc = (value) => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

  const formatMoney = (value) => `฿${Number(value || 0).toFixed(2)}`;

  const statusLabel = (status) => {
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

  const statusClass = (status) => {
    if (status === 'pending') return 'border border-gray-300 bg-gray-50 text-gray-700';
    if (status === 'accepted') return 'border border-sky-200 bg-sky-50 text-sky-800';
    if (status === 'cancelled') return 'border border-gray-300 bg-rice-50 text-red-700';
    if (status === 'completed') return 'border border-green-200 bg-green-50 text-green-800';
    if (['shipping','ready_to_ship','awaiting_pickup','preparing'].includes(status)) return 'border border-blue-200 bg-blue-50 text-blue-800';
    if (status === 'paid') return 'border border-amber-200 bg-amber-50 text-amber-800';
    if (status === 'payment_review') return 'border border-orange-200 bg-orange-50 text-orange-800';
    return 'border border-rice-700 bg-grain-100 text-grain-600';
  };

  const setLoadingRow = () => {
    if (!tableBody) return;
    tableBody.innerHTML = `
      <tr class="odd:bg-white even:bg-rice-50">
        <td class="border border-gray-300 px-3 py-3 text-center text-gray-500" colspan="6">กำลังโหลดข้อมูล...</td>
      </tr>
    `;
  };

  const renderRows = (rows) => {
    if (!tableBody) return;

    if (!rows || rows.length === 0) {
      tableBody.innerHTML = '';
      emptyState?.classList.remove('hidden');
      return;
    }

    emptyState?.classList.add('hidden');
    tableBody.innerHTML = rows.map((row, idx) => {
      const badge = `<span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs ${statusClass(row.status)}">${esc(statusLabel(row.status))}</span>`;
      return `
        <tr class="odd:bg-white even:bg-rice-50">
          <td class="border border-gray-300 px-3 py-2">${idx + 1}</td>
          <td class="border border-gray-300 px-3 py-2 font-medium">${esc(row.order_number)}</td>
          <td class="border border-gray-300 px-3 py-2">${esc(row.customer_name)}</td>
          <td class="border border-gray-300 px-3 py-2">${badge}</td>
          <td class="border border-gray-300 px-3 py-2 font-medium">${formatMoney(row.total)}</td>
          <td class="border border-gray-300 px-3 py-2">
            <a href="/owner-orders-detail.html?id=${row.order_id}" class="btn-secondary px-3 py-1 text-xs inline-flex">รายละเอียด</a>
          </td>
        </tr>
      `;
    }).join('');
  };

  const fetchRows = async () => {
    setLoadingRow();

    try {
      const resp = await fetch(`/api/orders?mill_id=${encodeURIComponent(session.mill_id)}&limit=100&offset=0`);
      const json = await resp.json();

      if (!resp.ok || !json || json.success !== true) {
        throw new Error(json?.message || 'ไม่สามารถดึงข้อมูลได้');
      }

      renderRows(json.data);
    } catch (err) {
      console.error(err);
      if (tableBody) {
        tableBody.innerHTML = `
          <tr class="odd:bg-white even:bg-rice-50">
            <td class="border border-gray-300 px-3 py-3 text-center text-red-700" colspan="6">เกิดข้อผิดพลาดในการดึงข้อมูล</td>
          </tr>
        `;
      }
      toast('ดึงข้อมูลคำสั่งซื้อไม่สำเร็จ', 'error');
    }
  };

  fetchRows();
  setInterval(fetchRows, 15000);
});
