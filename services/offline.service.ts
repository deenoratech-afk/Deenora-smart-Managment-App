
import { supabase } from '../lib/supabase';

export const offlineService = {
  setCache: (key: string, data: any) => { 
    try { 
      localStorage.setItem(`cache_${key}`, JSON.stringify(data)); 
    } catch (e) { 
      console.warn('Caching failed:', e);
    } 
  },
  
  getCache: (key: string) => { 
    try { 
      const cached = localStorage.getItem(`cache_${key}`); 
      return cached ? JSON.parse(cached) : null; 
    } catch (e) { 
      return null; 
    } 
  },
  
  removeCache: (key: string) => localStorage.removeItem(`cache_${key}`),
  
  queueAction: (table: string, type: 'INSERT' | 'UPDATE' | 'DELETE', payload: any) => {
    const queue = JSON.parse(localStorage.getItem('sync_queue') || '[]');
    queue.push({ 
      id: Math.random().toString(36).substr(2, 9), 
      table, 
      type, 
      payload, 
      timestamp: Date.now() 
    });
    localStorage.setItem('sync_queue', JSON.stringify(queue));
  },
  
  getQueue: () => JSON.parse(localStorage.getItem('sync_queue') || '[]'),
  
  removeFromQueue: (id: string) => {
    const queue = JSON.parse(localStorage.getItem('sync_queue') || '[]');
    localStorage.setItem('sync_queue', JSON.stringify(queue.filter((item: any) => item.id !== id)));
  },
  
  processQueue: async () => {
    const queue = offlineService.getQueue();
    if (queue.length === 0) return;
    
    for (const action of queue) {
      try {
        let result;
        if (action.type === 'INSERT') {
          result = await supabase.from(action.table).insert(action.payload);
        } else if (action.type === 'UPDATE') {
          result = await supabase.from(action.table).update(action.payload).eq('id', action.payload.id);
        } else if (action.type === 'DELETE') {
          result = await supabase.from(action.table).delete().eq('id', action.payload.id);
        }
        
        if (!result?.error) {
          offlineService.removeFromQueue(action.id);
        }
      } catch (e) {
        console.error('Queue processing error:', e);
      }
    }
  }
};
