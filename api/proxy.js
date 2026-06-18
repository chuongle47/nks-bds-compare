/**
 * api/proxy.js — Vercel Serverless Function
 * GET /api/proxy          → WordPress REST API (nks/v1/properties)
 * GET /api/proxy?img=URL  → Proxy ảnh (bypass CORS)
 */

const WP_API   = 'https://nksbds.page.gd/wp-json/nks/v1/properties';
const WP_TOKEN = process.env.NKS_WP_TOKEN || '';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // ── Proxy ảnh ────────────────────────────────────────────────────────
  if (req.query.img) {
    try {
      const url    = decodeURIComponent(req.query.img);
      const imgRes = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://www.dropbox.com/' },
      });
      if (!imgRes.ok) throw new Error('fetch failed');
      const buffer = Buffer.from(await imgRes.arrayBuffer());
      res.setHeader('Content-Type',  imgRes.headers.get('content-type') || 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return res.send(buffer);
    } catch {
      return res.redirect(302, 'https://placehold.co/400x260/e8f4fd/0077bb?text=NKS+BDS');
    }
  }

  // ── Lấy dữ liệu BĐS từ WordPress ────────────────────────────────────
  try {
    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15000);

    const headers = {
      'Accept':           'application/json',
      'User-Agent':       'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
      'Referer':          'https://nksbds.page.gd/',
      'Origin':           'https://nksbds.page.gd',
      'sec-ch-ua':        '"Google Chrome";v="125"',
      'sec-ch-ua-mobile': '?0',
      'Sec-Fetch-Dest':   'empty',
      'Sec-Fetch-Mode':   'cors',
      'Sec-Fetch-Site':   'same-origin',
    };
    if (WP_TOKEN) headers['X-NKS-Token'] = WP_TOKEN;

    const response = await fetch(WP_API, { headers, signal: ctrl.signal, redirect: 'follow' });
    clearTimeout(timer);

    const text    = await response.text();
    const trimmed = text.trim();

    if (!trimmed.startsWith('[') && !trimmed.startsWith('{')) {
      return res.status(502).json({
        error:      'WordPress không trả về JSON — có thể bị hosting chặn',
        httpStatus: response.status,
        preview:    trimmed.substring(0, 400),
      });
    }

    const data = JSON.parse(text);
    if (data?.code === 'rest_forbidden') {
      return res.status(403).json({ error: 'Token không hợp lệ hoặc chưa cấu hình' });
    }

    const items = Array.isArray(data) ? data : (data.data ?? data.items ?? []);
    const fixed = items.map(item => ({
      ...item,
      featureimg: (item.featureimg || '').replace(/^http:\/\//i, 'https://'),
    }));

    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=30');
    res.setHeader('Content-Type',  'application/json');
    return res.status(200).json(fixed);

  } catch (error) {
    return res.status(502).json({
      error: error.name === 'AbortError'
        ? 'Timeout: WordPress không phản hồi sau 15 giây'
        : error.message,
      type: error.name,
    });
  }
}
