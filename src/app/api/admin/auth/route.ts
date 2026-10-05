import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const ADMIN_MASTER_PASSWORD = '8287261653';
const MAX_ATTEMPTS = 3;
const LOCKOUT_DURATION_MS = 24 * 60 * 60 * 1000; // 24 Hours in milliseconds (86,400,000ms)

// Persistent in-memory lockout tracker
interface LockoutTracker {
  failedAttempts: number;
  lockoutUntil: number;
  lastAttemptAt: number;
}

// Global state for the admin console
const globalLockout: LockoutTracker = {
  failedAttempts: 0,
  lockoutUntil: 0,
  lastAttemptAt: 0,
};

function formatRemainingDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h}h ${m}m ${s}s`;
}

// GET /api/admin/auth — Check current lock status & remaining attempts
export async function GET() {
  const now = Date.now();
  const isLocked = globalLockout.lockoutUntil > now;

  // If lockout duration has elapsed, reset attempts
  if (!isLocked && globalLockout.lockoutUntil > 0) {
    globalLockout.failedAttempts = 0;
    globalLockout.lockoutUntil = 0;
  }

  const remainingSeconds = isLocked
    ? Math.max(0, Math.ceil((globalLockout.lockoutUntil - now) / 1000))
    : 0;

  return NextResponse.json({
    success: true,
    locked: isLocked,
    lockoutUntil: isLocked ? globalLockout.lockoutUntil : 0,
    remainingSeconds,
    remainingFormatted: isLocked ? formatRemainingDuration(remainingSeconds) : null,
    attemptsRemaining: isLocked ? 0 : Math.max(0, MAX_ATTEMPTS - globalLockout.failedAttempts),
    maxAttempts: MAX_ATTEMPTS,
  });
}

// POST /api/admin/auth — Verify admin password with 3-attempt 24h lockout enforcement
export async function POST(req: NextRequest) {
  try {
    const now = Date.now();

    // 1. Verify if console is currently in 24-hour lockout
    if (globalLockout.lockoutUntil > now) {
      const remainingSeconds = Math.max(0, Math.ceil((globalLockout.lockoutUntil - now) / 1000));
      return NextResponse.json(
        {
          success: false,
          locked: true,
          lockoutUntil: globalLockout.lockoutUntil,
          remainingSeconds,
          remainingFormatted: formatRemainingDuration(remainingSeconds),
          attemptsRemaining: 0,
          error: `SECURITY LOCKDOWN: Admin panel is locked for 24 hours. Remaining time: ${formatRemainingDuration(remainingSeconds)}.`,
        },
        { status: 423 } // 423 Locked
      );
    }

    // If previously locked but time expired, reset
    if (globalLockout.lockoutUntil > 0 && globalLockout.lockoutUntil <= now) {
      globalLockout.failedAttempts = 0;
      globalLockout.lockoutUntil = 0;
    }

    const body = await req.json();
    const { password } = body;

    if (!password || typeof password !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Password is required' },
        { status: 400 }
      );
    }

    // 2. Validate Password against Master Password: 8287261653
    if (password.trim() === ADMIN_MASTER_PASSWORD) {
      // SUCCESS: Reset failure counters
      globalLockout.failedAttempts = 0;
      globalLockout.lockoutUntil = 0;

      return NextResponse.json({
        success: true,
        message: 'Admin access authorized successfully.',
        attemptsRemaining: MAX_ATTEMPTS,
      });
    }

    // 3. FAILED ATTEMPT: Increment counter
    globalLockout.failedAttempts += 1;
    globalLockout.lastAttemptAt = now;

    // Check if 3-attempt threshold has been hit
    if (globalLockout.failedAttempts >= MAX_ATTEMPTS) {
      globalLockout.lockoutUntil = now + LOCKOUT_DURATION_MS;
      const remainingSeconds = Math.ceil(LOCKOUT_DURATION_MS / 1000);

      return NextResponse.json(
        {
          success: false,
          locked: true,
          lockoutUntil: globalLockout.lockoutUntil,
          remainingSeconds,
          remainingFormatted: formatRemainingDuration(remainingSeconds),
          attemptsRemaining: 0,
          error: `MAXIMUM ATTEMPTS REACHED: 3 failed attempts. Admin panel is now LOCKED for 24 hours!`,
        },
        { status: 423 }
      );
    }

    const attemptsRemaining = MAX_ATTEMPTS - globalLockout.failedAttempts;

    return NextResponse.json(
      {
        success: false,
        locked: false,
        attemptsRemaining,
        error: `Incorrect password. ${attemptsRemaining} of ${MAX_ATTEMPTS} attempt${attemptsRemaining === 1 ? '' : 's'} remaining before 24-hour lockdown.`,
      },
      { status: 401 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown server error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
