const WP_API = 'https://nksbds.page.gd/wp-json/nks/v1/properties?i=1';

export default async function handler(req, res) {
  // ── CORS ─────────────────────────────────────────────────────
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // ── PROXY ẢNH (GET /api/proxy?img=URL) ──────────────────────
  if (req.query.img) {
    try {
      const url = decodeURIComponent(req.query.img);
      const imgRes = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
      });
      if (!imgRes.ok) throw new Error('image fetch failed');
      const buffer = Buffer.from(await imgRes.arrayBuffer());
      res.setHeader('Content-Type', imgRes.headers.get('content-type') || 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=86400'); // cache ảnh 1 ngày
      return res.send(buffer);
    } catch {
      return res.redirect(302, 'https://placehold.co/400x260/e8f4fd/0077bb?text=NKS+BDS');
    }
  }

  // ── LẤY DỮ LIỆU WORDPRESS (GET /api/proxy) ──────────────────
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // timeout 10s

    const response = await fetch(WP_API, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      },
      signal: controller.signal
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return res.status(502).json({
        error: `WordPress trả về lỗi ${response.status}`
      });
    }

    const data = await response.json();

    // Fix ảnh http → https để tránh Mixed Content trên trình duyệt
    const fixed = Array.isArray(data)
      ? data.map(item => ({
          ...item,
          featureimg: (item.featureimg || '').replace(/^http:\/\//i, 'https://')
        }))
      : data;

    // Cache dữ liệu 5 phút trên Vercel Edge
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=60');
    res.setHeader('Content-Type', 'application/json');
    return res.status(200).json(fixed);

  } catch (error) {
    const isTimeout = error.name === 'AbortError';
    return res.status(502).json({
      error: isTimeout ? 'Timeout: WordPress không phản hồi sau 10 giây' : error.message
    });
  }
}