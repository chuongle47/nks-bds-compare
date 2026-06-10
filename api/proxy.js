const WP_API = 'https://nksbds.page.gd/wp-json/nks/v1/properties?i=1';

// Headers giả lập browser thật để tránh hosting chặn bot
const BROWSER_HEADERS = {
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
  'Accept-Encoding': 'gzip, deflate, br',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Referer': 'https://nksbds.page.gd/',
  'Origin': 'https://nksbds.page.gd',
  'sec-ch-ua': '"Google Chrome";v="125", "Chromium";v="125"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"Windows"',
  'Sec-Fetch-Dest': 'empty',
  'Sec-Fetch-Mode': 'cors',
  'Sec-Fetch-Site': 'same-origin',
  'Cache-Control': 'no-cache',
  'Pragma': 'no-cache',
  'Connection': 'keep-alive',
};

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
      const imgRes = await fetch(url, { headers: { 'User-Agent': BROWSER_HEADERS['User-Agent'] } });
      if (!imgRes.ok) throw new Error('image fetch failed');
      const buffer = Buffer.from(await imgRes.arrayBuffer());
      res.setHeader('Content-Type', imgRes.headers.get('content-type') || 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return res.send(buffer);
    } catch {
      return res.redirect(302, 'https://placehold.co/400x260/e8f4fd/0077bb?text=NKS+BDS');
    }
  }

  // ── LẤY DỮ LIỆU WORDPRESS ────────────────────────────────────
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000); // 15s timeout

    const response = await fetch(WP_API, {
      headers: BROWSER_HEADERS,
      signal: controller.signal,
      redirect: 'follow',
    });

    clearTimeout(timeout);

    // Đọc text trước để kiểm tra có phải JSON không
    const text = await response.text();

    // Nếu WordPress trả về HTML (bị chặn/redirect) → log preview để debug
    const trimmed = text.trim();
    if (!trimmed.startsWith('[') && !trimmed.startsWith('{')) {
      return res.status(502).json({
        error: 'WordPress không trả về JSON',
        httpStatus: response.status,
        preview: trimmed.substring(0, 500),
      });
    }

    const data = JSON.parse(text);

    // Fix ảnh http → https
    const fixed = Array.isArray(data)
      ? data.map(item => ({
          ...item,
          featureimg: (item.featureimg || '').replace(/^http:\/\//i, 'https://')
        }))
      : data;

    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=60');
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