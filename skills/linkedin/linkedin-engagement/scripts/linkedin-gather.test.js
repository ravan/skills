const assert = require('node:assert/strict');
const test = require('node:test');

const {
  buildPeopleSearchUrl,
  buildFinalReview,
  buildSearchUrl,
  extractProfileIds,
  extractVanitySlug,
  extractActivityCandidates,
  extractActivityRecords,
  gatherMentioningMemberSearch,
  gatherSearch,
  linkedInDateFilter,
  parseArgs,
  resolveRange,
  selectCandidateUrl,
} = require('./linkedin-gather.js');

test('parseArgs supports mentioning-member mode', () => {
  const args = parseArgs([
    '--target', 'Ravan Naidoo',
    '--mentioning-member', 'Ravan Naidoo',
    '--period', 'last 90 days',
  ]);

  assert.equal(args.mentioningMember, 'Ravan Naidoo');
  assert.equal(args.period, 'last 90 days');
});

test('parseArgs supports deterministic final markdown output', () => {
  const args = parseArgs([
    '--target', 'SUSE',
    '--format', 'final-markdown',
    '--review-file', 'review.json',
  ]);

  assert.equal(args.format, 'final-markdown');
  assert.equal(args.reviewFile, 'review.json');
});

test('last 90 days does not force LinkedIn past-week or past-month filter', () => {
  assert.equal(linkedInDateFilter('last 90 days'), '');
});

test('last 3 weeks resolves to a 21 day metadata range and LinkedIn past-month filter', () => {
  const args = parseArgs([
    '--target', 'Andreas Prins',
    '--period', 'last 3 weeks',
    '--today', '2026-05-07',
  ]);

  assert.deepEqual(resolveRange(args), { start: '2026-04-16', end: '2026-05-07' });
  assert.equal(linkedInDateFilter('last 3 weeks'), 'past-month');
});

test('buildSearchUrl uses mentionsMember without keyword false positives', () => {
  const url = new URL(buildSearchUrl({
    term: '',
    mentioningMember: 'ACoAAAD_example',
    period: 'last 90 days',
    sortBy: 'date_posted',
  }));

  assert.equal(url.origin, 'https://www.linkedin.com');
  assert.equal(url.pathname, '/search/results/content/');
  assert.equal(url.searchParams.get('origin'), 'FACETED_SEARCH');
  assert.equal(url.searchParams.get('mentionsMember'), '["ACoAAAD_example"]');
  assert.equal(url.searchParams.get('sortBy'), '["date_posted"]');
  assert.equal(url.searchParams.has('keywords'), false);
  assert.equal(url.searchParams.has('datePosted'), false);
});

test('buildSearchUrl encodes LinkedIn datePosted as an array', () => {
  const url = new URL(buildSearchUrl({
    mentioningMember: 'ACoAAAD_example',
    period: 'last 7 days',
    sortBy: 'date_posted',
  }));

  assert.equal(url.searchParams.get('datePosted'), '["past-week"]');
});

test('buildPeopleSearchUrl points at LinkedIn people search', () => {
  const url = new URL(buildPeopleSearchUrl('Andreas Prins'));

  assert.equal(url.pathname, '/search/results/people/');
  assert.equal(url.searchParams.get('keywords'), 'Andreas Prins');
});

test('extractProfileIds prefers fsd_profile ids and removes known suffixes', () => {
  const ids = extractProfileIds(`
    {"entityUrn":"urn:li:fsd_profile:ACoAAADjq30BFYAdX1wFuXEB-b7Mn9w7WlkOjOE"}
    ACoAAADjq30BFYAdX1wFuXEB-b7Mn9w7WlkOjOETopcard
  `);

  assert.equal(ids[0], 'ACoAAADjq30BFYAdX1wFuXEB-b7Mn9w7WlkOjOE');
  assert.deepEqual(ids, ['ACoAAADjq30BFYAdX1wFuXEB-b7Mn9w7WlkOjOE']);
});

test('extractVanitySlug supports profile URLs and bare slugs', () => {
  assert.equal(extractVanitySlug('https://www.linkedin.com/in/andreasprins/'), 'andreasprins');
  assert.equal(extractVanitySlug('andreasprins'), 'andreasprins');
  assert.equal(extractVanitySlug('Andreas Prins'), '');
});

test('selectCandidateUrl prefers post links over profile links', () => {
  const url = selectCandidateUrl([
    'https://www.linkedin.com/in/haraldmuellerney/',
    'https://www.linkedin.com/feed/update/urn:li:activity:123456789/',
    'https://www.linkedin.com/company/suse/',
  ], 'https://www.linkedin.com/search/results/content/');

  assert.equal(url, 'https://www.linkedin.com/feed/update/urn:li:activity:123456789/');
});

test('extractActivityCandidates prefers readable SSR text around activity records', () => {
  const html = `
    {"$type":"proto.sdui.components.Text","text":"Harald Mueller-Ney"}
    {"text":"Senior Program Manager at SUSE"}
    {"text":"1d"}
    {"text":"Common Criteria EAL4+: Is Your Software Built in a Vetted Factory?"}
    {"text":"Great to see this narrative aligning with the Digital Sovereignty program led by Andreas Prins."}
    {"navigationUrl":"https://www.linkedin.com/feed/update/urn:li:activity:7457432255678963712/"}
    urn:li:activity:7457432255678963712
    {"text":"Like"}
    {"text":"Comment"}
  `;

  const candidates = extractActivityCandidates(
    html,
    'linkedin_http_search_mentions_member',
    'https://www.linkedin.com/search/results/content/',
    ['Andreas Prins'],
    false,
    'Ravan Naidoo',
    ['ACoAAADjq30BFYAdX1wFuXEB-b7Mn9w7WlkOjOE'],
  );

  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].url, 'https://www.linkedin.com/feed/update/urn:li:activity:7457432255678963712/');
  assert.equal(candidates[0].author, 'Harald Mueller-Ney');
  assert.equal(candidates[0].date, '1d');
  assert.match(candidates[0].excerpt, /Digital Sovereignty program led by Andreas Prins/);
  assert.doesNotMatch(candidates[0].excerpt, /proto\.sdui/);
});

test('extractActivityCandidates falls back to activity id date when SSR timestamp is absent', () => {
  const html = `
    {"$type":"proto.sdui.components.Text","text":"Harald Mueller-Ney"}
    {"text":"Common Criteria EAL4+: Is Your Software Built in a Vetted Factory?"}
    {"text":"Great to see this narrative aligning with the Digital Sovereignty program led by Andreas Prins."}
    {"navigationUrl":"https://www.linkedin.com/feed/update/urn:li:activity:7457432255678963712/"}
    urn:li:activity:7457432255678963712
    {"text":"Like"}
    {"text":"Comment"}
  `;

  const candidates = extractActivityCandidates(
    html,
    'linkedin_http_search_mentions_member',
    'https://www.linkedin.com/search/results/content/',
    ['Andreas Prins'],
    false,
    'Ravan Naidoo',
    ['ACoAAADjq30BFYAdX1wFuXEB-b7Mn9w7WlkOjOE'],
  );

  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].date, '2026-05-05');
});

test('gatherSearch hydrates keyword search candidates from activity detail pages', async () => {
  const searchUrl = buildSearchUrl({ term: 'SUSE', period: 'last 7 days' });
  const activityUrl = 'https://www.linkedin.com/feed/update/urn:li:activity:7457032344042938368/';
  const pages = new Map([
    [searchUrl, `
      {"text":"Search query state for SUSE"}
      {"navigationUrl":"${activityUrl}"}
      urn:li:activity:7457032344042938368
    `],
    [activityUrl, `
      {"text":"Jane Example"}
      {"text":"2d"}
      {"text":"SUSE is expanding secure open source infrastructure for regulated industries."}
      urn:li:activity:7457032344042938368
    `],
  ]);

  const records = await gatherSearch({}, {
    target: ['SUSE'],
    includeSuse: false,
    period: 'last 7 days',
    viewerName: 'Ravan Naidoo',
  }, async (url) => ({ html: pages.get(url) || '' }));

  assert.equal(records.candidates.length, 1);
  assert.equal(records.candidates[0].source, searchUrl);
  assert.equal(records.candidates[0].source_type, 'linkedin_http_search');
  assert.match(records.candidates[0].excerpt, /secure open source infrastructure/);
  assert.doesNotMatch(records.candidates[0].excerpt, /Search query state/);
});

test('gatherMentioningMemberSearch carries member mention evidence into detail hydration', async () => {
  const resolved = {
    id: 'ACoAAABnFdkBR6sltc2NCKYNvDYNRUrfixk5XD8',
    source: 'profile',
    url: 'https://www.linkedin.com/in/ffeldmann/',
  };
  const searchUrl = buildSearchUrl({
    mentioningMember: resolved.id,
    period: 'last 7 days',
    sortBy: 'date_posted',
  });
  const activityUrl = 'https://www.linkedin.com/feed/update/urn:li:activity:7457938486814248961/';
  const pages = new Map([
    [searchUrl, `
      {"text":"Nils Brauckmann"}
      {"navigationUrl":"${activityUrl}"}
      urn:li:activity:7457938486814248961
    `],
    [activityUrl, `
      {"text":"Nils Brauckmann"}
      {"text":"1d"}
      {"text":"This discussion highlights why open infrastructure matters for regulated enterprises."}
      urn:li:activity:7457938486814248961
    `],
  ]);

  const records = await gatherMentioningMemberSearch({}, {
    mentioningMember: 'ffeldmann',
    target: ['FrankVeldman'],
    includeSuse: false,
    period: 'last 7 days',
    viewerName: 'Ravan Naidoo',
  }, async (url) => ({ html: pages.get(url) || '' }), async () => resolved);

  assert.equal(records.candidates.length, 1);
  assert.equal(records.skipped_candidates.length, 0);
  assert.equal(records.candidates[0].url, activityUrl);
  assert.deepEqual(records.candidates[0].matches, ['ffeldmann', resolved.id]);
  assert.match(records.candidates[0].excerpt, /open infrastructure matters/);
});

test('gatherSearch applies quality filters after detail hydration, not on noisy search cards', async () => {
  const searchUrl = buildSearchUrl({ term: 'SUSE', period: 'last 7 days' });
  const activityUrl = 'https://www.linkedin.com/feed/update/urn:li:activity:7457659485629640704/';
  const pages = new Map([
    [searchUrl, `
      {"text":"View event: SUSECON 2026: The Highlights Reel"}
      {"text":"18 attendees"}
      {"text":"Gerson Guevara"}
      {"text":"Team Lead, Global Embedded/Integrated Solutions and IHVs Solution Architects @ SUSE"}
      {"navigationUrl":"${activityUrl}"}
      urn:li:activity:7457659485629640704
    `],
    [activityUrl, `
      {"text":"Gerson Guevara"}
      {"text":"1d"}
      {"text":"The goal is to transform the data center from a cost center into an engine of agility."}
      {"text":"SUSE Partner Solutions make storage modernization more actionable."}
      urn:li:activity:7457659485629640704
    `],
  ]);

  const records = await gatherSearch({}, {
    target: ['SUSE'],
    includeSuse: false,
    period: 'last 7 days',
    viewerName: 'Ravan Naidoo',
  }, async (url) => ({ html: pages.get(url) || '' }));

  assert.equal(records.candidates.length, 1);
  assert.equal(records.skipped_candidates.length, 0);
  assert.equal(records.candidates[0].author, 'Gerson Guevara');
  assert.match(records.candidates[0].excerpt, /Partner Solutions/);
});

test('extractActivityRecords rejects LinkedIn job cards as engagement candidates', () => {
  const html = `
    {"text":"View job"}
    {"text":"Czechia Privacy Governance Professional (Full-time or part-time)"}
    {"text":"Job by SUSE"}
    {"text":"Jan Svoboda"}
    {"text":"Group Head of Privacy at SUSE"}
    {"text":"3d"}
    {"navigationUrl":"https://www.linkedin.com/feed/update/urn:li:activity:7457032344042938368/"}
    urn:li:activity:7457032344042938368
  `;

  const records = extractActivityRecords(
    html,
    'linkedin_http_search',
    'https://www.linkedin.com/search/results/content/?keywords=SUSE',
    ['SUSE'],
    false,
    'Ravan Naidoo',
  );

  assert.equal(records.candidates.length, 0);
  assert.equal(records.skipped_candidates.length, 1);
  assert.equal(records.skipped_candidates[0].skip_reason, 'target appears in LinkedIn job/event chrome');
});

test('extractActivityRecords rejects owned company event posts for target keyword scans', () => {
  const html = `
    {"text":"Online"}
    {"text":"SUSECON 2026: The Highlights Reel"}
    {"text":"Tue, May 5, 4:00 PM CEST"}
    {"text":"View event: SUSECON 2026: The Highlights Reel"}
    {"text":"18 attendees"}
    {"text":"190,182 followers"}
    {"text":"SUSE"}
    {"text":"1w"}
    {"text":"What happened at SUSECON 2026 in Prague and what does it mean for your business?"}
    {"navigationUrl":"https://www.linkedin.com/feed/update/urn:li:activity:7456597680014827520/"}
    urn:li:activity:7456597680014827520
  `;

  const records = extractActivityRecords(
    html,
    'linkedin_http_search',
    'https://www.linkedin.com/search/results/content/?keywords=SUSE',
    ['SUSE'],
    false,
    'Ravan Naidoo',
  );

  assert.equal(records.candidates.length, 0);
  assert.equal(records.skipped_candidates.length, 1);
  assert.equal(records.skipped_candidates[0].skip_reason, 'target appears as the posting company, not as a third-party mention');
});

test('extractActivityRecords keeps third-party posts when unrelated event chrome is nearby', () => {
  const html = `
    {"text":"SUSECON 2026: The Highlights Reel"}
    {"text":"18 attendees"}
    ${'x'.repeat(5200)}
    {"text":"Gerson Guevara"}
    {"text":"Team Lead, Global Embedded/Integrated Solutions and IHVs Solution Architects @ SUSE"}
    {"text":"1d"}
    {"text":"The goal is to transform the data center from a cost center into an engine of agility."}
    {"text":"When storage projects connect to platform outcomes, SUSE customers can move faster."}
    {"navigationUrl":"https://www.linkedin.com/feed/update/urn:li:activity:7457659485629640704/"}
    urn:li:activity:7457659485629640704
  `;

  const records = extractActivityRecords(
    html,
    'linkedin_http_search',
    'https://www.linkedin.com/search/results/content/?keywords=SUSE',
    ['SUSE'],
    false,
    'Ravan Naidoo',
  );

  assert.equal(records.candidates.length, 1);
  assert.equal(records.candidates[0].author, 'Gerson Guevara');
  assert.match(records.candidates[0].excerpt, /platform outcomes/);
});

test('buildFinalReview prints LLM-provided engagement decisions and comments', () => {
  const review = buildFinalReview({
    dateRange: { start: '2026-05-01', end: '2026-05-07' },
    targets: ['SUSE'],
    candidates: [{
      source: 'https://www.linkedin.com/search/results/content/?keywords=SUSE',
      source_type: 'linkedin_http_search',
      url: 'https://www.linkedin.com/feed/update/urn:li:activity:1/',
      author: 'Jane Example',
      date: '2d',
      matches: ['SUSE'],
      comment_status: 'not found in parsed comments (1 parsed)',
      excerpt: 'SUSECON 2026 highlighted practical shifts in enterprise open source strategy.',
      evidence: 'Matched LinkedIn SSR HTML fetched over authenticated HTTP.',
    }, {
      source: 'https://www.linkedin.com/search/results/content/?keywords=SUSE',
      source_type: 'linkedin_http_search',
      url: 'https://www.linkedin.com/feed/update/urn:li:activity:2/',
      author: 'Pat Example',
      date: '1d',
      matches: ['SUSE'],
      comment_status: 'viewer found in parsed comments (3 parsed)',
      excerpt: 'Great to see SUSE sharing more context.',
      evidence: 'Matched LinkedIn SSR HTML fetched over authenticated HTTP.',
    }],
    skippedCandidates: [{
      url: 'https://www.linkedin.com/feed/update/urn:li:activity:3/',
      matches: ['SUSE'],
      skip_reason: 'target appears only in author/profile chrome',
    }],
    reviews: [{
      url: 'https://www.linkedin.com/feed/update/urn:li:activity:1/',
      sentiment: 'positive',
      rationale: 'LLM determined the post is positive toward SUSE.',
      proposed_comment: 'This is a specific LLM-authored comment.',
    }, {
      url: 'https://www.linkedin.com/feed/update/urn:li:activity:2/',
      sentiment: 'positive',
      rationale: 'LLM determined the post is positive toward SUSE.',
      proposed_comment: 'Already commented candidate should still be skipped.',
    }],
  });

  assert.match(review, /# LinkedIn Engagement Review \(2026-05-01 to 2026-05-07\)/);
  assert.match(review, /- Action: draft/);
  assert.match(review, /- Sentiment: positive/);
  assert.match(review, /- Rationale: LLM determined the post is positive toward SUSE\./);
  assert.match(review, /- Comment status: No previous comments from you/);
  assert.match(review, /- Proposed comment: This is a specific LLM-authored comment\./);
  assert.match(review, /- Action: skip/);
  assert.match(review, /viewer already found in parsed comments/);
  assert.match(review, /## Skipped Candidates/);
  assert.match(review, /target appears only in author\/profile chrome/);
});

test('buildFinalReview does not infer sentiment when LLM review is missing', () => {
  const review = buildFinalReview({
    dateRange: { start: '2026-05-01', end: '2026-05-07' },
    targets: ['SUSE'],
    candidates: [{
      source: 'https://www.linkedin.com/search/results/content/?keywords=SUSE',
      source_type: 'linkedin_http_search',
      url: 'https://www.linkedin.com/feed/update/urn:li:activity:4/',
      author: 'SUSE',
      date: '1w',
      matches: ['SUSE'],
      comment_status: 'unknown - no parsed comment blocks in fetched HTML',
      excerpt: 'SUSECON 2026: The event may be over, but the strategic shifts in open source infrastructure continue.',
      evidence: 'Matched LinkedIn SSR HTML fetched over authenticated HTTP.',
    }],
    skippedCandidates: [],
    reviews: [],
  });

  assert.match(review, /- Action: manual-review/);
  assert.match(review, /- Sentiment: unreviewed/);
  assert.match(review, /missing LLM review annotation/);
  assert.doesNotMatch(review, /Proposed comment:/);
});

test('buildFinalReview keeps unknown comment status draft-only', () => {
  const review = buildFinalReview({
    dateRange: { start: '2026-05-01', end: '2026-05-07' },
    targets: ['SUSE'],
    candidates: [{
      url: 'https://www.linkedin.com/feed/update/urn:li:activity:5/',
      author: 'Jane Example',
      date: '1d',
      matches: ['SUSE'],
      comment_status: 'unknown - no parsed comment blocks in fetched HTML',
      excerpt: 'SUSE platform discussion.',
    }],
    reviews: [{
      url: 'https://www.linkedin.com/feed/update/urn:li:activity:5/',
      sentiment: 'positive',
      rationale: 'LLM determined the post is positive toward SUSE.',
      proposed_comment: 'Specific draft comment.',
    }],
  });

  assert.match(review, /- Action: manual-review/);
  assert.match(review, /verify comments manually before using the draft/);
  assert.doesNotMatch(review, /before posting/);
});

test('extractActivityCandidates rejects author-only profile chrome for mention searches', () => {
  const html = `
    {"text":"View Andreas Prins’ graphic link"}
    {"text":"Global Head Sovereign Solutions at SUSE"}
    {"text":"Andreas Prins"}
    {"text":"1d"}
    {"text":"1 day ago"}
    {"text":"Visible to anyone on or off LinkedIn"}
    {"text":"View Andreas Prins’ profile"}
    {"text":"Where is the CISO in the sovereignty conversation?"}
    {"text":"In my opinion the discussion needs more security leadership."}
    {"navigationUrl":"https://www.linkedin.com/feed/update/urn:li:activity:7458130421994782721/"}
    urn:li:activity:7458130421994782721
    {"text":"Like"}
    {"text":"Comment"}
  `;

  const candidates = extractActivityCandidates(
    html,
    'linkedin_http_search_mentions_member',
    'https://www.linkedin.com/search/results/content/',
    ['Andreas Prins'],
    false,
    'Ravan Naidoo',
    ['ACoAAADjq30BFYAdX1wFuXEB-b7Mn9w7WlkOjOE'],
  );

  assert.equal(candidates.length, 0);
});

test('extractActivityRecords reports skipped activity URLs with reasons', () => {
  const html = `
    {"text":"View Andreas Prins’ graphic link"}
    {"text":"Global Head Sovereign Solutions at SUSE"}
    {"text":"Andreas Prins"}
    {"text":"1d"}
    {"text":"1 day ago"}
    {"text":"Visible to anyone on or off LinkedIn"}
    {"text":"View Andreas Prins’ profile"}
    {"text":"Where is the CISO in the sovereignty conversation?"}
    {"text":"In my opinion the discussion needs more security leadership."}
    {"navigationUrl":"https://www.linkedin.com/feed/update/urn:li:activity:7458130421994782721/"}
    urn:li:activity:7458130421994782721
  `;

  const records = extractActivityRecords(
    html,
    'linkedin_http_search_mentions_member',
    'https://www.linkedin.com/search/results/content/',
    ['Andreas Prins'],
    false,
    'Ravan Naidoo',
    ['ACoAAADjq30BFYAdX1wFuXEB-b7Mn9w7WlkOjOE'],
  );

  assert.equal(records.candidates.length, 0);
  assert.equal(records.skipped_candidates.length, 1);
  assert.equal(records.skipped_candidates[0].url, 'https://www.linkedin.com/feed/update/urn:li:activity:7458130421994782721/');
  assert.equal(records.skipped_candidates[0].skip_reason, 'target appears only in author/profile chrome');
});

test('extractActivityCandidates checks viewer name only inside parsed comment blocks', () => {
  const html = `
    {"firstName":"Ravan","lastName":"Naidoo","$type":"com.linkedin.voyager.dash.identity.profile.Profile"}
    {"text":"Harald Mueller-Ney"}
    {"text":"Great to see this narrative aligning with the Digital Sovereignty program led by Andreas Prins."}
    {"navigationUrl":"https://www.linkedin.com/feed/update/urn:li:activity:7457432255678963712/"}
    urn:li:activity:7457432255678963712
    {"title":{"textDirection":"USER_LOCALE","text":"Andreas Prins"},"$type":"com.linkedin.voyager.dash.social.Commenter"}
    {"$type":"com.linkedin.voyager.dash.social.Comment","urn":"urn:li:comment:(activity:7457432255678963712,1)","commentary":{"text":"Thanks for sharing this"}}
  `;

  const candidates = extractActivityCandidates(
    html,
    'linkedin_http_url',
    'https://www.linkedin.com/feed/update/urn:li:activity:7457432255678963712/',
    ['Andreas Prins'],
    false,
    'Ravan Naidoo',
  );

  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].comment_status, 'not found in parsed comments (1 parsed)');
});

test('extractActivityCandidates detects viewer comment when split first and last name are in a comment block', () => {
  const html = `
    {"text":"Harald Mueller-Ney"}
    {"text":"Great to see this narrative aligning with the Digital Sovereignty program led by Andreas Prins."}
    {"navigationUrl":"https://www.linkedin.com/feed/update/urn:li:activity:7457432255678963712/"}
    urn:li:activity:7457432255678963712
    {"title":{"textDirection":"USER_LOCALE","text":"Ravan Naidoo"},"firstName":"Ravan","lastName":"Naidoo","$type":"com.linkedin.voyager.dash.social.Commenter"}
    {"$type":"com.linkedin.voyager.dash.social.Comment","urn":"urn:li:comment:(activity:7457432255678963712,1)","commentary":{"text":"Useful framing."}}
  `;

  const candidates = extractActivityCandidates(
    html,
    'linkedin_http_url',
    'https://www.linkedin.com/feed/update/urn:li:activity:7457432255678963712/',
    ['Andreas Prins'],
    false,
    'Ravan Naidoo',
  );

  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].comment_status, 'viewer found in parsed comments (1 parsed)');
});
