// File: api/proxy.js
export default async function handler(req, res) {
  // Chỉ cho phép phương thức POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const targetUrl = 'https://online.nks.vn/api/nks/rsitems';

    // Gọi API của NKS
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body || {})
    });

    // Nếu NKS trả về lỗi (ví dụ 500 hoặc 404), bắt nó lại
    if (!response.ok) {
        throw new Error(`API NKS trả về lỗi: ${response.status}`);
    }

    const data = await response.json();

    // Trả dữ liệu về cho Frontend
    res.status(200).json(data);

  } catch (error) {
    console.error("Lỗi Proxy:", error);
    // Trả về lỗi rõ ràng để Frontend xử lý
    res.status(500).json({ error: error.message });
  }
}