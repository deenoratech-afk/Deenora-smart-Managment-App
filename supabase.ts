
import { createClient } from '@supabase/supabase-js';
import { Student, Madrasah } from './types';

const supabaseUrl = 'https://jtbhesczfjwjqivtmkqw.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp0Ymhlc2N6Zmp3anFpdnRta3F3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1MDI4ODQsImV4cCI6MjA4NzA3ODg4NH0.zKxOZlvjiZwaLprMBGeObcmf2VqjGoJtdxgF_nFpKvI';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: window.localStorage,
    storageKey: 'madrasah_auth_token',
    flowType: 'pkce' // More secure and robust for web apps
  }
});

/**
 * Normalizes phone numbers to strictly 13 digits: 8801XXXXXXXXX
 * This is the standard format required by BD SMS Gateways.
 */
const normalizePhone = (phone: string): string => {
  let p = phone.replace(/\D/g, ''); // Remove all non-digits
  
  // If it's already 13 digits starting with 880, return it
  if (p.length === 13 && p.startsWith('880')) return p;
  
  // If it starts with 01 (11 digits), prepend 88
  if (p.startsWith('0') && p.length === 11) {
    return `88${p}`;
  }
  
  // If it starts with 1 (10 digits), prepend 880
  if (p.startsWith('1') && p.length === 10) {
    return `880${p}`;
  }

  // If it starts with 880 but not 13 digits, trim or pad (rare case)
  if (p.startsWith('880')) {
    return p.slice(0, 13);
  }

  return p;
};

export const smsApi = {
  getGlobalSettings: async () => {
    try {
      const { data, error } = await supabase
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
      return { 
        reve_api_key: 'aa407e1c6629da8e', 
        reve_secret_key: '91051e7e', 
        bkash_number: '০১৭৬৬-XXXXXX', 
        reve_caller_id: '1234',
        reve_client_id: ''
      };
    }
  },

  sendBulk: async (madrasahId: string, students: Student[], message: string) => {
    // 1. Fetch settings and profile
    const [mRes, global] = await Promise.all([
      supabase.from('madrasahs').select('sms_balance, reve_api_key, reve_secret_key, reve_caller_id, reve_client_id').eq('id', madrasahId).single(),
      smsApi.getGlobalSettings()
    ]);

    const mData = mRes.data;
    if (!mData) throw new Error("মাদরাসা প্রোফাইল লোড করা যায়নি।");
    
    const balance = mData.sms_balance || 0;
    if (balance < students.length) {
      throw new Error(`ব্যালেন্স পর্যাপ্ত নয়। প্রয়োজন: ${students.length}, আছে: ${balance}`);
    }

    // 2. Deduct balance via RPC (Database transaction)
    const { data: rpcData, error: rpcError } = await supabase.rpc('send_bulk_sms_rpc', {
      p_madrasah_id: madrasahId,
      p_student_ids: students.map(s => s.id),
      p_message: message
    });

    if (rpcError) throw new Error("ব্যালেন্স আপডেট করতে সমস্যা হয়েছে: " + rpcError.message);
    if (rpcData && rpcData.success === false) throw new Error(rpcData.error || "ট্রানজ্যাকশন সফল হয়নি।");

    // 3. Prepare credentials
    const apiKey = (mData.reve_api_key && mData.reve_api_key.trim() !== '') ? mData.reve_api_key.trim() : global.reve_api_key;
    const secretKey = (mData.reve_secret_key && mData.reve_secret_key.trim() !== '') ? mData.reve_secret_key.trim() : global.reve_secret_key;
    const callerId = (mData.reve_caller_id && mData.reve_caller_id.trim() !== '') ? mData.reve_caller_id.trim() : global.reve_caller_id;
    const clientId = (mData.reve_client_id && mData.reve_client_id.trim() !== '') ? mData.reve_client_id.trim() : global.reve_client_id;

    // 4. Batch Processing
    // REVE SMS handles comma separated numbers in one content object efficiently.
    // We send in chunks of 15 to keep the URL length safe.
    const chunkSize = 15; 
    const batches: string[] = [];
    
    for (let i = 0; i < students.length; i += chunkSize) {
      const chunk = students.slice(i, i + chunkSize);
      const phoneList = chunk.map(s => normalizePhone(s.guardian_phone)).join(',');
      batches.push(phoneList);
    }

    // 5. Fire SMS Requests
    const sendPromises = batches.map(async (toUsers) => {
      // Documentation suggests for multi-contact with SAME content:
      // content=[{"callerID":"...","toUser":"8801...,8801...","messageContent":"..."}]
      const content = [{
        callerID: callerId,
        toUser: toUsers,
        messageContent: message
      }];

      // type=3 is mandatory for Unicode/Bengali characters
      let apiUrl = `https://smpp.revesms.com:7790/send?apikey=${apiKey}&secretkey=${secretKey}&type=3&content=${encodeURIComponent(JSON.stringify(content))}`;
      
      if (clientId) {
        apiUrl += `&clientid=${clientId}`;
      }

      try {
        // We use fetch with no-cors to trigger the gateway request.
        await fetch(apiUrl, { mode: 'no-cors', cache: 'no-cache' });
      } catch (err) {
        console.warn("SMS batch failed to trigger:", err);
      }
    });

    await Promise.all(sendPromises);
    return { success: true };
  },

  sendDirect: async (phone: string, message: string, madrasahId?: string) => {
    const global = await smsApi.getGlobalSettings();
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
    
    // Using /sendtext for single direct messages (more reliable for single pings)
    let apiUrl = `https://smpp.revesms.com:7790/sendtext?apikey=${apiKey}&secretkey=${secretKey}&callerID=${callerId}&toUser=${target}&messageContent=${encodeURIComponent(message)}&type=3`;
    
    if (clientId) apiUrl += `&clientid=${clientId}`;
    
    try { 
      await fetch(apiUrl, { mode: 'no-cors', cache: 'no-cache' }); 
    } catch (e) {
      console.warn("Direct SMS failed to trigger:", e);
    }
  }
};

export const offlineApi = {
  setCache: (key: string, data: any) => { try { localStorage.setItem(`cache_${key}`, JSON.stringify(data)); } catch (e) {} },
  getCache: (key: string) => { try { const cached = localStorage.getItem(`cache_${key}`); return cached ? JSON.parse(cached) : null; } catch (e) { return null; } },
  removeCache: (key: string) => localStorage.removeItem(`cache_${key}`),
  queueAction: (table: string, type: 'INSERT' | 'UPDATE' | 'DELETE', payload: any) => {
    const queue = JSON.parse(localStorage.getItem('sync_queue') || '[]');
    queue.push({ id: Math.random().toString(36).substr(2, 9), table, type, payload, timestamp: Date.now() });
    localStorage.setItem('sync_queue', JSON.stringify(queue));
  },
  getQueue: () => JSON.parse(localStorage.getItem('sync_queue') || '[]'),
  removeFromQueue: (id: string) => {
    const queue = JSON.parse(localStorage.getItem('sync_queue') || '[]');
    localStorage.setItem('sync_queue', JSON.stringify(queue.filter((item: any) => item.id !== id)));
  },
  processQueue: async () => {
    const queue = offlineApi.getQueue();
    if (queue.length === 0) return;
    for (const action of queue) {
      try {
        if (action.type === 'INSERT') await supabase.from(action.table).insert(action.payload);
        else if (action.type === 'UPDATE') await supabase.from(action.table).update(action.payload).eq('id', action.payload.id);
        else if (action.type === 'DELETE') await supabase.from(action.table).delete().eq('id', action.payload.id);
        offlineApi.removeFromQueue(action.id);
      } catch (e) {}
    }
  }
};
