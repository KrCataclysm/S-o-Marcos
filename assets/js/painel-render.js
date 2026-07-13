/* Renderização do painel — usada tanto pelo gerador (dados ao vivo)
   quanto pela tela de histórico (dados recuperados do Supabase). */
let RESULT = null;
let filtroCrit = null;
let filtroDiasMax = null;
let anonimo = false;
let anonMap = new Map();

function showPainel(result) {
  RESULT = result;
  filtroCrit = null;
  filtroDiasMax = null;
  anonimo = false;
  $('chkAnonimo').checked = false;
  $('painel').style.display = 'block';
  renderPainel();
}

// Mesmo fornecedor sempre vira o mesmo "Fornecedor N" dentro de uma rodada —
// numerado na ordem em que aparece no resumo (mais crítico primeiro).
function montarAnonMap(resumoForn) {
  anonMap = new Map();
  resumoForn.forEach((r, i) => anonMap.set(r.forn, 'Fornecedor ' + (i + 1)));
}
function nomeExibido(forn) {
  return anonimo ? (anonMap.get(forn) || forn) : forn;
}
// "Fonte alternativa" cita nomes de outros fornecedores (às vezes fora da pauta) —
// no modo anônimo não dá pra só trocar pelo Fornecedor N (nem sempre está no mapa),
// então vira um indicativo sem identificar quem é.
function fonteExibida(d) {
  if (!anonimo) return d.fonte;
  if (d.fonte === 'Sem informação') return d.fonte;
  return d.fonteBloq ? 'Bloqueado' : 'Sim';
}

function renderPainel() {
  const { detalhe, resumoForn, dtP, W } = RESULT;
  montarAnonMap(resumoForn);
  $('lblAnonimo').style.display = 'flex';
  $('btnExcel').style.display = 'inline-block';
  $('btnPrint').style.display = 'inline-block';
  $('pTitulo').textContent = 'Painel de Criticidade — Pauta de Pagamento ' + dtP.toLocaleDateString('pt-BR');
  $('pMeta').textContent = `Gerado em ${new Date().toLocaleDateString('pt-BR')} · janela de análise de ${W} dias · ${resumoForn.length} fornecedores analisados`;

  const { valorTotal: vTotal, valorAberto: vAberto, itensCriticos: nCrit } = calcKpis(detalhe, resumoForn);
  const cnt = { 'Crítico máximo': 0, 'Crítico': 0, 'Atenção': 0, 'Monitorar': 0 };
  detalhe.forEach(d => cnt[d.crit]++);

  $('cards').innerHTML = `
    <div class="kcard"><div class="v">${resumoForn.length}</div><div class="l">Fornecedores na pauta</div></div>
    <div class="kcard"><div class="v">R$ ${fmtBR(vTotal)}</div><div class="l">Valor da pauta (a comprar)</div></div>
    <div class="kcard"><div class="v">R$ ${fmtBR(vAberto)}</div><div class="l">Valor em aberto com fornecedores</div></div>
    <div class="kcard crit"><div class="v">${nCrit}</div><div class="l">Itens em risco crítico / crítico máximo</div></div>
    <div class="kcard"><div class="v">${detalhe.length}</div><div class="l">Itens analisados</div></div>`;

  document.querySelectorAll('#regua .cell').forEach(c => {
    c.querySelector('.cnt').textContent = '';
    c.classList.toggle('active', filtroCrit === c.dataset.f);
  });
  const firstCell = {};
  document.querySelectorAll('#regua .cell').forEach(c => { if (!(c.dataset.f in firstCell)) firstCell[c.dataset.f] = c; });
  Object.entries(cnt).forEach(([k, v]) => { if (firstCell[k]) firstCell[k].querySelector('.cnt').textContent = v + ' itens'; });

  const cssVar = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const sevVar = k => '--sev-' + CRIT_BADGE[k].slice(2);
  $('distrib').innerHTML = '<div class="distrib">' + Object.entries(cnt).filter(([, v]) => v > 0).map(([k, v]) =>
    `<div style="background:${cssVar(sevVar(k))};color:${cssVar(sevVar(k) + '-on')};flex:${v}" title="${k}: ${v}">${v}</div>`).join('') +
    '</div><div class="legend">' + Object.entries(cnt).map(([k, v]) => `${k}: <b>${v}</b>`).join(' &nbsp;·&nbsp; ') + '</div>';

  $('tblForn').innerHTML = '<thead><tr><th>Fornecedor</th><th>Categoria na pauta</th><th>Pior criticidade</th><th class="num">Itens a comprar (ponto de pedido)</th><th class="num">Valor a comprar (R$)</th><th class="num">Valor em aberto (R$)</th></tr></thead><tbody>' +
    resumoForn.map(r => `<tr><td><b>${nomeExibido(r.forn)}</b></td><td>${r.cat || '—'}</td>
      <td><span class="badge ${CRIT_BADGE[r.pior]}">${r.pior}</span></td>
      <td class="num">${r.nPP || 0}</td>
      <td class="num">${r.vPauta != null ? fmtBR(r.vPauta) : '—'}</td>
      <td class="num">${r.valorAberto != null ? fmtBR(r.valorAberto) : '—'}</td></tr>`).join('') + '</tbody>';

  renderDetalhe();
}

// Ruptura = estoque zerado/negativo, tratado como 0 dias (o mais urgente possível).
function diasEfetivos(d) {
  if (d.dias != null) return d.dias;
  if (d.diasTxt === 'Ruptura') return 0;
  return null;
}

function renderDetalhe() {
  const busca = norm($('fBusca').value);
  let rows = RESULT.detalhe.filter(d => {
    if (filtroCrit && d.crit !== filtroCrit) return false;
    if (busca) {
      const blob = norm([d.produto, d.forn, d.comprador, d.cat, d.fonte].join(' '));
      if (!blob.includes(busca)) return false;
    }
    if (filtroDiasMax != null) {
      const dv = diasEfetivos(d);
      if (dv == null || dv > filtroDiasMax) return false;
    }
    return true;
  });
  if (filtroDiasMax != null) rows = rows.slice().sort((a, b) => diasEfetivos(a) - diasEfetivos(b));
  $('chipDias').classList.toggle('active', filtroDiasMax != null);
  $('fInfo').textContent = rows.length + ' de ' + RESULT.detalhe.length + ' itens' +
    (filtroCrit ? ' · filtro: ' + filtroCrit : '') +
    (filtroDiasMax != null ? ' · até ' + filtroDiasMax + ' dias de estoque (menor primeiro)' : '');
  $('tblDet').innerHTML = '<thead><tr><th>Fornecedor</th><th>Categoria na pauta</th><th>Produto comprado</th><th class="num">Saldo</th><th class="num">Dias de estoque</th><th class="num">Em trânsito</th><th>Fonte alternativa</th><th>Criticidade</th><th class="num">Valor fornecedor bloqueado (R$)</th><th>Obs.</th></tr></thead><tbody>' +
    rows.map(d => `<tr>
      <td><b>${nomeExibido(d.forn)}</b></td><td>${d.cat || '—'}</td><td>${d.produto}</td>
      <td class="num">${d.saldo != null ? fmtInt(d.saldo) : '—'}</td>
      <td class="num">${d.diasTxt === 'Ruptura' ? '<b style="color:var(--red)">Ruptura</b>' : d.diasTxt}</td>
      <td class="num">${d.transito != null ? fmtInt(d.transito) : '—'}</td>
      <td>${!anonimo && d.fonteBloq ? '<span class="alt-block">' + d.fonte + '</span>' : fonteExibida(d)}</td>
      <td><span class="badge ${CRIT_BADGE[d.crit]}">${d.crit}</span></td>
      <td class="num">${d.vPauta != null ? fmtBR(d.vPauta) : '—'}</td>
      <td class="obs">${d.obs || ''}</td></tr>`).join('') + '</tbody>';
}

function exportExcel() {
  const { detalhe, resumoForn, dtP, W } = RESULT;
  const cnt = { 'Crítico máximo': 0, 'Crítico': 0, 'Atenção': 0, 'Monitorar': 0 };
  detalhe.forEach(d => cnt[d.crit]++);
  const { valorTotal: vTotal, valorAberto: vAberto } = calcKpis(detalhe, resumoForn);
  const wb = XLSX.utils.book_new();

  const s1 = [
    ['HOSPITAL SÃO MARCOS — APCC  |  Central de Compras'],
    ['Painel de Criticidade — Fornecedores da Pauta de Pagamento ' + dtP.toLocaleDateString('pt-BR') + '  ·  Gerado em ' + new Date().toLocaleDateString('pt-BR')],
    [], ['Indicadores Gerais'],
    ['Fornecedores na pauta', resumoForn.length],
    ['Valor da pauta a comprar (R$)', +vTotal.toFixed(2)],
    ['Valor em aberto com fornecedores (R$)', +vAberto.toFixed(2)],
    ['Itens em risco Crítico/Crítico máximo', cnt['Crítico máximo'] + cnt['Crítico']],
    ['Itens analisados (janela de ' + W + ' dias)', detalhe.length],
    [], ['Régua de Criticidade Adotada'],
    ['Cobertura ↓ / 2ª fonte →', 'SEM 2ª fonte', 'COM 2ª fonte'],
    ['Ruptura / ≤ 15 dias', 'Crítico máximo', 'Crítico'],
    ['15 a 45 dias', 'Crítico', 'Atenção'],
    ['> 45 dias', 'Atenção', 'Monitorar'],
    ['Sem informação', 'Atenção', 'Monitorar'],
    [], ['Distribuição dos Itens por Criticidade'], ['Criticidade', 'Itens'],
    ...Object.entries(cnt)
  ];
  const ws1 = XLSX.utils.aoa_to_sheet(s1); ws1['!cols'] = [{ wch: 42 }, { wch: 18 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, ws1, 'Resumo Executivo');

  const s2 = [['HOSPITAL SÃO MARCOS — APCC  |  Resumo de Criticidade por Fornecedor'],
  ['Fornecedor', 'Comprador', 'Categoria na Pauta', 'Pior Criticidade', 'Itens Analisados (' + W + 'd)', 'Itens a Comprar (Ponto de Pedido)', 'Valor Comprado ' + W + 'd (R$)', 'Valor a Comprar (R$)', 'Valor em Aberto (R$)'],
  ...resumoForn.map(r => [nomeExibido(r.forn), r.comprador || '', r.cat || '', r.pior, r.nItens, r.nPP || 0, +(r.vJanela || 0).toFixed(2), r.vPauta != null ? +r.vPauta.toFixed(2) : '', r.valorAberto != null ? +r.valorAberto.toFixed(2) : ''])];
  const ws2 = XLSX.utils.aoa_to_sheet(s2); ws2['!cols'] = [{ wch: 34 }, { wch: 20 }, { wch: 34 }, { wch: 16 }, { wch: 14 }, { wch: 16 }, { wch: 20 }, { wch: 18 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, ws2, 'Resumo por Fornecedor');

  const s3 = [['HOSPITAL SÃO MARCOS — APCC  |  Detalhamento — Itens x Fornecedores Bloqueados x Estoque'],
  ['Comprador', 'Fornecedor', 'Categoria na Pauta', 'Produto Comprado (' + W + 'd)', 'Qtd ' + W + 'd', 'Valor ' + W + 'd (R$)', 'Saldo Estoque', 'Dias de Estoque', 'Em Trânsito', 'Fonte Alternativa', 'Criticidade', 'Valor Fornecedor Bloqueado (R$)', 'Observação'],
  ...detalhe.map(d => [d.comprador || '', nomeExibido(d.forn), d.cat || '', d.produto, d.q ?? '', d.v != null ? +d.v.toFixed(2) : '', d.saldo ?? '',
  d.dias != null ? +d.dias.toFixed(1) : d.diasTxt, d.transito ?? '', fonteExibida(d), d.crit, d.vPauta != null ? +d.vPauta.toFixed(2) : '', d.obs || ''])];
  const ws3 = XLSX.utils.aoa_to_sheet(s3);
  ws3['!cols'] = [{ wch: 16 }, { wch: 26 }, { wch: 30 }, { wch: 52 }, { wch: 10 }, { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 36 }, { wch: 15 }, { wch: 16 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(wb, ws3, 'Detalhamento por Item');

  const dd = dtP.toLocaleDateString('pt-BR').replace(/\//g, '');
  XLSX.writeFile(wb, 'Painel_Criticidade_Fornecedores_Pauta_' + dd + '.xlsx');
}

function aplicarFiltroDias() {
  if (!RESULT) return;
  const v = parseFloat($('fDiasMax').value);
  filtroDiasMax = Number.isFinite(v) && v >= 0 ? v : null;
  renderDetalhe();
}

function initPanelInteractions() {
  $('fBusca').addEventListener('input', () => RESULT && renderDetalhe());
  $('chipTodos').addEventListener('click', () => {
    filtroCrit = null;
    filtroDiasMax = null;
    $('fBusca').value = '';
    $('fDiasMax').value = '';
    if (RESULT) renderPainel();
  });
  $('chipDias').addEventListener('click', aplicarFiltroDias);
  $('fDiasMax').addEventListener('keydown', e => { if (e.key === 'Enter') aplicarFiltroDias(); });
  document.querySelectorAll('#regua .cell').forEach(c => c.addEventListener('click', () => {
    if (!RESULT) return;
    filtroCrit = filtroCrit === c.dataset.f ? null : c.dataset.f;
    renderPainel();
  }));
  $('btnExcel').addEventListener('click', exportExcel);
  $('btnPrint').addEventListener('click', () => window.print());
  $('chkAnonimo').addEventListener('change', async e => {
    const querido = e.target.checked;
    e.target.checked = !querido; // só confirma visualmente depois da senha validada
    const ok = await confirmarSenhaAdmin();
    if (!ok) return;
    e.target.checked = querido;
    anonimo = querido;
    if (RESULT) renderPainel();
  });
}

// A alavanca de ocultar/mostrar fornecedor é protegida pela senha de admin —
// se já tem sessão de admin válida no navegador (ex.: entrou no ADM antes), não pede de novo.
async function confirmarSenhaAdmin() {
  if (getAdminSession()) return true;
  const senha = prompt('Senha de administrador para usar esta função:');
  if (!senha) return false;
  const { data, error } = await supabaseClient.rpc('rpc_admin_login', { p_password: senha });
  if (error || !data || !data.length) { alert('Senha de administrador incorreta.'); return false; }
  setAdminSession(data[0].token, data[0].expires_at);
  return true;
}
