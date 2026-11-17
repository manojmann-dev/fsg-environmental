const serviceIconBySlug = {
  'vacuum-drainage-maintenance': 'droplets',
  'stormwater-maintenance-inspections': 'hardhat',
  'hydro-excavation-utility-support': 'factory',
  'industrial-cleaning-hydroblasting': 'clipboard',
  'environmental-compliance-ehs-support': 'shield-check',
  '24-7-environmental-support-arrangements': 'leaf',
  'environmental-remediation': 'wrench',
  'civil-drainage-restoration': 'building',
  'demolition-decommissioning': 'scan',
  'environmental-sampling-soil-assessment': 'droplets',
  'spill-response-support': 'shield-check'
};

const iconShapes = {
  droplets: (
    <>
      <path d="M12 21a6.5 6.5 0 0 0 6.5-6.5C18.5 10.8 12 3 12 3s-6.5 7.8-6.5 11.5A6.5 6.5 0 0 0 12 21Z" />
      <path d="M5.2 5.8C3.6 7.8 2.5 9.6 2.5 11a3.7 3.7 0 0 0 3.7 3.7" />
    </>
  ),
  hardhat: (
    <>
      <path d="M3 15.5h18a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-2a1 1 0 0 1 1-1Z" />
      <path d="M5 15.5a7 7 0 0 1 14 0" />
      <path d="M12 8.5v7" />
      <path d="M7.5 10.1 6.3 8.9M16.5 10.1l1.2-1.2" />
    </>
  ),
  factory: (
    <>
      <path d="M3 21V8l6 3.5V8l6 3.5V5h6v16H3Z" />
      <path d="M15 5V3h4v2M7 16h2m3 0h2m3 0h1" />
      <path d="M7 21v-3h3v3" />
    </>
  ),
  clipboard: (
    <>
      <rect x="5" y="4" width="14" height="17" rx="2" />
      <path d="M9 4.5V3h6v1.5" />
      <path d="m8.5 13 2.2 2.2 4.8-5" />
    </>
  ),
  'shield-check': (
    <>
      <path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  leaf: (
    <>
      <path d="M20.5 3.5C12 3.5 5 5.5 5 12a6 6 0 0 0 6 6c6.5 0 8.5-7 9.5-14.5Z" />
      <path d="M3 21c3.5-5.5 7.5-8.5 13-11" />
    </>
  ),
  wrench: (
    <>
      <path d="M14.7 6.3a5 5 0 0 0-6.4 6.4L3 18a2.1 2.1 0 0 0 3 3l5.3-5.3a5 5 0 0 0 6.4-6.4l-3.1 3.1-3.8-3.8 3.9-2.3Z" />
    </>
  ),
  building: (
    <>
      <rect x="4" y="3" width="16" height="18" rx="1.5" />
      <path d="M8 7h2m4 0h2M8 11h2m4 0h2M8 15h2m4 0h2M10 21v-3h4v3" />
    </>
  ),
  scan: (
    <>
      <path d="M7 3H5a2 2 0 0 0-2 2v2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M3 17v2a2 2 0 0 0 2 2h2" />
      <path d="M8 12h8" />
    </>
  )
};

export default function ServiceIcon({ slug, className = '' }) {
  const iconName = serviceIconBySlug[slug] || 'factory';
  return (
    <svg
      className={`service-icon ${className}`.trim()}
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {iconShapes[iconName]}
    </svg>
  );
}
