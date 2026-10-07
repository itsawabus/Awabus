import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cors from 'cors';
import morgan from 'morgan';

import authRoutes from './routes/authRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import routeRoutes from './routes/routeRoutes.js';
import busRoutes from './routes/busRoutes.js';
import driverRoutes from './routes/driverRoutes.js';
import studentRoutes from './routes/studentRoutes.js';
import guardianRoutes from './routes/guardianRoutes.js';
import tripRoutes from './routes/tripRoutes.js';
import trackingRoutes from './routes/trackingRoutes.js';
import webhookRoutes from './routes/webhookRoutes.js';
import schoolRoutes from './routes/schoolRoutes.js';
import driverAppRoutes from './routes/driverAppRoutes.js';
import superadminRoutes from './routes/superadminRoutes.js';
import geocodeRoutes from './routes/geocodeRoutes.js';
import importRoutes from './routes/importRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';
import { sanitizeBody } from './middleware/sanitize.js';
import assistRoutes from './routes/assistRoutes.js';

const app = express();
// Query strings are parsed as plain text values only (no ?a[$ne]=x objects).
app.set('query parser', 'simple');
app.disable('x-powered-by');
// Behind one proxy (Render, Codespaces): use the caller's real IP for rate limits.
app.set('trust proxy', 1);

// Basic security headers for an API that only serves JSON.
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  if (process.env.NODE_ENV === 'production') res.setHeader('Strict-Transport-Security', 'max-age=15552000');
  next();
});

const allowedOrigins = [
  process.env.CLIENT_URL,
  process.env.CLIENT_URL2,
  process.env.DEPLOYED_URL,
  process.env.CODESPACE_URL,
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    callback(new Error(`Not allowed by CORS: ${origin}`));
  },
  credentials: true,
}));
// Profile photos are sent inline as (client-resized) data URLs, so allow more
// than Express's 100kb default.
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: false, limit: '5mb' }));
app.use(sanitizeBody);
if (process.env.NODE_ENV !== 'test') app.use(morgan('dev'));

// `features` tells apart servers running different code (e.g. the deployed
// server vs. a Codespace on a branch): open /api/health on each to compare.
app.get('/api/health', (req, res) =>
  res.json({ success: true, message: 'AwaBus API is running', features: ['runs', 'arrival-calls', 'driver-online', 'call-status', 'nearest-first'] })
);

// Admin Portal API
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/routes', routeRoutes);
app.use('/api/buses', busRoutes);
app.use('/api/drivers', driverRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/guardians', guardianRoutes);
app.use('/api/trips', tripRoutes);
// Bus assistant page (teacher on bus duty, via the driver's QR code)
app.use('/api/assist', assistRoutes);
app.use('/api/tracking', trackingRoutes);
app.use('/api/superadmin', superadminRoutes);
app.use('/api/geocode', geocodeRoutes);
app.use('/api/import', importRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/school', schoolRoutes);
// Results sent back by outside services (voice call status)
app.use('/api/webhooks', webhookRoutes);

// Driver App API (mobile client not built yet, API is ready)
app.use('/api/driver-app', driverAppRoutes);

// Public audio for arrival calls: the server fetches it from here and uploads it
// to Arkesel. Only this folder is served; ARKESEL_VOICE_FILE_URL points to it.
app.use('/voice', express.static(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'voice'), { index: false, fallthrough: true, maxAge: '1h' }));

app.use(notFound);
app.use(errorHandler);

export default app;
