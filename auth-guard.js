(function () {
    // ── Auth check ──────────────────────────────────────────
    const loggedIn = localStorage.getItem('isLoggedIn') === 'true';
    const operator = localStorage.getItem('packify_operator');
    if (!loggedIn || !operator) {
        window.location.replace('login.html');
    }

    // ── Anti-flash: apply theme ASAP sebelum render ─────────
    const theme = localStorage.getItem('packify_theme') || 'light';
    document.documentElement.setAttribute('data-theme', theme);

    // ── ENV banner — tampil di semua halaman saat mode dev ──
    // ENV dibaca dari app.js — inject banner setelah DOM ready
    document.addEventListener('DOMContentLoaded', function () {
        // Baca ENV dari script — cek CONFIG object yang didefinisikan di app.js
        const isDev = (typeof ENV !== 'undefined') && ENV === 'dev';
        if (!isDev) return;

        const banner = document.createElement('div');
        banner.id    = 'env-banner';
        banner.textContent = '⚠️ DEV MODE';
        banner.style.cssText = [
            'position:fixed', 'bottom:72px', 'left:50%',
            'transform:translateX(-50%)',
            'background:#FF6B35', 'color:#fff',
            'font-size:10px', 'font-weight:700',
            'padding:3px 10px', 'border-radius:10px',
            'z-index:9999', 'pointer-events:none',
            'letter-spacing:0.5px', 'opacity:0.9',
        ].join(';');
        document.body.appendChild(banner);
    });
})();