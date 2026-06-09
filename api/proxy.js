/**
 * File: api/proxy.js
 * Hỗ trợ GET (cho ảnh) và GET/POST (cho dữ liệu WordPress)
 */

export default async function handler(req, res) {
  // ── CORS SETUP ─────────────────────────────────────────────
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // ── 1. PROXY ẢNH (Chỉ GET) ──────────────────────────────────
  if (req.method === 'GET' && req.query.img) {
    const url = decodeURIComponent(req.query.img);
    const allowedDomains = ['dropbox.com', 'nks.vn', 'data.nks.vn', 'online.nks.vn'];
    
    if (!allowedDomains.some(d => url.includes(d))) {
      return res.status(403).json({ error: 'Domain không được phép' });
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      const imgRes = await fetch(url, {
        signal: controller.signal,
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      clearTimeout(timeout);

      if (!imgRes.ok) throw new Error('Image fetch failed');

      const buffer = Buffer.from(await imgRes.arrayBuffer());
      res.setHeader('Content-Type', imgRes.headers.get('content-type') || 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return res.send(buffer);
    } catch (err) {
      return res.redirect(302, 'https://placehold.co/400x260/e8f4fd/0077bb?text=NKS+BDS');
    }
  }

  // ── 2. LẤY DỮ LIỆU TỪ WORDPRESS (Hỗ trợ GET và POST) ───────
  if (req.method === 'GET' || req.method === 'POST') {
    try {
      const response = await fetch('https://nksbds.page.gd/wp-json/nks/v1/properties', {
        method: 'GET', // Luôn dùng GET để gọi WP
        headers: { 
          'Accept': 'application/json',
          'User-Agent': 'Vercel-Proxy-Service'
        }
      });

      if (!response.ok) {
        throw new Error(`WordPress returned status ${response.status}`);
      }

      const data = await response.json();
      const items = Array.isArray(data) ? data : [];

      const mappedItems = items.map(item => ({
        ...item,
        featuring: item.featureimg || null,
        imgProxy: (item.featureimg && typeof item.featureimg === 'string' && item.featureimg.trim() !== '') 
                   ? `/api/proxy?img=${encodeURIComponent(item.featureimg)}` 
                   : null
      }));

      return res.status(200).json(mappedItems);
    } catch (error) {
      return res.status(500).json({ 
        error: 'Không thể kết nối tới nguồn dữ liệu', 
        message: error.message 
      });
    }
  }

  return res.status(405).json({ error: 'Phương thức không được hỗ trợ' });
}