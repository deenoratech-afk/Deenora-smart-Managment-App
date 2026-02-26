import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { Loader2, Plus, X, ChevronDown, Tag, DollarSign, Search, History, CheckCircle2, AlertCircle } from 'lucide-react';
import { t } from '../translations';
import { Madrasah, Class, FeeCategory, FeeStructure, Language, Student, CoachingBatch, CoachingEnrollment, Fee } from '../types';

interface AccountingProps {
  lang: Language;
  madrasah: Madrasah | null;
  onBack: () => void;
  role: string;
}

const Accounting: React.FC<AccountingProps> = ({ lang, madrasah, onBack, role }) => {
  const [activeTab, setActiveTab] = useState<'setup' | 'overrides' | 'coaching' | 'generation' | 'collection'>('setup');
  const [feeCategories, setFeeCategories] = useState<FeeCategory[]>([]);
  const [feeStructures, setFeeStructures] = useState<FeeStructure[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [showAddStructure, setShowAddStructure] = useState(false);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryType, setNewCategoryType] = useState<'recurring' | 'one-time' | 'optional'>('one-time');
  const [newCategoryDesc, setNewCategoryDesc] = useState('');
  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [feeNote, setFeeNote] = useState('');
  const [amount, setAmount] = useState('');
  const [isMonthlyFee, setIsMonthlyFee] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showClassDropdown, setShowClassDropdown] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const [coachingBatches, setCoachingBatches] = useState<CoachingBatch[]>([]);
  const [showAddBatch, setShowAddBatch] = useState(false);
  const [batchName, setBatchName] = useState('');
  const [batchFee, setBatchFee] = useState('');
  const [overrides, setOverrides] = useState<any[]>([]);
  const [showAddOverride, setShowAddOverride] = useState(false);
  const [overrideStudentId, setOverrideStudentId] = useState('');
  const [overrideStructureId, setOverrideStructureId] = useState('');
  const [overrideAmount, setOverrideAmount] = useState('');
  const [overrideDiscount, setOverrideDiscount] = useState('');
  const [students, setStudents] = useState<Student[]>([]);

  const [selectedBatch, setSelectedBatch] = useState<CoachingBatch | null>(null);
  const [showEnrollmentModal, setShowEnrollmentModal] = useState(false);
  const [enrollments, setEnrollments] = useState<CoachingEnrollment[]>([]);
  const [enrollStudentId, setEnrollStudentId] = useState('');

  // Collection Tab State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [studentFees, setStudentFees] = useState<Fee[]>([]);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedFee, setSelectedFee] = useState<Fee | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [isRecordingPayment, setIsRecordingPayment] = useState(false);

  const fetchData = async () => {
    if (!madrasah?.id) return;

    const { data: categoriesData } = await supabase
      .from('fee_categories')
      .select('*')
      .eq('madrasah_id', madrasah.id);
    setFeeCategories(categoriesData || []);

    const { data: structuresData } = await supabase
      .from('fee_structures')
      .select('*, classes(class_name), fee_categories(name)')
      .eq('madrasah_id', madrasah.id);
    setFeeStructures(structuresData || []);

    const { data: classesData } = await supabase
      .from('classes')
      .select('*')
      .eq('madrasah_id', madrasah.id);
    setClasses(classesData || []);

    const { data: batches } = await supabase
      .from('coaching_batches')
      .select('*')
      .eq('madrasah_id', madrasah.id);
    setCoachingBatches(batches || []);

    const { data: overrideData } = await supabase
      .from('student_fee_overrides')
      .select('*, students(student_name), fee_structures(fee_name)');
    setOverrides(overrideData || []);

    const { data: stds } = await supabase
      .from('students')
      .select('*, classes(class_name)')
      .eq('madrasah_id', madrasah.id);
    setStudents(stds || []);
  };

  useEffect(() => {
    fetchData();
  }, [madrasah?.id]);

  const fetchEnrollments = async (batchId: string) => {
    const { data } = await supabase
      .from('coaching_enrollments')
      .select('*, students(student_name, roll)')
      .eq('batch_id', batchId);
    setEnrollments(data || []);
  };

  const handleEnroll = async () => {
    if (!selectedBatch || !enrollStudentId) return;
    const { error } = await supabase.from('coaching_enrollments').insert({
      batch_id: selectedBatch.id,
      student_id: enrollStudentId
    });
    if (!error) {
      setEnrollStudentId('');
      fetchEnrollments(selectedBatch.id);
    }
  };

  const handleUnenroll = async (id: string) => {
    if (!confirm('Unenroll this student?')) return;
    const { error } = await supabase.from('coaching_enrollments').delete().eq('id', id);
    if (!error && selectedBatch) {
      fetchEnrollments(selectedBatch.id);
    }
  };

  const generateMonthlyFees = async () => {
    if (!madrasah?.id) return;
    const now = new Date();
    const month = now.toISOString().slice(0, 7); // YYYY-MM
    
    // Calculate previous month
    const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonth = prevDate.toISOString().slice(0, 7);
    
    if (!confirm(`Are you sure you want to generate fees for ${month}? This will process all active students and carry forward unpaid dues.`)) return;
    
    setIsGenerating(true);
    try {
      const monthlyStructures = feeStructures.filter(s => s.is_monthly);
      
      if (monthlyStructures.length === 0) {
        alert('No monthly fee structures found. Please set up fees first.');
        return;
      }

      for (const student of students) {
        const classStructure = monthlyStructures.find(s => s.class_id === student.class_id);
        if (!classStructure) continue;

        let finalAmount = classStructure.amount;
        
        const override = overrides?.find(o => o.student_id === student.id && o.fee_structure_id === classStructure.id);
        if (override) {
          if (override.override_amount !== undefined && override.override_amount !== null) {
            finalAmount = override.override_amount;
          } else if (override.discount_percentage) {
            finalAmount = finalAmount * (1 - override.discount_percentage / 100);
          }
        }

        // Check for unpaid dues from previous month
        const { data: prevFees } = await supabase
          .from('fees')
          .select('due_amount')
          .eq('student_id', student.id)
          .eq('month', prevMonth);
        
        const carriedDues = prevFees?.reduce((sum, f) => sum + (f.due_amount || 0), 0) || 0;

        const { data: existing } = await supabase
          .from('fees')
          .select('id')
          .eq('student_id', student.id)
          .eq('month', month)
          .eq('fee_structure_id', classStructure.id)
          .maybeSingle();

        if (!existing) {
          await supabase.from('fees').insert({
            madrasah_id: madrasah.id,
            student_id: student.id,
            class_id: student.class_id,
            fee_structure_id: classStructure.id,
            amount: finalAmount,
            paid_amount: 0,
            due_amount: finalAmount + carriedDues,
            month: month,
            description: `${classStructure.fee_name} - ${month}${carriedDues > 0 ? ` (Includes ৳${carriedDues} previous dues)` : ''}`,
            status: 'unpaid'
          });
        }
      }

      const { data: enrollmentsData } = await supabase
        .from('coaching_enrollments')
        .select('*, coaching_batches(*)');
      
      if (enrollmentsData) {
        for (const enrollment of enrollmentsData) {
          const batch = enrollment.coaching_batches;
          if (!batch) continue;

          const { data: existingCoaching } = await supabase
            .from('fees')
            .select('id')
            .eq('student_id', enrollment.student_id)
            .eq('month', month)
            .ilike('description', `%Coaching: ${batch.name}%`)
            .maybeSingle();

          if (!existingCoaching) {
             await supabase.from('fees').insert({
                madrasah_id: madrasah.id,
                student_id: enrollment.student_id,
                class_id: students.find(s => s.id === enrollment.student_id)?.class_id,
                amount: batch.fee_amount,
                paid_amount: 0,
                due_amount: batch.fee_amount,
                month: month,
                description: `Coaching: ${batch.name} - ${month}`,
                status: 'unpaid'
             });
          }
        }
      }

      alert('Fees generated successfully!');
    } catch (e: any) {
      alert(e.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const fetchStudentFees = async (studentId: string) => {
    const { data } = await supabase
      .from('fees')
      .select('*')
      .eq('student_id', studentId)
      .order('month', { ascending: false });
    setStudentFees(data || []);
  };

  const handleRecordPayment = async () => {
    if (!selectedFee || !paymentAmount) return;
    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) return;

    setIsRecordingPayment(true);
    try {
      const newPaidAmount = (selectedFee.paid_amount || 0) + amount;
      const newDueAmount = Math.max(0, selectedFee.due_amount - amount);
      const newStatus = newDueAmount === 0 ? 'paid' : 'partial';

      const { error } = await supabase
        .from('fees')
        .update({
          paid_amount: newPaidAmount,
          due_amount: newDueAmount,
          status: newStatus,
          paid_at: new Date().toISOString()
        })
        .eq('id', selectedFee.id);

      if (error) throw error;

      // Record in ledger
      await supabase.from('ledger_entries').insert({
        madrasah_id: madrasah?.id,
        type: 'income',
        category: 'Student Fee',
        amount: amount,
        description: `Fee Payment: ${selectedStudent?.student_name} - ${selectedFee.description}`,
        transaction_date: new Date().toISOString().slice(0, 10)
      });

      setShowPaymentModal(false);
      setPaymentAmount('');
      if (selectedStudent) fetchStudentFees(selectedStudent.id);
      alert('Payment recorded successfully!');
    } catch (e: any) {
      alert(e.message);
    } finally {
      setIsRecordingPayment(false);
    }
  };

  const filteredStudents = searchQuery.trim() 
    ? students.filter(s => 
        s.student_name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        s.roll?.toString().includes(searchQuery)
      )
    : [];

  return (
    <div className="w-full max-w-4xl mx-auto p-4">
      <div className="flex items-center justify-between mb-6">
        <button onClick={onBack} className="text-slate-500 hover:text-slate-700 font-black">&larr; {t('back', lang)}</button>
        <h2 className="text-2xl font-black text-[#1E3A8A]">{t('accounting', lang)}</h2>
        <div className="flex space-x-2">
          <button onClick={() => setShowAddCategory(true)} className="px-4 py-2 bg-[#2563EB] text-white rounded-full text-sm font-black flex items-center shadow-lg active:scale-95 transition-all">
            <Plus size={16} className="mr-1" /> {t('add_category', lang)}
          </button>
          <button onClick={() => setShowAddStructure(true)} className="px-4 py-2 bg-[#2563EB] text-white rounded-full text-sm font-black flex items-center shadow-lg active:scale-95 transition-all">
            <Plus size={16} className="mr-1" /> {t('add_fee_structure', lang)}
          </button>
        </div>
      </div>

      <div className="flex space-x-4 mb-6 overflow-x-auto pb-2 no-scrollbar">
        {[
          { id: 'setup', label: t('setup_fee', lang) },
          { id: 'collection', label: t('collection', lang) },
          { id: 'overrides', label: t('student_overrides', lang) },
          { id: 'coaching', label: t('coaching', lang) },
          { id: 'generation', label: t('fee_generation', lang) }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-6 py-2 rounded-full font-black whitespace-nowrap transition-all ${activeTab === tab.id ? 'bg-[#2563EB] text-white shadow-lg' : 'bg-white text-slate-400 hover:bg-slate-50'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'setup' && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
          <div className="bg-white rounded-[2rem] p-8 shadow-sm">
            <h3 className="text-xl font-black text-[#1E3A8A] mb-6 flex items-center">
              <Tag size={20} className="mr-2 text-[#2563EB]" />
              {t('fee_categories', lang)}
            </h3>
            {feeCategories.length === 0 ? (
              <div className="text-center py-12 border-2 border-dashed border-slate-100 rounded-3xl">
                <p className="text-slate-400 font-medium">{t('no_fee_categories', lang)}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {feeCategories.map(category => (
                  <div key={category.id} className="bg-slate-50 rounded-2xl p-5 flex items-center justify-between group hover:bg-blue-50 transition-colors">
                    <div>
                      <p className="font-black text-[#1E3A8A]">{category.name}</p>
                      <p className="text-[10px] font-bold text-[#2563EB] uppercase tracking-wider">{t(category.type as any, lang)}</p>
                      {category.description && <p className="text-[10px] text-slate-400 mt-1 line-clamp-1">{category.description}</p>}
                    </div>
                    <button 
                      onClick={async () => {
                        if (confirm(t('confirm_delete_category', lang, { categoryName: category.name }))) {
                          await supabase.from('fee_categories').delete().eq('id', category.id);
                          fetchData();
                        }
                      }}
                      className="w-8 h-8 bg-white text-red-400 rounded-xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-[2rem] p-8 shadow-sm">
            <h3 className="text-xl font-black text-[#1E3A8A] mb-6 flex items-center">
              <DollarSign size={20} className="mr-2 text-[#2563EB]" />
              {t('fee_structures', lang)}
            </h3>
            {feeStructures.length === 0 ? (
              <div className="text-center py-12 border-2 border-dashed border-slate-100 rounded-3xl">
                <p className="text-slate-400 font-medium">{t('no_fee_structures', lang)}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {feeStructures.map(structure => (
                  <div key={structure.id} className="bg-slate-50 rounded-2xl p-5 flex items-center justify-between group hover:bg-blue-50 transition-colors">
                    <div>
                      <p className="font-black text-[#1E3A8A]">{structure.fee_name}</p>
                      <p className="text-xs text-slate-500 font-bold">{structure.classes?.class_name} • {structure.fee_categories?.name}</p>
                      <p className="text-lg font-black text-[#2563EB] mt-1">৳{structure.amount} <span className="text-[10px] uppercase">{structure.is_monthly ? t('monthly', lang) : t('one-time', lang)}</span></p>
                    </div>
                    <button 
                      onClick={async () => {
                        if (confirm(t('confirm_delete_structure', lang, { structureName: structure.fee_name }))) {
                          await supabase.from('fee_structures').delete().eq('id', structure.id);
                          fetchData();
                        }
                      }}
                      className="w-8 h-8 bg-white text-red-400 rounded-xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'collection' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
          <div className="bg-white rounded-[2rem] p-8 shadow-sm space-y-6">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={20} />
              <input 
                type="text" 
                className="w-full h-14 bg-slate-50 rounded-2xl px-12 font-black text-sm outline-none border-2 border-transparent focus:border-[#2563EB]/20 transition-all"
                placeholder={t('search_student', lang)}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {searchQuery && filteredStudents.length > 0 && !selectedStudent && (
              <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                {filteredStudents.map(s => (
                  <button 
                    key={s.id} 
                    onClick={() => {
                      setSelectedStudent(s);
                      fetchStudentFees(s.id);
                      setSearchQuery('');
                    }}
                    className="w-full flex items-center justify-between p-4 bg-slate-50 rounded-2xl hover:bg-blue-50 transition-colors text-left"
                  >
                    <div>
                      <p className="font-black text-[#1E3A8A]">{s.student_name}</p>
                      <p className="text-xs text-slate-500 font-bold">{s.classes?.class_name} • Roll: {s.roll}</p>
                    </div>
                    <ChevronDown size={20} className="text-slate-300 -rotate-90" />
                  </button>
                ))}
              </div>
            )}

            {selectedStudent && (
              <div className="space-y-6 animate-in fade-in">
                <div className="flex items-center justify-between bg-blue-50 p-6 rounded-[2rem] border border-blue-100">
                  <div className="flex items-center space-x-4">
                    <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-[#2563EB] shadow-sm">
                      <Search size={32} />
                    </div>
                    <div>
                      <h4 className="text-xl font-black text-[#1E3A8A]">{selectedStudent.student_name}</h4>
                      <p className="text-sm text-[#2563EB] font-bold">{selectedStudent.classes?.class_name} • Roll: {selectedStudent.roll}</p>
                    </div>
                  </div>
                  <button onClick={() => setSelectedStudent(null)} className="w-10 h-10 bg-white text-slate-300 rounded-xl flex items-center justify-center hover:text-red-400 transition-colors shadow-sm">
                    <X size={20} />
                  </button>
                </div>

                <div className="space-y-4">
                  <h5 className="text-lg font-black text-[#1E3A8A] flex items-center">
                    <History size={20} className="mr-2 text-[#2563EB]" />
                    {t('payment_history', lang)}
                  </h5>
                  
                  {studentFees.length === 0 ? (
                    <div className="text-center py-12 border-2 border-dashed border-slate-100 rounded-3xl">
                      <p className="text-slate-400 font-medium">{t('no_fees_found', lang)}</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {studentFees.map(fee => (
                        <div key={fee.id} className="bg-slate-50 p-5 rounded-3xl border border-slate-100 flex items-center justify-between">
                          <div className="space-y-1">
                            <p className="font-black text-[#1E3A8A]">{fee.description}</p>
                            <div className="flex items-center space-x-2">
                              <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider ${
                                fee.status === 'paid' ? 'bg-emerald-100 text-emerald-600' :
                                fee.status === 'partial' ? 'bg-amber-100 text-amber-600' :
                                'bg-red-100 text-red-600'
                              }`}>
                                {t(fee.status as any, lang)}
                              </span>
                              <span className="text-[10px] font-bold text-slate-400">{fee.month}</span>
                            </div>
                          </div>
                          <div className="text-right space-y-1">
                            <p className="text-sm font-black text-slate-400 line-through">৳{fee.amount}</p>
                            <p className="text-lg font-black text-[#2563EB]">৳{fee.due_amount} <span className="text-[10px] text-slate-400 uppercase">Due</span></p>
                            {fee.status !== 'paid' && (
                              <button 
                                onClick={() => {
                                  setSelectedFee(fee);
                                  setPaymentAmount(fee.due_amount.toString());
                                  setShowPaymentModal(true);
                                }}
                                className="px-4 py-1.5 bg-[#2563EB] text-white rounded-xl text-[10px] font-black shadow-lg active:scale-95 transition-all"
                              >
                                {t('collect_now', lang)}
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'generation' && (
        <div className="bg-white rounded-[2rem] p-12 shadow-sm text-center space-y-8 animate-in fade-in slide-in-from-bottom-4">
          <div className="w-24 h-24 bg-blue-50 rounded-full flex items-center justify-center mx-auto shadow-inner">
            <DollarSign size={48} className="text-[#2563EB]" />
          </div>
          <div className="max-w-md mx-auto">
            <h3 className="text-2xl font-black text-[#1E3A8A]">{t('fee_generation', lang)}</h3>
            <p className="text-slate-500 mt-2">Automatically generate monthly fees for all active students based on their class fee structure and coaching enrollments.</p>
          </div>
          <div className="bg-blue-50/50 border border-blue-100 p-6 rounded-[2rem] text-blue-700 text-sm font-bold flex items-center justify-center space-x-3">
            <Tag size={18} />
            <span>Target Month: {new Date().toLocaleString(lang === 'bn' ? 'bn-BD' : 'en-US', { month: 'long', year: 'numeric' })}</span>
          </div>
          <button 
            onClick={generateMonthlyFees}
            disabled={isGenerating}
            className="w-full max-w-md mx-auto py-6 bg-[#2563EB] text-white font-black rounded-full shadow-premium active:scale-95 transition-all flex items-center justify-center space-x-3 text-lg"
          >
            {isGenerating ? <Loader2 className="animate-spin" /> : <><Plus size={24} /> <span>{t('generate_fees', lang)}</span></>}
          </button>
        </div>
      )}

      {activeTab === 'overrides' && (
        <div className="bg-white rounded-[2rem] p-8 shadow-sm animate-in fade-in slide-in-from-bottom-4 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-black text-[#1E3A8A]">{t('student_overrides', lang)}</h3>
            <button onClick={() => setShowAddOverride(true)} className="px-4 py-2 bg-[#2563EB] text-white rounded-full text-sm font-black flex items-center shadow-lg active:scale-95 transition-all">
              <Plus size={16} className="mr-1" /> {t('add_student', lang)}
            </button>
          </div>
          
          {overrides.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed border-slate-100 rounded-3xl">
              <p className="text-slate-400 font-medium">No overrides set yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {overrides.map(o => (
                <div key={o.id} className="bg-slate-50 p-5 rounded-3xl flex items-center justify-between group hover:bg-blue-50 transition-colors">
                  <div>
                    <p className="font-black text-[#1E3A8A]">{o.students?.student_name}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{o.fee_structures?.fee_name}</p>
                  </div>
                  <div className="text-right flex items-center gap-4">
                    <div className="bg-white px-3 py-1.5 rounded-xl shadow-sm border border-slate-100">
                      {o.override_amount ? (
                        <p className="font-black text-[#2563EB] text-sm">৳{o.override_amount}</p>
                      ) : (
                        <p className="font-black text-emerald-500 text-sm">{o.discount_percentage}% Off</p>
                      )}
                    </div>
                    <button onClick={async () => {
                      if (confirm('Delete this override?')) {
                        await supabase.from('student_fee_overrides').delete().eq('id', o.id);
                        fetchData();
                      }
                    }} className="text-red-400 hover:text-red-600 transition-colors"><X size={18}/></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'coaching' && (
        <div className="bg-white rounded-[2rem] p-8 shadow-sm animate-in fade-in slide-in-from-bottom-4 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-black text-[#1E3A8A]">{t('coaching', lang)}</h3>
            <button onClick={() => setShowAddBatch(true)} className="px-4 py-2 bg-[#2563EB] text-white rounded-full text-sm font-black flex items-center shadow-lg active:scale-95 transition-all">
              <Plus size={16} className="mr-1" /> {t('new_batch', lang)}
            </button>
          </div>

          {coachingBatches.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed border-slate-100 rounded-3xl">
              <p className="text-slate-400 font-medium">No coaching batches created yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {coachingBatches.map(batch => (
                <div key={batch.id} className="bg-slate-50 p-6 rounded-[2rem] space-y-4 border border-slate-100 hover:border-blue-200 transition-all">
                  <div className="flex items-center justify-between">
                    <h4 className="font-black text-[#1E3A8A] text-lg">{batch.name}</h4>
                    <button onClick={async () => {
                      if (confirm('Delete this batch?')) {
                        await supabase.from('coaching_batches').delete().eq('id', batch.id);
                        fetchData();
                      }
                    }} className="w-8 h-8 bg-white text-red-400 rounded-xl flex items-center justify-center shadow-sm"><X size={16}/></button>
                  </div>
                  <div className="flex items-baseline space-x-1">
                    <span className="text-2xl font-black text-[#2563EB]">৳{batch.fee_amount}</span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">/ {t('monthly', lang)}</span>
                  </div>
                  <button 
                    onClick={() => {
                      setSelectedBatch(batch);
                      fetchEnrollments(batch.id);
                      setShowEnrollmentModal(true);
                    }}
                    className="w-full py-3 bg-white text-[#2563EB] rounded-2xl text-xs font-black border border-blue-100 shadow-sm hover:bg-blue-50 transition-all"
                  >
                    {t('manage_enrollments', lang)}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MODALS */}
      {showPaymentModal && selectedFee && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xl z-[999] flex items-center justify-center p-6 text-slate-900">
          <div className="bg-white w-full max-w-sm rounded-[3rem] p-8 space-y-6 animate-in zoom-in-95 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-black text-[#1E3A8A]">{t('collect_payment', lang)}</h3>
              <button onClick={() => setShowPaymentModal(false)} className="w-10 h-10 bg-slate-50 text-slate-300 rounded-2xl flex items-center justify-center hover:text-slate-500 transition-colors"><X size={24} /></button>
            </div>
            
            <div className="space-y-4">
              <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{t('total_due', lang)}</p>
                <p className="text-2xl font-black text-[#2563EB]">৳{selectedFee.due_amount}</p>
                <p className="text-[10px] text-slate-500 mt-1">{selectedFee.description}</p>
              </div>

              <div className="relative">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 mb-2 block">{t('payment_amount', lang)}</label>
                <div className="relative">
                  <input 
                    type="number" 
                    className="w-full h-14 bg-slate-50 rounded-2xl px-12 font-black text-lg outline-none border-2 border-transparent focus:border-[#2563EB]/20 transition-all"
                    placeholder="0" 
                    value={paymentAmount} 
                    onChange={(e) => setPaymentAmount(e.target.value)} 
                  />
                  <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-[#2563EB]" size={20}/>
                </div>
              </div>

              <button 
                onClick={handleRecordPayment}
                disabled={isRecordingPayment}
                className="w-full py-5 bg-[#2563EB] text-white font-black rounded-full shadow-premium active:scale-95 transition-all text-base flex items-center justify-center space-x-2"
              >
                {isRecordingPayment ? <Loader2 className="animate-spin" /> : <><CheckCircle2 size={20} /> <span>{t('record_payment', lang)}</span></>}
              </button>
            </div>
          </div>
        </div>
      )}

      {showEnrollmentModal && selectedBatch && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xl z-[999] flex items-center justify-center p-6 text-slate-900">
          <div className="bg-white w-full max-w-md rounded-[3rem] p-8 space-y-6 animate-in zoom-in-95 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-black text-[#1E3A8A]">{t('manage_enrollments', lang)}</h3>
                <p className="text-xs font-bold text-[#2563EB] uppercase tracking-wider">{selectedBatch.name}</p>
              </div>
              <button onClick={() => setShowEnrollmentModal(false)} className="w-10 h-10 bg-slate-50 text-slate-300 rounded-2xl flex items-center justify-center hover:text-slate-500 transition-colors"><X size={24} /></button>
            </div>
            
            <div className="flex gap-2">
              <select 
                className="flex-1 h-14 bg-slate-50 rounded-2xl px-6 font-black text-sm outline-none border-2 border-transparent focus:border-[#2563EB]/20 transition-all"
                value={enrollStudentId}
                onChange={(e) => setEnrollStudentId(e.target.value)}
              >
                <option value="">{t('select_student', lang)}</option>
                {students.map(s => <option key={s.id} value={s.id}>{s.student_name} (Roll: {s.roll})</option>)}
              </select>
              <button onClick={handleEnroll} className="px-8 bg-[#2563EB] text-white rounded-2xl font-black text-sm shadow-lg active:scale-95 transition-all">Enroll</button>
            </div>

            <div className="space-y-2 max-h-72 overflow-y-auto pr-2 custom-scrollbar">
              {enrollments.map(e => (
                <div key={e.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 group">
                  <div>
                    <p className="font-black text-sm text-[#1E3A8A]">{e.students?.student_name}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Roll: {e.students?.roll}</p>
                  </div>
                  <button onClick={() => handleUnenroll(e.id)} className="w-8 h-8 bg-white text-red-400 rounded-xl flex items-center justify-center shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"><X size={14}/></button>
                </div>
              ))}
              {enrollments.length === 0 && (
                <div className="text-center py-8 border-2 border-dashed border-slate-100 rounded-3xl">
                  <p className="text-slate-400 text-xs font-medium">No students enrolled yet.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showAddCategory && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xl z-[999] flex items-center justify-center p-6 text-slate-900">
          <div className="bg-white w-full max-w-sm rounded-[3rem] p-8 space-y-6 animate-in zoom-in-95 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-black text-[#1E3A8A]">{t('add_new_category', lang)}</h3>
              <button onClick={() => setShowAddCategory(false)} className="w-10 h-10 bg-slate-50 text-slate-300 rounded-2xl flex items-center justify-center"><X size={24} /></button>
            </div>
            <div className="space-y-4">
              <div className="relative">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 mb-2 block">{t('category_name', lang)}</label>
                <input 
                  type="text" 
                  className="w-full h-14 bg-slate-50 rounded-2xl px-6 font-black text-sm outline-none border-2 border-transparent focus:border-[#2563EB]/20 transition-all"
                  placeholder={t('category_name_placeholder', lang)} 
                  value={newCategoryName} 
                  onChange={(e) => setNewCategoryName(e.target.value)} 
                />
              </div>
              <div className="relative">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 mb-2 block">{t('category_type', lang)}</label>
                <select 
                  className="w-full h-14 bg-slate-50 rounded-2xl px-6 font-black text-sm outline-none border-2 border-transparent focus:border-[#2563EB]/20 transition-all"
                  value={newCategoryType}
                  onChange={(e) => setNewCategoryType(e.target.value as any)}
                >
                  <option value="recurring">{t('recurring', lang)}</option>
                  <option value="one-time">{t('one-time', lang)}</option>
                  <option value="optional">{t('optional', lang)}</option>
                </select>
              </div>
              <div className="relative">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 mb-2 block">{t('description', lang)}</label>
                <textarea 
                  className="w-full bg-slate-50 rounded-2xl px-6 py-4 font-black text-sm outline-none border-2 border-transparent focus:border-[#2563EB]/20 h-28 resize-none transition-all"
                  placeholder="Optional details..." 
                  value={newCategoryDesc} 
                  onChange={(e) => setNewCategoryDesc(e.target.value)} 
                />
              </div>
              <button onClick={async () => {
                if (!newCategoryName) return;
                setIsSaving(true);
                try {
                  const { error } = await supabase.from('fee_categories').insert({
                    madrasah_id: madrasah?.id,
                    name: newCategoryName,
                    type: newCategoryType,
                    description: newCategoryDesc
                  });
                  if (error) throw error;
                  setShowAddCategory(false);
                  setNewCategoryName('');
                  setNewCategoryDesc('');
                  fetchData();
                } catch (e: any) { alert(e.message); } finally { setIsSaving(false); }
              }} className="w-full py-5 bg-[#2563EB] text-white font-black rounded-full shadow-premium active:scale-95 transition-all text-base">
                {isSaving ? <Loader2 className="animate-spin mx-auto" /> : t('add_category', lang)}
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddStructure && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xl z-[999] flex items-center justify-center p-6 text-slate-900">
           <div className="bg-white w-full max-w-sm rounded-[3rem] p-8 space-y-6 animate-in zoom-in-95 shadow-2xl relative">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-black text-[#1E3A8A]">{t('setup_fee', lang)}</h3>
                <button onClick={() => setShowAddStructure(false)} className="w-10 h-10 bg-slate-50 text-slate-300 rounded-2xl flex items-center justify-center"><X size={24} /></button>
              </div>
              <div className="space-y-4">
                 <div className="relative">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 mb-2 block">{t('select_class', lang)}</label>
                    <button onClick={() => setShowClassDropdown(!showClassDropdown)} className="w-full h-14 px-6 rounded-2xl border-2 border-slate-100 bg-slate-50 flex items-center justify-between font-black text-[#1E3A8A] transition-all hover:border-blue-200">
                       <span className="truncate">{classes.find(c => c.id === selectedClass)?.class_name || t('select_class_placeholder', lang)}</span>
                       <ChevronDown size={20} className="text-slate-300" />
                    </button>
                    {showClassDropdown && (
                        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-3xl shadow-2xl border border-slate-100 z-[1001] p-3 max-h-56 overflow-y-auto animate-in fade-in slide-in-from-top-2">
                            {classes.map(c => (
                                <button key={c.id} onClick={() => { setSelectedClass(c.id); setShowClassDropdown(false); }} className="w-full text-left px-5 py-3 rounded-2xl hover:bg-blue-50 font-black text-[#1E3A8A] transition-colors">{c.class_name}</button>
                            ))}
                        </div>
                    )}
                 </div>
                 <div className="relative">
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 mb-2 block">{t('select_category', lang)}</label>
                     <select 
                        className="w-full h-14 bg-slate-50 rounded-2xl px-6 font-black text-sm outline-none border-2 border-transparent focus:border-[#2563EB]/20 transition-all"
                        value={category || ''}
                        onChange={(e) => setCategory(e.target.value)}
                     >
                        <option value="">{t('select_category_placeholder', lang)}</option>
                        {feeCategories.map(c => (
                           <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                     </select>
                  </div>
                 <div className="relative">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 mb-2 block">{t('fee_name', lang)}</label>
                    <div className="relative">
                      <input type="text" className="w-full h-14 bg-slate-50 rounded-2xl px-12 font-black text-sm outline-none border-2 border-transparent focus:border-[#2563EB]/20 transition-all" placeholder={t('fee_name_placeholder', lang)} value={feeNote} onChange={(e) => setFeeNote(e.target.value)} />
                      <Tag className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={20}/>
                    </div>
                 </div>
                 <div className="relative">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 mb-2 block">{t('fee_type', lang)}</label>
                    <div className="flex p-1.5 bg-slate-100 rounded-2xl border border-slate-200">
                       <button 
                          type="button"
                          onClick={() => setIsMonthlyFee(true)} 
                          className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${isMonthlyFee ? 'bg-white text-[#2563EB] shadow-sm' : 'text-slate-400'}`}
                       >
                          {t('monthly', lang)}
                       </button>
                       <button 
                          type="button"
                          onClick={() => setIsMonthlyFee(false)} 
                          className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${!isMonthlyFee ? 'bg-white text-[#2563EB] shadow-sm' : 'text-slate-400'}`}
                       >
                          {t('one-time', lang)}
                       </button>
                    </div>
                 </div>
                 <div className="relative">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 mb-2 block">{t('amount', lang)}</label>
                    <div className="relative">
                      <input type="number" className="w-full h-14 bg-slate-50 rounded-2xl px-12 font-black text-lg outline-none border-2 border-transparent focus:border-[#2563EB]/20 transition-all" placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
                      <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-[#2563EB]" size={20}/>
                    </div>
                 </div>
                 
                 <button onClick={async () => {
                    if (!selectedClass || !category || !amount) return;
                    setIsSaving(true);
                    try {
                        const { error } = await supabase.from('fee_structures').insert({
                            madrasah_id: madrasah?.id,
                            class_id: selectedClass,
                            category_id: category,
                            fee_name: feeNote,
                            amount: parseFloat(amount),
                            is_monthly: isMonthlyFee
                        });
                        if (error) throw error;
                        setShowAddStructure(false);
                        setCategory(''); setFeeNote(''); setAmount(''); setSelectedClass('');
                        fetchData();
                    } catch (e: any) { alert(e.message); } finally { setIsSaving(false); }
                 }} className="w-full py-5 bg-[#2563EB] text-white font-black rounded-full shadow-premium active:scale-95 transition-all text-base">
                    {isSaving ? <Loader2 className="animate-spin mx-auto" /> : t('save', lang)}
                 </button>
              </div>
           </div>
        </div>
      )}

      {showAddBatch && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xl z-[999] flex items-center justify-center p-6 text-slate-900">
          <div className="bg-white w-full max-w-sm rounded-[3rem] p-8 space-y-6 animate-in zoom-in-95 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-black text-[#1E3A8A]">{t('new_batch', lang)}</h3>
              <button onClick={() => setShowAddBatch(false)} className="w-10 h-10 bg-slate-50 text-slate-300 rounded-2xl flex items-center justify-center"><X size={24} /></button>
            </div>
            <div className="space-y-4">
              <div className="relative">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 mb-2 block">Batch Name</label>
                <input 
                  type="text" 
                  className="w-full h-14 bg-slate-50 rounded-2xl px-6 font-black text-sm outline-none border-2 border-transparent focus:border-[#2563EB]/20 transition-all"
                  placeholder="e.g. Math Special" 
                  value={batchName} 
                  onChange={(e) => setBatchName(e.target.value)} 
                />
              </div>
              <div className="relative">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 mb-2 block">{t('monthly', lang)} {t('amount', lang)}</label>
                <input 
                  type="number" 
                  className="w-full h-14 bg-slate-50 rounded-2xl px-6 font-black text-sm outline-none border-2 border-transparent focus:border-[#2563EB]/20 transition-all"
                  placeholder="0" 
                  value={batchFee} 
                  onChange={(e) => setBatchFee(e.target.value)} 
                />
              </div>
              <button onClick={async () => {
                if (!batchName || !batchFee) return;
                setIsSaving(true);
                try {
                  const { error } = await supabase.from('coaching_batches').insert({
                    madrasah_id: madrasah?.id,
                    name: batchName,
                    fee_amount: parseFloat(batchFee)
                  });
                  if (error) throw error;
                  setShowAddBatch(false);
                  setBatchName('');
                  setBatchFee('');
                  fetchData();
                } catch (e: any) { alert(e.message); } finally { setIsSaving(false); }
              }} className="w-full py-5 bg-[#2563EB] text-white font-black rounded-full shadow-premium active:scale-95 transition-all text-base">
                {isSaving ? <Loader2 className="animate-spin mx-auto" /> : t('save', lang)}
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddOverride && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xl z-[999] flex items-center justify-center p-6 text-slate-900">
          <div className="bg-white w-full max-w-sm rounded-[3rem] p-8 space-y-6 animate-in zoom-in-95 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-black text-[#1E3A8A]">{t('save_override', lang)}</h3>
              <button onClick={() => setShowAddOverride(false)} className="w-10 h-10 bg-slate-50 text-slate-300 rounded-2xl flex items-center justify-center"><X size={24} /></button>
            </div>
            <div className="space-y-4">
              <div className="relative">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 mb-2 block">{t('select_student', lang)}</label>
                <select 
                  className="w-full h-14 bg-slate-50 rounded-2xl px-6 font-black text-sm outline-none border-2 border-transparent focus:border-[#2563EB]/20 transition-all"
                  value={overrideStudentId}
                  onChange={(e) => setOverrideStudentId(e.target.value)}
                >
                  <option value="">{t('select_student', lang)}</option>
                  {students.map(s => <option key={s.id} value={s.id}>{s.student_name} (Roll: {s.roll})</option>)}
                </select>
              </div>
              <div className="relative">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 mb-2 block">{t('fee_name', lang)}</label>
                <select 
                  className="w-full h-14 bg-slate-50 rounded-2xl px-6 font-black text-sm outline-none border-2 border-transparent focus:border-[#2563EB]/20 transition-all"
                  value={overrideStructureId}
                  onChange={(e) => setOverrideStructureId(e.target.value)}
                >
                  <option value="">{t('select_category_placeholder', lang)}</option>
                  {feeStructures.map(s => <option key={s.id} value={s.id}>{s.fee_name} ({s.classes?.class_name})</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="relative">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 mb-2 block">{t('custom_amount', lang)}</label>
                  <input 
                    type="number" 
                    className="w-full h-14 bg-slate-50 rounded-2xl px-6 font-black text-sm outline-none border-2 border-transparent focus:border-[#2563EB]/20 transition-all"
                    placeholder="৳" 
                    value={overrideAmount} 
                    onChange={(e) => { setOverrideAmount(e.target.value); setOverrideDiscount(''); }} 
                  />
                </div>
                <div className="relative">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 mb-2 block">{t('discount_percentage', lang)}</label>
                  <input 
                    type="number" 
                    className="w-full h-14 bg-slate-50 rounded-2xl px-6 font-black text-sm outline-none border-2 border-transparent focus:border-[#2563EB]/20 transition-all"
                    placeholder="%" 
                    value={overrideDiscount} 
                    onChange={(e) => { setOverrideDiscount(e.target.value); setOverrideAmount(''); }} 
                  />
                </div>
              </div>
              <button onClick={async () => {
                if (!overrideStudentId || !overrideStructureId || (!overrideAmount && !overrideDiscount)) return;
                setIsSaving(true);
                try {
                  const { error } = await supabase.from('student_fee_overrides').insert({
                    student_id: overrideStudentId,
                    fee_structure_id: overrideStructureId,
                    override_amount: overrideAmount ? parseFloat(overrideAmount) : null,
                    discount_percentage: overrideDiscount ? parseFloat(overrideDiscount) : null
                  });
                  if (error) throw error;
                  setShowAddOverride(false);
                  setOverrideStudentId('');
                  setOverrideStructureId('');
                  setOverrideAmount('');
                  setOverrideDiscount('');
                  fetchData();
                } catch (e: any) { alert(e.message); } finally { setIsSaving(false); }
              }} className="w-full py-5 bg-[#2563EB] text-white font-black rounded-full shadow-premium active:scale-95 transition-all text-base">
                {isSaving ? <Loader2 className="animate-spin mx-auto" /> : t('save_override', lang)}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Accounting;
