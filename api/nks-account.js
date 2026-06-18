/**
 * api/nks-account.js — Vercel Serverless Function v2.1
 * Relay POST requests đến account.nks.vn & online.nks.vn
 */

// Tăng giới hạn body cho avatar/CCCD base64 (mặc định Vercel chỉ 1mb)
export const config = {
  api: { bodyParser: { sizeLimit: '10mb' } }
};

const ACCOUNT_BASE = 'https://account.nks.vn/api';
const ONLINE_BASE  = 'https://online.nks.vn/api';

const ROUTES = {
  login:               { base: ACCOUNT_BASE, ep: 'nks/user/login'        },
  get_user:            { base: ACCOUNT_BASE, ep: 'nks/user'              },
  update_info:         { base: ACCOUNT_BASE, ep: 'nks/user/updateInfo'   },
  update_password:     { base: ACCOUNT_BASE, ep: 'nks/user/updatePass'   },
  update_avatar:       { base: ACCOUNT_BASE, ep: 'nks/user/updateAvatar' },
  update_cccd:         { base: ACCOUNT_BASE, ep: 'nks/user/updateCccd'   },
  get_provinces:       { base: ONLINE_BASE,  ep: 'nks/provinces'         },
  get_administratives: { base: ONLINE_BASE,  ep: 'nks/administratives'   },
};

async function nksPost(endpoint, body = {}) {
  // Với avatar/cccd: gửi multipart/form-data thay vì URLSearchParams
  // vì base64 lớn có thể bị cắt khi encode URL
  const hasFile = body.avatar || body.front || body.back;
  const url     = endpoint;
  const ctrl    = new AbortController();
  const timer   = setTimeout(() => ctrl.abort(), 25000);

  try {
    let fetchBody, contentType;

    if (hasFile) {
      // Dùng FormData để gửi file base64 lớn
      const fd = new FormData();
      for (const [k, v] of Object.entries(body)) {
        fd.append(k, v);
      }
      fetchBody   = fd;
      contentType = null; // FormData tự set Content-Type + boundary
    } else {
      fetchBody   = new URLSearchParams(body).toString();
      contentType = 'application/x-www-form-urlencoded';
    }

    const headers = {
      'User-Agent': 'Mozilla/5.0 NKS-Proxy/2.1',
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

    try   { return { ok: r.ok, status: r.status, data: JSON.parse(text) }; }
    catch { return { ok: false, status: r.status, data: { success: false, message: text.substring(0, 400) } }; }

  } catch (e) {
    clearTimeout(timer);
    const msg = e.name === 'AbortError' ? 'Timeout 25s — NKS API không phản hồi' : e.message;
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

  // Parse body — Vercel tự parse JSON khi Content-Type: application/json
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

  // Bổ sung thông tin cho login
  if (action === 'login') {
    params.ip_address = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || '';
    params.location   = '';
    params.fbtoken    = params.fbtoken || '';
    params.system     = params.system  || 'NKS';
    params.device     = params.device  || 'Web Browser';
  }

  const result = await nksPost(url, params);

  // Luôn trả về 200 kèm data gốc — để client tự xử lý logic lỗi
  return res.status(200).json(result.data);
}
