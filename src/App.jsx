// App.jsx - Main Application Coordinator for LingoGoc AI
import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import RoadmapView from './components/RoadmapView';
import IpaView from './components/IpaView';
import VocabView from './components/VocabView';
import ReflexView from './components/ReflexView';
import AiSpeakingView from './components/AiSpeakingView';
import ProgressView from './components/ProgressView';
import { loadUserData, saveUserData } from './utils/storage';

export default function App() {
  const [userData, setUserData] = useState(() => loadUserData());
  const [activeTab, setActiveTab] = useState('roadmap');
  const [voiceSpeed, setVoiceSpeed] = useState(0.85);
  const [theme, setTheme] = useState('dark');

  // Load initial settings
  useEffect(() => {
    if (userData?.settings) {
      if (userData.settings.theme) setTheme(userData.settings.theme);
      if (userData.settings.voiceSpeed) setVoiceSpeed(userData.settings.voiceSpeed);
    }
  }, []);

  // Update theme class on body
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Update User Data & sync with LocalStorage
  const handleUpdateUserData = (newData) => {
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

  return (
    <div className={`app-root ${theme}-theme`}>
      {/* Top Navigation Bar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        userData={userData}
        onToggleSpeed={handleToggleSpeed}
        voiceSpeed={voiceSpeed}
        theme={theme}
        onToggleTheme={handleToggleTheme}
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
    </div>
  );
}
