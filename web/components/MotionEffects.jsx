'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Client-only scroll and entrance motion. The page remains fully visible when
 * JavaScript is unavailable and reduced-motion preferences are always honoured.
 */
export default function MotionEffects() {
  const pathname = usePathname();

  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined;

    let cancelled = false;
    let context;
    let plugin;

    async function initialise() {
      try {
        const [gsapModule, scrollModule] = await Promise.all([
          import('gsap'),
          import('gsap/ScrollTrigger')
        ]);
        if (cancelled) return;

        const gsap = gsapModule.gsap || gsapModule.default;
        plugin = scrollModule.ScrollTrigger || scrollModule.default;
        if (!gsap || !plugin) return;
        gsap.registerPlugin(plugin);

        context = gsap.context(() => {
          const heroItems = gsap.utils.toArray(
            '.hero-copy .breadcrumbs, .hero-copy .eyebrow, .hero-copy h1, .hero-copy > p, .hero-copy .hero-actions, .hero-copy .hero-progress'
          );
          if (heroItems.length) {
            gsap.fromTo(heroItems,
              { autoAlpha: 0, y: 18 },
              { autoAlpha: 1, y: 0, duration: 0.68, stagger: 0.075, ease: 'power2.out', clearProps: 'all' }
            );
          }

          const heroMedia = document.querySelector('.hero-media');
          if (heroMedia) {
            gsap.fromTo(heroMedia,
              { autoAlpha: 0, x: 18 },
              { autoAlpha: 1, x: 0, duration: 0.85, delay: 0.12, ease: 'power2.out', clearProps: 'all' }
            );
          }

          gsap.utils.toArray('.content-section, .cta-band, .trusted').forEach((element) => {
            gsap.fromTo(element,
              { autoAlpha: 0, y: 20 },
              {
                autoAlpha: 1,
                y: 0,
                duration: 0.72,
                ease: 'power2.out',
                clearProps: 'all',
                scrollTrigger: { trigger: element, start: 'top 88%', once: true }
              }
            );
          });

          gsap.utils.toArray('.info-card, .service-card, .step-card, .branch-card').forEach((element) => {
            gsap.fromTo(element,
              { autoAlpha: 0, y: 14 },
              {
                autoAlpha: 1,
                y: 0,
                duration: 0.48,
                ease: 'power2.out',
                clearProps: 'all',
                scrollTrigger: { trigger: element, start: 'top 94%', once: true }
              }
            );
          });

          plugin.refresh();
        });
      } catch (error) {
        // Animation must never prevent the public page from rendering.
        console.warn('[FSG motion] Animations unavailable:', error?.message || error);
      }
    }

    initialise();
    return () => {
      cancelled = true;
      context?.revert();
      if (plugin) plugin.refresh?.();
    };
  }, [pathname]);

  return null;
}
