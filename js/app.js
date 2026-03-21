let socios = [], gestiones = [], activities = [], pagosCache = [], recibosCache = [], mensajesCache = [];
let currentEditingSocioId = null;
let currentReceiptData = null; // Para el modal
let selectedChatSocioId = null;
let currentUserSocioId = null; // Para el dashboard de usuario

const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

function init() {
    showLoading(true);
    auth.onAuthStateChanged(async (user) => {
        if (!user) {
            try {
                await auth.signInAnonymously();
            } catch (e) { console.error(e); }
        } else {
            const role = localStorage.getItem('userRole');
            if (!user.isAnonymous) {
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
                    let checkSocios = setInterval(() => {
                        if (socios.length > 0) {
                            clearInterval(checkSocios);
                            loadUserDashboard();
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

function setupListeners() {
    getPublicRef('socios').orderBy('nombre').onSnapshot(snap => { socios = snap.docs.map(d => ({ id: d.id, ...d.data() })); renderSocios(); });
    getPublicRef('gestiones').orderBy('val', 'desc').onSnapshot(snap => { gestiones = snap.docs.map(d => ({ id: d.id, ...d.data() })); renderGestiones(); });
    getPublicRef('actividades').orderBy('timestamp', 'desc').onSnapshot(snap => { activities = snap.docs.map(d => ({ id: d.id, ...d.data() })); renderActivities(); });
    getPublicRef('avisos').orderBy('timestamp', 'desc').onSnapshot(snap => { renderNotices(snap.docs.map(d => ({ id: d.id, ...d.data() }))); });

    // Listeners para nuevas funciones
    getPublicRef('pagos').onSnapshot(snap => {
        pagosCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        updateAdminStats(); // Recalcular estadisticas
        // Si el panel de admin está abierto y hay un socio seleccionado, actualizar la lista
        if (document.getElementById('admin-dossier-view').innerHTML !== '' && document.getElementById('pay-name').value) {
            loadDossierAdmin();
        }
    });
    getPublicRef('recibos').orderBy('timestamp', 'desc').onSnapshot(snap => {
        recibosCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        // Auto-refrescar vistas si están activas
        if (document.getElementById('admin-socio-receipts').style.display === 'block') loadDossierAdmin();
        if (document.getElementById('receipt-search-results').innerHTML.includes('table')) searchReceiptsAdmin();
    });
    let isInitialMensajes = true;
    getPublicRef('mensajes').orderBy('timestamp', 'asc').onSnapshot(snap => {
        if (!isInitialMensajes) {
            snap.docChanges().forEach(change => {
                if (change.type === 'added') {
                    const m = change.doc.data();
                    if (m.from === 'user' && !m.read && document.getElementById('admin-panel').style.display === 'block') {
                        showToast("🔔 NUEVO MENSAJE de " + (m.socioName || "Socio"));
                    }
                }
            });
        }
        isInitialMensajes = false;
        
        mensajesCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        if (document.getElementById('admin-panel').style.display === 'block') {
            renderAdminChatThreads();
            if (selectedChatSocioId) selectAdminChat(selectedChatSocioId);
        }
        if (currentUserSocioId) renderUserChat(currentUserSocioId);
    });
}

function setupKeyboardNav() {
    document.querySelectorAll('.nav-input').forEach(input => {
        input.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
                // e.preventDefault(); // Permitir escritura normal
            }
        });
    });

    document.getElementById('login-pass').addEventListener('keyup', e => { if (e.key === 'Enter') performLogin(); });
    document.getElementById('pay-name').addEventListener('keyup', e => { if (e.key === 'Enter' && socios.length > 0) handleSearch(e.target, 'pay-drop'); });
    document.getElementById('user-search-input').addEventListener('keyup', e => { if (e.key === 'Enter') loadUserDashboard(); });
    
    // Mensajes con Enter
    document.getElementById('msg-admin-reply').addEventListener('keyup', e => { if (e.key === 'Enter') sendAdminReply(); });
    document.getElementById('user-msg-input').addEventListener('keyup', e => { if (e.key === 'Enter') sendUserMessage(); });
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
}

function toggleLoginModal(show) {
    document.getElementById('login-modal').style.display = show ? 'flex' : 'none';
    if (show) document.getElementById('login-email').focus();
}

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

function openTab(id) {
    sessionStorage.setItem('currentTab', id);
    localStorage.setItem('activeTab', id);
    document.querySelectorAll('.tab-content').forEach(t => t.style.display = 'none');
    document.getElementById(id).style.display = 'block';
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

// --- FUNCIONES DE ESTADSTICAS DASHBOARD ---
function updateAdminStats() {
    if (!pagosCache.length) return;
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // 1-12

    let totalMes = 0;
    let totalAnio = 0;

    // Filtrar pagos por fecha de registro (timestamp) para saber el flujo de caja real
    pagosCache.forEach(p => {
        if (p.year === currentYear) totalAnio += parseFloat(p.amount || 0);

        // Para el mes, necesitamos mirar el timestamp de creación si existe
        if (p.timestamp) {
            const d = p.timestamp.toDate();
            if (d.getFullYear() === currentYear && (d.getMonth() + 1) === currentMonth) {
                totalMes += parseFloat(p.amount || 0);
            }
        }
    });

    document.getElementById('stat-month').innerText = `Bs. ${totalMes}`;
    document.getElementById('stat-year').innerText = `Bs. ${totalAnio}`;
    document.getElementById('stat-socios').innerText = socios.length;
}

// --- VISTA PREVIA MULTI AÑO ---
async function loadDossierAdmin() {
    const name = document.getElementById('pay-name').value;
    const socio = socios.find(s => s.nombre === name);
    if (!socio) return;

    // 1. Render Grid Visual
    document.getElementById('admin-dossier-view').innerHTML = '<div style="color:#666; text-align:center;">Cargando historial...</div>';

    const pagosSocio = pagosCache.filter(p => p.socioId === socio.id);
    const currentYear = new Date().getFullYear();
    const yearsToShow = Array.from({ length: 5 }, (_, i) => currentYear - i);

    let gridHtml = `<div style="padding: 10px;">`;
    yearsToShow.forEach(y => {
        gridHtml += `
                <div class="hist-year-row">
                    <div class="hist-label">${y}</div>
                    <div class="hist-grid">`;
        for (let m = 1; m <= 12; m++) {
            const pago = pagosSocio.find(p => p.year === y && p.month === m);
            if (pago) {
                gridHtml += `<div class="hist-cell paid" title="Monto: ${pago.amount}">${MESES[m - 1].substring(0, 3)}</div>`;
            } else {
                gridHtml += `<div class="hist-cell">${m}</div>`;
            }
        }
        gridHtml += `</div></div>`;
    });
    gridHtml += `</div>`;
    document.getElementById('admin-dossier-view').innerHTML = gridHtml;

    // 2. Render Lista de Gestión (Editable/Borrable)
    const listContainer = document.getElementById('admin-pay-management');
    const listEl = document.getElementById('admin-pay-list');
    listContainer.style.display = 'block';

    // Ordenar pagos: Año Descendente, luego Mes Descendente
    const pagosOrdenados = [...pagosSocio].sort((a, b) => {
        if (b.year !== a.year) return b.year - a.year;
        return b.month - a.month;
    });

    if (pagosOrdenados.length === 0) {
        listEl.innerHTML = '<div style="text-align:center; padding:10px; color:#555;">Sin pagos registrados.</div>';
    } else {
        listEl.innerHTML = pagosOrdenados.map(p => {
            // Formato Mes: "01 - ENERO"
            const mesFmt = (p.month < 10 ? '0' + p.month : p.month) + ' - ' + MESES[p.month - 1].toUpperCase();
            return `
                    <div class="pay-row">
                        <span style="color:#888;">${p.year}</span>
                        <span style="font-weight:bold; color:#ddd;">${mesFmt}</span>
                        <span style="color:var(--success);">Bs. ${p.amount}</span>
                        <div style="text-align:right;">
                            <button class="icon-btn edit" onclick="openEditPayModal('${p.id}', ${p.amount})" title="Editar Monto">✏️</button>
                            <button class="icon-btn delete" onclick="deletePayment('${p.id}', '${mesFmt}', ${p.year})" title="Eliminar Pago">🗑️</button>
                        </div>
                    </div>`;
        }).join("");
    }

    // 3. Render LISTA DE RECIBOS DEL SOCIO (INYECCIÓN SOLICITADA)
    const receiptsContainer = document.getElementById('admin-socio-receipts');
    const receiptsListEl = document.getElementById('admin-socio-receipts-list');

    // Buscar recibos del socio en el cache
    const recibosSocio = recibosCache.filter(r => r.socioId === socio.id);
    const multasSocio = recibosSocio.filter(r => r.isFine);
    const recibosNormales = recibosSocio.filter(r => !r.isFine);

    if (recibosNormales.length > 0) {
        receiptsContainer.style.display = 'block';
        receiptsListEl.innerHTML = recibosNormales.map(r => `
                    <div class="pay-row" style="grid-template-columns: 1fr 1fr 1fr 0.5fr; gap:5px;">
                        <span style="color:#888; font-size:0.75rem;">${r.date}</span>
                        <span style="font-weight:bold; color:var(--success);">Bs. ${r.total}</span>
                        <button class="btn-green" style="padding:2px 8px; font-size:0.7rem;" onclick='openReceiptModal(${JSON.stringify(r).replace(/'/g, "&#39;")})'>Ver</button>
                        <button class="icon-btn delete" style="padding:2px 8px;" onclick="deleteReceipt('${r.id}', '${r.folio}')" title="Eliminar Factura">🗑️</button>
                    </div>
                `).join("");
    } else {
        receiptsContainer.style.display = 'none';
        receiptsListEl.innerHTML = "";
    }

    // INYECCIÓN: HISTORIAL DE MULTAS (Si existe el contenedor, o agregándolo aquí mismo dinámicamente)
    // Para no romper la UI, agregar el contenido HTML al final del container de recibos si hay multas
    if (multasSocio.length > 0) {
        receiptsContainer.style.display = 'block';
        receiptsListEl.innerHTML += `
            <h3 style="color:#888; font-size:0.8rem; margin:15px 0 10px 0; border-top: 1px dashed #333; padding-top:10px; text-transform:uppercase;">Historial de Cobro de Multas</h3>
            ${multasSocio.map(r => `
                    <div class="pay-row" style="grid-template-columns: 1fr 1fr 1fr 0.5fr; gap:5px; border-left: 3px solid var(--accent);">
                        <span style="color:#888; font-size:0.72rem;">${r.date}</span>
                        <span style="font-weight:bold; color:var(--accent);">Bs. ${r.total}</span>
                        <button class="btn-green" style="padding:2px 8px; font-size:0.7rem;" onclick='openReceiptModal(${JSON.stringify(r).replace(/'/g, "&#39;")})'>Ver</button>
                        <button class="icon-btn delete" style="padding:2px 8px;" onclick="deleteReceipt('${r.id}', '${r.folio}')">🗑️</button>
                    </div>
                `).join("")}
        `;
    }
}

// --- FUNCIÓN DE EDICIÓN DE PAGO (NUEVA UI) ---
function openEditPayModal(id, currentAmount) {
    document.getElementById('edit-pay-id').value = id;
    document.getElementById('edit-pay-amount').value = currentAmount;
    document.getElementById('edit-amount-modal').style.display = 'flex';
}

function closeEditPayModal() {
    document.getElementById('edit-amount-modal').style.display = 'none';
}

async function savePaymentCorrection() {
    const pId = document.getElementById('edit-pay-id').value;
    const newAmt = parseFloat(document.getElementById('edit-pay-amount').value);

    if (isNaN(newAmt) || newAmt < 0) {
        showToast("Monto inválido");
        return;
    }

    showLoading(true);
    try {
        await getPublicRef('pagos').doc(pId).update({ amount: newAmt });
        showToast("Monto corregido correctamente");
        closeEditPayModal();
        loadDossierAdmin(); // Recargar lista
    } catch (e) {
        showToast("Error al actualizar: " + e.message);
    }
    showLoading(false);
}

// --- FUNCIÓN DE BORRADO DE PAGO (NUEVA UI) ---
function deletePayment(id, mesStr, year) {
    openConfirm(`¿Eliminar pago de ${mesStr} ${year}?`, async () => {
        showLoading(true);
        try {
            await getPublicRef('pagos').doc(id).delete();
            showToast("Pago eliminado del historial");
            // No hace falta llamar a loadDossierAdmin manual si el onSnapshot está bien configurado, 
            // pero por seguridad UI lo hacemos en el snapshot listener.
        } catch (e) {
            showToast("Error: " + e.message);
        }
        showLoading(false);
    });
}

// --- NUEVA FUNCIÓN: ELIMINAR RECIBO (FACTURA) ---
function deleteReceipt(id, folio) {
    openConfirm(`¿Eliminar factura folio ${folio}? Esto no elimina los pagos del historial, solo el comprobante.`, async () => {
        showLoading(true);
        try {
            await getPublicRef('recibos').doc(id).delete();
            showToast("Factura eliminada");
            // Las vistas se actualizarán automáticamente por el onSnapshot modificado
        } catch (e) {
            showToast("Error: " + e.message);
        }
        showLoading(false);
    });
}

// --- SISTEMA DE FACTURACIÓN Y PAGOS (MODIFICADO) ---
async function submitPayment() {
    const socio = socios.find(s => s.nombre === document.getElementById('pay-name').value);
    if (!socio) return showToast("Socio no encontrado");

    const year = parseInt(document.getElementById('pay-year').value);
    const startMonth = parseInt(document.getElementById('pay-month-start').value);
    const qty = parseInt(document.getElementById('pay-qty').value) || 1;
    const payMethod = document.getElementById('pay-method').value;

    // Validación de Duplicados
    let duplicados = [];
    for (let i = 0; i < qty; i++) {
        let m = startMonth + i, y = year;
        while (m > 12) { m -= 12; y++; }
        const exists = pagosCache.find(p => p.socioId === socio.id && p.year === y && p.month === m);
        if (exists) duplicados.push(`${MESES[m - 1]} ${y}`);
    }

    if (duplicados.length > 0) {
        openCustomInfo('⚠ ATENCIÓN: DUPLICADOS', `Ya existen pagos registrados para: <br><b>${duplicados.join(', ')}</b>.<br><br>Verifique el historial antes de continuar.`);
        return;
    }

    showLoading(true);
    const folio = Date.now().toString(36).toUpperCase(); // Generar ID único corto
    const itemsRecibo = [];
    let totalRecibo = 0;
    const batch = db.batch(); // Usar batch para atomicidad (todo o nada)

    for (let i = 0; i < qty; i++) {
        let m = startMonth + i, y = year;
        while (m > 12) { m -= 12; y++; }

        const amount = 10; // Monto base, podría ser dinámico
        const docRef = getPublicRef('pagos').doc();
        batch.set(docRef, {
            socioId: socio.id,
            year: y,
            month: m,
            amount: amount,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            receiptId: folio
        });

        itemsRecibo.push({ desc: `Cuota ${MESES[m - 1]} ${y}`, amount: amount });
        totalRecibo += amount;
    }

    // Crear documento de Recibo
    const reciboRef = getPublicRef('recibos').doc(folio);
    const reciboData = {
        folio: folio,
        socioId: socio.id,
        socioName: socio.nombre,
        date: new Date().toLocaleDateString(),
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        items: itemsRecibo,
        total: totalRecibo,
        method: payMethod
    };
    batch.set(reciboRef, reciboData);

    await batch.commit();

    showLoading(false);
    showToast("Pago registrado correctamente");
    loadDossierAdmin();
    openReceiptModal(reciboData);
}

// --- LÓGICA DE RECIBOS ---
function openReceiptModal(data) {
    currentReceiptData = data;
    document.getElementById('rec-folio').innerText = data.folio;
    document.getElementById('rec-date').innerText = data.date;
    document.getElementById('rec-socio').innerText = data.socioName;
    document.getElementById('rec-total').innerText = data.total;
    document.getElementById('rec-items').innerHTML = data.items.map(i =>
        `<div style="display:flex; justify-content:space-between; font-size:0.9rem;"><span>${i.desc}</span><span>Bs. ${i.amount}</span></div>`
    ).join("");
    document.getElementById('receipt-modal').style.display = 'flex';
}

function closeReceiptModal() {
    document.getElementById('receipt-modal').style.display = 'none';
}

function printReceipt() {
    const printContent = document.getElementById('receipt-printable-area').innerHTML;
    document.body.classList.add('printing-receipt'); // Helper class if needed
    // Crear un iframe temporal para imprimir solo el recibo o usar window.print y CSS media
    // Usaremos el enfoque de ocultar todo excepto el recibo via CSS media print
    const overlay = document.getElementById('receipt-modal');
    const originalDisplay = overlay.style.display;

    // Hack simple: Poner el contenido del recibo en el body, imprimir, y restaurar
    // Nota: Para SPAs robustas esto es feo, pero funciona 100% en todos los navegadores sin librerías
    const oldBody = document.body.innerHTML;
    document.body.innerHTML = `<div class="print-visible" style="display:flex; justify-content:center; align-items:flex-start; padding-top:50px;">${printContent}</div>`;
    window.print();
    document.body.innerHTML = oldBody;

    // Re-bind events (porque reemplazamos el body) - En una app real usaríamos CSS @media print mejorado
    // Recargamos la página para asegurar funcionalidad completa tras impresión destructiva
    window.location.reload();
}

function shareWhatsApp() {
    if (!currentReceiptData) return;
    const text = `*RECIBO DE PAGO SINDICATO*\nFolio: ${currentReceiptData.folio}\nSocio: ${currentReceiptData.socioName}\nTotal: Bs.${currentReceiptData.total}\nFecha: ${currentReceiptData.date}\n\nGracias por su aporte.`;
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
}

// --- INYECCIÓN: LÓGICA DE BÚSQUEDA DE RECIBOS ---
function searchReceiptsAdmin() {
    const term = document.getElementById('search-receipt-input').value.toUpperCase();
    const resultsDiv = document.getElementById('receipt-search-results');

    if (!term) {
        resultsDiv.innerHTML = '<p style="color:#666; text-align:center; padding:10px;">Escriba para buscar recibos...</p>';
        return;
    }

    const matches = recibosCache.filter(r => r.socioName.toUpperCase().includes(term));

    if (matches.length === 0) {
        resultsDiv.innerHTML = '<p style="color:#888; text-align:center; padding:10px;">No se encontraron recibos.</p>';
        return;
    }

    let html = `<table class="rep-table" style="width:100%; margin-top:10px;">
                <thead><tr><th>Fecha</th><th>Socio</th><th>Total</th><th>Método</th><th>Acción</th></tr></thead>
                <tbody>`;

    matches.forEach(r => {
        html += `<tr>
                    <td>${r.date}</td>
                    <td style="text-align:left;">${r.socioName}</td>
                    <td>Bs. ${r.total}</td>
                    <td>${r.method || 'N/A'}</td>
                    <td>
                        <button class="btn-green" style="padding:4px 10px; font-size:0.7rem;" onclick='openReceiptModal(${JSON.stringify(r).replace(/'/g, "&#39;")})'>Ver Recibo</button>
                        <button class="btn-red" style="padding:4px 10px; font-size:0.7rem; margin-left:5px;" onclick="deleteReceipt('${r.id}', '${r.folio}')">🗑️</button>
                    </td>
                </tr>`;
    });
    html += '</tbody></table>';
    resultsDiv.innerHTML = html;
}

// --- REPORTES ---
async function generateIndReport() {
    const name = document.getElementById('rep-socio-name').value;
    const socio = socios.find(s => s.nombre === name);
    if (!socio) return showToast("Seleccione un afiliado");

    showLoading(true);
    // Usar cache para velocidad
    const pagos = pagosCache.filter(p => p.socioId === socio.id);
    const snapA = await getPublicRef('asistencias').where('socioId', '==', socio.id).get();
    const asistencias = snapA.docs.map(d => d.data());

    document.getElementById('print-subtitle').innerText = socio.nombre;

    let html = `<div class="report-section-title">Historial de Pagos Mensuales</div>`;

    gestiones.forEach(g => {
        html += `<p style="margin-top:10px; font-weight:bold;">Gestión ${g.val}</p>
                <table class="rep-table"><thead><tr>`;
        MESES.forEach(m => html += `<th>${m.substring(0, 3)}</th>`);
        html += `</tr></thead><tbody><tr>`;
        for (let m = 1; m <= 12; m++) {
            const p = pagos.find(x => x.year === g.val && x.month === m);
            html += `<td>${p ? 'Bs.' + p.amount : '-'}</td>`;
        }
        html += `</tr></tbody></table>`;
    });

    html += `<div class="report-section-title">Control de Asistencias y Multas</div>
            <table class="rep-table">
                <thead><tr><th>Reunión / Actividad</th><th>Fecha</th><th>Estado</th><th>Multa</th></tr></thead>
                <tbody>`;

    activities.forEach(act => {
        const asis = asistencias.find(a => a.actId === act.id);
        const pagada = asis?.finePaid === true;
        html += `
                    <tr>
                        <td style="text-align:left">${act.name}</td>
                        <td>${act.date}</td>
                        <td>${asis ? 'Presente' : 'Falta'}</td>
                        <td>${asis ? '-' : (pagada ? 'PAGADA (Bs.' + act.fine + ')' : 'DEUDA (Bs.' + act.fine + ')')}</td>
                    </tr>`;
    });
    html += `</tbody></table>`;

    document.getElementById('rep-visual-content').innerHTML = html;
    showLoading(false);
    showToast("Kardex generado");
}

async function generateGenReport() {
    const year = parseInt(document.getElementById('rep-gen-year').value);
    showLoading(true);
    // Usar cache filtrada
    const allPagos = pagosCache.filter(p => p.year === year);
    document.getElementById('print-subtitle').innerText = "Planilla General " + year;
    let html = `<table class="rep-table"><thead><tr><th>Afiliado</th>`;
    for (let m = 1; m <= 12; m++) html += `<th>${m}</th>`;
    html += `</tr></thead><tbody>`;
    socios.forEach(s => {
        html += `<tr><td style="text-align:left;">${s.nombre}</td>`;
        for (let m = 1; m <= 12; m++) {
            const p = allPagos.find(x => x.socioId === s.id && x.month === m);
            html += `<td>${p ? p.amount : ''}</td>`;
        }
        html += `</tr>`;
    });
    html += `</tbody></table>`;
    document.getElementById('rep-visual-content').innerHTML = html;
    showLoading(false);
}

// --- DASHBOARD USUARIO CON RECIBOS Y SOPORTE ---
async function loadUserDashboard() {
    const name = document.getElementById('user-search-input').value;
    const socio = socios.find(s => s.nombre === name);
    if (!socio) return showToast("Nombre no válido");

    currentUserSocioId = socio.id;
    localStorage.setItem('activeUserDashboard', socio.nombre);

    showLoading(true);
    const pagos = pagosCache.filter(p => p.socioId === socio.id);
    const snapA = await getPublicRef('asistencias').where('socioId', '==', socio.id).get();
    const asistencias = snapA.docs.map(d => d.data());

    let totalPagados = pagos.length;
    let totalRestantes = (gestiones.length * 12) - totalPagados;
    let totalDeuda = 0; // CONTADOR DE DEUDA INYECTADO

    let html = `
                <div class="stat-grid">
                    <div class="stat-card"><div>Pagados</div><div class="stat-val" style="color:var(--success)">${totalPagados}</div></div>
                    <div class="stat-card"><div>Restantes</div><div class="stat-val" style="color:var(--accent)">${totalRestantes}</div></div>
                </div>`;

    gestiones.forEach(g => {
        html += `<div class="card no-hover"><h3>Gestión ${g.val}</h3><div class="months-grid">`;
        for (let m = 1; m <= 12; m++) {
            const pag = pagos.some(p => p.year === g.val && p.month === m);
            html += `<div class="month-box ${pag ? 'paid' : 'pending'}">${MESES[m - 1].substring(0, 3)}</div>`;
        }
        html += `</div></div>`;
    });

    html += `<div class="card no-hover"><h3>Multas y Reuniones</h3>`;
    activities.forEach(act => {
        const asis = asistencias.find(a => a.actId === act.id);
        const pagada = asis?.finePaid === true;

        // Lógica de cálculo de deuda: Si no hay registro (asis) es FALTA y se suma la multa
        if (!asis) {
            totalDeuda += (parseFloat(act.fine) || 0);
        }

        html += `
                    <div class="item-row">
                        <span>${act.name} (${act.date})</span>
                        <span>
                            ${asis ? '<span class="badge badge-paid">PRESENTE</span>' :
                (pagada ? '<span class="badge badge-paid">M. PAGADA</span>' :
                    `<span class="badge badge-debt">FALTA - Bs.${act.fine}</span>`)}
                        </span>
                    </div>`;
    });
    html += `</div>`; // Cierre card reuniones

    // INYECCIÓN VISUAL DE DEUDA TOTAL
    if (totalDeuda > 0) {
        html += `
                    <div class="debt-container">
                        <div class="debt-title">Total Deuda Acumulada</div>
                        <div class="debt-amount">Bs. ${totalDeuda}</div>
                    </div>`;
    } else {
        html += `
                    <div class="clean-slate">
                        <h3>✅ ¡Felicidades!</h3>
                        <p style="font-size:0.9rem; margin-top:5px; opacity:0.8;">Estás al día con tus obligaciones de asistencia.</p>
                    </div>`;
    }

    document.getElementById('user-dashboard-view').innerHTML = html;

    // Cargar Recibos del Usuario
    const recibosSocio = recibosCache.filter(r => r.socioId === socio.id);
    const multasSocio = recibosSocio.filter(r => r.isFine);
    const recibosNormales = recibosSocio.filter(r => !r.isFine);

    const rList = document.getElementById('user-receipts-list');
    rList.innerHTML = recibosNormales.length ? recibosNormales.map(r => `
                <div class="item-row">
                    <span>${r.date} - Bs.${r.total} (Folio: ${r.folio})</span>
                    <button class="btn-green" onclick='openReceiptModal(${JSON.stringify(r)})'>Ver</button>
                </div>
            `).join("") : '<div style="padding:10px; color:#666; font-size:0.85em;">No hay recibos digitales regulares.</div>';
    
    // Inyección histroial multas usuario
    if (multasSocio.length > 0) {
        rList.innerHTML += `<div style="margin-top:15px; border-top: 1px dashed #333; padding-top:10px;">
            <h3 style="font-size:0.9rem; color:var(--accent); margin-bottom:10px;">Historial de Cobro de Multas</h3>
            ${multasSocio.map(r => `
                <div class="item-row" style="border-left: 3px solid var(--accent);">
                    <span style="font-size:0.9rem;">${r.date} - Bs.${r.total}</span>
                    <button class="btn-ghost" onclick='openReceiptModal(${JSON.stringify(r)})' style="color:var(--accent); border-color:var(--accent);">Ver</button>
                </div>
            `).join("")}
        </div>`;
    }
    document.getElementById('user-receipts-card').style.display = 'block';

    // Activar chat
    document.getElementById('user-support-card').style.display = 'block';
    renderUserChat(socio.id);

    showLoading(false);
}

// --- SISTEMA DE MENSAJERA / SOPORTE ---

function renderUserChat(sId) {
    const chatBox = document.getElementById('user-chat-box');
    const msgs = mensajesCache.filter(m => m.socioId === sId);
    chatBox.innerHTML = msgs.map(m => `
                <div class="chat-msg ${m.from === 'user' ? 'msg-user' : 'msg-admin'}">
                    ${m.text}
                    <span class="msg-meta">${new Date(m.timestamp?.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
            `).join("");
    setTimeout(() => {
        chatBox.scrollTo({ top: chatBox.scrollHeight, behavior: 'smooth' });
    }, 50);
}

async function sendUserMessage() {
    const txt = document.getElementById('user-msg-input').value.trim();
    if (!txt || !currentUserSocioId) return;
    const socio = socios.find(s => s.id === currentUserSocioId);
    await getPublicRef('mensajes').add({
        socioId: currentUserSocioId,
        socioName: socio.nombre,
        text: txt,
        from: 'user',
        read: false,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
    document.getElementById('user-msg-input').value = "";
}

async function sendAdminReply() {
    const txt = document.getElementById('msg-admin-reply').value.trim();
    if (!txt || !selectedChatSocioId) {
        if (!selectedChatSocioId) showToast("Seleccione un socio para responder");
        return;
    }
    const thread = mensajesCache.find(m => m.socioId === selectedChatSocioId);
    const sName = thread ? thread.socioName : "Socio";
    await getPublicRef('mensajes').add({
        socioId: selectedChatSocioId,
        socioName: sName,
        text: txt,
        from: 'admin',
        read: true,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
    document.getElementById('msg-admin-reply').value = "";
}

function renderAdminChatThreads() {
    // Agrupar mensajes por socio para crear hilos
    const threads = {};
    mensajesCache.forEach(m => {
        if (!threads[m.socioId]) threads[m.socioId] = { name: m.socioName, lastMsg: m.text, time: m.timestamp, unread: 0 };
        threads[m.socioId].lastMsg = m.text;
        threads[m.socioId].time = m.timestamp;
        if (m.from === 'user' && !m.read) threads[m.socioId].unread++;
    });

    const list = document.getElementById('msg-threads-list');
    list.innerHTML = Object.keys(threads).map(k => `
                <div class="item-row" onclick="selectAdminChat('${k}')" style="cursor:pointer; ${selectedChatSocioId === k ? 'border-color:var(--accent); background:#151515;' : ''}">
                    <div style="width:100%">
                        <div style="display:flex; justify-content:space-between;">
                            <span style="font-weight:bold;">${threads[k].name}</span>
                            ${threads[k].unread > 0 ? `<span class="badge badge-debt">${threads[k].unread}</span>` : ''}
                        </div>
                        <div style="font-size:0.7rem; color:#666; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${threads[k].lastMsg}</div>
                    </div>
                </div>
            `).join("");
}

function selectAdminChat(sId) {
    selectedChatSocioId = sId;
    renderAdminChatThreads(); // Para actualizar estilo activo
    const chatBox = document.getElementById('msg-admin-view');
    const msgs = mensajesCache.filter(m => m.socioId === sId);

    chatBox.innerHTML = msgs.map(m => `
                <div class="chat-msg ${m.from === 'admin' ? 'msg-user' : 'msg-admin'}"> <!-- Invertido visualmente para admin -->
                    <span style="font-size:0.6rem; color:#aaa; display:block; margin-bottom:2px;">${m.from === 'user' ? 'Socio' : 'Directiva'}</span>
                    ${m.text}
                </div>
            `).join("");
    setTimeout(() => {
        chatBox.scrollTo({ top: chatBox.scrollHeight, behavior: 'smooth' });
    }, 50);

    // Marcar leídos
    msgs.filter(m => m.from === 'user' && !m.read).forEach(m => {
        getPublicRef('mensajes').doc(m.id).update({ read: true });
    });
}

async function sendAdminReply() {
    const txt = document.getElementById('msg-admin-reply').value.trim();
    if (!txt || !selectedChatSocioId) return;
    
    const socio = socios.find(s => s.id === selectedChatSocioId);
    await getPublicRef('mensajes').add({
        socioId: selectedChatSocioId,
        socioName: socio ? socio.nombre : 'Socio',
        text: txt,
        from: 'admin',
        read: true,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
    document.getElementById('msg-admin-reply').value = "";
}

function deleteAdminChat() {
    if (!selectedChatSocioId) return showToast("Seleccione un chat primero");
    openConfirm("¿Eliminar TODA la conversación con este socio?", async () => {
        showLoading(true);
        const msgs = mensajesCache.filter(m => m.socioId === selectedChatSocioId);
        const batch = db.batch();
        msgs.forEach(m => {
            batch.delete(getPublicRef('mensajes').doc(m.id));
        });
        await batch.commit();
        selectedChatSocioId = null;
        document.getElementById('msg-admin-view').innerHTML = "Seleccione un socio para ver el chat.";
        renderAdminChatThreads();
        showLoading(false);
        showToast("Chat eliminado correctamente");
    });
}


// --- GESTIÓN REUNIONES CON FILTRO ---
async function loadAssist(aId, name) {
    document.getElementById('assist-card').style.display = 'block';
    document.getElementById('assist-title').innerText = name;
    document.getElementById('assist-title').dataset.aid = aId; // Guardar ID actual

    const snap = await getPublicRef('asistencias').where('actId', '==', aId).get();
    const asisDocs = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    const act = activities.find(a => a.id === aId);
    renderAssistTable(asisDocs, aId, name, "", act);
}

function renderAssistTable(asisDocs, aId, name, filterText = "", act = null) {
    if (!act) act = activities.find(a => a.id === aId) || {fine: 0};
    const sociosFiltrados = socios.filter(s => s.nombre.includes(filterText.toUpperCase()));

    document.getElementById('assist-table').innerHTML = `
                <table class="rep-table">
                    <thead><tr><th>Socio</th><th>Estado</th><th>Multa</th></tr></thead>
                    <tbody>
                    ${sociosFiltrados.map(s => {
        const asis = asisDocs.find(a => a.socioId === s.id);
        const isPresent = !!asis;
        const isFinePaid = asis?.finePaid === true;
        return `
                            <tr>
                                <td style="text-align:left">${s.nombre}</td>
                                <td><button onclick="toggleAsis('${aId}','${s.id}','${name}')" class="${isPresent ? 'btn-red' : 'btn-ghost'}">${isPresent ? 'P' : 'F'}</button></td>
                                <td>${!isPresent ? (isFinePaid ? `<button class="btn-green">PAGADA</button>` : `<button onclick="openFineBillingModal('${aId}','${s.id}','${name}', ${act.fine})" class="btn-ghost" style="color:var(--accent); border-color:var(--accent);">COBRAR</button>`) : '-'}</td>
                            </tr>`;
    }).join("")}
                    </tbody>
                </table>`;
}

// Filtro de asistencia en tiempo real
async function filterAssistTable() {
    const filter = document.getElementById('assist-filter').value;
    const aId = document.getElementById('assist-title').dataset.aid;
    const name = document.getElementById('assist-title').innerText;
    if (!aId) return;

    const snap = await getPublicRef('asistencias').where('actId', '==', aId).get();
    const asisDocs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const act = activities.find(a => a.id === aId);
    renderAssistTable(asisDocs, aId, name, filter, act);
}

async function toggleAsis(aId, sId, name) {
    const snap = await getPublicRef('asistencias').where('actId', '==', aId).where('socioId', '==', sId).get();
    if (snap.empty) await getPublicRef('asistencias').add({ actId: aId, socioId: sId, finePaid: false });
    else await snap.docs[0].ref.delete();

    filterAssistTable();
}

function openFineBillingModal(aId, sId, actName, fineAmount) {
    document.getElementById('fine-act-id').value = aId;
    document.getElementById('fine-socio-id').value = sId;
    document.getElementById('fine-act-name').value = actName;
    document.getElementById('fine-amount').value = fineAmount;
    const socio = socios.find(s => s.id === sId);
    const sName = socio ? socio.nombre : 'Desconocido';
    document.getElementById('fine-billing-desc').innerText = "Falta: " + actName + "\\nSocio: " + sName;
    document.getElementById('fine-billing-modal').style.display = 'flex';
}

function closeFineBillingModal() {
    document.getElementById('fine-billing-modal').style.display = 'none';
}

async function processFinePayment() {
    const aId = document.getElementById('fine-act-id').value;
    const sId = document.getElementById('fine-socio-id').value;
    const actName = document.getElementById('fine-act-name').value;
    const amount = parseFloat(document.getElementById('fine-amount').value);
    const payMethod = document.getElementById('fine-pay-method').value;

    const socio = socios.find(s => s.id === sId);
    if (!socio) return showToast("Error: Socio no encontrado");

    showLoading(true);
    try {
        const batch = db.batch();

        const snap = await getPublicRef('asistencias').where('actId', '==', aId).where('socioId', '==', sId).get();
        if (snap.empty) {
            batch.set(getPublicRef('asistencias').doc(), { actId: aId, socioId: sId, finePaid: true });
        } else {
            batch.update(snap.docs[0].ref, { finePaid: true });
        }

        const folio = 'M-' + Date.now().toString(36).toUpperCase();
        const reciboRef = getPublicRef('recibos').doc(folio);
        const reciboData = {
            folio: folio,
            socioId: socio.id,
            socioName: socio.nombre,
            date: new Date().toLocaleDateString(),
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            items: [{desc: "Cobro Multa: " + actName, amount: amount}],
            total: amount,
            method: payMethod,
            isFine: true,
            actId: aId
        };
        batch.set(reciboRef, reciboData);

        await batch.commit();
        
        showToast("Multa cobrada correctamente");
        closeFineBillingModal();
        openReceiptModal(reciboData);

        if (document.getElementById('assist-title').dataset.aid === aId) {
            filterAssistTable();
        }
    } catch (e) {
        showToast("Error al cobrar multa: " + e.message);
    }
    showLoading(false);
}

// --- FUNCIONES COMUNES ---
function renderSocios() {
    const list = document.getElementById('cfg-socios-list');
    if (list) list.innerHTML = socios.map(s => `
                <div class="item-row">
                    <span>${s.nombre}</span>
                    <div style="display:flex; gap:5px;">
                        <button onclick="openEditModal('${s.id}','${s.nombre}')" class="btn-ghost">✏️</button>
                        <button onclick="deleteDoc('socios','${s.id}')" class="btn-ghost">🗑️</button>
                    </div>
                </div>`).join("");
}

function renderGestiones() {
    const opts = gestiones.map(g => `<option value="${g.val}">${g.val}</option>`).join("");
    ['pay-year', 'rep-gen-year'].forEach(id => { if (document.getElementById(id)) document.getElementById(id).innerHTML = opts; });
    const yList = document.getElementById('cfg-years-list');
    if (yList) yList.innerHTML = gestiones.map(g => `
                <div class="item-row">
                    <span>${g.val}</span>
                    <button onclick="deleteYearSafe('${g.id}', ${g.val})" class="btn-ghost">🗑️</button>
                </div>`).join("");
}

// Validación de seguridad para borrar años (MODIFICADA CON TOAST)
async function deleteYearSafe(id, yearVal) {
    const hasData = pagosCache.some(p => p.year === yearVal);
    if (hasData) {
        showToast(`Error: No se puede eliminar el año ${yearVal} porque tiene pagos registrados.`);
        return;
    }
    openConfirm(`¿Eliminar gestión ${yearVal}?`, async () => {
        await getPublicRef('gestiones').doc(id).delete();
    });
}

function renderActivities() {
    const list = document.getElementById('act-list');
    if (list) list.innerHTML = activities.map(a => `
                <div class="item-row">
                    <span onclick="loadAssist('${a.id}','${a.name}')" style="cursor:pointer">${a.name}</span>
                    <button onclick="deleteDoc('actividades','${a.id}')" class="btn-ghost">🗑️</button>
                </div>`).join("");
}
function renderNotices(avisos) {
    const html = a => `<div class="notice-card">${auth.currentUser && document.getElementById('admin-panel').style.display === 'block' ? `<button class="delete-notice-btn" onclick="deleteDoc('avisos','${a.id}')">🗑️</button>` : ''}<div class="notice-header"><div class="notice-title">📢 ${a.title}</div><small>${a.date}</small></div><div class="notice-body">${a.body}</div></div>`;
    if (document.getElementById('admin-notices-list')) document.getElementById('admin-notices-list').innerHTML = avisos.map(html).join("");
    if (document.getElementById('user-notices-list')) document.getElementById('user-notices-list').innerHTML = avisos.map(html).join("");
}

async function addSocio() { const n = document.getElementById('cfg-socio-name').value.trim().toUpperCase(); if (n) await getPublicRef('socios').add({ nombre: n }); document.getElementById('cfg-socio-name').value = ""; }
async function addYear() { const y = parseInt(document.getElementById('cfg-new-year').value); if (y) await getPublicRef('gestiones').add({ val: y }); document.getElementById('cfg-new-year').value = ""; }
async function publishNotice() { const t = document.getElementById('notice-title-input').value, b = document.getElementById('notice-body-input').value; if (t && b) await getPublicRef('avisos').add({ title: t, body: b, date: new Date().toLocaleDateString(), timestamp: firebase.firestore.FieldValue.serverTimestamp() }); document.getElementById('notice-title-input').value = ""; document.getElementById('notice-body-input').value = ""; }
async function createActivity() { const n = document.getElementById('act-name').value, d = document.getElementById('act-date').value, f = document.getElementById('act-fine').value; if (n && d) await getPublicRef('actividades').add({ name: n, date: d, fine: parseFloat(f), timestamp: firebase.firestore.FieldValue.serverTimestamp() }); showToast("Reunión creada"); }

// --- SISTEMA DILOGOS Y HELPERS ---
async function deleteDoc(c, id) { openConfirm("¿Eliminar registro?", async () => { showLoading(true); await getPublicRef(c).doc(id).delete(); showLoading(false); }); }

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
async function saveEditSocio() { const n = document.getElementById('modal-edit-input').value.trim().toUpperCase(); if (n) await getPublicRef('socios').doc(currentEditingSocioId).update({ nombre: n }); closeModal(); }
function showToast(m) { const c = document.getElementById('toast-container'), t = document.createElement('div'); t.className = 'toast'; t.innerText = m; c.appendChild(t); setTimeout(() => t.remove(), 3000); }
function showLoading(s) { document.getElementById('loading').style.display = s ? 'flex' : 'none'; }
function printReport() { window.print(); }
function switchReportSubTab(t) { document.getElementById('sub-tab-individual').style.display = t === 'individual' ? 'block' : 'none'; document.getElementById('sub-tab-general').style.display = t === 'general' ? 'block' : 'none'; document.getElementById('btn-rep-ind').className = `tab-btn ${t === 'individual' ? 'active' : ''}`; document.getElementById('btn-rep-gen').className = `tab-btn ${t === 'general' ? 'active' : ''}`; }
function updatePayDisplay() { document.getElementById('pay-amount').value = (parseInt(document.getElementById('pay-qty').value) || 1) * 10; }

window.onload = init;
