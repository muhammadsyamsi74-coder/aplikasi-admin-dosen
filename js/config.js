// js/config.js
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// Kredensial API Supabase Anda
const SUPABASE_URL = 'https://unskqryypusdhqqtwrfq.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVuc2txcnl5cHVzZGhxcXR3cmZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY2MTE2NDEsImV4cCI6MjEwMjE4NzY0MX0.rNQw5YsIP6TyqyI8f9e-N50GroAYXZ_x5LAeZVoHs9s';

// Inisialisasi SDK Supabase Client
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);