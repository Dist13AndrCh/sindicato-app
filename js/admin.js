function updateAdminStats() {
    if (!pagosCache.length) return;
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    let totalMes = 0;
    let totalAnio = 0;

    pagosCache.forEach(p => {
        if (p.year === currentYear) totalAnio += parseFloat(p.amount || 0);
        if (p.timestamp) {
            const d = p.timestamp.toDate();
            if (d.getFullYear() === currentYear && (d.getMonth() + 1) === currentMonth) {
                totalMes += parseFloat(p.amount || 0);
            }
        }
    });

    document.getElementById('stat-month').innerText = `Bs. ${totalMes}`;
    document.getElementById('stat-socios').innerText = socios.length;
}

async function loadDossierAdmin() {
    const name = document.getElementById('pay-name').value.trim();
    if (!name) return;
    const socio = socios.find(s => s.nombre === name);
    if (!socio) {
        document.getElementById('admin-dossier-view').innerHTML = '<div class="empty-state">Afiliado no encontrado en la base de datos.</div>';
        document.getElementById('admin-pay-management').style.display = 'none';
        return;
    }

    document.getElementById('admin-dossier-view').innerHTML = '<div style="color:var(--text-muted); text-align:center;">Cargando historial...</div>';

    const pagosSocio = pagosCache.filter(p => p.socioId === socio.id);
    const currentYear = new Date().getFullYear();
    let yearsToShow = gestiones.map(g => parseInt(g.val)).sort((a,b) => b - a);
    if(yearsToShow.length === 0) {
        yearsToShow = Array.from({ length: 5 }, (_, i) => currentYear - i);
    }

    let gridHtml = `<div style="padding: 10px; max-height: 300px; overflow-y: auto; overflow-x: hidden; border: 1px solid var(--border); border-radius: var(--radius);">`;
    yearsToShow.forEach(y => {
        gridHtml += `
                <div class="hist-year-row">
                    <div class="hist-label">${y}</div>
                    <div class="hist-months">`;
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

    const listContainer = document.getElementById('admin-pay-management');
    const listEl = document.getElementById('admin-pay-list');
    listContainer.style.display = 'block';

    const pagosOrdenados = [...pagosSocio].sort((a, b) => {
        if (b.year !== a.year) return b.year - a.year;
        return b.month - a.month;
    });

    if (pagosOrdenados.length > 0) {
        const lastP = pagosOrdenados[0];
        let nM = lastP.month + 1;
        let nY = lastP.year;
        if (nM > 12) { nM = 1; nY++; }
        const yOpt = document.querySelector(`#pay-year option[value="${nY}"]`);
        if (yOpt) document.getElementById('pay-year').value = nY;
        document.getElementById('pay-month-start').value = nM;
        document.getElementById('pay-qty').value = (12 - nM + 1);
    } else {
        document.getElementById('pay-month-start').value = 1;
        document.getElementById('pay-qty').value = 12;
    }
    updatePayDisplay();

    if (pagosOrdenados.length === 0) {
        listEl.innerHTML = '<div class="empty-state">Sin pagos registrados.</div>';
    } else {
        listEl.innerHTML = pagosOrdenados.map(p => {
            const mesFmt = (p.month < 10 ? '0' + p.month : p.month) + ' - ' + MESES[p.month - 1].toUpperCase();
            return `
                    <div class="pay-row">
                        <span style="color:var(--text-muted);">${p.year}</span>
                        <span style="font-weight:bold; color:var(--text);">${mesFmt}</span>
                        <span style="color:var(--success);">Bs. ${p.amount}</span>
                        <div style="text-align:right;">
                            <button class="icon-btn edit" aria-label="Editar" onclick="openEditPayModal('${p.id}', ${p.amount}, ${p.month}, ${p.year}, '${p.receiptId}')" title="Editar Pago">✏️</button>
                            <button class="icon-btn delete" aria-label="Eliminar" onclick="deletePayment('${p.id}', '${mesFmt}', ${p.year})" title="Eliminar Pago">🗑️</button>
                        </div>
                    </div>`;
        }).join("");
    }

    const receiptsContainer = document.getElementById('admin-socio-receipts');
    const receiptsListEl = document.getElementById('admin-socio-receipts-list');
    const recibosSocio = recibosCache.filter(r => r.socioId === socio.id);
    const multasSocio = recibosSocio.filter(r => r.isFine);
    const recibosNormales = recibosSocio.filter(r => !r.isFine);

    if (recibosNormales.length > 0) {
        receiptsContainer.style.display = 'block';
        receiptsListEl.innerHTML = recibosNormales.map(r => `
                    <div class="pay-row" style="grid-template-columns: 1fr 1fr 1fr 0.5fr; gap:5px;">
                        <span style="color:var(--text-muted); font-size:0.75rem;">${r.date}</span>
                        <span style="font-weight:bold; color:var(--success);">Bs. ${r.total}</span>
                        <button class="btn-green" style="padding:2px 8px; font-size:0.7rem;" onclick='openReceiptModal(${JSON.stringify(r).replace(/'/g, "&#39;")})'>Ver</button>
                        <button class="icon-btn delete" aria-label="Eliminar" style="padding:2px 8px;" onclick="deleteReceipt('${r.id}', '${r.folio}')" title="Eliminar Factura">🗑️</button>
                    </div>
                `).join("");
    } else {
        receiptsContainer.style.display = 'none';
        receiptsListEl.innerHTML = "";
    }

    if (multasSocio.length > 0) {
        receiptsContainer.style.display = 'block';
        receiptsListEl.innerHTML += `
            <h3 style="color:var(--text-muted); font-size:0.8rem; margin:15px 0 10px 0; border-top: 1px dashed var(--border); padding-top:10px; text-transform:uppercase;">Historial de Cobro de Multas</h3>
            ${multasSocio.map(r => `
                    <div class="pay-row" style="grid-template-columns: 1fr 1fr 1fr 0.5fr; gap:5px; border-left: 3px solid var(--accent);">
                        <span style="color:var(--text-muted); font-size:0.72rem;">${r.date}</span>
                        <span style="font-weight:bold; color:var(--accent);">Bs. ${r.total}</span>
                        <button class="btn-green" style="padding:2px 8px; font-size:0.7rem;" onclick='openReceiptModal(${JSON.stringify(r).replace(/'/g, "&#39;")})'>Ver</button>
                        <button class="icon-btn delete" aria-label="Eliminar" style="padding:2px 8px;" onclick="deleteReceipt('${r.id}', '${r.folio}')">🗑️</button>
                    </div>
                `).join("")}
        `;
    }
}

function openEditPayModal(id, currentAmount, currentMonth, year, receiptId) {
    document.getElementById('edit-pay-id').value = id;
    document.getElementById('edit-pay-amount').value = currentAmount;
    document.getElementById('edit-pay-month').value = currentMonth;
    document.getElementById('edit-pay-old-month').value = currentMonth;
    document.getElementById('edit-pay-year').value = year;
    document.getElementById('edit-pay-receipt-id').value = receiptId || '';
    document.getElementById('edit-amount-modal').style.display = 'flex';
}
function closeEditPayModal() { document.getElementById('edit-amount-modal').style.display = 'none'; }

async function savePaymentCorrection() {
    const pId = document.getElementById('edit-pay-id').value;
    const newAmt = parseFloat(document.getElementById('edit-pay-amount').value);
    const newMonth = parseInt(document.getElementById('edit-pay-month').value);
    const oldMonth = parseInt(document.getElementById('edit-pay-old-month').value);
    const year = parseInt(document.getElementById('edit-pay-year').value);
    const receiptId = document.getElementById('edit-pay-receipt-id').value;

    if (isNaN(newAmt) || newAmt < 0) return showToast("Monto inválido");
    
    showLoading(true);
    try {
        const batch = db.batch();
        batch.update(getPublicRef('pagos').doc(pId), { amount: newAmt, month: newMonth });
        
        if (receiptId) {
            const rData = recibosCache.find(r => r.folio === receiptId);
            if (rData) {
                const oldDesc = `Cuota ${MESES[oldMonth - 1]} ${year}`;
                const newDesc = `Cuota ${MESES[newMonth - 1]} ${year}`;
                
                let itemsUpdated = false;
                const newItems = rData.items.map(i => {
                    if (i.desc === oldDesc) {
                        itemsUpdated = true;
                        return { desc: newDesc, amount: newAmt };
                    }
                    return i;
                });
                
                if (itemsUpdated) {
                    const newTotal = newItems.reduce((acc, curr) => acc + parseFloat(curr.amount || 0), 0);
                    batch.update(getPublicRef('recibos').doc(receiptId), { items: newItems, total: newTotal });
                }
            }
        }
        
        await batch.commit();
        showToast("Pago corregido correctamente");
        closeEditPayModal();
    } catch (e) { showToast("Error al actualizar: " + e.message); }
    showLoading(false);
}

function deletePayment(id, mesStr, year) {
    openConfirm(`¿Eliminar pago de ${mesStr} ${year}?`, async () => {
        showLoading(true);
        try {
            await getPublicRef('pagos').doc(id).delete();
            showToast("Pago eliminado del historial");
        } catch (e) { showToast("Error: " + e.message); }
        showLoading(false);
    });
}

function deleteReceipt(id, folio) {
    openConfirm(`¿Eliminar factura folio ${folio}? Esto no elimina los pagos del historial.`, async () => {
        showLoading(true);
        try {
            await getPublicRef('recibos').doc(id).delete();
            showToast("Factura eliminada");
        } catch (e) { showToast("Error: " + e.message); }
        showLoading(false);
    });
}

async function submitPayment() {
    const socio = socios.find(s => s.nombre === document.getElementById('pay-name').value);
    if (!socio) return showToast("Socio no encontrado");

    const year = parseInt(document.getElementById('pay-year').value);
    const startMonth = parseInt(document.getElementById('pay-month-start').value);
    const qty = parseInt(document.getElementById('pay-qty').value) || 1;
    const payMethod = document.getElementById('pay-method').value;
    const physicalFolio = document.getElementById('pay-physical-folio').value.trim();

    if (!physicalFolio) return showToast("El Nº de Talonario es obligatorio");

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
    const folio = Date.now().toString(36).toUpperCase();
    const itemsRecibo = [];
    let totalRecibo = 0;
    const batch = db.batch();

    for (let i = 0; i < qty; i++) {
        let m = startMonth + i, y = year;
        while (m > 12) { m -= 12; y++; }
        const amount = 10; 
        const docRef = getPublicRef('pagos').doc();
        batch.set(docRef, { socioId: socio.id, year: y, month: m, amount: amount, timestamp: firebase.firestore.FieldValue.serverTimestamp(), receiptId: folio });
        itemsRecibo.push({ desc: `Cuota ${MESES[m - 1]} ${y}`, amount: amount });
        totalRecibo += amount;
    }

    const reciboRef = getPublicRef('recibos').doc(folio);
    const reciboData = { folio: folio, physicalFolio: physicalFolio, socioId: socio.id, socioName: socio.nombre, date: new Date().toLocaleDateString(), timestamp: firebase.firestore.FieldValue.serverTimestamp(), items: itemsRecibo, total: totalRecibo, method: payMethod };
    batch.set(reciboRef, reciboData);
    await batch.commit();

    document.getElementById('pay-physical-folio').value = '';

    showLoading(false);
    showToast("Pago registrado correctamente");
    openReceiptModal(reciboData);
}

function openReceiptModal(data) {
    currentReceiptData = data;
    document.getElementById('rec-folio').innerText = data.folio;
    document.getElementById('rec-physical-folio').innerText = data.physicalFolio || 'S/N';
    document.getElementById('rec-date').innerText = data.date;
    document.getElementById('rec-socio').innerText = data.socioName;
    document.getElementById('rec-total').innerText = data.total;
    document.getElementById('rec-items').innerHTML = data.items.map(i =>
        `<div style="display:flex; justify-content:space-between; font-size:0.9rem;"><span>${i.desc}</span><span>Bs. ${i.amount}</span></div>`
    ).join("");
    
    const isAdminView = document.getElementById('admin-panel').style.display === 'block';
    
    const adminActions = document.getElementById('receipt-admin-actions');
    if (adminActions) adminActions.style.display = isAdminView ? 'flex' : 'none';
    
    const editFolioBtn = document.querySelector('.icon-btn.edit.no-print');
    if (editFolioBtn) editFolioBtn.style.display = isAdminView ? 'inline-block' : 'none';
    
    document.getElementById('receipt-modal').style.display = 'flex';
}

function renderPendingFines() {
    const listEl = document.getElementById('pending-fines-list');
    if (!listEl) return;

    if (!asistenciasCache || asistenciasCache.length === 0) {
        listEl.innerHTML = '<div class="empty-state">No hay multas pendientes registradas.</div>';
        return;
    }

    const pending = asistenciasCache.filter(a => {
        if (a.finePaid === true) return false;
        const isAtraso = a.atr;
        const isFalta = (!a.ini && !a.atr && !a.fin) || (a.ini && !a.fin);
        return isFalta || isAtraso;
    });
    
    if (pending.length === 0) {
        listEl.innerHTML = '<div class="empty-state">Todas las multas de reuniones están pagadas.</div>';
        return;
    }

    let html = `<table class="rep-table" style="width:100%;">
                <thead><tr><th>Socio</th><th>Reunión</th><th>Motivo</th><th>Monto</th><th>Acción</th></tr></thead>
                <tbody>`;
    pending.forEach(p => {
        const socio = socios.find(s => s.id === p.socioId);
        const act = activities.find(a => a.id === p.actId);
        if(!socio || !act) return;

        const isAtraso = p.atr;
        const isFuga = p.ini && !p.fin && !p.atr;

        let motivo = 'Falta';
        let monto = act.fine || 20;
        let btnColor = 'var(--accent)';
        
        if(isAtraso) { 
            motivo = 'Atraso'; 
            monto = act.fineLate || 10; 
            btnColor = 'var(--warning)';
        }
        if(isFuga) { 
            motivo = 'Fuga'; 
        }

        html += `<tr>
                    <td style="text-align:left;">${socio.nombre}</td>
                    <td>${act.name}</td>
                    <td style="color:${btnColor}; font-weight:bold;">${motivo}</td>
                    <td>Bs. ${monto}</td>
                    <td>
                        <button class="btn-ghost" style="padding:4px 10px; font-size:0.7rem; color:${btnColor}; border-color:${btnColor};" onclick="openFineBillingModal('${p.actId}','${p.socioId}','${act.name}', ${monto}, ${isAtraso})">COBRAR</button>
                    </td>
                </tr>`;
    });
    html += '</tbody></table>';
    listEl.innerHTML = html;
}
async function promptEditPhysicalFolio() {
    if (!currentReceiptData) return;
    const newFolio = prompt("Ingrese el nuevo Nº de Talonario Físico:", currentReceiptData.physicalFolio || '');
    if (newFolio !== null && newFolio.trim() !== '') {
        showLoading(true);
        try {
            await getPublicRef('recibos').doc(currentReceiptData.folio).update({ physicalFolio: newFolio.trim() });
            currentReceiptData.physicalFolio = newFolio.trim();
            document.getElementById('rec-physical-folio').innerText = newFolio.trim();
            showToast("Nº de Talonario actualizado");
            // If the search results are open, they might need a refresh but usually receipt modal is standalone
        } catch (e) {
            showToast("Error al actualizar: " + e.message);
        }
        showLoading(false);
    }
}
function closeReceiptModal() { document.getElementById('receipt-modal').style.display = 'none'; }
function updatePayDisplay() { document.getElementById('pay-amount').value = (parseInt(document.getElementById('pay-qty').value) || 1) * 10; }

function printReceipt() {
    const modal = document.getElementById('receipt-modal');
    modal.classList.add('print-visible');
    window.print();
    modal.classList.remove('print-visible');
}

function printReport() { window.print(); }

function shareWhatsApp() {
    if (!currentReceiptData) return;
    const text = `*RECIBO DE PAGO SINDICATO*\nFolio: ${currentReceiptData.folio}\nSocio: ${currentReceiptData.socioName}\nTotal: Bs.${currentReceiptData.total}\nFecha: ${currentReceiptData.date}\n\nGracias por su aporte.`;
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
}

function renderLatestReceipts() {
    const listEl = document.getElementById('latest-receipts-list');
    if (!listEl) return;

    if (recibosCache.length === 0) {
        listEl.innerHTML = '<div class="empty-state">No se han emitido recibos.</div>';
        return;
    }

    // recibosCache is already sorted by timestamp desc from the snapshot
    const latest = recibosCache.slice(0, 5);

    let html = `<table class="rep-table" style="width:100%;">
                <thead><tr><th>Fecha</th><th>Socio</th><th>Folio Físico</th><th>Total</th><th>Acción</th></tr></thead>
                <tbody>`;
    latest.forEach(r => {
        html += `<tr>
                    <td>${r.date}</td>
                    <td style="text-align:left;">${r.socioName}</td>
                    <td style="color:var(--accent); font-weight:bold;">${r.physicalFolio || '-'}</td>
                    <td>Bs. ${r.total}</td>
                    <td>
                        <button class="btn-green" style="padding:4px 10px; font-size:0.7rem;" onclick='openReceiptModal(${JSON.stringify(r).replace(/'/g, "&#39;")})'>Ver</button>
                    </td>
                </tr>`;
    });
    html += '</tbody></table>';
    listEl.innerHTML = html;
}

function searchReceiptsAdmin() {
    const term = document.getElementById('search-receipt-input').value.toUpperCase();
    const resultsDiv = document.getElementById('receipt-search-results');

    if (!term) {
        resultsDiv.innerHTML = '<div class="empty-state">Escriba para buscar recibos...</div>';
        return;
    }

    const matches = recibosCache.filter(r => r.socioName.toUpperCase().includes(term));

    if (matches.length === 0) {
        resultsDiv.innerHTML = '<div class="empty-state">No se encontraron recibos.</div>';
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
                        <button class="btn-red" aria-label="Eliminar" style="padding:4px 10px; font-size:0.7rem; margin-left:5px;" onclick="deleteReceipt('${r.id}', '${r.folio}')">🗑️</button>
                    </td>
                </tr>`;
    });
    html += '</tbody></table>';
    resultsDiv.innerHTML = html;
}

async function loadAssist(aId, name) {
    document.getElementById('assist-card').style.display = 'block';
    document.getElementById('assist-title').innerText = name;
    document.getElementById('assist-title').dataset.aid = aId; 

    const snap = await getPublicRef('asistencias').where('actId', '==', aId).get();
    const asisDocs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const act = activities.find(a => a.id === aId);
    renderAssistTable(asisDocs, aId, name, "", act);
}

function renderAssistTable(asisDocs, aId, name, filterText = "", act = null) {
    if (!act) act = activities.find(a => a.id === aId) || {fine: 20, fineLate: 10};
    const sociosFiltrados = socios.filter(s => s.nombre.includes(filterText.toUpperCase()));

    let pres = 0, faltas = 0, atrasos = 0, proy = 0, cobrado = 0;

    const tbodyHtml = sociosFiltrados.map(s => {
        const asis = asisDocs.find(a => a.socioId === s.id);
        const ini = asis?.ini || false;
        const fin = asis?.fin || false;
        const atr = asis?.atr || false;
        const isPaid = asis?.finePaid === true;

        // Compute final state
        let estadoTxt = 'FALTA';
        let isAtraso = false;
        let isFalta = false;
        let fineToPay = act.fine || 20;

        if (ini && fin) {
            estadoTxt = 'PRESENTE';
            fineToPay = 0;
        } else if (atr) {
            estadoTxt = 'ATRASO';
            isAtraso = true;
            fineToPay = act.fineLate || 10;
        } else if (ini && !fin) {
            estadoTxt = 'FUGA';
            isFalta = true;
            fineToPay = act.fine || 20;
        } else if (!ini && !atr && !fin) {
            estadoTxt = 'FALTA';
            isFalta = true;
            fineToPay = act.fine || 20;
        } else {
            estadoTxt = 'FALTA';
            isFalta = true;
            fineToPay = act.fine || 20;
        }

        // Calculate stats
        if (estadoTxt === 'PRESENTE' && !isAtraso) pres++;
        if (isFalta) faltas++;
        if (isAtraso) atrasos++;
        proy += fineToPay;
        if (isPaid) cobrado += fineToPay;

        const btnHtml = `
            <div style="display:flex; gap:5px; flex-wrap:wrap; justify-content:center;">
                <button class="${ini ? 'btn-green' : 'btn-ghost'}" style="padding:4px 8px; font-size:0.7rem; flex:1;" onclick="toggleAsisBtn('${aId}', '${s.id}', 'ini')">INICIO</button>
                <button class="${fin ? 'btn-green' : 'btn-ghost'}" style="padding:4px 8px; font-size:0.7rem; flex:1;" onclick="toggleAsisBtn('${aId}', '${s.id}', 'fin')">FINAL</button>
                <button class="${atr ? 'btn-red' : 'btn-ghost'}" style="padding:4px 8px; font-size:0.7rem; flex:1; ${atr ? 'background-color:var(--warning); color:#000;' : ''}" onclick="toggleAsisBtn('${aId}', '${s.id}', 'atr')">ATRASO</button>
            </div>
        `;

        let actionHtml = '-';
        if (fineToPay > 0) {
            if (isPaid) {
                actionHtml = `<span style="color:var(--success); font-weight:bold; font-size:0.8rem;">PAGADA (Bs.${fineToPay})</span>`;
            } else {
                const btnColor = isAtraso ? 'var(--warning)' : 'var(--accent)';
                actionHtml = `<button onclick="openFineBillingModal('${aId}','${s.id}','${name}', ${fineToPay}, ${isAtraso})" class="btn-ghost" style="color:${btnColor}; border-color:${btnColor}; padding:2px 8px; font-size:0.7rem;">COBRAR Bs.${fineToPay}</button>`;
            }
        }

        return `
            <tr>
                <td style="text-align:left">${s.nombre}<br><small style="color:var(--text-muted);">${estadoTxt}</small></td>
                <td>${btnHtml}</td>
                <td>${actionHtml}</td>
            </tr>`;
    }).join("");

    document.getElementById('assist-table').innerHTML = `
                <table class="rep-table">
                    <thead><tr><th>Socio</th><th>Asistencia</th><th>Multa / Acción</th></tr></thead>
                    <tbody>${tbodyHtml}</tbody>
                </table>`;

    // Update stats
    if(document.getElementById('astat-pres')) document.getElementById('astat-pres').innerText = pres;
    if(document.getElementById('astat-faltas')) document.getElementById('astat-faltas').innerText = faltas;
    if(document.getElementById('astat-atrasos')) document.getElementById('astat-atrasos').innerText = atrasos;
    if(document.getElementById('astat-proy')) document.getElementById('astat-proy').innerText = 'Bs. ' + proy;
    if(document.getElementById('astat-cobrado')) document.getElementById('astat-cobrado').innerText = 'Bs. ' + cobrado;
}

async function toggleAsisBtn(aId, sId, field) {
    // 1. Encontrar datos actuales en caché
    let asis = asistenciasCache.find(a => a.actId === aId && a.socioId === sId);
    let currentData = asis ? { ...asis } : { ini: false, fin: false, atr: false, finePaid: false };

    // 2. Lógica de Toggle
    currentData[field] = !currentData[field];
    
    // Lógica cruzada
    if (field === 'atr' && currentData.atr) currentData.ini = false;
    if (field === 'ini' && currentData.ini) currentData.atr = false;

    // 3. Actualizar la UI Optimísticamente INMEDIATAMENTE
    if (asis) {
        Object.assign(asis, currentData); // Mutar caché local
    } else {
        asistenciasCache.push({ id: 'temp_' + Date.now(), actId: aId, socioId: sId, ...currentData });
    }
    
    // Re-renderizar la tabla al instante con la caché actualizada
    filterAssistTable();

    // 4. Enviar a Firebase en segundo plano (sin bloquear la UI)
    try {
        const snap = await getPublicRef('asistencias').where('actId', '==', aId).where('socioId', '==', sId).get();
        if (snap.empty) {
            await getPublicRef('asistencias').add({ actId: aId, socioId: sId, ...currentData });
        } else {
            await snap.docs[0].ref.update({ ini: currentData.ini, fin: currentData.fin, atr: currentData.atr });
        }
    } catch (e) {
        console.error("Error updating firebase attendance:", e);
        showToast("Error de conexión al guardar la asistencia");
    }
}

function filterAssistTable() {
    const filter = document.getElementById('assist-filter').value;
    const aId = document.getElementById('assist-title').dataset.aid;
    const name = document.getElementById('assist-title').innerText;
    if (!aId) return;

    // Usar la caché en lugar de hacer fetch a la base de datos
    const asisDocs = asistenciasCache.filter(a => a.actId === aId);
    const act = activities.find(a => a.id === aId);
    renderAssistTable(asisDocs, aId, name, filter, act);
}

async function toggleAsis(aId, sId, name) {
    const snap = await getPublicRef('asistencias').where('actId', '==', aId).where('socioId', '==', sId).get();
    if (snap.empty) await getPublicRef('asistencias').add({ actId: aId, socioId: sId, estado: 'P', finePaid: false });
    else await snap.docs[0].ref.delete();
    filterAssistTable();
}

async function markRemainingAsAbsences() {
    const aId = document.getElementById('assist-title').dataset.aid;
    if (!aId) return;

    openConfirm("¿Marcar FALTAS a todos los socios sin estado definido?", async () => {
        showLoading(true);
        const snap = await getPublicRef('asistencias').where('actId', '==', aId).get();
        const asisDocs = snap.docs.map(d => ({ socioId: d.data().socioId }));
        
        const batch = db.batch();
        let added = 0;
        
        for (const s of socios) {
            if (!asisDocs.some(a => a.socioId === s.id)) {
                const newRef = getPublicRef('asistencias').doc();
                batch.set(newRef, { actId: aId, socioId: s.id, ini: false, fin: false, atr: false, finePaid: false });
                added++;
            }
        }

        if (added > 0) {
            await batch.commit();
            showToast(`${added} faltas registradas.`);
            filterAssistTable();
        } else {
            showToast("Todos los socios ya tienen un estado.");
        }
        showLoading(false);
    });
}

function openFineBillingModal(aId, sId, actName, fineAmount, isAtraso = false) {
    document.getElementById('fine-act-id').value = aId;
    document.getElementById('fine-socio-id').value = sId;
    document.getElementById('fine-act-name').value = actName;
    document.getElementById('fine-amount').value = fineAmount;
    document.getElementById('fine-is-atraso').value = isAtraso ? 'true' : 'false';
    
    const socio = socios.find(s => s.id === sId);
    const sName = socio ? socio.nombre : 'Desconocido';
    const descType = isAtraso ? "Atraso" : "Falta/Fuga";
    
    document.getElementById('fine-billing-desc').innerText = `${descType}: ${actName}\nSocio: ${sName}`;
    
    const folioInput = document.getElementById('fine-physical-folio');
    if(isAtraso) {
        folioInput.placeholder = "Nº Talonario (Opcional para Atrasos)";
    } else {
        folioInput.placeholder = "Nº Talonario (Obligatorio)";
    }
    
    document.getElementById('fine-billing-modal').style.display = 'flex';
}
function closeFineBillingModal() { document.getElementById('fine-billing-modal').style.display = 'none'; }

async function processFinePayment() {
    const aId = document.getElementById('fine-act-id').value;
    const sId = document.getElementById('fine-socio-id').value;
    const actName = document.getElementById('fine-act-name').value;
    const isAtraso = document.getElementById('fine-is-atraso').value === 'true';
    const amount = parseFloat(document.getElementById('fine-amount').value);
    const payMethod = document.getElementById('fine-pay-method').value;
    const physicalFolio = document.getElementById('fine-physical-folio').value.trim();

    if (!isAtraso && !physicalFolio) {
        return showToast("El Nº de Talonario es obligatorio para faltas");
    }

    const socio = socios.find(s => s.id === sId);
    if (!socio) return showToast("Error: Socio no encontrado");

    showLoading(true);
    try {
        const batch = db.batch();
        const snap = await getPublicRef('asistencias').where('actId', '==', aId).where('socioId', '==', sId).get();
        if (snap.empty) batch.set(getPublicRef('asistencias').doc(), { actId: aId, socioId: sId, finePaid: true });
        else batch.update(snap.docs[0].ref, { finePaid: true });

        let reciboData = null;
        if (!isAtraso) {
            const folio = 'M-' + Date.now().toString(36).toUpperCase();
            const reciboRef = getPublicRef('recibos').doc(folio);
            reciboData = { folio: folio, physicalFolio: physicalFolio, socioId: socio.id, socioName: socio.nombre, date: new Date().toLocaleDateString(), timestamp: firebase.firestore.FieldValue.serverTimestamp(), items: [{desc: "Cobro Multa: " + actName, amount: amount}], total: amount, method: payMethod, isFine: true, actId: aId };
            batch.set(reciboRef, reciboData);
        }

        await batch.commit();
        
        document.getElementById('fine-physical-folio').value = '';
        
        showToast("Cobro procesado correctamente");
        closeFineBillingModal();
        
        if (reciboData) {
            openReceiptModal(reciboData);
        }
        
        if (document.getElementById('assist-title').dataset.aid === aId) filterAssistTable();
        // Update pending fines tab if we are there
        renderPendingFines();
    } catch (e) { showToast("Error al procesar cobro: " + e.message); }
    showLoading(false);
}

function switchReportSubTab(t) { 
    const tabs = ['individual', 'general', 'finanzas', 'asistencia', 'maestro', 'recaudos'];
    tabs.forEach(tab => {
        const el = document.getElementById(`sub-tab-${tab}`);
        if(el) el.style.display = t === tab ? 'block' : 'none';
        const btn = document.getElementById(`btn-rep-${tab === 'individual' ? 'ind' : tab === 'general' ? 'gen' : tab === 'finanzas' ? 'fin' : tab === 'asistencia' ? 'asis' : tab === 'maestro' ? 'maestro' : 'rec'}`);
        if(btn) btn.className = `tab-btn ${t === tab ? 'active' : ''}`;
    });
    
    if (t === 'asistencia') {
        const select = document.getElementById('rep-asis-act');
        if (select) {
            select.innerHTML = activities.map(a => `<option value="${a.id}">${a.name} (${a.date})</option>`).join("");
        }
    }
}

async function generateAsisReport() {
    const aId = document.getElementById('rep-asis-act').value;
    const act = activities.find(a => a.id === aId);
    if (!act) return showToast("Seleccione una actividad");

    const showMoney = document.getElementById('rep-asis-show-money').checked;
    
    showLoading(true);
    const snap = await getPublicRef('asistencias').where('actId', '==', aId).get();
    const asisDocs = snap.docs.map(d => d.data());
    showLoading(false);

    let html = `<h3>Lista de Asistencia: ${act.name}</h3>`;
    html += `<p><strong>Fecha:</strong> ${act.date} &nbsp;&nbsp; <strong>Tipo:</strong> ${act.type || 'Ordinaria'}</p>`;
    
    html += `<table class="rep-table" style="width:100%;">
                <thead>
                    <tr>
                        <th>Nº</th>
                        <th style="text-align:left;">Nombre del Afiliado</th>
                        <th>Estado</th>
                        ${showMoney ? '<th>Monto (Bs)</th><th>Pagado</th>' : ''}
                    </tr>
                </thead>
                <tbody>`;
    
    let count = 1;
    let totalCobrado = 0;
    
    socios.forEach(s => {
        const asis = asisDocs.find(a => a.socioId === s.id);
        const ini = asis?.ini || false;
        const fin = asis?.fin || false;
        const atr = asis?.atr || false;
        
        let estadoTxt = 'FALTA';
        let fineToPay = act.fine || 20;
        let isAtraso = false;

        if (ini && fin) {
            estadoTxt = 'PRESENTE';
            fineToPay = 0;
        } else if (atr) {
            estadoTxt = 'ATRASO';
            isAtraso = true;
            fineToPay = act.fineLate || 10;
        } else if (ini && !fin) {
            estadoTxt = 'FUGA';
            fineToPay = act.fine || 20;
        } else if (!ini && !atr && !fin) {
            if (asis) { // exists but empty
                estadoTxt = 'FALTA';
                fineToPay = act.fine || 20;
            } else { // no record at all
                estadoTxt = 'SIN MARCAR';
                fineToPay = 0;
            }
        }
        
        let moneyCols = '';
        if (showMoney) {
            const paid = asis?.finePaid ? 'Sí' : 'No';
            if (asis?.finePaid && fineToPay > 0) totalCobrado += fineToPay;
            moneyCols = `<td>${fineToPay > 0 ? fineToPay : '-'}</td><td>${fineToPay > 0 ? paid : '-'}</td>`;
        }

        html += `<tr>
                    <td>${count++}</td>
                    <td style="text-align:left;">${s.nombre}</td>
                    <td style="font-weight:bold;">${estadoTxt}</td>
                    ${moneyCols}
                 </tr>`;
    });
    
    html += `</tbody></table>`;
    
    if (showMoney) {
        html += `<p style="text-align:right; margin-top:15px; font-weight:bold; font-size:1.2rem;">Total Recaudado: Bs. ${totalCobrado}</p>`;
    }
    
    document.getElementById('report-printable-area').innerHTML = html;
    showToast("Reporte generado, listo para imprimir");
}

function generateFinanzasReport() {
    showLoading(true);
    const agrupar = {};

    recibosCache.forEach(r => {
        if(!r.timestamp) return;
        const d = r.timestamp.toDate();
        const k = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`;
        if(!agrupar[k]) {
            agrupar[k] = { 
                label: `${MESES[d.getMonth()].toUpperCase()} ${d.getFullYear()}`,
                count: 0,
                total: 0
            };
        }
        agrupar[k].count += 1;
        agrupar[k].total += parseFloat(r.total || 0);
    });

    const keys = Object.keys(agrupar).sort().reverse();
    const resDiv = document.getElementById('finanzas-results');

    if(keys.length === 0) {
        resDiv.innerHTML = '<div class="empty-state">No hay recibos registrados aún.</div>';
    } else {
        let html = `<table class="rep-table" style="width:100%; margin-top:15px;">
                    <thead><tr><th>Mes y Año</th><th>Nº Recibos</th><th>Total Recaudado</th></tr></thead>
                    <tbody>`;
        let granTotal = 0;
        keys.forEach(k => {
            html += `<tr>
                        <td style="font-weight:bold;">${agrupar[k].label}</td>
                        <td>${agrupar[k].count}</td>
                        <td style="color:var(--success); font-weight:bold;">Bs. ${agrupar[k].total}</td>
                     </tr>`;
            granTotal += agrupar[k].total;
        });
        html += `</tbody></table>
                 <div style="margin-top:15px; padding:15px; background:var(--surface-1); border:1px solid var(--border); border-radius:var(--radius); text-align:right;">
                     <span style="color:var(--text-muted); font-size:0.9rem; text-transform:uppercase;">Recaudación Histórica Total: </span>
                     <span style="font-size:1.5rem; font-weight:900; color:var(--success);">Bs. ${granTotal}</span>
                 </div>`;
        resDiv.innerHTML = html;
    }
    showLoading(false);
}

async function generateIndReport() {
    const name = document.getElementById('rep-socio-name').value;
    const socio = socios.find(s => s.nombre === name);
    if (!socio) return showToast("Seleccione un afiliado");

    showLoading(true);
    const pagos = pagosCache.filter(p => p.socioId === socio.id);
    const asistencias = asistenciasCache.filter(a => a.socioId === socio.id);
    const misAportes = aportesCache.filter(a => a.socioId === socio.id);

    document.getElementById('print-subtitle').innerText = socio.nombre;

    let html = `<div class="report-section-title">Historial de Pagos Mensuales</div>`;
    gestiones.forEach(g => {
        html += `<p style="margin-top:10px; font-weight:bold;">Gestión ${g.val}</p><table class="rep-table"><thead><tr>`;
        MESES.forEach(m => html += `<th>${m.substring(0, 3)}</th>`);
        html += `</tr></thead><tbody><tr>`;
        for (let m = 1; m <= 12; m++) {
            const p = pagos.find(x => x.year === g.val && x.month === m);
            html += `<td>${p ? 'Bs.' + p.amount : '-'}</td>`;
        }
        html += `</tr></tbody></table>`;
    });

    html += `<div class="report-section-title">Control de Asistencias y Multas</div><table class="rep-table"><thead><tr><th>Reunión / Actividad</th><th>Fecha</th><th>Estado</th><th>Multa</th></tr></thead><tbody>`;
    activities.forEach(act => {
        const asis = asistencias.find(a => a.actId === act.id);
        const pagada = asis?.finePaid === true;
        html += `<tr><td style="text-align:left">${act.name}</td><td>${act.date}</td><td>${asis ? 'Presente' : 'Falta'}</td><td>${asis ? '-' : (pagada ? 'PAGADA (Bs.' + act.fine + ')' : 'DEUDA (Bs.' + act.fine + ')')}</td></tr>`;
    });
    html += `</tbody></table>`;

    html += `<div class="report-section-title">Aportes Extraordinarios (Recaudaciones)</div><table class="rep-table"><thead><tr><th style="text-align:left">Concepto</th><th>Fecha</th><th>Tipo</th><th>Monto</th><th>Estado</th></tr></thead><tbody>`;
    let noRecaudaciones = true;
    recaudacionesCache.forEach(rec => {
        const hasPaid = misAportes.some(a => a.recaudoId === rec.id);
        if (hasPaid || rec.type === 'obligatoria') {
            noRecaudaciones = false;
            const dateStr = rec.timestamp ? new Date(rec.timestamp.seconds * 1000).toLocaleDateString() : '-';
            let status = hasPaid ? `<span style="color:green; font-weight:bold;">PAGADO</span>` : `<span style="color:red; font-weight:bold;">DEUDA</span>`;
            html += `<tr><td style="text-align:left">${rec.title}</td><td>${dateStr}</td><td>${rec.type.toUpperCase()}</td><td>Bs. ${rec.amount}</td><td>${status}</td></tr>`;
        }
    });
    if (noRecaudaciones) html += `<tr><td colspan="5" style="text-align:center;">No registra aportes ni deudas extraordinarias.</td></tr>`;
    html += `</tbody></table>`;

    document.getElementById('rep-visual-content').innerHTML = html;
    showLoading(false);
    showToast("Kardex generado");
}

async function generateGenReport() {
    const year = parseInt(document.getElementById('rep-gen-year').value);
    showLoading(true);
    const allPagos = pagosCache.filter(p => p.year === year);
    document.getElementById('print-subtitle').innerText = "Planilla General " + year;
    let html = `<table class="rep-table"><thead><tr><th>Afiliado</th>`;
    for (let m = 1; m <= 12; m++) html += `<th>${MESES[m-1].substring(0, 3)}</th>`;
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