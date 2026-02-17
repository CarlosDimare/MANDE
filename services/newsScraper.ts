// SERVICIO DE EXTRACCIÓN DE NOTICIAS (SINDICADO)
// "La verdad viaja mejor por RSS que por algoritmos corporativos."

const CACHE_PREFIX = 'burocrat_news_cache_rss_';
const CACHE_DURATION = 15 * 60 * 1000; // 15 minutos para RSS

export interface ScrapedNewsItem {
  title: string;
  url: string;
  source: string;
  date: string;
  snippet: string;
  content: string;
}

// Fuentes extraídas del manifiesto FUENTES (2).html + Nuevas solicitadas
// NOTA: Para LPO y DataClave usamos Google News RSS filtrado por sitio para garantizar estabilidad.
export const NEWS_SOURCES = [
  // --- MEDIOS HEGEMÓNICOS Y CORPORATIVOS (ARG) ---
  { name: 'Clarín', country: 'AR', url: 'https://www.clarin.com/rss/lo-ultimo/' },
  { name: 'La Nación', country: 'AR', url: 'https://www.lanacion.com.ar/arc/outboundfeeds/rss/?outputType=xml' },
  { name: 'La Política Online', country: 'AR', url: 'https://news.google.com/rss/search?q=site:lapoliticaonline.com&hl=es-419&gl=AR&ceid=AR:es-419' },
  { name: 'DataClave', country: 'AR', url: 'https://news.google.com/rss/search?q=site:dataclave.com.ar&hl=es-419&gl=AR&ceid=AR:es-419' },

  // --- PRENSA ALTERNATIVA / REGIONAL ---
  { name: 'La Izquierda Diario', country: 'AR', url: 'https://www.laizquierdadiario.com/spip.php?page=backend' },
  { name: 'Tiempo Argentino', country: 'AR', url: 'https://www.tiempoar.com.ar/articulos/feed' },
  { name: 'Folha de S.Paulo', country: 'BR', url: 'https://feeds.folha.uol.com.br/mundo/rss091.xml' },

  // --- EUROPA ---
  { name: 'Il Manifesto', country: 'IT', url: 'https://ilmanifesto.it/feed/' },
  { name: 'Il Fatto Quotidiano', country: 'IT', url: 'https://www.ilfattoquotidiano.it/feed/' },
  { name: 'Corriere della Sera', country: 'IT', url: 'https://xml2.corriereobjects.it/feed-hp/homepage.xml' },
  { name: 'Der Spiegel', country: 'DE', url: 'https://www.spiegel.de/international/index.rss' },
  { name: 'El País', country: 'ES', url: 'https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/portada' },
  { name: 'Le Monde Diplomatique', country: 'FR', url: 'https://mondiplo.com/spip.php?page=backend' },
  { name: 'The Guardian', country: 'UK', url: 'https://www.theguardian.com/world/rss' },

  // --- AMÉRICA DEL NORTE ---
  { name: 'Democracy Now!', country: 'US', url: 'https://www.democracynow.org/democracynow.rss' },
  { name: 'New York Times', country: 'US', url: 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml' },
  { name: 'ProPublica', country: 'US', url: 'https://feeds.propublica.org/propublica/main' }
];

/**
 * Función principal de obtención de noticias vía RSS
 */
export const fetchScrapedNews = async (sourceName: string): Promise<ScrapedNewsItem[]> => {
  const source = NEWS_SOURCES.find(s => s.name === sourceName);
  
  // Si no encontramos la fuente, intentamos buscar por nombre aproximado o devolvemos error
  if (!source) {
      console.error(`[RSS] Fuente no registrada: ${sourceName}`);
      return [];
  }

  const cacheKey = `${CACHE_PREFIX}${sourceName}`;

  // 1. Verificar Cache Local
  const cached = localStorage.getItem(cacheKey);
  if (cached) {
    try {
      const parsedCache = JSON.parse(cached);
      const now = Date.now();
      if (now - parsedCache.timestamp < CACHE_DURATION) {
        console.log(`[Burocracia] Sirviendo RSS desde archivo: ${sourceName}`);
        return parsedCache.data;
      }
    } catch (e) {
      localStorage.removeItem(cacheKey);
    }
  }

  // 2. Construir URL para rss2json
  // Usamos api.rss2json.com para convertir XML a JSON y evitar CORS
  const apiUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(source.url)}`;

  console.log(`[Burocracia] Sintonizando frecuencia: ${source.name}`);

  try {
    const response = await fetch(apiUrl);
    const data = await response.json();

    if (data.status !== 'ok') {
        throw new Error(`Error del servicio RSS: ${data.message}`);
    }

    const items = data.items || [];

    // 3. Mapear respuesta
    const newsItems: ScrapedNewsItem[] = items.map((item: any) => {
        // Limpiar HTML sucio de la descripción para el snippet
        const rawDesc = item.description || item.content || '';
        const cleanDesc = rawDesc.replace(/<[^>]+>/g, '').trim();
        const snippet = cleanDesc.length > 200 ? cleanDesc.substring(0, 197) + '...' : cleanDesc;

        // Intentar obtener contenido más completo si existe
        const content = item.content || item.description || '';

        return {
            title: item.title,
            url: item.link,
            source: sourceName,
            date: item.pubDate,
            snippet: snippet || 'Sin resumen disponible.',
            content: content // Guardamos el contenido completo/HTML para el modal
        };
    });

    // 4. Guardar en Cache
    if (newsItems.length > 0) {
      localStorage.setItem(cacheKey, JSON.stringify({
        timestamp: Date.now(),
        data: newsItems
      }));
    }

    return newsItems;

  } catch (error) {
    console.error("Error obteniendo cables RSS:", error);
    return [];
  }
};