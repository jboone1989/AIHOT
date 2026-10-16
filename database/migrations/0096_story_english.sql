-- English title and digest of a story for the /en edition (editorial/english.ts), written by the worker
-- from the Chinese digest. inputs_hash is over the story's current title and digest, as in english_copies.
CREATE TABLE IF NOT EXISTS story_english (
  story_id     bigint PRIMARY KEY REFERENCES stories (id) ON DELETE CASCADE,
  inputs_hash  text NOT NULL,
  outcome      text NOT NULL CHECK (outcome IN ('written', 'failed')),
  attempts     integer NOT NULL DEFAULT 1,
  title        text,
  digest       text,
  error        text,
  receipt_id   bigint,
  updated_at   timestamptz NOT NULL DEFAULT now()
);
