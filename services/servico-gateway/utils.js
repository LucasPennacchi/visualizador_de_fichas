// services/servico-gateway/utils.js
function getCharacterIdFromUrl(url) {
  try {
    const targetUrl = new URL(url);
    const pathParts = targetUrl.pathname.split('/');
    // Pega o último item que não seja vazio
    return pathParts.filter(p => p).pop() || null;
  } catch (error) {
    console.error('[Gateway] URL inválida:', url, error.message);
    return null;
  }
}

module.exports = { getCharacterIdFromUrl };