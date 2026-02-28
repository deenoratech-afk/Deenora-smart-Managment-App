
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { Language } from '../types';
import { t } from '../translations';
import { TrendingUp, DollarSign, BarChart3, AlertCircle, Send, Loader2, CheckCircle2, MessageSquare, Smartphone } from 'lucide-react';

interface SmartFeeAnalyticsProps {
  madrasahId: string;
  lang: Language;
  month: string;
}

const SmartFeeAnalytics: React.FC<SmartFeeAnalyticsProps> = ({ madrasahId, lang, month }) => {
  const [stats, setStats] = useState<any>(null);
  const [reminders, setReminders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    fetchAnalytics();
  }, [madrasahId, month]);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const [statsRes, remindersRes] = await Promise.all([
        supabase.rpc('get_smart_fee_analytics', { p_madrasah_id: madrasahId, p_month: month }),
        supabase.rpc('get_fee_reminder_list', { p_madrasah_id: madrasahId, p_month: month })
      ]);

      if (statsRes.data) setStats(statsRes.data);
      if (remindersRes.data) setReminders(remindersRes.data);
    } catch (err) {
      console.error('Smart Fee Analytics Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const sendBulkReminder = async (type: 'native' | 'system') => {
    if (reminders.length === 0) return;
    
    if (type === 'native') {
      const phones = reminders.map(r => r.guardian_phone).join(',');
      const body = `আস-সালামু আলাইকুম, আপনার সন্তানের ${month} মাসের বকেয়া ফি ৳${reminders[0].balance_due} দ্রুত পরিশোধ করার জন্য অনুরোধ করা হলো।`;
      window.location.href = `sms:${phones}?body=${encodeURIComponent(body)}`;
    } else {
      // System SMS logic would go here
      alert('System SMS sending is not implemented in this demo, but the logic is ready.');
    }
  };

  if (loading) return (
    <div className="flex justify-center py-10">
      <Loader2 className="animate-spin text-[#2563EB]" size={32} />
    </div>
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-bubble">
          <div className="flex items-center gap-4 mb-3">
            <div className="w-10 h-10 bg-blue-50 text-blue-500 rounded-xl flex items-center justify-center">
              <DollarSign size={20} />
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('expected_income', lang)}</p>
          </div>
          <h3 className="text-2xl font-black text-[#1E3A8A]">৳ {stats?.expected_income?.toLocaleString('bn-BD')}</h3>
        </div>

        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-bubble">
          <div className="flex items-center gap-4 mb-3">
            <div className="w-10 h-10 bg-emerald-50 text-emerald-500 rounded-xl flex items-center justify-center">
              <TrendingUp size={20} />
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('predicted_total', lang)}</p>
          </div>
          <h3 className="text-2xl font-black text-[#1E3A8A]">৳ {stats?.prediction?.toLocaleString('bn-BD')}</h3>
          <div className="mt-2 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
            <div 
              className="h-full bg-emerald-500 transition-all duration-1000" 
              style={{ width: `${Math.min(100, (stats?.prediction / stats?.expected_income) * 100)}%` }}
            />
          </div>
        </div>

        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-bubble">
          <div className="flex items-center gap-4 mb-3">
            <div className="w-10 h-10 bg-indigo-50 text-indigo-500 rounded-xl flex items-center justify-center">
              <BarChart3 size={20} />
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('collection_rate_label', lang)}</p>
          </div>
          <h3 className="text-2xl font-black text-[#1E3A8A]">{stats?.collection_rate}%</h3>
          <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase">Based on current payments</p>
        </div>
      </div>

      {/* Reminders Section */}
      <div className="bg-white p-8 rounded-[2.5rem] text-[#1E293B] shadow-bubble border border-slate-100 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-black font-noto">{t('reminders', lang)}</h3>
            <p className="text-[10px] font-black uppercase opacity-60 tracking-widest">{reminders.length} Students Pending</p>
          </div>
          <div className="w-12 h-12 bg-blue-50 text-[#2563EB] rounded-2xl flex items-center justify-center border border-blue-100">
            <AlertCircle size={24} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button 
            onClick={() => sendBulkReminder('system')}
            className="h-14 bg-[#2563EB] text-white rounded-2xl font-black text-[10px] uppercase shadow-premium flex items-center justify-center gap-2 active:scale-95 transition-all"
          >
            <MessageSquare size={16} fill="currentColor" /> {t('system_sms', lang)}
          </button>
          <button 
            onClick={() => sendBulkReminder('native')}
            className="h-14 bg-slate-50 text-slate-600 rounded-2xl font-black text-[10px] uppercase border border-slate-200 flex items-center justify-center gap-2 active:scale-95 transition-all"
          >
            <Smartphone size={16} fill="currentColor" /> {t('native_sms', lang)}
          </button>
        </div>

        <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
          {reminders.map((r, idx) => (
            <div key={idx} className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-center justify-between">
              <div className="min-w-0">
                <h4 className="font-black text-[#1E3A8A] text-sm font-noto truncate">{r.student_name}</h4>
                <p className="text-[9px] font-bold opacity-60 uppercase">{r.class_name} • Due: ৳{r.balance_due}</p>
              </div>
              <span className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase ${
                r.reminder_type === 'final' ? 'bg-red-500 text-white' : r.reminder_type === 'strong' ? 'bg-orange-500 text-white' : 'bg-blue-500 text-white'
              }`}>
                {r.reminder_type === 'final' ? t('final_warning', lang) : r.reminder_type === 'strong' ? t('strong_reminder', lang) : t('soft_reminder', lang)}
              </span>
            </div>
          ))}
          {reminders.length === 0 && (
            <div className="text-center py-10 opacity-40">
              <CheckCircle2 size={32} className="mx-auto mb-2" />
              <p className="text-[10px] font-black uppercase tracking-widest">All fees collected!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SmartFeeAnalytics;
