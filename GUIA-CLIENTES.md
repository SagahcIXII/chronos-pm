# Guia — Empresas, Usuários e Isolamento de Projetos

O Chronos PM separa os dados por **empresa cliente**. Cada empresa enxerga
somente os próprios projetos; nunca os de outra empresa nem os internos da BD7D.

---

## 1. Como funciona

- Uma **empresa** (ex.: BioAmazon) agrupa usuários e projetos.
- Todo usuário de uma empresa vê **todos os projetos daquela empresa**.
- Projetos **sem empresa** são internos da BD7D.
- O **ADMIN** (BD7D) não pertence a empresa e vê tudo.

A regra é aplicada **no servidor** em toda leitura (`src/lib/access.ts`): quem
tentar abrir um projeto de outra empresa, até pela URL ou pela API, recebe
"não encontrado". Vale para tarefas, anexos, comentários, Curva S, Excel e e-mail.

---

## 2. Papéis

| Papel | Pertence a | Vê | Edita |
|---|---|---|---|
| **ADMIN** | — (BD7D) | todos os projetos | tudo; gerencia empresas e usuários |
| **MANAGER** (Gerente) | uma empresa | projetos da empresa | todos os projetos da empresa; cria projetos nela |
| **CLIENT** (Cliente) | uma empresa | projetos da empresa | não — só lê e **comenta** |
| **VIEWER** (Visualizador) | uma empresa | projetos da empresa | não — só lê e **comenta** |

Um MANAGER/CLIENT/VIEWER **sem empresa** é tratado como interno da BD7D e vê
apenas os projetos internos que ele mesmo criou.

Projeto criado por um MANAGER entra automaticamente na empresa dele. Só o
ADMIN pode mover um projeto de empresa.

---

## 3. Cadastrar uma nova empresa cliente

1. Entre como **ADMIN** → **Usuários**.
2. Na seção **Empresas**, digite o nome e clique em **Criar empresa**.
3. Em **Novo Usuário**, preencha nome, e-mail, senha inicial, **Papel** e
   selecione a **Empresa**.
   - Quem vai atualizar o cronograma → **Gerente**.
   - Quem só acompanha → **Cliente** ou **Visualizador**.
4. Passe o e-mail e a senha inicial ao usuário (ele troca em *Trocar senha*).

Para um projeto já existente aparecer para a empresa: **Projetos → editar →
Empresa**.

---

## 4. Desativar acesso

- **Um usuário:** Usuários → **Desativar**. O acesso cai na próxima ação dele.
- **Uma empresa inteira:** Empresas → **Desativar**. Todos os usuários dela
  perdem o acesso imediatamente; os projetos e dados são preservados e voltam
  ao reativar.

Proteções: o admin não consegue desativar nem rebaixar a própria conta.

---

## 5. Migrar um cliente que já usava o sistema sozinho

Antes das empresas, cada cliente via apenas os projetos que ele mesmo criou.
Para colocá-lo (e os projetos dele) em uma empresa:

```bash
# simula e mostra o que será feito
npm run db:assign-org -- --org "BioAmazon" --owner abucker@gmail.com
# aplica
npm run db:assign-org -- --org "BioAmazon" --owner abucker@gmail.com --apply
```

Depois, cadastre os demais usuários da empresa pela tela **Usuários**.

---

## 6. Boas práticas

- Troque a senha padrão do admin no primeiro acesso em produção.
- Dê papel **Gerente** só a quem deve alterar o cronograma.
- Só a equipe BD7D deve ter papel **ADMIN**.
