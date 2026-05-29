/* Owner - Check Milling Requests (dynamic)
   Data source: /api/milling_requests
   Filter by mill and review_status=pending_review
*/

document.addEventListener('DOMContentLoaded', () => {
  const session = window.OwnerSession?.get?.();
  if (!session || !session.mill_id) {
    window.location.href = '/login.html';
    return;
  }

  const tableBody = document.getElementById('check-rows');
  const emptyState = document.getElementById('check-empty');

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

  // Format date
  const formatDate = (value) => {
    if (!value) return '-';
    try {
      return new Date(value).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
      return String(value);
    }
  };

  // Milling request process status label (ภาษาไทย)
  const statusLabel = (status) => {
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

  const reviewStatusLabel = (status) => {
    if (status === 'reviewed') return 'ตรวจสอบแล้ว';
    if (status === 'pending_review') return 'รอตรวจสอบ';
    return status || '-';
  };

  // Process status badge styling
  const statusClass = (status) => {
    if (status === 'cancelled') return 'border border-gray-300 bg-rice-50 text-red-700';
    if (status === 'delivered') return 'border border-green-200 bg-green-50 text-green-800';
    if (['shipping','packing','milling','queued','received','awaiting_pickup','accepted','pending_review'].includes(status)) return 'border border-blue-200 bg-blue-50 text-blue-800';
    return 'border border-amber-200 bg-amber-50 text-amber-800';
  };

  const reviewStatusClass = (status) => {
    if (status === 'reviewed') return 'border border-green-200 bg-green-50 text-green-800';
    if (status === 'pending_review') return 'border border-amber-200 bg-amber-50 text-amber-800';
    return 'border border-gray-300 bg-rice-50 text-slate-700';
  };

  const setLoadingRow = () => {
    if (!tableBody) return;
    tableBody.innerHTML = `
      <tr class="odd:bg-white even:bg-rice-50">
        <td class="border border-gray-300 px-3 py-3 text-center text-gray-500" colspan="8">กำลังโหลดข้อมูล...</td>
      </tr>
    `;
  };

  const updateRequest = async (id, payload) => {
    const resp = await fetch(`/api/milling-requests/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const json = await resp.json().catch(() => null);
    if (!resp.ok || !json || json.success !== true) {
      throw new Error(json?.message || 'อัปเดตไม่สำเร็จ');
    }

    return json;
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
      const processStatus = row.status || 'pending';
      const reviewStatus = row.review_status || 'pending_review';
      const statusBadge = `<span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs ${statusClass(processStatus)}">${esc(statusLabel(processStatus))}</span>`;
      const reviewBadge = `<span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs ${reviewStatusClass(reviewStatus)}">${esc(reviewStatusLabel(reviewStatus))}</span>`;

      html += `
        <tr class="odd:bg-white even:bg-rice-50">
          <td class="border border-gray-300 px-3 py-2">${idx + 1}</td>
          <td class="border border-gray-300 px-3 py-2 font-medium">${esc(String(row.request_id))}</td>
          <td class="border border-gray-300 px-3 py-2">${esc(row.phone)}</td>
          <td class="border border-gray-300 px-3 py-2">${esc(row.rice_type)}</td>
          <td class="border border-gray-300 px-3 py-2 text-center">${Number(row.sacks || 0)}</td>
          <td class="border border-gray-300 px-3 py-2">${statusBadge}</td>
          <td class="border border-gray-300 px-3 py-2">${reviewBadge}</td>
          <td class="border border-gray-300 px-3 py-2">
            <a href="/owner-check-detail.html?id=${row.request_id}" class="btn-secondary px-3 py-1 text-xs inline-flex">รายละเอียด</a>
          </td>
        </tr>
      `;
    });

    tableBody.innerHTML = html;
  };

  // Fetch milling requests from API
  const fetchRows = async () => {
    setLoadingRow();

    try {
      const resp = await fetch(`/api/milling-requests?mill_id=${encodeURIComponent(session.mill_id)}&limit=100&offset=0`);
      const json = await resp.json();

      if (!resp.ok || !json || json.success !== true) {
        throw new Error((json && json.message) || 'ไม่สามารถดึงข้อมูลได้');
      }

      renderRows(json.data);
    } catch (err) {
      console.error(err);

      if (tableBody) {
        tableBody.innerHTML = `
          <tr class="odd:bg-white even:bg-rice-50">
            <td class="border border-gray-300 px-3 py-3 text-center text-red-700" colspan="8">เกิดข้อผิดพลาดในการดึงข้อมูล</td>
          </tr>
        `;
      }
      toast('ดึงข้อมูลไม่สำเร็จ', 'error');
    }
  };

  // Initial load
  fetchRows();
  setInterval(fetchRows, 15000);
});
