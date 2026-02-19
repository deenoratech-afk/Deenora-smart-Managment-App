
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { Madrasah, Class, Student, Language, Attendance as AttendanceType } from '../types';
import { ClipboardList, Users, CheckCircle, XCircle, Clock, Loader2, ArrowLeft, ChevronDown, Save, Calendar } from 'lucide-react';
import { sortMadrasahClasses } from './Classes';

interface AttendanceProps {
  lang: Language;
  madrasah: Madrasah | null;
  onBack: () => void;
  userId: string;
}

const Attendance: React.FC<AttendanceProps> = ({ lang, madrasah, onBack, userId }) => {
  const [classes, setClasses] = useState<Class[]>([]);
  const [selectedClass, setSelectedClass] = useState<Class | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<Record<string, 'present' | 'absent' | 'late'>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showClassDropdown, setShowClassDropdown] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    if (madrasah) fetchClasses();
  }, [madrasah?.id]);

  useEffect(() => {
    if (selectedClass) fetchStudents(selectedClass.id);
  }, [selectedClass?.id]);

  const fetchClasses = async () => {
    const { data } = await supabase.from('classes').select('*').eq('madrasah_id', madrasah?.id);
    if (data) setClasses(sortMadrasahClasses(data));
  };

  const fetchStudents = async (cid: string) => {
    setLoading(true);
    try {
      const { data } = await supabase.from('students').select('*').eq('class_id', cid).order('roll', { ascending: true });
      if (data) {
        setStudents(data);
        const initial: Record<string, 'present' | 'absent' | 'late'> = {};
        data.forEach(s => initial[s.id] = 'present');
        setAttendance(initial);
      }
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const setStatus = (sid: string, status: 'present' | 'absent' | 'late') => {
    setAttendance(prev => ({ ...prev, [sid]: status }));
  };

  const handleSave = async () => {
    if (!madrasah || !selectedClass) return;
    setSaving(true);
    try {
      const payload = Object.entries(attendance).map(([sid, status]) => ({
        madrasah_id: madrasah.id,
        student_id: sid,
        status: status,
        date: date,
        recorded_by: userId
      }));

      const { error } = await supabase.from('attendance').insert(payload);
      if (error) throw error;
      alert('উপস্থিতি সফলভাবে সংরক্ষণ করা হয়েছে!');
      onBack();
    } catch (err: any) { alert(err.message); } finally { setSaving(false); }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      <div className="flex items-center gap-3 px-2">
        <button onClick={onBack} className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center text-white border border-white/20"><ArrowLeft size={20}/></button>
        <h1 className="text-xl font-black text-white font-noto">ছাত্র হাজিরা</h1>
      </div>

      <div className="bg-white/95 backdrop-blur-xl p-6 rounded-[2.5rem] border border-white shadow-xl space-y-4">
        <div className="relative">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 mb-1.5 block">ক্লাস নির্বাচন করুন</label>
          <button onClick={() => setShowClassDropdown(!showClassDropdown)} className="w-full h-14 px-6 rounded-2xl border-2 bg-slate-50 border-slate-100 flex items-center justify-between">
            <span className="font-black text-[#2E0B5E] font-noto">{selectedClass?.class_name || 'সিলেক্ট ক্লাস'}</span>
            <ChevronDown size={20} className="text-slate-300" />
          </button>
          {showClassDropdown && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-slate-100 z-[100] p-2 max-h-48 overflow-y-auto">
              {classes.map(cls => (
                <button key={cls.id} onClick={() => { setSelectedClass(cls); setShowClassDropdown(false); }} className={`w-full text-left px-5 py-3 rounded-xl mb-1 ${selectedClass?.id === cls.id ? 'bg-[#8D30F4] text-white' : 'hover:bg-slate-50 text-slate-700'}`}>
                  <span className="font-black font-noto">{cls.class_name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="relative">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 mb-1.5 block">তারিখ</label>
          <div className="relative"><input type="date" className="w-full h-14 px-12 bg-slate-50 border-2 border-slate-100 rounded-2xl font-black text-[#2E0B5E]" value={date} onChange={(e) => setDate(e.target.value)} /><Calendar className="absolute left-4 top-4 text-[#8D30F4]" size={20}/></div>
        </div>
      </div>

      {loading ? <div className="flex justify-center py-20"><Loader2 className="animate-spin text-white" /></div> : students.length > 0 && (
        <div className="space-y-3 animate-in slide-in-from-bottom-5">
           <div className="bg-white/10 p-3 rounded-2xl flex items-center justify-between text-white/60 text-[10px] font-black uppercase tracking-widest px-6">
              <span>রোল / নাম</span>
              <span>স্ট্যাটাস</span>
           </div>
           {students.map(s => (
             <div key={s.id} className="bg-white/95 p-4 rounded-[1.8rem] border border-white shadow-md flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-[#F2EBFF] text-[#8D30F4] rounded-xl flex flex-col items-center justify-center border border-[#8D30F4]/10 shrink-0">
                    <span className="text-[8px] font-black opacity-40">ROLL</span>
                    <span className="text-sm font-black">{s.roll || '-'}</span>
                  </div>
                  <h5 className="font-black text-[#2E0B5E] font-noto truncate max-w-[120px]">{s.student_name}</h5>
                </div>
                <div className="flex gap-2">
                   <button onClick={() => setStatus(s.id, 'present')} className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${attendance[s.id] === 'present' ? 'bg-green-500 text-white shadow-lg' : 'bg-slate-50 text-slate-300'}`}><CheckCircle size={20}/></button>
                   <button onClick={() => setStatus(s.id, 'absent')} className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${attendance[s.id] === 'absent' ? 'bg-red-500 text-white shadow-lg' : 'bg-slate-50 text-slate-300'}`}><XCircle size={20}/></button>
                   <button onClick={() => setStatus(s.id, 'late')} className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${attendance[s.id] === 'late' ? 'bg-amber-500 text-white shadow-lg' : 'bg-slate-50 text-slate-300'}`}><Clock size={20}/></button>
                </div>
             </div>
           ))}
           <button onClick={handleSave} disabled={saving} className="w-full h-16 premium-btn text-white font-black rounded-full shadow-2xl flex items-center justify-center gap-3 text-lg mt-4">
              {saving ? <Loader2 className="animate-spin" /> : <><Save size={24}/> হাজিরা সেভ করুন</>}
           </button>
        </div>
      )}
    </div>
  );
};

export default Attendance;
