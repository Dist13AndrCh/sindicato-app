// Habilitar caché offline nativo de Firebase para cargas instantáneas
try {
    firebase.firestore().enablePersistence({ synchronizeTabs: true })
        .catch((err) => {
            if (err.code === 'failed-precondition') {
                console.warn('Persistencia offline limitada: Múltiples pestañas abiertas.');
            } else if (err.code === 'unimplemented') {
                console.warn('El navegador no soporta persistencia offline.');
            }
        });
} catch (e) {
    console.warn("No se pudo inicializar persistencia (posiblemente ya iniciada)", e);
}

function setupListeners() {
    unsubSocios = getPublicRef('socios').orderBy('nombre').onSnapshot(snap => { socios = snap.docs.map(d => ({ id: d.id, ...d.data() })); renderSocios(); });
    unsubGestiones = getPublicRef('gestiones').orderBy('val', 'desc').onSnapshot(snap => { gestiones = snap.docs.map(d => ({ id: d.id, ...d.data() })); renderGestiones(); });
    unsubActividades = getPublicRef('actividades').orderBy('timestamp', 'desc').onSnapshot(snap => { activities = snap.docs.map(d => ({ id: d.id, ...d.data() })); renderActivities(); });
    let initialAvisosLoad = true;
    unsubAvisos = getPublicRef('avisos').orderBy('timestamp', 'desc').onSnapshot(snap => { 
        window.avisosCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderNotices(window.avisosCache);
        
        if (!initialAvisosLoad && "Notification" in window && Notification.permission === "granted") {
            snap.docChanges().forEach(change => {
                if (change.type === 'added') {
                    const data = change.doc.data();
                    new Notification("Sindicato: Nuevo Aviso", {
                        body: data.title,
                        icon: "img/icon-192.png"
                    });
                }
            });
        }
        initialAvisosLoad = false;
    });

    unsubPagos = getPublicRef('pagos').onSnapshot(snap => {
        pagosCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        updateAdminStats();
        if (document.getElementById('admin-dossier-view').innerHTML !== '' && document.getElementById('pay-name').value) {
            loadDossierAdmin();
        }
    });
    unsubRecibos = getPublicRef('recibos').orderBy('timestamp', 'desc').onSnapshot(snap => {
        recibosCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        if (document.getElementById('admin-socio-receipts').style.display === 'block') loadDossierAdmin();
        if (document.getElementById('receipt-search-results').innerHTML.includes('table')) searchReceiptsAdmin();
        if (typeof renderLatestReceipts === 'function') renderLatestReceipts();
    });

    unsubAsistencias = getPublicRef('asistencias').onSnapshot(snap => {
        asistenciasCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        if (typeof renderPendingFines === 'function') renderPendingFines();
    });

    unsubRecaudaciones = getPublicRef('recaudaciones').orderBy('timestamp', 'desc').onSnapshot(snap => {
        recaudacionesCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        if (typeof renderRecaudacionesList === 'function') renderRecaudacionesList();
    });

    unsubAportes = getPublicRef('aportes').onSnapshot(snap => {
        aportesCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        if (typeof updateRecaudoManagerStats === 'function') updateRecaudoManagerStats();
    });
}

function clearListeners() {
    if(unsubSocios) unsubSocios();
    if(unsubGestiones) unsubGestiones();
    if(unsubActividades) unsubActividades();
    if(unsubAvisos) unsubAvisos();
    if(unsubPagos) unsubPagos();
    if(unsubRecibos) unsubRecibos();
    if(unsubAsistencias) unsubAsistencias();
    if(unsubRecaudaciones) unsubRecaudaciones();
    if(unsubAportes) unsubAportes();
}

async function addSocio() { 
    const n = document.getElementById('cfg-socio-name').value.trim().toUpperCase(); 
    if (!n) { showToast("El nombre no puede estar vacío"); return; }
    if (socios.some(s => s.nombre === n)) { showToast("El socio ya existe"); return; }
    
    showLoading(true);
    try {
        await getPublicRef('socios').add({ nombre: n }); 
        document.getElementById('cfg-socio-name').value = ""; 
        showToast("Socio añadido");
    } catch (e) {
        showToast("Error al añadir socio");
    } finally {
        showLoading(false);
    }
}

async function addYear() { 
    const y = parseInt(document.getElementById('cfg-new-year').value); 
    if (!y || y < 2000 || y > 2100) { showToast("Año inválido"); return; }
    if (gestiones.some(g => g.val === y)) { showToast("La gestión ya existe"); return; }
    
    showLoading(true);
    try {
        await getPublicRef('gestiones').add({ val: y }); 
        document.getElementById('cfg-new-year').value = ""; 
        showToast("Gestión añadida");
    } catch (e) {
        showToast("Error al añadir gestión");
    } finally {
        showLoading(false);
    }
}

function downloadBackup() {
    const backupData = {
        fecha: new Date().toISOString(),
        socios: socios,
        gestiones: gestiones,
        actividades: activities,
        pagos: pagosCache,
        asistencias: asistenciasCache,
        recibos: recibosCache,
        avisos: window.avisosCache,
        recaudaciones: typeof recaudacionesCache !== 'undefined' ? recaudacionesCache : [],
        aportes: typeof aportesCache !== 'undefined' ? aportesCache : []
    };
    
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData, null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", `backup_sindicato_${new Date().toISOString().split('T')[0]}.json`);
    dlAnchorElem.click();
    showToast("Respaldo descargado");
}

async function processBackupFile(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (!confirm("⚠️ ADVERTENCIA: Restaurar un respaldo SOBREESCRIBIRÁ los datos actuales. ¿Estás seguro de continuar?")) {
        event.target.value = "";
        return;
    }

    showLoading(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const data = JSON.parse(e.target.result);
            if (!data.socios) throw new Error("Formato inválido");

            const collections = ['socios', 'gestiones', 'actividades', 'pagos', 'asistencias', 'recibos', 'avisos'];
            let promises = [];

            for (const col of collections) {
                if (data[col] && Array.isArray(data[col])) {
                    data[col].forEach(item => {
                        if (item.id) {
                            const id = item.id;
                            const docData = { ...item };
                            delete docData.id;
                            promises.push(getPublicRef(col).doc(id).set(docData));
                        }
                    });
                }
            }
            
            await Promise.all(promises);
            showLoading(false);
            showToast("Respaldo restaurado exitosamente");
            event.target.value = "";
        } catch (err) {
            console.error("Error importando backup:", err);
            showLoading(false);
            showToast("Error: Archivo de respaldo inválido");
        }
    };
    reader.readAsText(file);
}
async function publishNotice() {
    const id = document.getElementById('notice-id-input').value;
    const t = document.getElementById('notice-title-input').value;
    const b = document.getElementById('notice-body-input').value;
    const p = document.getElementById('notice-priority-input').value || 'info';

    if (t && b) {
        if (id) {
            await getPublicRef('avisos').doc(id).update({
                title: t,
                body: b,
                priority: p,
                date: new Date().toLocaleString()
            });
            showToast("Aviso actualizado");
        } else {
            await getPublicRef('avisos').add({
                title: t,
                body: b,
                priority: p,
                date: new Date().toLocaleString(),
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });
            showToast("Aviso publicado");
        }
        cancelEditNotice();
    }
}
async function createActivity() {
    const n = document.getElementById('act-name').value.trim();
    const d = document.getElementById('act-date').value;
    const t = document.getElementById('act-type').value;
    const f = document.getElementById('act-fine').value;
    const fl = document.getElementById('act-fine-late').value;
    if (n && d) {
        showLoading(true);
        await getPublicRef('actividades').add({
            name: n,
            date: d,
            type: t,
            fine: parseFloat(f) || 20,
            fineLate: parseFloat(fl) || 10,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
        showLoading(false);
        showToast("Actividad creada");
        document.getElementById('act-name').value = '';
    } else {
        showToast("Complete nombre y fecha");
    }
}
async function deleteDoc(c, id) { openConfirm("¿Eliminar registro?", async () => { showLoading(true); await getPublicRef(c).doc(id).delete(); showLoading(false); }); }
async function saveEditSocio() { const n = document.getElementById('modal-edit-input').value.trim().toUpperCase(); if (n) await getPublicRef('socios').doc(currentEditingSocioId).update({ nombre: n }); closeModal(); }

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