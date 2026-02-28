-- Enable Supabase Realtime for the messages table
-- This allows clients to subscribe to INSERT events on the messages table
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
