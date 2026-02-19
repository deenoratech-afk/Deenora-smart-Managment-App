
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { Madrasah, LedgerEntry, Fee, Language, UserRole, Class, Student } from '../types';
import { Calculator, Plus, ArrowUpCircle, ArrowDownCircle, Wallet, History, Users, Loader2, Save, X, Calendar, DollarSign, Tag, FileText, CheckCircle2, TrendingUp, AlertCircle, Send, Search, ChevronDown, BarChart3, Settings2, RefreshCw, Info } from 'lucide-react';
import { t } from '../translations';
import { sortMadrasahClasses } from './Classes';

interface AccountingProps {
  lang: Language;
  madrasah: Madrasah | null;
  onBack: () => void;
  role: UserRole;
}

const Accounting: React.FC<AccountingProps> = ({ lang, madrasah, onBack, role }) => {
  const [activeTab, setActiveTab] = useState<'summary' | 'ledger' | 'fees' | 'structures'>('fees');
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [feesReport, setFeesReport] = useState<any[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [structures, setStructures] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showAddLedger, setShowAddLedger] = useState(false);
  const [showAddStructure, setShowAddStructure] = useState(false);
  const [showFeeCollection, setShowFeeCollection] = useState(false);
  
  const [anyStudentsInMadrasah, setAnyStudentsInMadrasah] = useState<boolean | null>(null);

  const [selectedClass, setSelectedClass] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [type, setType] = useState<'income' | 'expense'>('income');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [desc, setDesc] = useState('');

  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [collectAmount, setCollectAmount] = useState('');
  const [showClassDropdown, setShowClassDropdown] = useState(false);

  useEffect(() => {
    if (madrasah) {
      fetchData();
      fetchClasses();
    }
  }, [madrasah?.id, activeTab, selectedMonth, selectedClass]);

  const fetchClasses = async () => {
    const { data } = await supabase.from('classes').select('*').eq('madrasah_id', madrasah?.id);
    if (data) setClasses(sortMadrasahClasses(data));
  };

  const fetchData = async () => {
    if (!madrasah?.id) return;
    setLoading(true);
    setFetchError(null);
    try {
      if (activeTab === 'summary' || activeTab === 'ledger') {
        const { data } = await supabase.from('ledger').select('*').eq('madrasah_id', madrasah.id).order('transaction_date', { ascending: false });
        if (data) setLedger(data);
      }
      
      if (activeTab === 'fees') {
        const classId = selectedClass === '' ? null : selectedClass;
        
        const { data, error } = await supabase.rpc('get_monthly_dues_report', {
          p_madrasah_id: madrasah.id,
          p_class_id: classId,
          p_month: selectedMonth
        });
        
        if (error) {
          console.error("RPC Error:", error);
          setFetchError(error.message);
          setFeesReport([]); // Clear results on error
          return; // Stop processing
        }

        setFeesReport(data || []);

        // Verify if students exist in DB even if report is empty
        if (!data || data.length === 0) {
          let checkQuery = supabase.from('students').select('id', { count: 'exact', head: true }).eq('madrasah_id', madrasah.id);
          if (classId) checkQuery = checkQuery.eq('class_id', classId);
          const { count } = await checkQuery;
          setAnyStudentsInMadrasah(count && count > 0 ? true : false);
        } else {
          setAnyStudentsInMadrasah(true);
        }
      }

      if (activeTab === 'structures') {
        const { data } = await supabase.from('fee_structures').select('*, classes(class_name)').eq('madrasah_id', madrasah.id);
        if (data) setStructures(data);
      }
    } catch (e: any) { 
      console.error("Accounting Fetch Error:", e);
      setFetchError(e.message);
    } finally { setLoading(false); }
  };

  const handleCollectFee = async () => {
    if (!madrasah || !selectedStudent || !collectAmount) return;
    setIsSaving(true);
    try {
      const amt = parseFloat(collectAmount);
      // Ensure the insert matches our schema column
      const { error: feeErr } = await supabase.from('fees').insert({
        madrasah_id: madrasah.id,
        student_id: selectedStudent.student_id,
        class_id: selectedStudent.class_id,
        amount_paid: amt,
        month: selectedMonth,
        status: (Number(selectedStudent.total_paid) + amt) >= selectedStudent.total_payable ? 'paid' : 'partial'
      });
      if (feeErr) throw feeErr;

      await supabase.from('ledger').insert({
        madrasah_id: madrasah.id,
        type: 'income',
        amount: amt,
        category: 'Student Fee',
        description: `Fee for ${selectedStudent.student_name} (${selectedMonth})`,
        transaction_date: new Date().toISOString().split('T')[0]
      });

      setShowFeeCollection(false);
      setCollectAmount('');
      setSelectedStudent(null);
      fetchData();
    } catch (err: any) { alert(err.message); } finally { setIsSaving(false); }
  };

  // Fixed missing handleAddLedger function
  const handleAddLedger = async () => {
    if (!madrasah || !amount || !category) return;
    setIsSaving(true);
    try {
      const { error } = await supabase.from('ledger').insert({
        madrasah_id: madrasah.id,
        type: type,
        amount: parseFloat(amount),
        category: category.trim(),
        description: desc.trim(),
        transaction_date: new Date().toISOString().split('T')[0]
      });
      if (error) throw error;
      
      // Reset form and close modal
      setShowAddLedger(false);
      setAmount('');
      setCategory('');
      setDesc('');
      
      // Refresh data
      fetchData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const totals = ledger.reduce((acc, curr) => {
    if (curr.type === 'income') acc.income += curr.amount;
    else acc.expense += curr.amount;
    return acc;
  }, { income: 0, expense: 0 });

  const totalDues = feesReport.reduce((sum, item) => sum + Number(item.balance_due), 0);

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center text-white border border-white/20">
            <Calculator size={20}/>
          </button>
          <h1 className="text-xl font-black text-white font-noto">ফি ও হিসাব</h1>
        </div>
        <div className="flex gap-2">
            <button onClick={() => fetchData()} className={`w-10 h-10 bg-white/10 text-white rounded-xl flex items-center justify-center active:scale-95 transition-all ${loading ? 'animate-spin' : ''}`}><RefreshCw size={18}/></button>
            <button onClick={() => setShowAddLedger(true)} className="w-10 h-10 bg-white text-[#8D30F4] rounded-xl shadow-xl flex items-center justify-center active:scale-95 transition-all"><Plus size={20}/></button>
        </div>
      </div>

      <div className="flex p-1.5 bg-white/10 rounded-[1.5rem] border border-white/20 overflow-x-auto no-scrollbar">
        {(['fees', 'summary', 'ledger', 'structures'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`flex-1 min-w-[85px] py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all duration-300 ${activeTab === tab ? 'bg-white text-[#8D30F4] shadow-lg' : 'text-white/60'}`}>
            {tab === 'summary' ? 'ড্যাশবোর্ড' : tab === 'ledger' ? 'লেনদেন' : tab === 'fees' ? 'ছাত্র ফি' : 'ফি সেটিংস'}
          </button>
        ))}
      </div>

      {activeTab === 'fees' && (
        <div className="space-y-4 animate-in slide-in-from-bottom-5">
           <div className="bg-white/95 p-5 rounded-[2.2rem] border border-white shadow-lg space-y-4">
              <div className="grid grid-cols-2 gap-3">
                 <div className="relative">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1 mb-1 block">শ্রেণি</label>
                    <button onClick={() => setShowClassDropdown(!showClassDropdown)} className="w-full h-12 px-4 rounded-xl border bg-slate-50 flex items-center justify-between text-xs font-black">
                       <span className="truncate">{classes.find(c => c.id === selectedClass)?.class_name || 'সব শ্রেণি'}</span>
                       <ChevronDown size={16} />
                    </button>
                    {showClassDropdown && (
                        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-2xl border z-50 p-1 max-h-40 overflow-y-auto">
                            <button onClick={() => { setSelectedClass(''); setShowClassDropdown(false); }} className="w-full text-left px-3 py-2 text-[10px] font-black uppercase hover:bg-slate-50">সব শ্রেণি</button>
                            {classes.map(c => (
                                <button key={c.id} onClick={() => { setSelectedClass(c.id); setShowClassDropdown(false); }} className="w-full text-left px-3 py-2 text-[10px] font-black uppercase hover:bg-slate-50">{c.class_name}</button>
                            ))}
                        </div>
                    )}
                 </div>
                 <div className="relative">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1 mb-1 block">মাস</label>
                    <input type="month" className="w-full h-12 px-4 bg-slate-50 border rounded-xl text-xs font-black outline-none" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} />
                 </div>
              </div>
           </div>

           {fetchError && (
              <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600 text-xs font-bold shadow-sm">
                 <div className="bg-red-500 text-white p-2 rounded-xl">
                    <AlertCircle size={20} />
                 </div>
                 <div className="flex-1">
                    <p className="font-black">টেকনিক্যাল এরর!</p>
                    <p className="opacity-70">ডাটাবেসের সাথে সংযোগে সমস্যা হচ্ছে। (Error: {fetchError})</p>
                 </div>
                 <button onClick={() => fetchData()} className="bg-white px-3 py-1.5 rounded-lg border border-red-200 text-red-600 active:scale-95"><RefreshCw size={14}/></button>
              </div>
           )}

           <div className="space-y-2.5">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-16 text-white/50">
                  <Loader2 className="animate-spin mb-4" size={32} />
                  <p className="text-[10px] font-black uppercase tracking-widest">ডাটা লোড হচ্ছে...</p>
                </div>
              ) : feesReport.length > 0 ? (
                  feesReport.map((item: any) => (
                    <div key={item.student_id} className="bg-white/95 p-4 rounded-[1.8rem] border border-white shadow-md flex items-center justify-between group active:scale-[0.98] transition-all">
                       <div className="flex items-center gap-3.5 min-w-0">
                          <div className={`w-11 h-11 rounded-[1rem] flex items-center justify-center font-black shrink-0 ${item.status === 'paid' ? 'bg-green-50 text-green-500' : item.status === 'partial' ? 'bg-orange-50 text-orange-500' : 'bg-red-50 text-red-500'}`}>
                             {item.roll || '-'}
                          </div>
                          <div className="min-w-0">
                             <h5 className="font-black text-[#2E0B5E] font-noto truncate leading-tight mb-1">{item.student_name}</h5>
                             <div className="flex items-center gap-2">
                                <p className="text-[10px] text-slate-400 font-bold uppercase">বকেয়া: ৳{item.balance_due}</p>
                                {Number(item.total_payable) === 0 && <span className="text-[8px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-md font-black uppercase">No Fee Set</span>}
                             </div>
                          </div>
                       </div>
                       <button onClick={() => { setSelectedStudent(item); setCollectAmount(item.balance_due.toString()); setShowFeeCollection(true); }} disabled={item.status === 'paid' || Number(item.total_payable) === 0} className={`px-5 py-3 rounded-xl text-[10px] font-black uppercase transition-all shadow-sm ${item.status === 'paid' ? 'bg-green-100 text-green-600 border border-green-200' : Number(item.total_payable) === 0 ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-[#8D30F4] text-white active:scale-95'}`}>
                          {item.status === 'paid' ? 'PAID' : 'ফি জমা নিন'}
                       </button>
                    </div>
                  ))
              ) : !fetchError && (
                <div className="text-center py-16 bg-white/10 rounded-[3rem] border-2 border-dashed border-white/30 backdrop-blur-sm mx-2 px-6 flex flex-col items-center">
                   <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center text-white/40 mb-5">
                      {anyStudentsInMadrasah ? <Info size={32} /> : <Users size={32} />}
                   </div>
                   <h3 className="text-white text-lg font-black font-noto leading-tight">
                     {anyStudentsInMadrasah ? 'রিপোর্ট পাওয়া যায়নি' : 'কোনো ছাত্র পাওয়া যায়নি'}
                   </h3>
                   <p className="text-white/60 text-[10px] font-bold mt-2 uppercase tracking-wide leading-relaxed">
                     {anyStudentsInMadrasah 
                        ? 'আপনার ডাটাবেসে ছাত্র আছে, কিন্তু তারা সম্ভবত সঠিক শ্রেণিতে নিবন্ধিত নয় অথবা ডাটাবেস ফাংশনে সমস্যা হচ্ছে।'
                        : 'এই মাদরাসার অধীনে কোনো ছাত্র নিবন্ধিত নেই। অনুগ্রহ করে ছাত্র যোগ করুন।'}
                   </p>
                   {anyStudentsInMadrasah && (
                     <button onClick={() => fetchData()} className="mt-6 px-6 py-3 bg-white text-[#8D30F4] rounded-xl text-[11px] font-black uppercase flex items-center gap-2 active:scale-95 transition-all">
                        <RefreshCw size={16} /> পুনরায় চেষ্টা করুন
                     </button>
                   )}
                </div>
              )}
           </div>
        </div>
      )}
      {/* Existing Tabs */}
      {activeTab === 'summary' && (
        <div className="space-y-4 animate-in slide-in-from-bottom-5">
          <div className="bg-white/95 p-6 rounded-[2.5rem] border border-white shadow-xl flex items-center justify-between">
            <div className="text-left">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">মোট কালেকশন</p>
              <h2 className="text-3xl font-black text-[#2E0B5E]">৳ {totals.income.toLocaleString('bn-BD')}</h2>
            </div>
            <div className="w-12 h-12 bg-green-50 text-green-500 rounded-2xl flex items-center justify-center shadow-inner">
               <TrendingUp size={24} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white/95 p-5 rounded-[2rem] border border-white shadow-lg">
              <p className="text-[9px] font-black uppercase text-slate-400 mb-1">মোট ব্যয়</p>
              <h4 className="text-xl font-black text-red-500">৳ {totals.expense.toLocaleString('bn-BD')}</h4>
            </div>
            <div className="bg-white/95 p-5 rounded-[2rem] border border-white shadow-lg">
              <p className="text-[9px] font-black uppercase text-slate-400 mb-1">নগদ স্থিতি</p>
              <h4 className="text-xl font-black text-emerald-500">৳ {(totals.income - totals.expense).toLocaleString('bn-BD')}</h4>
            </div>
          </div>

          <div className="bg-[#1A0B2E] p-8 rounded-[3rem] text-white shadow-2xl relative overflow-hidden group">
            <div className="relative z-10 flex items-center justify-between">
               <div>
                  <p className="text-[10px] font-black uppercase opacity-60 mb-1">মোট বকেয়া (Dues)</p>
                  <h3 className="text-3xl font-black">৳ {totalDues.toLocaleString('bn-BD')}</h3>
               </div>
               <div className="w-14 h-14 bg-white/10 rounded-[1.5rem] flex items-center justify-center border border-white/10"><Wallet size={28} /></div>
            </div>
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform">
               <BarChart3 size={100} />
            </div>
          </div>
        </div>
      )}

      {activeTab === 'ledger' && (
        <div className="space-y-3 animate-in slide-in-from-bottom-5">
          {loading ? <div className="flex justify-center py-10"><Loader2 className="animate-spin text-white" /></div> : ledger.length > 0 ? (
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

      {activeTab === 'structures' && (
        <div className="space-y-4 animate-in slide-in-from-bottom-5">
           <button onClick={() => setShowAddStructure(true)} className="w-full py-5 bg-white rounded-[2.2rem] text-[#8D30F4] font-black flex items-center justify-center gap-3 shadow-xl active:scale-95 transition-all">
              <Plus size={24} strokeWidth={3} /> নতুন ফি আইটেম যোগ করুন
           </button>
           <div className="space-y-3">
              {structures.length > 0 ? structures.map(s => (
                <div key={s.id} className="bg-white/95 p-5 rounded-[2rem] border border-white shadow-md flex items-center justify-between">
                   <div className="min-w-0">
                      <h5 className="font-black text-[#2E0B5E] font-noto text-[17px] truncate">{s.fee_name}</h5>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] font-black text-[#A179FF] uppercase tracking-widest">{s.classes?.class_name}</span>
                      </div>
                   </div>
                   <div className="flex items-center gap-3">
                       <div className="text-2xl font-black text-[#8D30F4] shrink-0">৳{s.amount}</div>
                       <button onClick={async () => {
                           if(confirm('এটি ডিলিট করতে চান?')) {
                               await supabase.from('fee_structures').delete().eq('id', s.id);
                               fetchData();
                           }
                       }} className="p-2 text-red-300 hover:text-red-500"><X size={18}/></button>
                   </div>
                </div>
              )) : (
                <div className="text-center py-20 text-white/40 uppercase text-xs font-black">No Fee Structures Set</div>
              )}
           </div>
        </div>
      )}

      {/* COLLECT FEE MODAL */}
      {showFeeCollection && selectedStudent && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xl z-[999] flex items-center justify-center p-6">
              <div className="bg-white w-full max-w-sm rounded-[3rem] p-8 space-y-6 animate-in zoom-in-95 overflow-y-auto max-h-[80vh] shadow-2xl">
                  <div className="flex items-center justify-between">
                      <h3 className="text-xl font-black text-[#2E0B5E] font-noto">ফি সংগ্রহ করুন</h3>
                      <button onClick={() => setShowFeeCollection(false)} className="w-9 h-9 bg-slate-50 text-slate-300 rounded-xl flex items-center justify-center"><X size={20} /></button>
                  </div>
                  <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 text-center">
                      <p className="text-[10px] font-black text-slate-400 uppercase mb-1">ছাত্রের নাম</p>
                      <h4 className="text-xl font-black text-[#2E0B5E] font-noto">{selectedStudent.student_name}</h4>
                      <div className="grid grid-cols-3 gap-2 mt-4">
                          <div className="bg-white p-2.5 rounded-2xl border border-slate-100 shadow-sm">
                            <p className="text-[7px] font-black text-slate-400 uppercase"> Payable </p>
                            <p className="font-black text-blue-600 text-sm">৳{selectedStudent.total_payable}</p>
                          </div>
                          <div className="bg-white p-2.5 rounded-2xl border border-slate-100 shadow-sm">
                            <p className="text-[7px] font-black text-slate-400 uppercase"> Paid </p>
                            <p className="font-black text-green-600 text-sm">৳{selectedStudent.total_paid}</p>
                          </div>
                          <div className="bg-white p-2.5 rounded-2xl border border-slate-100 shadow-sm">
                            <p className="text-[7px] font-black text-slate-400 uppercase"> Due </p>
                            <p className="font-black text-red-600 text-sm">৳{selectedStudent.balance_due}</p>
                          </div>
                      </div>
                  </div>
                  <div className="space-y-4">
                      <div className="space-y-1.5">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">জমা টাকার পরিমাণ</label>
                          <div className="relative">
                            <input type="number" className="w-full h-14 bg-slate-50 rounded-2xl px-12 font-black text-lg outline-none border-2 border-transparent focus:border-[#8D30F4]/20" placeholder="0.00" value={collectAmount} onChange={(e) => setCollectAmount(e.target.value)} />
                            <DollarSign className="absolute left-4 top-4 text-[#8D30F4]" size={20}/>
                          </div>
                      </div>
                      <button onClick={handleCollectFee} disabled={isSaving || !collectAmount} className="w-full py-5 premium-btn text-white font-black rounded-full shadow-xl flex items-center justify-center gap-3 active:scale-95 transition-all text-base">
                          {isSaving ? <Loader2 className="animate-spin" /> : <><CheckCircle2 size={20}/> পেমেন্ট নিশ্চিত করুন</>}
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* ADD LEDGER MODAL */}
      {showAddLedger && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xl z-[999] flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-sm rounded-[3rem] p-8 space-y-6 animate-in zoom-in-95 shadow-2xl">
             <div className="flex items-center justify-between">
               <h3 className="text-xl font-black text-[#2E0B5E]">নতুন লেনদেন যোগ করুন</h3>
               <button onClick={() => setShowAddLedger(false)} className="w-9 h-9 bg-slate-50 text-slate-300 rounded-xl flex items-center justify-center"><X size={20} /></button>
             </div>
             <div className="flex p-1.5 bg-slate-100 rounded-2xl border border-slate-200">
                <button onClick={() => setType('income')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${type === 'income' ? 'bg-white text-green-50 shadow-md text-green-500' : 'text-slate-400'}`}>আয় (Income)</button>
                <button onClick={() => setType('expense')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${type === 'expense' ? 'bg-white text-red-50 shadow-md text-red-500' : 'text-slate-400'}`}>ব্যয় (Expense)</button>
             </div>
             <div className="space-y-4">
                <div className="relative"><input type="number" className="w-full h-14 bg-slate-50 rounded-2xl px-12 font-black text-lg outline-none border-2 border-transparent focus:border-[#8D30F4]/20" placeholder="টাকার পরিমাণ" value={amount} onChange={(e) => setAmount(e.target.value)} /><DollarSign className="absolute left-4 top-4 text-slate-300" size={20}/></div>
                <div className="relative"><input type="text" className="w-full h-14 bg-slate-50 rounded-2xl px-12 font-black text-sm outline-none border-2 border-transparent focus:border-[#8D30F4]/20" placeholder="ক্যাটাগরি (যেমন: বেতন, বিদ্যুৎ)" value={category} onChange={(e) => setCategory(e.target.value)} /><Tag className="absolute left-4 top-4 text-slate-300" size={20}/></div>
                <div className="relative"><textarea className="w-full h-24 bg-slate-50 rounded-2xl px-12 py-4 font-bold text-sm outline-none border-2 border-transparent focus:border-[#8D30F4]/20 resize-none" placeholder="বিবরণ" value={desc} onChange={(e) => setDesc(e.target.value)} /><FileText className="absolute left-4 top-4 text-slate-300" size={20}/></div>
                <button onClick={handleAddLedger} disabled={isSaving} className="w-full py-5 premium-btn text-white font-black rounded-full shadow-xl flex items-center justify-center gap-3 active:scale-95 transition-all">
                  {isSaving ? <Loader2 className="animate-spin" size={20} /> : <><Save size={20}/> সংরক্ষণ করুন</>}
                </button>
             </div>
          </div>
        </div>
      )}

      {/* ADD STRUCTURE MODAL */}
      {showAddStructure && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xl z-[999] flex items-center justify-center p-6">
           <div className="bg-white w-full max-w-sm rounded-[3rem] p-8 space-y-6 animate-in zoom-in-95 shadow-2xl relative">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-black text-[#2E0B5E]">ফি সেটআপ করুন</h3>
                <button onClick={() => setShowAddStructure(false)} className="w-9 h-9 bg-slate-50 text-slate-300 rounded-xl flex items-center justify-center"><X size={20} /></button>
              </div>
              <div className="space-y-4">
                 <div className="relative">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2 mb-1.5 block">শ্রেণি নির্বাচন করুন</label>
                    <button onClick={() => setShowClassDropdown(!showClassDropdown)} className="w-full h-14 px-6 rounded-2xl border-2 border-slate-100 bg-slate-50 flex items-center justify-between font-black text-[#2E0B5E]">
                       <span className="truncate">{classes.find(c => c.id === selectedClass)?.class_name || 'শ্রেণি বেছে নিন'}</span>
                       <ChevronDown size={20} className="text-slate-300" />
                    </button>
                    {showClassDropdown && (
                        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-slate-100 z-[1001] p-2 max-h-48 overflow-y-auto">
                            {classes.map(c => (
                                <button key={c.id} onClick={() => { setSelectedClass(c.id); setShowClassDropdown(false); }} className="w-full text-left px-5 py-3 rounded-xl hover:bg-slate-50 font-black text-[#2E0B5E]">{c.class_name}</button>
                            ))}
                        </div>
                    )}
                 </div>
                 <div className="relative">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2 mb-1.5 block">ফি-র নাম</label>
                    <input type="text" className="w-full h-14 bg-slate-50 rounded-2xl px-12 font-black text-sm outline-none border-2 border-transparent focus:border-[#8D30F4]/20" placeholder="যেমন: মাসিক বেতন" value={category} onChange={(e) => setCategory(e.target.value)} />
                    <Tag className="absolute left-4 top-[44px] text-slate-300" size={20}/>
                 </div>
                 <div className="relative">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2 mb-1.5 block">টাকার পরিমাণ</label>
                    <input type="number" className="w-full h-14 bg-slate-50 rounded-2xl px-12 font-black text-lg outline-none border-2 border-transparent focus:border-[#8D30F4]/20" placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
                    <DollarSign className="absolute left-4 top-[44px] text-[#8D30F4]" size={20}/>
                 </div>
                 
                 <button onClick={async () => {
                    if (!selectedClass || !category || !amount) return;
                    setIsSaving(true);
                    try {
                        const { error } = await supabase.from('fee_structures').insert({
                            madrasah_id: madrasah?.id,
                            class_id: selectedClass,
                            fee_name: category,
                            amount: parseFloat(amount)
                        });
                        if (error) throw error;
                        setShowAddStructure(false);
                        setCategory(''); setAmount(''); setSelectedClass('');
                        fetchData();
                    } catch (e: any) { alert(e.message); } finally { setIsSaving(false); }
                 }} className="w-full py-5 premium-btn text-white font-black rounded-full shadow-xl active:scale-95 transition-all text-base">
                    {isSaving ? <Loader2 className="animate-spin" /> : 'সেভ করুন'}
                 </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default Accounting;
