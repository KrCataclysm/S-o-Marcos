/* Comentários por painel: "Nome - Comentário" digitado livre, sem parsing. */
async function carregarComentarios(painelId) {
  const lista = $('listaComentarios');
  const { data, error } = await callAuthed('rpc_list_comentarios', { p_painel_id: painelId });
  if (error) { lista.innerHTML = '<p class="hist-error">Não foi possível carregar os comentários.</p>'; return; }
  if (!data || !data.length) { lista.innerHTML = '<p class="footnote">Nenhum comentário ainda.</p>'; return; }
  lista.innerHTML = data.map(c => `<div class="comentario-item">
    <div class="comentario-texto">${escapeHtml(c.texto)}</div>
    <div class="comentario-data">${new Date(c.criado_em).toLocaleString('pt-BR')}</div>
  </div>`).join('');
}

function initComentarios(painelId) {
  carregarComentarios(painelId);

  const input = $('txtComentario'), btn = $('btnEnviarComentario');
  const enviar = async () => {
    const texto = input.value.trim();
    if (!texto) return;
    btn.disabled = true;
    const { error } = await callAuthed('rpc_add_comentario', { p_painel_id: painelId, p_texto: texto });
    btn.disabled = false;
    if (!error) { input.value = ''; carregarComentarios(painelId); }
  };
  btn.addEventListener('click', enviar);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') enviar(); });
}
