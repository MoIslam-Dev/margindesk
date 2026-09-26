/**
 * Demo data for MarginDesk.
 *
 * Loaded automatically the first time the app runs so the dashboard, reports and
 * project pages are never empty. Everything here is fictional: the studio, the
 * clients and the numbers.
 *
 * Dates are generated relative to today, so the demo always looks current.
 */
(function (root, factory) {
  const calc = root.MarginDeskCalc || (typeof require === 'function' ? require('./calc.js') : null);
  const api = factory(calc);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MarginDeskSeed = api;
})(typeof self !== 'undefined' ? self : this, function (calc) {
  'use strict';

  /** Local calendar dates, so the demo reads correctly in every timezone. */
  function isoDaysAgo(days) {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return calc.isoDate(date);
  }

  function isoDaysAhead(days) {
    return isoDaysAgo(-days);
  }

  function timestampDaysAgo(days) {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date.toISOString();
  }

  let lineCounter = 0;
  function line(description, detail, hours, rate, complexity, rushPercent, cost) {
    lineCounter += 1;
    return {
      id: `li_seed_${lineCounter}`,
      description,
      detail,
      hours,
      rate,
      complexity,
      rushPercent,
      cost,
    };
  }

  function buildState() {
    const year = new Date().getFullYear();
    const settings = Object.assign({}, calc.DEFAULT_SETTINGS, {
      businessName: 'Fieldnote Studio',
      ownerName: 'Maya Aldridge',
      email: 'hello@fieldnotestudio.com',
      phone: '+1 (503) 555-0142',
      address: '418 NW Couch Street, Suite 210\nPortland, OR 97209',
      website: 'fieldnotestudio.com',
      quotePrefix: 'FN',
      currency: 'USD',
      taxRate: 0,
      taxLabel: 'Tax',
      defaultHourlyRate: 120,
      defaultCostRate: 42,
      defaultRushPercent: 0,
      quoteValidityDays: 30,
      paymentTerms: '50% on signature, 50% on delivery. Quotes valid for 30 days.',
      bankDetails: 'Fieldnote Studio LLC · Rivermark Bank · •••• 4471',
      targetMarginPercent: 55,
      accentColor: '#2f6f4f',
    });

    const clients = [
      {
        id: 'c_harbor',
        name: 'Dana Whitfield',
        company: 'Harbor Coffee Roasters',
        email: 'dana@harborroasters.example',
        phone: '+1 (207) 555-0118',
        address: '14 Wharf Street\nPortland, ME 04101',
        taxId: '',
        notes: 'Speciality roaster, 3rd location opening. Prefers Tuesday calls.',
        createdAt: timestampDaysAgo(210),
      },
      {
        id: 'c_lumen',
        name: 'Marcus Feld',
        company: 'Lumen Fitness',
        email: 'marcus@lumenfitness.example',
        phone: '+1 (312) 555-0164',
        address: '2200 N Milwaukee Ave\nChicago, IL 60647',
        taxId: '',
        notes: 'Boutique gym, 3 locations. Booking engine is the priority.',
        createdAt: timestampDaysAgo(120),
      },
      {
        id: 'c_bricklane',
        name: 'Priya Raman',
        company: 'Brick Lane Bakery',
        email: 'priya@bricklanebakery.example',
        phone: '+1 (617) 555-0193',
        address: '77 Bread Street\nBoston, MA 02110',
        taxId: '',
        notes: 'Wholesale bakery. Packaging refresh for 14 SKUs.',
        createdAt: timestampDaysAgo(75),
      },
      {
        id: 'c_tidewater',
        name: 'Dr. Alina Reyes',
        company: 'Tidewater Dental Group',
        email: 'ar@tidewaterdental.example',
        phone: '+1 (757) 555-0127',
        address: '900 Tidewater Boulevard\nVirginia Beach, VA 23451',
        taxId: '',
        notes: 'Four-chair practice. Needs a calm, clinical tone — no hard sell.',
        createdAt: timestampDaysAgo(40),
      },
      {
        id: 'c_verdant',
        name: 'Tom Berger',
        company: 'Verdant Home Goods',
        email: 'tom@verdanthome.example',
        phone: '+1 (503) 555-0175',
        address: '1120 SE Division Street\nPortland, OR 97202',
        taxId: '',
        notes: 'E-commerce homeware. Small budget, fast decisions.',
        createdAt: timestampDaysAgo(18),
      },
    ];

    const quotes = [
      {
        id: 'q_brand_harbor',
        number: `${settings.quotePrefix}-${year - 1}-014`,
        clientId: 'c_harbor',
        title: 'Brand identity refresh',
        status: 'accepted',
        issueDate: isoDaysAgo(195),
        validUntil: isoDaysAgo(165),
        acceptedAt: timestampDaysAgo(188),
        lineItems: [
          line('Brand strategy workshop', 'Two half-day sessions with the leadership team', 16, 120, 1.25, 0, 520),
          line('Logo and mark system', 'Primary mark, wordmark, monogram, clear-space rules', 22, 120, 1, 0, 640),
          line('Colour, type and layout system', 'Two directions developed, one refined to delivery', 26, 120, 1.25, 0, 780),
          line('Brand guidelines document', '48-page PDF plus a one-page cheat sheet for the team', 14, 120, 1, 0, 300),
          line('Launch assets', 'Packaging dielines, signage artwork, social templates', 18, 120, 1.5, 15, 690),
        ],
        discount: { type: 'percent', value: 5 },
        taxRate: 0,
        notes:
          'Thank you for the opportunity. Work starts as soon as the deposit clears — we will hold the first two workshop dates in your name for 14 days.',
        projectId: 'p_harbor_brand',
        createdAt: timestampDaysAgo(195),
        updatedAt: timestampDaysAgo(188),
      },
      {
        id: 'q_site_lumen',
        number: `${settings.quotePrefix}-${year}-002`,
        clientId: 'c_lumen',
        title: 'Membership site & class booking',
        status: 'accepted',
        issueDate: isoDaysAgo(38),
        validUntil: isoDaysAgo(8),
        acceptedAt: timestampDaysAgo(31),
        lineItems: [
          line('Discovery and booking-flow mapping', 'Member journeys, class types, cancellation rules', 10, 120, 1.25, 0, 340),
          line('UX and page design', '11 page designs, desktop and mobile', 34, 120, 1, 0, 1180),
          line('Front-end build', 'Responsive build with the booking widget embedded', 46, 120, 1.5, 0, 1740),
          line('Content migration', '48 existing class pages moved and re-structured', 12, 120, 1.25, 0, 420),
          line('Launch and handover', 'Analytics, staff training session, 30-day support', 8, 120, 1, 0, 260),
        ],
        discount: { type: 'fixed', value: 500 },
        taxRate: 0,
        notes: 'Includes two rounds of revisions per page and a recorded handover session for your marketing lead.',
        projectId: 'p_lumen_site',
        createdAt: timestampDaysAgo(38),
        updatedAt: timestampDaysAgo(31),
      },
      {
        id: 'q_pack_bricklane',
        number: `${settings.quotePrefix}-${year}-003`,
        clientId: 'c_bricklane',
        title: 'Packaging design system — 14 SKUs',
        status: 'sent',
        issueDate: isoDaysAgo(9),
        validUntil: isoDaysAgo(-2),
        lineItems: [
          line('Range architecture', 'Grouping 14 products into 4 shelf families', 8, 120, 1.25, 0, 260),
          line('Master template design', 'One flexible layout that scales across the range', 18, 120, 1.5, 0, 620),
          line('14 SKU adaptations', 'Photography, ingredient panels, allergen copy', 34, 120, 1, 0, 1080),
          line('Print-ready artwork and press check', 'Pre-flight, 3mm bleed, foil and emboss separations', 12, 120, 1.25, 0, 440),
        ],
        discount: { type: 'percent', value: 0 },
        taxRate: 0,
        notes: 'Quote assumes your photographer delivers final images. Physical press check billed at cost.',
        projectId: null,
        createdAt: timestampDaysAgo(9),
        updatedAt: timestampDaysAgo(9),
      },
      {
        id: 'q_site_tidewater',
        number: `${settings.quotePrefix}-${year}-004`,
        clientId: 'c_tidewater',
        title: 'Patient website rebuild',
        status: 'sent',
        issueDate: isoDaysAgo(24),
        validUntil: isoDaysAgo(6),
        lineItems: [
          line('Patient-journey review', 'Call recordings and front-desk notes reviewed', 6, 120, 1, 0, 180),
          line('Information architecture', 'Service, team, insurance and FAQ structure', 10, 120, 1.25, 0, 300),
          line('Page design', '9 pages, calm clinical tone, large type', 28, 120, 1, 0, 860),
          line('Build and form integration', 'Responsive build, appointment request form', 32, 120, 1.25, 0, 1050),
          line('HIPAA-aware hosting setup', 'Encrypted form handling and staff training', 8, 120, 1.5, 0, 340),
        ],
        discount: { type: 'percent', value: 3 },
        taxRate: 0,
        notes: 'Appointment requests go straight to your practice manager by email. No patient data is stored on the site.',
        projectId: null,
        createdAt: timestampDaysAgo(24),
        updatedAt: timestampDaysAgo(24),
      },
      {
        id: 'q_campaign_verdant',
        number: `${settings.quotePrefix}-${year}-005`,
        clientId: 'c_verdant',
        title: 'Autumn campaign landing page',
        status: 'draft',
        issueDate: isoDaysAgo(3),
        validUntil: isoDaysAgo(-27),
        lineItems: [
          line('Landing page design', 'Single long-form page, mobile and desktop', 12, 120, 1, 0, 380),
          line('Build and Shopify embed', 'Section build inside the existing theme', 10, 120, 1.25, 0, 340),
          line('Copy edits and imagery', 'Two rounds of copy edits, image crops', 4, 120, 1, 0, 120),
        ],
        discount: { type: 'percent', value: 0 },
        taxRate: 0,
        notes: 'Draft — send once the product photography is confirmed.',
        projectId: null,
        createdAt: timestampDaysAgo(3),
        updatedAt: timestampDaysAgo(3),
      },
      {
        id: 'q_holiday_verdant',
        number: `${settings.quotePrefix}-${year}-006`,
        clientId: 'c_verdant',
        title: 'Holiday collection product shoot',
        status: 'accepted',
        issueDate: isoDaysAgo(21),
        validUntil: isoDaysAgo(9),
        acceptedAt: timestampDaysAgo(12),
        lineItems: [
          line('Shot list and styling plan', 'Twelve products, two sets, seasonal props', 5, 120, 1, 0, 60),
          line('Studio day', 'Photographer, assistant, lighting and the day itself', 11, 120, 1.25, 15, 1180),
          line('Retouching and delivery', '40 final images plus four lifestyle crops per SKU', 9, 120, 1, 0, 260),
        ],
        discount: { type: 'percent', value: 5 },
        taxRate: 0,
        notes: 'Booked for the first week of October so the images are live before the collection goes up.',
        projectId: null,
        createdAt: timestampDaysAgo(21),
        updatedAt: timestampDaysAgo(12),
      },
      {
        id: 'q_photo_bricklane',
        number: `${settings.quotePrefix}-${year}-001`,
        clientId: 'c_bricklane',
        title: 'Photography day rate',
        status: 'accepted',
        issueDate: isoDaysAgo(64),
        validUntil: isoDaysAgo(34),
        acceptedAt: timestampDaysAgo(60),
        lineItems: [
          line('Photography day rate', 'Shoot, art direction and 120 selects', 10, 120, 1, 0, 900),
          line('Retouching', '60 final images, colour matched to your brand', 8, 120, 1, 0, 320),
        ],
        discount: { type: 'percent', value: 0 },
        taxRate: 0,
        notes: 'Delivered via shared album with 12-month archive.',
        projectId: 'p_bricklane_photo',
        createdAt: timestampDaysAgo(64),
        updatedAt: timestampDaysAgo(60),
      },
      {
        id: 'q_signage_harbor',
        number: `${settings.quotePrefix}-${year - 1}-016`,
        clientId: 'c_harbor',
        title: 'Retail signage kit',
        status: 'declined',
        issueDate: isoDaysAgo(150),
        validUntil: isoDaysAgo(120),
        lineItems: [
          line('Signage system design', 'Menu board, window vinyl, A-board', 20, 120, 1.25, 0, 700),
          line('Production-ready artwork', 'Vendor-ready files for three fabricators', 10, 120, 1, 0, 260),
        ],
        discount: { type: 'percent', value: 0 },
        taxRate: 0,
        notes: 'Client deferred to the following fiscal year.',
        projectId: null,
        createdAt: timestampDaysAgo(150),
        updatedAt: timestampDaysAgo(142),
      },
    ];

    const projects = [
      {
        id: 'p_harbor_brand',
        name: 'Brand identity refresh',
        clientId: 'c_harbor',
        quoteId: 'q_brand_harbor',
        status: 'completed',
        startDate: isoDaysAgo(185),
        dueDate: isoDaysAgo(120),
        budgetHours: 96,
        hourlyRate: 120,
        costRate: 42,
        notes: 'Delivered two weeks early. The launch assets ran over — factor 1.5 next time.',
        timeEntries: [
          { id: 't_h1', date: isoDaysAgo(183), hours: 6.5, note: 'Strategy workshop, day one', billable: true },
          { id: 't_h2', date: isoDaysAgo(180), hours: 5, note: 'Strategy synthesis and moodboards', billable: true },
          { id: 't_h3', date: isoDaysAgo(172), hours: 7, note: 'Logo sketches, round one', billable: true },
          { id: 't_h4', date: isoDaysAgo(168), hours: 4.5, note: 'Client review and refinement', billable: true },
          { id: 't_h5', date: isoDaysAgo(160), hours: 9, note: 'Identity system build', billable: true },
          { id: 't_h6', date: isoDaysAgo(150), hours: 6, note: 'Guidelines document', billable: true },
          { id: 't_h7', date: isoDaysAgo(144), hours: 2, note: 'Internal concept review', billable: false },
          { id: 't_h8', date: isoDaysAgo(138), hours: 8.5, note: 'Packaging artwork', billable: true },
          { id: 't_h9', date: isoDaysAgo(131), hours: 11, note: 'Launch assets and templates', billable: true },
          { id: 't_h10', date: isoDaysAgo(126), hours: 3, note: 'Handover call and training', billable: true },
        ],
        costs: [
          { id: 'cs_h1', date: isoDaysAgo(170), label: 'Stock photography licence', amount: 240 },
          { id: 'cs_h2', date: isoDaysAgo(140), label: 'Print supplier sample run', amount: 385 },
        ],
        createdAt: timestampDaysAgo(185),
        updatedAt: timestampDaysAgo(120),
      },
      {
        id: 'p_lumen_site',
        name: 'Membership site & class booking',
        clientId: 'c_lumen',
        quoteId: 'q_site_lumen',
        status: 'active',
        startDate: isoDaysAgo(28),
        dueDate: isoDaysAgo(-6),
        budgetHours: 110,
        hourlyRate: 120,
        costRate: 42,
        notes: 'Booking widget API was slower than documented — added a buffer.',
        timeEntries: [
          { id: 't_l1', date: isoDaysAgo(27), hours: 7, note: 'Kickoff and journey mapping', billable: true },
          { id: 't_l2', date: isoDaysAgo(22), hours: 6.5, note: 'Wireframes', billable: true },
          { id: 't_l3', date: isoDaysAgo(18), hours: 9, note: 'Home and membership pages', billable: true },
          { id: 't_l4', date: isoDaysAgo(14), hours: 8, note: 'Class schedule pages', billable: true },
          { id: 't_l5', date: isoDaysAgo(11), hours: 7.5, note: 'Trainer profiles and internal review', billable: true },
          { id: 't_l6', date: isoDaysAgo(8), hours: 12, note: 'Front-end build, schedule and filters', billable: true },
          { id: 't_l7', date: isoDaysAgo(5), hours: 10, note: 'Booking widget integration', billable: true },
          { id: 't_l8', date: isoDaysAgo(4), hours: 4, note: 'Debugging with the vendor API', billable: true },
          { id: 't_l9', date: isoDaysAgo(2), hours: 5, note: 'Content migration', billable: true },
        ],
        costs: [{ id: 'cs_l1', date: isoDaysAgo(8), label: 'Staging hosting, 2 months', amount: 60 }],
        createdAt: timestampDaysAgo(28),
        updatedAt: timestampDaysAgo(2),
      },
      {
        id: 'p_bricklane_photo',
        name: 'Photography day rate',
        clientId: 'c_bricklane',
        quoteId: 'q_photo_bricklane',
        status: 'completed',
        startDate: isoDaysAgo(58),
        dueDate: isoDaysAgo(50),
        budgetHours: 18,
        hourlyRate: 120,
        costRate: 42,
        notes: 'Assistant photographer on the day — the biggest cost on this project.',
        timeEntries: [
          { id: 't_b1', date: isoDaysAgo(58), hours: 9, note: 'Shoot day', billable: true },
          { id: 't_b2', date: isoDaysAgo(55), hours: 6, note: 'Retouching batch one', billable: true },
          { id: 't_b3', date: isoDaysAgo(52), hours: 5, note: 'Retouching batch two and delivery', billable: true },
        ],
        costs: [{ id: 'cs_b1', date: isoDaysAgo(58), label: 'Assistant photographer', amount: 480 }],
        createdAt: timestampDaysAgo(58),
        updatedAt: timestampDaysAgo(50),
      },
      {
        id: 'p_harbor_podcast',
        name: 'Origin stories podcast series',
        clientId: 'c_harbor',
        quoteId: null,
        status: 'onHold',
        startDate: isoDaysAgo(45),
        dueDate: isoDaysAgo(-15),
        budgetHours: 24,
        hourlyRate: 120,
        costRate: 42,
        notes: 'On hold at the client’s request until the new roaster opens.',
        timeEntries: [{ id: 't_p1', date: isoDaysAgo(44), hours: 3, note: 'Pitch and outline', billable: true }],
        costs: [],
        createdAt: timestampDaysAgo(45),
        updatedAt: timestampDaysAgo(40),
      },
    ];

    return {
      version: 1,
      settings,
      clients,
      quotes,
      projects,
      seeded: true,
    };
  }

  return { buildState };
});
