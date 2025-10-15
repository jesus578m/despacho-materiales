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
  async fetch(req, env) {
    const url = new URL(req.url);
    const { pathname } = url;

    // ---------- CORS ----------
    const CORS = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS,PUT,DELETE",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    };
    if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

    // Helpers
    const json = (data, status = 200, extraHeaders = {}) =>
      new Response(JSON.stringify(data), {
        status,
        headers: { "Content-Type": "application/json", ...CORS, ...extraHeaders },
      });

    // ---------- API: /api/records ----------
    if (pathname === "/api/records") {
      if (req.method === "POST") {
        let body = {};
        try { body = await req.json(); } catch {}
        const id = crypto.randomUUID();
        const ts = Date.now();
        const item = { id, ts, ...body };

        // Guarda el registro
        await env.DESPACHO_KV.put(`record:${id}`, JSON.stringify(item));

        // Actualiza índice
        const idx = JSON.parse((await env.DESPACHO_KV.get("index")) || "[]");
        idx.push({ id, ts });
        await env.DESPACHO_KV.put("index", JSON.stringify(idx));

        return json({ ok: true, id });
      }

      if (req.method === "GET") {
        const limit = Number(url.searchParams.get("limit") || 100);
        const idx = JSON.parse((await env.DESPACHO_KV.get("index")) || "[]")
          .sort((a, b) => b.ts - a.ts)
          .slice(0, limit);

        const items = await Promise.all(
          idx.map(async ({ id }) => JSON.parse(await env.DESPACHO_KV.get(`record:${id}`)))
        );

        return json({ items });
      }

      return json({ error: "Method not allowed" }, 405, { Allow: "GET, POST, OPTIONS" });
    }

    // ---------- API: /api/descargas (CSV en vivo) ----------
    if (pathname === "/api/descargas" && req.method === "GET") {
      const idx = JSON.parse((await env.DESPACHO_KV.get("index")) || "[]")
        .sort((a, b) => b.ts - a.ts);

      const items = await Promise.all(
        idx.map(async ({ id }) => JSON.parse(await env.DESPACHO_KV.get(`record:${id}`)))
      );

      const cols = ["id","ts","tecnico","material","cantidad","po","comentarios"];
      const header = cols.join(",");
      const lines = items.map(o =>
        cols.map(c => `"${String(o?.[c] ?? "").replace(/"/g,'""')}"`).join(",")
      );
      const csv = [header, ...lines].join("\n");

      return new Response(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="despachos_${new Date().toISOString().slice(0,10)}.csv"`,
          ...CORS
        }
      });
    }

    // ---------- Sitio estático (Assets) ----------
    // Todo lo que no sea /api/* se sirve desde /public
    return env.ASSETS.fetch(req);
  }
};
