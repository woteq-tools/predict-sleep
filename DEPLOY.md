# Deployment

The app is a static site: any web server that serves the folder over **HTTPS**
works. PWAs and service workers require a secure context, so `http://` only
works for `localhost`.

## This deployment

| | |
| --- | --- |
| Repository | <https://github.com/woteq-tools/predict-sleep> |
| Live URL | <https://woteq-tools.github.io/predict-sleep/> |
| Hosting | GitHub Pages, published by `.github/workflows/deploy.yml` |

Every push to `main` is deployed automatically.

## GitHub Pages (recommended)

The repository already contains a workflow at
`.github/workflows/deploy.yml` that publishes the app on every push to `main`.

One time setup:

1. Create a repository on GitHub and push the project:

   ```bash
   git remote add origin https://github.com/<you>/<repo>.git
   git push -u origin main
   git push origin --tags
   ```

2. In the repository go to **Settings → Pages**.
3. Under **Build and deployment** choose **Source: GitHub Actions**.
4. Wait for the first workflow run to finish.

The app is then served from `https://<you>.github.io/<repo>/`.

> If the project lives in a subdirectory, the relative paths (`./styles.css`,
> `./app.js`, ...) keep working, but the service worker scope is limited to
> that subdirectory. Everything below is written relative, so no change is
> needed.

## Any other static host

Upload these files and keep the folder structure:

```
index.html
styles.css
app.js
time.js
storage.js
sw.js
manifest.json
icons/*.png
```

- **Netlify**: drag the folder into the deploy drop zone.
- **Vercel**: `vercel --prod` (no build step needed).
- **Cloudflare Pages**: connect the repository, leave the build command empty
  and set the output directory to the repository root.

## After every deployment

The service worker caches the app shell. When the shell changes, bump the
cache version in `sw.js`:

```js
const CACHE_VERSION = 'sleep-v3';   // <- bump this
```

Without the bump, users keep the old files until the cache is cleared.
