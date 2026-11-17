import { notFound } from 'next/navigation';
import { getPublicPage } from '../lib/api';
import { fallbackPages } from '../lib/seed-data';
import { PageSections } from '../components/Sections';
export default async function HomePage() {
 const result = await getPublicPage('home');
 if (result?.__notFound) notFound();
 const page = result || fallbackPages.home;
 return <PageSections sections={page.sections || []} kicker="Home" pageSlug="home"/>;
}
