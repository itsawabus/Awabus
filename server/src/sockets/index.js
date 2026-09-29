import { Server } from 'socket.io';
import { startTripSimulator } from './tripSimulator.js';
import { socketAuth } from './auth.js';

export const initSocket = (httpServer, corsOrigin) => {
  const io = new Server(httpServer, {
    cors: { origin: corsOrigin, credentials: true },
  });

  // Only signed-in admins may connect; each hears only its own school.
  io.use(socketAuth);

  startTripSimulator(io);

  return io;
};

export default initSocket;
