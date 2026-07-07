/* Renderização do painel — usada tanto pelo gerador (dados ao vivo)
   quanto pela tela de histórico (dados recuperados do Supabase). */
let RESULT = null;
let filtroCrit = null;

function showPainel(result) {
  RESULT = result;
  filtroCrit = null;
  $('painel').style.display = 'block';
  renderPainel();
}

function renderPainel() {
  const { detalhe, resumoForn, dtP, W } = RESULT;
  $('btnExcel').style.display = 'inline-block';
  $('btnPrint').style.display = 'inline-block';
  $('pTitulo').textContent = 'Painel de Criticidade — Pauta de Pagamento ' + dtP.toLocaleDateString('pt-BR');
  $('pMeta').textContent = `Gerado em ${new Date().toLocaleDateString('pt-BR')} · janela de análise de ${W} dias · ${resumoForn.length} fornecedores analisados`;

  const { valorTotal: vTotal, itensCriticos: nCrit } = calcKpis(detalhe, resumoForn);
  const cnt = { 'Crítico máximo': 0, 'Crítico': 0, 'Atenção': 0, 'Monitorar': 0 };
  detalhe.forEach(d => cnt[d.crit]++);

  $('cards').innerHTML = `
    <div class="kcard"><div class="v">${resumoForn.length}</div><div class="l">Fornecedores na pauta</div></div>
    <div class="kcard"><div class="v">R$ ${fmtBR(vTotal)}</div><div class="l">Valor total da pauta</div></div>
    <div class="kcard crit"><div class="v">${nCrit}</div><div class="l">Itens em risco crítico / crítico máximo</div></div>
    <div class="kcard"><div class="v">${detalhe.length}</div><div class="l">Itens analisados</div></div>`;

  document.querySelectorAll('#regua .cell').forEach(c => {
    c.querySelector('.cnt').textContent = '';
    c.classList.toggle('active', filtroCrit === c.dataset.f);
  });
  const firstCell = {};
  document.querySelectorAll('#regua .cell').forEach(c => { if (!(c.dataset.f in firstCell)) firstCell[c.dataset.f] = c; });
  Object.entries(cnt).forEach(([k, v]) => { if (firstCell[k]) firstCell[k].querySelector('.cnt').textContent = v + ' itens'; });

  const cores = { 'Crítico máximo': '#C00000', 'Crítico': '#e05252', 'Atenção': '#e9a53a', 'Monitorar': '#9aa7ba' };
  $('distrib').innerHTML = '<div class="distrib">' + Object.entries(cnt).filter(([, v]) => v > 0).map(([k, v]) =>
    `<div style="background:${cores[k]};flex:${v}" title="${k}: ${v}">${v}</div>`).join('') +
    '</div><div class="legend">' + Object.entries(cnt).map(([k, v]) => `${k}: <b>${v}</b>`).join(' &nbsp;·&nbsp; ') + '</div>';

  $('tblForn').innerHTML = '<thead><tr><th>Fornecedor</th><th>Comprador</th><th>Categoria na pauta</th><th>Pior criticidade</th><th class="num">Itens (' + W + 'd)</th><th class="num">Valor comprado ' + W + 'd (R$)</th><th class="num">Valor a comprar (R$)</th></tr></thead><tbody>' +
    resumoForn.map(r => `<tr><td><b>${r.forn}</b></td><td>${r.comprador || '—'}</td><td>${r.cat || '—'}</td>
      <td><span class="badge ${CRIT_BADGE[r.pior]}">${r.pior}</span></td>
      <td class="num">${r.nItens}</td><td class="num">${fmtBR(r.vJanela)}</td><td class="num">${r.vPauta != null ? fmtBR(r.vPauta) : '—'}</td></tr>`).join('') + '</tbody>';

  renderDetalhe();
}

function renderDetalhe() {
  const busca = norm($('fBusca').value);
  const rows = RESULT.detalhe.filter(d => {
    if (filtroCrit && d.crit !== filtroCrit) return false;
    if (busca) {
      const blob = norm([d.produto, d.forn, d.comprador, d.cat, d.fonte].join(' '));
      if (!blob.includes(busca)) return false;
    }
    return true;
  });
  $('fInfo').textContent = rows.length + ' de ' + RESULT.detalhe.length + ' itens' + (filtroCrit ? ' · filtro: ' + filtroCrit : '');
  $('tblDet').innerHTML = '<thead><tr><th>Comprador</th><th>Fornecedor</th><th>Categoria na pauta</th><th>Produto comprado</th><th class="num">Qtd</th><th class="num">Valor (R$)</th><th class="num">Saldo</th><th class="num">Dias de estoque</th><th class="num">Em trânsito</th><th>Fonte alternativa</th><th>Criticidade</th><th class="num">Valor a comprar (R$)</th><th>Obs.</th></tr></thead><tbody>' +
    rows.map(d => `<tr>
      <td>${d.comprador || '—'}</td><td><b>${d.forn}</b></td><td>${d.cat || '—'}</td><td>${d.produto}</td>
      <td class="num">${d.q != null ? fmtInt(d.q) : ''}</td><td class="num">${d.v != null ? fmtBR(d.v) : ''}</td>
      <td class="num">${d.saldo != null ? fmtInt(d.saldo) : '—'}</td>
      <td class="num">${d.diasTxt === 'Ruptura' ? '<b style="color:var(--red)">Ruptura</b>' : d.diasTxt}</td>
      <td class="num">${d.transito != null ? fmtInt(d.transito) : '—'}</td>
      <td>${d.fonteBloq ? '<span class="alt-block">' + d.fonte + '</span>' : d.fonte}</td>
      <td><span class="badge ${CRIT_BADGE[d.crit]}">${d.crit}</span></td>
      <td class="num">${d.vPauta != null ? fmtBR(d.vPauta) : '—'}</td>
      <td class="obs">${d.obs || ''}</td></tr>`).join('') + '</tbody>';
}

function exportExcel() {
  const { detalhe, resumoForn, dtP, W } = RESULT;
  const cnt = { 'Crítico máximo': 0, 'Crítico': 0, 'Atenção': 0, 'Monitorar': 0 };
  detalhe.forEach(d => cnt[d.crit]++);
  const { valorTotal: vTotal } = calcKpis(detalhe, resumoForn);
  const wb = XLSX.utils.book_new();

  const s1 = [
    ['HOSPITAL SÃO MARCOS — APCC  |  Central de Compras'],
    ['Painel de Criticidade — Fornecedores da Pauta de Pagamento ' + dtP.toLocaleDateString('pt-BR') + '  ·  Gerado em ' + new Date().toLocaleDateString('pt-BR')],
    [], ['Indicadores Gerais'],
    ['Fornecedores na pauta', resumoForn.length],
    ['Valor total da pauta (R$)', +vTotal.toFixed(2)],
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
  ['Fornecedor', 'Comprador', 'Categoria na Pauta', 'Pior Criticidade', 'Itens Analisados (' + W + 'd)', 'Valor Comprado ' + W + 'd (R$)', 'Valor a Comprar (R$)'],
  ...resumoForn.map(r => [r.forn, r.comprador || '', r.cat || '', r.pior, r.nItens, +(r.vJanela || 0).toFixed(2), r.vPauta != null ? +r.vPauta.toFixed(2) : ''])];
  const ws2 = XLSX.utils.aoa_to_sheet(s2); ws2['!cols'] = [{ wch: 34 }, { wch: 20 }, { wch: 34 }, { wch: 16 }, { wch: 14 }, { wch: 20 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, ws2, 'Resumo por Fornecedor');

  const s3 = [['HOSPITAL SÃO MARCOS — APCC  |  Detalhamento — Itens x Fornecedores Bloqueados x Estoque'],
  ['Comprador', 'Fornecedor', 'Categoria na Pauta', 'Produto Comprado (' + W + 'd)', 'Qtd ' + W + 'd', 'Valor ' + W + 'd (R$)', 'Saldo Estoque', 'Dias de Estoque', 'Em Trânsito', 'Fonte Alternativa', 'Criticidade', 'Valor a Comprar (R$)', 'Observação'],
  ...detalhe.map(d => [d.comprador || '', d.forn, d.cat || '', d.produto, d.q ?? '', d.v != null ? +d.v.toFixed(2) : '', d.saldo ?? '',
  d.dias != null ? +d.dias.toFixed(1) : d.diasTxt, d.transito ?? '', d.fonte, d.crit, d.vPauta != null ? +d.vPauta.toFixed(2) : '', d.obs || ''])];
  const ws3 = XLSX.utils.aoa_to_sheet(s3);
  ws3['!cols'] = [{ wch: 16 }, { wch: 26 }, { wch: 30 }, { wch: 52 }, { wch: 10 }, { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 36 }, { wch: 15 }, { wch: 16 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(wb, ws3, 'Detalhamento por Item');

  const dd = dtP.toLocaleDateString('pt-BR').replace(/\//g, '');
  XLSX.writeFile(wb, 'Painel_Criticidade_Fornecedores_Pauta_' + dd + '.xlsx');
}

function initPanelInteractions() {
  $('fBusca').addEventListener('input', () => RESULT && renderDetalhe());
  $('chipTodos').addEventListener('click', () => { filtroCrit = null; $('fBusca').value = ''; if (RESULT) renderPainel(); });
  document.querySelectorAll('#regua .cell').forEach(c => c.addEventListener('click', () => {
    if (!RESULT) return;
    filtroCrit = filtroCrit === c.dataset.f ? null : c.dataset.f;
    renderPainel();
  }));
  $('btnExcel').addEventListener('click', exportExcel);
  $('btnPrint').addEventListener('click', () => window.print());
}
