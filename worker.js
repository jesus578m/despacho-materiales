// Cloudflare Worker script for Despacho de Materiales
// This worker receives dispatch records from the front-end and appends them to
// descargas.json in a GitHub repository. It uses the GitHub API and a token
// stored in environment variables. Deploy this script as a Worker on
// Cloudflare and configure the following environment variables:
//   GH_OWNER  – GitHub username or organization (e.g. 'jesus578m')
//   GH_REPO   – Repository name (e.g. 'despacho-materiales')
//   GH_BRANCH – Branch name to update (default 'main')
//   GH_TOKEN  – Personal access token with "repo" or "contents:write" scope

export default {
  async fetch(request, env) {
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }
    let body;
    try {
      body = await request.json();
    } catch {
      return new Response('Invalid JSON', { status: 400 });
    }
    const { action, record } = body || {};
    if (action !== 'append' || !record) {
      return new Response('Invalid payload', { status: 400 });
    }
    // Configuration from environment variables
    const owner = env.GH_OWNER || 'jesus578m';
    const repo = env.GH_REPO || 'despacho-materiales';
    const branch = env.GH_BRANCH || 'main';
    const token = env.GH_TOKEN;
    if (!token) {
      return new Response('Missing GitHub token in environment', { status: 500 });
    }
    try {
      // Fetch existing descargas.json to get SHA and data
      const metaRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/descargas.json?ref=${branch}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'User-Agent': 'cf-worker',
          'Accept': 'application/vnd.github+json'
        }
      });
      if (!metaRes.ok) {
        return new Response('Failed to fetch file metadata', { status: metaRes.status });
      }
      const meta = await metaRes.json();
      let data = [];
      if (meta && meta.content) {
        // GitHub returns base64-encoded content
        data = JSON.parse(atob(meta.content.replace(/\n/g, '')));
      }
      data.push(record);
      const newContent = btoa(unescape(encodeURIComponent(JSON.stringify(data, null, 2))));
      // Prepare commit
      const bodyUpdate = {
        message: `chore(descargas): append via worker on ${new Date().toISOString()}`,
        content: newContent,
        branch,
        sha: meta.sha
      };
      const putRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/descargas.json`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'User-Agent': 'cf-worker',
          'Accept': 'application/vnd.github+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(bodyUpdate)
      });
      if (!putRes.ok) {
        const text = await putRes.text();
        return new Response('Failed to update file: ' + text, { status: putRes.status });
      }
      return new Response('OK', { status: 200 });
    } catch (err) {
      return new Response('Error: ' + err.message, { status: 500 });
    }
  }
};