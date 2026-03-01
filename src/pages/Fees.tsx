
import * as React from 'react';
import { useState, useEffect } from 'react';
import { 
  ArrowLeft, Plus, Search, Banknote, LayoutGrid, 
  History, Trash2, Edit3, Save, X, Loader2, CheckCircle2, 
  AlertCircle, ChevronRight, Calculator, User, Calendar,
  Percent, DollarSign, Filter, ListChecks, ArrowUpRight,
  Receipt, Wallet
} from 'lucide-react';
import { supabase } from '../supabase';
import { 
  Madrasah, Class, Student, Language, UserRole, 
  FeeCategory, FeeStructure, StudentFeeOverride, Fee 
} from '../types';
import { t } from '../translations';
import { sortMadrasahClasses } from './Classes';

interface FeesProps {
  lang: Language;
  madrasah: Madrasah | null;
  onBack: () => void;
  role: UserRole;
}

type FeeTab = 'collect' | 'history' | 'setup';

const Fees: React.FC<FeesProps> = ({ lang, madrasah, onBack, role }) => {
  const [activeTab, setActiveTab] = useState<FeeTab>('collect');
  const [loading, setLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Data states
  const [categories, setCategories] = useState<FeeCategory[]>([]);
  const [structures, setStructures] = useState<FeeStructure[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  
  // Selection states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [studentFees, setStudentFees] = useState<Fee[]>([]);
  const [selectedFeeIds, setSelectedFeeIds] = useState<Set<string>>(new Set());

  // Form states
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [showAddStructure, setShowAddStructure] = useState(false);
  const [showQuickAddFee, setShowQuickAddFee] = useState(false);
  
  const [catName, setCatName] = useState('');
  const [catType, setCatType] = useState<'recurring' | 'one-time' | 'optional'>('recurring');
  
  const [structClassId, setStructClassId] = useState('');
  const [structCatId, setStructCatId] = useState('');
  const [structName, setStructName] = useState('');
  const [structAmount, setStructAmount] = useState('');

  const [paymentAmount, setPaymentAmount] = useState('');
  const [quickFeeAmount, setQuickFeeAmount] = useState('');
  const [quickFeeDesc, setQuickFeeDesc] = useState('');

  useEffect(() => {
    if (madrasah) {
      fetchCategories();
      fetchClasses();
      fetchStructures();
    }
  }, [madrasah?.id]);

  const fetchCategories = async () => {
    const { data } = await supabase.from('fee_categories').select('*').eq('madrasah_id', madrasah?.id).order('name');
    if (data) setCategories(data);
  };

  const fetchClasses = async () => {
    const { data } = await supabase.from('classes').select('*').eq('madrasah_id', madrasah?.id);
    if (data) setClasses(sortMadrasahClasses(data));
  };

  const fetchStructures = async () => {
    const { data } = await supabase.from('fee_structures').select('*, classes(class_name), fee_categories(name)').eq('madrasah_id', madrasah?.id);
    if (data) setStructures(data);
  };

  const searchStudents = async (query: string) => {
    if (!query.trim() || !madrasah) {
      setStudents([]);
      return;
    }
    const { data } = await supabase
      .from('students')
      .select('*, classes(class_name)')
      .eq('madrasah_id', madrasah.id)
      .or(`student_name.ilike.%${query}%,guardian_phone.ilike.%${query}%`)
      .limit(10);
    if (data) setStudents(data);
  };

  useEffect(() => {
    const timer = setTimeout(() => searchStudents(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const fetchStudentFees = async (studentId: string) => {
    setLoading(true);
    const { data } = await supabase
      .from('fees')
      .select('*')
      .eq('student_id', studentId)
      .neq('status', 'paid')
      .order('month', { ascending: true });
    if (data) {
      setStudentFees(data);
      setSelectedFeeIds(new Set(data.map(f => f.id)));
    }
    setLoading(false);
  };

  const handleCollectPayment = async () => {
    if (!selectedStudent || selectedFeeIds.size === 0 || !paymentAmount) return;
    setIsSaving(true);
    try {
      const amountToDistribute = parseFloat(paymentAmount);
      let remaining = amountToDistribute;
      
      const selectedFees = studentFees.filter(f => selectedFeeIds.has(f.id));
      
      for (const fee of selectedFees) {
        if (remaining <= 0) break;
        
        const canPay = Math.min(remaining, fee.due_amount);
        const newPaid = fee.paid_amount + canPay;
        const newDue = fee.amount - newPaid;
        const newStatus = newDue <= 0 ? 'paid' : 'partial';
        
        const { error } = await supabase.from('fees').update({
          paid_amount: newPaid,
          due_amount: newDue,
          status: newStatus,
          paid_at: new Date().toISOString()
        }).eq('id', fee.id);
        
        if (error) throw error;
        
        await supabase.from('ledger').insert({
          madrasah_id: madrasah?.id,
          type: 'income',
          category: 'Student Fee',
          amount: canPay,
          description: `Fee Payment: ${selectedStudent.student_name} (${fee.description})`,
          transaction_date: new Date().toISOString().split('T')[0]
        });
        
        remaining -= canPay;
      }
      
      alert(t('success', lang));
      setSelectedStudent(null);
      setPaymentAmount('');
      setSearchQuery('');
    } catch (e: any) {
      alert(e.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleQuickAddFee = async () => {
    if (!selectedStudent || !quickFeeAmount || !quickFeeDesc || !madrasah) return;
    setIsSaving(true);
    try {
      const amount = parseFloat(quickFeeAmount);
      const { data, error } = await supabase.from('fees').insert({
        madrasah_id: madrasah.id,
        student_id: selectedStudent.id,
        class_id: selectedStudent.class_id,
        amount: amount,
        paid_amount: 0,
        due_amount: amount,
        month: new Date().toISOString().slice(0, 7),
        description: quickFeeDesc,
        status: 'unpaid'
      }).select().single();

      if (error) throw error;
      
      setShowQuickAddFee(false);
      setQuickFeeAmount('');
      setQuickFeeDesc('');
      fetchStudentFees(selectedStudent.id);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddCategory = async () => {
    if (!catName || !madrasah) return;
    setIsSaving(true);
    const { error } = await supabase.from('fee_categories').insert({
      madrasah_id: madrasah.id,
      name: catName,
      type: catType
    });
    if (!error) {
      setShowAddCategory(false);
      setCatName('');
      fetchCategories();
    }
    setIsSaving(false);
  };

  const handleAddStructure = async () => {
    if (!structClassId || !structCatId || !structName || !structAmount || !madrasah) return;
    setIsSaving(true);
    const { error } = await supabase.from('fee_structures').insert({
      madrasah_id: madrasah.id,
      class_id: structClassId,
      category_id: structCatId,
      fee_name: structName,
      amount: parseFloat(structAmount),
      is_monthly: true
    });
    if (!error) {
      setShowAddStructure(false);
      setStructName('');
      setStructAmount('');
      fetchStructures();
    }
    setIsSaving(false);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-slate-400 shadow-sm border border-slate-100 active:scale-90 transition-all">
            <ArrowLeft size={24}/>
          </button>
          <div>
            <h1 className="text-2xl font-black text-slate-800 font-noto">{t('fee_collection', lang)}</h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Easy Payment Management</p>
          </div>
        </div>
        <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 shadow-inner">
          <Wallet size={24} />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-slate-100 p-1.5 rounded-[2rem] mx-4">
        {(['collect', 'history', 'setup'] as FeeTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-3.5 rounded-[1.5rem] text-[11px] font-black uppercase tracking-widest transition-all ${
              activeTab === tab 
                ? 'bg-white text-blue-600 shadow-md' 
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            {tab === 'collect' ? 'Collect' : tab === 'history' ? 'History' : 'Settings'}
          </button>
        ))}
      </div>

      {activeTab === 'collect' && (
        <div className="space-y-6 px-4">
          {!selectedStudent ? (
            <div className="space-y-6">
              <div className="relative group">
                <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-blue-500 group-focus-within:scale-110 transition-transform" size={22} />
                <input 
                  type="text" 
                  placeholder={t('search_student', lang)}
                  className="w-full pl-16 pr-6 py-6 bg-white rounded-[2.5rem] outline-none text-slate-800 font-black text-lg shadow-xl border-2 border-transparent focus:border-blue-100 transition-all placeholder:text-slate-300"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              
              <div className="grid grid-cols-1 gap-3">
                {students.map(std => (
                  <button 
                    key={std.id}
                    onClick={() => {
                      setSelectedStudent(std);
                      fetchStudentFees(std.id);
                    }}
                    className="w-full bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-lg flex items-center justify-between group active:scale-[0.98] transition-all"
                  >
                    <div className="flex items-center gap-5">
                      <div className="w-14 h-14 bg-gradient-to-br from-blue-50 to-indigo-50 text-blue-600 rounded-3xl flex items-center justify-center shadow-inner border border-white">
                        <User size={28} />
                      </div>
                      <div className="text-left">
                        <h4 className="font-black text-slate-800 font-noto text-lg leading-tight">{std.student_name}</h4>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-[9px] font-black rounded-full uppercase">Roll: {std.roll}</span>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{std.classes?.class_name}</span>
                        </div>
                      </div>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-300 group-hover:bg-blue-50 group-hover:text-blue-500 transition-colors">
                      <ChevronRight size={20} />
                    </div>
                  </button>
                ))}
                {searchQuery && students.length === 0 && (
                  <div className="text-center py-10 opacity-40">
                    <Search size={48} className="mx-auto mb-4" />
                    <p className="font-black uppercase tracking-widest text-xs">No students found</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-6 animate-in slide-in-from-bottom-10 duration-500">
              {/* Student Card */}
              <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-8 rounded-[3rem] text-white shadow-2xl relative overflow-hidden">
                <div className="absolute -right-10 -top-10 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
                <button 
                  onClick={() => setSelectedStudent(null)}
                  className="absolute top-6 right-6 w-10 h-10 bg-white/20 hover:bg-white/30 rounded-2xl flex items-center justify-center backdrop-blur-md transition-colors"
                >
                  <X size={20} />
                </button>
                <div className="flex items-center gap-6">
                  <div className="w-20 h-20 bg-white/20 rounded-[2rem] flex items-center justify-center backdrop-blur-md border border-white/30 shadow-inner">
                    <User size={40} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black font-noto">{selectedStudent.student_name}</h3>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="px-3 py-1 bg-white/20 rounded-full text-[10px] font-black uppercase tracking-widest">Roll: {selectedStudent.roll}</span>
                      <span className="text-xs font-bold opacity-80">{selectedStudent.classes?.class_name}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Fee List */}
              <div className="space-y-4">
                <div className="flex items-center justify-between px-2">
                  <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Pending Fees</h4>
                  <button 
                    onClick={() => setShowQuickAddFee(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-100 transition-colors"
                  >
                    <Plus size={14} /> Quick Charge
                  </button>
                </div>
                
                {loading ? (
                  <div className="flex justify-center py-10"><Loader2 className="animate-spin text-blue-600" /></div>
                ) : studentFees.length === 0 ? (
                  <div className="bg-white p-12 rounded-[3rem] text-center border-2 border-dashed border-slate-100">
                    <div className="w-16 h-16 bg-emerald-50 text-emerald-500 rounded-3xl flex items-center justify-center mx-auto mb-4">
                      <CheckCircle2 size={32} />
                    </div>
                    <p className="text-sm font-black text-slate-400 uppercase tracking-widest">All fees are paid!</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {studentFees.map(fee => (
                      <div 
                        key={fee.id}
                        onClick={() => {
                          const next = new Set(selectedFeeIds);
                          if (next.has(fee.id)) next.delete(fee.id);
                          else next.add(fee.id);
                          setSelectedFeeIds(next);
                        }}
                        className={`p-5 rounded-[2.2rem] border-2 transition-all flex items-center justify-between cursor-pointer active:scale-[0.98] ${
                          selectedFeeIds.has(fee.id) 
                            ? 'bg-white border-blue-500 shadow-xl' 
                            : 'bg-slate-50 border-transparent opacity-60'
                        }`}
                      >
                        <div className="flex items-center gap-4">
                          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                            selectedFeeIds.has(fee.id) ? 'bg-blue-50 text-blue-600' : 'bg-slate-200 text-slate-400'
                          }`}>
                            {selectedFeeIds.has(fee.id) ? <CheckCircle2 size={24} /> : <div className="w-6 h-6 rounded-full border-2 border-slate-300" />}
                          </div>
                          <div>
                            <h5 className="text-base font-black text-slate-800 font-noto leading-tight">{fee.description}</h5>
                            <p className="text-[10px] font-black text-slate-400 uppercase mt-1 tracking-wider">{fee.month}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-black text-blue-600">৳{fee.due_amount}</p>
                          {fee.status === 'partial' && (
                            <p className="text-[9px] font-black text-emerald-500 uppercase">Paid: ৳{fee.paid_amount}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Payment Box */}
              {selectedFeeIds.size > 0 && (
                <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-2xl space-y-6 sticky bottom-4 z-20">
                  <div className="flex items-center justify-between px-2">
                    <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Total Payable</span>
                    <span className="text-2xl font-black text-slate-800">
                      ৳{studentFees.filter(f => selectedFeeIds.has(f.id)).reduce((sum, f) => sum + f.due_amount, 0)}
                    </span>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="relative">
                      <Banknote className="absolute left-6 top-1/2 -translate-y-1/2 text-blue-500" size={24} />
                      <input 
                        type="number" 
                        className="w-full h-20 bg-slate-50 rounded-[1.8rem] pl-16 pr-24 font-black text-2xl text-blue-600 outline-none border-2 border-transparent focus:border-blue-200 transition-all"
                        placeholder="0.00"
                        value={paymentAmount}
                        onChange={(e) => setPaymentAmount(e.target.value)}
                      />
                      <button 
                        onClick={() => setPaymentAmount(studentFees.filter(f => selectedFeeIds.has(f.id)).reduce((sum, f) => sum + f.due_amount, 0).toString())}
                        className="absolute right-6 top-1/2 -translate-y-1/2 px-4 py-2 bg-blue-600 text-white text-[10px] font-black rounded-xl uppercase shadow-lg active:scale-90 transition-all"
                      >
                        Full
                      </button>
                    </div>
                  </div>

                  <button 
                    onClick={handleCollectPayment}
                    disabled={isSaving || !paymentAmount}
                    className="w-full py-6 bg-blue-600 text-white font-black rounded-[1.8rem] shadow-xl shadow-blue-200 flex items-center justify-center gap-4 active:scale-95 transition-all text-lg"
                  >
                    {isSaving ? <Loader2 className="animate-spin" /> : <><Receipt size={24}/> {t('record_payment', lang)}</>}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === 'setup' && (
        <div className="space-y-8 px-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between px-2">
              <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Fee Categories</h4>
              <button onClick={() => setShowAddCategory(true)} className="w-10 h-10 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center shadow-sm active:scale-90 transition-all"><Plus size={20}/></button>
            </div>
            <div className="grid grid-cols-1 gap-3">
              {categories.map(cat => (
                <div key={cat.id} className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-md flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-slate-50 text-slate-400 rounded-2xl flex items-center justify-center"><LayoutGrid size={24}/></div>
                    <div>
                      <h5 className="text-base font-black text-slate-800 font-noto">{cat.name}</h5>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{cat.type}</p>
                    </div>
                  </div>
                  <button className="w-10 h-10 rounded-xl hover:bg-slate-50 text-slate-300 transition-colors"><Edit3 size={18}/></button>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between px-2">
              <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Standard Fee Setup</h4>
              <button onClick={() => setShowAddStructure(true)} className="w-10 h-10 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center shadow-sm active:scale-90 transition-all"><Plus size={20}/></button>
            </div>
            <div className="grid grid-cols-1 gap-3">
              {structures.map(struct => (
                <div key={struct.id} className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-md flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center"><Banknote size={24}/></div>
                    <div>
                      <h5 className="text-base font-black text-slate-800 font-noto">{struct.fee_name}</h5>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        {struct.classes?.class_name} • ৳{struct.amount}
                      </p>
                    </div>
                  </div>
                  <button className="w-10 h-10 rounded-xl hover:bg-slate-50 text-slate-300 transition-colors"><Edit3 size={18}/></button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MODALS */}
      {showQuickAddFee && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xl z-[999] flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-sm rounded-[3rem] p-8 space-y-6 animate-in zoom-in-95">
             <div className="flex items-center justify-between">
               <h3 className="text-xl font-black text-slate-800">Quick Charge</h3>
               <button onClick={() => setShowQuickAddFee(false)} className="w-10 h-10 bg-slate-50 text-slate-400 rounded-2xl flex items-center justify-center"><X size={20} /></button>
             </div>
             <div className="space-y-5">
                <div className="space-y-2">
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest px-1">Fee Description</label>
                  <input 
                    type="text" 
                    className="w-full h-16 bg-slate-50 rounded-2xl px-6 font-black text-sm outline-none border-2 border-transparent focus:border-blue-200 transition-all" 
                    placeholder="e.g. Exam Fee, Books" 
                    value={quickFeeDesc} 
                    onChange={(e) => setQuickFeeDesc(e.target.value)} 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest px-1">Amount (৳)</label>
                  <input 
                    type="number" 
                    className="w-full h-16 bg-slate-50 rounded-2xl px-6 font-black text-lg text-blue-600 outline-none border-2 border-transparent focus:border-blue-200 transition-all" 
                    placeholder="0.00" 
                    value={quickFeeAmount} 
                    onChange={(e) => setQuickFeeAmount(e.target.value)} 
                  />
                </div>
                <button 
                  onClick={handleQuickAddFee} 
                  disabled={isSaving || !quickFeeAmount || !quickFeeDesc} 
                  className="w-full py-6 bg-emerald-600 text-white font-black rounded-[1.5rem] shadow-xl shadow-emerald-100 flex items-center justify-center gap-3 active:scale-95 transition-all"
                >
                  {isSaving ? <Loader2 className="animate-spin" /> : <><Plus size={20}/> Add Charge</>}
                </button>
             </div>
          </div>
        </div>
      )}

      {showAddCategory && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xl z-[999] flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-sm rounded-[3rem] p-8 space-y-6 animate-in zoom-in-95">
             <div className="flex items-center justify-between">
               <h3 className="text-xl font-black text-slate-800">{t('add_category', lang)}</h3>
               <button onClick={() => setShowAddCategory(false)} className="w-10 h-10 bg-slate-50 text-slate-400 rounded-2xl flex items-center justify-center"><X size={20} /></button>
             </div>
             <div className="space-y-5">
                <div className="space-y-2">
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest px-1">Category Name</label>
                  <input type="text" className="w-full h-16 bg-slate-50 rounded-2xl px-6 font-black text-sm outline-none border-2 border-transparent focus:border-blue-200 transition-all" placeholder="e.g. Monthly Fee" value={catName} onChange={(e) => setCatName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest px-1">Type</label>
                  <select className="w-full h-16 bg-slate-50 rounded-2xl px-6 font-black text-sm outline-none border-2 border-transparent focus:border-blue-200 appearance-none" value={catType} onChange={(e) => setCatType(e.target.value as any)}>
                    <option value="recurring">Recurring (Monthly)</option>
                    <option value="one-time">One-time</option>
                    <option value="optional">Optional</option>
                  </select>
                </div>
                <button onClick={handleAddCategory} disabled={isSaving} className="w-full py-6 bg-blue-600 text-white font-black rounded-[1.5rem] shadow-xl shadow-blue-100 flex items-center justify-center gap-3 active:scale-95 transition-all">
                  {isSaving ? <Loader2 className="animate-spin" /> : 'Save Category'}
                </button>
             </div>
          </div>
        </div>
      )}

      {showAddStructure && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xl z-[999] flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-sm rounded-[3rem] p-8 space-y-6 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
             <div className="flex items-center justify-between">
               <h3 className="text-xl font-black text-slate-800">{t('setup_fee', lang)}</h3>
               <button onClick={() => setShowAddStructure(false)} className="w-10 h-10 bg-slate-50 text-slate-400 rounded-2xl flex items-center justify-center"><X size={20} /></button>
             </div>
             <div className="space-y-5">
                <div className="space-y-2">
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest px-1">Class</label>
                  <select className="w-full h-16 bg-slate-50 rounded-2xl px-6 font-black text-sm outline-none border-2 border-transparent focus:border-blue-200 appearance-none" value={structClassId} onChange={(e) => setStructClassId(e.target.value)}>
                    <option value="">Select Class</option>
                    {classes.map(c => <option key={c.id} value={c.id}>{c.class_name}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest px-1">Category</label>
                  <select className="w-full h-16 bg-slate-50 rounded-2xl px-6 font-black text-sm outline-none border-2 border-transparent focus:border-blue-200 appearance-none" value={structCatId} onChange={(e) => setStructCatId(e.target.value)}>
                    <option value="">Select Category</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest px-1">Fee Name</label>
                  <input type="text" className="w-full h-16 bg-slate-50 rounded-2xl px-6 font-black text-sm outline-none border-2 border-transparent focus:border-blue-200 transition-all" placeholder="e.g. Tuition Fee" value={structName} onChange={(e) => setStructName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest px-1">Amount</label>
                  <input type="number" className="w-full h-16 bg-slate-50 rounded-2xl px-6 font-black text-lg text-blue-600 outline-none border-2 border-transparent focus:border-blue-200 transition-all" placeholder="0.00" value={structAmount} onChange={(e) => setStructAmount(e.target.value)} />
                </div>
                <button onClick={handleAddStructure} disabled={isSaving} className="w-full py-6 bg-blue-600 text-white font-black rounded-[1.5rem] shadow-xl shadow-blue-100 flex items-center justify-center gap-3 active:scale-95 transition-all">
                  {isSaving ? <Loader2 className="animate-spin" /> : 'Save Structure'}
                </button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Fees;
