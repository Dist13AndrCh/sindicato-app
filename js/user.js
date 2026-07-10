async function loadUserDashboard() {
    const name = document.getElementById('user-search-input').value;
    const socio = socios.find(s => s.nombre === name);
    if (!socio) return showToast("Nombre no válido");

    currentUserSocioId = socio.id;
    localStorage.setItem('activeUserDashboard', socio.nombre);

    showLoading(true);
    try {
        const pagos = pagosCache.filter(p => p.socioId === socio.id);
        const asistencias = asistenciasCache.filter(a => a.socioId === socio.id);
        const misAportes = aportesCache.filter(a => a.socioId === socio.id);

        let totalPagados = pagos.length;
        let totalRestantes = (gestiones.length * 12) - totalPagados;
        let totalDeuda = 0; 
        
        let aportesHtml = `<div class="card no-hover" style="margin-top:15px;" id="user-aportes-card"><h3>Aportes y Recaudaciones</h3>`;
        let recDeuda = 0;
        let hasRecaudaciones = false;

        recaudacionesCache.forEach(rec => {
            const hasPaid = misAportes.some(a => a.recaudoId === rec.id);
            if (hasPaid) {
                hasRecaudaciones = true;
                aportesHtml += `
                    <div class="item-row" style="border-left: 3px solid var(--success); margin-bottom: 5px;">
                        <span style="font-size:0.9rem;">${rec.title}</span>
                        <span style="color:var(--success); font-weight:bold;">Bs.${rec.amount}</span>
                    </div>`;
            } else if (rec.type === 'obligatoria') {
                hasRecaudaciones = true;
                recDeuda += rec.amount;
                aportesHtml += `
                    <div class="item-row" style="border-left: 3px solid var(--accent); margin-bottom: 5px;">
                        <span style="font-size:0.9rem;">${rec.title}</span>
                        <span style="color:var(--accent); font-weight:bold;">DEBE Bs.${rec.amount}</span>
                    </div>`;
            }
        });

        if (!hasRecaudaciones) {
            aportesHtml += `<div class="empty-state">No tienes aportes o deudas extraordinarias.</div>`;
        } else if (recDeuda > 0) {
            aportesHtml += `<div style="text-align:right; margin-top:10px; font-weight:bold; color:var(--accent);">Deuda Especial: Bs.${recDeuda}</div>`;
        }
        aportesHtml += `</div>`;

        totalDeuda += recDeuda;

        let multasHtml = `<div class="card no-hover" style="margin-top:15px;"><h3>Multas y Reuniones</h3>`;

    activities.forEach(act => {
        const a = asistencias.find(as => as.actId === act.id);
        let statusBadge = '';
        const fine = parseFloat(act.fine) || 0;

        if (!a) {
            // Sin registro alguno = Falta completa
            totalDeuda += fine;
            statusBadge = `<span class="badge badge-debt">FALTA - Bs.${fine}</span>`;
        } else {
            // Lógica con ini, fin, atr
            const pF = !(a.ini) && !(a.atr);
            const aF = !(a.fin);
            const totalFaltas = (pF ? 1 : 0) + (aF ? 1 : 0);
            
            if (totalFaltas === 0 && !a.atr) {
                statusBadge = '<span class="badge badge-paid">PRESENTE</span>';
            } else if (totalFaltas === 0 && a.atr) {
                if (a.finePaid) statusBadge = '<span class="badge badge-paid">ATRASO (PAGADO)</span>';
                else {
                    totalDeuda += fine;
                    statusBadge = `<span class="badge badge-debt">ATRASO - Bs.${fine}</span>`;
                }
            } else if (totalFaltas === 1 && !pF) {
                // Fuga (Vino al inicio pero no al final)
                if (a.finePaid) statusBadge = '<span class="badge badge-paid">FUGA (PAGADA)</span>';
                else {
                    totalDeuda += fine;
                    statusBadge = `<span class="badge badge-debt">FUGA - Bs.${fine}</span>`;
                }
            } else {
                // Falta (0 o 1 asistencia parcial no cubierta, en la app si falta ambas = Falta completa)
                if (a.finePaid) statusBadge = '<span class="badge badge-paid">FALTA (PAGADA)</span>';
                else {
                    totalDeuda += fine;
                    statusBadge = `<span class="badge badge-debt">FALTA - Bs.${fine}</span>`;
                }
            }
        }

        multasHtml += `
            <div class="item-row">
                <span>${act.name} (${act.date})</span>
                <span>${statusBadge}</span>
            </div>`;
    });
    multasHtml += `</div>`; 

    const isAlDia = totalDeuda === 0 && totalRestantes === 0; // Wait, totalRestantes just means they haven't paid all months. 
    // Usually "Al Día" means no multas. We'll use totalDeuda === 0 for the badge.
    
    let html = `
        <div class="card no-hover" style="text-align: center; border-bottom: 4px solid ${totalDeuda === 0 ? 'var(--success)' : 'var(--accent)'}; padding: 2rem;">
            <div style="font-size: 0.8rem; color: #888; letter-spacing: 2px;">CREDENCIAL DIGITAL</div>
            <h2 style="font-size: 1.8rem; margin: 10px 0; color: white;">${socio.nombre}</h2>
            <div style="display: inline-block; padding: 5px 15px; border-radius: 20px; font-weight: bold; background: ${totalDeuda === 0 ? 'rgba(40,167,69,0.1)' : 'rgba(229,9,20,0.1)'}; color: ${totalDeuda === 0 ? 'var(--success)' : 'var(--accent)'};">
                ${totalDeuda === 0 ? '✅ AL DÍA' : '⚠️ EN MORA'}
            </div>
        </div>

        <div class="stat-grid">
            <div class="stat-card"><div>Cuotas Pagadas</div><div class="stat-val" style="color:var(--success)">${totalPagados}</div></div>
            <div class="stat-card"><div>Cuotas Pendientes</div><div class="stat-val" style="color:var(--warning)">${totalRestantes}</div></div>
        </div>`;

    gestiones.forEach(g => {
        html += `<div class="card no-hover"><h3>Gestión ${g.val}</h3><div class="months-grid">`;
        for (let m = 1; m <= 12; m++) {
            const pag = pagos.some(p => p.year === g.val && p.month === m);
            html += `<div class="month-box ${pag ? 'paid' : 'pending'}">${MESES[m - 1].substring(0, 3)}</div>`;
        }
        html += `</div></div>`;
    });

    html += multasHtml;

    if (totalDeuda > 0) {
        html += `
            <div class="debt-container">
                <div class="debt-title">Total Deuda por Multas</div>
                <div class="debt-amount">Bs. ${totalDeuda}</div>
            </div>`;
    } else {
        html += `
            <div class="clean-slate">
                <h3>✅ ¡Felicidades!</h3>
                <p style="font-size:0.9rem; margin-top:5px; opacity:0.8;">Estás al día con tus obligaciones de asistencia.</p>
            </div>`;
    }
    
    // Guardamos la deuda total en localStorage para usarla en WhatsApp
    localStorage.setItem('currentUserDebt', totalDeuda);
    
    document.getElementById('user-dashboard-view').innerHTML = html + aportesHtml;

    const recibosSocio = recibosCache.filter(r => r.socioId === socio.id);
    const multasSocio = recibosSocio.filter(r => r.isFine);
    const recibosNormales = recibosSocio.filter(r => !r.isFine);

    const rList = document.getElementById('user-receipts-list');
    rList.innerHTML = recibosNormales.length ? recibosNormales.map(r => `
                <div class="item-row">
                    <span>${r.date} - Bs.${r.total} (Folio: ${r.physicalFolio || 'S/N'})</span>
                    <button class="btn-green" onclick='openReceiptModal(${JSON.stringify(r)})'>Ver</button>
                </div>
            `).join("") : '<div class="empty-state">No hay recibos digitales regulares.</div>';
    
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
        document.getElementById('user-support-card').style.display = 'block';

    } catch (error) {
        console.error("Error loading user dashboard:", error);
        showToast("Hubo un problema al cargar los datos. Inténtalo de nuevo.");
    } finally {
        showLoading(false);
    }
}

function sendUserMessage(number) {
    const name = localStorage.getItem('activeUserDashboard') || 'Afiliado';
    const debt = parseFloat(localStorage.getItem('currentUserDebt')) || 0;
    
    let msg = `Buenas tardes, soy un _${name}_ y tengo una consulta...`;
    
    if (debt > 0) {
        msg = `Buenas tardes, soy _${name}_. Veo en el sistema que tengo una deuda acumulada de *Bs.${debt}* por multas. Quisiera coordinar su pago.`;
    }
    
    window.open(`https://wa.me/591${number}?text=${encodeURIComponent(msg)}`, '_blank');
}