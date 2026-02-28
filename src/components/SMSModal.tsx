
import React, { useState, useEffect } from 'react';
import { X, Send, MessageSquare, Loader2, AlertCircle, CheckCircle2, ChevronDown, BookOpen } from 'lucide-react';
import { t } from '../translations';
import { Language, Student, Madrasah, SMSTemplate } from '../types';
import { supabase, smsApi } from '../supabase';

interface SMSModalProps {
  students: Student[];
  madrasah: Madrasah;
  lang: Language;
  onClose: () => void;
  onSuccess: () => void;
}

const SMSModal: React.FC<SMSModalProps> = ({ students, madrasah, lang, onClose, onSuccess }) => {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [templates, setTemplates] = useState<SMSTemplate[]>([]);
  const [showTemplateDropdown, setShowTemplateDropdown] = useState(false);

  useEffect(() => { fetchTemplates(); }, [madrasah.id]);

  const fetchTemplates = async () => {
    const { data } = await supabase.from('sms_templates').select('*').eq('madrasah_id', madrasah.id).order('created_at', { ascending: false });
    if (data) setTemplates(data);
  };

  const handleSend = async () => {
    if (!message.trim() || students.length === 0) return;
    setSending(true);
    try {
      await smsApi.sendBulk(madrasah.id, students, message);
      setStatus('success');
      setTimeout(() => { onSuccess(); onClose(); }, 1500);
    } catch (err: any) {
      setStatus('error');
      setErrorMsg(lang === 'bn' ? 'ব্যালেন্স নেই অথবা নেটওয়ার্ক সমস্যা' : 'Failed to send SMS');
    } finally { setSending(false); }
  };

  if (status === 'success') {
    return (
      <div className="fixed inset-0 bg-[#080A12]/40 backdrop-blur-2xl z-[500] flex items-start justify-center p-8 pt-32 animate-in fade-in zoom-in-95">
        <div className="bg-white rounded-[3.5rem] p-10 flex flex-col items-center text-center shadow-2xl border border-[#8D30F4]/5">
           <div className="w-20 h-20 bg-green-50 text-green-500 rounded-full flex items-center justify-center mb-6 shadow-inner"><CheckCircle2 size={40} strokeWidth={2.5} /></div>
           <h2 className="text-xl font-black text-slate-800 mb-1 font-noto">সফল হয়েছে!</h2>
           <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest">{students.length} SMS Sent</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-[#080A12]/40 backdrop-blur-2xl z-[500] flex items-start justify-center p-4 pt-16 animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-sm rounded-[3rem] shadow-2xl p-8 border border-[#8D30F4]/5 animate-in zoom-in-95 relative overflow-hidden">
        <button onClick={onClose} className="absolute top-6 right-6 text-slate-300 hover:text-slate-800 transition-all"><X size={24} /></button>
        <div className="flex items-center gap-4 mb-6">
          <div className="w-11 h-11 bg-[#8D30F4]/5 rounded-xl flex items-center justify-center text-[#8D30F4]"><MessageSquare size={22} /></div>
          <div><h2 className="text-xl font-black text-slate-800 font-noto leading-tight">এসএমএস পাঠান</h2><p className="text-[9px] font-black text-[#8D30F4]/60 uppercase tracking-widest mt-0.5">{students.length} জন ছাত্র নির্বাচিত</p></div>
        </div>
        <div className="space-y-5">
          <div className="relative"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 mb-1.5 block">টেমপ্লেট বেছে নিন</label><button onClick={() => setShowTemplateDropdown(!showTemplateDropdown)} className="w-full flex items-center justify-between px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-xl text-slate-600 text-sm font-bold shadow-sm"><div className="flex items-center gap-2"><BookOpen size={16} className="text-[#8D30F4]" /><span className="truncate">Saved Templates</span></div><ChevronDown size={18} className={`text-slate-300 transition-all ${showTemplateDropdown ? 'rotate-180' : ''}`} /></button>
            {showTemplateDropdown && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-xl border border-slate-100 z-[510] max-h-48 overflow-y-auto p-1">{templates.map(tmp => (<button key={tmp.id} onClick={() => { setMessage(tmp.body); setShowTemplateDropdown(false); }} className="w-full text-left px-4 py-3 border-b border-slate-50 last:border-0 hover:bg-slate-50 rounded-lg"><p className="text-[8px] font-black text-[#8D30F4] uppercase mb-0.5">{tmp.title}</p><p className="text-xs font-bold text-slate-500 truncate">{tmp.body}</p></button>))}</div>
            )}
          </div>
          <div className="space-y-1.5"><div className="flex justify-between items-center px-1"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">বার্তা লিখুন</label><span className="text-[10px] font-black text-[#8D30F4] uppercase tracking-widest">{message.length}/160</span></div><textarea className="w-full h-28 px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none text-slate-700 font-medium text-sm focus:border-[#8D30F4]/30 resize-none shadow-inner leading-relaxed" placeholder="মেসেজ লিখুন..." value={message} onChange={(e) => setMessage(e.target.value)} maxLength={160} /></div>
          {status === 'error' && <div className="bg-red-50 p-3 rounded-xl flex items-center gap-2 text-red-500 text-[10px] font-black border border-red-100 animate-in slide-in-from-top-2"><AlertCircle size={14} className="shrink-0" /> {errorMsg}</div>}
          <button onClick={handleSend} disabled={sending || !message.trim()} className="w-full py-4 premium-btn text-white font-black rounded-2xl shadow-lg active:scale-[0.98] transition-all flex items-center justify-center gap-3 text-sm uppercase tracking-widest">{sending ? <Loader2 className="animate-spin" size={20} /> : 'বার্তা পাঠান'}</button>
        </div>
      </div>
    </div>
  );
};

export default SMSModal;
