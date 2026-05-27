(function () {
  const millingStatusLabels = {
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
    cancelled: 'ยกเลิก'
  };

  const millingStatusColors = {
    pending_review: 'bg-yellow-100 text-yellow-800',
    accepted: 'bg-blue-100 text-blue-800',
    awaiting_pickup: 'bg-blue-100 text-blue-800',
    received: 'bg-blue-100 text-blue-800',
    queued: 'bg-blue-100 text-blue-800',
    milling: 'bg-blue-100 text-blue-800',
    packing: 'bg-blue-100 text-blue-800',
    ready: 'bg-blue-100 text-blue-800',
    shipping: 'bg-blue-100 text-blue-800',
    delivered: 'bg-green-100 text-green-800',
    cancelled: 'bg-red-100 text-red-800',
  };

  const riceTypeLabels = {
    white_rice: 'ข้าวขาว',
    brown_rice: 'ข้าวกล้อง',
    sticky_rice: 'ข้าวเหนียว',
  };

  async function loadHistory() {
    const tbody = document.getElementById('history-rows');
    const emptyMsg = document.getElementById('history-empty');
    if (!tbody) return;

    try {
      // Fetch delivered and cancelled milling requests only
      const respCompleted = await fetch('/api/milling-requests/my-requests?limit=100&offset=0&status=delivered');
      const jsonCompleted = await respCompleted.json().catch(() => ({ data: [] }));

      const respCancelled = await fetch('/api/milling-requests/my-requests?limit=100&offset=0&status=cancelled');
      const jsonCancelled = await respCancelled.json().catch(() => ({ data: [] }));

      const data = [...(jsonCompleted.data || []), ...(jsonCancelled.data || [])];
      if (!data || data.length === 0) {
        emptyMsg && emptyMsg.classList.remove('hidden');
        return;
      }

      // sort by created_at desc
      data.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

      tbody.innerHTML = data
        .map((r, i) => {
          const mill = r.mill_name_th || r.mill_name || '-';
          const status = r.status || 'pending_review';
          const statusClass = millingStatusColors[status] || 'bg-gray-100 text-gray-800';
          const statusText = millingStatusLabels[status] || status;
          const dropoff = r.dropoff_date ? new Date(r.dropoff_date).toLocaleDateString('th-TH') : '-';

          return `<tr class="hover:bg-slate-50">
            <td class="border border-slate-300 px-3 py-2 text-center">${i + 1}</td>
            <td class="border border-slate-300 px-3 py-2">${escapeHtml(mill)}</td>
            <td class="border border-slate-300 px-3 py-2">${escapeHtml(riceTypeLabels[r.rice_type] || r.rice_type || '-')}</td>
            <td class="border border-slate-300 px-3 py-2 text-center">${r.sacks ?? '-'}</td>
            <td class="border border-slate-300 px-3 py-2">${dropoff}</td>
            <td class="border border-slate-300 px-3 py-2">
              <span class="inline-block rounded px-2 py-0.5 text-xs font-medium ${statusClass}">${statusText}</span>
            </td>
          </tr>`;
        })
        .join('');
    } catch (err) {
      console.error('load history error', err);
      emptyMsg && emptyMsg.classList.remove('hidden');
    }
  }

  function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  document.addEventListener('DOMContentLoaded', loadHistory);
})();
