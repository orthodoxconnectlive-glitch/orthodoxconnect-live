/**
 * Localizes in-app notification title/body for the app's current language.
 *
 * Notifications are stored with a structured `type` plus the actor's name, but
 * their title/body text was written in whatever language the *sender's* app
 * happened to use at creation time. Rendering from templates here means every
 * notification — old and new — reads correctly in the *viewer's* language.
 *
 * Actor names are never translated. User-written content (message text, comment
 * text, quotes, stream titles) is passed through untouched.
 */

export type NotifLanguage = 'ar' | 'en';

export interface LocalizableNotification {
  type?: string;
  title?: string;
  body?: string;
  senderName?: string;
}

export function localizeNotification(
  n: LocalizableNotification,
  language: NotifLanguage
): { title: string; body: string } {
  const ar = language === 'ar';
  const actor = (n.senderName || '').trim();
  const actorName = actor || (ar ? 'عضو الرعية' : 'A parishioner');
  const storedTitle = n.title || '';
  const storedBody = n.body || '';
  const fallback = {
    title: storedTitle || (ar ? 'إشعار الرعية' : 'Parish Notification'),
    body: storedBody,
  };

  switch (n.type) {
    case 'like':
      return {
        title: ar ? 'بركة جديدة' : 'New blessing',
        body: ar ? `${actorName} بارك منشورك` : `${actorName} blessed your post`,
      };

    case 'comment': {
      const prefix =
        actor && storedBody && !storedBody.startsWith(actor) ? `${actor}: ` : '';
      return {
        title: ar ? 'تعليق جديد' : 'New comment',
        body: storedBody
          ? `${prefix}${storedBody}`
          : ar
            ? `${actorName} علّق على منشورك`
            : `${actorName} commented on your reflection`,
      };
    }

    case 'message':
      return {
        title: ar ? `رسالة من ${actorName}` : `Message from ${actorName}`,
        body:
          storedBody ||
          (ar ? `أرسل لك ${actorName} رسالة` : `${actorName} sent you a message`),
      };

    case 'mention': {
      // Reshares. Stored title: "{author} reshared your reflection".
      // Stored body: the quote text, or the generic "Reshared your reflection with the community."
      const genericEn = 'Reshared your reflection with the community.';
      const body =
        !storedBody || storedBody === genericEn
          ? ar
            ? 'أعاد مشاركة منشورك مع المجتمع.'
            : genericEn
          : storedBody;
      return {
        title: ar
          ? `${actorName} أعاد مشاركة منشورك`
          : `${actorName} reshared your reflection`,
        body,
      };
    }

    case 'event_invite': {
      // Stored title: "New Parish Event: {eventTitle}" (or its Arabic form).
      // Stored body: "{date} at {time} • {parish}".
      const mTitle =
        storedTitle.match(/^(?:New Parish Event|فعالية رعوية جديدة):\s*(.*)$/);
      const eventTitle = mTitle ? mTitle[1] : '';
      const mBody = storedBody.match(/^(.*?)\s+at\s+(.*?)\s*•\s*(.*)$/);
      const body = mBody
        ? ar
          ? `${mBody[1]} الساعة ${mBody[2]} • ${mBody[3]}`
          : storedBody
        : storedBody;
      return {
        title: eventTitle
          ? ar
            ? `فعالية رعوية جديدة: ${eventTitle}`
            : `New Parish Event: ${eventTitle}`
          : fallback.title,
        body,
      };
    }

    case 'call': {
      const isVideo = /video/i.test(storedTitle);
      return {
        title: ar
          ? isVideo
            ? 'مكالمة فيديو واردة'
            : 'مكالمة صوتية واردة'
          : isVideo
            ? 'Incoming Video Call'
            : 'Incoming Voice Call',
        body: ar ? `${actorName} يتصل بك الآن.` : `${actorName} is calling you.`,
      };
    }

    case 'system': {
      // Live broadcasts are stored as "🔴 {parish} is LIVE" / "🔴 {parish} في بث مباشر".
      // Other system notifications were already localized at creation time — keep them.
      const mLive = storedTitle.match(/^🔴\s*(.*?)\s*(is LIVE|في بث مباشر)\s*$/);
      if (mLive) {
        const parish = mLive[1];
        return {
          title: ar ? `🔴 ${parish} في بث مباشر` : `🔴 ${parish} is LIVE`,
          body: storedBody,
        };
      }
      return fallback;
    }

    default:
      return fallback;
  }
}
