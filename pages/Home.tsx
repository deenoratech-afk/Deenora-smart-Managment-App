
import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
// Fix: Added CheckCircle2 to the imports from lucide-react
import { Search, Clock, User as UserIcon, RefreshCw, PhoneCall, X, MessageCircle, Phone, AlertCircle, Trash2, AlertTriangle, Loader2, Users, BookOpen, GraduationCap, Wallet, TrendingUp, DollarSign, CheckCircle2 } from 'lucide-react';
import { supabase, offlineApi } from '../supabase';
import { Student, RecentCall, Language } from '../types';
import { t } from '../translations';

interface HomeProps {
  onStudentClick: (student: Student) => void;
  lang: Language;
  dataVersion: number;
  triggerRefresh: () => void;
  madrasahId?: string;
}

const Home: React.FC<HomeProps> = ({ onStudentClick, lang, dataVersion, triggerRefresh, madrasahId }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Student[]>([]);
  const [recentCalls, setRecentCalls] = useState<RecentCall[]>([]);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [loadingRecent, setLoadingRecent] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  
  // Dashboard Stats
  const [stats, setStats] = useState({
    totalStudents: 0,
    totalClasses: 0,
    smsBalance: 0,
    attendanceToday: 0
  });
  const [loadingStats, setLoadingStats] = useState(true);

  // Deletion States
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

  const recordCall = async (studentId: string) => {
    if (!madrasahId || !studentId) return;
    try {
      const { error } = await supabase.from('recent_calls').insert({
        madrasah_id: madrasahId,
        student_id: studentId,
        called_at: new Date().toISOString()
      });
      
      if (error) {
        console.error("Error saving call record:", error.message);
      } else {
        triggerRefresh();
      }
    } catch (e) {
      console.error("recordCall Exception:", e);
    }
  };

  const clearAllHistory = async () => {
    if (!madrasahId) return;
    setIsClearing(true);
    try {
      const { error } = await supabase
        .from('recent_calls')
        .delete()
        .eq('madrasah_id', madrasahId);
      
      if (error) throw error;
      
      setRecentCalls([]);
      offlineApi.removeCache('recent_calls');
      triggerRefresh();
    } catch (err) {
      console.error("Clear history error:", err);
    } finally {
      setIsClearing(false);
      setShowClearConfirm(false);
    }
  };

  const handleSearch = useCallback(async (query: string) => {
    if (!query.trim() || !madrasahId) { setSearchResults([]); return; }
    
    setLoadingSearch(true);
    try {
      if (navigator.onLine) {
        const { data } = await supabase
          .from('students')
          .select('*, classes(*)')
          .eq('madrasah_id', madrasahId)
          .ilike('student_name', `%${query}%`)
          .limit(10);
        
        if (data) {
          const formattedResults = (data as any[]).map(s => ({
            ...s,
            classes: Array.isArray(s.classes) ? s.classes[0] : s.classes
          })) as Student[];
          setSearchResults(formattedResults);
        }
      } else {
        const all = offlineApi.getCache('all_students_search') || [];
        setSearchResults(all.filter((s: Student) => s.student_name.toLowerCase().includes(query.toLowerCase())).slice(0, 10));
      }
    } catch (err) { console.error(err); } finally { setLoadingSearch(false); }
  }, [madrasahId]);

  useEffect(() => {
    const timer = setTimeout(() => handleSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery, handleSearch]);

  const initiateNormalCall = async (studentId: string, phone: string) => {
    await recordCall(studentId);
    window.location.href = `tel:${phone}`;
  };

  const initiateWhatsAppCall = async (studentId: string, phone: string) => {
     await recordCall(studentId);
     window.location.href = `https://wa.me/88${phone.replace(/\D/g, '')}`;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      
      {/* QUICK DASHBOARD CARDS */}
      <div className="grid grid-cols-2 gap-3 px-1">
        <div className="bg-white/95 backdrop-blur-md p-5 rounded-[2rem] border border-white shadow-xl flex flex-col items-center text-center animate-in zoom-in duration-300">
           <div className="w-10 h-10 bg-indigo-50 text-indigo-500 rounded-2xl flex items-center justify-center mb-2 shadow-inner">
             <Users size={20} />
           </div>
           <h4 className="text-xl font-black text-[#2E0B5E]">{loadingStats ? '...' : stats.totalStudents}</h4>
           <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1">{t('students', lang)}</p>
        </div>
        <div className="bg-white/95 backdrop-blur-md p-5 rounded-[2rem] border border-white shadow-xl flex flex-col items-center text-center animate-in zoom-in duration-300 delay-75">
           <div className="w-10 h-10 bg-emerald-50 text-emerald-500 rounded-2xl flex items-center justify-center mb-2 shadow-inner">
             <CheckCircle2 size={20} />
           </div>
           <h4 className="text-xl font-black text-[#2E0B5E]">{loadingStats ? '...' : stats.attendanceToday}</h4>
           <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1">আজকের হাজিরা</p>
        </div>
        <div className="bg-white/95 backdrop-blur-md p-5 rounded-[2rem] border border-white shadow-xl flex flex-col items-center text-center animate-in zoom-in duration-300 delay-100">
           <div className="w-10 h-10 bg-purple-50 text-purple-500 rounded-2xl flex items-center justify-center mb-2 shadow-inner">
             <Wallet size={20} />
           </div>
           <h4 className="text-xl font-black text-[#2E0B5E]">{loadingStats ? '...' : stats.smsBalance}</h4>
           <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1">{t('sms', lang)} ব্যালেন্স</p>
        </div>
        <div className="bg-white/95 backdrop-blur-md p-5 rounded-[2rem] border border-white shadow-xl flex flex-col items-center text-center animate-in zoom-in duration-300 delay-150">
           <div className="w-10 h-10 bg-orange-50 text-orange-500 rounded-2xl flex items-center justify-center mb-2 shadow-inner">
             <BookOpen size={20} />
           </div>
           <h4 className="text-xl font-black text-[#2E0B5E]">{loadingStats ? '...' : stats.totalClasses}</h4>
           <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1">{t('classes', lang)}</p>
        </div>
      </div>

      <div className="relative z-20 group px-1">
        <div className="absolute -inset-1 bg-gradient-to-r from-[#8D30F4] to-[#A179FF] rounded-[2.2rem] blur opacity-10 group-focus-within:opacity-30 transition duration-500"></div>
        <div className="relative flex items-center">
          <div className="absolute left-6 text-[#8D30F4] transition-all duration-300 group-focus-within:scale-110 group-focus-within:rotate-12 z-10">
            <Search size={22} strokeWidth={2.5} />
          </div>
          <input
            type="text"
            placeholder={t('search_placeholder', lang)}
            className="w-full h-16 pl-16 pr-14 bg-white/95 backdrop-blur-2xl border border-white/50 rounded-[2rem] outline-none text-[#2E0B5E] placeholder:text-[#9B6DFF]/60 font-bold text-base shadow-[0_15px_40px_-10px_rgba(46,11,94,0.2)] focus:shadow-[0_20px_60px_-10px_rgba(141,48,244,0.3)] focus:border-[#8D30F4]/30 transition-all duration-300"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')} 
              className="absolute right-5 p-2 bg-[#F2EBFF] text-[#8D30F4] rounded-2xl hover:bg-[#8D30F4] hover:text-white active:scale-90 transition-all duration-200 shadow-sm flex items-center justify-center z-10"
            >
              <X size={18} strokeWidth={3} />
            </button>
          )}
        </div>
      </div>

      {searchQuery.length > 0 && (
        <div className="space-y-2.5 animate-in slide-in-from-top-3 px-1">
          <h2 className="text-[10px] font-black text-white uppercase tracking-[0.2em] px-3 drop-shadow-md opacity-80">
            {loadingSearch ? (lang === 'bn' ? 'খোঁজা হচ্ছে...' : 'Searching...') : (lang === 'bn' ? 'সার্চ ফলাফল' : 'Search Results')}
          </h2>
          {searchResults.map(student => (
            <div key={student.id} onClick={() => onStudentClick(student)} className="bg-white/95 p-4 rounded-[1.8rem] border-l-4 border-l-[#8D30F4] border border-white/40 flex items-center justify-between shadow-xl active:scale-[0.98] transition-all group backdrop-blur-lg">
              <div className="min-w-0 flex-1">
                <h3 className="font-black text-[#4B168A] text-[16px] font-noto truncate leading-tight tracking-tight">{student.student_name}</h3>
                <p className="text-[9px] text-[#A179FF] font-black uppercase mt-1 tracking-widest">{student.classes?.class_name || 'N/A'}</p>
              </div>
              <div className="flex items-center gap-6 shrink-0 ml-2">
                 <div onClick={(e) => { e.stopPropagation(); initiateNormalCall(student.id, student.guardian_phone) }} className="w-10 h-10 bg-[#8D30F4]/10 text-[#8D30F4] rounded-xl flex items-center justify-center shadow-sm active:scale-90 transition-all border border-[#8D30F4]/10">
                   <Phone size={20} fill="currentColor" />
                 </div>
                 <div onClick={(e) => { e.stopPropagation(); initiateWhatsAppCall(student.id, student.guardian_phone) }} className="w-10 h-10 bg-[#25d366] text-white rounded-xl flex items-center justify-center shadow-lg active:scale-90 transition-all border border-white/20">
                   <PhoneCall size={20} fill="currentColor" />
                 </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-3.5 px-1 pb-10">
        <div className="flex items-center justify-between px-3">
          <h2 className="text-[10px] font-black text-white uppercase tracking-[0.3em] drop-shadow-md opacity-80">
            {t('recent_calls', lang)} <span className="text-[9px] opacity-40 ml-1">(Top 20)</span>
          </h2>
          <div className="flex items-center gap-2">
            {recentCalls.length > 0 && (
              <button 
                onClick={() => setShowClearConfirm(true)} 
                className="p-2 bg-red-500/10 rounded-xl text-red-500 backdrop-blur-md active:scale-95 transition-all flex items-center gap-1.5 px-3 border border-red-500/10"
              >
                <Trash2 size={14} strokeWidth={3} />
                <span className="text-[9px] font-black uppercase tracking-widest">{t('clear', lang)}</span>
              </button>
            )}
            <button 
              onClick={() => fetchRecentCalls(true)} 
              className="p-2 bg-white/20 rounded-xl text-white backdrop-blur-md active:scale-95 transition-all flex items-center gap-2 px-3"
            >
              <span className="text-[9px] font-black uppercase tracking-widest">{loadingRecent ? '...' : (lang === 'bn' ? 'রিফ্রেশ' : 'Refresh')}</span>
              <RefreshCw size={14} strokeWidth={3} className={loadingRecent ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
        
        {fetchError && (
          <div className="mx-2 p-3 bg-red-500/20 backdrop-blur-md border border-red-500/30 rounded-2xl flex items-center gap-3 text-white text-[10px] font-black uppercase tracking-wider">
            <AlertCircle size={16} className="shrink-0" />
            <span>Error: {fetchError}</span>
          </div>
        )}

        {loadingRecent && recentCalls.length === 0 ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-20 bg-white/10 animate-pulse rounded-[1.8rem] border border-white/5"></div>
            ))}
          </div>
        ) : recentCalls.length > 0 ? (
          <div className="space-y-2.5">
            {recentCalls.slice(0, 20).map(call => (
              <div key={call.id} onClick={() => call.students && onStudentClick(call.students)} className="bg-white/95 p-4 rounded-[1.8rem] border border-white/40 flex items-center justify-between shadow-xl active:scale-[0.98] transition-all group backdrop-blur-lg">
                <div className="flex items-center gap-4 min-w-0 flex-1">
                  <div className="w-11 h-11 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-300 border border-slate-100 shadow-inner shrink-0">
                    <UserIcon size={20} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-black text-[#4B168A] text-[16px] font-noto truncate leading-tight tracking-tight">{call.students?.student_name || 'অজানা'}</h3>
                    <div className="flex items-center gap-1.5 mt-0.5">
                       <Clock size={11} className="text-[#A179FF]" />
                       <span className="text-[9px] font-black text-[#A179FF] uppercase tracking-[0.05em]">
                         {new Date(call.called_at).toLocaleTimeString(lang === 'bn' ? 'bn-BD' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
                         {" • "}
                         {new Date(call.called_at).toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-US', { day: 'numeric', month: 'short' })}
                       </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-6 shrink-0 ml-2">
                   <div onClick={(e) => { e.stopPropagation(); call.students && initiateNormalCall(call.students.id, call.students.guardian_phone) }} className="w-10 h-10 bg-[#8D30F4]/10 text-[#8D30F4] rounded-xl flex items-center justify-center shadow-sm active:scale-90 transition-all border border-[#8D30F4]/10">
                     <Phone size={20} fill="currentColor" />
                   </div>
                   <div onClick={(e) => { e.stopPropagation(); call.students && initiateWhatsAppCall(call.students.id, call.students.guardian_phone) }} className="w-10 h-10 bg-[#25d366] text-white rounded-xl flex items-center justify-center shadow-lg active:scale-90 transition-all border border-white/20">
                     <PhoneCall size={20} fill="currentColor" />
                   </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-20 bg-white/10 rounded-[3rem] border-2 border-dashed border-white/30 backdrop-blur-sm mx-2">
            <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4 border border-white/10">
              <Clock size={32} className="text-white/20" />
            </div>
            <p className="text-white/60 text-[10px] font-black uppercase tracking-[0.2em] drop-shadow-sm">
              No History Found
            </p>
            <p className="text-white/30 text-[8px] font-bold uppercase tracking-widest mt-2">Try refreshing or calling a student</p>
          </div>
        )}
      </div>

      {/* Clear All Confirmation Modal */}
      {showClearConfirm && createPortal(
        <div className="modal-overlay bg-[#080A12]/40 backdrop-blur-2xl animate-in fade-in duration-300">
           <div className="bg-white w-full max-w-sm rounded-[3.5rem] p-10 shadow-[0_40px_100px_rgba(239,68,68,0.2)] border border-red-50 text-center space-y-6 animate-in zoom-in-95 duration-500">
              <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto shadow-inner border border-red-100">
                 <AlertTriangle size={40} />
              </div>
              <div>
                 <h3 className="text-xl font-black text-slate-800 font-noto tracking-tight">{t('clear_history', lang)}</h3>
                 <p className="font-bold text-slate-400 mt-2 text-[13px] leading-relaxed">
                   {t('confirm_clear_history', lang)}
                 </p>
              </div>
              <div className="flex flex-col gap-3 pt-2">
                <button 
                  onClick={clearAllHistory} 
                  disabled={isClearing}
                  className="w-full py-5 bg-red-500 text-white font-black rounded-full shadow-xl shadow-red-100 active:scale-95 transition-all text-sm uppercase tracking-widest flex items-center justify-center gap-2"
                >
                  {isClearing ? <Loader2 className="animate-spin" size={20} /> : <><Trash2 size={18} /> {t('confirm_btn', lang)}</>}
                </button>
                <button 
                  onClick={() => setShowClearConfirm(false)} 
                  disabled={isClearing}
                  className="w-full py-4 bg-slate-100 text-[#2E0B5E] rounded-full font-black text-xs uppercase tracking-widest active:scale-95 transition-all"
                >
                  {t('cancel_btn', lang)}
                </button>
              </div>
           </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default Home;
