/**
 * Cloudflare Worker 入口
 * 记录访问者信息到 D1 + 提供统计 API
 */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // /api/init — 初始化数据库表
    if (url.pathname === '/api/init') {
      try {
        await env.DB.exec(
          "CREATE TABLE IF NOT EXISTS visits (id INTEGER PRIMARY KEY AUTOINCREMENT, ip TEXT, country TEXT, city TEXT, region TEXT, ua TEXT, path TEXT, referer TEXT, ts DATETIME DEFAULT CURRENT_TIMESTAMP)"
        );
        return new Response('OK - table created');
      } catch (e) {
        return new Response('Error: ' + e.message, { status: 500 });
      }
    }

    // /api/track — 记录访问
    if (url.pathname === '/api/track') {
      const ip = request.headers.get('cf-connecting-ip') || 'unknown';
      const country = request.headers.get('cf-ipcountry') || 'unknown';
      const city = (request.cf && request.cf.city) || 'unknown';
      const region = (request.cf && request.cf.region) || 'unknown';
      const ua = request.headers.get('user-agent') || 'unknown';
      const path = url.searchParams.get('p') || '/';
      const referer = request.headers.get('referer') || '';

      try {
        await env.DB.prepare(
          'INSERT INTO visits (ip, country, city, region, ua, path, referer) VALUES (?, ?, ?, ?, ?, ?, ?)'
        ).bind(ip, country, city, region, ua, path, referer).run();
      } catch (e) {
        // 表不存在则自动创建
        try {
          await env.DB.exec(
            "CREATE TABLE IF NOT EXISTS visits (id INTEGER PRIMARY KEY AUTOINCREMENT, ip TEXT, country TEXT, city TEXT, region TEXT, ua TEXT, path TEXT, referer TEXT, ts DATETIME DEFAULT CURRENT_TIMESTAMP)"
          );
          await env.DB.prepare(
            'INSERT INTO visits (ip, country, city, region, ua, path, referer) VALUES (?, ?, ?, ?, ?, ?, ?)'
          ).bind(ip, country, city, region, ua, path, referer).run();
        } catch (e2) {
          // 静默失败，不影响用户体验
        }
      }

      return new Response('ok', {
        headers: { 'content-type': 'text/plain', 'access-control-allow-origin': '*' }
      });
    }

    // /api/stats — 统计数据
    if (url.pathname === '/api/stats') {
      var days = parseInt(url.searchParams.get('days') || '7');
      var since = new Date(Date.now() - days * 86400000).toISOString();

      try {
        var results = await Promise.all([
          env.DB.prepare("SELECT DATE(ts) as day, COUNT(*) as cnt FROM visits WHERE ts >= ? GROUP BY day ORDER BY day").bind(since).all(),
          env.DB.prepare("SELECT country, COUNT(*) as cnt FROM visits WHERE ts >= ? GROUP BY country ORDER BY cnt DESC LIMIT 20").bind(since).all(),
          env.DB.prepare("SELECT CASE WHEN ua LIKE '%Mobile%' THEN 'Mobile' WHEN ua LIKE '%Tablet%' THEN 'Tablet' ELSE 'Desktop' END as device, COUNT(*) as cnt FROM visits WHERE ts >= ? GROUP BY device ORDER BY cnt DESC").bind(since).all(),
          env.DB.prepare("SELECT path, COUNT(*) as cnt FROM visits WHERE ts >= ? GROUP BY path ORDER BY cnt DESC LIMIT 10").bind(since).all(),
          env.DB.prepare("SELECT COUNT(*) as cnt, COUNT(DISTINCT ip) as uv FROM visits WHERE ts >= ?").bind(since).all(),
        ]);

        return Response.json({
          daily: results[0].results,
          countries: results[1].results,
          devices: results[2].results,
          paths: results[3].results,
          total: results[4].results[0]
        }, { headers: { 'access-control-allow-origin': '*' } });
      } catch (e) {
        return Response.json({ error: e.message }, { status: 500 });
      }
    }

    // 其他请求 → 静态资源
    return env.ASSETS.fetch(request);
  }
};
