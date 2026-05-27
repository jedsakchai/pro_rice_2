document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('register-form');
    if (!form) return;

    const roleSelect = document.getElementById('role');
    const millSection = document.getElementById('mill-section');
    const millSelect = document.getElementById('mill_id');

    const ownerMillDetails = document.getElementById('owner-mill-details');
    const villagerDetails = document.getElementById('villager-details');
    const latEl = document.getElementById('latitude');
    const lngEl = document.getElementById('longitude');
    const mapLinkEl = document.getElementById('map_link');
    const btnUseMapLink = document.getElementById('btn-use-map-link');
    const btnOpenMapLink = document.getElementById('btn-open-map-link');
    const mapSearchEl = document.getElementById('map_search');
    const mapFrame = document.getElementById('mill-map-preview');

    // แสดง/ซ่อนช่องเลือกโรงสีตามบทบาท
    function toggleMillSection() {
        if (!roleSelect || !millSection) return;
        if (roleSelect.value === 'owner') {
            millSection.style.display = '';
            if (millSelect) millSelect.required = true;
            if (ownerMillDetails) ownerMillDetails.classList.remove('hidden');
            if (villagerDetails) villagerDetails.classList.add('hidden');
        } else {
            millSection.style.display = 'none';
            if (millSelect) { millSelect.required = false; millSelect.value = ''; }
            if (ownerMillDetails) ownerMillDetails.classList.add('hidden');
            if (villagerDetails) villagerDetails.classList.remove('hidden');
        }
    }
    if (roleSelect) {
        roleSelect.addEventListener('change', toggleMillSection);
        toggleMillSection(); // init
    }

    const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

    // Thailand bounds (approx) to keep map within Thailand only
    const TH_BOUNDS = {
        latMin: 5.5,
        latMax: 20.6,
        lngMin: 97.3,
        lngMax: 105.7
    };

    const isWithinThailand = (lat, lng) => (
        Number.isFinite(lat) && Number.isFinite(lng) &&
        lat >= TH_BOUNDS.latMin && lat <= TH_BOUNDS.latMax &&
        lng >= TH_BOUNDS.lngMin && lng <= TH_BOUNDS.lngMax
    );

    function setMapToThailandDefault() {
        if (!mapFrame) return;
        mapFrame.src = 'https://www.google.com/maps?q=' + encodeURIComponent('ประเทศไทย') + '&hl=th&gl=TH&z=6&output=embed';
    }

    function extractLatLngFromGoogleMapsUrl(urlText) {
        const url = String(urlText || '').trim();
        if (!url) return null;

        // Patterns we can parse without network calls
        // 1) .../@lat,lng,...
        let m = url.match(/@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/);
        if (m) return { lat: Number(m[1]), lng: Number(m[2]) };

        // 2) ...?q=lat,lng or ...?ll=lat,lng
        try {
            const u = new URL(url);
            const q = u.searchParams.get('q') || u.searchParams.get('ll');
            if (q) {
                const mm = q.match(/(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/);
                if (mm) return { lat: Number(mm[1]), lng: Number(mm[2]) };
            }
        } catch (_) {
            // ignore invalid URL
        }

        // 3) ...!3dLAT!4dLNG (common in Google Maps URLs)
        m = url.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
        if (m) return { lat: Number(m[1]), lng: Number(m[2]) };

        return null;
    }

    function updateMapPreviewFromLatLng() {
        if (!mapFrame) return;
        const latRaw = latEl?.value;
        const lngRaw = lngEl?.value;

        const lat = latRaw !== '' && latRaw !== null && latRaw !== undefined ? Number(latRaw) : null;
        const lng = lngRaw !== '' && lngRaw !== null && lngRaw !== undefined ? Number(lngRaw) : null;

        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
        const safeLat = clamp(lat, -90, 90);
        const safeLng = clamp(lng, -180, 180);

        // Keep within Thailand only
        if (!isWithinThailand(safeLat, safeLng)) return;

        mapFrame.src = `https://www.google.com/maps?q=${encodeURIComponent(String(safeLat) + ',' + String(safeLng))}&hl=th&gl=TH&z=16&output=embed`;
    }

    if (latEl) latEl.addEventListener('input', updateMapPreviewFromLatLng);
    if (lngEl) lngEl.addEventListener('input', updateMapPreviewFromLatLng);

    if (mapSearchEl && mapFrame) {
        mapSearchEl.addEventListener('keydown', (e) => {
            if (e.key !== 'Enter') return;
            e.preventDefault();
            let q = String(mapSearchEl.value || '').trim();
            if (!q) return;
            // Bias search to Thailand
            const lower = q.toLowerCase();
            if (!lower.includes('thailand') && !q.includes('ไทย') && !q.includes('ประเทศไทย')) {
                q = q + ' ประเทศไทย';
            }
            mapFrame.src = `https://www.google.com/maps?q=${encodeURIComponent(q)}&hl=th&gl=TH&z=14&output=embed`;
        });
    }

    // Google Maps link: open / parse coords if possible
    function handleUseMapLink() {
        const link = String(mapLinkEl?.value || '').trim();
        if (!link) {
            window.FormUtils?.showToast?.('กรุณาวางลิงก์ Google Maps ก่อน', 'error');
            return;
        }

        const coords = extractLatLngFromGoogleMapsUrl(link);
        if (coords && Number.isFinite(coords.lat) && Number.isFinite(coords.lng)) {
            if (!isWithinThailand(coords.lat, coords.lng)) {
                window.FormUtils?.showToast?.('พิกัดต้องอยู่ในประเทศไทยเท่านั้น', 'error');
                return;
            }
            if (latEl) latEl.value = String(coords.lat);
            if (lngEl) lngEl.value = String(coords.lng);
            updateMapPreviewFromLatLng();
            return;
        }

        // Short links usually can't be parsed without following redirects (CORS), so we just open it.
        if (link.includes('maps.app.goo.gl')) {
            window.open(link, '_blank', 'noopener,noreferrer');
            window.FormUtils?.showToast?.('เปิดลิงก์แล้ว — กรุณาคัดลอกพิกัดมาใส่ในช่อง lat/lng', 'success');
            return;
        }

        // Fallback: just show Thailand map and ask user to use search/latlng
        window.FormUtils?.showToast?.('ลิงก์นี้ดึงพิกัดอัตโนมัติไม่ได้ กรุณากรอก lat/lng', 'error');
        setMapToThailandDefault();
    }

    btnUseMapLink?.addEventListener('click', handleUseMapLink);
    btnOpenMapLink?.addEventListener('click', () => {
        const link = String(mapLinkEl?.value || '').trim();
        if (!link) {
            window.FormUtils?.showToast?.('กรุณาวางลิงก์ Google Maps ก่อน', 'error');
            return;
        }
        window.open(link, '_blank', 'noopener,noreferrer');
    });

    mapLinkEl?.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        handleUseMapLink();
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const role = document.getElementById('role')?.value || 'villager';
        const owner_name = document.getElementById('owner_name')?.value?.trim();
        const mill_id = document.getElementById('mill_id')?.value;
        const username = document.getElementById('username')?.value?.trim();
        const password = document.getElementById('password')?.value || '';

        const mill_location_th = document.getElementById('mill_location_th')?.value?.trim();
        const mill_phone = document.getElementById('mill_phone')?.value?.trim();
        const mill_email = document.getElementById('mill_email')?.value?.trim();
        const villager_phone = document.getElementById('villager_phone')?.value?.trim();
        const villager_address = document.getElementById('villager_address')?.value?.trim();
        const latitudeRaw = document.getElementById('latitude')?.value;
        const longitudeRaw = document.getElementById('longitude')?.value;

        const latitude = latitudeRaw !== '' && latitudeRaw !== null && latitudeRaw !== undefined ? Number(latitudeRaw) : null;
        const longitude = longitudeRaw !== '' && longitudeRaw !== null && longitudeRaw !== undefined ? Number(longitudeRaw) : null;

        const isAlphaNum = (v) => /^[A-Za-z0-9]+$/.test(String(v || ''));

        if (!owner_name || !username || !password) {
            window.FormUtils?.showToast?.('กรุณากรอกข้อมูลให้ครบถ้วน', 'error');
            return;
        }

        if (role === 'owner' && !mill_id) {
            window.FormUtils?.showToast?.('เจ้าของโรงสีต้องเลือกโรงสี', 'error');
            return;
        }

        if (role === 'owner') {
            if ((latitude !== null && !Number.isFinite(latitude)) || (longitude !== null && !Number.isFinite(longitude))) {
                window.FormUtils?.showToast?.('พิกัด lat/lng ไม่ถูกต้อง', 'error');
                return;
            }
            if (Number.isFinite(latitude) && (latitude < -90 || latitude > 90)) {
                window.FormUtils?.showToast?.('Latitude ต้องอยู่ระหว่าง -90 ถึง 90', 'error');
                return;
            }
            if (Number.isFinite(longitude) && (longitude < -180 || longitude > 180)) {
                window.FormUtils?.showToast?.('Longitude ต้องอยู่ระหว่าง -180 ถึง 180', 'error');
                return;
            }

            if (Number.isFinite(latitude) && Number.isFinite(longitude) && !isWithinThailand(latitude, longitude)) {
                window.FormUtils?.showToast?.('พิกัดต้องอยู่ในประเทศไทยเท่านั้น', 'error');
                return;
            }
        }

        if (String(password).length < 6) {
            window.FormUtils?.showToast?.('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร', 'error');
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

        const body = { owner_name, username, password, role };
        if (role === 'owner' && mill_id) body.mill_id = Number(mill_id);
        if (role === 'owner') {
            if (mill_location_th) body.mill_location_th = mill_location_th;
            if (mill_phone) body.mill_phone = mill_phone;
            if (mill_email) body.mill_email = mill_email;
            if (Number.isFinite(latitude)) body.latitude = latitude;
            if (Number.isFinite(longitude)) body.longitude = longitude;
        }
        // Villager contact info
        if (role !== 'owner') {
            if (villager_phone) body.phone = villager_phone;
            if (villager_address) body.address = villager_address;
        }

        try {
            const res = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            const json = await res.json().catch(() => null);
            if (!res.ok) {
                window.FormUtils?.showToast?.(json?.message || 'สมัครไม่สำเร็จ', 'error');
                return;
            }

            window.FormUtils?.showToast?.('สมัครสมาชิกสำเร็จ', 'success');
            setTimeout(() => {
                window.location.href = '/login.html';
            }, 700);
        } catch (err) {
            console.error(err);
            window.FormUtils?.showToast?.('เกิดข้อผิดพลาด โปรดลองใหม่', 'error');
        }
    });
});
