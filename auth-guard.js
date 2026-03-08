(function () {
    // ── Auth check ──────────────────────────────────────────
    const loggedIn = localStorage.getItem('isLoggedIn') === 'true';
    const operator = localStorage.getItem('packify_operator');
    if (!loggedIn || !operator) {
        window.location.replace('login.html');
    }

    // ── Anti-flash: apply theme ASAP sebelum render ─────────
    // Harus di sini (bukan app.js) karena app.js load di akhir body
    const theme = localStorage.getItem('packify_theme') || 'light';
    document.documentElement.setAttribute('data-theme', theme);
})();