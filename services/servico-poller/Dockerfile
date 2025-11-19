# ==============================================================================
# Módulo: Infrastructure/Docker/Worker
# Descrição: Definição da imagem para o microserviço Poller (Worker).
# Estratégia: Configuração stateless para permitir escalabilidade horizontal.
# ==============================================================================

# 1. Definição da Imagem Base
FROM node:18-alpine

# 2. Metadados da Imagem (OCI Annotations)
LABEL org.opencontainers.image.title="GM Dashboard - Poller Worker"
LABEL org.opencontainers.image.description="Worker responsável pelo processamento de jobs da fila e busca de dados externos"
LABEL org.opencontainers.image.authors="Lucas Hideki Okido"
LABEL org.opencontainers.image.version="1.0.0"
LABEL org.opencontainers.image.source="https://github.com/LucasPennacchi/visualizador_de_fichas"

# 3. Configuração do Ambiente
WORKDIR /usr/src/app

# 4. Instalação de Dependências (Layer Caching)
COPY package*.json ./
RUN npm install --only=production

# 5. Transferência do Código Fonte
COPY . .

# 6. Ponto de Entrada
# Inicia o loop de processamento do Worker.
CMD ["node", "index.js"]