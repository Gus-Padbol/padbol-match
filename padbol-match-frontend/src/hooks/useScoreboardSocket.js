import { useCallback, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { API_BASE } from '../utils/scoreboardApi';

export default function useScoreboardSocket(partidoId, onUpdate) {
  const callbackRef = useRef(onUpdate);
  callbackRef.current = onUpdate;
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);

  const reconnect = useCallback(() => {
    const socket = socketRef.current;
    if (!socket || !partidoId) return;
    if (!socket.connected) {
      socket.connect();
    }
    socket.emit('scoreboard:join', { partidoId });
  }, [partidoId]);

  useEffect(() => {
    if (!partidoId) {
      socketRef.current = null;
      setConnected(false);
      return undefined;
    }

    const socket = io(API_BASE, {
      transports: ['polling', 'websocket'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      path: '/socket.io',
    });
    socketRef.current = socket;

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
      socketRef.current = null;
      setConnected(false);
    };
  }, [partidoId]);

  return { connected, reconnect };
}
