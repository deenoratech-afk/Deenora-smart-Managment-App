
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { Madrasah, Class, Student, Exam, ExamSubject, Language, UserRole } from '../types';
// Fixed: Added AlertCircle to the import list from lucide-react
import { GraduationCap, Plus, ChevronRight, BookOpen, Trophy, Save, X, Edit3, Trash2, Loader2, ArrowLeft, Calendar, LayoutGrid, CheckCircle2, FileText, Send, User, Hash, Star, AlertCircle } from 'lucide-react';
import { t } from '../translations';
import { sortMadrasahClasses } from './Classes';

interface ExamsProps {
  lang: Language;
  madrasah: Madrasah | null;
  onBack: () => void;
  role: UserRole;
}

const Exams: React.FC<ExamsProps> = ({ lang, madrasah, onBack, role }) => {
  const [view, setView] = useState<'list' | 'subjects' | 'marks' | 'report'>('list');
  const [exams, setExams] = useState<Exam[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [selectedExam, setSelectedExam] = useState<Exam | null>(null);
  const [subjects, setSubjects] = useState<ExamSubject[]>([]);
  const [marksData, setMarksData] = useState<any[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showAddExam, setShowAddExam] = useState(false);
  const [showAddSubject, setShowAddSubject] = useState(false);

  // Form states
  const [examName, setExamName] = useState('');
  const [examDate, setExamDate] = useState(new Date().toISOString().split('T')[0]);
  const [classId, setClassId] = useState('');
  const [subName, setSubName] = useState('');
  const [fullMarks, setFullMarks] = useState('100');
  const [passMarks, setPassMarks] = useState('33');

  useEffect(() => {
    if (madrasah) {
      fetchExams();
      fetchClasses();
    }
  }, [madrasah?.id, view]);

  const fetchExams = async () => {
    const { data } = await supabase.from('exams').select('*, classes(class_name)').eq('madrasah_id', madrasah?.id).order('created_at', { ascending: false });
    if (data) setExams(data);
    setLoading(false);
  };

  const fetchClasses = async () => {
    const { data } = await supabase.from('classes').select('*').eq('madrasah_id', madrasah?.id);
    if (data) setClasses(sortMadrasahClasses(data));
  };

  const fetchSubjects = async (examId: string) => {
    setLoading(true);
    const { data } = await supabase.from('exam_subjects').select('*').eq('exam_id', examId);
    if (data) setSubjects(data);
    setLoading(false);
  };

  const fetchMarkEntryData = async (examId: string) => {
    setLoading(true);
    // 1. Fetch Students of the exam's class
    const { data: stds } = await supabase.from('students').select('*').eq('class_id', selectedExam?.class_id).order('roll', { ascending: true });
    // 2. Fetch existing marks
    const { data: marks } = await supabase.from('exam_marks').select('*').eq('exam_id', examId);
    
    if (stds) setStudents(stds);
    if (marks) {
        const initialMarks: any = {};
        marks.forEach(m => {
            if (!initialMarks[m.student_id]) initialMarks[m.student_id] = {};
            initialMarks[m.student_id][m.subject_id] = m.marks_obtained;
        });
        setMarksData(initialMarks);
    }
    setLoading(false);
  };

  const fetchRanking = async (examId: string) => {
    setLoading(true);
    const { data } = await supabase.rpc('get_exam_ranking', { p_exam_id: examId });
    if (data) setMarksData(data); // Using marksData state for ranking list
    setLoading(false);
  };

  const handleAddExam = async () => {
    if (!madrasah || !examName || !classId) return;
    setIsSaving(true);
    const { error } = await supabase.from('exams').insert({
      madrasah_id: madrasah.id,
      class_id: classId,
      exam_name: examName,
      exam_date: examDate
    });
    if (!error) {
      setShowAddExam(false);
      fetchExams();
    }
    setIsSaving(false);
  };

  const handleAddSubject = async () => {
    if (!selectedExam || !subName) return;
    setIsSaving(true);
    const { error } = await supabase.from('exam_subjects').insert({
      exam_id: selectedExam.id,
      subject_name: subName,
      full_marks: parseInt(fullMarks),
      pass_marks: parseInt(passMarks)
    });
    if (!error) {
      setShowAddSubject(false);
      setSubName('');
      fetchSubjects(selectedExam.id);
    }
    setIsSaving(false);
  };

  const handleSaveMarks = async () => {
    if (!selectedExam) return;
    setIsSaving(true);
    const payload: any[] = [];
    Object.entries(marksData).forEach(([studentId, subMarks]: any) => {
        Object.entries(subMarks).forEach(([subjectId, marks]) => {
            payload.push({
                exam_id: selectedExam.id,
                student_id: studentId,
                subject_id: subjectId,
                marks_obtained: parseFloat(marks as string)
            });
        });
    });

    // Upsert logic
    for (const row of payload) {
        await supabase.from('exam_marks').upsert(row);
    }
    alert(t('success', lang));
    setIsSaving(false);
  };

  const calculateGrade = (obtained: number, full: number) => {
    const pct = (obtained / full) * 100;
    if (pct >= 80) return 'A+';
    if (pct >= 70) return 'A';
    if (pct >= 60) return 'A-';
    if (pct >= 50) return 'B';
    if (pct >= 40) return 'C';
    if (pct >= 33) return 'D';
    return 'F';
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-3">
          <button onClick={view === 'list' ? onBack : () => setView('list')} className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center text-white border border-white/20">
            <ArrowLeft size={20}/>
          </button>
          <h1 className="text-xl font-black text-white font-noto">
            {view === 'list' ? t('exams', lang) : selectedExam?.exam_name}
          </h1>
        </div>
        {view === 'list' && role === 'madrasah_admin' && (
            <button onClick={() => setShowAddExam(true)} className="w-10 h-10 bg-white text-[#8D30F4] rounded-xl shadow-xl flex items-center justify-center active:scale-95 transition-all"><Plus size={20}/></button>
        )}
      </div>

      {view === 'list' && (
        <div className="space-y-4">
          {loading ? <div className="flex justify-center py-10"><Loader2 className="animate-spin text-white" /></div> : exams.map(exam => (
            <div key={exam.id} className="bg-white/95 p-5 rounded-[2.5rem] border border-white shadow-xl space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-[#F2EBFF] text-[#8D30F4] rounded-2xl flex items-center justify-center shadow-inner"><GraduationCap size={24}/></div>
                        <div>
                            <h3 className="text-lg font-black text-[#2E0B5E] font-noto leading-tight">{exam.exam_name}</h3>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{exam.classes?.class_name}</p>
                        </div>
                    </div>
                    <div className="text-[10px] font-black text-slate-300 uppercase">{new Date(exam.exam_date).toLocaleDateString()}</div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                    <button onClick={() => { setSelectedExam(exam); setView('subjects'); fetchSubjects(exam.id); }} className="py-2.5 bg-slate-50 text-slate-500 rounded-xl text-[9px] font-black uppercase tracking-widest border border-slate-100">{t('subject', lang)}</button>
                    <button onClick={() => { setSelectedExam(exam); setView('marks'); fetchSubjects(exam.id); fetchMarkEntryData(exam.id); }} className="py-2.5 bg-[#F2EBFF] text-[#8D30F4] rounded-xl text-[9px] font-black uppercase tracking-widest border border-[#8D30F4]/10">{t('enter_marks', lang)}</button>
                    <button onClick={() => { setSelectedExam(exam); setView('report'); fetchRanking(exam.id); }} className="py-2.5 bg-[#2E0B5E] text-white rounded-xl text-[9px] font-black uppercase tracking-widest">{t('rank', lang)}</button>
                </div>
            </div>
          ))}
        </div>
      )}

      {view === 'subjects' && (
        <div className="space-y-4">
           <button onClick={() => setShowAddSubject(true)} className="w-full py-5 bg-white rounded-[2.2rem] text-[#8D30F4] font-black flex items-center justify-center gap-3 shadow-xl active:scale-95 transition-all">
              <Plus size={24} strokeWidth={3} /> বিষয় যোগ করুন
           </button>
           <div className="space-y-3">
              {subjects.map(s => (
                <div key={s.id} className="bg-white/95 p-5 rounded-[2rem] border border-white shadow-md flex items-center justify-between">
                   <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-slate-50 text-slate-400 rounded-xl flex items-center justify-center"><BookOpen size={20}/></div>
                      <h5 className="font-black text-[#2E0B5E] font-noto text-lg">{s.subject_name}</h5>
                   </div>
                   <div className="text-right">
                      <p className="text-[9px] font-black text-slate-400 uppercase">পূর্ণমান: {s.full_marks}</p>
                      <p className="text-[9px] font-black text-red-400 uppercase">পাস: {s.pass_marks}</p>
                   </div>
                </div>
              ))}
           </div>
        </div>
      )}

      {view === 'marks' && (
        <div className="space-y-4">
            <div className="bg-white/95 p-5 rounded-[2.5rem] shadow-xl border border-white overflow-x-auto no-scrollbar">
                <table className="w-full text-left">
                    <thead>
                        <tr className="border-b border-slate-50">
                            <th className="py-4 text-[10px] font-black text-slate-400 uppercase pr-4">Roll/Name</th>
                            {subjects.map(s => (
                                <th key={s.id} className="py-4 text-[10px] font-black text-slate-400 uppercase text-center min-w-[80px]">{s.subject_name}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {students.map(std => (
                            <tr key={std.id} className="border-b border-slate-50 last:border-0">
                                <td className="py-4 pr-4">
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-black text-[#8D30F4] leading-none mb-1">#{std.roll}</span>
                                        <span className="font-black text-[#2E0B5E] text-xs font-noto truncate max-w-[100px]">{std.student_name}</span>
                                    </div>
                                </td>
                                {subjects.map(sub => (
                                    <td key={sub.id} className="py-4 px-2">
                                        <input 
                                            type="number" 
                                            className="w-full h-10 bg-slate-50 border border-slate-100 rounded-lg text-center font-black text-xs outline-none focus:border-[#8D30F4]"
                                            value={marksData[std.id]?.[sub.id] || ''}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                setMarksData(prev => ({
                                                    ...prev,
                                                    [std.id]: {
                                                        ...prev[std.id],
                                                        [sub.id]: val
                                                    }
                                                }));
                                            }}
                                        />
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <button onClick={handleSaveMarks} disabled={isSaving} className="w-full h-16 premium-btn text-white font-black rounded-full shadow-2xl flex items-center justify-center gap-3 text-lg">
                {isSaving ? <Loader2 className="animate-spin" /> : <><Save size={24}/> নম্বর সংরক্ষণ করুন</>}
            </button>
        </div>
      )}

      {view === 'report' && (
          <div className="space-y-4">
              <div className="bg-[#1A0B2E] p-6 rounded-[2.5rem] text-white flex items-center justify-between shadow-2xl">
                  <div>
                      <p className="text-[10px] font-black uppercase opacity-60">সেরা ফলাফল</p>
                      <h3 className="text-2xl font-black font-noto">{marksData[0]?.student_name || 'N/A'}</h3>
                  </div>
                  <Trophy size={40} className="text-amber-400" />
              </div>

              <div className="space-y-3">
                  {marksData.map((item: any) => (
                      <div key={item.student_id} className="bg-white/95 p-5 rounded-[2.2rem] border border-white shadow-md flex items-center justify-between">
                          <div className="flex items-center gap-4 min-w-0">
                              <div className="w-10 h-10 bg-[#F2EBFF] text-[#8D30F4] rounded-xl flex items-center justify-center font-black shrink-0">{item.rank}</div>
                              <div className="min-w-0">
                                  <h5 className="font-black text-[#2E0B5E] font-noto truncate leading-none mb-1">{item.student_name}</h5>
                                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Roll: {item.roll} | Total: {item.total_marks}</p>
                              </div>
                          </div>
                          <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase border ${item.pass_status ? 'bg-green-50 text-green-500 border-green-100' : 'bg-red-50 text-red-500 border-red-100'}`}>
                             {item.pass_status ? 'Passed' : 'Failed'}
                          </div>
                      </div>
                  ))}
              </div>
          </div>
      )}

      {/* MODALS */}
      {showAddExam && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xl z-[999] flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-sm rounded-[3rem] p-8 space-y-6 animate-in zoom-in-95">
             <div className="flex items-center justify-between">
               <h3 className="text-xl font-black text-[#2E0B5E]">নতুন পরীক্ষা যোগ করুন</h3>
               <button onClick={() => setShowAddExam(false)}><X size={24} className="text-slate-300" /></button>
             </div>
             <div className="space-y-4">
                <div className="relative"><input type="text" className="w-full h-14 bg-slate-50 rounded-2xl px-12 font-black text-sm outline-none border-2 border-transparent focus:border-[#8D30F4]/20" placeholder="পরীক্ষার নাম (যেমন: বার্ষিক পরীক্ষা)" value={examName} onChange={(e) => setExamName(e.target.value)} /><BookOpen className="absolute left-4 top-4 text-slate-300" size={20}/></div>
                <div className="relative"><input type="date" className="w-full h-14 bg-slate-50 rounded-2xl px-12 font-black text-sm outline-none border-2 border-transparent focus:border-[#8D30F4]/20" value={examDate} onChange={(e) => setExamDate(e.target.value)} /><Calendar className="absolute left-4 top-4 text-slate-300" size={20}/></div>
                <div className="relative">
                    <select className="w-full h-14 bg-slate-50 rounded-2xl px-12 font-black text-sm outline-none border-2 border-transparent focus:border-[#8D30F4]/20 appearance-none" value={classId} onChange={(e) => setClassId(e.target.value)}>
                        <option value="">ক্লাস বেছে নিন</option>
                        {classes.map(c => <option key={c.id} value={c.id}>{c.class_name}</option>)}
                    </select>
                    <LayoutGrid className="absolute left-4 top-4 text-slate-300" size={20}/>
                </div>
                <button onClick={handleAddExam} disabled={isSaving} className="w-full py-5 bg-[#8D30F4] text-white font-black rounded-full shadow-xl flex items-center justify-center gap-3 active:scale-95 transition-all">
                  {isSaving ? <Loader2 className="animate-spin" /> : <><Save size={20}/> পরীক্ষা তৈরি করুন</>}
                </button>
             </div>
          </div>
        </div>
      )}

      {showAddSubject && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xl z-[999] flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-sm rounded-[3rem] p-8 space-y-6 animate-in zoom-in-95">
             <div className="flex items-center justify-between">
               <h3 className="text-xl font-black text-[#2E0B5E]">বিষয় যোগ করুন</h3>
               <button onClick={() => setShowAddSubject(false)}><X size={24} className="text-slate-300" /></button>
             </div>
             <div className="space-y-4">
                <div className="relative"><input type="text" className="w-full h-14 bg-slate-50 rounded-2xl px-12 font-black text-sm outline-none border-2 border-transparent focus:border-[#8D30F4]/20" placeholder="বিষয়ের নাম (যেমন: কুরআন)" value={subName} onChange={(e) => setSubName(e.target.value)} /><Tag className="absolute left-4 top-4 text-slate-300" size={20}/></div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="relative"><input type="number" className="w-full h-14 bg-slate-50 rounded-2xl px-12 font-black text-sm outline-none border-2 border-transparent focus:border-[#8D30F4]/20" placeholder="পূর্ণমান" value={fullMarks} onChange={(e) => setFullMarks(e.target.value)} /><Star className="absolute left-4 top-4 text-slate-300" size={20}/></div>
                    <div className="relative"><input type="number" className="w-full h-14 bg-slate-50 rounded-2xl px-12 font-black text-sm outline-none border-2 border-transparent focus:border-[#8D30F4]/20" placeholder="পাস" value={passMarks} onChange={(e) => setPassMarks(e.target.value)} /><AlertCircle className="absolute left-4 top-4 text-slate-300" size={20}/></div>
                </div>
                <button onClick={handleAddSubject} disabled={isSaving} className="w-full py-5 bg-[#8D30F4] text-white font-black rounded-full shadow-xl flex items-center justify-center gap-3 active:scale-95 transition-all">
                  {isSaving ? <Loader2 className="animate-spin" /> : 'বিষয় সেভ করুন'}
                </button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

const Tag = ({ size, className }: { size: number, className: string }) => <BookOpen size={size} className={className} />;

export default Exams;
