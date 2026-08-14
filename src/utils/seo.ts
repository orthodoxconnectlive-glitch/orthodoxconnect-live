/**
 * SEO & Canonical Manager for OrthodoxConnect (orthodoxconnect.live)
 * Ensures search engine crawlers and browsers have accurate canonical tags, titles, and metadata.
 */

export interface SEOConfig {
  title: string;
  description: string;
  canonicalPath: string;
  ogType?: string;
  ogImage?: string;
}

const BASE_URL = 'https://orthodoxconnect.live';

const VIEW_SEO_CONFIGS: Record<string, SEOConfig> = {
  feed: {
    title: 'OrthodoxConnect — Orthodox Christian Fellowship, Community Feed & Prayers',
    description: 'Connect with Orthodox Christian faithful worldwide. Share spiritual reflections, prayers, monastery news, and parish fellowship.',
    canonicalPath: '/',
    ogType: 'website',
    ogImage: 'https://images.unsplash.com/photo-1548625361-1959779df5ff?auto=format&fit=crop&q=80&w=1200',
  },
  videos: {
    title: 'Orthodox Videos & Liturgical Reflections — OrthodoxConnect',
    description: 'Watch inspiring Orthodox video reflections, Byzantine chants, patristic homilies, and monastery highlights.',
    canonicalPath: '/videos',
    ogType: 'video.other',
    ogImage: 'https://images.unsplash.com/photo-1519817650390-64a93db51149?auto=format&fit=crop&q=80&w=1200',
  },
  reels: {
    title: 'Orthodox Videos & Liturgical Reflections — OrthodoxConnect',
    description: 'Watch inspiring Orthodox video reflections, Byzantine chants, patristic homilies, and monastery highlights.',
    canonicalPath: '/videos',
    ogType: 'video.other',
  },
  live: {
    title: 'Live Liturgical Broadcasts & Divine Liturgies — OrthodoxConnect',
    description: 'Stream live Orthodox Divine Liturgies, Vespers, vigil services, and spiritual talks from monasteries and cathedrals.',
    canonicalPath: '/live',
    ogType: 'video.live_stream',
    ogImage: 'https://images.unsplash.com/photo-1548625361-1959779df5ff?auto=format&fit=crop&q=80&w=1200',
  },
  calendar: {
    title: 'Liturgical Calendar & Fasting Guidelines — OrthodoxConnect',
    description: 'Daily Orthodox liturgical calendar, saints of the day, fasting rules, and feast day scripture readings.',
    canonicalPath: '/calendar',
    ogType: 'website',
  },
  myNetwork: {
    title: 'Orthodox Parishes & Community Rooms — OrthodoxConnect',
    description: 'Join Orthodox parish discussion groups, monastery study circles, and regional fellowship networks.',
    canonicalPath: '/myNetwork',
    ogType: 'website',
  },
  messages: {
    title: 'Direct Messages — OrthodoxConnect',
    description: 'Orthodox Christian private messaging and fellowship.',
    canonicalPath: '/messages',
    ogType: 'website',
  },
  profile: {
    title: 'Orthodox Profile & Fellowship — OrthodoxConnect',
    description: 'Orthodox Christian community member profile and spiritual contributions.',
    canonicalPath: '/',
    ogType: 'profile',
  },
};

/**
 * Updates dynamic meta tags, title, and canonical link tag in the document head.
 */
export function updateSEOForView(viewName: string, customConfig?: Partial<SEOConfig>) {
  if (typeof document === 'undefined') return;

  const config: SEOConfig = {
    ...(VIEW_SEO_CONFIGS[viewName] || VIEW_SEO_CONFIGS.feed),
    ...customConfig,
  };

  // 1. Update Document Title
  document.title = config.title;

  // 2. Canonical Link Tag Management
  const canonicalUrl = `${BASE_URL}${config.canonicalPath}`;
  let canonicalEl = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!canonicalEl) {
    canonicalEl = document.createElement('link');
    canonicalEl.setAttribute('rel', 'canonical');
    document.head.appendChild(canonicalEl);
  }
  canonicalEl.setAttribute('href', canonicalUrl);

  // 3. Meta Description
  let metaDesc = document.querySelector<HTMLMetaElement>('meta[name="description"]');
  if (!metaDesc) {
    metaDesc = document.createElement('meta');
    metaDesc.setAttribute('name', 'description');
    document.head.appendChild(metaDesc);
  }
  metaDesc.setAttribute('content', config.description);

  // 4. OpenGraph Tags
  setMetaTag('og:title', config.title, 'property');
  setMetaTag('og:description', config.description, 'property');
  setMetaTag('og:url', canonicalUrl, 'property');
  setMetaTag('og:type', config.ogType || 'website', 'property');
  if (config.ogImage) {
    setMetaTag('og:image', config.ogImage, 'property');
  }

  // 5. Twitter Card Tags
  setMetaTag('twitter:card', 'summary_large_image', 'name');
  setMetaTag('twitter:title', config.title, 'name');
  setMetaTag('twitter:description', config.description, 'name');
  if (config.ogImage) {
    setMetaTag('twitter:image', config.ogImage, 'name');
  }
}

function setMetaTag(name: string, content: string, attr: 'name' | 'property' = 'name') {
  let el = document.querySelector<HTMLMetaElement>(`meta[${attr}="${name}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, name);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}
