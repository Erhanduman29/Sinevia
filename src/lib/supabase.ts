import { createClient } from '@supabase/supabase-js';

// 1. KENDİ BAĞLANTI BİLGİLERİN
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://gropqzbuuhmwrtmrdntk.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdyb3BxemJ1dWhtd3J0bXJkbnRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTExOTQxNjEsImV4cCI6MjEwNjc3MDE2MX0.57PLAdysepy6b0SwaEPEt3PFXqfHg5bggkHXO3Wr0T8';

// 2. GÜVENLİK İMZASI OLUŞTURUCU (Siteni koruyan yeni sistem)
function getOrCreateSecretToken(): string {
  if (typeof window === 'undefined') return '';
  let token = localStorage.getItem('sinevia_secret_token');
  if (!token) {
    token = 'sec_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15) + '_' + Date.now().toString(36);
    localStorage.setItem('sinevia_secret_token', token);
  }
  return token;
}

// 3. SUPABASE BAĞLANTISI (Güvenlik imzasıyla birlikte)
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    headers: {
      'x-agent-token': getOrCreateSecretToken(),
    },
  },
});