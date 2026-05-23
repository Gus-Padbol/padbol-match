import React, { Component } from 'react';

/**
 * Evita que un fallo en el banner de sponsors tire abajo toda la página.
 */
export default class SponsorBannerSlotErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error, errorInfo) {
    console.warn('[SponsorBannerSlot] Error de render:', error?.message || error, errorInfo?.componentStack);
  }

  render() {
    if (this.state.failed) return null;
    return this.props.children;
  }
}
