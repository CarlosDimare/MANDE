import React, { useState, useRef, useEffect } from 'react';
import { DEFAULT_CONFIG, INITIAL_MESSAGE } from './constants';
import { AppConfig, AppMode, Message, ChatSession } from './types';
import * as GeminiService from './services/geminiService';
import ChatMessage from './components/ChatMessage';
import LiveSession from './components/LiveSession';
import NewsSelector from './components/NewsSelector';
import { GenerateContentResponse } from '@google/genai';

function App() {
  // State
  const [sessionId, setSessionId] = useState<string>('init');
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE]);
  const [historyList, setHistoryList] = useState<ChatSession[]>([]);
  
  const [input, setInput] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [config, setConfig] = useState<AppConfig>(DEFAULT_CONFIG);
  const [mode, setMode] = useState<AppMode>(AppMode.CHAT);
  const [showLive, setShowLive] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showNewsSelector, setShowNewsSelector] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false); // Default closed on mobile
  const [attachment, setAttachment] = useState<{data: string, mimeType: string} | null>(null);
  const [isLoading, setIsLoading] = useState(false); // Prevent multiple API calls

  const bottomRef = useRef<HTMLDivElement>(null);

  // Load History from LocalStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('burocrat_sessions');
    if (saved) {
      try {
        setHistoryList(JSON.parse(saved));
      } catch (e) {
        console.error("Error loading history", e);
      }
    }
    // Check screen size for initial sidebar state
    if (window.innerWidth >= 768) {
      setSidebarOpen(true);
    }
  }, []);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, statusMessage]);

  // Save Session Helper
  const saveSession = (id: string, msgs: Message[]) => {
    if (id === 'init') return; 
    
    setHistoryList(prev => {
      const existingIdx = prev.findIndex(s => s.id === id);
      const title = msgs.find(m => m.role === 'user' && !m.hidden)?.text?.substring(0, 30).toUpperCase() || 'EXPEDIENTE SIN CARÁTULA';
      
      let newList;
      if (existingIdx >= 0) {
        newList = [...prev];
        newList[existingIdx] = { ...newList[existingIdx], messages: msgs, updatedAt: Date.now(), title };
      } else {
        const newSession: ChatSession = { id, title, messages: msgs, updatedAt: Date.now() };
        newList = [newSession, ...prev];
      }
      
      localStorage.setItem('burocrat_sessions', JSON.stringify(newList));
      return newList;
    });
  };

  const loadSession = (session: ChatSession) => {
    setSessionId(session.id);
    setMessages(session.messages);
    setMode(AppMode.CHAT);
    if (window.innerWidth < 768) setSidebarOpen(false);
  };

  const startNewSession = () => {
    setSessionId('init');
    setMessages([INITIAL_MESSAGE]);
    setMode(AppMode.CHAT);
    if (window.innerWidth < 768) setSidebarOpen(false);
  };

  const deleteSession = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const newList = historyList.filter(s => s.id !== id);
    setHistoryList(newList);
    localStorage.setItem('burocrat_sessions', JSON.stringify(newList));
    if (sessionId === id) startNewSession();
  };

  const handleSend = async (overrideText?: string, isHidden: boolean = false) => {
    // Prevent multiple simultaneous API calls
    if (isLoading) return;
    
    const textToSend = overrideText || input;
    if ((!textToSend.trim() && !attachment) || statusMessage) return;
    
    setIsLoading(true);

    const currentTimestamp = Date.now();
    let currentSessionId = sessionId;
    
    if (currentSessionId === 'init') {
        currentSessionId = currentTimestamp.toString();
        setSessionId(currentSessionId);
    }

    const userMsg: Message = {
      id: currentTimestamp.toString(),
      role: 'user',
      text: textToSend,
      images: attachment ? [attachment.data] : undefined,
      timestamp: currentTimestamp,
      hidden: isHidden // Set hidden property
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    saveSession(currentSessionId, newMessages); 
    
    setInput('');
    setAttachment(null);
    setStatusMessage("PROCESANDO...");

    try {
      // IMAGE GEN MODE
      if (mode === AppMode.IMAGE_GEN) {
        setStatusMessage("CONSTRUYENDO IMAGEN...");
        const res = await GeminiService.generateImage(userMsg.text || 'Image', config);
        const parts = res.candidates?.[0]?.content?.parts || [];
        const imgs: string[] = [];
        let responseText = '';
        parts.forEach((p: any) => {
          if (p.inlineData) imgs.push(p.inlineData.data);
          if (p.text) responseText += p.text;
        });
        
        if (!responseText) responseText = "PRODUCCIÓN VISUAL FINALIZADA.";
        
        const botMsg: Message = { id: Date.now().toString(), role: 'model', text: responseText, images: imgs, timestamp: Date.now() };
        const finalMessages = [...newMessages, botMsg];
        setMessages(finalMessages);
        saveSession(currentSessionId, finalMessages);
        setStatusMessage(null);
        return;
      }

      // IMAGE EDIT MODE
      if (attachment && userMsg.text?.toLowerCase().includes('editar')) {
           setStatusMessage("REVISANDO MATERIAL...");
           const res = await GeminiService.editImage(userMsg.text || '', attachment.data, attachment.mimeType);
           const parts = res.candidates?.[0]?.content?.parts || [];
           const imgs: string[] = [];
           let responseText = '';
           parts.forEach((p: any) => { if (p.inlineData) imgs.push(p.inlineData.data); if (p.text) responseText += p.text; });
           
           const botMsg: Message = { id: Date.now().toString(), role: 'model', text: responseText, images: imgs, timestamp: Date.now() };
           const finalMessages = [...newMessages, botMsg];
           setMessages(finalMessages);
           saveSession(currentSessionId, finalMessages);
           setStatusMessage(null);
           return;
      }

      // CHAT MODE (RAW STREAMING)
      const imagePart = attachment ? { inlineData: { data: attachment.data, mimeType: attachment.mimeType } } : undefined;
      const history = messages.filter(m => m.role !== 'system').map(m => ({
         role: m.role, parts: [{ text: m.text }, ...(m.images ? m.images.map(i => ({ inlineData: { data: i, mimeType: 'image/png' } })) : [])]
      }));

      setStatusMessage("ESCRIBIENDO...");
      
      const botMsgId = (Date.now() + 1).toString();
      const initialBotMsg: Message = { id: botMsgId, role: 'model', text: '', timestamp: Date.now(), isLoading: true };
      setMessages(prev => [...prev, initialBotMsg]);

      // Pass config with updated system instruction
      const stream = await GeminiService.generateTextStream(history, userMsg.text || '', config, imagePart);
      
      let accumulatedText = '';
      let groundingInfo: any = undefined;

      try {
          for await (const chunk of stream) {
              const c = chunk as GenerateContentResponse;
              const newText = c.text || '';
              
              accumulatedText += newText;

              const chunks = c.candidates?.[0]?.groundingMetadata?.groundingChunks;
              if (chunks) {
                 if (!groundingInfo) groundingInfo = {};
                 
                 const searchChunks = chunks.filter((c: any) => c.web);
                 if (searchChunks.length > 0) {
                     const newSearch = searchChunks.map((c: any) => ({ uri: c.web.uri, title: c.web.title }));
                     groundingInfo.search = [...(groundingInfo.search || []), ...newSearch];
                 }
                 
                 const mapsList: any[] = [];
                 chunks.forEach((c: any) => { if ((c as any).maps) mapsList.push({ uri: (c as any).maps.uri, title: (c as any).maps.title || 'Ubicación' }); });
                 if (mapsList.length > 0) {
                     groundingInfo.maps = [...(groundingInfo.maps || []), ...mapsList];
                 }
              }

              setMessages(prev => {
                  const newList = [...prev];
                  const msgIdx = newList.findIndex(m => m.id === botMsgId);
                  if (msgIdx !== -1) {
                      newList[msgIdx] = { ...newList[msgIdx], text: accumulatedText, grounding: groundingInfo, isLoading: true };
                  }
                  return newList;
              });
          }

          setStatusMessage(null);
          setMessages(prev => {
              const newList = [...prev];
              const msgIdx = newList.findIndex(m => m.id === botMsgId);
              if (msgIdx !== -1) {
                  newList[msgIdx] = { ...newList[msgIdx], isLoading: false };
                  saveSession(currentSessionId, newList);
              }
              return newList;
          });

      } catch (error: any) {
         setMessages(prev => {
            const newList = [...prev];
            const idx = newList.findIndex(m => m.id === botMsgId);
            if (idx !== -1) {
                newList[idx] = { ...newList[idx], text: newList[idx].text + `\n[ERROR: ${error.message}]`, isLoading: false };
            }
            return newList;
         });
         setStatusMessage(null);
      }

    } catch (error: any) {
      setMessages(prev => [...prev, { id: Date.now().toString(), role: 'model', text: `ERROR DE BUROCRACIA INTERNA: ${error.message}`, timestamp: Date.now() }]);
      setStatusMessage(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
         const base64 = (reader.result as string).split(',')[1];
         setAttachment({ data: base64, mimeType: file.type });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSelectNews = (news: { title: string, snippet: string, url: string, source: string }) => {
    // Agregar la noticia al chat como mensaje del usuario (CRUDO, sin análisis de Gemini)
    const newsMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: `[EXPEDIENTE DE PRENSA]\n\nFUENTE: ${news.source}\nTITULAR: ${news.title}\nRESUMEN: ${news.snippet}\nENLACE: ${news.url}`,
      timestamp: Date.now()
    };
    setMessages(prev => [...prev, newsMsg]);
    
    // NO se llama a Gemini automáticamente - el usuario debe hacer clic en "Analizar" manualmente
  };

  const handleAnalyzeNews = (msg: Message) => {
    // Analizar la noticia con Gemini cuando el usuario hace clic en el botón
    const prompt = `Analiza y procesa la siguiente noticia:\n\n${msg.text}`;
    handleSend(prompt, false);
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#F2EFE9] text-black">
      
      {/* MOBILE HEADER */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-14 bg-black text-white flex items-center justify-between px-4 z-40 shadow-[0_4px_0_0_#D92B2B]">
          <h1 className="font-head text-xl font-bold tracking-tighter">MAN<span className="text-[#D92B2B]">DE</span></h1>
          <button onClick={() => setSidebarOpen(true)} className="p-2">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-8 h-8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>
      </div>

      {/* SIDEBAR OVERLAY (MOBILE) */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/80 z-40 md:hidden" onClick={() => setSidebarOpen(false)}></div>
      )}

      {/* SIDEBAR - Added md:shrink-0 to prevent layout collapse */}
      <div className={`
        fixed inset-y-0 left-0 z-50 w-[85%] sm:w-[300px] bg-[#121212] text-[#F2EFE9] flex flex-col 
        transform transition-transform duration-300 ease-in-out shadow-[10px_0_0_0_#D92B2B]
        md:relative md:translate-x-0 md:w-[300px] lg:w-[340px] md:shrink-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
          <div className="p-6 flex flex-col h-full relative z-10">
            {/* Header / Logo (Desktop) */}
            <div className="hidden md:block mb-8 transform -skew-x-6 origin-left">
              <h1 className="font-head text-4xl font-bold leading-none tracking-tighter text-white">
                MAN<span className="text-[#D92B2B]">DE</span>
              </h1>
              <div className="w-full h-3 bg-[#D92B2B] mt-1 skew-x-12"></div>
            </div>

            {/* Mobile Sidebar Close */}
            <div className="md:hidden flex justify-between items-center mb-6 border-b border-gray-800 pb-4">
               <span className="font-head text-2xl">MENU</span>
               <button onClick={() => setSidebarOpen(false)} className="text-white">
                 <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-8 h-8">
                   <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                 </svg>
               </button>
            </div>

            {/* NEW EXPEDIENTE ICON ONLY */}
            <button 
               onClick={startNewSession}
               className="group w-16 h-16 md:w-full md:h-12 mb-6 bg-[#F2EFE9] text-black font-bold hover:bg-[#D92B2B] hover:text-white transition-all shrink-0 flex items-center justify-center border-4 border-black shadow-hard-sm"
               title="NUEVO EXPEDIENTE"
            >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-8 h-8">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
            </button>
            
            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 flex flex-col gap-6 min-h-0">
              {/* MODES */}
              <div className="space-y-2 shrink-0">
                 <p className="text-xs font-bold text-[#D92B2B] uppercase tracking-widest border-b-2 border-[#333] pb-1">OPERATIVA</p>
                 <button 
                   onClick={() => { setMode(AppMode.CHAT); if (window.innerWidth < 768) setSidebarOpen(false); }}
                   className={`w-full flex items-center justify-between px-3 py-2 text-base uppercase font-bold transition-all border-l-4 ${mode === AppMode.CHAT ? 'border-[#D92B2B] bg-[#222] text-white' : 'border-transparent text-gray-400 hover:text-white hover:bg-[#1a1a1a]'}`}
                 >
                   <span>TEXTO</span>
                   {mode === AppMode.CHAT && <span className="w-2 h-2 bg-[#D92B2B]"></span>}
                 </button>
                 <button 
                   onClick={() => { setMode(AppMode.IMAGE_GEN); if (window.innerWidth < 768) setSidebarOpen(false); }}
                   className={`w-full flex items-center justify-between px-3 py-2 text-base uppercase font-bold transition-all border-l-4 ${mode === AppMode.IMAGE_GEN ? 'border-[#D92B2B] bg-[#222] text-white' : 'border-transparent text-gray-400 hover:text-white hover:bg-[#1a1a1a]'}`}
                 >
                   <span>PROPAGANDA VISUAL</span>
                   {mode === AppMode.IMAGE_GEN && <span className="w-2 h-2 bg-[#D92B2B]"></span>}
                 </button>
              </div>

              {/* HISTORY LIST */}
              <div className="space-y-2 flex-1 overflow-y-auto">
                 <p className="text-xs font-bold text-[#D92B2B] uppercase tracking-widest border-b-2 border-[#333] pb-1">ARCHIVOS</p>
                 {historyList.length === 0 ? (
                    <p className="text-gray-600 text-sm italic py-2">Sin expedientes previos.</p>
                 ) : (
                    <div className="flex flex-col gap-1">
                      {historyList.map(session => (
                        <div 
                          key={session.id} 
                          onClick={() => loadSession(session)}
                          className={`group relative p-2 cursor-pointer border-l-2 transition-all hover:bg-[#222] ${sessionId === session.id ? 'border-[#D92B2B] bg-[#1a1a1a]' : 'border-transparent'}`}
                        >
                           <div className="flex justify-between items-start">
                              <span className="text-sm font-bold uppercase truncate w-[85%] text-gray-300 group-hover:text-white">
                                {session.title}
                              </span>
                              <button 
                                onClick={(e) => deleteSession(e, session.id)}
                                className="text-gray-600 hover:text-[#D92B2B] font-bold leading-none p-1"
                              >
                                ×
                              </button>
                           </div>
                        </div>
                      ))}
                    </div>
                 )}
              </div>
            </div>
            
            {/* BOTTOM ACTIONS - SETTINGS REMOVED */}
            <div className="mt-4 pt-4 border-t border-[#333] space-y-3 shrink-0">
                <button onClick={() => setShowLive(true)} className="w-full py-3 bg-black border-2 border-[#D92B2B] text-[#D92B2B] font-bold hover:bg-[#D92B2B] hover:text-white transition-all uppercase tracking-widest text-sm relative overflow-hidden group">
                   <span className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></span>
                   <span className="relative z-10 flex items-center justify-center gap-2">
                     <span className="w-2 h-2 bg-red-600 rounded-full animate-ping"></span>
                     HABLE
                   </span>
                </button>
            </div>
          </div>
      </div>

      {/* MAIN AREA - Added min-w-0 to allow flex content to shrink properly */}
      <div className="flex-1 flex flex-col relative bg-[#F2EFE9] w-full min-w-0">
         <div className="absolute inset-0 bg-pattern-dots z-0 pointer-events-none"></div>
         
         {/* Top Diagonal Decoration */}
         <div className="absolute top-0 right-0 w-[500px] h-32 bg-[#D92B2B] transform -skew-y-3 origin-top-right translate-y-[-50%] opacity-10 pointer-events-none"></div>

         {/* MESSAGES */}
         <div className="flex-1 overflow-y-auto custom-scrollbar pt-16 md:pt-12 px-2 md:px-16 relative z-10">
            {messages.map((msg) => (
               <ChatMessage 
                 key={msg.id} 
                 message={msg} 
                 onAnalyze={msg.text?.includes('[EXPEDIENTE DE PRENSA]') ? () => handleAnalyzeNews(msg) : undefined}
               />
             ))}
            {statusMessage && (
               <div className="py-8 flex justify-center">
                 <div className="bg-black text-white px-8 py-3 font-head font-bold uppercase text-lg md:text-xl tracking-widest border-l-8 border-[#D92B2B] animate-pulse skew-x-[-10deg] shadow-hard text-center">
                   {statusMessage}
                 </div>
               </div>
            )}
            <div className="h-48" ref={bottomRef}></div>
         </div>

         {/* INPUT CONSOLE */}
         <div className="relative z-20 w-full p-4 md:p-6 bg-[#F2EFE9] border-t-8 border-black">
            <div className="max-w-4xl mx-auto relative">
               
               {/* Attachment Badge */}
               {attachment && (
                  <div className="absolute -top-14 left-0 bg-[#D92B2B] text-white border-2 border-black px-4 py-1 font-bold uppercase text-xs flex gap-4 items-center shadow-hard-sm transform -rotate-1">
                    <span className="truncate max-w-[200px]">ANEXO VISUAL</span>
                    <button onClick={() => setAttachment(null)} className="hover:text-black text-lg leading-none">×</button>
                  </div>
               )}
               
               {/* Input Container */}
               <div className="flex items-stretch shadow-hard transition-transform bg-white transform -skew-x-2">
                  {/* ATTACHMENT BUTTON */}
                  <label className="cursor-pointer bg-[#E5E5E5] hover:bg-[#ccc] w-12 md:w-16 flex items-center justify-center border-r-2 border-black transition-colors group shrink-0 relative z-10">
                     <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5 md:w-7 md:h-7 text-black group-hover:scale-110 transition-transform">
                        <path strokeLinecap="square" strokeLinejoin="miter" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
                     </svg>
                     <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
                  </label>

                  {/* NEWS BUTTON */}
                  <button 
                     onClick={() => setShowNewsSelector(true)}
                     className="cursor-pointer bg-[#E5E5E5] hover:bg-[#ccc] w-12 md:w-16 flex items-center justify-center border-r-4 border-black transition-colors group shrink-0"
                     title="AGENCIA DE NOTICIAS"
                  >
                     <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5 md:w-7 md:h-7 text-black group-hover:scale-110 transition-transform">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 01-2.25 2.25M16.5 7.5V18a2.25 2.25 0 002.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 002.25 2.25h13.5M6 7.5h3v3H6v-3z" />
                     </svg>
                  </button>
                  
                  <textarea 
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                    placeholder={mode === AppMode.IMAGE_GEN ? "PROPAGANDA..." : "ESCRIBA"}
                    className="flex-1 bg-transparent border-0 focus:ring-0 text-black placeholder-gray-400 py-4 px-4 font-bold resize-none outline-none max-h-32 custom-scrollbar text-lg md:text-xl transform skew-x-2 min-w-0"
                    rows={1}
                  />
                  
                  <button 
                    onClick={() => handleSend()}
                    disabled={isLoading || statusMessage !== null || (!input.trim() && !attachment)}
                    className={`px-6 md:px-10 font-head font-bold text-xl md:text-2xl uppercase tracking-wider transition-all border-l-4 border-black shrink-0 ${isLoading || statusMessage || (!input.trim() && !attachment) ? 'bg-gray-300 text-gray-500' : 'bg-[#D92B2B] text-white hover:bg-black hover:text-[#D92B2B]'}`}
                  >
                    <span className="block transform skew-x-2">
                         <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-6 h-6 md:hidden">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                         </svg>
                         <span className="hidden md:block">MANDE</span>
                    </span>
                  </button>
               </div>
            </div>
         </div>
      </div>

      {/* OVERLAYS */}
      {showLive && <LiveSession onClose={() => setShowLive(false)} systemInstruction={config.systemInstruction} />}
      {showNewsSelector && <NewsSelector onClose={() => setShowNewsSelector(false)} onSelectNews={handleSelectNews} />}
      
      {/* SETTINGS MODAL */}
      {showSettings && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-[#F2EFE9] w-full max-w-2xl border-4 border-black shadow-[15px_15px_0px_0px_#D92B2B] flex flex-col max-h-[90vh]">
                <div className="bg-black text-white p-4 flex justify-between items-center border-b-4 border-black shrink-0">
                    <h2 className="font-head text-2xl font-bold uppercase tracking-wider">PROTOCOLO DE SISTEMA</h2>
                    <button onClick={() => setShowSettings(false)} className="hover:text-[#D92B2B]">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-6 h-6">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
                <div className="p-6 flex-1 overflow-y-auto">
                    <p className="text-sm font-bold uppercase mb-2 text-[#D92B2B]">INSTRUCCIÓN BASE (SYSTEM PROMPT)</p>
                    <textarea 
                        className="w-full h-64 p-4 border-2 border-black bg-white font-mono text-sm leading-relaxed resize-none focus:outline-none focus:border-[#D92B2B]"
                        value={config.systemInstruction}
                        onChange={(e) => setConfig(prev => ({...prev, systemInstruction: e.target.value}))}
                    ></textarea>
                    <p className="mt-4 text-xs text-gray-500 font-bold uppercase">
                        NOTA: Los cambios afectarán a las respuestas futuras. La consistencia ideológica es obligatoria.
                    </p>
                </div>
                <div className="p-4 border-t-4 border-black bg-gray-100 flex justify-end shrink-0">
                    <button 
                        onClick={() => setShowSettings(false)}
                        className="px-8 py-3 bg-black text-white font-bold uppercase hover:bg-[#D92B2B] transition-colors shadow-hard-sm"
                    >
                        CONFIRMAR CAMBIOS
                    </button>
                </div>
            </div>
        </div>
      )}

    </div>
  );
}

export default App;