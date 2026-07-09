function showToast(m) { const c = document.getElementById('toast-container'), t = document.createElement('div'); t.className = 'toast'; t.innerText = m; c.appendChild(t); setTimeout(() => t.remove(), 3000); }
function showLoading(s) { document.getElementById('loading').style.display = s ? 'flex' : 'none'; }
function openConfirm(m, cb) {
    document.getElementById('confirm-title').innerText = "Confirmar Acción";
    document.getElementById('confirm-message').innerText = m;
    document.getElementById('confirm-overlay').style.display = 'flex';
    document.getElementById('confirm-btn-yes').onclick = async () => { await cb(); closeConfirm(); };
}
function closeConfirm() { document.getElementById('confirm-overlay').style.display = 'none'; }
function openCustomInfo(title, msg) {
    document.getElementById('info-title').innerText = title;
    document.getElementById('info-message').innerHTML = msg;
    document.getElementById('info-modal').style.display = 'flex';
}
function closeInfoModal() { document.getElementById('info-modal').style.display = 'none'; }
function openEditModal(id, n) { currentEditingSocioId = id; document.getElementById('modal-edit-input').value = n; document.getElementById('modal-overlay').style.display = 'flex'; }
function closeModal() { document.getElementById('modal-overlay').style.display = 'none'; }

function openThemeModal() { document.getElementById('theme-modal').style.display = 'flex'; }
function closeThemeModal() { document.getElementById('theme-modal').style.display = 'none'; }
function setTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    localStorage.setItem('userTheme', t);
    closeThemeModal();
}
function showInfoModal(msg) { openCustomInfo('Información', msg); }

function openTab(id) {
    sessionStorage.setItem('currentTab', id);
    localStorage.setItem('activeTab', id);
    document.querySelectorAll('.tab-content').forEach(t => t.style.display = 'none');
    document.getElementById(id).style.display = 'block';
    
    // Update active state on dock buttons
    document.querySelectorAll('.dock-btn').forEach(btn => btn.classList.remove('active'));
    const activeBtn = document.querySelector(`.dock-btn[data-target="${id}"]`);
    if(activeBtn) activeBtn.classList.add('active');
}

function handleSearch(el, dId) {
    const v = el.value.toUpperCase();
    const d = document.getElementById(dId);
    if (!v) { d.style.display = 'none'; return; }
    const matches = socios.filter(s => s.nombre.includes(v)).slice(0, 5);
    d.innerHTML = matches.map(s => `<div class="drop-item" onclick="selectDrop('${el.id}','${dId}','${s.nombre}')">${s.nombre}</div>`).join("");
    d.style.display = matches.length ? 'block' : 'none';
}

function selectDrop(iId, dId, n) {
    document.getElementById(iId).value = n;
    document.getElementById(dId).style.display = 'none';
    if (iId === 'pay-name') loadDossierAdmin();
    if (iId === 'user-search-input') loadUserDashboard();
}

function setupKeyboardNav() {
    document.querySelectorAll('.nav-input').forEach(input => {
        input.addEventListener('keydown', (e) => {});
    });
    document.getElementById('login-pass').addEventListener('keyup', e => { if (e.key === 'Enter') performLogin(); });
    document.getElementById('pay-name').addEventListener('keyup', e => { if (e.key === 'Enter' && socios.length > 0) handleSearch(e.target, 'pay-drop'); });
    document.getElementById('user-search-input').addEventListener('keyup', e => { if (e.key === 'Enter') loadUserDashboard(); });
}

function renderSocios() {
    const list = document.getElementById('cfg-socios-list');
    const count = document.getElementById('cfg-socios-count');
    if (count) count.innerText = socios.length;
    
    if (list) {
        list.innerHTML = socios.map(s => `
                <div class="item-row cfg-socio-item" data-name="${s.nombre.toLowerCase()}">
                    <span>${s.nombre}</span>
                    <div style="display:flex; gap:5px;">
                        <button onclick="openEditModal('${s.id}','${s.nombre}')" class="btn-ghost" aria-label="Editar">✏️</button>
                        <button onclick="deleteDoc('socios','${s.id}')" class="btn-ghost" aria-label="Eliminar">🗑️</button>
                    </div>
                </div>`).join("");
        filterCfgSocios(); // apply filter if text is present
    }
}

function filterCfgSocios() {
    const query = document.getElementById('cfg-socio-search').value.toLowerCase();
    const items = document.querySelectorAll('.cfg-socio-item');
    let visibleCount = 0;
    items.forEach(item => {
        if (item.dataset.name.includes(query)) {
            item.style.display = 'flex';
            visibleCount++;
        } else {
            item.style.display = 'none';
        }
    });
    const countSpan = document.getElementById('cfg-socios-count');
    if (countSpan) countSpan.innerText = query ? `${visibleCount} / ${socios.length}` : socios.length;
}

function renderGestiones() {
    const opts = gestiones.map(g => `<option value="${g.val}">${g.val}</option>`).join("");
    ['pay-year', 'rep-gen-year'].forEach(id => { if (document.getElementById(id)) document.getElementById(id).innerHTML = opts; });
    const yList = document.getElementById('cfg-years-list');
    if (yList) yList.innerHTML = gestiones.map(g => `
                <div class="item-row">
                    <span>${g.val}</span>
                    <button onclick="deleteYearSafe('${g.id}', ${g.val})" class="btn-ghost" aria-label="Eliminar">🗑️</button>
                </div>`).join("");
}

function renderActivities() {
    const list = document.getElementById('act-list');
    if (!list) return;
    
    if (activities.length === 0) {
        list.innerHTML = '<div class="empty-state">No hay actividades creadas.</div>';
        return;
    }
    
    list.innerHTML = activities.map(a => `
        <div class="card" style="margin-bottom:10px; padding:10px; cursor:pointer; position:relative; border-left: 4px solid var(--accent);" onclick="loadAssist('${a.id}','${a.name}')">
            <button onclick="event.stopPropagation(); deleteDoc('actividades','${a.id}')" class="icon-btn delete" style="position:absolute; top:10px; right:10px;">🗑️</button>
            <div style="font-weight:bold; font-size:1.1rem; padding-right: 30px;">${a.name}</div>
            <div style="font-size:0.8rem; color:#888; margin-bottom: 5px;">${a.type || 'Ordinaria'} • ${a.date}</div>
            <div style="display:flex; gap:10px; font-size:0.75rem;">
                <span style="background:var(--bg); padding:2px 6px; border-radius:4px;">Multa: Bs.${a.fine || 20}</span>
                <span style="background:var(--bg); padding:2px 6px; border-radius:4px;">Atraso: Bs.${a.fineLate || 10}</span>
            </div>
        </div>
    `).join("");
}

window.currentAvisosFilter = 'all';

function renderNotices(avisos) {
    const readNotices = JSON.parse(localStorage.getItem('read_notices') || '[]');
    
    const isNew = (timestamp) => {
        if (!timestamp) return false;
        const now = new Date().getTime();
        const noticeTime = timestamp.toDate ? timestamp.toDate().getTime() : timestamp;
        return (now - noticeTime) < (24 * 60 * 60 * 1000);
    };

    const buildHtml = (a, forAdmin) => {
        const prioClass = a.priority ? `prio-${a.priority}` : 'prio-info';
        const isRead = readNotices.includes(a.id);
        const cardClasses = `notice-card ${prioClass} ${!forAdmin && isRead ? 'notice-read' : ''}`;
        
        const waText = encodeURIComponent(`*${a.title}*\n\n${a.body}`);
        const waLink = `https://wa.me/?text=${waText}`;

        let actionHtml = '';
        if (forAdmin) {
            const safeA = JSON.stringify(a).replace(/'/g, "&#39;").replace(/"/g, "&quot;");
            actionHtml = `
                <div class="notice-actions">
                    <button class="notice-action-btn btn-delete" onclick="deleteDoc('avisos','${a.id}')">🗑️ Eliminar</button>
                    <button class="notice-action-btn" onclick='editNotice(${safeA})'>✏️ Editar</button>
                    <button class="notice-action-btn" onclick="window.open('${waLink}', '_blank')">📱 WhatsApp</button>
                </div>
            `;
        } else {
            const toggleText = isRead ? '❌ Desmarcar Visto' : '👁️ Marcar como Visto';
            actionHtml = `
                <div class="notice-actions">
                    <button class="notice-action-btn" onclick="toggleNoticeRead('${a.id}')" style="background:var(--card); border:1px solid #555;">${toggleText}</button>
                </div>
            `;
        }

        const newBadge = isNew(a.timestamp) && !isRead && !forAdmin ? `<span class="badge-new">NUEVO</span>` : '';

        return `
        <div class="${cardClasses}">
            ${newBadge}
            <div class="notice-header">
                <div class="notice-title">📢 ${a.title}</div>
                <small>${a.date}</small>
            </div>
            <div class="notice-body">${a.body}</div>
            ${actionHtml}
        </div>`;
    };

    if (document.getElementById('admin-notices-list')) {
        document.getElementById('admin-notices-list').innerHTML = avisos.map(a => buildHtml(a, true)).join("");
    }
    
    if (document.getElementById('user-notices-list')) {
        const searchVal = (document.getElementById('user-notice-search') ? document.getElementById('user-notice-search').value.toLowerCase() : '');
        const filtered = avisos.filter(a => {
            const matchSearch = a.title.toLowerCase().includes(searchVal) || a.body.toLowerCase().includes(searchVal);
            const matchFilter = window.currentAvisosFilter === 'all' || a.priority === window.currentAvisosFilter;
            return matchSearch && matchFilter;
        });
        
        document.getElementById('user-notices-list').innerHTML = filtered.length 
            ? filtered.map(a => buildHtml(a, false)).join("") 
            : '<div class="empty-state">No hay comunicados.</div>';
    }
}

window.filterUserNotices = function(prio) {
    if (prio !== undefined) {
        window.currentAvisosFilter = prio;
    }
    if (window.avisosCache) renderNotices(window.avisosCache);
}

window.toggleNoticeRead = function(id) {
    let readNotices = JSON.parse(localStorage.getItem('read_notices') || '[]');
    const index = readNotices.indexOf(id);
    if (index === -1) {
        readNotices.push(id);
    } else {
        readNotices.splice(index, 1);
    }
    localStorage.setItem('read_notices', JSON.stringify(readNotices));
    if (window.avisosCache) renderNotices(window.avisosCache);
}

function setNoticePriority(prio) {
    document.getElementById('prio-info').classList.remove('active-prio');
    document.getElementById('prio-warn').classList.remove('active-prio');
    document.getElementById('prio-urg').classList.remove('active-prio');
    document.getElementById('prio-' + prio).classList.add('active-prio');
    document.getElementById('notice-priority-input').value = prio;
}

function editNotice(a) {
    document.getElementById('notice-id-input').value = a.id;
    document.getElementById('notice-title-input').value = a.title;
    document.getElementById('notice-body-input').value = a.body;
    setNoticePriority(a.priority || 'info');
    
    document.getElementById('notice-form-title').innerText = "Editar Aviso";
    document.getElementById('btn-publish-notice').innerText = "Guardar Cambios";
    document.getElementById('btn-cancel-notice').style.display = "block";
    
    // Scroll up
    document.getElementById('notice-form-card').scrollIntoView({behavior: "smooth"});
}

function cancelEditNotice() {
    document.getElementById('notice-id-input').value = "";
    document.getElementById('notice-title-input').value = "";
    document.getElementById('notice-body-input').value = "";
    setNoticePriority('info');
    
    document.getElementById('notice-form-title').innerText = "Publicar Aviso";
    document.getElementById('btn-publish-notice').innerText = "Publicar";
    document.getElementById('btn-cancel-notice').style.display = "none";
}

function requestPushPermission() {
    if (!("Notification" in window)) {
        showToast("Este navegador no soporta notificaciones de escritorio");
        return;
    }
    Notification.requestPermission().then(permission => {
        if (permission === "granted") {
            showToast("Notificaciones activadas!");
            if(document.getElementById('btn-push-perm')) document.getElementById('btn-push-perm').style.display = "none";
            if(document.getElementById('btn-push-perm-user')) document.getElementById('btn-push-perm-user').style.display = "none";
        }
    });
}

// Check notification permission on load
document.addEventListener("DOMContentLoaded", () => {
    if ("Notification" in window && Notification.permission !== "granted" && Notification.permission !== "denied") {
        const btn = document.getElementById('btn-push-perm');
        if (btn) btn.style.display = "block";
    }
});