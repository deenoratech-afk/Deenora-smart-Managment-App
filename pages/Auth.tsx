
import React, { useState, useEffect } from 'react';
import { supabase, offlineApi } from '../supabase';
import { Mail, Lock, Loader2, BookOpen, AlertCircle, Smartphone, Key, UserCheck, ShieldCheck } from 'lucide-react';
import { Language } from '../types';
import { t } from '../translations';

interface AuthProps {
  lang: Language;
}

const Auth: React.FC<AuthProps> = ({ lang }) => {
  const [loginType, setLoginType] = useState<'admin' | 'teacher'>('admin');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [brandInfo, setBrandInfo] = useState({ name: 'মাদরাসা কন্টাক্ট' });

  useEffect(() => {
    const name = localStorage.getItem('m_name');
    if (name) setBrandInfo({ name });
  }, []);

  const handleAdminAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      const { data, error: signInError } = await (supabase.auth as any).signInWithPassword({ 
        email: email.trim(), 
        password: code 
      });
      if (signInError) throw signInError;
      if (data.user) {
        localStorage.removeItem('teacher_session');
        offlineApi.removeCache('profile');
        const { data: profile } = await supabase.from('madrasahs').select('name').eq('id', data.user.id).single();
        if (profile) localStorage.setItem('m_name', profile.name);
      }
    } catch (err: any) { 
      setError(t('login_error', lang)); 
    } finally { 
      setLoading(false); 
    }
  };

  const handleTeacherAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Clean phone number (remove spaces, dashes, etc.)
      const cleanPhone = phone.replace(/\D/g, '');
      // If the number is 11 digits (BD local), it's standard.
      
      const { data, error: fetchError } = await supabase
        .from('teachers')
        .select('*, madrasahs(name, logo_url)')
        .eq('phone', cleanPhone)
        .eq('login_code', code.trim())
        .eq('is_active', true)
        .maybeSingle();

      if (fetchError) {
        console.error("Teacher Login Fetch Error:", fetchError);
        throw new Error(lang === 'bn' ? 'সার্ভার সংযোগে সমস্যা হচ্ছে' : 'Server connection error');
      }

      if (!data) {
        throw new Error(lang === 'bn' ? 'ভুল মোবাইল নম্বর অথবা পিন কোড!' : 'Invalid Phone or PIN!');
      }

      // Success - Store session
      localStorage.setItem('teacher_session', JSON.stringify(data));
      window.location.reload(); 
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#A179FF] flex flex-col items-center justify-center p-8 relative overflow-hidden mesh-bg-vibrant">
      <div className="w-full max-w-sm flex flex-col items-center z-10 space-y-10">
        <div className="text-center space-y-4">
          <div className="w-24 h-24 bg-white/95 rounded-[2.2rem] mx-auto flex items-center justify-center border-4 border-[#8D30F4]/20 shadow-2xl animate-bounce duration-[3s] backdrop-blur-md">
            <BookOpen size={45} strokeWidth={2.5} className="text-[#8D30F4]" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-white font-noto leading-tight drop-shadow-xl">
              {brandInfo.name}
            </h1>
            <p className="text-white font-black text-[10px] uppercase tracking-[0.4em] mt-2 opacity-80 drop-shadow-md">Secure Portal Login</p>
          </div>
        </div>

        <div className="w-full space-y-6">
          <div className="flex p-1.5 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 relative">
            <div 
              className={`absolute h-[calc(100%-12px)] w-[calc(50%-6px)] bg-white rounded-xl shadow-lg transition-all duration-300 ${loginType === 'teacher' ? 'translate-x-full' : 'translate-x-0'}`}
            />
            <button onClick={() => { setLoginType('admin'); setError(''); }} className={`flex-1 py-3 text-[11px] font-black uppercase tracking-widest relative z-10 transition-colors ${loginType === 'admin' ? 'text-[#8D30F4]' : 'text-white'}`}>
              Admin
            </button>
            <button onClick={() => { setLoginType('teacher'); setError(''); }} className={`flex-1 py-3 text-[11px] font-black uppercase tracking-widest relative z-10 transition-colors ${loginType === 'teacher' ? 'text-[#8D30F4]' : 'text-white'}`}>
              Teacher
            </button>
          </div>

          <form onSubmit={loginType === 'admin' ? handleAdminAuth : handleTeacherAuth} className="space-y-4">
            {error && (
              <div className="bg-white/90 backdrop-blur-md border-l-4 border-l-red-500 p-4 rounded-xl flex items-center gap-3 text-red-600 font-black text-xs animate-in slide-in-from-top-2">
                <AlertCircle size={18} strokeWidth={3} />
                {error}
              </div>
            )}

            <div className="space-y-3">
              {loginType === 'admin' ? (
                <>
                  <div className="relative">
                    <Mail className="absolute left-5 top-1/2 -translate-y-1/2 text-[#4B168A]" size={20} />
                    <input
                      type="email"
                      required
                      placeholder="ইমেইল এড্রেস"
                      className="w-full pl-14 pr-6 py-5 bg-white rounded-2xl outline-none text-[#2D3142] font-black text-sm shadow-xl"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-[#4B168A]" size={20} />
                    <input
                      type="password"
                      required
                      placeholder="পাসওয়ার্ড"
                      className="w-full pl-14 pr-6 py-5 bg-white rounded-2xl outline-none text-[#2D3142] font-black text-sm shadow-xl"
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="relative">
                    <Smartphone className="absolute left-5 top-1/2 -translate-y-1/2 text-[#4B168A]" size={20} />
                    <input
                      type="tel"
                      required
                      placeholder="শিক্ষকের মোবাইল নম্বর"
                      className="w-full pl-14 pr-6 py-5 bg-white rounded-2xl outline-none text-[#2D3142] font-black text-sm shadow-xl"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                  </div>
                  <div className="relative">
                    <Key className="absolute left-5 top-1/2 -translate-y-1/2 text-[#4B168A]" size={20} />
                    <input
                      type="password"
                      required
                      placeholder="পিন কোড"
                      className="w-full pl-14 pr-6 py-5 bg-white rounded-2xl outline-none text-[#2D3142] font-black text-sm shadow-xl"
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                    />
                  </div>
                </>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-5 premium-btn text-white font-black rounded-2xl active:scale-[0.98] transition-all flex items-center justify-center gap-3 text-lg font-noto shadow-xl"
            >
              {loading ? <Loader2 className="animate-spin" size={24} /> : 'লগইন করুন'}
            </button>
          </form>
        </div>

        <p className="text-white/60 text-[9px] font-black tracking-[0.4em] uppercase">
          Deenora Management System
        </p>
      </div>
    </div>
  );
};

export default Auth;
