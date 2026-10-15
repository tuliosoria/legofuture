# AGENTS.md — LEGO Future

Working notes for AI coding agents on this repository.

## Skills to consult

Before non-trivial work in this repo, invoke the relevant skill from the
libraries below using your platform's skill loader (Copilot CLI: `skill`
tool · Claude Code: `Skill` tool · Gemini CLI: `activate_skill`).

### 1. obra/superpowers — process & engineering discipline

Source: https://github.com/obra/superpowers

Use these for *how* to work:

- `using-superpowers` — load first to learn skill discovery rules
- `brainstorming` — before any creative work or new feature
- `writing-plans` / `executing-plans` — for multi-step tasks
- `test-driven-development` — before writing implementation code
- `systematic-debugging` — for any bug or unexpected behavior
- `verification-before-completion` — before claiming work done
- `requesting-code-review` / `receiving-code-review`
- `using-git-worktrees` — for isolated feature work
- `dispatching-parallel-agents` / `subagent-driven-development`
- `finishing-a-development-branch`
- `writing-skills`

### 2. vercel-labs/agent-skills — React + Next.js performance

Source: https://github.com/vercel-labs/agent-skills/tree/main/skills/react-best-practices

Use this for *what* to build. The skill ships 70 rules across 8
categories:

| Priority | Category                   | Rule prefix |
|----------|----------------------------|-------------|
| 1        | Eliminating Waterfalls     | `async-`    |
| 2        | Bundle Size Optimization   | `bundle-`   |
| 3        | Server-Side Performance    | `server-`   |
| 4        | Client-Side Data Fetching  | `client-`   |
| 5        | Re-render Optimization     | `rerender-` |
| 6        | Rendering Performance      | `rendering-`|
| 7        | JavaScript Performance     | `js-`       |
| 8        | Advanced Patterns          | `advanced-` |

Invoke `vercel-react-best-practices` whenever you:

- Add or refactor a React component or Next.js route
- Touch data fetching (server or client)
- Adjust bundle composition, dynamic imports, or `next/image`
- Investigate a performance regression

## Project conventions

- **Commits** include the trailer:
  `Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>`
- **Verify before claiming complete**: run the relevant build / test /
  lint command and confirm exit 0 before reporting success.

## Sunset PriceCharting — decisão de 14/10/2026

- Data informada: 22/10/2026; horário contratual desconhecido. Preparação proposta até 20/10/2026 00:00 UTC.
- Manter catálogo, busca, anúncios e calculadoras manuais existentes. Anúncio ativo eBay não é venda nem valor de mercado. Suspender forecasts/rankings dependentes de vendas sem fonte válida; mostrar origem, data, condição e amostra.
- Não renovar data observada ao ler cache; não substituir ausência por zero. Não presumir Marketplace Insights, quota efetiva ou licença de retenção PC.
- Não apagar dados, imagens, históricos ou modelos; inventário/licença/deleção têm gates separados. Não alterar credenciais, assinatura ou produção. Push/deploy exigem autorização específica.
- Contexto permanente: [ADR do sunset](docs/architecture/2026-10-14-pricecharting-sunset.md); [plano por tarefas](docs/superpowers/plans/2026-10-14-pricecharting-sunset.md). Comportamento aprovado não autoriza execução do plano.
