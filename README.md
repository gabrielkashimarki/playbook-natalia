# Playbook Comercial — Clínica Natália Penteado

Kanban interativo para a equipe comercial. Editável, com autenticação por senha e banco de dados persistente.

## Stack

- **Node.js 22.x** + Express
- **SQLite** via better-sqlite3 (zero config, arquivo único)
- **Autenticação** por senha com cookie seguro (30 dias)
- **Frontend** vanilla JS com drag-and-drop nativo

## Instalação Local

```bash
git clone https://github.com/SEU_USUARIO/playbook-natalia.git
cd playbook-natalia
npm install
npm run seed    # Cria o banco com conteúdo pré-carregado
npm start       # Inicia em http://localhost:3000
```

Senha padrão: `natalia2026`

## Deploy na Hostinger (Node.js)

### 1. No painel Hostinger

1. Acesse **Websites > Gerenciar > Avançado > Node.js**
2. Versão do Node: **22.x**
3. Diretório raiz: `/home/SEU_USUARIO/playbook` (ou o que preferir)
4. Arquivo de entrada: `server.js`
5. Comando de build: `npm install && npm run seed`
6. Variáveis de ambiente:
   - `APP_PASSWORD` = senha desejada
   - `PORT` = porta que a Hostinger atribuir
   - `NODE_ENV` = production
   - `SESSION_SECRET` = uma string aleatória longa

### 2. Via Git

```bash
# Na Hostinger, ative o Git em Avançado > Git
# Clone o repositório no diretório configurado
cd /home/SEU_USUARIO/playbook
git clone https://github.com/SEU_USUARIO/playbook-natalia.git .
npm install
npm run seed
# Reinicie a aplicação Node.js no painel
```

### 3. Via FTP / Gerenciador de Arquivos

1. Faça upload de todos os arquivos para o diretório configurado
2. No terminal SSH: `cd /home/SEU_USUARIO/playbook && npm install && npm run seed`
3. Reinicie a aplicação no painel

## Estrutura

```
playbook-app/
├── server.js          # Servidor Express + Auth + API
├── seed.js            # Popula o banco com conteúdo inicial
├── package.json
├── .env.example
├── .gitignore
├── views/
│   ├── login.html     # Tela de login
│   └── board.html     # Kanban principal
├── public/
│   ├── style.css      # Estilos
│   └── app.js         # Frontend (CRUD + drag-drop)
└── data/
    └── playbook.db    # Banco SQLite (criado pelo seed)
```

## API

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/columns` | Lista colunas com cards |
| POST | `/api/columns` | Criar coluna |
| PUT | `/api/columns/:id` | Editar coluna |
| DELETE | `/api/columns/:id` | Excluir coluna |
| POST | `/api/cards` | Criar card |
| PUT | `/api/cards/:id` | Editar card |
| DELETE | `/api/cards/:id` | Excluir card |
| POST | `/api/cards/move` | Mover card entre colunas |

## Customização

- **Trocar senha:** Altere `APP_PASSWORD` no `.env` ou variáveis de ambiente
- **Adicionar colunas:** Clique em "+ Coluna" no board
- **Editar cards:** Clique no card → edite título, rótulo, conteúdo HTML
- **Arrastar cards:** Drag-and-drop entre colunas
- **Novo conteúdo HTML:** Use as classes `.msg-box`, `.msg-box.good`, `.msg-box.bad`, `.tag-when`, `.tag-obj` para manter o visual

## Licença

Uso privado — Smarten Digital Solutions / Clínica Natália Penteado.
