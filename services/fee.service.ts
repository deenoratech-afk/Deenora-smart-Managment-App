import { supabase } from '../supabase';

export const feeService = {
  /**
   * Generate monthly fees for all active students.
   * This function calculates the fee based on the class structure and applies any active discounts.
   */
  generateMonthlyFees: async (madrasahId: string, month: string, categoryId: string) => {
    try {
      // 1. Get all active students
      const { data: students } = await supabase
        .from('students')
        .select('id, class_id')
        .eq('madrasah_id', madrasahId);

      if (!students || students.length === 0) return { success: false, error: 'কোনো ছাত্র পাওয়া যায়নি' };

      // 2. Get class fee structures for the selected category
      const { data: structures } = await supabase
        .from('class_fee_structures')
        .select('*')
        .eq('madrasah_id', madrasahId)
        .eq('fee_category_id', categoryId);

      if (!structures || structures.length === 0) return { success: false, error: 'এই ক্যাটাগরির জন্য কোনো ফি স্ট্রাকচার সেট করা নেই' };

      // 3. Get active discounts for this category
      const { data: discounts } = await supabase
        .from('student_discounts')
        .select('*')
        .eq('madrasah_id', madrasahId)
        .eq('fee_category_id', categoryId)
        .eq('is_active', true);

      const feeEntries: any[] = [];

      for (const student of students) {
        const struct = structures?.find(s => s.class_id === student.class_id);
        if (struct) {
          // Calculate discount
          const discount = discounts?.find(d => d.student_id === student.id);
          let discountAmount = 0;
          if (discount) {
            if (discount.discount_type === 'fixed') {
              discountAmount = Number(discount.amount);
            } else {
              discountAmount = (Number(struct.amount) * Number(discount.amount)) / 100;
            }
          }

          const finalAmount = Math.max(0, Number(struct.amount) - discountAmount);

          feeEntries.push({
            madrasah_id: madrasahId,
            student_id: student.id,
            fee_category_id: categoryId,
            month: month,
            amount: struct.amount,
            discount_amount: discountAmount,
            due_amount: finalAmount,
            status: finalAmount === 0 ? 'paid' : 'due',
            notes: `Fee for ${month}`
          });
        }
      }

      const { error } = await supabase.from('student_fees').insert(feeEntries);
      if (error) throw error;

      // Deactivate one-time discounts
      const oneTimeDiscounts = discounts?.filter(d => d.duration === 'one-time');
      if (oneTimeDiscounts && oneTimeDiscounts.length > 0) {
        await supabase
          .from('student_discounts')
          .update({ is_active: false })
          .in('id', oneTimeDiscounts.map(d => d.id));
      }

      return { success: true };
    } catch (error: any) {
      console.error('Error generating monthly fees:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Process a payment for a student fee.
   */
  processPayment: async (madrasahId: string, studentId: string, studentFeeId: string, amount: number, method: string) => {
    try {
      if (!madrasahId) throw new Error('Madrasah ID is missing');
      
      // 1. Get current fee details
      const { data: fee, error: fError } = await supabase
        .from('student_fees')
        .select('*')
        .eq('id', studentFeeId)
        .single();

      if (fError || !fee) throw new Error('ফি রেকর্ড পাওয়া যায়নি');

      // 2. Record payment
      const { data: payment, error: pError } = await supabase
        .from('payments')
        .insert({
          madrasah_id: madrasahId,
          student_id: studentId,
          student_fee_id: studentFeeId,
          amount: amount,
          payment_method: method
        })
        .select()
        .single();

      if (pError) {
        console.error('Payment insert error:', pError);
        throw new Error('পেমেন্ট রেকর্ড করতে সমস্যা হয়েছে: ' + pError.message);
      }

      // 3. Update student fee status
      const newPaidAmount = Number(fee.paid_amount) + amount;
      const newDueAmount = Math.max(0, Number(fee.due_amount) - amount);
      const newStatus = newDueAmount === 0 ? 'paid' : 'partial';

      const { error: uError } = await supabase
        .from('student_fees')
        .update({
          paid_amount: newPaidAmount,
          due_amount: newDueAmount,
          status: newStatus
        })
        .eq('id', studentFeeId);

      if (uError) throw uError;

      return { success: true, payment };
    } catch (error: any) {
      console.error('Error processing payment:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Get financial summary for a madrasah.
   */
  getFinancialSummary: async (madrasahId: string) => {
    const { data, error } = await supabase
      .from('financial_summary')
      .select('*')
      .eq('madrasah_id', madrasahId)
      .order('month', { ascending: false });
    
    if (error) throw error;
    return data;
  },

  /**
   * Send due reminders to students with outstanding dues.
   */
  sendDueReminders: async (madrasahId: string) => {
    const { data: dues } = await supabase
      .from('student_fees')
      .select('*, students(student_name, parent_phone)')
      .eq('madrasah_id', madrasahId)
      .gt('due_amount', 0);

    if (!dues) return { count: 0 };
    
    // In a real app, integrate with SMS service here
    return { count: dues.length };
  }
};
