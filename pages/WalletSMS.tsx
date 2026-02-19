
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { CreditCard, Loader2, Send, ChevronDown, BookOpen, Users, CheckCircle2, MessageSquare, Plus, Edit3, Trash2, Smartphone, X, Check, History, Zap, AlertTriangle, Clock, Save, AlertCircle } from 'lucide-react';
import { supabase, smsApi } from '../supabase';
import { SMSTemplate, Language, Madrasah, Class, Student, Transaction } from '../types';
import { t } from '../translations';
import { sortMadrasahClasses } from './Classes';

interface WalletSMSProps {
  lang: Language;
  madrasah: Madrasah | null;
  triggerRefresh: () => void;
  dataVersion: number;
}

const WalletSMS: React.FC<WalletSMSProps> = ({ lang, madrasah, triggerRefresh, dataVersion }) => {
  const [activeTab, setActiveTab] = useState<'templates' | 'bulk-sms' | 'recharge'>('bulk-sms');
  const [templates, setTemplates] = useState<SMSTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState<Class[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [bulkMessage, setBulkMessage] = useState('');
  const [sendingBulk, setSendingBulk] = useState(false);
  const [bulkSuccess, setBulkSuccess] = useState(false);
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [classStudents, setClassStudents] = useState<Student[]>([]);
  const [showClassDropdown, setShowClassDropdown] = useState(false);
  const [showTemplateDropdownBulk, setShowTemplateDropdownBulk] = useState(false);
  const [userTransactions, setUserTransactions] = useState<Transaction[]>([]);
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<SMSTemplate | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [tempTitle, setTempTitle] = useState('');
  const [tempBody, setTempBody] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  // Error/Status Modal
  const [statusModal, setStatusModal] = useState<{show: boolean, type: 'error' | 'balance' | 'success', title: string, message: string}>({
    show: false,
    type: 'error',
    title: '',
    message: ''
  });

  // Recharge Form States
  const [rechargeAmount, setRechargeAmount] = useState('');
  const [rechargeTrx, setRechargeTrx] = useState('');
  const [rechargePhone, setRechargePhone] = useState('');
  const [requesting, setRequesting] = useState(false);
  const [requestSuccess, setRequestSuccess] = useState(false);
  const [adminBkash, setAdminBkash] = useState('০১৭৬৬-XXXXXX');

  useEffect(() => { 
    if (activeTab === 'templates') fetchTemplates(); 
    if (activeTab === 'bulk-sms') { fetchClasses(); fetchTemplates(); }
    if (activeTab === 'recharge') { fetchSystemSettings(); fetchUserTransactions(); }
  }, [activeTab, madrasah?.id, dataVersion]);

  useEffect(() => {
    if (selectedClassId) fetchClassStudents(selectedClassId); else setClassStudents([]);
  }, [selectedClassId]);

  const fetchSystemSettings = async () => {
    const settings = await smsApi.getGlobalSettings();
    if (settings.bkash_number) setAdminBkash(settings.bkash_number);
  };

  const fetchClasses = async () => {
    if (!madrasah) return;
    const { data } = await supabase.from('classes').select('*').eq('madrasah_id', madrasah.id);
    if (data) setClasses(sortMadrasahClasses(data));
  };

  const fetchClassStudents = async (cid: string) => {
    const { data } = await supabase.from('students').select('*').eq('class_id', cid);
    if (data) setClassStudents(data);
  };

  const fetchTemplates = async () => {
    if (!madrasah) return;
    setLoading(true);
    const { data } = await supabase.from('sms_templates').select('*').eq('madrasah_id', madrasah.id).order('created_at', { ascending: false });
    if (data) setTemplates(data);
    setLoading(false);
  };

  const handleSaveTemplate = async () => {
    if (!madrasah || !tempTitle.trim() || !tempBody.trim()) return;
    setIsSaving(true);
    try {
      if (editingId) {
        await supabase.from('sms_templates').update({ title: tempTitle, body: tempBody }).eq('id', editingId);
      } else {
        await supabase.from('sms_templates').insert({ madrasah_id: madrasah.id, title: tempTitle, body: tempBody });
      }
      setShowAddModal(false);
      setTempTitle('');
      setTempBody('');
      setEditingId(null);
      fetchTemplates();
    } catch (e: any) { alert(e.message); } finally { setIsSaving(false); }
  };

  const handleDeleteTemplate = async () => {
    if (!showDeleteConfirm) return;
    setIsDeleting(true);
    try {
      await supabase.from('sms_templates').delete().eq('id', showDeleteConfirm.id);
      setShowDeleteConfirm(null);
      fetchTemplates();
    } catch (e: any) { alert(e.message); } finally { setIsDeleting(false); }
  };

  const fetchUserTransactions = async () => {
    if (!madrasah) return;
    const { data } = await supabase.from('transactions')
      .select('*')
      .eq('madrasah_id', madrasah.id)
      .order('created_at', { ascending: false })
      .limit(10);
    if (data) setUserTransactions(data);
  };

  const handleRechargeRequest = async () => {
    if (!rechargeAmount || !rechargeTrx || !madrasah) return;
    setRequesting(true);
    try {
      const { error } = await supabase.from('transactions').insert({
        madrasah_id: madrasah.id,
        amount: parseInt(rechargeAmount),
        transaction_id: rechargeTrx.trim().toUpperCase(),
        sender_phone: rechargePhone.trim(),
        description: 'SMS Recharge Request',
        type: 'credit',
        status: 'pending'
      });
      if (error) throw error;
      setRequestSuccess(true);
      setRechargeAmount('');
      setRechargeTrx('');
      setRechargePhone('');
      fetchUserTransactions();
      setTimeout(() => setRequestSuccess(false), 5000);
    } catch (err: any) {
      setStatusModal({
        show: true,
        type: 'error',
        title: 'Request Failed',
        message: err.message
      });
    } finally {
      setRequesting(false);
    }
  };

  const handleSendBulk = async () => {
    if (!bulkMessage.trim() || !selectedClassId || classStudents.length === 0 || !madrasah) return;
    setSendingBulk(true);
    try {
      await smsApi.sendBulk(madrasah.id, classStudents, bulkMessage);
      setBulkSuccess(true); 
      setShowSuccessPopup(true);
      setBulkMessage(''); 
      setSelectedClassId('');
      triggerRefresh();
      setTimeout(() => setBulkSuccess(false), 3000);
    } catch (err: any) { 
      const isBalanceError = err.message.toLowerCase().includes('balance');
      setStatusModal({
        show: true,
        type: isBalanceError ? 'balance' : 'error',
        title: isBalanceError ? (lang === 'bn' ? 'ব্যালেন্স শেষ!' : 'Out of Balance!') : (lang === 'bn' ? 'ব্যর্থ' : 'Failed'),
        message: err.message
      });
    } finally { setSendingBulk(false); }
  };

  const handleSendFreeBulk = () => {
    if (!bulkMessage.trim() || classStudents.length === 0) return;
    const phones = classStudents.map(s => s.guardian_phone).join(',');
    const encodedMsg = encodeURIComponent(bulkMessage);
    const separator = /iPad|iPhone|iPod/.test(navigator.userAgent) ? '&' : '?';
    window.location.href = `sms:${phones}${separator}body=${encodedMsg}`;
  };

  const getSelectedClassName = () => {
    const cls = classes.find(c => c.id === selectedClassId);
    return cls ? cls.class_name : (lang === 'bn' ? 'ক্লাস নির্বাচন করুন' : 'Select Class');
  };

  return (
    <>
      <div className="space-y-4 animate-in fade-in duration-500 pb-24">
        <div className="relative p-1.5 bg-white/10 backdrop-blur-3xl rounded-[3rem] border border-white/20 shadow-xl flex items-center h-16 mb-2">
          <div 
            className="absolute h-[calc(100%-12px)] rounded-[2.5rem] bg-white shadow-md transition-all duration-500 z-0"
            style={{ 
              width: 'calc((100% - 12px) / 3)',
              left: activeTab === 'templates' ? '6px' : activeTab === 'bulk-sms' ? 'calc(6px + (100% - 12px) / 3)' : 'calc(6px + 2 * (100% - 12px) / 3)',
            }}
          />
          {(['templates', 'bulk-sms', 'recharge'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`relative flex-1 h-full rounded-[2.5rem] font-black text-[11px] uppercase tracking-wider flex items-center justify-center gap-2 transition-all z-10 ${activeTab === tab ? 'text-[#8D30F4]' : 'text-white/70'}`}>
              {tab === 'templates' ? <MessageSquare size={16} /> : tab === 'bulk-sms' ? <Send size={16} /> : <CreditCard size={16} />}
              <span className="font-noto">{tab === 'templates' ? t('templates', lang) : tab === 'bulk-sms' ? t('bulk_sms', lang) : t('recharge', lang)}</span>
            </button>
          ))}
        </div>

        {activeTab === 'templates' && (
          <div className="space-y-5 animate-in slide-in-from-bottom-5">
            <div className="flex items-center justify-between px-2">
              <h2 className="text-[10px] font-black text-white uppercase tracking-[0.2em] opacity-80">Saved Message Templates</h2>
              <button onClick={() => { setEditingId(null); setTempTitle(''); setTempBody(''); setShowAddModal(true); }} className="premium-btn text-white px-4 py-2 rounded-2xl text-[10px] font-black flex items-center gap-2 active:scale-95 transition-all border border-white/20 shadow-xl">
                 <Plus size={14} strokeWidth={4} /> {t('new_template', lang)}
              </button>
            </div>

            <div className="space-y-3">
               {loading ? (
                  <div className="flex justify-center py-10"><Loader2 className="animate-spin text-white" size={30} /></div>
               ) : templates.length > 0 ? (
                  templates.map(tmp => (
                    <div key={tmp.id} className="bg-white/95 backdrop-blur-md p-5 rounded-[2.2rem] border border-white/50 shadow-xl relative group">
                       <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                             <div className="w-10 h-10 bg-[#8D30F4]/10 rounded-xl flex items-center justify-center text-[#8D30F4] border border-[#8D30F4]/10">
                                <BookOpen size={18} />
                             </div>
                             <h4 className="font-black text-[#2E0B5E] text-[15px] font-noto">{tmp.title}</h4>
                          </div>
                          <div className="flex gap-1.5">
                             <button onClick={() => { setEditingId(tmp.id); setTempTitle(tmp.title); setTempBody(tmp.body); setShowAddModal(true); }} className="w-8 h-8 bg-slate-50 text-slate-400 rounded-lg flex items-center justify-center active:scale-90 transition-all"><Edit3 size={14}/></button>
                             <button onClick={() => setShowDeleteConfirm(tmp)} className="w-8 h-8 bg-red-50 text-red-500 rounded-lg flex items-center justify-center active:scale-90 transition-all"><Trash2 size={14}/></button>
                          </div>
                       </div>
                       <p className="text-sm font-bold text-slate-500 font-noto leading-relaxed">{tmp.body}</p>
                    </div>
                  ))
               ) : (
                  <div className="text-center py-20 bg-white/10 rounded-[3rem] border-2 border-dashed border-white/30 backdrop-blur-sm">
                     <p className="text-white/60 font-black text-[10px] uppercase tracking-widest">No templates found</p>
                  </div>
               )}
            </div>
          </div>
        )}

        {activeTab === 'bulk-sms' && (
          <div className="space-y-5 animate-in slide-in-from-bottom-5">
            <div className="bg-gradient-to-br from-[#8D30F4] to-[#A179FF] p-6 rounded-[2.2rem] shadow-xl border border-white/20 flex items-center justify-between text-white relative">
               <div className="relative z-10">
                 <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-70 mb-1">Available SMS</p>
                 <h3 className="text-4xl font-black flex items-baseline gap-2">{madrasah?.sms_balance || 0}</h3>
               </div>
               <Zap size={40} className="text-white opacity-20" />
            </div>

            <div className="bg-white/95 backdrop-blur-xl p-6 rounded-[2.5rem] shadow-2xl border border-white/50 space-y-7">
              <div className="space-y-4">
                <h4 className="text-[11px] font-black text-[#2E0B5E] uppercase tracking-widest px-1">১. ক্লাস নির্বাচন</h4>
                <div className="relative space-y-3">
                  <button onClick={() => setShowClassDropdown(!showClassDropdown)} className="w-full h-[60px] px-6 rounded-[1.5rem] border-2 bg-slate-50 border-slate-100 flex items-center justify-between">
                    <span className="text-base font-black font-noto text-[#2E0B5E]">{getSelectedClassName()}</span>
                    <ChevronDown className={`text-slate-300 transition-all ${showClassDropdown ? 'rotate-180' : ''}`} size={20} />
                  </button>
                  
                  {selectedClassId && (
                    <div className="flex items-center gap-2 px-4 py-2 bg-[#8D30F4]/10 rounded-xl border border-[#8D30F4]/10 animate-in fade-in slide-in-from-top-2">
                      <Users size={16} className="text-[#8D30F4]" />
                      <p className="text-[11px] font-black text-[#8D30F4] uppercase tracking-wider">
                        {lang === 'bn' ? `মোট ছাত্র: ${classStudents.length} জন` : `Total Students: ${classStudents.length}`}
                      </p>
                    </div>
                  )}

                  {showClassDropdown && (
                    <div className="absolute top-full left-0 right-0 mt-3 bg-white rounded-[2rem] shadow-2xl border border-slate-100 z-[100] p-2 max-h-60 overflow-y-auto">
                      {classes.map(cls => (
                        <button key={cls.id} onClick={() => { setSelectedClassId(cls.id); setShowClassDropdown(false); }} className={`w-full text-left px-5 py-3.5 rounded-xl mb-1 ${selectedClassId === cls.id ? 'bg-[#8D30F4] text-white' : 'hover:bg-slate-50 text-[#2E0B5E]'}`}>
                          <span className="font-black font-noto">{cls.class_name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-[11px] font-black text-[#2E0B5E] uppercase tracking-widest px-1">২. টেমপ্লেট বাছাই করুন (ঐচ্ছিক)</h4>
                <div className="relative">
                  <button onClick={() => setShowTemplateDropdownBulk(!showTemplateDropdownBulk)} className="w-full h-[60px] px-6 rounded-[1.5rem] border-2 bg-slate-50 border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <BookOpen size={18} className="text-[#8D30F4]" />
                      <span className="text-base font-black font-noto text-slate-400">টেমপ্লেট সিলেক্ট করুন</span>
                    </div>
                    <ChevronDown className={`text-slate-300 transition-all ${showTemplateDropdownBulk ? 'rotate-180' : ''}`} size={20} />
                  </button>
                  {showTemplateDropdownBulk && (
                    <div className="absolute top-full left-0 right-0 mt-3 bg-white rounded-[2rem] shadow-2xl border border-slate-100 z-[100] p-2 max-h-60 overflow-y-auto animate-in slide-in-from-top-2">
                      {templates.length > 0 ? templates.map(tmp => (
                        <button key={tmp.id} onClick={() => { setBulkMessage(tmp.body); setShowTemplateDropdownBulk(false); }} className="w-full text-left px-5 py-3.5 rounded-xl mb-1 hover:bg-slate-50">
                          <p className="text-[10px] font-black text-[#8D30F4] uppercase mb-0.5">{tmp.title}</p>
                          <p className="text-xs font-bold text-[#2E0B5E] truncate">{tmp.body}</p>
                        </button>
                      )) : (
                        <div className="p-5 text-center text-slate-400 text-xs font-bold">কোনো টেমপ্লেট পাওয়া যায়নি</div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-[11px] font-black text-[#2E0B5E] uppercase tracking-widest px-1">৩. বার্তা লিখুন</h4>
                <div className="relative">
                  <textarea className="w-full h-32 px-5 py-5 bg-slate-50 border-2 border-slate-100 rounded-[1.8rem] text-[#2E0B5E] font-bold outline-none font-noto resize-none" placeholder="বার্তা..." value={bulkMessage} onChange={(e) => setBulkMessage(e.target.value)} maxLength={160} />
                  <div className="absolute bottom-4 right-5 bg-white px-2 py-0.5 rounded-lg border border-slate-100 shadow-sm">
                     <span className="text-[10px] font-black text-[#8D30F4]">{bulkMessage.length}/160</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3">
                <button onClick={handleSendBulk} disabled={sendingBulk || !bulkMessage.trim() || !selectedClassId || classStudents.length === 0} className="w-full h-[64px] premium-btn text-white font-black rounded-full shadow-lg flex items-center justify-center gap-3 text-lg disabled:opacity-40">
                  {sendingBulk ? <Loader2 className="animate-spin" size={24} /> : bulkSuccess ? 'সফল!' : <><Send size={20} /> বাল্ক এসএমএস পাঠান</>}
                </button>
                
                <button onClick={handleSendFreeBulk} disabled={sendingBulk || !bulkMessage.trim() || classStudents.length === 0} className="w-full h-[54px] bg-[#1A0B2E] text-white font-black rounded-full shadow-lg flex items-center justify-center gap-3 text-sm disabled:opacity-40 active:scale-95 transition-all">
                  <Smartphone size={20} /> ফ্রি এসএমএস (সিম কার্ড)
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'recharge' && (
          <div className="space-y-6 animate-in slide-in-from-bottom-5 duration-500">
             <div className="bg-white/95 p-8 rounded-[3rem] shadow-2xl border border-white space-y-6">
                <div className="text-center">
                  <div className="inline-flex p-3 bg-[#8D30F4]/10 rounded-2xl text-[#8D30F4] mb-3"><CreditCard size={32} /></div>
                  <h3 className="text-xl font-black text-[#2E0B5E]">রিচার্জ রিকোয়েস্ট</h3>
                  <p className="text-xs font-bold text-slate-400 font-noto">বিকাশ/নগদ সেন্ড মানি করে রিকোয়েস্ট পাঠান</p>
                </div>

                <div className="bg-[#F2EBFF] p-6 rounded-[2.2rem] text-center border border-[#8D30F4]/10">
                  <p className="text-[9px] font-black text-[#8D30F4] uppercase tracking-widest mb-1">bKash/Nagad Number</p>
                  <h3 className="text-2xl font-black text-[#2E0B5E]">{adminBkash}</h3>
                </div>

                <div className="space-y-4">
                  {requestSuccess && (
                    <div className="bg-green-50 p-4 rounded-2xl border border-green-100 flex items-center gap-3 text-green-600 text-sm font-black animate-in slide-in-from-top-2">
                       <CheckCircle2 size={20} /> রিকোয়েস্ট সফল! অ্যাডমিন অনুমোদন করলে SMS যোগ হবে।
                    </div>
                  )}
                  <div className="space-y-1.5 px-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">টাকার পরিমাণ</label>
                    <input type="number" className="w-full h-14 px-6 bg-slate-50 border-2 border-slate-100 rounded-full font-black text-lg" value={rechargeAmount} onChange={(e) => setRechargeAmount(e.target.value)} placeholder="0.00" />
                  </div>
                  <div className="space-y-1.5 px-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">বিকাশ নম্বর</label>
                    <input type="tel" className="w-full h-14 px-6 bg-slate-50 border-2 border-slate-100 rounded-full font-black text-lg" value={rechargePhone} onChange={(e) => setRechargePhone(e.target.value)} placeholder="017XXXXXXXX" />
                  </div>
                  <div className="space-y-1.5 px-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">TrxID</label>
                    <input type="text" className="w-full h-14 px-6 bg-slate-50 border-2 border-slate-100 rounded-full font-black text-lg uppercase" value={rechargeTrx} onChange={(e) => setRechargeTrx(e.target.value)} placeholder="8X23M1..." />
                  </div>
                  <button onClick={handleRechargeRequest} disabled={requesting || !rechargeAmount || !rechargeTrx} className="w-full h-16 premium-btn text-white font-black rounded-full flex items-center justify-center gap-3 text-lg mt-4 disabled:opacity-40">
                    {requesting ? <Loader2 className="animate-spin" size={24} /> : 'রিকোয়েস্ট পাঠান'}
                  </button>
                </div>
             </div>

             <div className="space-y-4">
                <h2 className="text-[10px] font-black text-white uppercase tracking-[0.2em] px-3 opacity-80 flex items-center gap-2">
                   <History size={12} /> My Recharge History
                </h2>
                <div className="space-y-2.5">
                  {userTransactions.length > 0 ? userTransactions.map(tr => (
                    <div key={tr.id} className="bg-white/95 backdrop-blur-md p-4 rounded-[1.8rem] border border-white flex items-center justify-between shadow-xl">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-[15px] font-black text-slate-800 leading-none">{tr.amount} ৳</p>
                          <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${tr.status === 'approved' ? 'bg-green-50 text-green-600' : tr.status === 'pending' ? 'bg-orange-50 text-orange-600' : 'bg-red-50 text-red-600'}`}>
                            {tr.status}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1.5">
                           <Clock size={10} className="text-slate-400" />
                           <p className="text-[10px] font-bold text-slate-400">{new Date(tr.created_at).toLocaleDateString('bn-BD')}</p>
                        </div>
                      </div>
                      <div className="text-right">
                         <p className="text-[9px] font-black text-[#8D30F4] uppercase tracking-tighter opacity-60">TrxID: {tr.transaction_id}</p>
                      </div>
                    </div>
                  )) : (
                    <div className="text-center py-10 bg-white/10 rounded-[2.5rem] border border-white/20">
                       <p className="text-white/40 text-[9px] font-black uppercase tracking-widest">No history records</p>
                    </div>
                  )}
                </div>
             </div>
          </div>
        )}
      </div>

      {statusModal.show && createPortal(
        <div className="modal-overlay bg-[#080A12]/40 backdrop-blur-2xl animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-sm rounded-[3.5rem] p-10 text-center shadow-[0_50px_120px_rgba(0,0,0,0.15)] border border-slate-50 animate-in zoom-in-95 duration-500 relative overflow-hidden">
             
             <div className="relative mb-8">
                <div className={`w-24 h-24 rounded-full flex items-center justify-center mx-auto border-4 shadow-inner relative z-10 transition-all duration-700 ${
                  statusModal.type === 'balance' ? 'bg-orange-50 text-orange-500 border-orange-100' :
                  statusModal.type === 'success' ? 'bg-green-50 text-green-500 border-green-100' :
                  'bg-red-50 text-red-500 border-red-100'
                }`}>
                  {statusModal.type === 'balance' ? <Zap size={54} strokeWidth={2.5} fill="currentColor" /> :
                   statusModal.type === 'success' ? <CheckCircle2 size={54} strokeWidth={2.5} /> :
                   <AlertCircle size={54} strokeWidth={2.5} />}
                </div>
                {statusModal.type !== 'success' && (
                  <div className={`absolute inset-0 rounded-full animate-ping opacity-20 mx-auto w-24 h-24 ${statusModal.type === 'balance' ? 'bg-orange-400' : 'bg-red-400'}`}></div>
                )}
             </div>

             <h3 className="text-[24px] font-black text-[#2E0B5E] font-noto leading-tight tracking-tight">{statusModal.title}</h3>
             <p className="text-[13px] font-bold text-slate-500 mt-3 font-noto px-2 leading-relaxed">
               {statusModal.message}
             </p>
             
             <div className="flex flex-col gap-3 mt-10">
                {statusModal.type === 'balance' ? (
                  <>
                    <button 
                      onClick={() => { setStatusModal({ ...statusModal, show: false }); setActiveTab('recharge'); }} 
                      className="w-full py-5 bg-[#8D30F4] text-white font-black rounded-full shadow-xl shadow-purple-100 active:scale-95 transition-all text-sm uppercase tracking-[0.1em] flex items-center justify-center gap-3"
                    >
                      <Zap size={18} fill="currentColor" /> রিচার্জ করুন
                    </button>
                    <button 
                      onClick={() => setStatusModal({ ...statusModal, show: false })} 
                      className="w-full py-4 bg-slate-50 text-slate-400 font-black rounded-full text-[11px] uppercase tracking-widest active:scale-95 transition-all"
                    >
                      {lang === 'bn' ? 'বাতিল' : 'Cancel'}
                    </button>
                  </>
                ) : (
                  <button 
                    onClick={() => setStatusModal({ ...statusModal, show: false })} 
                    className={`w-full py-5 font-black rounded-full text-sm uppercase tracking-[0.2em] transition-all shadow-xl active:scale-95 ${statusModal.type === 'success' ? 'bg-[#2E0B5E] text-white shadow-slate-200' : 'bg-red-500 text-white shadow-red-100'}`}
                  >
                    {lang === 'bn' ? 'ঠিক আছে' : 'Continue'}
                  </button>
                )}
             </div>
          </div>
        </div>,
        document.body
      )}

      {showSuccessPopup && createPortal(
        <div className="modal-overlay bg-[#080A12]/40 backdrop-blur-2xl animate-in fade-in duration-300">
           <div className="bg-white w-full max-w-sm rounded-[3.5rem] p-12 text-center shadow-[0_40px_100px_rgba(141,48,244,0.3)] border border-[#8D30F4]/10 animate-in zoom-in-95 duration-300">
              <div className="w-24 h-24 bg-green-50 text-green-500 rounded-full flex items-center justify-center mx-auto mb-8 shadow-inner border border-green-100">
                 <CheckCircle2 size={56} strokeWidth={2.5} />
              </div>
              <h3 className="text-2xl font-black text-slate-800 font-noto tracking-tight">সফলভাবে প্রেরন করা হয়েছে</h3>
              <p className="text-[11px] font-bold text-slate-400 mt-4 uppercase tracking-[0.2em]">Bulk SMS Sent Successfully</p>
              <button 
                onClick={() => setShowSuccessPopup(false)} 
                className="w-full mt-10 py-5 premium-btn text-white font-black rounded-full shadow-xl active:scale-95 transition-all text-sm uppercase tracking-widest"
              >
                ঠিক আছে
              </button>
           </div>
        </div>,
        document.body
      )}
      
      {showAddModal && createPortal(
        <div className="modal-overlay bg-[#080A12]/40 backdrop-blur-2xl animate-in fade-in duration-300">
           <div className="bg-white w-full max-w-sm rounded-[3.5rem] p-10 shadow-[0_40px_100px_rgba(141,48,244,0.2)] border border-[#8D30F4]/5 relative animate-in zoom-in-95 duration-300">
              <button onClick={() => setShowAddModal(false)} className="absolute top-10 right-10 text-slate-300 hover:text-[#8D30F4] transition-all p-1">
                 <X size={26} strokeWidth={3} />
              </button>
              <div className="flex items-center gap-5 mb-8">
                 <div className="w-16 h-16 bg-[#8D30F4]/10 rounded-[1.8rem] flex items-center justify-center text-[#8D30F4] border border-[#8D30F4]/10 shadow-inner">
                    <MessageSquare size={32} />
                 </div>
                 <div>
                    <h2 className="text-xl font-black text-[#2E0B5E] font-noto tracking-tight">টেমপ্লেট যোগ করুন</h2>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">SMS Template</p>
                 </div>
              </div>
              <div className="space-y-6">
                 <div className="space-y-2 px-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block px-1">শিরোনাম</label>
                    <input type="text" className="w-full h-14 bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 font-black text-[#2E0B5E] font-noto outline-none focus:border-[#8D30F4]/30" placeholder="যেমন: উপস্থিতি" value={tempTitle} onChange={(e) => setTempTitle(e.target.value)} />
                 </div>
                 <div className="space-y-2 px-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block px-1">মেসেজ বডি</label>
                    <textarea className="w-full h-32 bg-slate-50 border-2 border-slate-100 rounded-[1.8rem] px-6 py-4 font-bold text-slate-600 font-noto outline-none focus:border-[#8D30F4]/30 resize-none" placeholder="আপনার মেসেজ এখানে লিখুন..." value={tempBody} onChange={(e) => setTempBody(e.target.value)} />
                 </div>
                 <button onClick={handleSaveTemplate} disabled={isSaving || !tempTitle || !tempBody} className="w-full h-16 premium-btn text-white font-black rounded-full shadow-2xl flex items-center justify-center gap-3 active:scale-95 transition-all text-lg">
                    {isSaving ? <Loader2 className="animate-spin" size={24} /> : <><Save size={24} /> {editingId ? 'আপডেট করুন' : 'সেভ করুন'}</>}
                 </button>
              </div>
           </div>
        </div>,
        document.body
      )}

      {showDeleteConfirm && createPortal(
        <div className="modal-overlay bg-[#080A12]/40 backdrop-blur-2xl animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-sm rounded-[3.5rem] p-10 shadow-[0_40px_100px_rgba(239,68,68,0.2)] border border-red-50 text-center space-y-6 animate-in zoom-in-95 duration-500">
             <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto shadow-inner border border-red-100">
                <AlertTriangle size={40} />
             </div>
             <div>
                <h3 className="text-xl font-black text-slate-800 font-noto">টেমপ্লেট ডিলিট করুন</h3>
                <p className="text-[11px] font-bold text-slate-400 mt-2 uppercase tracking-wider px-4 leading-relaxed">
                  আপনি কি নিশ্চিতভাবে "{showDeleteConfirm.title}" টেমপ্লেটটি মুছে ফেলতে চান? এটি আর ফিরিয়ে আনা যাবে না।
                </p>
             </div>
             <div className="flex flex-col gap-3 pt-2">
                <button 
                  onClick={handleDeleteTemplate} 
                  disabled={isDeleting} 
                  className="w-full py-5 bg-red-500 text-white font-black rounded-full shadow-xl shadow-red-100 active:scale-95 transition-all flex items-center justify-center text-md gap-3"
                >
                  {isDeleting ? <Loader2 className="animate-spin" size={22} /> : (
                    <><Trash2 size={20} /> ডিলিট করুন</>
                  )}
                </button>
                <button 
                  onClick={() => setShowDeleteConfirm(null)} 
                  disabled={isDeleting}
                  className="w-full py-4 bg-slate-50 text-slate-400 font-black rounded-full active:scale-95 transition-all text-sm uppercase tracking-widest"
                >
                  বাতিল
                </button>
             </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

export default WalletSMS;
