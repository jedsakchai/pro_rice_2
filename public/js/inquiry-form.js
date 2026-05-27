// Inquiry Form Validation and Submission

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('inquiry-form');
    const submitBtn = document.getElementById('submit-btn');

    if (!form) return;

    const applyIfEmpty = (inputEl, value) => {
        if (!inputEl) return;
        const nextValue = String(value || '').trim();
        if (!inputEl.value.trim() && nextValue) {
            inputEl.value = nextValue;
        }
    };

    const loadCustomerProfile = async () => {
        const session = window.OwnerSession?.get?.();
        if (!session || session.role === 'owner' || !session.villager_id) return;

        const nameEl = document.getElementById('customer-name');
        const phoneEl = document.getElementById('phone');

        applyIfEmpty(nameEl, session.owner_name || session.villager_name || '');
        applyIfEmpty(phoneEl, session.phone || '');

        if ((nameEl && nameEl.value.trim()) && (phoneEl && phoneEl.value.trim())) {
            return;
        }

        try {
            const headers = {};
            if (session?.token) {
                headers.Authorization = `Bearer ${session.token}`;
            }
            if (session) {
                headers['x-session-data'] = btoa(unescape(encodeURIComponent(JSON.stringify(session))));
            }

            const resp = await fetch('/api/auth/me', { headers });
            const json = await resp.json().catch(() => null);
            if (!resp.ok || !json || json.success !== true || !json.data) return;

            const profile = json.data || {};
            applyIfEmpty(nameEl, profile.villager_name || profile.owner_name || session.owner_name || '');
            applyIfEmpty(phoneEl, profile.phone || session.phone || '');
        } catch (err) {
            console.debug('loadCustomerProfile(inquiry) failed', err);
        }
    };

    const persistCustomerSession = () => {
        const session = window.OwnerSession?.get?.();
        if (!session || session.role === 'owner' || !session.villager_id) return;

        const customerName = document.getElementById('customer-name')?.value?.trim() || '';
        const phone = document.getElementById('phone')?.value?.trim() || '';

        window.OwnerSession?.set?.({
            ...session,
            owner_name: customerName || session.owner_name || session.villager_name || '',
            villager_name: customerName || session.villager_name || session.owner_name || '',
            phone: phone || session.phone || '',
        });
    };

    // เจ้าของโรงสีไม่ต้องส่งคำถาม — ซ่อนฟอร์ม
    const session = window.OwnerSession?.get?.();
    if (session && session.role === 'owner') {
        form.style.display = 'none';
        return;
    }

    // Form validation configuration
    const validationRules = {
        'subject': { errorId: 'subject-error', required: true },
        'message': { errorId: 'message-error', required: true },
        'customer-name': { errorId: 'name-error', required: true },
        'phone': { errorId: 'phone-error', required: true, validator: window.FormUtils.isValidPhoneNumber },
    };

    // Setup real-time validation
    window.FormUtils.setupFormValidation('inquiry-form', validationRules);

    loadCustomerProfile();

    // Form submission
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Clear all previous errors
        Object.values(validationRules).forEach(rule => {
            const errorEl = document.getElementById(rule.errorId);
            if (errorEl) errorEl.classList.add('hidden');
        });

        // Validate form
        let isValid = true;
        const formData = new FormData(form);
        const data = Object.fromEntries(formData);

        // Validate Subject
        if (!data.subject || data.subject.trim() === '') {
            window.FormUtils.showFieldError('subject', 'subject-error', 'Subject is required');
            isValid = false;
        }

        // Validate Message
        if (!data.message || data.message.trim() === '') {
            window.FormUtils.showFieldError('message', 'message-error', 'Message is required');
            isValid = false;
        }

        // Validate Customer Name
        if (!data.customer_name || data.customer_name.trim() === '') {
            window.FormUtils.showFieldError('customer-name', 'name-error', 'Name is required');
            isValid = false;
        }

        // Validate Phone
        if (!data.phone || data.phone.trim() === '') {
            window.FormUtils.showFieldError('phone', 'phone-error', 'Phone number is required');
            isValid = false;
        } else if (!window.FormUtils.isValidPhoneNumber(data.phone)) {
            window.FormUtils.showFieldError('phone', 'phone-error', 'Phone number must be 9-10 digits');
            isValid = false;
        }

        if (!isValid) {
            window.FormUtils.showToast('Please correct the errors above', 'error');
            return;
        }

        // Prepare submission data
        const submitData = {
            subject: data.subject,
            message: data.message,
            customer_name: data.customer_name,
            phone: data.phone,
        };

        // Submit form
        window.FormUtils.setButtonLoading('submit-btn', true);

        try {
            const response = await fetch('/api/inquiries', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(submitData),
            });

            if (response.ok) {
                const result = await response.json();
                // Show success message
                document.getElementById('success-message').classList.remove('hidden');
                persistCustomerSession();
                form.reset();
                window.FormUtils.showToast('Inquiry sent successfully!', 'success');
                window.dispatchEvent(new CustomEvent('inquiry:submitted', { detail: result }));
                // Scroll to success message
                document.getElementById('success-message').scrollIntoView({ behavior: 'smooth' });
            } else {
                window.FormUtils.showToast('Failed to send inquiry. Please try again.', 'error');
            }
        } catch (error) {
            console.error('Error:', error);
            window.FormUtils.showToast('An error occurred. Please try again.', 'error');
        } finally {
            window.FormUtils.setButtonLoading('submit-btn', false);
        }
    });
});
