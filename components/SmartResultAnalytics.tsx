
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { Language } from '../types';
import { t } from '../translations';
import { TrendingUp, TrendingDown, Award, AlertCircle, Loader2, User, ChevronRight } from 'lucide-react';

interface ResultInsight {
  student_id: string;
  student_name: string;
  class_name: string;
  roll: number;
  current_avg: number;
  previous_avg: number;
  change: number;
  status: 'improving' | 'declining' | 'stable';
}

interface SmartResultAnalyticsProps {
  madrasahId: string;
  lang: Language;
}

const SmartResultAnalytics: React.FC<SmartResultAnalyticsProps> = ({ madrasahId, lang }) => {
  const [insights, setInsights] = useState<ResultInsight[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchInsights();
  }, [madrasahId]);

  const fetchInsights = async () => {
    setLoading(true);
    try {
      // This logic compares the latest exam with the one before it for each student
      const { data, error } = await supabase.rpc('get_smart_result_insights', { p_madrasah_id: madrasahId });
      if (error) throw error;
      if (data) setInsights(data);
    } catch (err) {
      console.error('Smart Result Analytics Error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="animate-spin text-[#2563EB]" /></div>;

  const improving = insights.filter(i => i.status === 'improving');
  const declining = insights.filter(i => i.status === 'declining');

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-bubble">
          <div className="flex items-center gap-3 mb-2">
            <TrendingUp className="text-emerald-500" size={20} />
            <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Improving</span>
          </div>
          <h4 className="text-2xl font-black text-[#1E3A8A]">{improving.length}</h4>
          <p className="text-[8px] font-bold text-emerald-600/60 uppercase">Students showing progress</p>
        </div>
        <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-bubble">
          <div className="flex items-center gap-3 mb-2">
            <TrendingDown className="text-red-500" size={20} />
            <span className="text-[10px] font-black text-red-600 uppercase tracking-widest">Declining</span>
          </div>
          <h4 className="text-2xl font-black text-[#1E3A8A]">{declining.length}</h4>
          <p className="text-[8px] font-bold text-red-600/60 uppercase">Needs attention</p>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-2">Performance Insights</h3>
        {insights.map((item, idx) => (
          <div key={idx} className="bg-white p-4 rounded-[1.8rem] border border-slate-100 shadow-bubble flex items-center justify-between">
            <div className="flex items-center gap-4 min-w-0">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                item.status === 'improving' ? 'bg-emerald-50 text-emerald-500' : item.status === 'declining' ? 'bg-red-50 text-red-500' : 'bg-slate-50 text-slate-400'
              }`}>
                {item.status === 'improving' ? <TrendingUp size={20} /> : item.status === 'declining' ? <TrendingDown size={20} /> : <Award size={20} />}
              </div>
              <div className="min-w-0">
                <h4 className="font-black text-[#1E3A8A] text-sm font-noto truncate">{item.student_name}</h4>
                <p className="text-[9px] font-bold text-slate-400 uppercase">{item.class_name} • Roll: {item.roll}</p>
              </div>
            </div>
            <div className="text-right">
              <div className={`text-xs font-black ${item.status === 'improving' ? 'text-emerald-500' : item.status === 'declining' ? 'text-red-500' : 'text-slate-400'}`}>
                {item.change > 0 ? '+' : ''}{item.change}%
              </div>
              <p className="text-[8px] font-bold text-slate-300 uppercase">Avg: {item.current_avg}%</p>
            </div>
          </div>
        ))}
        {insights.length === 0 && (
          <div className="text-center py-10 bg-slate-50 rounded-[2rem] border-2 border-dashed border-slate-200">
            <AlertCircle size={32} className="mx-auto text-slate-300 mb-2" />
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Not enough data for insights</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SmartResultAnalytics;
