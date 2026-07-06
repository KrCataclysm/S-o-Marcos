/* Utilitários e regras compartilhadas entre o gerador e o histórico. */
const $ = id => document.getElementById(id);
const norm = s => (s == null ? '' : String(s)).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const fmtBR = (n, d = 2) => n == null || isNaN(n) ? '—' : n.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
const fmtInt = n => n == null || isNaN(n) ? '—' : n.toLocaleString('pt-BR', { maximumFractionDigits: 0 });
const excelDate = v => {
  if (v == null || v === '') return null;
  if (v instanceof Date) return v;
  if (typeof v === 'number') return new Date(Math.round((v - 25569) * 86400 * 1000));
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/); if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
  const d = new Date(s); return isNaN(d) ? null : d;
};
const parseNum = v => {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return v;
  const n = parseFloat(String(v).replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, ''));
  return isNaN(n) ? null : n;
};
const escRx = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const CRIT_ORD = { 'Crítico máximo': 0, 'Crítico': 1, 'Atenção': 2, 'Monitorar': 3 };
const CRIT_BADGE = { 'Crítico máximo': 'b-critmax', 'Crítico': 'b-crit', 'Atenção': 'b-atencao', 'Monitorar': 'b-monitorar' };

function classifica(dias, ruptura, temFonte) {
  if (dias == null && !ruptura) return temFonte ? 'Monitorar' : 'Atenção';
  if (ruptura || dias <= 15) return temFonte ? 'Crítico' : 'Crítico máximo';
  if (dias <= 45) return temFonte ? 'Atenção' : 'Crítico';
  return temFonte ? 'Monitorar' : 'Atenção';
}

function calcKpis(detalhe, resumoForn) {
  const vTotal = resumoForn.reduce((s, r) => s + (r.vPauta || 0), 0);
  const nCrit = detalhe.filter(d => CRIT_ORD[d.crit] <= 1).length;
  return { fornecedores: resumoForn.length, valorTotal: vTotal, itensCriticos: nCrit, itensAnalisados: detalhe.length };
}
