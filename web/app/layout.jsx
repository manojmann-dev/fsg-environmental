import './globals.css';
import Header from '../components/Header';
import Footer from '../components/Footer';
import MotionEffects from '../components/MotionEffects';
import { getPublicPage } from '../lib/api';
import { SpeedInsights } from '@vercel/speed-insights/next';

export async function generateMetadata() {
  const page = await getPublicPage('home'); const seo = page?.seo || {};
  return { title: seo.title || 'FSG Environmental | Future Starts Green', description: seo.description || page?.sections?.[0]?.data?.text || 'Environmental maintenance, advisory support and coordinated specialist field services.', alternates: seo.canonical ? { canonical: seo.canonical } : undefined, openGraph: { title: seo.title || 'FSG Environmental', description: seo.description || 'Future Starts Green.', images: seo.ogImage ? [seo.ogImage] : undefined }, robots: seo.noIndex ? { index: false, follow: false } : undefined };
}
export default function RootLayout({ children }) {
 return (
    // Some browser extensions inject attributes on <html> before React hydrates.
    // Suppress only the root-element warning; the application markup remains SSR-rendered.
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <Header />
        <main>{children}</main>
        <Footer />
        <MotionEffects />
        <SpeedInsights />
      </body>
    </html>
  );
}
