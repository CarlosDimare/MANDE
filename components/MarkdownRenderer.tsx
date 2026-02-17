import React from 'react';

interface Props {
  content: string;
}

// Updated Parser for **bold**, *italic*, and `code`
const parseInlineStyles = (text: string) => {
  if (!text) return null;
  
  // Regex Breakdown:
  // (\*\*.*?\*\*)  -> Matches **bold** non-greedy
  // (`[^`]+`)      -> Matches `code`
  // (\*[^*]+?\*)   -> Matches *italic* non-greedy
  const parts = text.split(/(\*\*.*?\*\*|`[^`]+`|\*[^*]+?\*)/g);

  return parts.map((part, i) => {
    // 1. BOLD (**...**) -> Red Constructivist Block
    if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
      return (
        <span key={i} className="bg-[#D92B2B] text-white px-1 font-bold uppercase mx-0.5 box-decoration-clone inline-block transform -skew-x-6 shadow-[2px_2px_0px_0px_black] text-sm md:text-base">
          <span className="transform skew-x-6 inline-block tracking-wide">{part.slice(2, -2)}</span>
        </span>
      );
    }
    
    // 2. INLINE CODE (`...`) -> Black Monospace Tag
    if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
      return (
        <span key={i} className="bg-black text-[#F2EFE9] font-mono px-1.5 py-0.5 mx-0.5 text-sm border-2 border-transparent">
          {part.slice(1, -1)}
        </span>
      );
    }

    // 3. ITALIC (*...*) -> Thick Red Underline + Bold
    if (part.startsWith('*') && part.endsWith('*') && part.length >= 2) {
      return (
        <span key={i} className="font-bold text-black border-b-[3px] border-[#D92B2B] inline-block leading-tight">
          {part.slice(1, -1)}
        </span>
      );
    }

    return part;
  });
};

const ConstructivistTable = ({ lines }: { lines: string[] }) => {
    // Vertical Card Layout for Tables
    const validLines = lines.filter(l => l.trim().length > 0);
    if (validLines.length < 2) return null;

    const headers = validLines[0].split('|').filter(c => c.trim() !== '').map(c => c.trim());
    const bodyRows = validLines.slice(2).map(row => 
        row.split('|').filter(c => c.trim() !== '').map(c => c.trim())
    );

    return (
        <div className="my-8 w-full space-y-8">
            {bodyRows.map((row, rI) => (
               <div key={rI} className="bg-[#F2EFE9] border-[4px] border-black shadow-[8px_8px_0px_0px_#D92B2B] relative">
                  <table className="w-full border-collapse">
                     <tbody>
                        {headers.map((h, hI) => (
                           <tr key={hI} className="border-b-[2px] border-black last:border-b-0">
                              {/* Header Label Column (Left) */}
                              <th className="w-[120px] md:w-[160px] bg-black text-white p-4 align-middle text-left border-r-[2px] border-black">
                                 <span className="font-head font-bold uppercase tracking-widest text-sm md:text-base leading-none block">
                                    {h}
                                 </span>
                              </th>
                              {/* Content Column (Right) */}
                              <td className="p-4 align-middle bg-white">
                                 {hI === 0 ? (
                                    <span className="inline-block bg-[#D92B2B] text-white px-3 py-1 font-bold uppercase text-base md:text-lg transform -skew-x-6 shadow-sm border border-black">
                                       <span className="inline-block transform skew-x-6">{parseInlineStyles(row[hI] || '')}</span>
                                    </span>
                                 ) : (
                                    // Increased font size by ~20% (text-lg/xl vs base)
                                    <span className="text-black font-medium text-lg md:text-xl leading-relaxed block">
                                       {parseInlineStyles(row[hI] || '')}
                                    </span>
                                 )}
                              </td>
                           </tr>
                        ))}
                     </tbody>
                  </table>
               </div>
            ))}
        </div>
    );
}

const MarkdownRenderer: React.FC<Props> = ({ content }) => {
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  
  let tableBuffer: string[] = [];
  let inCodeBlock = false;

  const flushTable = (key: number) => {
    if (tableBuffer.length === 0) return null;
    const tableLines = [...tableBuffer];
    tableBuffer = [];
    return <ConstructivistTable key={`table-${key}`} lines={tableLines} />;
  };

  lines.forEach((line, index) => {
    // --- Code Block Logic ---
    if (line.trim().startsWith('```')) {
        if (tableBuffer.length > 0) elements.push(flushTable(index));
        inCodeBlock = !inCodeBlock;
        return; 
    }
    if (inCodeBlock) {
        elements.push(
            <div key={index} className="bg-[#121212] text-[#00FF00] font-mono text-xs md:text-sm px-4 py-2 border-l-4 border-[#D92B2B] my-2 shadow-hard-sm overflow-x-auto whitespace-pre-wrap break-all">
                {line}
            </div>
        );
        return;
    }

    // --- Table Logic ---
    if (line.trim().startsWith('|')) {
      tableBuffer.push(line);
      return;
    }
    
    // Flush table if we hit non-table line
    if (tableBuffer.length > 0) {
        elements.push(flushTable(index));
    }

    // --- Standard Line Logic ---
    const trimmed = line.trim();
    if (trimmed === '') {
        elements.push(<div key={index} className="h-4"></div>);
    } else if (trimmed.startsWith('#')) {
         const level = line.match(/^#+/)?.[0].length || 1;
         const text = line.replace(/^#+\s*/, '');
         elements.push(
            <div key={index} className="flex -ml-2 md:-ml-4 mt-6 mb-4 transform -skew-x-3 origin-left max-w-full">
              <div className={`bg-black text-white px-4 py-2 md:px-6 md:py-3 shadow-[4px_4px_0px_0px_#D92B2B] md:shadow-[6px_6px_0px_0px_#D92B2B] border-2 border-transparent`}>
                <h3 className={`font-head font-bold uppercase tracking-[0.15em] break-words ${level === 1 ? 'text-2xl md:text-4xl' : 'text-xl md:text-2xl'}`}>
                  {text}
                </h3>
              </div>
            </div>
         );
    } else if (line.match(/^(\*|-)\s/)) {
         const text = line.replace(/^(\*|-)\s*/, '');
         elements.push(
            <div key={index} className="flex items-start gap-3 pl-1 mb-2">
              <div className="w-3 h-3 mt-1.5 bg-[#D92B2B] border border-black shrink-0" />
              <p className="font-bold text-base md:text-xl leading-snug break-words">{parseInlineStyles(text)}</p>
            </div>
         );
    } else {
         elements.push(<p key={index} className="mb-2 leading-relaxed text-base md:text-xl font-medium break-words">{parseInlineStyles(line)}</p>);
    }
  });
  
  if (tableBuffer.length > 0) elements.push(flushTable(lines.length));

  return <div className="w-full min-w-0">{elements}</div>;
};

export default MarkdownRenderer;