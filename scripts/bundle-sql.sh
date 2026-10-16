#!/usr/bin/env bash
# Combine all migrations + seed into one file you can paste into the Supabase SQL Editor.
set -euo pipefail
out=supabase/setup-all.sql
{
  echo "-- Narrow Gate Fitness: complete database setup (schema, security policies, storage, catalog)."
  echo "-- Paste this whole file into Supabase > SQL Editor > New query, then click Run. Run it only once on a new project."
  for f in supabase/migrations/*.sql; do echo; echo "-- ===== $f ====="; cat "$f"; done
  echo; echo "-- ===== supabase/seed.sql ====="; cat supabase/seed.sql
} > "$out"
echo "wrote $out"
