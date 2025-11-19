Com certeza. O `README.md` é a "vitrine" do seu projeto e, dada a complexidade da arquitetura de microserviços que construímos, ele precisa ser bem detalhado para explicar como as peças se encaixam.

Aqui está um `README.md` profissional, cobrindo arquitetura, instalação, uso e estrutura do código.

-----

# GM Dashboard - Visualizador de Fichas em Tempo Real

> Um sistema distribuído baseado em microserviços para monitoramento em tempo real de fichas de RPG da plataforma C.R.I.S. (Ordem Paranormal).

O **GM Dashboard** permite que Mestres de Jogo (GMs) visualizem o status (Vida, Sanidade, Inventário, Perícias) de múltiplos jogadores simultaneamente. A aplicação detecta alterações na fonte de dados original e atualiza a interface instantaneamente via WebSockets, sem necessidade de recarregar a página.

-----

## Arquitetura do Sistema

O projeto abandonou a arquitetura monolítica tradicional em favor de uma **Arquitetura de Microserviços** orientada a eventos, garantindo alta disponibilidade, desacoplamento e escalabilidade horizontal.

O sistema é composto por 4 componentes principais orquestrados via Docker Compose:

1.  **Gateway Service (`servico-gateway`):**
      * **Responsabilidade:** Gerenciamento de conexões WebSocket.
      * **Função:** Ponto único de entrada. Mantém conexões persistentes com o Frontend. Inscreve-se em canais do Redis Pub/Sub para receber atualizações e consulta o Cache para envio rápido de dados iniciais.
2.  **Worker Service (`servico-poller`):**
      * **Responsabilidade:** Busca e processamento de dados.
      * **Função:** Consome tarefas de uma Fila de Prioridade no Redis. Busca dados da API externa (Google Firestore), compara com o cache local para detectar mudanças (Delta Check) e publica atualizações apenas quando necessário. É escalável horizontalmente (suporta *N* instâncias).
3.  **Scheduler Service (`servico-scheduler`):**
      * **Responsabilidade:** Agendamento de tarefas (Heartbeat).
      * **Função:** Periodicamente (a cada 5s) identifica todas as fichas ativas no sistema e enfileira jobs de revalidação para os Workers.
4.  **Message Broker & Cache (`redis`):**
      * **Responsabilidade:** Comunicação e Estado.
      * **Função:** Atua como barramento de mensagens (Pub/Sub), Fila de Trabalho (List) e Cache de Dados (Key-Value Store).

-----

## Funcionalidades

### Backend (Distribuído)

  * **Arquitetura Reativa:** Atualizações enviadas apenas quando há mudanças reais nos dados.
  * **Escalabilidade Horizontal:** Suporte para executar múltiplos *Workers* simultâneos para dividir a carga de processamento (`--scale poller=N`).
  * **Resiliência:** A falha de um serviço de busca não desconecta os clientes.
  * **Otimização de Recursos:** "Garbage Collection" de assinaturas que para de monitorar fichas que não possuem mais espectadores ativos.

### Frontend (Modular)

  * **Interface Dinâmica:** Cards expansíveis com detalhes de Habilidades, Rituais, Inventário e Perícias.
  * **Drag-and-Drop:** Organização visual dos cards arrastando e soltando (persiste no LocalStorage).
  * **Rolador de Dados Customizado:**
      * Interpretador próprio (sem dependências externas quebradas).
      * Suporte a operações matemáticas complexas (`2d20 + 1d6 - 3`).
      * Suporte a Vantagem (`kh1` - Keep Highest) e Desvantagem (`kl1` - Keep Lowest).
  * **Normalização de Links:** Aceita tanto URLs completas quanto apenas o ID/Código da ficha.

-----

## Tecnologias Utilizadas

  * **Runtime:** Node.js (v18 Alpine)
  * **Containerização:** Docker & Docker Compose
  * **Banco de Dados/Broker:** Redis
  * **Frontend:** Vanilla JS (ES6 Modules), CSS3, HTML5
  * **Bibliotecas Principais:**
      * `ioredis`: Comunicação com Redis.
      * `ws`: Servidor WebSocket.
      * `axios`: Requisições HTTP.
      * `SortableJS`: Drag-and-drop no frontend.
      * `GNOLL` (Lógica base de dados adaptada).

-----

## Como Executar o Projeto

### Pré-requisitos

  * [Docker](https://www.docker.com/) e Docker Compose instalados.
  * [Ngrok](https://ngrok.com/) (para expor o localhost para a internet/GitHub Pages).

### Passo 1: Iniciar o Backend (Local)

Na raiz do projeto, execute:

```bash
# Constrói as imagens e sobe os containers
# Opcional: use --scale poller=4 para testar paralelismo
docker compose up --build
```

### Passo 2: Criar o Túnel (Ngrok)

O Frontend (hospedado no GitHub Pages) precisa se comunicar com o seu Docker local. Abra um novo terminal:

```bash
# Expõe a porta do Gateway (3000)
ngrok http 3000
```

Copie a URL gerada pelo Ngrok (ex: `https://xxxx-xxxx.ngrok-free.app`). Apenas o domínio é necessário.

### Passo 3: Acessar o Dashboard

Acesse o link do seu GitHub Pages adicionando o parâmetro `?ws=` com o domínio do Ngrok:

```
https://seu-usuario.github.io/visualizador_de_fichas/?ws=xxxx-xxxx.ngrok-free.app
```

-----

## Estrutura de Pastas

```
/
├── docker-compose.yml          # Orquestração dos contêineres
├── services/                   # Microserviços do Backend
│   ├── servico-gateway/        # API Gateway & WebSocket
│   ├── servico-scheduler/      # Agendador de Tarefas
│   └── servico-poller/         # Worker de Busca de Dados
└── frontend/                   # Aplicação Cliente (Static)
    ├── css/                    # Estilos modulares
    │   ├── card/               # Estilos específicos dos cards
    │   └── ...
    ├── js/
    │   ├── lib/                # Bibliotecas externas locais
    │   ├── ui/                 # Módulos de Interface
    │   │   ├── dice-roller/    # Módulo completo de dados
    │   │   └── ...
    │   ├── api.js              # Camada de Rede
    │   ├── main.js             # Entry Point
    │   └── store.js            # Gerenciamento de Estado Local
    └── index.html
```

-----

## Uso do Rolador de Dados

O rolador de dados integrado suporta a seguinte notação:

  * **Simples:** `1d20`, `2d6`, `1d4 + 5`.
  * **Vantagem:** Selecione "Vantagem" na UI. O sistema converte `1d20` automaticamente para `2d20kh1` (Rola 2, mantém o maior 1).
  * **Desvantagem:** Selecione "Desvantagem" na UI. O sistema converte `1d20` automaticamente para `2d20kl1` (Rola 2, mantém o menor 1).
  * **Matemática:** `(1d8 + 3) * 2` (Dano Crítico).

-----

## Próximos Passos (Roadmap)

1.  **Exportação/Importação:** Salvar o estado atual de um card em JSON.
2.  **Modo Combate:** Sistema de Iniciativa visual, com destaque para o turno atual.
3.  **Suporte Multi-Sistema:** Implementação do padrão *Adapter* no backend para suportar fichas de D\&D 5e e Tormenta20.
4.  **Player de Música:** Sincronização de áudio entre clientes conectados na mesma sessão.