import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, FileText, Copy, RefreshCw, Trash2, Activity, User, MessageSquare, Edit3, ClipboardCheck, UserPlus, AlertCircle } from 'lucide-react';

// --- API Configuration ---
const apiKey = ""; 
const MODEL_NAME = "gemini-2.5-flash-preview-09-2025";

const App = () => {
  const [patientName, setPatientName] = useState("");
  const [patientAge, setPatientAge] = useState("");
  const [patientGender, setPatientGender] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [manualMemo, setManualMemo] = useState("");
  const [generatedChart, setGeneratedChart] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  
  const recognitionRef = useRef(null);

  // Initialize Speech Recognition
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'ko-KR';

      recognitionRef.current.onresult = (event) => {
        let currentTranscript = "";
        for (let i = 0; i < event.results.length; i++) {
          currentTranscript += event.results[i][0].transcript;
        }
        setTranscript(currentTranscript);
      };

      recognitionRef.current.onerror = (event) => {
        console.error("Speech Recognition Error:", event.error);
        setIsListening(false);
      };
    } else {
      setError("이 브라우저는 음성 인식을 지원하지 않습니다. 크롬 브라우저를 권장합니다.");
    }
  }, []);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      recognitionRef.current?.start();
      setIsListening(true);
    }
  };

  const generateMedicalChart = async () => {
    if (!transcript.trim() && !manualMemo.trim()) {
      setError("음성 기록이나 메모 중 하나는 입력되어야 합니다.");
      return;
    }

    setIsLoading(true);
    setError(null);

    const systemPrompt = `
      당신은 전문적인 한의학 의료 서기입니다. 
      제공된 데이터를 바탕으로 표준화된 SOAP 형식의 진료 차트를 작성하세요.
      
      [필독 지침: 출력 형식]
      1. '#', '**', '-', '*' 등 어떠한 마크다운 기호도 절대 사용하지 마세요.
      2. 모든 내용은 문장이 아닌 '간결한 단어 및 키워드' 위주로 작성하세요. (예: "만성적인 요통입니다" -> "CC: 만성 요통")
      3. 제목은 다음 순서로 작성하고 뒤에 콜론(:)을 붙이세요:
         주관적 정보 (S)
         객관적 정보 (O)
         평가 및 한의변증 (A)
         계획 (P)
      
      [필독 지침: 섹션별 내용]
      - 주관적 정보 (S): 환자 호소 증상(CC), 발병 시기, 통증 양상 등을 핵심 단어 위주로 기술.
      - 객관적 정보 (O): 이학적 검사 결과, 관찰 소견 등 핵심 키워드 위주. (예: "장요근 검사 필요", "SLR (-) 등")
      - 평가 및 한의변증 (A): 
         1) 한의학적 변증 (기혈수 변증, 장부변증 등)
         2) 양방 변명 (Western Diagnosis)
      - 계획 (P): 
         1) 치료 주기 및 기간: (예: 주 2-3회, 4주간)
         2) 치료처치종류: 침, 뜸, 부항, 약침, 추나 등 명시
         3) 처방종류: 
            - 증상한약: 보험적용 한약 혹은 크라시에 제약회사 한국출시 제품 중심
            - 기능회복한약: 탕약 처방명 중심
      
      4. 항목 사이에는 한 줄의 빈 줄을 두어 구분하세요.
      5. 화자 구분(의사/환자)을 지능적으로 수행하여 내용을 분류하세요.
    `;

    const userQuery = `
      환자 정보: 성함 ${patientName || '미상'}, 나이 ${patientAge || '미상'}, 성별 ${patientGender || '미상'}
      [음성 기록]: ${transcript}
      [의사 메모]: ${manualMemo}
      위 내용을 바탕으로 기호 없이 키워드 중심의 한방 SOAP 차트를 작성해줘.
    `;

    const fetchWithRetry = async (retries = 5, delay = 1000) => {
      try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: userQuery }] }],
            systemInstruction: { parts: [{ text: systemPrompt }] }
          })
        });

        if (!response.ok) throw new Error('API request failed');
        const data = await response.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text;
      } catch (err) {
        if (retries > 0) {
          await new Promise(res => setTimeout(res, delay));
          return fetchWithRetry(retries - 1, delay * 2);
        }
        throw err;
      }
    };

    try {
      const result = await fetchWithRetry();
      setGeneratedChart(result);
      setTimeout(() => {
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
      }, 100);
    } catch (err) {
      setError("AI 차트 생성 중 오류가 발생했습니다. 다시 시도해주세요.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = () => {
    const info = `[환자 정보]\n성함: ${patientName || '미상'}\n나이: ${patientAge || '미상'}\n성별: ${patientGender || '미상'}\n\n`;
    const textToCopy = info + (generatedChart || "");
    
    const textArea = document.createElement("textarea");
    textArea.value = textToCopy;
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand('copy');
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error('복사 실패', err);
    }
    document.body.removeChild(textArea);
  };

  const handleResetRequest = () => {
    setShowResetConfirm(true);
  };

  const executeReset = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    }
    
    setTranscript("");
    setManualMemo("");
    setGeneratedChart(null);
    setError(null);
    setPatientName("");
    setPatientAge("");
    setPatientGender("");
    setCopySuccess(false);
    setShowResetConfirm(false);
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelReset = () => {
    setShowResetConfirm(false);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans p-4 md:p-6 text-[15px] pb-32">
      <div className="max-w-7xl mx-auto">
        {/* Header - Logo Removed */}
        <header className="flex flex-col md:flex-row items-center justify-between mb-8 gap-4 border-b border-slate-200 pb-6">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-600 p-2.5 rounded-xl text-white shadow-lg shadow-emerald-200">
              <Activity size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-800">해온 MediScribe <span className="text-emerald-600 font-extrabold">Clean</span></h1>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[2px]">Keyword-Based AI Assistant</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto">
            <div className="relative flex-none w-32">
              <input
                type="text"
                placeholder="성함"
                className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all shadow-sm text-sm"
                value={patientName}
                onChange={(e) => setPatientName(e.target.value)}
              />
            </div>
            <div className="relative flex-none w-20">
              <input
                type="text"
                placeholder="나이"
                className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all shadow-sm text-sm"
                value={patientAge}
                onChange={(e) => setPatientAge(e.target.value)}
              />
            </div>
            <select
              className="px-3 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all shadow-sm text-sm min-w-[90px]"
              value={patientGender}
              onChange={(e) => setPatientGender(e.target.value)}
            >
              <option value="">성별</option>
              <option value="남성">남성</option>
              <option value="여성">여성</option>
            </select>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Left: Voice Section */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-[380px]">
            <div className="px-5 py-4 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
              <span className="text-xs font-bold text-slate-500 flex items-center gap-2 uppercase tracking-wide">
                <MessageSquare size={14} className="text-emerald-500" /> 대화 녹음
              </span>
              {isListening && (
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                  </span>
                  <span className="text-[10px] font-bold text-red-500 uppercase">Recording</span>
                </div>
              )}
            </div>
            
            <div className="flex-1 p-6 overflow-y-auto bg-white">
              {transcript ? (
                <p className="text-base leading-relaxed text-slate-700 whitespace-pre-wrap font-medium">
                  {transcript}
                </p>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-300 text-center px-4">
                  <Mic className="mb-3 opacity-10" size={48} />
                  <p className="text-xs">환자와의 대화를 실시간 기록합니다.</p>
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-50/50 border-t border-slate-100">
              <button
                onClick={toggleListening}
                className={`w-full flex items-center justify-center gap-3 py-3 rounded-xl font-bold transition-all shadow-sm ${
                  isListening 
                  ? "bg-red-500 text-white shadow-md active:scale-95" 
                  : "bg-emerald-600 text-white shadow-md hover:bg-emerald-700 active:scale-95"
                }`}
              >
                {isListening ? <MicOff size={18} /> : <Mic size={18} />}
                {isListening ? "기록 중단" : "음성 기록 시작"}
              </button>
            </div>
          </div>

          {/* Right: Manual Memo Section */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-[380px]">
            <div className="px-5 py-4 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
              <span className="text-xs font-bold text-slate-500 flex items-center gap-2 uppercase tracking-wide">
                <Edit3 size={14} className="text-indigo-500" /> 직접 메모
              </span>
            </div>
            
            <textarea
              className="flex-1 p-6 text-base leading-relaxed text-slate-700 outline-none resize-none placeholder:text-slate-200 font-medium bg-white"
              placeholder="맥진, 설진, 변증 키워드 등을 기록하세요..."
              value={manualMemo}
              onChange={(e) => setManualMemo(e.target.value)}
            />

            <div className="p-4 bg-slate-50/50 border-t border-slate-100">
              <button
                onClick={generateMedicalChart}
                disabled={isLoading || isListening || (!transcript && !manualMemo)}
                className="w-full bg-slate-800 hover:bg-slate-900 text-white py-3 rounded-xl font-bold disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-md active:scale-95"
              >
                {isLoading ? <RefreshCw className="animate-spin" size={18} /> : <FileText size={18} />}
                키워드 차트 생성
              </button>
            </div>
          </div>
        </div>

        {/* Result: Generated Chart */}
        { (generatedChart || isLoading || error) && (
          <div className="bg-white rounded-2xl shadow-md border border-emerald-100 overflow-hidden mb-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="px-6 py-4 border-b border-emerald-50 flex justify-between items-center bg-emerald-50/30">
              <div className="flex flex-col">
                <span className="text-sm font-bold text-emerald-800 flex items-center gap-2">
                  <ClipboardCheck size={18} /> 통합 분석 차트 (Keyword-Based)
                </span>
                <span className="text-[10px] text-emerald-600 font-bold ml-6">
                  {patientName || '미상'} / {patientAge || '?'}세 / {patientGender || '미기재'}
                </span>
              </div>
              {generatedChart && (
                <button 
                  onClick={handleCopy}
                  className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-bold transition-all shadow-sm ${
                    copySuccess 
                    ? "bg-green-600 text-white" 
                    : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <Copy size={14} />
                  {copySuccess ? "복사 완료" : "텍스트 복사"}
                </button>
              )}
            </div>

            <div className="p-8">
              {isLoading ? (
                <div className="py-16 flex flex-col items-center justify-center text-emerald-300">
                  <RefreshCw className="animate-spin mb-4" size={40} />
                  <p className="text-sm font-bold tracking-tight text-emerald-800">핵심 단어 위주로 요약하고 있습니다...</p>
                </div>
              ) : error ? (
                <div className="py-6 text-center text-red-500 text-sm font-bold flex flex-col items-center gap-2">
                  <AlertCircle size={24} />
                  {error}
                </div>
              ) : (
                <div className="bg-[#FBFDFB] p-6 rounded-2xl border border-emerald-50/50 whitespace-pre-wrap text-slate-800 leading-loose text-[16px] font-medium font-sans shadow-inner">
                  {generatedChart}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Bottom Reset Area */}
        <div className="mt-16 flex flex-col items-center justify-center gap-4 pb-12">
           {!showResetConfirm ? (
             <button
               onClick={handleResetRequest}
               className="flex items-center gap-3 px-12 py-4 bg-white border-2 border-slate-100 text-slate-400 rounded-2xl font-bold hover:bg-slate-50 hover:border-slate-200 hover:text-emerald-600 transition-all shadow-sm active:scale-95 group"
             >
               <UserPlus size={22} className="group-hover:text-emerald-600 transition-colors" />
               새 환자 진료 시작 (초기화)
             </button>
           ) : (
             <div className="bg-white p-6 rounded-3xl border border-emerald-100 shadow-xl flex flex-col items-center gap-4 animate-in zoom-in-95 duration-200">
               <p className="text-sm font-bold text-slate-700 text-center">작성 중인 내용을 삭제하고 초기화할까요?</p>
               <div className="flex gap-3 w-full">
                 <button 
                   onClick={executeReset}
                   className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-bold text-sm hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-50"
                 >
                   네, 초기화합니다
                 </button>
                 <button 
                   onClick={cancelReset}
                   className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-200 transition-colors"
                 >
                   취소
                 </button>
               </div>
             </div>
           )}
           <p className="text-[10px] text-slate-400 font-medium uppercase tracking-[1px]">© MediScribe Clean - Haeon Clinic Tech</p>
        </div>
      </div>
    </div>
  );
};

export default App;