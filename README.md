# LEGO Future

LEGO set investment forecasting — Next.js 16 + Tailwind v4 on AWS Amplify
(WEB_COMPUTE). Live at [legofuture.com](https://legofuture.com).

## Spec

Architectural parity with PokeFuture — see Phase recipe in spec §16.
Implementation follows the same forecast / data-sync / legal-page pattern,
adapted for LEGO sets and PriceCharting's `lego` console.

## Development

```sh
npm ci
npm run dev       # local dev server on :3000
npm run verify    # lint + test + build
```

See [AGENTS.md](./AGENTS.md) for AI agent guidance, including the
superpowers and Vercel React best-practices skills this repo uses.
