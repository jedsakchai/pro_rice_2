/* Public - Inquiry table with reply
   Data source: GET /api/inquiries
   Reply: POST /api/inquiries/:id/reply
*/

document.addEventListener('DOMContentLoaded', () => {
  const tableBody = document.getElementById('inquiry-table-rows');
  const emptyState = document.getElementById('inquiry-table-empty');
  const btnRefresh = document.getElementById('btn-refresh-inquiries');

  // ตรวจสอบ role ผู้ใช้: เจ้าของโรงสีจึงจะตอบ/แก้ไขได้
  const session = window.OwnerSession?.get?.();
  const isOwner = session && session.role === 'owner';

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

  const setLoadingRow = () => {
    if (!tableBody) return;
    tableBody.innerHTML = `
      <tr class="odd:bg-white even:bg-rice-50">
        <td class="border border-slate-300 px-3 py-3 text-center text-gray-500" colspan="4">กำลังโหลดข้อมูล...</td>
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
        const replied = (r.status === 'replied' || r.status === 'closed') && r.reply_message;

        // === ชาวบ้าน / ผู้ไม่ login: แสดงผลอย่างเดียว ===
        if (!isOwner) {
          const replyCell = replied
            ? `<span class="text-sm text-slate-800 whitespace-pre-wrap">${esc(r.reply_message)}</span>`
            : `<span class="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800">รอคำตอบ</span>`;

          return `
            <tr class="odd:bg-white even:bg-rice-50 align-top">
              <td class="border border-slate-300 px-3 py-2">${idx + 1}</td>
              <td class="border border-slate-300 px-3 py-2 whitespace-pre-wrap">${esc(subject)}</td>
              <td class="border border-slate-300 px-3 py-2 whitespace-pre-wrap">${esc(message)}</td>
              <td class="border border-slate-300 px-3 py-2">${replyCell}</td>
            </tr>
          `;
        }

        // === เจ้าของโรงสี: ตอบ/แก้ไขได้ ===
        const replyValue = replied ? r.reply_message : '';
        const disabled = replied ? 'disabled' : '';
        const btnLabel = 'บันทึกคำตอบ';
        const showEdit = replied;

        return `
          <tr class="odd:bg-white even:bg-rice-50 align-top" data-row-id="${esc(id)}" data-replied="${replied ? '1' : '0'}" data-editing="0">
            <td class="border border-slate-300 px-3 py-2">${idx + 1}</td>
            <td class="border border-slate-300 px-3 py-2 whitespace-pre-wrap">${esc(subject)}</td>
            <td class="border border-slate-300 px-3 py-2 whitespace-pre-wrap">${esc(message)}</td>
            <td class="border border-slate-300 px-3 py-2">
              <div class="space-y-2">
                <textarea
                  class="w-full min-w-[240px] rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rice-600"
                  rows="3"
                  placeholder="พิมพ์คำตอบ..."
                  data-reply-for="${esc(id)}"
                  ${disabled}
                >${esc(replyValue)}</textarea>

                <div class="flex flex-wrap gap-2">
                  <button
                    type="button"
                    class="btn-primary px-4 py-2 text-sm"
                    data-action="reply"
                    data-id="${esc(id)}"
                    ${disabled}
                  >${esc(btnLabel)}</button>

                  ${showEdit ? `
                    <button
                      type="button"
                      class="btn-secondary px-4 py-2 text-sm"
                      data-action="edit"
                      data-id="${esc(id)}"
                    >แก้ไข</button>
                  ` : ''}
                </div>

                ${replied ? `<div class="text-xs text-gray-600">สถานะ: ตอบแล้ว</div>` : ''}
              </div>
            </td>
          </tr>
        `;
      })
      .join('');
  };

  const fetchRows = async () => {
    setLoadingRow();

    try {
      const resp = await fetch('/api/inquiries?limit=50&offset=0');
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
            <td class="border border-slate-300 px-3 py-3 text-center text-red-700" colspan="4">เกิดข้อผิดพลาดในการดึงข้อมูล</td>
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

    const replyBtn = el.closest('button[data-action="reply"]');
    if (replyBtn) {
      const id = replyBtn.getAttribute('data-id');
      if (!id) return;

      const row = replyBtn.closest('tr[data-row-id]');
      const textarea = document.querySelector(`textarea[data-reply-for="${CSS.escape(id)}"]`);
      const message = (textarea && 'value' in textarea) ? String(textarea.value || '').trim() : '';

      if (!message) {
        toast('กรุณาพิมพ์ข้อความตอบกลับ', 'error');
        return;
      }

      try {
        replyBtn.setAttribute('disabled', 'true');
        if (textarea) textarea.setAttribute('disabled', 'true');

        await replyInquiry(id, message);
        toast('บันทึกคำตอบเรียบร้อย', 'success');

        if (row) row.setAttribute('data-editing', '0');
        await fetchRows();
      } catch (err) {
        console.error(err);
        replyBtn.removeAttribute('disabled');

        // If it was already replied and user is editing, keep textarea enabled.
        const replied = row && row.getAttribute('data-replied') === '1';
        const editing = row && row.getAttribute('data-editing') === '1';
        if (!replied || !editing) {
          if (textarea) textarea.removeAttribute('disabled');
        }

        toast(err.message || 'บันทึกคำตอบไม่สำเร็จ', 'error');
      }
      return;
    }

    const editBtn = el.closest('button[data-action="edit"]');
    if (editBtn) {
      const id = editBtn.getAttribute('data-id');
      if (!id) return;

      const row = editBtn.closest('tr[data-row-id]');
      const textarea = document.querySelector(`textarea[data-reply-for="${CSS.escape(id)}"]`);
      const saveBtn = row ? row.querySelector('button[data-action="reply"]') : null;

      if (row) row.setAttribute('data-editing', '1');
      if (textarea) {
        textarea.removeAttribute('disabled');
        textarea.focus();
      }
      if (saveBtn) saveBtn.removeAttribute('disabled');

      toast('แก้ไขคำตอบได้เลย แล้วกดบันทึก', 'success');
      return;
    }
  });

  if (btnRefresh) {
    btnRefresh.addEventListener('click', () => fetchRows());
  }

  // Refresh list after successful form submission
  window.addEventListener('inquiry:submitted', () => fetchRows());

  fetchRows();
});
