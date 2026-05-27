document.addEventListener('DOMContentLoaded', () => {
    const session = window.OwnerSession?.get?.();
    if (!session || !session.mill_id) {
        window.location.href = '/login.html';
        return;
    }

    // อ่าน id จาก URL เพื่อดึงรายละเอียดคำขอจาก API
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');

    const fullNameEl = document.getElementById('full-name');
    const customerPhoneEl = document.getElementById('customer-phone');
    const customerAddressEl = document.getElementById('customer-address');
    const millNameEl = document.getElementById('mill-name');
    const riceTypeEl = document.getElementById('rice-type');
    const sacksEl = document.getElementById('sacks');
    const dropoffDateEl = document.getElementById('dropoff-date');
    const returnDateEl = document.getElementById('return-date');
    const notesEl = document.getElementById('notes');
    const processStatusEl = document.getElementById('process-status');
    const cancelledHint = document.getElementById('cancelled-hint');
    const btnSave = document.getElementById('btn-save');

    // toast สำหรับหน้านี้: ใช้ alert เป็นหลักเพื่อให้ผู้ใช้เห็นแน่นอน
    const toast = (message, type = 'success') => {
        console.log(`Toast: ${type} - ${message}`);
        
        // Always show alert to ensure user sees feedback
        if (type === 'success') {
            alert(`✅ ${message}`);
        } else {
            alert(`❌ ${message}`);
        }
        
        // Also try FormUtils toast if available
        if (window.FormUtils && typeof window.FormUtils.showToast === 'function') {
            window.FormUtils.showToast(message, type);
        }
    };

    // แปลงวันที่ให้อ่านง่ายในรูปแบบไทย
    const formatDate = (dateStr) => {
        if (!dateStr) return '-';
        try {
            const date = new Date(dateStr);
            return date.toLocaleDateString('th-TH', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
            });
        } catch {
            return dateStr;
        }
    };

    // แปลงค่า enum rice_type เป็นคำไทย
    const translateRiceType = (riceType) => {
        const types = {
            'white_rice': 'ข้าวขาว',
            'brown_rice': 'ข้าวกล้อง',
            'sticky_rice': 'ข้าวเหนียว'
        };
        return types[riceType] || riceType || '-';
    };

    // เลือกชื่อโรงสีที่ใช้แสดง: ให้ “ตรงกับชื่อที่เลือก/กรอกบนหน้าเว็บ”
    // - ใช้ชื่อไทยจาก DB ก่อน (ถ้าไม่เพี้ยนเป็น ???)
    // - ถ้าชื่อไทยไม่มี/เสีย ให้ใช้ชื่อไทยตาม mill_id (mapping เดียวกับหน้า index)
    // - สุดท้ายค่อย fallback เป็นชื่ออังกฤษจาก DB
    const resolveMillName = (data) => {
        const thaiName = (data && data.mill_name_th) ? String(data.mill_name_th).trim() : '';
        const engName = (data && data.mill_name) ? String(data.mill_name).trim() : '';
        const id = Number(data && data.mill_id);

        const isAllQuestionMarks = (value) => /^[?\s]+$/.test(value);

        if (thaiName && !isAllQuestionMarks(thaiName)) return thaiName;

        // Fallback mapping (matches the home page cards)
        if (id === 1) return 'โรงสีจังหวัลอยกลาง';
        if (id === 2) return 'โรงสีเหนือวิลเลจ';
        if (id === 3) return 'โรงสีใต้ พรีเมี่ยม';

        if (engName) return engName;
        return '-';
    };

    // เปิด/ปิดการแก้ไขฟอร์ม (dropdown + ปุ่มบันทึก)
    const setDisabled = (disabled) => {
        if (processStatusEl) processStatusEl.disabled = disabled;
        if (btnSave) btnSave.disabled = disabled;
    };

    const toDbStatus = (uiStatus) => {
        const value = String(uiStatus || 'pending');
            const aliases = {
                pending: 'pending_review',
                in_progress: 'milling',
            };
            const canonical = aliases[value] || value;
            const allowed = new Set(['pending_review', 'accepted', 'awaiting_pickup', 'received', 'queued', 'milling', 'packing', 'ready', 'shipping', 'delivered', 'cancelled']);
            if (allowed.has(canonical)) return canonical;
            return 'pending_review';
    };

    // ดึงรายละเอียดจาก API แล้วเติมข้อมูลลงหน้า
    const fetchDetail = async () => {
        if (!id) {
            toast('ไม่พบรหัสรายการ', 'error');
            setDisabled(true);
            return;
        }

        // ปิดการแก้ไขไว้ก่อน ระหว่างโหลด
        setDisabled(true);

        try {
            // GET /api/milling-requests/:id
            const resp = await fetch(`/api/milling-requests/${encodeURIComponent(id)}`);
            const json = await resp.json();

            if (!resp.ok || !json || json.success !== true) {
                throw new Error((json && json.message) || 'ไม่สามารถดึงข้อมูลได้');
            }

            const data = json.data || {};
            
            // ข้อมูลลูกค้า
            if (fullNameEl) fullNameEl.textContent = data.customer_name || '-';
            if (customerPhoneEl) customerPhoneEl.textContent = data.phone || '-';
            if (customerAddressEl) customerAddressEl.textContent = data.address || '-';
            
            // ข้อมูลคำขอ
            if (millNameEl) millNameEl.textContent = resolveMillName(data);
            if (riceTypeEl) riceTypeEl.textContent = translateRiceType(data.rice_type);
            if (sacksEl) sacksEl.textContent = data.sacks ? `${data.sacks} กระสอบ` : '-';
            if (dropoffDateEl) dropoffDateEl.textContent = formatDate(data.dropoff_date);
            if (returnDateEl) returnDateEl.textContent = formatDate(data.expected_return_date);
            if (notesEl) notesEl.textContent = data.notes || '-';

            // ตั้งค่า dropdown สถานะการดำเนินการ
            const status = data.status || 'pending';
            // Map existing internal statuses to our select values
            const mapToSelect = (s) => {
                if (!s) return 'pending';
                            const aliases = {
                                pending: 'pending_review',
                                in_progress: 'milling',
                                completed: 'delivered',
                            };
                            return aliases[s] || String(s);
            };
            if (processStatusEl) processStatusEl.value = mapToSelect(status);

            const cancelled = data.status === 'cancelled';
            if (cancelledHint) cancelledHint.classList.toggle('hidden', !cancelled);
            // อนุญาตให้แก้ไข review_status ได้แม้ถูกยกเลิก
            setDisabled(false);
        } catch (err) {
            console.error(err);

            // Fallback: localStorage when backend/API is not available
            try {
                const data = window.LocalApi?.millingRequests?.getById?.(id);
                if (!data) throw err;

                if (fullNameEl) fullNameEl.textContent = data.customer_name || '-';
                if (customerPhoneEl) customerPhoneEl.textContent = data.phone || '-';
                if (customerAddressEl) customerAddressEl.textContent = data.address || '-';

                if (millNameEl) millNameEl.textContent = resolveMillName(data);
                if (riceTypeEl) riceTypeEl.textContent = translateRiceType(data.rice_type);
                if (sacksEl) sacksEl.textContent = data.sacks ? `${data.sacks} กระสอบ` : '-';
                if (dropoffDateEl) dropoffDateEl.textContent = formatDate(data.dropoff_date);
                if (returnDateEl) returnDateEl.textContent = formatDate(data.expected_return_date);
                if (notesEl) notesEl.textContent = data.notes || '-';

                const reviewStatus = data.review_status ?? 'pending_review';
                if (reviewEl) reviewEl.value = reviewStatus === 'reviewed' ? 'reviewed' : 'pending_review';

                const cancelled = data.status === 'cancelled';
                if (cancelledHint) cancelledHint.classList.toggle('hidden', !cancelled);

                setDisabled(false);
                toast('แสดงข้อมูลจากเครื่อง (ออฟไลน์)', 'success');
                return;
            } catch (e) {
                console.error('Local fallback failed:', e);
            }

            toast(err.message || 'ดึงข้อมูลไม่สำเร็จ', 'error');
            setDisabled(true);
        }
    };

    // บันทึกการเปลี่ยนแปลง review_status ไปที่ API
    const save = async () => {
        if (!id) {
            console.log('Save failed: no ID');
            return;
        }

        console.log('Save button clicked, starting save process...');

        try {
            // ปิดการแก้ไขระหว่างบันทึก
            setDisabled(true);
            const statusValue = processStatusEl ? processStatusEl.value : 'pending';
            const payload = {
                status: toDbStatus(statusValue),
                review_status: statusValue === 'pending' ? 'pending_review' : 'reviewed',
            };

            console.log('Sending payload:', payload);

            // PUT /api/milling-requests/:id
            const resp = await fetch(`/api/milling-requests/${encodeURIComponent(id)}`,
                {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                }
            );

            console.log('API Response status:', resp.status);

            const json = await resp.json().catch(() => null);
            console.log('API Response:', json);
            
            if (!resp.ok || !json || json.success !== true) {
                throw new Error((json && json.message) || 'บันทึกไม่สำเร็จ');
            }

            toast('บันทึกข้อมูลเรียบร้อยแล้ว', 'success');
            console.log('Save completed successfully');
            // เด้งกลับไปหน้ารายการคำขอหลังบันทึกสำเร็จ
            setTimeout(() => {
                window.location.href = '/owner-check.html';
            }, 600);
        } catch (err) {
            console.error('Save error:', err);

            // Fallback: localStorage update
            try {
                const updated = window.LocalApi?.millingRequests?.update?.(id, payload);
                if (updated) {
                    toast('บันทึกข้อมูล (ออฟไลน์) เรียบร้อยแล้ว', 'success');
                    await fetchDetail();
                    return;
                }
            } catch (e) {
                console.error('Local fallback failed:', e);
            }

            toast(err.message || 'บันทึกไม่สำเร็จ', 'error');
            setDisabled(false);
        }
    };

    if (btnSave) {
        console.log('Save button found, adding click listener');
        // ผูกปุ่มบันทึกกับฟังก์ชัน save()
        btnSave.addEventListener('click', (e) => {
            console.log('Save button clicked!');
            e.preventDefault();
            save();
        });
    } else {
        console.error('Save button not found!');
    }

    // เริ่มดึงรายละเอียดเมื่อหน้าโหลด
    fetchDetail();
});
