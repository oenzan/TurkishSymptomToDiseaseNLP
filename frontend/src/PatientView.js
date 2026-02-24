import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Logo from './assets/logo.svg';

function PatientView({ onNavigateToDepartment }) {
  // Helper function to normalize symptoms for comparison
  const normalizeSymptom = (symptom) => {
    if (!symptom) return '';
    return symptom.toLowerCase().trim().replace(/\s+/g, ' ');
  };
  
  const [symptoms, setSymptoms] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentSymptoms, setCurrentSymptoms] = useState('');
  const [normalizedSymptomsList, setNormalizedSymptomsList] = useState([]);
  const [currentAnswer, setCurrentAnswer] = useState(null);
  const [surveyMode, setSurveyMode] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [negativeCount, setNegativeCount] = useState(0);
  const [questionCount, setQuestionCount] = useState(0);
  const [askedSymptoms, setAskedSymptoms] = useState(new Set());
  const [availableSymptomsToAsk, setAvailableSymptomsToAsk] = useState([]);
  const [isProcessingAnswer, setIsProcessingAnswer] = useState(false);

  const [loadingMsgIndex, setLoadingMsgIndex] = useState(0);
  const loadingMessages = [
    'Semptomlarına uygun bölümü buluyoruz',
    'MedGemma analiz yapıyor',
    'Seni en uygun bölüme yönlendireceğiz',
    'Kısa bir süre içinde sonuç gösterilecek'
  ];

  useEffect(() => {
    if (!loading) return;
    setLoadingMsgIndex(0);
    const t = setInterval(() => {
      setLoadingMsgIndex(i => (i + 1) % loadingMessages.length);
    }, 3000);
    return () => clearInterval(t);
  }, [loading]);

  const analyzeSymptoms = async (symptomsText) => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.post('/api/ask', { symptoms: symptomsText });
      console.log('API response:', res.data);
      
      const answer = res.data.answer || {};
      const normalized = res.data.normalized_symptoms || [];
      const shouldSkipQuestions = res.data.should_skip_questions || false;
      
      setCurrentAnswer(answer);
      setNormalizedSymptomsList(normalized);

      // Check if MedGemma identified any departments (validates symptom input)
      if (!answer.departments || answer.departments.length === 0) {
        setError('Herhangi bir hastalık semptomu girmediniz');
        return;
      }

      // If high confidence, navigate directly to department
      if (shouldSkipQuestions) {
        const normalizedText = normalized.join(', ');
        onNavigateToDepartment(answer.departments[0], normalizedText, answer, []);
        return;
      }

      // Start survey with MedGemma-generated symptoms_to_ask
      const rawSymptomsToAsk = answer.symptoms_to_ask || [];
      const symptomsToAsk = [];
      const seenNormalized = new Set();
      
      for (const symptom of rawSymptomsToAsk) {
        const norm = normalizeSymptom(symptom);
        if (!seenNormalized.has(norm)) {
          seenNormalized.add(norm);
          symptomsToAsk.push(symptom);
        }
      }
      
      console.log('Symptoms to ask:', symptomsToAsk);
      setAvailableSymptomsToAsk(symptomsToAsk);
      const normalizedText = normalized.join(', ');
      startSurvey(answer, normalizedText, symptomsToAsk);
    } catch (e) {
      console.error('API error', e);
      setError(e.message || 'API error');
    } finally {
      setLoading(false);
    }
  };

  const startSurvey = (answer, symptomsText, symptomsToAsk) => {
    if (questionCount >= 4) {
      if (answer.departments && answer.departments.length > 0) {
        onNavigateToDepartment(answer.departments[0], symptomsText, answer, []);
      }
      return;
    }
    
    const currentSymptomsNormalized = normalizedSymptomsList.map(s => normalizeSymptom(s));
    const availableSymptoms = symptomsToAsk.filter(s => {
      const norm = normalizeSymptom(s);
      const alreadyAsked = Array.from(askedSymptoms).some(asked => normalizeSymptom(asked) === norm);
      const alreadyHas = currentSymptomsNormalized.some(current => current === norm);
      return !alreadyAsked && !alreadyHas;
    });
    
    if (availableSymptoms.length > 0) {
      setSurveyMode(true);
      setCurrentQuestion(availableSymptoms[0]);
      setCurrentSymptoms(symptomsText);
    } else {
      if (answer.departments && answer.departments.length > 0) {
        onNavigateToDepartment(answer.departments[0], symptomsText, answer, []);
      }
    }
  };

  const handleSurveyAnswer = async (hasSymptom) => {
    // Prevent multiple clicks
    if (isProcessingAnswer) {
      console.log('Already processing answer, ignoring click');
      return;
    }
    
    setIsProcessingAnswer(true);
    
    const updatedAskedSymptoms = new Set([...askedSymptoms, currentQuestion]);
    setAskedSymptoms(updatedAskedSymptoms);
    
    const newQuestionCount = questionCount + 1;
    setQuestionCount(newQuestionCount);
    
    if (hasSymptom) {
      // Add symptom and re-analyze with MedGemma
      const newSymptoms = currentSymptoms + ', ' + currentQuestion;
      setNegativeCount(0);
      
      try {
        const res = await axios.post('/api/ask', { symptoms: newSymptoms });
        
        const answer = res.data.answer || {};
        const normalized = res.data.normalized_symptoms || [];
        const shouldSkipQuestions = res.data.should_skip_questions || false;
        setCurrentAnswer(answer);
        setNormalizedSymptomsList(normalized);
        
        if (shouldSkipQuestions || newQuestionCount >= 4) {
          const normalizedText = normalized.join(', ');
          setSurveyMode(false);
          setLoading(true);
          setIsProcessingAnswer(false);
          onNavigateToDepartment(answer.departments[0], normalizedText, answer, []);
          return;
        }
        
        // Continue survey
        const normalizedText = normalized.join(', ');
        const currentSymptomsNormalized = normalized.map(s => normalizeSymptom(s));
        const availableSymptoms = availableSymptomsToAsk.filter(s => {
          const norm = normalizeSymptom(s);
          const alreadyAsked = Array.from(updatedAskedSymptoms).some(asked => normalizeSymptom(asked) === norm);
          const alreadyHas = currentSymptomsNormalized.some(current => current === norm);
          return !alreadyAsked && !alreadyHas;
        });
        
        if (availableSymptoms.length > 0 && newQuestionCount < 4) {
          setCurrentQuestion(availableSymptoms[0]);
          setCurrentSymptoms(normalizedText);
          setIsProcessingAnswer(false);
        } else {
          if (answer.departments && answer.departments.length > 0) {
            setSurveyMode(false);
            setLoading(true);
            setIsProcessingAnswer(false);
            onNavigateToDepartment(answer.departments[0], normalizedText, answer, []);
          }
        }
      } catch (e) {
        console.error('API error', e);
        setError(e.message || 'API error');
        setIsProcessingAnswer(false);
      }
    } else {
      // Increment negative count
      const newNegativeCount = negativeCount + 1;
      setNegativeCount(newNegativeCount);

      if (newNegativeCount >= 3) {
        // Navigate to top department after 3 negatives
        if (currentAnswer && currentAnswer.departments && currentAnswer.departments.length > 0) {
          setLoading(true);
          setIsProcessingAnswer(false);
          onNavigateToDepartment(currentAnswer.departments[0], currentSymptoms, currentAnswer, []);
        }
        return;
      }

      // Ask next question from existing list (no API call needed)
      const currentSymptomsNormalized = normalizedSymptomsList.map(s => normalizeSymptom(s));
      const availableSymptoms = availableSymptomsToAsk.filter(s => {
        const norm = normalizeSymptom(s);
        const alreadyAsked = Array.from(updatedAskedSymptoms).some(asked => normalizeSymptom(asked) === norm);
        const alreadyHas = currentSymptomsNormalized.some(current => current === norm);
        return !alreadyAsked && !alreadyHas;
      });
      
      if (availableSymptoms.length > 0 && newQuestionCount < 4) {
        setCurrentQuestion(availableSymptoms[0]);
        setIsProcessingAnswer(false);
      } else {
        // No more questions or reached limit, navigate to top department
        if (currentAnswer && currentAnswer.departments && currentAnswer.departments.length > 0) {
          setLoading(true);
          setIsProcessingAnswer(false);
          onNavigateToDepartment(currentAnswer.departments[0], currentSymptoms, currentAnswer, []);
        }
      }
    }
  };

  const handleSubmit = () => {
    if (!symptoms) return setError('Lütfen semptom girin.');
    setNegativeCount(0);
    setQuestionCount(0);
    setAskedSymptoms(new Set());
    setNormalizedSymptomsList([]);
    setAvailableSymptomsToAsk([]);
    setCurrentAnswer(null);
    analyzeSymptoms(symptoms);
  };

  if (surveyMode && currentQuestion) {
    return (
      <div className="container">
        {loading && (
          <div className="overlay" role="status" aria-busy="true">
            <div className="overlay-inner">
              <img src={Logo} alt="logo" className="logo-anim" />
              <div className="overlay-text">Bölüm öneriniz hazırlanıyor...</div>
            </div>
          </div>
        )}
        
        <main className="content survey-container">
          <div className="survey-card">
            <h2>Ek Belirtiler</h2>
            <p className="survey-question">Aşağıdaki belirtiyi yaşıyor musunuz?</p>
            <div className="symptom-box" key={currentQuestion}>
              {currentQuestion}
            </div>
            
            {isProcessingAnswer && (
              <div style={{
                textAlign: 'center',
                padding: '16px',
                color: 'var(--accent1)',
                fontSize: '14px',
                fontWeight: 500
              }}>
                <div style={{
                  display: 'inline-block',
                  width: '20px',
                  height: '20px',
                  border: '3px solid rgba(88, 166, 255, 0.3)',
                  borderTopColor: 'var(--accent1)',
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite',
                  marginRight: '8px',
                  verticalAlign: 'middle'
                }}></div>
                Analiz ediliyor...
              </div>
            )}
            
            <div className="survey-actions">
              <button 
                onClick={() => handleSurveyAnswer(true)} 
                className="btn-primary"
                disabled={isProcessingAnswer || loading}
                style={{
                  opacity: isProcessingAnswer ? 0.6 : 1,
                  cursor: isProcessingAnswer ? 'not-allowed' : 'pointer'
                }}
              >
                {isProcessingAnswer ? '⏳ Bekleniyor...' : 'Evet'}
              </button>
              <button 
                onClick={() => handleSurveyAnswer(false)} 
                className="btn-secondary"
                disabled={isProcessingAnswer || loading}
                style={{
                  opacity: isProcessingAnswer ? 0.6 : 1,
                  cursor: isProcessingAnswer ? 'not-allowed' : 'pointer'
                }}
              >
                {isProcessingAnswer ? '⏳ Bekleniyor...' : 'Hayır'}
              </button>
            </div>
            <p className="survey-hint">
              {questionCount < 4 && negativeCount < 3 
                ? `En fazla ${Math.max(0, 4 - questionCount)} soru daha veya ${Math.max(0, 3 - negativeCount)} "Hayır" yanıtından sonra bölüm önerisi yapılacak.`
                : ''}
            </p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="container">
      {loading && (
        <div className="overlay" role="status" aria-busy="true">
          <div className="overlay-inner">
            <img src={Logo} alt="logo" className="logo-anim" />
            <div className="overlay-text">{loadingMessages[loadingMsgIndex]}</div>
          </div>
        </div>
      )}

      <aside className="sidebar">
        <h1>🩺 Hasta Girişi</h1>
        <p className="muted">Semptomlarınızı girin, size en uygun bölümü bulalım.</p>
      </aside>

      <main className="content">
        <label className="label">🩺 Hangi semptomlara sahipsiniz?</label>
        <textarea 
          value={symptoms} 
          onChange={(e) => setSymptoms(e.target.value)} 
          placeholder="örn: Başım ağrıyor ve midem bulanıyor"
        />

        <div className="actions">
          <button onClick={handleSubmit} disabled={loading} className="btn-primary">
            {loading ? 'Bekleniyor...' : 'Gönder'}
          </button>
          <button onClick={() => setSymptoms('')} className="btn-ghost">Temizle</button>
        </div>

        {error && <div className="error">{error}</div>}
      </main>
    </div>
  );
}

export default PatientView;

