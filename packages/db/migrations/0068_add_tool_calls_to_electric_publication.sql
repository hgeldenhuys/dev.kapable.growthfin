-- Add crm_tool_calls table to ElectricSQL publication for real-time streaming
-- This enables tool call events to be streamed to clients via Electric's HTTP API

ALTER PUBLICATION electric_publication_default ADD TABLE crm_tool_calls;

-- Verify the publication includes our table
-- SELECT tablename FROM pg_publication_tables WHERE pubname = 'electric_publication_default' AND tablename = 'crm_tool_calls';
