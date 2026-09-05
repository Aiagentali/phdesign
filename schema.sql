-- PH Web — Portable schema (D1/SQLite today, MySQL tomorrow)
-- All tables use TEXT PK (uuid) and INTEGER timestamps for portability

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('customer','admin','superadmin')),
  created_at INTEGER NOT NULL,
  reset_token TEXT,
  reset_expires INTEGER
);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  type_name TEXT NOT NULL,
  base_price INTEGER NOT NULL,
  addons_json TEXT NOT NULL DEFAULT '[]',
  addons_price INTEGER NOT NULL DEFAULT 0,
  total_price INTEGER NOT NULL,
  days INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('cart','pending','reviewing','in_progress','delivered','completed','cancelled')),
  customer_note TEXT,
  admin_note TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS payments (
  -- payment_phase: deposit|remaining|full
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id),
  method TEXT NOT NULL CHECK (method IN ('crypto','card')),
  amount INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','verified','rejected')),
  tx_hash TEXT,
  receipt_url TEXT,
  card_last4 TEXT,
  verified_by TEXT REFERENCES users(id),
  verified_at INTEGER,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS tickets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  order_id TEXT REFERENCES orders(id),
  subject TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','answered','closed')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS ticket_messages (
  id TEXT PRIMARY KEY,
  ticket_id TEXT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  sender_id TEXT NOT NULL REFERENCES users(id),
  sender_role TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  actor_id TEXT REFERENCES users(id),
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  meta_json TEXT,
  created_at INTEGER NOT NULL
);

-- Default pricing (editable from superadmin)
INSERT OR IGNORE INTO settings (key, value, updated_at) VALUES
  ('pricing', '{"types":{"corporate":{"name":"شرکتی","price":4000000,"days":14},"shop":{"name":"فروشگاهی","price":7000000,"days":21},"portfolio":{"name":"پورتفولیو","price":3000000,"days":10},"restaurant":{"name":"رستوران / کافه","price":4500000,"days":12},"medical":{"name":"پزشکی / کلینیک","price":5000000,"days":14},"education":{"name":"آموزشی","price":6000000,"days":18}},"addons":{"about":{"name":"صفحه درباره ما","price":500000,"days":2},"blog":{"name":"وبلاگ","price":800000,"days":3},"gallery":{"name":"گالری تصاویر","price":600000,"days":2},"booking":{"name":"فرم رزرو / سفارش آنلاین","price":1200000,"days":4},"multilang":{"name":"چندزبانه","price":1500000,"days":5},"cms":{"name":"پنل مدیریت محتوا","price":2000000,"days":6},"seo":{"name":"سئوی پیشرفته","price":800000,"days":2},"gateway":{"name":"درگاه پرداخت آنلاین","price":1200000,"days":3},"chat":{"name":"چت آنلاین","price":400000,"days":1}}}', strftime('%s','now')),
  ('payment_terms', '{"deposit_percent":50,"allow_deposit":true,"allow_full":true,"deposit_label":"بیعانه برای شروع پروژه","remaining_label":"تسویه پس از تحویل"}', strftime('%s','now')),
  ('payment_info', '{"card_number":"6037-XXXX-XXXX-1234","card_holder":"PH Web","crypto_addresses":{"USDT_TRC20":"TXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX","BTC":"1XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"}}', strftime('%s','now'));

CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_tickets_user ON tickets(user_id);
