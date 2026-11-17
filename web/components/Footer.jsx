import Link from 'next/link';
import Image from 'next/image';
import { services as fallbackServices } from '../lib/seed-data';

const coreLinks = [
  ['Services', '/services'],
  ['Maintenance Programs', '/maintenance-programs'],
  ['Industries', '/industries'],
  ['About', '/about'],
  ['How We Work', '/how-we-work'],
  ['Contact', '/contact']
];
const API = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api').replace(/\/$/, '');

export default async function Footer() {
  let services = fallbackServices;
  let navLinks = coreLinks;
  try {
    const [serviceResponse, navResponse] = await Promise.all([
      fetch(`${API}/service-pages`, { cache: 'no-store' }),
      fetch(`${API}/navigation`, { cache: 'no-store' })
    ]);
    if (serviceResponse.ok) {
      const data = await serviceResponse.json();
      services = (data.items || []).map((page) => ({ slug: page.slug, name: page.navLabel || page.title }));
    }
    if (navResponse.ok) {
      const data = await navResponse.json();
      const pages = Array.isArray(data.pages) ? data.pages : [];
      navLinks = pages.filter((page) => page?.slug && page.slug !== 'home')
        .map((page) => [page.navLabel || page.title || page.slug, `/${page.slug}`]);
      if (!navLinks.some(([, href]) => href === '/contact')) navLinks.push(['Contact', '/contact']);
    }
  } catch {}

  return <>
    <section className="trusted"><div className="container"><p className="eyebrow">TRUSTED BY</p><div className="trusted-logos">
      <div className="trusted-logo-box trusted-logo-mosaic"><Image src="/images/partners/mosaic.webp" alt="Mosaic Transit Support" width={250} height={108} sizes="(max-width: 600px) 34vw, 190px"/></div>
      <div className="trusted-logo-box trusted-logo-access"><Image src="/images/partners/access-maintenance.png" alt="Access Maintenance" width={780} height={180} sizes="(max-width: 600px) 42vw, 260px"/></div>
      <div className="trusted-logo-box trusted-logo-jnr"><Image src="/images/partners/jnr-design-build.webp" alt="JNR Design and Build" width={200} height={200} sizes="(max-width: 600px) 22vw, 88px"/></div>
    </div></div></section>
    <footer className="site-footer"><div className="container footer-grid">
      <div><Link className="brand brand-footer" href="/"><span className="brand-mark">FSG</span><span className="brand-copy"><b>ENVIRONMENTAL</b><small>FUTURE STARTS GREEN</small></span></Link><p>Clear scope, coordinated work and documented closeout.</p><Link className="footer-link" href="/contact">Plan your next project ↗</Link></div>
      <div><h4>EXPLORE</h4>{navLinks.map(([label, href]) => <Link href={href} key={href}>{label}</Link>)}</div>
      <div className="footer-services"><h4>SERVICE DIRECTORY</h4><div>{services.map((service) => <Link href={`/${service.slug}`} key={service.slug}>{service.name}</Link>)}</div></div>
    </div><div className="container footer-bottom"><p>Service availability, mobilization timing and delivery model vary by location, hazard class, site access, regulatory requirements and resource availability. Certain regulated work is completed by or coordinated with appropriately licensed or qualified professionals, as applicable to the scope.</p><div><span>© {new Date().getFullYear()} FSG Environmental. Future Starts Green.</span><span>Privacy policy</span><span>Review site · Prepare a project brief</span></div></div></footer>
  </>;
}
