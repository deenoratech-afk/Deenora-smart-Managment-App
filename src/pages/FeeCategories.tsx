
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { Madrasah, FeeCategory, Language } from '../types';
import { Plus, X, Loader2, Save, Tag, FileText, ChevronLeft, Trash2 } from 'lucide-react';

interface FeeCategoriesProps {
  lang: Language;
  madrasah: Madrasah | null;
  onBack: () => void;
}

const FeeCategories: React.FC<FeeCategoriesProps> = ({ lang, madrasah, onBack }) => {
  const [categories, setCategories] = useState<FeeCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (madrasah) fetchCategories();
  }, [madrasah]);

  const fetchCategories = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('fee_categories')
      .select('*')
      .eq('madrasah_id', madrasah?.id)
      .order('created_at', { ascending: false });
    if (data) setCategories(data);
    setLoading(false);
  };

  const handleAdd = async () => {
    if (!name || !madrasah) return;
    setIsSaving(true);
    try {
      const { error } = await supabase.from('fee_categories').insert({
        madrasah_id: madrasah.id,
        name: name.trim(),
        description: description.trim()
      });
      if (error) throw error;
      setName('');
      setDescription('');
      setShowAdd(false);
      fetchCategories();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure? This will remove the category from all fee structures.')) return;
    const { error } = await supabase.from('fee_categories').delete().eq('id', id);
    if (error) alert(error.message);
    else fetchCategories();
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-slate-400 border border-slate-100 shadow-sm">
            <ChevronLeft size={20}/>
          </button>
          <h1 className="text-xl font-black text-[#1E293B] font-noto">ফি ক্যাটাগরি</h1>
        </div>
        <button onClick={() => setShowAdd(true)} className="w-10 h-10 bg-[#2563EB] text-white rounded-xl shadow-premium flex items-center justify-center active:scale-95 transition-all">
          <Plus size={20}/>
        </button>
      </div>

      <div className="space-y-3">
        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="animate-spin text-blue-500" /></div>
        ) : categories.length > 0 ? (
          categories.map(cat => (
            <div key={cat.id} className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-bubble flex items-center justify-between">
              <div className="min-w-0">
                <h3 className="font-black text-[#1E3A8A] text-lg font-noto">{cat.name}</h3>
                {cat.description && <p className="text-[10px] font-bold text-slate-400 mt-1">{cat.description}</p>}
              </div>
              <button onClick={() => handleDelete(cat.id)} className="p-2 text-red-300 hover:text-red-500 transition-colors">
                <Trash2 size={18} />
              </button>
            </div>
          ))
        ) : (
          <div className="text-center py-20 bg-slate-50 rounded-[3rem] border-2 border-dashed border-slate-200 mx-2">
            <Tag size={40} className="mx-auto text-slate-200 mb-4" />
            <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">No categories found</p>
          </div>
        )}
      </div>

      {showAdd && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xl z-[999] flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-sm rounded-[3rem] p-8 space-y-6 animate-in zoom-in-95 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-black text-[#1E3A8A]">নতুন ক্যাটাগরি</h3>
              <button onClick={() => setShowAdd(false)} className="w-9 h-9 bg-slate-50 text-slate-300 rounded-xl flex items-center justify-center"><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <div className="relative">
                <input 
                  type="text" 
                  className="w-full h-14 bg-slate-50 rounded-2xl px-12 font-black text-sm outline-none border-2 border-transparent focus:border-[#2563EB]/20" 
                  placeholder="ক্যাটাগরির নাম (যেমন: একাডেমিক ফি)" 
                  value={name} 
                  onChange={(e) => setName(e.target.value)} 
                />
                <Tag className="absolute left-4 top-4 text-slate-300" size={20}/>
              </div>
              <div className="relative">
                <textarea 
                  className="w-full h-24 bg-slate-50 rounded-2xl px-12 py-4 font-bold text-sm outline-none border-2 border-transparent focus:border-[#2563EB]/20 resize-none" 
                  placeholder="বিবরণ (ঐচ্ছিক)" 
                  value={description} 
                  onChange={(e) => setDescription(e.target.value)} 
                />
                <FileText className="absolute left-4 top-4 text-slate-300" size={20}/>
              </div>
              <button 
                onClick={handleAdd} 
                disabled={isSaving || !name} 
                className="w-full py-5 bg-[#2563EB] text-white font-black rounded-full shadow-premium flex items-center justify-center gap-3 active:scale-95 transition-all"
              >
                {isSaving ? <Loader2 className="animate-spin" size={20} /> : <><Save size={20}/> সংরক্ষণ করুন</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FeeCategories;
