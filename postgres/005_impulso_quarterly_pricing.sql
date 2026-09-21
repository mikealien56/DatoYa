-- DatoYa Impulso: agrega plan de 3 meses y ajusta oferta anual.
ALTER TABLE business_impulse_memberships
  DROP CONSTRAINT IF EXISTS business_impulse_memberships_billing_period_check;
ALTER TABLE business_impulse_memberships
  ADD CONSTRAINT business_impulse_memberships_billing_period_check
  CHECK (billing_period IN ('gift','monthly','quarterly','annual'));

ALTER TABLE business_impulse_payments
  DROP CONSTRAINT IF EXISTS business_impulse_payments_billing_period_check;
ALTER TABLE business_impulse_payments
  ADD CONSTRAINT business_impulse_payments_billing_period_check
  CHECK (billing_period IN ('monthly','quarterly','annual'));

INSERT INTO settings(key,value) VALUES('impulso_quarterly_price','26990')
ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value;

INSERT INTO settings(key,value) VALUES('impulso_annual_price','89990')
ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value;
