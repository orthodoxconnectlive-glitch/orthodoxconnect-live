// Replace handleToggleLike in FeedView.tsx:
const handleToggleLike = async (postId: string) => {
  const myLikerId = profile?.id || 'me';
  const myLikerName = profile?.full_name || (language === 'ar' ? 'أنت' : 'You');
  const myLikerAvatar =
    profile?.avatar_url ||
    'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=200';

  let nextIsLiked = false;
  let updatedLikersList: any[] = [];

  setPosts((prev) =>
    prev.map((p) => {
      if (p.id === postId) {
        nextIsLiked = !p.isLiked;
        const currentCount = typeof p.likesCount === 'number' ? p.likesCount : (p.likes_count || 0);
        const nextCount = nextIsLiked ? currentCount + 1 : Math.max(0, currentCount - 1);

        let updatedLikers = p.likers ? [...p.likers] : [];
        if (nextIsLiked) {
          updatedLikers = [
            { userId: myLikerId, userName: myLikerName, userAvatar: myLikerAvatar },
            ...updatedLikers.filter(
              (l) => l.userId !== myLikerId && l.userId !== 'me' && l.userId !== profile?.id
            ),
          ];
        } else {
          updatedLikers = updatedLikers.filter(
            (l) => l.userId !== myLikerId && l.userId !== 'me' && l.userId !== profile?.id
          );
        }

        updatedLikersList = updatedLikers;

        return {
          ...p,
          isLiked: nextIsLiked,
          likesCount: nextCount,
          likes_count: nextCount,
          likers: updatedLikers,
        };
      }
      return p;
    })
  );

  // 1. Save like status in localStorage
  const currentLocalLikes = loadLocalLikesMap();
  saveLocalLikesMap({
    ...currentLocalLikes,
    [postId]: nextIsLiked,
  });

  // 2. Save likers array in localStorage (if helper imported)
  try {
    const rawLikers = localStorage.getItem('orthodox_local_likers_v5');
    const map = rawLikers ? JSON.parse(rawLikers) : {};
    map[postId] = updatedLikersList;
    localStorage.setItem('orthodox_local_likers_v5', JSON.stringify(map));
  } catch (e) {}

  // 3. Sync to API
  try {
    await togglePostLike(postId, profile);
  } catch (err) {
    console.warn('Error syncing like:', err);
  }
};
