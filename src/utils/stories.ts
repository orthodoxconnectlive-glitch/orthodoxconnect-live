export interface Story {
  id: string;
  authorId?: string;
  authorName: string;
  authorAvatar: string;
  authorParish: string;
  imageUrl: string;
  /** 'image' | 'video' (Bunny guid) | 'audio' (data URL). Defaults to 'image'. */
  mediaType?: 'image' | 'video' | 'audio';
  caption: string;
  createdAt: string;
}

const STORIES_STORAGE_KEY = 'orthodoxconnect_stories_v1';

const INITIAL_STORIES: Story[] = [];

export function loadStories(): Story[] {
  try {
    const raw = localStorage.getItem(STORIES_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed: Story[] = JSON.parse(raw);
    const cleaned = parsed.filter(
      (s) =>
        s.authorName &&
        !s.authorName.includes('Seraphim') &&
        !s.authorName.includes('Eleni') &&
        !s.authorName.includes('Markos') &&
        !s.authorName.includes('Deacon')
    );
    if (cleaned.length !== parsed.length) {
      localStorage.setItem(STORIES_STORAGE_KEY, JSON.stringify(cleaned));
    }
    return cleaned;
  } catch {
    return [];
  }
}

export function saveStory(newStoryPartial: Omit<Story, 'id' | 'createdAt'>): Story {
  const newStory: Story = {
    id: 'story-' + Date.now(),
    ...newStoryPartial,
    createdAt: new Date().toISOString(),
  };

  persistStory(newStory);

  return newStory;
}

/**
 * Persist a fully-built story (used when the id must be known before the
 * server call, so the local copy and the server row share the same id and
 * never appear as duplicates in the bar).
 */
export function persistStory(story: Story): void {
  const existing = loadStories();
  const updated = [story, ...existing.filter((s) => s.id !== story.id)];

  try {
    localStorage.setItem(STORIES_STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn('Failed to save story to localStorage:', err);
  }
}
