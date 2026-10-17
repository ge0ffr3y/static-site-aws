// CloudFront Function (viewer-request).
//
// The bucket is private and read through the S3 REST endpoint, which has no notion of
// "directory index" documents. Map clean URLs to the files that actually exist:
//   /blog/        -> /blog/index.html
//   /blog         -> /blog/index.html
//   /styles.css   -> /styles.css   (has a file extension, left alone)
function handler(event) {
  var request = event.request;
  var uri = request.uri;

  if (uri.endsWith('/')) {
    request.uri = uri + 'index.html';
  } else if (uri.indexOf('.') === -1) {
    request.uri = uri + '/index.html';
  }

  return request;
}
