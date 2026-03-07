/* =========================================
   PACKIFY — app.js
   Shared utils, storage, gamifikasi logic
   ========================================= */

// ─── KONFIGURASI ───────────────────────────
const LINK_GAS         = 'https://script.google.com/macros/s/AKfycbykbWDanoqMz4ElDYWommSN-XFO0iDQTZZ4m-0fH7tUgic4KA6HMUoQAH_fAaX3Xg69/exec';
const API_KEY          = '09a638642848807261eca8fd3004a277dc01d2bffbf9a25f';
const STORAGE_KEY      = 'packify_sessions';
const CURRENT_KEY      = 'packify_current';
const OPERATOR_KEY     = 'packify_operator';
const GAMIF_KEY        = 'packify_gamifikasi'; // cache lokal gamifikasi
const SYNC_QUEUE_KEY   = 'packify_sync_queue';  // antrian sesi yang gagal sync

// ─── SYNC QUEUE HELPERS ─────────────────────
function loadSyncQueue() {
    try { return JSON.parse(localStorage.getItem(SYNC_QUEUE_KEY)) || []; }
    catch { return []; }
}
function saveSyncQueue(queue) {
    localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
}
function addToSyncQueue(sessionId) {
    const queue = loadSyncQueue();
    if (!queue.includes(sessionId)) { queue.push(sessionId); saveSyncQueue(queue); }
}
function removeFromSyncQueue(sessionId) {
    saveSyncQueue(loadSyncQueue().filter(id => id !== sessionId));
}
function getSyncFailedCount() {
    return loadSyncQueue().length;
}

// Poin per jenis barang — atur sesuai kebutuhan
const POIN_MAP = {
    T1:      10,
    T3:      10,
    M3:      8,
    ARRANET: 5,
    USER:    5,
    ARAHNETS:5,
    MPN:     5,
    Thermal: 3,
    Kaos:    3,
};

const OPERATORS = ['ram', 'nab', 'wul'];

// ─── STATUS ────────────────────────────────
const STATUS = {
    PENDING_RESI: 'PENDING_RESI',
    DONE:         'DONE',
};

// ─── BADGE DEFINITIONS ─────────────────────
const BADGES = [
    {
        id:    'first_pack',
        icon:  '🎯',
        label: 'Packing Pertama',
        desc:  'Selesaikan sesi packing pertamamu',
        check: (stats) => stats.totalDone >= 1,
    },
    {
        id:    'streak_7',
        icon:  '🔥',
        label: 'On Fire',
        desc:  'Streak 7 hari berturut-turut',
        check: (stats) => stats.streak >= 7,
    },
    {
        id:    'veteran',
        icon:  '📦',
        label: 'Veteran',
        desc:  '50 total packing selesai',
        check: (stats) => stats.totalDone >= 50,
    },
    {
        id:    'top_packer',
        icon:  '👑',
        label: 'Top Packer',
        desc:  'Raih #1 leaderboard mingguan',
        check: (stats) => stats.isTopWeekly === true,
    },
];

// ─── UTILS ─────────────────────────────────
function generateUUID() {
    return crypto.randomUUID();
}

function now() {
    // Format ISO dengan offset WIB — readable & aman di semua browser termasuk Safari
    const d   = new Date();
    const pad = n => String(n).padStart(2, '0');
    // Offset WIB = UTC+7
    const wib = new Date(d.getTime() + 7 * 60 * 60 * 1000);
    return `${wib.getUTCFullYear()}-${pad(wib.getUTCMonth()+1)}-${pad(wib.getUTCDate())}T` +
           `${pad(wib.getUTCHours())}:${pad(wib.getUTCMinutes())}:${pad(wib.getUTCSeconds())}+07:00`;
}

// Parse timestamp dengan aman di semua browser (termasuk Safari)
function parseDate(str) {
    if (!str) return null;
    // Ganti spasi dengan T kalau ada (format lama)
    const iso = str.replace(' ', 'T');
    const d   = new Date(iso);
    return isNaN(d) ? null : d;
}

function formatDate(iso) {
    if (!iso) return '-';
    const d = parseDate(iso);
    if (!d) return '-';
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatTime(iso) {
    if (!iso) return '-';
    const d = parseDate(iso);
    if (!d) return '-';
    return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

function formatDateTime(iso) {
    if (!iso) return '-';
    return `${formatDate(iso)}, ${formatTime(iso)}`;
}

function getTodayKey() {
    const d   = new Date();
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}

function getWeekStart() {
    const d = new Date();
    const day = d.getDay(); // 0=Sun, 1=Mon
    const diff = (day === 0) ? -6 : 1 - day; // Senin
    d.setDate(d.getDate() + diff);
    d.setHours(0, 0, 0, 0);
    const pad = n => String(n).padStart(2,'0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}

function getPoinForJenis(jenis) {
    return POIN_MAP[jenis] || 3;
}

// ─── STORAGE ───────────────────────────────
function loadAllSessions() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
    catch { return []; }
}

function saveAllSessions(sessions) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
}

function loadCurrentSession() {
    try { return JSON.parse(localStorage.getItem(CURRENT_KEY)); }
    catch { return null; }
}

function saveCurrentSession(s) {
    localStorage.setItem(CURRENT_KEY, JSON.stringify(s));
}

function clearCurrentSession() {
    localStorage.removeItem(CURRENT_KEY);
}

// Hapus semua sesi DRAFT saat app load — sesi yang tidak selesai tidak ada gunanya
function cleanupDraftSessions() {
    const all     = loadAllSessions();
    const cleaned = all.filter(s => getStatus(s) !== 'DRAFT');
    if (cleaned.length !== all.length) {
        saveAllSessions(cleaned);
        console.log(`🧹 ${all.length - cleaned.length} sesi DRAFT dihapus`);
    }
}

// Jalankan cleanup setiap kali app.js dimuat
cleanupDraftSessions();

function getOperator() {
    return localStorage.getItem(OPERATOR_KEY) || '';
}

function setOperator(name) {
    localStorage.setItem(OPERATOR_KEY, name);
}

// ─── GAMIFIKASI — LOCAL CACHE ───────────────
function loadGamifCache() {
    try { return JSON.parse(localStorage.getItem(GAMIF_KEY)) || {}; }
    catch { return {}; }
}

function saveGamifCache(data) {
    localStorage.setItem(GAMIF_KEY, JSON.stringify(data));
}

// Hitung & update streak lokal setelah sesi selesai
function updateStreakLocal(operator) {
    const cache    = loadGamifCache();
    const key      = `streak_${operator}`;
    const dayKey   = `lastday_${operator}`;
    const today    = getTodayKey();
    const lastDay  = cache[dayKey] || null;

    let streak = cache[key] || 0;

    if (lastDay === today) {
        // Sudah packing hari ini, streak tidak berubah
    } else if (lastDay === getPrevDayKey(today)) {
        // Hari berturut-turut
        streak += 1;
    } else {
        // Putus / baru mulai
        streak = 1;
    }

    cache[key]   = streak;
    cache[dayKey] = today;
    saveGamifCache(cache);
    return streak;
}

function getPrevDayKey(todayKey) {
    const d = new Date(todayKey);
    d.setDate(d.getDate() - 1);
    const pad = n => String(n).padStart(2,'0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}

function getStreakLocal(operator) {
    const cache = loadGamifCache();
    return cache[`streak_${operator}`] || 0;
}

// Cek badge baru yang didapat
function checkNewBadges(stats, prevBadges = []) {
    return BADGES.filter(b => !prevBadges.includes(b.id) && b.check(stats));
}

// ─── NORMALISE SESSION ─────────────────────
// Konversi sesi dari format server (PascalCase) ke format lokal (camelCase)
// supaya getSessionID(), getStatus(), dll selalu bisa menemukan field dengan benar
function normaliseSession(s) {
    if (!s) return s;
    // Kalau sudah punya sessionId (lokal), tidak perlu diubah
    if (s.sessionId) return s;

    const checklist = s.ChecklistData || s.checklist || [];

    return {
        sessionId:  s.SessionID    || s.sessionId  || '',
        status:     s.Status       || s.status      || '',
        operator:   s.Petugas      || s.operator    || '',
        poin:       s.Poin         || s.poin        || 0,
        createdAt:  s.WaktuDibuat  || s.createdAt   || '',
        finishedAt: s.WaktuSelesai || s.finishedAt  || '',
        shipping: {
            penerima: s.Penerima    || s.shipping?.penerima || '',
            platform: s.Platform    || s.shipping?.platform || '',
            jenis:    s.JenisBarang || s.shipping?.jenis    || '',
            petugas:  s.Petugas     || s.shipping?.petugas  || '',
        },
        resi: {
            number:   s.NomorResi    || s.resi?.number   || '',
            photoUrl: s.LinkFotoResi || s.resi?.photoUrl || '',
        },
        checklist,
    };
}


function createSession(shipping) {
    return {
        sessionId:  generateUUID(),
        operator:   getOperator(),
        shipping,
        checklist:  [],
        resi:       { number: null, photoUrl: null },
        poin:       getPoinForJenis(shipping.jenis),
        status:     'DRAFT',
        createdAt:  now(),
        finishedAt: null,
    };
}

function updateSession(mutator) {
    const s = loadCurrentSession();
    if (!s) return;
    mutator(s);
    s.updatedAt = now();
    saveCurrentSession(s);
}

function persistSession() {
    const all = loadAllSessions();
    const cur = loadCurrentSession();
    if (!cur) return;
    const idx = all.findIndex(s => s.sessionId === cur.sessionId);
    if (idx >= 0) all[idx] = cur;
    else all.push(cur);
    saveAllSessions(all);
}

// ─── CHECKLIST GENERATOR ───────────────────
const CHECKLIST_MAP = {
    T1:      ['EDC', 'Banner', 'Sertifikat', 'Layanan QRIS', 'QRIS', 'Thermal', 'Hardbox'],
    T3:      ['EDC', 'Banner', 'Sertifikat', 'Layanan QRIS', 'QRIS', 'Thermal', 'Hardbox'],
    M3:      ['EDC', 'Banner', 'Sertifikat', 'Thermal', 'Hardbox'],
    ARRANET: ['EDC'],
    USER:    ['EDC'],
    ARAHNETS:['EDC'],
    MPN:     ['EDC'],
    Thermal: ['Thermal Paper'],
    Kaos:    ['Kaos'],
};

function generateChecklist(jenis) {
    return (CHECKLIST_MAP[jenis] || []).map(label => ({
        id:             label.toLowerCase().replace(/\s+/g, '_'),
        label,
        photoId:        null,
        photoPreview:   null,
        hasPending:     false,
    }));
}

function calculateProgress(checklist) {
    if (!checklist.length) return 0;
    const done = checklist.filter(i => i.photoId || i.hasPending).length;
    return Math.round((done / checklist.length) * 100);
}

// ─── STATUS HELPERS ────────────────────────
function getStatusBadge(status) {
    const map = {
        DRAFT:        { label: 'Draft',          cls: 'badge-gray'   },
        PENDING_RESI: { label: 'Belum Ada Resi', cls: 'badge-orange' },
        DONE:         { label: 'Selesai',         cls: 'badge-green'  },
        SYNCED:       { label: 'Selesai',         cls: 'badge-green'  },
    };
    return map[status] || { label: status, cls: 'badge-gray' };
}

// ─── FIELD NORMALIZER (lokal vs server) ────
function getField(s, localKey, serverKey) {
    const v = s[serverKey];
    return (v !== undefined && v !== null && v !== '') ? v : s[localKey];
}
function getStatus(s)       { return getField(s, 'status',     'Status')       || ''; }
function getSessionID(s)    { return getField(s, 'sessionId',  'SessionID')    || ''; }
function getPenerima(s)     { return getField(s, 'penerima',   'Penerima')     || s.shipping?.penerima || '-'; }
function getPetugas(s)      { return getField(s, 'operator',   'Petugas')      || s.shipping?.petugas  || '-'; }
function getWaktuDibuat(s)  { return getField(s, 'createdAt',  'WaktuDibuat')  || null; }
function getWaktuSelesai(s) { return getField(s, 'finishedAt', 'WaktuSelesai') || null; }
function getJenis(s)        { return getField(s, 'jenis',      'JenisBarang')  || s.shipping?.jenis    || '-'; }
function getPlatform(s)     { return getField(s, 'platform',   'Platform')     || s.shipping?.platform || '-'; }
function getNomorResi(s)    { return getField(s, 'resiNumber', 'NomorResi')    || s.resi?.number       || '-'; }
function getFotoResi(s)     { return getField(s, 'resiPhoto',  'LinkFotoResi') || s.resi?.photoUrl     || null; }
function getChecklist(s)    { return s.ChecklistData || s.checklist            || []; }
function getPoin(s)         { return getField(s, 'poin',       'Poin')         || 0; }

// ─── DRIVE URL ─────────────────────────────
function toDriveDirectUrl(url) {
    if (!url || typeof url !== 'string') return url;

    // Ekstrak file ID dari berbagai format URL Drive
    let fileId = null;

    const m1 = url.match(/\/file\/d\/([^/]+)/);
    if (m1) fileId = m1[1];

    if (!fileId) {
        const m2 = url.match(/[?&]id=([^&]+)/);
        if (m2) fileId = m2[1];
    }

    // Sudah dalam format thumbnail, ambil id-nya saja
    if (!fileId) {
        const m3 = url.match(/thumbnail\?id=([^&]+)/);
        if (m3) fileId = m3[1];
    }

    if (!fileId) return url; // tidak bisa parse, kembalikan apa adanya

    // Pakai format thumbnail — tidak kena CORB, works di semua browser
    return `https://drive.google.com/thumbnail?id=${fileId}&sz=w1280`;
}

// ─── IMAGE UTILS ───────────────────────────
async function compressImage(file, maxWidth = 1280, quality = 0.75) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const r   = new FileReader();
        r.onload  = e => { img.src = e.target.result; };
        r.onerror = reject;
        img.onload = () => {
            const scale  = Math.min(1, maxWidth / img.width);
            const canvas = document.createElement('canvas');
            canvas.width  = img.width  * scale;
            canvas.height = img.height * scale;
            canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
            canvas.toBlob(
                b => b ? resolve(b) : reject(new Error('Compress failed')),
                'image/jpeg', quality
            );
        };
        r.readAsDataURL(file);
    });
}

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload  = () => resolve(r.result.split(',')[1]);
        r.onerror = reject;
        r.readAsDataURL(file);
    });
}

// ─── UPLOAD PHOTO ──────────────────────────
async function uploadPhoto({ sessionId, type, item, penerima, resiNumber, file }) {
    const blob   = await compressImage(file);
    const base64 = await fileToBase64(blob);

    const form = new FormData();
    form.append('sessionId',  sessionId);
    form.append('type',       type);
    form.append('item',       item       || '');
    form.append('resiNumber', resiNumber || '');
    form.append('penerima',   penerima   || '');
    form.append('filename',   file.name);
    form.append('mimeType',   blob.type);
    form.append('base64',     base64);
    form.append('apiKey',     API_KEY);

    const res = await fetch(LINK_GAS, {
        method: 'POST', body: form, redirect: 'follow',
    });
    const text = await res.text();
    let result;
    try { result = JSON.parse(text); }
    catch { throw new Error('Response bukan JSON: ' + text.slice(0, 80)); }

    if (!result.photoUrl) throw new Error('Server tidak mengembalikan photoUrl.');
    return { photoUrl: toDriveDirectUrl(result.photoUrl), item };
}

// ─── SYNC SESSION ──────────────────────────
async function syncSession(session, { onSuccess, onFail } = {}) {
    const sessionId = getSessionID(session);
    try {
        const res = await fetch(`${LINK_GAS}?type=sync_session&key=${API_KEY}`, {
            method: 'POST', redirect: 'follow',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(session),
        });
        const result = await res.json();
        if (result.status !== 'success') throw new Error(result.message);

        // Update status lokal → status tetap DONE, tandai syncStatus
        const all = loadAllSessions();
        const idx = all.findIndex(s => getSessionID(s) === sessionId);
        if (idx > -1) {
            all[idx].syncStatus = 'SYNCED';
            // Jangan override status DONE/PENDING_RESI — hanya tandai sudah tersync
            saveAllSessions(all);
        }

        // Hapus dari queue kalau sebelumnya gagal
        removeFromSyncQueue(sessionId);

        console.log('✅ Sync berhasil:', sessionId);
        if (onSuccess) onSuccess();

    } catch (err) {
        console.error('❌ Sync gagal:', err);

        // Tandai gagal di data lokal
        const all = loadAllSessions();
        const idx = all.findIndex(s => getSessionID(s) === sessionId);
        if (idx > -1) {
            all[idx].syncStatus = 'FAILED';
            saveAllSessions(all);
        }

        // Masukkan ke queue retry
        addToSyncQueue(sessionId);

        if (onFail) onFail(err);
    }
}

// Retry semua sesi yang gagal sync
async function retrySyncQueue(onProgress) {
    const queue = loadSyncQueue();
    if (!queue.length) return { success: 0, failed: 0 };

    const all = loadAllSessions();
    let success = 0, failed = 0;

    for (const sessionId of queue) {
        const session = all.find(s => getSessionID(s) === sessionId);
        if (!session) { removeFromSyncQueue(sessionId); continue; }

        if (onProgress) onProgress(sessionId);
        await syncSession(session, {
            onSuccess: () => success++,
            onFail:    () => failed++,
        });
    }

    return { success, failed };
}

// ─── RESI BADGE ────────────────────────────
function countPendingResi() {
    return loadAllSessions().filter(s => getStatus(s) === 'PENDING_RESI').length;
}

function updateResiNavBadge() {
    const badge = document.getElementById('resi-badge-nav');
    if (!badge) return;
    const n = countPendingResi();
    badge.textContent = n;
    badge.classList.toggle('d-none', n === 0);
}

// ─── NAV GLOBAL ────────────────────────────
document.addEventListener('click', e => {
    const btn = e.target.closest('[data-nav]');
    if (!btn) return;
    const map = {
        dashboard: 'index.html',
        checklist: 'checklist.html',
        resi:      'resi.html',
        history:   'history.html',
    };
    if (map[btn.dataset.nav]) window.location.href = map[btn.dataset.nav];
});

// ─── SEARCHABLE DROPDOWN (Penerima) ────────
let _penerimaNames = [];

async function initPenerimaSearch() {
    const input    = document.getElementById('input-penerima-search');
    const hidden   = document.getElementById('input-penerima');
    if (!input || !hidden) return;

    // Buat dropdown dan mount ke body
    const dropdown = document.createElement('div');
    dropdown.id    = 'penerima-dropdown';
    Object.assign(dropdown.style, {
        position:  'fixed', zIndex: '9999',
        maxHeight: '200px', overflowY: 'auto',
        background: '#fff', display: 'none',
        borderRadius: '10px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
        border: '1px solid var(--border)',
    });
    document.body.appendChild(dropdown);

    function position() {
        const r = input.getBoundingClientRect();
        dropdown.style.top   = r.bottom + 4 + 'px';
        dropdown.style.left  = r.left + 'px';
        dropdown.style.width = r.width + 'px';
    }

    function show() { position(); dropdown.style.display = 'block'; }
    function hide() { dropdown.style.display = 'none'; }

    function render(q) {
        const filtered = q
            ? _penerimaNames.filter(n => n.toLowerCase().includes(q.toLowerCase()))
            : _penerimaNames;
        dropdown.innerHTML = '';
        if (!filtered.length) {
            dropdown.innerHTML = '<div style="padding:10px 14px;color:#888;font-size:13px;">Tidak ditemukan</div>';
            show(); return;
        }
        filtered.forEach(name => {
            const item = document.createElement('div');
            item.textContent = name;
            Object.assign(item.style, {
                padding: '10px 14px', cursor: 'pointer',
                fontSize: '14px', borderBottom: '1px solid #f0f0f0',
            });
            item.addEventListener('mouseenter', () => item.style.background = '#f5f5f5');
            item.addEventListener('mouseleave', () => item.style.background = '');
            item.addEventListener('mousedown', e => {
                e.preventDefault();
                input.value  = name;
                hidden.value = name;
                hide();
                hidden.dispatchEvent(new Event('change'));
            });
            dropdown.appendChild(item);
        });
        show();
    }

    input.addEventListener('input', () => {
        hidden.value = '';
        hidden.dispatchEvent(new Event('change'));
        const q = input.value.trim();
        if (q) render(q); else hide();
    });
    input.addEventListener('focus', () => { if (_penerimaNames.length) render(input.value); });
    input.addEventListener('blur',  () => {
        setTimeout(() => {
            hide();
            if (_penerimaNames.length && !_penerimaNames.includes(input.value)) {
                input.value = ''; hidden.value = '';
                hidden.dispatchEvent(new Event('change'));
            }
        }, 200);
    });
    window.addEventListener('scroll', position, true);
    window.addEventListener('resize', position);

    // Fetch dari server
    input.disabled = true;
    input.placeholder = 'Memuat...';
    try {
        const res    = await fetch(`${LINK_GAS}?action=get_penerima&key=${API_KEY}`, { redirect: 'follow' });
        const text   = await res.text();
        const result = JSON.parse(text);
        if (result.status === 'success') {
            _penerimaNames = (result.data || []).map(String).filter(Boolean);
        }
    } catch (err) {
        console.error('Gagal fetch penerima:', err);
    } finally {
        input.disabled = false;
        input.placeholder = 'Cari penerima...';
    }
}

// ─── PLATFORM / JENIS FILTER ───────────────
function initPlatformJenisFilter() {
    const platform = document.getElementById('input-platform');
    const jenis    = document.getElementById('input-jenis');
    if (!platform || !jenis) return;

    const allOpts     = [...jenis.options];
    const defaultOpt  = allOpts[0];
    jenis.disabled    = true;

    const filterMap = {
        Retur:    ['ARRANET', 'USER', 'ARAHNETS', 'MPN'],
        Aplikasi: ['T1', 'T3', 'M3'],
        TikTok:   ['T1', 'T3', 'M3', 'Thermal', 'Kaos'],
        Shopee:   ['T1', 'T3', 'M3', 'Thermal', 'Kaos'],
    };

    platform.addEventListener('change', () => {
        const allowed = filterMap[platform.value] || [];
        jenis.disabled = !platform.value;
        jenis.innerHTML = '';
        jenis.append(defaultOpt, ...allOpts.filter(o => allowed.includes(o.value)));
        jenis.value = '';
    });
}