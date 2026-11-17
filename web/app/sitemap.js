const API=(process.env.NEXT_PUBLIC_API_URL||'http://localhost:5000/api').replace(/\/$/,'');
export default async function sitemap(){
 const base=(process.env.SITE_URL||'http://localhost:3000').replace(/\/$/,'');
 let pages=[]; try{const r=await fetch(`${API}/site-index`,{next:{revalidate:300}});if(r.ok)pages=(await r.json()).pages||[];}catch{}
 const now=new Date();
 const indexed = new Set(pages.map((page) => page.slug));
 const maintenanceFallback = indexed.has('maintenance-programs') ? [] : [{ slug: 'maintenance-programs' }];
 return [{url:base,lastModified:now,changeFrequency:'weekly',priority:1},{url:`${base}/contact`,lastModified:now,changeFrequency:'monthly',priority:.7},...pages.filter(p=>p.slug!=='home').map(p=>({url:`${base}/${p.slug}`,lastModified:p.updatedAt?new Date(p.updatedAt):now,changeFrequency:'monthly',priority:.6})),...maintenanceFallback.map(p=>({url:`${base}/${p.slug}`,lastModified:now,changeFrequency:'monthly',priority:.6}))];
}
