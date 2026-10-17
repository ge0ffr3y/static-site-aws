'use strict';

const { escapeHtml, canonicalUrl } = require('./lib');

function layout(config, { title, description, urlPath, body, noindex = false }) {
  const fullTitle = title === config.title ? config.title : `${title} | ${config.title}`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(fullTitle)}</title>
  <meta name="description" content="${escapeHtml(description)}" />
  <link rel="canonical" href="${escapeHtml(canonicalUrl(config.siteUrl, urlPath))}" />${
    noindex ? '\n  <meta name="robots" content="noindex" />' : ''
  }
  <link rel="stylesheet" href="/styles.css" />
</head>
<body>
  <header class="site-header">
    <a class="site-title" href="/">${escapeHtml(config.title)}</a>
    <nav><a href="/blog/">Blog</a></nav>
  </header>
  <main>
${body}
  </main>
  <footer class="site-footer">
    <p>&copy; ${new Date().getUTCFullYear()} ${escapeHtml(config.author)}</p>
  </footer>
</body>
</html>
`;
}

function tagList(tags) {
  if (!tags.length) return '';
  return `<ul class="tags">${tags.map((t) => `<li>${escapeHtml(t)}</li>`).join('')}</ul>`;
}

function postCard(post) {
  return `    <article class="card">
      <p class="meta">${post.dateDisplay}</p>
      <h2><a href="/blog/${post.slug}/">${escapeHtml(post.title)}</a></h2>
      <p>${escapeHtml(post.excerpt)}</p>
    </article>`;
}

function homePage(config, posts) {
  const recent = posts.slice(0, config.homePosts);
  const list = recent.length
    ? recent.map(postCard).join('\n')
    : '    <p>No posts yet.</p>';
  const body = `    <h1>${escapeHtml(config.title)}</h1>
    <p class="lede">${escapeHtml(config.description)}</p>
    <h2 class="section">Recent posts</h2>
${list}
    <p><a href="/blog/">All posts &rarr;</a></p>`;
  return layout(config, {
    title: config.title,
    description: config.description,
    urlPath: '/',
    body,
  });
}

function blogIndex(config, posts) {
  const list = posts.length ? posts.map(postCard).join('\n') : '    <p>No posts yet.</p>';
  const body = `    <h1>Blog</h1>\n${list}`;
  return layout(config, {
    title: 'Blog',
    description: `Posts from ${config.title}.`,
    urlPath: '/blog/',
    body,
  });
}

function postPage(config, post) {
  const body = `    <article class="post">
      <p class="meta">${post.dateDisplay}</p>
      <h1>${escapeHtml(post.title)}</h1>
      ${tagList(post.tags)}
      <div class="post-body">
${post.html}
      </div>
    </article>`;
  return layout(config, {
    title: post.title,
    description: post.excerpt,
    urlPath: `/blog/${post.slug}/`,
    body,
  });
}

function notFoundPage(config) {
  const body = `    <h1>Page not found</h1>
    <p>That page doesn't exist. <a href="/">Back to the home page</a>.</p>`;
  return layout(config, {
    title: 'Page not found',
    description: 'Page not found.',
    urlPath: '/404.html',
    body,
    noindex: true,
  });
}

module.exports = { layout, homePage, blogIndex, postPage, notFoundPage };
