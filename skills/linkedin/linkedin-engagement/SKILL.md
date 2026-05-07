---
name: linkedin-engagement
description: Use when the user asks to find LinkedIn posts that mention them, SUSE, or another person/company; scan recent LinkedIn mentions; classify engagement opportunities; or draft comments for positive or neutral engagement candidates. This skill is read-only and must not post comments, reactions, reposts, messages, or any other LinkedIn writes.
---

# LinkedIn Engagement

Find LinkedIn mention candidates with read-only HTTP requests using the saved
LinkedIn cookies in `.env`. A candidate must be a commentable post whose body
mentions the target, not a job card, event card, profile header, search-result
chrome, or a post where the target is only the posting company. Reject risky or
irrelevant posts and draft comments for positive or neutral items. Never post,
react, repost, message, or perform any LinkedIn write action.

## Quick Start

Use the bundled HTTP gatherer. It reads `LINKEDIN_LI_AT` and
`LINKEDIN_JSESSIONID` from the project `.env`, sends them as LinkedIn browser
cookies, parses LinkedIn SSR HTML, hydrates mention-search results by fetching
activity URLs, and reports both usable and skipped candidates. Keep extraction
and final formatting deterministic in the script. Let the LLM agent determine
sentiment, rationale, and proposed comments, then pass those annotations back to
the script with `--review-file` for final printing.

Before each gather, the wrapper runs `scripts/check-linkedin-env.sh` and emits a
deterministic `LINKEDIN_ENV_CHECK ...` line to stderr without secret values. Run
that script directly when you only need to verify auth configuration.

For a named third party, prefer `--mentioning-member`; the script resolves the
person to LinkedIn's `ACo...` member id and fetches content search with the
`mentionsMember` filter:

```bash
.agents/skills/linkedin-engagement/scripts/run-linkedin-gather.sh \
  --target "Andreas Prins" \
  --mentioning-member "Andreas Prins" \
  --period "last 30 days" \
  --viewer-name "Ravan Naidoo" \
  --format json
```

For a known LinkedIn profile URL, pass it directly:

```bash
.agents/skills/linkedin-engagement/scripts/run-linkedin-gather.sh \
  --target "Andreas Prins" \
  --mentioning-member "https://www.linkedin.com/in/andreasprins/" \
  --period "last 7 days" \
  --format json
```

For supplied post/search URLs:

```bash
.agents/skills/linkedin-engagement/scripts/run-linkedin-gather.sh \
  --target "Andreas Prins" \
  --url "https://www.linkedin.com/feed/update/urn:li:activity:123/" \
  --format json
```

For the user's own mentions, use notification mentions and set the user's name
as both target and viewer:

```bash
.agents/skills/linkedin-engagement/scripts/run-linkedin-gather.sh \
  --target "Ravan Naidoo" \
  --viewer-mentions \
  --period "last 7 days" \
  --viewer-name "Ravan Naidoo" \
  --format json
```

After the LLM reviews the JSON candidates, save a review file and use the script
to print the final deterministic report:

```bash
.agents/skills/linkedin-engagement/scripts/run-linkedin-gather.sh \
  --target "Andreas Prins" \
  --period "last 7 days" \
  --viewer-name "Ravan Naidoo" \
  --review-file /tmp/linkedin-review.json \
  --format final-markdown
```

## Workflow

1. Resolve the requested period into concrete start/end dates and show them.
2. Run `scripts/check-linkedin-env.sh` or rely on the gatherer wrapper to do it; if it reports `missing-file` or `missing-values`, run `bash .agents/skills/linkedin-login/scripts/run-linkedin-login.sh`.
3. For another person's mentions, run the gatherer with `--mentioning-member`. It resolves names, vanity slugs, profile URLs, or `ACo...` ids.
4. For broad keyword searches such as `--target "SUSE"`, treat results as mention candidates only when the post body discusses the target. Exclude job cards, event cards, search-result cards, profile/company headers, and posts authored by the target company unless the user explicitly asks for owned posts.
5. Run gathers with `--format json` first. Use only items in `candidates` for LLM review and drafting.
6. As the LLM agent, classify sentiment toward the mentioned person/company as `positive`, `neutral`, `mixed`, or `negative`.
7. As the LLM agent, draft one concise comment for each positive or neutral candidate unless `comment_status` shows `viewer found in parsed comments`. Match the post's topic and tone with a similar professional peer comment; do not write a generic congratulatory or brand-style reply.
8. Write a JSON review file with LLM annotations keyed by URL:
   `[{ "url": "...", "sentiment": "positive", "rationale": "...", "proposed_comment": "..." }]`.
9. Run the gatherer again with the same gather arguments plus `--review-file <file>` and `--format final-markdown`.
10. Relay the final script output directly. Do not hand-assemble a different final candidate list unless debugging or patching the script.
11. Always include `skipped_candidates` in the final report; the script prints each activity URL and `skip_reason`.
12. Treat candidates with `unknown` comment status as needing manual browser verification before using a drafted comment; the script prints these as `manual-review` even when LLM annotations exist.
13. Reject `negative` and `mixed` posts unless the user explicitly asks to review them; the script prints these as `skip`.
14. Present candidates one at a time with author/URL, match, sentiment/rationale, excerpt, comment status, and exact proposed comment.
15. Do not post comments or treat approval language as permission to post. If the user asks to post, explain that this skill is draft-only and provide the exact drafted text for manual use.
16. Summarize drafted, skipped, and manual-review items.

## HTTP Notes

- The script is read-only and uses only HTTP GET requests.
- Do not use Playwright to render posts as a fallback for gathering or parsing. If HTTP extraction is weak, improve the parser or capture a redacted HTTP fixture.
- Auth uses `Cookie: li_at=<LINKEDIN_LI_AT>; JSESSIONID=<LINKEDIN_JSESSIONID>` plus `csrf-token` from `JSESSIONID`.
- Name resolution first fetches profile pages for vanity/profile inputs, otherwise LinkedIn people search.
- Mention search fetches `https://www.linkedin.com/search/results/content/?origin=FACETED_SEARCH&sortBy=["date_posted"]&mentionsMember=["ACo..."]`.
- Mention-search records are discovery signals. The script fetches each discovered activity URL and uses the detail-page parse as final evidence.
- Keyword-search records are noisy. The script should skip LinkedIn job/event cards, owned-company posts, and author/profile chrome before the LLM drafts comments.
- Comment status is based on parsed `com.linkedin.voyager.dash.social.Comment` blocks, not the whole page. `not found in parsed comments (N parsed)` means visible SSR comments were checked and the viewer was not found; `unknown - no parsed comment blocks in fetched HTML` means do not infer either way.
- LinkedIn only exposes stable web date filters for `past-24h`, `past-week`, and `past-month`. The gatherer maps `last/past 2-4 weeks` to `past-month`; for longer windows, omit `datePosted`, sort by date, and post-filter parsed candidates when dates are visible.
- If LinkedIn returns login, checkpoint, authwall, redirects there, or a same-URL redirect that deletes `li_at`, refresh `.env` with `linkedin-login`.
- See [HTTP_RESEARCH.md](HTTP_RESEARCH.md) for observed request/response details.

## Write-Safety Rules

Never post automatically or manually through this skill. Do not click or call
Like, Comment, Repost, Send, Follow, Message, Share, or any other LinkedIn write
surface. Treat approval phrases such as `Approve this comment`, `Post this one`,
or `Yes, post comment 3` as requests to show the draft for manual use, not as
authorization to post.

If the user edits a proposed comment, treat the edited text as the new draft and
present it back without posting.

## Comment Style

- Keep comments 1-3 sentences.
- Sound like a professional peer, not a brand account.
- Add a specific observation from the post.
- Do not mention AI assistance.
- Do not make unsupported claims.
- Do not tag people or use hashtags unless requested.
- Avoid sales language and generic praise.
