/**
 * QR 등록·로그인·복구 API를 Store와 보안 유틸리티에 연결한다.
 * 토큰 검증 또는 DB 오류를 정상 로그인으로 처리하지 않는다.
 */

import type express from 'express';
import QRCode from 'qrcode';
import type { Store } from '../db/store.js';
import { decodeQrPayload, encodeQrPayload } from '../utils/qrPayload.js';
import { generateLongPublicId, generateRecoveryCode, hashOptional } from '../utils/security.js';
import { LoginSchema, RecoverSchema, RegisterSchema } from './schemas.js';

interface AuthRouteDeps {
  store: Store;
}

export function registerAuthRoutes(app: express.Express, deps: AuthRouteDeps): void {
  app.post('/api/auth/register', async (req, res) => {
    const parsed = RegisterSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    const publicId = generateLongPublicId();
    const recoveryCode = parsed.data.enableRecoveryCode ? generateRecoveryCode() : undefined;
    const user = await deps.store.createUser({
      publicId,
      displayName: parsed.data.displayName,
      recoveryCodeHash: hashOptional(recoveryCode)
    });
    await deps.store.createIdentityToken(user.id, publicId);

    const qrPayload = encodeQrPayload({ v: 1, type: 'turinglet-id', token: publicId });
    const qrDataUrl = await QRCode.toDataURL(qrPayload, { errorCorrectionLevel: 'H' });
    res.status(201).json({ userId: user.id, publicId: user.publicId, qrPayload, qrDataUrl, recoveryCode });
  });

  app.post('/api/auth/login', async (req, res) => {
    const parsed = LoginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid login payload' });
      return;
    }

    try {
      const payload = decodeQrPayload(parsed.data.qrPayload);
      const user = await deps.store.findUserByToken(payload.token);
      if (!user) {
        res.status(401).json({ error: 'Unknown QR token' });
        return;
      }

      const existingSession = await deps.store.getLatestSessionByUserId(user.id);
      const session = existingSession ?? (await deps.store.createSession(user.id));
      if (!existingSession) {
        await deps.store.appendMessage({
          sessionId: session.id,
          role: 'assistant',
          content: '안녕하세요. 지금은 천천히 시작해도 괜찮아요.',
          metadata: { source: 'system_greeting' }
        });
      }
      res.status(200).json({ sessionId: session.id, userId: user.id, resumed: Boolean(existingSession) });
    } catch {
      res.status(400).json({ error: 'Malformed or forged QR payload' });
    }
  });

  app.post('/api/auth/recover', async (req, res) => {
    const parsed = RecoverSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid recovery payload' });
      return;
    }

    const user = await deps.store.findUserByRecoveryCode(parsed.data.recoveryCode);
    if (!user) {
      res.status(401).json({ error: 'Recovery code mismatch' });
      return;
    }

    const replacementPublicId = generateLongPublicId();
    await deps.store.createIdentityToken(user.id, replacementPublicId);
    const qrPayload = encodeQrPayload({ v: 1, type: 'turinglet-id', token: replacementPublicId });
    const qrDataUrl = await QRCode.toDataURL(qrPayload, { errorCorrectionLevel: 'H' });
    res.status(200).json({ qrPayload, qrDataUrl });
  });
}
