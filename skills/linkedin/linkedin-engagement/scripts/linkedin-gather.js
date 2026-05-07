#!/usr/bin/env node
/* Gather LinkedIn mention candidates with authenticated HTTP requests.
 *
 * Read-only: this script only performs GET requests and prints JSON/Markdown.
 * It never clicks Like, Comment, Repost, or Post.
 */

const fs = require('fs');
const path = require('path');

const WORD_RE = /\s+/g;
const PROFILE_ID_RE = /ACo[A-Za-z0-9_-]{20,}/g;
const FSD_PROFILE_RE = /urn:li:fsd_profile:(ACo[A-Za-z0-9_-]+)/g;
const ACTIVITY_RE = /urn:li:activity:(\d+)/g;
const HUMAN_TEXT_KEYS_RE = /"(?:text|stringValue|accessibilityText|ariaLabel|title|subtitle|description)":"((?:\\.|[^"\\])*)"/g;
const NOISY_TEXT_RE = /^(?:Default|Collapsed|Expanded|Like|Comment|Repost|Send|Follow|Message|Share|Save|Copy link|Open Emoji Keyboard|Current selected sort order is|Most relevant|View job|Online)$/i;

function parseArgs(argv) {
  const args = {
    target: [],
    url: [],
    period: 'last 7 days',
    includeSuse: false,
    viewerMentions: false,
    mentioningMember: '',
    maxCandidates: 10,
    maxScrolls: 6,
    viewerName: '',
    format: 'json',
    headed: true,
    profileDir: '',
    envFile: '',
    reviewFile: '',
    today: '',
    startDate: '',
    endDate: '',
    loginTimeoutMs: 300000,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    const next = () => {
      if (i + 1 >= argv.length) throw new Error(`Missing value for ${key}`);
      i += 1;
      return argv[i];
    };
    if (key === '--target') args.target.push(next());
    else if (key === '--url') args.url.push(next());
    else if (key === '--period') args.period = next();
    else if (key === '--start-date') args.startDate = next();
    else if (key === '--end-date') args.endDate = next();
    else if (key === '--today') args.today = next();
    else if (key === '--include-suse') args.includeSuse = true;
    else if (key === '--viewer-mentions') args.viewerMentions = true;
    else if (key === '--mentioning-member') args.mentioningMember = next();
    else if (key === '--max-candidates') args.maxCandidates = Number(next());
    else if (key === '--max-scrolls') args.maxScrolls = Number(next());
    else if (key === '--viewer-name') args.viewerName = next();
    else if (key === '--format') args.format = next();
    else if (key === '--headless' || key === '--headed') args.headed = key === '--headed';
    else if (key === '--profile-dir') args.profileDir = next();
    else if (key === '--env-file') args.envFile = next();
    else if (key === '--review-file') args.reviewFile = next();
    else if (key === '--login-timeout-ms') args.loginTimeoutMs = Number(next());
    else if (key === '--help' || key === '-h') {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${key}`);
    }
  }

  if (args.target.length === 0) throw new Error('At least one --target is required.');
  if (!['json', 'markdown', 'final-markdown'].includes(args.format)) throw new Error('--format must be json, markdown, or final-markdown.');
  return args;
}

function printHelp() {
  console.log(`Usage: run-linkedin-gather.sh --target NAME [options]

Options:
  --target NAME              Target name, handle, or profile URL. Repeatable.
  --include-suse             Also search and match SUSE.
  --viewer-mentions          Fetch LinkedIn mentions notifications page over HTTP.
  --mentioning-member NAME   Filter posts that mention this member. Accepts name, URL, vanity slug, or ACo id.
  --period TEXT              today, yesterday, last 7 days, last 30 days.
  --start-date YYYY-MM-DD    Inclusive date range metadata.
  --end-date YYYY-MM-DD      Inclusive date range metadata.
  --today YYYY-MM-DD         Override today's date for deterministic output.
  --url URL                  Fetch a specific LinkedIn URL. Repeatable.
  --viewer-name NAME         Mark candidate if this name is present in fetched HTML.
  --max-candidates N         Default 10.
  --env-file FILE            Env file with LINKEDIN_LI_AT and LINKEDIN_JSESSIONID.
  --review-file FILE         JSON file of LLM-authored candidate reviews keyed by URL.
  --format json|markdown|final-markdown
                              Default json. final-markdown prints deterministic
                              final results from gathered data and review-file
                              annotations.

Ignored compatibility options: --max-scrolls, --headed, --headless, --profile-dir, --login-timeout-ms.
`);
}

function parseEnvFile(contents) {
  const values = {};
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    const quote = value[0];
    if ((quote === '"' || quote === "'") && value.endsWith(quote)) value = value.slice(1, -1);
    values[match[1]] = value;
  }
  return values;
}

function loadLinkedInAuth(envFile) {
  const explicitPath = envFile || process.env.LINKEDIN_AUTH_ENV_FILE;
  const candidates = explicitPath ? [explicitPath] : [path.join(process.cwd(), '.env')];
  const envValues = {};
  for (const filePath of candidates) {
    if (!filePath || !fs.existsSync(filePath)) continue;
    Object.assign(envValues, parseEnvFile(fs.readFileSync(filePath, 'utf8')));
  }
  return {
    liAt: process.env.LINKEDIN_LI_AT || envValues.LINKEDIN_LI_AT || '',
    jsessionId: process.env.LINKEDIN_JSESSIONID || envValues.LINKEDIN_JSESSIONID || '',
  };
}

function normalizeText(value) {
  return String(value || '').replace(WORD_RE, ' ').trim();
}

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

function parseDate(value) {
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) throw new Error(`Invalid date: ${value}`);
  return date;
}

function addDays(date, days) {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

function resolveRange(args) {
  if (args.startDate || args.endDate) {
    if (!args.startDate || !args.endDate) throw new Error('--start-date and --end-date must be supplied together.');
    return { start: args.startDate, end: args.endDate };
  }
  const today = args.today ? parseDate(args.today) : new Date();
  const value = args.period.toLowerCase().trim();
  if (value === 'today') return { start: isoDate(today), end: isoDate(today) };
  if (value === 'yesterday') {
    const day = addDays(today, -1);
    return { start: isoDate(day), end: isoDate(day) };
  }
  const daysMatch = value.match(/^(?:last\s+)?(\d+)\s+days?$/);
  const weeksMatch = value.match(/^(?:last|past)\s+(\d+)\s+weeks?$/);
  const days = daysMatch ? Number(daysMatch[1]) : (['last week', 'past week', 'week'].includes(value) ? 7 : null);
  if (days) return { start: isoDate(addDays(today, -(days - 1))), end: isoDate(today) };
  if (weeksMatch) return { start: isoDate(addDays(today, -(Number(weeksMatch[1]) * 7))), end: isoDate(today) };
  if (value === 'last 30 days' || value === 'past month' || value === 'last month') {
    return { start: isoDate(addDays(today, -29)), end: isoDate(today) };
  }
  return { start: isoDate(addDays(today, -6)), end: isoDate(today) };
}

function linkedInDateFilter(period) {
  const value = period.toLowerCase().trim();
  if (value === 'today' || value === 'yesterday' || value === 'last 1 day') return 'past-24h';
  if (value.includes('30') || value.includes('month')) return 'past-month';
  const weeksMatch = value.match(/(?:last|past)\s+(\d+)\s+weeks?/);
  if (weeksMatch && Number(weeksMatch[1]) <= 4) return 'past-month';
  if (value.includes('week') || value.includes('7')) return 'past-week';
  return '';
}

function buildSearchUrl({ term = '', mentioningMember = '', period = '', sortBy = '' } = {}) {
  const params = new URLSearchParams({ origin: mentioningMember ? 'FACETED_SEARCH' : 'GLOBAL_SEARCH_HEADER' });
  if (term) params.set('keywords', term);
  if (mentioningMember && /^ACo[A-Za-z0-9_-]+$/.test(mentioningMember)) {
    params.set('mentionsMember', JSON.stringify([mentioningMember]));
  }
  const dateFilter = linkedInDateFilter(period);
  if (dateFilter) params.set('datePosted', JSON.stringify([dateFilter]));
  if (sortBy) params.set('sortBy', JSON.stringify([sortBy]));
  return `https://www.linkedin.com/search/results/content/?${params.toString()}`;
}

function buildPeopleSearchUrl(name) {
  const params = new URLSearchParams({ keywords: name, origin: 'GLOBAL_SEARCH_HEADER' });
  return `https://www.linkedin.com/search/results/people/?${params.toString()}`;
}

function decodeHtml(value) {
  return String(value || '')
    .replace(/\\u002d/g, '-')
    .replace(/\\u0026/g, '&')
    .replace(/\\u003c/g, '<')
    .replace(/\\u003e/g, '>')
    .replace(/\\u002F/g, '/')
    .replace(/\\&quot;|&quot;/g, '"')
    .replace(/\\&amp;|&amp;/g, '&')
    .replace(/\\&lt;|&lt;/g, '<')
    .replace(/\\&gt;|&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&#61;/g, '=')
    .replace(/&#92;/g, '\\');
}

function decodeJsonString(value) {
  try {
    return JSON.parse(`"${String(value || '').replace(/"/g, '\\"')}"`);
  } catch {
    return String(value || '')
      .replace(/\\"/g, '"')
      .replace(/\\n/g, ' ')
      .replace(/\\r/g, ' ')
      .replace(/\\t/g, ' ')
      .replace(/\\\\/g, '\\');
  }
}

function stripHtml(value) {
  return normalizeText(decodeHtml(value)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' '));
}

function extractProfileIds(html) {
  const ids = [];
  for (const match of decodeHtml(html).matchAll(FSD_PROFILE_RE)) ids.push(match[1]);
  for (const match of decodeHtml(html).matchAll(PROFILE_ID_RE)) ids.push(match[0]);
  return [...new Set(ids.map((id) => id.replace(/(Topcard|SupportedLocales)$/i, '')))];
}

function extractVanitySlug(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) {
    try {
      const parsed = new URL(raw);
      const match = parsed.pathname.match(/^\/in\/([^/]+)/);
      return match ? match[1] : '';
    } catch {
      return '';
    }
  }
  const match = raw.match(/(?:linkedin\.com\/in\/)?([A-Za-z0-9_-]+)\/?$/);
  return match && !raw.includes(' ') ? match[1] : '';
}

function authHeaders(auth, accept = 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8') {
  if (!auth.liAt || !auth.jsessionId) {
    throw new Error('Missing LINKEDIN_LI_AT or LINKEDIN_JSESSIONID. Refresh .env with linkedin-login.');
  }
  const jsessionId = auth.jsessionId.replace(/^"|"$/g, '');
  return {
    accept,
    cookie: `li_at=${auth.liAt}; JSESSIONID=${auth.jsessionId}`,
    'csrf-token': jsessionId,
    'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  };
}

function sameUrl(left, right) {
  try {
    const a = new URL(left);
    const b = new URL(right, a.origin);
    a.hash = '';
    b.hash = '';
    return a.toString() === b.toString();
  } catch {
    return left === right;
  }
}

function redactedSetCookieSummary(response) {
  const cookies = [];
  for (const [key, value] of response.headers) {
    if (key.toLowerCase() !== 'set-cookie') continue;
    const name = value.split('=')[0];
    if (name) cookies.push(name);
  }
  return cookies.length ? cookies.join(', ') : '';
}

async function fetchLinkedIn(url, auth) {
  const response = await fetch(url, { headers: authHeaders(auth), redirect: 'manual' });
  const text = await response.text();
  if ([301, 302, 303, 307, 308].includes(response.status)) {
    const location = response.headers.get('location') || '';
    if (/login|checkpoint|authwall/i.test(location)) {
      throw new Error('LinkedIn auth is expired or checkpointed. Refresh .env with linkedin-login.');
    }
    const setCookieSummary = redactedSetCookieSummary(response);
    if (sameUrl(url, location)) {
      const detail = setCookieSummary ? ` LinkedIn also sent Set-Cookie for: ${setCookieSummary}.` : '';
      throw new Error(`LinkedIn rejected the authenticated HTTP request with a same-URL redirect.${detail} Refresh .env with linkedin-login, then retry the HTTP gatherer.`);
    }
  }
  if (/\/login|checkpoint|authwall/i.test(response.url) || /Sign in to LinkedIn|authwall/i.test(text.slice(0, 20000))) {
    throw new Error('LinkedIn auth is expired or checkpointed. Refresh .env with linkedin-login.');
  }
  if (!response.ok) throw new Error(`LinkedIn request failed ${response.status} for ${url}`);
  return { url: response.url || url, html: text, status: response.status };
}

async function resolveMemberIdentity(member, auth) {
  if (/^ACo[A-Za-z0-9_-]+$/.test(member)) return { id: member, source: 'provided_id', url: '' };

  const vanity = extractVanitySlug(member);
  if (vanity) {
    const url = `https://www.linkedin.com/in/${vanity}/`;
    const page = await fetchLinkedIn(url, auth);
    const ids = extractProfileIds(page.html);
    if (ids.length) return { id: ids[0], source: 'profile', url };
  }

  const searchUrl = buildPeopleSearchUrl(member);
  const page = await fetchLinkedIn(searchUrl, auth);
  const ids = extractProfileIds(page.html);
  if (!ids.length) throw new Error(`Could not resolve LinkedIn member identity for "${member}".`);
  return { id: ids[0], source: 'people_search', url: searchUrl };
}

function matchesFor(text, targets, includeSuse) {
  const checks = [...targets];
  if (includeSuse && !checks.includes('SUSE')) checks.push('SUSE');
  const lowered = text.toLowerCase();
  return checks.filter((target) => lowered.includes(target.toLowerCase()));
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isAuthorOnlyTargetMatch(text, targets) {
  return targets.some((target) => {
    const escaped = escapeRegExp(target).replace(/['’]/g, "['’]");
    const actorHeader = new RegExp(
      `${escaped}\\s+(?:\\d+\\s*(?:m|h|d|w|mo|yr)|\\d+\\s+(?:minute|hour|day|week|month|year)s?\\s+ago)[\\s\\S]{0,240}Visible to[\\s\\S]{0,240}View ${escaped}['’] profile`,
      'i',
    );
    if (!actorHeader.test(text)) return false;

    return true;
  });
}

function isLinkedInJobOrEventCard(text) {
  return /(?:\bJob by\b|\bFull-time or part-time\b|\bView event:\b)/i.test(text);
}

function isOwnedTargetCompanyPost(text, targets) {
  return targets.some((target) => {
    const escaped = escapeRegExp(target).replace(/['’]/g, "['’]");
    const companyHeader = new RegExp(
      `(?:View company:\\s*)?${escaped}[\\s\\S]{0,120}\\bfollowers\\b[\\s\\S]{0,120}${escaped}\\s+(?:\\d+\\s*(?:m|h|d|w|mo|yr)|\\d+\\s+(?:minute|hour|day|week|month|year)s?\\s+ago|1w)`,
      'i',
    );
    const followersBeforeName = new RegExp(
      `\\bfollowers\\b\\s+${escaped}\\s+(?:\\d+\\s*(?:m|h|d|w|mo|yr)|\\d+\\s+(?:minute|hour|day|week|month|year)s?\\s+ago|1w)`,
      'i',
    );
    return companyHeader.test(text) || followersBeforeName.test(text);
  });
}

function nonEngagementSkipReason(text, targets) {
  if (isLinkedInJobOrEventCard(text)) return 'target appears in LinkedIn job/event chrome';
  if (isOwnedTargetCompanyPost(text, targets)) return 'target appears as the posting company, not as a third-party mention';
  return '';
}

function excerptAround(text, matches, width = 360) {
  const lowered = text.toLowerCase();
  const positions = matches.map((m) => lowered.indexOf(m.toLowerCase())).filter((p) => p >= 0);
  const pos = positions.length ? Math.min(...positions) : 0;
  const start = Math.max(0, pos - Math.floor(width / 3));
  const end = Math.min(text.length, start + width);
  return `${start ? '...' : ''}${text.slice(start, end).trim()}${end < text.length ? '...' : ''}`;
}

function viewerNamePatterns(viewerName) {
  const normalized = normalizeText(viewerName);
  if (!normalized) return [];
  const parts = normalized.split(' ').filter(Boolean);
  const patterns = [new RegExp(escapeRegExp(normalized).replace(/\s+/g, '\\s+'), 'i')];
  if (parts.length >= 2) {
    patterns.push(new RegExp(`"firstName":"${escapeRegExp(parts[0])}"[\\s\\S]{0,800}"lastName":"${escapeRegExp(parts.slice(1).join(' '))}"`, 'i'));
    patterns.push(new RegExp(`"title":\\{"textDirection":"[^"]+","text":"${escapeRegExp(normalized)}"`, 'i'));
  }
  return patterns;
}

function extractCommentBlocks(text) {
  const blocks = [];
  const marker = '"$type":"com.linkedin.voyager.dash.social.Comment"';
  const commenterMarker = '"$type":"com.linkedin.voyager.dash.social.Commenter"';
  let offset = -1;
  while ((offset = text.indexOf(marker, offset + 1)) >= 0) {
    const commenterOffset = text.lastIndexOf(commenterMarker, offset);
    const titleOffset = commenterOffset >= 0 ? text.lastIndexOf('"title":', commenterOffset) : -1;
    const start = titleOffset >= 0 && offset - titleOffset < 3200
      ? titleOffset
      : commenterOffset >= 0 && offset - commenterOffset < 3200
      ? Math.max(0, commenterOffset - 800)
      : offset;
    blocks.push(text.slice(start, Math.min(text.length, offset + 5200)));
  }
  return blocks;
}

function commentStatus(text, viewerName) {
  if (!viewerName) return 'unknown';
  const patterns = viewerNamePatterns(viewerName);
  const commentBlocks = extractCommentBlocks(text);
  if (!commentBlocks.length) return 'unknown - no parsed comment blocks in fetched HTML';
  const viewerFound = commentBlocks.some((block) => patterns.some((pattern) => pattern.test(block)));
  return viewerFound
    ? `viewer found in parsed comments (${commentBlocks.length} parsed)`
    : `not found in parsed comments (${commentBlocks.length} parsed)`;
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function extractHumanTextValues(block) {
  const values = [];
  for (const match of block.matchAll(HUMAN_TEXT_KEYS_RE)) {
    const value = normalizeText(decodeHtml(decodeJsonString(match[1])));
    if (!value || value.length < 2 || NOISY_TEXT_RE.test(value)) continue;
    if (/^\$/.test(value) || /proto\.sdui|auto-binding|component/i.test(value)) continue;
    values.push(value);
  }
  return unique(values);
}

function readableActivityText(block) {
  const values = extractHumanTextValues(block);
  const stripped = stripHtml(block);
  const text = values.length ? values.join(' ') : stripped;
  return normalizeText(text.replace(/"\$type":"[^"]+"/g, ' '));
}

function inferAuthor(values) {
  return values.find((value) => (
    /^[A-Z][A-Za-z .'-]{2,80}$/.test(value)
    && !/LinkedIn|SUSE|Common Criteria|Digital Sovereignty|Program Manager|Visible to|ago/i.test(value)
  )) || '';
}

function inferDate(values) {
  return values.find((value) => (
    /^\d+\s*(?:m|h|d|w|mo|yr)$/i.test(value)
    || /^\d+\s+(?:minute|hour|day|week|month|year)s?\s+ago$/i.test(value)
    || /^[A-Z][a-z]{2}\s+\d{1,2},\s+\d{4}$/.test(value)
  )) || null;
}

function inferDateFromActivityId(id) {
  try {
    const timestampMs = BigInt(String(id)) >> 22n;
    const date = new Date(Number(timestampMs));
    return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
  } catch {
    return null;
  }
}

function cleanLinkedInUrl(url) {
  if (!url) return '';
  try {
    const parsed = new URL(url, 'https://www.linkedin.com');
    parsed.search = '';
    parsed.hash = '';
    return parsed.toString();
  } catch {
    return url;
  }
}

function selectCandidateUrl(links, fallbackUrl) {
  const cleaned = links.map(cleanLinkedInUrl).filter(Boolean);
  return cleaned.find((href) => /linkedin\.com\/(feed\/update|posts)\//.test(href))
    || cleaned.find((href) => /linkedin\.com\/company\//.test(href))
    || cleaned.find((href) => /linkedin\.com\/in\//.test(href))
    || cleanLinkedInUrl(fallbackUrl);
}

function activityUrl(id) {
  return `https://www.linkedin.com/feed/update/urn:li:activity:${id}/`;
}

function skipCandidate(skipped, sourceUrl, sourceType, id, reason, matches = []) {
  skipped.push({
    source: sourceUrl,
    source_type: sourceType,
    url: activityUrl(id),
    matches,
    skip_reason: reason,
  });
}

function extractActivityRecords(html, sourceType, sourceUrl, targets, includeSuse, viewerName, forcedMatches = [], options = {}) {
  const qualityFilters = options.qualityFilters !== false;
  const decoded = decodeHtml(html);
  const ids = [...new Set([...decoded.matchAll(ACTIVITY_RE)].map((match) => match[1]))];
  const candidates = [];
  const skipped_candidates = [];
  for (const id of ids) {
    const occurrences = [];
    let offset = -1;
    while ((offset = decoded.indexOf(id, offset + 1)) >= 0) occurrences.push(offset);
    const first = occurrences[0] ?? decoded.indexOf(`urn:li:activity:${id}`);
    const start = Math.max(0, Math.min(...occurrences, first) - 5000);
    const end = Math.min(decoded.length, Math.max(...occurrences, first) + 7000);
    const block = decoded.slice(start, end);
    const values = extractHumanTextValues(block);
    const text = readableActivityText(block);
    const links = [...block.matchAll(/https:\/\/www\.linkedin\.com\/(?:feed\/update|posts|company|in)\/[^"'<\\\s)]+/g)].map((match) => match[0]);
    const url = selectCandidateUrl(
      [activityUrl(id), ...links],
      sourceUrl,
    );
    const matches = [...new Set([...forcedMatches, ...matchesFor(text, targets, includeSuse)])];
    if (!matches.length && !forcedMatches.length) {
      skipCandidate(skipped_candidates, sourceUrl, sourceType, id, 'no target match in parsed activity text');
      continue;
    }
    if (qualityFilters && isAuthorOnlyTargetMatch(text, targets)) {
      skipCandidate(skipped_candidates, sourceUrl, sourceType, id, 'target appears only in author/profile chrome', matches);
      continue;
    }
    const lowQualityReason = qualityFilters ? nonEngagementSkipReason(text, targets) : '';
    if (lowQualityReason) {
      skipCandidate(skipped_candidates, sourceUrl, sourceType, id, lowQualityReason, matches);
      continue;
    }
    candidates.push({
      source: sourceUrl,
      source_type: sourceType,
      url,
      title: '',
      author: inferAuthor(values),
      date: inferDate(values) || inferDateFromActivityId(id),
      matches: matches.length ? matches : forcedMatches,
      comment_status: commentStatus(decoded, viewerName),
      excerpt: excerptAround(text || `LinkedIn activity ${id}`, matches.length ? matches : forcedMatches),
      evidence: 'Matched LinkedIn SSR HTML fetched over authenticated HTTP.',
    });
  }
  return { candidates, skipped_candidates };
}

function extractActivityCandidates(html, sourceType, sourceUrl, targets, includeSuse, viewerName, forcedMatches = []) {
  return extractActivityRecords(html, sourceType, sourceUrl, targets, includeSuse, viewerName, forcedMatches).candidates;
}

async function gatherSearch(auth, args, fetchPage = fetchLinkedIn) {
  const terms = [...args.target];
  if (args.includeSuse) terms.push('SUSE');
  const records = { candidates: [], skipped_candidates: [] };
  for (const term of terms) {
    const url = buildSearchUrl({ term, period: args.period });
    const page = await fetchPage(url, auth);
    const extracted = extractActivityRecords(page.html, 'linkedin_http_search', url, args.target, args.includeSuse, args.viewerName, [], {
      qualityFilters: false,
    });
    records.skipped_candidates.push(...extracted.skipped_candidates);
    for (const candidate of extracted.candidates) {
      const detailPage = await fetchPage(candidate.url, auth);
      const detailRecords = extractActivityRecords(
        detailPage.html,
        'linkedin_http_url',
        candidate.url,
        args.target,
        args.includeSuse,
        args.viewerName,
      );
      if (!detailRecords.candidates.length) {
        records.skipped_candidates.push({
          source: url,
          source_type: 'linkedin_http_search',
          url: candidate.url,
          matches: candidate.matches,
          skip_reason: detailRecords.skipped_candidates[0]?.skip_reason || 'activity detail fetch did not produce a usable candidate',
        });
        continue;
      }
      records.candidates.push(...detailRecords.candidates.map((detailCandidate) => ({
        ...detailCandidate,
        source: url,
        source_type: 'linkedin_http_search',
      })));
      records.skipped_candidates.push(...detailRecords.skipped_candidates.map((item) => ({
        ...item,
        source: url,
        source_type: 'linkedin_http_search',
      })));
    }
  }
  return records;
}

async function gatherMentioningMemberSearch(auth, args, fetchPage = fetchLinkedIn, resolveMember = resolveMemberIdentity) {
  const resolved = await resolveMember(args.mentioningMember, auth);
  const url = buildSearchUrl({
    mentioningMember: resolved.id,
    period: args.period,
    sortBy: 'date_posted',
  });
  const page = await fetchPage(url, auth);
  const searchRecords = extractActivityRecords(
    page.html,
    'linkedin_http_search_mentions_member',
    url,
    args.target,
    args.includeSuse,
    args.viewerName,
    [args.mentioningMember, resolved.id],
  );
  const records = { candidates: [], skipped_candidates: [...searchRecords.skipped_candidates] };
  for (const candidate of searchRecords.candidates) {
    const detailPage = await fetchPage(candidate.url, auth);
    const detailRecords = extractActivityRecords(
      detailPage.html,
      'linkedin_http_url',
      candidate.url,
      args.target,
      args.includeSuse,
      args.viewerName,
      candidate.matches,
    );
    if (!detailRecords.candidates.length) {
      if (!detailRecords.skipped_candidates.length) {
        records.candidates.push({
          ...candidate,
          source: url,
          source_type: 'linkedin_http_search_mentions_member',
          resolved_member: resolved,
          evidence: 'Search result candidate retained because the activity detail page did not expose parseable LinkedIn SSR activity records over HTTP.',
        });
        continue;
      }
      records.skipped_candidates.push({
        source: url,
        source_type: 'linkedin_http_search_mentions_member',
        url: candidate.url,
        matches: candidate.matches,
        skip_reason: detailRecords.skipped_candidates[0].skip_reason,
        resolved_member: resolved,
      });
      continue;
    }
    records.candidates.push(...detailRecords.candidates.map((detailCandidate) => ({
      ...detailCandidate,
      source: url,
      source_type: 'linkedin_http_search_mentions_member',
      resolved_member: resolved,
    })));
    records.skipped_candidates.push(...detailRecords.skipped_candidates.map((item) => ({
      ...item,
      resolved_member: resolved,
    })));
  }
  return records;
}

async function gatherViewerMentions(auth, args) {
  const url = 'https://www.linkedin.com/notifications/?filter=mentions_all';
  const page = await fetchLinkedIn(url, auth);
  return extractActivityRecords(page.html, 'linkedin_http_notifications_mentions', url, args.target, args.includeSuse, args.viewerName);
}

async function gatherUrls(auth, args) {
  const records = { candidates: [], skipped_candidates: [] };
  for (const url of args.url) {
    const page = await fetchLinkedIn(url, auth);
    const extracted = extractActivityRecords(page.html, 'linkedin_http_url', url, args.target, args.includeSuse, args.viewerName);
    records.candidates.push(...extracted.candidates);
    records.skipped_candidates.push(...extracted.skipped_candidates);
  }
  return records;
}

function dedupe(candidates, limit) {
  const seen = new Set();
  const output = [];
  for (const candidate of candidates) {
    const key = candidate.url || candidate.excerpt.slice(0, 120);
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(candidate);
    if (output.length >= limit) break;
  }
  return output;
}

function normalizeReviewList(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (Array.isArray(value.reviews)) return value.reviews;
  if (Array.isArray(value.candidates)) return value.candidates;
  return [];
}

function loadReviews(reviewFile) {
  if (!reviewFile) return [];
  const parsed = JSON.parse(fs.readFileSync(reviewFile, 'utf8'));
  return normalizeReviewList(parsed);
}

function reviewMap(reviews) {
  return new Map(normalizeReviewList(reviews).filter((item) => item?.url).map((item) => [cleanLinkedInUrl(item.url), item]));
}

function reviewCandidate(item, reviewsByUrl) {
  const review = reviewsByUrl.get(cleanLinkedInUrl(item.url)) || {};
  const sentiment = review.sentiment || 'unreviewed';
  if (/viewer found in parsed comments/i.test(item.comment_status || '')) {
    return {
      ...item,
      action: 'skip',
      sentiment,
      rationale: 'viewer already found in parsed comments',
      proposed_comment: '',
    };
  }
  if (sentiment === 'unreviewed') {
    return {
      ...item,
      action: 'manual-review',
      sentiment,
      rationale: 'missing LLM review annotation',
      proposed_comment: '',
    };
  }
  if (['negative', 'mixed'].includes(sentiment)) {
    return {
      ...item,
      action: 'skip',
      sentiment,
      rationale: review.rationale || `${sentiment} sentiment toward the target requires explicit review`,
      proposed_comment: '',
    };
  }
  if (/unknown/i.test(item.comment_status || '')) {
    return {
      ...item,
      action: 'manual-review',
      sentiment,
      rationale: 'comment status is unknown; verify comments manually before using the draft',
      proposed_comment: review.proposed_comment || '',
    };
  }
  return {
    ...item,
    action: 'draft',
    sentiment,
    rationale: review.rationale || 'positive or neutral candidate with no parsed viewer comment',
    proposed_comment: review.proposed_comment || '',
  };
}

function displayCommentStatus(status) {
  if (/not found in parsed comments/i.test(status || '')) return 'No previous comments from you';
  if (/viewer found in parsed comments/i.test(status || '')) return 'Previous comment from you found';
  if (/unknown/i.test(status || '')) return 'Unable to verify previous comments from you';
  return status || 'Unable to verify previous comments from you';
}

function buildFinalReview({ dateRange, targets, candidates, skippedCandidates = [], reviews = [] }) {
  const reviewsByUrl = reviewMap(reviews);
  const lines = [
    `# LinkedIn Engagement Review (${dateRange.start} to ${dateRange.end})`,
    '',
    `- Targets: ${targets.join(', ')}`,
    `- Candidates: ${candidates.length}`,
    `- Skipped candidates: ${skippedCandidates.length}`,
    '',
  ];

  candidates.map((item) => reviewCandidate(item, reviewsByUrl)).forEach((item, index) => {
    lines.push(`## Candidate ${index + 1}`);
    lines.push(`- URL: ${item.url || ''}`);
    lines.push(`- Author: ${item.author || ''}`);
    lines.push(`- Date: ${item.date || 'unknown'}`);
    lines.push(`- Match: ${(item.matches || []).join(', ')}`);
    lines.push(`- Action: ${item.action}`);
    lines.push(`- Sentiment: ${item.sentiment}`);
    lines.push(`- Rationale: ${item.rationale}`);
    lines.push(`- Comment status: ${displayCommentStatus(item.comment_status)}`);
    if (item.proposed_comment) lines.push(`- Proposed comment: ${item.proposed_comment}`);
    lines.push(`- Excerpt: ${item.excerpt || ''}`);
    lines.push('');
  });

  lines.push('## Skipped Candidates');
  if (!skippedCandidates.length) {
    lines.push('- None');
  } else {
    skippedCandidates.forEach((item, index) => {
      lines.push(`- ${index + 1}. ${item.url || ''}`);
      lines.push(`  - Reason: ${item.skip_reason || 'unknown'}`);
      if (item.matches?.length) lines.push(`  - Match: ${item.matches.join(', ')}`);
    });
  }
  return lines.join('\n');
}

function printOutput(args, dateRange, candidates, skippedCandidates = [], reviews = []) {
  const payload = {
    date_range: dateRange,
    targets: args.target,
    include_suse: args.includeSuse,
    generated_at: new Date().toISOString(),
    collection_method: 'authenticated_linkedin_http',
    candidates,
    skipped_candidates: skippedCandidates,
  };
  if (args.format === 'json') {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }
  if (args.format === 'final-markdown') {
    console.log(buildFinalReview({
      dateRange,
      targets: args.target,
      candidates,
      skippedCandidates,
      reviews,
    }));
    return;
  }
  console.log(`# LinkedIn Mention Candidates (${dateRange.start} to ${dateRange.end})\n`);
  candidates.forEach((item, index) => {
    console.log(`## Candidate ${index + 1}`);
    console.log(`- Source: ${item.source}`);
    console.log(`- URL: ${item.url || ''}`);
    console.log(`- Author: ${item.author || ''}`);
    console.log(`- Date: ${item.date || 'unknown'}`);
    console.log(`- Match: ${item.matches.join(', ')}`);
    console.log(`- Comment status: ${displayCommentStatus(item.comment_status)}`);
    console.log(`- Evidence: ${item.evidence}`);
    console.log(`- Excerpt: ${item.excerpt}\n`);
  });
  if (skippedCandidates.length) {
    console.log('## Skipped');
    skippedCandidates.forEach((item, index) => {
      console.log(`- ${index + 1}. ${item.url || ''}`);
      console.log(`  - Reason: ${item.skip_reason}`);
      if (item.matches?.length) console.log(`  - Match: ${item.matches.join(', ')}`);
    });
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const dateRange = resolveRange(args);
  const auth = loadLinkedInAuth(args.envFile);
  const reviews = loadReviews(args.reviewFile);
  const gathered = { candidates: [], skipped_candidates: [] };
  for (const records of [
    args.viewerMentions ? await gatherViewerMentions(auth, args) : null,
    args.url.length ? await gatherUrls(auth, args) : null,
    args.mentioningMember ? await gatherMentioningMemberSearch(auth, args) : null,
    (!args.viewerMentions && !args.mentioningMember) ? await gatherSearch(auth, args) : null,
  ].filter(Boolean)) {
    gathered.candidates.push(...records.candidates);
    gathered.skipped_candidates.push(...records.skipped_candidates);
  }
  printOutput(args, dateRange, dedupe(gathered.candidates, args.maxCandidates), dedupe(gathered.skipped_candidates, args.maxCandidates), reviews);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`ERROR: ${error.message}`);
    process.exit(1);
  });
}

module.exports = {
  buildPeopleSearchUrl,
  buildFinalReview,
  buildSearchUrl,
  extractActivityCandidates,
  extractActivityRecords,
  inferDateFromActivityId,
  extractProfileIds,
  extractVanitySlug,
  gatherMentioningMemberSearch,
  gatherSearch,
  displayCommentStatus,
  loadReviews,
  linkedInDateFilter,
  parseArgs,
  resolveRange,
  selectCandidateUrl,
};
