
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, Save, User as UserIcon, Phone, List, Hash, Loader2, ChevronDown, Camera, X, Check, UserCheck, AlertCircle, BookOpen } from 'lucide-react';
import { supabase, offlineApi } from '../supabase';
import { Student, Class, Language, Madrasah } from '../types';
import { t } from '../translations';
import { sortMadrasahClasses } from './Classes';

interface StudentFormProps {
  student?: Student | null;
  madrasah: Madrasah | null;
  defaultClassId?: string;
  isEditing: boolean;
  onSuccess: () => void;
  onCancel: () => void;
  lang: Language;
}

const StudentForm: React.FC<StudentFormProps> = ({ student, madrasah, defaultClassId, isEditing, onSuccess, onCancel, lang }) => {
  const [name, setName] = useState(student?.student_name || '');
  const [guardianName, setGuardianName] = useState(student?.guardian_name || '');
  const [roll, setRoll] = useState(student?.roll?.toString() || '');
  const [phone, setPhone] = useState(student?.guardian_phone || '');
  const [phone2, setPhone2] = useState(student?.guardian_phone_2 || '');
  const [classId, setClassId] = useState(student?.class_id || defaultClassId || '');
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(false);
  const [showClassModal, setShowClassModal] = useState(false);
  
  const [errorModal, setErrorModal] = useState<{show: boolean, message: string}>({show: false, message: ''});

  useEffect(() => {
    fetchClasses();
  }, []);

  const fetchClasses = async () => {
    const cached = offlineApi.getCache('classes');
    if (cached) setClasses(sortMadrasahClasses(cached));

    if (navigator.onLine && madrasah) {
      const { data } = await supabase.from('classes').select('*').eq('madrasah_id', madrasah.id);
      if (data) {
        const sorted = sortMadrasahClasses(data);
        setClasses(sorted);
        offlineApi.setCache('classes', sorted);
      }
    }
  };

  const getSelectedClassName = () => {
    const cls = classes.find(c => c.id === classId);
    return cls ? cls.class_name : t('class_choose', lang);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim() || !classId || !madrasah) {
      setErrorModal({ show: true, message: lang === 'bn' ? 'সব তথ্য পূরণ করুন' : 'Fill required fields' });
      return;
    }

    if (phone.length < 10 || phone.length > 15) {
      setErrorModal({ 
        show: true, 
        message: t('invalid_phone', lang)
      });
      return;
    }

    setLoading(true);
    try {
      const payload = {
        student_name: name.trim(),
        guardian_name: guardianName.trim(),
        roll: roll ? parseInt(roll) : null,
        guardian_phone: phone.trim(),
        guardian_phone_2: phone2.trim() || null,
        class_id: classId,
        madrasah_id: madrasah.id
      };

      if (navigator.onLine) {
        if (isEditing && student) {
          const { error } = await supabase.from('students').update(payload).eq('id', student.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from('students').insert(payload);
          if (error) throw error;
        }
      } else {
        offlineApi.queueAction('students', isEditing ? 'UPDATE' : 'INSERT', isEditing ? { ...payload, id: student?.id } : payload);
      }
      onSuccess();
    } catch (err: any) { 
      let msg = err.message;
      if (err.code === '23505') {
        msg = t('duplicate_roll', lang);
      }
      setErrorModal({ show: true, message: msg });
    } finally { setLoading(false); }
  };

  const handlePhoneChange = (val: string, setter: (v: string) => void) => {
    const numericValue = val.replace(/\D/g, '').slice(0, 15);
    setter(numericValue);
  };

  return (
    <div className="animate-in slide-in-from-bottom-6 duration-500 pb-24 space-y-8">
      <div className="flex items-center gap-5 px-1">
        <button onClick={onCancel} className="w-11 h-11 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center text-white active:scale-95 transition-all border border-white/20 shadow-xl shrink-0">
          <ArrowLeft size={24} strokeWidth={3} />
        </button>
        <h1 className="text-xl font-black text-white font-noto drop-shadow-md truncate">
          {isEditing ? t('edit_student', lang) : t('add_student', lang)}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="bg-white/95 backdrop-blur-xl p-8 rounded-[3rem] border-2 border-[#8D30F4]/5 shadow-2xl space-y-8">
          <div className="space-y-6">
             <div className="space-y-2">
               <label className="flex items-center gap-2 text-[10px] font-black text-[#4B168A] uppercase tracking-widest px-2"><UserIcon size={14} className="text-[#8D30F4]" /> {t('student_name', lang)}</label>
               <input type="text" required className="w-full h-[64px] px-6 bg-slate-50 border-2 border-slate-100 rounded-[1.5rem] outline-none text-[#2D3142] font-black text-lg focus:border-[#8D30F4]/30 focus:bg-white transition-all shadow-inner" value={name} onChange={(e) => setName(e.target.value)} />
             </div>

             <div className="space-y-2">
               <label className="flex items-center gap-2 text-[10px] font-black text-[#4B168A] uppercase tracking-widest px-2"><UserCheck size={14} className="text-[#8D30F4]" /> {t('guardian_name', lang)}</label>
               <input type="text" className="w-full h-[64px] px-6 bg-slate-50 border-2 border-slate-100 rounded-[1.5rem] outline-none text-[#2D3142] font-black text-lg focus:border-[#8D30F4]/30 focus:bg-white transition-all shadow-inner" value={guardianName} onChange={(e) => setGuardianName(e.target.value)} />
             </div>
             
             <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-[10px] font-black text-[#4B168A] uppercase tracking-widest px-2"><Hash size={14} className="text-[#8D30F4]" /> {t('roll', lang)}</label>
                  <input 
                    type="number" 
                    className="w-full h-[64px] px-6 bg-slate-50 border-2 border-slate-100 rounded-[1.5rem] text-[#2D3142] font-black text-xl outline-none text-center focus:border-[#8D30F4]/30 focus:bg-white transition-all shadow-inner" 
                    value={roll} 
                    onChange={(e) => setRoll(e.target.value)} 
                  />
                </div>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-[10px] font-black text-[#4B168A] uppercase tracking-widest px-2"><List size={14} className="text-[#8D30F4]" /> {t('classes', lang)}</label>
                  <div 
                    onClick={() => setShowClassModal(true)} 
                    className="w-full h-[64px] px-5 bg-slate-50 border-2 border-slate-100 rounded-[1.5rem] flex items-center justify-between cursor-pointer active:scale-[0.98] transition-all shadow-inner"
                  >
                    <span className="font-black text-[#2D3142] truncate text-base leading-none font-noto">{getSelectedClassName()}</span>
                    <ChevronDown size={18} className="text-[#8D30F4] shrink-0" />
                  </div>
                </div>
             </div>

             <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-[10px] font-black text-[#4B168A] uppercase tracking-widest px-2"><Phone size={14} className="text-[#8D30F4]" /> {t('phone_primary_wa', lang)}</label>
                  <input type="tel" required className="w-full h-[64px] px-5 bg-slate-50 border-2 border-slate-100 rounded-[1.5rem] text-[#2D3142] font-black text-sm outline-none focus:border-[#8D30F4]/30 focus:bg-white transition-all shadow-inner" value={phone} onChange={(e) => handlePhoneChange(e.target.value, setPhone)} placeholder="Max 15 digits" />
                </div>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-[10px] font-black text-[#4B168A] uppercase tracking-widest px-2"><Phone size={14} className="text-[#8D30F4]" /> {t('phone_secondary_15', lang)}</label>
                  <input type="tel" className="w-full h-[64px] px-5 bg-slate-50 border-2 border-slate-100 rounded-[1.5rem] text-[#2D3142] font-black text-sm outline-none focus:border-[#8D30F4]/30 focus:bg-white transition-all shadow-inner" value={phone2} onChange={(e) => handlePhoneChange(e.target.value, setPhone2)} placeholder="Max 15 digits" />
                </div>
             </div>
          </div>
        </div>

        <button type="submit" disabled={loading} className="w-full h-[72px] premium-btn text-white font-black rounded-[2.2rem] shadow-[0_20px_50px_-10px_rgba(141,48,244,0.5)] active:scale-95 transition-all flex items-center justify-center gap-4 text-[17px] font-noto border border-white/20 uppercase tracking-[0.15em] relative overflow-hidden group">
          {loading ? <Loader2 className="animate-spin" size={28} /> : (
            <>
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center shadow-inner group-active:scale-90 transition-transform">
                <Save size={24} strokeWidth={2.5} />
              </div>
              <span className="drop-shadow-md">{t('save', lang)}</span>
            </>
          )}
        </button>
      </form>

      {showClassModal && createPortal(
        <div className="modal-overlay bg-[#080A12]/40 backdrop-blur-2xl animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-sm rounded-[3.5rem] p-10 shadow-[0_40px_100px_rgba(141,48,244,0.2)] border border-[#8D30F4]/5 relative animate-in zoom-in-95 duration-300">
            <button onClick={() => setShowClassModal(false)} className="absolute top-10 right-10 text-slate-300 hover:text-[#8D30F4] transition-all"><X size={26} strokeWidth={3} /></button>
            
            <div className="flex items-center gap-5 mb-8">
               <div className="w-16 h-16 bg-[#8D30F4]/10 rounded-[1.8rem] flex items-center justify-center text-[#8D30F4] shrink-0 border border-[#8D30F4]/10 shadow-inner">
                  <BookOpen size={32} />
               </div>
               <div>
                  <h2 className="text-xl font-black text-[#2E0B5E] font-noto tracking-tight">{t('select_class', lang)}</h2>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Select a class</p>
               </div>
            </div>

            <div className="space-y-3 max-h-72 overflow-y-auto pr-2 custom-scrollbar">
               {classes.map(cls => (
                 <button key={cls.id} onClick={() => { setClassId(cls.id); setShowClassModal(false); }} className={`w-full p-5 rounded-[1.8rem] font-black transition-all flex items-center justify-between border-2 ${classId === cls.id ? 'bg-[#8D30F4] border-[#8D30F4] text-white shadow-xl' : 'bg-slate-50 border-slate-100 text-[#2E0B5E]'}`}>
                    <span className="font-noto text-[16px]">{cls.class_name}</span>
                    {classId === cls.id && <Check size={20} strokeWidth={4} />}
                 </button>
               ))}
            </div>
          </div>
        </div>,
        document.body
      )}

      {errorModal.show && createPortal(
         <div className="modal-overlay bg-[#080A12]/40 backdrop-blur-2xl animate-in fade-in duration-300">
            <div className="bg-white w-full max-w-sm p-10 rounded-[3.5rem] shadow-[0_40px_100px_rgba(239,68,68,0.2)] text-center space-y-6 animate-in zoom-in-95 duration-300 border border-red-50">
               <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto shadow-inner border border-red-100">
                 <AlertCircle size={40} />
               </div>
               <div>
                 <h3 className="text-xl font-black text-slate-800 font-noto tracking-tight">সতর্কবাণী</h3>
                 <p className="font-bold text-slate-400 mt-2 text-[13px] leading-relaxed">{errorModal.message}</p>
               </div>
               <button onClick={() => setErrorModal({show: false, message: ''})} className="w-full py-5 bg-slate-100 text-[#2E0B5E] rounded-full font-black text-sm uppercase tracking-widest active:scale-95 transition-all">ঠিক আছে</button>
            </div>
         </div>,
         document.body
      )}
    </div>
  );
};

export default StudentForm;
