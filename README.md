# Chronos PM — Sistema de Gestão de Cronograma

Controle de cronograma de projetos com Gantt, Curva S, relatório executivo
(PDF, Excel e e-mail), multiusuário com isolamento por cliente.

Desenvolvido por **BD7D Solutions Engenharia LTDA**

---

## Stack

| Camada | Tecnologia |
|---|---|
| Framework | Next.js 14 (App Router) + TypeScript |
| Banco | PostgreSQL (Neon) via Prisma 5 |
| Autenticação | NextAuth.js (credenciais + bcrypt, sessão JWT de 8 h) |
| Gráficos | Recharts (Dashboard/Curva S) · SVG próprio (Gantt) |
| Relatório PDF | HTML gerado no navegador → imprimir / salvar como PDF |
| Excel | SheetJS (`xlsx`), gerado no servidor |
| E-mail | Nodemailer (Gmail) |
| Anexos | Vercel Blob |
| Validação | Zod |
| Estilo | Tailwind CSS + CSS próprio (`globals.css`), tema claro/escuro |
| Deploy | Vercel (deploy automático a cada push na `main`) |

---

## Instalação local

Pré-requisitos: Node.js 18+ (recomendado 20 LTS) e um banco PostgreSQL
(recomendado: uma **branch de desenvolvimento** do Neon, para não mexer em produção).

```bash
git clone https://github.com/SagahcIXII/chronos-pm.git
cd chronos-pm
npm install
cp .env.example .env      # preencha as variáveis (veja abaixo)
npm run db:push           # aplica o schema no banco
npm run db:seed           # (opcional) dados de demonstração
npm run dev               # http://localhost:3000
```

### Variáveis de ambiente

| Variável | Obrigatória | Para quê |
|---|---|---|
| `DATABASE_URL` | sim | Conexão PostgreSQL (Neon) |
| `NEXTAUTH_SECRET` | sim | Assinatura da sessão — `openssl rand -base64 32` |
| `NEXTAUTH_URL` | sim | URL base (`http://localhost:3000` ou a da Vercel) |
| `BLOB_READ_WRITE_TOKEN` | para anexos | Vercel Blob; sem ela o upload responde 503 |
| `EMAIL_USER` / `EMAIL_PASS` | para e-mail | Conta Gmail + senha de app |
| `EMAIL_FROM` | não | Remetente exibido no e-mail |

### Comandos

```bash
npm run dev          # servidor de desenvolvimento
npm run build        # build de produção
npm run db:push      # aplica o schema (prisma db push)
npm run db:seed      # dados de demonstração
npm run db:studio    # Prisma Studio
npm run db:recalc    # recalcula progresso/status de grupos e projetos
npm run db:assign-org -- --org "Empresa" --owner email   # vincula cliente existente (simula; --apply grava)
npm run db:reset     # ⚠ APAGA o banco e repovoa com o seed
```

> ⚠ `db:reset`, `db:push --force-reset` e `db:seed` usam o `DATABASE_URL`
> do `.env`. Confira para qual banco ele aponta antes de rodar.

---

## Deploy (Vercel + Neon)

1. Crie o projeto no Neon e copie a connection string.
2. Importe o repositório na Vercel e configure as variáveis da tabela acima.
3. Aplique o schema no banco de produção uma vez:
   `DATABASE_URL="postgresql://..." npx prisma db push`
4. A partir daí, todo push na `main` gera deploy automático.

**Troque a senha padrão do admin no primeiro acesso** (menu *Trocar senha*).

---

## Regras de cálculo

Toda a lógica fica em `src/lib/progress.ts` (fonte única — Dashboard, Curva S,
Relatório PDF, Excel, e-mail e banco usam as mesmas funções).

- **Tarefas de execução**: tarefas comuns + grupos **sem** subtarefas
  (ex.: uma "Meta" lançada como grupo e preenchida à mão).
- **Avanço do projeto** = Σ(peso × progresso) ÷ Σ(peso) das tarefas de execução.
  Peso vazio ou 0 conta como 1.
- **Grupo com subtarefas**: progresso e status são calculados automaticamente
  a partir das tarefas abaixo dele (todos os níveis) sempre que uma tarefa muda.
- **Curva S — planejado**: linear no tempo (dias decorridos ÷ dias totais do projeto).
- **Curva S — executado** em uma data = Σ(peso × progresso estimado naquela data)
  ÷ Σ(peso de **todas** as tarefas). O progresso histórico é estimado de forma
  linear (concluída: início → término; em andamento: início → hoje). No ponto
  "hoje", o executado é igual ao avanço do projeto.
  Pontos lançados no *Histórico Manual* substituem a estimativa da semana.
- **"Hoje"** é a data local do navegador; no servidor, `America/Manaus`.
- **Dias úteis** (`src/lib/schedule.ts`): seg–sex, exceto feriados nacionais
  calculados para qualquer ano (incluindo Sexta-feira Santa e Corpus Christi).

---

## Empresas e usuários (multi-tenancy)

Cada **empresa cliente** (ex.: BioAmazon) tem os próprios usuários e projetos e
**só enxerga os dados dela**. Projetos sem empresa são internos da BD7D.

```
Empresa (Organization)
 ├── Usuários  ── MANAGER: edita todos os projetos da empresa
 │              └ CLIENT / VIEWER: só leem e comentam
 └── Projetos  ── visíveis a todos os usuários da empresa
ADMIN (BD7D) ── sem empresa, vê e gerencia tudo
```

### Papéis

| Papel | Pertence a | Vê | Edita |
|---|---|---|---|
| ADMIN | — (BD7D) | todos os projetos de todas as empresas | tudo; cria empresas e usuários |
| MANAGER | uma empresa | projetos da empresa | todos os projetos da empresa; cria projetos nela |
| CLIENT / VIEWER | uma empresa | projetos da empresa | não — lê e comenta |
| MANAGER / CLIENT / VIEWER sem empresa | — | só os projetos internos que criou | conforme o papel |

### Fluxos (todos feitos pelo ADMIN)

**Nova empresa cliente**
1. **Usuários → Empresas** → digite o nome → **Criar empresa**.
2. **Usuários → Novo Usuário** → nome, e-mail, senha inicial, **Papel** e **Empresa**.
   Quem atualiza o cronograma = **Gerente**; quem só acompanha = **Cliente**/**Visualizador**.
3. Envie e-mail e senha ao usuário; ele troca a senha em **Trocar senha**.

**Mais um usuário para uma empresa existente** — passo 2 acima. O usuário já
entra vendo todos os projetos da empresa.

**Projeto da empresa** — o Gerente da empresa cria o projeto e ele já nasce na
empresa dele. Para mover um projeto existente: **Projetos → editar → Empresa**
(só o ADMIN altera a empresa de um projeto).

**Editar um usuário** — **Usuários → Editar**: nome, e-mail (é o login), papel,
empresa, nova senha e ativo/inativo.

**Cortar acesso**
- Um usuário: **Usuários → Desativar**.
- A empresa inteira: **Empresas → Desativar** — todos os usuários dela perdem o
  acesso na hora; projetos e dados ficam preservados e voltam ao reativar.

**Cliente antigo (de antes das empresas)** — vincula o usuário e todos os
projetos que ele criou a uma empresa (cria a empresa se não existir):

```bash
npm run db:assign-org -- --org "Empresa" --owner email@cliente.com          # simula
npm run db:assign-org -- --org "Empresa" --owner email@cliente.com --apply  # grava
```

**Visão do ADMIN** — a tela **Projetos** agrupa os cards por empresa (A→Z, com
"BD7D — projetos internos" por último), com contagem e avanço médio; cada grupo
pode ser recolhido.

### Como o isolamento é garantido

- Toda leitura de projeto passa por `projectVisibilityWhere` / `assertProjectAccess`
  (`src/lib/access.ts`); tarefas, anexos, comentários, Curva S, Excel e e-mail
  herdam a regra. Projeto de outra empresa responde **404**, inclusive via API.
- Papel, empresa e status são lidos **do banco a cada requisição** (não do token
  da sessão): desativar ou mudar a empresa de alguém vale imediatamente.
- ADMIN nunca pertence a empresa; projeto criado por não-admin sempre recebe a
  empresa do usuário, independentemente do que for enviado à API.
- Esconder botões na interface (`useCanEdit`) é só conveniência — quem bloqueia
  é sempre a API.

Detalhes e boas práticas em [GUIA-CLIENTES.md](GUIA-CLIENTES.md).

---

## Estrutura

```
prisma/
  schema.prisma          # modelo do banco (PostgreSQL)
  seed.ts                # dados de demonstração
  recalc-rollups.ts      # npm run db:recalc
  assign-organization.ts # npm run db:assign-org
src/
  app/
    auth/login/          # login
    projects/            # lista de projetos (criar, editar, duplicar, arquivar)
    users/               # gestão de empresas e usuários (ADMIN)
    account/             # trocar a própria senha
    dashboard/           # área do projeto ativo
      page.tsx           #   dashboard executivo
      gantt/             #   Gantt com arrastar-e-soltar de datas
      curves/            #   Curva S + histórico manual
      tasks/             #   tarefas, anexos e comentários
      pdf/               #   relatório PDF, Excel e envio por e-mail
    api/                 # rotas do backend (projetos, tarefas, snapshots,
                         # empresas, usuários, conta, e-mail, export/excel)
  components/ThemeToggle.tsx
  lib/
    access.ts            # autorização e isolamento por empresa, validação de vínculos
    progress.ts          # fórmulas oficiais de avanço e Curva S
    rollup.ts            # recálculo de grupos/projeto no banco
    schedule.ts          # dias úteis, feriados, formatadores
    taskTree.ts          # ordenação cronológica + numeração WBS
    projectContext.tsx   # projeto ativo
    useCanEdit.ts        # permissão de escrita na interface
    i18n.tsx, theme.tsx, auth.ts, prisma.ts
  middleware.ts          # protege as rotas autenticadas
```

---

## Credenciais do seed (somente demonstração)

| Perfil | E-mail | Senha |
|---|---|---|
| Admin | admin@bd7d.com.br | chronos2025 |
| Manager | carlos@bd7d.com.br | manager123 |

Novos usuários são criados pela tela **Usuários** (ADMIN).

---

## Evoluções planejadas

- [ ] Notificações de atraso por e-mail
- [ ] Baseline com comparação visual no Gantt
- [ ] Integração com Google Calendar
- [ ] Gestão de recursos (horas, custos)
- [ ] Modo offline (PWA)

---

BD7D Solutions Engenharia LTDA · Manaus, Amazonas, Brasil
