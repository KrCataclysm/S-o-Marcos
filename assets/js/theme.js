/* Aplica o tema (cores, fonte, textos) vindo do Supabase em qualquer página.
   Falha silenciosa: se não der pra buscar, fica no visual padrão de sempre. */
const THEME_FONT_PRESETS = {
  'serif-institucional': {
    serif: "'Times New Roman', Georgia, serif",
    sans: "'Segoe UI', system-ui, -apple-system, Arial, sans-serif"
  },
  'sans-moderna': {
    serif: "system-ui, -apple-system, 'Segoe UI', Arial, sans-serif",
    sans: "system-ui, -apple-system, 'Segoe UI', Arial, sans-serif"
  },
  'serif-classica': {
    serif: "Georgia, 'Times New Roman', serif",
    sans: "Georgia, 'Times New Roman', serif"
  },
  'sans-arredondada': {
    serif: "'Segoe UI', system-ui, sans-serif",
    sans: "'Segoe UI', system-ui, sans-serif"
  }
};

function hexToRgb(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [0, 0, 0];
}
function rgbToHex([r, g, b]) {
  return '#' + [r, g, b].map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
}
function mixHex(hex, targetHex, amount) {
  const a = hexToRgb(hex), b = hexToRgb(targetHex);
  return rgbToHex(a.map((v, i) => v + (b[i] - v) * amount));
}
const lighten = (hex, amt) => mixHex(hex, '#ffffff', amt);
const darken = (hex, amt) => mixHex(hex, '#000000', amt);

window.__HSM_TEXT_OVERRIDES = {};

function relLuminance(hex) {
  const [r, g, b] = hexToRgb(hex).map(v => {
    v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function applySevColor(varName, hex) {
  if (!hex) return;
  const root = document.documentElement;
  root.style.setProperty(varName, hex);
  root.style.setProperty(varName + '-bg', lighten(hex, 0.88));
  root.style.setProperty(varName + '-text', darken(hex, 0.35));
  root.style.setProperty(varName + '-on', relLuminance(hex) > 0.5 ? '#22262e' : '#ffffff');
}

function applyLogo(url) {
  if (!url) return;
  document.querySelectorAll('link[rel="icon"], link[rel="apple-touch-icon"]').forEach(l => { l.href = url; });
  document.querySelectorAll('img[data-logo]').forEach(img => { img.src = url; img.style.display = ''; });
}

async function applyTheme() {
  try {
    const { data, error } = await supabaseClient.rpc('rpc_get_theme');
    if (error || !data || !data.length) return;
    const t = data[0];
    const root = document.documentElement;

    if (t.cor_navy) {
      root.style.setProperty('--navy', t.cor_navy);
      root.style.setProperty('--navy-2', lighten(t.cor_navy, 0.2));
    }
    if (t.cor_vermelho) {
      root.style.setProperty('--red', t.cor_vermelho);
      root.style.setProperty('--red-bg', lighten(t.cor_vermelho, 0.92));
    }
    applySevColor('--sev-critmax', t.cor_critmax);
    applySevColor('--sev-crit', t.cor_crit);
    applySevColor('--sev-atencao', t.cor_atencao);
    applySevColor('--sev-monitorar', t.cor_monitorar);

    const fonts = THEME_FONT_PRESETS[t.fonte] || THEME_FONT_PRESETS['serif-institucional'];
    root.style.setProperty('--serif', fonts.serif);
    root.style.setProperty('--sans', fonts.sans);

    applyLogo(t.logo_url);

    window.__HSM_TEXT_OVERRIDES = t.textos || {};
    document.querySelectorAll('[data-txt]').forEach(el => {
      const key = el.dataset.txt;
      if (window.__HSM_TEXT_OVERRIDES[key]) el.textContent = window.__HSM_TEXT_OVERRIDES[key];
    });
    document.querySelectorAll('[data-txt-html]').forEach(el => {
      const key = el.dataset.txtHtml;
      if (window.__HSM_TEXT_OVERRIDES[key]) el.innerHTML = window.__HSM_TEXT_OVERRIDES[key];
    });
    document.querySelectorAll('[data-txt-placeholder]').forEach(el => {
      const key = el.dataset.txtPlaceholder;
      if (window.__HSM_TEXT_OVERRIDES[key]) el.placeholder = window.__HSM_TEXT_OVERRIDES[key];
    });
  } catch (e) { /* mantém o visual padrão */ }
}

applyTheme();
