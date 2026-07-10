// Lógica del Módulo de Recaudaciones y Reporte Maestro

async function createRecaudo() {
    const title = document.getElementById('rec-title').value.trim();
    const motive = document.getElementById('rec-motive').value.trim();
    const amount = parseFloat(document.getElementById('rec-amount').value);
    const type = document.getElementById('rec-type').value;

    if (!title || !motive || isNaN(amount) || amount <= 0) {
        return showToast("Completa todos los campos correctamente.");
    }

    showLoading(true);
    try {
        await getPublicRef('recaudaciones').add({
            title: title,
            motive: motive,
            amount: amount,
            type: type,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
        showToast("Recaudación creada con éxito.");
        document.getElementById('rec-title').value = '';
        document.getElementById('rec-motive').value = '';
        document.getElementById('rec-amount').value = '';
    } catch (e) {
        console.error("Error creating recaudo:", e);
        showToast("Error de conexión.");
    } finally {
        showLoading(false);
    }
}

function renderRecaudacionesList() {
    const listEl = document.getElementById('recaudaciones-list');
    const selEl = document.getElementById('rep-rec-sel');
    if (!listEl) return;

    if (recaudacionesCache.length === 0) {
        listEl.innerHTML = '<div class="empty-state">No hay recaudaciones creadas.</div>';
        if(selEl) selEl.innerHTML = '';
        return;
    }

    let html = '';
    let optHtml = '';
    recaudacionesCache.forEach(r => {
        const isOblig = r.type === 'obligatoria';
        const color = isOblig ? 'var(--accent)' : 'var(--info)';
        const dateStr = r.timestamp ? new Date(r.timestamp.seconds * 1000).toLocaleDateString() : 'Pendiente';
        html += `
            <div class="item-row" style="border-left: 4px solid ${color}; margin-bottom: 10px; cursor: pointer;" onclick="openRecaudoManager('${r.id}')">
                <div style="flex:1;">
                    <strong style="color:var(--text); font-size:1rem;">${r.title}</strong><br>
                    <small style="color:var(--text-muted);">${r.motive}</small><br>
                    <span style="font-size:0.75rem; background:rgba(255,255,255,0.1); padding:2px 6px; border-radius:10px;">${isOblig ? 'Obligatoria' : 'Voluntaria'}</span>
                    <span style="font-size:0.75rem; color:#888;">${dateStr}</span>
                </div>
                <div style="text-align:right;">
                    <span style="color:var(--success); font-weight:bold; font-size:1.1rem;">Bs. ${r.amount}</span><br>
                    <button class="btn-ghost" style="padding:4px 8px; font-size:0.75rem; margin-top:5px;">Gestionar</button>
                </div>
            </div>`;
        optHtml += `<option value="${r.id}">${r.title} (${dateStr})</option>`;
    });
    listEl.innerHTML = html;
    if(selEl) selEl.innerHTML = optHtml;
}

let currentRecaudoId = null;

function openRecaudoManager(id) {
    currentRecaudoId = id;
    const rec = recaudacionesCache.find(r => r.id === id);
    if (!rec) return;

    document.getElementById('recaudo-title').innerText = rec.title;
    document.getElementById('recaudo-title').dataset.rid = id;
    document.getElementById('recaudo-filter').value = '';
    
    document.getElementById('recaudo-manager-card').style.display = 'block';
    // Desplazar la vista hacia el manager
    document.getElementById('recaudo-manager-card').scrollIntoView({ behavior: 'smooth' });

    filterRecaudoTable();
}

function filterRecaudoTable() {
    const filter = document.getElementById('recaudo-filter').value.toLowerCase();
    const id = currentRecaudoId;
    const rec = recaudacionesCache.find(r => r.id === id);
    if (!rec) return;

    const isOblig = rec.type === 'obligatoria';
    const aportes = aportesCache.filter(a => a.recaudoId === id);

    let html = '';
    
    // Sort socios alphabetically
    const sortedSocios = [...socios].sort((a, b) => a.nombre.localeCompare(b.nombre));

    sortedSocios.forEach(s => {
        if (!s.nombre.toLowerCase().includes(filter)) return;

        const aporte = aportes.find(a => a.socioId === s.id);
        const hasPaid = !!aporte;

        let statusHtml = '';
        let actionHtml = '';

        if (hasPaid) {
            statusHtml = `<span style="color:var(--success); font-weight:bold; font-size:0.8rem;">PAGADO</span>`;
            actionHtml = `<button onclick="toggleAporte('${id}', '${s.id}', true, '${aporte.id}')" class="btn-ghost" style="color:var(--accent); border-color:var(--accent); padding:4px 8px; font-size:0.75rem;">Deshacer</button>`;
        } else {
            if (isOblig) {
                statusHtml = `<span style="color:var(--accent); font-weight:bold; font-size:0.8rem;">DEBE Bs.${rec.amount}</span>`;
            } else {
                statusHtml = `<span style="color:#888; font-size:0.8rem;">-</span>`;
            }
            actionHtml = `<button onclick="toggleAporte('${id}', '${s.id}', false)" class="btn-green" style="padding:4px 8px; font-size:0.75rem;">Aportar Bs.${rec.amount}</button>`;
        }

        html += `
            <div class="pay-row" style="grid-template-columns: 2fr 1fr 1fr;">
                <span style="color:var(--text); font-weight:bold; font-size:0.85rem;">${s.nombre}</span>
                <span>${statusHtml}</span>
                <div style="text-align:right;">${actionHtml}</div>
            </div>`;
    });

    document.getElementById('recaudo-table').innerHTML = html;
    updateRecaudoManagerStats();
}

async function toggleAporte(rId, sId, isRemoving, aporteId = null) {
    // Actualización optimista
    if (isRemoving) {
        const idx = aportesCache.findIndex(a => a.id === aporteId);
        if(idx !== -1) aportesCache.splice(idx, 1);
    } else {
        aportesCache.push({
            id: 'temp_' + Date.now(),
            recaudoId: rId,
            socioId: sId,
            timestamp: { seconds: Date.now() / 1000 }
        });
    }
    filterRecaudoTable();

    try {
        if (isRemoving) {
            await getPublicRef('aportes').doc(aporteId).delete();
        } else {
            await getPublicRef('aportes').add({
                recaudoId: rId,
                socioId: sId,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });
        }
    } catch (e) {
        console.error("Error toggle aporte:", e);
        showToast("Error al guardar el aporte.");
    }
}

function updateRecaudoManagerStats() {
    if (!currentRecaudoId) return;
    const rec = recaudacionesCache.find(r => r.id === currentRecaudoId);
    if (!rec) return;

    const aportes = aportesCache.filter(a => a.recaudoId === currentRecaudoId);
    const isOblig = rec.type === 'obligatoria';

    const totalAportantes = aportes.length;
    const montoRecaudado = totalAportantes * rec.amount;
    
    document.getElementById('rstat-aportantes').innerText = totalAportantes;
    document.getElementById('rstat-monto').innerText = `Bs. ${montoRecaudado}`;

    if (isOblig) {
        const pendientes = socios.length - totalAportantes;
        const montoDeuda = pendientes * rec.amount;
        document.getElementById('rstat-deuda-card').style.display = 'block';
        document.getElementById('rstat-deuda').innerText = `${pendientes} (Bs. ${montoDeuda})`;
    } else {
        document.getElementById('rstat-deuda-card').style.display = 'none';
    }
}

function generateRecaudoReport() {
    const id = document.getElementById('rep-rec-sel').value;
    if (!id) return showToast("Seleccione una recaudación.");
    const rec = recaudacionesCache.find(r => r.id === id);
    if (!rec) return;

    const aportes = aportesCache.filter(a => a.recaudoId === id);
    const sortedSocios = [...socios].sort((a, b) => a.nombre.localeCompare(b.nombre));

    let html = `
        <h3 style="text-align:center;">Detalle de Recaudación: ${rec.title}</h3>
        <p style="text-align:center; font-size:0.9rem; color:#555;">Motivo: ${rec.motive} | Tipo: ${rec.type.toUpperCase()} | Monto c/u: Bs.${rec.amount}</p>
        <p style="text-align:center; font-size:1rem; font-weight:bold; margin-bottom: 20px;">Total Recaudado: Bs.${aportes.length * rec.amount} (${aportes.length} aportantes)</p>
        
        <table style="width:100%; border-collapse: collapse; font-size: 10pt; color:#000;">
            <thead>
                <tr style="background:#eee; text-align:left;">
                    <th style="padding:8px; border:1px solid #ccc; width: 10%;">Nº</th>
                    <th style="padding:8px; border:1px solid #ccc; width: 60%;">Nombre del Afiliado</th>
                    <th style="padding:8px; border:1px solid #ccc; width: 30%;">Estado</th>
                </tr>
            </thead>
            <tbody>
    `;

    let counter = 1;
    sortedSocios.forEach(s => {
        const hasPaid = aportes.some(a => a.socioId === s.id);
        
        if (hasPaid) {
            html += `
                <tr>
                    <td style="padding:6px; border:1px solid #ccc; text-align:center;">${counter++}</td>
                    <td style="padding:6px; border:1px solid #ccc; font-weight:bold;">${s.nombre}</td>
                    <td style="padding:6px; border:1px solid #ccc; color:green; font-weight:bold;">PAGADO (Bs.${rec.amount})</td>
                </tr>`;
        } else if (rec.type === 'obligatoria') {
            html += `
                <tr>
                    <td style="padding:6px; border:1px solid #ccc; text-align:center;">${counter++}</td>
                    <td style="padding:6px; border:1px solid #ccc;">${s.nombre}</td>
                    <td style="padding:6px; border:1px solid #ccc; color:red; font-weight:bold;">DEBE (Bs.${rec.amount})</td>
                </tr>`;
        }
    });

    html += `</tbody></table>`;
    document.getElementById('rep-visual-content').innerHTML = html;
    document.getElementById('print-main-title').innerText = "Reporte de Recaudación";
    document.getElementById('print-subtitle').innerText = "";
    document.getElementById('report-printable-area').style.display = 'block';
}

function generateMaestroReport() {
    showLoading(true);
    
    // Generación asíncrona para no bloquear UI principal por cálculos masivos
    setTimeout(() => {
        const sortedSocios = [...socios].sort((a, b) => a.nombre.localeCompare(b.nombre));
        const totalGestiones = gestiones.length;
        const cuotasExigibles = totalGestiones * 12;

        let html = `
            <table style="width:100%; border-collapse: collapse; font-size: 8pt; color:#000;">
                <thead>
                    <tr style="background:#eee; text-align:center; font-weight:bold;">
                        <td style="padding:6px; border:1px solid #ccc;" rowspan="2">Socio</td>
                        <td style="padding:6px; border:1px solid #ccc;" colspan="2">Cuotas</td>
                        <td style="padding:6px; border:1px solid #ccc;" colspan="3">Reuniones</td>
                        <td style="padding:6px; border:1px solid #ccc;" colspan="2">Multas (Bs)</td>
                        <td style="padding:6px; border:1px solid #ccc;" colspan="2">Recaudaciones (Bs)</td>
                        <td style="padding:6px; border:1px solid #ccc; background:#ddd;" rowspan="2">TOTAL MORA</td>
                    </tr>
                    <tr style="background:#f5f5f5; text-align:center; font-weight:bold; font-size:7pt;">
                        <td style="padding:4px; border:1px solid #ccc; color:green;">Pagadas</td>
                        <td style="padding:4px; border:1px solid #ccc; color:red;">Faltan</td>
                        
                        <td style="padding:4px; border:1px solid #ccc; color:green;">P.</td>
                        <td style="padding:4px; border:1px solid #ccc; color:orange;">Atr.</td>
                        <td style="padding:4px; border:1px solid #ccc; color:red;">F.</td>
                        
                        <td style="padding:4px; border:1px solid #ccc; color:green;">Pag.</td>
                        <td style="padding:4px; border:1px solid #ccc; color:red;">Debe</td>
                        
                        <td style="padding:4px; border:1px solid #ccc; color:green;">Aportó</td>
                        <td style="padding:4px; border:1px solid #ccc; color:red;">Debe</td>
                    </tr>
                </thead>
                <tbody>
        `;

        let gTotDeuda = 0;

        sortedSocios.forEach(s => {
            // 1. Cuotas
            const cPagadas = pagosCache.filter(p => p.socioId === s.id).length;
            const cFaltan = cuotasExigibles - cPagadas;

            // 2. Reuniones y Multas
            let asisTotal = 0, atrTotal = 0, faltasTotal = 0;
            let multasDebe = 0, multasPagadas = 0;
            
            // Evaluamos la asistencia usando la misma lógica que el dashboard de usuario
            activities.forEach(act => {
                const a = asistenciasCache.find(as => as.actId === act.id && as.socioId === s.id);
                const fine = parseFloat(act.fine) || 20;
                const fineLate = parseFloat(act.fineLate) || 10;
                
                if (!a) {
                    faltasTotal++;
                    multasDebe += fine;
                } else {
                    const pF = !(a.ini) && !(a.atr);
                    const aF = !(a.fin);
                    const tF = (pF ? 1 : 0) + (aF ? 1 : 0);
                    
                    if (tF === 0 && !a.atr) {
                        asisTotal++;
                    } else if (tF === 0 && a.atr) {
                        atrTotal++;
                        if(a.finePaid) multasPagadas += fineLate;
                        else multasDebe += fineLate;
                    } else if (tF === 1 && !pF) { // Fuga
                        faltasTotal++;
                        if(a.finePaid) multasPagadas += fine;
                        else multasDebe += fine;
                    } else { // Falta completa (aunque haya ido solo al final)
                        faltasTotal++;
                        if(a.finePaid) multasPagadas += fine;
                        else multasDebe += fine;
                    }
                }
            });

            // 3. Recaudaciones
            let recAporto = 0, recDebe = 0;
            recaudacionesCache.forEach(r => {
                const hasPaid = aportesCache.some(ap => ap.recaudoId === r.id && ap.socioId === s.id);
                if (hasPaid) {
                    recAporto += r.amount;
                } else if (r.type === 'obligatoria') {
                    recDebe += r.amount;
                }
            });

            const totalMora = (cFaltan * 10) + multasDebe + recDebe; // Asumiendo 10 Bs por cuota estándar (modificar si varía)
            gTotDeuda += totalMora;

            html += `
                <tr style="text-align:center;">
                    <td style="padding:4px; border:1px solid #ccc; text-align:left; font-weight:bold;">${s.nombre}</td>
                    
                    <td style="padding:4px; border:1px solid #ccc;">${cPagadas}</td>
                    <td style="padding:4px; border:1px solid #ccc; font-weight:bold; ${cFaltan>0?'color:red':''}">${cFaltan}</td>
                    
                    <td style="padding:4px; border:1px solid #ccc;">${asisTotal}</td>
                    <td style="padding:4px; border:1px solid #ccc;">${atrTotal}</td>
                    <td style="padding:4px; border:1px solid #ccc; ${faltasTotal>0?'color:red':''}">${faltasTotal}</td>
                    
                    <td style="padding:4px; border:1px solid #ccc;">${multasPagadas}</td>
                    <td style="padding:4px; border:1px solid #ccc; font-weight:bold; ${multasDebe>0?'color:red':''}">${multasDebe}</td>
                    
                    <td style="padding:4px; border:1px solid #ccc;">${recAporto}</td>
                    <td style="padding:4px; border:1px solid #ccc; font-weight:bold; ${recDebe>0?'color:red':''}">${recDebe}</td>
                    
                    <td style="padding:4px; border:1px solid #ccc; background:#eee; font-weight:bold; font-size:9pt; ${totalMora>0?'color:red':'color:green'}">${totalMora>0 ? 'Bs.'+totalMora : 'AL DÍA'}</td>
                </tr>
            `;
        });

        html += `
                </tbody>
            </table>
            <p style="text-align:right; font-weight:bold; font-size:11pt; margin-top:15px;">TOTAL DEUDA GLOBAL PROYECTADA: Bs. ${gTotDeuda}</p>
        `;

        document.getElementById('rep-visual-content').innerHTML = html;
        document.getElementById('print-main-title').innerText = "Reporte Maestro (Global de Socios)";
        const d = new Date();
        document.getElementById('print-subtitle').innerText = `Generado el: ${d.toLocaleDateString()} a las ${d.toLocaleTimeString()}`;
        document.getElementById('report-printable-area').style.display = 'block';
        showLoading(false);
    }, 100); // Pequeño timeout para asegurar que el DOM dibuje el showLoading(true)
}
