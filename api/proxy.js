// api/proxy.js
export default async function handler(req, res) {
  // Chỉ cho phép phương thức POST nếu API của bạn là POST
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Chỉ chấp nhận phương thức POST' });
  }

  try {
    const targetUrl = 'https://online.nks.vn/api/nks/rsitems';
    
    // Gọi đến API NKS
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Nếu API cần API Key hoặc Header đặc biệt, thêm vào đây
        // 'Authorization': 'Bearer YOUR_KEY' 
      },
      body: JSON.stringify(req.body) // Chuyển tiếp body từ client lên
    });

    const data = await response.json();

    // Trả kết quả về cho Frontend
    res.status(200).json(data);
  } catch (error) {
    console.error('Lỗi Proxy:', error);
    res.status(500).json({ error: 'Không thể kết nối đến API NKS' });
  }
}