
import React, { useState, useEffect } from 'react';
import { offlineService } from './services/offline.service';
import { useAuth } from './hooks/useAuth';
import { supabase } from './supabase';
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
import { Routes, Route, useNavigate, useLocation, Navigate, useParams } from 'react-router-dom';
import { View, Class, Student, Language } from './types';
import { BookOpen, ShieldAlert, Loader2 } from 'lucide-react';

const App: React.FC = () => {
  const { session, profile, madrasah, loading, authError, handleLogout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [dataVersion, setDataVersion] = useState(0); 
  const [lang, setLang] = useState<Language>(() => (localStorage.getItem('app_lang') as Language) || 'bn');

  const triggerRefresh = () => setDataVersion(prev => prev + 1);

  // Map current path to View for Layout compatibility
  const getViewFromPath = (path: string): View => {
    if (path === '/') return 'home';
    if (path.startsWith('/classes')) return 'classes';
    if (path.startsWith('/students')) return 'students';
    if (path === '/account') return 'account';
    if (path === '/admin') return 'admin-panel';
    if (path === '/admin/approvals') return 'admin-approvals';
    if (path === '/admin/dashboard') return 'admin-dashboard';
    if (path === '/wallet') return 'wallet-sms';
    if (path === '/data') return 'data-management';
    if (path === '/teachers') return 'teachers';
    if (path === '/accounting') return 'accounting';
    if (path === '/attendance') return 'attendance';
    if (path === '/exams') return 'exams';
    return 'home';
  };

  const currentView = getViewFromPath(location.pathname);
  const role = profile?.role || 'teacher';

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

  return (
    <Layout currentView={currentView} setView={(v) => {
      if (v === 'home') navigate('/');
      else if (v === 'classes') navigate('/classes');
      else if (v === 'account') navigate('/account');
      else if (v === 'admin-panel') navigate('/admin');
      else if (v === 'admin-approvals') navigate('/admin/approvals');
      else if (v === 'admin-dashboard') navigate('/admin/dashboard');

      else if (v === 'attendance') navigate('/attendance');
      else if (v === 'exams') navigate('/exams');
    }} lang={lang} madrasah={madrasah} profile={profile}>
      <Routes>
        <Route path="/" element={
          <Home 
            onStudentClick={(s) => navigate(`/students/${s.id}`)} 
            lang={lang} 
            dataVersion={dataVersion} 
            triggerRefresh={triggerRefresh} 
            madrasahId={madrasah?.id} 
            onNavigateToWallet={() => navigate('/wallet')}

            onNavigateToAttendance={() => navigate('/attendance')}
            onNavigateToExams={() => navigate('/exams')}
          />
        } />
        
        <Route path="/classes" element={
          <Classes 
            onClassClick={(cls) => navigate(`/classes/${cls.id}/students`)} 
            lang={lang} 
            madrasah={madrasah} 
            dataVersion={dataVersion} 
            triggerRefresh={triggerRefresh} 
            readOnly={role === 'teacher'} 
          />
        } />

        <Route path="/classes/:classId/students" element={
          <StudentsWrapper 
            lang={lang} 
            dataVersion={dataVersion} 
            triggerRefresh={triggerRefresh} 
            role={role} 
            madrasahId={madrasah?.id} 
          />
        } />

        <Route path="/students/:studentId" element={
          <StudentDetailsWrapper 
            lang={lang} 
            role={role} 
            madrasahId={madrasah?.id} 
            triggerRefresh={triggerRefresh} 
          />
        } />

        <Route path="/students/new" element={
          <StudentForm 
            madrasah={madrasah} 
            isEditing={false} 
            onSuccess={() => { triggerRefresh(); navigate(-1); }} 
            onCancel={() => navigate(-1)} 
            lang={lang} 
          />
        } />

        <Route path="/students/:studentId/edit" element={
          <StudentFormWrapper 
            madrasah={madrasah} 
            triggerRefresh={triggerRefresh} 
            lang={lang} 
          />
        } />

        <Route path="/account" element={
          <Account 
            lang={lang} 
            setLang={(l) => { setLang(l); localStorage.setItem('app_lang', l); }} 
            initialMadrasah={madrasah} 
            isSuperAdmin={role === 'super_admin'} 
            setView={(v) => {
              if (v === 'data-management') navigate('/data');
              else if (v === 'teachers') navigate('/teachers');
            }} 
            onLogout={handleLogout} 
            isTeacher={role === 'teacher'} 
          />
        } />

        <Route path="/admin" element={
          role === 'super_admin' ? <AdminPanel lang={lang} currentView="list" dataVersion={dataVersion} /> : <Navigate to="/" />
        } />
        <Route path="/admin/approvals" element={
          role === 'super_admin' ? <AdminPanel lang={lang} currentView="approvals" dataVersion={dataVersion} /> : <Navigate to="/" />
        } />
        <Route path="/admin/dashboard" element={
          role === 'super_admin' ? <AdminPanel lang={lang} currentView="dashboard" dataVersion={dataVersion} /> : <Navigate to="/" />
        } />

        <Route path="/wallet" element={<WalletSMS lang={lang} madrasah={madrasah} triggerRefresh={triggerRefresh} dataVersion={dataVersion} />} />
        <Route path="/data" element={<DataManagement lang={lang} madrasah={madrasah} onBack={() => navigate('/account')} triggerRefresh={triggerRefresh} />} />
        <Route path="/teachers" element={<Teachers lang={lang} madrasah={madrasah} onBack={() => navigate('/account')} />} />

        <Route path="/attendance" element={<Attendance lang={lang} madrasah={madrasah} onBack={() => navigate('/')} userId={session?.user?.id} />} />
        <Route path="/exams" element={<Exams lang={lang} madrasah={madrasah} onBack={() => navigate('/')} role={role} />} />
        
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Layout>
  );
};

// Helper wrappers to handle params
const StudentsWrapper: React.FC<any> = ({ lang, dataVersion, triggerRefresh, role, madrasahId }) => {
  const { classId } = useParams();
  const navigate = useNavigate();
  const [selectedClass, setSelectedClass] = useState<Class | null>(null);

  useEffect(() => {
    const fetchClass = async () => {
      const { data } = await supabase.from('classes').select('*').eq('id', classId).single();
      if (data) setSelectedClass(data);
    };
    fetchClass();
  }, [classId]);

  if (!selectedClass) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-blue-500" /></div>;

  return (
    <Students 
      selectedClass={selectedClass} 
      onStudentClick={(s) => navigate(`/students/${s.id}`)} 
      onAddClick={() => navigate('/students/new', { state: { defaultClassId: classId } })} 
      onBack={() => navigate('/classes')} 
      lang={lang} 
      dataVersion={dataVersion} 
      triggerRefresh={triggerRefresh} 
      canAdd={role !== 'teacher'}
      canSendSMS={role !== 'teacher'}
      madrasahId={madrasahId}
    />
  );
};

const StudentDetailsWrapper: React.FC<any> = ({ lang, role, madrasahId, triggerRefresh }) => {
  const { studentId } = useParams();
  const navigate = useNavigate();
  const [student, setStudent] = useState<Student | null>(null);

  useEffect(() => {
    const fetchStudent = async () => {
      const { data } = await supabase.from('students').select('*, classes(*)').eq('id', studentId).single();
      if (data) setStudent(data);
    };
    fetchStudent();
  }, [studentId]);

  if (!student) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-blue-500" /></div>;

  return (
    <StudentDetails 
      student={student} 
      onEdit={() => navigate(`/students/${student.id}/edit`)} 
      onBack={() => navigate(`/classes/${student.class_id}/students`)} 
      lang={lang} 
      readOnly={role === 'teacher'}
      madrasahId={madrasahId}
      triggerRefresh={triggerRefresh}
    />
  );
};

const StudentFormWrapper: React.FC<any> = ({ madrasah, triggerRefresh, lang }) => {
  const { studentId } = useParams();
  const navigate = useNavigate();
  const [student, setStudent] = useState<Student | null>(null);

  useEffect(() => {
    if (studentId) {
      const fetchStudent = async () => {
        const { data } = await supabase.from('students').select('*').eq('id', studentId).single();
        if (data) setStudent(data);
      };
      fetchStudent();
    }
  }, [studentId]);

  if (studentId && !student) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-blue-500" /></div>;

  return (
    <StudentForm 
      student={student} 
      madrasah={madrasah} 
      isEditing={!!studentId} 
      onSuccess={() => { triggerRefresh(); navigate(-1); }} 
      onCancel={() => navigate(-1)} 
      lang={lang} 
    />
  );
};

export default App;
