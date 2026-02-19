
import { supabase } from '../lib/supabase';
import { Student } from '../types';

const normalizePhone = (phone: string): string => {
  let p = phone.replace(/\D/g, ''); 
  if (p.length === 13 && p.startsWith('880')) return p;
  if (p.startsWith('0') && p.length === 11) return `88${p}`;
  if (p.startsWith('1') && p.length === 10) return `880${p}`;
  if (p.startsWith('880')) return p.slice(0, 13);
  return p;
};

export const smsService = {
  getGlobalSettings: async () => {
    try {
      const { data } = await supabase
        .from('system_settings')
        .select('*')
        .eq('id', '00000000-0000-0000-0000-000000000001')
        .maybeSingle();
      
      const defaults = { 
        reve_api_key: 'aa407e1c6629da8e', 
        reve_secret_key: '91051e7e', 
        bkash_number: '০১৭৬৬-XXXXXX', 
        reve_caller_id: '1234',
        reve_client_id: ''
      };

      if (!data) return defaults;
      return {
        reve_api_key: (data.reve_api_key || defaults.reve_api_key).trim(),
        reve_secret_key: (data.reve_secret_key || defaults.reve_secret_key).trim(),
        reve_caller_id: (data.reve_caller_id || defaults.reve_caller_id).trim(),
        bkash_number: data.bkash_number || defaults.bkash_number,
        reve_client_id: (data.reve_client_id || defaults.reve_client_id).trim()
      };
    } catch (e) {
      return { reve_api_key: 'aa407e1c6629da8e', reve_secret_key: '91051e7e', bkash_number: '০১৭৬৬-XXXXXX', reve_caller_id: '1234', reve_client_id: '' };
    }
  },

  sendBulk: async (madrasahId: string, students: Student[], message: string) => {
    const [mRes, global] = await Promise.all([
      supabase.from('madrasahs').select('sms_balance, reve_api_key, reve_secret_key, reve_caller_id, reve_client_id').eq('id', madrasahId).single(),
      smsService.getGlobalSettings()
    ]);

    const mData = mRes.data;
    if (!mData) throw new Error("Security Violation: Unauthorized Madrasah context.");
    
    const balance = mData.sms_balance || 0;
    if (balance < students.length) {
      throw new Error(`ব্যালেন্স পর্যাপ্ত নয়। প্রয়োজন: ${students.length}, আছে: ${balance}`);
    }

    const { data: rpcData, error: rpcError } = await supabase.rpc('send_bulk_sms_rpc', {
      p_madrasah_id: madrasahId,
      p_student_ids: students.map(s => s.id),
      p_message: message
    });

    if (rpcError) throw new Error("ট্রানজ্যাকশন সফল হয়নি। (RLS Refused)");
    if (rpcData && rpcData.success === false) throw new Error(rpcData.error || "ট্রানজ্যাকশন সফল হয়নি।");

    const apiKey = (mData.reve_api_key && mData.reve_api_key.trim() !== '') ? mData.reve_api_key.trim() : global.reve_api_key;
    const secretKey = (mData.reve_secret_key && mData.reve_secret_key.trim() !== '') ? mData.reve_secret_key.trim() : global.reve_secret_key;
    const callerId = (mData.reve_caller_id && mData.reve_caller_id.trim() !== '') ? mData.reve_caller_id.trim() : global.reve_caller_id;
    const clientId = (mData.reve_client_id && mData.reve_client_id.trim() !== '') ? mData.reve_client_id.trim() : global.reve_client_id;

    const chunkSize = 15; 
    const batches: string[] = [];
    for (let i = 0; i < students.length; i += chunkSize) {
      const chunk = students.slice(i, i + chunkSize);
      const phoneList = chunk.map(s => normalizePhone(s.guardian_phone)).join(',');
      batches.push(phoneList);
    }

    const sendPromises = batches.map(async (toUsers) => {
      const content = [{ callerID: callerId, toUser: toUsers, messageContent: message }];
      let apiUrl = `https://smpp.revesms.com:7790/send?apikey=${apiKey}&secretkey=${secretKey}&type=3&content=${encodeURIComponent(JSON.stringify(content))}`;
      if (clientId) apiUrl += `&clientid=${clientId}`;
      try { await fetch(apiUrl, { mode: 'no-cors', cache: 'no-cache' }); } catch (err) { console.warn("SMS batch failed:", err); }
    });

    await Promise.all(sendPromises);
    return { success: true };
  },

  sendDirect: async (phone: string, message: string, madrasahId?: string) => {
    const global = await smsService.getGlobalSettings();
    let apiKey = global.reve_api_key;
    let secretKey = global.reve_secret_key;
    let callerId = global.reve_caller_id;
    let clientId = global.reve_client_id;

    if (madrasahId) {
      const { data } = await supabase
        .from('madrasahs')
        .select('reve_api_key, reve_secret_key, reve_caller_id, reve_client_id')
        .eq('id', madrasahId)
        .maybeSingle();
        
      if (data) {
        if (data.reve_api_key && data.reve_api_key.trim() !== '') apiKey = data.reve_api_key.trim();
        if (data.reve_secret_key && data.reve_secret_key.trim() !== '') secretKey = data.reve_secret_key.trim();
        if (data.reve_caller_id && data.reve_caller_id.trim() !== '') callerId = data.reve_caller_id.trim();
        if (data.reve_client_id && data.reve_client_id.trim() !== '') clientId = data.reve_client_id.trim();
      }
    }

    const target = normalizePhone(phone);
    let apiUrl = `https://smpp.revesms.com:7790/sendtext?apikey=${apiKey}&secretkey=${secretKey}&callerID=${callerId}&toUser=${target}&messageContent=${encodeURIComponent(message)}&type=3`;
    if (clientId) apiUrl += `&clientid=${clientId}`;
    try { await fetch(apiUrl, { mode: 'no-cors', cache: 'no-cache' }); } catch (e) { console.warn("Direct SMS failed:", e); }
  }
};
