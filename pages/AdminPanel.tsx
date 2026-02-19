
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
// Fix: Import icons from lucide-react instead of ../supabase
import { Loader2, Search, ChevronRight, User as UserIcon, ShieldCheck, Database, Globe, CheckCircle, XCircle, CreditCard, Save, X, Settings, Smartphone, MessageSquare, Key, Shield, ArrowLeft, Copy, Check, Calendar, Users, Layers, MonitorSmartphone, Server, BarChart3, TrendingUp, RefreshCcw, Clock, Hash, History as HistoryIcon, Zap, Activity, PieChart, Users2, CheckCircle2, AlertCircle, AlertTriangle, RefreshCw, Trash2, Sliders, ToggleLeft, ToggleRight, GraduationCap, Banknote, PhoneCall } from 'lucide-react';
import { supabase, smsApi } from '../supabase';
import { Madrasah, Language, Transaction, AdminSMSStock } from '../types';

interface MadrasahWithStats extends Madrasah {
  student_count?: number;
  class_count?: number;
}

interface AdminPanelProps {
  lang: Language;
  currentView?: 'list' | 'dashboard' | 'approvals';
  dataVersion?: number;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ lang, currentView = 'list', dataVersion = 0 }) => {
  const [madrasahs, setMadrasahs] = useState<MadrasahWithStats[]>([]);
  const [pendingTrans, setPendingTrans] = useState<Transaction[]>([]);
  const [transactionHistory, setTransactionHistory] = useState<Transaction[]>([]);
  const [globalRecentCalls, setGlobalRecentCalls] = useState<any[]>([]);
  const [adminStock, setAdminStock] = useState<AdminSMSStock | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [view, setView] = useState<'list' | 'approvals' | 'details' | 'dashboard'>(
    currentView === 'approvals' ? 'approvals' : currentView === 'dashboard' ? 'dashboard' : 'list'
  );
  const [smsToCredit, setSmsToCredit] = useState<{ [key: string]: string }>({});
  const [approvingIds, setApprovingIds] = useState<Set<string>>(new Set());
  
  const [smsEnabledMap, setSmsEnabledMap] = useState<{ [key: string]: boolean }>({});

  const [statusModal, setStatusModal] = useState<{show: boolean, type: 'success' | 'error', title: string, message: string}>({
    show: false,
    type: 'success',
    title: '',
    message: ''
  });

  const [rejectConfirm, setRejectConfirm] = useState<Transaction | null>(null);
  const [isRejecting, setIsRejecting] = useState(false);

  const [globalStats, setGlobalStats] = useState({ 
    totalStudents: 0, 
    totalClasses: 0, 
    totalTeachers: 0, 
    totalDistributedSMS: 0,
    totalSentSMS: 0,
    currentInUserWallets: 0 
  });
  const [selectedUser, setSelectedUser] = useState<MadrasahWithStats | null>(null);
  const [userStats, setUserStats] = useState({ students: 0, classes: 0, teachers: 0 });
  
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editLoginCode, setEditLoginCode] = useState('');
  const [editActive, setEditActive] = useState(true);
  const [editReveApiKey, setEditReveApiKey] = useState('');
  const [editReveSecretKey, setEditReveSecretKey] = useState('');
  const [editReveCallerId, setEditReveCallerId] = useState('');

  const [isUpdatingUser, setIsUpdatingUser] = useState(false);
  const [isRefreshingStats, setIsRefreshingStats] = useState(false);

  const fetchGlobalCounts = async () => {
    const [studentsRes, classesRes, teachersRes, smsAllocRes, currentBalRes] = await Promise.all([
      supabase.from('students').select('*', { count: 'exact', head: true }),
      supabase.from('classes').select('*', { count: 'exact', head: true }),
      supabase.from('teachers').select('*', { count: 'exact', head: true }),
      supabase.from('transactions').select('sms_count').eq('status', 'approved'),
      supabase.from('madrasahs').select('sms_balance')
    ]);

    const totalAllocated = smsAllocRes.data?.reduce((sum, t) => sum + (Number(t.sms_count) || 0), 0) || 0;
    const totalInWallets = currentBalRes.data?.reduce((sum, m) => sum + (Number(m.sms_balance) || 0), 0) || 0;
    const sentCount = Math.max(0, totalAllocated - totalInWallets);

    return {
      totalStudents: studentsRes.count || 0,
      totalClasses: classesRes.count || 0,
      totalTeachers: teachersRes.count || 0,
      totalDistributedSMS: totalAllocated,
      totalSentSMS: sentCount,
      currentInUserWallets: totalInWallets
    };
  };

  const fetchAdminStock = async () => {
    const { data } = await supabase.from('admin_sms_stock').select('*').limit(1).maybeSingle();
    return data || null;
  };

  const fetchAllMadrasahs = async () => {
    const { data, error } = await supabase.from('madrasahs')
      .select('*')
      .eq('is_super_admin', false)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  };

  const fetchGlobalRecentCalls = async () => {
    const { data } = await supabase
      .from('recent_calls')
      .select('*, students(student_name), madrasahs(name)')
      .order('called_at', { ascending: false })
      .limit(20);
    return data || [];
  };

  const fetchPendingTransactions = async () => {
    const { data } = await supabase.from('transactions').select('*, madrasahs(*)').eq('status', 'pending').order('created_at', { ascending: false });
    return data || [];
  };

  const fetchTransactionHistory = async () => {
    const { data } = await supabase.from('transactions')
      .select('*, madrasahs(*)')
      .neq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(50);
    return data || [];
  };

  const initData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    let isMounted = true;
    try {
      if (view === 'list' || view === 'dashboard') {
        const [mList, gStats, aStock, gCalls] = await Promise.all([
          fetchAllMadrasahs(),
          fetchGlobalCounts(),
          fetchAdminStock(),
          fetchGlobalRecentCalls()
        ]);
        if (isMounted) {
          setMadrasahs(mList.map(m => {
            const existing = madrasahs.find(ex => ex.id === m.id);
            return { 
              ...m, 
              student_count: existing?.student_count || 0, 
              class_count: existing?.class_count || 0 
            };
          }));
          setGlobalStats(gStats);
          setAdminStock(aStock);
          setGlobalRecentCalls(gCalls.slice(0, 20));
        }
      }
      if (view === 'approvals') {
        const [pTrans, tHist] = await Promise.all([
          fetchPendingTransactions(),
          fetchTransactionHistory()
        ]);
        if (isMounted) {
          setPendingTrans(pTrans);
          setTransactionHistory(tHist);
          const newSmsMap = { ...smsEnabledMap };
          pTrans.forEach(tr => {
            if (newSmsMap[tr.id] === undefined) newSmsMap[tr.id] = true;
          });
          setSmsEnabledMap(newSmsMap);
        }
      }
    } catch (err) { 
      console.error("AdminPanel Init Error:", err); 
    } finally { 
      if (isMounted && !silent) setLoading(false); 
    }
    return () => { isMounted = false; };
  }, [view, madrasahs.length]);

  useEffect(() => { 
    const cleanup = initData(); 
    return () => { cleanup.then(cb => cb && cb()); };
  }, [dataVersion, view]);

  useEffect(() => {
    if (currentView === 'approvals') setView('approvals');
    else if (currentView === 'dashboard') setView('dashboard');
    else if (currentView === 'list') setView('list');
  }, [currentView]);

  // Fix: Add missing handleUserClick function to manage details view and stats
  const handleUserClick = async (user: MadrasahWithStats) => {
    setSelectedUser(user);
    setEditName(user.name || '');
    setEditPhone(user.phone || '');
    setEditLoginCode(user.login_code || '');
    setEditActive(user.is_active);
    setEditReveApiKey(user.reve_api_key || '');
    setEditReveSecretKey(user.reve_secret_key || '');
    setEditReveCallerId(user.reve_caller_id || '');
    
    setView('details');
    
    // Fetch user stats
    setUserStats({ students: 0, classes: 0, teachers: 0 });
    try {
      const [stdRes, clsRes, teaRes] = await Promise.all([
        supabase.from('students').select('*', { count: 'exact', head: true }).eq('madrasah_id', user.id),
        supabase.from('classes').select('*', { count: 'exact', head: true }).eq('madrasah_id', user.id),
        supabase.from('teachers').select('*', { count: 'exact', head: true }).eq('madrasah_id', user.id)
      ]);
      setUserStats({
        students: stdRes.count || 0,
        classes: clsRes.count || 0,
        teachers: teaRes.count || 0
      });
    } catch (e) {
      console.error("Error fetching user stats:", e);
    }
  };

  // Fix: Add missing handleUserUpdate function to save changes to madrasah profile
  const handleUserUpdate = async () => {
    if (!selectedUser) return;
    setIsUpdatingUser(true);
    try {
      const { error } = await supabase.from('madrasahs').update({
        name: editName.trim(),
        phone: editPhone.trim(),
        login_code: editLoginCode.trim(),
        is_active: editActive,
        reve_api_key: editReveApiKey.trim() || null,
        reve_secret_key: editReveSecretKey.trim() || null,
        reve_caller_id: editReveCallerId.trim() || null
      }).eq('id', selectedUser.id);
      
      if (error) throw error;
      
      setStatusModal({ show: true, type: 'success', title: 'সফল', message: 'মাদরাসা প্রোফাইল আপডেট হয়েছে।' });
      initData(true);
      setView('list');
    } catch (err: any) {
      setStatusModal({ show: true, type: 'error', title: 'ব্যর্থ', message: err.message });
    } finally {
      setIsUpdatingUser(false);
    }
  };

  const approveTransaction = async (tr: Transaction) => {
    const sms = Number(smsToCredit[tr.id]);
    if (!sms || sms <= 0) {
      setStatusModal({ show: true, type: 'error', title: 'ত্রুটি', message: 'সঠিক SMS সংখ্যা লিখুন' });
      return;
    }
    
    setApprovingIds(prev => new Set(prev).add(tr.id));
    try {
      // ১. ডাটাবেসে পেমেন্ট অনুমোদন করা (RPC handles transactions, madrasahs balance and admin stock)
      const { data, error } = await supabase.rpc('approve_payment_with_sms', { 
        t_id: tr.id, 
        m_id: tr.madrasah_id, 
        sms_to_give: sms 
      });
      
      if (error) throw error;

      // RPC রেসপন্স চেক করা (Database level error capture)
      const res = data as { success: boolean, error?: string };
      if (res && res.success === false) {
        throw new Error(res.error || "Approval failed on server");
      }
      
      // ২. ইউজারকে কনফার্মেশন SMS পাঠানো (যদি টগল চালু থাকে)
      const isSmsEnabled = smsEnabledMap[tr.id] !== false;
      if (isSmsEnabled) {
        const userPhone = tr.madrasahs?.phone || tr.sender_phone;
        if (userPhone) {
          const msg = `আস-সালামু আলাইকুম, আপনার পেমেন্ট অনুমোদিত হয়েছে। আপনার অ্যাকাউন্টে ${sms} টি SMS যোগ করা হয়েছে। ধন্যবাদ।`;
          // Fire and forget SMS to avoid blocking UI
          smsApi.sendDirect(userPhone, msg).catch(err => console.error("SMS Send Error:", err));
        }
      }

      // ৩. লোকাল স্টেট আপডেট করা (সফল হলে সাথে সাথে লিস্ট থেকে সরিয়ে দেয়া)
      setPendingTrans(prev => prev.filter(p => p.id !== tr.id));
      
      setStatusModal({ 
        show: true, 
        type: 'success', 
        title: 'সফল', 
        message: isSmsEnabled ? 'রিচার্জ সফল হয়েছে এবং ইউজারকে SMS পাঠানো হয়েছে।' : 'রিচার্জ সফল হয়েছে (SMS পাঠানো হয়নি)।' 
      });
      
      // ব্যাকগ্রাউন্ডে ডাটা রিফ্রেশ করা
      initData(true);
    } catch (err: any) {
      console.error("Approve Error:", err);
      // Detailed error reporting for debugging
      const errorMessage = err.message || "অজানা ত্রুটি দেখা দিয়েছে।";
      setStatusModal({ show: true, type: 'error', title: 'ব্যর্থ', message: errorMessage });
    } finally {
      setApprovingIds(prev => {
        const next = new Set(prev);
        next.delete(tr.id);
        return next;
      });
    }
  };

  const rejectTransaction = async () => {
    if (!rejectConfirm) return;
    setIsRejecting(true);
    try {
      const { error } = await supabase.from('transactions').update({ status: 'rejected' }).eq('id', rejectConfirm.id);
      if (error) throw error;
      
      const userPhone = rejectConfirm.madrasahs?.phone || rejectConfirm.sender_phone;
      if (userPhone) {
        const msg = `দুঃখিত, আপনার পেমেন্ট রিকোয়েস্টটি (${rejectConfirm.amount} ৳) বাতিল করা হয়েছে। বিস্তারিত জানতে যোগাযোগ করুন।`;
        smsApi.sendDirect(userPhone, msg).catch(err => console.error("SMS Send Error:", err));
      }

      setPendingTrans(prev => prev.filter(p => p.id !== rejectConfirm.id));
      setRejectConfirm(null);
      setStatusModal({ show: true, type: 'success', title: 'বাতিল', message: 'পেমেন্ট রিকোয়েস্ট বাতিল করা হয়েছে' });
      initData(true);
    } catch (err: any) {
      setStatusModal({ show: true, type: 'error', title: 'ব্যর্থ', message: err.message });
    } finally {
      setIsRejecting(false);
    }
  };

  const toggleSmsForRequest = (id: string) => {
    setSmsEnabledMap(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const filtered = useMemo(() => madrasahs.filter(m => m.name.toLowerCase().includes(searchQuery.toLowerCase())), [madrasahs, searchQuery]);

  return (
    <div className="space-y-6 pb-20 animate-in fade-in relative">
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 text-white">
          <Loader2 className="animate-spin mb-4" size={40} />
          <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40">Loading System Data...</p>
        </div>
      ) : (
        <>
          {view === 'dashboard' && (
            <div className="space-y-6 animate-in slide-in-from-bottom-5">
              <div className="flex items-center justify-between px-2">
                <h1 className="text-xl font-black text-white font-noto drop-shadow-md">সিস্টেম ড্যাশবোর্ড</h1>
                <button onClick={() => initData()} className="p-2 bg-white/20 rounded-xl text-white backdrop-blur-md active:scale-95 transition-all">
                   <RefreshCw size={18} />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white/95 p-5 rounded-[2.2rem] border border-white shadow-xl flex flex-col items-center text-center">
                  <div className="w-10 h-10 bg-blue-50 text-blue-500 rounded-2xl flex items-center justify-center mb-2 shadow-inner">
                    <Users2 size={20} />
                  </div>
                  <h4 className="text-2xl font-black text-[#2E0B5E]">{madrasahs.length}</h4>
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1">Madrasahs</p>
                </div>
                <div className="bg-white/95 p-5 rounded-[2.2rem] border border-white shadow-xl flex flex-col items-center text-center">
                  <div className="w-10 h-10 bg-emerald-50 text-emerald-500 rounded-2xl flex items-center justify-center mb-2 shadow-inner">
                    <Activity size={20} />
                  </div>
                  <h4 className="text-2xl font-black text-[#2E0B5E]">{madrasahs.filter(m => m.is_active).length}</h4>
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1">Active Portals</p>
                </div>
                
                <div className="bg-white/95 p-6 rounded-[2.5rem] border border-white shadow-xl flex flex-col items-center text-center col-span-2 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform">
                    <PieChart size={60} />
                  </div>
                  <div className="grid grid-cols-2 w-full divide-x divide-slate-100">
                    <div>
                      <h4 className="text-2xl font-black text-[#2E0B5E]">{globalStats.totalDistributedSMS.toLocaleString('bn-BD')}</h4>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">মোট বিতরণকৃত SMS</p>
                    </div>
                    <div>
                      <h4 className="text-2xl font-black text-[#8D30F4]">{globalStats.totalSentSMS.toLocaleString('bn-BD')}</h4>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">মোট প্রেরিত SMS (ইউসেজ)</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white/95 p-8 rounded-[3rem] border border-white shadow-2xl space-y-8">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-black text-[#2E0B5E] font-noto">SMS Inventory</h3>
                  <Zap size={24} className="text-[#8D30F4]" fill="currentColor" />
                </div>
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-50 p-5 rounded-3xl border border-slate-100">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">সিস্টেম স্টক</p>
                      <h5 className="text-xl font-black text-[#2E0B5E]">{adminStock?.remaining_sms || 0}</h5>
                    </div>
                    <div className="bg-slate-50 p-5 rounded-3xl border border-slate-100">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">ইউজার ওয়ালেট (মোট)</p>
                      <h5 className="text-xl font-black text-[#8D30F4]">{globalStats.currentInUserWallets}</h5>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {view === 'list' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between px-2">
                <h1 className="text-xl font-black text-white font-noto drop-shadow-md">মাদরাসা লিস্ট</h1>
              </div>

              <div className="relative group px-1">
                <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                <input type="text" placeholder="Search Madrasah..." className="w-full h-14 pl-14 pr-14 bg-white border border-[#8D30F4]/5 rounded-[2rem] outline-none text-slate-800 font-bold shadow-xl" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
              </div>

              <div className="space-y-3">
                {filtered.length > 0 ? filtered.map(m => (
                  <div key={m.id} onClick={() => handleUserClick(m)} className="bg-white/95 p-5 rounded-[2.2rem] border border-white/50 shadow-lg active:scale-[0.98] transition-all cursor-pointer hover:border-[#8D30F4]/30">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-300 border border-slate-100 shadow-inner shrink-0 overflow-hidden">
                          {m.logo_url ? <img src={m.logo_url} className="w-full h-full object-cover" /> : <UserIcon size={24} />}
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-black text-slate-800 truncate font-noto text-lg">{m.name}</h3>
                          <div className="flex items-center gap-2 mt-1">
                            <p className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${m.is_active ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                              {m.is_active ? 'Active' : 'Blocked'}
                            </p>
                            <span className="text-[10px] text-slate-300">•</span>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{m.phone || 'No Phone'}</p>
                          </div>
                        </div>
                      </div>
                      <div className="text-right bg-[#F2F5FF] px-4 py-2 rounded-2xl border border-blue-50 flex flex-col items-center">
                        <p className="text-lg font-black text-[#8D30F4]">{m.sms_balance || 0}</p>
                        <p className="text-[7px] font-black text-slate-400 uppercase tracking-tighter">SMS</p>
                      </div>
                    </div>
                  </div>
                )) : (
                  <div className="text-center py-20 bg-white/10 rounded-[2.5rem] border-2 border-dashed border-white/30">
                    <p className="text-white/40 text-[10px] font-black uppercase tracking-widest">No Madrasahs Found</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {view === 'approvals' && (
            <div className="space-y-8 px-1">
              <div className="flex items-center justify-between px-2">
                <h1 className="text-xl font-black text-white font-noto drop-shadow-md">পেমেন্ট ম্যানেজমেন্ট</h1>
                <button onClick={() => initData()} className="p-2 bg-white/20 rounded-xl text-white backdrop-blur-md active:scale-95 transition-all">
                   <RefreshCw size={18} />
                </button>
              </div>
              
              <div className="space-y-6">
                <h2 className="text-[11px] font-black text-white uppercase tracking-[0.2em] px-2 flex items-center gap-2">
                  <AlertCircle size={14} className="text-amber-400" /> Pending Requests
                </h2>
                <div className="space-y-4">
                  {pendingTrans.length > 0 ? pendingTrans.map(tr => (
                    <div key={tr.id} className="bg-white p-6 rounded-[2.5rem] border border-white shadow-xl space-y-4 animate-in slide-in-from-left-4">
                      <div className="flex items-center justify-between">
                        <div className="bg-green-50 text-green-600 px-4 py-1.5 rounded-full text-[16px] font-black border border-green-100">{tr.amount} ৳</div>
                        <div className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-1.5">
                           <Clock size={12} /> {new Date(tr.created_at).toLocaleDateString('bn-BD')}
                        </div>
                      </div>
                      <div className="px-1 space-y-1">
                        <p className="text-[15px] font-black text-slate-800 font-noto">{tr.madrasahs?.name}</p>
                        <div className="flex flex-col gap-0.5">
                           <p className="text-[10px] font-bold text-slate-400">TrxID: <span className="text-[#8D30F4]">{tr.transaction_id}</span></p>
                           <p className="text-[11px] font-black text-[#2E0B5E] flex items-center gap-1.5">
                              <Smartphone size={12} className="text-[#8D30F4]" /> 
                              বিকাশ নম্বর: <span className="text-slate-800">{tr.sender_phone || 'N/A'}</span>
                           </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between bg-slate-50 p-3 rounded-2xl border border-slate-100">
                        <div className="flex items-center gap-2">
                           <MessageSquare size={16} className={smsEnabledMap[tr.id] ? "text-[#8D30F4]" : "text-slate-300"} />
                           <span className="text-[10px] font-black text-slate-500 uppercase">অ্যাপ্রুভ হলে SMS পাঠান</span>
                        </div>
                        <button onClick={() => toggleSmsForRequest(tr.id)} className="transition-all active:scale-90">
                           {smsEnabledMap[tr.id] ? (
                             <ToggleRight className="text-[#8D30F4]" size={28} />
                           ) : (
                             <ToggleLeft className="text-slate-300" size={28} />
                           )}
                        </button>
                      </div>

                      <div className="flex flex-col gap-3">
                        <div className="flex flex-col gap-2.5">
                          <input 
                            type="number" 
                            disabled={approvingIds.has(tr.id)}
                            className="w-full h-14 px-6 bg-slate-50 border border-slate-100 rounded-[1.5rem] font-black text-base text-center outline-none focus:border-[#8D30F4]/20 disabled:opacity-50" 
                            value={smsToCredit[tr.id] || ''} 
                            onChange={(e) => setSmsToCredit({...smsToCredit, [tr.id]: e.target.value})} 
                            placeholder="SMS Quantity" 
                          />
                          <button 
                            onClick={() => approveTransaction(tr)} 
                            disabled={approvingIds.has(tr.id) || !smsToCredit[tr.id]}
                            className="w-full h-14 bg-green-500 text-white font-black rounded-[1.5rem] text-sm active:scale-95 transition-all shadow-lg shadow-green-100 disabled:bg-slate-300 disabled:shadow-none flex items-center justify-center"
                          >
                            {approvingIds.has(tr.id) ? <Loader2 className="animate-spin" size={20} /> : 'অনুমোদন দিন'}
                          </button>
                        </div>
                        <button 
                          onClick={() => setRejectConfirm(tr)} 
                          disabled={approvingIds.has(tr.id)}
                          className="w-full h-12 bg-red-50 text-red-500 font-black rounded-[1.5rem] text-xs active:scale-95 transition-all border border-red-100 disabled:opacity-50"
                        >
                          রিকোয়েস্ট বাতিল করুন
                        </button>
                      </div>
                    </div>
                  )) : (
                    <div className="text-center py-10 bg-white/10 rounded-[2.5rem] border-2 border-dashed border-white/30">
                      <p className="text-white/40 text-[10px] font-black uppercase tracking-widest">No Pending Requests</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-6 pt-4 border-t border-white/10">
                <h2 className="text-[11px] font-black text-white uppercase tracking-[0.2em] px-2 flex items-center gap-2">
                   <HistoryIcon size={14} className="text-blue-400" /> Recent Transactions
                </h2>
                <div className="space-y-3">
                  {transactionHistory.length > 0 ? transactionHistory.map(tr => (
                    <div key={tr.id} className="bg-white/95 p-5 rounded-[2rem] border border-white shadow-lg flex items-center justify-between">
                       <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                             <p className="text-[15px] font-black text-slate-800 leading-none">{tr.amount} ৳</p>
                             <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${tr.status === 'approved' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                                {tr.status}
                             </span>
                          </div>
                          <p className="text-[12px] font-black text-[#2E0B5E] font-noto truncate">{tr.madrasahs?.name}</p>
                          <p className="text-[10px] font-bold text-slate-400 mt-1 flex items-center gap-2">
                             <Smartphone size={10} /> বিকাশ: {tr.sender_phone || 'N/A'}
                             {tr.sms_count && <span className="text-[#8D30F4] font-black">({tr.sms_count} SMS)</span>}
                          </p>
                          <div className="flex items-center gap-2 mt-1.5 text-slate-400">
                             <Clock size={10} />
                             <p className="text-[9px] font-bold">{new Date(tr.created_at).toLocaleDateString('bn-BD')}</p>
                          </div>
                       </div>
                       <div className="text-right ml-4">
                          <p className="text-[9px] font-black text-slate-300 uppercase tracking-tighter">TrxID</p>
                          <p className="text-[10px] font-black text-[#8D30F4] uppercase leading-tight">{tr.transaction_id}</p>
                       </div>
                    </div>
                  )) : (
                    <div className="text-center py-10 bg-white/10 rounded-[2.5rem] border-2 border-dashed border-white/30">
                       <p className="text-white/40 text-[10px] font-black uppercase tracking-widest">No History Found</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {view === 'details' && selectedUser && (
             <div className="animate-in slide-in-from-right-10 duration-500 pb-20 space-y-8 pt-2">
                <div className="flex items-center gap-5 px-1">
                   <button onClick={() => setView('list')} className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center text-white active:scale-90 transition-all border border-white/20 shadow-xl">
                      <ArrowLeft size={24} strokeWidth={3} />
                   </button>
                   <div className="min-w-0">
                      <h1 className="text-xl font-black text-white font-noto truncate leading-tight drop-shadow-md">Madrasah Details</h1>
                      <p className="text-[9px] font-black text-white/60 uppercase tracking-widest mt-1">UUID: {selectedUser.id}</p>
                   </div>
                </div>

                <div className="bg-white rounded-[3.5rem] p-8 shadow-2xl border border-white/50 space-y-8">
                   <div className="flex flex-col items-center text-center">
                      <div className="w-24 h-24 bg-slate-50 rounded-[2rem] flex items-center justify-center border-4 border-white shadow-xl overflow-hidden mb-4">
                         {selectedUser.logo_url ? <img src={selectedUser.logo_url} className="w-full h-full object-cover" /> : <UserIcon size={40} className="text-slate-300" />}
                      </div>
                      <h2 className="text-2xl font-black text-[#2E0B5E] font-noto">{selectedUser.name}</h2>
                      <div className={`mt-3 px-5 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2 border ${editActive ? 'bg-green-50 text-green-600 border-green-100' : 'bg-red-50 text-red-600 border-red-100'}`}>
                         <Activity size={12} /> {editActive ? 'Active Portal' : 'Access Restricted'}
                      </div>
                   </div>

                   <div className="grid grid-cols-2 gap-3">
                      <div className="bg-slate-50 p-4 rounded-3xl text-center border border-slate-100">
                         <h5 className="text-xl font-black text-[#2E0B5E]">{userStats.students}</h5>
                         <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Students</p>
                      </div>
                      <div className="bg-slate-50 p-4 rounded-3xl text-center border border-slate-100">
                         <h5 className="text-xl font-black text-[#2E0B5E]">{userStats.classes}</h5>
                         <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Classes</p>
                      </div>
                      <div className="bg-slate-50 p-4 rounded-3xl text-center border border-slate-100">
                         <h5 className="text-xl font-black text-[#2E0B5E]">{userStats.teachers}</h5>
                         <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Teachers</p>
                      </div>
                      <div className="bg-[#F2EBFF] p-4 rounded-3xl text-center border border-[#8D30F4]/10">
                         <h5 className="text-xl font-black text-[#8D30F4]">{selectedUser.sms_balance || 0}</h5>
                         <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest">SMS Bal</p>
                      </div>
                   </div>

                   <div className="space-y-6 pt-4 border-t border-slate-50">
                      <div className="grid grid-cols-1 gap-5">
                         <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Madrasah Name</label>
                            <input type="text" className="w-full h-14 bg-slate-50 border border-slate-100 rounded-2xl px-6 font-black text-[#2E0B5E] outline-none focus:border-[#8D30F4]/20" value={editName} onChange={(e) => setEditName(e.target.value)} />
                         </div>
                         <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                               <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Phone</label>
                               <input type="tel" className="w-full h-14 bg-slate-50 border border-slate-100 rounded-2xl px-6 font-black text-[#2E0B5E] outline-none" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                               <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Login Pin</label>
                               <input type="text" className="w-full h-14 bg-slate-50 border border-slate-100 rounded-2xl px-6 font-black text-[#8D30F4] outline-none" value={editLoginCode} onChange={(e) => setEditLoginCode(e.target.value)} />
                            </div>
                         </div>
                      </div>

                      <div className="bg-slate-50 p-6 rounded-[2.5rem] space-y-6">
                         <div className="flex items-center justify-between px-1">
                            <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                               <Sliders size={14} className="text-[#8D30F4]" /> Advanced Config
                            </h4>
                            <button onClick={() => setEditActive(!editActive)} className={`flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all ${editActive ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
                               {editActive ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                               <span className="text-[10px] font-black uppercase">{editActive ? 'Enabled' : 'Disabled'}</span>
                            </button>
                         </div>
                         <div className="space-y-4">
                            <div className="space-y-1.5">
                               <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">REVE API Key</label>
                               <input type="text" className="w-full h-12 bg-white border border-slate-100 rounded-xl px-4 font-bold text-xs" value={editReveApiKey} onChange={(e) => setEditReveApiKey(e.target.value)} placeholder="System Default Used" />
                            </div>
                            <div className="space-y-1.5">
                               <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">REVE Secret</label>
                               <input type="text" className="w-full h-12 bg-white border border-slate-100 rounded-xl px-4 font-bold text-xs" value={editReveSecretKey} onChange={(e) => setEditReveSecretKey(e.target.value)} placeholder="System Default Used" />
                            </div>
                            <div className="space-y-1.5">
                               <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Override Sender ID</label>
                               <input type="text" className="w-full h-12 bg-white border border-slate-100 rounded-xl px-4 font-black text-sm" value={editReveCallerId} onChange={(e) => setEditReveCallerId(e.target.value)} placeholder="e.g. 12345" />
                            </div>
                         </div>
                      </div>

                      <button onClick={handleUserUpdate} disabled={isUpdatingUser} className="w-full h-16 premium-btn text-white font-black rounded-full shadow-2xl active:scale-95 transition-all flex items-center justify-center gap-3 text-lg">
                         {isUpdatingUser ? <Loader2 className="animate-spin" size={24} /> : <><Save size={24} /> Save Profile Changes</>}
                      </button>
                   </div>
                </div>
             </div>
          )}
        </>
      )}

      {/* Reject Confirmation Modal - PORTALED */}
      {rejectConfirm && createPortal(
        <div className="modal-overlay bg-[#080A12]/60 backdrop-blur-3xl animate-in fade-in duration-300">
           <div className="bg-white w-full max-w-sm rounded-[3rem] p-8 shadow-[0_40px_100px_rgba(0,0,0,0.15)] text-center animate-in zoom-in-95 duration-500 border border-red-50">
              <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-5 shadow-inner border border-red-100">
                 <AlertTriangle size={32} />
              </div>
              <h3 className="text-xl font-black text-slate-800 font-noto tracking-tight">আপনি কি নিশ্চিত?</h3>
              <p className="text-[12px] font-bold text-slate-400 mt-2 font-noto leading-relaxed">
                 <span className="text-red-500">{rejectConfirm.madrasahs?.name}</span> এর <span className="text-slate-800">{rejectConfirm.amount} ৳</span> রিচার্জ রিকোয়েস্ট বাতিল করতে চাচ্ছেন।
              </p>
              <div className="flex flex-col gap-2 mt-8">
                 <button onClick={rejectTransaction} disabled={isRejecting} className="w-full py-4 bg-red-500 text-white font-black rounded-full shadow-xl shadow-red-100 active:scale-95 transition-all flex items-center justify-center gap-2 text-xs uppercase tracking-widest">
                    {isRejecting ? <Loader2 className="animate-spin" size={18} /> : 'হ্যাঁ, বাতিল করুন'}
                 </button>
                 <button onClick={() => setRejectConfirm(null)} disabled={isRejecting} className="w-full py-3 bg-slate-50 text-slate-400 font-black rounded-full active:scale-95 transition-all text-[10px] uppercase tracking-widest">পিছনে যান</button>
              </div>
           </div>
        </div>,
        document.body
      )}

      {/* Status Modal - PORTALED */}
      {statusModal.show && createPortal(
        <div className="modal-overlay bg-[#080A12]/50 backdrop-blur-3xl animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-sm rounded-[3.5rem] p-10 text-center shadow-[0_50px_120px_rgba(0,0,0,0.1)] border border-slate-50 animate-in zoom-in-95 duration-500 relative overflow-hidden">
             <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 transition-transform duration-700 ${statusModal.type === 'success' ? 'bg-green-50 text-green-500 border-green-100' : 'bg-red-50 text-red-500 border-red-100'} border-4 shadow-inner`}>
                {statusModal.type === 'success' ? <CheckCircle2 size={40} strokeWidth={2.5} /> : <AlertCircle size={40} strokeWidth={2.5} />}
             </div>
             <h3 className="text-[22px] font-black text-[#2E0B5E] font-noto leading-tight tracking-tight">{statusModal.title}</h3>
             <p className="text-[13px] font-bold text-slate-400 mt-3 font-noto px-4 leading-relaxed">{statusModal.message}</p>
             <button onClick={() => setStatusModal({ ...statusModal, show: false })} className={`w-full mt-8 py-4 font-black rounded-full text-xs uppercase tracking-[0.2em] transition-all shadow-2xl active:scale-95 ${statusModal.type === 'success' ? 'bg-[#2E0B5E] text-white shadow-slate-200' : 'bg-red-50 text-white shadow-red-100'}`}>
                {lang === 'bn' ? 'ঠিক আছে' : 'Continue'}
             </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default AdminPanel;
