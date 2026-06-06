import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { API_BASE } from '../utils/scoreboardApi';

export default function useScoreboardSocket(partidoId, onUpdate) {
  const callbackRef = useRef(onUpdate);
  callbackRef.current = onUpdate;
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!partidoId) {
      setConnected(false);
      return undefined;
    }

    const socket = io(API_BASE, {
      transports: ['polling', 'websocket'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      path: '/socket.io',
    });

    const joinRoom = () => {
      socket.emit('scoreboard:join', { partidoId });
    };

    socket.on('connect', () => {
      setConnected(true);
      joinRoom();
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    socket.io.on('reconnect', joinRoom);

    socket.on('scoreboard:update', (payload) => {
      if (callbackRef.current) callbackRef.current(payload);
    });

    if (socket.connected) {
      setConnected(true);
      joinRoom();
    }

    return () => {
      socket.emit('scoreboard:leave', { partidoId });
      socket.disconnect();
      setConnected(false);
    };
  }, [partidoId]);

  return connected;
}
