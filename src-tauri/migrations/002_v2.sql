-- timeBOX v2: MIT marking, planned deliverables, structured evening review.
-- Maps to the "24-hour system" video — feedback-loop core: one MIT, visible
-- deliverable, structured night-time review = streak counter input.

-- Timeboxes get a MIT flag and a "what should this produce" field.
ALTER TABLE timeboxes ADD COLUMN is_mit INTEGER NOT NULL DEFAULT 0;
ALTER TABLE timeboxes ADD COLUMN deliverable TEXT;

CREATE INDEX IF NOT EXISTS idx_tb_is_mit ON timeboxes(is_mit);

-- Daily plans get the 5-question evening review.
ALTER TABLE daily_plans ADD COLUMN review_best_action TEXT;
ALTER TABLE daily_plans ADD COLUMN review_main_obstacle TEXT;
ALTER TABLE daily_plans ADD COLUMN review_obstacle_response TEXT;
ALTER TABLE daily_plans ADD COLUMN review_keep_action TEXT;
ALTER TABLE daily_plans ADD COLUMN review_drop_action TEXT;
ALTER TABLE daily_plans ADD COLUMN review_completed_at TEXT;
