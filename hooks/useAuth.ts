
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { offlineService } from '../services/offline.service';
import { Profile, Madrasah } from '../types';

export const useAuth = () => {
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [madrasah, setMadrasah] = useState<Madrasah | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const fetchUserProfile = async (userId: string) => {
    try {
      // First, get the profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
      
      if (profileError) throw profileError;

      if (profileData) {
        setProfile(profileData);
        
        // Then get the madrasah
        const { data: madrasahData, error: mError } = await supabase
          .from('madrasahs')
          .select('*')
          .eq('id', profileData.madrasah_id)
          .maybeSingle();

        if (mError) throw mError;
        
        setMadrasah(madrasahData);
        if (madrasahData) offlineService.setCache('profile', madrasahData);
      } else {
        // If profile doesn't exist yet, it might be the trigger lagging or 
        // a manual auth user without SQL data.
        setAuthError("Profile not found in database. Please check if SQL triggers are running.");
      }
    } catch (err: any) {
      console.error("fetchUserProfile error:", err);
      setAuthError(err.message);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('teacher_session');
    offlineService.removeCache('profile');
    window.location.reload();
  };

  useEffect(() => {
    const initializeAuth = async () => {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      
      if (currentSession) {
        setSession(currentSession);
        await fetchUserProfile(currentSession.user.id);
      } else {
        const teacherSession = localStorage.getItem('teacher_session');
        if (teacherSession) {
          const teacherData = JSON.parse(teacherSession);
          // Teachers usually have their madrasah data embedded or cached
          const mData = Array.isArray(teacherData.madrasahs) 
            ? teacherData.madrasahs[0] 
            : teacherData.madrasahs;

          setMadrasah(mData);
          setProfile({
            id: teacherData.id,
            madrasah_id: teacherData.madrasah_id,
            full_name: teacherData.name,
            role: 'teacher',
            is_active: true,
            created_at: teacherData.created_at
          });
          setSession({ user: { id: teacherData.id } });
        }
      }
      setLoading(false);
    };

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        setSession(null); 
        setMadrasah(null); 
        setProfile(null);
        localStorage.removeItem('teacher_session');
      } else if (session) {
        setSession(session);
        fetchUserProfile(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return { session, profile, madrasah, loading, authError, handleLogout };
};
