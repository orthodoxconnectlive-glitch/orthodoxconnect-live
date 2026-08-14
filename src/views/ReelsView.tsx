import { loadPosts, deletePost, savePost } from '../utils/posts'; // Import loadPosts instead of loadReels

// Replace your existing fetchReels function with this:
  const fetchReels = async () => {
    setLoading(true);
    
    // 1. Pull all active posts from your unified Home Feed storage (Supabase + Local Cache)
    const { posts } = await loadPosts();
    
    // 2. Filter for items that actually contain video streams or MP4 video files
    const videoReels = posts.filter((p) => !!p.video || (p.image && p.image.endsWith('.mp4')));

    // 3. Fallback to sample reels only if no video posts exist yet
    const finalReels = videoReels.length > 0 ? videoReels : [
      {
        id: 'fallback-reel-1',
        text: 'Orthodox Spiritual Reflection ☨',
        authorName: 'OrthodoxConnect',
        authorParish: 'Parish Fellowship',
        authorAvatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200',
        video: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
        image: 'https://images.unsplash.com/photo-1548625361-1959779df5ff?auto=format&fit=crop&q=80&w=800',
        createdAt: new Date().toISOString(),
        likesCount: 25,
        commentsCount: 2,
        resharesCount: 0,
      }
    ];

    setReels(finalReels);
    setActiveIndex(0);

    // Load saved likes and comments from localStorage
    let savedLikes: Record<string, boolean> = {};
    let savedComments: Record<string, ReelComment[]> = {};
    try {
      const rawLikes = localStorage.getItem('orthodox_reels_liked_map');
      if (rawLikes) savedLikes = JSON.parse(rawLikes);
      const rawComments = localStorage.getItem('orthodox_reels_comments_map');
      if (rawComments) savedComments = JSON.parse(rawComments);
    } catch (e) {
      console.warn('Reels cache read error:', e);
    }

    setLikedMap(savedLikes);

    const initialLikesCount: Record<string, number> = {};
    const initialComments: Record<string, ReelComment[]> = {};

    finalReels.forEach((reel) => {
      const baseLikes = reel.likesCount || 0;
      initialLikesCount[reel.id] = savedLikes[reel.id] ? baseLikes + 1 : baseLikes;
      initialComments[reel.id] = savedComments[reel.id] || [];
    });

    setLikeCounts(initialLikesCount);
    setReelCommentsMap(initialComments);
    setLoading(false);
  };
