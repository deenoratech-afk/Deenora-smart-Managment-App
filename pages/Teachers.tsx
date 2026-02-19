
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, UserPlus, ShieldCheck, User as UserIcon, Loader2, Save, X, Phone, Key, CheckCircle2, Trash2, Edit3, Smartphone, MessageSquare, Layers, MessageCircle, Shield, Check, ChevronRight, AlertTriangle, AlertCircle } from 'lucide-react';
import { supabase } from '../supabase';
import { Teacher, Language, Madrasah } from '../types';
import { t } from '../translations';

interface TeachersProps {
  lang: Language;
  madrasah: Madrasah | null;
  onBack: () => void;
}

const Teachers: React.FC<TeachersProps> = ({ lang, madrasah, onBack }) => {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<Teacher | null>(null);
  const [warningModal, setWarningModal] = useState<{show: boolean, message: string}>({ show: false, message: '' });
  
  // Form States
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [perms, setPerms] = useState({
    can_manage_students: true,
    can_manage_classes: false,
    can_send_sms: false,
    can_send_free_sms: false
  });

  useEffect(() => {
    fetchTeachers();
  }, [madrasah?.id]);

  const fetchTeachers = async () => {
    if (!madrasah) return;
    try {
      const { data } = await supabase.from('teachers').select('*').eq('madrasah_id', madrasah.id).order('created_at', { ascending: false });
      if (data) setTeachers(data);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const handleSave = async () => {
    if (!madrasah || !name || !phone || !code) return;
    setSaving(true);
    try {
      // Clean inputs
      const cleanPhone = phone.replace(/\D/g, '');
      const cleanCode = code.trim();

      // Check for duplicates in the current madrasah
      let query = supabase
        .from('teachers')
        .select('id, phone, login_code')
        .eq('madrasah_id', madrasah.id)
        .or(`phone.eq.${cleanPhone},login_code.eq.${cleanCode}`);
      
      if (editId) {
        query = query.neq('id', editId);
      }

      const { data: duplicates, error: checkError } = await query;
      
      if (checkError) throw checkError;

      if (duplicates && duplicates.length > 0) {
        const hasPhoneMatch = duplicates.some(d => d.phone === cleanPhone);
        const hasCodeMatch = duplicates.some(d => d.login_code === cleanCode);

        if (hasPhoneMatch) {
          setWarningModal({ show: true, message: t('duplicate_teacher_phone', lang) });
          setSaving(false);
          return;
        }
        if (hasCodeMatch) {
          setWarningModal({ show: true, message: t('duplicate_teacher_pin', lang) });
          setSaving(false);
          return;
        }
      }

      const payload = {
        madrasah_id: madrasah.id,
        name: name.trim(),
        phone: cleanPhone,
        login_code: cleanCode,
        permissions: perms
      };

      if (editId) {
        const { error } = await supabase.from('teachers').update(payload).eq('id', editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('teachers').insert(payload);
        if (error) throw error;
      }
      
      setIsModalOpen(false);
      resetForm();
      fetchTeachers();
    } catch (e: any) { 
      setWarningModal({ show: true, message: e.message });
    } finally { 
      setSaving(false); 
    }
  };

  const resetForm = () => {
    setEditId(null);
    setName('');
    setPhone('');
    setCode('');
    setPerms({ can_manage_students: true, can_manage_classes: false, can_send_sms: false, can_send_free_sms: false });
  };

  const handleDeleteTeacher = async () => {
    if (!showDeleteConfirm) return;
    setIsDeleting(true);
    try {
      const { error } = await supabase.from('teachers').delete().eq('id', showDeleteConfirm.id);
      if (error) throw error;
      setShowDeleteConfirm(null);
      fetchTeachers();
    } catch (e: any) { 
      setWarningModal({ show: true, message: e.message });
    } finally { 
      setIsDeleting(false); 
    }
  };

  const PermissionToggle = ({ 
    active, 
    onClick, 
    icon: Icon, 
    label, 
    color 
  }: { 
    active: boolean, 
    onClick: () => void, 
    icon: any, 
    label: string, 
    color: string 
  }) => (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex items-center justify-between p-3.5 rounded-2xl border-2 transition-all duration-300 active:scale-95 ${
        active 
          ? `bg-white border-${color}-400 shadow-[0_8px_20px_-6px_rgba(0,0,0,0.1)]` 
          : 'bg-slate-50 border-transparent grayscale'
      }`}
    >
      <div className="flex items-center gap-3">
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${active ? `bg-${color}-50 text-${color}-500` : 'bg-slate-200 text-slate-400'}`}>
          <Icon size={16} />
        </div>
        <span className={`text-[11px] font-black uppercase tracking-wider ${active ? 'text-slate-800' : 'text-slate-400'}`}>
          {label}
        </span>
      </div>
      <div className={`w-5 h-5 rounded-full flex items-center justify-center transition-all ${active ? `bg-${color}-500 text-white` : 'bg-slate-200'}`}>
        {active && <Check size={12} strokeWidth={4} />}
      </div>
    </button>
  );

  return (
    <>
      <div className="space-y-6 animate-in slide-in-from-right-4 duration-500 pb-24">
        <div className="flex items-center gap-4 px-2">
          <button onClick={onBack} className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center text-white active:scale-90 transition-all border border-white/20 shadow-xl">
            <ArrowLeft size={24} strokeWidth={3} />
          </button>
          <h1 className="text-2xl font-black text-white font-noto drop-shadow-md">Manage Teachers</h1>
        </div>

        <button onClick={() => { resetForm(); setIsModalOpen(true); }} className="w-full py-6 bg-white rounded-[2.5rem] text-[#8D30F4] font-black flex items-center justify-center gap-3 shadow-[0_20px_50px_rgba(46,11,94,0.3)] active:scale-95 transition-all">
          <UserPlus size={24} strokeWidth={3} /> Add New Teacher
        </button>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="animate-spin text-white" size={40} /></div>
        ) : (
          <div className="space-y-3.5 px-1">
            {teachers.map(t => (
              <div key={t.id} className="bg-white/95 backdrop-blur-md p-4 sm:p-6 rounded-[2.5rem] border border-white/50 shadow-xl relative overflow-hidden group">
                 <div className="flex items-start sm:items-center justify-between mb-4 gap-2">
                    <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                       <div className="w-12 h-12 sm:w-16 sm:h-16 bg-[#F2EBFF] text-[#8D30F4] rounded-[1.2rem] sm:rounded-[1.5rem] flex items-center justify-center border border-[#8D30F4]/10 shadow-inner shrink-0">
                          <UserIcon size={24} className="sm:size-[30px]" />
                       </div>
                       <div className="min-w-0 flex-1 pr-1">
                          <h3 className="text-[15px] sm:text-[17px] font-black text-[#2E0B5E] font-noto line-clamp-1 leading-tight">{t.name}</h3>
                          <p className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1 truncate">Ph: {t.phone}</p>
                       </div>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                       <button onClick={() => { setEditId(t.id); setName(t.name); setPhone(t.phone); setCode(t.login_code); setPerms(t.permissions); setIsModalOpen(true); }} className="w-9 h-9 sm:w-10 sm:h-10 bg-[#F2EBFF] text-[#8D30F4] rounded-xl flex items-center justify-center shadow-sm active:scale-90 transition-all border border-[#8D30F4]/5"><Edit3 size={16} /></button>
                       <button onClick={() => setShowDeleteConfirm(t)} className="w-9 h-9 sm:w-10 sm:h-10 bg-red-50 text-red-500 rounded-xl flex items-center justify-center shadow-sm active:scale-90 transition-all border border-red-100/50"><Trash2 size={16} /></button>
                    </div>
                 </div>

                 <div className="flex flex-wrap gap-2 pt-4 border-t border-slate-50">
                    <div className={`px-3 sm:px-3.5 py-1.5 rounded-full text-[8px] sm:text-[9px] font-black uppercase tracking-widest flex items-center gap-1 sm:gap-1.5 ${t.permissions?.can_manage_students ? 'bg-green-50 text-green-600' : 'bg-slate-50 text-slate-300'}`}>
                      <Smartphone size={10} strokeWidth={3} /> Students
                    </div>
                    <div className={`px-3 sm:px-3.5 py-1.5 rounded-full text-[8px] sm:text-[9px] font-black uppercase tracking-widest flex items-center gap-1 sm:gap-1.5 ${t.permissions?.can_manage_classes ? 'bg-blue-50 text-blue-600' : 'bg-slate-50 text-slate-300'}`}>
                      <Layers size={10} strokeWidth={3} /> Classes
                    </div>
                    <div className={`px-3 sm:px-3.5 py-1.5 rounded-full text-[8px] sm:text-[9px] font-black uppercase tracking-widest flex items-center gap-1 sm:gap-1.5 ${t.permissions?.can_send_sms ? 'bg-orange-50 text-orange-600' : 'bg-slate-50 text-slate-300'}`}>
                      <MessageSquare size={10} strokeWidth={3} /> System SMS
                    </div>
                    <div className={`px-3 sm:px-3.5 py-1.5 rounded-full text-[8px] sm:text-[9px] font-black uppercase tracking-widest flex items-center gap-1 sm:gap-1.5 ${t.permissions?.can_send_free_sms ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-50 text-slate-300'}`}>
                      <MessageCircle size={10} strokeWidth={3} /> Free SMS
                    </div>
                 </div>
              </div>
            ))}
            {teachers.length === 0 && (
              <div className="text-center py-24 bg-white/10 rounded-[3rem] border-2 border-dashed border-white/30 backdrop-blur-sm">
                 <UserIcon size={40} className="mx-auto text-white/20 mb-4" />
                 <p className="text-white/60 font-black text-xs uppercase tracking-[0.2em]">No Teachers Added Yet</p>
              </div>
            )}
          </div>
        )}
      </div>

      {isModalOpen && createPortal(
        <div className="modal-overlay bg-[#080A12]/60 backdrop-blur-xl animate-in fade-in duration-300">
           <div className="bg-white w-full max-w-sm rounded-[3rem] shadow-2xl relative animate-in zoom-in-95 duration-500 border border-[#8D30F4]/5 flex flex-col overflow-hidden max-h-[90vh]">
              
              <div className="flex items-center justify-between p-8 pb-4 shrink-0">
                 <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-[#8D30F4]/10 rounded-2xl flex items-center justify-center text-[#8D30F4] border border-[#8D30F4]/10">
                       <Shield size={24} />
                    </div>
                    <div>
                       <h2 className="text-xl font-black text-[#2E0B5E] font-noto tracking-tight">
                         {editId ? 'Edit Teacher' : 'Add Teacher'}
                       </h2>
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Access Credentials</p>
                    </div>
                 </div>
                 <button onClick={() => setIsModalOpen(false)} className="text-slate-300 hover:text-[#8D30F4] transition-all p-1">
                    <X size={24} strokeWidth={3}/>
                 </button>
              </div>
              
              <div className="px-8 pb-8 space-y-5 overflow-y-auto custom-scrollbar flex-1">
                 <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Name</label>
                    <input 
                      type="text" 
                      className="w-full h-12 bg-slate-50 rounded-xl px-4 font-black text-[#2E0B5E] outline-none border-2 border-transparent focus:border-[#8D30F4]/20 transition-all text-sm" 
                      value={name} 
                      onChange={(e) => setName(e.target.value)} 
                      placeholder="e.g. Abdur Rahman" 
                    />
                 </div>
                 
                 <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                       <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Phone</label>
                       <input 
                         type="tel" 
                         className="w-full h-12 bg-slate-50 rounded-xl px-4 font-black text-[#2E0B5E] outline-none border-2 border-transparent focus:border-[#8D30F4]/20 transition-all text-sm" 
                         value={phone} 
                         onChange={(e) => setPhone(e.target.value)} 
                         placeholder="017..." 
                       />
                    </div>
                    <div className="space-y-1.5">
                       <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">PIN</label>
                       <input 
                         type="text" 
                         className="w-full h-12 bg-slate-50 rounded-xl px-4 font-black text-[#8D30F4] outline-none border-2 border-transparent focus:border-[#8D30F4]/20 transition-all text-sm" 
                         value={code} 
                         onChange={(e) => setCode(e.target.value)} 
                         placeholder="1234" 
                       />
                    </div>
                 </div>

                 <div className="pt-2 space-y-3">
                    <div className="flex items-center justify-between px-1">
                       <p className="text-[10px] font-black text-[#8D30F4] uppercase tracking-widest">Permissions</p>
                    </div>
                    <div className="grid grid-cols-1 gap-2">
                       <PermissionToggle 
                         active={perms.can_manage_students} 
                         onClick={() => setPerms({...perms, can_manage_students: !perms.can_manage_students})} 
                         icon={Smartphone} 
                         label="Students" 
                         color="green" 
                       />
                       <PermissionToggle 
                         active={perms.can_manage_classes} 
                         onClick={() => setPerms({...perms, can_manage_classes: !perms.can_manage_classes})} 
                         icon={Layers} 
                         label="Classes" 
                         color="blue" 
                       />
                       <PermissionToggle 
                         active={perms.can_send_sms} 
                         onClick={() => setPerms({...perms, can_send_sms: !perms.can_send_sms})} 
                         icon={MessageSquare} 
                         label="System SMS" 
                         color="orange" 
                       />
                       <PermissionToggle 
                         active={perms.can_send_free_sms} 
                         onClick={() => setPerms({...perms, can_send_free_sms: !perms.can_send_free_sms})} 
                         icon={MessageCircle} 
                         label="Free SMS" 
                         color="indigo" 
                       />
                    </div>
                 </div>

                 <div className="pt-2">
                    <button 
                      onClick={handleSave} 
                      disabled={saving || !name || !phone || !code} 
                      className="w-full h-14 premium-btn text-white font-black rounded-2xl shadow-xl flex items-center justify-center gap-3 active:scale-95 transition-all text-sm font-noto disabled:opacity-30"
                    >
                       {saving ? <Loader2 className="animate-spin" size={20} /> : (
                          <>
                            <Save size={18} />
                            <span>{editId ? 'Update Profile' : 'Save Teacher'}</span>
                          </>
                       )}
                    </button>
                    <div className="h-10"></div>
                 </div>
              </div>
           </div>
        </div>,
        document.body
      )}

      {warningModal.show && createPortal(
        <div className="modal-overlay bg-[#080A12]/40 backdrop-blur-2xl animate-in fade-in duration-300">
           <div className="bg-white w-full max-w-sm rounded-[3.5rem] p-10 shadow-[0_40px_100px_rgba(239,68,68,0.2)] border border-red-50 text-center space-y-6 animate-in zoom-in-95 duration-500">
              <div className="relative">
                 <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto border border-red-100 relative z-10">
                    <AlertTriangle size={40} />
                 </div>
                 <div className="absolute inset-0 bg-red-500/10 rounded-full animate-ping opacity-30"></div>
              </div>
              <div>
                 <h3 className="text-xl font-black text-[#2E0B5E] font-noto tracking-tight">সতর্কবাণী</h3>
                 <p className="text-[13px] font-bold text-slate-500 mt-2 font-noto leading-relaxed">
                   {warningModal.message}
                 </p>
              </div>
              <button 
                onClick={() => setWarningModal({ show: false, message: '' })} 
                className="w-full py-4 bg-[#2E0B5E] text-white font-black rounded-full shadow-xl shadow-slate-200 active:scale-95 transition-all text-xs uppercase tracking-widest"
              >
                ঠিক আছে
              </button>
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
                <h3 className="text-xl font-black text-slate-800 font-noto">শিক্ষক প্রোফাইল মুছুন</h3>
                <p className="text-[11px] font-bold text-slate-400 mt-2 uppercase tracking-wider px-4 leading-relaxed">
                  আপনি কি নিশ্চিতভাবে <span className="text-red-500">"{showDeleteConfirm.name}"</span> এর প্রোফাইল এবং অ্যাক্সেস মুছে ফেলতে চান? এটি আর ফিরিয়ে আনা যাবে না।
                </p>
             </div>
             <div className="flex flex-col gap-3 pt-2">
                <button 
                  onClick={handleDeleteTeacher} 
                  disabled={isDeleting} 
                  className="w-full py-5 bg-red-500 text-white font-black rounded-full shadow-xl shadow-red-100 active:scale-95 transition-all flex items-center justify-center text-md gap-3"
                >
                  {isDeleting ? <Loader2 className="animate-spin" size={22} /> : (
                    <><Trash2 size={20} /> নিশ্চিত ডিলিট</>
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

export default Teachers;
