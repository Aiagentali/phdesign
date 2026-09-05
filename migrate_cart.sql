
-- Cart + installment migration (idempotent)
-- 1) Expand orders status to include cart
-- SQLite: need to recreate check constraint via new table? Easier: just allow cart via app layer, don't enforce DB check strictly
-- We'll recreate orders with cart allowed
CREATE TABLE IF NOT EXISTS _orders_new (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  type_name TEXT NOT NULL,
  base_price INTEGER NOT NULL,
  addons_json TEXT NOT NULL DEFAULT '[]',
  addons_price INTEGER NOT NULL DEFAULT 0,
  total_price INTEGER NOT NULL,
  days INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'cart' CHECK (status IN ('cart','pending','reviewing','in_progress','delivered','completed','cancelled')),
  customer_note TEXT,
  admin_note TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
INSERT OR IGNORE INTO _orders_new SELECT * FROM orders;
DROP TABLE IF EXISTS orders;
ALTER TABLE _orders_new RENAME TO orders;
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);

-- 2) Add payment_phase to payments
CREATE TABLE IF NOT EXISTS _payments_new (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id),
  method TEXT NOT NULL CHECK (method IN ('crypto','card')),
  amount INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','verified','rejected')),
  payment_phase TEXT NOT NULL DEFAULT 'full' CHECK (payment_phase IN ('deposit','remaining','full')),
  tx_hash TEXT,
  receipt_url TEXT,
  card_last4 TEXT,
  verified_by TEXT REFERENCES users(id),
  verified_at INTEGER,
  created_at INTEGER NOT NULL
);
INSERT OR IGNORE INTO _payments_new (id,order_id,user_id,method,amount,status,tx_hash,receipt_url,card_last4,verified_by,verified_at,created_at)
  SELECT id,order_id,user_id,method,amount,status,tx_hash,receipt_url,card_last4,verified_by,verified_at,created_at FROM payments;
DROP TABLE IF EXISTS payments;
ALTER TABLE _payments_new RENAME TO payments;
CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id);

-- 3) payment_terms setting
INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES ('payment_terms', '{"deposit_percent":50,"allow_deposit":true,"allow_full":true,"deposit_label":"بیعانه برای شروع پروژه","remaining_label":"تسویه پس از تحویل"}', strftime('%s','now'));
