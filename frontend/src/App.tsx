import { BrowserRouter, Route, Routes } from 'react-router-dom';
import styles from './App.module.scss';
import { LoginPage } from './pages/LoginPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { HomePage } from './pages/HomePage';
import { UserProvider } from './contexts/UserContext';
import { ProfilePage } from './pages/ProfilePage';
import { ProtectedRoute } from './components/ProtectedRoutes';
import { SignUpConfirmation } from './pages/SignUpConfirmation';
import { GuestRoute } from './components/GuestRoute';
import { ConfirmEmailPage } from './pages/ConfirmEmailPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { HowToPlay } from './pages/HowToPlay';
import { LanguageSwitcher } from './components/LanguageSwitcher';
import { TestingVillainPage, TestingCardPage } from './pages/TestPage';
import { ToastProvider } from './contexts/ToastContext';
import { PublicProfilePage } from './pages/PublicProfilePage';
import { MessagesPage } from './pages/MessagesPage';
import { FriendsPage } from './pages/FriendsPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { LobbyPage } from './pages/LobbyPage';
import { GamePage } from './pages/GamePage';

function App() {
  return (
    <ToastProvider>
      <UserProvider>
        <main>
          <BrowserRouter>
            <div className={styles.app}>
              <div className={styles.headerApp}>
                <div className={styles.headerActions}>
                  <LanguageSwitcher />
                </div>
              </div>
              <Routes>
                <Route element={<GuestRoute />}>
                  <Route path="/" element={<LoginPage />} />
                  <Route path="/confirm-email" element={<ConfirmEmailPage />} />
                  <Route
                    path="/email-confirmation"
                    element={<SignUpConfirmation />}
                  />
                  <Route
                    path="/reset-password"
                    element={<ResetPasswordPage />}
                  />
                  <Route
                    path="/forgot-password"
                    element={<ForgotPasswordPage />}
                  />
                </Route>
                <Route element={<ProtectedRoute />}>
                  <Route path="/home" element={<HomePage />} />
                  {/* <Route path="/howtoplay" element={<HowToPlay />} /> */}
                  <Route path="/howtoplay/:villain?" element={<HowToPlay />} />
                  <Route
                    path="/test/villain/:villain"
                    element={<TestingVillainPage />}
                  />
                  <Route path="/test/card/:id" element={<TestingCardPage />} />
                  <Route path="/profile" element={<ProfilePage />} />
                  <Route
                    path="/profile/:login"
                    element={<PublicProfilePage />}
                  />
                  <Route
                    path="/messages/:conversationId?"
                    element={<MessagesPage />}
                  />
                  <Route path="/friends" element={<FriendsPage />} />
                  <Route
                    path="/notifications"
                    element={<NotificationsPage />}
                  />
                  <Route path="/lobby/:code" element={<LobbyPage />} />
                  <Route path="/game/:code" element={<GamePage />} />
                </Route>
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </div>
          </BrowserRouter>
        </main>
      </UserProvider>
    </ToastProvider>
  );
}

export default App;
