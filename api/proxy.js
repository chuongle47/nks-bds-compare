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

    let items = [];
    if (Array.isArray(data))              items = data;
    else if (Array.isArray(data.data))    items = data.data;
    else if (Array.isArray(data.items))   items = data.items;
    else if (Array.isArray(data.results)) items = data.results;

    // Map đúng tên field: featureimg → featuring
    items = items.map(item => ({
      ...item,
      featuring: item.featureimg || null
    }));

    res.status(200).json({ data: items });
  } catch (error) {
    console.error('Lỗi Proxy:', error);
    res.status(500).json({ error: error.message });
  }
}