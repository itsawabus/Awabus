import express from 'express';
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
import driverAppRoutes from './routes/driverAppRoutes.js';
import superadminRoutes from './routes/superadminRoutes.js';
import geocodeRoutes from './routes/geocodeRoutes.js';
import importRoutes from './routes/importRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';

const app = express();

const allowedOrigins = [
  process.env.CLIENT_URL,
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
app.use(express.urlencoded({ extended: true, limit: '5mb' }));
if (process.env.NODE_ENV !== 'test') app.use(morgan('dev'));

app.get('/api/health', (req, res) => res.json({ success: true, message: 'AwaBus API is running' }));

// Admin Portal API
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/routes', routeRoutes);
app.use('/api/buses', busRoutes);
app.use('/api/drivers', driverRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/guardians', guardianRoutes);
app.use('/api/trips', tripRoutes);
app.use('/api/tracking', trackingRoutes);
app.use('/api/superadmin', superadminRoutes);
app.use('/api/geocode', geocodeRoutes);
app.use('/api/import', importRoutes);
app.use('/api/notifications', notificationRoutes);

// Driver App API (mobile client not built yet, API is ready)
app.use('/api/driver-app', driverAppRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
