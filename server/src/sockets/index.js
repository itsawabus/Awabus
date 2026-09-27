import { Server } from 'socket.io';
import { startTripSimulator } from './tripSimulator.js';

export const initSocket = (httpServer, corsOrigin) => {
  const io = new Server(httpServer, {
    cors: { origin: corsOrigin, credentials: true },
  });

  io.on('connection', (socket) => {
    console.log(`[socket] client connected: ${socket.id}`);
    socket.on('disconnect', () => console.log(`[socket] client disconnected: ${socket.id}`));
  });

  startTripSimulator(io);

  return io;
};

export default initSocket;
