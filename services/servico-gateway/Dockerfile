# ==============================================================================
# Módulo: Infrastructure/Docker/Gateway
# Descrição: Definição da imagem do contêiner para o microserviço de Gateway (WebSocket).
# Estratégia: Otimização de cache de camadas para dependências Node.js.
# ==============================================================================

# 1. Definição da Imagem Base
# Utiliza a versão 'alpine' do Node.js 18 para reduzir a superfície de ataque e tamanho.
FROM node:18-alpine

# 2. Metadados da Imagem (OCI Annotations)
LABEL org.opencontainers.image.title="GM Dashboard - Gateway Service"
LABEL org.opencontainers.image.description="Microserviço responsável pelo gerenciamento de conexões WebSocket e Pub/Sub"
LABEL org.opencontainers.image.authors="Lucas Hideki Okido"
LABEL org.opencontainers.image.version="1.0.0"
LABEL org.opencontainers.image.source="https://github.com/LucasPennacchi/visualizador_de_fichas"

# 3. Configuração do Ambiente
WORKDIR /usr/src/app

# 4. Instalação de Dependências (Layer Caching)
# A separação da cópia do package.json permite que o Docker reutilize a camada
# de 'npm install' se as dependências não tiverem mudado, acelerando o build.
COPY package*.json ./

# Instala apenas dependências de produção (ignora devDependencies) para otimização.
RUN npm install --only=production

# 5. Transferência do Código Fonte
COPY . .

# 6. Ponto de Entrada
# Inicia o servidor Gateway.
CMD ["node", "index.js"]