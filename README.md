# ClipDrop — Twitch Clip Downloader

A polished Next.js + Netlify Functions MVP.

## Architecture

```text
Browser
   |
   | POST /api/resolve
   v
Netlify Function
   |
   | Twitch internal GraphQL
   v
Twitch
   |
   | signed MP4 source URL
   v
Browser
   |
   v
Twitch CDN -> local download
```

The Netlify function does not proxy the video file. It resolves the temporary
Twitch media URL and the browser requests the video directly from Twitch's CDN.

## Run locally

```bash
npm install
npm run dev
```

Open:

http://localhost:3000

For local Netlify Functions behavior, use the Netlify CLI:

```bash
npx netlify dev
```

## Deploy

Push this repository to GitHub and import it into Netlify.

Netlify detects Next.js automatically. The included `netlify.toml` configures
the build and the Functions directory.

## Important implementation note

The resolver uses Twitch's internal `gql.twitch.tv/gql` web-client endpoint and
the `VideoAccessToken_Clip` persisted query. This is not Twitch's official
public GraphQL API and can change without notice.

The official public Twitch API has a `Get Clips Download` endpoint, but its
authorization requirements are different. Do not treat this internal resolver
as an official Twitch API guarantee.

Use the downloader only for content you have permission to download.
