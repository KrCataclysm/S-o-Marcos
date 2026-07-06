/* Leitura das planilhas, identificação da pauta e cruzamento de dados.
   Lógica herdada do Gerador_Painel_Criticidade_HSM.html original — inalterada. */

let BASE = null;      // [{f,p,g,u,t(ms),q,v}]
let SALDO = null;     // Map normProduto -> {produto, saldo, q3m}
let SALDO_GEN = null; // Map normProduto1 -> {saldo, q3m}
let RELMAP = null;    // Map normProduto -> {aba, sdHosp, consDiario, dias, transito}
let PAUTA = [];        // [{nome, categoria, valor, comprador, matches:[nomes base], incluir:true}]

const STORAGE_KEY = 'hsm_base_compras_v2';

function encodeBase(base) {
  const supIdx = new Map(), prodIdx = new Map(), sup = [], prod = [], rows = [];
  for (const r of base) {
    if (!supIdx.has(r.f)) { supIdx.set(r.f, sup.length); sup.push(r.f); }
    const pk = r.p + '\u0001' + r.g + '\u0001' + r.u;
    if (!prodIdx.has(pk)) { prodIdx.set(pk, prod.length); prod.push([r.p, r.g, r.u]); }
    rows.push([supIdx.get(r.f), prodIdx.get(pk), Math.round(r.t / 86400000), +r.q.toFixed(3), +r.v.toFixed(2)]);
  }
  return JSON.stringify({ sup, prod, rows });
}
function decodeBase(str) {
  const o = JSON.parse(str);
  if (!o.sup || !o.prod || !o.rows) throw new Error('formato antigo');
  return o.rows.map(([si, pi, d, q, v]) => ({ f: o.sup[si], p: o.prod[pi][0], g: o.prod[pi][1], u: o.prod[pi][2], t: d * 86400000, q, v }));
}
function tryStore(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }
function tryLoad(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function tryDel(k) { try { localStorage.removeItem(k); } catch (e) { } }

function readWB(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = e => { try { res(XLSX.read(new Uint8Array(e.target.result), { type: 'array' })); } catch (err) { rej(err); } };
    r.onerror = () => rej(new Error('Falha na leitura do arquivo'));
    r.readAsArrayBuffer(file);
  });
}

function setStatus(el, msg, cls) { el.textContent = msg; el.className = 'status ' + cls; }

function parsePauta(txt) {
  const out = [];
  for (let raw of txt.split(/\r?\n/)) {
    let line = raw.trim();
    if (!line) continue;
    line = line.replace(/^\*+\s*/, '');
    if (!line.includes(' - ')) continue;
    if (/^(bom dia|boa tarde|prezad|lista de|segue|obs)/i.test(line)) continue;
    const parts = line.split(/\s+-\s+/);
    if (parts.length < 2) continue;
    const nome = parts[0].trim();
    if (!nome || nome.length < 2) continue;
    let valor = null, comprador = '', categoria = '';
    const rest = parts.slice(1);
    const others = [];
    for (const p of rest) {
      const mv = p.match(/R\$\s*([\d.\s]+,\d{1,2}|[\d.]+)/i);
      if (mv && valor == null) { valor = parseNum(mv[1]); continue; }
      if (/\(\s*\d{3,}/.test(p)) { comprador = p.trim(); continue; }
      others.push(p.trim());
    }
    categoria = others.join(' - ');
    out.push({ nome, categoria, valor, comprador, matches: [], incluir: true });
  }
  return out;
}

function matchSupplier(nome) {
  if (!BASE) return [];
  const n = norm(nome);
  const set = new Set(), seen = new Set();
  for (const r of BASE) {
    const fb = norm(r.f);
    if (seen.has(fb)) continue; seen.add(fb);
    let ok = false;
    if (fb.includes(n)) ok = true;
    else if (n.includes(fb) && fb.length >= 8) ok = true;
    else {
      const toks = n.split(' ').filter(t => t.length > 3);
      if (toks.length && toks.every(t => new RegExp('\\b' + escRx(t)).test(fb))) ok = true;
    }
    if (ok) set.add(r.f);
  }
  return [...set].sort();
}
function refreshPautaMatches() {
  if (!PAUTA.length) return;
  PAUTA.forEach(p => { p.matches = matchSupplier(p.nome); p.matchesSel = new Set(p.matches); });
  renderSupList();
}

function renderSupList() {
  const el = $('supList'); el.innerHTML = ''; el.className = 'sup-list show';
  PAUTA.forEach((p, i) => {
    if (!p.matchesSel) p.matchesSel = new Set(p.matches);
    const d = document.createElement('div');
    d.className = 'sup-item ' + (p.matches.length ? 'match' : 'nomatch');
    const chips = p.matches.map((m, j) =>
      `<label style="display:inline-flex;align-items:center;gap:3px;margin:2px 6px 2px 0;cursor:pointer;">
        <input type="checkbox" class="mchk" data-i="${i}" data-m="${j}" ${p.matchesSel.has(m) ? 'checked' : ''}>
        <span class="matched">${m}</span></label>`).join('');
    d.innerHTML = `<input type="checkbox" class="pchk" ${p.incluir ? 'checked' : ''} data-i="${i}" style="margin-top:2px;" title="Incluir este fornecedor no painel">
      <div><span class="nm">${p.nome}</span> ${p.valor != null ? '· R$ ' + fmtBR(p.valor) : ''} ${p.comprador ? '· ' + p.comprador : ''}
      <small>${p.categoria || ''}</small>
      <small>${p.matches.length ? `Vínculos na base (desmarque os incorretos):<br>${chips}` : `<span class="nomatch-txt">Sem correspondência na base — entrará como “sem histórico de compra”.</span>`}</small></div>`;
    el.appendChild(d);
  });
  el.querySelectorAll('.pchk').forEach(cb => cb.addEventListener('change', e => { PAUTA[+e.target.dataset.i].incluir = e.target.checked; }));
  el.querySelectorAll('.mchk').forEach(cb => cb.addEventListener('change', e => {
    const p = PAUTA[+e.target.dataset.i], m = p.matches[+e.target.dataset.m];
    if (e.target.checked) p.matchesSel.add(m); else p.matchesSel.delete(m);
  }));
}

function checkReady() { $('btnGerar').disabled = !(BASE && SALDO && PAUTA.length); }

function gerarPainel() {
  const dtP = $('dtPauta').value ? new Date($('dtPauta').value + 'T12:00:00') : new Date();
  const W = +$('selJanela').value;
  const tMax = dtP.getTime(), tMin = tMax - W * 86400 * 1000;

  const fontes = new Map();
  for (const r of BASE) {
    if (!r.g) continue;
    const k = norm(r.g);
    if (!fontes.has(k)) fontes.set(k, new Set());
    fontes.get(k).add(r.f);
  }
  const bloqueadosNorm = new Set();
  PAUTA.filter(p => p.incluir).forEach(p => [...(p.matchesSel || new Set(p.matches))].forEach(m => bloqueadosNorm.add(norm(m))));

  const detalhe = [], resumoForn = [];
  for (const p of PAUTA.filter(x => x.incluir)) {
    const nomesBase = new Set([...(p.matchesSel || new Set(p.matches))].map(norm));
    const agg = new Map();
    let vJanela = 0;
    for (const r of BASE) {
      if (!nomesBase.has(norm(r.f))) continue;
      if (r.t < tMin || r.t > tMax) continue;
      const k = norm(r.p);
      if (!agg.has(k)) agg.set(k, { produto: r.p, generico: r.g, unidade: r.u, q: 0, v: 0 });
      const o = agg.get(k); o.q += r.q; o.v += r.v; vJanela += r.v;
      if (!o.generico && r.g) o.generico = r.g;
    }
    let pior = 'Monitorar', itens = [...agg.values()];
    if (!itens.length) {
      const cr = p.matches.length ? 'Atenção' : 'Atenção';
      detalhe.push({ comprador: p.comprador, forn: p.nome, cat: p.categoria, produto: '— sem histórico de compra na janela —', q: null, v: null, saldo: null, dias: null, diasTxt: 'Sem informação', fonte: 'Sem informação', fonteBloq: false, crit: cr, vPauta: p.valor, obs: p.matches.length ? `Sem compras nos últimos ${W} dias.` : 'Fornecedor não localizado na base — verificar nome no sistema.' });
      pior = cr;
    } else {
      for (const it of itens) {
        let s = SALDO.get(norm(it.produto)), viaGen = false;
        if (!s && it.generico) { s = SALDO_GEN.get(norm(it.generico)); viaGen = !!s; }
        const saldo = s ? s.saldo : null, q3m = s ? s.q3m : 0;
        let dias = null, ruptura = false, diasTxt = 'Sem informação';
        if (s) {
          if (saldo <= 0) { ruptura = true; diasTxt = 'Ruptura'; }
          else if (q3m > 0) { dias = saldo / (q3m / 90); diasTxt = fmtBR(dias, 1); }
        }
        let alt = [], temFonte = false;
        if (it.generico && fontes.has(norm(it.generico))) {
          alt = [...fontes.get(norm(it.generico))].filter(f => !nomesBase.has(norm(f)));
          temFonte = alt.some(f => !bloqueadosNorm.has(norm(f)));
        }
        const crit = classifica(dias, ruptura, temFonte);
        if (CRIT_ORD[crit] < CRIT_ORD[pior]) pior = crit;
        const rel = RELMAP ? (RELMAP.get(norm(it.produto)) || (it.generico ? RELMAP.get(norm(it.generico)) : null)) : null;
        let obs = (s ? '' : 'Item não localizado no saldo do dia.') + (viaGen ? ' Saldo apurado pelo genérico.' : '');
        if (rel) obs = ('⚠ No ponto de pedido do dia (' + rel.aba + '). ' + obs).trim();
        detalhe.push({
          comprador: p.comprador, forn: p.nome, cat: p.categoria, produto: it.produto, q: it.q, v: it.v, saldo, dias, diasTxt,
          transito: rel ? rel.transito : null, pontoPedido: !!rel,
          fonte: alt.length ? alt.map(f => bloqueadosNorm.has(norm(f)) ? f + ' (bloqueado)' : f).join(' | ') : 'Sem informação',
          fonteBloq: alt.length && !temFonte, crit, vPauta: p.valor, obs
        });
      }
    }
    resumoForn.push({ forn: p.nome, comprador: p.comprador, cat: p.categoria, pior, nItens: itens.length, vJanela, vPauta: p.valor });
  }

  detalhe.sort((a, b) => CRIT_ORD[a.crit] - CRIT_ORD[b.crit] || (b.v || 0) - (a.v || 0));
  resumoForn.sort((a, b) => CRIT_ORD[a.pior] - CRIT_ORD[b.pior] || (b.vPauta || 0) - (a.vPauta || 0));
  return { detalhe, resumoForn, dtP, W };
}

function initGeradorInteractions() {
  $('fileBase').addEventListener('change', async e => {
    const f = e.target.files[0]; if (!f) return;
    setStatus($('stBase'), 'Lendo arquivo…', 'warn');
    try {
      const wb = await readWB(f);
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: null });
      const need = ['nm_fornecedor', 'nm_produto', 'dt_entrada'];
      if (!rows.length || need.some(c => !(c in rows[0]))) throw new Error('Colunas esperadas não encontradas (nm_fornecedor, nm_produto, dt_entrada).');
      BASE = rows.filter(r => r.nm_fornecedor && r.nm_produto).map(r => ({
        f: String(r.nm_fornecedor).trim(),
        p: String(r.nm_produto).trim(),
        g: r.generico ? String(r.generico).trim() : '',
        u: r.nm_unidade ? String(r.nm_unidade).trim() : '',
        t: (excelDate(r.dt_entrada) || new Date(0)).getTime(),
        q: parseNum(r.qt_item) || 0,
        v: parseNum(r.vl_item) || 0
      }));
      const ds = BASE.map(r => r.t).filter(t => t > 0);
      const dmin = new Date(Math.min(...ds)), dmax = new Date(Math.max(...ds));
      const nf = new Set(BASE.map(r => norm(r.f))).size, np = new Set(BASE.map(r => norm(r.p))).size;
      let msg = `Base carregada: ${BASE.length.toLocaleString('pt-BR')} linhas · ${nf} fornecedores · ${np} produtos\nPeríodo: ${dmin.toLocaleDateString('pt-BR')} a ${dmax.toLocaleDateString('pt-BR')}`;
      const saved = tryStore(STORAGE_KEY, encodeBase(BASE));
      msg += saved ? '\nBase salva neste navegador — não precisa recarregar amanhã.' : '\nAtenção: não foi possível salvar a base neste navegador (arquivo grande ou armazenamento indisponível). Recarregue o arquivo quando abrir novamente.';
      setStatus($('stBase'), msg, 'ok');
      refreshPautaMatches(); checkReady();
    } catch (err) { BASE = null; setStatus($('stBase'), 'Erro: ' + err.message, 'err'); checkReady(); }
  });

  $('fileSaldo').addEventListener('change', async e => {
    const f = e.target.files[0]; if (!f) return;
    setStatus($('stSaldo'), 'Lendo arquivo…', 'warn');
    try {
      const wb = await readWB(f);
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: null });
      if (!rows.length || !('nm_produto' in rows[0]) || !('sd_estoque' in rows[0])) throw new Error('Colunas esperadas não encontradas (nm_produto, sd_estoque, qt_item3meses).');
      SALDO = new Map(); SALDO_GEN = new Map();
      let locais = new Set();
      for (const r of rows) {
        if (!r.nm_produto) continue;
        if (r.nm_local) locais.add(r.nm_local);
        const k = norm(r.nm_produto);
        const s = parseNum(r.sd_estoque) || 0, q = parseNum(r.qt_item3meses) || 0;
        if (!SALDO.has(k)) SALDO.set(k, { produto: String(r.nm_produto).trim(), saldo: 0, q3m: 0 });
        const o = SALDO.get(k); o.saldo += s; o.q3m += q;
        if (r.nm_produto1) {
          const kg = norm(r.nm_produto1);
          if (!SALDO_GEN.has(kg)) SALDO_GEN.set(kg, { saldo: 0, q3m: 0 });
          const og = SALDO_GEN.get(kg); og.saldo += s; og.q3m += q;
        }
      }
      setStatus($('stSaldo'), `Saldo carregado: ${SALDO.size.toLocaleString('pt-BR')} produtos · ${locais.size} locais somados.`, 'ok');
      checkReady();
    } catch (err) { SALDO = null; setStatus($('stSaldo'), 'Erro: ' + err.message, 'err'); checkReady(); }
  });

  $('fileRel').addEventListener('change', async e => {
    const f = e.target.files[0]; if (!f) return;
    setStatus($('stRel'), 'Lendo arquivo…', 'warn');
    try {
      const wb = await readWB(f);
      RELMAP = new Map(); let n = 0;
      for (const nome of wb.SheetNames) {
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[nome], { defval: null, header: 1 });
        const hi = rows.findIndex(r => r && r.includes('nm_produto'));
        if (hi < 0) continue;
        const H = rows[hi], col = c => H.indexOf(c);
        const cP = col('nm_produto'), cS = col('sd_hosp'), cD = col('cons_diario'), cE = col('dias_em_estoque'), cT = col('em_transito');
        for (let i = hi + 1; i < rows.length; i++) {
          const r = rows[i]; if (!r || !r[cP]) continue;
          RELMAP.set(norm(r[cP]), { aba: nome, sdHosp: parseNum(r[cS]), consDiario: parseNum(r[cD]), dias: parseNum(r[cE]), transito: parseNum(r[cT]) || 0 });
          n++;
        }
      }
      if (!n) throw new Error('Nenhuma aba com a coluna nm_produto foi encontrada.');
      setStatus($('stRel'), `Ponto de pedido carregado: ${n.toLocaleString('pt-BR')} itens em ${wb.SheetNames.length} abas. Serão sinalizados no painel com a quantidade em trânsito.`, 'ok');
    } catch (err) { RELMAP = null; setStatus($('stRel'), 'Erro: ' + err.message, 'err'); }
  });

  $('btnLerPauta').addEventListener('click', () => {
    PAUTA = parsePauta($('txtPauta').value);
    if (!PAUTA.length) { setStatus($('stPauta'), 'Nenhuma linha de fornecedor reconhecida. Verifique o formato (Fornecedor - Categoria - R$ valor - Comprador).', 'err'); $('supList').className = 'sup-list'; checkReady(); return; }
    PAUTA.forEach(p => { p.matches = matchSupplier(p.nome); p.matchesSel = new Set(p.matches); });
    const semMatch = PAUTA.filter(p => !p.matches.length).length;
    setStatus($('stPauta'), `${PAUTA.length} fornecedores identificados na pauta` + (BASE ? ` · ${semMatch} sem correspondência na base de compras.` : ' · carregue a base para vincular ao histórico.'), semMatch && BASE ? 'warn' : 'ok');
    renderSupList(); checkReady();
  });

  $('btnLimparBase').addEventListener('click', () => { tryDel(STORAGE_KEY); BASE = null; setStatus($('stBase'), 'Base salva removida. Carregue um novo arquivo.', 'warn'); checkReady(); });
}

function initGeradorState() {
  $('hoje').textContent = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
  $('dtPauta').value = new Date().toISOString().slice(0, 10);
  const saved = tryLoad(STORAGE_KEY);
  if (saved) {
    try {
      BASE = decodeBase(saved);
      const ds = BASE.map(r => r.t).filter(t => t > 0);
      setStatus($('stBase'), `Base recuperada deste navegador: ${BASE.length.toLocaleString('pt-BR')} linhas · período ${new Date(Math.min(...ds)).toLocaleDateString('pt-BR')} a ${new Date(Math.max(...ds)).toLocaleDateString('pt-BR')}.\nCarregue um novo arquivo para atualizar.`, 'ok');
    } catch (e) { BASE = null; }
  }
  checkReady();
}
