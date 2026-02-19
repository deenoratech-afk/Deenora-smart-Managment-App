
import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { LogOut, Camera, Loader2, User as UserIcon, ShieldCheck, Database, ChevronRight, Check, MessageSquare, Zap, Globe, Smartphone, Save, Users, Layers, Edit3, UserPlus, Languages, Mail, Key, Settings, Fingerprint, Copy, History, Server, CreditCard, Shield, Sliders, Activity, Bell, RefreshCw, AlertTriangle, GraduationCap, ChevronLeft, ArrowRight, LayoutDashboard, Settings2, X, Sparkles, Box, ShieldAlert, Award, CheckCircle2, Lock, Terminal, Cpu } from 'lucide-react';
import { supabase, smsApi } from '../supabase';
import { Madrasah, Language, View } from '../types';
import { t } from '../translations';

interface AccountProps {
  lang: Language;
  setLang: (l: Language) => void;
  onProfileUpdate?: () => void;
  setView: (view: View) => void;
  isSuperAdmin?: boolean;
  initialMadrasah: Madrasah | null;
  onLogout: () => void;
  isTeacher?: boolean;
}

const Account: React.FC<AccountProps> = ({ lang, setLang, onProfileUpdate, setView, isSuperAdmin, initialMadrasah, onLogout, isTeacher }) => {
  const [madrasah, setMadrasah] = useState<Madrasah | null>(initialMadrasah);
  const [saving, setSaving] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isEditingGlobal, setIsEditingGlobal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState({ show: false, title: '', message: '' });
  
  const [stats, setStats] = useState({ students: 0, classes: 0, teachers: 0 });
  const [loadingStats, setLoadingStats] = useState(true);

  const [newName, setNewName] = useState(initialMadrasah?.name || '');
  const [newPhone, setNewPhone] = useState(initialMadrasah?.phone || '');
  const [newLoginCode, setNewLoginCode] = useState(initialMadrasah?.login_code || '');
  const [logoUrl, setLogoUrl] = useState(initialMadrasah?.logo_url || '');
  
  const [reveApiKey, setReveApiKey] = useState(initialMadrasah?.reve_api_key || '');
  const [reveSecretKey, setReveSecretKey] = useState(initialMadrasah?.reve_secret_key || '');
  const [reveCallerId, setReveCallerId] = useState(initialMadrasah?.reve_caller_id || '');

  const [globalSettings, setGlobalSettings] = useState({
    reve_api_key: '',
    reve_secret_key: '',
    reve_caller_id: '',
    bkash_number: ''
  });
  
  const [copiedId, setCopiedId] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initialMadrasah) {
      setMadrasah(initialMadrasah);
      setNewName(initialMadrasah.name || '');
      setNewPhone(initialMadrasah.phone || '');
      setNewLoginCode(initialMadrasah.login_code || '');
      setLogoUrl(initialMadrasah.logo_url || '');
      setReveApiKey(initialMadrasah.reve_api_key || '');
      setReveSecretKey(initialMadrasah.reve_secret_key || '');
      setReveCallerId(initialMadrasah.reve_caller_id || '');
      
      if (!isSuperAdmin) fetchStats();
      if (isSuperAdmin) fetchGlobalSettings();
    }
  }, [initialMadrasah, isSuperAdmin]);

  const fetchStats = async () => {
    if (!initialMadrasah) return;
    setLoadingStats(true);
    try {
      const { data: profile } = await supabase.from('madrasahs').select('*').eq('id', initialMadrasah.id).maybeSingle();
      if (profile) setMadrasah(profile);
      const [stdRes, clsRes, teaRes] = await Promise.all([
        supabase.from('students').select('*', { count: 'exact', head: true }).eq('madrasah_id', initialMadrasah.id),
        supabase.from('classes').select('*', { count: 'exact', head: true }).eq('madrasah_id', initialMadrasah.id),
        supabase.from('teachers').select('*', { count: 'exact', head: true }).eq('madrasah_id', initialMadrasah.id)
      ]);
      setStats({ students: stdRes.count || 0, classes: clsRes.count || 0, teachers: teaRes.count || 0 });
    } catch (e) { console.error(e); } finally { setLoadingStats(false); }
  };

  const fetchGlobalSettings = async () => {
    const settings = await smsApi.getGlobalSettings();
    setGlobalSettings({
      reve_api_key: settings.reve_api_key,
      reve_secret_key: settings.reve_secret_key,
      reve_caller_id: settings.reve_caller_id,
      bkash_number: settings.bkash_number
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleUpdate = async () => {
    if (!madrasah || isTeacher) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('madrasahs').update({ 
        name: newName.trim(), 
        phone: newPhone.trim(), 
        login_code: newLoginCode.trim(), 
        logo_url: logoUrl,
        reve_api_key: reveApiKey.trim() || null,
        reve_secret_key: reveSecretKey.trim() || null,
        reve_caller_id: reveCallerId.trim() || null
      }).eq('id', madrasah.id);
      if (error) throw error;
      if (onProfileUpdate) onProfileUpdate();
      setIsEditingProfile(false);
      setMadrasah(prev => prev ? { ...prev, name: newName, phone: newPhone, login_code: newLoginCode } : null);
      setShowSuccessModal({ show: true, title: t('success', lang), message: 'Profile updated successfully' });
    } catch (err: any) { alert(err.message); } finally { setSaving(false); }
  };

  const handleSaveGlobalSettings = async () => {
    if (!isSuperAdmin) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('system_settings').update({
        reve_api_key: globalSettings.reve_api_key.trim(),
        reve_secret_key: globalSettings.reve_secret_key.trim(),
        reve_caller_id: globalSettings.reve_caller_id.trim(),
        bkash_number: globalSettings.bkash_number.trim()
      }).eq('id', '00000000-0000-0000-0000-000000000001');
      if (error) throw error;
      setIsEditingGlobal(false);
      setShowSuccessModal({ show: true, title: 'সিস্টেম আপডেট', message: 'কোর সিস্টেম সেটিংস আপডেট হয়েছে।' });
      fetchGlobalSettings();
    } catch (err: any) { alert(err.message); } finally { setSaving(false); }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !madrasah || isTeacher) return;
    setSaving(true);
    try {
      const fileName = `logo_${madrasah.id}_${Date.now()}`;
      const { error: uploadError } = await supabase.storage.from('madrasah-assets').upload(`logos/${fileName}`, file);
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('madrasah-assets').getPublicUrl(`logos/${fileName}`);
      await supabase.from('madrasahs').update({ logo_url: publicUrl }).eq('id', madrasah.id);
      setLogoUrl(publicUrl);
      if (onProfileUpdate) onProfileUpdate();
    } catch (e: any) { alert(e.message); } finally { setSaving(false); }
  };

  if (!madrasah) return null;

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-36 relative z-10">
      {isSuperAdmin && (
        <div className="bg-[#1A0B2E] p-6 sm:p-8 rounded-[3.5rem] border border-white/10 shadow-2xl space-y-8 relative overflow-hidden group">
           <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:rotate-12 transition-transform duration-1000"><Shield size={140} className="text-[#A179FF]" /></div>
           <div className="flex items-center justify-between relative z-10">
              <div className="flex items-center gap-5">
                 <div className="w-14 h-14 bg-[#8D30F4] text-white rounded-[1.5rem] flex items-center justify-center shadow-[0_0_40px_rgba(141,48,244,0.4)] border border-white/10"><LayoutDashboard size={26} /></div>
                 <div><h3 className="text-xl font-black text-white font-noto tracking-tight">System Core</h3><p className="text-[9px] font-black text-[#A179FF] uppercase tracking-[0.25em] mt-1.5">Master Gateway</p></div>
              </div>
              <button onClick={() => setIsEditingGlobal(true)} className="w-11 h-11 bg-white/10 text-white rounded-2xl flex items-center justify-center transition-all shadow-lg border border-white/10 hover:bg-[#8D30F4]"><Settings2 size={20} /></button>
           </div>
           <div className="flex gap-4 relative z-10 flex-wrap">
              <div className="flex-1 min-w-[140px] bg-white/5 p-6 rounded-[2.5rem] border border-white/10 flex items-center gap-4"><div className="w-12 h-12 bg-green-500/20 text-green-400 rounded-2xl flex items-center justify-center"><Activity size={22} /></div><div><p className="text-[8px] font-black text-[#A179FF] uppercase tracking-widest">Network</p><p className="text-sm font-black text-white">Active</p></div></div>
              <div className="flex-1 min-w-[140px] bg-white/5 p-6 rounded-[2.5rem] border border-white/10 flex items-center gap-4"><div className="w-12 h-12 bg-indigo-500/20 text-indigo-400 rounded-2xl flex items-center justify-center"><CreditCard size={22} /></div><div><p className="text-[8px] font-black text-[#A179FF] uppercase tracking-widest">Payment</p><p className="text-sm font-black text-white truncate max-w-[80px]">{globalSettings.bkash_number || 'N/A'}</p></div></div>
              <div className="flex-1 min-w-[140px] bg-white/5 p-6 rounded-[2.5rem] border border-white/10 flex items-center gap-4"><div className="w-12 h-12 bg-[#8D30F4]/20 text-[#A179FF] rounded-2xl flex items-center justify-center"><MessageSquare size={22} /></div><div><p className="text-[8px] font-black text-[#A179FF] uppercase tracking-widest">Core ID</p><p className="text-sm font-black text-white">{globalSettings.reve_caller_id || 'Deenora'}</p></div></div>
           </div>
        </div>
      )}

      <div className="relative pt-20 px-1">
        <div className="bg-white rounded-[4.5rem] p-6 sm:p-10 pt-28 shadow-[0_30px_70px_-20px_rgba(46,11,94,0.2)] border border-slate-50 relative text-center">
          <div className="absolute -top-16 left-1/2 -translate-x-1/2 z-20">
            <div className="relative group">
              <div className="w-40 h-40 bg-white p-2.5 rounded-full shadow-2xl border-[12px] border-slate-50 flex items-center justify-center overflow-hidden">
                {logoUrl ? <img src={logoUrl} className="w-full h-full object-cover rounded-full" alt="Profile" /> : <div className="w-full h-full bg-[#F2EBFF] flex items-center justify-center text-[#8D30F4]"><UserIcon size={70} strokeWidth={1.5} /></div>}
              </div>
              {!isTeacher && (
                <button 
                  onClick={() => fileInputRef.current?.click()} 
                  className="absolute bottom-2 right-2 w-11 h-11 bg-[#8D30F4] text-white rounded-2xl flex items-center justify-center shadow-xl border-4 border-white active:scale-90 transition-all z-30"
                >
                  {saving ? <Loader2 size={20} className="animate-spin" /> : <Camera size={20} />}
                </button>
              )}
              <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handlePhotoUpload} />
            </div>
          </div>
          <div className="space-y-6">
             {/* Fixed Madrasah Name Issue: Changed font-black to font-bold and reset shadow to fix "ghosting/distortion" */}
             <h2 className="text-[26px] sm:text-[32px] font-bold text-[#2E0B5E] font-noto tracking-tight leading-snug px-4 break-words [text-shadow:none]">{madrasah.name}</h2>
             
             <div className="flex flex-col items-center gap-2">
                <div className="inline-flex px-5 py-1.5 bg-[#F2EBFF] text-[#8D30F4] rounded-2xl border border-[#8D30F4]/10">
                   <ShieldCheck size={14} className="mr-2 shrink-0" />
                   <span className="text-[10px] font-black uppercase tracking-widest whitespace-nowrap">{t('sender_id', lang)}: {madrasah.reve_caller_id || 'DEFAULT'}</span>
                </div>
             </div>

             <div className="pt-4">
                <div onClick={() => copyToClipboard(madrasah.id)} className="bg-slate-50/70 p-5 rounded-[2.5rem] border border-slate-100 flex items-center gap-5 active:scale-[0.98] cursor-pointer">
                   <Fingerprint size={24} className="text-[#8D30F4] shrink-0" />
                   <div className="flex-1 text-left min-w-0">
                      <p className="text-[9px] font-black text-slate-400 uppercase mb-1">{t('madrasah_uuid', lang)}</p>
                      <p className="text-[12px] font-black text-[#8D30F4] truncate">{madrasah.id}</p>
                   </div>
                   {copiedId ? <Check size={22} className="text-green-500 shrink-0" /> : <Copy size={20} className="text-slate-200 shrink-0" />}
                </div>
             </div>

             {!isSuperAdmin && (
              <div className="grid grid-cols-2 gap-4 mt-8 pt-4">
                  <div className="bg-white rounded-3xl p-5 border border-slate-50 shadow-md"><Users size={20} className="mx-auto mb-2 text-purple-500" /><h4 className="text-lg font-black">{stats.students}</h4><p className="text-[8px] uppercase font-black text-slate-400">{t('students', lang)}</p></div>
                  <div className="bg-white rounded-3xl p-5 border border-slate-50 shadow-md"><Layers size={20} className="mx-auto mb-2 text-blue-500" /><h4 className="text-lg font-black">{stats.classes}</h4><p className="text-[8px] uppercase font-black text-slate-400">{t('classes', lang)}</p></div>
                  <div className="bg-white rounded-3xl p-5 border border-slate-50 shadow-md"><GraduationCap size={20} className="mx-auto mb-2 text-emerald-500" /><h4 className="text-lg font-black">{stats.teachers}</h4><p className="text-[8px] uppercase font-black text-slate-400">{t('teachers', lang)}</p></div>
                  <div className="bg-white rounded-3xl p-5 border border-slate-50 shadow-md"><Zap size={20} className="mx-auto mb-2 text-amber-500" /><h4 className="text-lg font-black">{madrasah.sms_balance || 0}</h4><p className="text-[8px] uppercase font-black text-slate-400">{t('wallet', lang)}</p></div>
              </div>
             )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-[3.5rem] shadow-2xl border border-slate-50 divide-y divide-slate-50 overflow-hidden mx-1">
        {!isTeacher && (
          <>
            <button onClick={() => setIsEditingProfile(true)} className="w-full p-6 sm:p-8 flex items-center justify-between group">
              <div className="flex items-center gap-4 sm:gap-6"><div className="w-12 h-12 bg-purple-50 text-[#8D30F4] rounded-2xl flex items-center justify-center"><Edit3 size={22} /></div><div className="text-left"><h5 className="text-[17px] font-black text-[#2E0B5E] font-noto">{t('profile_settings', lang)}</h5><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{t('branding', lang)}</p></div></div><ChevronRight size={22} className="text-slate-200" />
            </button>
            {!isSuperAdmin && (
              <>
                <button onClick={() => setView('teachers')} className="w-full p-6 sm:p-8 flex items-center justify-between group">
                  <div className="flex items-center gap-4 sm:gap-6"><div className="w-12 h-12 bg-orange-50 text-orange-500 rounded-2xl flex items-center justify-center"><Users size={22} /></div><div className="text-left"><h5 className="text-[17px] font-black text-[#2E0B5E] font-noto">{t('manage_teachers', lang)}</h5><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Staff Access</p></div></div><ChevronRight size={22} className="text-slate-200" />
                </button>
                <button onClick={() => setView('data-management')} className="w-full p-6 sm:p-8 flex items-center justify-between group">
                  <div className="flex items-center gap-4 sm:gap-6"><div className="w-12 h-12 bg-emerald-50 text-emerald-500 rounded-2xl flex items-center justify-center"><Database size={22} /></div><div className="text-left"><h5 className="text-[17px] font-black text-[#2E0B5E] font-noto">{t('backup_restore', lang)}</h5><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Excel Tools</p></div></div><ChevronRight size={22} className="text-slate-200" />
                </button>
              </>
            )}
          </>
        )}
        <div className="w-full p-5 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between group gap-4 sm:gap-0">
          <div className="flex items-center gap-4 sm:gap-6">
            <div className="w-12 h-12 bg-blue-50 text-blue-500 rounded-2xl flex items-center justify-center"><Languages size={22} /></div>
            <div className="text-left">
              <h5 className="text-[17px] font-black text-[#2E0B5E] font-noto">{t('language', lang)}</h5>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{t('change_lang', lang)}</p>
            </div>
          </div>
          <div className="flex p-1.5 bg-slate-50 rounded-2xl border border-slate-100 self-end sm:self-auto">
            <button onClick={() => setLang('bn')} className={`px-3 sm:px-5 py-2.5 rounded-xl text-[10px] font-black transition-all ${lang === 'bn' ? 'bg-white text-[#8D30F4] shadow-sm' : 'text-slate-400'}`}>বাংলা</button>
            <button onClick={() => setLang('en')} className={`px-3 sm:px-5 py-2.5 rounded-xl text-[10px] font-black transition-all ${lang === 'en' ? 'bg-white text-[#8D30F4] shadow-sm' : 'text-slate-400'}`}>ENG</button>
          </div>
        </div>
        <button onClick={onLogout} className="w-full p-6 sm:p-8 flex items-center justify-between group">
          <div className="flex items-center gap-4 sm:gap-6"><div className="w-12 h-12 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center"><LogOut size={22} /></div><div className="text-left"><h5 className="text-[17px] font-black text-red-600 font-noto">{t('logout', lang)}</h5><p className="text-[10px] font-bold text-red-300 uppercase tracking-widest mt-1">{t('logout_system', lang)}</p></div></div><ChevronRight size={22} className="text-red-100" />
        </button>
      </div>

      {/* SYSTEM CORE UPDATE POPUP - PORTALED */}
      {isEditingGlobal && createPortal(
        <div className="modal-overlay bg-[#080A12]/90 backdrop-blur-3xl animate-in fade-in duration-300">
           <div className="bg-[#1A0B2E] w-full max-w-sm rounded-[3rem] shadow-2xl animate-in zoom-in-95 duration-500 border border-white/10 overflow-hidden flex flex-col max-h-[85vh] relative">
              <div className="p-5 shrink-0 relative overflow-hidden">
                 <div className="flex items-center justify-between relative z-10">
                    <div className="flex items-center gap-3">
                       <div className="w-10 h-10 bg-[#8D30F4] text-white rounded-xl flex items-center justify-center border border-white/20"><Shield size={20} strokeWidth={2.5} /></div>
                       <div><h3 className="text-lg font-black text-white font-noto tracking-tight">System Core</h3><p className="text-[7px] font-black text-[#A179FF] uppercase tracking-[0.2em]">Kernel Control</p></div>
                    </div>
                    <button onClick={() => setIsEditingGlobal(false)} className="w-9 h-9 bg-white/5 text-white/40 rounded-xl flex items-center justify-center active:scale-90 transition-all border border-white/5"><X size={18} /></button>
                 </div>
              </div>
              <div className="px-6 pb-8 space-y-5 overflow-y-auto custom-scrollbar flex-1 relative z-10">
                 <div className="space-y-2.5">
                    <h4 className="text-[10px] font-black text-white/70 uppercase tracking-[0.2em] px-1">Gateway Protocols</h4>
                    <div className="bg-white/5 p-4 rounded-[2rem] border border-white/5 space-y-4">
                       <div className="space-y-1"><label className="text-[9px] font-black text-[#A179FF] uppercase px-1">Master API Key</label><input type="text" className="w-full h-11 bg-[#080A12]/50 border border-white/10 rounded-xl px-4 font-bold text-[#A179FF] text-[11px] outline-none focus:border-[#8D30F4]/50" value={globalSettings.reve_api_key} onChange={(e) => setGlobalSettings({...globalSettings, reve_api_key: e.target.value})} /></div>
                       <div className="space-y-1"><label className="text-[9px] font-black text-[#A179FF] uppercase px-1">Encryption Token</label><input type="password" className="w-full h-11 bg-[#080A12]/50 border border-white/10 rounded-xl px-4 font-bold text-[#A179FF] text-[11px] outline-none focus:border-[#8D30F4]/50" value={globalSettings.reve_secret_key} onChange={(e) => setGlobalSettings({...globalSettings, reve_secret_key: e.target.value})} /></div>
                    </div>
                 </div>
                 <div className="space-y-2.5">
                    <h4 className="text-[10px] font-black text-white/70 uppercase tracking-[0.2em] px-1">Global Identities</h4>
                    <div className="bg-white/5 p-4 rounded-[2rem] border border-white/5 space-y-4">
                       <div className="space-y-1"><label className="text-[9px] font-black text-white/60 uppercase px-1">Global Caller ID</label><input type="text" className="w-full h-11 bg-white/5 border border-white/10 rounded-xl px-4 font-black text-white text-sm outline-none focus:border-[#8D30F4]/50" value={globalSettings.reve_caller_id} onChange={(e) => setGlobalSettings({...globalSettings, reve_caller_id: e.target.value})} /></div>
                       <div className="space-y-1"><label className="text-[9px] font-black text-white/60 uppercase px-1">Master Payment Number</label><input type="text" className="w-full h-11 bg-white/5 border border-white/10 rounded-xl px-4 font-black text-white text-sm outline-none focus:border-[#8D30F4]/50" value={globalSettings.bkash_number} onChange={(e) => setGlobalSettings({...globalSettings, bkash_number: e.target.value})} /></div>
                    </div>
                 </div>
                 <div className="pt-2">
                    <button 
                       onClick={handleSaveGlobalSettings} 
                       disabled={saving} 
                       className="relative w-full h-16 group overflow-hidden bg-[#8D30F4] text-white font-black rounded-full shadow-[0_0_30px_rgba(141,48,244,0.4)] active:scale-95 transition-all flex items-center justify-center gap-3 border border-white/20 text-[13px] uppercase tracking-[0.25em]"
                    >
                       <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite_linear]"></div>
                       {saving ? (
                          <Loader2 className="animate-spin" size={22} />
                       ) : (
                          <>
                             <div className="bg-white/20 p-2 rounded-xl">
                                <RefreshCw size={18} className="group-hover:rotate-180 transition-transform duration-700" />
                             </div>
                             <span className="drop-shadow-md">Push Changes</span>
                          </>
                       )}
                    </button>
                 </div>
              </div>
           </div>
        </div>,
        document.body
      )}

      {/* Edit Profile Modal - PORTALED */}
      {isEditingProfile && createPortal(
        <div className="modal-overlay bg-[#080A12]/80 backdrop-blur-2xl animate-in fade-in duration-300">
           <div className="bg-white w-full max-w-sm rounded-[3.5rem] p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-500 relative max-h-[85vh] overflow-y-auto">
              <div className="flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3"><div className="w-10 h-10 bg-purple-50 text-[#8D30F4] rounded-xl flex items-center justify-center"><Edit3 size={20} /></div><h3 className="text-xl font-black text-[#2E0B5E] font-noto tracking-tight">অ্যাকাউন্ট আপডেট</h3></div>
                <button onClick={() => setIsEditingProfile(false)} className="w-9 h-9 bg-slate-50 text-slate-300 rounded-xl flex items-center justify-center"><X size={20} /></button>
              </div>

              <div className="space-y-3.5">
                 <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">{t('madrasah_name', lang)}</label><input type="text" className="w-full h-11 bg-slate-50 border border-slate-100 rounded-xl px-4 font-black text-[#2E0B5E] text-sm outline-none focus:border-[#8D30F4]/30" value={newName} onChange={(e) => setNewName(e.target.value)} /></div>
                 <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">{t('madrasah_phone', lang)}</label><input type="tel" className="w-full h-11 bg-slate-50 border border-slate-100 rounded-xl px-4 font-black text-[#2E0B5E] text-sm outline-none focus:border-[#8D30F4]/30" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} /></div>
                 <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">{t('madrasah_code_label', lang)}</label><input type="text" className="w-full h-11 bg-slate-50 border border-slate-100 rounded-xl px-4 font-black text-[#2E0B5E] text-sm outline-none focus:border-[#8D30F4]/30" value={newLoginCode} onChange={(e) => setNewLoginCode(e.target.value)} /></div>
              </div>
              <div className="flex gap-2 pt-2 shrink-0">
                 <button onClick={() => setIsEditingProfile(false)} className="flex-1 py-4 bg-slate-100 text-slate-500 font-black rounded-2xl text-[10px] uppercase">বাতিল</button>
                 <button onClick={handleUpdate} disabled={saving} className="flex-[2] py-4 bg-[#8D30F4] text-white font-black rounded-2xl text-[10px] uppercase shadow-lg flex items-center justify-center gap-2">{saving ? <Loader2 className="animate-spin" size={16} /> : 'সংরক্ষণ করুন'}</button>
              </div>
           </div>
        </div>,
        document.body
      )}

      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
      `}</style>
    </div>
  );
};

export default Account;
