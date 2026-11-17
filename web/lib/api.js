export const API = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api').replace(/\/$/, '');
export async function getPublicPage(slug) {
  try { const res = await fetch(`${API}/pages/${encodeURIComponent(slug)}`, { cache: 'no-store' }); if (res.status === 404) return { __notFound: true }; if (!res.ok) return null; const data = await res.json(); return data.page; }
  catch { return null; }
}
export async function getContactData() {
  try { const res = await fetch(`${API}/contact`, { cache: 'no-store' }); if (!res.ok) return null; return await res.json(); }
  catch { return null; }
}
