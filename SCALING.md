
# Scalability Guide for Deenora SaaS (1000 Madrasahs)

To manage 1,000 tenants with an estimated 300,000 students, the following strategies must be enforced:

### 1. Database Tier (Supabase/PostgreSQL)
*   **Tenant Isolation (RLS)**: Already implemented. PostgreSQL handles this via internal filters.
*   **Indices**: Every table must have a composite B-Tree index on `(madrasah_id, primary_search_column)`.
*   **Connection Pooling**: As user count grows, ensure Supabase Transaction mode (Port 6543) is used to handle high concurrent sessions.

### 2. Computing Tier (Serverless)
*   **Bulk Operations**: Sending SMS to 1000 students should never be done in the frontend thread. Move this to a **Supabase Edge Function** triggered via a database webhook or direct fetch.
*   **Monthly Reports**: PDF generation for 300 students at once should be offloaded to an Edge Function using a library like `jspdf` or a headless browser service.

### 3. Frontend Tier (React/Vite)
*   **Virtualization**: For lists exceeding 500 items, use `react-window` to render only the visible rows.
*   **State Management**: Avoid large global states. Keep data fetching scoped to the view (as seen in the updated `Students.tsx` pagination).
*   **Caching**: Implement an `IndexedDB` layer for offline support if the data set exceeds the 5MB `localStorage` limit.

### 4. SMS Gateway (REVE SMS)
*   **Queueing**: When sending 10,000+ SMS in a single broadcast (e.g., Exam Results), the system should batch calls into chunks of 100 to avoid Gateway rate limits.
