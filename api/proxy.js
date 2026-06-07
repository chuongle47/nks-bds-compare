// File: api/proxy.js
export default async function handler(req, res) {
  // ── CORS ──────────────────────────────────────────────────
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // ── PROXY ẢNH: GET /api/proxy?img=<url> ──────────────────
  if (req.method === 'GET' && req.query.img) {
    const url = decodeURIComponent(req.query.img);

    const allowed = ['dropbox.com', 'nks.vn', 'data.nks.vn', 'online.nks.vn'];
    const ok = allowed.some(d => url.includes(d));
    if (!ok) return res.status(403).json({ error: 'Domain không được phép' });

    try {
      const imgRes = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': 'https://www.dropbox.com/'
        }
      });

      if (!imgRes.ok) {
        // Trả placeholder nếu ảnh lỗi
        return res.redirect(302, 'https://placehold.co/400x260/e8f4fd/0077bb?text=NKS+BDS');
      }

      const contentType = imgRes.headers.get('content-type') || 'image/jpeg';
      const buffer = await imgRes.arrayBuffer();

      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=86400'); // cache 1 ngày
      return res.status(200).send(Buffer.from(buffer));
    } catch (err) {
      return res.redirect(302, 'https://placehold.co/400x260/e8f4fd/0077bb?text=NKS+BDS');
    }
  }

  // ── PROXY DATA: POST /api/proxy ───────────────────────────
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const targetUrl = 'https://online.nks.vn/api/nks/rsitems';
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body || {})
    });

    if (!response.ok) {
      throw new Error(`API NKS trả về lỗi: ${response.status}`);
    }

    const data = await response.json();

    // Chuẩn hóa cấu trúc
    let items = [];
    if (Array.isArray(data))              items = data;
    else if (Array.isArray(data.data))    items = data.data;
    else if (Array.isArray(data.items))   items = data.items;
    else if (Array.isArray(data.results)) items = data.results;
    else if (Array.isArray(data.List))    items = data.List;

    // Map featureimg → featuring + tạo imgUrl proxy qua chính server này
    items = items.map(item => {
      const rawImg = item.featureimg || item.featuring || item.image || null;
      return {
        ...item,
        featuring: rawImg,
        // imgProxy: URL ảnh đi qua proxy của chính mình (tránh CORS/tracking block)
        imgProxy: rawImg
          ? `/api/proxy?img=${encodeURIComponent(rawImg)}`
          : null
      };
    });

    return res.status(200).json({ data: items });
  } catch (error) {
    console.error('Lỗi Proxy:', error);
    return res.status(500).json({ error: error.message });
  }
}
