import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Banknote, 
  LayoutDashboard, 
  CreditCard, 
  Settings, 
  Calendar, 
  Users, 
  Tag, 
  BarChart3, 
  Plus, 
  Search, 
  ChevronRight, 
  History, 
  AlertCircle, 
  CheckCircle2, 
  Loader2, 
  X, 
  ArrowLeft,
  Filter,
  Download,
  Bell
} from 'lucide-react';
import { supabase } from '../supabase';
import { feeService } from '../services/fee.service';
import { Madrasah, Language } from '../types';
import { t } from '../translations';

interface FeesProps {
  lang: Language;
  madrasah: Madrasah | null;
  onBack: () => void;
  role: string;
}

type FeeTab = 'dashboard' | 'payments' | 'categories';

const Fees: React.FC<FeesProps> = ({ lang, madrasah, onBack, role }) => {
  const [activeTab, setActiveTab] = useState<FeeTab>('dashboard');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalCollection: 0,
    totalDue: 0,
    activeDiscounts: 0,
    collectionThisMonth: 0
  });

  const fetchStats = async () => {
    if (!madrasah?.id) return;
    setLoading(true);
    try {
      const { data: fees } = await supabase
        .from('student_fees')
        .select('paid_amount, due_amount')
        .eq('madrasah_id', madrasah.id);

      const { data: discounts } = await supabase
        .from('student_discounts')
        .select('id', { count: 'exact' })
        .eq('madrasah_id', madrasah.id)
        .eq('is_active', true);

      const totalPaid = fees?.reduce((sum, f) => sum + Number(f.paid_amount), 0) || 0;
      const totalDue = fees?.reduce((sum, f) => sum + Number(f.due_amount), 0) || 0;

      setStats({
        totalCollection: totalPaid,
        totalDue: totalDue,
        activeDiscounts: discounts?.length || 0,
        collectionThisMonth: 0 // Would need more granular query
      });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [madrasah?.id]);

  const tabs: { id: FeeTab; label: string; icon: any }[] = [
    { id: 'dashboard', label: 'ড্যাশবোর্ড', icon: LayoutDashboard },
    { id: 'payments', label: 'পেমেন্ট', icon: CreditCard },
    { id: 'categories', label: 'ক্যাটাগরি', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-24">
      {/* Header */}
      <div className="bg-white border-b border-slate-100 px-6 py-4 sticky top-0 z-30">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 hover:bg-slate-50 rounded-xl transition-colors">
            <ArrowLeft size={20} className="text-slate-600" />
          </button>
          <div>
            <h1 className="text-xl font-black text-[#1E293B] font-noto">ফি কালেকশন</h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Fee Management System</p>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="px-6 py-4 overflow-x-auto no-scrollbar bg-white border-b border-slate-100">
        <div className="flex gap-2 min-w-max">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl font-noto font-bold text-sm transition-all ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-200'
                  : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
              }`}
            >
              <tab.icon size={16} />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <main className="px-6 py-6 max-w-5xl mx-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === 'dashboard' && (
              <DashboardView stats={stats} lang={lang} madrasahId={madrasah?.id} />
            )}
            {activeTab === 'payments' && (
              <PaymentsView lang={lang} madrasahId={madrasah?.id} />
            )}
            {activeTab === 'categories' && (
              <CategoriesView lang={lang} madrasahId={madrasah?.id} />
            )}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
};

// --- Sub-views ---

const DashboardView: React.FC<{ stats: any; lang: Language; madrasahId?: string }> = ({ stats, lang, madrasahId }) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [categories, setCategories] = useState<any[]>([]);

  useEffect(() => {
    const fetchCategories = async () => {
      if (!madrasahId) return;
      const { data } = await supabase.from('fee_categories').select('*').eq('madrasah_id', madrasahId);
      setCategories(data || []);
      if (data && data.length > 0) setSelectedCategoryId(data[0].id);
    };
    fetchCategories();
  }, [madrasahId]);

  const handleGenerateFees = async () => {
    if (!madrasahId || !selectedCategoryId) {
      alert('দয়া করে ক্যাটাগরি সিলেক্ট করুন');
      return;
    }
    
    const category = categories.find(c => c.id === selectedCategoryId);
    if (!confirm(`${selectedMonth} মাসের জন্য "${category?.name}" ফি জেনারেট করতে চান?`)) return;

    setIsGenerating(true);
    const res = await feeService.generateMonthlyFees(madrasahId, selectedMonth, selectedCategoryId);
    setIsGenerating(false);

    if (res.success) {
      alert('সফলভাবে ফি জেনারেট করা হয়েছে!');
    } else {
      alert('ত্রুটি: ' + res.error);
    }
  };

  const handleSendReminders = async () => {
    if (!madrasahId) return;
    const res = await feeService.sendDueReminders(madrasahId);
    alert(`${res.count} জন ছাত্রকে বকেয়া রিমাইন্ডার পাঠানো হয়েছে (সিমুলেশন)`);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="মোট কালেকশন" value={`৳${stats.totalCollection}`} icon={Banknote} color="blue" />
        <StatCard title="মোট বকেয়া" value={`৳${stats.totalDue}`} icon={AlertCircle} color="red" />
        <StatCard title="সক্রিয় ডিসকাউন্ট" value={stats.activeDiscounts} icon={Tag} color="amber" />
        <StatCard title="এই মাসের কালেকশন" value={`৳${stats.collectionThisMonth}`} icon={BarChart3} color="emerald" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm">
          <h3 className="text-lg font-black text-[#1E293B] mb-4">ফি জেনারেট করুন</h3>
          <div className="space-y-4">
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 mb-2 block">মাস সিলেক্ট করুন</label>
              <input 
                type="month" 
                className="w-full p-4 bg-slate-50 rounded-2xl font-black text-sm border-none focus:ring-2 focus:ring-blue-500"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
              />
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 mb-2 block">ক্যাটাগরি সিলেক্ট করুন</label>
              <select 
                className="w-full p-4 bg-slate-50 rounded-2xl font-black text-sm border-none focus:ring-2 focus:ring-blue-500"
                value={selectedCategoryId}
                onChange={(e) => setSelectedCategoryId(e.target.value)}
              >
                <option value="">সিলেক্ট করুন</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <button 
              onClick={handleGenerateFees}
              disabled={isGenerating}
              className="w-full py-4 bg-blue-600 text-white font-black rounded-2xl shadow-lg shadow-blue-100 active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              {isGenerating ? <Loader2 className="animate-spin" /> : <Calendar size={20} />}
              ফি জেনারেট করুন
            </button>
          </div>
        </div>

        <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm">
          <h3 className="text-lg font-black text-[#1E293B] mb-4">কুইক অ্যাকশন</h3>
          <div className="grid grid-cols-1 gap-3">
            <button 
              onClick={handleSendReminders}
              className="flex items-center gap-4 p-6 bg-red-50 rounded-3xl border border-red-100 hover:bg-red-100 transition-all group"
            >
              <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-red-600 shadow-sm group-hover:scale-110 transition-transform">
                <Bell size={24} />
              </div>
              <div className="text-left">
                <span className="block text-sm font-black text-red-700">বকেয়া রিমাইন্ডার</span>
                <span className="text-[10px] font-bold text-red-400 uppercase">Send SMS to parents</span>
              </div>
            </button>
          </div>
        </div>

        <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm">
          <h3 className="text-lg font-black text-[#1E293B] mb-4">সাম্প্রতিক পেমেন্ট</h3>
          <div className="space-y-3">
            <p className="text-center py-8 text-slate-400 text-xs font-bold uppercase tracking-widest">No recent payments</p>
          </div>
        </div>
      </div>
    </div>
  );
};

const StatCard: React.FC<{ title: string; value: string | number; icon: any; color: string }> = ({ title, value, icon: Icon, color }) => {
  const colors: any = {
    blue: 'bg-blue-50 text-blue-600 border-blue-100',
    red: 'bg-red-50 text-red-600 border-red-100',
    amber: 'bg-amber-50 text-amber-600 border-amber-100',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
  };

  return (
    <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex items-center gap-4">
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${colors[color]} border shadow-inner`}>
        <Icon size={24} />
      </div>
      <div>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{title}</p>
        <h4 className="text-xl font-black text-[#1E293B]">{value}</h4>
      </div>
    </div>
  );
};

const PaymentsView: React.FC<{ lang: Language; madrasahId?: string }> = ({ lang, madrasahId }) => {
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [students, setStudents] = useState<any[]>([]);
  const [studentFeesMap, setStudentFeesMap] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(false);
  
  const [showPayModal, setShowPayModal] = useState(false);
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [selectedFee, setSelectedFee] = useState<any>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('cash');

  const [categories, setCategories] = useState<any[]>([]);
  const [discountData, setDiscountData] = useState({
    fee_category_id: '',
    discount_type: 'percentage',
    amount: '',
    duration: 'recurring',
    reason: ''
  });

  const today = new Date();
  const formattedDate = today.toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-US', { 
    day: 'numeric', 
    month: 'long', 
    year: 'numeric' 
  });

  useEffect(() => {
    const fetchClasses = async () => {
      if (!madrasahId) return;
      const { data: cls } = await supabase.from('classes').select('*').eq('madrasah_id', madrasahId);
      setClasses(cls || []);
      
      const { data: cats } = await supabase.from('fee_categories').select('*').eq('madrasah_id', madrasahId);
      setCategories(cats || []);
    };
    fetchClasses();
  }, [madrasahId]);

  const handleClassChange = async (classId: string) => {
    setSelectedClassId(classId);
    if (!classId || !madrasahId) {
      setStudents([]);
      return;
    }

    setLoading(true);
    try {
      // Fetch students of the class
      const { data: stds } = await supabase
        .from('students')
        .select('*')
        .eq('class_id', classId)
        .eq('madrasah_id', madrasahId)
        .order('roll', { ascending: true });

      if (stds) {
        setStudents(stds);
        
        // Fetch all unpaid fees for these students
        const studentIds = stds.map(s => s.id);
        const { data: fees } = await supabase
          .from('student_fees')
          .select('*, fee_categories(name)')
          .in('student_id', studentIds)
          .neq('status', 'paid')
          .order('created_at', { ascending: false });

        const map: Record<string, any[]> = {};
        fees?.forEach(f => {
          if (!map[f.student_id]) map[f.student_id] = [];
          map[f.student_id].push(f);
        });
        setStudentFeesMap(map);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handlePayment = async () => {
    if (!madrasahId || !selectedStudent || !selectedFee || !payAmount) return;
    const res = await feeService.processPayment(
      madrasahId,
      selectedStudent.id,
      selectedFee.id,
      Number(payAmount),
      payMethod
    );
    if (res.success) {
      alert('পেমেন্ট সফল হয়েছে!');
      setShowPayModal(false);
      refreshStudentFees(selectedStudent.id);
    } else {
      alert('ত্রুটি: ' + res.error);
    }
  };

  const handleApplyDiscount = async () => {
    if (!madrasahId || !selectedStudent || !discountData.fee_category_id || !discountData.amount) return;
    
    const { error } = await supabase.from('student_discounts').insert({
      ...discountData,
      student_id: selectedStudent.id,
      madrasah_id: madrasahId,
      amount: Number(discountData.amount)
    });

    if (!error) {
      alert('ডিসকাউন্ট সফলভাবে যুক্ত হয়েছে!');
      setShowDiscountModal(false);
      refreshStudentFees(selectedStudent.id);
    } else {
      alert('ত্রুটি: ' + error.message);
    }
  };

  const refreshStudentFees = async (studentId: string) => {
    const { data: updatedFees } = await supabase
      .from('student_fees')
      .select('*, fee_categories(name)')
      .eq('student_id', studentId)
      .neq('status', 'paid');
    
    setStudentFeesMap(prev => ({
      ...prev,
      [studentId]: updatedFees || []
    }));
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 mb-2 block">ক্লাস সিলেক্ট করুন</label>
            <select 
              className="w-full p-4 bg-slate-50 rounded-2xl font-noto font-bold text-sm border-none focus:ring-2 focus:ring-blue-500 transition-all"
              value={selectedClassId}
              onChange={(e) => handleClassChange(e.target.value)}
            >
              <option value="">ক্লাস নির্বাচন করুন</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.class_name}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => handleClassChange(selectedClassId)}
              className="p-4 bg-slate-50 text-slate-400 rounded-2xl hover:text-blue-600 transition-colors"
              title="Refresh"
            >
              <History size={20} />
            </button>
            <div className="bg-blue-50 px-6 py-4 rounded-2xl border border-blue-100 flex items-center gap-3">
              <Calendar size={20} className="text-blue-600" />
              <div>
                <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest">আজকের তারিখ</p>
                <p className="text-sm font-black text-blue-700">{formattedDate}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="animate-spin text-blue-600" size={32} />
        </div>
      ) : (
        <div className="space-y-3">
          {students.map(student => {
            const unpaidFees = studentFeesMap[student.id] || [];
            const totalDue = unpaidFees.reduce((sum, f) => sum + Number(f.due_amount), 0);

            return (
              <div key={student.id} className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-blue-200 transition-all">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 font-black text-lg">
                    {student.roll}
                  </div>
                  <div>
                    <h4 className="font-black text-[#1E293B]">{student.student_name}</h4>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">রোল: {student.roll}</p>
                  </div>
                </div>

                <div className="flex items-center gap-4 justify-between md:justify-end flex-1">
                  <div className="text-right">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">মোট বকেয়া</p>
                    <p className={`text-lg font-black ${totalDue > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                      ৳{totalDue}
                    </p>
                  </div>

                  {unpaidFees.length > 0 ? (
                    <div className="flex flex-col md:flex-row gap-2">
                      <button 
                        onClick={() => {
                          setSelectedStudent(student);
                          setShowDiscountModal(true);
                        }}
                        className="px-4 py-2.5 bg-amber-50 text-amber-600 rounded-xl text-xs font-black border border-amber-100 active:scale-95 transition-all flex items-center gap-2"
                      >
                        <Tag size={14} />
                        ডিসকাউন্ট
                      </button>
                      
                      <div className="flex flex-col gap-2">
                        {unpaidFees.map(fee => (
                          <button 
                            key={fee.id}
                            onClick={() => {
                              setSelectedStudent(student);
                              setSelectedFee(fee);
                              setPayAmount(fee.due_amount.toString());
                              setShowPayModal(true);
                            }}
                            className="px-4 py-2 bg-blue-600 text-white rounded-xl text-[10px] font-black shadow-lg shadow-blue-100 active:scale-95 transition-all flex items-center justify-center gap-2"
                          >
                            <Banknote size={12} />
                            {fee.fee_categories?.name} ({fee.month}) - ৳{fee.due_amount}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="px-6 py-2.5 bg-emerald-50 text-emerald-600 rounded-xl text-xs font-black border border-emerald-100 flex items-center gap-2">
                      <CheckCircle2 size={14} />
                      পরিশোধিত
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          
          {selectedClassId && students.length === 0 && (
            <div className="text-center py-12 bg-white rounded-[2rem] border border-dashed border-slate-200">
              <p className="text-slate-400 font-bold">এই ক্লাসে কোনো ছাত্র পাওয়া যায়নি।</p>
            </div>
          )}
        </div>
      )}

      {/* Payment Modal */}
      {showPayModal && selectedFee && (
        <div className="fixed inset-0 bg-[#080A12]/60 backdrop-blur-xl z-[100] flex items-center justify-center p-6">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white w-full max-w-sm rounded-[3rem] p-8 shadow-2xl border border-slate-100"
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-black text-[#1E293B]">পেমেন্ট এন্ট্রি</h3>
              <button onClick={() => setShowPayModal(false)} className="p-2 bg-slate-50 text-slate-400 rounded-xl"><X size={20} /></button>
            </div>

            <div className="space-y-4">
              <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100">
                <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1">বকেয়া পরিমাণ</p>
                <p className="text-2xl font-black text-blue-700">৳{selectedFee.due_amount}</p>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 mb-2 block">টাকার পরিমাণ</label>
                <input 
                  type="number" 
                  className="w-full p-4 bg-slate-50 rounded-2xl font-black text-lg border-none focus:ring-2 focus:ring-blue-500"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 mb-2 block">পেমেন্ট মেথড</label>
                <select 
                  className="w-full p-4 bg-slate-50 rounded-2xl font-black text-sm border-none focus:ring-2 focus:ring-blue-500"
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value)}
                >
                  <option value="cash">Cash</option>
                  <option value="bkash">bKash</option>
                  <option value="nagad">Nagad</option>
                  <option value="bank">Bank</option>
                </select>
              </div>

              <button 
                onClick={handlePayment}
                className="w-full py-5 bg-blue-600 text-white font-black rounded-full shadow-xl shadow-blue-200 active:scale-95 transition-all text-base flex items-center justify-center gap-2"
              >
                <CheckCircle2 size={20} />
                পেমেন্ট নিশ্চিত করুন
              </button>
            </div>
          </motion.div>
        </div>
      )}
      {/* Discount Modal */}
      {showDiscountModal && selectedStudent && (
        <div className="fixed inset-0 bg-[#080A12]/60 backdrop-blur-xl z-[100] flex items-center justify-center p-6">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white w-full max-w-md rounded-[3rem] p-8 shadow-2xl border border-slate-100"
          >
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-xl font-black text-[#1E293B]">ডিসকাউন্ট যুক্ত করুন</h3>
                <p className="text-xs font-bold text-slate-400">{selectedStudent.student_name}</p>
              </div>
              <button onClick={() => setShowDiscountModal(false)} className="p-2 bg-slate-50 text-slate-400 rounded-xl"><X size={20} /></button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 mb-2 block">ফি ক্যাটাগরি</label>
                <select 
                  className="w-full p-4 bg-slate-50 rounded-2xl font-black text-sm border-none focus:ring-2 focus:ring-blue-500"
                  value={discountData.fee_category_id}
                  onChange={(e) => setDiscountData({ ...discountData, fee_category_id: e.target.value })}
                >
                  <option value="">সিলেক্ট করুন</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 mb-2 block">টাইপ</label>
                  <select 
                    className="w-full p-4 bg-slate-50 rounded-2xl font-black text-sm border-none focus:ring-2 focus:ring-blue-500"
                    value={discountData.discount_type}
                    onChange={(e) => setDiscountData({ ...discountData, discount_type: e.target.value })}
                  >
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed">Fixed (৳)</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 mb-2 block">পরিমাণ</label>
                  <input 
                    type="number" 
                    className="w-full p-4 bg-slate-50 rounded-2xl font-black text-sm border-none focus:ring-2 focus:ring-blue-500"
                    value={discountData.amount}
                    onChange={(e) => setDiscountData({ ...discountData, amount: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 mb-2 block">মেয়াদ</label>
                <select 
                  className="w-full p-4 bg-slate-50 rounded-2xl font-black text-sm border-none focus:ring-2 focus:ring-blue-500"
                  value={discountData.duration}
                  onChange={(e) => setDiscountData({ ...discountData, duration: e.target.value })}
                >
                  <option value="recurring">প্রতি মাসে (Recurring)</option>
                  <option value="one-time">এককালীন (One-time)</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 mb-2 block">কারণ</label>
                <input 
                  type="text" 
                  className="w-full p-4 bg-slate-50 rounded-2xl font-black text-sm border-none focus:ring-2 focus:ring-blue-500"
                  placeholder="যেমন: এতিম ছাত্র, হাফেজ ইত্যাদি"
                  value={discountData.reason}
                  onChange={(e) => setDiscountData({ ...discountData, reason: e.target.value })}
                />
              </div>

              <button 
                onClick={handleApplyDiscount}
                className="w-full py-5 bg-blue-600 text-white font-black rounded-full shadow-xl shadow-blue-200 active:scale-95 transition-all text-base"
              >
                ডিসকাউন্ট নিশ্চিত করুন
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

const CategoriesView: React.FC<{ lang: Language; madrasahId?: string }> = ({ lang, madrasahId }) => {
  const [categories, setCategories] = useState<any[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState('recurring');

  const fetchCategories = async () => {
    if (!madrasahId) return;
    const { data } = await supabase.from('fee_categories').select('*').eq('madrasah_id', madrasahId);
    setCategories(data || []);
  };

  useEffect(() => { fetchCategories(); }, [madrasahId]);

  const handleAdd = async () => {
    if (!madrasahId || !name) return;
    const { error } = await supabase.from('fee_categories').insert({
      madrasah_id: madrasahId,
      name,
      type
    });
    if (!error) {
      setShowAdd(false);
      setName('');
      fetchCategories();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-black text-[#1E293B]">ফি ক্যাটাগরি</h3>
        <button onClick={() => setShowAdd(true)} className="px-4 py-2 bg-blue-600 text-white rounded-2xl font-black text-xs flex items-center gap-2 shadow-lg shadow-blue-100">
          <Plus size={16} />
          নতুন ক্যাটাগরি
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {categories.map(c => (
          <div key={c.id} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
            <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center mb-4">
              <Settings size={20} />
            </div>
            <h4 className="font-black text-[#1E293B]">{c.name}</h4>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{c.type}</p>
          </div>
        ))}
      </div>

      {showAdd && (
        <div className="fixed inset-0 bg-[#080A12]/60 backdrop-blur-xl z-[100] flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-sm rounded-[3rem] p-8 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-black text-[#1E293B]">নতুন ক্যাটাগরি</h3>
              <button onClick={() => setShowAdd(false)} className="p-2 bg-slate-50 text-slate-400 rounded-xl"><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 mb-2 block">নাম</label>
                <input 
                  type="text" 
                  className="w-full p-4 bg-slate-50 rounded-2xl font-black text-sm border-none focus:ring-2 focus:ring-blue-500"
                  placeholder="যেমন: মাসিক ফি, পরীক্ষা ফি"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 mb-2 block">টাইপ</label>
                <select 
                  className="w-full p-4 bg-slate-50 rounded-2xl font-black text-sm border-none focus:ring-2 focus:ring-blue-500"
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                >
                  <option value="recurring">প্রতি মাসে (Recurring)</option>
                  <option value="one-time">এককালীন (One-time)</option>
                  <option value="optional">ঐচ্ছিক (Optional)</option>
                </select>
              </div>
              <button onClick={handleAdd} className="w-full py-5 bg-blue-600 text-white font-black rounded-full shadow-xl shadow-blue-200 active:scale-95 transition-all text-base">
                সেভ করুন
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Fees;
