# CampusMart PWA deployment

CampusMart remains the existing React/Vite single page application. Netlify still builds from `FRONTEND/OldIsGold` with `npm install && npm run build`, publishes `dist`, and uses the existing SPA rewrite in the repository-root `netlify.toml`.

## Netlify configuration

- Keep the site on HTTPS. Netlify serves HTTPS deployments, which service workers and installation require outside localhost.
- Set `VITE_SITE_URL` in the Netlify environment to the production site's canonical origin (scheme and host only, with no path). This is used for canonical and social-sharing metadata. It is optional for local development, where the current origin is used.
- Keep `VITE_API_URL` empty when the API is available through the existing same-origin `/api` proxy, or set it to the configured backend origin for a split deployment.
- Configure `GEMINI_API_KEY` on the backend deployment for AI search and price estimates. The key is not read by the frontend.

The build emits `manifest.webmanifest`, `sw.js`, the existing 192 and 512 pixel CampusMart icons, and `offline.html`. Netlify sends no-cache headers for the service worker and serves `/offline.html` as a static asset; the SPA rewrite remains in place for client routes.

## Install and offline behavior

The in-app install button appears only after a browser dispatches `beforeinstallprompt`. On iPhone and iPad, use Safari's Share menu and choose **Add to Home Screen**. Other browsers that do not expose the prompt show browser-menu guidance; install availability depends on the browser and its policy.

The service worker precaches the static app shell, icons, and offline page. It does not cache API calls, authentication responses, or private user data. Offline submissions are not queued; the UI says to reconnect and retry. In-app notifications continue to use the existing authenticated API and socket channel. Push notifications are not configured or claimed.

To test the production PWA locally, run the project's existing `npm run build` and `npm run preview` scripts from this directory, then visit the preview on localhost. The Vite development server is not used to judge production service-worker behavior.
