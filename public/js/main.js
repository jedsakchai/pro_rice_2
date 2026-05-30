// Main JavaScript for all pages

// เติม query string ของโรงสี (mill_id/mill_name) ลงในลิงก์ไปหน้า milling.html
// ใช้ตอนผู้ใช้กดปุ่ม “สีข้าว” จากการ์ดโรงสี เพื่อให้หน้าแบบฟอร์มรู้ว่าเลือกโรงสีไหน
function applyMillParamsToLink(link) {
    if (!(link instanceof HTMLAnchorElement)) return;

    const millName = link.getAttribute('data-mill-name');
    const millId = link.getAttribute('data-mill-id');
    const rawHref = link.getAttribute('href');

    if (!rawHref || !millName) return;
    if (!rawHref.includes('milling.html')) return;

    try {
        const url = new URL(rawHref, window.location.origin);
        // mill_id เป็น optional (บางลิงก์อาจมีแค่ชื่อ)
        if (millId) url.searchParams.set('mill_id', millId);
        url.searchParams.set('mill_name', millName);
        // เขียนกลับเป็น path+query เพื่อให้ลิงก์เป็นแบบ relative
        link.setAttribute('href', url.pathname + url.search + url.hash);
    } catch {
        // ignore malformed href
    }
}

// เขียนพารามิเตอร์โรงสีให้ทุกลิงก์ที่มี data-mill-name (มักอยู่ที่หน้า index)
function rewriteAllMillLinks() {
    const millLinks = document.querySelectorAll('a[data-mill-name]');
    millLinks.forEach(applyMillParamsToLink);
}

// ดักคลิกแบบ capture เพื่อ “ประกัน” ว่าทันก่อน browser จะนำทาง
// แก้เคสผู้ใช้คลิกเร็วมาก ๆ ก่อน DOMContentLoaded ทำงาน
document.addEventListener('click', (e) => {
    const el = e.target;
    if (!(el instanceof Element)) return;

    const link = el.closest('a[data-mill-name]');
    if (!(link instanceof HTMLAnchorElement)) return;
    applyMillParamsToLink(link);
}, true);

// ทำอีกรอบตอนโหลดสคริปต์ (best-effort) เพื่อให้ href ถูกตั้งค่าไว้ก่อน
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => rewriteAllMillLinks());
} else {
    rewriteAllMillLinks();
}

// เมนูมือถือ: เปิด/ปิด และปิดอัตโนมัติเมื่อคลิกลิงก์ในเมนู
document.addEventListener('DOMContentLoaded', () => {
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const mobileMenu = document.getElementById('mobile-menu');

    if (mobileMenuBtn && mobileMenu) {
        mobileMenuBtn.addEventListener('click', () => {
            const isOpen = mobileMenu.classList.contains('hidden');
            if (isOpen) {
                mobileMenu.classList.remove('hidden');
                mobileMenuBtn.setAttribute('aria-expanded', 'true');
            } else {
                mobileMenu.classList.add('hidden');
                mobileMenuBtn.setAttribute('aria-expanded', 'false');
            }
        });

        // Close menu when a link is clicked
        const links = mobileMenu.querySelectorAll('a');
        links.forEach(link => {
            link.addEventListener('click', () => {
                mobileMenu.classList.add('hidden');
                mobileMenuBtn.setAttribute('aria-expanded', 'false');
            });
        });
    }

    // === Dynamic Navbar: ปรับเมนูตาม role / login status ===
    (function updateNavbar() {
        const session = window.OwnerSession?.get?.();
        // target both desktop (ul.hidden.md\\:flex) and mobile menus
        const desktopUl = document.querySelector('header nav > ul');
        const mobileUl = document.querySelector('#mobile-menu > ul');
        if (!desktopUl && !mobileUl) return;

        function buildItems(isMobile) {
            const cls = isMobile ? 'block py-2' : '';
            const hoverCls = 'text-gray-700 hover:text-rice-700';
            const linkClass = isMobile ? `${cls} ${hoverCls}` : hoverCls;

            const items = [];

            if (session && session.role === 'owner') {
                // Owner: แดชบอร์ด + ออกจากระบบ
                items.push(`<li><a href="/owner-dashboard.html" class="${linkClass}">แดชบอร์ด</a></li>`);
                items.push(`<li><a href="#" class="${linkClass}" data-action="logout">ออกจากระบบ</a></li>`);
            } else if (session) {
                // Villager: ประวัติสีข้าว + ชื่อผู้ใช้ + ออกจากระบบ
                items.push(`<li><a href="/my-history-combined.html" class="${linkClass}">ประวัติ</a></li>`);
                const name = session.owner_name || session.mill_name || 'ผู้ใช้';
                items.push(`<li><span class="${isMobile ? cls : ''} text-rice-700 font-semibold cursor-default">${name}</span></li>`);
                items.push(`<li><a href="#" class="${linkClass}" data-action="logout">ออกจากระบบ</a></li>`);
            } else {
                // ไม่ login
                items.push(`<li><a href="/login.html" class="${linkClass}">เข้าสู่ระบบ</a></li>`);
            }

            return items.join('');
        }

        function rewriteMenu(ul, isMobile) {
            if (!ul) return;
            // เก็บ 3 ลิงก์แรก (หน้าแรก, สอบถาม, ติดต่อ) — ลบรายการที่เหลือ
            const lis = Array.from(ul.querySelectorAll('li'));
            // Remove all items after the first 3 (หน้าแรก, สอบถาม, ติดต่อ)
            for (let i = 3; i < lis.length; i++) lis[i].remove();
            
            // เพิ่มไอคอนกระดิ่งแจ้งเตือนสำหรับ villager (login แล้ว)
            let notificationBellHtml = '';
            if (session && session.role !== 'owner' && !isMobile) {
                notificationBellHtml = `<li id="notification-bell-item" class="flex items-center">
                    <a href="/notifications.html" class="inline-flex items-center gap-1.5" title="แจ้งเตือน">
                        <svg class="w-6 h-6 text-rice-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path>
                        </svg>
                        <span id="notification-badge" class="notification-badge inline-flex items-center justify-center text-xs font-bold leading-none text-red-600 hidden">0</span>
                    </a>
                </li>`;
            }
            
            // Append notification bell + role-based items
            ul.insertAdjacentHTML('beforeend', notificationBellHtml + buildItems(isMobile));
            // Bind logout
            ul.querySelectorAll('[data-action="logout"]').forEach(el => {
                el.addEventListener('click', (e) => {
                    e.preventDefault();
                    window.OwnerSession?.clear?.();
                    window.location.href = '/';
                });
            });
        }

        rewriteMenu(desktopUl, false);
        rewriteMenu(mobileUl, true);

        // Mobile-only notification bell: show before the hamburger so unread count is visible immediately
        if (session && session.role !== 'owner' && mobileMenuBtn && mobileMenuBtn.parentElement) {
            const existingMobileBell = document.getElementById('notification-bell-mobile');
            if (!existingMobileBell) {
                const mobileBell = document.createElement('a');
                mobileBell.id = 'notification-bell-mobile';
                mobileBell.href = '/notifications.html';
                mobileBell.title = 'แจ้งเตือน';
                mobileBell.className = 'md:hidden ml-auto mr-1 inline-flex h-10 items-center justify-center gap-1 rounded-lg bg-white/80 px-3 shadow-sm border border-gray-200';
                mobileBell.innerHTML = `
                    <svg class="w-5 h-5 text-rice-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path>
                    </svg>
                    <span id="notification-badge-mobile" class="notification-badge inline-flex items-center justify-center text-xs font-bold leading-none text-red-600 hidden">0</span>
                `;
                mobileMenuBtn.parentElement.insertBefore(mobileBell, mobileMenuBtn);
            }
        }
        
        // Fetch notification count and update badge
        if (session && session.role !== 'owner') {
            async function updateNotificationBadge() {
                try {
                    // encode session to base64 to ensure header uses ASCII-safe characters
                    const encodedSession = (typeof window.btoa === 'function')
                        ? window.btoa(unescape(encodeURIComponent(JSON.stringify(session))))
                        : encodeURIComponent(JSON.stringify(session));
                    const resp = await fetch('/api/notifications/count', {
                            headers: {
                                'x-session-data': encodedSession
                            }
                        });
                    const json = await resp.json();
                    if (json.success && json.data) {
                        const total = json.data.total || 0;
                        document.querySelectorAll('#notification-badge, #notification-badge-mobile').forEach((badge) => {
                            if (!badge) return;
                            if (total > 0) {
                                badge.textContent = String(total > 99 ? '99+' : total);
                                badge.classList.remove('hidden');
                            } else {
                                badge.classList.add('hidden');
                            }
                        });
                    }
                } catch (err) {
                    console.error('Failed to fetch notifications:', err);
                }
            }
            
            updateNotificationBadge();
            window.addEventListener('notifications:changed', updateNotificationBadge);
            // Update every 30 seconds
            setInterval(updateNotificationBadge, 30000);
        }
    })();

});

// Toast Notification Utility: แสดงแจ้งเตือนมุมขวาล่าง (success/error)
// ออกแบบให้ใช้ได้ทุกหน้า: ถ้าไม่มี container จะสร้างให้เอง
function showToast(message, type = 'success', duration = 4000) {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = type === 'success'
        ? 'fixed bottom-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-pulse'
        : 'fixed bottom-4 right-4 bg-red-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-pulse';

    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, duration);
}

// แปลงวันที่เป็นรูปแบบ DD/MM/YYYY (ใช้แสดงผลในหน้าเว็บ)
function formatDateToDDMMYYYY(date) {
    if (!date) return '';
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
}

// แปลงข้อความ DD/MM/YYYY เป็น Date (ใช้ตอนต้องการคำนวณ/เปรียบเทียบวันที่)
function parseDateFromDDMMYYYY(dateString) {
    const [day, month, year] = dateString.split('/');
    return new Date(year, month - 1, day);
}

// ตรวจสอบเบอร์โทรไทยแบบง่าย: 9-10 หลัก (อนุญาตช่องว่าง/ขีด)
function isValidPhoneNumber(phone) {
    const cleaned = phone.replace(/[\s\-]/g, '');
    return /^\d{9,10}$/.test(cleaned);
}

// แสดง error ใต้ฟิลด์ฟอร์ม (พร้อมใส่ class ที่ทำให้ input เป็นสถานะ error)
function showFieldError(fieldId, errorId, message) {
    const field = document.getElementById(fieldId);
    const errorEl = document.getElementById(errorId);

    if (field && errorEl) {
        field.classList.add('input-error');
        errorEl.textContent = message;
        errorEl.classList.remove('hidden');
    }
}

// ล้าง error ของฟิลด์ (เอา class error ออก + ซ่อนข้อความ)
function clearFieldError(fieldId, errorId) {
    const field = document.getElementById(fieldId);
    const errorEl = document.getElementById(errorId);

    if (field && errorEl) {
        field.classList.remove('input-error');
        errorEl.textContent = '';
        errorEl.classList.add('hidden');
    }
}

// ผูก event ให้ฟิลด์: เมื่อผู้ใช้พิมพ์/เปลี่ยนค่า ให้ล้าง error ที่เคยขึ้น
function setupFormValidation(formId, validationConfig) {
    const form = document.getElementById(formId);
    if (!form) return;

    // On change, clear errors
    Object.keys(validationConfig).forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (field) {
            field.addEventListener('change', () => {
                const errorId = validationConfig[fieldId].errorId;
                clearFieldError(fieldId, errorId);
            });
            field.addEventListener('input', () => {
                const errorId = validationConfig[fieldId].errorId;
                clearFieldError(fieldId, errorId);
            });
        }
    });
}

// ตั้งสถานะปุ่ม submit: disable และสลับข้อความ/สปินเนอร์
// ใช้ร่วมกันหลายฟอร์มที่มี id ชื่อเดียวกัน (btn-text/btn-spinner)
function setButtonLoading(buttonId, isLoading = true) {
    const btn = document.getElementById(buttonId);
    const btnText = document.getElementById('btn-text');
    const btnSpinner = document.getElementById('btn-spinner');

    if (btn) {
        btn.disabled = isLoading;
        if (btnText) btnText.style.display = isLoading ? 'none' : 'inline';
        if (btnSpinner) btnSpinner.style.display = isLoading ? 'inline' : 'none';
    }
}

// รวม utility ไว้ที่ window.FormUtils เพื่อให้ไฟล์ JS หน้าอื่นเรียกใช้ได้
window.FormUtils = {
    showToast,
    formatDateToDDMMYYYY,
    parseDateFromDDMMYYYY,
    isValidPhoneNumber,
    showFieldError,
    clearFieldError,
    setupFormValidation,
    setButtonLoading,
};

// Owner session helper (token + owner info) for owner-only pages and API calls
(() => {
    const KEY = 'rice_mill_owner_session_v1';

    const normalize = (value) => (value || '').toString().trim();

    const resolveMillIdFromName = (name) => {
        const raw = normalize(name);
        if (!raw) return null;
        const compact = raw.replace(/\s+/g, '');
        const lower = raw.toLowerCase();

        const map = {
            'โรงสีบ้านบางกระวาน': 1,
            'โรงสีบางกระวาน': 1,
            'โรงสีกลาง': 1,
            'CentralMill': 1,
            'โรงสีบ้านปรือคัน': 2,
            'โรงสีปรือคัน': 2,
            'โรงสีเหนือ': 2,
            'NorthernMill': 2,
            'โรงสีบ้านเนินเเสง': 3,
            'โรงสีบ้านเนินแสง': 3,
            'โรงสีเนินแสง': 3,
            'โรงสีใต้': 3,
            'SouthernMill': 3,
        };

        if (map[compact] !== undefined) return map[compact];
        if (raw.includes('กลาง') || lower.includes('central')) return 1;
        if (raw.includes('เหนือ') || lower.includes('north')) return 2;
        if (raw.includes('ใต้') || lower.includes('south')) return 3;
        return null;
    };

    const get = () => {
        if (!window.localStorage) return null;
        try {
            const raw = window.localStorage.getItem(KEY);
            if (!raw) return null;
            const s = JSON.parse(raw);
            if (!s || typeof s !== 'object') return null;
            if (s.exp && Date.now() > Number(s.exp)) {
                window.localStorage.removeItem(KEY);
                return null;
            }
            return s;
        } catch {
            return null;
        }
    };

    const set = (session) => {
        if (!window.localStorage) return;
        window.localStorage.setItem(KEY, JSON.stringify(session || {}));
    };

    const clear = () => {
        if (!window.localStorage) return;
        window.localStorage.removeItem(KEY);
    };

    window.OwnerSession = {
        get,
        set,
        clear,
        resolveMillIdFromName,
    };

    // Auto-redirect: owner-only pages require login with role 'owner'
    // villager pages require login (any role)
    try {
        const path = window.location && window.location.pathname ? window.location.pathname : '';
        
        // Owner-only pages (must be owner role)
        if (path.startsWith('/owner-')) {
            const s = get();
            if (!s) {
                window.location.href = '/login.html';
            } else if (s.role && s.role !== 'owner') {
                window.location.href = '/';
            }
        } 
        // Villager pages (must be logged in, any role)
        else if ([
            '/checkout.html',
            '/cart.html',
            '/order.html',
            '/milling.html',
            '/inquiry.html',
            '/my-history.html',
            '/my-history-combined.html',
            '/my-orders.html',
            '/order-status.html',
            '/villager-dashboard.html'
        ].includes(path)) {
            const s = get();
            if (!s) {
                // Save current page to redirect back after login
                window.sessionStorage.setItem('redirect_after_login', path);
                window.location.href = '/login.html';
            }
        }
    } catch {
        // ignore
    }

    // Attach Authorization header automatically for same-origin /api calls
    try {
        const originalFetch = window.fetch.bind(window);
        window.fetch = (input, init = {}) => {
            const session = get();
            if (!session || !session.token) return originalFetch(input, init);

            let url;
            try {
                url = (typeof input === 'string') ? input : (input && input.url);
            } catch {
                url = null;
            }

            if (typeof url === 'string') {
                // Only attach for same-origin API requests
                const isApiPath = url.startsWith('/api/') || url.startsWith('/api?') || url.includes('/api/');
                if (isApiPath) {
                    try {
                        const headers = new Headers(init.headers || (input && input.headers) || undefined);
                        if (!headers.has('Authorization')) {
                            headers.set('Authorization', `Bearer ${session.token}`);
                        }
                        return originalFetch(input, { ...init, headers });
                    } catch (e) {
                        // If Headers construction fails (e.g., non-ASCII header values), fallback to original fetch
                        return originalFetch(input, init);
                    }
                }
            }

            return originalFetch(input, init);
        };
    } catch {
        // ignore
    }
})();

// Local fallback data store (for running as static files without backend/MySQL)
// Owner pages will use this when /api requests fail.
(() => {
    const KEY = 'rice_mill_milling_requests_v1';

    const safeParse = (raw) => {
        try {
            return JSON.parse(raw);
        } catch {
            return null;
        }
    };

    const loadList = () => {
        const raw = window.localStorage ? window.localStorage.getItem(KEY) : null;
        const parsed = raw ? safeParse(raw) : null;
        return Array.isArray(parsed) ? parsed : [];
    };

    const saveList = (rows) => {
        if (!window.localStorage) return;
        window.localStorage.setItem(KEY, JSON.stringify(rows || []));
    };

    const todayPlus = (days) => {
        const d = new Date();
        d.setDate(d.getDate() + days);
        d.setHours(0, 0, 0, 0);
        return d.toISOString().slice(0, 10);
    };

    const ensureSeed = () => {
        const existing = loadList();
        if (existing.length > 0) return existing;

        const now = new Date().toISOString();
        const seed = [
            {
                request_id: 1,
                mill_id: 1,
                mill_name: 'Central Mill',
                mill_name_th: 'โรงสีบ้านบางกระวาน',
                rice_type: 'white_rice',
                customer_name: 'นายสมชาย ใจดี',
                phone: '0812345678',
                address: '123 หมู่ 1 ตำบลตัวอย่าง อำเภอตัวอย่าง',
                sacks: 10,
                dropoff_date: todayPlus(3),
                expected_return_date: todayPlus(5),
                status: 'pending_review',
                review_status: 'pending_review',
                notes: 'ตัวอย่างข้อมูล',
                created_at: now,
                updated_at: now,
            },
            {
                request_id: 2,
                mill_id: 2,
                mill_name: 'Northern Mill',
                mill_name_th: 'โรงสีบ้านปรือคัน',
                rice_type: 'brown_rice',
                customer_name: 'นางสาว จันทร์ดี พราว',
                phone: '0893456789',
                address: '456 หมู่ 2 ตำบลตัวอย่าง อำเภอตัวอย่าง',
                sacks: 8,
                dropoff_date: todayPlus(4),
                expected_return_date: todayPlus(6),
                status: 'milling',
                review_status: 'reviewed',
                notes: 'ตัวอย่างข้อมูล',
                created_at: now,
                updated_at: now,
            },
            {
                request_id: 3,
                mill_id: 3,
                mill_name: 'Southern Mill',
                mill_name_th: 'โรงสีบ้านเนินเเสง',
                rice_type: 'sticky_rice',
                customer_name: 'นายอานนท์ มั่นคง',
                phone: '0864567890',
                address: '789 หมู่ 3 ตำบลตัวอย่าง อำเภอตัวอย่าง',
                sacks: 12,
                dropoff_date: todayPlus(2),
                expected_return_date: todayPlus(4),
                status: 'delivered',
                review_status: 'reviewed',
                notes: 'ตัวอย่างข้อมูล',
                created_at: now,
                updated_at: now,
            },
        ];
        saveList(seed);
        return seed;
    };

    const nextId = (rows) => {
        let maxId = 0;
        for (const r of rows) {
            const id = Number(r && r.request_id);
            if (Number.isFinite(id) && id > maxId) maxId = id;
        }
        return maxId + 1;
    };

    const sortNewestFirst = (rows) => {
        return [...rows].sort((a, b) => {
            const ta = new Date(a?.created_at || 0).getTime();
            const tb = new Date(b?.created_at || 0).getTime();
            return tb - ta;
        });
    };

    const list = ({ limit = 100, offset = 0, millId } = {}) => {
        const seeded = ensureSeed();
        const ordered = sortNewestFirst(seeded);
        const filtered = (millId ? ordered.filter(r => Number(r?.mill_id) === Number(millId)) : ordered);
        const start = Math.max(0, Number(offset) || 0);
        const end = start + (Number(limit) || 100);
        return filtered.slice(start, end);
    };

    const getById = (id) => {
        const seeded = ensureSeed();
        const num = Number(id);

        const row = seeded.find(r => Number(r.request_id) === num) || null;
        if (!row) return null;

        // Enforce per-mill access if session exists
        const sessionMill = window.OwnerSession?.get?.()?.mill_id;
        if (sessionMill && Number(row.mill_id) !== Number(sessionMill)) return null;

        return row;
    };

    const create = (payload) => {
        const rows = loadList();
        const now = new Date().toISOString();
        const id = nextId(rows);
        const row = {
            request_id: id,
            mill_id: payload?.mill_id ? Number(payload.mill_id) : null,
            rice_type: payload?.rice_type || 'white_rice',
            customer_name: payload?.customer_name || '-',
            phone: payload?.phone || '-',
            address: payload?.address || '',
            sacks: Number(payload?.sacks) || 0,
            dropoff_date: payload?.dropoff_date || todayPlus(1),
            expected_return_date: null,
            status: 'pending_review',
            review_status: 'pending_review',
            notes: payload?.notes || '',
            created_at: now,
            updated_at: now,
        };
        const merged = [row, ...rows];
        saveList(merged);
        return row;
    };

    const update = (id, patch) => {
        const rows = loadList();
        const num = Number(id);
        let updatedRow = null;
        const now = new Date().toISOString();

        const sessionMill = window.OwnerSession?.get?.()?.mill_id;

        const merged = rows.map((r) => {
            if (Number(r.request_id) !== num) return r;

            if (sessionMill && Number(r.mill_id) !== Number(sessionMill)) return r;

            updatedRow = {
                ...r,
                ...patch,
                updated_at: now,
            };
            return updatedRow;
        });

        if (!updatedRow) return null;
        saveList(merged);
        return updatedRow;
    };

    const remove = (id) => {
        const rows = loadList();
        const num = Number(id);
        const sessionMill = window.OwnerSession?.get?.()?.mill_id;
        const before = rows.length;
        const kept = rows.filter(r => {
            if (Number(r.request_id) !== num) return true;
            if (sessionMill && Number(r.mill_id) !== Number(sessionMill)) return true;
            return false;
        });
        saveList(kept);
        return kept.length !== before;
    };

    window.LocalApi = {
        millingRequests: {
            list,
            getById,
            create,
            update,
            delete: remove,
            _loadRaw: loadList,
            _saveRaw: saveList,
            _ensureSeed: ensureSeed,
        }
    };
})();
