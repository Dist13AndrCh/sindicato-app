function init() {
    const savedTheme = localStorage.getItem('userTheme') || 'blue';
    document.documentElement.setAttribute('data-theme', savedTheme);
    showLoading(true);
    auth.onAuthStateChanged(async (user) => {
        if (!user) {
            try {
                await auth.signInAnonymously();
            } catch (e) { console.error(e); }
        } else {
            const role = localStorage.getItem('userRole');
            if (!user.isAnonymous && role === 'admin') {
                enterAs('admin');
                const tab = localStorage.getItem('activeTab');
                if (tab) openTab(tab);
                else openTab('tab-pagos');
            } else if (role === 'user') {
                enterAs('user');
                const tab = localStorage.getItem('activeTab');
                if (tab) openTab(tab);
                else openTab('user-perfil');
                
                const uName = localStorage.getItem('activeUserDashboard');
                if (uName) {
                    document.getElementById('user-search-input').value = uName;
                    let attempts = 0;
                    let checkSocios = setInterval(() => {
                        attempts++;
                        if (socios.length > 0 || attempts > 50) {
                            clearInterval(checkSocios);
                            if (socios.length > 0) loadUserDashboard();
                        }
                    }, 200);
                }
            } else {
                goHome();
            }
        }
        showLoading(false);
    });
    
    try {
        setupListeners();
        setupKeyboardNav();
        
        const savedRole = sessionStorage.getItem('currentRole');
        const savedTab = sessionStorage.getItem('currentTab');
        if (savedRole) {
            enterAs(savedRole, true);
            if (savedTab) openTab(savedTab);
        }
    } catch (e) { console.error(e); }
}

window.onload = init;