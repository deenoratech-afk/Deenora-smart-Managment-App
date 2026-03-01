
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jtbhesczfjwjqivtmkqw.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp0Ymhlc2N6Zmp3anFpdnRta3F3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1MDI4ODQsImV4cCI6MjA4NzA3ODg4NH0.zKxOZlvjiZwaLprMBGeObcmf2VqjGoJtdxgF_nFpKvI';

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
