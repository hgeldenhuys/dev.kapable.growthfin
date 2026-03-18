-- Add progress tracking columns to crm_tasks table
ALTER TABLE crm_tasks
ADD COLUMN total_entities INTEGER DEFAULT 0,
ADD COLUMN processed_entities INTEGER DEFAULT 0,
ADD COLUMN successful_entities INTEGER DEFAULT 0,
ADD COLUMN failed_entities INTEGER DEFAULT 0,
ADD COLUMN skipped_entities INTEGER DEFAULT 0,
ADD COLUMN actual_cost DECIMAL(10, 4) DEFAULT 0;

-- Add comment explaining the columns
COMMENT ON COLUMN crm_tasks.total_entities IS 'Total number of entities (contacts/leads) to process';
COMMENT ON COLUMN crm_tasks.processed_entities IS 'Number of entities processed so far';
COMMENT ON COLUMN crm_tasks.successful_entities IS 'Number of entities successfully processed';
COMMENT ON COLUMN crm_tasks.failed_entities IS 'Number of entities that failed processing';
COMMENT ON COLUMN crm_tasks.skipped_entities IS 'Number of entities skipped (e.g., budget limits)';
COMMENT ON COLUMN crm_tasks.actual_cost IS 'Actual cost incurred during task execution';
