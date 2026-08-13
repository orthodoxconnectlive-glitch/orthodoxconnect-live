import { supabase } from '../lib/supabase';
import { ContentReport, ModerationAuditLog, UserModerationStatus } from '../types';

const INITIAL_REPORTS: ContentReport[] = [];

const INITIAL_AUDIT_LOGS: ModerationAuditLog[] = [];

let localReportsCache: ContentReport[] = [...INITIAL_REPORTS];
let localAuditLogsCache: ModerationAuditLog[] = [...INITIAL_AUDIT_LOGS];
let userStatusMap: Record<string, UserModerationStatus> = {};

export async function loadContentReports(): Promise<ContentReport[]> {
  try {
    const { data, error } = await supabase
      .from('content_reports')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data && data.length > 0) {
      const dbReports: ContentReport[] = data.map((d: any) => ({
        id: String(d.id),
        targetType: d.target_type,
        targetId: d.target_id,
        targetContentPreview: d.target_content_preview || undefined,
        targetAuthorName: d.target_author_name || undefined,
        targetAuthorId: d.target_author_id || undefined,
        reporterId: d.reporter_id || 'me',
        reporterName: d.reporter_name || 'Parish Member',
        reason: d.reason || 'inappropriate',
        details: d.details || undefined,
        status: d.status || 'pending',
        createdAt: d.created_at || new Date().toISOString(),
      }));

      const map = new Map<string, ContentReport>();
      dbReports.forEach((r) => map.set(r.id, r));
      localReportsCache.forEach((r) => {
        if (!map.has(r.id)) map.set(r.id, r);
      });

      return Array.from(map.values());
    }
  } catch (err) {
    console.warn('Supabase reports fetch fallback:', err);
  }

  return localReportsCache;
}

export async function submitContentReport(
  reportData: Partial<ContentReport>
): Promise<ContentReport> {
  const newReport: ContentReport = {
    id: 'rpt-' + Date.now(),
    targetType: reportData.targetType || 'post',
    targetId: reportData.targetId || 'unknown',
    targetContentPreview: reportData.targetContentPreview,
    targetAuthorName: reportData.targetAuthorName,
    targetAuthorId: reportData.targetAuthorId,
    reporterId: reportData.reporterId || 'me',
    reporterName: reportData.reporterName || 'Parishioner',
    reason: reportData.reason || 'inappropriate',
    details: reportData.details,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };

  localReportsCache = [newReport, ...localReportsCache];

  try {
    await supabase.from('content_reports').insert([
      {
        target_type: newReport.targetType,
        target_id: newReport.targetId,
        target_content_preview: newReport.targetContentPreview || null,
        target_author_name: newReport.targetAuthorName || null,
        target_author_id: newReport.targetAuthorId || null,
        reporter_id: newReport.reporterId,
        reporter_name: newReport.reporterName,
        reason: newReport.reason,
        details: newReport.details || null,
        status: 'pending',
      },
    ]);
  } catch (err) {
    console.warn('Submit content report warning:', err);
  }

  return newReport;
}

export async function updateReportStatus(
  reportId: string,
  status: 'reviewed' | 'action_taken' | 'dismissed',
  admin: { id: string; name: string },
  actionType?: 'dismiss' | 'remove_content' | 'warn_user' | 'ban_user',
  reasonText?: string
): Promise<void> {
  let targetReport: ContentReport | undefined;

  localReportsCache = localReportsCache.map((r) => {
    if (r.id === reportId) {
      targetReport = { ...r, status };
      return targetReport;
    }
    return r;
  });

  if (targetReport && actionType) {
    const logItem: ModerationAuditLog = {
      id: 'log-' + Date.now(),
      adminId: admin.id,
      adminName: admin.name,
      action: actionType,
      targetId: targetReport.targetId,
      targetType: targetReport.targetType,
      reason: reasonText || `Action ${actionType} performed on reported ${targetReport.targetType}.`,
      createdAt: new Date().toISOString(),
    };

    localAuditLogsCache = [logItem, ...localAuditLogsCache];
  }

  try {
    await supabase
      .from('content_reports')
      .update({ status })
      .eq('id', reportId);
  } catch (err) {
    console.warn('Update report status warning:', err);
  }
}

export async function getUserModerationStatus(userId: string): Promise<UserModerationStatus> {
  if (userStatusMap[userId]) {
    return userStatusMap[userId];
  }
  return {
    userId,
    warningCount: 0,
    isBanned: false,
    updatedAt: new Date().toISOString(),
  };
}

export async function warnUser(
  userId: string,
  admin: { id: string; name: string },
  reason: string
): Promise<UserModerationStatus> {
  const current = await getUserModerationStatus(userId);
  const updated: UserModerationStatus = {
    ...current,
    warningCount: current.warningCount + 1,
    updatedAt: new Date().toISOString(),
  };

  userStatusMap[userId] = updated;

  localAuditLogsCache = [
    {
      id: 'log-' + Date.now(),
      adminId: admin.id,
      adminName: admin.name,
      action: 'warn_user',
      targetId: userId,
      targetType: 'user',
      reason: reason || `Issued official warning #${updated.warningCount} to user.`,
      createdAt: new Date().toISOString(),
    },
    ...localAuditLogsCache,
  ];

  return updated;
}

export async function setUserBanStatus(
  userId: string,
  isBanned: boolean,
  admin: { id: string; name: string },
  banReason?: string
): Promise<UserModerationStatus> {
  const current = await getUserModerationStatus(userId);
  const updated: UserModerationStatus = {
    ...current,
    isBanned,
    banReason: isBanned ? banReason : undefined,
    updatedAt: new Date().toISOString(),
  };

  userStatusMap[userId] = updated;

  localAuditLogsCache = [
    {
      id: 'log-' + Date.now(),
      adminId: admin.id,
      adminName: admin.name,
      action: isBanned ? 'ban_user' : 'unban_user',
      targetId: userId,
      targetType: 'user',
      reason: banReason || (isBanned ? 'User banned by admin.' : 'User ban lifted by admin.'),
      createdAt: new Date().toISOString(),
    },
    ...localAuditLogsCache,
  ];

  try {
    await supabase.from('profiles').update({ is_banned: isBanned }).eq('id', userId);
  } catch (err) {
    console.warn('Set ban status error:', err);
  }

  return updated;
}

export async function loadAuditLogs(): Promise<ModerationAuditLog[]> {
  return localAuditLogsCache;
}
