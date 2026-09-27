import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

let sharedSocket = null;

const getSocket = () => {
  if (!sharedSocket) {
    sharedSocket = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000', {
      transports: ['websocket', 'polling'],
      autoConnect: true,
    });
  }
  return sharedSocket;
};

// Subscribes to a socket.io event for the lifetime of the calling component.
export function useSocketEvent(event, handler) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const socket = getSocket();
    const listener = (...args) => handlerRef.current(...args);
    socket.on(event, listener);
    return () => socket.off(event, listener);
  }, [event]);
}

export default getSocket;
