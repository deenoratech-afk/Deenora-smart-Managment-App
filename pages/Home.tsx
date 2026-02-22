
import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Search, Clock, User as UserIcon, RefreshCw, PhoneCall, X, MessageCircle, Phone, AlertCircle, Trash2, AlertTriangle, Loader2, Users, BookOpen, GraduationCap, Wallet, TrendingUp, DollarSign, CheckCircle2, Banknote, ClipboardList, ChevronRight, Trophy } from 'lucide-react';
import { supabase, offlineApi } from '../supabase';
import { Student, Language } from '../types';
import { t } from '../translations';
import RiskAnalysis from '../components/RiskAnalysis';
import SmartFeeAnalytics from '../components/SmartFeeAnalytics';
import SmartResultAnalytics from '../components/SmartResultAnalytics';

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

  useEffect(() => { 
    fetchDashboardStats();
  }, [dataVersion, madrasahId]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      <div className="grid grid-cols-2 gap-3 px-1">
        <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-bubble flex flex-col items-center text-center animate-in zoom-in duration-300">
           <div className="w-10 h-10 bg-blue-50 text-blue-500 rounded-2xl flex items-center justify-center mb-2 shadow-inner"><Users size={20} /></div>
           <h4 className="text-xl font-black text-[#1E3A8A]">{loadingStats ? '...' : stats.totalStudents}</h4>
           <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1">{t('students', lang)}</p>
        </div>
        <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-bubble flex flex-col items-center text-center animate-in zoom-in duration-300 delay-75">
           <div className="w-10 h-10 bg-emerald-50 text-emerald-500 rounded-2xl flex items-center justify-center mb-2 shadow-inner"><CheckCircle2 size={20} /></div>
           <h4 className="text-xl font-black text-[#1E3A8A]">{loadingStats ? '...' : stats.attendanceToday}</h4>
           <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1">আজকের হাজিরা</p>
        </div>
      </div>

      {madrasahId && (
        <div className="space-y-6">
          <RiskAnalysis 
            madrasahId={madrasahId} 
            lang={lang} 
            onStudentClick={onStudentClick} 
          />
          
          <div className="px-1 space-y-3">
             <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] px-3 opacity-80">
               {t('smart_fee_mgmt', lang)}
             </h2>
             <SmartFeeAnalytics 
               madrasahId={madrasahId} 
               lang={lang} 
               month={new Date().toISOString().slice(0, 7)} 
             />
          </div>

          <div className="px-1 space-y-3">
             <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] px-3 opacity-80">
               Result Insights
             </h2>
             <SmartResultAnalytics 
               madrasahId={madrasahId} 
               lang={lang} 
             />
          </div>
        </div>
      )}
    </div>
  );
};

export default Home;
