/**
 * API Proxy cho NKS Property
 * Tính năng: 
 * 1. Proxy hình ảnh (GET /api/proxy?img=...)
 * 2. Proxy dữ liệu BĐS (POST/GET /api/proxy) - Gọi tới WordPress API
 */

export default async function handler(req, res) {
  // 1. Cấu hình CORS (Cho phép frontend gọi từ mọi nguồn)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json');

  // Xử lý request OPTIONS (Preflight)
  if (req.method === 'OPTIONS') return res.status(200).end();

  // 2. PROXY ẢNH (GET /api/proxy?img=URL)
  if (req.method === 'GET' && req.query.img) {
    try {
      const url = decodeURIComponent(req.query.img);
      const imgRes = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      
      if (!imgRes.ok) throw new Error('Failed to fetch image');
      
      const buffer = Buffer.from(await imgRes.arrayBuffer());
      res.setHeader('Content-Type', imgRes.headers.get('content-type') || 'image/jpeg');
      return res.send(buffer);
    } catch (err) {
      // Nếu lỗi ảnh, trả về ảnh placeholder thay vì báo lỗi
      return res.redirect(302, 'https://placehold.co/400x260/e8f4fd/0077bb?text=NKS+BDS');
    }
  }

  // 3. LẤY DỮ LIỆU TỪ WORDPRESS (Hỗ trợ POST từ index.html)
  try {
    const response = await fetch('https://nksbds.page.gd/wp-json/nks/v1/properties', {
      method: 'GET', // Luôn gọi GET tới WordPress
      headers: { 'Accept': 'application/json' }
    });

    if (!response.ok) throw new Error('WordPress API error');

    const data = await response.json();

    // TRẢ VỀ DỮ LIỆU GỐC
    // Index.html đang mong đợi dữ liệu JSON thô, không qua xử lý trung gian
    return res.status(200).json(data);

  } catch (error) {
    // Nếu có lỗi, trả về mảng rỗng để frontend không bị treo
    return res.status(200).json([]);
  }
}