// App.jsx - Main Application Coordinator for LingoGoc AI
import React, { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import Navbar from './components/Navbar';
import RoadmapView from './components/RoadmapView';
import IpaView from './components/IpaView';
import VocabView from './components/VocabView';
import ReflexView from './components/ReflexView';
import AiSpeakingView from './components/AiSpeakingView';
import ProgressView from './components/ProgressView';
import DiagnosticTestView from './components/DiagnosticTestView';
import SmartReviewView from './components/SmartReviewView';
import BattleView from './components/BattleView';
import AudioPodView from './components/AudioPodView';
import CertificateView from './components/CertificateView';
import DictationView from './components/DictationView';
import TrapsView from './components/TrapsView';
import SettingsModal from './components/SettingsModal';
import SpeechStatus from './components/SpeechStatus';
import ItCareerView from './components/ItCareerView';
import { loadUserData, saveUserData } from './utils/storage';
import { getSrsStats } from './utils/srsEngine';
import { loadBestAvailableSystemVocabulary, refreshSystemVocabulary } from './utils/systemVocabularyService';
import speechHelper from './utils/speechHelper';
import { loadOrCreateGuestIdentity } from './utils/guestIdentity';
import NetworkStatus from './components/NetworkStatus';

const VocabularyAdminView = lazy(() => import('./components/VocabularyAdminView'));

export default function App() {
  const [userData, setUserData] = useState(() => {
    loadOrCreateGuestIdentity();
    return loadUserData();
  });
  const [activeTab, setActiveTab] = useState(() => (
    new URLSearchParams(window.location.search).get('admin') === '1' ? 'vocab-admin' : 'roadmap'
  ));
  const [voiceSpeed, setVoiceSpeed] = useState(() => userData?.settings?.voiceSpeed || 0.85);
  const [theme, setTheme] = useState(() => userData?.settings?.theme || 'dark');
  const [vocabulary, setVocabulary] = useState([]);
  const dueSrsCount = useMemo(
    () => (vocabulary.length ? getSrsStats(vocabulary).dueCount || 0 : 0),
    [vocabulary],
  );

  // Modals
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  // The learning catalog is fully managed by the application. Learners always
  // receive the same curated system vocabulary on every device.
  useEffect(() => {
    let active = true;
    loadBestAvailableSystemVocabulary().then(({ words, contentHash }) => {
      if (!active) return;
      setVocabulary(words);
      refreshSystemVocabulary(words, 4000, contentHash).then((updatedWords) => {
        if (active && updatedWords) setVocabulary(updatedWords);
      });
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    speechHelper.setVoicePreset(userData?.settings?.voicePreset || 'auto');
  }, [userData?.settings?.voicePreset]);

  // Update theme class on body
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Update User Data & sync with LocalStorage
  const handleUpdateUserData = (newData) => {
    speechHelper.setVoicePreset(newData?.settings?.voicePreset || 'auto');
    setUserData(newData);
    saveUserData(newData);
  };

  // Toggle Voice Speed between 0.75x (slow for beginners) and 1.0x (normal)
  const handleToggleSpeed = () => {
    const nextSpeed = voiceSpeed <= 0.85 ? 1.0 : 0.75;
    setVoiceSpeed(nextSpeed);
    const updated = {
      ...userData,
      settings: {
        ...(userData?.settings || {}),
        voiceSpeed: nextSpeed
      }
    };
    handleUpdateUserData(updated);
  };

  // Toggle Theme between Dark and Light
  const handleToggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    const updated = {
      ...userData,
      settings: {
        ...(userData?.settings || {}),
        theme: nextTheme
      }
    };
    handleUpdateUserData(updated);
  };

  // Handle stage selection from Diagnostic Test
  const handleSelectStage = (stageNum) => {
    switch (stageNum) {
      case 1:
        setActiveTab('ipa');
        break;
      case 2:
        setActiveTab('vocab');
        break;
      case 3:
        setActiveTab('reflex');
        break;
      case 4:
        setActiveTab('speaking');
        break;
      default:
        setActiveTab('roadmap');
    }
  };

  return (
    <div className={`app-root ${theme}-theme`}>
      <NetworkStatus />
      {/* Top Navigation Bar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        userData={userData}
        onToggleSpeed={handleToggleSpeed}
        voiceSpeed={voiceSpeed}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        dueSrsCount={dueSrsCount}
        onOpenSettingsModal={() => setIsSettingsModalOpen(true)}
      />

      {/* Main View Screen Container */}
      <main className="app-main-content">
        <div className="content-max-width">
          {activeTab === 'vocab-admin' && (
            <Suspense fallback={<p>Đang tải công cụ quản trị…</p>}>
              <VocabularyAdminView />
            </Suspense>
          )}
          {activeTab === 'roadmap' && (
            <RoadmapView 
              setActiveTab={setActiveTab} 
              userData={userData}
              vocabularyCount={vocabulary.length}
            />
          )}

          {activeTab === 'diagnostic' && (
            <DiagnosticTestView
              onSelectStage={handleSelectStage}
              onCompleteTest={() => setUserData(loadUserData())}
            />
          )}

          {activeTab === 'ipa' && (
            <IpaView 
              userData={userData} 
              onUpdateUserData={handleUpdateUserData} 
              voiceSpeed={voiceSpeed} 
            />
          )}

          {activeTab === 'vocab' && (
            <VocabView 
              userData={userData} 
              onUpdateUserData={handleUpdateUserData}
              voiceSpeed={voiceSpeed}
              vocabulary={vocabulary}
            />
          )}

          {activeTab === 'srs' && (
            <SmartReviewView
              key={vocabulary.length}
              onBackToVocab={() => setActiveTab('vocab')}
              onUpdateUserData={handleUpdateUserData}
              vocabulary={vocabulary}
            />
          )}

          {activeTab === 'battle' && (
            <BattleView
              userData={userData}
              onUpdateUserData={handleUpdateUserData}
              vocabulary={vocabulary}
            />
          )}

          {activeTab === 'audiopod' && (
            <AudioPodView
              voiceSpeed={voiceSpeed}
              vocabulary={vocabulary}
              onUpdateUserData={handleUpdateUserData}
            />
          )}

          {activeTab === 'certificate' && (
            <CertificateView
              userData={userData}
            />
          )}

          {activeTab === 'dictation' && (
            <DictationView 
              userData={userData} 
              onUpdateUserData={handleUpdateUserData} 
            />
          )}

          {activeTab === 'traps' && (
            <TrapsView 
              userData={userData} 
              onUpdateUserData={handleUpdateUserData} 
            />
          )}

          {activeTab === 'it-career' && (
            <ItCareerView
              userData={userData}
              onUpdateUserData={handleUpdateUserData}
              voiceSpeed={voiceSpeed}
            />
          )}

          {activeTab === 'reflex' && (
            <ReflexView 
              userData={userData} 
              onUpdateUserData={handleUpdateUserData} 
              voiceSpeed={voiceSpeed} 
            />
          )}

          {activeTab === 'speaking' && (
            <AiSpeakingView 
              userData={userData} 
              onUpdateUserData={handleUpdateUserData} 
              voiceSpeed={voiceSpeed} 
            />
          )}

          {activeTab === 'progress' && (
            <ProgressView 
              userData={userData} 
              onUpdateUserData={handleUpdateUserData} 
            />
          )}
        </div>
      </main>

      {/* Motivational Beginner Footer */}
      <footer className="app-footer">
        <div className="footer-inner">
          <div className="footer-brand">
            <span className="footer-seedling">🌱</span>
            <strong>LingoGoc</strong> — Mỗi ngày một bước, xây lại gốc tiếng Anh
          </div>
          <div className="footer-quote">
            “Đi chậm vẫn là đang tiến về phía trước.”
          </div>
        </div>
      </footer>

      {/* User Settings & Data Backup Modal */}
      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        userData={userData}
        onUpdateUserData={handleUpdateUserData}
      />
      <SpeechStatus />
    </div>
  );
}
