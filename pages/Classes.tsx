
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Plus, ChevronRight, BookOpen, Users, Edit3, Trash2, X, Check, Loader2, AlertCircle, AlertTriangle, Hash } from 'lucide-react';
import { supabase, offlineApi } from '../supabase';
import { Class, Language, Madrasah } from '../types';
import { t } from '../translations';

export const sortMadrasahClasses = (classes: any[]) => {
  if (!classes || !Array.isArray(classes)) return [];
  return [...classes].sort((a, b) => {
    // Primary sort by sort_order
    const orderA = a.sort_order ?? 999999;
    const orderB = b.sort_order ?? 999999;
    if (orderA !== orderB) return orderA - orderB;
    // Fallback to alphabetical
    return (a.class_name || '').localeCompare((b.class_name || ''), 'bn', { numeric: true });
  });
};

interface ClassesProps {
  onClassClick: (cls: Class) => void;
  lang: Language;
  madrasah: Madrasah | null;
  dataVersion: number;
  triggerRefresh: () => void;
  readOnly?: boolean;
}

const Classes: React.FC<ClassesProps> = ({ onClassClick, lang, madrasah, dataVersion, triggerRefresh, readOnly }) => {
  const [classes, setClasses] = useState<(Class & { student_count?: number })[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [newSortOrder, setNewSortOrder] = useState<string>('');
  const [editingClass, setEditingClass] = useState<Class | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<Class | null>(null);

  useEffect(() => { fetchClasses(); }, [dataVersion]);

  const fetchClasses = async () => {
    setLoading(true);
    const cached = offlineApi.getCache('classes');
    if (cached) setClasses(sortMadrasahClasses(cached));

    if (navigator.onLine && madrasah) {
      try {
        const { data: classesData, error } = await supabase
          .from('classes')
          .select('*')
          .eq('madrasah_id', madrasah.id);
        if (error) throw error;
        if (classesData) {
          const withCounts = await Promise.all(classesData.map(async (cls) => {
            const { count } = await supabase
              .from('students')
              .select('*', { count: 'exact', head: true })
              .eq('class_id', cls.id);
            return { ...cls, student_count: count || 0 };
          }));
          const sorted = sortMadrasahClasses(withCounts);
          setClasses(sorted);
          offlineApi.setCache('classes', sorted);
        }
      } catch (err) { console.error(err); } finally { setLoading(false); }
    } else { setLoading(false); }
  };

  const handleSaveClass = async () => {
    if (!newClassName.trim() || !madrasah) return;
    setModalLoading(true);
    const order = newSortOrder ? parseInt(newSortOrder) : null;
    try {
      if (editingClass) {
        if (navigator.onLine) {
          const { error } = await supabase.from('classes').update({ 
            class_name: newClassName.trim(),
            sort_order: order 
          }).eq('id', editingClass.id);
          if (error) throw error;
        } else {
          offlineApi.queueAction('classes', 'UPDATE', { 
            id: editingClass.id, 
            class_name: newClassName.trim(),
            sort_order: order
          });
        }
      } else {
        const payload = { 
          class_name: newClassName.trim(), 
          madrasah_id: madrasah.id,
          sort_order: order
        };
        if (navigator.onLine) {
          const { error } = await supabase.from('classes').insert(payload);
          if (error) throw error;
        } else {
          offlineApi.queueAction('classes', 'INSERT', payload);
        }
      }
      setShowModal(false);
      setNewClassName('');
      setNewSortOrder('');
      setEditingClass(null);
      triggerRefresh();
    } catch (err: any) {
      alert(lang === 'bn' ? `ব্যর্থ হয়েছে: ${err.message}` : `Failed: ${err.message}`);
    } finally { setModalLoading(false); }
  };

  const handleDeleteClass = async () => {
    if (!showDeleteConfirm) return;
    setModalLoading(true);
    try {
      if (navigator.onLine) {
        const { error } = await supabase.from('classes').delete().eq('id', showDeleteConfirm.id);
        if (error) throw error;
      } else {
        offlineApi.queueAction('classes', 'DELETE', { id: showDeleteConfirm.id });
      }
      setShowDeleteConfirm(null);
      triggerRefresh();
    } catch (err: any) { alert(err.message); } finally { setModalLoading(false); }
  };

  return (
    <>
      <div className="space-y-6 animate-in slide-in-from-right-4 duration-500 pb-20">
        <div className="flex items-center justify-between px-2">
          <h1 className="text-xl font-noto font-black text-white drop-shadow-md">{t('classes_title', lang)}</h1>
          {!readOnly && (
            <button onClick={() => { setNewClassName(''); setNewSortOrder(''); setEditingClass(null); setShowModal(true); }} className="premium-btn text-white px-5 py-3 rounded-2xl text-[12px] font-black flex items-center gap-2 active:scale-95 transition-all border border-white/20 shadow-xl">
              <Plus size={16} strokeWidth={4} /> {t('new_class', lang)}
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4">
          {classes.map(cls => (
            <div key={cls.id} onClick={() => onClassClick(cls)} className="bg-white/95 backdrop-blur-md p-4 sm:p-5 rounded-[2.2rem] border border-white/40 flex items-center justify-between active:scale-[0.98] transition-all group shadow-lg relative overflow-hidden">
              <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                <div className="w-12 h-12 sm:w-14 sm:h-14 bg-[#8D30F4]/10 rounded-2xl flex items-center justify-center text-[#8D30F4] shrink-0 border border-[#8D30F4]/10 shadow-inner">
                  <BookOpen size={20} className="sm:size-6" />
                </div>
                <div className="min-w-0 flex-1 pr-2">
                  <div className="flex items-center gap-2">
                    <h3 className="font-black text-[#2E0B5E] text-[16px] sm:text-[18px] font-noto line-clamp-2 leading-tight tracking-tight break-words">
                      {cls.class_name}
                    </h3>
                  </div>
                  <div className="flex items-center gap-1.5 mt-1">
                    <Users size={12} className="text-[#8D30F4]/60" />
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.1em]">{cls.student_count || 0} {t('students_count', lang)}</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                {!readOnly && (
                  <>
                    <button onClick={(e) => { e.stopPropagation(); setNewClassName(cls.class_name); setNewSortOrder(cls.sort_order?.toString() || ''); setEditingClass(cls); setShowModal(true); }} 
                      className="w-9 h-9 sm:w-10 sm:h-10 bg-[#F2EBFF] text-[#8D30F4] rounded-xl flex items-center justify-center border border-[#8D30F4]/10 active:scale-90 transition-all shadow-sm">
                      <Edit3 size={14} className="sm:size-4" />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(cls); }} 
                      className="w-9 h-9 sm:w-10 sm:h-10 bg-red-50 text-red-500 rounded-xl flex items-center justify-center border border-red-100 active:scale-90 transition-all shadow-sm">
                      <Trash2 size={14} className="sm:size-4" />
                    </button>
                  </>
                )}
                <ChevronRight className="text-[#A179FF]/40 group-hover:text-[#8D30F4] transition-colors ml-0.5" size={18} strokeWidth={3} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {showModal && createPortal(
        <div className="modal-overlay bg-[#080A12]/40 backdrop-blur-2xl animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-sm rounded-[3.5rem] p-10 shadow-[0_40px_100px_rgba(141,48,244,0.2)] border border-[#8D30F4]/5 relative animate-in zoom-in-95 duration-300">
            <button onClick={() => setShowModal(false)} className="absolute top-10 right-10 text-slate-300 hover:text-[#8D30F4] transition-all"><X size={26} strokeWidth={3} /></button>
            
            <div className="flex items-center gap-5 mb-8">
               <div className="w-16 h-16 bg-[#8D30F4]/10 rounded-[1.8rem] flex items-center justify-center text-[#8D30F4] shrink-0 border border-[#8D30F4]/10 shadow-inner">
                  <BookOpen size={32} />
               </div>
               <div>
                  <h2 className="text-xl font-black text-[#2E0B5E] font-noto tracking-tight">
                    {editingClass ? t('edit_class', lang) : t('new_class', lang)}
                  </h2>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Class Information</p>
               </div>
            </div>

            <div className="space-y-6">
              <div className="space-y-2.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-2">{t('class_name_label', lang)}</label>
                <input 
                  type="text" 
                  autoFocus
                  className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-[1.8rem] text-[#2E0B5E] font-black text-lg outline-none focus:border-[#8D30F4]/30 focus:bg-white transition-all shadow-inner" 
                  value={newClassName} 
                  onChange={(e) => setNewClassName(e.target.value)}
                  placeholder="যেমন: হিফয বিভাগ"
                />
              </div>

              <div className="space-y-2.5">
                <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-2">
                  <Hash size={12} /> সিরিয়াল নম্বর (Sorting)
                </label>
                <input 
                  type="number" 
                  className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-[1.8rem] text-[#2E0B5E] font-black text-lg outline-none focus:border-[#8D30F4]/30 focus:bg-white transition-all shadow-inner" 
                  value={newSortOrder} 
                  onChange={(e) => setNewSortOrder(e.target.value)}
                  placeholder="যেমন: ১"
                />
              </div>

              <button onClick={handleSaveClass} disabled={modalLoading || !newClassName.trim()} className="w-full py-5 premium-btn text-white font-black rounded-full shadow-2xl active:scale-[0.98] transition-all flex items-center justify-center gap-3 text-lg">
                {modalLoading ? <Loader2 className="animate-spin" size={24} /> : <><Check size={24} strokeWidth={4} /> {t('save', lang)}</>}
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
                <h3 className="text-xl font-black text-slate-800 font-noto">{t('confirm_delete', lang)}</h3>
                <p className="text-[11px] font-bold text-slate-400 mt-2 uppercase tracking-wider px-4">"{showDeleteConfirm.class_name}" শ্রেণির সকল ছাত্রের তথ্য মুছে যাবে।</p>
             </div>
             <div className="flex flex-col gap-3 pt-2">
                <button onClick={handleDeleteClass} disabled={modalLoading} className="w-full py-5 bg-red-500 text-white font-black rounded-full shadow-xl shadow-red-100 active:scale-95 transition-all flex items-center justify-center text-md">
                  {modalLoading ? <Loader2 className="animate-spin" size={22} /> : 'ডিলিট করুন'}
                </button>
                <button onClick={() => setShowDeleteConfirm(null)} className="w-full py-4 bg-slate-50 text-slate-400 font-black rounded-full active:scale-95 transition-all text-sm uppercase tracking-widest">বাতিল</button>
             </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

export default Classes;
