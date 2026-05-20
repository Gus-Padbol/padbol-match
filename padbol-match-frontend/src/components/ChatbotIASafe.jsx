import React, { Component, Suspense, lazy } from 'react';

function isTensorFlowKernelNoise(err) {
  const msg = String(err?.message || err || '');
  return /kernel.*already registered/i.test(msg) || /tensorflow|@tensorflow|tfjs/i.test(msg);
}

/**
 * Carga el asistente en chunk aparte. Si el módulo falla (p. ej. TF/WebGL duplicado),
 * la app sigue funcionando sin el FAB del chatbot.
 */
const ChatbotIALazy = lazy(() =>
  import('./ChatbotIA').catch((err) => {
    if (!isTensorFlowKernelNoise(err)) {
      console.warn('[Padbol] Chatbot IA: no se pudo cargar el módulo.', err);
    }
    return { default: function ChatbotIADisabled() {
      return null;
    } };
  }),
);

class ChatbotErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error, errorInfo) {
    if (!isTensorFlowKernelNoise(error)) {
      console.warn('[Padbol] Chatbot IA: error de render.', error, errorInfo?.componentStack);
    }
  }

  render() {
    if (this.state.failed) return null;
    return this.props.children;
  }
}

/** Wrapper seguro: lazy + boundary; fallos silenciosos. */
export default function ChatbotIASafe() {
  return (
    <ChatbotErrorBoundary>
      <Suspense fallback={null}>
        <ChatbotIALazy />
      </Suspense>
    </ChatbotErrorBoundary>
  );
}
