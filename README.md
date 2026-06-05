# MacroDash — v1.6.1 deploy scaffold

Wraps the existing `dashboard.jsx` (v1.6.0) into a Vite + React app that
Cloudflare Pages can build and serve. Produces one responsive URL that works
on mobile (primary) and desktop.

## One-time setup (do this once, in your existing GitHub repo)

1. Drop these files into the repo root.
2. Move your existing `dashboard.jsx` to **`src/dashboard.jsx`**.
3. Confirm the export style in `src/App.jsx` matches your dashboard
   (default vs named — see the note at the top of App.jsx).
4. Commit + push:
   ```
   git add .
   git commit -m "v1.6.1: Vite scaffold for Cloudflare Pages"
   git push
   ```

## Cloudflare Pages (one-time connect)

dash.cloudflare.com → Workers & Pages → Create → Pages → Connect to Git →
pick this repo → set:

- Framework preset:    **Vite**
- Build command:       **npm run build**
- Build output dir:    **dist**

Click Save and Deploy. You get `https://<project>.pages.dev` in ~1–2 min.
Every future `git push` to main auto-redeploys that same URL.

## Views

- Full view (you):           `https://<project>.pages.dev`
- Friend / public view:      `https://<project>.pages.dev/?view=public`
  (hides Zone E **only after** the one-line guard is added in dashboard.jsx)

## Local check before pushing (optional)

```
npm install
npm run build      # must succeed and create dist/
npm run preview    # open the printed localhost URL to eyeball it
```

## Mobile

The viewport + manifest are wired for "Add to Home Screen." Adding a
192px and 512px icon (and an apple-touch-icon) later gives a real app icon;
without them, add-to-home-screen still works with a default glyph.
