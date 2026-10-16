-- Exchange prices the worker records (market.snapshot), so an event page can show prices around the event.
CREATE TABLE IF NOT EXISTS market_snapshots (
  asset text NOT NULL,
  observed_at timestamptz NOT NULL,
  price_usdt numeric NOT NULL CHECK (price_usdt > 0),
  exchange text NOT NULL,
  PRIMARY KEY (asset, observed_at)
);
