
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, Plus, Search, CheckCircle2, MessageSquare, X, BookOpen, ChevronDown, Check, PhoneCall, Smartphone, Loader2, ListChecks, MessageCircle, Phone, AlertCircle, AlertTriangle, Zap } from 'lucide-react';
import { supabase, offlineApi, smsApi } from '../supabase';
import { Class, Student, Language, Teacher } from '../types';
import { t } from '../translations';

interface StudentsProps {
  selectedClass: Class;
  onStudentClick: (student: Student) => void;
  onAddClick: () => void;
  onBack: () => void;
  lang: Language;
  dataVersion: number;
  triggerRefresh: () => void;
  canAdd?: boolean;
  canSendSMS?: boolean;
  teacher?: Teacher | null;
  madrasahId?: string;
  onNavigateToWallet?: () => void;
}

const PAGE_SIZE = 50;

const Students: React.FC<StudentsProps> = ({ selectedClass, onStudentClick, onAddClick, onBack, lang, dataVersion, triggerRefresh, canAdd, canSendSMS, teacher, madrasahId, onNavigateToWallet }) => {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<any | null>(null);
  const [showTemplateMenu, setShowTemplateMenu] = useState(false);
  const [sending, setSending] = useState(false);
  
  const [statusModal, setStatusModal] = useState<{show: boolean, type: 'success' | 'error' | 'balance', title: string, message: string}>({
    show: false, type: 'success', title: '', message: ''
  });

  // Fetch Templates (Cached)
  const fetchTemplates = useCallback(async () => {
    if (!madrasahId) return;
    const { data } = await supabase.from('sms_templates').select('id, title, body').eq('madrasah_id', madrasahId);
    if (data) setTemplates(data);
  }, [madrasahId]);

  // Paginated Fetching
  const fetchStudents = useCallback(async (reset = false) => {
    if (!madrasahId) return;
    if (reset) { setLoading(true); setPage(0); } else { setLoadingMore(true); }

    const currentPage = reset ? 0 : page;
    const from = currentPage * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    try {
      // Fix: Add madrasah_id to the select query to satisfy the Student type requirements.
      let query = supabase
        .from('students')
        .select('id, madrasah_id, student_name, guardian_phone, roll, guardian_name, class_id, classes(class_name)')
        .eq('madrasah_id', madrasahId)
        .eq('class_id', selectedClass.id)
        .order('roll', { ascending: true })
        .range(from, to);

      if (searchQuery.trim()) {
        query = query.ilike('student_name', `%${searchQuery}%`);
      }

      const { data, error } = await query;
      if (error) throw error;

      if (data) {
        const formattedData = (data as any[]).map(s => ({
          ...s,
          classes: Array.isArray(s.classes) ? s.classes[0] : s.classes
        })) as Student[];
        
        setStudents(prev => reset ? formattedData : [...prev, ...formattedData]);
        setHasMore(data.length === PAGE_SIZE);
        if (!reset) setPage(currentPage + 1);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [madrasahId, selectedClass.id, page, searchQuery]);

  useEffect(() => {
    const timer = setTimeout(() => fetchStudents(true), 400); // Optimized debounced search
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    fetchTemplates();
  }, [madrasahId, fetchTemplates]);

  const toggleSelectAll = () => {
    if (selectedIds.size === students.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(students.map(s => s.id)));
    }
  };

  const handlePremiumSMS = async () => {
    if (!selectedTemplate || selectedIds.size === 0 || !madrasahId) return;
    setSending(true);
    try {
      const selectedStudents = students.filter(s => selectedIds.has(s.id));
      await smsApi.sendBulk(madrasahId, selectedStudents, selectedTemplate.body);
      setStatusModal({ show: true, type: 'success', title: 'সাফল্য', message: t('sms_success', lang) });
      setIsSelectionMode(false);
      setSelectedIds(new Set());
    } catch (err: any) {
      const isBal = err.message.toLowerCase().includes('balance');
      setStatusModal({ show: true, type: isBal ? 'balance' : 'error', title: isBal ? 'ব্যালেন্স শেষ!' : 'ব্যর্থ', message: err.message });
    } finally { setSending(false); }
  };

  const canSendSystemSMS = !teacher || teacher.permissions?.can_send_sms;
  const canSendFreeSMS = !teacher || teacher.permissions?.can_send_free_sms;

  return (
    <div className="space-y-4 animate-in slide-in-from-right-4 duration-300 pb-10">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={onBack} className="w-10 h-10 bg-blue-50 rounded-2xl text-[#2563EB] border border-blue-100 shadow-sm flex items-center justify-center active:scale-95"><ArrowLeft size={22} strokeWidth={3} /></button>
            <div className="min-w-0">
              <h1 className="text-[17px] font-black text-[#1E293B] truncate font-noto leading-tight">{selectedClass.class_name}</h1>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{students.length} Loaded</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {isSelectionMode && (
              <button onClick={toggleSelectAll} className="h-10 px-3.5 rounded-2xl bg-blue-50 text-[#2563EB] border border-blue-100 font-black text-[10px] uppercase shadow-sm active:scale-95">
                {selectedIds.size === students.length ? t('clear', lang) : t('all', lang)}
              </button>
            )}
            <button onClick={() => { setIsSelectionMode(!isSelectionMode); setSelectedIds(new Set()); }} className={`w-10 h-10 rounded-2xl border flex items-center justify-center transition-all active:scale-95 ${isSelectionMode ? 'bg-[#2563EB] text-white border-blue-200 shadow-premium' : 'bg-blue-50 text-[#2563EB] border-blue-100 shadow-sm'}`}>
              {isSelectionMode ? <X size={18} /> : <CheckCircle2 size={18} />}
            </button>
            {!isSelectionMode && canAdd && (
              <button onClick={onAddClick} className="bg-[#2563EB] text-white px-4 py-2.5 rounded-2xl text-[11px] font-black shadow-premium active:scale-95 transition-all flex items-center gap-2"><Plus size={14} /> {t('add_student', lang)}</button>
            )}
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-[#2563EB]" size={18} />
          <input type="text" placeholder={t('search_placeholder', lang)}
            className="w-full pl-12 pr-6 py-3.5 bg-white rounded-[1.2rem] outline-none text-[#1E293B] font-black text-sm shadow-bubble border border-slate-100"
            value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2">
        {students.map(student => (
          <div key={student.id} onClick={() => isSelectionMode ? (setSelectedIds(prev => { const n = new Set(prev); if(n.has(student.id)) n.delete(student.id); else n.add(student.id); return n; })) : onStudentClick(student)}
            className={`p-3 rounded-[1.2rem] border transition-all flex items-center justify-between shadow-bubble ${isSelectionMode && selectedIds.has(student.id) ? 'bg-white border-[#2563EB] scale-[1.01]' : 'bg-white border-slate-100'}`}>
            <div className="flex items-center gap-3.5 flex-1 min-w-0">
              {isSelectionMode ? (
                <div className={`w-11 h-11 rounded-2xl flex items-center justify-center border-2 shrink-0 ${selectedIds.has(student.id) ? 'bg-[#2563EB] text-white border-[#2563EB]' : 'bg-slate-50 border-slate-100 text-slate-200'}`}><CheckCircle2 size={22} fill={selectedIds.has(student.id) ? "white" : "none"} /></div>
              ) : (
                <div className="w-11 h-11 rounded-2xl flex flex-col items-center justify-center bg-blue-50 text-[#2563EB] shrink-0 border border-blue-100 shadow-inner">
                  <span className="text-[7px] font-black opacity-40 leading-none">ROLL</span>
                  <span className="text-base font-black leading-none mt-1">{student.roll || '-'}</span>
                </div>
              )}
              <div className="min-w-0 flex-1">
                <h3 className="font-black text-[#1E3A8A] text-[16px] font-noto truncate leading-tight">{student.student_name}</h3>
                <p className="text-[9px] font-black text-[#2563EB]/60 uppercase mt-0.5">{student.guardian_name || '-'}</p>
              </div>
            </div>
            {!isSelectionMode && (
              <div className="flex items-center gap-4 shrink-0 ml-2">
                <button onClick={(e) => { e.stopPropagation(); window.location.href = `tel:${student.guardian_phone}`; }} className="w-10 h-10 bg-blue-50 text-[#2563EB] rounded-xl flex items-center justify-center border border-blue-100 shadow-sm active:scale-90 transition-all"><Phone size={18} fill="currentColor" /></button>
                <button onClick={(e) => { e.stopPropagation(); window.location.href = `https://wa.me/88${student.guardian_phone.replace(/\D/g, '')}`; }} className="w-10 h-10 bg-emerald-500 text-white rounded-xl flex items-center justify-center shadow-lg active:scale-90 transition-all"><PhoneCall size={18} fill="currentColor" /></button>
              </div>
            )}
          </div>
        ))}
        
        {loading && <div className="flex justify-center py-10"><Loader2 className="animate-spin text-[#2563EB]" /></div>}
        
        {!loading && hasMore && (
           <button onClick={() => fetchStudents()} disabled={loadingMore} className="w-full py-4 mt-2 bg-blue-50 rounded-2xl text-[#2563EB] font-black text-[10px] uppercase tracking-widest border border-blue-100 shadow-sm active:scale-95 transition-all">
              {loadingMore ? <Loader2 className="animate-spin mx-auto" size={16} /> : 'আরও লোড করুন (Load More)'}
           </button>
        )}
      </div>

      {isSelectionMode && selectedIds.size > 0 && (
        <div className="fixed bottom-[calc(env(safe-area-inset-bottom,0px)+95px)] left-1/2 -translate-x-1/2 w-[94%] max-w-md z-[150] animate-in slide-in-from-bottom-10">
          <div className="bg-white/95 backdrop-blur-xl rounded-[2.5rem] p-5 shadow-2xl border border-[#8D30F4]/20 flex flex-col gap-4">
            <button onClick={() => setShowTemplateMenu(!showTemplateMenu)} className="w-full h-[60px] flex items-center justify-between px-6 rounded-2xl border-2 bg-slate-50 border-slate-100 text-[#2E0B5E] font-black">
              <div className="flex items-center gap-3 truncate"><BookOpen size={20} className="text-[#8D30F4]" /><span className="truncate font-noto">{selectedTemplate ? selectedTemplate.title : t('template_title', lang)}</span></div>
              <ChevronDown size={20} className={showTemplateMenu ? 'rotate-180' : ''} />
            </button>
            {showTemplateMenu && (
              <div className="absolute bottom-[calc(100%-40px)] left-0 right-0 mb-3 bg-white rounded-2xl shadow-2xl border border-slate-100 max-h-60 overflow-y-auto p-1">
                {templates.map(tmp => (
                  <button key={tmp.id} onClick={() => { setSelectedTemplate(tmp); setShowTemplateMenu(false); }} className={`w-full text-left px-5 py-3.5 rounded-xl flex items-center justify-between ${selectedTemplate?.id === tmp.id ? 'bg-[#8D30F4] text-white shadow-xl' : 'hover:bg-slate-50'}`}>
                    <span className="text-xs font-black truncate font-noto">{tmp.title}</span>
                    {selectedTemplate?.id === tmp.id && <Check size={18} strokeWidth={4} />}
                  </button>
                ))}
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              {canSendSystemSMS && <button onClick={handlePremiumSMS} disabled={sending || !selectedTemplate} className="h-12 bg-[#8D30F4] text-white rounded-full font-black text-[10px] uppercase shadow-lg flex items-center justify-center gap-2">{sending ? <Loader2 size={16} /> : <MessageSquare size={16} fill="currentColor" />} {t('system_sms', lang)}</button>}
              {canSendFreeSMS && <button onClick={() => { if(!selectedTemplate) return; const phones = students.filter(s => selectedIds.has(s.id)).map(s => s.guardian_phone).join(','); window.location.href = `sms:${phones}?body=${encodeURIComponent(selectedTemplate.body)}`; }} disabled={!selectedTemplate} className="h-12 bg-[#1A0B2E] text-white rounded-full font-black text-[10px] uppercase shadow-lg flex items-center justify-center gap-2"><Smartphone size={16} fill="currentColor" /> {t('native_sms', lang)}</button>}
            </div>
            <p className="text-[10px] font-black text-[#8D30F4] uppercase tracking-widest text-center">{selectedIds.size} {t('selected', lang)}</p>
          </div>
        </div>
      )}

      {statusModal.show && createPortal(
        <div className="modal-overlay bg-[#080A12]/40 backdrop-blur-2xl">
          <div className="bg-white w-full max-w-sm rounded-[3.5rem] p-10 text-center shadow-2xl border border-slate-50 animate-in zoom-in-95">
             <div className={`w-24 h-24 rounded-full flex items-center justify-center mx-auto border-4 mb-8 ${statusModal.type === 'success' ? 'bg-green-50 text-green-500 border-green-100' : statusModal.type === 'balance' ? 'bg-orange-50 text-orange-500 border-orange-100' : 'bg-red-50 text-red-500 border-red-100'}`}>
                {statusModal.type === 'success' ? <CheckCircle2 size={54} /> : statusModal.type === 'balance' ? <Zap size={54} /> : <AlertCircle size={54} />}
             </div>
             <h3 className="text-2xl font-black text-[#2E0B5E] font-noto">{statusModal.title}</h3>
             <p className="text-[13px] font-bold text-slate-500 mt-3 font-noto px-2">{statusModal.message}</p>
             <button onClick={() => setStatusModal({ ...statusModal, show: false })} className="w-full py-5 premium-btn text-white font-black rounded-full shadow-xl mt-10 text-sm uppercase">Continue</button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default Students;
