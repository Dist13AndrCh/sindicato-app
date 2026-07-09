async function performLogin() {
    const e = document.getElementById('login-email').value;
    const p = document.getElementById('login-pass').value;
    if (!e || !p) return showToast("Complete credenciales");
    showLoading(true);
    try {
        await auth.signInWithEmailAndPassword(e, p);
        toggleLoginModal(false);
        enterAs('admin');
    } catch (err) {
        showToast("Error de acceso: " + err.message);
    }
    showLoading(false);
}

function enterAs(r, isReload = false) {
    sessionStorage.setItem('currentRole', r);
    localStorage.setItem('userRole', r);
    if (r === 'admin') {
        document.getElementById('admin-panel').style.display = 'block';
        document.getElementById('admin-links').style.display = 'flex';
        if (!isReload) openTab('tab-pagos');
        updateAdminStats();
    } else {
        document.getElementById('user-panel').style.display = 'block';
        document.getElementById('user-links').style.display = 'flex';
        if (!isReload) openTab('user-perfil');
    }
    document.getElementById('splash').style.display = 'none';
    document.getElementById('main-nav').style.display = 'flex';
}

function goHome() {
    sessionStorage.removeItem('currentRole');
    sessionStorage.removeItem('currentTab');
    document.querySelectorAll('.container').forEach(c => c.style.display = 'none');
    document.querySelectorAll('.nav-links').forEach(n => n.style.display = 'none');
    document.getElementById('main-nav').style.display = 'none';
    document.getElementById('splash').style.display = 'flex';
    currentUserSocioId = null;
    localStorage.removeItem('userRole');
    localStorage.removeItem('activeTab');
    localStorage.removeItem('activeUserDashboard');
    
    // Clear listeners to save memory and database reads when idle
    clearListeners();
}

function toggleLoginModal(show) {
    document.getElementById('login-modal').style.display = show ? 'flex' : 'none';
    if (show) document.getElementById('login-email').focus();
}