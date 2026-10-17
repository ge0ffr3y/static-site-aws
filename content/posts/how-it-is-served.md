---
title: "How this site is served"
date: 2026-02-03
tags: [aws, infrastructure]
---

The pages are plain HTML files in a private S3 bucket, and CloudFront is the only thing allowed to read them. Visitors never touch the bucket directly, so there is no public endpoint to misconfigure.

A small CloudFront Function maps clean URLs like `/blog/` to the `index.html` inside that folder, and a response-headers policy adds the usual security headers. Deploys use a role that can write to one bucket and invalidate one distribution, and nothing else.
