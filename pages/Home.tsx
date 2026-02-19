
import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Search, Clock, User as UserIcon, RefreshCw, PhoneCall, X, MessageCircle, Phone, AlertCircle, Trash2, AlertTriangle, Loader2, Users, BookOpen, GraduationCap, Wallet, TrendingUp, DollarSign, CheckCircle2, Banknote, ClipboardList, ChevronRight, Trophy } from 'lucide-react';
import { supabase, offlineApi } from '../supabase';
import { Student, RecentCall, Language } from '../types';
import { t } from '../translations';

interface HomeProps {
  onStudentClick: (student: Student) => void;
  lang: Language;
  dataVersion: number;
  triggerRefresh: () => void;
  madrasahId?: string;
  onNavigateToWallet?: () => void;
  onNavigateToAccounting?: () => void;
  onNavigateToAttendance?: () => void;
  onNavigateToExams?: () => void;
}

const Home: React.FC<HomeProps> = ({ onStudentClick, lang, dataVersion, triggerRefresh, madrasahId, onNavigateToWallet, onNavigateToAccounting, onNavigateToAttendance, onNavigateToExams }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Student[]>([]);
  const [recentCalls, setRecentCalls] = useState<RecentCall[]>([]);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [loadingRecent, setLoadingRecent] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  
  const [stats, setStats] = useState({
    totalStudents: 0,
    totalClasses: 0,
    smsBalance: 0,
    attendanceToday: 0
  });
  const [loadingStats, setLoadingStats] = useState(true);

  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  const fetchDashboardStats = async () => {
    if (!madrasahId) return;
    setLoadingStats(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const [stdRes, clsRes, mRes, attRes] = await Promise.all([
        supabase.from('students').select('*', { count: 'exact', head: true }).eq('madrasah_id', madrasahId),
        supabase.from('classes').select('*', { count: 'exact', head: true }).eq('madrasah_id', madrasahId),
        supabase.from('madrasahs').select('sms_balance').eq('id', madrasahId).maybeSingle(),
        supabase.from('attendance').select('*', { count: 'exact', head: true }).eq('madrasah_id', madrasahId).eq('date', today).eq('status', 'present')
      ]);

      setStats({
        totalStudents: stdRes.count || 0,
        totalClasses: clsRes.count || 0,
        smsBalance: mRes.data?.sms_balance || 0,
        attendanceToday: attRes.count || 0
      });
    } catch (e) {
      console.error("Dashboard Stats Error:", e);
    } finally {
      setLoadingStats(false);
    }
  };

  const fetchRecentCalls = async (isManual = false) => {
    if (!madrasahId) {
      setLoadingRecent(false);
      return;
    }
    
    if (isManual) {
      setLoadingRecent(true);
      setFetchError(null);
      offlineApi.removeCache('recent_calls');
    }
    
    const cached = offlineApi.getCache('recent_calls');
    if (cached && !isManual) {
      setRecentCalls(cached.slice(0, 20));
      setLoadingRecent(false);
    }

    if (navigator.onLine) {
      try {
        const { data, error } = await supabase
          .from('recent_calls')
          .select(`
            id,
            madrasah_id,
            student_id,
            called_at,
            students (
              id,
              student_name,
              guardian_phone,
              roll,
              photo_url,
              classes (
                id,
                class_name
              )
            )
          `)
          .eq('madrasah_id', madrasahId)
          .order('called_at', { ascending: false })
          .limit(20);
        
        if (error) throw error;
        
        if (data) {
          const formattedCalls: RecentCall[] = (data as any[]).map(call => {
            const rawStudent = Array.isArray(call.students) ? call.students[0] : call.students;
            if (rawStudent) {
              const rawClass = Array.isArray(rawStudent.classes) ? rawStudent.classes[0] : rawStudent.classes;
              return {
                ...call,
                students: {
                  ...rawStudent,
                  classes: rawClass
                }
              };
            }
            return { ...call, students: undefined };
          });

          const validCalls = formattedCalls.filter(call => call.students).slice(0, 20);
          setRecentCalls(validCalls);
          offlineApi.setCache('recent_calls', validCalls);
        }
      } catch (err: any) { 
        console.error("Recent Calls Fetch Error:", err.message);
        setFetchError(err.message);
      } finally { 
        setLoadingRecent(false); 
      }
    } else { 
      setLoadingRecent(false); 
    }
  };

  useEffect(() => { 
    fetchRecentCalls();
    fetchDashboardStats();
  }, [dataVersion, madrasahId]);

  const handleSearch = useCallback(async (query: string) => {
    if (!query.trim() || !madrasahId) { setSearchResults([]); return; }
    setLoadingSearch(true);
    try {
      if (navigator.onLine) {
        const { data } = await supabase.from('students').select('*, classes(*)').eq('madrasah_id', madrasahId).ilike('student_name', `%${query}%`).limit(10);
        if (data) {
          const formattedResults = (data as any[]).map(s => ({ ...s, classes: Array.isArray(s.classes) ? s.classes[0] : s.classes })) as Student[];
          setSearchResults(formattedResults);
        }
      }
    } catch (err) { console.error(err); } finally { setLoadingSearch(false); }
  }, [madrasahId]);

  useEffect(() => {
    const timer = setTimeout(() => handleSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery, handleSearch]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      <div className="grid grid-cols-2 gap-3 px-1">
        <div className="bg-white/95 backdrop-blur-md p-5 rounded-[2rem] border border-white shadow-xl flex flex-col items-center text-center animate-in zoom-in duration-300">
           <div className="w-10 h-10 bg-indigo-50 text-indigo-500 rounded-2xl flex items-center justify-center mb-2 shadow-inner"><Users size={20} /></div>
           <h4 className="text-xl font-black text-[#2E0B5E]">{loadingStats ? '...' : stats.totalStudents}</h4>
           <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1">{t('students', lang)}</p>
        </div>
        <div className="bg-white/95 backdrop-blur-md p-5 rounded-[2rem] border border-white shadow-xl flex flex-col items-center text-center animate-in zoom-in duration-300 delay-75">
           <div className="w-10 h-10 bg-emerald-50 text-emerald-500 rounded-2xl flex items-center justify-center mb-2 shadow-inner"><CheckCircle2 size={20} /></div>
           <h4 className="text-xl font-black text-[#2E0B5E]">{loadingStats ? '...' : stats.attendanceToday}</h4>
           <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1">আজকের হাজিরা</p>
        </div>
      </div>

      <div className="px-1 space-y-3">
         <h2 className="text-[10px] font-black text-white uppercase tracking-[0.3em] px-3 drop-shadow-md opacity-80">Quick Actions</h2>
         <div className="grid grid-cols-1 gap-3">
            <button 
              onClick={onNavigateToAccounting}
              className="bg-[#1A0B2E] p-5 rounded-[2.2rem] text-white flex items-center justify-between shadow-2xl active:scale-[0.98] transition-all group overflow-hidden"
            >
               <div className="flex items-center gap-5 relative z-10">
                  <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center border border-white/10"><Banknote size={24} /></div>
                  <div className="text-left">
                     <h3 className="text-lg font-black font-noto">ছাত্র ফি সংগ্রহ</h3>
                     <p className="text-[8px] font-black uppercase tracking-widest opacity-60">Monthly Fee Collection</p>
                  </div>
               </div>
               <ChevronRight size={18} className="relative z-10 opacity-40 group-hover:translate-x-1 transition-transform" />
            </button>

            <button 
              onClick={onNavigateToExams}
              className="bg-white/95 p-5 rounded-[2.2rem] text-[#2E0B5E] flex items-center justify-between shadow-xl active:scale-[0.98] transition-all group overflow-hidden border border-white"
            >
               <div className="flex items-center gap-5 relative z-10">
                  <div className="w-12 h-12 bg-[#8D30F4]/10 rounded-2xl flex items-center justify-center border border-[#8D30F4]/10"><Trophy size={24} className="text-[#8D30F4]" /></div>
                  <div className="text-left">
                     <h3 className="text-lg font-black font-noto">পরীক্ষা ও ফলাফল</h3>
                     <p className="text-[8px] font-black uppercase tracking-widest text-[#A179FF]">Exam Results & Ranking</p>
                  </div>
               </div>
               <ChevronRight size={18} className="relative z-10 opacity-20 group-hover:translate-x-1 transition-transform" />
            </button>
         </div>
      </div>

      <div className="relative z-20 group px-1">
        <div className="absolute -inset-1 bg-gradient-to-r from-[#8D30F4] to-[#A179FF] rounded-[2.2rem] blur opacity-10 group-focus-within:opacity-30 transition duration-500"></div>
        <div className="relative flex items-center">
          <div className="absolute left-6 text-[#8D30F4] z-10"><Search size={22} strokeWidth={2.5} /></div>
          <input
            type="text"
            placeholder={t('search_placeholder', lang)}
            className="w-full h-16 pl-16 pr-14 bg-white/95 backdrop-blur-2xl border border-white/50 rounded-[2rem] outline-none text-[#2E0B5E] placeholder:text-[#9B6DFF]/60 font-bold text-base shadow-xl focus:border-[#8D30F4]/30 transition-all duration-300"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {searchQuery.length > 0 && (
        <div className="space-y-2.5 px-1">
          <h2 className="text-[10px] font-black text-white uppercase tracking-[0.2em] px-3 drop-shadow-md opacity-80">সার্চ ফলাফল</h2>
          {searchResults.map(student => (
            <div key={student.id} onClick={() => onStudentClick(student)} className="bg-white/95 p-4 rounded-[1.8rem] border border-white shadow-xl flex items-center justify-between active:scale-[0.98] transition-all">
              <div className="min-w-0 flex-1">
                <h3 className="font-black text-[#4B168A] text-[16px] font-noto truncate">{student.student_name}</h3>
                <p className="text-[9px] text-[#A179FF] font-black uppercase mt-1 tracking-widest">{student.classes?.class_name || 'N/A'}</p>
              </div>
              <div className="flex gap-4 shrink-0">
                 <div onClick={(e) => { e.stopPropagation(); window.location.href = `tel:${student.guardian_phone}` }} className="w-10 h-10 bg-[#8D30F4]/10 text-[#8D30F4] rounded-xl flex items-center justify-center"><Phone size={20} fill="currentColor" /></div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-3.5 px-1 pb-10">
        <div className="flex items-center justify-between px-3">
          <h2 className="text-[10px] font-black text-white uppercase tracking-[0.3em] drop-shadow-md opacity-80">{t('recent_calls', lang)}</h2>
          <button onClick={() => fetchRecentCalls(true)} className="p-2 bg-white/20 rounded-xl text-white backdrop-blur-md active:scale-95 transition-all flex items-center gap-2 px-3">
            <span className="text-[9px] font-black uppercase tracking-widest">{loadingRecent ? '...' : 'Refresh'}</span><RefreshCw size={14} strokeWidth={3} className={loadingRecent ? 'animate-spin' : ''} />
          </button>
        </div>
        {recentCalls.length > 0 ? (
          <div className="space-y-2.5">{recentCalls.map(call => (
            <div key={call.id} onClick={() => call.students && onStudentClick(call.students)} className="bg-white/95 p-4 rounded-[1.8rem] border border-white shadow-xl flex items-center justify-between active:scale-[0.98] transition-all">
              <div className="flex items-center gap-4 min-w-0 flex-1">
                <div className="w-11 h-11 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-300 shrink-0"><UserIcon size={20} /></div>
                <div className="min-w-0">
                  <h3 className="font-black text-[#4B168A] text-[16px] font-noto truncate">{call.students?.student_name || 'অজানা'}</h3>
                  <div className="flex items-center gap-1.5 mt-0.5"><Clock size={11} className="text-[#A179FF]" /><span className="text-[9px] font-black text-[#A179FF] uppercase">{new Date(call.called_at).toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' })}</span></div>
                </div>
              </div>
            </div>
          ))}</div>
        ) : <div className="text-center py-20 bg-white/10 rounded-[3rem] border-2 border-dashed border-white/30 backdrop-blur-sm mx-2"><p className="text-white/60 text-[10px] font-black uppercase tracking-widest">No History Found</p></div>}
      </div>
    </div>
  );
};

export default Home;
