/**
 * proxy.js — Vercel Serverless Function
 * Flow: Vercel → WordPress REST API (nks/v1/properties) → index.html
 * Dùng header X-NKS-Token để xác thực với WordPress
 */

const WP_API   = 'https://nksbds.page.gd/wp-json/nks/v1/properties';
const WP_TOKEN = process.env.NKS_WP_TOKEN || ''; // Vercel → Settings → Environment Variables

export default async function handler(req, res) {
  // ── CORS ──────────────────────────────────────────────────────
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // ── PROXY ẢNH (GET /api/proxy?img=URL) ───────────────────────
  if (req.query.img) {
    try {
      const url = decodeURIComponent(req.query.img);
      const imgRes = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0',
          'Referer': 'https://www.dropbox.com/',
        }
      });
      if (!imgRes.ok) throw new Error('image fetch failed');
      const buffer = Buffer.from(await imgRes.arrayBuffer());
      res.setHeader('Content-Type', imgRes.headers.get('content-type') || 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return res.send(buffer);
    } catch {
      return res.redirect(302, 'https://placehold.co/400x260/e8f4fd/0077bb?text=NKS+BDS');
    }
  }

  // ── LẤY DỮ LIỆU TỪ WORDPRESS REST API ───────────────────────
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const headers = {
      'Accept': 'application/json',
      // Giả lập browser để tránh hosting chặn
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
      'Referer': 'https://nksbds.page.gd/',
      'Origin': 'https://nksbds.page.gd',
      'sec-ch-ua': '"Google Chrome";v="125"',
      'sec-ch-ua-mobile': '?0',
      'Sec-Fetch-Dest': 'empty',
      'Sec-Fetch-Mode': 'cors',
      'Sec-Fetch-Site': 'same-origin',
    };

    // Thêm token nếu đã cấu hình
    if (WP_TOKEN) headers['X-NKS-Token'] = WP_TOKEN;

    const response = await fetch(WP_API, {
      headers,
      signal: controller.signal,
      redirect: 'follow',
    });

    clearTimeout(timeout);

    const text = await response.text();
    const trimmed = text.trim();

    // Nếu WordPress trả HTML (bị chặn) → hiện preview để debug
    if (!trimmed.startsWith('[') && !trimmed.startsWith('{')) {
      return res.status(502).json({
        error: 'WordPress không trả về JSON — có thể bị hosting chặn',
        httpStatus: response.status,
        preview: trimmed.substring(0, 400),
      });
    }

    const data = JSON.parse(text);

    // Kiểm tra lỗi xác thực token
    if (data && data.code === 'rest_forbidden') {
      return res.status(403).json({ error: 'Token không hợp lệ hoặc chưa cấu hình' });
    }

    // Chuẩn hóa thành mảng
    const items = Array.isArray(data) ? data : (data.data ?? data.items ?? []);

    // Fix ảnh http → https
    const fixed = items.map(item => ({
      ...item,
      featureimg: (item.featureimg || '').replace(/^http:\/\//i, 'https://'),
    }));

    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=30');
    res.setHeader('Content-Type', 'application/json');
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