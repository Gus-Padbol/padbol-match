import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { API_BASE } from '../utils/scoreboardApi';

export default function useScoreboardSocket(partidoId, onUpdate) {
  const callbackRef = useRef(onUpdate);
  callbackRef.current = onUpdate;

  useEffect(() => {
    if (!partidoId) return undefined;

    const socket = io(API_BASE, {
      transports: ['websocket', 'polling'],
      reconnection: true,
    });

    socket.emit('scoreboard:join', { partidoId });

    socket.on('scoreboard:update', (payload) => {
      if (callbackRef.current) callbackRef.current(payload);
    });

    return () => {
      socket.emit('scoreboard:leave', { partidoId });
      socket.disconnect();
    };
  }, [partidoId]);
}
