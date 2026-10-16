-- English copy of a selected report for the /en edition (editorial/english.ts), written by the worker.
-- inputs_hash is over the publication's current title, original title, summary and reason; a copy whose
-- hash no longer matches is not shown and is written again.
CREATE TABLE IF NOT EXISTS english_copies (
  article_id   text PRIMARY KEY REFERENCES articles (id) ON DELETE CASCADE,
  inputs_hash  text NOT NULL,
  outcome      text NOT NULL CHECK (outcome IN ('written', 'failed')),
  attempts     integer NOT NULL DEFAULT 1,
  title        text,
  summary      text,
  reason       text,
  error        text,
  receipt_id   bigint,
  updated_at   timestamptz NOT NULL DEFAULT now()
);
