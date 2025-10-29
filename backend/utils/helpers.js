function getCharacterIdFromUrl(url) {
    try {
        const targetUrl = new URL(url);
        const pathParts = targetUrl.pathname.split('/');
        return pathParts[pathParts.length - 1];
    } catch (error) {
        console.error('URL inválida:', url);
        return null;
    }
}

module.exports = { 
    getCharacterIdFromUrl 
};