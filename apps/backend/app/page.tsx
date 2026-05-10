export default function Home() {
  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: 32, lineHeight: 1.5 }}>
      <h1>Spice backend</h1>
      <p>This service hosts the YouTube Music proxy (web client only) and the sync API.</p>
      <ul>
        <li><code>GET /api/yt/search?q=...</code></li>
        <li><code>GET /api/yt/track/[id]</code></li>
        <li><code>GET /api/yt/stream/[id]</code> (range-aware)</li>
        <li><code>POST /api/auth/spice/signin</code></li>
        <li><code>GET /api/auth/google/start</code></li>
        <li><code>GET|POST /api/sync/playlists</code></li>
        <li><code>GET|POST /api/sync/likes</code></li>
        <li><code>POST /api/sync/history</code></li>
      </ul>
      <p>All endpoints currently return <code>501 Phase N</code> — see the build plan.</p>
    </main>
  );
}
