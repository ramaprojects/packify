(function () {
    const loggedIn = localStorage.getItem('isLoggedIn') === 'true';
    const operator = localStorage.getItem('packify_operator');
    if (!loggedIn || !operator) {
        window.location.replace('login.html');
    }
})();