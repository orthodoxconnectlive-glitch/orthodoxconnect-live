import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Users,
  UserCheck,
  Shield,
  AlertTriangle,
  Flag,
  Trash2,
  AlertOctagon,
  Clock,
  Search,
  UserPlus,
  X,
  CheckCircle,
  Church,
} from 'lucide-react';
import { UserProfile, UserRole, ContentReport, ModerationAuditLog } from '../types';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { apiFetch, profilesApi, reportsApi, churchesApi } from '../lib/api';
import { US_COPTIC_CHURCHES } from '../data/usCopticChurches';
import { OCA_PARISHES } from '../data/ocaParishes';
import {
  loadContentReports,
  updateReportStatus,
  warnUser,
  setUserBanStatus,
  loadAuditLogs,
  getUserModerationStatus,
} from '../utils/moderation';
import { deletePost, deleteUserApi } from '../utils/posts';

interface AdminPanelViewProps {
  onSelectUser?: (user: { id?: string; name: string; avatar?: string; parish?: string; role?: string }) => void;
}

export const AdminPanelView: React.FC<AdminPanelViewProps> = ({ onSelectUser }) => {
  const { profile } = useAuth();
  const { t } = useTheme();

  const [activeTab, setActiveTab] = useState<'users' | 'clergy' | 'reports' | 'audit'>('users');
  const [reportsList, setReportsList] = useState<ContentReport[]>([]);
  const [auditLogs, setAuditLogs] = useState<ModerationAuditLog[]>([]);
  const [userStatuses, setUserStatuses] = useState<Record<string, { warningCount: number; isBanned: boolean }>>({});

  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [totalMembers, setTotalMembers] = useState<number>(0);

  // Search & Filter
  const [userSearchQuery, setUserSearchQuery] = useState('');

  // Modals & Forms
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [newMemberForm, setNewMemberForm] = useState({
    fullName: '',
    email: '',
    parish: '',
    role: 'user' as UserRole,
  });

  const [userToDelete, setUserToDelete] = useState<UserProfile | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const isCurrentSuperAdmin = profile?.email?.toLowerCase() === 'orthodoxconnect.live@gmail.com';
  const isSuperAdmin = isCurrentSuperAdmin || profile?.role === 'super_admin';
  const isAdminOrOwner = isSuperAdmin || profile?.role === 'admin' || profile?.role === 'owner';

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // One-tap import of the US Coptic churches directory
  const [churchImporting, setChurchImporting] = useState(false);
  const [ocaImporting, setOcaImporting] = useState(false);
  const [ocaImportResult, setOcaImportResult] = useState<string | null>(null);
  const [deduping, setDeduping] = useState(false);
  const [dedupeResult, setDedupeResult] = useState<string | null>(null);
  const [ocaImportProgress, setOcaImportProgress] = useState({ done: 0, total: 0 });
  const [churchImportProgress, setChurchImportProgress] = useState({ done: 0, total: 0 });
  const [churchImportResult, setChurchImportResult] = useState<string | null>(null);

  const handleDedupe = async () => {
    if (deduping) return;
    if (!confirm('Remove duplicate churches? Keeps the most complete record per church.')) return;
    setDeduping(true);
    setDedupeResult(null);
    try {
      const data = await apiFetch<any>('/api/churches/dedupe', { method: 'POST' }).catch(() => ({}));
      if (data.success) {
        setDedupeResult('Done: merged ' + data.mergedGroups + ' groups, removed ' + data.deleted + ' duplicates');
      } else {
        setDedupeResult('Failed: ' + (data.error || 'unknown error'));
      }
    } catch {
      setDedupeResult('Failed');
    } finally {
      setDeduping(false);
    }
  };

  const handleImportOca = async () => {
    if (ocaImporting) return;
    setOcaImporting(true);
    setOcaImportResult(null);
    try {
      setOcaImportProgress({ done: 0, total: OCA_PARISHES.length });
      // Single bulk request — far lighter than 791 individual saves.
      const payload = OCA_PARISHES.map((ch) => ({
        name: ch.name,
        city: ch.city,
        country: ch.country,
        jurisdiction: 'OCA',
        description: ch.diocese || 'Orthodox Church in America',
        website: ch.website || '',
      }));
      const data = await apiFetch<any>('/api/churches/bulk', {
        method: 'POST',
        body: JSON.stringify({ churches: payload }),
      }).catch(() => ({}));
      if (data.success) {
        setOcaImportProgress({ done: data.inserted, total: OCA_PARISHES.length });
        setOcaImportResult('OCA import done: ' + data.inserted + ' added, ' + data.skipped + ' skipped');
      } else {
        setOcaImportResult('OCA import failed: ' + (data.error || 'unknown error'));
      }
    } catch {
      setOcaImportResult('OCA import failed');
    } finally {
      setOcaImporting(false);
    }
  };

  const handleImportChurches = async () => {
    if (churchImporting) return;
    setChurchImporting(true);
    setChurchImportResult(null);
    try {
      const existing = await churchesApi.list();
      // Match by name+city: several churches share a name (e.g. St. Mark) in
      // different cities. Name-only matching skipped them as duplicates.
      const keyOf = (n: any, c: any) => ((n || '').trim() + '|' + (c || '').trim()).toLowerCase();
      const byNameCity = new Map<string, any>();
      for (const c of existing as any[]) {
        if (c.name) byNameCity.set(keyOf(c.name, c.city), c);
        if ((c as any).name_ar) byNameCity.set(keyOf((c as any).name_ar, (c as any).city_ar), c);
      }
      type Op = { type: 'create' | 'update'; ch: (typeof US_COPTIC_CHURCHES)[number]; id?: string };
      const ops: Op[] = [];
      const payload = (ch: (typeof US_COPTIC_CHURCHES)[number]) => ({
        name: ch.name,
        name_ar: ch.name_ar,
        city: ch.city,
        city_ar: ch.city_ar,
        country: ch.country,
        description: ch.description,
        description_ar: ch.description_ar,
        address: (ch as any).address || '',
        website: (ch as any).website || '',
      });
      for (const ch of US_COPTIC_CHURCHES) {
        const ex = byNameCity.get(keyOf(ch.name, ch.city)) || byNameCity.get(keyOf(ch.name_ar, ch.city_ar));
        if (!ex) {
          ops.push({ type: 'create', ch });
        } else {
          // refresh bilingual fields on already-imported rows (migrates old Arabic-only rows)
          const needsUpdate =
            (ex.name || '').trim() !== ch.name.trim() ||
            ((ex as any).name_ar || '').trim() !== ch.name_ar.trim() ||
            (ex.city || '').trim() !== ch.city.trim();
          if (needsUpdate) ops.push({ type: 'update', ch, id: ex.id });
        }
      }
      setChurchImportProgress({ done: 0, total: ops.length });
      let ok = 0;
      // small parallel batches to keep the import fast
      for (let i = 0; i < ops.length; i += 5) {
        const batch = ops.slice(i, i + 5);
        const results = await Promise.all(
          batch.map((op) => {
            if (op.type === 'create') {
              return churchesApi
                .create(payload(op.ch) as any)
                .then(() => true)
                .catch(() => false);
            }
            return churchesApi
              .update(op.id as string, payload(op.ch) as any)
              .then(() => true)
              .catch(() => false);
          })
        );
        ok += results.filter(Boolean).length;
        setChurchImportProgress({ done: ok, total: ops.length });
      }
      setChurchImportResult(`${t('adminChurchImportDone')}: ${ok}/${ops.length}`);
      showToast(`${t('adminChurchImportDone')}: ${ok}/${ops.length}`);
    } catch {
      setChurchImportResult(t('adminChurchImportDone') + ' ✕');
    } finally {
      setChurchImporting(false);
    }
  };

  useEffect(() => {
    if (isAdminOrOwner) {
      fetchAdminData();
    }
  }, [isAdminOrOwner]);

  const fetchAdminData = async () => {
    if (!isAdminOrOwner) return;

    // 1. Fetch registered profiles from Cloudflare D1
    let loadedUsers: UserProfile[] = [];
    try {
      loadedUsers = await profilesApi.getAll();
      if (loadedUsers && loadedUsers.length > 0) {
        setUsersList(loadedUsers);
        setTotalMembers(loadedUsers.length);
      } else {
        if (profile) {
          const defaultAdminUser: UserProfile = {
            id: profile.id || 'admin-user',
            email: profile.email || 'admin@orthodoxconnect.live',
            full_name: profile.full_name || 'Parish Administrator',
            parish: profile.parish || 'St. George Cathedral',
            role: profile.role || 'admin',
            avatar_url: profile.avatar_url,
            created_at: new Date().toISOString(),
          };
          setUsersList([defaultAdminUser]);
          setTotalMembers(1);
        }
      }
    } catch (err) {
      console.warn('Admin user list fetch error:', err);
    }

    // 2. Fetch moderation content reports
    const reports = await loadContentReports();
    setReportsList(reports);

    // 3. Fetch audit logs
    const logs = await loadAuditLogs();
    setAuditLogs(logs);

    // 4. Load user moderation status
    const statusMap: Record<string, { warningCount: number; isBanned: boolean }> = {};
    const checkList = loadedUsers.length > 0 ? loadedUsers : usersList;
    for (const u of checkList) {
      const st = await getUserModerationStatus(u.id);
      statusMap[u.id] = { warningCount: st.warningCount, isBanned: st.isBanned };
    }
    setUserStatuses(statusMap);
  };

  // Role Change Dropdown Handler
  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    if (!isAdminOrOwner) return;

    setUsersList((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
    );

    try {
      await profilesApi.update(userId, { role: newRole });
      const _roleLabel = newRole === 'clergy' ? t('adminRoleClergy') : newRole === 'admin' ? t('adminRoleAdmin') : t('adminRoleMember');
      showToast(t('adminRoleUpdated').replace('{role}', _roleLabel));
    } catch (err) {
      console.warn('Role update error:', err);
      const _roleLabel2 = newRole === 'clergy' ? t('adminRoleClergy') : newRole === 'admin' ? t('adminRoleAdmin') : t('adminRoleMember');
        showToast(t('adminRoleUpdatedLocal').replace('{role}', _roleLabel2));
    }
  };

  // Delete User Confirmation & Handler
  const confirmDeleteUser = async () => {
    if (!userToDelete || !isAdminOrOwner) return;

    const targetId = userToDelete.id;
    const targetName = userToDelete.full_name;
    const targetEmail = userToDelete.email;
    const targetRole = userToDelete.role;

    const isTargetAdmin = targetRole === 'admin' || targetRole === 'owner';
    if (isTargetAdmin && !isCurrentSuperAdmin) {
      showToast(t('adminDeleteDenied'));
      setUserToDelete(null);
      return;
    }

    // 1. Call Cloudflare Worker API
    const apiResult = await deleteUserApi(targetId, targetEmail, targetRole, profile);
    if (!apiResult.success) {
      showToast(`${t('adminError')}: ${apiResult.error || t('adminDeleteFailed')}`);
      setUserToDelete(null);
      return;
    }

    // 2. Remove from state
    setUsersList((prev) => prev.filter((u) => u.id !== targetId));
    setTotalMembers((prev) => Math.max(0, prev - 1));

    try {
      await profilesApi.delete(targetId);
      showToast(t('adminRemoved').replace('{name}', targetName));
    } catch (err) {
      console.warn('Delete profile error:', err);
      showToast(t('adminRemoved').replace('{name}', targetName));
    } finally {
      setUserToDelete(null);
    }
  };

  // Add Member Modal Submit Handler
  const handleAddMemberSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdminOrOwner) return;

    const name = newMemberForm.fullName.trim();
    const email = newMemberForm.email.trim();
    const parish = newMemberForm.parish.trim() || profile?.parish || 'St. George Cathedral';
    const role = newMemberForm.role;

    if (!name || !email) {
      showToast(t('adminNeedNameEmail'));
      return;
    }

    const newId = `user_${Date.now()}`;
    const newMemberObj: UserProfile = {
      id: newId,
      email,
      full_name: name,
      parish,
      role,
      avatar_url: 'https://orthodoxconnect.live/launchericon-512x512.png',
      created_at: new Date().toISOString(),
    };

    setUsersList((prev) => [newMemberObj, ...prev]);
    setTotalMembers((prev) => prev + 1);

    try {
      await profilesApi.update(newId, {
        email,
        full_name: name,
        parish,
        role,
        avatar_url: newMemberObj.avatar_url,
      });
      showToast(t('adminAdded').replace('{name}', name));
    } catch (err) {
      console.warn('Add member DB notice:', err);
      showToast(t('adminAdded').replace('{name}', name));
    } finally {
      setNewMemberForm({ fullName: '', email: '', parish: '', role: 'user' });
      setIsAddMemberOpen(false);
    }
  };

  // Moderation Actions
  const handleDismissReport = async (reportId: string) => {
    await updateReportStatus(
      reportId,
      'dismissed',
      { id: profile?.id || 'admin', name: profile?.full_name || 'Admin' },
      'dismiss',
      'Report reviewed and dismissed.'
    );
    setReportsList((prev) => prev.map((r) => (r.id === reportId ? { ...r, status: 'dismissed' } : r)));
    refreshLogs();
  };

  const handleRemoveContent = async (report: ContentReport) => {
    if (report.targetType === 'post') {
      await deletePost(report.targetId, profile);
    }
    await updateReportStatus(
      report.id,
      'action_taken',
      { id: profile?.id || 'admin', name: profile?.full_name || 'Admin' },
      'remove_content',
      `Removed flagged ${report.targetType} from feed.`
    );
    setReportsList((prev) => prev.map((r) => (r.id === report.id ? { ...r, status: 'action_taken' } : r)));
    refreshLogs();
  };

  const handleWarnUser = async (report: ContentReport) => {
    const targetUserId = report.targetAuthorId || report.targetId;
    const admin = { id: profile?.id || 'admin', name: profile?.full_name || 'Admin' };
    const updatedStatus = await warnUser(targetUserId, admin, `Official warning for ${report.reason}`);

    setUserStatuses((prev) => ({
      ...prev,
      [targetUserId]: { warningCount: updatedStatus.warningCount, isBanned: updatedStatus.isBanned },
    }));

    await updateReportStatus(report.id, 'action_taken', admin, 'warn_user', 'Issued warning to user.');
    setReportsList((prev) => prev.map((r) => (r.id === report.id ? { ...r, status: 'action_taken' } : r)));
    refreshLogs();
  };

  const handleBanUser = async (targetUserId: string, isBanning: boolean) => {
    const admin = { id: profile?.id || 'admin', name: profile?.full_name || 'Admin' };
    const updatedStatus = await setUserBanStatus(targetUserId, isBanning, admin, 'Violation of parish policy.');

    setUserStatuses((prev) => ({
      ...prev,
      [targetUserId]: { warningCount: updatedStatus.warningCount, isBanned: updatedStatus.isBanned },
    }));

    refreshLogs();
  };

  const refreshLogs = async () => {
    const logs = await loadAuditLogs();
    setAuditLogs(logs);
  };

  if (!isAdminOrOwner) {
    return (
      <div className="p-8 text-center bg-(--bg-card-hi) rounded-2xl border border-red-500/40 text-red-700 shadow-xl space-y-2">
        <AlertTriangle className="w-10 h-10 mx-auto text-red-600" />
        <h3 className="font-serif font-bold text-lg">{t('adminAccessRestricted')}</h3>
        <p className="text-xs text-(--tx-soft)">
          {t('adminAccessRestrictedMsg')}
        </p>
      </div>
    );
  }

  const pendingCount = reportsList.filter((r) => r.status === 'pending').length;

  const filteredUsers = usersList.filter(
    (u) =>
      u.full_name.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
      u.parish.toLowerCase().includes(userSearchQuery.toLowerCase())
  );

  const filteredClergy = usersList.filter(
    (u) =>
      u.role === 'clergy' &&
      (u.full_name.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
        u.email.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
        u.parish.toLowerCase().includes(userSearchQuery.toLowerCase()))
  );

  // Shared users table (used by Users tab and Clergy tab)
  const renderUsersTable = (list: UserProfile[], emptyMessage: string) => (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-(--ln-bright)/30 text-(--tx-soft) uppercase font-bold text-[10px]">
                  <th className="py-3 px-3">{t('adminThMember')}</th>
                  <th className="py-3 px-3">{t('adminThEmail')}</th>
                  <th className="py-3 px-3">{t('adminThParish')}</th>
                  <th className="py-3 px-3">{t('adminThRole')}</th>
                  <th className="py-3 px-3">{t('adminThJoined')}</th>
                  <th className="py-3 px-3">{t('adminThStatus')}</th>
                  <th className="py-3 px-3 text-right">{t('adminThActions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-(--ln-bright)/20">
                {list.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-(--tx-soft)">
                      {emptyMessage}
                    </td>
                  </tr>
                ) : (
                  list.map((user) => {
                    const status = userStatuses[user.id] || { warningCount: 0, isBanned: false };
                    const isTargetSuperAdmin =
                      user.role === 'super_admin' ||
                      user.email?.toLowerCase() === 'orthodoxconnect.live@gmail.com';
                    const isTargetAdmin = user.role === 'admin' || user.role === 'owner';
                    const canDeleteTarget =
                      !isTargetSuperAdmin && (!isTargetAdmin || isCurrentSuperAdmin);
                    // NEW badge: joined within the last 7 days, then it goes away on its own.
                    const isNewMember = (() => {
                      if (!user.created_at) return false;
                      const joined = new Date(user.created_at).getTime();
                      if (isNaN(joined)) return false;
                      return Date.now() - joined < 7 * 24 * 60 * 60 * 1000;
                    })();

                    return (
                      <tr key={user.id} className="hover:bg-(--bg-inset)/50 transition-colors">
                        {/* Member Name & Avatar */}
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2.5">
                            <img
                              src={
                                user.avatar_url ||
                                'https://orthodoxconnect.live/launchericon-512x512.png'
                              }
                              alt={user.full_name}
                              className="w-8 h-8 rounded-full object-cover border border-(--ln-bright)/40"
                            />
                            <div>
                              <p className="font-bold text-(--tx-head)">
                                {onSelectUser ? (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      onSelectUser({
                                        id: user.id,
                                        name: user.full_name,
                                        avatar: user.avatar_url || undefined,
                                        parish: user.parish || undefined,
                                        role: user.role || undefined,
                                      })
                                    }
                                    className="hover:underline hover:text-(--ac-gold-tx) transition-colors cursor-pointer text-start"
                                  >
                                    {user.full_name}
                                  </button>
                                ) : (
                                  user.full_name
                                )}
                                {isNewMember && (
                                  <span className="ml-2 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-green-600 text-white align-middle">{t('adminNew')}</span>
                                )}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Email Address - strictly guarded for Admins */}
                        <td className="py-3 px-3 text-(--tx-head) font-mono text-[11px]">
                          {isAdminOrOwner ? user.email : '••••@••••.com'}
                        </td>

                        {/* Parish */}
                        <td className="py-3 px-3 text-(--tx-faint) font-medium">
                          {user.parish}
                        </td>

                        {/* Role Badge & Change Role Dropdown */}
                        <td className="py-3 px-3">
                          {isTargetSuperAdmin ? (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-(--ac-gold) text-white border border-(--ln-bronze) shadow-sm">{t('adminSuperAdmin')}</span>
                          ) : isTargetAdmin && !isCurrentSuperAdmin ? (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-[#7c5f3d] text-white border border-[#5a4632] shadow-sm">{t('adminAdminRole')}</span>
                          ) : (
                            <select
                              value={user.role}
                              onChange={(e) => handleRoleChange(user.id, e.target.value as UserRole)}
                              className="px-2 py-1 rounded-lg bg-white border border-(--ln-bright)/40 text-(--tx-head) font-bold text-[11px] focus:outline-none focus:border-(--ln-bright) cursor-pointer"
                            >
                              <option value="user">{t('adminRoleMember')}</option>
                              <option value="clergy">{t('adminRoleClergy')}</option>
                              <option value="admin">{t('adminRoleAdmin')}</option>
                            </select>
                          )}
                        </td>

                        {/* Joined Date */}
                        <td className="py-3 px-3 text-(--tx-soft) text-[11px]">
                          {user.created_at ? new Date(user.created_at).toLocaleDateString() : t('adminActive')}
                        </td>

                        {/* Status */}
                        <td className="py-3 px-3">
                          {status.isBanned ? (
                            <span className="px-2 py-0.5 rounded-full bg-red-600 text-white text-[10px] font-bold uppercase">{t('adminBanned')}</span>
                          ) : (
                            <span className="text-xs text-(--tx-soft) font-semibold">
                              {status.warningCount > 0 ? (
                                <span className="text-red-600 font-bold">{status.warningCount} {t('adminWarnings')}</span>
                              ) : (
                                t('adminGoodStanding')
                              )}
                            </span>
                          )}
                        </td>

                        {/* Action Buttons */}
                        <td className="py-3 px-3 text-right flex items-center justify-end gap-2">
                          {isTargetSuperAdmin ? (
                            <span className="text-[10px] text-(--ac-bronze-tx) font-serif font-bold uppercase italic">
                              {t('adminSuperAdminProtected')}
                            </span>
                          ) : (
                            <>
                              <button
                                onClick={() => handleBanUser(user.id, !status.isBanned)}
                                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase transition-all cursor-pointer ${
                                  status.isBanned
                                    ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                                    : 'bg-amber-600 text-white hover:bg-amber-700'
                                }`}
                              >
                                {status.isBanned ? t('adminUnban') : t('adminBan')}
                              </button>

                              {canDeleteTarget ? (
                                <button
                                  onClick={() => setUserToDelete(user)}
                                  className="px-2.5 py-1 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold text-[10px] uppercase shadow-sm transition-all cursor-pointer flex items-center gap-1"
                                  title={t('adminDeleteUserTitle')}
                                >
                                  <Trash2 className="w-3 h-3" />
                                  <span>{t('adminDeleteUser')}</span>
                                </button>
                              ) : isTargetAdmin ? (
                                <span
                                  className="text-[10px] text-(--tx-soft) italic font-medium px-1.5 py-0.5 rounded bg-(--bg-inset2) border border-(--ln-bright)/20"
                                  title={t('adminAdminProtectedTip')}
                                >{t('adminAdminProtected')}</span>
                              ) : null}
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
  );
  return (
    <div className="space-y-6 relative">
      {/* Toast Feedback Banner */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-2.5 rounded-2xl bg-[#1c1611] border border-(--ln-gold) text-[#f5ebd9] font-serif font-bold text-xs shadow-2xl flex items-center gap-2 animate-bounce">
          <CheckCircle className="w-4 h-4 text-(--ac-gold-tx)" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-(--bg-inset) via-(--bg-card-hi) to-(--bg-inset) border border-(--ln-bright)/30 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-(--ac-bright) text-white flex items-center justify-center shadow-md">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h2 className="font-serif font-bold text-2xl text-(--tx-head)">
              {t('adminPanelTitle')}
            </h2>
            <p className="text-xs text-(--tx-soft)">
              {t('adminPanelSubtitle')}
            </p>
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-(--bg-card-hi) border border-(--ln-bright)/30 shadow-lg flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-(--ac-bright)/20 border border-(--ln-bright)/40 flex items-center justify-center text-(--ac-bright-tx)">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[11px] text-(--tx-soft) uppercase font-bold tracking-wider">
              {t('adminTotalMembers')}
            </p>
            <h3 className="font-serif font-bold text-2xl text-(--tx-head)">
              {totalMembers}
            </h3>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-(--bg-card-hi) border border-(--ln-bright)/30 shadow-lg flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-100 border border-purple-300 flex items-center justify-center text-purple-700">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[11px] text-(--tx-soft) uppercase font-bold tracking-wider">
              {t('adminAdmins')}
            </p>
            <h3 className="font-serif font-bold text-2xl text-(--tx-head)">
              {usersList.filter((u) => u.role === 'admin' || u.role === 'owner' || u.role === 'super_admin').length}
            </h3>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-(--bg-card-hi) border border-(--ln-bright)/30 shadow-lg flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-100 border border-amber-300 flex items-center justify-center text-amber-700">
            <UserCheck className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[11px] text-(--tx-soft) uppercase font-bold tracking-wider">
              {t('adminClergy')}
            </p>
            <h3 className="font-serif font-bold text-2xl text-(--tx-head)">
              {usersList.filter((u) => u.role === 'clergy').length}
            </h3>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-(--bg-card-hi) border border-(--ln-bright)/30 shadow-lg flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-red-100 border border-red-300 flex items-center justify-center text-red-600">
            <Flag className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[11px] text-(--tx-soft) uppercase font-bold tracking-wider">
              {t('adminPendingReports')}
            </p>
            <h3 className="font-serif font-bold text-2xl text-(--tx-head)">
              {pendingCount}
            </h3>
          </div>
        </div>
      </div>

      {/* US Churches one-tap import */}
      <div className="p-5 rounded-2xl bg-(--bg-card-hi) border border-(--ln-bright)/30 shadow-lg flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-(--ac-bright)/10 border border-(--ac-bright)/30 flex items-center justify-center text-(--ac-bright-tx) shrink-0">
          <Church className="w-6 h-6" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-serif font-bold text-base text-(--tx-head)">
            {t('adminChurchImportTitle')}
          </p>
          <p className="text-xs text-(--tx-soft) mt-0.5">
            {t('adminChurchImportDesc')}
          </p>
          {churchImporting && (
            <p className="text-xs font-bold text-(--ac-bright-tx) mt-1">
              {t('adminChurchImporting')} {churchImportProgress.done}/{churchImportProgress.total}
            </p>
          )}
          {churchImportResult && !churchImporting && (
            <p className="text-xs font-bold text-(--ac-bright-tx) mt-1">{churchImportResult}</p>
          )}
        </div>
        <button
          onClick={handleImportChurches}
          disabled={churchImporting}
          className="px-5 py-2.5 rounded-xl bg-(--ac-bright) hover:opacity-90 text-white font-serif font-bold text-xs uppercase tracking-wider shadow-md transition-all cursor-pointer disabled:opacity-50 shrink-0"
        >
          {churchImporting ? t('adminChurchImporting') : t('adminChurchImportBtn')}
        </button>
      </div>

      {/* OCA parishes import */}
      <div className="flex items-center gap-4 p-4 rounded-3xl bg-(--bg-card) dark:bg-[#1c1611] border-2 border-(--ln-gold) dark:border-[#8b6b4a] shadow-lg">
        <div className="w-12 h-12 rounded-2xl bg-(--ac-gold)/15 flex items-center justify-center shrink-0">
          <Church className="w-6 h-6" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-serif font-bold text-base text-(--tx-head)">
            OCA Parishes
          </p>
          <p className="text-xs text-(--tx-soft) mt-0.5">
            Import {OCA_PARISHES.length} Orthodox Church in America parishes (USA, Canada, Mexico)
          </p>
          {ocaImporting && (
            <p className="text-xs font-bold text-(--ac-bright-tx) mt-1">
              Importing {ocaImportProgress.done}/{ocaImportProgress.total}
            </p>
          )}
          {ocaImportResult && !ocaImporting && (
            <p className="text-xs font-bold text-(--ac-bright-tx) mt-1">{ocaImportResult}</p>
          )}
        </div>
        <button
          onClick={handleImportOca}
          disabled={ocaImporting}
          className="px-5 py-2.5 rounded-xl bg-(--ac-bright) hover:opacity-90 text-white font-serif font-bold text-xs uppercase tracking-wider shadow-md transition-all cursor-pointer disabled:opacity-50 shrink-0"
        >
          {ocaImporting ? 'Importing' : 'Import'}
        </button>
      </div>

      {/* Dedupe */}
      <div className="flex items-center gap-4 p-4 rounded-3xl bg-(--bg-card) dark:bg-[#1c1611] border-2 border-(--ln-gold) dark:border-[#8b6b4a] shadow-lg">
        <div className="flex-1 min-w-0">
          <p className="font-serif font-bold text-base text-(--tx-head)">Remove Duplicates</p>
          <p className="text-xs text-(--tx-soft) mt-0.5">Find churches added more than once and keep the best record</p>
          {dedupeResult && !deduping && (
            <p className="text-xs font-bold text-(--ac-bright-tx) mt-1">{dedupeResult}</p>
          )}
        </div>
        <button
          onClick={handleDedupe}
          disabled={deduping}
          className="px-5 py-2.5 rounded-xl bg-(--ac-bright) hover:opacity-90 text-white font-serif font-bold text-xs uppercase tracking-wider shadow-md transition-all cursor-pointer disabled:opacity-50 shrink-0"
        >
          {deduping ? 'Working' : 'Clean Up'}
        </button>
      </div>

{/* Navigation Tabs */}
      <div className="flex gap-2 border-b border-(--ln-bright)/20 pb-2">
        <button
          onClick={() => setActiveTab('users')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'users'
              ? 'bg-(--ac-bright) text-white shadow-md'
              : 'bg-(--bg-card-hi) text-(--tx-soft) hover:bg-(--bg-inset)'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>{t('adminTabUsers')} ({usersList.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('clergy')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'clergy'
              ? 'bg-(--ac-bright) text-white shadow-md'
              : 'bg-(--bg-card-hi) text-(--tx-soft) hover:bg-(--bg-inset)'
          }`}
        >
          <Shield className="w-4 h-4" />
          <span>{t('adminTabClergy')} ({usersList.filter((u) => u.role === 'clergy').length})</span>
        </button>

        <button
          onClick={() => setActiveTab('reports')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'reports'
              ? 'bg-(--ac-bright) text-white shadow-md'
              : 'bg-(--bg-card-hi) text-(--tx-soft) hover:bg-(--bg-inset)'
          }`}
        >
          <Flag className="w-4 h-4" />
          <span>{t('adminTabReports')} ({pendingCount})</span>
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'audit'
              ? 'bg-(--ac-bright) text-white shadow-md'
              : 'bg-(--bg-card-hi) text-(--tx-soft) hover:bg-(--bg-inset)'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>{t('adminTabAudit')} ({auditLogs.length})</span>
        </button>
      </div>

      {/* TAB 1: USER DIRECTORY & USER MANAGEMENT */}
      {activeTab === 'users' && (
        <div className="bg-(--bg-card-hi) border border-(--ln-bright)/30 rounded-2xl p-5 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <h3 className="font-serif font-bold text-lg text-(--tx-head) flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-(--ac-bright-tx)" />
              <span>{t('adminUserDirTitle')}</span>
            </h3>

            {/* Add Member Button */}
            <button
              onClick={() => setIsAddMemberOpen(true)}
              className="px-4 py-2 rounded-xl bg-(--ac-gold) hover:bg-(--ac-bronze) text-white font-serif font-bold text-xs uppercase tracking-wider shadow-md flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>{t('adminAddMember')}</span>
            </button>
          </div>

          {/* Search Filter Input */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-(--tx-soft)" />
            <input
              type="text"
              placeholder={t('adminSearchMembers')}
              value={userSearchQuery}
              onChange={(e) => setUserSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-(--bg-inset2) border border-(--ln-bright)/30 text-xs text-(--tx-head) placeholder-(--tx-soft)/70 focus:outline-none focus:border-(--ln-bright)"
            />
          </div>

          {renderUsersTable(filteredUsers, t('adminNoMatch'))}
        </div>
      )}
      {/* TAB: CLERGY DIRECTORY */}
      {activeTab === 'clergy' && (
        <div className="bg-(--bg-card-hi) border border-(--ln-bright)/30 rounded-2xl p-5 shadow-xl space-y-4">
          <h3 className="font-serif font-bold text-lg text-(--tx-head) flex items-center gap-2">
            <Shield className="w-5 h-5 text-(--ac-bright-tx)" />
            <span>{t('adminClergyDirTitle')} ({filteredClergy.length})</span>
          </h3>
          {renderUsersTable(filteredClergy, t('adminNoClergy'))}
        </div>
      )}

      {/* TAB 2: Content Moderation Reports Queue */}
      {activeTab === 'reports' && (
        <div className="bg-(--bg-card-hi) border border-(--ln-bright)/30 rounded-2xl p-5 shadow-xl space-y-4">
          <h3 className="font-serif font-bold text-lg text-(--tx-head) flex items-center gap-2">
            <Flag className="w-5 h-5 text-red-600" />
            <span>{t('adminReportsTitle')}</span>
          </h3>

          {reportsList.length === 0 ? (
            <div className="p-8 text-center text-xs text-(--tx-soft)">
              {t('adminNoFlagged')}
            </div>
          ) : (
            <div className="space-y-3">
              {reportsList.map((report) => (
                <div
                  key={report.id}
                  className={`p-4 rounded-2xl border shadow-md space-y-3 transition-all ${
                    report.status === 'pending'
                      ? 'bg-(--bg-inset) border-red-500/40'
                      : 'bg-(--bg-inset2) border-(--ln-bright)/20 opacity-75'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-full bg-red-600 text-white font-bold text-[10px] uppercase">
                        {report.targetType}
                      </span>
                      <span className="font-bold text-(--tx-head)">
                        {t('adminReason')}: {report.reason.replace('_', ' ')}
                      </span>
                    </div>
                    <span className="text-[10px] text-(--tx-soft)">
                      {t('adminReportedBy')} {report.reporterName} • {new Date(report.createdAt).toLocaleTimeString()}
                    </span>
                  </div>

                  {report.targetContentPreview && (
                    <div className="p-3 rounded-xl bg-white border border-(--ln-bright)/20 text-xs text-(--tx-body) italic">
                      "{report.targetContentPreview}"
                    </div>
                  )}

                  {report.details && (
                    <p className="text-xs text-(--tx-soft)">
                      <span className="font-bold text-(--tx-head)">{t('adminReporterNote')} </span>
                      {report.details}
                    </p>
                  )}

                  <div className="pt-2 border-t border-(--ln-bright)/20 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[11px] text-(--tx-soft)">
                      {t('adminAuthor')} <span className="font-bold text-(--tx-head)">{report.targetAuthorName || t('adminUnknownUser')}</span>
                    </span>

                    {report.status === 'pending' ? (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleDismissReport(report.id)}
                          className="px-3 py-1.5 rounded-xl bg-white border border-(--ln-bright)/30 text-(--tx-soft) hover:text-(--tx-head) font-bold text-xs shadow-sm transition-all cursor-pointer"
                        >{t('adminDismiss')}</button>

                        <button
                          onClick={() => handleRemoveContent(report)}
                          className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-sm transition-all cursor-pointer flex items-center gap-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>{t('adminRemoveContent')}</span>
                        </button>

                        <button
                          onClick={() => handleWarnUser(report)}
                          className="px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-sm transition-all cursor-pointer flex items-center gap-1"
                        >
                          <AlertOctagon className="w-3.5 h-3.5" />
                          <span>{t('adminWarnUser')}</span>
                        </button>
                      </div>
                    ) : (
                      <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold uppercase">
                        {t('adminStatus')} {report.status.replace('_', ' ')}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: Moderation Audit Log Trail */}
      {activeTab === 'audit' && (
        <div className="bg-(--bg-card-hi) border border-(--ln-bright)/30 rounded-2xl p-5 shadow-xl space-y-4">
          <h3 className="font-serif font-bold text-lg text-(--tx-head) flex items-center gap-2">
            <Clock className="w-5 h-5 text-(--ac-bright-tx)" />
            <span>{t('adminAuditTitle')}</span>
          </h3>

          <div className="space-y-2">
            {auditLogs.length === 0 ? (
              <div className="p-6 text-center text-xs text-(--tx-soft)">
                {t('adminNoLogs')}
              </div>
            ) : (
              auditLogs.map((log) => (
                <div
                  key={log.id}
                  className="p-3.5 rounded-xl bg-(--bg-inset2) border border-(--ln-bright)/20 flex items-center justify-between text-xs"
                >
                  <div>
                    <span className="font-bold text-(--tx-head)">{log.adminName} </span>
                    <span className="text-(--tx-soft)">{t('adminPerformed')} </span>
                    <span className="font-bold text-red-600 uppercase">[{log.action.replace('_', ' ')}] </span>
                    <p className="text-[11px] text-(--tx-faint) mt-0.5">{log.reason}</p>
                  </div>
                  <span className="text-[10px] text-(--tx-soft) shrink-0">
                    {new Date(log.createdAt).toLocaleString()}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* MODAL 1: ADD NEW MEMBER */}
      {isAddMemberOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#1c1611] border-2 border-(--ln-gold) rounded-2xl max-w-md w-full p-6 shadow-2xl text-[#f5ebd9] space-y-4 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between border-b border-(--ln-gold)/30 pb-3">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-(--ac-gold-tx)" />
                <h3 className="font-serif font-bold text-lg text-(--ac-gold-tx)">{t('adminAddMemberTitle')}</h3>
              </div>
              <button
                onClick={() => setIsAddMemberOpen(false)}
                className="p-1 rounded-lg hover:bg-[#282019] text-(--ac-gold-tx) transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddMemberSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-(--ac-gold-tx) font-bold mb-1 uppercase tracking-wider text-[10px]">
                  {t('adminFullName')}
                </label>
                <input
                  type="text"
                  required
                  placeholder={t('adminFullNamePh')}
                  value={newMemberForm.fullName}
                  onChange={(e) => setNewMemberForm({ ...newMemberForm, fullName: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-stone-900 border border-(--ln-gold)/30 text-[#f5ebd9] focus:outline-none focus:border-(--ln-gold)"
                />
              </div>

              <div>
                <label className="block text-(--ac-gold-tx) font-bold mb-1 uppercase tracking-wider text-[10px]">
                  {t('adminEmailAddress')}
                </label>
                <input
                  type="email"
                  required
                  placeholder={t('adminEmailPh')}
                  value={newMemberForm.email}
                  onChange={(e) => setNewMemberForm({ ...newMemberForm, email: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-stone-900 border border-(--ln-gold)/30 text-[#f5ebd9] focus:outline-none focus:border-(--ln-gold)"
                />
              </div>

              <div>
                <label className="block text-(--ac-gold-tx) font-bold mb-1 uppercase tracking-wider text-[10px]">
                  {t('adminParishLabel')}
                </label>
                <input
                  type="text"
                  placeholder={t('adminParishPh')}
                  value={newMemberForm.parish}
                  onChange={(e) => setNewMemberForm({ ...newMemberForm, parish: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-stone-900 border border-(--ln-gold)/30 text-[#f5ebd9] focus:outline-none focus:border-(--ln-gold)"
                />
              </div>

              <div>
                <label className="block text-(--ac-gold-tx) font-bold mb-1 uppercase tracking-wider text-[10px]">
                  {t('adminInitialRole')}
                </label>
                <select
                  value={newMemberForm.role}
                  onChange={(e) => setNewMemberForm({ ...newMemberForm, role: e.target.value as UserRole })}
                  className="w-full p-2.5 rounded-xl bg-stone-900 border border-(--ln-gold)/30 text-[#f5ebd9] font-bold focus:outline-none focus:border-(--ln-gold) cursor-pointer"
                >
                  <option value="user">{t('adminRoleMember')}</option>
                  <option value="clergy">{t('adminRoleClergy')}</option>
                  <option value="admin">{t('adminRoleAdmin')}</option>
                </select>
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsAddMemberOpen(false)}
                  className="px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-[#f5ebd9] font-bold transition-colors cursor-pointer"
                >{t('adminCancel')}</button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-(--ac-gold) hover:bg-(--ac-bronze) text-(--tx-ink) font-serif font-bold uppercase tracking-wider shadow-lg transition-colors cursor-pointer"
                >{t('adminCreateMember')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: DELETE USER CONFIRMATION */}
      {userToDelete && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#1c1611] border-2 border-red-500/60 rounded-2xl max-w-md w-full p-6 shadow-2xl text-[#f5ebd9] space-y-4 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center gap-3 text-red-500">
              <AlertOctagon className="w-7 h-7 shrink-0" />
              <div>
                <h3 className="font-serif font-bold text-lg text-white">{t('adminConfirmDelete')}</h3>
                <p className="text-[11px] text-red-400">{t('adminConfirmDeleteMsg')}</p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-stone-900 border border-red-500/30 text-xs space-y-1">
              <p>
                <span className="text-(--ac-gold-tx) font-bold">{t('adminName')} </span>
                {userToDelete.full_name}
              </p>
              <p>
                <span className="text-(--ac-gold-tx) font-bold">{t('adminEmail')} </span>
                {userToDelete.email}
              </p>
              <p>
                <span className="text-(--ac-gold-tx) font-bold">{t('adminParish')} </span>
                {userToDelete.parish}
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setUserToDelete(null)}
                className="px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-[#f5ebd9] font-bold transition-colors cursor-pointer text-xs"
              >{t('adminCancel')}</button>
              <button
                onClick={confirmDeleteUser}
                className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-serif font-bold text-xs uppercase tracking-wider shadow-lg transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>{t('adminRemoveMember')}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
