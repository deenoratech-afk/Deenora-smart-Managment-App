
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { Madrasah, Class, Student, Exam, ExamSubject, Language, UserRole } from '../types';
import { GraduationCap, Plus, ChevronRight, BookOpen, Trophy, Save, X, Edit3, Trash2, Loader2, ArrowLeft, Calendar, LayoutGrid, CheckCircle2, FileText, Send, User, Hash, Star, AlertCircle, TrendingUp } from 'lucide-react';
import { t } from '../translations';
import { sortMadrasahClasses } from './Classes';
import SmartResultAnalytics from '../components/SmartResultAnalytics';

interface ExamsProps {
  lang: Language;
  madrasah: Madrasah | null;
  onBack: () => void;
  role: UserRole;
}

const Exams: React.FC<ExamsProps> = ({ lang, madrasah, onBack, role }) => {
  const [view, setView] = useState<'list' | 'subjects' | 'marks' | 'report' | 'insights'>('list');
  const [exams, setExams] = useState<Exam[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [selectedExam, setSelectedExam] = useState<Exam | null>(null);
  const [subjects, setSubjects] = useState<ExamSubject[]>([]);
  const [marksData, setMarksData] = useState<any>({});
  const [rankingData, setRankingData] = useState<any[]>([]);
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

  const fetchMarkEntryData = async (examId: string, classId: string) => {
    setLoading(true);
    // 1. Fetch Students of the exam's class
    const { data: stds } = await supabase.from('students').select('*').eq('class_id', classId).order('roll', { ascending: true });
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
    try {
      const { data } = await supabase.rpc('get_exam_ranking', { p_exam_id: examId });
      setRankingData(data || []);
    } catch (e) {
      console.error(e);
      setRankingData([]);
    }
    setLoading(false);
  };

  const getGradeInfo = (totalMarks: number, passStatus: boolean) => {
    if (!passStatus) return { gpa: '0.00', grade: 'F' };
    
    const totalPossible = subjects.reduce((sum, s) => sum + s.full_marks, 0);
    if (totalPossible === 0) return { gpa: '0.00', grade: 'N/A' };
    
    const percentage = (totalMarks / totalPossible) * 100;
    
    if (percentage >= 80) return { gpa: '5.00', grade: 'A+' };
    if (percentage >= 70) return { gpa: '4.00', grade: 'A' };
    if (percentage >= 60) return { gpa: '3.50', grade: 'A-' };
    if (percentage >= 50) return { gpa: '3.00', grade: 'B' };
    if (percentage >= 40) return { gpa: '2.00', grade: 'C' };
    if (percentage >= 33) return { gpa: '1.00', grade: 'D' };
    return { gpa: '0.00', grade: 'F' };
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

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-3">
          <button onClick={view === 'list' ? onBack : () => setView('list')} className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-[#2563EB] border border-blue-100">
            <ArrowLeft size={20}/>
          </button>
          <h1 className="text-xl font-black text-[#1E293B] font-noto">
            {view === 'list' ? t('exams', lang) : view === 'insights' ? t('prediction_system', lang) : selectedExam?.exam_name}
          </h1>
        </div>
        {(view === 'list' || view === 'insights') && role === 'madrasah_admin' && (
            <div className="flex gap-2">
                <button onClick={() => setView(view === 'insights' ? 'list' : 'insights')} className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-all ${view === 'insights' ? 'bg-[#2563EB] text-white border-[#2563EB]' : 'bg-slate-50 text-slate-400 border-slate-100'}`}>
                    <TrendingUp size={20}/>
                </button>
                <button onClick={() => setShowAddExam(true)} className="w-10 h-10 bg-[#2563EB] text-white rounded-xl shadow-premium flex items-center justify-center active:scale-95 transition-all"><Plus size={20}/></button>
            </div>
        )}
      </div>

      {view === 'insights' && madrasah && (
          <SmartResultAnalytics madrasahId={madrasah.id} lang={lang} />
      )}

      {view === 'list' && (
        <div className="space-y-4">
          {loading ? <div className="flex justify-center py-10"><Loader2 className="animate-spin text-[#2563EB]" /></div> : exams.map(exam => (
            <div key={exam.id} className="bg-white p-5 rounded-[2.5rem] border border-slate-100 shadow-bubble space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-blue-50 text-[#2563EB] rounded-2xl flex items-center justify-center shadow-inner"><GraduationCap size={24}/></div>
                        <div>
                            <h3 className="text-lg font-black text-[#1E3A8A] font-noto leading-tight">{exam.exam_name}</h3>
                            <div className="flex items-center gap-2 mt-1">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{exam.classes?.class_name}</span>
                                {exam.is_published && <span className="px-2 py-0.5 bg-green-50 text-green-500 rounded-full text-[8px] font-black uppercase">Published</span>}
                            </div>
                        </div>
                    </div>
                    <div className="text-[10px] font-black text-slate-300 uppercase">{new Date(exam.exam_date).toLocaleDateString('bn-BD')}</div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                    <button onClick={() => { setSelectedExam(exam); setView('subjects'); fetchSubjects(exam.id); }} className="py-2.5 bg-slate-50 text-slate-500 rounded-xl text-[9px] font-black uppercase tracking-widest border border-slate-100 active:scale-95 transition-all">{t('subject', lang)}</button>
                    <button onClick={() => { setSelectedExam(exam); setView('marks'); fetchSubjects(exam.id); fetchMarkEntryData(exam.id, exam.class_id); }} className="py-2.5 bg-blue-50 text-[#2563EB] rounded-xl text-[9px] font-black uppercase tracking-widest border border-blue-100 active:scale-95 transition-all">{t('enter_marks', lang)}</button>
                    <button onClick={() => { setSelectedExam(exam); setView('report'); fetchSubjects(exam.id); fetchRanking(exam.id); }} className="py-2.5 bg-[#2563EB] text-white rounded-xl text-[9px] font-black uppercase tracking-widest shadow-premium active:scale-95 transition-all">{t('rank', lang)}</button>
                </div>
            </div>
          ))}
        </div>
      )}

      {view === 'subjects' && (
        <div className="space-y-4">
           <button onClick={() => setShowAddSubject(true)} className="w-full py-5 bg-white rounded-[2.2rem] text-[#2563EB] font-black flex items-center justify-center gap-3 shadow-bubble border border-slate-100 active:scale-95 transition-all">
              <Plus size={24} strokeWidth={3} /> বিষয় যোগ করুন
           </button>
           <div className="space-y-3">
              {subjects.map(s => (
                <div key={s.id} className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-bubble flex items-center justify-between">
                   <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-blue-50 text-[#2563EB] rounded-xl flex items-center justify-center"><BookOpen size={20}/></div>
                      <h5 className="font-black text-[#1E3A8A] font-noto text-lg">{s.subject_name}</h5>
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
            <div className="bg-white p-5 rounded-[2.5rem] shadow-bubble border border-slate-100 overflow-x-auto no-scrollbar">
                <table className="w-full text-left">
                    <thead>
                        <tr className="border-b border-slate-50">
                            <th className="py-4 text-[10px] font-black text-slate-400 uppercase pr-4">Roll/Name</th>
                            {subjects.map(s => (
                                <th key={s.id} className="py-4 text-[10px] font-black text-slate-400 uppercase text-center min-w-[80px]">{s.subject_name}</th>
                            ))}
                            <th className="py-4 text-[10px] font-black text-blue-400 uppercase text-center min-w-[60px]">{t('total_marks', lang)}</th>
                            <th className="py-4 text-[10px] font-black text-purple-400 uppercase text-center min-w-[60px]">{t('average', lang)}</th>
                            <th className="py-4 text-[10px] font-black text-emerald-400 uppercase text-center min-w-[60px]">{t('gpa', lang)}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {students.map(std => (
                            <tr key={std.id} className="border-b border-slate-50 last:border-0">
                                <td className="py-4 pr-4">
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-black text-[#2563EB] leading-none mb-1">#{std.roll}</span>
                                        <span className="font-black text-[#1E3A8A] text-xs font-noto truncate max-w-[100px]">{std.student_name}</span>
                                    </div>
                                </td>
                                {subjects.map(sub => (
                                    <td key={sub.id} className="py-4 px-2">
                                        <input 
                                            type="number" 
                                            className="w-full h-10 bg-slate-50 border border-slate-100 rounded-lg text-center font-black text-xs outline-none focus:border-[#2563EB] transition-all"
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
                                <td className="py-4 px-2 text-center font-black text-[#1E3A8A] text-xs">
                                    {(Object.values(marksData[std.id] || {}) as any[]).reduce((sum: number, m: any) => sum + (parseFloat(m) || 0), 0)}
                                </td>
                                <td className="py-4 px-2 text-center font-black text-[#2563EB] text-xs">
                                    {subjects.length > 0 ? ((Object.values(marksData[std.id] || {}) as any[]).reduce((sum: number, m: any) => sum + (parseFloat(m) || 0), 0) / subjects.length).toFixed(1) : '0'}
                                </td>
                                <td className="py-4 px-2 text-center font-black text-emerald-500 text-xs">
                                    {(() => {
                                        const total = (Object.values(marksData[std.id] || {}) as any[]).reduce((sum: number, m: any) => sum + (parseFloat(m) || 0), 0);
                                        const passStatus = subjects.length > 0 && subjects.every(sub => {
                                            const mark = parseFloat((marksData[std.id] || {})[sub.id] || '0');
                                            return mark >= sub.pass_marks;
                                        });
                                        return getGradeInfo(total, passStatus).gpa;
                                    })()}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <button onClick={handleSaveMarks} disabled={isSaving} className="w-full h-16 bg-[#2563EB] text-white font-black rounded-full shadow-premium flex items-center justify-center gap-3 text-lg active:scale-95 transition-all">
                {isSaving ? <Loader2 className="animate-spin" /> : <><Save size={24}/> নম্বর সংরক্ষণ করুন</>}
            </button>
        </div>
      )}

      {view === 'report' && (
          <div className="space-y-4">
              {loading ? (
                <div className="flex justify-center py-20"><Loader2 className="animate-spin text-[#2563EB]" size={40} /></div>
              ) : (
                <>
                  <div className="bg-gradient-to-br from-[#1E3A8A] to-[#2563EB] p-6 rounded-[2.5rem] text-white flex items-center justify-between shadow-premium">
                      <div>
                          <p className="text-[10px] font-black uppercase opacity-60">সেরা ফলাফল</p>
                          <h3 className="text-2xl font-black font-noto">{rankingData[0]?.student_name || 'N/A'}</h3>
                      </div>
                      <Trophy size={40} className="text-amber-300" />
                  </div>

                  <div className="space-y-3">
                      {rankingData.map((item: any) => (
                          <div key={item.student_id} className="bg-white p-5 rounded-[2.2rem] border border-slate-100 shadow-bubble flex items-center justify-between">
                              <div className="flex items-center gap-4 min-w-0">
                                  <div className="w-10 h-10 bg-blue-50 text-[#2563EB] rounded-xl flex items-center justify-center font-black shrink-0">{item.rank}</div>
                                  <div className="min-w-0">
                                      <h5 className="font-black text-[#1E3A8A] font-noto truncate leading-none mb-1">{item.student_name}</h5>
                                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                        Roll: {item.roll} | {t('total_marks', lang)}: {item.total_marks} | {t('average', lang)}: {subjects.length > 0 ? (item.total_marks / subjects.length).toFixed(2) : '0'}
                                      </p>
                                  </div>
                              </div>
                              <div className="flex flex-col items-end gap-1.5">
                                  <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase border ${item.pass_status ? 'bg-emerald-50 text-emerald-500 border-emerald-100' : 'bg-red-50 text-red-500 border-red-100'}`}>
                                     {item.pass_status ? (lang === 'bn' ? 'পাস' : 'Passed') : (lang === 'bn' ? 'ফেল' : 'Failed')}
                                  </div>
                                  {item.pass_status && (
                                    <div className="flex gap-1.5">
                                       <span className="px-2 py-0.5 bg-blue-50 text-[#2563EB] rounded-lg text-[8px] font-black border border-blue-100">{t('gpa', lang)}: {getGradeInfo(item.total_marks, item.pass_status).gpa}</span>
                                       <span className="px-2 py-0.5 bg-purple-50 text-purple-600 rounded-lg text-[8px] font-black border border-purple-100">{t('grade', lang)}: {getGradeInfo(item.total_marks, item.pass_status).grade}</span>
                                    </div>
                                  )}
                              </div>
                          </div>
                      ))}
                  </div>
                </>
              )}
          </div>
      )}

      {/* MODALS */}
      {showAddExam && (
        <div className="fixed inset-0 bg-[#080A12]/60 backdrop-blur-xl z-[999] flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-sm rounded-[3rem] p-8 space-y-6 animate-in zoom-in-95">
             <div className="flex items-center justify-between">
               <h3 className="text-xl font-black text-[#1E3A8A]">নতুন পরীক্ষা যোগ করুন</h3>
               <button onClick={() => setShowAddExam(false)} className="w-9 h-9 bg-slate-50 text-slate-400 rounded-xl flex items-center justify-center"><X size={18} /></button>
             </div>
             <div className="space-y-4">
                <div className="relative"><input type="text" className="w-full h-14 bg-slate-50 rounded-2xl px-12 font-black text-sm outline-none border-2 border-transparent focus:border-[#2563EB]/20 transition-all" placeholder="পরীক্ষার নাম (যেমন: বার্ষিক পরীক্ষা)" value={examName} onChange={(e) => setExamName(e.target.value)} /><BookOpen className="absolute left-4 top-4 text-slate-300" size={20}/></div>
                <div className="relative"><input type="date" className="w-full h-14 bg-slate-50 rounded-2xl px-12 font-black text-sm outline-none border-2 border-transparent focus:border-[#2563EB]/20 transition-all" value={examDate} onChange={(e) => setExamDate(e.target.value)} /><Calendar className="absolute left-4 top-4 text-slate-300" size={20}/></div>
                <div className="relative">
                    <select className="w-full h-14 bg-slate-50 rounded-2xl px-12 font-black text-sm outline-none border-2 border-transparent focus:border-[#2563EB]/20 appearance-none transition-all" value={classId} onChange={(e) => setClassId(e.target.value)}>
                        <option value="">ক্লাস বেছে নিন</option>
                        {classes.map(c => <option key={c.id} value={c.id}>{c.class_name}</option>)}
                    </select>
                    <LayoutGrid className="absolute left-4 top-4 text-slate-300" size={20}/>
                </div>
                <button onClick={handleAddExam} disabled={isSaving} className="w-full py-5 bg-[#2563EB] text-white font-black rounded-full shadow-premium flex items-center justify-center gap-3 active:scale-95 transition-all">
                  {isSaving ? <Loader2 className="animate-spin" /> : <><Save size={20}/> পরীক্ষা তৈরি করুন</>}
                </button>
             </div>
          </div>
        </div>
      )}

      {showAddSubject && (
        <div className="fixed inset-0 bg-[#080A12]/60 backdrop-blur-xl z-[999] flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-sm rounded-[3rem] p-8 space-y-6 animate-in zoom-in-95">
             <div className="flex items-center justify-between">
               <h3 className="text-xl font-black text-[#1E3A8A]">বিষয় যোগ করুন</h3>
               <button onClick={() => setShowAddSubject(false)} className="w-9 h-9 bg-slate-50 text-slate-400 rounded-xl flex items-center justify-center"><X size={18} /></button>
             </div>
             <div className="space-y-4">
                <div className="relative"><input type="text" className="w-full h-14 bg-slate-50 rounded-2xl px-12 font-black text-sm outline-none border-2 border-transparent focus:border-[#2563EB]/20 transition-all" placeholder="বিষয়ের নাম (যেমন: কুরআন)" value={subName} onChange={(e) => setSubName(e.target.value)} /><BookOpen size={20} className="absolute left-4 top-4 text-slate-300" /></div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="relative"><input type="number" className="w-full h-14 bg-slate-50 rounded-2xl px-12 font-black text-sm outline-none border-2 border-transparent focus:border-[#2563EB]/20 transition-all" placeholder="পূর্ণমান" value={fullMarks} onChange={(e) => setFullMarks(e.target.value)} /><Star className="absolute left-4 top-4 text-slate-300" size={20}/></div>
                    <div className="relative"><input type="number" className="w-full h-14 bg-slate-50 rounded-2xl px-12 font-black text-sm outline-none border-2 border-transparent focus:border-[#2563EB]/20 transition-all" placeholder="পাস" value={passMarks} onChange={(e) => setPassMarks(e.target.value)} /><AlertCircle className="absolute left-4 top-4 text-slate-300" size={20}/></div>
                </div>
                <button onClick={handleAddSubject} disabled={isSaving} className="w-full py-5 bg-[#2563EB] text-white font-black rounded-full shadow-premium flex items-center justify-center gap-3 active:scale-95 transition-all">
                  {isSaving ? <Loader2 className="animate-spin" /> : 'বিষয় সেভ করুন'}
                </button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Exams;
