# Triagem de ocorrências

Mini central de triagem de ocorrências detectadas por drones. A API recebe os alertas, agrupa repetições e controla o status de cada ocorrência; a tela lista as ocorrências por prioridade e permite reconhecê-las e resolvê-las.

Backend em Node.js + TypeScript + MongoDB (Express e Mongoose) e frontend em React + TypeScript (Vite).

## Como rodar

Pré-requisitos:

- Node.js 20.19+ e npm (desenvolvido e validado com Node.js 24.11)
- MongoDB
- Docker (opcional)

### MongoDB

```bash
docker run -d \
  --name aeroscan-mongo \
  -p 27017:27017 \
  mongo:8
```

### Backend

```bash
cd backend
npm install
npm run dev
```

A API sobe em `http://localhost:3000`. A configuração vem das variáveis `PORT` e `MONGODB_URI` (veja `backend/.env.example`); sem elas, os padrões são `3000` e `mongodb://localhost:27017/aeroscan`. Um arquivo `backend/.env` é carregado automaticamente, se existir.

Para rodar o JavaScript compilado em vez do modo de desenvolvimento:

```bash
npm run build
npm start
```

### Backend com Docker (opcional)

A partir da raiz do projeto, usando o MongoDB do passo anterior:

```bash
docker build -t aeroscan-backend backend
docker run -d --name aeroscan-backend -p 3000:3000 \
  --add-host=host.docker.internal:host-gateway \
  -e MONGODB_URI=mongodb://host.docker.internal:27017/aeroscan \
  aeroscan-backend
```

### Frontend em desenvolvimento

Com a API rodando:

```bash
cd frontend
npm install
npm run dev
```

E acesse `http://localhost:5173`.

## Frontend compilado

A pasta `frontend/dist` já contém o frontend compilado. Não é necessário rodar o build para gerar esses arquivos.

O bundle do Vite não funciona abrindo o `index.html` direto no navegador (`file://`), então a pasta deve ser servida por um servidor HTTP estático. Por exemplo, a partir da raiz do projeto:

```bash
python3 -m http.server 4173 --directory frontend/dist
```

Dependendo do sistema, o executável pode se chamar `python` em vez de `python3`. Depois, acesse `http://localhost:4173`.

O build entregue consome a API em `http://localhost:3000`. Para usar outro endereço, gere um novo build definindo `VITE_API_URL`. Em shells compatíveis com bash:

```bash
cd frontend
VITE_API_URL=http://localhost:4000 npm run build
```

Em qualquer shell (inclusive CMD/PowerShell), crie `frontend/.env` com:

```env
VITE_API_URL=http://localhost:4000
```

E rode `npm run build` dentro de `frontend`.

## API

```text
POST  /occurrences
GET   /occurrences?status=&siteId=
PATCH /occurrences/:id/status
```

- `POST` recebe um alerta e cria uma ocorrência, ou agrupa na ocorrência aberta do mesmo `siteId` e `type` detectada nos 10 minutos anteriores.
- `GET` lista as ocorrências por prioridade (`severity` × peso do tipo, calculada e não persistida) e, no empate, pela detecção mais recente. `status` e `siteId` são filtros opcionais.
- `PATCH` aceita apenas `open → acknowledged` e `acknowledged → resolved`; resolver exige `note`.

Erros retornam `{ "message": "..." }` com `400` (entrada inválida), `404` (ocorrência inexistente) ou `409` (transição de status inválida).

## Como usei IA

Usei duas ferramentas, com papéis diferentes:

- **ChatGPT**, para orquestrar o desenvolvimento: dividir o desafio em etapas, revisar os resultados de cada uma, discutir alternativas e levantar pontos que mereciam minha atenção.
- **Claude Code**, como ferramenta de execução dentro do projeto: fazia as alterações de código, rodava os comandos e executava as validações que eu pedia.

As decisões técnicas ficaram comigo. Eu definia e aprovava o escopo de cada etapa antes da implementação, e arquitetura, bibliotecas, regras de negócio e premissas passavam pela minha avaliação. O Claude Code recebia tarefas delimitadas e não avançava para a etapa seguinte sem a minha revisão; as sugestões das duas ferramentas eram tratadas como sugestões, não como decisões. Revisei os resultados, pedi correções quando algo não estava adequado e mantive a implementação propositalmente simples, sem abstrações que o desafio não pedia.

## Premissas

- Ao agrupar uma repetição, `detectedAt` passa a representar a última detecção; com isso, a janela de 10 minutos conta a partir da última repetição.
- Numa repetição, a severidade existente sobe exatamente +1, limitada a 5; a `severity` recebida no novo alerta não substitui a atual.
- O agrupamento usa somente `siteId + type`, como descrito no desafio; `droneId` não participa da identificação de repetição.
- Numa ocorrência agrupada, o `droneId` continua sendo o da primeira detecção.
- Uma diferença de exatamente 10 minutos ainda está dentro da janela.
- Um alerta com `detectedAt` anterior à última detecção da ocorrência aberta não é agrupado nela.
- `detectedAt` exige data e hora em formato ISO (por exemplo, `2026-09-27T12:30:00Z`).
- Uma data ISO sem timezone é interpretada no timezone do runtime do servidor.
