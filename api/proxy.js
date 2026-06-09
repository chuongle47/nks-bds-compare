// File: api/proxy.js
export default async function handler(req, res) {
  // ── CORS SETUP ─────────────────────────────────────────────
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // ── PROXY ẢNH (GET) ────────────────────────────────────────
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
        return res.redirect(302, 'https://placehold.co/400x260/e8f4fd/0077bb?text=NKS+BDS');
      }
      const contentType = imgRes.headers.get('content-type') || 'image/jpeg';
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      const arrayBuffer = await imgRes.arrayBuffer();
      return res.send(Buffer.from(arrayBuffer));
    } catch (err) {
      return res.redirect(302, 'https://placehold.co/400x260/e8f4fd/0077bb?text=NKS+BDS');
    }
  }

  // ── LẤY DỮ LIỆU (POST): Gọi sang REST API WordPress ────────────────
  if (req.method === 'POST') {
    try {
      const targetUrl = 'https://nksbds.page.gd/wp-json/nks/v1/properties';

      const response = await fetch(targetUrl, {
        method: 'GET',
        headers: { 
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Vercel Serverless Function)'
        }
      });

      // Đọc dữ liệu dạng Text trước để tránh lỗi sập hệ thống JSON.parse nếu WP trả về mã lỗi HTML
      const responseText = await response.text();

      if (!response.ok) {
        return res.status(500).json({ 
          error: `WordPress báo lỗi HTTP ${response.status}`, 
          debug: responseText.substring(0, 300) 
        });
      }

      // Thử kiểm tra xem nội dung nhận được có phải JSON chuẩn không
      let items;
      try {
        items = JSON.parse(responseText);
      } catch (e) {
        return res.status(500).json({ 
          error: "Dữ liệu trả về từ WordPress không phải là JSON chuẩn!", 
          debug: responseText.substring(0, 500) // Trả về đoạn code lỗi PHP/HTML để Dev đọc được luôn
        });
      }

      if (!Array.isArray(items)) {
        return res.status(200).json([]);
      }

      // Chuẩn hóa cấu trúc ảnh đi qua hệ thống proxy để chống lỗi hiển thị hình ảnh
      const mappedItems = items.map(item => {
        const rawImg = item.featureimg || null;
        return {
          ...item,
          featuring: rawImg,
          imgProxy: rawImg ? `/api/proxy?img=${encodeURIComponent(rawImg)}` : null
        };
      });

      return res.status(200).json(mappedItems);

    } catch (error) {
      return res.status(500).json({ error: 'Mất kết nối máy chủ Proxy: ' + error.message });
    }
  }

  return res.status(405).json({ error: 'Phương thức không được hỗ trợ' });
}