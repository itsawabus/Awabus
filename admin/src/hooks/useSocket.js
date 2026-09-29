import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { useAuthStore } from '../store/authStore.js';
import { useViewSchoolStore } from '../store/viewSchoolStore.js';

let sharedSocket = null;

const isLocal = (host) => /^(localhost|127\.0\.0\.1|\[::1\])$/.test(host);

// Where the live-update server is. A localhost address only works when the
// page itself is open on localhost; anywhere else (a Codespace, a phone on the
// network) the page's own address is used and the dev server forwards
// /socket.io to the API (see vite.config.js).
function socketUrl() {
  const configured = import.meta.env.VITE_SOCKET_URL;
  if (!configured) return undefined; // same address as the page
  try {
    if (isLocal(new URL(configured).hostname) && !isLocal(window.location.hostname)) return undefined;
  } catch {
    /* not a full URL: use it as given */
  }
  return configured;
}

// The server only accepts signed-in admins and puts each connection in its
// school's room, so the connection carries the sign-in token (and, for a
// superadmin, the school being viewed). Read fresh on every (re)connect.
const currentAuth = () => ({
  token: useAuthStore.getState().token,
  viewSchool: useViewSchoolStore.getState().school?.id,
});

// Reconnect when the account or the viewed school changes, so live updates
// always belong to what is on screen. Signed out: stay disconnected.
const reconnect = () => {
  if (!sharedSocket) return;
  sharedSocket.disconnect();
  if (currentAuth().token) sharedSocket.connect();
};

const getSocket = () => {
  if (!sharedSocket) {
    sharedSocket = io(socketUrl(), {
      transports: ['websocket', 'polling'],
      autoConnect: false,
      auth: (cb) => cb(currentAuth()),
    });
    if (currentAuth().token) sharedSocket.connect();
    useAuthStore.subscribe((s, prev) => s.token !== prev.token && reconnect());
    useViewSchoolStore.subscribe((s, prev) => s.school?.id !== prev.school?.id && reconnect());
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
