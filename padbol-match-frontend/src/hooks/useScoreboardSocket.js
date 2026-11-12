import { useCallback, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { API_BASE } from '../utils/scoreboardApi';

export default function useScoreboardSocket(partidoId, onUpdate, accessToken = null) {
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

    const qaPolling = process.env.REACT_APP_APP_VARIANT === 'qa' && process.env.REACT_APP_QA_SOCKET_POLLING === 'true';
    const socket = io(API_BASE, {
      transports: qaPolling ? ['polling'] : ['polling', 'websocket'],
      ...(qaPolling ? { upgrade: false, addTrailingSlash: false } : {}),
      reconnection: true,
      reconnectionAttempts: Infinity,
      path: qaPolling ? '/api/qa-socket' : '/socket.io',
      ...(accessToken ? {auth:{token:accessToken}} : {}),
    });
    socketRef.current = socket;

    const joinRoom = () => {
      socket.emit('scoreboard:join', { partidoId });
    };

    socket.on('connect', () => {
      setConnected(true);
      joinRoom();
    });

    socket.on('scoreboard:access-denied', () => setConnected(false));

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
  }, [partidoId,accessToken]);

  return { connected, reconnect };
}
