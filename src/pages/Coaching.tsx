
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { Madrasah, CoachingBatch, Student, Language, UserRole, Teacher } from '../types';
import { Plus, X, Loader2, Save, Users, BookOpen, ChevronLeft, Trash2, Calendar, Clock, GraduationCap, Search, CheckCircle2 } from 'lucide-react';

interface CoachingProps {
  lang: Language;
  madrasah: Madrasah | null;
  onBack: () => void;
  role: UserRole;
}

const Coaching: React.FC<CoachingProps> = ({ lang, madrasah, onBack, role }) => {
  const [batches, setBatches] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showAddBatch, setShowAddBatch] = useState(false);
  const [showEnroll, setShowEnroll] = useState<string | null>(null);
  
  const [batchName, setBatchName] = useState('');
  const [feeAmount, setFeeAmount] = useState('');
  const [teacherId, setTeacherId] = useState('');
  const [schedule, setSchedule] = useState('');

  const [searchQuery, setSearchQuery] = useState('');
  const [students, setStudents] = useState<Student[]>([]);
  const [enrolledStudents, setEnrolledStudents] = useState<string[]>([]);

  useEffect(() => {
    if (madrasah) {
      fetchBatches();
      fetchTeachers();
    }
  }, [madrasah]);

  const fetchBatches = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('coaching_batches')
      .select('*, teachers(name)')
      .eq('madrasah_id', madrasah?.id)
      .order('created_at', { ascending: false });
    if (data) setBatches(data);
    setLoading(false);
  };

  const fetchTeachers = async () => {
    const { data } = await supabase.from('teachers').select('*').eq('madrasah_id', madrasah?.id);
    if (data) setTeachers(data);
  };

  const handleAddBatch = async () => {
    if (!batchName || !feeAmount || !madrasah) return;
    setIsSaving(true);
    try {
      const { error } = await supabase.from('coaching_batches').insert({
        madrasah_id: madrasah.id,
        batch_name: batchName.trim(),
        fee_amount: parseFloat(feeAmount),
        teacher_id: teacherId || null,
        schedule: schedule.trim()
      });
      if (error) throw error;
      setBatchName('');
      setFeeAmount('');
      setTeacherId('');
      setSchedule('');
      setShowAddBatch(false);
      fetchBatches();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const fetchStudentsForEnroll = async (batchId: string) => {
    const { data: studentsData } = await supabase
      .from('students')
      .select('*, classes(class_name)')
      .eq('madrasah_id', madrasah?.id);
    
    const { data: enrolledData } = await supabase
      .from('student_coaching')
      .select('student_id')
      .eq('batch_id', batchId);
    
    if (studentsData) setStudents(studentsData);
    if (enrolledData) setEnrolledStudents(enrolledData.map(e => e.student_id));
  };

  const toggleEnrollment = async (studentId: string, batchId: string) => {
    const isEnrolled = enrolledStudents.includes(studentId);
    if (isEnrolled) {
      await supabase.from('student_coaching').delete().eq('student_id', studentId).eq('batch_id', batchId);
      setEnrolledStudents(prev => prev.filter(id => id !== studentId));
    } else {
      await supabase.from('student_coaching').insert({ student_id: studentId, batch_id: batchId });
      setEnrolledStudents(prev => [...prev, studentId]);
    }
  };

  const filteredStudents = students.filter(s => 
    s.student_name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    s.guardian_phone.includes(searchQuery)
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-slate-400 border border-slate-100 shadow-sm">
            <ChevronLeft size={20}/>
          </button>
          <h1 className="text-xl font-black text-[#1E293B] font-noto">কোচিং ব্যাচ</h1>
        </div>
        <button onClick={() => setShowAddBatch(true)} className="w-10 h-10 bg-[#2563EB] text-white rounded-xl shadow-premium flex items-center justify-center active:scale-95 transition-all">
          <Plus size={20}/>
        </button>
      </div>

      <div className="space-y-4">
        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="animate-spin text-blue-500" /></div>
        ) : batches.length > 0 ? (
          batches.map(batch => (
            <div key={batch.id} className="bg-white p-5 rounded-[2.2rem] border border-slate-100 shadow-bubble space-y-4">
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <h3 className="font-black text-[#1E3A8A] text-lg font-noto">{batch.batch_name}</h3>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-[10px] font-black text-[#2563EB] uppercase tracking-widest flex items-center gap-1">
                      <GraduationCap size={10} /> {batch.teachers?.name || 'No Teacher'}
                    </span>
                    {batch.schedule && (
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                        <Clock size={10} /> {batch.schedule}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xl font-black text-[#2563EB]">৳{batch.fee_amount}</p>
                  <p className="text-[8px] font-black text-slate-300 uppercase">মাসিক ফি</p>
                </div>
              </div>
              <div className="flex gap-2 pt-2 border-t border-slate-50">
                <button 
                  onClick={() => { setShowEnroll(batch.id); fetchStudentsForEnroll(batch.id); }}
                  className="flex-1 py-3 bg-blue-50 text-[#2563EB] rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all"
                >
                  <Users size={14} /> ছাত্র ভর্তি করুন
                </button>
                <button 
                  onClick={async () => {
                    if (confirm('Are you sure?')) {
                      await supabase.from('coaching_batches').delete().eq('id', batch.id);
                      fetchBatches();
                    }
                  }}
                  className="w-12 h-12 bg-red-50 text-red-400 rounded-xl flex items-center justify-center active:scale-95 transition-all"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-20 bg-slate-50 rounded-[3rem] border-2 border-dashed border-slate-200 mx-2">
            <BookOpen size={40} className="mx-auto text-slate-200 mb-4" />
            <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">No batches found</p>
          </div>
        )}
      </div>

      {showAddBatch && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xl z-[999] flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-sm rounded-[3rem] p-8 space-y-6 animate-in zoom-in-95 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-black text-[#1E3A8A]">নতুন কোচিং ব্যাচ</h3>
              <button onClick={() => setShowAddBatch(false)} className="w-9 h-9 bg-slate-50 text-slate-300 rounded-xl flex items-center justify-center"><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2">ব্যাচের নাম</label>
                <input type="text" className="w-full h-14 bg-slate-50 rounded-2xl px-6 font-black text-sm outline-none border-2 border-transparent focus:border-[#2563EB]/20" placeholder="যেমন: গণিত স্পেশাল" value={batchName} onChange={(e) => setBatchName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2">মাসিক ফি</label>
                <input type="number" className="w-full h-14 bg-slate-50 rounded-2xl px-6 font-black text-lg outline-none border-2 border-transparent focus:border-[#2563EB]/20" placeholder="0" value={feeAmount} onChange={(e) => setFeeAmount(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2">শিক্ষক</label>
                <select className="w-full h-14 bg-slate-50 rounded-2xl px-6 font-black text-sm outline-none border-2 border-transparent focus:border-[#2563EB]/20 appearance-none" value={teacherId} onChange={(e) => setTeacherId(e.target.value)}>
                  <option value="">শিক্ষক নির্বাচন করুন</option>
                  {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2">সময়সূচী</label>
                <input type="text" className="w-full h-14 bg-slate-50 rounded-2xl px-6 font-black text-sm outline-none border-2 border-transparent focus:border-[#2563EB]/20" placeholder="যেমন: শনি-সোম ৪টা" value={schedule} onChange={(e) => setSchedule(e.target.value)} />
              </div>
              <button 
                onClick={handleAddBatch} 
                disabled={isSaving || !batchName || !feeAmount} 
                className="w-full py-5 bg-[#2563EB] text-white font-black rounded-full shadow-premium flex items-center justify-center gap-3 active:scale-95 transition-all"
              >
                {isSaving ? <Loader2 className="animate-spin" size={20} /> : <><Save size={20}/> ব্যাচ তৈরি করুন</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {showEnroll && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xl z-[999] flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-sm rounded-[3rem] p-8 space-y-6 animate-in zoom-in-95 shadow-2xl flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between shrink-0">
              <h3 className="text-xl font-black text-[#1E3A8A]">ছাত্র ভর্তি</h3>
              <button onClick={() => setShowEnroll(null)} className="w-9 h-9 bg-slate-50 text-slate-300 rounded-xl flex items-center justify-center"><X size={20} /></button>
            </div>
            <div className="relative shrink-0">
              <input 
                type="text" 
                className="w-full h-12 bg-slate-50 rounded-xl px-10 font-bold text-xs outline-none border border-slate-100" 
                placeholder="ছাত্রের নাম বা ফোন দিয়ে খুঁজুন..." 
                value={searchQuery} 
                onChange={(e) => setSearchQuery(e.target.value)} 
              />
              <Search className="absolute left-3 top-3.5 text-slate-300" size={16} />
            </div>
            <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
              {filteredStudents.map(student => (
                <div 
                  key={student.id} 
                  onClick={() => toggleEnrollment(student.id, showEnroll)}
                  className={`p-4 rounded-2xl border transition-all flex items-center justify-between cursor-pointer ${enrolledStudents.includes(student.id) ? 'bg-emerald-50 border-emerald-100' : 'bg-slate-50 border-slate-100 hover:border-slate-200'}`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${enrolledStudents.includes(student.id) ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-white border-slate-200'}`}>
                      {enrolledStudents.includes(student.id) && <CheckCircle2 size={14} />}
                    </div>
                    <div>
                      <p className="text-sm font-black text-[#1E3A8A] font-noto">{student.student_name}</p>
                      <p className="text-[9px] font-bold text-slate-400 uppercase">{student.classes?.class_name} • Roll: {student.roll}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <button 
              onClick={() => setShowEnroll(null)} 
              className="w-full py-4 bg-[#2563EB] text-white font-black rounded-full shadow-premium active:scale-95 transition-all text-sm shrink-0"
            >
              সম্পন্ন
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Coaching;
