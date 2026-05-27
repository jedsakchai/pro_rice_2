document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('login-form');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const username = document.getElementById('username')?.value?.trim();
        const password = document.getElementById('password')?.value || '';

        const isAlphaNum = (v) => /^[A-Za-z0-9]+$/.test(String(v || ''));

        if (!username || !password) {
            window.FormUtils?.showToast?.('กรุณากรอกข้อมูลให้ครบถ้วน', 'error');
            return;
        }

        if (!isAlphaNum(username)) {
            window.FormUtils?.showToast?.('username ใช้ได้เฉพาะตัวอักษรภาษาอังกฤษและตัวเลข', 'error');
            return;
        }

        if (!isAlphaNum(password)) {
            window.FormUtils?.showToast?.('password ใช้ได้เฉพาะตัวอักษรภาษาอังกฤษและตัวเลข', 'error');
            return;
        }

        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const json = await res.json().catch(() => null);
            if (!res.ok) {
                // Offline fallback: allow demo login to enable per-mill filtering when DB is unavailable
                const millId = window.OwnerSession?.resolveMillIdFromName?.(username);
                if (res.status === 503 && millId) {
                    const exp = Date.now() + 24 * 60 * 60 * 1000;
                    window.OwnerSession?.set?.({
                        token: `offline-${Date.now()}`,
                        owner_id: 0,
                        owner_name: username,
                        mill_name: username,
                        mill_id: millId,
                        exp,
                        offline: true,
                    });
                    window.FormUtils?.showToast?.('เข้าสู่ระบบแบบออฟไลน์สำเร็จ', 'success');
                    setTimeout(() => {
                        const redirectPage = window.sessionStorage?.getItem?.('redirect_after_login');
                        if (redirectPage) {
                            window.sessionStorage.removeItem('redirect_after_login');
                            window.location.href = redirectPage;
                        } else {
                            window.location.href = '/owner-dashboard.html';
                        }
                    }, 600);
                    return;
                }

                window.FormUtils?.showToast?.(json?.message || 'เข้าสู่ระบบไม่สำเร็จ', 'error');
                return;
            }

            // Save session for authenticated pages and API calls
            const exp = Date.now() + 24 * 60 * 60 * 1000;
            if (json?.token) {
                const d = json.data;
                const role = d.role || 'villager';
                window.OwnerSession?.set?.({
                    token: json.token,
                    owner_id: d.owner_id || null,
                    villager_id: d.villager_id || null,
                    owner_name: d.owner_name || d.villager_name || '',
                    mill_name: d.mill_name || d.username || '',
                    mill_id: d.mill_id || null,
                    phone: d.phone || '',
                    address: d.address || '',
                    role,
                    exp,
                });
            }

            window.FormUtils?.showToast?.('เข้าสู่ระบบสำเร็จ', 'success');
            setTimeout(() => {
                const role = json?.data?.role || 'villager';
                // Check if there's a page to redirect to after login
                const redirectPage = window.sessionStorage?.getItem?.('redirect_after_login');
                if (redirectPage) {
                    window.sessionStorage.removeItem('redirect_after_login');
                    window.location.href = redirectPage;
                } else if (role === 'owner') {
                    window.location.href = '/owner-dashboard.html';
                } else {
                    window.location.href = '/';
                }
            }, 600);
        } catch (err) {
            console.error(err);
            // Offline fallback if network/API unavailable
            const millId = window.OwnerSession?.resolveMillIdFromName?.(username);
            if (millId) {
                const exp = Date.now() + 24 * 60 * 60 * 1000;
                window.OwnerSession?.set?.({
                    token: `offline-${Date.now()}`,
                    owner_id: 0,
                    owner_name: username,
                    mill_name: username,
                    mill_id: millId,
                    exp,
                    offline: true,
                });
                window.FormUtils?.showToast?.('เข้าสู่ระบบแบบออฟไลน์สำเร็จ', 'success');
                setTimeout(() => {
                    const redirectPage = window.sessionStorage?.getItem?.('redirect_after_login');
                    if (redirectPage) {
                        window.sessionStorage.removeItem('redirect_after_login');
                        window.location.href = redirectPage;
                    } else {
                        window.location.href = '/owner-dashboard.html';
                    }
                }, 600);
                return;
            }

            window.FormUtils?.showToast?.('เกิดข้อผิดพลาด โปรดลองใหม่', 'error');
        }
    });

    const registerBtn = document.getElementById('register-btn');
    if (registerBtn) {
        registerBtn.addEventListener('click', () => {
            window.location.href = '/register.html';
        });
    }
});
