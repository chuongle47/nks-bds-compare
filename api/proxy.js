/**
 * File: api/proxy.js
 * Chức năng: 
 * 1. GET /api/proxy?img=URL -> Proxy ảnh.
 * 2. GET/POST /api/proxy -> Lấy dữ liệu từ WordPress API.
 */

export default async function handler(req, res) {
  // 1. Cấu hình CORS (Cho phép frontend gọi từ mọi nguồn)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // 2. PROXY ẢNH
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

  // 3. LẤY DỮ LIỆU TỪ WORDPRESS
  // Sử dụng try-catch bao quát để đảm bảo luôn trả về dữ liệu cho frontend
  try {
    const response = await fetch('https://nksbds.page.gd/wp-json/nks/v1/properties', {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });

    if (!response.ok) {
      throw new Error('WordPress API error');
    }

    const data = await response.json();

    // TRẢ VỀ NGUYÊN BẢN DỮ LIỆU (Giữ nguyên cấu trúc JSON gốc)
    // Điều này đảm bảo Frontend không bị lỗi render
    return res.status(200).json(data);

  } catch (error) {
    // Nếu có lỗi, trả về mảng rỗng để frontend không bị crash
    return res.status(200).json([]);
  }
}