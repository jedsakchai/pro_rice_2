// Public page: Notifications
document.addEventListener('DOMContentLoaded', async () => {
    // Auto-redirect if not logged in or is owner
    const session = window.OwnerSession?.get?.();
    if (!session) {
        window.location.href = '/login.html';
        return;
    }
    if (session.role === 'owner') {
        window.location.href = '/owner-dashboard.html';
        return;
    }

    // Load notifications on page load
    await loadNotifications();
    
    // Reload notifications when mark-read event occurs
    window.addEventListener('notifications:changed', loadNotifications);
});

async function loadNotifications() {
    try {
        const session = window.OwnerSession?.get?.();
        const encoded = (typeof window.btoa === 'function')
            ? window.btoa(unescape(encodeURIComponent(JSON.stringify(session))))
            : encodeURIComponent(JSON.stringify(session));
        const resp = await fetch('/api/notifications/items', {
            headers: {
                'x-session-data': encoded
            }
        });
        const json = await resp.json();
        if (json.success && json.data) {
            initNotificationUI(json.data);
        } else {
            showNoNotifications();
        }
    } catch (err) {
        console.error('Failed to load notifications:', err);
        showNoNotifications();
    }
}

function getStatusDisplay(type, status) {
    const orderStatusMap = {
        'pending': { th: 'รอดำเนินการ', color: 'gray' },
        'accepted': { th: 'ยอมรับคำสั่งซื้อแล้ว', color: 'blue' },
        'pending_payment': { th: 'รอชำระเงิน', color: 'yellow' },
        'payment_review': { th: 'รอตรวจสอบการชำระเงิน', color: 'orange' },
        'paid': { th: 'ชำระเงินแล้ว', color: 'blue' },
        'preparing': { th: 'กำลังเตรียมสินค้า', color: 'blue' },
        'ready_to_ship': { th: 'พร้อมจัดส่ง', color: 'blue' },
        'shipping': { th: 'จัดส่งแล้ว', color: 'green' },
        'completed': { th: 'สำเร็จ', color: 'green' },
        'cancelled': { th: 'ยกเลิก', color: 'gray' }
    };

    const millingStatusMap = {
        'pending_review': { th: 'รอตรวจสอบ', color: 'yellow' },
        'accepted': { th: 'รับคำสั่งแล้ว', color: 'blue' },
        'awaiting_pickup': { th: 'รอไปรับข้าว', color: 'blue' },
        'received': { th: 'รับข้าวแล้ว', color: 'blue' },
        'queued': { th: 'รอคิวสี', color: 'blue' },
        'milling': { th: 'กำลังสีข้าว', color: 'blue' },
        'packing': { th: 'กำลังแพ็ก', color: 'blue' },
        'ready': { th: 'พร้อมรับ/จัดส่ง', color: 'blue' },
        'shipping': { th: 'กำลังจัดส่ง', color: 'blue' },
        'delivered': { th: 'ส่งมอบแล้ว', color: 'green' },
        'cancelled': { th: 'ยกเลิก', color: 'gray' }
    };

    const statusMap = type === 'order' ? orderStatusMap : millingStatusMap;
    return statusMap[status] || statusMap[String(status || '').trim()] || { th: status, color: 'gray' };
}

function getColorClass(color) {
    const colorMap = {
        'yellow': 'bg-yellow-100 text-yellow-800 border-yellow-300',
        'orange': 'bg-orange-100 text-orange-800 border-orange-300',
        'blue': 'bg-blue-100 text-blue-800 border-blue-300',
        'green': 'bg-green-100 text-green-800 border-green-300',
        'gray': 'bg-gray-100 text-gray-800 border-gray-300'
    };
    return colorMap[color] || colorMap.gray;
}

function formatDate(dateString) {
    const date = new Date(dateString);
    const options = { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    return date.toLocaleDateString('th-TH', options);
}

function formatShortDate(dateString) {
    const date = new Date(dateString);
    const options = { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    return date.toLocaleDateString('th-TH', options);
}

function displayNotifications(items) {
    // legacy; not used directly anymore
    document.getElementById('notification-list').innerHTML = '<div class="text-center text-gray-600 py-12">ไม่มีการแจ้งเตือน</div>';
}

// New UI helpers
let ALL_NOTIFS = [];

function initNotificationUI(items) {
    // Normalize shapes: if items are from notifications table or fallback they should have resource_id
    ALL_NOTIFS = items.map((it) => {
        // Always trust resource_id from API (either persistent notifications table or derived/fallback)
        if (it.type === 'order') {
            return { 
                id: it.id || it.notification_id, 
                type: 'order', 
                resource_id: it.resource_id, 
                status: it.status, 
                message: it.message || `คำสั่งซื้อ #${it.resource_id}`, 
                is_read: !!it.is_read, 
                created_at: it.created_at, 
                total: it.total 
            };
        }
        return { 
            id: it.id || it.notification_id, 
            type: 'milling', 
            resource_id: it.resource_id, 
            status: it.status, 
            message: it.message || `คำขอสีข้าว #${it.resource_id}`, 
            is_read: !!it.is_read, 
            created_at: it.created_at, 
            sacks: it.sacks 
        };
    });

    renderNotifications();
    attachUIHandlers();
}

function renderNotifications(filterTab = 'all', typeFilter = 'all') {
    const list = document.getElementById('notification-list');
    let items = ALL_NOTIFS.filter((n) => {
        if (typeFilter !== 'all' && n.type !== typeFilter) return false;
        if (filterTab === 'all') return true;
        if (filterTab === 'check') return ['pending','pending_payment','payment_review','pending_review'].includes(n.status);
        if (filterTab === 'in_progress') return ['accepted','paid','preparing','ready_to_ship','awaiting_pickup','received','queued','milling','packing','ready'].includes(n.status);
        if (filterTab === 'shipping') return ['shipping'].includes(n.status);
        return true;
    });

    // Sort: unread first, then by created_at desc
    items = items.sort((a, b) => {
        const aRead = a.is_read ? 1 : 0;
        const bRead = b.is_read ? 1 : 0;
        if (aRead !== bRead) return aRead - bRead; // unread (0) first
        return new Date(b.created_at) - new Date(a.created_at);
    });

    // Update counts (show unread counts per category)
    const unreadAll = ALL_NOTIFS.filter(n => !n.is_read).length;
    const unreadCheck = ALL_NOTIFS.filter(n => !n.is_read && ['pending','pending_payment','payment_review','pending_review'].includes(n.status)).length;
    const unreadInProgress = ALL_NOTIFS.filter(n => !n.is_read && ['accepted','paid','preparing','ready_to_ship','awaiting_pickup','received','queued','milling','packing','ready'].includes(n.status)).length;
    const unreadShipping = ALL_NOTIFS.filter(n => !n.is_read && ['shipping'].includes(n.status)).length;

    document.getElementById('count-all').textContent = unreadAll;
    document.getElementById('count-check').textContent = unreadCheck;
    document.getElementById('count-in_progress').textContent = unreadInProgress;
    document.getElementById('count-shipping').textContent = unreadShipping;

    if (items.length === 0) {
        list.innerHTML = '<div class="text-center text-gray-600 py-12">ไม่มีการแจ้งเตือนที่ตรงกับตัวกรอง</div>';
        return;
    }

    const html = items.map((item) => {
        const statusInfo = getStatusDisplay(item.type, item.status);
        const colorClass = getColorClass(statusInfo.color);
        const date = formatDate(item.created_at);
        const unreadDot = item.is_read ? '' : '<span class="inline-block w-3 h-3 bg-rice-700 rounded-full mr-3"></span>';

        const label = 'สถานะการคำขอสีข้าว/คำสั่งซื้อ:';
        const note = 'คลิกเพื่อดูรายละเอียด';
        const statusLabel = statusInfo.th;

        // link target
        const href = item.type === 'order' ? `/order-status.html?order_id=${encodeURIComponent(item.resource_id)}` : `/milling-status.html?request_id=${encodeURIComponent(item.resource_id)}`;
        
        // Use notification_id or create pseudo-id from type/resource_id for fallback data
        const notifId = item.id || item.notification_id || `${item.type}-${item.resource_id}`;

                // apply visual hint for read items
                const readClass = item.is_read ? 'opacity-60' : '';

                return `
                    <a href="${href}" data-notif-id="${notifId}" class="block ${readClass}">
                        <div class="notif-item hover:shadow-md ${item.is_read ? 'bg-gray-50' : ''}">
                            <div class="flex-shrink-0 mt-1">
                                <div class="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-xl">${item.type === 'order' ? '📦' : '🌾'}</div>
                            </div>
                            <div class="notif-item-main w-full">
                                <div class="notif-item-head">
                                    <div class="flex items-start gap-2">
                                        ${unreadDot}
                                        <div class="space-y-1">
                                            <h3 class="notif-title text-base font-semibold text-gray-800">${label}</h3>
                                            <div class="text-base font-semibold ${colorClass} inline-flex items-center rounded-full border px-3 py-1">${statusLabel}</div>
                                            <p class="notif-detail text-sm text-gray-500">หมายเหตุ: ${note}</p>
                                            <div class="notif-date text-sm text-gray-400">${formatShortDate(item.created_at)}</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                                <div class="ml-4 flex items-center gap-2">
                                    ${renderCancelButtonIfAllowed(item)}
                                </div>
                            </div>
                        </a>
                `;
    }).join('\n');

    list.innerHTML = html;

    // After rendering, attach click handlers to mark as read when clicked
    document.querySelectorAll('#notification-list a').forEach((el) => {
        el.addEventListener('click', async (ev) => {
            ev.preventDefault();
            const nid = el.getAttribute('data-notif-id');
            const href = el.getAttribute('href');
            if (nid) {
                // mark read on server
                try {
                    const enc = (typeof window.btoa === 'function')
                        ? window.btoa(unescape(encodeURIComponent(JSON.stringify(window.OwnerSession?.get?.() || {}))))
                        : encodeURIComponent(JSON.stringify(window.OwnerSession?.get?.() || {}));
                    const resp = await fetch(`/api/notifications/${encodeURIComponent(nid)}/read`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'x-session-data': enc }
                    });
                    if (resp.ok) {
                        window.dispatchEvent(new Event('notifications:changed'));
                    }
                } catch (e) {
                    console.error('mark read failed', e);
                }
            }
            // Navigate after mark-read (dispatch happens in parallel, navigate immediately)
            if (href) window.location.href = href;
        });
    });
}

function isCancelableByVillager(item) {
    if (!item || !item.status) return false;
    if (item.type === 'order') {
        const ok = new Set(['pending','accepted','pending_payment','payment_review','paid','preparing']);
        return ok.has(String(item.status));
    }
    if (item.type === 'milling') {
        const ok = new Set(['pending_review','accepted','awaiting_pickup']);
        return ok.has(String(item.status));
    }
    return false;
}

function renderCancelButtonIfAllowed(item) {
    if (!isCancelableByVillager(item)) return '';
    return `<button data-cancel-type="${item.type}" data-cancel-resource="${item.resource_id}" class="cancel-action-btn px-3 py-1.5 bg-red-50 text-red-700 rounded border border-red-100 text-sm">ยกเลิก</button>`;
}

// Cancel modal behavior
const DEFAULT_CANCEL_CHOICES = ['เปลี่ยนใจ', 'พบราคาถูกกว่า', 'ต้องการแก้ไขข้อมูล/ที่อยู่', 'โรงสียังไม่สะดวก', 'อื่นๆ'];

function openCancelModal(type, resourceId) {
    const modal = document.getElementById('cancel-modal');
    const choicesWrap = document.getElementById('cancel-choices');
    const note = document.getElementById('cancel-note');
    if (!modal || !choicesWrap || !note) return;
    modal.dataset.type = type;
    modal.dataset.resourceId = String(resourceId);
    choicesWrap.innerHTML = '';
    DEFAULT_CANCEL_CHOICES.forEach((c, idx) => {
        const id = `cancel-choice-${idx}`;
        const div = document.createElement('div');
        div.innerHTML = `<label class="inline-flex items-center gap-2"><input type="checkbox" id="${id}" value="${c}" class="form-checkbox"> <span class="text-sm">${c}</span></label>`;
        choicesWrap.appendChild(div);
    });
    note.value = '';
    modal.classList.remove('hidden');
}

function closeCancelModal() {
    const modal = document.getElementById('cancel-modal');
    if (!modal) return;
    modal.classList.add('hidden');
    delete modal.dataset.type;
    delete modal.dataset.resourceId;
}

document.addEventListener('click', (e) => {
    const btn = e.target.closest && e.target.closest('.cancel-action-btn');
    if (btn) {
        e.preventDefault();
        const type = btn.getAttribute('data-cancel-type');
        const rid = btn.getAttribute('data-cancel-resource');
        openCancelModal(type, rid);
    }
});

document.addEventListener('DOMContentLoaded', () => {
    // modal cancel/submit handlers
    const modal = document.getElementById('cancel-modal');
    if (!modal) return;
    const cancelBtn = document.getElementById('cancel-cancel-btn');
    cancelBtn?.addEventListener('click', (e) => { e.preventDefault(); closeCancelModal(); });

    const form = document.getElementById('cancel-form');
    form?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const type = modal.dataset.type;
        const resourceId = modal.dataset.resourceId;
        const choices = Array.from(document.querySelectorAll('#cancel-choices input[type=checkbox]:checked')).map(i => i.value);
        const note = document.getElementById('cancel-note')?.value || '';

        try {
            const session = window.OwnerSession?.get?.() || {};
            const enc = (typeof window.btoa === 'function')
                ? window.btoa(unescape(encodeURIComponent(JSON.stringify(session))))
                : encodeURIComponent(JSON.stringify(session));

            const resp = await fetch(`/api/notifications/${encodeURIComponent(type)}/${encodeURIComponent(resourceId)}/cancel`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-session-data': enc },
                body: JSON.stringify({ choices, note })
            });
            const j = await resp.json();
            if (j && j.success) {
                window.dispatchEvent(new Event('notifications:changed'));
                closeCancelModal();
                // refresh list
                await loadNotifications();
                window.FormUtils.showToast('ยกเลิกเรียบร้อย', 'success');
            } else {
                window.FormUtils.showToast(j && j.message ? j.message : 'ไม่สามารถยกเลิกได้', 'error');
            }
        } catch (err) {
            console.error('cancel failed', err);
            window.FormUtils.showToast('เกิดข้อผิดพลาดขณะยกเลิก', 'error');
        }
    });
});

function attachUIHandlers() {
    // Tabs
    document.querySelectorAll('#notif-tabs .tab-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('#notif-tabs .tab-btn').forEach(b => b.classList.remove('bg-field-700','text-white'));
            btn.classList.add('bg-field-700','text-white');
            const tab = btn.getAttribute('data-tab');
            const typeFilter = document.getElementById('status-filter').value;
            renderNotifications(tab, typeFilter);
        });
    });

    // Filter
    document.getElementById('status-filter').addEventListener('change', (e) => {
        const tab = document.querySelector('#notif-tabs .tab-btn.bg-field-700')?.getAttribute('data-tab') || 'all';
        renderNotifications(tab, e.target.value);
    });

    // Mark all read
    document.getElementById('mark-all-read').addEventListener('click', async () => {
        try {
            const encAll = (typeof window.btoa === 'function')
                ? window.btoa(unescape(encodeURIComponent(JSON.stringify(window.OwnerSession?.get?.() || {}))))
                : encodeURIComponent(JSON.stringify(window.OwnerSession?.get?.() || {}));
            const resp = await fetch('/api/notifications/mark-all-read', { method: 'POST', headers: { 'x-session-data': encAll } });
            if (resp.ok) {
                window.dispatchEvent(new Event('notifications:changed'));
            }
            // locally mark
            ALL_NOTIFS = ALL_NOTIFS.map(n => ({ ...n, is_read: true }));
            const tab = document.querySelector('#notif-tabs .tab-btn.bg-field-700')?.getAttribute('data-tab') || 'all';
            const typeFilter = document.getElementById('status-filter').value;
            renderNotifications(tab, typeFilter);
        } catch (e) {
            console.error('mark all read failed', e);
        }
    });

    // initialize active tab
    const firstTab = document.querySelector('#notif-tabs .tab-btn[data-tab="all"]');
    if (firstTab) firstTab.click();
}

function showNoNotifications() {
    const container = document.getElementById('notification-list');
    container.innerHTML = `
        <div class="bg-white rounded-lg shadow p-12 text-center">
            <div class="text-5xl mb-4">✅</div>
            <p class="text-xl text-gray-700 mb-2">ไม่มีการแจ้งเตือนใหม่</p>
            <p class="text-gray-500 mb-6">ยังไม่มีรายการแจ้งเตือนใหม่</p>
            <a href="/my-history-combined.html" class="inline-block px-6 py-2 bg-rice-700 text-white rounded-lg hover:bg-rice-800 transition">
                ดูประวัติ →
            </a>
        </div>
    `;
}
