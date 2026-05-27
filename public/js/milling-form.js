// Milling Request Form Validation and Submission

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('milling-form');
    const submitBtn = document.getElementById('submit-btn');

    if (!form) return;

    const applyIfEmpty = (inputEl, value) => {
        if (!inputEl) return;
        const nextValue = String(value || '').trim();
        if (!inputEl.value.trim() && nextValue) {
            inputEl.value = nextValue;
        }
    };

    const loadProfile = async () => {
        const session = window.OwnerSession?.get?.();
        if (!session || session.role === 'owner' || !session.villager_id) return;

        const nameEl = document.getElementById('customer-name');
        const phoneEl = document.getElementById('phone');
        const addressEl = document.getElementById('address');

        applyIfEmpty(nameEl, session.owner_name || session.villager_name || '');
        applyIfEmpty(phoneEl, session.phone || '');
        applyIfEmpty(addressEl, session.address || '');

        if ((nameEl && nameEl.value.trim()) && (phoneEl && phoneEl.value.trim()) && (addressEl && addressEl.value.trim())) {
            return;
        }

        try {
            const headers = {};
            if (session) {
                headers['x-session-data'] = btoa(unescape(encodeURIComponent(JSON.stringify(session))));
            }
            const resp = await fetch('/api/auth/me', { headers });
            const json = await resp.json().catch(() => null);
            if (!resp.ok || !json || json.success !== true || !json.data) return;

            const profile = json.data || {};
            applyIfEmpty(nameEl, profile.villager_name || profile.owner_name || session.owner_name || '');
            applyIfEmpty(phoneEl, profile.phone || session.phone || '');
            applyIfEmpty(addressEl, profile.address || session.address || '');
        } catch (err) {
            console.debug('loadProfile(milling) failed', err);
        }
    };

    const persistCustomerSession = () => {
        const session = window.OwnerSession?.get?.();
        if (!session || session.role === 'owner' || !session.villager_id) return;

        const customerName = document.getElementById('customer-name')?.value?.trim() || '';
        const phone = document.getElementById('phone')?.value?.trim() || '';
        const address = document.getElementById('address')?.value?.trim() || '';

        window.OwnerSession?.set?.({
            ...session,
            owner_name: customerName || session.owner_name || session.villager_name || '',
            villager_name: customerName || session.villager_name || session.owner_name || '',
            phone: phone || session.phone || '',
            address: address || session.address || '',
        });
    };

    // อ่าน mill_id/mill_name จาก URL เพื่อโชว์ “โรงสีที่เลือก” บนหน้าแบบฟอร์ม
    // และเก็บ mill_id ลง hidden input เพื่อส่งเข้าหลังบ้าน
    try {
        const params = new URLSearchParams(window.location.search);
        const millName = (params.get('mill_name') || '').trim();
        const millId = (params.get('mill_id') || '').trim();

        const banner = document.getElementById('selected-mill-banner');
        const nameEl = document.getElementById('selected-mill-name');
        const millIdInput = document.getElementById('mill-id');

        if (millIdInput) {
            millIdInput.value = millId;
        }

        if (banner && nameEl && millName) {
            nameEl.textContent = millName;
            banner.classList.remove('hidden');
        }
    } catch (e) {
        // ignore URL parsing errors
    }

    // กติกาการตรวจฟอร์ม (ใช้ร่วมกับ FormUtils.setupFormValidation)
    const validationRules = {
        'rice-white': { errorId: 'rice-error', required: true },
        'rice-brown': { errorId: 'rice-error', required: true },
        'rice-sticky': { errorId: 'rice-error', required: true },
        'customer-name': { errorId: 'name-error', required: true },
        'phone': { errorId: 'phone-error', required: true, validator: window.FormUtils.isValidPhoneNumber },
        'address': { errorId: 'address-error', required: true },
        'sacks': { errorId: 'sacks-error', required: true, validator: (val) => parseInt(val) > 0 },
        'dropoff-date': { errorId: 'date-error', required: true },
    };

    // ผูก event ให้พิมพ์แล้วล้าง error ทันที (UX ดีขึ้น)
    window.FormUtils.setupFormValidation('milling-form', validationRules);

    loadProfile();

    // เมื่อกดส่งฟอร์ม: ตรวจความถูกต้อง → ส่ง POST ไป /api/milling-requests
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const session = window.OwnerSession?.get?.();

        // Clear all previous errors
        Object.values(validationRules).forEach(rule => {
            const errorEl = document.getElementById(rule.errorId);
            if (errorEl) errorEl.classList.add('hidden');
        });

        // เก็บข้อมูลจากฟอร์มทั้งหมดเป็น object (name=value)
        let isValid = true;
        const formData = new FormData(form);
        const data = Object.fromEntries(formData);

        // ตรวจชนิดข้าว: ต้องเลือก radio อย่างใดอย่างหนึ่ง
        const riceType = document.querySelector('input[name="rice_type"]:checked');
        if (!riceType) {
            window.FormUtils.showFieldError('rice-white', 'rice-error', 'กรุณาเลือกชนิดข้าว');
            isValid = false;
        }

        // ตรวจชื่อ-นามสกุล
        if (!data.customer_name || data.customer_name.trim() === '') {
            window.FormUtils.showFieldError('customer-name', 'name-error', 'กรุณากรอกชื่อ-นามสกุล');
            isValid = false;
        }

        // ตรวจเบอร์โทร: ต้องมีและรูปแบบถูกต้อง
        if (!data.phone || data.phone.trim() === '') {
            window.FormUtils.showFieldError('phone', 'phone-error', 'กรุณากรอกเบอร์โทรศัพท์');
            isValid = false;
        } else if (!window.FormUtils.isValidPhoneNumber(data.phone)) {
            window.FormUtils.showFieldError('phone', 'phone-error', 'เบอร์โทรศัพท์ต้องมี 9-10 หลัก');
            isValid = false;
        }

        // ตรวจที่อยู่: บังคับขั้นต่ำ 5 ตัวอักษร (ให้ตรงกับ backend)
        if (!data.address || data.address.trim() === '') {
            window.FormUtils.showFieldError('address', 'address-error', 'กรุณากรอกที่อยู่');
            isValid = false;
        } else if (data.address.trim().length < 5) {
            window.FormUtils.showFieldError('address', 'address-error', 'ที่อยู่ต้องยาวอย่างน้อย 5 ตัวอักษร');
            isValid = false;
        }

        // ตรวจจำนวนกระสอบ: ต้องมากกว่า 0
        if (!data.sacks || parseInt(data.sacks) <= 0) {
            window.FormUtils.showFieldError('sacks', 'sacks-error', 'จำนวนกระสอบต้องมากกว่า 0');
            isValid = false;
        }

        // ตรวจวันที่: ห้ามย้อนหลัง
        if (!data.dropoff_date) {
            window.FormUtils.showFieldError('dropoff-date', 'date-error', 'กรุณาเลือกวันที่ต้องการสีข้าว');
            isValid = false;
        } else {
            const selectedDate = new Date(data.dropoff_date);
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            if (Number.isNaN(selectedDate.getTime())) {
                window.FormUtils.showFieldError('dropoff-date', 'date-error', 'รูปแบบวันที่ไม่ถูกต้อง');
                isValid = false;
            } else {
                selectedDate.setHours(0, 0, 0, 0);
                if (selectedDate < today) {
                    window.FormUtils.showFieldError('dropoff-date', 'date-error', 'วันที่ต้องเป็นวันนี้หรือวันถัดไป');
                    isValid = false;
                }
            }
        }

        if (!isValid) {
            // ถ้าฟอร์มไม่ผ่าน ให้แจ้งเตือนรวม 1 ครั้ง และให้ผู้ใช้แก้ตาม error ที่ขึ้นใต้ฟิลด์
            window.FormUtils.showToast('กรุณาตรวจสอบข้อมูลที่กรอก', 'error');
            return;
        }

        // เตรียม payload ให้ตรงกับ API หลังบ้าน
        const submitData = {
            mill_id: data.mill_id || null,
            rice_type: data.rice_type,
            customer_name: data.customer_name,
            phone: data.phone,
            address: data.address,
            sacks: parseInt(data.sacks),
            dropoff_date: data.dropoff_date,
            villager_id: session?.villager_id || null,
        };

        // กันกดซ้ำด้วย loading state
        window.FormUtils.setButtonLoading('submit-btn', true);

        try {
            // ยิง API สร้างคำขอสีข้าว
            const headers = {
                'Content-Type': 'application/json',
            };
            if (session?.token) {
                headers.Authorization = `Bearer ${session.token}`;
            }

            const response = await fetch('/api/milling-requests', {
                method: 'POST',
                headers,
                body: JSON.stringify(submitData),
            });

            if (response.ok) {
                const result = await response.json();
                // สำเร็จ: โชว์กล่อง success + reset ฟอร์ม
                document.getElementById('success-message').classList.remove('hidden');
                persistCustomerSession();
                form.reset();
                window.FormUtils.showToast('ส่งคำขอสำเร็จ!', 'success');
                // เลื่อนจอไปที่ข้อความสำเร็จ เพื่อให้ผู้ใช้เห็นแน่นอน
                document.getElementById('success-message').scrollIntoView({ behavior: 'smooth' });
            } else {
                // ไม่สำเร็จ: แสดงข้อความ error จาก server ถ้ามี
                const err = await response.json().catch(() => null);
                window.FormUtils.showToast(err?.message || 'ส่งคำขอไม่สำเร็จ โปรดลองใหม่', 'error');
            }
        } catch (error) {
            console.error('Error:', error);
            // network/อื่น ๆ
            window.FormUtils.showToast('เกิดข้อผิดพลาด โปรดลองใหม่', 'error');
        } finally {
            // ปลดล็อคปุ่มเสมอ
            window.FormUtils.setButtonLoading('submit-btn', false);
        }
    });
});
