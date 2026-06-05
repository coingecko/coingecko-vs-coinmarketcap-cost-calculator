# CoinGecko API vs CoinMarketCap API Credit & Cost Calculator

A self-contained, single-file web app that compares API credit/cost between CoinGecko and CoinMarketCap.

## Files

| File | Purpose |
|------|---------|
| `index.html` | **Production build** — fully self-contained (252 kB), ready to serve |
| `.github/workflows/deploy.yml` | GitHub Actions workflow for auto-deploy to Pages |
| `package.json` / `vite.config.ts` / `tsconfig.json` | Build tooling config |
| `src/` | React + Tailwind source code |

## Deployment

1. Create a **public** repo under the CoinGecko org
2. Push all files to the `main` branch
3. Go to repo **Settings → Pages** and set:
   - Source: **GitHub Actions**
4. The included workflow will deploy automatically on push

The app is a single `index.html` — no build step needed for deployment. If changes are needed, source is in `src/`.

## To Rebuild (if modifying source)

```bash
npm install
npm run build
# Output: dist/index.html (copy to root)
```

## SEO

Already configured:
- `<title>`: CoinGecko API vs CoinMarketCap API Credit & Cost Calculator
- `<meta name="description">`: SEO-optimized comparison description
- `<meta name="google-site-verification">`: Search Console verification tag
- `<meta name="robots">`: index, follow


