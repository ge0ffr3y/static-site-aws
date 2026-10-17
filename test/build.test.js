'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { build, readConfig } = require('../src/build');

function makeSite() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'site-'));
  const contentDir = path.join(root, 'content');
  const siteDir = path.join(root, 'site');
  const outDir = path.join(root, 'dist');
  fs.mkdirSync(contentDir, { recursive: true });
  fs.mkdirSync(siteDir, { recursive: true });
  fs.writeFileSync(path.join(siteDir, 'styles.css'), 'body{}');
  fs.writeFileSync(
    path.join(contentDir, 'first.md'),
    '---\ntitle: First <Post>\ndate: 2026-02-01\ntags: [a]\n---\nHello there. More text.'
  );
  fs.writeFileSync(
    path.join(contentDir, 'second.md'),
    '---\ntitle: Second\ndate: 2026-03-01\n---\nSecond post.'
  );
  fs.writeFileSync(
    path.join(contentDir, 'hidden.md'),
    '---\ntitle: Hidden\ndate: 2026-04-01\ndraft: true\n---\nNot yet.'
  );
  return { root, contentDir, siteDir, outDir };
}

const config = { siteUrl: 'https://example.com', title: 'Test Site', description: 'A test.', author: 'Tester', homePosts: 3 };

test('build writes every expected file and copies static assets', () => {
  const { root, contentDir, siteDir, outDir } = makeSite();
  try {
    build({ config, contentDir, siteDir, outDir });
    for (const f of [
      'index.html',
      'blog/index.html',
      'blog/first/index.html',
      'blog/second/index.html',
      '404.html',
      'sitemap.xml',
      'robots.txt',
      'styles.css',
    ]) {
      assert.ok(fs.existsSync(path.join(outDir, f)), `missing ${f}`);
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('drafts are excluded from pages and the sitemap', () => {
  const { root, contentDir, siteDir, outDir } = makeSite();
  try {
    build({ config, contentDir, siteDir, outDir });
    assert.ok(!fs.existsSync(path.join(outDir, 'blog/hidden/index.html')));
    assert.ok(!fs.readFileSync(path.join(outDir, 'sitemap.xml'), 'utf8').includes('hidden'));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('every page has exactly one canonical URL that matches its location and the sitemap', () => {
  const { root, contentDir, siteDir, outDir } = makeSite();
  try {
    build({ config, contentDir, siteDir, outDir });
    const sitemap = fs.readFileSync(path.join(outDir, 'sitemap.xml'), 'utf8');
    const locs = new Set([...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]));

    const pages = ['index.html', 'blog/index.html', 'blog/first/index.html', 'blog/second/index.html'];
    for (const page of pages) {
      const html = fs.readFileSync(path.join(outDir, page), 'utf8');
      const canon = [...html.matchAll(/<link rel="canonical" href="([^"]+)"/g)].map((m) => m[1]);
      assert.equal(canon.length, 1, `${page} should have one canonical tag`);
      const dir = path.dirname(page);
      const expected = 'https://example.com' + (dir === '.' ? '/' : `/${dir}/`);
      assert.equal(canon[0], expected, `${page} canonical`);
      assert.ok(locs.has(expected), `${expected} should be in the sitemap`);
    }
    assert.equal(locs.size, pages.length, 'sitemap should list exactly the built pages');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('the 404 page is marked noindex and kept out of the sitemap', () => {
  const { root, contentDir, siteDir, outDir } = makeSite();
  try {
    build({ config, contentDir, siteDir, outDir });
    assert.match(fs.readFileSync(path.join(outDir, '404.html'), 'utf8'), /name="robots" content="noindex"/);
    assert.ok(!fs.readFileSync(path.join(outDir, 'sitemap.xml'), 'utf8').includes('404'));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('titles from frontmatter are HTML-escaped', () => {
  const { root, contentDir, siteDir, outDir } = makeSite();
  try {
    build({ config, contentDir, siteDir, outDir });
    const html = fs.readFileSync(path.join(outDir, 'blog/first/index.html'), 'utf8');
    assert.ok(html.includes('First &lt;Post&gt;'));
    assert.ok(!html.includes('<Post>'));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('building twice gives byte-identical sitemaps', () => {
  const { root, contentDir, siteDir, outDir } = makeSite();
  try {
    build({ config, contentDir, siteDir, outDir });
    const first = fs.readFileSync(path.join(outDir, 'sitemap.xml'), 'utf8');
    build({ config, contentDir, siteDir, outDir });
    assert.equal(fs.readFileSync(path.join(outDir, 'sitemap.xml'), 'utf8'), first);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('readConfig normalizes siteUrl, accepts a SITE_URL override, and rejects bad URLs', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cfg-'));
  const file = path.join(dir, 'site.config.json');
  try {
    fs.writeFileSync(file, JSON.stringify({ siteUrl: 'https://example.com/', title: 'T' }));
    assert.equal(readConfig(file, {}).siteUrl, 'https://example.com');
    assert.equal(readConfig(file, { SITE_URL: 'https://other.dev/' }).siteUrl, 'https://other.dev');
    assert.throws(() => readConfig(file, { SITE_URL: 'not a url' }), /siteUrl must look like/);
    assert.throws(() => readConfig(file, { SITE_URL: 'https://example.com/sub/path' }), /siteUrl must look like/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
