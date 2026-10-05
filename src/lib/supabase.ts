import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://gropqzbuuhmwrtmrdntk.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdyb3BxemJ1dWhtd3J0bXJkbnRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTExOTQxNjEsImV4cCI6MjEwNjc3MDE2MX0.57PLAdysepy6b0SwaEPEt3PFXqfHg5bggkHXO3Wr0T8';

export const supabase = createClient(supabaseUrl, supabaseKey);