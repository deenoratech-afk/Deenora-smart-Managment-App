
import React, { useState, useEffect, useMemo } from 'react';
import { supabase, smsApi } from '../supabase';
import { Madrasah, Class, Student, Language, Attendance as AttendanceType } from '../types';
import { ClipboardList, Users, CheckCircle, XCircle, Clock, Loader2, ArrowLeft, ChevronDown, Save, Calendar, BarChart3, Send, AlertTriangle, FileText, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { sortMadrasahClasses } from './Classes';
import { t } from '../translations';

interface AttendanceProps {
  lang: Language;
  madrasah: Madrasah | null;
  onBack: () => void;
  userId: string;
}

const Attendance: React.FC<AttendanceProps> = ({ lang, madrasah, onBack, userId }) => {
  const [activeTab, setActiveTab] = useState<'daily' | 'report'>('daily');
  const [classes, setClasses] = useState<Class[]>([]);
  const [selectedClass, setSelectedClass] = useState<Class | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<Record<string, 'present' | 'absent' | 'late'>>({});
  const [reportData, setReportData] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sendingAlerts, setSendingAlerts] = useState(false);
  const [showClassDropdown, setShowClassDropdown] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); 
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    if (madrasah) fetchClasses();
  }, [madrasah?.id]);

  useEffect(() => {
    if (selectedClass) {
      if (activeTab === 'daily') fetchStudents(selectedClass.id);
      else fetchReport(selectedClass.id);
    }
  }, [selectedClass?.id, activeTab, date, selectedMonth]);

  const fetchClasses = async () => {
    const { data } = await supabase.from('classes').select('*').eq('madrasah_id', madrasah?.id);
    if (data) setClasses(sortMadrasahClasses(data));
  };

  const fetchStudents = async (cid: string) => {
    setLoading(true);
    setFetchError(null);
    try {
      const { data: stdData } = await supabase.from('students').select('*').eq('class_id', cid).order('roll', { ascending: true });
      const { data: attData } = await supabase.from('attendance').select('*').eq('class_id', cid).eq('date', date);

      if (stdData) {
        setStudents(stdData);
        const initial: Record<string, 'present' | 'absent' | 'late'> = {};
        stdData.forEach(s => {
          const existing = attData?.find(a => a.student_id === s.id);
          initial[s.id] = existing ? (existing.status as any) : 'present';
        });
        setAttendance(initial);
      }
    } catch (e: any) { 
      console.error(e);
      setFetchError(e.message);
    } finally { setLoading(false); }
  };

  const fetchReport = async (cid: string) => {
    setLoading(true);
    setFetchError(null);
    try {
      const startOfMonth = `${selectedMonth}-01`;
      const endOfMonth = new Date(new Date(selectedMonth).getFullYear(), new Date(selectedMonth).getMonth() + 1, 0).toISOString().split('T')[0];

      const { data, error } = await supabase.rpc('get_attendance_report', {
        p_class_id: cid,
        p_start_date: startOfMonth,
        p_end_date: endOfMonth
      });

      if (error) throw error;
      if (data) setReportData(data);
    } catch (e: any) { 
      console.error(e);
      setFetchError(e.message);
    } finally { setLoading(false); }
  };

  const setStatus = (sid: string, status: 'present' | 'absent' | 'late') => {
    setAttendance(prev => ({ ...prev, [sid]: status }));
  };

  const handleSave = async () => {
    if (!madrasah || !selectedClass) return;
    setSaving(true);
    try {
      // Clean delete for sync
      const { error: delError } = await supabase.from('attendance').delete().eq('class_id', selectedClass.id).eq('date', date);
      if (delError) throw delError;

      const payload = Object.entries(attendance).map(([sid, status]) => ({
        madrasah_id: madrasah.id,
        class_id: selectedClass.id,
        student_id: sid,
        status: status,
        date: date,
        recorded_by: userId
      }));

      const { error } = await supabase.from('attendance').insert(payload);
      if (error) {
        if (error.message.includes('class_id') || error.message.includes('cache')) {
          throw new Error('ডাটাবেস কলাম (class_id) খুঁজে পাওয়া যাচ্ছে না। দয়া করে SQL এডিটর থেকে নতুন মাইগ্রেশন কোডটি রান করুন।');
        }
        throw error;
      }
      alert(t('success', lang));
    } catch (err: any) { 
      alert(err.message); 
    } finally { 
      setSaving(false); 
    }
  };

  const sendAbsentAlerts = async () => {
    if (!madrasah || !selectedClass) return;
    const absents = students.filter(s => attendance[s.id] === 'absent');
    if (absents.length === 0) {
        alert(lang === 'bn' ? 'কোনো অনুপস্থিত ছাত্র নেই!' : 'No absent students found!');
        return;
    }

    if (!confirm(lang === 'bn' ? `${absents.length} জন অভিভাবককে অনুপস্থিতি SMS পাঠাতে চান?` : `Send absence alerts to ${absents.length} guardians?`)) return;

    setSendingAlerts(true);
    try {
      const message = lang === 'bn' 
        ? `আস-সালামু আলাইকুম, আজ আপনার সন্তান মাদরাসায় অনুপস্থিত। অনুগ্রহ করে অনুপস্থিতির কারণ জানান।`
        : `As-Salamu Alaikum, your child is absent today. Please inform us of the reason.`;

      await smsApi.sendBulk(madrasah.id, absents, message);
      alert(t('sms_success', lang));
    } catch (err: any) { alert(err.message); } finally { setSendingAlerts(false); }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center text-white border border-white/20 shadow-xl active:scale-95"><ArrowLeft size={20}/></button>
          <h1 className="text-xl font-black text-white font-noto drop-shadow-md">{t('attendance_daily', lang)}</h1>
        </div>
        <button onClick={() => selectedClass && (activeTab === 'daily' ? fetchStudents(selectedClass.id) : fetchReport(selectedClass.id))} className="w-10 h-10 bg-white/10 text-white rounded-xl flex items-center justify-center active:scale-95"><RefreshCw size={18} /></button>
      </div>

      <div className="flex p-1 bg-white/10 rounded-[1.5rem] border border-white/20 shadow-lg">
        {(['daily', 'report'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all duration-300 ${activeTab === tab ? 'bg-white text-[#8D30F4] shadow-md' : 'text-white/60'}`}>
            {tab === 'daily' ? t('attendance_daily', lang) : t('attendance_report', lang)}
          </button>
        ))}
      </div>

      <div className="bg-white/95 backdrop-blur-xl p-6 rounded-[2.5rem] border border-white shadow-xl space-y-4">
        <div className="relative">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 mb-1.5 block">{t('class_select', lang)}</label>
          <button onClick={() => setShowClassDropdown(!showClassDropdown)} className="w-full h-14 px-6 rounded-2xl border-2 bg-slate-50 border-slate-100 flex items-center justify-between group active:scale-[0.99] transition-all">
            <span className="font-black text-[#2E0B5E] font-noto truncate">{selectedClass?.class_name || t('class_choose', lang)}</span>
            <ChevronDown size={20} className={`text-slate-300 transition-transform duration-300 ${showClassDropdown ? 'rotate-180' : ''}`} />
          </button>
          {showClassDropdown && (
            <div className="absolute top-full left-0 right-0 mt-3 bg-white rounded-[2rem] shadow-2xl border border-slate-100 z-[100] p-2 max-h-56 overflow-y-auto animate-in slide-in-from-top-2">
              {classes.map(cls => (
                <button key={cls.id} onClick={() => { setSelectedClass(cls); setShowClassDropdown(false); }} className={`w-full text-left px-5 py-4 rounded-xl mb-1 transition-all ${selectedClass?.id === cls.id ? 'bg-[#8D30F4] text-white shadow-lg' : 'hover:bg-slate-50 text-slate-700'}`}>
                  <span className="font-black font-noto text-[15px]">{cls.class_name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {activeTab === 'daily' ? (
          <div className="relative animate-in fade-in">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 mb-1.5 block">তারিখ</label>
            <div className="relative"><input type="date" className="w-full h-14 pl-14 pr-6 bg-slate-50 border-2 border-slate-100 rounded-2xl font-black text-[#2E0B5E] outline-none focus:border-[#8D30F4]/20 transition-all" value={date} onChange={(e) => setDate(e.target.value)} /><Calendar className="absolute left-5 top-4 text-[#8D30F4]" size={22}/></div>
          </div>
        ) : (
            <div className="relative animate-in fade-in">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 mb-1.5 block">মাস নির্বাচন করুন</label>
                <div className="relative"><input type="month" className="w-full h-14 pl-14 pr-6 bg-slate-50 border-2 border-slate-100 rounded-2xl font-black text-[#2E0B5E] outline-none focus:border-[#8D30F4]/20 transition-all" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} /><BarChart3 className="absolute left-5 top-4 text-[#8D30F4]" size={22}/></div>
            </div>
        )}
      </div>

      {fetchError && (
        <div className="p-5 bg-red-50 border border-red-100 rounded-[2rem] flex items-center gap-4 text-red-600 shadow-sm animate-in shake duration-500">
           <div className="w-12 h-12 bg-red-500 text-white rounded-2xl flex items-center justify-center shrink-0 shadow-lg"><AlertCircle size={24} /></div>
           <div className="min-w-0 flex-1">
              <p className="text-xs font-black uppercase tracking-wider">টেকনিক্যাল এরর!</p>
              <p className="text-[11px] font-bold opacity-80 leading-relaxed">{fetchError}</p>
           </div>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-white/50">
          <Loader2 className="animate-spin mb-4" size={40} />
          <p className="text-[10px] font-black uppercase tracking-[0.2em]">Syncing Data...</p>
        </div>
      ) : (
          <>
            {activeTab === 'daily' ? (
              students.length > 0 ? (
                <div className="space-y-3 animate-in slide-in-from-bottom-5">
                   <div className="flex items-center justify-between px-6">
                      <h4 className="text-[10px] font-black text-white/60 uppercase tracking-[0.2em]">ছাত্র তালিকা</h4>
                      <h4 className="text-[10px] font-black text-white/60 uppercase tracking-[0.2em]">উপস্থিতি</h4>
                   </div>
                   {students.map(s => (
                     <div key={s.id} className="bg-white/95 p-4 rounded-[1.8rem] border border-white shadow-md flex items-center justify-between group active:scale-[0.98] transition-all">
                        <div className="flex items-center gap-4 min-w-0">
                          <div className="w-11 h-11 bg-[#F2EBFF] text-[#8D30F4] rounded-[1.1rem] flex flex-col items-center justify-center border border-[#8D30F4]/10 shrink-0 shadow-inner">
                            <span className="text-[8px] font-black opacity-40 leading-none">ROLL</span>
                            <span className="text-base font-black leading-none mt-1">{s.roll || '-'}</span>
                          </div>
                          <h5 className="font-black text-[#2E0B5E] font-noto truncate text-lg">{s.student_name}</h5>
                        </div>
                        <div className="flex gap-2 shrink-0">
                           <button onClick={() => setStatus(s.id, 'present')} className={`w-11 h-11 rounded-[1.1rem] flex items-center justify-center transition-all ${attendance[s.id] === 'present' ? 'bg-green-500 text-white shadow-lg' : 'bg-slate-50 text-slate-300'}`} title="Present"><CheckCircle size={22}/></button>
                           <button onClick={() => setStatus(s.id, 'absent')} className={`w-11 h-11 rounded-[1.1rem] flex items-center justify-center transition-all ${attendance[s.id] === 'absent' ? 'bg-red-500 text-white shadow-lg' : 'bg-slate-50 text-slate-300'}`} title="Absent"><XCircle size={22}/></button>
                           <button onClick={() => setStatus(s.id, 'late')} className={`w-11 h-11 rounded-[1.1rem] flex items-center justify-center transition-all ${attendance[s.id] === 'late' ? 'bg-amber-500 text-white shadow-lg' : 'bg-slate-50 text-slate-300'}`} title="Late"><Clock size={22}/></button>
                        </div>
                     </div>
                   ))}
                   <div className="flex flex-col gap-4 mt-8">
                        <button onClick={handleSave} disabled={saving} className="w-full h-16 premium-btn text-white font-black rounded-full shadow-2xl flex items-center justify-center gap-3 text-lg border border-white/20 active:scale-95 transition-all">
                            {saving ? <Loader2 className="animate-spin" size={24} /> : <><Save size={24} strokeWidth={3} /> {t('save', lang)}</>}
                        </button>
                        <button onClick={sendAbsentAlerts} disabled={sendingAlerts} className="w-full h-14 bg-white/10 backdrop-blur-md text-white font-black rounded-full flex items-center justify-center gap-3 text-[13px] active:scale-95 transition-all border border-white/20 uppercase tracking-widest shadow-xl">
                            {sendingAlerts ? <Loader2 className="animate-spin" size={20} /> : <><Send size={20} className="text-white/60" /> {t('absent_alert', lang)}</>}
                        </button>
                   </div>
                </div>
              ) : <div className="text-center py-20 bg-white/10 rounded-[3rem] border-2 border-dashed border-white/20 mx-2 flex flex-col items-center">
                    <Users size={40} className="text-white/20 mb-4" />
                    <p className="text-white/40 uppercase text-xs font-black tracking-[0.2em]">{selectedClass ? 'No Students Found' : 'Please select a class'}</p>
                  </div>
            ) : (
                <div className="space-y-4 animate-in slide-in-from-bottom-5">
                    {reportData.length > 0 ? reportData.map((item: any) => {
                        const pct = item.total_days > 0 ? Math.round((item.present_days / item.total_days) * 100) : 0;
                        return (
                            <div key={item.student_id} className="bg-white/95 p-6 rounded-[2.5rem] border border-white shadow-lg space-y-4 group">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4 min-w-0">
                                        <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center font-black text-[#A179FF] border border-slate-100 shadow-inner shrink-0">#{item.roll || '-'}</div>
                                        <div className="min-w-0">
                                            <h5 className="font-black text-[#2E0B5E] font-noto text-[17px] truncate leading-tight mb-0.5">{item.student_name}</h5>
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Attendance Status</p>
                                        </div>
                                    </div>
                                    <div className={`text-2xl font-black ${pct >= 90 ? 'text-green-500' : pct >= 75 ? 'text-amber-500' : 'text-red-500'}`}>{pct}%</div>
                                </div>
                                <div className="w-full h-3 bg-slate-50 rounded-full overflow-hidden border border-slate-100 flex shadow-inner">
                                    <div className="h-full bg-gradient-to-r from-green-400 to-emerald-500 transition-all duration-1000 shadow-[0_0_10px_rgba(16,185,129,0.3)]" style={{ width: `${pct}%` }}></div>
                                </div>
                                <div className="grid grid-cols-3 gap-2">
                                   <div className="bg-slate-50/50 p-2.5 rounded-xl text-center border border-slate-50"><p className="text-[8px] font-black text-slate-400 uppercase mb-0.5">Total</p><p className="font-black text-[#2E0B5E] text-sm">{item.total_days}</p></div>
                                   <div className="bg-green-50/50 p-2.5 rounded-xl text-center border border-green-50"><p className="text-[8px] font-black text-green-400 uppercase mb-0.5">Present</p><p className="font-black text-green-600 text-sm">{item.present_days}</p></div>
                                   <div className="bg-red-50/50 p-2.5 rounded-xl text-center border border-red-50"><p className="text-[8px] font-black text-red-400 uppercase mb-0.5">Absent</p><p className="font-black text-red-600 text-sm">{item.absent_days}</p></div>
                                </div>
                            </div>
                        );
                    }) : <div className="text-center py-20 bg-white/10 rounded-[3rem] border-2 border-dashed border-white/20 mx-2 flex flex-col items-center">
                            <FileText size={40} className="text-white/20 mb-4" />
                            <p className="text-white/40 uppercase text-xs font-black tracking-[0.2em]">No Attendance Records</p>
                         </div>}
                </div>
            )}
          </>
      )}
    </div>
  );
};

export default Attendance;
