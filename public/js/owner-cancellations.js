document.addEventListener('DOMContentLoaded', () => {
  const session = window.OwnerSession?.get?.();
  if (!session || !session.mill_id) {
    window.location.href = '/login.html';
    return;
  }

  const tableBody = document.getElementById('cancellation-rows');
  const emptyState = document.getElementById('cancellation-empty');

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

  const formatDate = (value) => {
    if (!value) return '-';
    try {
      return new Date(value).toLocaleString('th-TH', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch {
      return String(value);
    }
  };

  const typeLabel = (type) => type === 'order' ? 'คำสั่งซื้อสินค้า' : 'คำขอสีข้าว';

  const statusLabel = (status, type) => {
    if (status === 'cancelled') {
      return type === 'order' ? 'ยกเลิกคำสั่งซื้อสินค้าแล้ว' : 'ยกเลิกคำขอสีข้าวแล้ว';
    }
    if (status === 'pending_cancel') return type === 'order' ? 'รอยืนยันการยกเลิกคำสั่งซื้อ' : 'รอยืนยันการยกเลิกคำขอสีข้าว';
    if (status === 'approved_cancel') return type === 'order' ? 'ยกเลิกคำสั่งซื้อสินค้าแล้ว' : 'ยกเลิกคำขอสีข้าวแล้ว';
    if (status === 'rejected_cancel') return 'ปฏิเสธคำขอยกเลิก';
    return status || '-';
  };

  const statusClass = (status) => {
    if (status === 'approved_cancel' || status === 'cancelled') return 'border border-green-200 bg-green-50 text-green-800';
    if (status === 'rejected_cancel') return 'border border-red-200 bg-red-50 text-red-700';
    return 'border border-amber-200 bg-amber-50 text-amber-800';
  };

  const setLoadingRow = () => {
    if (!tableBody) return;
    tableBody.innerHTML = `
      <tr class="odd:bg-white even:bg-rice-50">
        <td class="border border-gray-300 px-3 py-3 text-center text-gray-500" colspan="7">กำลังโหลดข้อมูล...</td>
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
      const badge = `<span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs ${statusClass(row.cancellation_status)}">${esc(statusLabel(row.cancellation_status, row.type))}</span>`;
      const currentBadge = `<span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs ${statusClass(row.current_status)}">${esc(row.current_status_label || row.current_status || '-')}</span>`;
      const actionDisabled = row.cancellation_status !== 'pending_cancel';

      return `
        <tr class="odd:bg-white even:bg-rice-50">
          <td class="border border-gray-300 px-3 py-2">${idx + 1}</td>
          <td class="border border-gray-300 px-3 py-2 font-medium">${esc(row.resource_number || row.resource_id)}</td>
          <td class="border border-gray-300 px-3 py-2">${esc(row.customer_name)}</td>
          <td class="border border-gray-300 px-3 py-2">${esc(typeLabel(row.type))}</td>
          <td class="border border-gray-300 px-3 py-2">${esc(formatDate(row.cancellation_created_at))}</td>
          <td class="border border-gray-300 px-3 py-2">${currentBadge} <span class="ml-2">${badge}</span></td>
          <td class="border border-gray-300 px-3 py-2 text-right">
            <button type="button" data-action="accept-cancel" data-id="${row.cancellation_id}" class="btn-primary px-3 py-1 text-xs bg-red-600 hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed" ${actionDisabled ? 'disabled' : ''}>ยอมรับคำขอยกเลิก</button>
          </td>
        </tr>
      `;
    }).join('');
  };

  const fetchRows = async () => {
    setLoadingRow();

    try {
      const encoded = (typeof window.btoa === 'function')
        ? window.btoa(unescape(encodeURIComponent(JSON.stringify(session))))
        : encodeURIComponent(JSON.stringify(session));
      const resp = await fetch('/api/notifications/cancellations', {
        headers: { 'x-session-data': encoded }
      });
      const json = await resp.json();

      if (!resp.ok || !json || json.success !== true) {
        throw new Error(json?.message || 'ไม่สามารถดึงข้อมูลได้');
      }

      renderRows(Array.isArray(json.data) ? json.data : []);
    } catch (err) {
      console.error(err);
      if (tableBody) {
        tableBody.innerHTML = `
          <tr class="odd:bg-white even:bg-rice-50">
            <td class="border border-gray-300 px-3 py-3 text-center text-red-700" colspan="7">เกิดข้อผิดพลาดในการดึงข้อมูล</td>
          </tr>
        `;
      }
      toast('ดึงข้อมูลคำขอยกเลิกไม่สำเร็จ', 'error');
    }
  };

  const updateCancellation = async (id) => {
    const resp = await fetch(`/api/notifications/cancellations/${encodeURIComponent(id)}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-session-data': (typeof window.btoa === 'function')
          ? window.btoa(unescape(encodeURIComponent(JSON.stringify(session))))
          : encodeURIComponent(JSON.stringify(session))
      },
      body: JSON.stringify({ status: 'approved_cancel' })
    });
    const json = await resp.json().catch(() => null);
    if (!resp.ok || !json || json.success !== true) {
      throw new Error(json?.message || 'อนุมัติไม่สำเร็จ');
    }
    return json;
  };

  document.addEventListener('click', async (e) => {
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;

    const acceptBtn = target.closest('button[data-action="accept-cancel"]');
    if (!acceptBtn) return;

    const id = acceptBtn.getAttribute('data-id');
    if (!id) return;

    try {
      acceptBtn.setAttribute('disabled', 'true');
      await updateCancellation(id);
      window.dispatchEvent(new Event('notifications:changed'));
      toast('ยอมรับคำขอยกเลิกเรียบร้อยแล้ว', 'success');
      await fetchRows();
    } catch (err) {
      console.error(err);
      acceptBtn.removeAttribute('disabled');
      toast(err.message || 'อนุมัติไม่สำเร็จ', 'error');
    }
  });

  fetchRows();
  setInterval(fetchRows, 15000);
});