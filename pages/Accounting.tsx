import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { Loader2, Plus, X, ChevronDown, Tag, DollarSign } from 'lucide-react';
import { t } from '../translations';
import { Madrasah, Class, FeeCategory, FeeStructure, Language } from '../types';

interface AccountingProps {
  lang: Language;
  madrasah: Madrasah | null;
  onBack: () => void;
  role: string;
}

const Accounting: React.FC<AccountingProps> = ({ lang, madrasah, onBack, role }) => {
  const [feeCategories, setFeeCategories] = useState<FeeCategory[]>([]);
  const [feeStructures, setFeeStructures] = useState<FeeStructure[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [showAddStructure, setShowAddStructure] = useState(false);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryType, setNewCategoryType] = useState<'recurring' | 'one-time' | 'optional'>('one-time');
  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [feeNote, setFeeNote] = useState('');
  const [amount, setAmount] = useState('');
  const [isMonthlyFee, setIsMonthlyFee] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showClassDropdown, setShowClassDropdown] = useState(false);

  const fetchData = async () => {
    if (!madrasah?.id) return;

    const { data: categoriesData, error: categoriesError } = await supabase
      .from('fee_categories')
      .select('*')
      .eq('madrasah_id', madrasah.id);
    if (categoriesError) console.error('Error fetching fee categories:', categoriesError);
    else setFeeCategories(categoriesData || []);

    const { data: structuresData, error: structuresError } = await supabase
      .from('fee_structures')
      .select('*, classes(class_name), fee_categories(name)')
      .eq('madrasah_id', madrasah.id);
    if (structuresError) console.error('Error fetching fee structures:', structuresError);
    else setFeeStructures(structuresData || []);

    const { data: classesData, error: classesError } = await supabase
      .from('classes')
      .select('*')
      .eq('madrasah_id', madrasah.id);
    if (classesError) console.error('Error fetching classes:', classesError);
    else setClasses(classesData || []);
  };

  useEffect(() => {
    fetchData();
  }, [madrasah?.id]);

  return (
    <div className="w-full max-w-4xl mx-auto p-4">
      <div className="flex items-center justify-between mb-6">
        <button onClick={onBack} className="text-slate-500 hover:text-slate-700">&larr; {t('back', lang)}</button>
        <h2 className="text-2xl font-black text-[#1E3A8A]">{t('accounting', lang)}</h2>
        <div className="flex space-x-2">
          {role === 'super_admin' && (
            <button onClick={() => setShowAddCategory(true)} className="px-4 py-2 bg-[#2563EB] text-white rounded-full text-sm font-black flex items-center">
              <Plus size={16} className="mr-1" /> {t('add_category', lang)}
            </button>
          )}
          <button onClick={() => setShowAddStructure(true)} className="px-4 py-2 bg-[#2563EB] text-white rounded-full text-sm font-black flex items-center">
            <Plus size={16} className="mr-1" /> {t('add_fee_structure', lang)}
          </button>
        </div>
      </div>

      {/* Fee Categories Section */}
      <div className="mb-8">
        <h3 className="text-xl font-black text-[#1E3A8A] mb-4">{t('fee_categories', lang)}</h3>
        {feeCategories.length === 0 ? (
          <p className="text-slate-500">{t('no_fee_categories', lang)}</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {feeCategories.map(category => (
              <div key={category.id} className="bg-white rounded-2xl p-4 shadow-sm flex items-center justify-between">
                <div>
                  <p className="font-black text-[#1E3A8A]">{category.name}</p>
                  <p className="text-xs text-slate-500">{t(category.type as any, lang)}</p>
                </div>
                {role === 'super_admin' && (
                  <button 
                    onClick={async () => {
                      if (confirm(t('confirm_delete_category', lang, { categoryName: category.name }))) {
                        await supabase.from('fee_categories').delete().eq('id', category.id);
                        fetchData();
                      }
                    }}
                    className="text-red-500 hover:text-red-700"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Fee Structures Section */}
      <div>
        <h3 className="text-xl font-black text-[#1E3A8A] mb-4">{t('fee_structures', lang)}</h3>
        {feeStructures.length === 0 ? (
          <p className="text-slate-500">{t('no_fee_structures', lang)}</p>
        ) : (
          <div className="space-y-4">
            {feeStructures.map(structure => (
              <div key={structure.id} className="bg-white rounded-2xl p-4 shadow-sm">
                <p className="font-black text-[#1E3A8A]">{structure.fee_name}</p>
                <p className="text-sm text-slate-600">{structure.classes?.class_name} - {structure.fee_categories?.name}</p>
                <p className="text-lg font-bold text-[#2563EB]">৳{structure.amount} {structure.is_monthly ? t('monthly', lang) : t('one-time', lang)}</p>
                {role === 'super_admin' && (
                  <button 
                    onClick={async () => {
                      if (confirm(t('confirm_delete_structure', lang, { structureName: structure.fee_name }))) {
                        await supabase.from('fee_structures').delete().eq('id', structure.id);
                        fetchData();
                      }
                    }}
                    className="text-red-500 hover:text-red-700 mt-2"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ADD CATEGORY MODAL */}
      {showAddCategory && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xl z-[999] flex items-center justify-center p-6 text-slate-900">
          <div className="bg-white w-full max-w-sm rounded-[3rem] p-8 space-y-6 animate-in zoom-in-95 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-black text-[#1E3A8A]">{t('add_new_category', lang)}</h3>
              <button onClick={() => setShowAddCategory(false)} className="w-9 h-9 bg-slate-50 text-slate-300 rounded-xl flex items-center justify-center"><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <div className="relative">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2 mb-1.5 block">{t('category_name', lang)}</label>
                <input 
                  type="text" 
                  className="w-full h-14 bg-slate-50 rounded-2xl px-6 font-black text-sm outline-none border-2 border-transparent focus:border-[#2563EB]/20"
                  placeholder={t('category_name_placeholder', lang)} 
                  value={newCategoryName} 
                  onChange={(e) => setNewCategoryName(e.target.value)} 
                />
              </div>
              <div className="relative">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2 mb-1.5 block">{t('category_type', lang)}</label>
                <select 
                  className="w-full h-14 bg-slate-50 rounded-2xl px-6 font-black text-sm outline-none border-2 border-transparent focus:border-[#2563EB]/20"
                  value={newCategoryType}
                  onChange={(e) => setNewCategoryType(e.target.value as 'recurring' | 'one-time' | 'optional')}
                >
                  <option value="recurring">{t('recurring', lang)}</option>
                  <option value="one-time">{t('one-time', lang)}</option>
                  <option value="optional">{t('optional', lang)}</option>
                </select>
              </div>
              <button onClick={async () => {
                if (!newCategoryName) return;
                setIsSaving(true);
                try {
                  const { error } = await supabase.from('fee_categories').insert({
                    madrasah_id: madrasah?.id,
                    name: newCategoryName,
                    type: newCategoryType
                  });
                  if (error) throw error;
                  setShowAddCategory(false);
                  setNewCategoryName('');
                  fetchData();
                } catch (e: any) { alert(e.message); } finally { setIsSaving(false); }
              }} className="w-full py-5 bg-[#2563EB] text-white font-black rounded-full shadow-premium active:scale-95 transition-all text-base">
                {isSaving ? <Loader2 className="animate-spin mx-auto" /> : t('add_category', lang)}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD STRUCTURE MODAL */}
      {showAddStructure && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xl z-[999] flex items-center justify-center p-6 text-slate-900">
           <div className="bg-white w-full max-w-sm rounded-[3rem] p-8 space-y-6 animate-in zoom-in-95 shadow-2xl relative">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-black text-[#1E3A8A]">{t('setup_fee', lang)}</h3>
                <button onClick={() => setShowAddStructure(false)} className="w-9 h-9 bg-slate-50 text-slate-300 rounded-xl flex items-center justify-center"><X size={20} /></button>
              </div>
              <div className="space-y-4">
                 <div className="relative">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2 mb-1.5 block">{t('select_class', lang)}</label>
                    <button onClick={() => setShowClassDropdown(!showClassDropdown)} className="w-full h-14 px-6 rounded-2xl border-2 border-slate-100 bg-slate-50 flex items-center justify-between font-black text-[#1E3A8A]">
                       <span className="truncate">{classes.find(c => c.id === selectedClass)?.class_name || t('select_class_placeholder', lang)}</span>
                       <ChevronDown size={20} className="text-slate-300" />
                    </button>
                    {showClassDropdown && (
                        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-slate-100 z-[1001] p-2 max-h-48 overflow-y-auto">
                            {classes.map(c => (
                                <button key={c.id} onClick={() => { setSelectedClass(c.id); setShowClassDropdown(false); }} className="w-full text-left px-5 py-3 rounded-xl hover:bg-slate-50 font-black text-[#1E3A8A]">{c.class_name}</button>
                            ))}
                        </div>
                    )}
                 </div>
                 <div className="relative">
                     <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2 mb-1.5 block">{t('select_category', lang)}</label>
                     <select 
                        className="w-full h-14 bg-slate-50 rounded-2xl px-6 font-black text-sm outline-none border-2 border-transparent focus:border-[#2563EB]/20"
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
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2 mb-1.5 block">{t('fee_name', lang)}</label>
                    <div className="relative">
                      <input type="text" className="w-full h-14 bg-slate-50 rounded-2xl px-12 font-black text-sm outline-none border-2 border-transparent focus:border-[#2563EB]/20" placeholder={t('fee_name_placeholder', lang)} value={feeNote} onChange={(e) => setFeeNote(e.target.value)} />
                      <Tag className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={20}/>
                    </div>
                 </div>
                 <div className="relative">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2 mb-1.5 block">{t('fee_type', lang)}</label>
                    <div className="flex p-1 bg-slate-100 rounded-2xl border border-slate-200">
                       <button 
                          type="button"
                          onClick={() => setIsMonthlyFee(true)} 
                          className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${isMonthlyFee ? 'bg-white text-[#2563EB] shadow-md' : 'text-slate-400'}`}
                       >
                          {t('monthly', lang)}
                       </button>
                       <button 
                          type="button"
                          onClick={() => setIsMonthlyFee(false)} 
                          className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${!isMonthlyFee ? 'bg-white text-[#2563EB] shadow-md' : 'text-slate-400'}`}
                       >
                          {t('one-time', lang)}
                       </button>
                    </div>
                 </div>
                 <div className="relative">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2 mb-1.5 block">{t('amount', lang)}</label>
                    <div className="relative">
                      <input type="number" className="w-full h-14 bg-slate-50 rounded-2xl px-12 font-black text-lg outline-none border-2 border-transparent focus:border-[#2563EB]/20" placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
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
    </div>
  );
};

export default Accounting;
