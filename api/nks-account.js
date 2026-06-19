/**
 * api/nks-account.js — Vercel Serverless Function v2.2
 * Relay POST requests đến account.nks.vn & online.nks.vn
 *
 * FIXES v2.2:
 *  - Thống nhất signature nksPost(url, body) — loại bỏ phiên bản cũ 3 args
 *  - Thêm action `logout` (endpoint nks/user/logout)
 *  - Luôn trả HTTP 200 kèm data gốc — client tự xử lý logic lỗi
 *  - Timeout 25s cho upload avatar/CCCD
 */

export const config = {
  api: { bodyParser: { sizeLimit: '10mb' } }
};

const ACCOUNT_BASE = 'https://account.nks.vn/api';
const ONLINE_BASE  = 'https://online.nks.vn/api';

const ROUTES = {
  login:               { base: ACCOUNT_BASE, ep: 'nks/user/login'        },
  logout:              { base: ACCOUNT_BASE, ep: 'nks/user/logout'        },
  get_user:            { base: ACCOUNT_BASE, ep: 'nks/user'              },
  update_info:         { base: ACCOUNT_BASE, ep: 'nks/user/updateInfo'   },
  update_password:     { base: ACCOUNT_BASE, ep: 'nks/user/updatePass'   },
  update_avatar:       { base: ACCOUNT_BASE, ep: 'nks/user/updateAvatar' },
  update_cccd:         { base: ACCOUNT_BASE, ep: 'nks/user/updateCccd'   },
  get_provinces:       { base: ONLINE_BASE,  ep: 'nks/provinces'         },
  get_administratives: { base: ONLINE_BASE,  ep: 'nks/administratives'   },
};

/**
 * nksPost(url, body)
 * Gửi POST đến NKS API.
 * Tự chọn FormData (khi có file base64) hoặc URLSearchParams.
 */
async function nksPost(url, body = {}) {
  const hasFile = !!(body.avatar || body.front || body.back);
  const ctrl    = new AbortController();
  const timer   = setTimeout(() => ctrl.abort(), 25000);

  try {
    let fetchBody, contentType;

    if (hasFile) {
      // FormData để gửi base64 lớn (avatar, CCCD)
      const fd = new FormData();
      for (const [k, v] of Object.entries(body)) fd.append(k, v);
      fetchBody   = fd;
      contentType = null; // FormData tự set Content-Type + boundary
    } else {
      fetchBody   = new URLSearchParams(body).toString();
      contentType = 'application/x-www-form-urlencoded';
    }

    const headers = {
      'User-Agent': 'Mozilla/5.0 NKS-Proxy/2.2',
      'Accept':     'application/json',
    };
    if (contentType) headers['Content-Type'] = contentType;

    const r = await fetch(url, {
      method: 'POST',
      headers,
      body:   fetchBody,
      signal: ctrl.signal,
    });
    clearTimeout(timer);

    const text = await r.text();
    console.log(`[nks-account] ${url} → HTTP ${r.status} | ${text.substring(0, 300)}`);

    try {
      return { ok: r.ok, status: r.status, data: JSON.parse(text) };
    } catch {
      return { ok: false, status: r.status, data: { success: false, message: text.substring(0, 400) } };
    }
  } catch (e) {
    clearTimeout(timer);
    const msg = e.name === 'AbortError'
      ? 'Timeout 25s — NKS API không phản hồi'
      : e.message;
    console.error(`[nks-account] exception: ${msg}`);
    return { ok: false, status: 502, data: { success: false, message: msg } };
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')    return res.status(405).json({ error: 'Method not allowed' });

  // Vercel tự parse JSON khi Content-Type: application/json
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  body = body || {};

  const { action, ...params } = body;
  console.log(`[nks-account] action=${action} | keys=${Object.keys(params).join(',')}`);

  if (!action || !ROUTES[action]) {
    return res.status(400).json({
      error: `action "${action}" không hợp lệ`,
      valid: Object.keys(ROUTES),
    });
  }

  const { base, ep } = ROUTES[action];
  const url = `${base}/${ep}`;

  // Bổ sung metadata cho login
  if (action === 'login') {
    params.ip_address = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || '';
    params.location   = '';
    params.fbtoken    = params.fbtoken || '';
    params.system     = params.system  || 'NKS';
    params.device     = params.device  || 'Web Browser';
  }

  const result = await nksPost(url, params);

  // Luôn trả 200 — client tự xử lý success/error từ data
  return res.status(200).json(result.data);
}
