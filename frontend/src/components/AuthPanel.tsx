import { useMemo, useState } from 'react';
import { BrowserQRCodeReader } from '@zxing/browser';
import { api } from '../api';
import { useAppStore } from '../store';

// Authentication is intentionally QR-first: the screen teaches the code path
// that the backend also relies on, instead of hiding login behind test data.
export function AuthPanel() {
  const setAuth = useAppStore((s) => s.setAuth);
  const setRegistration = useAppStore((s) => s.setRegistration);
  const qrDataUrl = useAppStore((s) => s.qrDataUrl);
  const recoveryCode = useAppStore((s) => s.recoveryCode);

  const [displayName, setDisplayName] = useState('');
  const [qrInput, setQrInput] = useState('');
  const [error, setError] = useState<string | undefined>();
  const codeReader = useMemo(() => new BrowserQRCodeReader(), []);

  const register = async () => {
    setError(undefined);
    try {
      const res = await api.post('/auth/register', { displayName, enableRecoveryCode: true });
      setRegistration({
        qrPayload: res.data.qrPayload,
        qrDataUrl: res.data.qrDataUrl,
        recoveryCode: res.data.recoveryCode
      });
      setQrInput(res.data.qrPayload);
    } catch {
      setError('가입 중 오류가 발생했습니다.');
    }
  };

  const login = async (payload: string) => {
    setError(undefined);
    try {
      const res = await api.post('/auth/login', { qrPayload: payload });
      setAuth({ sessionId: res.data.sessionId, userId: res.data.userId });
    } catch {
      setError('로그인 실패: QR 형식/토큰을 확인해주세요.');
    }
  };

  const scanFromImage = async (file: File) => {
    setError(undefined);
    try {
      const imageUrl = URL.createObjectURL(file);
      const result = await codeReader.decodeFromImageUrl(imageUrl);
      URL.revokeObjectURL(imageUrl);
      setQrInput(result.getText());
      await login(result.getText());
    } catch {
      setError('이미지에서 QR을 읽지 못했습니다.');
    }
  };

  return (
    <div className="auth-shell">
      <div className="panel card">
        <h2>QR 기반 가입</h2>
        <input
          className="field"
          placeholder="표시 이름 (선택)"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
        />
        <button className="btn primary" onClick={register}>
          가입 + QR 발급
        </button>
        {qrDataUrl ? (
          <div className="qr-block">
            <img src={qrDataUrl} alt="QR" className="qr" />
            <a className="btn ghost" href={qrDataUrl} download="turinglet-identity-qr.png">
              QR 다운로드
            </a>
            {recoveryCode ? <p className="hint">복구코드: {recoveryCode}</p> : null}
          </div>
        ) : null}
      </div>

      <div className="panel card">
        <h2>QR 로그인</h2>
        <textarea
          className="field"
          placeholder="QR payload 붙여넣기"
          value={qrInput}
          onChange={(e) => setQrInput(e.target.value)}
        />
        <button className="btn primary" onClick={() => login(qrInput)}>
          로그인
        </button>

        <div className="scan-tools">
          <label className="btn ghost">
            이미지 업로드로 스캔
            <input
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void scanFromImage(file);
              }}
            />
          </label>
        </div>

        {error ? <p className="error">{error}</p> : null}
      </div>
    </div>
  );
}
