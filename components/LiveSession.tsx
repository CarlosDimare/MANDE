
import React, { useEffect, useRef, useState } from 'react';
import { GoogleGenAI, Modality } from '@google/genai';
import { createPcmBlob, decodeAudioData } from '../services/audioUtils';
import { ModelId } from '../types';

interface Props {
  onClose: () => void;
  systemInstruction: string;
}

const LiveSession: React.FC<Props> = ({ onClose, systemInstruction }) => {
  const [status, setStatus] = useState<'connecting' | 'connected' | 'error'>('connecting');
  const [isMuted, setIsMuted] = useState(false);
  
  // Audio Contexts
  const inputContextRef = useRef<AudioContext | null>(null);
  const outputContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sessionRef = useRef<any>(null); 
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  useEffect(() => {
    let active = true;

    const startSession = async () => {
      try {
        // Use environment API key exclusively
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        
        inputContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
        outputContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        
        const outputNode = outputContextRef.current.createGain();
        outputNode.connect(outputContextRef.current.destination);

        let stream: MediaStream;
        try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;
        } catch (e: any) {
            setStatus('error');
            return;
        }

        const sessionPromise = ai.live.connect({
          model: ModelId.LIVE,
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
              voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Fenrir' } },
            },
            inputAudioTranscription: {},
            outputAudioTranscription: {},
            systemInstruction: systemInstruction
          },
          callbacks: {
            onopen: () => {
              if (!active) return;
              setStatus('connected');
              
              if (!inputContextRef.current) return;
              const source = inputContextRef.current.createMediaStreamSource(stream);
              const scriptProcessor = inputContextRef.current.createScriptProcessor(4096, 1, 1);
              
              scriptProcessor.onaudioprocess = (e) => {
                if (isMuted) return; 
                const inputData = e.inputBuffer.getChannelData(0);
                const pcmBlob = createPcmBlob(inputData);
                
                sessionPromise.then((session) => {
                  session.sendRealtimeInput({ media: pcmBlob });
                });
              };
              
              source.connect(scriptProcessor);
              scriptProcessor.connect(inputContextRef.current.destination);
            },
            onmessage: async (msg) => {
               if (!active || !outputContextRef.current) return;
               
               const audioBase64 = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
               if (audioBase64) {
                 const ctx = outputContextRef.current;
                 nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
                 
                 const audioBuffer = await decodeAudioData(
                    new Uint8Array(atob(audioBase64).split('').map(c => c.charCodeAt(0))),
                    ctx,
                    24000
                 );
                 
                 const source = ctx.createBufferSource();
                 source.buffer = audioBuffer;
                 source.connect(outputNode);
                 source.addEventListener('ended', () => {
                   sourcesRef.current.delete(source);
                 });
                 
                 source.start(nextStartTimeRef.current);
                 nextStartTimeRef.current += audioBuffer.duration;
                 sourcesRef.current.add(source);
               }

               if (msg.serverContent?.interrupted) {
                 sourcesRef.current.forEach(s => s.stop());
                 sourcesRef.current.clear();
                 nextStartTimeRef.current = 0;
               }
            },
            onclose: () => {},
            onerror: (err) => {
              setStatus('error');
            }
          }
        });
        
        sessionRef.current = sessionPromise;

      } catch (e: any) {
        setStatus('error');
      }
    };

    startSession();

    return () => {
      active = false;
      streamRef.current?.getTracks().forEach(t => t.stop());
      inputContextRef.current?.close();
      outputContextRef.current?.close();
      sessionRef.current?.then((s: any) => s.close && s.close());
    };
  }, [systemInstruction]); 

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#D92B2B]/95 backdrop-blur-md p-4">
      <div className="relative bg-[#F2EFE9] w-full max-w-[320px] aspect-[3/4] border-4 border-black shadow-[15px_15px_0px_0px_#121212] flex flex-col items-center justify-between p-8">
        <div className={`absolute top-4 right-4 w-3 h-3 rounded-full border border-black ${
            status === 'connected' ? 'bg-green-500 animate-pulse' : 
            status === 'error' ? 'bg-red-600' : 'bg-yellow-400'
        }`}></div>

        <div className="flex-1 w-full flex items-center justify-center">
             <div className="flex items-end justify-center gap-2 h-24">
                {[1, 2, 3, 4, 3, 2, 1].map((h, i) => (
                    <div 
                        key={i} 
                        className="w-4 bg-black transition-all duration-75" 
                        style={{ 
                            height: status === 'connected' ? `${Math.max(10, Math.random() * 100)}%` : '10%' 
                        }}
                    ></div>
                ))}
             </div>
        </div>

        <div className="w-full flex justify-between items-center gap-6">
           <button 
             onClick={() => setIsMuted(!isMuted)}
             className={`w-16 h-16 rounded-full border-4 border-black flex items-center justify-center transition-all shadow-hard-sm active:translate-x-1 active:translate-y-1 active:shadow-none ${isMuted ? 'bg-[#D92B2B] text-white' : 'bg-white text-black'}`}
           >
             {isMuted ? (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-8 h-8">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 9.75L19.5 12m0 0l2.25 2.25M19.5 12l2.25-2.25M19.5 12l-2.25 2.25m-10.5-6l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
                </svg>
             ) : (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-8 h-8">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
                </svg>
             )}
           </button>

           <button 
             onClick={onClose}
             className="w-20 h-20 rounded-full bg-black border-4 border-black text-white flex items-center justify-center hover:bg-[#D92B2B] transition-colors shadow-hard-sm active:translate-x-1 active:translate-y-1 active:shadow-none"
           >
             <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-10 h-10">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
             </svg>
           </button>
        </div>
      </div>
    </div>
  );
};

export default LiveSession;
