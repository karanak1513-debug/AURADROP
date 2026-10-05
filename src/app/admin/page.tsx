'use client';

// Re-export AdminCommandCenterPage so both /admin and /admin143 load the secure,
// password-protected master console (Pass: 8287261653 with 3-attempt 24hr lockout)
export { default } from '@/app/admin143/page';
