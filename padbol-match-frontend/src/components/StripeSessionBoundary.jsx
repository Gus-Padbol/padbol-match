import React from 'react';

/** Recreate the payment UI whenever any booking or authorization input changes.
 * The server must still validate the amount and the booking before charging. */
export default function StripeSessionBoundary({identity,children}) {
  return React.cloneElement(React.Children.only(children), {key: JSON.stringify(identity)});
}
