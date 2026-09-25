-- Clasp read model. Replayed in full on every boot (src/migrate.ts), so every
-- statement must be idempotent. Additive changes only: a column that has to
-- change type needs a real migration step, not an edit here. A column added
-- to an existing table goes below as ALTER TABLE ... ADD COLUMN IF NOT EXISTS
-- (CREATE TABLE IF NOT EXISTS never touches a table that already exists).
--
-- Addresses are stored EIP-55 checksummed, exactly as viem returns them.
-- Amounts are numeric (wei / token base units): they exceed 2^63.

-- One row per Clasp vault (one per coin).
CREATE TABLE IF NOT EXISTS coins (
  token                  text PRIMARY KEY,
  vault                  text NOT NULL UNIQUE,
  registered_by          text NOT NULL,          -- VaultCreated.creator (who called createVault)
  creator                text,                   -- Pons deployer of the coin
  name                   text NOT NULL DEFAULT '',
  symbol                 text NOT NULL DEFAULT '',
  decimals               integer NOT NULL DEFAULT 18,
  total_supply           numeric NOT NULL DEFAULT 0,
  logo                   text,                   -- http(s) only
  description            text,
  website                text,
  twitter                text,
  telegram               text,
  discord                text,
  farcaster              text,
  curve                  text,
  creator_tax_bps        integer NOT NULL DEFAULT 0,
  pool_fee               integer,
  tick_spacing           integer,
  phase                  smallint NOT NULL DEFAULT 0, -- Pons GraduationPhase
  fee_recipient          text,                   -- current Pons creatorFeeRecipient
  -- Pons admin override pending on the factory (pendingCreatorFeeRecipient).
  redirect_to            text,
  redirect_effective_at  bigint,
  redirect_expires_at    bigint,
  treasury               text,
  terms                  jsonb NOT NULL DEFAULT '{}',
  created_block          bigint NOT NULL,
  created_at             timestamptz NOT NULL,
  -- Vault state, refreshed by the reconcile pass.
  total_locked           numeric NOT NULL DEFAULT 0,
  total_weight           numeric NOT NULL DEFAULT 0,
  vault_balance          numeric NOT NULL DEFAULT 0,
  escrow_balance         numeric NOT NULL DEFAULT 0,
  curve_fees             numeric NOT NULL DEFAULT 0, -- creator share still on the Pons curve (pre-graduation)
  undistributed          numeric NOT NULL DEFAULT 0,
  stream_end             bigint NOT NULL DEFAULT 0,
  acc_reward_per_weight  numeric NOT NULL DEFAULT 0,
  treasury_owed          numeric NOT NULL DEFAULT 0,
  lifetime_inflow        numeric NOT NULL DEFAULT 0,
  lifetime_rewards       numeric NOT NULL DEFAULT 0,
  -- Market, refreshed by the reconcile pass.
  price_wei              numeric,                -- wei per 1e18 base units
  market_cap_wei         numeric,
  metadata_at            timestamptz,
  reconciled_at          timestamptz
);
CREATE INDEX IF NOT EXISTS coins_created_idx ON coins (created_block DESC);
CREATE INDEX IF NOT EXISTS coins_search_idx ON coins (lower(symbol), lower(name));

-- One row per lock position. Written from the vault's own position(id) view
-- read at the confirmed block of the event that touched it.
CREATE TABLE IF NOT EXISTS positions (
  vault           text NOT NULL,
  id              numeric NOT NULL,
  token           text NOT NULL,
  owner           text NOT NULL,
  amount          numeric NOT NULL DEFAULT 0,
  weight          numeric NOT NULL DEFAULT 0,
  multiplier_bps  integer NOT NULL DEFAULT 0,
  lock_start      bigint NOT NULL DEFAULT 0,
  lock_end        bigint NOT NULL DEFAULT 0,
  claimed         numeric NOT NULL DEFAULT 0,
  open            boolean NOT NULL DEFAULT true,
  burned          numeric NOT NULL DEFAULT 0,
  forfeited       numeric NOT NULL DEFAULT 0,
  early           boolean,
  opened_block    bigint NOT NULL,
  updated_block   bigint NOT NULL,
  PRIMARY KEY (vault, id)
);
CREATE INDEX IF NOT EXISTS positions_owner_idx ON positions (owner) WHERE open;
CREATE INDEX IF NOT EXISTS positions_maturity_idx ON positions (lock_end) WHERE open;
CREATE INDEX IF NOT EXISTS positions_vault_open_idx ON positions (vault) WHERE open;

-- Every vault event, append-only, keyed by where it sits in the chain so
-- replaying a block range is a no-op.
CREATE TABLE IF NOT EXISTS events (
  tx_hash       text NOT NULL,
  log_index     integer NOT NULL,
  block_number  bigint NOT NULL,
  block_time    timestamptz NOT NULL,
  vault         text NOT NULL,
  token         text NOT NULL,
  kind          text NOT NULL,     -- lock | increase | extend | claim | unlock | fees | treasury | owed | owed_withdrawn
  position_id   numeric,
  owner         text,
  amount        numeric NOT NULL DEFAULT 0,
  data          jsonb NOT NULL DEFAULT '{}',
  PRIMARY KEY (tx_hash, log_index)
);
CREATE INDEX IF NOT EXISTS events_vault_idx ON events (vault, block_number DESC, log_index DESC);
CREATE INDEX IF NOT EXISTS events_kind_time_idx ON events (kind, block_time);
CREATE INDEX IF NOT EXISTS events_position_idx ON events (vault, position_id) WHERE position_id IS NOT NULL;

-- ClaspRouter trades.
CREATE TABLE IF NOT EXISTS trades (
  tx_hash       text NOT NULL,
  log_index     integer NOT NULL,
  block_number  bigint NOT NULL,
  block_time    timestamptz NOT NULL,
  token         text NOT NULL,
  trader        text NOT NULL,
  is_buy        boolean NOT NULL,
  eth_amount    numeric NOT NULL,
  token_amount  numeric NOT NULL,
  fee           numeric NOT NULL,
  PRIMARY KEY (tx_hash, log_index)
);
CREATE INDEX IF NOT EXISTS trades_token_idx ON trades (token, block_number DESC);

-- Uploaded coin images, served from /img/<sha256>.<ext>.
CREATE TABLE IF NOT EXISTS images (
  sha256      text PRIMARY KEY,
  mime        text NOT NULL,
  ext         text NOT NULL,
  bytes       bytea NOT NULL,
  size        integer NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Last fully processed block per indexer stream.
CREATE TABLE IF NOT EXISTS indexer_cursor (
  name        text PRIMARY KEY,
  block       bigint NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Every keeper transaction (and every refusal to send), for the runbook.
CREATE TABLE IF NOT EXISTS keeper_runs (
  id            bigserial PRIMARY KEY,
  at            timestamptz NOT NULL DEFAULT now(),
  action        text NOT NULL,     -- harvest | unlock | claimTreasury | refused
  vault         text,
  position_id   numeric,
  tx_hash       text,
  status        text NOT NULL,     -- sent | confirmed | reverted | failed | refused
  gas_used      numeric,
  fee_wei       numeric,
  detail        text
);
CREATE INDEX IF NOT EXISTS keeper_runs_at_idx ON keeper_runs (at DESC);
CREATE INDEX IF NOT EXISTS keeper_runs_vault_action_idx ON keeper_runs (vault, action, at DESC);

-- Pons admin overrides of a Clasp coin's creator fee recipient. One row per
-- proposal event; the reconcile pass also checks the factory's pending slot
-- so a missed event can never hide an active redirect.
CREATE TABLE IF NOT EXISTS admin_redirects (
  tx_hash            text NOT NULL,
  log_index          integer NOT NULL,
  block_number       bigint NOT NULL,
  block_time         timestamptz NOT NULL,
  token              text NOT NULL,
  current_recipient  text NOT NULL,
  new_recipient      text NOT NULL,
  effective_at       bigint NOT NULL,
  expires_at         bigint NOT NULL,
  status             text NOT NULL DEFAULT 'pending',   -- pending | cancelled | executed
  resolved_block     bigint,
  PRIMARY KEY (tx_hash, log_index)
);
CREATE INDEX IF NOT EXISTS admin_redirects_token_idx ON admin_redirects (token, block_number DESC);

-- Every creator-fee-recipient change of a Clasp coin, from any cause.
CREATE TABLE IF NOT EXISTS fee_recipient_changes (
  tx_hash             text NOT NULL,
  log_index           integer NOT NULL,
  block_number        bigint NOT NULL,
  block_time          timestamptz NOT NULL,
  token               text NOT NULL,
  previous_recipient  text NOT NULL,
  new_recipient       text NOT NULL,
  PRIMARY KEY (tx_hash, log_index)
);
CREATE INDEX IF NOT EXISTS fee_recipient_changes_token_idx ON fee_recipient_changes (token, block_number DESC);
