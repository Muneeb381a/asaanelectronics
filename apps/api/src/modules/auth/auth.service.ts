import { and, eq, gt, ne, sql } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { users, refreshTokens, otps, sellers } from '../../db/schema.js';
import { hashPassword, comparePassword } from '../../utils/hash.js';
import { signAccess, signRefresh, verifyRefresh, signOtpToken, verifyOtpToken } from '../../utils/jwt.js';
import { generateOtp, hashOtp, verifyOtp } from '../../utils/otp.js';
import { sendOtpEmail } from '../../utils/email.js';
import { AppError } from '../../middleware/error.js';

const REFRESH_TTL_MS  = 7 * 24 * 60 * 60 * 1000;
const OTP_TTL_MS      = 10 * 60 * 1000;
const MAX_OTP_ATTEMPTS = 3;

type DeviceInfo = { ip?: string; userAgent?: string };

function parseDevice(ua: string): { deviceName: string; deviceType: string } {
  const ua2 = ua || '';
  const mobile  = /Android|iPhone|iPod/i.test(ua2);
  const tablet  = /iPad|Android.*Tablet/i.test(ua2);
  const type    = tablet ? 'tablet' : mobile ? 'mobile' : 'desktop';

  const browser =
    ua2.includes('Edg/')     ? 'Edge'    :
    ua2.includes('OPR/')     ? 'Opera'   :
    ua2.includes('Firefox')  ? 'Firefox' :
    ua2.includes('Chrome')   ? 'Chrome'  :
    ua2.includes('Safari')   ? 'Safari'  : 'Browser';

  const os =
    ua2.includes('Windows NT')                                    ? 'Windows' :
    ua2.includes('Mac OS X') && !ua2.includes('iPhone') && !ua2.includes('iPad') ? 'macOS'   :
    ua2.includes('iPhone')   ? 'iPhone'  :
    ua2.includes('iPad')     ? 'iPad'    :
    ua2.includes('Android')  ? 'Android' :
    ua2.includes('Linux')    ? 'Linux'   : 'Unknown';

  return { deviceName: `${browser} on ${os}`, deviceType: type };
}

function safeUser(u: typeof users.$inferSelect) {
  return { id: u.id, name: u.name, email: u.email, role: u.role, sellerId: u.sellerId };
}

async function issueTokens(user: typeof users.$inferSelect, device: DeviceInfo = {}) {
  const refreshToken = signRefresh({ userId: user.id });
  const { deviceName, deviceType } = parseDevice(device.userAgent ?? '');
  const now = new Date();

  // Suspicious if any other active session exists from a different IP
  let isSuspicious = false;
  if (device.ip) {
    const others = await db
      .select({ ip: refreshTokens.ip })
      .from(refreshTokens)
      .where(and(eq(refreshTokens.userId, user.id), gt(refreshTokens.expiresAt, now)));
    isSuspicious = others.some((s) => s.ip && s.ip !== device.ip);
  }

  const [session] = await db.insert(refreshTokens).values({
    userId:       user.id,
    token:        refreshToken,
    expiresAt:    new Date(Date.now() + REFRESH_TTL_MS),
    ip:           device.ip,
    userAgent:    device.userAgent,
    deviceName,
    deviceType,
    lastActiveAt: now,
    isSuspicious,
  }).returning({ id: refreshTokens.id });

  const accessToken = signAccess({ userId: user.id, sellerId: user.sellerId, role: user.role, sessionId: session!.id });
  return { accessToken, refreshToken, user: safeUser(user) };
}

async function createAndSendOtp(user: typeof users.$inferSelect, purpose: 'LOGIN' | 'PASSWORD_RESET') {
  await db.delete(otps).where(and(eq(otps.userId, user.id), eq(otps.purpose, purpose)));
  const code = generateOtp();
  await db.insert(otps).values({
    userId:    user.id,
    codeHash:  hashOtp(code),
    purpose,
    expiresAt: new Date(Date.now() + OTP_TTL_MS),
  });
  await sendOtpEmail(user.email, user.name, code, purpose);
  return signOtpToken({ userId: user.id, purpose });
}

export class AuthService {
  async setup(body: { name: string; email: string; password: string }, device?: DeviceInfo) {
    const existing = await db.query.users.findFirst({ where: eq(users.role, 'SUPER_ADMIN'), columns: { id: true } });
    if (existing) throw new AppError('Owner already exists', 409);
    const password = await hashPassword(body.password);
    const [user] = await db.insert(users).values({ ...body, password, role: 'SUPER_ADMIN' }).returning();
    if (!user) throw new AppError('Setup failed', 500);
    return issueTokens(user, device);
  }

  async register(body: { name: string; email: string; password: string }, device?: DeviceInfo) {
    const existing = await db.query.users.findFirst({ where: eq(users.email, body.email) });
    if (existing) throw new AppError('Email already registered', 409);
    const password = await hashPassword(body.password);
    const [user] = await db.insert(users).values({ ...body, password }).returning();
    if (!user) throw new AppError('Registration failed', 500);
    return issueTokens(user, device);
  }

  async login(body: { email: string; password: string }, device?: DeviceInfo) {
    const user = await db.query.users.findFirst({ where: eq(users.email, body.email) });
    if (!user || !(await comparePassword(body.password, user.password))) {
      throw new AppError('Invalid credentials', 401);
    }

    if (user.role === 'SUPER_ADMIN') {
      return { requiresOtp: false as const, ...(await issueTokens(user, device)) };
    }

    if (user.sellerId) {
      const seller = await db.query.sellers.findFirst({
        where: eq(sellers.id, user.sellerId),
        columns: { isActive: true },
      });
      if (seller && !seller.isActive) {
        throw new AppError('Your shop account has been suspended. Contact the platform owner.', 403);
      }
    }

    const otpToken = await createAndSendOtp(user, 'LOGIN');
    return { requiresOtp: true as const, otpToken };
  }

  async verifyLoginOtp(body: { otpToken: string; code: string }, device?: DeviceInfo) {
    let payload: { userId: string; purpose: string };
    try { payload = verifyOtpToken(body.otpToken); }
    catch { throw new AppError('Session expired. Please login again.', 401); }

    if (payload.purpose !== 'LOGIN') throw new AppError('Invalid token', 400);

    const otp = await db.query.otps.findFirst({
      where: and(eq(otps.userId, payload.userId), eq(otps.purpose, 'LOGIN')),
    });

    if (!otp || otp.expiresAt < new Date()) throw new AppError('OTP expired. Please login again.', 401);

    if (otp.attempts >= MAX_OTP_ATTEMPTS) {
      await db.delete(otps).where(eq(otps.id, otp.id));
      throw new AppError('Too many incorrect attempts. Please login again.', 429);
    }

    if (!verifyOtp(body.code, otp.codeHash)) {
      await db.update(otps).set({ attempts: sql`${otps.attempts} + 1` }).where(eq(otps.id, otp.id));
      const left = MAX_OTP_ATTEMPTS - otp.attempts - 1;
      if (left <= 0) {
        await db.delete(otps).where(eq(otps.id, otp.id));
        throw new AppError('Too many incorrect attempts. Please login again.', 429);
      }
      throw new AppError(`Incorrect code. ${left} attempt${left === 1 ? '' : 's'} remaining.`, 400);
    }

    await db.delete(otps).where(eq(otps.id, otp.id));
    const user = await db.query.users.findFirst({ where: eq(users.id, payload.userId) });
    if (!user) throw new AppError('User not found', 404);
    return issueTokens(user, device);
  }

  async resendOtp(body: { otpToken: string }) {
    let payload: { userId: string; purpose: string };
    try { payload = verifyOtpToken(body.otpToken); }
    catch { throw new AppError('Session expired. Please login again.', 401); }
    if (payload.purpose !== 'LOGIN') throw new AppError('Invalid token', 400);

    const user = await db.query.users.findFirst({ where: eq(users.id, payload.userId) });
    if (!user) throw new AppError('User not found', 404);
    return { otpToken: await createAndSendOtp(user, 'LOGIN') };
  }

  async forgotPassword(body: { email: string }) {
    const user = await db.query.users.findFirst({ where: eq(users.email, body.email) });
    if (!user || user.role === 'SUPER_ADMIN') return;
    await createAndSendOtp(user, 'PASSWORD_RESET');
  }

  async resetPassword(body: { email: string; code: string; newPassword: string }) {
    const user = await db.query.users.findFirst({ where: eq(users.email, body.email) });
    if (!user) throw new AppError('Invalid request', 400);

    const otp = await db.query.otps.findFirst({
      where: and(eq(otps.userId, user.id), eq(otps.purpose, 'PASSWORD_RESET')),
    });

    if (!otp || otp.expiresAt < new Date()) throw new AppError('Code expired. Please request a new one.', 400);

    if (otp.attempts >= MAX_OTP_ATTEMPTS) {
      await db.delete(otps).where(eq(otps.id, otp.id));
      throw new AppError('Too many incorrect attempts. Please request a new reset code.', 429);
    }

    if (!verifyOtp(body.code, otp.codeHash)) {
      await db.update(otps).set({ attempts: sql`${otps.attempts} + 1` }).where(eq(otps.id, otp.id));
      const left = MAX_OTP_ATTEMPTS - otp.attempts - 1;
      if (left <= 0) {
        await db.delete(otps).where(eq(otps.id, otp.id));
        throw new AppError('Too many incorrect attempts. Please request a new reset code.', 429);
      }
      throw new AppError(`Incorrect code. ${left} attempt${left === 1 ? '' : 's'} remaining.`, 400);
    }

    await db.delete(otps).where(eq(otps.id, otp.id));
    await db.update(users).set({ password: await hashPassword(body.newPassword) }).where(eq(users.id, user.id));
  }

  async refresh(token: string, device?: DeviceInfo) {
    if (!token) throw new AppError('Refresh token required', 400);
    let payload: { userId: string };
    try { payload = verifyRefresh(token); } catch { throw new AppError('Invalid refresh token', 401); }

    // Atomically delete — returns the row if it existed and wasn't expired.
    // This eliminates the race condition where two concurrent requests both
    // pass a findFirst check before either deletes the token.
    const [deleted] = await db
      .delete(refreshTokens)
      .where(and(eq(refreshTokens.token, token), gt(refreshTokens.expiresAt, new Date())))
      .returning({ ip: refreshTokens.ip, userAgent: refreshTokens.userAgent });

    if (!deleted) throw new AppError('Refresh token expired or already used', 401);

    const carried: DeviceInfo = {
      ip:        deleted.ip        ?? device?.ip,
      userAgent: deleted.userAgent ?? device?.userAgent,
    };

    const user = await db.query.users.findFirst({ where: eq(users.id, payload.userId) });
    if (!user) throw new AppError('User not found', 404);
    return issueTokens(user, carried);
  }

  async logout(token: string) {
    if (token) await db.delete(refreshTokens).where(eq(refreshTokens.token, token));
  }
}
