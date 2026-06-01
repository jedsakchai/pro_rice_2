/* Villager - My Orders History (dynamic)
  Data source: /api/orders (filtered by villager_id from session)
*/

document.addEventListener('DOMContentLoaded', () => {
  const tableBody = document.getElementById('orders-rows');
  const emptyState = document.getElementById('orders-empty');

  // ตัวช่วยแสดง toast
  const toast = (message, type = 'success') => {
    if (window.FormUtils?.showToast) {
      window.FormUtils.showToast(message, type);
    } else {
      alert(message);
    }
  };

  // Escape HTML เพื่อกัน XSS
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

  // Order status label (ภาษาไทย)
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
      cancelled: 'ยกเลิก'
    };
    return map[status] || map[String(status || '').trim()] || status || '-';
  };

  // Order status badge styling
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

  // Set loading row
  const setLoadingRow = () => {
    if (!tableBody) return;
    tableBody.innerHTML = `
      <tr class="odd:bg-white even:bg-rice-50">
        <td class="border border-slate-300 px-3 py-3 text-center text-gray-500" colspan="7">กำลังโหลดข้อมูล...</td>
      </tr>
    `;
  };

  // Render rows
  const renderRows = (rows) => {
    if (!tableBody) return;

    if (!rows || rows.length === 0) {
      tableBody.innerHTML = '';
      if (emptyState) emptyState.classList.remove('hidden');
      return;
    }

    if (emptyState) emptyState.classList.add('hidden');

    let html = '';
    rows.forEach((row, idx) => {
      const badge = `<span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs ${statusClass(row.status)}">${esc(statusLabel(row.status))}</span>`;
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

  // Fetch orders from API
  const fetchRows = async () => {
    setLoadingRow();

    try {
      const session = window.OwnerSession?.get?.();
      const villagerId = Number(session?.villager_id || 0);
      if (!villagerId) {
        emptyState && emptyState.classList.remove('hidden');
        return;
      }

      // Fetch only completed and cancelled orders for history (others are delivered via notifications)
      const respCompleted = await fetch(`/api/orders?limit=100&offset=0&villager_id=${villagerId}&status=completed`);
      const jsonCompleted = await respCompleted.json().catch(() => ({ data: [] }));

      const respCancelled = await fetch(`/api/orders?limit=100&offset=0&villager_id=${villagerId}&status=cancelled`);
      const jsonCancelled = await respCancelled.json().catch(() => ({ data: [] }));

      if ((!respCompleted.ok && !respCancelled.ok) || (!jsonCompleted || !jsonCancelled)) {
        throw new Error('ไม่สามารถดึงข้อมูลได้');
      }

      const combined = [...(jsonCompleted.data || []), ...(jsonCancelled.data || [])];
      // sort by created_at desc
      combined.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      renderRows(combined || []);
    } catch (err) {
      console.error(err);

      if (tableBody) {
        tableBody.innerHTML = `
          <tr class="odd:bg-white even:bg-rice-50">
            <td class="border border-slate-300 px-3 py-3 text-center text-red-700" colspan="7">เกิดข้อผิดพลาดในการดึงข้อมูล</td>
          </tr>
        `;
      }
      toast('ดึงข้อมูลไม่สำเร็จ', 'error');
    }
  };

  // Initial load
  fetchRows();
});
