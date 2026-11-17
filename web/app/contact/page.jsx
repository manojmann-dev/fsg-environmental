import ContactContent from '../../components/ContactContent';
import { getContactData } from '../../lib/api';
export async function generateMetadata() {
 const data = await getContactData(); const seo = data?.contact?.seo || {};
 return { title: seo.title || 'Contact FSG Environmental | Project Scope Review', description: seo.description || 'Share your service, site location and timing with FSG Environmental.', alternates: seo.canonical ? { canonical: seo.canonical } : undefined, openGraph: { title: seo.title || 'Contact FSG Environmental', description: seo.description || 'Prepare a project-scope request.', images: seo.ogImage ? [seo.ogImage] : undefined }, robots: seo.noIndex ? { index: false, follow: false } : undefined };
}
export default function ContactPage() { return <ContactContent/>; }
