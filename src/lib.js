'use strict';

const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');
const { marked } = require('marked');

function slugify(str) {
  return String(str)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Frontmatter dates are calendar dates ("2026-07-24"), not instants. Format in UTC so
// a timezone behind UTC doesn't roll the displayed date back a day.
function formatDate(dateInput) {
  return new Date(dateInput).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

// First sentence of a Markdown body, as plain text. Requiring whitespace (or the end) after
// the punctuation keeps it from splitting inside a decimal number ("4.2%").
function firstSentence(markdown) {
  const plain = String(markdown)
    .replace(/^#+\s+/gm, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[*_`]/g, '')
    .trim();
  const match = plain.match(/^.*?[.!?](?=\s|$)/s);
  return (match ? match[0] : plain.slice(0, 200)).trim();
}

function canonicalUrl(siteUrl, urlPath) {
  const base = String(siteUrl).replace(/\/+$/, '');
  const p = urlPath.startsWith('/') ? urlPath : `/${urlPath}`;
  return `${base}${p}`;
}

function parsePost(raw, filename) {
  const { data, content } = matter(raw);
  if (!data.title) throw new Error(`${filename}: missing "title" in frontmatter`);
  if (!data.date) throw new Error(`${filename}: missing "date" in frontmatter`);

  const date = new Date(data.date);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`${filename}: invalid "date" (${data.date}); use YYYY-MM-DD`);
  }

  const slug = slugify(data.slug || filename.replace(/\.md$/, ''));
  if (!slug) throw new Error(`${filename}: could not derive a slug`);

  return {
    title: String(data.title),
    date,
    dateDisplay: formatDate(date),
    isoDate: date.toISOString().slice(0, 10),
    slug,
    excerpt: data.excerpt ? String(data.excerpt) : firstSentence(content),
    tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
    draft: data.draft === true,
    html: marked.parse(content),
  };
}

function loadPosts(dir, { includeDrafts = false } = {}) {
  if (!fs.existsSync(dir)) return [];

  const posts = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .sort()
    .map((f) => parsePost(fs.readFileSync(path.join(dir, f), 'utf8'), f));

  const seen = new Set();
  for (const p of posts) {
    if (seen.has(p.slug)) throw new Error(`Duplicate slug "${p.slug}"`);
    seen.add(p.slug);
  }

  return posts
    .filter((p) => includeDrafts || !p.draft)
    .sort((a, b) => b.date - a.date || a.slug.localeCompare(b.slug));
}

function buildSitemap(siteUrl, entries) {
  const body = entries
    .map(
      (e) =>
        `  <url>\n    <loc>${escapeHtml(canonicalUrl(siteUrl, e.path))}</loc>\n    <lastmod>${e.lastmod}</lastmod>\n  </url>`
    )
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

function buildRobots(siteUrl) {
  return `User-agent: *\nAllow: /\n\nSitemap: ${canonicalUrl(siteUrl, '/sitemap.xml')}\n`;
}

module.exports = {
  slugify,
  escapeHtml,
  formatDate,
  firstSentence,
  canonicalUrl,
  parsePost,
  loadPosts,
  buildSitemap,
  buildRobots,
};
