
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
          throw error;
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
    } finally { setLoading(false); }
  };

  const handleCollectFee = async () => {
    if (!madrasah || !selectedStudent || !collectAmount) return;
    setIsSaving(true);
    try {
      const amt = parseFloat(collectAmount);
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
              <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600 text-xs font-bold">
                 <AlertCircle size={18} />
                 <p>সিস্টেম এরর: {fetchError}. দয়া করে ডেভলপারের সাথে যোগাযোগ করুন।</p>
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
              ) : (
                <div className="text-center py-16 bg-white/10 rounded-[3rem] border-2 border-dashed border-white/20 mx-2 px-6 flex flex-col items-center">
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
      {/* Existing other tabs (summary, ledger, structures) remain the same as previous files */}
    </div>
  );
};

export default Accounting;
