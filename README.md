# Cyberpunk RED Solo Runner

A local-first, unofficial solo tabletop companion built with React, TypeScript and Vite.

## Run Locally

Requires Node.js 20 or newer and npm.

```sh
npm ci
npm run dev -- --host 127.0.0.1 --port 5173
```

Open http://127.0.0.1:5173/. Characters and campaigns are stored in the browser.
Different browsers, hostnames and ports have separate storage. Export a backup before migrating.

```sh
npm test
npm run build
```

On Windows, `scripts/launch-game.ps1` starts the local service and opens the game.

## Private Sources and AI

The repository does not include rulebook PDFs, extracted full text, private equipment data,
API keys or personal campaign saves. Use only source material you are entitled to access.
The app provides indexes and helpers, not a replacement for the official books.

To enable local source lookup, configure the `PDF_*` paths in a local `.env.local` based on
`.env.example`, then run `npm run sources:index`. PDF indexing requires Python and pypdf.
Run `npm run sources:equipment` to prepare the optional private equipment catalog.
Generated source indexes remain in `.local-sources/`, outside Git.

AI hosting is optional. Configure your own provider locally; never commit real credentials.
An AI response does not itself authorize changes to money, wounds, equipment or relationships.

## Deployment Warning

The Vite middleware is designed for personal local use. Do not expose `npm run dev` or
`npm run preview` directly to the Internet as a production service. The private PDF endpoints
and server-funded AI proxy need authentication and appropriate request controls before remote use.
GitHub Pages or a static `dist/` upload alone does not provide those API endpoints.

Deploy to a separate subdomain/virtual host if the existing main website must remain unchanged.
Private books and credentials must be configured separately on the server, not in a public repository.
The public repository intentionally omits copyrighted source files and does not imply permission
to redistribute them. This project is not an official R. Talsorian Games product.
