import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { TrendingUp, TrendingDown, DollarSign, AlertCircle, CheckCircle2 } from 'lucide-react';
import { supabase } from '../supabase';
import { Language } from '../types';
import { t } from '../translations';

interface SmartFeeAnalyticsProps {
  madrasahId: string;
  lang: Language;
  month: string;
}

const SmartFeeAnalytics: React.FC<SmartFeeAnalyticsProps> = ({ madrasahId, lang, month }) => {
  const [data, setData] = useState({
    totalExpected: 0,
    totalCollected: 0,
    totalDue: 0,
    collectionRate: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      setLoading(true);
      const { data: fees } = await supabase
        .from('student_fees')
        .select('amount, paid_amount, due_amount')
        .eq('madrasah_id', madrasahId)
        .eq('month', month);

      if (fees) {
        const expected = fees.reduce((sum, f) => sum + Number(f.amount), 0);
        const collected = fees.reduce((sum, f) => sum + Number(f.paid_amount), 0);
        const due = fees.reduce((sum, f) => sum + Number(f.due_amount), 0);
        const rate = expected > 0 ? (collected / expected) * 100 : 0;

        setData({
          totalExpected: expected,
          totalCollected: collected,
          totalDue: due,
          collectionRate: rate
        });
      }
      setLoading(false);
    };

    fetchAnalytics();
  }, [madrasahId, month]);

  if (loading) return <div className="h-32 bg-white rounded-[2rem] animate-pulse" />;

  return (
    <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-black text-[#1E293B] font-noto">ফি অ্যানালিটিক্স</h3>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{month}</p>
        </div>
        <div className="bg-blue-50 text-blue-600 px-3 py-1 rounded-full text-[10px] font-black">
          {data.collectionRate.toFixed(1)}% Collected
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 size={12} className="text-emerald-500" />
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">সংগৃহীত</span>
          </div>
          <p className="text-lg font-black text-[#1E293B]">৳{data.totalCollected}</p>
        </div>
        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
          <div className="flex items-center gap-2 mb-1">
            <AlertCircle size={12} className="text-red-500" />
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">বকেয়া</span>
          </div>
          <p className="text-lg font-black text-[#1E293B]">৳{data.totalDue}</p>
        </div>
      </div>

      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${data.collectionRate}%` }}
          className="bg-blue-600 h-full rounded-full"
        />
      </div>
    </div>
  );
};

export default SmartFeeAnalytics;
