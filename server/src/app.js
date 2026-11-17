import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { rateLimit } from 'express-rate-limit';
import mongoose from 'mongoose';
import publicRoutes from './routes/public.js';
import adminRoutes from './routes/admin.js';
import { connectDatabase } from './config/db.js';
import {
  AdminUser,
  ContactSettings,
  ContentPage,
  EmailTemplate,
  FormDefinition,
  SiteSettings
} from './models/index.js';
import bcrypt from 'bcryptjs';

const app = express();

const allowedOrigins = (process.env.WEB_ORIGIN || 'http://localhost:3000')
  .split(',')
  .map(v => v.trim())
  .filter(Boolean);

app.disable('x-powered-by');

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false
}));

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    const error = new Error('Origin is not permitted by CORS.');
    error.status = 403;
    callback(error);
  },
  credentials: true
}));

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));
app.use(cookieParser());

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'fsg-api' });
});

// Keep this database diagnostic route BEFORE app.use('/api', ensureDatabase).
// It must be reachable even when MongoDB is unavailable, so it can report
// the database failure instead of falling through to the generic API error.

app.get('/api/health/db', async (_req, res) => {
  if (!process.env.MONGODB_URI) {
    return res.status(503).json({
      ok: false,
      service: 'fsg-api',
      database: 'disconnected',
      message: 'MONGODB_URI is not configured. Check the root .env file.'
    });
  }

  try {
    await connectDatabase();

    if (!mongoose.connection.db) {
      throw new Error(
        'MongoDB connection opened without an accessible database handle.'
      );
    }

    await mongoose.connection.db.admin().ping();

    return res.json({
      ok: true,
      service: 'fsg-api',
      database: 'connected',
      databaseName: mongoose.connection.name,
      readyState: mongoose.connection.readyState
    });

  } catch (error) {
    const rawMessage = String(
      error?.message || 'Unknown MongoDB connection error'
    );

    const safeMessage = rawMessage.replace(
      /mongodb(?:\+srv)?:\/\/[^\s]+/gi,
      '[redacted MongoDB URI]'
    );

    console.error('[DB HEALTH] MongoDB connection check failed:', {
      name: error?.name,
      code: error?.code,
      message: safeMessage,
      readyState: mongoose.connection.readyState
    });

    return res.status(503).json({
      ok: false,
      service: 'fsg-api',
      database: 'disconnected',
      readyState: mongoose.connection.readyState,
      message: process.env.NODE_ENV === 'production'
        ? 'MongoDB connection failed. Check the API logs.'
        : safeMessage,
      errorName: error?.name || 'Error',
      errorCode: error?.code || null
    });
  }
});

// Rate limiting
app.use('/api/admin/auth/login', rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 12,
  standardHeaders: 'draft-7',
  legacyHeaders: false
}));

app.use('/api/forms', rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 35,
  standardHeaders: 'draft-7',
  legacyHeaders: false
}));

// Database initialization
let databaseReady;

async function ensureDatabase(req, res, next) {
  try {
    if (!databaseReady) {
      console.log('[DATABASE] Starting initialization...');

      databaseReady = (async () => {
        await connectDatabase();
        console.log('[DATABASE] MongoDB connected.');

        await seedInitialData();
        console.log('[DATABASE] Initial data seeded successfully.');
      })();
    }

    await databaseReady;

    console.log(
      '[DATABASE] Ready for request:',
      req.method,
      req.originalUrl
    );

    next();

  } catch (error) {
    console.error('[DATABASE INITIALIZATION FAILED]');
    console.error(error);

    databaseReady = null;

    next(error);
  }
}

app.use('/api', ensureDatabase);

app.use('/api', publicRoutes);

app.use('/api/admin', (req, res, next) => {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    const origin = req.get('origin');

    if (origin && !allowedOrigins.includes(origin)) {
      return res.status(403).json({
        message: 'This website origin is not allowed to make changes.'
      });
    }
  }

  next();
}, adminRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    message: 'API route not found.'
  });
});

// Global error handler
app.use((error, _req, res, _next) => {
  const duplicate = error?.code === 11000;
  const status = duplicate ? 409 : (error.status || 500);

  const message = duplicate
    ? 'A record with that unique value already exists.'
    : status >= 500
      ? 'A server error occurred. Check the API logs for details.'
      : error.message;

  if (status >= 500) {
    console.error('[API]', error);
  }

  res.status(status).json({ message });
});

// Initial database data
async function seedInitialData() {
  const email = String(process.env.ADMIN_EMAIL || '')
    .trim()
    .toLowerCase();

  const password = process.env.ADMIN_PASSWORD || '';

  if (email && password && password.length < 12) {
    throw new Error(
      'ADMIN_PASSWORD must contain at least 12 characters.'
    );
  }

  // Create initial admin only if it does not already exist.
  if (email && password && !(await AdminUser.exists({ email }))) {
    await AdminUser.create({
      name: 'FSG Administrator',
      email,
      passwordHash: await bcrypt.hash(password, 12),
      role: 'owner'
    });
  }

  // Default site settings
  await SiteSettings.updateOne(
    { key: 'primary' },
    {
      $setOnInsert: {
        key: 'primary',
        companyName: 'FSG Environmental',
        currency: 'GBP',
        taxRate: 20,
        nextQuoteNumber: 1001,
        nextInvoiceNumber: 1001
      }
    },
    { upsert: true }
  );

  // Default contact settings
  await ContactSettings.updateOne(
    { key: 'primary' },
    {
      $setOnInsert: {
        key: 'primary',
        eyebrow: 'Contact',
        title: 'Let’s scope the work.',
        intro: 'Share the service, location and timing you have in mind. A clear first brief helps define the next steps.',
        heroImage: '/images/contact-hero.webp',
        heroButtonLabel: 'Prepare a project brief',
        heroButtonHref: '#request',
        heroSecondaryLabel: 'Review the process',
        heroSecondaryHref: '/how-we-work',
        formEyebrow: '01  REQUEST A SCOPE REVIEW',
        formTitle: 'Prepare your service request.',
        formIntro: 'A clear first brief helps the team understand your requirements and confirm the next steps.',
        branchesEyebrow: '02  OUR LOCATIONS',
        branchesTitle: 'Contact a branch.',
        branchesIntro: 'Contact the location relevant to your site.',
        incidentEyebrow: '03  CONTACT',
        incidentTitle: 'For an active incident.',
        incidentText: 'This website is not an emergency dispatch channel. Use your site emergency procedures and confirmed 24/7 support arrangements.',
        ctaEyebrow: 'THE NEXT STEP',
        ctaTitle: 'Need to understand the scope first?',
        ctaText: 'Explore the service pages for typical work scopes, the information to prepare and the records that can be included.',
        ctaButtonLabel: 'Explore our services',
        ctaButtonHref: '/services',
        defaultFormSlug: 'project-scope'
      }
    },
    { upsert: true }
  );

  // Core pages
  const corePages = [
    {
      slug: 'home',
      title: 'Environmental work. Clearly coordinated.',
      navLabel: 'Home',
      status: 'published',
      showInNavigation: false,
      sortOrder: 0,
      sections: [
        {
          id: 'hero',
          type: 'hero',
          label: 'Hero',
          visible: true,
          data: {
            eyebrow: 'Practical project support',
            title: 'Environmental work. Clearly coordinated.',
            text: 'Maintenance, advisory support and specialist field services for facilities and infrastructure. One coordinated approach, from scope review to documented closeout.',
            image: '/images/home-hero.webp',
            primaryLabel: 'Request a scope review',
            primaryHref: '/contact',
            secondaryLabel: 'Explore our services',
            secondaryHref: '/services'
          }
        },
        {
          id: 'approach',
          type: 'cards',
          label: 'The FSG approach',
          visible: true,
          data: {
            eyebrow: 'THE FSG APPROACH',
            title: 'Clear scope. Coordinated delivery. Useful records.',
            cards: [
              {
                title: 'Clear scope',
                text: 'Understand the work, access requirements and required closeout information.'
              },
              {
                title: 'Coordinated delivery',
                text: 'Bring the right resources together around your site and service needs.'
              },
              {
                title: 'Useful records',
                text: 'Keep service sheets, photographs and closeout documents organized.'
              }
            ]
          }
        },
        {
          id: 'services',
          type: 'services',
          label: 'Service directory',
          visible: true,
          data: {
            eyebrow: 'OUR SERVICES',
            title: 'The right support for the site.',
            text: 'Start with the service and scope that best fit the work.',
            limit: 11
          }
        },
        {
          id: 'cta',
          type: 'cta',
          label: 'Next step',
          visible: true,
          data: {
            eyebrow: 'THE NEXT STEP',
            title: 'Let’s plan the next step.',
            text: 'Tell us about your site, the work required and your preferred timing. We will confirm the scope and next steps.',
            buttonLabel: 'Request a scope review',
            buttonHref: '/contact'
          }
        }
      ]
    },
    {
      slug: 'services',
      title: 'The right service. A clear plan.',
      navLabel: 'Services',
      status: 'published',
      showInNavigation: true,
      sortOrder: 1,
      sections: [
        {
          id: 'hero',
          type: 'hero',
          label: 'Hero',
          visible: true,
          data: {
            eyebrow: 'Services',
            title: 'The right service. A clear plan.',
            text: 'Explore maintenance, advisory and specialist field services. Each engagement starts with the site requirements and a defined scope.',
            image: '/images/services-hero.webp',
            primaryLabel: 'Request a scope review',
            primaryHref: '/contact',
            secondaryLabel: 'Plan recurring maintenance',
            secondaryHref: '/contact'
          }
        },
        {
          id: 'services',
          type: 'services',
          label: 'Service directory',
          visible: true,
          data: {
            eyebrow: 'SERVICE DIRECTORY',
            title: 'Explore our services.',
            text: 'Select a service to see typical scopes, required inputs and closeout information.',
            limit: 20
          }
        },
        {
          id: 'prep',
          type: 'cards',
          label: 'Prepare for conversation',
          visible: true,
          data: {
            eyebrow: 'BEFORE YOU CONTACT US',
            title: 'Prepare for a useful first conversation.',
            cards: [
              {
                title: 'The location',
                text: 'Site address, asset locations and access restrictions.'
              },
              {
                title: 'The issue',
                text: 'Photographs, known conditions, available reports and the work you want completed.'
              },
              {
                title: 'The timing',
                text: 'Preferred work window, operational constraints and relevant deadlines.'
              }
            ]
          }
        }
      ]
    },
    {
      slug: 'maintenance-programs',
      title: 'Keep maintenance planned. Documented. Moving.',
      navLabel: 'Maintenance Programs',
      status: 'published',
      showInNavigation: true,
      sortOrder: 2,
      pageType: 'standard',
      sections: [
        {
          id: 'hero',
          type: 'hero',
          label: 'Hero',
          visible: true,
          data: {
            eyebrow: 'Maintenance Programs',
            title: 'Keep maintenance planned. Documented. Moving.',
            text: 'Build a practical maintenance programme around your assets, operating windows and site requirements. FSG coordinates planned inspections, recurring service visits and clear closeout records.',
            image: '/images/maintenance-programs-hero.webp',
            imageAlt: 'Stormwater asset access chamber prepared for maintenance',
            primaryLabel: 'Discuss a maintenance program',
            primaryHref: '/contact',
            secondaryLabel: 'Explore our services',
            secondaryHref: '/services'
          }
        },
        {
          id: 'program-approach',
          type: 'cards',
          label: 'The program approach',
          visible: true,
          data: {
            eyebrow: 'THE PROGRAM APPROACH',
            title: 'A reliable routine for the work your site needs.',
            text: 'The programme is shaped around your assets, site conditions and operating priorities—not a one-size-fits-all schedule.',
            tone: 'white',
            cards: [
              {
                title: 'Establish the baseline',
                text: 'Review asset locations, condition information, access requirements and current maintenance records.'
              },
              {
                title: 'Plan recurring activity',
                text: 'Agree inspection intervals, service windows, responsibilities and the work sequence.'
              },
              {
                title: 'Coordinate each visit',
                text: 'Align site contacts, specialist resources, safety requirements and operating constraints.'
              },
              {
                title: 'Keep records useful',
                text: 'Capture service outcomes, photographs, observations and follow-up actions in a clear format.'
              }
            ]
          }
        },
        {
          id: 'program-delivery',
          type: 'steps',
          label: 'Program delivery',
          visible: true,
          data: {
            eyebrow: 'HOW THE PROGRAMME RUNS',
            title: 'A clear cycle from review to review.',
            text: 'The programme can be adjusted as asset condition, site operations or priorities change.',
            items: [
              {
                title: 'Review the assets',
                text: 'Confirm locations, condition, access and the maintenance history available.'
              },
              {
                title: 'Agree the schedule',
                text: 'Set the service scope, planned intervals, visit windows and deliverables.'
              },
              {
                title: 'Coordinate the work',
                text: 'Arrange resources, permissions, site access and communication around each visit.'
              },
              {
                title: 'Review and improve',
                text: 'Check records, outstanding items and recommended changes to the next cycle.'
              }
            ]
          }
        },
        {
          id: 'program-services',
          type: 'services',
          label: 'Programme services',
          visible: true,
          data: {
            eyebrow: 'PROGRAMME SERVICES',
            title: 'Connect the programme to the right services.',
            text: 'Combine relevant services into a coordinated maintenance plan for your site.',
            limit: 8
          }
        },
        {
          id: 'program-faq',
          type: 'faq',
          label: 'Practical answers',
          visible: true,
          data: {
            eyebrow: 'PRACTICAL ANSWERS',
            title: 'Questions about maintenance programmes.',
            items: [
              {
                question: 'Can a programme cover more than one service?',
                answer: 'Yes. The scope can bring together suitable inspection, cleaning, maintenance and specialist support activities where they fit the site requirements.'
              },
              {
                question: 'Can service intervals change?',
                answer: 'The schedule can be reviewed when asset condition, operating hours, site priorities or regulatory requirements change.'
              },
              {
                question: 'What records are provided after a visit?',
                answer: 'The agreed closeout can include service records, photographs, observations, completed work and follow-up recommendations.'
              }
            ]
          }
        },
        {
          id: 'program-cta',
          type: 'cta',
          label: 'Next step',
          visible: true,
          data: {
            eyebrow: 'THE NEXT STEP',
            title: 'Plan a maintenance programme around your site.',
            text: 'Tell us about your assets, locations and operating requirements. We will review the information and help define a practical programme.',
            buttonLabel: 'Request a scope review',
            buttonHref: '/contact'
          }
        }
      ]
    },
    {
      slug: 'industries',
      title: 'Site needs change. Our approach stays clear.',
      navLabel: 'Industries',
      status: 'published',
      showInNavigation: true,
      sortOrder: 3,
      sections: [
        {
          id: 'hero',
          type: 'hero',
          label: 'Hero',
          visible: true,
          data: {
            eyebrow: 'Industries',
            title: 'Site needs change. Our approach stays clear.',
            text: 'Service coordination for facility owners, operators and project teams working across demanding operating environments.',
            image: '/images/industries-hero.webp',
            imageAlt: 'Green roof and building infrastructure',
            primaryLabel: 'Request a scope review',
            primaryHref: '/contact',
            secondaryLabel: 'Explore our services',
            secondaryHref: '/services'
          }
        },
        {
          id: 'sectors',
          type: 'cards',
          label: 'Sector focus',
          visible: true,
          data: {
            eyebrow: 'SECTOR FOCUS',
            title: 'Find your operating environment.',
            cards: [
              {
                title: 'Transit & transportation',
                text: 'Drainage assets, maintenance locations and operating yards.'
              },
              {
                title: 'Commercial property portfolios',
                text: 'Catch basins, sumps and recurring facility needs.'
              },
              {
                title: 'Industrial & manufacturing',
                text: 'Tanks, pits, cleaning and shutdown scopes.'
              },
              {
                title: 'Construction & civil',
                text: 'Utility support, soil coordination, drainage and restoration.'
              },
              {
                title: 'Municipal & institutional',
                text: 'Facility grounds and drainage infrastructure.'
              }
            ]
          }
        }
      ]
    },
    {
      slug: 'about',
      title: 'Future Starts Green.',
      navLabel: 'About',
      status: 'published',
      showInNavigation: true,
      sortOrder: 4,
      sections: [
        {
          id: 'hero',
          type: 'hero',
          label: 'Hero',
          visible: true,
          data: {
            eyebrow: 'About FSG',
            title: 'Future Starts Green.',
            text: 'FSG Environmental brings a practical coordination approach to environmental maintenance, safety support and specialist field services.',
            image: '/images/about-hero.webp',
            imageAlt: 'FSG field team coordinating work at a live site',
            primaryLabel: 'Request a scope review',
            primaryHref: '/contact',
            secondaryLabel: 'See how we work',
            secondaryHref: '/how-we-work'
          }
        },
        {
          id: 'principles',
          type: 'cards',
          label: 'Principles',
          visible: true,
          data: {
            eyebrow: 'ABOUT FSG',
            title: 'The principles behind every scope.',
            cards: [
              {
                title: 'Clarity before mobilization',
                text: 'Make the work boundaries, assumptions and responsibilities visible.'
              },
              {
                title: 'Respect for operating sites',
                text: 'Plan around access, people and work already happening on site.'
              },
              {
                title: 'Practical follow-through',
                text: 'Connect findings to the next maintenance or corrective action.'
              }
            ]
          }
        }
      ]
    },
    {
      slug: 'how-we-work',
      title: 'A clear path through the work.',
      navLabel: 'How We Work',
      status: 'published',
      showInNavigation: true,
      sortOrder: 5,
      sections: [
        {
          id: 'hero',
          type: 'hero',
          label: 'Hero',
          visible: true,
          data: {
            eyebrow: 'How we work',
            title: 'A clear path through the work.',
            text: 'Understand what happens from the first scope review to the final records and follow-up recommendations.',
            image: '/images/how-we-work-hero.webp',
            imageAlt: 'FSG field team coordinating work at a live site',
            primaryLabel: 'Request a scope review',
            primaryHref: '/contact',
            secondaryLabel: 'Browse services',
            secondaryHref: '/services'
          }
        },
        {
          id: 'steps',
          type: 'steps',
          label: 'Eight steps',
          visible: true,
          data: {
            eyebrow: 'HOW WE WORK',
            title: 'Eight steps. One coordinated scope.',
            items: [
              {
                title: 'Share the requirement',
                text: 'Tell us the location, issue, timing and known site conditions.'
              },
              {
                title: 'Review scope & access',
                text: 'Confirm assets, work boundaries, operating interfaces and available information.'
              },
              {
                title: 'Identify technical needs',
                text: 'Determine the specialists, investigations, testing or professional inputs required.'
              },
              {
                title: 'Confirm the quotation',
                text: 'Review inclusions, exclusions, assumptions, deliverables and the work window.'
              },
              {
                title: 'Coordinate resources',
                text: 'Align site contacts, access arrangements and the work sequence.'
              },
              {
                title: 'Complete the agreed work',
                text: 'Coordinate execution, communicate progress and approve scope changes.'
              },
              {
                title: 'Close out the records',
                text: 'Provide the agreed photographs, service information and supporting documents.'
              },
              {
                title: 'Plan the follow-up',
                text: 'Review open items and relevant maintenance or corrective-work next steps.'
              }
            ]
          }
        }
      ]
    }
  ];

  const serviceHeroImages = {
    'vacuum-drainage-maintenance': '/images/vacuum-drainage-maintenance-hero.webp',
    'stormwater-maintenance-inspections': '/images/stormwater-maintenance-inspections-hero.webp',
    'hydro-excavation-utility-support': '/images/hydro-excavation-utility-support-hero.webp',
    'industrial-cleaning-hydroblasting': '/images/industrial-cleaning-hydroblasting-hero.webp',
    'environmental-compliance-ehs-support': '/images/environmental-compliance-ehs-support-hero.webp',
    '24-7-environmental-support-arrangements': '/images/24-7-environmental-support-arrangements-hero.webp',
    'environmental-remediation': '/images/environmental-remediation-hero.webp',
    'civil-drainage-restoration': '/images/civil-drainage-restoration-hero.webp',
    'demolition-decommissioning': '/images/demolition-decommissioning-hero.webp',
    'environmental-sampling-soil-assessment': '/images/environmental-sampling-soil-assessment-hero.webp',
    'spill-response-support': '/images/spill-response-support-hero.webp'
  };

  const serviceSeeds = [
    [
      'vacuum-drainage-maintenance',
      'Vacuum & Drainage Maintenance',
      'Clear drainage. Better maintenance records.',
      'Coordinated cleaning, inspection and material removal for the drainage assets that keep facilities operating.',
      ['Recurring blockages', 'Unclear asset condition', 'Scattered service records'],
      ['Catch basins & oil-grit separators', 'Sumps, sewage pits & sanitation', 'Dry vacuum & material removal', 'Drain flushing & CCTV'],
      [
        'How often should drainage assets be cleaned?',
        'Can cleaning and repairs be quoted together?',
        'What happens to removed material?'
      ]
    ],
    [
      'stormwater-maintenance-inspections',
      'Stormwater Maintenance & Inspections',
      'Stormwater assets. Inspected and maintained.',
      'Condition assessment, cleaning coordination and documented maintenance for stormwater assets that protect facilities and infrastructure.',
      ['Unknown asset condition', 'Recurring sediment or blockage', 'Scattered inspection records'],
      ['Pipeline & lateral CCTV', 'Manhole & access-structure assessment', 'Cleaning & material removal', 'Treatment, storage & green infrastructure'],
      [
        'Are the inspections PACP, LACP and MACP certified?',
        'Can cleaning and inspection be completed together?',
        'How often should stormwater assets be inspected?'
      ]
    ],
    [
      'hydro-excavation-utility-support',
      'Hydro Excavation & Utility Support',
      'Expose utilities with a planned approach.',
      'Hydro excavation and utility daylighting coordinated around existing infrastructure, site access and the requirements of your project.',
      ['Congested underground services', 'Limited working space', 'Several parties on site'],
      ['Hydro excavation', 'Utility daylighting', 'Utility-locating coordination', 'Excavation support'],
      [
        'Does daylighting replace utility locates?',
        'Can you work around a live facility?',
        'How is the work priced?'
      ]
    ],
    [
      'industrial-cleaning-hydroblasting',
      'Industrial Cleaning & Hydroblasting',
      'Controlled cleaning. Contained recovery.',
      'Industrial cleaning, contained high-pressure washing and hydroblasting coordinated around work preparation, containment, wastewater recovery and operating requirements.',
      ['Tight shutdown windows', 'Difficult-to-access assets', 'Several maintenance scopes'],
      ['Tank cleaning', 'Confined-space cleaning', 'Contaminated washing & hydroblasting', 'Plumbing & facility support'],
      [
        'What is the difference between pressure washing and hydroblasting?',
        'Who is responsible for confined-space requirements?',
        'Is wastewater handling included?'
      ]
    ],
    [
      'environmental-compliance-ehs-support',
      'Environmental Compliance & EHS Support',
      'Turn requirements into site-ready actions.',
      'Practical support for environmental requirements, permits, inspections, records, waste obligations, contractor readiness and corrective actions.',
      ['Requirements spread across the site', 'Inspection or audit readiness', 'Actions without follow-through'],
      ['Environmental requirements gap review', 'Permits, inspections & records', 'Corrective-action coordination', 'Contractor & project EHS support'],
      [
        'Does FSG guarantee that a site will be compliant?',
        'Does this replace legal or professional advice?',
        'Do you offer one-time and recurring support?'
      ]
    ],
    [
      '24-7-environmental-support-arrangements',
      '24/7 Environmental Support Arrangements',
      'Set up the response path before an incident.',
      'Spill readiness, emergency planning and agreement-based 24/7 escalation and specialist response coordination for active environmental incidents and urgent site conditions.',
      ['An unclear response plan', 'Equipment gaps', 'After-hours uncertainty'],
      ['Pre-arranged 24/7 intake & escalation', 'Readiness reviews & exercises', 'Containment & mitigation', 'Recovery, cleanup & closeout'],
      [
        'Is this website an emergency dispatch channel?',
        'How is 24/7 support activated?',
        'Is emergency availability guaranteed?'
      ]
    ],
    [
      'environmental-remediation',
      'Environmental Remediation',
      'A defined scope for sensitive materials.',
      'Remediation coordination that brings assessment information, specialist work methods and documented closeout together.',
      ['Uncertain material conditions', 'Occupied or operating sites', 'Several specialist interfaces'],
      ['Mould remediation', 'Asbestos remediation', 'Lead & mercury', 'PCB-related work'],
      [
        'Can you quote before a material is identified?',
        'Who performs specialist remediation work?',
        'Is clearance testing included?'
      ]
    ],
    [
      'civil-drainage-restoration',
      'Civil & Drainage Restoration',
      'Repair the cause. Restore the site.',
      'Defined civil and drainage scopes that connect inspection findings with practical repairs, erosion control and site restoration.',
      ['Recurring drainage trouble', 'Erosion or washout damage', 'Incomplete reinstatement'],
      ['Drainage & catch-basin repairs', 'Ditch & sediment work', 'Erosion & washout restoration', 'Fill & final restoration'],
      [
        'Can you diagnose why flooding keeps happening?',
        'Can cleaning and restoration be coordinated together?',
        'Do you provide engineering design?'
      ]
    ],
    [
      'demolition-decommissioning',
      'Demolition & Decommissioning',
      'A coordinated path from shutdown to closeout.',
      'Selective demolition, structural demolition and decommissioning support planned around surveys, isolations and specialist execution.',
      ['Unknown materials or services', 'Adjacent operations', 'Several removal streams'],
      ['Selective interior demolition', 'Structural demolition', 'Facility decommissioning', 'Cleanup & closeout'],
      [
        'Can work happen beside active operations?',
        'Are permits and surveys included?',
        'Can remediation happen before demolition?'
      ]
    ],
    [
      'environmental-sampling-soil-assessment',
      'Environmental Sampling & Soil Assessment',
      'Traceable samples. Clear soil decisions.',
      'Environmental, waste and water sampling plus soil assessment and characterization, coordinated with traceable handling, laboratory support and qualified professional oversight where required.',
      ['A decision needs defensible data', 'Soil must be moved or managed', 'Water or waste needs characterization'],
      ['Soil assessment & site investigation', 'Water & environmental sampling', 'Waste characterization', 'Chain of custody & laboratory coordination'],
      [
        'Who provides regulated technical sign-off?',
        'Can testing determine whether waste can be accepted?',
        'Do sample results represent the entire site?'
      ]
    ],
    [
      'spill-response-support',
      'Spill Response Support',
      'Prepare the response before the spill.',
      'Practical spill readiness, containment planning and specialist response coordination for facilities and project teams.',
      ['Unclear response roles', 'Containment equipment gaps', 'After-hours coordination'],
      ['Response planning', 'Containment coordination', 'Material recovery support', 'Incident closeout records'],
      [
        'Is this an emergency dispatch service?',
        'Can a response plan be prepared in advance?',
        'What information should be ready?'
      ]
    ]
  ];

  // Insert core pages without overwriting existing admin-edited content.
  for (const page of corePages) {
    await ContentPage.updateOne(
      { slug: page.slug },
      { $setOnInsert: page },
      { upsert: true }
    );
  }

  // Idempotent Services-page content migration: add reference sections only when missing.
  // Existing admin-edited section content is preserved.
  const servicesPage = await ContentPage.findOne({ slug: 'services' });

  if (servicesPage) {
    const current = Array.isArray(servicesPage.sections)
      ? [...servicesPage.sections]
      : [];

    const ids = new Set(current.map(item => item.id));
    let servicesPageChanged = false;

    const addAfter = (afterId, section) => {
      if (ids.has(section.id)) return;

      const index = current.findIndex(item => item.id === afterId);

      current.splice(
        index >= 0 ? index + 1 : current.length,
        0,
        section
      );

      ids.add(section.id);
      servicesPageChanged = true;
    };

    addAfter('hero', {
      id: 'services-page-anchors',
      type: 'anchorNav',
      label: 'On this page',
      visible: true,
      data: {
        links: [
          { number: '01', label: 'Service directory', href: '#service-directory' },
          { number: '02', label: 'Need several services at one site?', href: '#multi-service-support' },
          { number: '03', label: 'Prepare for a useful first conversation', href: '#prepare-first-conversation' }
        ]
      }
    });

    const directory = current.find(item => item.id === 'services');

    if (directory) {
      const nextDirectoryData = {
        ...(directory.data || {}),
        anchorId: directory.data?.anchorId || 'service-directory',
        limit: Number(directory.data?.limit || 10) === 10
          ? 11
          : Math.min(Number(directory.data?.limit || 11), 11)
      };

      if (
        JSON.stringify(directory.data || {}) !==
        JSON.stringify(nextDirectoryData)
      ) {
        servicesPageChanged = true;
      }

      directory.data = nextDirectoryData;
    }

    addAfter('services', {
      id: 'multi-service-support',
      type: 'featureSplit',
      label: 'The FSG approach',
      visible: true,
      data: {
        anchorId: 'multi-service-support',
        eyebrow: 'THE FSG APPROACH',
        title: 'Need several services at one site?',
        text: 'A drainage issue may call for cleaning, inspection and repair. A facility shutdown may need cleaning, remediation and trade support. We can bring the relevant services together and identify the specialist responsibilities.',
        image: '/images/multi-service-feature.webp',
        imageAlt: 'Industrial electrical equipment and specialist vacuum cleaning',
        imagePosition: 'center center',
        buttonLabel: 'See how we work',
        buttonHref: '/how-we-work'
      }
    });

    const prep = current.find(item => item.id === 'prep');

    if (prep) {
      const nextPrepData = {
        ...(prep.data || {}),
        anchorId: prep.data?.anchorId || 'prepare-first-conversation'
      };

      if (
        JSON.stringify(prep.data || {}) !==
        JSON.stringify(nextPrepData)
      ) {
        servicesPageChanged = true;
      }

      prep.data = nextPrepData;
    }

    addAfter('prep', {
      id: 'services-next-step',
      type: 'cta',
      label: 'Next step',
      visible: true,
      data: {
        eyebrow: 'THE NEXT STEP',
        title: 'Let’s plan the next step.',
        text: 'Tell us about your site, the work required and your preferred timing. We will confirm the scope and next steps.',
        buttonLabel: 'Request a scope review',
        buttonHref: '/contact'
      }
    });

    if (servicesPageChanged) {
      await ContentPage.updateOne(
        { slug: 'services' },
        { $set: { sections: current } }
      );
    }
  }

  // Create service detail pages without overwriting existing pages.
  for (const [
    slug,
    name,
    title,
    description,
    needs,
    scope,
    faqs
  ] of serviceSeeds) {
    const sections = [
      {
        id: 'hero',
        type: 'hero',
        label: 'Hero',
        visible: true,
        data: {
          eyebrow: 'ENVIRONMENTAL & INFRASTRUCTURE SERVICES',
          title,
          text: description,
          image: serviceHeroImages[slug] || '/images/vacuum-drainage-hero.webp',
          primaryLabel: 'Request a scope review',
          primaryHref: '/contact',
          secondaryLabel: 'View service scope',
          secondaryHref: '#scope'
        }
      },
      {
        id: 'need',
        type: 'cards',
        label: 'When this service helps',
        visible: true,
        data: {
          eyebrow: '01  THE NEED',
          title: 'When this service helps.',
          cards: needs.map(x => ({
            title: x,
            text: 'Define the site condition, access needs and practical next steps before work begins.'
          }))
        }
      },
      {
        id: 'scope',
        type: 'cards',
        label: 'Scope of service',
        visible: true,
        data: {
          eyebrow: '02  SCOPE OF SERVICE',
          title: 'What we can coordinate.',
          tone: 'pale',
          cards: scope.map(x => ({
            title: x,
            text: 'Defined scope, responsibilities and delivery sequence around the operating requirements of your site.'
          }))
        }
      },
      {
        id: 'delivery',
        type: 'richText',
        label: 'Delivery and records',
        visible: true,
        data: {
          eyebrow: '03  DELIVERY & RECORDS',
          title: 'Built around your site.',
          text: 'The service is organized around site access, operating conditions and agreed deliverables.',
          items: [
            'Defined work scope and access requirements',
            'Coordinated site schedule and responsibilities',
            'Photographs, service sheets and closeout records'
          ]
        }
      },
      {
        id: 'plan',
        type: 'steps',
        label: 'Plan the work',
        visible: true,
        data: {
          eyebrow: '04  PLAN THE WORK',
          title: 'Start with the right information.',
          items: [
            {
              title: 'Scope the work',
              text: 'Review the assets, site conditions, access, timing and expected deliverables.'
            },
            {
              title: 'Plan the delivery',
              text: 'Confirm responsibilities, specialist requirements, quotation and work sequence.'
            },
            {
              title: 'Coordinate the site',
              text: 'Align resources and site contacts, communicate progress and review changes.'
            },
            {
              title: 'Close out clearly',
              text: 'Provide agreed records, identify open items and plan relevant follow-up.'
            }
          ]
        }
      },
      {
        id: 'faq',
        type: 'faq',
        label: 'Practical answers',
        visible: true,
        data: {
          eyebrow: '05  PRACTICAL ANSWERS',
          title: 'Questions before you start.',
          items: faqs.map(question => ({
            question,
            answer: 'The exact approach depends on the site, required scope, access conditions and responsibilities. Share the details in a project brief and FSG can confirm the next steps.'
          }))
        }
      },
      {
        id: 'related',
        type: 'services',
        label: 'Related services',
        visible: true,
        data: {
          eyebrow: '06  CONNECTED SUPPORT',
          title: 'Related services.',
          limit: 3
        }
      },
      {
        id: 'cta',
        type: 'cta',
        label: 'Next step',
        visible: true,
        data: {
          eyebrow: 'THE NEXT STEP',
          title: `Plan your ${name.toLowerCase()} scope.`,
          text: 'Tell us about your site, the work required and your preferred timing. We will confirm the scope and next steps.',
          buttonLabel: 'Request a scope review',
          buttonHref: '/contact'
        }
      }
    ];

    await ContentPage.updateOne(
      { slug },
      {
        $setOnInsert: {
          slug,
          title: name,
          navLabel: name,
          status: 'published',
          showInNavigation: false,
          sortOrder: 20,
          pageType: 'service',
          sections
        }
      },
      { upsert: true }
    );
  }

  // Update only known starter-image paths.
  // Admin-selected/custom image URLs are preserved.
  const coreHeroImageMigration = {
    'maintenance-programs': {
      from: '/images/vacuum-drainage-maintenance-hero.webp',
      to: '/images/maintenance-programs-hero.webp'
    },
    'industries': {
      from: '/images/services-hero.webp',
      to: '/images/industries-hero.webp'
    },
    'about': {
      from: '/images/home-hero.webp',
      to: '/images/about-hero.webp'
    },
    'how-we-work': {
      from: '/images/home-hero.webp',
      to: '/images/how-we-work-hero.webp'
    }
  };

  for (const [slug, mapping] of Object.entries(coreHeroImageMigration)) {
    const page = await ContentPage.findOne({ slug });
    const hero = page?.sections?.find(section => section.type === 'hero');

    if (hero?.data?.image === mapping.from) {
      hero.data.image = mapping.to;
      page.markModified('sections');
      await page.save();
    }
  }

  // The 24/7 arrangement and spill-support pages now use separate supplied photographs.
  const supportPage = await ContentPage.findOne({
    slug: '24-7-environmental-support-arrangements'
  });

  const supportHero = supportPage?.sections?.find(
    section => section.type === 'hero'
  );

  if (
    supportHero?.data?.image ===
    '/images/spill-response-support-hero.webp'
  ) {
    supportHero.data.image =
      '/images/24-7-environmental-support-arrangements-hero.webp';

    supportPage.markModified('sections');
    await supportPage.save();
  }

  const servicesPageForImages = await ContentPage.findOne({
    slug: 'services'
  });

  const featureSection = servicesPageForImages?.sections?.find(
    section => section.id === 'multi-service-support'
  );

  if (
    featureSection?.data?.image ===
    '/images/industrial-cleaning-hydroblasting-hero.webp'
  ) {
    featureSection.data.image = '/images/multi-service-feature.webp';
    servicesPageForImages.markModified('sections');
    await servicesPageForImages.save();
  }

  // Default project scope form
  if (!(await FormDefinition.exists({ slug: 'project-scope' }))) {
    await FormDefinition.create({
      name: 'Project scope request',
      slug: 'project-scope',
      description: 'Prepare a useful first project brief.',
      status: 'published',
      pageSlugs: ['contact'],
      layout: {
        columns: 2,
        style: 'reference'
      },
      fields: [
        {
          key: 'name',
          label: 'Your name',
          type: 'text',
          placeholder: 'Full name',
          required: true,
          width: 'half',
          order: 1
        },
        {
          key: 'company',
          label: 'Company',
          type: 'text',
          placeholder: 'Company or organization',
          required: true,
          width: 'half',
          order: 2
        },
        {
          key: 'email',
          label: 'Email',
          type: 'email',
          placeholder: 'name@company.com',
          required: true,
          width: 'half',
          order: 3
        },
        {
          key: 'phone',
          label: 'Phone',
          type: 'tel',
          placeholder: 'Your contact number',
          required: false,
          width: 'half',
          order: 4
        },
        {
          key: 'siteLocation',
          label: 'Site location',
          type: 'text',
          placeholder: 'City and site address',
          required: true,
          width: 'half',
          order: 5
        },
        {
          key: 'preferredTiming',
          label: 'Preferred timing',
          type: 'text',
          placeholder: 'Work window or target date',
          required: false,
          width: 'half',
          order: 6
        },
        {
          key: 'service',
          label: 'Service needed',
          type: 'select',
          options: [
            'Vacuum & Drainage Maintenance',
            'Stormwater Maintenance & Inspections',
            'Hydro Excavation & Utility Support',
            'Industrial Cleaning & Hydroblasting',
            'Environmental Compliance & EHS Support',
            '24/7 Environmental Support Arrangements',
            'Environmental Remediation',
            'Civil & Drainage Restoration',
            'Demolition & Decommissioning',
            'Environmental Sampling & Soil Assessment',
            'Spill Response Support',
            'Not sure yet'
          ],
          required: true,
          width: 'full',
          order: 7
        },
        {
          key: 'scope',
          label: 'Scope and known conditions',
          type: 'textarea',
          placeholder: 'Describe the work, assets, access restrictions and known conditions.',
          required: true,
          width: 'full',
          order: 8
        },
        {
          key: 'documents',
          label: 'Available documents',
          type: 'textarea',
          placeholder: 'List available photographs, drawings or reports. No file upload is needed for this brief.',
          required: false,
          width: 'full',
          order: 9
        }
      ]
    });
  }

  // Default email templates
  const templateDefaults = [
    {
      key: 'project-scope-auto-reply',
      name: 'Website enquiry auto-reply',
      purpose: 'auto-reply',
      trigger: 'form-submit',
      enabled: false,
      to: '{{customer.email}}',
      subject: 'We have received your project brief — {{submission.id}}',
      headerHtml: '<h2 style="margin:0;color:#fff">FSG ENVIRONMENTAL</h2>',
      bodyHtml: '<p>Hello {{customer.name}},</p><p>Thank you for contacting us. We have received your project brief <strong>{{submission.id}}</strong>.</p><p>Our team will review the details and respond using the contact information supplied.</p><p><strong>Service:</strong> {{customer.service}}</p>',
      footerHtml: '<p>Future Starts Green · Thank you for getting in touch.</p>',
      formSlugs: ['project-scope']
    },
    {
      key: 'project-scope-notification',
      name: 'New website enquiry notification',
      purpose: 'admin-notification',
      trigger: 'form-submit',
      enabled: false,
      to: '{{company.notificationEmail}}',
      subject: 'New enquiry {{submission.id}} from {{customer.name}}',
      headerHtml: '<h2 style="margin:0;color:#fff">New project enquiry</h2>',
      bodyHtml: '<p><strong>{{customer.name}}</strong> from {{customer.company}} sent a new project brief.</p><p>Email: {{customer.email}}<br>Phone: {{customer.phone}}<br>Service: {{customer.service}}</p><p>Reference: {{submission.id}}</p>',
      footerHtml: '<p>Sign in to the admin workspace to review and respond.</p>',
      formSlugs: ['project-scope']
    }
  ];

  for (const template of templateDefaults) {
    await EmailTemplate.updateOne(
      { key: template.key },
      { $setOnInsert: template },
      { upsert: true }
    );
  }
}

export { app };