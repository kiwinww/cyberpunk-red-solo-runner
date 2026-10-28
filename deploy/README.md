# Online Deployment

Deploy only the production `dist` directory. Do not publish `.env.local`,
`.local-sources`, books, private equipment indexes, or browser saves.

`cyberpunk.http.conf` is a dedicated Nginx virtual host, not a replacement
for the main site's configuration. Validate with `nginx -t` before reloading.
Issue a separate certificate for `cyberpunk.lwnavx.com` using the server's
existing Certbot account. Keep automatic certificate renewal enabled.

The optional GLM route accepts a caller-owned API key and forwards only to
the fixed official GLM endpoint. It contains no shared server key. The CA
bundle path targets the current Alibaba Cloud Linux server; verify it before
using this example on another OS. The route is rate-limited per client IP.

Online AI settings:

- API base: `https://cyberpunk.lwnavx.com/api/providers/glm`
- Model: a model available to the caller's GLM account
- API key: the caller's own key, entered in the app, never committed

Other providers can be used directly if they permit browser CORS. Local PDF
search and private equipment data are not included in this public deployment.
Export saves on the local site and import them on the online site to migrate.
