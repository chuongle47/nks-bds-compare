/**
 * proxy.js — Vercel Serverless Function  v2.0
 * Routes:
 *   GET  /api/proxy            → WordPress REST API (nks/v1/properties)
 *   GET  /api/proxy?img=URL    → Proxy ảnh (bypass CORS)
 *   POST /api/nks-account      → Relay đến account.nks.vn & online.nks.vn API
 */

const WP_API        = 'https://nksbds.page.gd/wp-json/nks/v1/properties';
const WP_TOKEN      = process.env.NKS_WP_TOKEN   || '';
const ACCOUNT_BASE  = 'https://account.nks.vn/api';
const ONLINE_BASE   = 'https://online.nks.vn/api';

// ── Helpers ───────────────────────────────────────────────────────────────

function setCors(res, methods = 'GET, POST, OPTIONS') {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', methods);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

async function nksPost(baseUrl, endpoint, body = {}) {
  const url    = `${baseUrl}/${endpoint}`;
  const params = new URLSearchParams(body);
  const ctrl   = new AbortController();
  const timer  = setTimeout(() => ctrl.abort(), 15000);
  try {
    const r = await fetch(url, {
      method:  'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent':   'Mozilla/5.0 NKS-Proxy/2.0',
        'Accept':       'application/json',
      },
      body:   params.toString(),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    const text = await r.text();
    try { return { ok: r.ok, status: r.status, data: JSON.parse(text) }; }
    catch { return { ok: false, status: r.status, data: { message: text.substring(0, 300) } }; }
  } catch (e) {
    clearTimeout(timer);
    return { ok: false, status: 502, data: { message: e.name === 'AbortError' ? 'Timeout 15s' : e.message } };
  }
}

// ── Main handler ──────────────────────────────────────────────────────────

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  // ── Route: POST /api/nks-account  (Account & Online API relay) ───────
  if (req.method === 'POST') {
    let body = req.body;
    // Vercel parse JSON body tự động nếu Content-Type: application/json
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }

    const { action, ...params } = body || {};

    // Map action → endpoint + baseUrl
    const routes = {
      login:                  { base: ACCOUNT_BASE, ep: 'nks/user/login' },
      get_user:               { base: ACCOUNT_BASE, ep: 'nks/user' },
      update_info:            { base: ACCOUNT_BASE, ep: 'nks/user/updateInfo' },
      update_password:        { base: ACCOUNT_BASE, ep: 'nks/user/updatePass' },
      update_avatar:          { base: ACCOUNT_BASE, ep: 'nks/user/updateAvatar' },
      update_cccd:            { base: ACCOUNT_BASE, ep: 'nks/user/updateCccd' },
      get_provinces:          { base: ONLINE_BASE,  ep: 'nks/provinces' },
      get_administratives:    { base: ONLINE_BASE,  ep: 'nks/administratives' },
    };

    if (!action || !routes[action]) {
      return res.status(400).json({ error: 'action không hợp lệ', valid: Object.keys(routes) });
    }

    const { base, ep } = routes[action];

    // Thêm ip_address cho login
    if (action === 'login') {
      params.ip_address = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || '';
      params.location   = '';
      params.fbtoken    = params.fbtoken    || '';
      params.system     = params.system     || 'NKS';
      params.device     = params.device     || 'Web Browser';
    }

    const result = await nksPost(base, ep, params);
    return res.status(result.ok ? 200 : result.status).json(result.data);
  }

  // ── Route: GET /api/proxy?img=URL  (Image proxy) ─────────────────────
  if (req.query.img) {
    try {
      const url    = decodeURIComponent(req.query.img);
      const imgRes = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://www.dropbox.com/' }
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

  // ── Route: GET /api/proxy  (WordPress properties) ────────────────────
  try {
    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15000);

    const headers = {
      'Accept':          'application/json',
      'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
      'Referer':         'https://nksbds.page.gd/',
      'Origin':          'https://nksbds.page.gd',
      'sec-ch-ua':       '"Google Chrome";v="125"',
      'sec-ch-ua-mobile':'?0',
      'Sec-Fetch-Dest':  'empty',
      'Sec-Fetch-Mode':  'cors',
      'Sec-Fetch-Site':  'same-origin',
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
      error: error.name === 'AbortError' ? 'Timeout: WordPress không phản hồi sau 15 giây' : error.message,
      type:  error.name,
    });
  }
}
