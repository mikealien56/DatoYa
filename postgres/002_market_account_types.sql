-- Separación persistente entre cuentas cliente, negocio y administrador.
-- Migración aditiva e idempotente: no elimina ni reescribe datos comerciales.
CREATE TABLE IF NOT EXISTS market_account_types (
  user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  account_type TEXT NOT NULL DEFAULT 'customer'
    CHECK (account_type IN ('customer', 'business', 'admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Clasifica solamente cuentas que todavía no tengan tipo explícito.
INSERT INTO market_account_types (user_id, account_type)
SELECT u.id,
       CASE
         WHEN u.role = 'admin' THEN 'admin'
         WHEN EXISTS (
           SELECT 1 FROM businesses b WHERE b.owner_user_id = u.id
         ) THEN 'business'
         ELSE 'customer'
       END
FROM users u
ON CONFLICT (user_id) DO NOTHING;

-- Los invariantes administrativos y de propiedad prevalecen sobre valores legacy.
UPDATE market_account_types m
SET account_type = 'admin', updated_at = CURRENT_TIMESTAMP
FROM users u
WHERE u.id = m.user_id
  AND u.role = 'admin'
  AND m.account_type <> 'admin';

UPDATE market_account_types m
SET account_type = 'business', updated_at = CURRENT_TIMESTAMP
WHERE m.account_type <> 'admin'
  AND EXISTS (
    SELECT 1 FROM businesses b WHERE b.owner_user_id = m.user_id
  );

CREATE INDEX IF NOT EXISTS idx_market_account_types_type
  ON market_account_types(account_type);
