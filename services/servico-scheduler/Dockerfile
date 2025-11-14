# services/servico-scheduler/Dockerfile

# 1. Use uma imagem base leve do Node.js
FROM node:18-alpine

# 2. Defina o diretório de trabalho dentro do contêiner
WORKDIR /usr/src/app

# 3. Copie o package.json e instale as dependências
COPY package*.json ./
RUN npm install

# 4. Copie o resto do código da aplicação
COPY . .

# 5. O comando para iniciar a aplicação
CMD ["node", "index.js"]