const express = require('express');
const path = require('path');
require('dotenv').config({ override: true });

const authRoutes = require('./routes/auth');
const millingRoutes = require('./routes/milling');
const inquiryRoutes = require('./routes/inquiry');
const contactRoutes = require('./routes/contact');
const millsRoutes = require('./routes/mills');
const productsRoutes = require('./routes/products');
const ownerProductsRoutes = require('./routes/owner-products');
const ordersRoutes = require('./routes/orders');
const notificationsRoutes = require('./routes/notifications');
const lineWebhookRoutes = require('./routes/lineWebhook');

const app = express();
const PORT = Number(process.env.RICE_PORT || process.env.PORT || 3000);

function extractLatLngFromGoogleMapsUrl(urlText) {
  const url = String(urlText || '').trim();
  if (!url) return null;

  // 1) .../@lat,lng,...
  let m = url.match(/@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/);
  if (m) return { lat: Number(m[1]), lng: Number(m[2]) };

  // 2) ...?q=lat,lng or ...?ll=lat,lng
  try {
    const u = new URL(url);
    const q = u.searchParams.get('q') || u.searchParams.get('ll');
    if (q) {
      const mm = q.match(/(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/);
      if (mm) return { lat: Number(mm[1]), lng: Number(mm[2]) };
    }
  } catch {
    // ignore
  }

  // 3) ...!3dLAT!4dLNG
  m = url.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
  if (m) return { lat: Number(m[1]), lng: Number(m[2]) };

  return null;
}

function isAllowedGoogleMapsUrl(urlObj) {
  if (!urlObj || urlObj.protocol !== 'https:') return false;
  const host = String(urlObj.hostname || '').toLowerCase();

  // allow Google Maps and the official short-link host
  if (host === 'maps.app.goo.gl') return true;
  if (host.endsWith('google.com')) return true;
  if (host.endsWith('google.co.th')) return true;
  return false;
}

function resolveRedirects(initialUrl, maxHops = 6) {
  const https = require('https');
  const http = require('http');

  return new Promise((resolve, reject) => {
    const visit = (currentUrl, hopsLeft) => {
      let u;
      try {
        u = new URL(currentUrl);
      } catch (e) {
        reject(e);
        return;
      }

      if (!isAllowedGoogleMapsUrl(u)) {
        reject(new Error('URL not allowed'));
        return;
      }

      const lib = u.protocol === 'https:' ? https : http;
      const req = lib.request(
        u,
        {
          method: 'GET',
          headers: {
            'User-Agent': 'rice-mill-website/1.0',
            'Accept': 'text/html,application/xhtml+xml'
          },
          timeout: 8000
        },
        (res) => {
          const status = res.statusCode || 0;
          const location = res.headers.location;

          // Drain minimal data and end
          res.resume();

          if ([301, 302, 303, 307, 308].includes(status) && location && hopsLeft > 0) {
            const nextUrl = new URL(location, u).toString();
            visit(nextUrl, hopsLeft - 1);
            return;
          }

          resolve(u.toString());
        }
      );

      req.on('timeout', () => {
        req.destroy(new Error('Request timeout'));
      });
      req.on('error', (err) => reject(err));
      req.end();
    };

    visit(String(initialUrl || ''), maxHops);
  });
}

process.on('unhandledRejection', (reason) => {
  console.error('UnhandledRejection:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('UncaughtException:', err);
});

app.use(express.json({
  limit: '2mb',
  verify: (req, res, buf) => {
    req.rawBody = Buffer.from(buf);
  },
}));
app.use(express.urlencoded({ extended: true }));

// Static site (HTML/CSS/JS will be served with correct Content-Type by Express)
app.use(express.static(path.join(__dirname, 'public')));

// APIs
app.get('/api/health', (req, res) => {
  res.json({ success: true, status: 'OK', timestamp: new Date().toISOString() });
});

// Resolve Google Maps short links (maps.app.goo.gl) and extract coordinates
app.get('/api/utils/resolve-maps', async (req, res) => {
  const raw = String(req.query.url || '').trim();
  if (!raw) return res.status(400).json({ success: false, message: 'Missing url' });
  if (raw.length > 2000) return res.status(400).json({ success: false, message: 'URL too long' });

  let u;
  try {
    u = new URL(raw);
  } catch {
    return res.status(400).json({ success: false, message: 'Invalid url' });
  }
  if (!isAllowedGoogleMapsUrl(u)) {
    return res.status(400).json({ success: false, message: 'URL not allowed' });
  }

  try {
    const finalUrl = await resolveRedirects(u.toString());
    const coords = extractLatLngFromGoogleMapsUrl(finalUrl);
    res.json({ success: true, finalUrl, ...(coords ? coords : {}) });
  } catch (err) {
    console.error('resolve-maps failed:', err);
    res.status(500).json({ success: false, message: 'Resolve failed' });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/milling-requests', millingRoutes);
app.use('/api/inquiries', inquiryRoutes);
app.use('/api/contacts', contactRoutes);
app.use('/api/mills', millsRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/owner/products', ownerProductsRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/webhook/line', lineWebhookRoutes);

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));

// Multipage fallback: serve index.html for unknown paths that aren't /api
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.status(404).sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ success: false, message: 'Server error' });
});

console.log('PORT ->', PORT);
app.listen(PORT, () => {
  console.log(`✅ Server running: http://localhost:${PORT}`);
});
