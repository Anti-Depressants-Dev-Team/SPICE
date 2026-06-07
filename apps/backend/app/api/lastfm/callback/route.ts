import type { NextRequest } from 'next/server';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')?.trim() || '';
  const html = token ? tokenCaptureHtml(token) : callbackInfoHtml(request.nextUrl.origin);

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
    },
  });
}

function callbackInfoHtml(origin: string) {
  return pageHtml(`
    <h1>Last.fm Callback Ready</h1>
    <p>Use this callback URL in your Last.fm API application settings:</p>
    <code>${escapeHtml(`${origin}/api/lastfm/callback`)}</code>
    <p>SPICE primarily uses Last.fm's desktop auth flow, so this page is only a fallback when Last.fm redirects back with a token.</p>
    <a href="/">Return to SPICE</a>
  `);
}

function tokenCaptureHtml(token: string) {
  const safeToken = JSON.stringify(token);
  return pageHtml(`
    <h1>Last.fm Token Captured</h1>
    <p>The authorization token was saved locally. Return to Settings and click <strong>Complete Link</strong>.</p>
    <script>
      localStorage.setItem('spice_lastfm_link_token', ${safeToken});
      setTimeout(() => {
        window.location.href = '/';
      }, 1200);
    </script>
    <a href="/">Return to SPICE now</a>
  `);
}

function pageHtml(body: string) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>SPICE Last.fm Callback</title>
    <style>
      :root { color-scheme: dark; }
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        background: #050505;
        color: #f8fafc;
        font-family: Inter, ui-sans-serif, system-ui, sans-serif;
      }
      main {
        width: min(560px, calc(100vw - 32px));
        border: 1px solid rgba(255,255,255,0.12);
        border-radius: 18px;
        background: #101010;
        padding: 28px;
        box-shadow: 0 24px 80px rgba(0,0,0,0.45);
      }
      h1 { margin: 0 0 12px; font-size: 1.4rem; }
      p { color: #b6b6c2; line-height: 1.55; }
      code {
        display: block;
        padding: 12px;
        border-radius: 10px;
        background: #050505;
        color: #c4b5fd;
        overflow-wrap: anywhere;
      }
      a { color: #c084fc; font-weight: 700; }
    </style>
  </head>
  <body>
    <main>${body}</main>
  </body>
</html>`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
