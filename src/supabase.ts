
/**
 * DEPRECATED: This file is kept for backward compatibility during transition.
 * Future logic should use:
 * - import { supabase } from './lib/supabase'
 * - import { smsService } from './services/sms.service'
 * - import { offlineService } from './services/offline.service'
 */

import { supabase } from './lib/supabase';
import { smsService } from './services/sms.service';
import { offlineService } from './services/offline.service';

export { supabase };
export const smsApi = smsService;
export const offlineApi = offlineService;
