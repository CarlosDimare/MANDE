import React, { useState, useEffect } from 'react';
import { fetchScrapedNews, ScrapedNewsItem, NEWS_SOURCES } from '../services/newsScraper';

interface Props {
  onClose: () => void;
  onSelectNews: (news: any) => void;
}

const NewsSelector: React.FC<Props> = ({ onClose, onSelectNews }) => {
  const [selectedSource, setSelectedSource] = useState(NEWS_SOURCES[0].name);
  const [loading, setLoading] = useState(false);
  const [feed, setFeed] = useState<ScrapedNewsItem[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  
  // Estado para el modal de lectura
  const [viewingItem, setViewingItem] = useState<ScrapedNewsItem | null>(null);

  // Carga inicial automática
  useEffect(() => {
    handleUpdateFeed(selectedSource);
  }, []); 

  const handleUpdateFeed = async (sourceName: string) => {
    setSelectedSource(sourceName);
    setLoading(true);
    setErrorMsg(null);
    setFeed([]); 
    
    try {
        const results = await fetchScrapedNews(sourceName);
        if (results.length === 0) {
            setErrorMsg("SIN NOVEDADES EN EL FRENTE.");
        } else {
            setFeed(results);
        }
    } catch (e) {
        setErrorMsg("ERROR DE CONEXIÓN.");
    } finally {
        setLoading(false);
    }
  };

  const handleSelect = (item: ScrapedNewsItem) => {
    onSelectNews({
        title: item.title,
        snippet: item.snippet,
        url: item.url,
        source: item.source,
        date: item.date
    });
    // Si estamos en el modal, cerrarlo también
    setViewingItem(null);
    onClose();
  };

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-[#F2EFE9] w-full max-w-7xl h-[90vh] border-4 border-black shadow-[15px_15px_0px_0px_#D92B2B] flex flex-col relative overflow-hidden">
        
        {/* HEADER */}
        <div className="bg-black text-white p-3 border-b-4 border-black shrink-0 z-20 flex justify-between items-center h-16">
          <div className="flex items-center gap-4">
            <button 
                onClick={toggleSidebar} 
                className="text-white hover:text-[#D92B2B] transition-colors p-1"
                title="Mostrar/Ocultar Fuentes"
            >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-8 h-8">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                </svg>
            </button>
            <h2 className="font-head text-2xl font-bold uppercase tracking-widest text-[#D92B2B] select-none">
              NOTICIAS
            </h2>
          </div>

          <div className="flex items-center gap-4">
             {loading && <span className="text-xs font-mono animate-pulse text-[#D92B2B]">ACTUALIZANDO...</span>}
             <button onClick={onClose} className="hover:text-[#D92B2B]">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-8 h-8">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>
          </div>
        </div>

        {/* CONTENIDO PRINCIPAL (SPLIT VIEW) */}
        <div className="flex flex-1 overflow-hidden relative">
            
            {/* PANEL IZQUIERDO: MEDIOS */}
            <div className={`${isSidebarOpen ? 'w-64 md:w-72 border-r-4 border-black' : 'w-0 border-0'} bg-[#E5E5E5] transition-all duration-300 flex flex-col overflow-hidden relative z-10`}>
                <div className="p-3 bg-black text-white text-xs font-bold uppercase tracking-wider sticky top-0">
                    FUENTES DE INFORMACIÓN
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {NEWS_SOURCES.map((s) => (
                        <button
                            key={s.name}
                            onClick={() => handleUpdateFeed(s.name)}
                            className={`w-full text-left px-4 py-3 border-b border-gray-300 font-bold uppercase text-sm hover:bg-[#D92B2B] hover:text-white transition-all flex justify-between items-center group ${selectedSource === s.name ? 'bg-black text-white' : 'text-black'}`}
                        >
                            <span>{s.name}</span>
                            <span className={`text-[10px] px-1 py-0.5 border ${selectedSource === s.name ? 'border-white text-white' : 'border-black text-black group-hover:border-white group-hover:text-white'}`}>
                                {s.country}
                            </span>
                        </button>
                    ))}
                </div>
            </div>

            {/* PANEL CENTRAL: LISTA DE NOTICIAS */}
            <div className="flex-1 overflow-y-auto custom-scrollbar bg-white relative">
                 <div className="absolute inset-0 bg-pattern-dots pointer-events-none opacity-20"></div>
                 
                 {/* Estado: Error */}
                 {errorMsg && !loading && (
                    <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                        <div className="bg-black text-white p-4 transform -skew-x-3">
                            <h3 className="text-xl font-bold text-[#D92B2B]">ERROR</h3>
                            <p className="font-mono text-sm mt-2">{errorMsg}</p>
                        </div>
                        <button 
                            onClick={() => handleUpdateFeed(selectedSource)}
                            className="mt-4 underline font-bold hover:text-[#D92B2B]"
                        >
                            REINTENTAR
                        </button>
                    </div>
                 )}

                 {/* Lista de Noticias */}
                 {!errorMsg && (
                    <div className="flex flex-col">
                        {feed.map((item, idx) => (
                            <div 
                                key={idx} 
                                className={`
                                    relative p-4 border-b-2 border-gray-200 hover:bg-[#F2EFE9] transition-colors group
                                    ${loading ? 'opacity-50' : 'opacity-100'}
                                `}
                            >
                                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="bg-[#D92B2B] text-white text-[10px] font-bold px-1 py-0.5 uppercase">
                                                {item.source}
                                            </span>
                                            <span className="text-xs text-gray-500 font-bold uppercase">
                                                {item.date.split(' ').slice(0, 1).join(' ')} 
                                            </span>
                                        </div>
                                        <h3 
                                            onClick={() => setViewingItem(item)}
                                            className="font-sans text-xl font-bold leading-tight cursor-pointer hover:text-[#D92B2B] mb-2"
                                            title="Leer noticia original"
                                        >
                                            {item.title}
                                        </h3>
                                        <p className="text-sm text-gray-600 font-serif leading-snug line-clamp-2 max-w-4xl">
                                            {item.snippet}
                                        </p>
                                    </div>

                                    <div className="shrink-0 flex items-center">
                                        <button 
                                            onClick={() => handleSelect(item)}
                                            className="bg-black text-white px-4 py-2 font-bold text-xs uppercase border-2 border-transparent hover:bg-white hover:text-black hover:border-black transition-all shadow-hard-sm active:translate-x-1 active:translate-y-1 active:shadow-none whitespace-nowrap"
                                        >
                                            MANDE →
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                        
                        {/* Empty State / Loading Placeholders */}
                        {loading && feed.length === 0 && (
                            <div className="p-12 flex flex-col items-center justify-center gap-4 opacity-50">
                                <div className="w-12 h-12 border-4 border-black border-t-[#D92B2B] rounded-full animate-spin"></div>
                                <p className="font-bold font-head text-xl">RECUPERANDO CABLES...</p>
                            </div>
                        )}
                    </div>
                 )}
            </div>
        </div>

        {/* Footer Informativo */}
        <div className="bg-black text-white p-2 text-[10px] font-mono flex justify-between px-4 z-20">
            <span>ESTADO: {loading ? 'RECIBIENDO DATOS...' : 'EN ESPERA'}</span>
            <span>{feed.length} ELEMENTOS RECUPERADOS</span>
        </div>

      </div>

      {/* MODAL DE LECTURA */}
      {viewingItem && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4" onClick={() => setViewingItem(null)}>
            <div 
                className="bg-[#F2EFE9] w-full max-w-3xl max-h-[85vh] flex flex-col border-4 border-black shadow-[10px_10px_0px_0px_#D92B2B] animate-in fade-in zoom-in-95 duration-200" 
                onClick={e => e.stopPropagation()}
            >
                <div className="bg-black text-white p-4 flex justify-between items-center shrink-0 border-b-4 border-black">
                    <span className="font-head uppercase text-xl tracking-widest text-[#D92B2B]">LECTURA DE CABLE</span>
                    <button onClick={() => setViewingItem(null)} className="text-white hover:text-[#D92B2B] transition-colors">
                       <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-8 h-8">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                       </svg>
                    </button>
                </div>
                
                <div className="p-8 overflow-y-auto custom-scrollbar bg-white">
                    <div className="mb-6 border-b-2 border-gray-200 pb-4">
                        <div className="flex flex-wrap items-center gap-3 mb-2">
                            <span className="bg-[#D92B2B] text-white text-sm font-bold px-3 py-1 uppercase transform -skew-x-6">{viewingItem.source}</span>
                            <span className="text-sm font-bold text-gray-500 font-mono uppercase">{viewingItem.date}</span>
                        </div>
                        <h2 className="font-sans text-2xl md:text-3xl font-bold leading-tight uppercase text-black">
                            {viewingItem.title}
                        </h2>
                    </div>
                    
                    {/* Contenido HTML sanitizado o texto plano */}
                    <div 
                        className="prose prose-sm md:prose-base max-w-none font-serif text-black [&_img]:max-w-full [&_img]:border-2 [&_img]:border-black [&_p]:mb-4 [&_a]:text-blue-700 [&_a]:underline [&_a]:font-bold" 
                        dangerouslySetInnerHTML={{ __html: viewingItem.content || viewingItem.snippet }}
                    ></div>
                </div>
                
                <div className="p-4 border-t-4 border-black bg-[#E5E5E5] flex justify-between items-center shrink-0">
                    <a 
                        href={viewingItem.url} 
                        target="_blank" 
                        rel="noreferrer" 
                        className="text-black font-bold uppercase text-xs hover:text-[#D92B2B] hover:underline flex items-center gap-1"
                    >
                        ABRIR FUENTE ORIGINAL
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                        </svg>
                    </a>
                    
                    <button 
                        onClick={() => handleSelect(viewingItem)} 
                        className="bg-black text-white px-8 py-3 font-bold uppercase text-sm border-2 border-transparent hover:bg-[#D92B2B] hover:border-black shadow-hard-sm transition-all active:translate-x-1 active:translate-y-1 active:shadow-none"
                    >
                        MANDE (ANALIZAR)
                    </button>
                </div>
            </div>
        </div>
      )}

    </div>
  );
};

export default NewsSelector;