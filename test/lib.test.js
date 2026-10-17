'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  slugify,
  escapeHtml,
  formatDate,
  firstSentence,
  canonicalUrl,
  parsePost,
  loadPosts,
  buildSitemap,
  buildRobots,
} = require('../src/lib');

test('slugify makes URL-safe slugs', () => {
  assert.equal(slugify('Hello, World!'), 'hello-world');
  assert.equal(slugify('  Spaces   and --- dashes  '), 'spaces-and-dashes');
  assert.equal(slugify('!!!'), '');
});

test('escapeHtml escapes the characters that matter', () => {
  assert.equal(escapeHtml('<a href="x">&</a>'), '&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;');
});

test('formatDate never rolls back a day, whatever the machine timezone', () => {
  const original = process.env.TZ;
  try {
    for (const tz of ['America/Los_Angeles', 'UTC', 'Pacific/Auckland']) {
      process.env.TZ = tz;
      assert.equal(formatDate('2026-07-24'), 'Jul 24, 2026', `wrong date in ${tz}`);
      assert.equal(formatDate(new Date('2026-07-24')), 'Jul 24, 2026', `wrong date in ${tz}`);
    }
  } finally {
    if (original === undefined) delete process.env.TZ;
    else process.env.TZ = original;
  }
});

test('firstSentence stops at the first sentence end', () => {
  assert.equal(firstSentence('One. Two. Three.'), 'One.');
  assert.equal(firstSentence('Is this a question? Yes.'), 'Is this a question?');
});

test('firstSentence does not split inside a decimal number', () => {
  assert.equal(
    firstSentence('Unemployment is about 4.2% right now. It changes monthly.'),
    'Unemployment is about 4.2% right now.'
  );
});

test('firstSentence strips Markdown formatting', () => {
  assert.equal(
    firstSentence('Some **bold** text and a [link](https://example.com) here. More.'),
    'Some bold text and a link here.'
  );
  assert.equal(firstSentence('![alt](img.png)A caption-less start. Next.'), 'A caption-less start.');
});

test('canonicalUrl joins cleanly regardless of slashes', () => {
  assert.equal(canonicalUrl('https://example.com', '/blog/'), 'https://example.com/blog/');
  assert.equal(canonicalUrl('https://example.com/', 'blog/'), 'https://example.com/blog/');
});

test('parsePost requires a title and a valid date', () => {
  assert.throws(() => parsePost('---\ndate: 2026-01-01\n---\nBody.', 'a.md'), /missing "title"/);
  assert.throws(() => parsePost('---\ntitle: A\n---\nBody.', 'a.md'), /missing "date"/);
  assert.throws(
    () => parsePost('---\ntitle: A\ndate: not-a-date\n---\nBody.', 'a.md'),
    /invalid "date"/
  );
});

test('parsePost derives slug and excerpt, and honors overrides', () => {
  const derived = parsePost('---\ntitle: A Post\ndate: 2026-01-01\n---\nFirst sentence. Second.', 'my-post.md');
  assert.equal(derived.slug, 'my-post');
  assert.equal(derived.excerpt, 'First sentence.');
  assert.equal(derived.isoDate, '2026-01-01');

  const overridden = parsePost(
    '---\ntitle: A\ndate: 2026-01-01\nslug: Custom Slug\nexcerpt: Hand written.\ntags: [x, y]\n---\nBody.',
    'ignored.md'
  );
  assert.equal(overridden.slug, 'custom-slug');
  assert.equal(overridden.excerpt, 'Hand written.');
  assert.deepEqual(overridden.tags, ['x', 'y']);
});

function withPosts(files, fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'posts-'));
  try {
    for (const [name, body] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), body);
    return fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('loadPosts sorts newest first and skips drafts', () => {
  withPosts(
    {
      'old.md': '---\ntitle: Old\ndate: 2026-01-01\n---\nOld.',
      'new.md': '---\ntitle: New\ndate: 2026-03-01\n---\nNew.',
      'wip.md': '---\ntitle: WIP\ndate: 2026-04-01\ndraft: true\n---\nWip.',
    },
    (dir) => {
      assert.deepEqual(loadPosts(dir).map((p) => p.slug), ['new', 'old']);
      assert.deepEqual(loadPosts(dir, { includeDrafts: true }).map((p) => p.slug), ['wip', 'new', 'old']);
    }
  );
});

test('loadPosts breaks date ties by slug so builds are deterministic', () => {
  withPosts(
    {
      'b.md': '---\ntitle: B\ndate: 2026-01-01\n---\nB.',
      'a.md': '---\ntitle: A\ndate: 2026-01-01\n---\nA.',
    },
    (dir) => assert.deepEqual(loadPosts(dir).map((p) => p.slug), ['a', 'b'])
  );
});

test('loadPosts rejects duplicate slugs', () => {
  withPosts(
    {
      'one.md': '---\ntitle: One\ndate: 2026-01-01\nslug: same\n---\nOne.',
      'two.md': '---\ntitle: Two\ndate: 2026-01-02\nslug: same\n---\nTwo.',
    },
    (dir) => assert.throws(() => loadPosts(dir), /Duplicate slug "same"/)
  );
});

test('loadPosts returns an empty list when the folder is missing', () => {
  assert.deepEqual(loadPosts(path.join(os.tmpdir(), 'definitely-not-here-xyz')), []);
});

test('buildSitemap and buildRobots use absolute canonical URLs', () => {
  const xml = buildSitemap('https://example.com', [
    { path: '/', lastmod: '2026-01-01' },
    { path: '/blog/a&b/', lastmod: '2026-01-02' },
  ]);
  assert.match(xml, /<loc>https:\/\/example\.com\/<\/loc>/);
  assert.match(xml, /<loc>https:\/\/example\.com\/blog\/a&amp;b\/<\/loc>/);
  assert.match(buildRobots('https://example.com'), /Sitemap: https:\/\/example\.com\/sitemap\.xml/);
});
