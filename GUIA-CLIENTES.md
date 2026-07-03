# Guia — Usuários, Clientes e Isolamento de Projetos

Este documento explica como o Chronos PM separa os projetos por usuário (multi-tenancy)
e como cadastrar e gerenciar clientes.

---

## 1. Papéis de usuário

| Papel | Pode criar/editar? | O que enxerga | Uso típico |
|---|---|---|---|
| **ADMIN** | Sim | **Todos** os projetos (os seus e os de todos os clientes) | Você / BD7D |
| **MANAGER** (Gerente) | Sim | **Apenas os projetos que ele mesmo criou** | Cliente que gere os próprios projetos |
| **CLIENT** (Cliente) | Não (somente leitura) | Apenas os projetos que o admin atribuiu a ele | Cliente que só acompanha um projeto seu |
| **VIEWER** | Não (somente leitura) | Apenas projetos onde é dono/atribuído | Acesso de leitura genérico |

A regra de visibilidade é aplicada **no servidor** (não é apenas esconder na tela):
quem não é ADMIN só recebe da API os projetos onde é **dono** (`ownerId`) ou **cliente**
(`clientId`). Não há como burlar chamando a API diretamente.

Garantias:
- O ADMIN vê tudo.
- Um MANAGER **não vê** os projetos do admin nem os de outros managers.
- Dois clientes MANAGER ficam **isolados entre si**.

---

## 2. Qual papel usar para cada cenário

### Cenário A — Cliente gerencia os próprios projetos → **MANAGER**
O cliente cria e edita os projetos dele, com Gantt, tarefas, curva S e relatórios,
mas **não vê** os seus projetos internos.

### Cenário B — Cliente só acompanha um projeto que você gerencia → **CLIENT**
Você cria o projeto, atribui o cliente no campo **"Cliente"** do formulário de projeto,
e ele acessa apenas para **visualizar** (somente leitura). O campo "Cliente" só aparece
para o ADMIN.

---

## 3. Como cadastrar um cliente (passo a passo)

1. Faça login como **ADMIN**.
2. Vá em **Projetos → 👥 Usuários** (o botão só aparece para admin).
3. Clique em **➕ Novo Usuário** e preencha:
   - **Nome** e **E-mail** (será o login).
   - **Senha** inicial (mínimo 6 caracteres) — o cliente pode trocar depois.
   - **Papel**: escolha **Gerente** (cenário A) ou **Cliente** (cenário B).
4. Salve. Passe o e-mail e a senha inicial ao cliente.

### Se escolheu **Cliente** (cenário B), atribua o projeto:
1. Vá em **Projetos**, edite o projeto desejado.
2. No campo **"Cliente (quem pode visualizar)"**, selecione o usuário.
3. Salve. A partir daí, aquele cliente vê esse projeto (somente leitura).

---

## 4. O que o cliente vê ao entrar

- **MANAGER sem projetos ainda:** o painel mostra "Nenhum projeto disponível" com o botão
  **Ir para Projetos**. Ele cria o primeiro projeto e começa a gestão.
- **MANAGER/CLIENT com projetos:** entra direto no painel do projeto dele.
- Nenhum cliente tem acesso à tela de **Usuários** (exclusiva do admin).

---

## 5. Gerenciar usuários existentes

Na tela **Usuários** o admin pode:
- **Editar** nome, papel e redefinir senha (deixe a senha em branco para mantê-la).
- **Ativar/Desativar** um usuário. Um usuário inativo não consegue fazer login.
- A coluna **Projetos** mostra quantos projetos o usuário possui (ou, para CLIENT,
  quantos lhe foram atribuídos).

Proteções automáticas: você **não** consegue desativar nem rebaixar a **própria** conta
de admin (evita perder o acesso administrativo).

---

## 6. Boas práticas de segurança

- **Troque a senha padrão do admin** (`chronos2025`) logo no primeiro acesso em produção —
  edite sua própria conta na tela de Usuários.
- Use senhas iniciais fortes ao criar clientes e oriente-os a trocar.
- Mantenha o papel **VIEWER** como padrão para acessos que não devem editar nada.
- Só o ADMIN deve permanecer com papel ADMIN.

---

## 7. Resumo rápido

- **Você quer que o cliente gerencie sozinho e não veja seus projetos?** → papel **MANAGER**.
- **Você quer que o cliente só visualize um projeto seu?** → papel **CLIENT** + campo "Cliente".
- **Admin sempre vê tudo; clientes veem só o que é deles.** Garantido no servidor.
