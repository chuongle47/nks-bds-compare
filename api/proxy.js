/**
 * API Proxy cho NKS Property
 * Xử lý: Proxy ảnh và Lấy dữ liệu BĐS từ WordPress
 */

export default async function handler(req, res) {
  // 1. Cấu hình CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json');

  // Xử lý preflight request
  if (req.method === 'OPTIONS') return res.status(200).end();

  // 2. PROXY ẢNH (GET /api/proxy?img=...)
  if (req.method === 'GET' && req.query.img) {
    try {
      const url = decodeURIComponent(req.query.img);
      const imgRes = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      if (!imgRes.ok) throw new Error();
      
      const buffer = Buffer.from(await imgRes.arrayBuffer());
      res.setHeader('Content-Type', imgRes.headers.get('content-type') || 'image/jpeg');
      return res.send(buffer);
    } catch (err) {
      return res.redirect(302, 'https://placehold.co/400x260/e8f4fd/0077bb?text=NKS+BDS');
    }
  }

  // 3. LẤY DỮ LIỆU WORDPRESS (Hỗ trợ cả POST và GET từ frontend)
  try {
    const response = await fetch('https://nksbds.page.gd/wp-json/nks/v1/properties', {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });

    if (!response.ok) throw new Error('Cannot fetch WordPress API');

    const data = await response.json();

    // Trả về dữ liệu gốc để file index.html tự xử lý
    return res.status(200).json(data);
  } catch (error) {
    // Trả về mảng rỗng nếu có lỗi để Frontend không bị treo
    return res.status(200).json([]);
  }
}