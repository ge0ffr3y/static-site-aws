#!/usr/bin/env node
'use strict';

// Builds the site into dist/: pages, a sitemap, and robots.txt. Static files in site/
// (CSS, images, anything else) are copied through unchanged.

const fs = require('fs');
const path = require('path');
const { loadPosts, buildSitemap, buildRobots } = require('./lib');
const { homePage, blogIndex, postPage, notFoundPage } = require('./templates');

function readConfig(configPath, env = process.env) {
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  // SITE_URL lets CI or a deploy override the URL without editing the file.
  const siteUrl = String(env.SITE_URL || config.siteUrl || '').replace(/\/+$/, '');
  if (!/^https?:\/\/[^/]+$/.test(siteUrl)) {
    throw new Error(`siteUrl must look like https://example.com (got "${siteUrl}")`);
  }
  return { homePosts: 3, ...config, siteUrl };
}

function writeFile(outDir, relPath, contents) {
  const full = path.join(outDir, relPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, contents);
}

function build({ config, contentDir, siteDir, outDir }) {
  const posts = loadPosts(contentDir);

  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  if (fs.existsSync(siteDir)) fs.cpSync(siteDir, outDir, { recursive: true });

  writeFile(outDir, 'index.html', homePage(config, posts));
  writeFile(outDir, 'blog/index.html', blogIndex(config, posts));
  for (const post of posts) {
    writeFile(outDir, `blog/${post.slug}/index.html`, postPage(config, post));
  }
  writeFile(outDir, '404.html', notFoundPage(config));

  // Dates come from the posts themselves, so the sitemap is the same on every build.
  const newest = posts.length ? posts[0].isoDate : new Date().toISOString().slice(0, 10);
  const entries = [
    { path: '/', lastmod: newest },
    { path: '/blog/', lastmod: newest },
    ...posts.map((p) => ({ path: `/blog/${p.slug}/`, lastmod: p.isoDate })),
  ];
  writeFile(outDir, 'sitemap.xml', buildSitemap(config.siteUrl, entries));
  writeFile(outDir, 'robots.txt', buildRobots(config.siteUrl));

  return { posts, sitemapPaths: entries.map((e) => e.path) };
}

if (require.main === module) {
  const root = path.resolve(__dirname, '..');
  const config = readConfig(path.join(root, 'site.config.json'));
  const result = build({
    config,
    contentDir: path.join(root, 'content', 'posts'),
    siteDir: path.join(root, 'site'),
    outDir: path.join(root, 'dist'),
  });
  console.log(`Built ${result.posts.length} post(s) for ${config.siteUrl} into dist/`);
  for (const p of result.sitemapPaths) console.log(`  ${p}`);
}

module.exports = { build, readConfig };
