import React, { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, Plus, MapPin, Video, Church, Sparkles, Filter, Search, BookOpen, Utensils } from 'lucide-react';
import { getTodayLiturgicalDay, getUpcomingFeasts } from '../data/liturgical';
import { EventItem } from '../types';
import { loadEvents, setEventRsvp } from '../utils/events';
import { CreateEventModal } from '../components/CreateEventModal';
import { EventDetailModal } from '../components/EventDetailModal';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { gregorianToCoptic } from '../utils/copticDate';

export const CalendarView: React.FC = () => {
  const { profile } = useAuth();
  const { t, language } = useTheme();

  const todayData = getTodayLiturgicalDay(language);
  const upcomingFeastsList = getUpcomingFeasts(language);
  const copticDate = gregorianToCoptic(new Date());

  const formattedCopticDate =
    language === 'ar'
      ? `${copticDate.day} ${copticDate.monthNameAr} ${copticDate.year} ش`
      : `${copticDate.day} ${copticDate.monthNameEn} ${copticDate.year} AM`;

  const [activeTab, setActiveTab] = useState<'events' | 'liturgical'>('events');
  const [eventsList, setEventsList] = useState<EventItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<EventItem | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    const data = await loadEvents();
    setEventsList(data);
  };

  const handleEventCreated = (newEvent: EventItem) => {
    setEventsList((prev) => [newEvent, ...prev]);
  };

  const handleRsvpQuick = async (
    e: React.MouseEvent,
    event: EventItem,
    status: 'going' | 'interested' | 'not_going'
  ) => {
    e.stopPropagation();
    const updated = await setEventRsvp(
      event.id,
      {
        id: profile?.id || 'me',
        name: profile?.full_name || (language === 'ar' ? 'عضو أرثوذكسي' : 'Orthodox Member'),
        avatar: profile?.avatar_url,
      },
      status
    );

    if (updated) {
      setEventsList((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
    }
  };

  const filteredEvents = eventsList.filter((event) => {
    const matchesCat = selectedCategory === 'all' || event.category === selectedCategory;
    const matchesSearch =
      event.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      event.parish.toLowerCase().includes(searchQuery.toLowerCase()) ||
      event.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const categories = [
    { id: 'all', label: language === 'ar' ? 'الكل' : 'All' },
    { id: 'liturgy', label: language === 'ar' ? 'القداسات' : 'Liturgy' },
    { id: 'feast', label: language === 'ar' ? 'الأعياد' : 'Feasts' },
    { id: 'bible_study', label: language === 'ar' ? 'دراسة الكتاب' : 'Bible Study' },
    { id: 'youth', label: language === 'ar' ? 'الشباب' : 'Youth' },
    { id: 'pilgrimage', label: language === 'ar' ? 'رحلات الحج' : 'Pilgrimages' },
  ];

  return (
    <div className="space-y-6">
      {/* Liturgical & Events Header Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-[#f1ebd7] via-[#fdfaf5] to-[#f1ebd7] border border-[#d4af37]/30 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-[#d4af37] text-white flex items-center justify-center shadow-md shrink-0">
            <CalendarIcon className="w-6 h-6" />
          </div>
          <div>
            <h2 className="font-serif font-bold text-2xl text-[#5a4632]">
              {t('parishEventsTitle')}
            </h2>
            <p className="text-xs text-[#8b6b4a]">
              {t('parishEventsSub')}
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsCreateOpen(true)}
          className="px-4 py-2.5 rounded-xl bg-[#d4af37] hover:bg-[#b89528] text-white font-bold text-xs flex items-center gap-2 shadow-md transition-all cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>{t('createParishEvent')}</span>
        </button>
      </div>

      {/* Main Tab Bar */}
      <div className="flex items-center gap-2 border-b border-[#d4af37]/20 pb-2">
        <button
          onClick={() => setActiveTab('events')}
          className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'events'
              ? 'bg-[#d4af37] text-white shadow-md'
              : 'bg-[#fdfaf5] text-[#8b6b4a] hover:bg-[#f1ebd7]'
          }`}
        >
          <Church className="w-4 h-4" />
          <span>{t('parishEventsTab')} ({eventsList.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('liturgical')}
          className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'liturgical'
              ? 'bg-[#d4af37] text-white shadow-md'
              : 'bg-[#fdfaf5] text-[#8b6b4a] hover:bg-[#f1ebd7]'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>{t('orthodoxFeastsTab')}</span>
        </button>
      </div>

      {/* TAB 1: PARISH EVENTS */}
      {activeTab === 'events' && (
        <div className="space-y-4">
          {/* Filters and Search Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#fdfaf5] p-3 rounded-2xl border border-[#d4af37]/30 shadow-md">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 rtl:left-auto rtl:right-3.5 top-1/2 -translate-y-1/2 text-[#8b6b4a]" />
              <input
                type="text"
                placeholder={language === 'ar' ? 'ابحث في الفعاليات، الرعايا، أو القداسات...' : 'Search events, parishes, or liturgies...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 rtl:pl-4 rtl:pr-10 pr-4 py-2 rounded-xl bg-[#f5f2ed] border border-[#d4af37]/20 text-xs text-[#2c2c2c] placeholder-[#8b6b4a]/60 focus:outline-none focus:border-[#d4af37]"
              />
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
              <Filter className="w-4 h-4 text-[#d4af37] shrink-0 ml-1 rtl:ml-0 rtl:mr-1" />
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all cursor-pointer shrink-0 ${
                    selectedCategory === cat.id
                      ? 'bg-[#d4af37] text-white'
                      : 'bg-[#f5f2ed] text-[#8b6b4a] hover:bg-[#f1ebd7]'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Events Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredEvents.length === 0 ? (
              <div className="col-span-full p-8 text-center bg-[#fdfaf5] rounded-2xl border border-[#d4af37]/30 text-[#8b6b4a] text-xs">
                {language === 'ar'
                  ? 'لا توجد فعاليات في هذا التصنيف. انقر على "إضافة فعالية كنسية" لنشر فعالية جديدة!'
                  : 'No events found in this category. Click "Create Parish Event" to publish one!'}
              </div>
            ) : (
              filteredEvents.map((evt) => {
                const userRsvp = evt.rsvps?.find((r) => r.userId === (profile?.id || 'me'))?.status;

                return (
                  <div
                    key={evt.id}
                    onClick={() => {
                      setSelectedEvent(evt);
                      setIsDetailOpen(true);
                    }}
                    className="bg-[#fdfaf5] border border-[#d4af37]/30 rounded-2xl shadow-lg hover:shadow-2xl transition-all overflow-hidden flex flex-col cursor-pointer group"
                  >
                    {/* Event Cover Image */}
                    <div className="relative h-40 w-full bg-[#5a4632] overflow-hidden">
                      <img
                        src={
                          evt.imageUrl ||
                          'https://images.unsplash.com/photo-1548625361-195fe5772323?auto=format&fit=crop&q=80&w=1200'
                        }
                        alt={evt.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#2c2c2c]/80 via-transparent to-transparent" />

                      <span className="absolute top-3 left-3 rtl:left-auto rtl:right-3 px-2.5 py-1 rounded-full bg-[#d4af37] text-white font-bold text-[10px] uppercase shadow-md">
                        {evt.category.replace('_', ' ')}
                      </span>

                      <div className="absolute bottom-3 left-3 rtl:left-auto rtl:right-3 right-3 rtl:right-auto rtl:left-3 text-white flex items-center justify-between text-xs">
                        <span className="font-bold flex items-center gap-1 text-amber-200">
                          <CalendarIcon className="w-3.5 h-3.5 text-[#d4af37]" /> {evt.date} • {evt.time}
                        </span>
                        <span className="text-[11px] bg-black/40 px-2 py-0.5 rounded-full font-medium">
                          {evt.parish}
                        </span>
                      </div>
                    </div>

                    {/* Card Details */}
                    <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                      <div>
                        <h3 className="font-serif font-bold text-base text-[#5a4632] leading-snug group-hover:text-[#d4af37] transition-colors">
                          {evt.title}
                        </h3>
                        <p className="text-xs text-[#4a3e31] line-clamp-2 mt-1 leading-relaxed">
                          {evt.description}
                        </p>
                      </div>

                      <div className="pt-2 border-t border-[#d4af37]/20 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5 text-[#8b6b4a] text-[11px]">
                          {evt.locationType === 'physical' ? (
                            <MapPin className="w-3.5 h-3.5 text-[#d4af37]" />
                          ) : (
                            <Video className="w-3.5 h-3.5 text-[#d4af37]" />
                          )}
                          <span className="truncate max-w-[140px]">
                            {evt.locationType === 'physical'
                              ? evt.locationAddress || (language === 'ar' ? 'مقر الرعية' : 'Parish Venue')
                              : (language === 'ar' ? 'غرفة افتراضية' : 'Virtual Room')}
                          </span>
                        </div>

                        {/* Quick RSVP Buttons */}
                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => handleRsvpQuick(e, evt, 'going')}
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                              userRsvp === 'going'
                                ? 'bg-emerald-600 text-white shadow-sm'
                                : 'bg-[#f1ebd7] text-[#5a4632] hover:bg-emerald-100'
                            }`}
                          >
                            {language === 'ar' ? `سأحضر (${evt.goingCount})` : `Going (${evt.goingCount})`}
                          </button>

                          <button
                            onClick={(e) => handleRsvpQuick(e, evt, 'interested')}
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                              userRsvp === 'interested'
                                ? 'bg-[#d4af37] text-white shadow-sm'
                                : 'bg-[#f1ebd7] text-[#5a4632] hover:bg-amber-100'
                            }`}
                          >
                            {language === 'ar' ? 'مهتم' : 'Interested'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* TAB 2: LITURGICAL FEASTS & FASTING */}
      {activeTab === 'liturgical' && (
        <div className="space-y-6">
          {/* Coptic Liturgical Date & Fasting Overview Banner */}
          <div className="p-5 rounded-2xl bg-[#eedcb5]/70 border-2 border-[#c5a059] shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-[#c5a059] text-white flex items-center justify-center font-bold text-xl shadow-md shrink-0">
                ☨
              </div>
              <div>
                <p className="text-[10px] font-serif uppercase tracking-wider text-[#7c5f3d]">
                  {language === 'ar' ? 'التقويم القبطي الليترجي' : 'Coptic Liturgical Calendar'}
                </p>
                <h3 className="font-serif font-bold text-lg sm:text-xl text-[#3d2b18]">
                  {formattedCopticDate}
                </h3>
              </div>
            </div>

            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-100 border border-emerald-400 text-emerald-900 font-serif font-bold text-xs">
              <Utensils className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
              <span>{todayData.fastingInfo}</span>
            </div>
          </div>

          {/* Today Feast Focus */}
          <div className="p-6 rounded-2xl bg-[#fdfaf5] border border-[#d4af37] shadow-xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="px-3 py-1 rounded-full bg-[#d4af37] text-white text-[10px] font-bold uppercase tracking-wider shadow-sm">
                {t('todaysCommemoration')}
              </span>
              <span className="text-xs font-serif font-bold text-[#8b6b4a]">
                {todayData.date}
              </span>
            </div>

            <h3 className="font-serif font-bold text-2xl text-[#5a4632]">
              {todayData.saintName}
            </h3>
            <p className="text-xs text-[#8b6b4a] font-semibold italic">
              {todayData.saintTitle}
            </p>
            <div className="p-4 rounded-xl bg-[#f1ebd7] border border-[#d4af37]/20 text-xs text-[#4a3e31] space-y-1">
              <p className="font-serif font-bold text-[#5a4632] flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-[#d4af37]" />
                <span>{t('dailyScripture')} ({todayData.scriptureRef}):</span>
              </p>
              <p className="italic">"{todayData.scriptureText}"</p>
            </div>
          </div>

          {/* Upcoming Great Feasts Grid */}
          <div className="space-y-3">
            <h3 className="font-serif font-bold text-lg text-[#5a4632]">
              {t('upcomingGreatFeasts')}
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {upcomingFeastsList.map((feast, idx) => (
                <div
                  key={idx}
                  className="p-5 rounded-2xl bg-[#fdfaf5] border border-[#d4af37]/30 shadow-lg space-y-2 hover:border-[#d4af37] transition-all"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#d4af37] font-bold">{feast.date}</span>
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                      {feast.fastingInfo}
                    </span>
                  </div>

                  <h4 className="font-serif font-bold text-base text-[#5a4632]">
                    {feast.saintName}
                  </h4>
                  <p className="text-xs text-[#8b6b4a]">{feast.saintTitle}</p>

                  <div className="pt-2 border-t border-[#d4af37]/20 text-[11px] text-[#4a3e31] italic">
                    <span className="font-bold text-[#5a4632] non-italic">{feast.scriptureRef}: </span>
                    "{feast.scriptureText}"
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      <CreateEventModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onEventCreated={handleEventCreated}
      />

      <EventDetailModal
        event={selectedEvent}
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        onRsvpUpdated={(updated) => {
          setEventsList((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
          setSelectedEvent(updated);
        }}
      />
    </div>
  );
};
