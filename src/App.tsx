import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, FileText, Copy, RefreshCw, Activity, MessageSquare, Edit3, ClipboardCheck, UserPlus, AlertCircle, Image as ImageIcon, X, UploadCloud } from 'lucide-react';

// --- API Configuration ---
const apiKey = ""; 
const MODEL_NAME = "gemini-2.5-flash-preview-09-2025";

const App = () => {
  const [patientName, setPatientName] = useState("");
  const [patientAge, setPatientAge] = useState("");
  const [patientGender, setPatientGender] = useState("");
  
  // Voice & Memo
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [manualMemo, setManualMemo] = useState("");
  
  // Images
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);

  // Result
  const [generatedChart, setGeneratedChart] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const shouldKeepListening = useRef(false); 
  const previousTranscriptRef = useRef(""); 

  // Initialize Speech Recognition
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'ko-KR';

      recognitionRef.current.onresult = (event) => {
        let currentSessionTranscript = "";
        for (let i = 0; i < event.results.length; i++) {
          currentSessionTranscript += event.results[i][0].transcript;
        }
        setTranscript(`${previousTranscriptRef.current} ${currentSessionTranscript}`.trim());
      };

      recognitionRef.current.onend = () => {
        if (shouldKeepListening.current) {
          previousTranscriptRef.current = transcript; 
          try {
            recognitionRef.current?.start();
            console.log("Speech recognition restarted automatically.");
          } catch (e) {
            console.error("Restart failed:", e);
            setIsListening(false);
            shouldKeepListening.current = false;
          }
        } else {
          setIsListening(false);
        }
      };

      recognitionRef.current.onerror = (event) => {
        console.error("Speech Recognition Error:", event.error);
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          setIsListening(false);
          shouldKeepListening.current = false;
        }
      };
    } else {
      setError("이 브라우저는 음성 인식을 지원하지 않습니다. 크롬 브라우저를 권장합니다.");
    }
  }, [transcript]); 
  
  const transcriptRef = useRef(transcript);
  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);

  useEffect(() => {
    if (recognitionRef.current) {
      recognitionRef.current.onend = () => {
        if (shouldKeepListening.current) {
          previousTranscriptRef.current = transcriptRef.current; 
          try {
            recognitionRef.current.start();
            console.log("Auto-restarting speech recognition...");
          } catch (e) {
            setIsListening(false);
            shouldKeepListening.current = false;
          }
        } else {
          setIsListening(false);
        }
      };
    }
  }, []);

  // --- Handlers ---

  const toggleListening = () => {
    if (isListening) {
      shouldKeepListening.current = false;
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      shouldKeepListening.current = true;
      previousTranscriptRef.current = transcript; 
      recognitionRef.current?.start();
      setIsListening(true);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (selectedImages.length + files.length > 10) {
      setError("이미지는 최대 10장까지만 업로드 가능합니다.");
      return;
    }
    setError(null);

    const newImages = [...selectedImages, ...files];
    setSelectedImages(newImages);

    // Create previews
    const newPreviews = files.map(file => URL.createObjectURL(file));
    setImagePreviews([...imagePreviews, ...newPreviews]);
  };

  const removeImage = (index: number) => {
    const newImages = selectedImages.filter((_, i) => i !== index);
    const newPreviews = imagePreviews.filter((_, i) => i !== index);
    
    // Revoke URL to avoid memory leaks
    if (imagePreviews[index]) {
      URL.revokeObjectURL(imagePreviews[index]);
    }
    
    setSelectedImages(newImages);
    setImagePreviews(newPreviews);
  };

  const fileToGenerativePart = (file: File) => {
    return new Promise<{ inlineData: { data: string; mimeType: string } }>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = String(reader.result).split(',')[1];
        resolve({
          inlineData: {
            data: base64String,
            mimeType: file.type
          }
        });
      };
      reader.readAsDataURL(file);
    });
  };

  const generateMedicalChart = async () => {
    if (!transcript.trim() && !manualMemo.trim() && selectedImages.length === 0) {
      setError("분석할 데이터(음성, 메모, 또는 이미지)가 없습니다.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // 1. Prepare Image Parts
      const imageParts = await Promise.all(selectedImages.map(fileToGenerativePart));

      // 2. Prepare Prompts
      const systemPrompt = `
        당신은 한의사의 진료를 보조하는 전문 의료 서기입니다. 
        주 역할은 환자 상담 내용(음성/메모)과 **진단검사 결과 이미지**를 통합 분석하여 '한의 임상 통합 차트'를 작성하는 것입니다.
        업로드된 '메디컬 차트 작성 원칙'의 OLDCoExCAFE 기준을 준수하세요.
        
        [이미지 정밀 판독(OCR) 및 분석 지침 - 최우선 순위]
        1. **정확도 엄수**: 업로드된 이미지(문진표, 인바디, 혈액검사, 초음파 등) 내의 **한글 텍스트와 숫자**를 있는 그대로 정확하게 인식하세요.
        2. **신뢰성 검증**: 글자가 흐릿하거나 불확실한 경우 절대 추측하여 적지 말고 **'판독불가'**로 표기하세요. 환각(Hallucination)은 엄격히 금지됩니다.
        3. **용어 인식**: '골격근량', '체지방률', '간수치', '콜레스테롤', '백혈구' 등 한글 의학 용어와 단위를 정확히 식별하세요.
        4. **결과 요약**: 판독 내용은 '진단검사결과 >' 섹션에 검사 종류별로 명확히 구분하여 핵심 소견만 간결하게 기술하세요.

        [작성 규칙]
        1. **특이사항 없음** 혹은 **언급/자료 없음**은 **'-'** 기호로 표기하세요.
        2. **누락 금지**: 언급된 모든 증상은 적절한 항목에 배치해야 하며, 분류가 애매한 내용은 **ROS > 기타** 란에 기재하세요.
        3. **간결성**: 문장이 아닌 개조식(키워드 위주)으로 작성하세요.
        4. **기호 사용 금지**: 결과값에 별표(*) 표시는 절대 사용하지 마세요. 강조가 필요하다면 텍스트로만 표현하세요.

        [출력 포맷]
        아래 포맷을 정확히 준수하세요.

        CC >>
        #1. (주증상 - OLDCoExCAFE 요소 반영)
        #2.

        ROS >
        - 頭面(안이비이): 
        - 食慾: 
        - 消化: 
        - 小便: 
        - 大便: 
        - 睡眠: 
        - 精神: 
        - 汗: 
        - 순환(부종/저림/위약): 
        - 여성(생리/대하): 
        - 기타: (위 항목에 포함되지 않은 모든 증상)

        P/E (신체진찰) >

        진단검사결과 (이미지 정밀 판독) >
        (업로드된 이미지가 있을 경우 아래와 같이 항목별 구분, 없으면 '-')
        - [검사명]: 주요 소견 및 수치 (단위 포함 정확히 기재)
        - [검사명]: 주요 소견 및 수치

        脈, 변증 >

        P/H (과거력) > 
        - 기저질환:
        - 수술/입원력:
        - 약물력(현재 복용약): 
        
        F/H (가족력) > 
        
        S/H (사회력) > 
        - 술/담배/기호식품:
        - 직업/환경/운동:
        - 외상력:

        추정 KCD 진단명 >
        
        한의 변증 >
        
        치료 계획 (Plan) >
        - 치료 내용:
        - 권장 내원 빈도:
        - 예상 치료 기간:
        
        환자 교육 (Education) >
        - 진단 설명:
        - 생활습관 주의점:

        감별진단/추가 검사 추천 >

        [임상 스토리라인]
        (OLDCoExCAFE, 병력, 검사 결과를 종합하여 제3자가 읽어도 환자의 상태를 완벽히 파악할 수 있는 전문적인 의학 내러티브로 요약 작성)
      `;

      const userQueryText = `
        환자 정보: 성함 ${patientName || '미상'}, 나이 ${patientAge || '미상'}, 성별 ${patientGender || '미상'}
        [음성 기록 (대화형)]: ${transcript}
        [의사 메모]: ${manualMemo}
        [첨부된 이미지 수]: ${selectedImages.length}장
        
        위 내용을 바탕으로 한의 통합 차트 형식으로 변환해줘. 특이사항 없는 항목은 '-'로 표기할 것.
        
        [이미지 분석 요청]
        첨부된 진단검사 이미지의 한글과 수치를 매우 엄격하게 판독해주세요. 
        잘못된 정보를 생성하지 말고, 이미지에 보이는 그대로만 '진단검사결과' 섹션에 요약해주세요.
        중요: 별표(*) 기호는 결과에 절대 포함하지 마세요.
      `;

      const requestPayload = {
        contents: [
          {
            parts: [
              { text: userQueryText },
              ...imageParts // Append image data here
            ]
          }
        ],
        systemInstruction: { parts: [{ text: systemPrompt }] }
      };

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestPayload)
      });

      if (!response.ok) throw new Error('API request failed');
      const data = await response.json();
      const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      
      setGeneratedChart(resultText);
      setTimeout(() => {
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
      }, 100);

    } catch (err) {
      console.error(err);
      setError("AI 분석 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
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
      shouldKeepListening.current = false;
      recognitionRef.current?.stop();
      setIsListening(false);
    }
    
    setTranscript("");
    previousTranscriptRef.current = "";
    setManualMemo("");
    
    // Clear images
    selectedImages.forEach((_, i) => {
      if (imagePreviews[i]) {
        URL.revokeObjectURL(imagePreviews[i]);
      }
    });
    setSelectedImages([]);
    setImagePreviews([]);

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
        {/* Header */}
        <header className="flex flex-col md:flex-row items-center justify-between mb-6 gap-4 border-b border-slate-200 pb-6">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-600 p-2.5 rounded-xl text-white shadow-lg shadow-emerald-200">
              <Activity size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-800">해온 MediScribe <span className="text-emerald-600 font-extrabold">Clean</span></h1>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[2px]">TKM Integrated Chart Assistant</p>
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

        {/* 1. Diagnostic Image Upload Section (New) */}
        <section className="mb-6 bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
           <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold text-slate-500 flex items-center gap-2 uppercase tracking-wide">
                <ImageIcon size={14} className="text-blue-500" /> 진단검사 결과 업로드 (최대 10장)
              </span>
              <span className="text-[10px] text-slate-400">
                지원 파일: 문진표, 인바디, 자율신경, CBC, 초음파 등 이미지 (OCR 정밀 분석)
              </span>
           </div>
           
           <div className="flex gap-4 overflow-x-auto pb-2 min-h-[100px] items-center">
              {/* Upload Button */}
              <label className="flex-none w-24 h-24 border-2 border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center text-slate-400 hover:border-emerald-500 hover:text-emerald-500 hover:bg-emerald-50 transition-all cursor-pointer bg-slate-50">
                <UploadCloud size={24} className="mb-1" />
                <span className="text-[10px] font-bold">사진 추가</span>
                <input 
                  type="file" 
                  accept="image/*" 
                  multiple 
                  className="hidden" 
                  onChange={handleImageUpload}
                  disabled={selectedImages.length >= 10}
                />
              </label>

              {/* Previews */}
              {imagePreviews.map((src, index) => (
                <div key={index} className="relative flex-none w-24 h-24 bg-slate-100 rounded-xl border border-slate-200 overflow-hidden group">
                  <img src={src} alt={`preview-${index}`} className="w-full h-full object-cover" />
                  <button 
                    onClick={() => removeImage(index)}
                    className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X size={12} />
                  </button>
                  <div className="absolute bottom-0 w-full bg-black/40 text-white text-[9px] py-0.5 text-center truncate px-1">
                    {selectedImages[index]?.name}
                  </div>
                </div>
              ))}
              
              {selectedImages.length === 0 && (
                <div className="flex-1 flex items-center justify-center text-slate-300 text-xs italic">
                  업로드된 이미지가 없습니다. 진단검사 결과지를 이곳에 추가하세요.
                </div>
              )}
           </div>
        </section>

        {/* 2. Main Input Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Left: Voice Section */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-[380px]">
            <div className="px-5 py-4 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
              <span className="text-xs font-bold text-slate-500 flex items-center gap-2 uppercase tracking-wide">
                <MessageSquare size={14} className="text-emerald-500" /> 문진 녹음 (무제한)
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
                  <p className="text-xs">환자와의 대화가 실시간으로 기록됩니다.<br/>(대화가 끊겨도 자동으로 이어 기록합니다)</p>
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
                {isListening ? "기록 중단" : "음성 기록 시작 (15분+)"}
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
                disabled={isLoading || isListening || (!transcript && !manualMemo && selectedImages.length === 0)}
                className="w-full bg-slate-800 hover:bg-slate-900 text-white py-3 rounded-xl font-bold disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-md active:scale-95"
              >
                {isLoading ? <RefreshCw className="animate-spin" size={18} /> : <FileText size={18} />}
                통합 차트 생성 (음성+메모+이미지)
              </button>
            </div>
          </div>
        </div>

        {/* 3. Result: Generated Chart */}
        { (generatedChart || isLoading || error) && (
          <div className="bg-white rounded-2xl shadow-md border border-emerald-100 overflow-hidden mb-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="px-6 py-4 border-b border-emerald-50 flex justify-between items-center bg-emerald-50/30">
              <div className="flex flex-col">
                <span className="text-sm font-bold text-emerald-800 flex items-center gap-2">
                  <ClipboardCheck size={18} /> 한의 임상 통합 차트
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
                  <p className="text-sm font-bold tracking-tight text-emerald-800">
                    음성, 메모, 그리고 {selectedImages.length}장의 이미지를 정밀 판독 중입니다...
                  </p>
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

        {/* 4. Bottom Reset Area */}
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
           <p className="text-[10px] text-slate-400 font-medium uppercase tracking-[1px]">© MediScribe Clean - Haeon Clinic AI LAB</p>
        </div>
      </div>
    </div>
  );
};

export default App;
