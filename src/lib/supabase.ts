
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jnmxqvfiuqynfxuunjjt.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpubXhxdmZpdXF5bmZ4dXVuamp0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzNjMwNDksImV4cCI6MjA4NzkzOTA0OX0.83r3nrsflHPTtSzxX0VU4Yxl4yxxrXl6y7Q0zbjx8Fc';

/**
 * Global Supabase client instance.
 * Persistent session enabled for PWA functionality.
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: window.localStorage,
    storageKey: 'madrasah_auth_token',
    flowType: 'pkce'
  }
});
