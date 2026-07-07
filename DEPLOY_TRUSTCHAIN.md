# Deploying LivingTrust Pro to trustchainservices.com/livingtrust

This project is configured so the frontend can be served from:

https://trustchainservices.com/livingtrust

## What is already configured

- `apps/web/package.json` includes `build:livingtrust`, which builds the app with `/livingtrust/` as the asset base path.
- `vercel.json` rewrites `/livingtrust`, `/livingtrust/assets/*`, and `/livingtrust/images/*` to the Vite build output.
- Frontend image references use `import.meta.env.BASE_URL`, so generated images work from both localhost and `/livingtrust`.
- Backend CORS in `.env.example` includes `https://trustchainservices.com`.

## Preferred deployment path

Use the existing Vercel project that owns `trustchainservices.com`.

1. Copy this app into the existing site repo or merge this repo into that Vercel project.
2. Add the `vercel.json` rewrites from this project to the existing Vercel config.
3. Set the frontend build command:

```bash
npm run build:livingtrust -w apps/web
```

4. Set the output directory:

```bash
apps/web/dist
```

5. Set production environment variable:

```bash
VITE_API_BASE_URL=https://api.trustchainservices.com
```

6. Deploy the frontend.

## Backend deployment

Deploy `apps/api` to Railway or Render and set:

```bash
WEB_ORIGIN=https://trustchainservices.com
DATABASE_URL=<postgres connection string>
OPENAI_API_KEY=<key>
STRIPE_SECRET_KEY=<key>
STRIPE_WEBHOOK_SECRET=<key>
SENDGRID_API_KEY=<key>
SENDGRID_FROM=<verified sender>
ATTORNEY_REVIEW_WEBHOOK_URL=<partner or internal attorney endpoint>
ATTORNEY_REVIEW_SHARED_SECRET=<shared secret>
```

After the backend is live, point `VITE_API_BASE_URL` at that backend URL and redeploy the frontend.

## Important routing note

Do not assign `trustchainservices.com` to a new empty Vercel project unless you intend to replace the existing homepage. The current domain already serves the Guerilla Holdings site, so the safest production path is to add this app as the `/livingtrust` route inside that existing project or configure a Vercel rewrite/proxy from the existing project to this deployment.

## Current live deployment

The reviewed Vercel deployment is live at:

https://livingtrust-pro.vercel.app/livingtrust

## Cloudflare proxy option for trustchainservices.com/livingtrust

DNS for `trustchainservices.com` currently resolves through Cloudflare. If Cloudflare is the active edge for the existing site, add a Worker route for:

```text
trustchainservices.com/livingtrust*
```

Use this Worker:

```js
export default {
  async fetch(request) {
    const sourceUrl = new URL(request.url);
    const targetUrl = new URL(sourceUrl.pathname + sourceUrl.search, "https://livingtrust-pro.vercel.app");

    const response = await fetch(targetUrl, {
      method: request.method,
      headers: request.headers,
      body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
      redirect: "follow"
    });

    const headers = new Headers(response.headers);
    headers.delete("content-security-policy");
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers
    });
  }
};
```

After the Worker is active, verify:

```bash
curl -I https://trustchainservices.com/livingtrust
curl -I https://trustchainservices.com/livingtrust/assets/index-DbhIJsHK.js
curl -I https://trustchainservices.com/livingtrust/images/trust-hero.png
```

Expected result: HTTP `200` for the page, bundled assets, and generated images.
