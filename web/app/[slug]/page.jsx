import { notFound } from 'next/navigation';
import { getPublicPage } from '../../lib/api';
import { fallbackPages, services } from '../../lib/seed-data';
import { PageSections, ServiceDetail } from '../../components/Sections';

export async function generateMetadata({ params }) {
 const { slug } = await params;
 const pageResult = await getPublicPage(slug);
 const page = pageResult?.__notFound ? null : (pageResult || fallbackPages[slug]);
 const service = services.find(s => s.slug === slug);
 if (pageResult?.__notFound) return { title: 'Page not found | FSG Environmental', robots: { index: false, follow: false } };
 if (!page && service) return { title: `${service.name} | FSG Environmental`, description: service.description };
 if (!page) return { title: 'FSG Environmental | Future Starts Green' };
 return { title: page.seo?.title || `${page.title} | FSG Environmental`, description: page.seo?.description || page.sections?.[0]?.data?.text, alternates: page.seo?.canonical ? { canonical: page.seo.canonical } : undefined, openGraph: { title: page.seo?.title || page.title, description: page.seo?.description || page.sections?.[0]?.data?.text, images: page.seo?.ogImage ? [page.seo.ogImage] : undefined }, robots: page.seo?.noIndex ? { index: false, follow: false } : undefined };
}
export default async function DynamicPage({ params }) {
 const { slug } = await params;
 if (slug === 'contact') notFound();
 const pageResult = await getPublicPage(slug);
 if (pageResult?.__notFound) notFound();
 const page = pageResult || fallbackPages[slug];
 if (page && page.status !== 'draft') return <PageSections sections={page.sections || []} kicker={page.title} pageSlug={slug}/>;
 const service = services.find(s => s.slug === slug);
 if (!pageResult && service) return <ServiceDetail service={service}/>;
 notFound();
}
