  return (
    <div className="w-full min-h-screen bg-[#130e0a] pb-24 px-4 flex flex-col items-center">
      {toastMessage && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-[#1c1611]/95 border-2 border-[#c5a059] text-[#f5ebd9] text-xs font-serif uppercase tracking-wider font-bold shadow-2xl flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-[#c5a059]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Header & Navigation Bar */}
      <div className="w-full max-w-md mt-4 mb-6 flex items-center justify-between bg-[#1c1611] border-2 border-[#c5a059] p-4 rounded-2xl shadow-xl">
        <div className="flex items-center gap-2 font-serif text-[#f5ebd9]">
          <button
            type="button"
            onClick={() => setActiveTab('following')}
            className={`text-xs uppercase font-bold px-3 py-1.5 rounded-xl transition-colors ${
              activeTab === 'following' ? 'bg-[#c5a059] text-[#1c1611]' : 'hover:bg-[#282019]'
            }`}
          >
            Following
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('foryou')}
            className={`text-xs uppercase font-bold px-3 py-1.5 rounded-xl transition-colors ${
              activeTab === 'foryou' ? 'bg-[#c5a059] text-[#1c1611]' : 'hover:bg-[#282019]'
            }`}
          >
            For You
          </button>
        </div>

        <button
          type="button"
          onClick={() => setIsUploadModalOpen(true)}
          className="px-3.5 py-1.5 rounded-xl bg-[#c5a059] hover:bg-[#a8833c] text-[#1c1611] font-serif font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-md transition-colors"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          <span>Upload</span>
        </button>
      </div>

      {/* Natural Scrolling Feed Container */}
      <div ref={feedContainerRef} className="w-full max-w-md flex flex-col gap-6">
        {loading ? (
          <div className="py-20 text-center text-[#c5a059] font-serif uppercase text-xs">
            Loading Videos Feed...
          </div>
        ) : filteredVideos.length === 0 ? (
          <div className="py-20 text-center text-[#a89379] font-serif uppercase text-xs">
            No videos available in this view.
          </div>
        ) : (
          filteredVideos.map((video) => (
            <VideoCard
              key={video.id}
              video={video}
              isPlaying={activePlayingId === video.id}
              onTogglePlay={() =>
                setActivePlayingId(activePlayingId === video.id ? null : video.id)
              }
              onSelectUser={onSelectUser}
              onOpenMessengerWithUser={onOpenMessengerWithUser}
              liked={!!likedMap[video.id]}
              likeCount={likeCounts[video.id] || 0}
              onToggleLike={handleToggleLike}
              saved={!!savedMap[video.id]}
              onToggleSave={handleToggleSave}
              isFollowed={!!followedAuthors[video.authorName]}
              onToggleFollow={handleToggleFollow}
              onDeleteVideo={handleDeleteVideo}
              comments={videoCommentsMap[video.id] || []}
              isCommentOpen={openCommentVideoId === video.id}
              onToggleCommentOpen={(id) =>
                setOpenCommentVideoId(openCommentVideoId === id ? null : id)
              }
              onAddComment={handleAddComment}
              onShare={handleShare}
              onHashtagClick={handleHashtagClick}
            />
          ))
        )}
      </div>
    </div>
  );
