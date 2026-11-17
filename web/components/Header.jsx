import Link from 'next/link';

const coreLinks = [
  ['Services', '/services'],
  ['Maintenance Programs', '/maintenance-programs'],
  ['Industries', '/industries'],
  ['About', '/about'],
  ['How We Work', '/how-we-work']
];
const API = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api').replace(/\/$/, '');

export default async function Header() {
  let navLinks = coreLinks;
  try {
    const response = await fetch(`${API}/navigation`, { cache: 'no-store' });
    if (response.ok) {
      const result = await response.json();
      const pages = Array.isArray(result.pages) ? result.pages : [];
      navLinks = pages.filter((page) => page?.slug && page.slug !== 'home')
        .map((page) => [page.navLabel || page.title || page.slug, `/${page.slug}`]);
    }
  } catch {}

  return <>
    <div className="utility-bar"><div className="container utility-inner"><span>ENVIRONMENTAL &amp; INFRASTRUCTURE SERVICES</span><span>Explore 24/7 support arrangements ↗</span></div></div>
    <header className="site-header"><div className="container header-inner">
      <Link className="brand" href="/" aria-label="FSG Environmental home"><span className="brand-mark">FSG</span><span className="brand-copy"><b>ENVIRONMENTAL</b><small>FUTURE STARTS GREEN</small></span></Link>
      <nav className="main-nav" aria-label="Main navigation">{navLinks.map(([label, href]) => <Link href={href} key={href}>{label}</Link>)}</nav>
      <Link href="/contact" className="button button-green header-cta">Request a scope review <span>↗</span></Link>
    </div></header>
  </>;
}
