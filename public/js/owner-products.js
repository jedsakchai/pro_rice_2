// Owner products management
(function(){
  function getSession() {
    return window.OwnerSession?.get?.() || null;
  }

  async function fetchProducts() {
    const session = getSession();
    const millId = session?.mill_id || (new URLSearchParams(window.location.search)).get('mill_id');
    if (!millId) return document.getElementById('owner-products-list').innerHTML = '<div class="text-sm text-gray-600">ไม่พบโรงสี (ล็อกอินในฐานะเจ้าของ หรือระบุ ?mill_id=)</div>';

    let products = null;
    // If logged-in owner, use protected API. Otherwise fall back to public /api/products and filter by mill_id (read-only)
    if (session?.token) {
      const res = await fetch(`/api/owner/products?mill_id=${encodeURIComponent(millId)}`, {
        method: 'GET', headers: { 'Authorization': `Bearer ${session.token}` }
      });
      const json = await res.json().catch(()=>({success:false}));
      if (!json.success) return document.getElementById('owner-products-list').innerHTML = '<div class="text-sm text-red-600">ไม่สามารถโหลดสินค้าได้ (ต้องล็อกอิน)</div>';
      products = json.data;
    } else {
      // public fallback: get all products and filter by mill_id
      const res = await fetch('/api/products');
      const json = await res.json().catch(()=>({success:false}));
      if (!json.success) return document.getElementById('owner-products-list').innerHTML = '<div class="text-sm text-red-600">ไม่สามารถโหลดสินค้าได้</div>';
      products = (Array.isArray(json.data) ? json.data : []).filter(p => String(p.mill_id || '') === String(millId));
    }

    const list = document.getElementById('owner-products-list');
    if (!products || products.length === 0) {
      list.innerHTML = '<div class="text-sm text-red-600">ไม่มีสินค้าของโรงสีนี้</div>';
      return;
    }

    list.innerHTML = products.map(p => `
      <div class="bg-white p-3 rounded shadow flex items-center justify-between">
        <div class="flex items-center gap-3">
          <img src="${p.image_url || '/images/placeholder.jpg'}" alt="" class="w-16 h-16 object-cover rounded" onerror="this.src='/images/placeholder.jpg'">
          <div>
            <div class="font-semibold">${p.product_name_th}</div>
            <div class="text-sm text-gray-500">${p.category_th} • ฿${Number(p.price||0).toFixed(2)} • สต็อก ${p.stock}</div>
          </div>
        </div>
        <div>
          <button data-id="${p.product_id}" class="btn-secondary delete-btn" ${session?.token ? '' : 'disabled title="ล็อกอินเป็นเจ้าของเพื่อใช้งาน"'}>ลบ</button>
        </div>
      </div>
    `).join('');

    // wire delete buttons (only active when logged in)
    document.querySelectorAll('.delete-btn').forEach(btn => btn.addEventListener('click', async (e)=>{
      const id = btn.getAttribute('data-id');
      if (!confirm('ต้องการลบสินค้านี้หรือไม่ ?')) return;
      const session = getSession();
      if (!session?.token) return alert('ล็อกอินเป็นเจ้าของเพื่อการลบ');
      const res = await fetch(`/api/owner/products/${encodeURIComponent(id)}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${session.token}` } });
      const json = await res.json().catch(()=>({success:false}));
      if (json.success) fetchProducts(); else alert(json.message || 'ลบไม่สำเร็จ');
    }));
  }

  document.addEventListener('DOMContentLoaded', ()=>{
    const form = document.getElementById('add-product-form');
    const session = getSession();
    // If not logged in as owner, disable form and show helper note
    if (!session?.token) {
      // disable all inputs and submit
      form.querySelectorAll('input,button').forEach(el => { if (el.tagName.toLowerCase() === 'button') el.disabled = true; else el.readOnly = true; });
      const note = document.createElement('div');
      note.className = 'text-sm text-red-600 mt-2';
      note.textContent = 'ต้องล็อกอินเป็นเจ้าของโรงสีเพื่อเพิ่ม/ลบสินค้า — ใช้เมนูล็อกอินที่หน้าแดชบอร์ด';
      form.parentNode.insertBefore(note, form.nextSibling);
    }
    form.addEventListener('submit', async (e)=>{
      e.preventDefault();
      const fd = new FormData(form);
      const body = {};
      fd.forEach((v,k)=> body[k]=v);
      body.price = Number(body.price || 0);
      body.stock = Number(body.stock || 0);

      const session = getSession();
      body.mill_id = session?.mill_id || (new URLSearchParams(window.location.search)).get('mill_id');
      if (!body.mill_id) return alert('ไม่พบโรงสี (ล็อกอินเป็นเจ้าของ)');

      const res = await fetch('/api/owner/products', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': session?.token ? `Bearer ${session.token}` : '' }, body: JSON.stringify(body)});
      const json = await res.json().catch(()=>({success:false}));
      if (json.success) { form.reset(); fetchProducts(); } else { alert(json.message || 'เพิ่มสินค้าไม่สำเร็จ'); }
    });

    fetchProducts();
  });
})();
