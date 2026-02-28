
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { Language, Student } from '../types';
import { t } from '../translations';
import { AlertTriangle, ShieldCheck, Zap, Loader2, ChevronRight, User, GraduationCap, Clock, TrendingDown } from 'lucide-react';

interface RiskData {
  student_id: string;
  student_name: string;
  class_name: string;
  roll: number;
  attendance_pct: number;
  late_count: number;
  latest_avg: number;
  dropout_risk: 'safe' | 'warning' | 'high';
  late_risk: 'safe' | 'warning' | 'high';
  result_risk: 'safe' | 'warning' | 'high';
}

interface RiskAnalysisProps {
  madrasahId: string;
  lang: Language;
  onStudentClick: (student: any) => void;
}

const RiskAnalysis: React.FC<RiskAnalysisProps> = ({ madrasahId, lang, onStudentClick }) => {
  const [risks, setRisks] = useState<RiskData[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    fetchRisks();
  }, [madrasahId]);

  const fetchRisks = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_student_risk_analysis', { p_madrasah_id: madrasahId });
      if (error) throw error;
      if (data) setRisks(data);
    } catch (err) {
      console.error('Risk Analysis Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const highRisks = risks.filter(r => r.dropout_risk === 'high' || r.late_risk === 'high' || r.result_risk === 'high');
  const warningRisks = risks.filter(r => 
    (r.dropout_risk === 'warning' || r.late_risk === 'warning' || r.result_risk === 'warning') && 
    !(r.dropout_risk === 'high' || r.late_risk === 'high' || r.result_risk === 'high')
  );

  const displayedRisks = expanded ? [...highRisks, ...warningRisks] : highRisks.slice(0, 3);

  if (loading) return (
    <div className="bg-white p-6 rounded-[2.2rem] border border-slate-100 shadow-bubble flex items-center justify-center gap-3">
      <Loader2 className="animate-spin text-[#2563EB]" size={20} />
      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Analyzing Risks...</span>
    </div>
  );

  if (risks.length === 0) return null;

  return (
    <div className="space-y-3 px-1">
      <div className="flex items-center justify-between px-3">
        <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] opacity-80">
          {t('prediction_system', lang)}
        </h2>
        { (highRisks.length > 3 || warningRisks.length > 0) && (
          <button 
            onClick={() => setExpanded(!expanded)} 
            className="text-[9px] font-black text-[#2563EB] uppercase tracking-widest bg-blue-50 px-3 py-1 rounded-full"
          >
            {expanded ? 'Show Less' : 'Show All'}
          </button>
        )}
      </div>

      <div className="space-y-2.5">
        {displayedRisks.length > 0 ? displayedRisks.map((risk) => (
          <div 
            key={risk.student_id} 
            onClick={() => onStudentClick({ id: risk.student_id, student_name: risk.student_name, roll: risk.roll })}
            className="bg-white p-4 rounded-[1.8rem] border border-slate-100 shadow-bubble flex items-center justify-between active:scale-[0.98] transition-all group"
          >
            <div className="flex items-center gap-4 min-w-0 flex-1">
              <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-inner ${
                risk.dropout_risk === 'high' || risk.late_risk === 'high' || risk.result_risk === 'high' 
                ? 'bg-red-50 text-red-500' 
                : 'bg-orange-50 text-orange-500'
              }`}>
                <AlertTriangle size={22} />
              </div>
              <div className="min-w-0">
                <h3 className="font-black text-[#1E3A8A] text-[15px] font-noto truncate leading-tight">{risk.student_name}</h3>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {risk.dropout_risk !== 'safe' && (
                    <span className={`px-2 py-0.5 rounded-full text-[7px] font-black uppercase tracking-tighter flex items-center gap-1 ${
                      risk.dropout_risk === 'high' ? 'bg-red-500 text-white' : 'bg-orange-400 text-white'
                    }`}>
                      <TrendingDown size={8} /> {t('dropout_risk', lang)}
                    </span>
                  )}
                  {risk.late_risk !== 'safe' && (
                    <span className={`px-2 py-0.5 rounded-full text-[7px] font-black uppercase tracking-tighter flex items-center gap-1 ${
                      risk.late_risk === 'high' ? 'bg-red-500 text-white' : 'bg-orange-400 text-white'
                    }`}>
                      <Clock size={8} /> {t('late_regularity', lang)}
                    </span>
                  )}
                  {risk.result_risk !== 'safe' && (
                    <span className={`px-2 py-0.5 rounded-full text-[7px] font-black uppercase tracking-tighter flex items-center gap-1 ${
                      risk.result_risk === 'high' ? 'bg-red-500 text-white' : 'bg-orange-400 text-white'
                    }`}>
                      <GraduationCap size={8} /> {t('result_decline', lang)}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <ChevronRight size={16} className="text-slate-300 group-hover:translate-x-1 transition-transform" />
          </div>
        )) : (
          <div className="bg-white p-8 rounded-[2.2rem] border border-slate-100 shadow-bubble text-center">
            <ShieldCheck size={32} className="mx-auto text-emerald-400 mb-2" />
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('no_risk_found', lang)}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default RiskAnalysis;
