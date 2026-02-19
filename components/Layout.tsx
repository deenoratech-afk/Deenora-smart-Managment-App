
import React, { useState, useEffect } from 'react';
import { Home, User, BookOpen, Wallet, ShieldCheck, BarChart3, CreditCard, RefreshCw, Smartphone, Bell, X, Info, AlertTriangle, CheckCircle2, Clock, Calculator, ClipboardList, GraduationCap } from 'lucide-react';
import { View, Language, Madrasah, Transaction, Profile } from '../types';
import { t } from '../translations';
import { supabase } from '../supabase';

interface LayoutProps {
  children: React.ReactNode;
  currentView: View;
  setView: (view: View) => void;
  lang: Language;
  madrasah: Madrasah | null;
  profile?: Profile | null;
}

interface AppNotification {
  id: string;
  title: string;
  desc: string;
  type: 'info' | 'success' | 'error' | 'warning';
  time: string;
}

const Layout: React.FC<LayoutProps> = ({ children, currentView, setView, lang, madrasah, profile }) => {
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const isSuperAdmin = profile?.role === 'super_admin';
  const role = profile?.role || 'teacher';

  const fetchDynamicNotifications = async () => {
    if (!madrasah?.id) return;
    const newNotifications: AppNotification[] = [];
    if (madrasah.sms_balance < 50) {
      newNotifications.push({ id: 'low-bal', title: t('low_balance_title', lang), desc: t('low_balance_msg', lang), type: 'error', time: 'Active' });
    }
    setNotifications(newNotifications);
  };

  useEffect(() => { if (showNotifications) fetchDynamicNotifications(); }, [showNotifications, madrasah?.id]);

  const isTabActive = (tab: string) => {
    if (tab === 'home' && currentView === 'home') return true;
    if (tab === 'account' && currentView === 'account') return true;
    if (tab === 'dashboard' && currentView === 'admin-dashboard') return true;
    if (tab === 'approvals' && currentView === 'admin-approvals') return true;
    if (tab === 'accounting' && currentView === 'accounting') return true;
    if (tab === 'attendance' && currentView === 'attendance') return true;
    if (tab === 'exams' && currentView === 'exams') return true;
    if (tab === 'classes' && (currentView === 'classes' || currentView === 'students' || currentView === 'student-details' || currentView === 'student-form')) return true;
    return false;
  };

  return (
    <div className="flex flex-col w-full h-full relative bg-transparent overflow-hidden">
      <header className="flex-none px-6 pt-[calc(env(safe-area-inset-top)+8px)] pb-3 flex items-center justify-between relative z-10">
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <div className="w-11 h-11 rounded-full flex items-center justify-center bg-white shadow-sm border border-white/20 shrink-0 overflow-hidden">
            {isSuperAdmin ? <ShieldCheck size={24} className="text-[#8D30F4]" /> : (madrasah?.logo_url ? <img src={madrasah.logo_url} className="w-full h-full object-cover" alt="Logo" /> : <BookOpen size={22} className="text-[#8D30F4]" />)}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-[16px] font-black text-white leading-[1.2] tracking-tight font-noto drop-shadow-md line-clamp-2">
              {isSuperAdmin ? (lang === 'bn' ? 'সুপার অ্যাডমিন' : 'Super Admin') : (madrasah?.name || 'Madrasah Portal')}
            </h1>
            <p className="text-[9px] font-black text-white/60 uppercase tracking-[0.2em] mt-1 drop-shadow-sm font-noto">
              {role === 'teacher' ? 'Teacher Portal' : role === 'accountant' ? 'Accounts Portal' : 'Admin Portal'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowNotifications(true)} className="relative p-2.5 bg-white/20 backdrop-blur-md rounded-[1rem] text-white active:scale-95 border border-white/20 shadow-xl">
            <Bell size={18} />
            {notifications.length > 0 && <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-[#9D50FF] animate-pulse"></span>}
          </button>
          <button onClick={() => window.location.reload()} className="p-2.5 bg-white/20 backdrop-blur-md rounded-[1rem] text-white active:scale-95 transition-all border border-white/20 shadow-xl">
            <RefreshCw size={18} />
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-5 pt-2 pb-44 w-full max-w-md mx-auto scroll-smooth custom-scrollbar">
        {children}
      </main>

      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 w-[94%] max-w-md z-[200]">
        <nav className="bg-white/95 backdrop-blur-[25px] border border-white/50 flex justify-around items-center py-4 px-2 rounded-[3rem] shadow-[0_25px_60px_-15px_rgba(46,11,94,0.4)]">
          <button onClick={() => setView('home')} className={`relative flex flex-col items-center gap-1 transition-all flex-1 ${isTabActive('home') ? 'text-[#8D30F4]' : 'text-[#A179FF]'}`}>
            <Home size={22} strokeWidth={isTabActive('home') ? 3 : 2} />
            <span className="text-[10px] font-black font-noto opacity-80">{t('home', lang)}</span>
          </button>
          
          {isSuperAdmin ? (
            <>
              <button onClick={() => setView('admin-approvals')} className={`relative flex flex-col items-center gap-1 transition-all flex-1 ${isTabActive('approvals') ? 'text-[#8D30F4]' : 'text-[#A179FF]'}`}>
                <CreditCard size={22} />
                <span className="text-[10px] font-black font-noto opacity-80">{t('approvals', lang)}</span>
              </button>
              <button onClick={() => setView('admin-dashboard')} className={`relative flex flex-col items-center gap-1 transition-all flex-1 ${isTabActive('dashboard') ? 'text-[#8D30F4]' : 'text-[#A179FF]'}`}>
                <BarChart3 size={22} />
                <span className="text-[10px] font-black font-noto opacity-80">{t('dashboard', lang)}</span>
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setView('attendance')} className={`relative flex flex-col items-center gap-1 transition-all flex-1 ${isTabActive('attendance') ? 'text-[#8D30F4]' : 'text-[#A179FF]'}`}>
                <ClipboardList size={22} />
                <span className="text-[10px] font-black font-noto opacity-80">হাজিরা</span>
              </button>
              <button onClick={() => setView('exams')} className={`relative flex flex-col items-center gap-1 transition-all flex-1 ${isTabActive('exams') ? 'text-[#8D30F4]' : 'text-[#A179FF]'}`}>
                <GraduationCap size={22} />
                <span className="text-[10px] font-black font-noto opacity-80">পরীক্ষা</span>
              </button>
              <button onClick={() => setView('classes')} className={`relative flex flex-col items-center gap-1 transition-all flex-1 ${isTabActive('classes') ? 'text-[#8D30F4]' : 'text-[#A179FF]'}`}>
                <BookOpen size={22} />
                <span className="text-[10px] font-black font-noto opacity-80">ছাত্র</span>
              </button>
            </>
          )}
          
          <button onClick={() => setView('account')} className={`relative flex flex-col items-center gap-1 transition-all flex-1 ${isTabActive('account') ? 'text-[#8D30F4]' : 'text-[#A179FF]'}`}>
            <User size={22} />
            <span className="text-[10px] font-black font-noto opacity-80">{t('account', lang)}</span>
          </button>
        </nav>
      </div>

      {showNotifications && (
        <div className="fixed inset-0 bg-[#080A12]/60 backdrop-blur-xl z-[9999] flex items-start justify-center p-4 pt-12">
           <div className="bg-white w-full max-w-sm rounded-[3rem] shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[80vh]">
              <div className="p-6 border-b border-slate-50 flex items-center justify-between shrink-0">
                 <h3 className="text-xl font-black text-[#2E0B5E] font-noto tracking-tight">{t('notifications', lang)}</h3>
                 <button onClick={() => setShowNotifications(false)} className="w-9 h-9 bg-slate-50 text-slate-400 rounded-xl flex items-center justify-center"><X size={18} /></button>
              </div>
              <div className="p-4 space-y-3 overflow-y-auto flex-1">
                 {notifications.length > 0 ? notifications.map(n => (
                    <div key={n.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex gap-4">
                       <div className="w-10 h-10 bg-red-50 text-red-500 rounded-xl flex items-center justify-center shrink-0"><AlertTriangle size={18} /></div>
                       <div className="min-w-0 flex-1">
                          <h4 className="text-[13px] font-black text-[#2E0B5E] truncate">{n.title}</h4>
                          <p className="text-[11px] font-bold text-slate-500 font-noto leading-relaxed">{n.desc}</p>
                       </div>
                    </div>
                 )) : <div className="py-12 text-center text-slate-400 text-xs font-black uppercase">No Alerts</div>}
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default Layout;
