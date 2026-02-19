
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
      const { data: profileData, error } = await supabase
        .from('profiles')
        .select('*, madrasahs(*)')
        .eq('id', userId)
        .maybeSingle();
      
      if (error) throw error;

      if (profileData) {
        setProfile(profileData);
        // Handle cases where madrasahs might be returned as an array or object
        const mData = Array.isArray(profileData.madrasahs) 
          ? profileData.madrasahs[0] 
          : profileData.madrasahs;
          
        setMadrasah(mData);
        if (mData) offlineService.setCache('profile', mData);
      } else {
        setAuthError("Unauthorized Access: Profile not found.");
        await handleLogout();
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
