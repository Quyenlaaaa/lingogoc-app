// App.jsx - Main Application Coordinator for LingoGoc AI
import React, { useState, useEffect } from 'react';
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
import LeaderboardView from './components/LeaderboardView';
import AudioPodView from './components/AudioPodView';
import CertificateView from './components/CertificateView';
import VipUpgradeModal from './components/VipUpgradeModal';
import SettingsModal from './components/SettingsModal';
import PwaInstallPrompt from './components/PwaInstallPrompt';
import { loadUserData, saveUserData } from './utils/storage';
import { getSrsStats } from './utils/srsEngine';
import { vocabData } from './data/vocabData';

export default function App() {
  const [userData, setUserData] = useState(() => loadUserData());
  const [activeTab, setActiveTab] = useState('roadmap');
  const [voiceSpeed, setVoiceSpeed] = useState(0.85);
  const [theme, setTheme] = useState('dark');
  const [dueSrsCount, setDueSrsCount] = useState(0);

  // Modals
  const [isVipModalOpen, setIsVipModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  // Load initial settings and SRS due count
  useEffect(() => {
    if (userData?.settings) {
      if (userData.settings.theme) setTheme(userData.settings.theme);
      if (userData.settings.voiceSpeed) setVoiceSpeed(userData.settings.voiceSpeed);
    }
    const stats = getSrsStats(vocabData);
    setDueSrsCount(stats.dueCount || 15);
  }, []);

  // Update theme class on body
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Update User Data & sync with LocalStorage
  const handleUpdateUserData = (newData) => {
    setUserData(newData);
    saveUserData(newData);
    const stats = getSrsStats(vocabData);
    setDueSrsCount(stats.dueCount || 0);
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
      {/* PWA Install Notification Prompt */}
      <PwaInstallPrompt />

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
        onOpenVipModal={() => setIsVipModalOpen(true)}
        onOpenSettingsModal={() => setIsSettingsModalOpen(true)}
      />

      {/* Main View Screen Container */}
      <main className="app-main-content">
        <div className="content-max-width">
          {activeTab === 'roadmap' && (
            <RoadmapView 
              setActiveTab={setActiveTab} 
              userData={userData} 
            />
          )}

          {activeTab === 'diagnostic' && (
            <DiagnosticTestView
              onSelectStage={handleSelectStage}
              onCompleteTest={(res) => {
                const stats = getSrsStats(vocabData);
                setDueSrsCount(stats.dueCount);
              }}
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
              onOpenSrs={() => setActiveTab('srs')}
            />
          )}

          {activeTab === 'srs' && (
            <SmartReviewView
              onBackToVocab={() => setActiveTab('vocab')}
            />
          )}

          {activeTab === 'battle' && (
            <BattleView
              userData={userData}
              onUpdateUserData={handleUpdateUserData}
              onGoToLeaderboard={() => setActiveTab('leaderboard')}
            />
          )}

          {activeTab === 'leaderboard' && (
            <LeaderboardView
              userData={userData}
              onGoToBattle={() => setActiveTab('battle')}
            />
          )}

          {activeTab === 'audiopod' && (
            <AudioPodView
              voiceSpeed={voiceSpeed}
            />
          )}

          {activeTab === 'certificate' && (
            <CertificateView
              userData={userData}
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
            <strong>LingoGoc AI</strong> - Từng bước lấy lại gốc tiếng Anh vững chắc
          </div>
          <div className="footer-quote">
            "Không quan trọng bạn đi chậm thế nào, miễn là bạn không dừng lại."
          </div>
        </div>
      </footer>

      {/* VIP Upgrade Modal with VietQR */}
      <VipUpgradeModal
        isOpen={isVipModalOpen}
        onClose={() => setIsVipModalOpen(false)}
        userData={userData}
        onUpdateUserData={handleUpdateUserData}
      />

      {/* User Settings & Data Backup Modal */}
      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        userData={userData}
        onUpdateUserData={handleUpdateUserData}
        onOpenVipModal={() => setIsVipModalOpen(true)}
      />
    </div>
  );
}
