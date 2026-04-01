# Chronos PM — Sistema de Gestão de Cronograma

Sistema profissional de controle de cronograma de projetos com Gráfico de Gantt,
Curva S, relatórios em PDF e autenticação segura.

Desenvolvido por **BD7D Solutions Engenharia LTDA**

---

## Stack tecnológica

| Camada | Tecnologia | Versão |
|---|---|---|
| Framework | Next.js App Router | 14.x |
| Linguagem | TypeScript | 5.x |
| ORM | Prisma | 5.x |
| Banco (dev) | SQLite | — |
| Banco (prod) | PostgreSQL (Neon) | — |
| Estilo | Tailwind CSS | 3.x |
| Autenticação | NextAuth.js + bcrypt | 4.x |
| Gráficos | Recharts | 2.x |
| PDF | jsPDF + autoTable | 2.x |
| Export | SheetJS (xlsx) | 0.18 |
| Estado | Zustand | 4.x |
| Forms | React Hook Form + Zod | — |
| Deploy | Vercel + Neon | gratuito |

---

## Pré-requisitos

- Node.js 18+ (recomendado: 20 LTS)
- npm 9+ ou yarn
- Git
- Conta GitHub (você já tem ✅)
- Conta Vercel — gratuita: https://vercel.com
- Conta Neon — gratuita: https://neon.tech

---

## ═══════════════════════════════════════════
## PASSO A PASSO — INSTALAÇÃO LOCAL
## ═══════════════════════════════════════════

### PASSO 1 — Clonar o repositório

```bash
# Se você já criou o repo no GitHub:
git clone https://github.com/SEU_USUARIO/chronos-pm.git
cd chronos-pm

# OU criar do zero na pasta atual:
cd chronos-pm
git init
```

---

### PASSO 2 — Instalar dependências

```bash
npm install
```

Aguarde o download (~2 min na primeira vez).

---

### PASSO 3 — Configurar variáveis de ambiente

```bash
# Copie o arquivo de exemplo
cp .env.example .env
```

Abra o arquivo `.env` e edite:

```env
# SQLite para desenvolvimento (não precisa mudar)
DATABASE_URL="file:./dev.db"

# Gere uma chave secreta segura:
# No terminal: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
NEXTAUTH_SECRET="COLE_A_CHAVE_GERADA_AQUI"

NEXTAUTH_URL="http://localhost:3000"
```

---

### PASSO 4 — Configurar o banco de dados

```bash
# Gera o cliente Prisma com base no schema
npm run db:generate

# Cria o banco SQLite e aplica o schema
npm run db:push

# Popula com dados de demonstração
npm run db:seed
```

Você verá no terminal:
```
✅ Usuários criados
✅ Projeto criado: BD7D-2025-001
✅ Tarefas criadas
✅ Dependências criadas
✅ Baseline salva
🚀 Seed concluído com sucesso!

  Acesso ao sistema:
  Email:  admin@bd7d.com.br
  Senha:  chronos2025
```

---

### PASSO 5 — Rodar localmente

```bash
npm run dev
```

Acesse: **http://localhost:3000**

Login: `admin@bd7d.com.br` / `chronos2025`

---

### Comandos úteis

```bash
npm run dev          # Servidor de desenvolvimento
npm run build        # Build de produção
npm run start        # Servidor de produção local
npm run db:studio    # Prisma Studio (visual do banco)
npm run db:reset     # Resetar e repovoar banco
npm run db:seed      # Apenas repovoar
```

---

## ═══════════════════════════════════════════
## PASSO A PASSO — DEPLOY NA VERCEL + NEON
## ═══════════════════════════════════════════

### PASSO 1 — Criar banco PostgreSQL no Neon (gratuito)

1. Acesse https://neon.tech e crie conta
2. Clique em **"New Project"**
3. Nome: `chronos-pm`
4. Região: `US East` ou `AWS São Paulo` (se disponível)
5. Clique em **"Create project"**
6. Na tela seguinte, copie a **Connection String** no formato:
   ```
   postgresql://USER:PASSWORD@HOST/chronos?sslmode=require
   ```
7. Guarde essa string — você vai precisar no próximo passo

---

### PASSO 2 — Atualizar o schema para PostgreSQL

Abra `prisma/schema.prisma` e altere:

```prisma
datasource db {
  provider = "postgresql"   # ← mude de "sqlite" para "postgresql"
  url      = env("DATABASE_URL")
}
```

---

### PASSO 3 — Publicar no GitHub

```bash
# No diretório do projeto:
git add .
git commit -m "feat: Chronos PM inicial"

# Crie o repositório no GitHub (pode ser privado):
# https://github.com/new → nome: chronos-pm

# Conecte e envie:
git remote add origin https://github.com/SEU_USUARIO/chronos-pm.git
git branch -M main
git push -u origin main
```

---

### PASSO 4 — Criar projeto na Vercel

1. Acesse https://vercel.com/new
2. Clique em **"Import Git Repository"**
3. Conecte sua conta GitHub se necessário
4. Selecione o repositório `chronos-pm`
5. Clique em **"Import"**

---

### PASSO 5 — Configurar variáveis de ambiente na Vercel

Na tela de configuração do projeto, clique em **"Environment Variables"** e adicione:

| Nome | Valor |
|---|---|
| `DATABASE_URL` | `postgresql://...` (string do Neon copiada no Passo 1) |
| `NEXTAUTH_SECRET` | Chave forte gerada (use: `openssl rand -base64 32`) |
| `NEXTAUTH_URL` | `https://SEU-PROJETO.vercel.app` |

---

### PASSO 6 — Deploy

Clique em **"Deploy"** e aguarde (~2 min).

Após o deploy, no terminal local rode as migrações no banco de produção:

```bash
# Defina temporariamente o DATABASE_URL do Neon:
export DATABASE_URL="postgresql://USER:PASSWORD@HOST/chronos?sslmode=require"

# Aplica o schema no PostgreSQL
npx prisma db push

# Popula com dados de demonstração
npm run db:seed

# Restaura variável local
unset DATABASE_URL
```

Ou use o arquivo `.env.production.local` para separar os ambientes.

---

### PASSO 7 — Acessar em produção

Acesse: `https://SEU-PROJETO.vercel.app`

Login: `admin@bd7d.com.br` / `chronos2025`

**Importante:** troque a senha após o primeiro acesso em produção.

---

### Deploy automático (CI/CD)

A partir daqui, qualquer push para a branch `main` dispara um novo deploy automaticamente:

```bash
# Qualquer alteração no código:
git add .
git commit -m "fix: ajuste no Gantt"
git push origin main
# → Vercel detecta e faz deploy automaticamente em ~1 min
```

---

## ═══════════════════════════════════════════
## ESTRUTURA DO PROJETO
## ═══════════════════════════════════════════

```
chronos-pm/
├── prisma/
│   ├── schema.prisma          # Modelo do banco (SQLite → PostgreSQL)
│   └── seed.ts                # Dados de demonstração
├── src/
│   ├── app/
│   │   ├── auth/login/        # Tela de login
│   │   ├── dashboard/         # Área autenticada
│   │   │   ├── layout.tsx     # Sidebar + topbar
│   │   │   ├── page.tsx       # Dashboard executivo
│   │   │   ├── gantt/         # Gráfico de Gantt
│   │   │   ├── curves/        # Curva S
│   │   │   ├── tasks/         # Gestão de tarefas
│   │   │   └── pdf/           # Relatório PDF
│   │   └── api/               # API Routes (backend)
│   │       ├── auth/          # NextAuth
│   │       ├── projects/      # CRUD projetos
│   │       ├── tasks/         # CRUD tarefas
│   │       ├── dashboard/     # KPIs e Curva S
│   │       ├── reports/pdf/   # Geração de PDF
│   │       └── export/excel/  # Exportação Excel
│   ├── components/            # Componentes React
│   ├── lib/
│   │   ├── prisma.ts          # Singleton Prisma
│   │   ├── auth.ts            # Configuração NextAuth
│   │   └── schedule.ts        # Algoritmos (CPM, Curva S, dias úteis)
│   ├── types/index.ts         # Tipos TypeScript
│   ├── stores/                # Zustand stores
│   └── middleware.ts          # Proteção de rotas
├── .env.example               # Template de variáveis
├── .gitignore
├── next.config.mjs
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

---

## ═══════════════════════════════════════════
## CREDENCIAIS PADRÃO
## ═══════════════════════════════════════════

| Perfil | Email | Senha | Permissões |
|---|---|---|---|
| Admin | admin@bd7d.com.br | chronos2025 | Tudo |
| Manager | carlos@bd7d.com.br | manager123 | Criar/editar tarefas |

**Troque as senhas em produção antes de compartilhar o sistema.**

Para criar novo usuário (via Prisma Studio):
```bash
npm run db:studio
# Acesse: http://localhost:5555
# Tabela "users" → Add record
# Senha deve ser hash bcrypt — gere com:
node -e "const b=require('bcryptjs');b.hash('nova_senha',12).then(console.log)"
```

---

## ═══════════════════════════════════════════
## EVOLUÇÕES PLANEJADAS
## ═══════════════════════════════════════════

### Curto prazo
- [ ] Seleção dinâmica de projetos (múltiplos projetos)
- [ ] Drag & drop de datas no Gantt
- [ ] Upload de anexos (Vercel Blob / S3)
- [ ] Notificações de atraso por email

### Médio prazo
- [ ] Múltiplos usuários com controle de acesso por projeto
- [ ] Baseline dinâmico com comparação visual
- [ ] Integração com Google Calendar
- [ ] App mobile (React Native)

### Longo prazo
- [ ] Gestão de recursos (horas, custos)
- [ ] Integração com ERP
- [ ] API pública para integração com outros sistemas
- [ ] Modo offline (PWA)

---

## Suporte

BD7D Solutions Engenharia LTDA
Manaus, Amazonas, Brasil
