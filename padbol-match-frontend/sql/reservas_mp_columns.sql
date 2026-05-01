-- Opcional: datos de pago Mercado Pago en reservas (Mi perfil / comprobantes).
alter table public.reservas add column if not exists moneda text;
alter table public.reservas add column if not exists monto_pagado numeric;
alter table public.reservas add column if not exists mp_payment_id text;
alter table public.reservas add column if not exists mp_comprobante_url text;
