
import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { 
  ArrowLeft, Plus, Search, Banknote, LayoutGrid, Settings, 
  History, Trash2, Edit3, Save, X, Loader2, CheckCircle2, 
  AlertCircle, ChevronRight, Calculator, User, Calendar,
  Percent, DollarSign, Filter, ListChecks, ArrowUpRight
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

type FeeTab = 'collection' | 'setup' | 'generation' | 'overrides';

const Fees: React.FC<FeesProps> = ({ lang, madrasah, onBack, role }) => {
  const [activeTab, setActiveTab] = useState<FeeTab>('collection');
  const [loading, setLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Data states
  const [categories, setCategories] = useState<FeeCategory[]>([]);
  const [structures, setStructures] = useState<FeeStructure[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  
  // Selection states
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [studentFees, setStudentFees] = useState<Fee[]>([]);
  const [selectedFeeIds, setSelectedFeeIds] = useState<Set<string>>(new Set());

  // Form states
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [showAddStructure, setShowAddStructure] = useState(false);
  const [showAddOverride, setShowAddOverride] = useState(false);
  
  const [catName, setCatName] = useState('');
  const [catType, setCatType] = useState<'recurring' | 'one-time' | 'optional'>('recurring');
  
  const [structClassId, setStructClassId] = useState('');
  const [structCatId, setStructCatId] = useState('');
  const [structName, setStructName] = useState('');
  const [structAmount, setStructAmount] = useState('');
  const [structIsMonthly, setStructIsMonthly] = useState(true);

  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'bkash' | 'nagad' | 'bank'>('cash');

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
      // Auto-select all unpaid fees by default
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
        
        // Record in ledger
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
      is_monthly: structIsMonthly
    });
    if (!error) {
      setShowAddStructure(false);
      setStructName('');
      setStructAmount('');
      fetchStructures();
    }
    setIsSaving(false);
  };

  const handleGenerateFees = async (month: string) => {
    if (!madrasah || !selectedClassId) return;
    setIsSaving(true);
    try {
      // 1. Get all students of the class
      const { data: students } = await supabase.from('students').select('id').eq('class_id', selectedClassId);
      if (!students) return;

      // 2. Get all structures for the class
      const { data: structures } = await supabase.from('fee_structures').select('*').eq('class_id', selectedClassId);
      if (!structures) return;

      // 3. Get all overrides for the students
      const { data: overrides } = await supabase
        .from('student_fee_overrides')
        .select('*')
        .in('student_id', students.map(s => s.id));

      const feeRecords: any[] = [];
      
      for (const std of students) {
        for (const struct of structures) {
          // Check if already generated
          const { data: existing } = await supabase
            .from('fees')
            .select('id')
            .eq('student_id', std.id)
            .eq('fee_structure_id', struct.id)
            .eq('month', month)
            .maybeSingle();
            
          if (!existing) {
            const override = overrides?.find(o => o.student_id === std.id && o.fee_structure_id === struct.id);
            let finalAmount = struct.amount;
            if (override) {
              if (override.override_amount !== null && override.override_amount !== undefined) {
                finalAmount = override.override_amount;
              } else if (override.discount_percentage !== null && override.discount_percentage !== undefined) {
                finalAmount = struct.amount * (1 - override.discount_percentage / 100);
              }
            }

            feeRecords.push({
              madrasah_id: madrasah.id,
              student_id: std.id,
              class_id: selectedClassId,
              fee_structure_id: struct.id,
              amount: finalAmount,
              paid_amount: 0,
              due_amount: finalAmount,
              month: month,
              description: struct.fee_name,
              status: 'unpaid'
            });
          }
        }
      }

      if (feeRecords.length > 0) {
        const { error } = await supabase.from('fees').insert(feeRecords);
        if (error) throw error;
      }
      
      alert(lang === 'bn' ? `${feeRecords.length} টি ফি জেনারেট করা হয়েছে` : `${feeRecords.length} fees generated successfully`);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-[#2563EB] border border-blue-100">
            <ArrowLeft size={20}/>
          </button>
          <h1 className="text-xl font-black text-[#1E293B] font-noto">{t('fee_collection', lang)}</h1>
        </div>
      </div>

      <div className="flex bg-white p-1.5 rounded-[2rem] border border-slate-100 shadow-sm mx-1">
        {(['collection', 'setup', 'generation', 'overrides'] as FeeTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-3 rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest transition-all ${
              activeTab === tab 
                ? 'bg-[#2563EB] text-white shadow-premium' 
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            {tab === 'collection' ? t('collection', lang) : 
             tab === 'setup' ? 'Setup' : 
             tab === 'generation' ? 'Generate' : 'Discount'}
          </button>
        ))}
      </div>

      {activeTab === 'collection' && (
        <div className="space-y-4 px-1">
          {!selectedStudent ? (
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-[#2563EB]" size={20} />
                <input 
                  type="text" 
                  placeholder={t('search_student', lang)}
                  className="w-full pl-14 pr-6 py-5 bg-white rounded-[2rem] outline-none text-[#1E293B] font-black text-sm shadow-bubble border border-slate-100"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                {students.map(std => (
                  <button 
                    key={std.id}
                    onClick={() => {
                      setSelectedStudent(std);
                      fetchStudentFees(std.id);
                    }}
                    className="w-full bg-white p-5 rounded-[2rem] border border-slate-100 shadow-bubble flex items-center justify-between group active:scale-[0.98] transition-all"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-blue-50 text-[#2563EB] rounded-2xl flex items-center justify-center shadow-inner">
                        <User size={24} />
                      </div>
                      <div className="text-left">
                        <h4 className="font-black text-[#1E3A8A] font-noto leading-tight">{std.student_name}</h4>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">
                          Roll: {std.roll} • {std.classes?.class_name}
                        </p>
                      </div>
                    </div>
                    <ChevronRight size={20} className="text-slate-300 group-hover:translate-x-1 transition-transform" />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-6 animate-in slide-in-from-right-4">
              <div className="bg-gradient-to-br from-[#1E3A8A] to-[#2563EB] p-6 rounded-[2.5rem] text-white shadow-premium relative overflow-hidden">
                <button 
                  onClick={() => setSelectedStudent(null)}
                  className="absolute top-4 right-4 w-8 h-8 bg-white/20 rounded-full flex items-center justify-center"
                >
                  <X size={16} />
                </button>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-white/20 rounded-[1.8rem] flex items-center justify-center backdrop-blur-md">
                    <User size={32} />
                  </div>
                  <div>
                    <h3 className="text-xl font-black font-noto">{selectedStudent.student_name}</h3>
                    <p className="text-[10px] font-black uppercase opacity-70 tracking-widest">
                      Roll: {selectedStudent.roll} • {selectedStudent.classes?.class_name}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between px-3">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Select Items to Pay</h4>
                  <button 
                    onClick={() => {
                      if (selectedFeeIds.size === studentFees.length) setSelectedFeeIds(new Set());
                      else setSelectedFeeIds(new Set(studentFees.map(f => f.id)));
                    }}
                    className="text-[9px] font-black text-[#2563EB] uppercase"
                  >
                    {selectedFeeIds.size === studentFees.length ? 'Deselect All' : 'Select All'}
                  </button>
                </div>
                
                {loading ? (
                  <div className="flex justify-center py-10"><Loader2 className="animate-spin text-[#2563EB]" /></div>
                ) : studentFees.length === 0 ? (
                  <div className="bg-white p-10 rounded-[2.5rem] text-center border border-slate-100 shadow-bubble">
                    <CheckCircle2 size={40} className="mx-auto text-emerald-400 mb-3" />
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest">No Pending Fees</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {studentFees.map(fee => (
                      <div 
                        key={fee.id}
                        onClick={() => {
                          const next = new Set(selectedFeeIds);
                          if (next.has(fee.id)) next.delete(fee.id);
                          else next.add(fee.id);
                          setSelectedFeeIds(next);
                        }}
                        className={`p-4 rounded-[1.8rem] border transition-all flex items-center justify-between cursor-pointer ${
                          selectedFeeIds.has(fee.id) 
                            ? 'bg-white border-[#2563EB] shadow-md' 
                            : 'bg-white/50 border-slate-100 opacity-60'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                            selectedFeeIds.has(fee.id) ? 'bg-blue-50 text-[#2563EB]' : 'bg-slate-100 text-slate-300'
                          }`}>
                            <ListChecks size={20} />
                          </div>
                          <div>
                            <h5 className="text-sm font-black text-[#1E3A8A] font-noto leading-tight">{fee.description}</h5>
                            <p className="text-[9px] font-black text-slate-400 uppercase mt-0.5">{fee.month}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-black text-[#2563EB]">৳{fee.due_amount}</p>
                          {fee.status === 'partial' && (
                            <p className="text-[8px] font-black text-emerald-500 uppercase">Paid: ৳{fee.paid_amount}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {selectedFeeIds.size > 0 && (
                <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-bubble space-y-5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Total Selected Due</span>
                    <span className="text-xl font-black text-[#1E3A8A]">
                      ৳{studentFees.filter(f => selectedFeeIds.has(f.id)).reduce((sum, f) => sum + f.due_amount, 0)}
                    </span>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Payment Amount</label>
                    <div className="relative">
                      <Banknote className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={20} />
                      <input 
                        type="number" 
                        className="w-full h-14 bg-slate-50 rounded-2xl px-12 font-black text-lg text-[#2563EB] outline-none border-2 border-transparent focus:border-[#2563EB]/20 transition-all"
                        placeholder="0.00"
                        value={paymentAmount}
                        onChange={(e) => setPaymentAmount(e.target.value)}
                      />
                      <button 
                        onClick={() => setPaymentAmount(studentFees.filter(f => selectedFeeIds.has(f.id)).reduce((sum, f) => sum + f.due_amount, 0).toString())}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-[#2563EB] uppercase"
                      >
                        Full Pay
                      </button>
                    </div>
                  </div>

                  <button 
                    onClick={handleCollectPayment}
                    disabled={isSaving || !paymentAmount}
                    className="w-full py-5 bg-[#2563EB] text-white font-black rounded-full shadow-premium flex items-center justify-center gap-3 active:scale-95 transition-all"
                  >
                    {isSaving ? <Loader2 className="animate-spin" /> : <><Save size={20}/> {t('record_payment', lang)}</>}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === 'setup' && (
        <div className="space-y-6 px-1">
          <div className="space-y-3">
            <div className="flex items-center justify-between px-3">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('fee_categories', lang)}</h4>
              <button onClick={() => setShowAddCategory(true)} className="w-8 h-8 bg-blue-50 text-[#2563EB] rounded-lg flex items-center justify-center"><Plus size={18}/></button>
            </div>
            <div className="grid grid-cols-1 gap-2">
              {categories.map(cat => (
                <div key={cat.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-slate-50 text-slate-400 rounded-xl flex items-center justify-center"><LayoutGrid size={20}/></div>
                    <div>
                      <h5 className="text-sm font-black text-[#1E3A8A] font-noto">{cat.name}</h5>
                      <p className="text-[9px] font-black text-slate-400 uppercase">{cat.type}</p>
                    </div>
                  </div>
                  <button className="text-slate-300"><Edit3 size={16}/></button>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between px-3">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('fee_structures', lang)}</h4>
              <button onClick={() => setShowAddStructure(true)} className="w-8 h-8 bg-blue-50 text-[#2563EB] rounded-lg flex items-center justify-center"><Plus size={18}/></button>
            </div>
            <div className="grid grid-cols-1 gap-2">
              {structures.map(struct => (
                <div key={struct.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-50 text-[#2563EB] rounded-xl flex items-center justify-center"><Banknote size={20}/></div>
                    <div>
                      <h5 className="text-sm font-black text-[#1E3A8A] font-noto">{struct.fee_name}</h5>
                      <p className="text-[9px] font-black text-slate-400 uppercase">
                        {struct.classes?.class_name} • ৳{struct.amount}
                      </p>
                    </div>
                  </div>
                  <button className="text-slate-300"><Edit3 size={16}/></button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'generation' && (
        <div className="px-1 space-y-6">
          <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-bubble space-y-6">
            <div className="text-center space-y-2">
              <div className="w-16 h-16 bg-blue-50 text-[#2563EB] rounded-[1.5rem] flex items-center justify-center mx-auto shadow-inner">
                <Calculator size={32} />
              </div>
              <h3 className="text-xl font-black text-[#1E3A8A] font-noto">{t('fee_generation', lang)}</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed">
                Generate monthly fees for all students in a class
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Select Class</label>
                <select 
                  className="w-full h-14 bg-slate-50 rounded-2xl px-6 font-black text-sm outline-none border-2 border-transparent focus:border-[#2563EB]/20 appearance-none"
                  value={selectedClassId}
                  onChange={(e) => setSelectedClassId(e.target.value)}
                >
                  <option value="">{t('select_class_placeholder', lang)}</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.class_name}</option>)}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Select Month</label>
                <input 
                  type="month" 
                  className="w-full h-14 bg-slate-50 rounded-2xl px-6 font-black text-sm outline-none border-2 border-transparent focus:border-[#2563EB]/20"
                  defaultValue={new Date().toISOString().slice(0, 7)}
                  id="gen-month"
                />
              </div>

              <button 
                onClick={() => {
                  const month = (document.getElementById('gen-month') as HTMLInputElement).value;
                  handleGenerateFees(month);
                }}
                disabled={isSaving || !selectedClassId}
                className="w-full py-5 bg-[#2563EB] text-white font-black rounded-full shadow-premium flex items-center justify-center gap-3 active:scale-95 transition-all mt-4"
              >
                {isSaving ? <Loader2 className="animate-spin" /> : <><ArrowUpRight size={20}/> {t('generate_fees', lang)}</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'overrides' && (
        <div className="px-1 space-y-4">
          <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-bubble space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black text-[#1E3A8A] font-noto">Apply Student Discount</h3>
              <div className="w-10 h-10 bg-blue-50 text-[#2563EB] rounded-xl flex items-center justify-center">
                <Percent size={20} />
              </div>
            </div>

            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                <input 
                  type="text" 
                  placeholder="Search student for discount..."
                  className="w-full h-12 pl-12 pr-4 bg-slate-50 rounded-xl font-black text-sm outline-none border-2 border-transparent focus:border-[#2563EB]/20"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              {selectedStudent ? (
                <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100 flex items-center justify-between">
                  <div>
                    <h4 className="font-black text-[#1E3A8A] font-noto">{selectedStudent.student_name}</h4>
                    <p className="text-[9px] font-black text-[#2563EB] uppercase tracking-widest">
                      Roll: {selectedStudent.roll} • {selectedStudent.classes?.class_name}
                    </p>
                  </div>
                  <button onClick={() => setSelectedStudent(null)} className="text-slate-400 hover:text-red-500"><X size={18}/></button>
                </div>
              ) : (
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {students.map(std => (
                    <button 
                      key={std.id}
                      onClick={() => setSelectedStudent(std)}
                      className="w-full p-3 text-left hover:bg-slate-50 rounded-xl transition-colors flex items-center gap-3"
                    >
                      <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-slate-400 border border-slate-100"><User size={14}/></div>
                      <div>
                        <p className="text-xs font-black text-[#1E3A8A]">{std.student_name}</p>
                        <p className="text-[8px] font-black text-slate-400 uppercase">Roll: {std.roll}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {selectedStudent && (
                <div className="space-y-4 pt-2 border-t border-slate-100">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Select Fee Structure</label>
                    <select 
                      className="w-full h-12 bg-slate-50 rounded-xl px-4 font-black text-sm outline-none border-2 border-transparent focus:border-[#2563EB]/20 appearance-none"
                      id="override-struct"
                    >
                      <option value="">Select Structure</option>
                      {structures.filter(s => s.class_id === selectedStudent.class_id).map(s => (
                        <option key={s.id} value={s.id}>{s.fee_name} (৳{s.amount})</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Override Amount</label>
                      <input type="number" id="override-amount" className="w-full h-12 bg-slate-50 rounded-xl px-4 font-black text-sm outline-none border-2 border-transparent focus:border-[#2563EB]/20" placeholder="e.g. 400" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Discount %</label>
                      <input type="number" id="override-discount" className="w-full h-12 bg-slate-50 rounded-xl px-4 font-black text-sm outline-none border-2 border-transparent focus:border-[#2563EB]/20" placeholder="e.g. 10" />
                    </div>
                  </div>

                  <button 
                    onClick={async () => {
                      const structId = (document.getElementById('override-struct') as HTMLSelectElement).value;
                      const amount = (document.getElementById('override-amount') as HTMLInputElement).value;
                      const discount = (document.getElementById('override-discount') as HTMLInputElement).value;
                      
                      if (!structId || (!amount && !discount)) return;
                      
                      setIsSaving(true);
                      const { error } = await supabase.from('student_fee_overrides').upsert({
                        student_id: selectedStudent.id,
                        fee_structure_id: structId,
                        override_amount: amount ? parseFloat(amount) : null,
                        discount_percentage: discount ? parseFloat(discount) : null
                      });
                      
                      if (!error) {
                        alert(t('success', lang));
                        setSelectedStudent(null);
                      } else {
                        alert(error.message);
                      }
                      setIsSaving(false);
                    }}
                    disabled={isSaving}
                    className="w-full py-4 bg-[#2563EB] text-white font-black rounded-xl shadow-premium flex items-center justify-center gap-3 active:scale-95 transition-all"
                  >
                    {isSaving ? <Loader2 className="animate-spin" /> : <><Save size={18}/> Save Discount</>}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}


      {/* MODALS */}
      {showAddCategory && (
        <div className="fixed inset-0 bg-[#080A12]/60 backdrop-blur-xl z-[999] flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-sm rounded-[3rem] p-8 space-y-6 animate-in zoom-in-95">
             <div className="flex items-center justify-between">
               <h3 className="text-xl font-black text-[#1E3A8A]">{t('add_category', lang)}</h3>
               <button onClick={() => setShowAddCategory(false)} className="w-9 h-9 bg-slate-50 text-slate-400 rounded-xl flex items-center justify-center"><X size={18} /></button>
             </div>
             <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Category Name</label>
                  <input type="text" className="w-full h-14 bg-slate-50 rounded-2xl px-6 font-black text-sm outline-none border-2 border-transparent focus:border-[#2563EB]/20 transition-all" placeholder="e.g. Monthly Fee" value={catName} onChange={(e) => setCatName(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Type</label>
                  <select className="w-full h-14 bg-slate-50 rounded-2xl px-6 font-black text-sm outline-none border-2 border-transparent focus:border-[#2563EB]/20 appearance-none" value={catType} onChange={(e) => setCatType(e.target.value as any)}>
                    <option value="recurring">Recurring (Monthly)</option>
                    <option value="one-time">One-time</option>
                    <option value="optional">Optional</option>
                  </select>
                </div>
                <button onClick={handleAddCategory} disabled={isSaving} className="w-full py-5 bg-[#2563EB] text-white font-black rounded-full shadow-premium flex items-center justify-center gap-3 active:scale-95 transition-all">
                  {isSaving ? <Loader2 className="animate-spin" /> : 'Save Category'}
                </button>
             </div>
          </div>
        </div>
      )}

      {showAddStructure && (
        <div className="fixed inset-0 bg-[#080A12]/60 backdrop-blur-xl z-[999] flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-sm rounded-[3rem] p-8 space-y-6 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
             <div className="flex items-center justify-between">
               <h3 className="text-xl font-black text-[#1E3A8A]">{t('setup_fee', lang)}</h3>
               <button onClick={() => setShowAddStructure(false)} className="w-9 h-9 bg-slate-50 text-slate-400 rounded-xl flex items-center justify-center"><X size={18} /></button>
             </div>
             <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Class</label>
                  <select className="w-full h-14 bg-slate-50 rounded-2xl px-6 font-black text-sm outline-none border-2 border-transparent focus:border-[#2563EB]/20 appearance-none" value={structClassId} onChange={(e) => setStructClassId(e.target.value)}>
                    <option value="">Select Class</option>
                    {classes.map(c => <option key={c.id} value={c.id}>{c.class_name}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Category</label>
                  <select className="w-full h-14 bg-slate-50 rounded-2xl px-6 font-black text-sm outline-none border-2 border-transparent focus:border-[#2563EB]/20 appearance-none" value={structCatId} onChange={(e) => setStructCatId(e.target.value)}>
                    <option value="">Select Category</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Fee Name</label>
                  <input type="text" className="w-full h-14 bg-slate-50 rounded-2xl px-6 font-black text-sm outline-none border-2 border-transparent focus:border-[#2563EB]/20 transition-all" placeholder="e.g. Tuition Fee" value={structName} onChange={(e) => setStructName(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Amount</label>
                  <input type="number" className="w-full h-14 bg-slate-50 rounded-2xl px-6 font-black text-sm outline-none border-2 border-transparent focus:border-[#2563EB]/20 transition-all" placeholder="0.00" value={structAmount} onChange={(e) => setStructAmount(e.target.value)} />
                </div>
                <button onClick={handleAddStructure} disabled={isSaving} className="w-full py-5 bg-[#2563EB] text-white font-black rounded-full shadow-premium flex items-center justify-center gap-3 active:scale-95 transition-all">
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
