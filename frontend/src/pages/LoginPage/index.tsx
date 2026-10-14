import { useNavigate } from 'react-router-dom';
import styles from './LoginPage.module.scss';
import { useState } from 'react';
import { useUser } from '../../contexts/UserContext';
import { useTranslation } from '../../hooks/useTranslation';

export function LoginPage() {
  const navigate = useNavigate();
  const { setUser, language } = useUser();
  const t = useTranslation(language, 'loginPage');

  const [mode, setMode] = useState<'login' | 'signup'>('login');

  // login
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginErrorKey, setLoginErrorKey] = useState<keyof NonNullable<typeof t>['loginPage'] | ''>('');
  const [loginLoading, setLoginLoading] = useState(false);

  // signup
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupRepeat, setSignupRepeat] = useState('');
  const [signupErrorKey, setSignupErrorKey] = useState<keyof NonNullable<typeof t>['loginPage'] | ''>('');
  const [signupLoading, setSignupLoading] = useState(false);

  const tr = (key: keyof NonNullable<typeof t>['loginPage'], fallback: string) =>
    t?.loginPage?.[key] ?? fallback;

  const loginError = loginErrorKey ? tr(loginErrorKey, loginErrorKey) : '';
  const signupError = signupErrorKey ? tr(signupErrorKey, signupErrorKey) : '';

  // ── client-side validation ──────────────────────────────────────────────

  const validateEmail = (v: string) => /\S+@\S+\.\S+/.test(v);

  type ErrorKey = keyof NonNullable<typeof t>['loginPage'];

  const getLoginErrorKey = (): ErrorKey | null => {
    if (!email) return 'emailRequired';
    if (!validateEmail(email)) return 'invalidEmail';
    if (!password) return 'passwordRequired';
    return null;
  };

  const getSignupErrorKey = (): ErrorKey | null => {
    if (!signupEmail) return 'emailRequired';
    if (!validateEmail(signupEmail)) return 'invalidEmail';
    if (!signupPassword) return 'passwordRequired';
    if (signupPassword.length < 8) return 'passwordTooShort';
    if (!signupRepeat) return 'repeatRequired';
    if (signupPassword !== signupRepeat) return 'passwordMismatch';
    return null;
  };

  // ── live signup hint while typing ──────────────────────────────────────

  const signupLiveError = (() => {
    if (signupPassword && signupPassword.length < 8)
      return tr('passwordTooShort', 'Password must be at least 8 characters.');
    if (signupRepeat && signupPassword !== signupRepeat)
      return tr('passwordMismatch', 'Passwords do not match.');
    return null;
  })();

  // ── handlers ───────────────────────────────────────────────────────────

  const requestLogin = (loginEmail: string, loginPassword: string) =>
    fetch('/api/users/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email: loginEmail, password: loginPassword }),
    });

  const handleLogin = async () => {
    const errKey = getLoginErrorKey();
    if (errKey) { setLoginErrorKey(errKey); return; }
    setLoginErrorKey('');
    setLoginLoading(true);
    try {
      const res = await requestLogin(email, password);
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 404) setLoginErrorKey('loginNotFound');
        else if (res.status === 401) setLoginErrorKey('loginWrongPassword');
        else if (res.status === 403) setLoginErrorKey('loginVerifyEmail');
        else setLoginErrorKey('loginFailed');
        return;
      }
      setUser(data.user);
      navigate('/home');
    } catch {
      setLoginErrorKey('networkError');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleSignup = async () => {
    const errKey = getSignupErrorKey();
    if (errKey) { setSignupErrorKey(errKey); return; }
    setSignupErrorKey('');
    setSignupLoading(true);
    try {
      const res = await fetch('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: signupEmail, password: signupPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        const msg = data?.error ?? '';
        if (res.status === 409) setSignupErrorKey('signupEmailExists');
        else if (res.status === 400 && msg.toLowerCase().includes('8')) setSignupErrorKey('passwordTooShort');
        else setSignupErrorKey('signupFailed');
        return;
      }
      if (data.emailVerified) {
        // The server doesn't send verification emails: the account is already active
        const loginRes = await requestLogin(signupEmail, signupPassword);
        if (loginRes.ok) {
          const loginData = await loginRes.json();
          setUser(loginData.user);
          navigate('/home');
        } else {
          setEmail(signupEmail);
          switchMode('login');
        }
        return;
      }
      navigate('/email-confirmation');
    } catch {
      setSignupErrorKey('networkError');
    } finally {
      setSignupLoading(false);
    }
  };

  const switchMode = (next: 'login' | 'signup') => {
    setMode(next);
    setLoginErrorKey('');
    setSignupErrorKey('');
  };

  // ── render ──────────────────────────────────────────────────────────────

  return (
    <main className={styles.page}>
      {/* ── left: form ── */}
      <section className={styles.loginCard}>
        <h2 className={styles.cardTitle}>
          {mode === 'login' ? tr('title', 'Login') : tr('signupTitle', 'Sign up')}
        </h2>

        {mode === 'login' ? (
          <form className={styles.form} onSubmit={(e) => { e.preventDefault(); void handleLogin(); }}>
            <div className={styles.field}>
              <input
                type="email"
                placeholder={tr('emailPlaceholder', 'Email')}
                value={email}
                onChange={(e) => { setEmail(e.target.value); setLoginErrorKey(''); }}
                autoComplete="email"
              />
            </div>
            <div className={styles.field}>
              <input
                type="password"
                placeholder={tr('passwordPlaceholder', 'Password')}
                value={password}
                onChange={(e) => { setPassword(e.target.value); setLoginErrorKey(''); }}
                autoComplete="current-password"
              />
            </div>
            {loginError && <p className={styles.errorMsg}>{loginError}</p>}
            <button type="submit" className={styles.loginButton} disabled={loginLoading}>
              {loginLoading ? '…' : tr('enterButton', 'Enter')}
            </button>
          </form>
        ) : (
          <form className={styles.form} onSubmit={(e) => { e.preventDefault(); void handleSignup(); }}>
            <div className={styles.field}>
              <input
                type="email"
                placeholder={tr('emailPlaceholder', 'Email')}
                value={signupEmail}
                onChange={(e) => { setSignupEmail(e.target.value); setSignupErrorKey(''); }}
                autoComplete="email"
              />
            </div>
            <div className={styles.field}>
              <input
                type="password"
                placeholder={tr('passwordPlaceholder', 'Password')}
                value={signupPassword}
                onChange={(e) => { setSignupPassword(e.target.value); setSignupErrorKey(''); }}
                autoComplete="new-password"
              />
            </div>
            <div className={styles.field}>
              <input
                type="password"
                placeholder={tr('repeatPasswordPlaceholder', 'Repeat password')}
                value={signupRepeat}
                onChange={(e) => { setSignupRepeat(e.target.value); setSignupErrorKey(''); }}
                autoComplete="new-password"
              />
            </div>
            {!signupError && signupLiveError && (
              <p className={styles.hintMsg}>{signupLiveError}</p>
            )}
            {signupError && <p className={styles.errorMsg}>{signupError}</p>}
            <button type="submit" className={styles.loginButton} disabled={signupLoading}>
              {signupLoading ? '…' : tr('createAccount', 'Create account')}
            </button>
          </form>
        )}

        <div className={styles.divider}><span>{tr('or', 'or')}</span></div>

        <a href="/api/auth/42" className={styles.fortyTwoButton}>
          {tr('continueWith42', 'Continue with 42')}
        </a>

        <div className={styles.signupPrompt}>
          {mode === 'login' ? (
            <>
              <p className={styles.signupText}>
                <button type="button" onClick={() => switchMode('signup')}>{tr('newHere', 'New here?')}</button>
              </p>
              <p className={styles.signupText}>
                <button type="button" onClick={() => navigate('/forgot-password')}>{tr('forgotPassword', 'Forgot password?')}</button>
              </p>
            </>
          ) : (
            <p className={styles.signupText}>
              <button type="button" onClick={() => switchMode('login')}>{tr('alreadyHaveAccount', 'Already have an account?')}</button>
            </p>
          )}
        </div>
      </section>

      {/* ── right: branding ── */}
      <div className={styles.branding}>
        <p className={styles.welcomeTo}>{tr('welcomeTo', 'Welcome to')}</p>
        <h1 className={styles.gameTitle}>Villainous</h1>
        <p className={styles.tagline}>{tr('tagline', "It's good to be bad")}</p>
      </div>
    </main>
  );
}
