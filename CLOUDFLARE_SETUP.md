# Cloudflare Setup Guide for Ghana Card Detector

This guide explains how to set up Cloudflare R2 storage and Workers to distribute your Ghana Card Detector package.

## Prerequisites

1. A Cloudflare account
2. Cloudflare R2 storage enabled on your account
3. Cloudflare Workers enabled on your account

## Step 1: Create R2 Storage Bucket

1. Log in to your Cloudflare dashboard
2. Navigate to R2 from the sidebar
3. Click "Create bucket"
4. Name your bucket (e.g., `ghana-card-detector-assets`)
5. Click "Create bucket"

## Step 2: Generate API Tokens

For GitHub Actions to upload to your R2 bucket:

1. Go to "Account Home" > "R2" > "Manage R2 API Tokens"
2. Create a new API token with read and write permissions
3. Store the Access Key ID and Secret Access Key safely

## Step 3: Add Secrets to GitHub Repository

Add the following secrets to your GitHub repository:

- `CLOUDFLARE_ACCESS_KEY_ID`: Your R2 access key ID
- `CLOUDFLARE_SECRET_ACCESS_KEY`: Your R2 secret access key
- `CLOUDFLARE_ACCOUNT_ID`: Your Cloudflare account ID
- `CLOUDFLARE_BUCKET_NAME`: Your R2 bucket name
- `NPM_TOKEN`: Your NPM access token (if publishing to NPM)

## Step 4: Create a Cloudflare Worker for Distribution

1. Go to "Workers & Pages" in your Cloudflare dashboard
2. Click "Create application" and select "Worker"
3. Create a new Worker with the following code:

```js
// ghana-card-detector-worker.js
const R2_BUCKET = 'ghana-card-detector-assets';
const PACKAGE_NAME = 'ghana-card-detector';
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
  async fetch(request, env) {
    // Handle OPTIONS request for CORS
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: CORS_HEADERS,
      });
    }

    // Parse the URL and pathname
    const url = new URL(request.url);
    const pathname = url.pathname;

    // Extract the requested version and file
    // Path format: /ghana-card-detector/[version]/[file]
    const pathSegments = pathname.split('/').filter(segment => segment);
    
    if (pathSegments.length < 2 || pathSegments[0] !== PACKAGE_NAME) {
      return new Response('Not found', { status: 404 });
    }

    const version = pathSegments[1];
    const file = pathSegments.slice(2).join('/') || 'index.js';
    
    const objectKey = `${PACKAGE_NAME}/${version}/${file}`;
    
    try {
      // Get the file from R2
      const object = await env.ASSETS.get(objectKey);
      
      if (object === null) {
        return new Response('Not found', { status: 404 });
      }
      
      // Determine content type based on file extension
      const contentType = getContentType(file);
      
      // Return the file with appropriate headers
      const headers = {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400',
        ...CORS_HEADERS
      };
      
      return new Response(object.body, { headers });
    } catch (error) {
      return new Response('Internal error: ' + error.message, { status: 500 });
    }
  }
};

// Helper function to determine content type
function getContentType(filename) {
  const extension = filename.split('.').pop().toLowerCase();
  
  const contentTypes = {
    'js': 'application/javascript',
    'mjs': 'application/javascript',
    'css': 'text/css',
    'html': 'text/html',
    'json': 'application/json',
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'svg': 'image/svg+xml',
    'tflite': 'application/octet-stream',
    'md': 'text/markdown',
  };
  
  return contentTypes[extension] || 'application/octet-stream';
}
```

4. Go to the Worker settings and bind your R2 bucket:
   - Create an R2 binding named "ASSETS" pointing to your R2 bucket

## Step 5: Configure a Custom Domain (Optional)

1. Go to your Worker settings
2. Navigate to "Triggers" > "Custom Domains"
3. Add a custom domain (e.g., `cdn.yourcompany.com`)
4. Set up the appropriate DNS records

## Usage

After deployment, your package will be available at:

```
https://[your-worker-domain]/ghana-card-detector/latest/index.js
```

Or for a specific version:

```
https://[your-worker-domain]/ghana-card-detector/1.0.0/index.js
```

## CDN Integration in HTML

```html
<script src="https://cdn.yourcompany.com/ghana-card-detector/latest/index.js"></script>
<script>
  document.addEventListener('DOMContentLoaded', async () => {
    const detector = new GhanaCardDetector({
      modelPath: 'https://cdn.yourcompany.com/ghana-card-detector/latest/models/autocapture.tflite'
    });
    
    await detector.initialize();
  });
</script>
```

## Updating the Package

When you create a new release in GitHub or manually trigger the release workflow, the package will be automatically uploaded to both NPM and your Cloudflare R2 storage.