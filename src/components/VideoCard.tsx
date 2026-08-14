  return (
    <div
      ref={containerRef}
      id={`video-card-${video.id}`}
      data-video-id={video.id}
      className="w-full max-w-md mx-auto bg-[#1c1611] rounded-3xl border-2 border-[#c5a059]/50 overflow-hidden shadow-2xl my-4 relative flex flex-col select-none"
    >
      {/* Video Display Container with fixed 9:16 aspect ratio */}
      <div 
        onClick={onTogglePlay}
        className="relative w-full aspect-[9/16] bg-black cursor-pointer flex items-center justify-center overflow-hidden"
      >
        <video
          ref={videoRef}
          data-media-id={elementMediaId}
          src={rawVideoUrl}
          controls={false}
          loop={true}
          preload="metadata"
          muted={isMuted}
          playsInline
          // @ts-ignore
          webkit-playsinline="true"
          className="w-full h-full object-cover bg-black"
        />

        {/* Play State Overlay Button */}
        {!isPlaying && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center pointer-events-none">
            <div className="w-16 h-16 rounded-full bg-[#c5a059] text-[#1c1611] flex items-center justify-center shadow-2xl border-2 border-[#f5ebd9]">
              <Play className="w-8 h-8 fill-current ml-1" />
            </div>
          </div>
        )}

        {/* Top-Right Mute Button */}
        <button
          type="button"
          onClick={handleToggleMute}
          className="absolute top-3 right-3 z-20 p-2.5 rounded-full bg-black/70 backdrop-blur-md border border-[#c5a059]/60 text-[#f5ebd9] hover:bg-[#c5a059] hover:text-[#1c1611] transition-all"
        >
          {isMuted ? <VolumeX className="w-4 h-4 text-amber-300" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
        </button>
      </div>

      {/* Clean Metadata Section Below Video (Instead of Overlapping) */}
      <div className="p-4 bg-[#1c1611] flex flex-col gap-3 border-t border-[#c5a059]/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src={video.authorAvatar}
              alt={video.authorName}
              className="w-10 h-10 rounded-full border border-[#c5a059] object-cover"
            />
            <div>
              <h4 className="font-serif font-bold text-xs text-[#f5ebd9] uppercase tracking-wider">
                {video.authorName}
              </h4>
              <p className="text-[10px] text-[#c5a059] font-serif">
                {video.authorParish || 'Orthodox Parish'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleFollow(video.authorName);
            }}
            className={`px-3 py-1 rounded-full text-xs font-serif font-bold uppercase transition-all ${
              isFollowed ? 'bg-emerald-600 text-white' : 'bg-[#c5a059] text-[#1c1611]'
            }`}
          >
            {isFollowed ? 'Following' : 'Follow'}
          </button>
        </div>

        {/* Caption */}
        <p className="text-xs text-[#f5ebd9] font-serif leading-relaxed">
          {video.text}
        </p>

        {/* Action Bar (Like, Comment, Share, Save) */}
        <div className="flex items-center justify-between pt-2 border-t border-[#c5a059]/20 text-xs text-[#f5ebd9]">
          <button
            type="button"
            onClick={() => onToggleLike(video.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#c5a059]/30 transition-colors ${
              liked ? 'bg-red-600/20 text-red-400 border-red-500' : 'bg-[#282019] hover:bg-[#c5a059]/20'
            }`}
          >
            <Heart className={`w-4 h-4 ${liked ? 'fill-current' : ''}`} />
            <span className="font-serif font-bold">{likeCount}</span>
          </button>

          <button
            type="button"
            onClick={() => onToggleCommentOpen(video.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#282019] border border-[#c5a059]/30 hover:bg-[#c5a059]/20 transition-colors"
          >
            <MessageCircle className="w-4 h-4 text-[#c5a059]" />
            <span className="font-serif font-bold">{comments.length}</span>
          </button>

          <button
            type="button"
            onClick={() => onToggleSave(video.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#c5a059]/30 transition-colors ${
              saved ? 'bg-[#c5a059] text-[#1c1611] font-bold' : 'bg-[#282019] hover:bg-[#c5a059]/20'
            }`}
          >
            <Bookmark className={`w-4 h-4 ${saved ? 'fill-current' : ''}`} />
            <span className="font-serif uppercase text-[10px]">Save</span>
          </button>

          <button
            type="button"
            onClick={() => onShare(video)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#282019] border border-[#c5a059]/30 hover:bg-[#c5a059]/20 transition-colors"
          >
            <Share2 className="w-4 h-4 text-[#c5a059]" />
            <span className="font-serif uppercase text-[10px]">Share</span>
          </button>
        </div>
      </div>
    </div>
  );
