import Link from 'next/link';
import Image from 'next/image';
import { services } from '../lib/seed-data';
import DynamicForm from './DynamicForm';
import ServiceIcon from './ServiceIcon';

function Eyebrow({ children, number }) { return <div className="eyebrow">{number ? `${number}  ` : '—  '}{children}</div>; }
function Section({ children, tone = 'white', className = '', id }) { return <section id={id} className={`content-section tone-${tone} ${className}`}><div className="container">{children}</div></section>; }

function Hero({ data, kicker }) {
 const originalImage = data.image || '/images/services-hero.webp';
 const displayImage = data.image2x || (originalImage.startsWith('/images/') && originalImage.endsWith('.webp') ? originalImage.replace(/\.webp$/, '@2x.webp') : originalImage);
 return <section className="hero"><div className="hero-inner"><div className="hero-copy"><div className="breadcrumbs"><Link href="/">Home</Link> <span>›</span> {kicker || data.eyebrow || 'FSG Environmental'}</div><Eyebrow>{data.eyebrow || 'ENVIRONMENTAL & INFRASTRUCTURE SERVICES'}</Eyebrow><h1>{data.title}</h1><p>{data.text}</p><div className="hero-actions"><Link className="button button-green" href={data.primaryHref || '/contact'}>{data.primaryLabel || 'Request a scope review'} <span>↗</span></Link>{data.secondaryLabel && <Link className="text-link" href={data.secondaryHref || '/services'}>{data.secondaryLabel} →</Link>}</div><div className="hero-progress">01 PLAN　 02 COORDINATE　 03 CLOSE OUT</div></div><div className="hero-media"><Image src={displayImage} alt={data.imageAlt || `${data.eyebrow || 'FSG Environmental'} field service photograph`} fill priority quality={96} sizes="(max-width: 760px) 100vw, 50vw" style={{ objectFit: data.imageFit || 'cover', objectPosition: data.imagePosition || 'center center' }}/><div className="image-caption">{data.imageCaption || 'FIELD SERVICES · ENVIRONMENTAL SUPPORT'}</div></div></div></section>;
}

function AnchorNav({ data }) {
 const links = data.links || [];
 if (!links.length) return null;
 return <nav className="page-anchorbar" aria-label="On this page"><div className="container page-anchorbar-inner"><span className="page-anchorbar-label">ON THIS PAGE</span>{links.map((item, index) => <a key={item.id || item.href || index} href={item.href || `#${item.id}`}><b>{item.number || String(index + 1).padStart(2, '0')}</b> {item.label}</a>)}</div></nav>;
}

function FeatureSplit({ data }) {
 const source = data.image || '/images/industrial-cleaning-hydroblasting-hero.webp';
 const image = data.image2x || (source.startsWith('/images/') && source.endsWith('.webp') ? source.replace(/\.webp$/, '@2x.webp') : source);
 return <Section tone="pale" className="feature-split-section" id={data.anchorId}>
  <div className="feature-split">
   <div className="feature-split-copy"><Eyebrow>{data.eyebrow || 'THE FSG APPROACH'}</Eyebrow><h2>{data.title || 'Need several services at one site?'}</h2><p>{data.text || 'A drainage issue may call for cleaning, inspection and repair. A facility shutdown may need cleaning, remediation and trade support. We can bring the relevant services together and identify the specialist responsibilities.'}</p>{data.buttonLabel && <Link className="button button-green" href={data.buttonHref || '/how-we-work'}>{data.buttonLabel} ↗</Link>}</div>
   <div className="feature-split-media"><Image src={image} alt={data.imageAlt || 'Industrial field equipment prepared for coordinated service work'} fill quality={96} sizes="(max-width: 760px) 100vw, 50vw" style={{ objectFit: 'cover', objectPosition: data.imagePosition || 'center center' }}/></div>
  </div>
 </Section>;
}
function Cards({ data, tone = 'white' }) {
 return <Section tone={tone} id={data.anchorId}><div className="section-heading"><div><Eyebrow>{data.eyebrow || 'THE FSG APPROACH'}</Eyebrow><h2>{data.title}</h2></div>{data.text && <p className="section-intro">{data.text}</p>}</div><div className="info-grid">{(data.cards || []).map((card,i)=><article className="info-card" key={i}><span className="card-number">{String(i+1).padStart(2,'0')}</span><h3>{card.title}</h3><p>{card.text}</p>{card.href && <Link href={card.href}>Explore →</Link>}</article>)}</div></Section>;
}
async function Services({ data }) {
 let source = services;
 try { const API = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api').replace(/\/$/, ''); const response = await fetch(`${API}/service-pages`, { cache: 'no-store' }); if (response.ok) { const result = await response.json(); source = (result.items || []).map(page => ({ slug: page.slug, name: page.navLabel || page.title, description: page.sections?.find(s => s.type === 'hero')?.data?.text || page.title })); } } catch {}
 const selection = data.slugs?.length ? data.slugs.map(slug => source.find(item => item.slug === slug)).filter(Boolean) : source.slice(0, Number(data.limit || 12));
 return <Section id={data.anchorId} tone="pale"><div className="section-heading"><div><Eyebrow>{data.eyebrow || 'SERVICE DIRECTORY'}</Eyebrow><h2>{data.title || 'Explore our services.'}</h2></div>{data.text && <p className="section-intro">{data.text}</p>}</div><div className="service-grid">{selection.map((service,i)=><Link className="service-card" href={`/${service.slug}`} key={service.slug}><div className="service-card-top"><ServiceIcon slug={service.slug} /><span className="service-card-arrow" aria-hidden="true">↗</span></div><h3>{service.name}</h3><p>{service.description}</p><span className="service-explore">Explore →</span></Link>)}</div></Section>;
}
function Steps({ data }) {
 return <Section tone="pale"><div className="section-heading"><div><Eyebrow>{data.eyebrow || 'PLAN THE WORK'}</Eyebrow><h2>{data.title}</h2></div>{data.text && <p className="section-intro">{data.text}</p>}</div><div className="steps-grid">{(data.items || []).map((item,i)=><div className="step-card" key={i}><span>{String(i+1).padStart(2,'0')}</span><h3>{item.title}</h3><p>{item.text}</p></div>)}</div></Section>;
}
function Cta({ data }) { return <section className="cta-band"><div className="container cta-inner"><div><Eyebrow>{data.eyebrow || 'THE NEXT STEP'}</Eyebrow><h2>{data.title}</h2><p>{data.text}</p></div><Link className="button button-dark" href={data.buttonHref || '/contact'}>{data.buttonLabel || 'Request a scope review'} ↗</Link></div></section>; }
function RichText({ data }) { return <Section tone={data.tone === 'pale' ? 'pale' : 'white'}><div className="rich-layout"><div><Eyebrow>{data.eyebrow || 'INFORMATION'}</Eyebrow><h2>{data.title}</h2></div><div className="rich-copy"><p>{data.text}</p>{data.items?.map((item,i)=><p key={i}>{item}</p>)}</div></div></Section>; }
function Faq({ data }) { return <Section tone="white"><div className="section-heading"><div><Eyebrow>{data.eyebrow || 'PRACTICAL ANSWERS'}</Eyebrow><h2>{data.title || 'Questions before you start.'}</h2></div></div><div className="faq-list">{(data.items || []).map((item,i)=><details key={i}><summary>{typeof item === 'string' ? item : item.question}</summary>{(typeof item === 'string' || item.answer) && <p>{typeof item === 'string' ? 'Share the details of your site, timing and requirements with our team so we can confirm the appropriate scope.' : item.answer}</p>}</details>)}</div></Section>; }

export function PageSections({ sections = [], kicker, pageSlug = '' }) {
 return <>{sections.filter(s => s.visible !== false).map((section) => {
   const data = section.data || {};
   switch (section.type) {
    case 'hero': return <Hero key={section.id} data={data} kicker={kicker}/>;
    case 'anchorNav': return <AnchorNav key={section.id} data={data}/>;
    case 'featureSplit': return <FeatureSplit key={section.id} data={data}/>;
    case 'cards': return <Cards key={section.id} data={data} tone={data.tone || 'white'}/>;
    case 'services': return <Services key={section.id} data={data}/>;
    case 'steps': return <Steps key={section.id} data={data}/>;
    case 'cta': return <Cta key={section.id} data={data}/>;
    case 'richText': return <RichText key={section.id} data={data}/>;
    case 'faq': return <Faq key={section.id} data={data}/>;
    case 'form': return <Section key={section.id} tone="white"><div className="section-heading"><div><Eyebrow>{data.eyebrow || 'GET IN TOUCH'}</Eyebrow><h2>{data.title || 'Tell us about the work.'}</h2></div><p className="section-intro">{data.text}</p></div><DynamicForm formSlug={data.formSlug || 'project-scope'} pageSlug={pageSlug || 'custom-page'}/></Section>;
    default: return null;
   }
 })}</>;
}

export function ServiceDetail({ service }) {
 return <>
  <Hero data={{ eyebrow: 'ENVIRONMENTAL & INFRASTRUCTURE SERVICES', title: service.title, text: service.lead, image: service.hero, imageAlt: service.imageAlt || `${service.name} field service work and equipment`, imageCaption: service.imageCaption, imagePosition: service.imagePosition || 'center center', primaryLabel: 'Request a scope review', primaryHref: '/contact', secondaryLabel: 'View service scope', secondaryHref: '#scope' }} kicker={service.name}/>
  <AnchorNav data={{ links: [{ id: 'the-need', label: 'The Need' }, { id: 'scope', label: 'Scope of Service' }, { id: 'delivery-records', label: 'Delivery & Records' }, { id: 'plan-the-work', label: 'Plan the Work' }, { id: 'practical-answers', label: 'Practical Answers' }, { id: 'connected-support', label: 'Connected Support' }] }}/><Section tone="white" id="the-need"><div className="section-heading"><div><Eyebrow number="01">THE NEED</Eyebrow><h2>When this service helps.</h2></div></div><div className="info-grid three">{service.needs.map((item,i)=><article className="info-card" key={item}><span className="card-number">0{i+1}</span><h3>{item}</h3><p>{service.needDetails?.[i] || 'Define the site condition, access needs and practical steps before work begins.'}</p></article>)}</div></Section>
  <Section tone="pale" className="scope-section" id="scope"><div className="section-heading"><div><Eyebrow number="02">SCOPE OF SERVICE</Eyebrow><h2>What we can coordinate.</h2></div></div><div className="info-grid two">{service.scope.map((item,i)=><article className="info-card" key={item}><span className="card-number">0{i+1}</span><h3>{item}</h3><p>{service.scopeDetails?.[i] || 'Defined scope, responsibilities and delivery sequence around the operational requirements of your site.'}</p></article>)}</div></Section>
  <Section tone="white" id="delivery-records"><div className="section-heading"><div><Eyebrow number="03">DELIVERY & RECORDS</Eyebrow><h2>Built around your site.</h2></div><p className="section-intro">{service.deliverIntro || 'The service is organized around site access, operating conditions and the agreed deliverables.'}</p></div><div className="check-grid">{service.deliver.map(x=><div key={x}><span>✓</span>{x}</div>)}</div></Section>
  <Section tone="pale" id="plan-the-work"><div className="section-heading"><div><Eyebrow number="04">PLAN THE WORK</Eyebrow><h2>Start with the right information.</h2></div>{service.planIntro && <p className="section-intro">{service.planIntro}</p>}</div><div className="steps-grid four">{['Scope the work','Plan the delivery','Coordinate the site','Close out clearly'].map((t,i)=><div className="step-card" key={t}><span>0{i+1}</span><h3>{t}</h3><p>{service.planDetails?.[i] || 'Review the assets, site conditions, access, timing and expected deliverables.'}</p></div>)}</div></Section>
  <div id="practical-answers"><Faq data={{ eyebrow: '05  PRACTICAL ANSWERS', title: 'Questions before you start.', items: service.faqs.map((q,i)=>({question:q,answer:service.faqAnswers?.[i] || ''})) }}/></div>
  <div id="connected-support"><Services data={{ eyebrow: '06  CONNECTED SUPPORT', title: 'Related services.', limit: 3, slugs: service.relatedSlugs }}/></div>
  <Cta data={{ eyebrow: 'THE NEXT STEP', title: service.ctaTitle || `Plan your ${service.name.toLowerCase()} scope.`, text: service.ctaText || 'Tell us about your site, the work required and your preferred timing. We will confirm the scope and next steps.', buttonLabel: 'Request a scope review', buttonHref: '/contact' }}/>
 </>;
}
