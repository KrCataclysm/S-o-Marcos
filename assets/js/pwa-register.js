if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => { /* PWA é opcional, ignora se falhar */ });
  });
}

// Reforço além do bloqueio visual (rotate-overlay): tenta travar via API do
// navegador quando suportado (só funciona em app instalado/tela cheia).
if (screen.orientation && screen.orientation.lock) {
  screen.orientation.lock('portrait').catch(() => { /* sem suporte nesse contexto, tudo bem */ });
}
