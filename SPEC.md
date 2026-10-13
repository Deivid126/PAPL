# Construção do sistema PAPL

Você deve construir um sistema web completo para aplicação do **Protocolo de Avaliação dos Preditores da Leitura na Pré-Escola — PAPL**, utilizando:

- Front-end: React + TypeScript + Vite
- Back-end: Node.js + TypeScript + NestJS
- Banco de dados: PostgreSQL
- ORM: Prisma
- Autenticação: JWT com access token e refresh token
- Senhas: hash seguro com Argon2 ou bcrypt
- Validação: Zod ou class-validator
- Testes: Vitest no front-end e Jest no back-end
- Interface responsiva para desktop e tablet
- Idioma da interface: português do Brasil

Não faça apenas um protótipo visual. Implemente o fluxo funcional completo, incluindo banco de dados, autenticação, persistência, validações, navegação e testes.

---

## 1. Objetivo do sistema

O sistema permitirá que um avaliador:

1. Crie uma conta usando nome, e-mail e senha;
2. Confirme o cadastro por e-mail;
3. Faça login;
4. Cadastre e acompanhe crianças avaliadas;
5. Consulte a lista de crianças já avaliadas;
6. Abra o histórico e os detalhes de cada criança;
7. Inicie uma nova aplicação do protocolo PAPL;
8. Execute as etapas do protocolo em sequência;
9. Registre as respostas e pontuações;
10. Salve a aplicação como rascunho;
11. Finalize a aplicação;
12. Consulte o resultado detalhado da avaliação.

---

## 2. Regras importantes

- O sistema deve ser multiusuário.
- Cada avaliador só pode visualizar suas próprias crianças e aplicações.
- Não armazenar senhas em texto puro.
- O e-mail deve ser único.
- O cadastro precisa ter confirmação por e-mail.
- A aplicação deve ser salva automaticamente a cada etapa.
- O avaliador deve poder continuar uma aplicação interrompida.
- O avaliador deve poder voltar para etapas anteriores antes de finalizar.
- Depois de finalizada, a aplicação deve ficar bloqueada para edição, salvo se houver uma ação explícita de reabertura.
- Toda aplicação deve possuir data de início, data de finalização e status.
- O sistema deve manter histórico de aplicações para a mesma criança.
- Não invente critérios de classificação de risco que não estejam claramente definidos no protocolo original. Caso os limites de “sem risco”, “risco médio” e “alto risco” não estejam disponíveis, implemente esses valores como configuração administrativa ou deixe a classificação como “não configurada”.

---

## 3. Fluxo de autenticação

Criar as seguintes telas:

### 3.1 Cadastro

Campos:

- Nome completo;
- E-mail;
- Senha;
- Confirmação da senha;
- Aceite dos termos.

Validações:

- Nome obrigatório;
- E-mail válido;
- Senha com no mínimo 8 caracteres;
- Confirmação igual à senha;
- E-mail não pode estar previamente cadastrado.

Após o cadastro:

- Criar o usuário;
- Gerar token de confirmação;
- Enviar e-mail de confirmação;
- Exibir a tela informando que o usuário deve confirmar o e-mail.

Durante o desenvolvimento, criar um adaptador de e-mail com modo de desenvolvimento que registre o link no terminal ou em uma tabela de e-mails enviados.

### 3.2 Confirmação de e-mail

Criar rota para confirmação por token.

Após confirmação:

- Marcar o usuário como verificado;
- Invalidar o token;
- Redirecionar para o login.

### 3.3 Login

Campos:

- E-mail;
- Senha.

Funcionalidades:

- Login com credenciais válidas;
- Mensagem de erro para credenciais inválidas;
- Bloqueio de acesso se o e-mail não estiver confirmado;
- Recuperação de senha;
- Logout;
- Proteção das rotas privadas.

### 3.4 Recuperação de senha

Criar:

- Tela para solicitar recuperação;
- Envio de token por e-mail;
- Tela para cadastrar nova senha;
- Expiração do token;
- Invalidação do token após uso.

---

## 4. Modelo de dados

Criar as seguintes entidades no Prisma.

### User

Campos:

- id;
- name;
- email;
- passwordHash;
- emailVerifiedAt;
- createdAt;
- updatedAt.

### EmailVerificationToken

Campos:

- id;
- userId;
- tokenHash;
- expiresAt;
- usedAt;
- createdAt.

### PasswordResetToken

Campos:

- id;
- userId;
- tokenHash;
- expiresAt;
- usedAt;
- createdAt.

### Child

Campos:

- id;
- evaluatorId;
- name;
- birthDate;
- ageAtEvaluation;
- sex, opcional;
- school;
- grade;
- notes;
- createdAt;
- updatedAt.

### Application

Campos:

- id;
- childId;
- evaluatorId;
- status: DRAFT, IN_PROGRESS, COMPLETED, ARCHIVED;
- startedAt;
- completedAt;
- currentStep;
- totalScore;
- classification, opcional;
- notes;
- createdAt;
- updatedAt.

### ApplicationStep

Campos:

- id;
- applicationId;
- stepNumber;
- skill;
- status;
- score;
- startedAt;
- completedAt;
- notes;
- createdAt;
- updatedAt.

### ApplicationItem

Campos:

- id;
- applicationStepId;
- itemNumber;
- prompt;
- expectedAnswer;
- childAnswer;
- isCorrect;
- score;
- responseTimeMs, opcional;
- notes;
- createdAt;
- updatedAt.

Todas as relações devem respeitar o avaliador autenticado.

---

## 5. Dashboard inicial

Após o login, exibir uma tela com:

- Nome do avaliador;
- Quantidade de crianças cadastradas;
- Quantidade de aplicações em andamento;
- Quantidade de aplicações finalizadas;
- Botão “Nova aplicação”;
- Botão “Cadastrar criança”;
- Lista das crianças avaliadas.

A lista deve exibir:

- Nome da criança;
- Idade na última aplicação;
- Data da última avaliação;
- Status da última aplicação;
- Resultado ou classificação, quando disponível;
- Botão “Ver detalhes”;
- Botão “Continuar aplicação”, quando houver rascunho.

Adicionar:

- Busca por nome;
- Filtro por status;
- Ordenação por nome e data da última avaliação;
- Estado vazio quando não houver crianças cadastradas.

---

## 6. Tela de detalhes da criança

Ao clicar em uma criança, exibir:

- Nome;
- Data de nascimento;
- Idade;
- Escola;
- Série;
- Observações;
- Data de cadastro;
- Lista de aplicações realizadas;
- Status de cada aplicação;
- Pontuação total;
- Pontuação por habilidade;
- Classificação, quando configurada;
- Botão “Nova aplicação”;
- Botão para abrir uma aplicação concluída;
- Botão para continuar uma aplicação em andamento.

Não exibir somente um resumo. Criar uma página detalhada com histórico completo.

---

## 7. Fluxo para nova aplicação

Ao clicar em “Nova aplicação”, abrir um formulário inicial com:

- Opção de selecionar uma criança já cadastrada;
- Opção de cadastrar uma nova criança;
- Nome da criança;
- Data de nascimento ou idade;
- Sexo, opcional;
- Escola, opcional;
- Série, opcional;
- Observações iniciais, opcional.

O sistema deve calcular automaticamente a idade com base na data de nascimento.

Antes de iniciar, exibir uma tela de confirmação com:

- Nome da criança;
- Idade;
- Ordem das habilidades;
- Aviso de que as respostas serão salvas.

Depois da confirmação, criar a aplicação com status `IN_PROGRESS`.

---

## 8. Ordem das telas do protocolo

A aplicação deve seguir obrigatoriamente a sequência abaixo.

Criar:

- Barra de progresso;
- Indicador da etapa atual;
- Nome da habilidade;
- Instruções;
- Área de exemplos/treino;
- Área dos itens oficiais;
- Registro da resposta da criança;
- Marcação de acerto ou erro;
- Campo de observações;
- Botões “Voltar” e “Continuar”;
- Botão “Salvar e sair”;
- Confirmação antes de finalizar cada etapa.

Não permitir pular etapas sem uma ação explícita de confirmação.

---

# ETAPA 1 — Conhecimento do alfabeto

Dividir em duas subetapas.

## 1.1 Conhecimento das vogais

- Aplicar os exemplos de treinamento;
- Exibir cada vogal individualmente;
- Registrar a resposta da criança;
- Marcar acerto ou erro;
- Pontuação máxima: 5 pontos;
- Pontuação mínima: 0 pontos.

## 1.2 Conhecimento das consoantes

- Aplicar os exemplos de treinamento;
- Exibir cada consoante individualmente;
- Registrar a resposta da criança;
- Marcar acerto ou erro;
- Pontuação máxima: 18 pontos;
- Pontuação mínima: 0 pontos.

Pontuação total da etapa:

- Máxima: 23 pontos;
- Mínima: 0 pontos.

---

# ETAPA 2 — Habilidades metafonológicas

Dividir em quatro subetapas.

## 2.1 Síntese silábica

O avaliador apresenta as sílabas separadas e a criança deve dizer a palavra formada.

Registrar:

- Palavra apresentada;
- Resposta esperada;
- Resposta da criança;
- Acerto ou erro;
- Observações.

Pontuação máxima: 21 pontos.

## 2.2 Segmentação silábica

O avaliador apresenta uma palavra e a criança deve separar a palavra em sílabas.

Registrar:

- Palavra apresentada;
- Quantidade esperada de sílabas;
- Resposta da criança;
- Acerto ou erro;
- Observações.

Pontuação máxima: 21 pontos.

## 2.3 Identificação de som ou sílaba inicial

O avaliador apresenta uma palavra e pergunta com qual som ou sílaba ela começa.

Registrar:

- Palavra apresentada;
- Resposta esperada;
- Resposta da criança;
- Acerto ou erro;
- Observações.

Pontuação máxima: 21 pontos.

## 2.4 Produção de palavras a partir de fonemas e sílabas iniciais

O avaliador apresenta um fonema ou uma sílaba inicial e a criança deve falar uma palavra que comece com esse som ou sílaba.

Registrar:

- Fonema ou sílaba apresentada;
- Respostas aceitáveis;
- Resposta da criança;
- Acerto ou erro;
- Observações.

Pontuação máxima: 21 pontos.

---

# ETAPA 3 — Memória operacional fonológica

O avaliador apresenta pseudopalavras e a criança deve repetir o que ouviu.

Registrar:

- Pseudopalavra;
- Resposta da criança;
- Acerto ou erro;
- Observações.

A etapa possui 24 itens.

A pontuação deve ser calculada com base nos itens corretos.

---

# ETAPA 4 — Nomeação automática rápida

Criar uma tela específica para aplicação cronometrada.

Funcionalidades:

- Apresentar a prancha de figuras;
- Botão “Iniciar cronômetro”;
- Botão “Finalizar aplicação”;
- Cronômetro visível;
- Registro do tempo total em segundos;
- Campo para observações;
- Registro de itens pulados, se necessário.

O tempo de execução deve ser salvo em milissegundos e exibido em segundos.

Não transformar tempo em pontuação arbitrária. Armazenar o tempo bruto e deixar a interpretação para uma regra configurável.

---

# ETAPA 5 — Compreensão auditiva de sentenças a partir de figuras

Apresentar cada sentença com sua figura correspondente.

A criança deve completar a frase com a palavra que falta.

Registrar:

- Sentença;
- Palavra esperada;
- Resposta da criança;
- Acerto ou erro;
- Observações.

Pontuação máxima: 20 pontos.

Permitir que o avaliador marque respostas alternativas como corretas quando forem semanticamente compatíveis, conforme o protocolo.

---

## 9. Tela de revisão

Antes de finalizar, exibir:

- Dados da criança;
- Data da aplicação;
- Status de todas as etapas;
- Pontuação por etapa;
- Pontuação total;
- Tempo da nomeação automática rápida;
- Itens sem resposta;
- Observações;
- Alertas de etapas incompletas.

Não permitir finalizar se houver etapa obrigatória incompleta sem uma confirmação explícita.

Após finalizar:

- Alterar status para `COMPLETED`;
- Registrar `completedAt`;
- Calcular a pontuação total;
- Gerar um resumo da aplicação;
- Bloquear edição normal.

---

## 10. Resultado da aplicação

A tela de resultado deve exibir:

- Dados da criança;
- Data da avaliação;
- Pontuação do conhecimento do alfabeto;
- Pontuação de cada habilidade metafonológica;
- Pontuação da memória operacional fonológica;
- Tempo da nomeação automática rápida;
- Pontuação da compreensão auditiva;
- Pontuação total;
- Classificação, se houver regra configurada;
- Observações do avaliador.

Criar gráficos simples para facilitar a visualização das pontuações.

Não usar gráficos 3D ou visualizações difíceis de interpretar.

---

## 11. Interface e experiência visual

Criar uma interface profissional, limpa e acolhedora, adequada para profissionais da área de educação e avaliação infantil.

Diretrizes:

- Layout com menu lateral no desktop;
- Layout responsivo no tablet;
- Cards com informações objetivas;
- Tipografia legível;
- Boa hierarquia visual;
- Cores suaves, mas com contraste adequado;
- Botões claros para ações principais;
- Indicadores visuais de progresso;
- Mensagens de erro compreensíveis;
- Estados de carregamento;
- Estados vazios;
- Confirmações para ações destrutivas;
- Navegação por teclado;
- Foco visível;
- Labels associados aos campos;
- Compatibilidade básica com leitores de tela;
- Não utilizar emojis como ícones;
- Usar ícones SVG acessíveis;
- Respeitar `prefers-reduced-motion`.

Criar os seguintes layouts:

- Login;
- Cadastro;
- Confirmação de e-mail;
- Recuperação de senha;
- Dashboard;
- Lista de crianças;
- Detalhes da criança;
- Cadastro de criança;
- Nova aplicação;
- Aplicação do protocolo;
- Revisão;
- Resultado;
- Perfil do avaliador.

---

## 12. API

Criar endpoints protegidos:

### Autenticação

- `POST /auth/register`
- `GET /auth/verify-email`
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`
- `POST /auth/forgot-password`
- `POST /auth/reset-password`
- `GET /auth/me`

### Crianças

- `GET /children`
- `POST /children`
- `GET /children/:id`
- `PATCH /children/:id`
- `DELETE /children/:id`

### Aplicações

- `GET /applications`
- `POST /applications`
- `GET /applications/:id`
- `PATCH /applications/:id`
- `POST /applications/:id/steps/:stepNumber/items`
- `PATCH /applications/:id/steps/:stepNumber`
- `POST /applications/:id/complete`
- `POST /applications/:id/reopen`

### Resultados

- `GET /applications/:id/result`
- `GET /children/:id/history`

Todas as rotas devem validar o usuário autenticado e impedir acesso a registros de outros avaliadores.

---

## 13. Seed inicial do protocolo

Criar um seed do banco contendo:

- Etapas;
- Subetapas;
- Instruções;
- Exemplos;
- Itens;
- Respostas esperadas;
- Pontuações máximas.

Use o arquivo PDF do PAPL como fonte principal.

Não invente itens que não estejam disponíveis no documento. Quando algum item estiver apenas como imagem e não for possível transcrevê-lo com segurança:

1. Marque o item como pendente;
2. Crie um campo para edição administrativa;
3. Registre no README quais itens precisam de conferência manual;
4. Não preencha valores fictícios.

---

## 14. Segurança

Implementar:

- Hash seguro de senha;
- Tokens de confirmação armazenados com hash;
- Tokens de recuperação armazenados com hash;
- Expiração de tokens;
- Rate limit no login;
- Rate limit no envio de e-mails;
- Validação de entrada no front-end e back-end;
- Proteção contra acesso indevido por ID;
- Sanitização de dados;
- CORS configurado;
- Variáveis sensíveis em `.env`;
- Nunca versionar `.env`;
- Logs sem senha, token ou dados sensíveis;
- Tratamento adequado de erros.

---

## 15. Testes obrigatórios

Criar testes para:

### Back-end

- Cadastro de usuário;
- Login;
- Senha inválida;
- Confirmação de e-mail;
- Recuperação de senha;
- Criação de criança;
- Isolamento de dados entre usuários;
- Criação de aplicação;
- Salvamento automático;
- Cálculo das pontuações;
- Finalização de aplicação;
- Bloqueio de edição após finalização.

### Front-end

- Tela de login;
- Cadastro;
- Dashboard;
- Lista de crianças;
- Formulário de nova aplicação;
- Navegação entre etapas;
- Salvamento de respostas;
- Tela de revisão;
- Tela de resultado.

---

## 16. Entregáveis

Entregar:

- Código completo;
- Estrutura organizada em `frontend/` e `backend/`;
- `docker-compose.yml` com PostgreSQL;
- `.env.example`;
- Migrations do Prisma;
- Seed do protocolo;
- README com instalação e execução;
- Documentação das variáveis de ambiente;
- Documentação da API;
- Testes automatizados;
- Usuário de desenvolvimento documentado;
- Comando para iniciar o front-end;
- Comando para iniciar o back-end;
- Comando para executar migrations;
- Comando para executar o seed;
- Comando para executar os testes.

---

## 17. Critérios de aceite

O trabalho só estará concluído quando:

- For possível criar uma conta;
- For possível confirmar o e-mail em modo de desenvolvimento;
- For possível fazer login;
- For possível cadastrar uma criança;
- A criança aparecer na lista inicial;
- For possível abrir os detalhes da criança;
- For possível iniciar uma nova aplicação;
- As cinco habilidades aparecerem na ordem correta;
- For possível registrar respostas;
- As respostas forem persistidas no banco;
- For possível sair e continuar a aplicação;
- As pontuações forem calculadas;
- For possível finalizar a aplicação;
- O resultado ficar disponível no histórico;
- Um avaliador não conseguir acessar dados de outro;
- O projeto compilar;
- Os testes automatizados passarem.

Antes de finalizar, execute:

```bash
npm install
npm run build
npm run test
npx prisma migrate dev
npx prisma db seed