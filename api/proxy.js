/**
 * API Proxy cho NKS Property
 * Xử lý: Proxy hình ảnh (GET) và Lấy dữ liệu BĐS từ WordPress (GET/POST)
 */

export default async function handler(req, res) {
  // 1. Cấu hình CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();

  // 2. PROXY ẢNH (GET /api/proxy?img=...)
  if (req.method === 'GET' && req.query.img) {
    const url = decodeURIComponent(req.query.img);
    const allowed = ['dropbox.com', 'nks.vn', 'data.nks.vn', 'online.nks.vn'];
    
    if (!allowed.some(d => url.includes(d))) {
      return res.status(403).json({ error: 'Domain không được phép' });
    }

    try {
      const imgRes = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      if (!imgRes.ok) throw new Error();
      
      const buffer = Buffer.from(await imgRes.arrayBuffer());
      res.setHeader('Content-Type', imgRes.headers.get('content-type') || 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return res.send(buffer);
    } catch (err) {
      return res.redirect(302, 'https://placehold.co/400x260/e8f4fd/0077bb?text=NKS+BDS');
    }
  }

  // 3. LẤY DỮ LIỆU WORDPRESS (GET hoặc POST)
  if (req.method === 'GET' || req.method === 'POST') {
    try {
      const response = await fetch('https://nksbds.page.gd/wp-json/nks/v1/properties', {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });

      // Nếu WordPress không trả về 200, bỏ qua và trả về mảng rỗng
      if (!response.ok) return res.status(200).json([]);

      const data = await response.json();
      const items = Array.isArray(data) ? data : [];

      // Xử lý dữ liệu an toàn
      const mappedItems = items
        .filter(item => item && typeof item === 'object') // Chỉ lấy đối tượng hợp lệ
        .map(item => {
          const rawImg = (item.featureimg && typeof item.featureimg === 'string') ? item.featureimg : null;
          return {
            ...item,
            featuring: rawImg,
            imgProxy: rawImg ? `/api/proxy?img=${encodeURIComponent(rawImg)}` : null
          };
        });

      return res.status(200).json(mappedItems);
    } catch (error) {
      // Bắt mọi lỗi xảy ra (kể cả lỗi JSON parse) để tránh HTTP 500
      return res.status(200).json([]);
    }
  }

  // 4. Các phương thức khác bị chặn
  return res.status(405).json({ error: 'Phương thức không được hỗ trợ' });
}