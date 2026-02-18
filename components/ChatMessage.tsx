import React from 'react';
import { Message } from '../types';
import MarkdownRenderer from './MarkdownRenderer';

interface Props {
  message: Message;
  onAnalyze?: () => void;
}

const ChatMessage: React.FC<Props> = ({ message, onAnalyze }) => {
  // Si el mensaje está marcado como oculto (ej: prompt interno de noticias), no renderizar nada.
  if (message.hidden) return null;

  const isUser = message.role === 'user';
  
  return (
    <div className={`w-full py-4 md:py-8 flex group ${isUser ? 'justify-end' : 'justify-start'}`}>
      {/* Max width adjusted for mobile to avoid cropping with diagonal clips. */}
      <div className={`max-w-[95%] md:max-w-[75%] flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
        
        {/* Identity Label */}
        <div className={`flex items-center gap-2 mb-[-2px] z-10 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
           <div className={`px-2 md:px-3 py-1 text-[10px] md:text-xs font-bold uppercase font-head tracking-widest border-2 border-black ${isUser ? 'bg-[#D92B2B] text-white' : 'bg-black text-[#F2EFE9]'}`}>
              {isUser ? 'HUMANO' : 'ESCRIBA'}
           </div>
           <div className="h-[2px] w-8 md:w-12 bg-black"></div>
        </div>

        {/* Message Container - Diagonal Slice */}
        {/* On mobile, reduced padding and relaxed clip paths slightly if needed, but keeping design. Using break-words to ensure text wraps. */}
        <div className={`relative p-4 md:p-8 border-4 border-black transition-all hover:translate-x-1 hover:translate-y-1 w-full ${
           isUser 
             ? 'bg-white shadow-[6px_6px_0px_0px_rgba(217,43,43,1)] md:shadow-[8px_8px_0px_0px_rgba(217,43,43,1)] clip-diagonal-l rounded-none' 
             : 'bg-[#F2EFE9] shadow-[6px_6px_0px_0px_rgba(5,5,5,1)] md:shadow-[8px_8px_0px_0px_rgba(5,5,5,1)] clip-diagonal-r'
        }`}>
          
          {/* Decorative Corner */}
          <div className={`absolute top-0 ${isUser ? 'right-0 border-l-4 border-b-4' : 'left-0 border-r-4 border-b-4'} border-black w-4 h-4 md:w-6 md:h-6 bg-[#D92B2B]`}></div>

          {/* Images */}
          {message.images && message.images.length > 0 && (
            <div className="mb-6 flex flex-wrap gap-4 justify-center">
              {message.images.map((img, i) => (
                <div key={i} className="relative p-2 bg-black transform -rotate-1">
                    <img 
                      src={`data:image/png;base64,${img}`} 
                      alt="Evidencia Visual" 
                      className="max-w-full border-2 border-white grayscale contrast-125"
                    />
                    <div className="absolute top-0 left-0 bg-[#D92B2B] text-white text-[10px] font-bold px-2 py-1">FIG. {i+1}</div>
                </div>
              ))}
            </div>
          )}

          {/* Text Content */}
          <div className="font-medium text-black break-words overflow-hidden">
             <MarkdownRenderer content={message.text || ''} />
             {/* Blinking Cursor for Typewriter Effect */}
             {message.isLoading && !isUser && (
                <span className="inline-block w-2 h-5 bg-[#D92B2B] ml-1 animate-pulse align-middle"></span>
             )}
          </div>

          {/* Botón ANALIZAR para noticias */}
          {onAnalyze && message.text?.includes('[EXPEDIENTE DE PRENSA]') && !message.isLoading && (
            <button 
              onClick={onAnalyze}
              className="mt-4 w-full bg-black text-white font-bold uppercase py-3 px-4 border-2 border-white hover:bg-[#D92B2B] transition-colors"
            >
              📡 ANALIZAR NOTICIA
            </button>
          )}

          {/* MAPS & GROUNDING WIDGET (Tactical Intel Card) */}
          {message.grounding?.maps && message.grounding.maps.length > 0 && (
            <div className="mt-8 border-t-4 border-black pt-6">
                <p className="font-head text-xs font-bold text-[#D92B2B] uppercase tracking-[0.2em] mb-4">
                  // COORDENADAS ESTRATÉGICAS DETECTADAS
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {message.grounding.maps.map((mapItem, i) => (
                    <div key={i} className="relative bg-black p-1 transform hover:-translate-y-1 transition-transform">
                      {/* Fake Map Visual */}
                      <div className="h-32 bg-[#2a2a2a] relative overflow-hidden border border-white/20 group-hover:border-[#D92B2B]">
                         <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-gray-500 via-black to-black"></div>
                         {/* Grid lines */}
                         <div className="absolute inset-0" style={{backgroundImage: 'linear-gradient(#333 1px, transparent 1px), linear-gradient(90deg, #333 1px, transparent 1px)', backgroundSize: '20px 20px'}}></div>
                         {/* Target Marker */}
                         <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 border-2 border-[#D92B2B] rounded-full flex items-center justify-center animate-pulse">
                            <div className="w-1 h-1 bg-[#D92B2B]"></div>
                         </div>
                         <div className="absolute bottom-2 left-2 text-[8px] text-[#D92B2B] font-mono">LAT: --.-- / LON: --.--</div>
                      </div>
                      
                      {/* Details */}
                      <div className="bg-white p-3 flex flex-col gap-2">
                        <span className="font-head font-bold uppercase text-lg leading-none truncate">{mapItem.title}</span>
                        <a 
                          href={mapItem.uri} 
                          target="_blank" 
                          rel="noreferrer" 
                          className="text-xs font-bold bg-[#D92B2B] text-white text-center py-2 uppercase hover:bg-black transition-colors"
                        >
                          INSPECCIONAR SECTOR →
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
            </div>
          )}

          {/* Search Sources */}
          {message.grounding?.search && message.grounding.search.length > 0 && (
             <div className="mt-6 flex flex-wrap gap-2">
                {message.grounding.search.map((src, i) => (
                  <a key={i} href={src.uri} target="_blank" rel="noreferrer" className="flex items-center gap-2 bg-[#F2EFE9] border-2 border-black px-3 py-1 hover:bg-black hover:text-white transition-colors group/link">
                    <span className="w-2 h-2 bg-[#D92B2B] group-hover/link:bg-white"></span>
                    <span className="text-[10px] font-bold uppercase tracking-wider">{src.title.substring(0, 20)}...</span>
                  </a>
                ))}
             </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatMessage;