# PAPL — Protocolo de Avaliação dos Preditores da Leitura na Pré-Escola

Sistema web completo para aplicação do protocolo PAPL por avaliadores. Multiusuário, com
autenticação JWT, cadastro de crianças, aplicação sequencial das cinco habilidades do
protocolo (com autosave), histórico, pontuações e resultado detalhado.

## Stack

| Camada    | Tecnologia                                                     |
| --------- | -------------------------------------------------------------- |
| Front-end | React 18 + TypeScript + Vite + React Router                    |
| Back-end  | Node.js + TypeScript + NestJS                                   |
| Banco     | PostgreSQL 16                                                  |
| ORM       | Prisma                                                         |
| Auth      | JWT (access + refresh), Argon2id, tokens opacos com hash       |
| Validação | class-validator (back), validação manual (front)               |
| Testes    | Vitest + Testing Library (front), Jest + Supertest (back)      |

## Estrutura

```
PAPL/
├── backend/          # API NestJS + Prisma
│   ├── prisma/       # schema, migrations, seed
│   ├── src/
│   │   ├── auth/     # cadastro, login, refresh, verificação, recuperação
│   │   ├── children/ # CRUD de crianças + histórico
│   │   ├── applications/ # aplicações, etapas, itens, autosave, finalização
│   │   ├── protocol/ # estrutura do protocolo + classificação
│   │   ├── mail/     # adaptadores de e-mail (dev/smtp)
│   │   └── blob/     # abstração de blob storage (local/s3/azure)
│   └── test/         # helpers e setup de testes
├── frontend/         # SPA React
│   └── src/
│       ├── pages/    # login, cadastro, dashboard, crianças, aplicação, resultado
│       ├── components/
│       └── lib/      # cliente de API, tipos, formatação
├── docker-compose.yml
└── SPEC.md           # especificação funcional
```

## Pré-requisitos

- Node.js ≥ 18
- Docker (para o PostgreSQL) **ou** um PostgreSQL já disponível

## Subindo o banco

```bash
docker compose up -d postgres
```

Cria o banco `papl` com usuário `papl`/`papl` na porta `5432`.

> Se já existir um PostgreSQL na porta 5432, ajuste a porta no
> `docker-compose.yml` e em `backend/.env`.

## Back-end

```bash
cd backend
cp .env.example .env      # ajuste as variáveis se necessário
npm install
npx prisma migrate dev    # cria as tabelas (migrations)
npm run seed              # protocolo + usuário de desenvolvimento
npm run start:dev         # API em http://localhost:3000
```

Documentação interativa da API (Swagger): `http://localhost:3000/docs`.

### Usuário de desenvolvimento (criado pelo seed)

| Campo    | Valor              |
| -------- | ------------------ |
| E-mail   | `avaliador@papl.dev` |
| Senha    | `Pap1@2024`          |

### Cadastro por confiança no e-mail informado

O sistema confia no e-mail informado no cadastro e ativa a conta imediatamente. Não há
etapa de confirmação de e-mail. O modo de e-mail `dev` continua disponível apenas para
os links de recuperação de senha:

```
GET http://localhost:3000/dev/emails
```

ou procure no terminal a mensagem `[DEV MAIL]` referente à recuperação de senha.

## Front-end

```bash
cd frontend
cp .env.example .env      # opcional (proxy já aponta para o back-end)
npm install
npm run dev               # http://localhost:5173
```

O Vite faz proxy de `/api` para `http://localhost:3000`. Em produção, defina
`VITE_API_URL` para a URL da API.

## Scripts úteis

| Comando (raiz de cada pacote) | Descrição                                |
| ----------------------------- | ---------------------------------------- |
| `npm run build`               | Compila o pacote                         |
| `npm run test`                | Executa os testes automatizados          |
| `npm run lint`                | Lint (ESLint)                            |
| `npm run prisma:migrate`      | `prisma migrate dev` (cria migrations)   |
| `npm run seed`                | Popula o banco com o protocolo e dev user |
| `npm run start:dev`           | Sobe o serviço em modo desenvolvimento   |

Back-end (testes): `npm test`. Front-end (testes): `npm test`.

## Variáveis de ambiente

Ambas as pastas possuem `.env.example`. As principais do back-end:

| Variável                | Padrão                          | Descrição                                  |
| ----------------------- | ------------------------------- | ------------------------------------------ |
| `DATABASE_URL`          | `postgresql://papl:papl@localhost:5432/papl` | Conexão com o PostgreSQL      |
| `JWT_ACCESS_SECRET`     | —                               | Segredo do access token (troque em produção) |
| `JWT_REFRESH_SECRET`    | —                               | Segredo do refresh token (troque em produção) |
| `JWT_ACCESS_EXPIRES_IN` | `900`                           | Validade do access token (segundos)        |
| `JWT_REFRESH_EXPIRES_IN`| `604800`                        | Validade do refresh token (segundos)       |
| `PASSWORD_TOKEN_EXPIRES_IN` | `3600`                      | Validade do token de recuperação           |
| `CORS_ORIGIN`           | `http://localhost:5173`         | Origem permitida para o front-end          |
| `MAIL_DRIVER`           | `dev`                           | `dev` (terminal/MailLog) ou `smtp`         |
| `SMTP_*`                | —                               | Configuração do SMTP quando `MAIL_DRIVER=smtp` |
| `BLOB_DRIVER`           | `local`                         | `local`, `s3` ou `azure`                   |
| `BLOB_LOCAL_DIR`        | `./storage`                     | Diretório do storage local                 |
| `SEED_DEV_EMAIL`/`SEED_DEV_PASSWORD` | `avaliador@papl.dev` / `Pap1@2024` | Usuário criado no seed        |

## API

Swagger completo em `/docs`. Resumo dos endpoints:

### Autenticação
| Método | Rota                          | Descrição                       |
| ------ | ----------------------------- | ------------------------------- |
| POST   | `/auth/register`              | Cadastro e ativação imediata    |
| POST   | `/auth/login`                 | Login (access + refresh)        |
| POST   | `/auth/refresh`               | Renova os tokens                |
| POST   | `/auth/logout`                | Revoga o refresh token          |
| POST   | `/auth/forgot-password`       | Solicita recuperação de senha   |
| POST   | `/auth/reset-password`        | Define nova senha com token     |
| GET    | `/auth/me`                    | Usuário autenticado             |
| PATCH  | `/auth/me`                    | Atualiza perfil                 |

### Crianças (protegidas)
| Método | Rota               | Descrição                          |
| ------ | ------------------ | ---------------------------------- |
| GET    | `/children`        | Lista (busca, filtro, ordenação)   |
| POST   | `/children`        | Cadastra criança                   |
| GET    | `/children/:id`    | Detalhes + histórico de aplicações |
| PATCH  | `/children/:id`    | Atualiza                           |
| DELETE | `/children/:id`    | Remove                             |
| GET    | `/children/:id/history` | Histórico completo            |

### Aplicações (protegidas)
| Método | Rota                                       | Descrição                        |
| ------ | ------------------------------------------ | -------------------------------- |
| GET    | `/applications`                            | Lista aplicações do avaliador    |
| POST   | `/applications`                            | Cria aplicação (IN_PROGRESS)     |
| GET    | `/applications/:id`                        | Detalhes (etapas e itens)        |
| PATCH  | `/applications/:id`                        | Atualiza etapa atual/observações |
| POST   | `/applications/:id/steps/:n/items`         | Salva resposta (autosave)        |
| PATCH  | `/applications/:id/steps/:n`               | Marca etapa / observações        |
| POST   | `/applications/:id/complete`               | Finaliza e calcula pontuações    |
| POST   | `/applications/:id/reopen`                 | Reabre aplicação finalizada      |
| GET    | `/applications/:id/result`                 | Resultado detalhado              |

### Protocolo (protegidas)
| Método | Rota                      | Descrição                              |
| ------ | ------------------------- | -------------------------------------- |
| GET    | `/protocol/steps`         | Estrutura (etapas, subetapas, itens)   |
| GET    | `/protocol/classification`| Regras de classificação ativas         |
| POST   | `/protocol/classification`| Cria/atualiza regra de classificação   |

Todas as rotas protegidas validam o token e **impedem o acesso a registros de outros
avaliadores** (isolamento por `evaluatorId`).

## Protocolo (seed) e itens pendentes

O seed popula as cinco etapas:

1. Conhecimento do alfabeto (vogais 5 + consoantes 18 = 23 itens) — **transcritos**;
2. Habilidades metafonológicas (4 subetapas × 21 itens);
3. Memória operacional fonológica (24 pseudopalavras);
4. Nomeação automática rápida (prancha de figuras, cronometrada);
5. Compreensão auditiva de sentenças (20 sentenças).

**Itens que precisam de conferência manual:** o material original do PAPL (PDF/pranchas)
não acompanha este repositório. Itens cuja fonte é exclusivamente o material visual/impresso
do protocolo são criados com `isPending = true` e **sem valores fictícios**. São eles:

- Etapa 2 (síntese/segmentação silábica, identificação de som/sílaba inicial e produção de
  palavras): 84 itens;
- Etapa 3 (pseudopalavras): 24 itens;
- Etapa 4 (prancha de figuras): 1 item cronometrado;
- Etapa 5 (sentenças): 20 itens.

Na interface, esses itens são marcados como “Aguardando conferência” e o avaliador pode
digitar o material apresentado diretamente no formulário durante a aplicação. Para fornecer
o conteúdo permanente, edite a tabela `ProtocolItem` (campo administrativo) ou forneça o PDF
para transcrição e atualize o seed.

## Classificação de risco

Os limites de “sem risco”, “risco médio” e “alto risco” **não constam no protocolo
disponível**. Portanto, a classificação é armazenada como regra configurável na tabela
`ClassificationConfig`. Sem regra ativa, o resultado exibe **“não configurada”**. Para
configurar, utilize `POST /protocol/classification` ou insira linhas no seed.

## Segurança

- Senhas com Argon2id (memory cost 19 MiB, iterations 2);
- Tokens de confirmação/recuperação e refresh tokens armazenados apenas com hash SHA-256;
- Expiração e revogação de tokens;
- Rate limit no login, refresh, recuperação e envio de e-mails (`@nestjs/throttler`);
- Validação de entrada no front e back, sanitização de strings, CORS restrito;
- Filtro global de erros que não vaza stack traces;
- `.env` nunca versionado (ver `.gitignore`).

## Testes

```bash
# Back-end (requer PostgreSQL; cria o banco papl_test automaticamente)
cd backend
npm test

# Front-end
cd frontend
npm test
```

Cobertura solicitada:
- **Back:** cadastro, login, senha inválida, confirmação de e-mail, recuperação de senha,
  criação de criança, isolamento entre usuários, criação de aplicação, autosave, cálculo de
  pontuações, finalização e bloqueio de edição após finalização.
- **Front:** login, cadastro, dashboard, lista de crianças, formulário de nova aplicação,
  navegação entre etapas, salvamento de respostas e tela de resultado.

## Critérios de aceite

Criar conta, confirmar e-mail em modo dev, login, cadastrar criança, ver a criança na lista,
abrir detalhes, iniciar nova aplicação, ver as cinco habilidades na ordem, registrar
respostas, persistir respostas, sair e continuar, calcular pontuações, finalizar, ver
resultado no histórico, isolamento entre avaliadores, build passando e testes passando — tudo
verificado na seção de testes e na documentação acima.