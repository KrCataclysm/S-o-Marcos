/* Cliente Supabase e gestão de sessão (senha única, token em sessionStorage).
   A chave abaixo é a chave pública (anon) do projeto — protegida por RLS,
   nunca dá acesso direto às tabelas, só às funções RPC liberadas. */
const SUPABASE_URL = 'https://nulxutevzmxecajgbjdj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im51bHh1dGV2em14ZWNhamdiamRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMzMDEwODMsImV4cCI6MjA5ODg3NzA4M30.imd8OVCOXGyTZ0xXBxh9XBlB9b3B-JngqhXcR5oRJVc';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const SESSION_KEY = 'hsm_painel_session';

function getSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s.token || !s.expiresAt) return null;
    if (new Date(s.expiresAt).getTime() <= Date.now()) { sessionStorage.removeItem(SESSION_KEY); return null; }
    return s;
  } catch (e) { return null; }
}

function setSession(token, expiresAt) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({ token, expiresAt }));
}

function clearSession() {
  sessionStorage.removeItem(SESSION_KEY);
}

// Redireciona para a tela de senha se não houver sessão válida. Retorna o token ou null.
function requireAuth() {
  const s = getSession();
  if (!s) { window.location.href = 'index.html'; return null; }
  return s.token;
}

async function logout() {
  const s = getSession();
  if (s && s.token) {
    try { await supabaseClient.rpc('rpc_logout', { p_token: s.token }); } catch (e) { /* ignore */ }
  }
  clearSession();
  window.location.href = 'index.html';
}

// Chama uma RPC autenticada; se a sessão tiver expirado no servidor, limpa e redireciona ao login.
async function callAuthed(fn, params) {
  const token = requireAuth();
  if (!token) return { data: null, error: { message: 'sem sessão' } };
  const res = await supabaseClient.rpc(fn, { p_token: token, ...params });
  if (res.error && /sessao invalida ou expirada/i.test(res.error.message || '')) {
    clearSession();
    window.location.href = 'index.html';
  }
  return res;
}
