
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { Madrasah, LedgerEntry, Fee, Language, UserRole } from '../types';
import { Calculator, Plus, ArrowUpCircle, ArrowDownCircle, Wallet, History, Users, Loader2, Save, X, Calendar, DollarSign, Tag, FileText } from 'lucide-react';

interface AccountingProps {
  lang: Language;
  madrasah: Madrasah | null;
  onBack: () => void;
  role: UserRole;
}

const Accounting: React.FC<AccountingProps> = ({ lang, madrasah, onBack, role }) => {
  const [activeTab, setActiveTab] = useState<'summary' | 'ledger' | 'fees'>('summary');
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [fees, setFees] = useState<Fee[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddLedger, setShowAddLedger] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Form states
  const [type, setType] = useState<'income' | 'expense'>('income');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [desc, setDesc] = useState('');

  useEffect(() => {
    if (madrasah) fetchData();
  }, [madrasah?.id]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [lRes, fRes] = await Promise.all([
        supabase.from('ledger').select('*').eq('madrasah_id', madrasah?.id).order('transaction_date', { ascending: false }),
        supabase.from('fees').select('*, students(student_name, roll)').eq('madrasah_id', madrasah?.id).order('created_at', { ascending: false }).limit(50)
      ]);
      if (lRes.data) setLedger(lRes.data);
      if (fRes.data) setFees(fRes.data);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const handleAddLedger = async () => {
    if (!madrasah || !amount || !category) return;
    setIsSaving(true);
    try {
      const { error } = await supabase.from('ledger').insert({
        madrasah_id: madrasah.id,
        type,
        amount: parseFloat(amount),
        category,
        description: desc,
        transaction_date: new Date().toISOString().split('T')[0]
      });
      if (error) throw error;
      setShowAddLedger(false);
      setAmount(''); setCategory(''); setDesc('');
      fetchData();
    } catch (err: any) { alert(err.message); } finally { setIsSaving(false); }
  };

  const totals = ledger.reduce((acc, curr) => {
    if (curr.type === 'income') acc.income += curr.amount;
    else acc.expense += curr.amount;
    return acc;
  }, { income: 0, expense: 0 });

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center text-white border border-white/20"><Calculator size={20}/></div>
          <h1 className="text-xl font-black text-white font-noto">মাদরাসা হিসাব</h1>
        </div>
        <button onClick={() => setShowAddLedger(true)} className="p-3 bg-white text-[#8D30F4] rounded-xl shadow-xl active:scale-95 transition-all"><Plus size={20} strokeWidth={3} /></button>
      </div>

      <div className="flex p-1 bg-white/10 rounded-2xl border border-white/20">
        {(['summary', 'ledger', 'fees'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === tab ? 'bg-white text-[#8D30F4]' : 'text-white/60'}`}>
            {tab === 'summary' ? 'ড্যাশবোর্ড' : tab === 'ledger' ? 'লেনদেন' : 'ছাত্র ফি'}
          </button>
        ))}
      </div>

      {activeTab === 'summary' && (
        <div className="space-y-4 animate-in slide-in-from-bottom-5">
          <div className="bg-white/95 p-6 rounded-[2.5rem] border border-white shadow-xl text-center">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">মোট নগদ স্থিতি (Balance)</p>
            <h2 className="text-4xl font-black text-[#2E0B5E] tracking-tight">৳ {(totals.income - totals.expense).toLocaleString('bn-BD')}</h2>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-green-500 p-5 rounded-[2rem] text-white shadow-lg relative overflow-hidden">
              <ArrowUpCircle size={40} className="absolute -right-2 -bottom-2 opacity-20" />
              <p className="text-[9px] font-black uppercase opacity-70 mb-1">মোট আয়</p>
              <h4 className="text-xl font-black">৳ {totals.income.toLocaleString('bn-BD')}</h4>
            </div>
            <div className="bg-red-500 p-5 rounded-[2rem] text-white shadow-lg relative overflow-hidden">
              <ArrowDownCircle size={40} className="absolute -right-2 -bottom-2 opacity-20" />
              <p className="text-[9px] font-black uppercase opacity-70 mb-1">মোট ব্যয়</p>
              <h4 className="text-xl font-black">৳ {totals.expense.toLocaleString('bn-BD')}</h4>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'ledger' && (
        <div className="space-y-3 animate-in slide-in-from-bottom-5">
          {loading ? <div className="flex justify-center py-20"><Loader2 className="animate-spin text-white" /></div> : ledger.length > 0 ? (
            ledger.map(entry => (
              <div key={entry.id} className="bg-white/95 p-4 rounded-[1.8rem] border border-white shadow-md flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${entry.type === 'income' ? 'bg-green-50 text-green-500' : 'bg-red-50 text-red-500'}`}>
                    {entry.type === 'income' ? <ArrowUpCircle size={20} /> : <ArrowDownCircle size={20} />}
                  </div>
                  <div>
                    <h5 className="font-black text-[#2E0B5E] font-noto leading-none mb-1">{entry.category}</h5>
                    <p className="text-[10px] text-slate-400 font-bold">{new Date(entry.transaction_date).toLocaleDateString('bn-BD')}</p>
                  </div>
                </div>
                <div className={`text-right ${entry.type === 'income' ? 'text-green-600' : 'text-red-600'} font-black`}>
                  {entry.type === 'income' ? '+' : '-'} ৳{entry.amount}
                </div>
              </div>
            ))
          ) : <div className="text-center py-20 text-white/40 uppercase text-xs font-black">No transactions</div>}
        </div>
      )}

      {activeTab === 'fees' && (
        <div className="space-y-3 animate-in slide-in-from-bottom-5">
           {fees.length > 0 ? fees.map(fee => (
             <div key={fee.id} className="bg-white/95 p-4 rounded-[1.8rem] border border-white shadow-md flex items-center justify-between">
               <div className="flex items-center gap-4">
                 <div className="w-10 h-10 bg-blue-50 text-blue-500 rounded-xl flex items-center justify-center"><Users size={20}/></div>
                 <div>
                   <h5 className="font-black text-[#2E0B5E] font-noto leading-none mb-1">{fee.students?.student_name}</h5>
                   <p className="text-[10px] text-[#8D30F4] font-black uppercase">{fee.month}</p>
                 </div>
               </div>
               <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase ${fee.status === 'paid' ? 'bg-green-50 text-green-500' : 'bg-red-50 text-red-500'}`}>
                  {fee.status === 'paid' ? 'PAID' : 'DUE'}
               </div>
             </div>
           )) : <div className="text-center py-20 text-white/40 uppercase text-xs font-black">No fee records found</div>}
        </div>
      )}

      {showAddLedger && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xl z-[999] flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-sm rounded-[3rem] p-8 space-y-6 animate-in zoom-in-95">
             <div className="flex items-center justify-between">
               <h3 className="text-xl font-black text-[#2E0B5E]">নতুন এন্ট্রি যোগ করুন</h3>
               <button onClick={() => setShowAddLedger(false)}><X size={24} className="text-slate-300" /></button>
             </div>
             <div className="flex p-1 bg-slate-50 rounded-2xl border border-slate-100">
                <button onClick={() => setType('income')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase ${type === 'income' ? 'bg-white text-green-500 shadow-sm' : 'text-slate-400'}`}>আয় (Income)</button>
                <button onClick={() => setType('expense')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase ${type === 'expense' ? 'bg-white text-red-500 shadow-sm' : 'text-slate-400'}`}>ব্যয় (Expense)</button>
             </div>
             <div className="space-y-4">
                <div className="relative"><input type="number" className="w-full h-14 bg-slate-50 rounded-2xl px-12 font-black text-lg outline-none border-2 border-transparent focus:border-[#8D30F4]/20" placeholder="টাকার পরিমাণ" value={amount} onChange={(e) => setAmount(e.target.value)} /><DollarSign className="absolute left-4 top-4 text-slate-300" size={20}/></div>
                <div className="relative"><input type="text" className="w-full h-14 bg-slate-50 rounded-2xl px-12 font-black text-sm outline-none border-2 border-transparent focus:border-[#8D30F4]/20" placeholder="ক্যাটাগরি (যেমন: বেতন, বিদ্যুৎ)" value={category} onChange={(e) => setCategory(e.target.value)} /><Tag className="absolute left-4 top-4 text-slate-300" size={20}/></div>
                <div className="relative"><textarea className="w-full h-24 bg-slate-50 rounded-2xl px-12 py-4 font-bold text-sm outline-none border-2 border-transparent focus:border-[#8D30F4]/20" placeholder="বিবরণ" value={desc} onChange={(e) => setDesc(e.target.value)} /><FileText className="absolute left-4 top-4 text-slate-300" size={20}/></div>
                <button onClick={handleAddLedger} disabled={isSaving} className="w-full py-5 bg-[#8D30F4] text-white font-black rounded-full shadow-xl flex items-center justify-center gap-3 active:scale-95 transition-all">
                  {isSaving ? <Loader2 className="animate-spin" /> : <><Save size={20}/> সংরক্ষণ করুন</>}
                </button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Accounting;
