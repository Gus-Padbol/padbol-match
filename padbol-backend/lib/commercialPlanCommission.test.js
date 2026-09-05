import test from 'node:test';
import assert from 'node:assert/strict';
import { commercialCommissionMinor, commercialCommissionPercent } from './commercialPlanCommission.js';

test('usa el porcentaje comercial de cada plan', () => {
  assert.equal(commercialCommissionPercent('starter'), 1);
  assert.equal(commercialCommissionPercent('pro'), 0.65);
  assert.equal(commercialCommissionPercent('business'), 0.35);
});

test('la comisión se descuenta del cobro y no se suma al total del jugador', () => {
  const amountPaidByPlayer = 10000;
  assert.equal(commercialCommissionMinor(amountPaidByPlayer, 'starter'), 100);
  assert.equal(amountPaidByPlayer, 10000);
});

test('Business admite un porcentaje contractual explícito', () => {
  assert.equal(commercialCommissionMinor(10000, 'business', 0.2), 20);
});
