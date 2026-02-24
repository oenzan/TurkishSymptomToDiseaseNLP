import React, { useState } from 'react';
import './App.css';
import Logo from './assets/logo.svg';
import PatientView from './PatientView';

function App() {
  const [currentView, setCurrentView] = useState('patient'); // 'patient', 'navigation'
  const [navigationInfo, setNavigationInfo] = useState(null);

  const handleNavigateToDepartment = (department, symptoms, doctorInfo = null) => {
    setNavigationInfo({ department, symptoms, doctorInfo });
    setCurrentView('navigation');
  };

  const handleBackToPatient = () => {
    setCurrentView('patient');
    setNavigationInfo(null);
  };

  // Navigation/Redirection View
  if (currentView === 'navigation') {
    return (
      <div className="App">
        <div className="container navigation-view">
          <div className="navigation-inner">
            <div className="navigation-icon">✅</div>
            <h1>Yönlendirme Tamamlandı</h1>
            <div className="navigation-department">
              Sizi <strong>{navigationInfo.department}</strong> bölümüne yönlendiriyoruz...
            </div>
            <div className="navigation-symptoms">
              <strong>Belirtileriniz:</strong> {navigationInfo.symptoms}
            </div>
            <button onClick={handleBackToPatient} className="btn-primary">
              Yeni Sorgu
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Patient View (default)
  return (
    <div className="App">
      <div className="header-bar">
        <img
          src={Logo}
          alt="logo"
          className="logo-small"
        />
        <h2 className="header-title">🩺 MedGemma Tıbbi Asistan</h2>
      </div>
      <PatientView onNavigateToDepartment={handleNavigateToDepartment} />
    </div>
  );
}

export default App;
