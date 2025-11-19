# ==============================================================================
# Módulo: Infrastructure/Docker/Scheduler
# Descrição: Definição da imagem do contêiner para o microserviço de Agendamento.
# Estratégia: Multi-stage build implícito focada em otimização de cache e segurança.
# ==============================================================================

# 1. Definição da Imagem Base
# Utiliza a versão 'alpine' do Node.js 18.
# Justificativa Técnica: O Alpine Linux é uma distribuição minimalista (~5MB),
# resultando em imagens finais menores e menor superfície de ataque (CVEs).
FROM node:18-alpine

# 2. Metadados da Imagem (OCI Annotations)
# Adiciona metadados formais que podem ser inspecionados via 'docker inspect'.
LABEL org.opencontainers.image.title="GM Dashboard - Scheduler Service"
LABEL org.opencontainers.image.description="Microserviço responsável pelo agendamento periódico de jobs"
LABEL org.opencontainers.image.authors="Lucas Hideki Okido"
LABEL org.opencontainers.image.version="1.0.0"
LABEL org.opencontainers.image.source="https://github.com/LucasPennacchi/visualizador_de_fichas"

# 3. Configuração do Ambiente
# Define o diretório de trabalho dentro do contêiner.
WORKDIR /usr/src/app

# 4. Instalação de Dependências (Estratégia de Layer Caching)
# Passo A: Copia apenas os arquivos de manifesto de dependências.
COPY package*.json ./

# Passo B: Instala as dependências.
# Motivo da separação: O Docker armazena cada comando como uma camada (layer).
# Se o 'package.json' não foi alterado, o Docker reutiliza esta camada do cache,
# evitando rodar 'npm install' novamente e acelerando o build drasticamente.
RUN npm install --only=production

# 5. Transferência do Código Fonte
# Copia todo o restante dos arquivos do diretório local para o contêiner.
# Esta instrução vem após o 'npm install' para garantir que mudanças apenas no
# código-fonte não invalidem o cache das dependências instaladas acima.
COPY . .

# 6. Configuração de Execução
# Define o usuário 'node' (não-root) por segurança, se a imagem permitir (opcional, mas recomendado).
# USER node

# 7. Ponto de Entrada (Entrypoint)
# Define o comando padrão que será executado quando o contêiner for iniciado.
CMD ["node", "index.js"]