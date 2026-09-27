import 'dotenv/config';
import http from 'http';
import app from './app.js';
import connectDB from './config/db.js';
import initSocket from './sockets/index.js';

const PORT = process.env.PORT || 5000;

const start = async () => {
  await connectDB();

  const server = http.createServer(app);
  const io = initSocket(server, process.env.CLIENT_URL || '*');
  app.set('io', io);

  server.listen(PORT, () => {
    console.log(`[server] AwaBus API listening on port ${PORT} (${process.env.NODE_ENV || 'development'})`);
  });
};

start();
