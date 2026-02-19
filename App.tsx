
import React, { useState, useEffect } from 'react';
import { supabase, offlineApi } from './supabase';
import Auth from './pages/Auth';
import Layout from './components/Layout';
import Home from './pages/Home';
import Classes from './pages/Classes';
import Students from './pages/Students';
import StudentDetails from './pages/StudentDetails';
import StudentForm from './pages/StudentForm';
import Account from './pages/Account';
import AdminPanel from './pages/AdminPanel';
import WalletSMS from './pages/WalletSMS';
import DataManagement from './pages/DataManagement';
import Teachers from './pages/Teachers';
import Accounting from './pages/Accounting';
import Attendance from './pages/Attendance';
import { View, Class, Student, Language, Madrasah, Profile, UserRole } from './types';
import { WifiOff, BookOpen, Loader2 } from 'lucide-react';
import { t } from './translations';

const App: React.FC = () => {
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>('home');
  const [madrasah, setMadrasah] = useState<Madrasah | null>(null);
  const [selectedClass, setSelectedClass] = useState<Class | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [dataVersion, setDataVersion] = useState(0); 
  const [lang, setLang] = useState<Language>(() => (localStorage.getItem('app_lang') as Language) || 'bn');

  const triggerRefresh = () => setDataVersion(prev => prev + 1);

  useEffect(() => {
    const handleStatusChange = () => {
      setIsOnline(navigator.onLine);
      if (navigator.onLine) offlineApi.processQueue();
    };
    window.addEventListener('online', handleStatusChange);
    window.addEventListener('offline', handleStatusChange);
    return () => {
      window.removeEventListener('online', handleStatusChange);
      window.removeEventListener('offline', handleStatusChange);
    };
  }, []);

  const fetchUserProfile = async (userId: string) => {
    try {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*, madrasahs(*)')
        .eq('id', userId)
        .maybeSingle();
      
      if (profileData) {
        setProfile(profileData);
        setMadrasah(profileData.madrasahs);
        offlineApi.setCache('profile', profileData.madrasahs);
      } else {
        // Fallback for direct madrasah logins if profile is missing
        const { data: madData } = await supabase.from('madrasahs').select('*').eq('id', userId).maybeSingle();
        if (madData) {
          setMadrasah(madData);
          setProfile({
            id: userId,
            madrasah_id: userId,
            full_name: madData.name,
            role: madData.is_super_admin ? 'super_admin' : 'madrasah_admin',
            is_active: true,
            created_at: new Date().toISOString()
          });
        }
      }
    } catch (err) {
      console.error("fetchUserProfile error:", err);
    }
  };

  useEffect(() => {
    const initializeAuth = async () => {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      if (currentSession) {
        setSession(currentSession);
        await fetchUserProfile(currentSession.user.id);
      } else {
        // Check for teacher session in local storage
        const teacherSession = localStorage.getItem('teacher_session');
        if (teacherSession) {
          const teacherData = JSON.parse(teacherSession);
          setMadrasah(teacherData.madrasahs);
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
        setSession(null); setMadrasah(null); setProfile(null);
        offlineApi.removeCache('profile');
        localStorage.removeItem('teacher_session');
      } else if (session) {
        setSession(session);
        fetchUserProfile(session.user.id);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('teacher_session');
    window.location.reload();
  };

  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#9D50FF] mesh-bg-vibrant">
      <div className="glass-card w-64 h-64 flex flex-col items-center justify-center relative overflow-hidden">
        <div className="relative w-14 h-14 bg-white rounded-3xl flex items-center justify-center shadow-2xl z-10 animate-pulse">
          <BookOpen size={28} className="text-[#8D30F4]" />
        </div>
        <p className="mt-8 text-white font-black tracking-[0.5em] text-[10px]">DEENORA SAAS</p>
      </div>
    </div>
  );

  if (!session && !madrasah) return <Auth lang={lang} />;

  const renderView = () => {
    const role = profile?.role || 'teacher';

    switch (view) {
      case 'home':
        return <Home onStudentClick={(s) => { setSelectedStudent(s); setView('student-details'); }} lang={lang} dataVersion={dataVersion} triggerRefresh={triggerRefresh} madrasahId={madrasah?.id} />;
      case 'classes':
        return <Classes onClassClick={(cls) => { setSelectedClass(cls); setView('students'); }} lang={lang} madrasah={madrasah} dataVersion={dataVersion} triggerRefresh={triggerRefresh} readOnly={role === 'teacher'} />;
      case 'students':
        if (!selectedClass) { setView('classes'); return null; }
        return <Students 
                  selectedClass={selectedClass} 
                  onStudentClick={(s) => { setSelectedStudent(s); setView('student-details'); }} 
                  onAddClick={() => { setIsEditing(false); setSelectedStudent(null); setView('student-form'); }} 
                  onBack={() => setView('classes')} 
                  lang={lang} 
                  dataVersion={dataVersion} 
                  triggerRefresh={triggerRefresh} 
                  canAdd={role !== 'teacher'}
                  canSendSMS={role !== 'teacher'}
                  madrasahId={madrasah?.id}
                />;
      case 'student-details':
        if (!selectedStudent) { setView('home'); return null; }
        return <StudentDetails 
                  student={selectedStudent} 
                  onEdit={() => { setIsEditing(true); setView('student-form'); }} 
                  onBack={() => setView('students')} 
                  lang={lang} 
                  readOnly={role === 'teacher'}
                  madrasahId={madrasah?.id}
                  triggerRefresh={triggerRefresh}
                />;
      case 'student-form':
        return <StudentForm student={selectedStudent} madrasah={madrasah} defaultClassId={selectedClass?.id} isEditing={isEditing} onSuccess={() => { triggerRefresh(); setView('students'); }} onCancel={() => setView('students')} lang={lang} />;
      case 'account':
        return <Account lang={lang} setLang={(l) => { setLang(l); localStorage.setItem('app_lang', l); }} initialMadrasah={madrasah} isSuperAdmin={role === 'super_admin'} setView={setView} onLogout={handleLogout} isTeacher={role === 'teacher'} />;
      case 'admin-panel':
      case 'admin-approvals':
      case 'admin-dashboard':
        return <AdminPanel lang={lang} currentView={view === 'admin-approvals' ? 'approvals' : view === 'admin-dashboard' ? 'dashboard' : 'list'} dataVersion={dataVersion} />;
      case 'wallet-sms':
        return <WalletSMS lang={lang} madrasah={madrasah} triggerRefresh={triggerRefresh} dataVersion={dataVersion} />;
      case 'data-management':
        return <DataManagement lang={lang} madrasah={madrasah} onBack={() => setView('account')} triggerRefresh={triggerRefresh} />;
      case 'teachers':
        return <Teachers lang={lang} madrasah={madrasah} onBack={() => setView('account')} />;
      case 'accounting':
        return <Accounting lang={lang} madrasah={madrasah} onBack={() => setView('home')} role={role} />;
      case 'attendance':
        return <Attendance lang={lang} madrasah={madrasah} onBack={() => setView('home')} userId={session?.user?.id} />;
      default:
        return <Home onStudentClick={(s) => { setSelectedStudent(s); setView('student-details'); }} lang={lang} dataVersion={dataVersion} triggerRefresh={triggerRefresh} madrasahId={madrasah?.id} />;
    }
  };

  return (
    <Layout currentView={view} setView={setView} lang={lang} madrasah={madrasah} profile={profile}>
      {renderView()}
    </Layout>
  );
};

export default App;
