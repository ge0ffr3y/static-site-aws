'use strict';

// Tests the CloudFront Function that Terraform deploys, by loading the very same file.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(
  path.join(__dirname, '..', 'infra', 'terraform', 'functions', 'index-rewrite.js'),
  'utf8'
);

function rewrite(uri) {
  const sandbox = {};
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  return sandbox.handler({ request: { uri } }).uri;
}

test('directory URLs map to their index.html', () => {
  assert.equal(rewrite('/'), '/index.html');
  assert.equal(rewrite('/blog/'), '/blog/index.html');
  assert.equal(rewrite('/blog/my-post/'), '/blog/my-post/index.html');
});

test('URLs without a trailing slash or extension also map to index.html', () => {
  assert.equal(rewrite('/blog'), '/blog/index.html');
  assert.equal(rewrite('/blog/my-post'), '/blog/my-post/index.html');
});

test('files with an extension are left alone', () => {
  assert.equal(rewrite('/styles.css'), '/styles.css');
  assert.equal(rewrite('/sitemap.xml'), '/sitemap.xml');
  assert.equal(rewrite('/images/photo.webp'), '/images/photo.webp');
  assert.equal(rewrite('/404.html'), '/404.html');
});

test('every page the build produces is reachable through the rewrite', () => {
  // The build writes <path>/index.html for each page, and the rewrite must map each
  // public URL back to exactly that file.
  const { build } = require('../src/build');
  const os = require('node:os');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'reach-'));
  try {
    const contentDir = path.join(root, 'content');
    fs.mkdirSync(contentDir);
    fs.writeFileSync(path.join(contentDir, 'a-post.md'), '---\ntitle: A\ndate: 2026-01-01\n---\nHi.');
    const outDir = path.join(root, 'dist');
    const config = { siteUrl: 'https://example.com', title: 'T', description: 'D', author: 'A', homePosts: 3 };
    const { sitemapPaths } = build({ config, contentDir, siteDir: path.join(root, 'none'), outDir });
    for (const urlPath of sitemapPaths) {
      const key = rewrite(urlPath).replace(/^\//, '');
      assert.ok(fs.existsSync(path.join(outDir, key)), `${urlPath} -> ${key} should exist in the build output`);
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
