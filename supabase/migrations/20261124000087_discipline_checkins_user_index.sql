-- Faith discipline check-ins are read by member (src/server/services/faith.ts: user_id and a date range;
-- achievements.ts: all of a member's check-ins), but the only index was (goal_id, checked_on), so every read scanned
-- the whole table. Measured on a copy with 1,000,000 check-ins from 10,000 members: one member's last 30 days took
-- 44.9 ms (full scan) and 0.14 ms with this index. Adds an index only; no data changes.
create index if not exists discipline_checkins_user_checked_idx on public.discipline_checkins (user_id, checked_on);
