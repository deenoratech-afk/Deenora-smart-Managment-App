
import React, { useState, useEffect } from 'react';
import { offlineService } from './services/offline.service';
import { useAuth } from './hooks/useAuth';
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
import Exams from './pages/Exams';
import { View, Class, Student, Language } from './types';
import { BookOpen, ShieldAlert } from 'lucide-react';

const App: React.FC = () => {
  const { session, profile, madrasah, loading, authError, handleLogout } = useAuth();
  const [view, setView] = useState<View>('home');
  const [selectedClass, setSelectedClass] = useState<Class | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [dataVersion, setDataVersion] = useState(0); 
  const [lang, setLang] = useState<Language>(() => (localStorage.getItem('app_lang') as Language) || 'bn');

  const triggerRefresh = () => setDataVersion(prev => prev + 1);

  useEffect(() => {
    const handleStatusChange = () => {
      if (navigator.onLine) offlineService.processQueue();
    };
    window.addEventListener('online', handleStatusChange);
    window.addEventListener('offline', handleStatusChange);
    return () => {
      window.removeEventListener('online', handleStatusChange);
      window.removeEventListener('offline', handleStatusChange);
    };
  }, []);

  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#9D50FF] mesh-bg-vibrant">
      <div className="glass-card w-64 h-64 flex flex-col items-center justify-center relative overflow-hidden">
        <div className="relative w-14 h-14 bg-white rounded-3xl flex items-center justify-center shadow-2xl z-10 animate-pulse">
          <BookOpen size={28} className="text-[#8D30F4]" />
        </div>
        <p className="mt-8 text-white font-noto font-black tracking-[0.5em] text-[10px]">DEENORA SAAS</p>
      </div>
    </div>
  );

  if (authError) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-red-500 p-10 text-center text-white font-noto">
       <ShieldAlert size={80} className="mb-6 animate-bounce" />
       <h1 className="text-3xl font-black mb-4">নিরাপত্তা সতর্কতা!</h1>
       <p className="text-lg opacity-80 mb-8">{authError}</p>
       <button onClick={() => window.location.reload()} className="px-10 py-4 bg-white text-red-600 rounded-full font-black shadow-2xl active:scale-95 transition-all">পুনরায় চেষ্টা করুন</button>
    </div>
  );

  if (!session && !madrasah) return <Auth lang={lang} />;

  const renderView = () => {
    const role = profile?.role || 'teacher';

    switch (view) {
      case 'home':
        return <Home onStudentClick={(s) => { setSelectedStudent(s); setView('student-details'); }} lang={lang} dataVersion={dataVersion} triggerRefresh={triggerRefresh} madrasahId={madrasah?.id} onNavigateToWallet={() => setView('wallet-sms')} />;
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
        if (role !== 'super_admin') { setView('home'); return null; }
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
      case 'exams':
        return <Exams lang={lang} madrasah={madrasah} onBack={() => setView('home')} role={role} />;
      default:
        return <Home onStudentClick={(s) => { setSelectedStudent(s); setView('student-details'); }} lang={lang} dataVersion={dataVersion} triggerRefresh={triggerRefresh} madrasahId={madrasah?.id} onNavigateToWallet={() => setView('wallet-sms')} />;
    }
  };

  return (
    <Layout currentView={view} setView={setView} lang={lang} madrasah={madrasah} profile={profile}>
      {renderView()}
    </Layout>
  );
};

export default App;
