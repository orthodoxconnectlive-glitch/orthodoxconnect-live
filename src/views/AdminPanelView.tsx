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
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { UserProfile, UserRole, ContentReport, ModerationAuditLog } from '../types';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import {
  loadContentReports,
  updateReportStatus,
  warnUser,
  setUserBanStatus,
  loadAuditLogs,
  getUserModerationStatus,
} from '../utils/moderation';
import { deletePost } from '../utils/posts';

export const AdminPanelView: React.FC = () => {
  const { profile } = useAuth();
  const { t } = useTheme();

  const [activeTab, setActiveTab] = useState<'users' | 'reports' | 'audit'>('users');
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

  const isSuperAdmin = profile?.role === 'super_admin' || profile?.email === 'orthodoxconnect.live@gmail.com';
  const isAdminOrOwner = isSuperAdmin || profile?.role === 'admin' || profile?.role === 'owner';

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  useEffect(() => {
    if (isAdminOrOwner) {
      fetchAdminData();
    }
  }, [isAdminOrOwner]);

  const fetchAdminData = async () => {
    if (!isAdminOrOwner) return;

    // 1. Fetch exact total members count from Supabase
    try {
      const { count, error: countErr } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });

      if (!countErr && count !== null) {
        setTotalMembers(count > 0 ? count : (profile ? 1 : 0));
      }
    } catch (err) {
      console.warn('Supabase exact member count fetch warning:', err);
    }

    // 2. Fetch registered profiles
    let loadedUsers: UserProfile[] = [];
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data && data.length > 0) {
        loadedUsers = data.map((d: any) => ({
          id: d.id,
          email: d.email || 'member@orthodoxconnect.live',
          full_name: d.full_name || 'Orthodox Member',
          parish: d.parish || 'St. George Cathedral',
          role: (d.role as UserRole) || 'user',
          avatar_url: d.avatar_url,
          created_at: d.created_at || d.joined_at || new Date().toISOString(),
        }));
        setUsersList(loadedUsers);

        setTotalMembers((prevCount) => (prevCount > 0 ? prevCount : loadedUsers.length));
      } else {
        // Fallback or empty DB
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
          setTotalMembers((prev) => (prev > 0 ? prev : 1));
        }
      }
    } catch (err) {
      console.warn('Admin user list fetch error:', err);
    }

    // 3. Fetch moderation content reports
    const reports = await loadContentReports();
    setReportsList(reports);

    // 4. Fetch audit logs
    const logs = await loadAuditLogs();
    setAuditLogs(logs);

    // 5. Load user moderation status
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
      await supabase.from('profiles').update({ role: newRole }).eq('id', userId);
      showToast(`User role updated to ${newRole.toUpperCase()}`);
    } catch (err) {
      console.warn('Role update error:', err);
      showToast(`Role updated locally to ${newRole.toUpperCase()}`);
    }
  };

  // Delete User Confirmation & Handler
  const confirmDeleteUser = async () => {
    if (!userToDelete || !isAdminOrOwner) return;

    const targetId = userToDelete.id;
    const targetName = userToDelete.full_name;

    setUsersList((prev) => prev.filter((u) => u.id !== targetId));
    setTotalMembers((prev) => Math.max(0, prev - 1));

    try {
      await supabase.from('profiles').delete().eq('id', targetId);
      showToast(`Removed ${targetName} from parish directory.`);
    } catch (err) {
      console.warn('Delete profile error:', err);
      showToast(`Removed ${targetName} from local directory.`);
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
      showToast('Please provide full name and email address.');
      return;
    }

    const newId = `user_${Date.now()}`;
    const newMemberObj: UserProfile = {
      id: newId,
      email,
      full_name: name,
      parish,
      role,
      avatar_url: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200',
      created_at: new Date().toISOString(),
    };

    setUsersList((prev) => [newMemberObj, ...prev]);
    setTotalMembers((prev) => prev + 1);

    try {
      await supabase.from('profiles').insert([
        {
          id: newId,
          email,
          full_name: name,
          parish,
          role,
          avatar_url: newMemberObj.avatar_url,
          created_at: newMemberObj.created_at,
        },
      ]);
      showToast(`Added ${name} to parish directory.`);
    } catch (err) {
      console.warn('Add member DB notice:', err);
      showToast(`Added ${name} to parish directory.`);
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
      await deletePost(report.targetId);
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
      <div className="p-8 text-center bg-[#fdfaf5] rounded-2xl border border-red-500/40 text-red-700 shadow-xl space-y-2">
        <AlertTriangle className="w-10 h-10 mx-auto text-red-600" />
        <h3 className="font-serif font-bold text-lg">Access Restricted</h3>
        <p className="text-xs text-[#8b6b4a]">
          Super Admin, Admin, or Owner privileges are required to access the Moderation & Management Panel.
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

  return (
    <div className="space-y-6 relative">
      {/* Toast Feedback Banner */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-2.5 rounded-2xl bg-[#1c1611] border border-[#c5a059] text-[#f5ebd9] font-serif font-bold text-xs shadow-2xl flex items-center gap-2 animate-bounce">
          <CheckCircle className="w-4 h-4 text-[#c5a059]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-[#f1ebd7] via-[#fdfaf5] to-[#f1ebd7] border border-[#d4af37]/30 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-[#d4af37] text-white flex items-center justify-center shadow-md">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h2 className="font-serif font-bold text-2xl text-[#5a4632]">
              Admin & Content Moderation Panel
            </h2>
            <p className="text-xs text-[#8b6b4a]">
              Manage registered parishioners, assign clergy roles, review reports, and audit system activity
            </p>
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-[#fdfaf5] border border-[#d4af37]/30 shadow-lg flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-[#d4af37]/20 border border-[#d4af37]/40 flex items-center justify-center text-[#d4af37]">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[11px] text-[#8b6b4a] uppercase font-bold tracking-wider">
              Total Members
            </p>
            <h3 className="font-serif font-bold text-2xl text-[#5a4632]">
              {totalMembers}
            </h3>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-[#fdfaf5] border border-[#d4af37]/30 shadow-lg flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-100 border border-purple-300 flex items-center justify-center text-purple-700">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[11px] text-[#8b6b4a] uppercase font-bold tracking-wider">
              Admins & Clergy
            </p>
            <h3 className="font-serif font-bold text-2xl text-[#5a4632]">
              {usersList.filter((u) => u.role === 'admin' || u.role === 'clergy' || u.role === 'owner' || u.role === 'super_admin').length}
            </h3>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-[#fdfaf5] border border-[#d4af37]/30 shadow-lg flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-red-100 border border-red-300 flex items-center justify-center text-red-600">
            <Flag className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[11px] text-[#8b6b4a] uppercase font-bold tracking-wider">
              Pending Reports
            </p>
            <h3 className="font-serif font-bold text-2xl text-[#5a4632]">
              {pendingCount}
            </h3>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex gap-2 border-b border-[#d4af37]/20 pb-2">
        <button
          onClick={() => setActiveTab('users')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'users'
              ? 'bg-[#d4af37] text-white shadow-md'
              : 'bg-[#fdfaf5] text-[#8b6b4a] hover:bg-[#f1ebd7]'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>User Directory & Roles ({usersList.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('reports')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'reports'
              ? 'bg-[#d4af37] text-white shadow-md'
              : 'bg-[#fdfaf5] text-[#8b6b4a] hover:bg-[#f1ebd7]'
          }`}
        >
          <Flag className="w-4 h-4" />
          <span>Content Reports Queue ({pendingCount})</span>
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'audit'
              ? 'bg-[#d4af37] text-white shadow-md'
              : 'bg-[#fdfaf5] text-[#8b6b4a] hover:bg-[#f1ebd7]'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Moderation Audit Log ({auditLogs.length})</span>
        </button>
      </div>

      {/* TAB 1: USER DIRECTORY & USER MANAGEMENT */}
      {activeTab === 'users' && (
        <div className="bg-[#fdfaf5] border border-[#d4af37]/30 rounded-2xl p-5 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <h3 className="font-serif font-bold text-lg text-[#5a4632] flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-[#d4af37]" />
              <span>Parish User Directory & Management</span>
            </h3>

            {/* Add Member Button */}
            <button
              onClick={() => setIsAddMemberOpen(true)}
              className="px-4 py-2 rounded-xl bg-[#c5a059] hover:bg-[#a8833c] text-white font-serif font-bold text-xs uppercase tracking-wider shadow-md flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>Add Member</span>
            </button>
          </div>

          {/* Search Filter Input */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-[#8b6b4a]" />
            <input
              type="text"
              placeholder="Search members by name, email, or parish..."
              value={userSearchQuery}
              onChange={(e) => setUserSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-[#f5f2ed] border border-[#d4af37]/30 text-xs text-[#5a4632] placeholder-[#8b6b4a]/70 focus:outline-none focus:border-[#d4af37]"
            />
          </div>

          {/* Users Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#d4af37]/30 text-[#8b6b4a] uppercase font-bold text-[10px]">
                  <th className="py-3 px-3">Member</th>
                  <th className="py-3 px-3">Email</th>
                  <th className="py-3 px-3">Parish</th>
                  <th className="py-3 px-3">Role</th>
                  <th className="py-3 px-3">Joined Date</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#d4af37]/20">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-[#8b6b4a]">
                      No registered parishioners match your search query.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => {
                    const status = userStatuses[user.id] || { warningCount: 0, isBanned: false };
                    const isProtected =
                      user.role === 'owner' ||
                      user.role === 'super_admin' ||
                      user.email === 'orthodoxconnect.live@gmail.com';

                    return (
                      <tr key={user.id} className="hover:bg-[#f1ebd7]/50 transition-colors">
                        {/* Member Name & Avatar */}
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2.5">
                            <img
                              src={
                                user.avatar_url ||
                                'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200'
                              }
                              alt={user.full_name}
                              className="w-8 h-8 rounded-full object-cover border border-[#d4af37]/40"
                            />
                            <div>
                              <p className="font-bold text-[#5a4632]">{user.full_name}</p>
                            </div>
                          </div>
                        </td>

                        {/* Email Address - strictly guarded for Admins */}
                        <td className="py-3 px-3 text-[#5a4632] font-mono text-[11px]">
                          {isAdminOrOwner ? user.email : '••••@••••.com'}
                        </td>

                        {/* Parish */}
                        <td className="py-3 px-3 text-[#4a3e31] font-medium">
                          {user.parish}
                        </td>

                        {/* Role Badge & Change Role Dropdown */}
                        <td className="py-3 px-3">
                          {isProtected ? (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-[#c5a059] text-white border border-[#a8833c] shadow-sm">
                              {user.email === 'orthodoxconnect.live@gmail.com' ? 'SUPER ADMIN' : user.role.toUpperCase()}
                            </span>
                          ) : (
                            <select
                              value={user.role}
                              onChange={(e) => handleRoleChange(user.id, e.target.value as UserRole)}
                              className="px-2 py-1 rounded-lg bg-white border border-[#d4af37]/40 text-[#5a4632] font-bold text-[11px] focus:outline-none focus:border-[#d4af37] cursor-pointer"
                            >
                              <option value="user">Member</option>
                              <option value="clergy">Clergy</option>
                              <option value="admin">Admin</option>
                            </select>
                          )}
                        </td>

                        {/* Joined Date */}
                        <td className="py-3 px-3 text-[#8b6b4a] text-[11px]">
                          {user.created_at ? new Date(user.created_at).toLocaleDateString() : 'Active'}
                        </td>

                        {/* Status */}
                        <td className="py-3 px-3">
                          {status.isBanned ? (
                            <span className="px-2 py-0.5 rounded-full bg-red-600 text-white text-[10px] font-bold uppercase">
                              Banned
                            </span>
                          ) : (
                            <span className="text-xs text-[#8b6b4a] font-semibold">
                              {status.warningCount > 0 ? (
                                <span className="text-red-600 font-bold">{status.warningCount} Warnings</span>
                              ) : (
                                'Good Standing'
                              )}
                            </span>
                          )}
                        </td>

                        {/* Action Buttons */}
                        <td className="py-3 px-3 text-right flex items-center justify-end gap-2">
                          {!isProtected ? (
                            <>
                              <button
                                onClick={() => handleBanUser(user.id, !status.isBanned)}
                                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase transition-all cursor-pointer ${
                                  status.isBanned
                                    ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                                    : 'bg-amber-600 text-white hover:bg-amber-700'
                                }`}
                              >
                                {status.isBanned ? 'Unban' : 'Ban'}
                              </button>

                              <button
                                onClick={() => setUserToDelete(user)}
                                className="px-2.5 py-1 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold text-[10px] uppercase shadow-sm transition-all cursor-pointer flex items-center gap-1"
                                title="Remove / Delete User"
                              >
                                <Trash2 className="w-3 h-3" />
                                <span>Delete User</span>
                              </button>
                            </>
                          ) : (
                            <span className="text-[10px] text-[#a8833c] font-serif font-bold uppercase italic">
                              Protected System User
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: Content Moderation Reports Queue */}
      {activeTab === 'reports' && (
        <div className="bg-[#fdfaf5] border border-[#d4af37]/30 rounded-2xl p-5 shadow-xl space-y-4">
          <h3 className="font-serif font-bold text-lg text-[#5a4632] flex items-center gap-2">
            <Flag className="w-5 h-5 text-red-600" />
            <span>Reported Content Review Queue</span>
          </h3>

          {reportsList.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#8b6b4a]">
              No flagged content. Community feed is clean!
            </div>
          ) : (
            <div className="space-y-3">
              {reportsList.map((report) => (
                <div
                  key={report.id}
                  className={`p-4 rounded-2xl border shadow-md space-y-3 transition-all ${
                    report.status === 'pending'
                      ? 'bg-[#f1ebd7] border-red-500/40'
                      : 'bg-[#f5f2ed] border-[#d4af37]/20 opacity-75'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-full bg-red-600 text-white font-bold text-[10px] uppercase">
                        {report.targetType}
                      </span>
                      <span className="font-bold text-[#5a4632]">
                        Reason: {report.reason.replace('_', ' ')}
                      </span>
                    </div>
                    <span className="text-[10px] text-[#8b6b4a]">
                      Reported by {report.reporterName} • {new Date(report.createdAt).toLocaleTimeString()}
                    </span>
                  </div>

                  {report.targetContentPreview && (
                    <div className="p-3 rounded-xl bg-white border border-[#d4af37]/20 text-xs text-[#2c2c2c] italic">
                      "{report.targetContentPreview}"
                    </div>
                  )}

                  {report.details && (
                    <p className="text-xs text-[#8b6b4a]">
                      <span className="font-bold text-[#5a4632]">Reporter Note: </span>
                      {report.details}
                    </p>
                  )}

                  <div className="pt-2 border-t border-[#d4af37]/20 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[11px] text-[#8b6b4a]">
                      Author: <span className="font-bold text-[#5a4632]">{report.targetAuthorName || 'Unknown User'}</span>
                    </span>

                    {report.status === 'pending' ? (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleDismissReport(report.id)}
                          className="px-3 py-1.5 rounded-xl bg-white border border-[#d4af37]/30 text-[#8b6b4a] hover:text-[#5a4632] font-bold text-xs shadow-sm transition-all cursor-pointer"
                        >
                          Dismiss
                        </button>

                        <button
                          onClick={() => handleRemoveContent(report)}
                          className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-sm transition-all cursor-pointer flex items-center gap-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Remove Content</span>
                        </button>

                        <button
                          onClick={() => handleWarnUser(report)}
                          className="px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-sm transition-all cursor-pointer flex items-center gap-1"
                        >
                          <AlertOctagon className="w-3.5 h-3.5" />
                          <span>Warn User</span>
                        </button>
                      </div>
                    ) : (
                      <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold uppercase">
                        Status: {report.status.replace('_', ' ')}
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
        <div className="bg-[#fdfaf5] border border-[#d4af37]/30 rounded-2xl p-5 shadow-xl space-y-4">
          <h3 className="font-serif font-bold text-lg text-[#5a4632] flex items-center gap-2">
            <Clock className="w-5 h-5 text-[#d4af37]" />
            <span>Moderation Audit Trail Log</span>
          </h3>

          <div className="space-y-2">
            {auditLogs.length === 0 ? (
              <div className="p-6 text-center text-xs text-[#8b6b4a]">
                No moderation logs recorded yet.
              </div>
            ) : (
              auditLogs.map((log) => (
                <div
                  key={log.id}
                  className="p-3.5 rounded-xl bg-[#f5f2ed] border border-[#d4af37]/20 flex items-center justify-between text-xs"
                >
                  <div>
                    <span className="font-bold text-[#5a4632]">{log.adminName} </span>
                    <span className="text-[#8b6b4a]">performed </span>
                    <span className="font-bold text-red-600 uppercase">[{log.action.replace('_', ' ')}] </span>
                    <p className="text-[11px] text-[#4a3e31] mt-0.5">{log.reason}</p>
                  </div>
                  <span className="text-[10px] text-[#8b6b4a] shrink-0">
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
          <div className="bg-[#1c1611] border-2 border-[#c5a059] rounded-2xl max-w-md w-full p-6 shadow-2xl text-[#f5ebd9] space-y-4 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between border-b border-[#c5a059]/30 pb-3">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-[#c5a059]" />
                <h3 className="font-serif font-bold text-lg text-[#c5a059]">Add New Parish Member</h3>
              </div>
              <button
                onClick={() => setIsAddMemberOpen(false)}
                className="p-1 rounded-lg hover:bg-[#282019] text-[#c5a059] transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddMemberSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-[#c5a059] font-bold mb-1 uppercase tracking-wider text-[10px]">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Deacon Nicholas"
                  value={newMemberForm.fullName}
                  onChange={(e) => setNewMemberForm({ ...newMemberForm, fullName: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-stone-900 border border-[#c5a059]/30 text-[#f5ebd9] focus:outline-none focus:border-[#c5a059]"
                />
              </div>

              <div>
                <label className="block text-[#c5a059] font-bold mb-1 uppercase tracking-wider text-[10px]">
                  Email Address *
                </label>
                <input
                  type="email"
                  required
                  placeholder="e.g. nicholas@orthodoxparish.org"
                  value={newMemberForm.email}
                  onChange={(e) => setNewMemberForm({ ...newMemberForm, email: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-stone-900 border border-[#c5a059]/30 text-[#f5ebd9] focus:outline-none focus:border-[#c5a059]"
                />
              </div>

              <div>
                <label className="block text-[#c5a059] font-bold mb-1 uppercase tracking-wider text-[10px]">
                  Parish / Monastery
                </label>
                <input
                  type="text"
                  placeholder="e.g. St. George Cathedral"
                  value={newMemberForm.parish}
                  onChange={(e) => setNewMemberForm({ ...newMemberForm, parish: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-stone-900 border border-[#c5a059]/30 text-[#f5ebd9] focus:outline-none focus:border-[#c5a059]"
                />
              </div>

              <div>
                <label className="block text-[#c5a059] font-bold mb-1 uppercase tracking-wider text-[10px]">
                  Initial Role
                </label>
                <select
                  value={newMemberForm.role}
                  onChange={(e) => setNewMemberForm({ ...newMemberForm, role: e.target.value as UserRole })}
                  className="w-full p-2.5 rounded-xl bg-stone-900 border border-[#c5a059]/30 text-[#f5ebd9] font-bold focus:outline-none focus:border-[#c5a059] cursor-pointer"
                >
                  <option value="user">Member</option>
                  <option value="clergy">Clergy</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsAddMemberOpen(false)}
                  className="px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-[#f5ebd9] font-bold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#c5a059] hover:bg-[#a8833c] text-[#1c1611] font-serif font-bold uppercase tracking-wider shadow-lg transition-colors cursor-pointer"
                >
                  Create Member
                </button>
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
                <h3 className="font-serif font-bold text-lg text-white">Confirm User Deletion</h3>
                <p className="text-[11px] text-red-400">This action will remove the member profile from the parish network.</p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-stone-900 border border-red-500/30 text-xs space-y-1">
              <p>
                <span className="text-[#c5a059] font-bold">Name: </span>
                {userToDelete.full_name}
              </p>
              <p>
                <span className="text-[#c5a059] font-bold">Email: </span>
                {userToDelete.email}
              </p>
              <p>
                <span className="text-[#c5a059] font-bold">Parish: </span>
                {userToDelete.parish}
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setUserToDelete(null)}
                className="px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-[#f5ebd9] font-bold transition-colors cursor-pointer text-xs"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteUser}
                className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-serif font-bold text-xs uppercase tracking-wider shadow-lg transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>Remove Member</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
