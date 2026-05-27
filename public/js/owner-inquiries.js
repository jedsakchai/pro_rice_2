/* Owner - Inquiries (dynamic)
   Data source: /api/inquiries
*/

document.addEventListener('DOMContentLoaded', () => {
  const session = window.OwnerSession?.get?.();
  if (!session || !session.mill_id) {
    window.location.href = '/login.html';
    return;
  }

  const tableBody = document.getElementById('inquiry-rows');
  const emptyState = document.getElementById('inquiry-empty');

  const toast = (message, type = 'success') => {
    if (window.FormUtils && typeof window.FormUtils.showToast === 'function') {
      window.FormUtils.showToast(message, type);
      return;
    }
    alert(message);
  };

  const esc = (value) => {
    const str = String(value ?? '');
    return str
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  };

  const formatDateTime = (dateStr) => {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      return d.toLocaleString('th-TH', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return String(dateStr);
    }
  };

  const statusLabel = (status) => {
    switch (status) {
      case 'new':
        return 'ใหม่';
      case 'read':
        return 'อ่านแล้ว';
      case 'replied':
        return 'ตอบแล้ว';
      case 'closed':
        return 'ปิดแล้ว';
      default:
        return status || '-';
    }
  };

  const badgeClass = (status) => {
    if (status === 'replied') {
      return 'border border-green-200 bg-green-50 text-green-800';
    }
    if (status === 'new') {
      return 'border border-rice-700 bg-grain-100 text-grain-600';
    }
    if (status === 'closed') {
      return 'border border-gray-300 bg-rice-50 text-slate-700';
    }
    // read / unknown
    return 'border border-gray-300 bg-rice-50 text-rice-700';
  };

  const setLoadingRow = () => {
    if (!tableBody) return;
    tableBody.innerHTML = `
      <tr class="odd:bg-white even:bg-rice-50">
        <td class="border border-slate-300 px-3 py-3 text-center text-gray-500" colspan="9">กำลังโหลดข้อมูล...</td>
      </tr>
    `;
  };

  const renderRows = (rows) => {
    if (!tableBody) return;

    if (!rows || rows.length === 0) {
      tableBody.innerHTML = '';
      if (emptyState) emptyState.classList.remove('hidden');
      return;
    }

    if (emptyState) emptyState.classList.add('hidden');

    tableBody.innerHTML = rows
      .map((r, idx) => {
        const id = r.inquiry_id;
        const subject = r.subject || '-';
        const message = r.message || '-';
        const customerName = r.customer_name || '-';
        const phone = r.phone || '-';
        const status = r.status || 'new';
        const createdAt = formatDateTime(r.created_at);
        const replied = (status === 'replied' || status === 'closed') && r.reply_message;
        const replyValue = replied ? r.reply_message : '';
        const disabled = replied ? 'disabled' : '';

        return `
          <tr class="odd:bg-white even:bg-rice-50 align-top" data-row-id="${esc(id)}" data-replied="${replied ? '1' : '0'}" data-editing="0">
            <td class="border border-slate-300 px-3 py-2">${idx + 1}</td>
            <td class="border border-slate-300 px-3 py-2">${esc(subject)}</td>
            <td class="border border-slate-300 px-3 py-2">${esc(message)}</td>
            <td class="border border-slate-300 px-3 py-2">${esc(customerName)}</td>
            <td class="border border-slate-300 px-3 py-2">${esc(phone)}</td>
            <td class="border border-slate-300 px-3 py-2">
              <span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs ${badgeClass(status)}">${esc(statusLabel(status))}</span>
            </td>
            <td class="border border-slate-300 px-3 py-2">${esc(createdAt)}</td>
            <td class="border border-slate-300 px-3 py-2">
              <div class="space-y-2">
                <textarea
                  class="w-full min-w-[200px] rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rice-600"
                  rows="3"
                  placeholder="พิมพ์คำตอบ..."
                  data-reply-for="${esc(id)}"
                  ${disabled}
                >${esc(replyValue)}</textarea>
                <div class="flex flex-wrap gap-2">
                  <button type="button" class="btn-primary px-4 py-1.5 text-xs" data-action="reply" data-id="${esc(id)}" ${disabled}>บันทึกคำตอบ</button>
                  ${replied ? `<button type="button" class="btn-secondary px-4 py-1.5 text-xs" data-action="edit" data-id="${esc(id)}">แก้ไข</button>` : ''}
                </div>
              </div>
            </td>
            <td class="border border-slate-300 px-3 py-2">
              <button type="button" class="btn-secondary px-4 py-1.5 text-xs text-red-700" data-action="delete" data-id="${esc(id)}">ลบ</button>
            </td>
          </tr>
        `;
      })
      .join('');
  };

  const deleteInquiry = async (id) => {
    const resp = await fetch(`/api/inquiries/${encodeURIComponent(id)}`,
      {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      }
    );

    const json = await resp.json().catch(() => null);
    if (!resp.ok || !json || json.success !== true) {
      throw new Error((json && json.message) || 'ลบไม่สำเร็จ');
    }

    return json;
  };

  const fetchRows = async () => {
    setLoadingRow();

    try {
      const resp = await fetch('/api/inquiries?limit=100&offset=0');
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
            <td class="border border-slate-300 px-3 py-3 text-center text-red-700" colspan="9">เกิดข้อผิดพลาดในการดึงข้อมูล</td>
          </tr>
        `;
      }
      if (emptyState) emptyState.classList.add('hidden');
      toast('ดึงข้อมูลไม่สำเร็จ', 'error');
    }
  };

  const replyInquiry = async (id, replyMessage) => {
    const resp = await fetch(`/api/inquiries/${encodeURIComponent(id)}/reply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reply_message: replyMessage }),
    });

    const json = await resp.json().catch(() => null);
    if (!resp.ok || !json || json.success !== true) {
      throw new Error((json && json.message) || 'บันทึกคำตอบไม่สำเร็จ');
    }

    return json;
  };

  document.addEventListener('click', async (e) => {
    const el = e.target;
    if (!(el instanceof HTMLElement)) return;

    // --- Reply button ---
    const replyBtn = el.closest('button[data-action="reply"]');
    if (replyBtn) {
      const id = replyBtn.getAttribute('data-id');
      if (!id) return;

      const textarea = document.querySelector(`textarea[data-reply-for="${CSS.escape(id)}"]`);
      const message = (textarea && 'value' in textarea) ? String(textarea.value || '').trim() : '';

      if (!message) {
        toast('กรุณาพิมพ์ข้อความตอบกลับ', 'error');
        return;
      }

      try {
        replyBtn.setAttribute('disabled', 'true');
        await replyInquiry(id, message);
        toast('บันทึกคำตอบเรียบร้อย', 'success');
        await fetchRows();
      } catch (err) {
        console.error(err);
        replyBtn.removeAttribute('disabled');
        toast(err.message || 'บันทึกคำตอบไม่สำเร็จ', 'error');
      }
      return;
    }

    // --- Edit button ---
    const editBtn = el.closest('button[data-action="edit"]');
    if (editBtn) {
      const id = editBtn.getAttribute('data-id');
      if (!id) return;

      const row = editBtn.closest('tr[data-row-id]');
      const textarea = document.querySelector(`textarea[data-reply-for="${CSS.escape(id)}"]`);
      const saveBtn = row?.querySelector('button[data-action="reply"]');

      if (textarea) textarea.removeAttribute('disabled');
      if (saveBtn) saveBtn.removeAttribute('disabled');
      if (textarea) textarea.focus();
      editBtn.remove();
      return;
    }

    // --- Delete button ---
    const btn = el.closest('button[data-action="delete"]');
    if (!btn) return;

    const id = btn.getAttribute('data-id');
    if (!id) return;

    const ok = confirm('ยืนยันการลบโพสต์คำถามนี้? (ลบแล้วไม่สามารถกู้คืนได้)');
    if (!ok) return;

    try {
      btn.setAttribute('disabled', 'true');
      await deleteInquiry(id);
      toast('ลบโพสต์เรียบร้อย', 'success');
      await fetchRows();
    } catch (err) {
      console.error(err);
      btn.removeAttribute('disabled');
      toast(err.message || 'ลบไม่สำเร็จ', 'error');
    }
  });

  fetchRows();
});
