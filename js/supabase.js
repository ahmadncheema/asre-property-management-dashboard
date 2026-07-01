// ================================================================
// ASRE Property Management Dashboard
// Supabase Client — shared across all pages
// ================================================================

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://oebafaigfoqiaotkrnuw.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9lYmFmYWlnZm9xaWFvdGtybnV3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI4OTM1MjgsImV4cCI6MjA5ODQ2OTUyOH0.s2qzle-N9S25UBcukJtI12Wz-5fgcQ2ydsg4ChbGTwg';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);