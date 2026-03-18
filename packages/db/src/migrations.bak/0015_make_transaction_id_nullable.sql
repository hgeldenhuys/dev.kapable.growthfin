-- Migration: Make transaction_id nullable in chat_messages
-- Reason: Sessions might not have a transaction ID at session start

ALTER TABLE "chat_messages" ALTER COLUMN "transaction_id" DROP NOT NULL;
