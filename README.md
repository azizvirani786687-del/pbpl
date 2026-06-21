Vite + React project — Vercel deployment

Quick steps to deploy to Vercel:

1. Install dependencies:

```
npm install
```

2. Build for production (Vercel runs `vercel-build` automatically):

```
npm run build
```

3. Deploy using the Vercel CLI or push to a Vercel-linked Git repo.

Notes:
- `vercel.json` is configured to use `@vercel/static-build` and serve the `dist` folder produced by Vite.
- If you use Firebase, ensure any runtime API keys are configured as environment variables in Vercel.