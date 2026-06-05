// File: api/proxy.js
export default async function handler(req, res) {
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

    // --- Chuẩn hóa cấu trúc về { data: [...] } ---
    let items = [];
    if (Array.isArray(data))            items = data;           // trả thẳng array
    else if (Array.isArray(data.data))  items = data.data;      // { data: [...] }
    else if (Array.isArray(data.items)) items = data.items;     // { items: [...] }
    else if (Array.isArray(data.results)) items = data.results; // { results: [...] }
    else {
      // Log để debug nếu vẫn sai
      console.log('Cấu trúc API lạ:', JSON.stringify(data).slice(0, 200));
    }

    // --- Chuẩn hóa field ảnh ---
    // API NKS có thể dùng nhiều tên field khác nhau cho ảnh
    items = items.map(item => ({
      ...item,
      featuring: item.featuring || item.image || item.thumbnail
               || item.photo   || item.img    || item.avatar
               || item.cover   || item.feature_image || null
    }));

    res.status(200).json({ data: items });
  } catch (error) {
    console.error('Lỗi Proxy:', error);
    res.status(500).json({ error: error.message });
  }
}