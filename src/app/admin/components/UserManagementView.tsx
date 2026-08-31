'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  Search,
  ShieldCheck,
  Crown,
  UserCheck,
  UserX,
  RefreshCw,
  Calendar,
  Mail,
  User as UserIcon,
  Shield,
  Sparkles,
  Trash2,
  AlertTriangle,
  X,
  Copy,
  Check,
  ChevronLeft,
  ChevronRight,
  CheckSquare,
  Square,
  MinusSquare,
} from 'lucide-react';
import { UserRole } from '@/lib/mongodb/userService';

interface ManagedUser {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  avatar?: string;
  createdAt: number;
}

interface UserManagementViewProps {
  currentUserId?: string;
  currentUserRole?: 'owner' | 'admin' | 'member';
  onShowToast: (message: string, type?: 'success' | 'error') => void;
}

export const UserManagementView: React.FC<UserManagementViewProps> = ({
  currentUserId,
  currentUserRole = 'member',
  onShowToast,
}) => {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [deletingUser, setDeletingUser] = useState<ManagedUser | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Multi-select state
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [isBatchDeleting, setIsBatchDeleting] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/users');
      const data = await res.json();
      if (res.ok && data.success) {
        setUsers(data.users || []);
        setSelectedUserIds([]);
      } else {
        onShowToast(data.message || 'Gagal memuat data pengguna', 'error');
      }
    } catch (err: any) {
      console.error('Fetch users error:', err);
      onShowToast('Terjadi kesalahan jaringan saat memuat pengguna', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleRoleChange = async (targetUser: ManagedUser, newRole: 'admin' | 'member') => {
    if (currentUserRole !== 'owner') {
      onShowToast('Hanya Owner yang memiliki izin untuk mengubah Role pengguna', 'error');
      return;
    }

    setUpdatingId(targetUser.id);
    try {
      const res = await fetch(`/api/admin/users/${targetUser.id}/role`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setUsers((prev) =>
          prev.map((u) => (u.id === targetUser.id ? { ...u, role: newRole } : u))
        );
        onShowToast(`Berhasil mengubah role @${targetUser.username} menjadi ${newRole.toUpperCase()}`, 'success');
      } else {
        onShowToast(data.message || 'Gagal mengubah role', 'error');
      }
    } catch (err: any) {
      console.error('Update role error:', err);
      onShowToast('Terjadi kesalahan saat mengubah role pengguna', 'error');
    } finally {
      setUpdatingId(null);
    }
  };

  // Single Delete
  const handleConfirmDelete = async () => {
    if (!deletingUser) return;
    if (currentUserRole !== 'owner') {
      onShowToast('Hanya Owner yang memiliki izin untuk menghapus akun pengguna', 'error');
      return;
    }

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/admin/users/${deletingUser.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setUsers((prev) => prev.filter((u) => u.id !== deletingUser.id));
        setSelectedUserIds((prev) => prev.filter((id) => id !== deletingUser.id));
        onShowToast(data.message || `Akun @${deletingUser.username} berhasil dihapus permanen`, 'success');
        setDeletingUser(null);
      } else {
        onShowToast(data.message || 'Gagal menghapus akun pengguna', 'error');
      }
    } catch (err: any) {
      console.error('Delete user error:', err);
      onShowToast('Terjadi kesalahan saat menghapus akun pengguna', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  // Batch Delete
  const handleConfirmBatchDelete = async () => {
    if (selectedUserIds.length === 0) return;
    if (currentUserRole !== 'owner') {
      onShowToast('Hanya Owner yang memiliki izin untuk menghapus akun pengguna', 'error');
      return;
    }

    setIsBatchDeleting(true);
    try {
      const res = await fetch('/api/admin/users/batch-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userIds: selectedUserIds }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        const deletedSet = new Set(selectedUserIds);
        setUsers((prev) => prev.filter((u) => !deletedSet.has(u.id)));
        setSelectedUserIds([]);
        onShowToast(data.message || 'Akun terpilih berhasil dihapus permanen', 'success');
        setIsBatchModalOpen(false);
      } else {
        onShowToast(data.message || 'Gagal menghapus beberapa akun pengguna', 'error');
      }
    } catch (err: any) {
      console.error('Batch delete error:', err);
      onShowToast('Terjadi kesalahan saat menghapus beberapa akun', 'error');
    } finally {
      setIsBatchDeleting(false);
    }
  };

  const handleCopyId = (id: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(id);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
      onShowToast('ID Pengguna disalin ke clipboard', 'success');
    }
  };

  // Filtered & Sorted Users
  const filteredUsers = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const result = users.filter((u) => {
      if (!q) return true;
      return (
        u.username.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q) ||
        u.id.toLowerCase().includes(q)
      );
    });

    // Role priority: Owner = 0, Admin = 1, Member = 2
    const rolePriority: Record<UserRole, number> = {
      owner: 0,
      admin: 1,
      member: 2,
    };

    return result.sort((a, b) => {
      const diff = (rolePriority[a.role] ?? 99) - (rolePriority[b.role] ?? 99);
      if (diff !== 0) return diff;
      return b.createdAt - a.createdAt;
    });
  }, [users, searchQuery]);

  // Reset pagination on search change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, itemsPerPage]);

  // Pagination calculations
  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / itemsPerPage));
  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredUsers.slice(start, start + itemsPerPage);
  }, [filteredUsers, currentPage, itemsPerPage]);

  // Non-owner selectable users
  const selectableUsers = useMemo(() => {
    return filteredUsers.filter((u) => u.role !== 'owner');
  }, [filteredUsers]);

  const isAllSelectableSelected =
    selectableUsers.length > 0 &&
    selectableUsers.every((u) => selectedUserIds.includes(u.id));

  const isSomeSelectableSelected =
    selectedUserIds.length > 0 && !isAllSelectableSelected;

  const toggleSelectAll = () => {
    if (isAllSelectableSelected) {
      setSelectedUserIds([]);
    } else {
      setSelectedUserIds(selectableUsers.map((u) => u.id));
    }
  };

  const toggleSelectUser = (id: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const totalAdmins = users.filter((u) => u.role === 'admin').length;
  const totalOwners = users.filter((u) => u.role === 'owner').length;
  const totalMembers = users.filter((u) => u.role === 'member').length;

  return (
    <div className="space-y-6">
      {/* ── Top Overview Banner ── */}
      <div className="p-4 sm:p-6 rounded-3xl bg-gradient-to-br from-[#0b122c] via-[#090e24] to-[#060814] border border-cyan-500/20 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-bold mb-2">
            <Shield size={13} />
            <span>Hak Akses & Otoritas</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            Manajemen Pengguna & Role
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 max-w-xl">
            Kelola hak akses dan akun pengguna. Posisi Owner dan Admin selalu berada di paling atas. Gunakan fitur multi-select dan pagination untuk mengelola akun dalam jumlah banyak.
          </p>
        </div>

        {/* Stats Counters */}
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <div className="px-3.5 py-2 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-center min-w-[80px]">
            <p className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">Owner</p>
            <p className="text-base sm:text-lg font-black text-amber-300">{totalOwners}</p>
          </div>
          <div className="px-3.5 py-2 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-center min-w-[80px]">
            <p className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider">Admin</p>
            <p className="text-base sm:text-lg font-black text-cyan-300">{totalAdmins}</p>
          </div>
          <div className="px-3.5 py-2 rounded-2xl bg-purple-500/10 border border-purple-500/30 text-center min-w-[80px]">
            <p className="text-[10px] font-bold text-purple-400 uppercase tracking-wider">Member</p>
            <p className="text-base sm:text-lg font-black text-purple-300">{totalMembers}</p>
          </div>
        </div>
      </div>

      {/* ── Search, Multi-Select & Refresh Bar ── */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari username, email, ID, atau role..."
            className="w-full pl-10 pr-4 py-2.5 bg-[#090e1f] border border-white/10 rounded-2xl text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-all"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Multi-Select Select All Toggle (Owner only) */}
          {currentUserRole === 'owner' && selectableUsers.length > 0 && (
            <button
              type="button"
              onClick={toggleSelectAll}
              className="px-3.5 py-2.5 rounded-2xl bg-white/[0.05] hover:bg-white/[0.1] text-slate-300 font-bold text-xs border border-white/10 transition-all flex items-center gap-2 active:scale-95"
            >
              {isAllSelectableSelected ? (
                <CheckSquare size={15} className="text-cyan-400" />
              ) : isSomeSelectableSelected ? (
                <MinusSquare size={15} className="text-cyan-400" />
              ) : (
                <Square size={15} className="text-slate-400" />
              )}
              <span>{isAllSelectableSelected ? 'Batal Pilih Semua' : 'Pilih Semua Akun'}</span>
            </button>
          )}

          {/* Items per page selector */}
          <div className="flex items-center gap-1.5 px-3 py-2 bg-[#090e1f] border border-white/10 rounded-2xl text-xs text-slate-400">
            <span>Tampilkan:</span>
            <select
              value={itemsPerPage}
              onChange={(e) => setItemsPerPage(Number(e.target.value))}
              className="bg-black/50 text-white font-bold rounded-lg px-2 py-0.5 border border-white/10 focus:outline-none focus:border-cyan-500"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
          </div>

          <button
            type="button"
            onClick={fetchUsers}
            disabled={loading}
            className="px-4 py-2.5 rounded-2xl bg-white/[0.05] hover:bg-white/[0.1] text-slate-300 font-bold text-xs border border-white/10 transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin text-cyan-400' : ''} />
            <span>Segarkan Data</span>
          </button>
        </div>
      </div>

      {/* ── Sticky Batch Action Bar when users are selected ── */}
      {selectedUserIds.length > 0 && currentUserRole === 'owner' && (
        <div className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r from-red-950/60 via-purple-950/50 to-black/70 border border-red-500/40 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-in">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-red-500/20 text-red-400 border border-red-500/30">
              <CheckSquare size={16} />
            </div>
            <div>
              <span className="font-extrabold text-sm text-white block">
                {selectedUserIds.length} Pengguna Dipilih
              </span>
              <span className="text-xs text-slate-400">
                Pilih tindakan batch untuk akun yang ditandai.
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              type="button"
              onClick={() => setSelectedUserIds([])}
              className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-all"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={() => setIsBatchModalOpen(true)}
              className="px-4 py-2 rounded-xl text-xs font-black bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/30 flex items-center gap-1.5 transition-all active:scale-95"
            >
              <Trash2 size={14} />
              <span>Hapus {selectedUserIds.length} Akun Terpilih</span>
            </button>
          </div>
        </div>
      )}

      {/* ── Users Content ── */}
      {loading ? (
        <div className="py-20 text-center text-slate-400">
          <RefreshCw size={28} className="animate-spin mx-auto mb-3 text-cyan-400" />
          <p className="text-xs font-semibold">Memuat daftar pengguna...</p>
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="p-12 rounded-3xl bg-[#090e1f] border border-white/10 text-center">
          <Users size={36} className="mx-auto text-slate-600 mb-3" />
          <h3 className="text-base font-bold text-white mb-1">Pengguna Tidak Ditemukan</h3>
          <p className="text-xs text-slate-400">
            {searchQuery
              ? `Tidak ada pengguna dengan kata kunci "${searchQuery}".`
              : 'Belum ada pengguna yang terdaftar di database.'}
          </p>
        </div>
      ) : (
        <>
          {/* ── Mobile & Small Screen Cards Layout (block lg:hidden) ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 lg:hidden">
            {paginatedUsers.map((u) => {
              const isOwnerUser = u.role === 'owner';
              const isAdminUser = u.role === 'admin';
              const isCurrent = u.id === currentUserId;
              const isUpdating = updatingId === u.id;
              const isSelected = selectedUserIds.includes(u.id);

              return (
                <div
                  key={u.id}
                  className={`p-4 rounded-2xl bg-[#090e1f] border space-y-3 shadow-lg transition-all ${
                    isSelected
                      ? 'border-cyan-500/60 bg-cyan-950/20'
                      : 'border-white/10 hover:border-cyan-500/30'
                  }`}
                >
                  {/* Top user row */}
                  <div className="flex items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {/* Checkbox for batch select (non-owner only) */}
                      {currentUserRole === 'owner' && (
                        <button
                          type="button"
                          disabled={isOwnerUser}
                          onClick={() => toggleSelectUser(u.id)}
                          className={`p-1 rounded-lg transition-colors flex-shrink-0 ${
                            isOwnerUser
                              ? 'opacity-30 cursor-not-allowed text-slate-600'
                              : isSelected
                              ? 'text-cyan-400 hover:text-cyan-300'
                              : 'text-slate-500 hover:text-white'
                          }`}
                          title={isOwnerUser ? 'Akun Owner tidak dapat dipilih' : 'Pilih akun'}
                        >
                          {isSelected ? <CheckSquare size={18} /> : <Square size={18} />}
                        </button>
                      )}

                      <div className="w-10 h-10 rounded-xl overflow-hidden bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center flex-shrink-0 border border-white/10">
                        <img
                          src={u.avatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(u.username)}`}
                          alt={u.username}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className="font-extrabold text-white text-sm capitalize truncate">
                            {u.username}
                          </h4>
                          {isCurrent && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                              Anda
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 truncate mt-0.5">
                          {u.email}
                        </p>
                      </div>
                    </div>

                    {/* Role Badge */}
                    <div className="flex-shrink-0">
                      {isOwnerUser ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-500/20 border border-amber-500/40 text-amber-300 shadow-[0_0_8px_rgba(245,158,11,0.25)]">
                          <Crown size={10} className="text-amber-400 fill-amber-400" />
                          <span>OWNER</span>
                        </span>
                      ) : isAdminUser ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 shadow-[0_0_8px_rgba(6,182,212,0.25)]">
                          <ShieldCheck size={10} className="text-cyan-400" />
                          <span>ADMIN</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/5 border border-white/10 text-slate-300">
                          <Sparkles size={9} className="text-purple-400" />
                          <span>MEMBER</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* ID & Date Info Row */}
                  <div className="p-2.5 rounded-xl bg-black/40 border border-white/5 space-y-1.5 text-[11px]">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-slate-500 font-semibold flex items-center gap-1">
                        ID:
                      </span>
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="font-mono text-slate-300 truncate select-all">
                          {u.id}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopyId(u.id)}
                          className="text-slate-400 hover:text-cyan-300 p-0.5 transition-colors flex-shrink-0"
                          title="Salin ID"
                        >
                          {copiedId === u.id ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-slate-400">
                      <span className="flex items-center gap-1">
                        <Calendar size={11} className="text-slate-500" /> Bergabung:
                      </span>
                      <span className="font-medium text-slate-300">
                        {new Date(u.createdAt).toLocaleDateString('id-ID', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                    </div>
                  </div>

                  {/* Action Buttons for Mobile */}
                  {currentUserRole === 'owner' && !isOwnerUser && (
                    <div className="flex items-center gap-2 pt-1">
                      {isAdminUser ? (
                        <button
                          type="button"
                          disabled={isUpdating}
                          onClick={() => handleRoleChange(u, 'member')}
                          className="flex-1 px-3 py-2 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 font-bold text-xs border border-purple-500/40 transition-all flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50 min-h-[36px]"
                        >
                          {isUpdating ? <RefreshCw size={12} className="animate-spin" /> : <UserX size={12} />}
                          <span>Jadikan Member</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={isUpdating}
                          onClick={() => handleRoleChange(u, 'admin')}
                          className="flex-1 px-3 py-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 font-bold text-xs border border-cyan-500/40 transition-all flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50 min-h-[36px]"
                        >
                          {isUpdating ? <RefreshCw size={12} className="animate-spin" /> : <UserCheck size={12} />}
                          <span>Jadikan Admin</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => setDeletingUser(u)}
                        className="px-3 py-2 rounded-xl bg-red-500/15 hover:bg-red-500/25 text-red-400 hover:text-red-300 font-bold text-xs border border-red-500/30 transition-all flex items-center justify-center gap-1.5 active:scale-95 min-h-[36px]"
                        title="Hapus Akun"
                      >
                        <Trash2 size={13} />
                        <span>Hapus</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* ── Desktop Table Layout (hidden lg:block) ── */}
          <div className="hidden lg:block rounded-3xl bg-[#090e1f] border border-white/10 overflow-hidden shadow-2xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/10 bg-white/[0.02] text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                    {currentUserRole === 'owner' && (
                      <th className="py-3.5 px-4 w-12 text-center">
                        <button
                          type="button"
                          onClick={toggleSelectAll}
                          className="text-slate-400 hover:text-white transition-colors"
                          title={isAllSelectableSelected ? 'Batal Pilih Semua' : 'Pilih Semua'}
                        >
                          {isAllSelectableSelected ? (
                            <CheckSquare size={16} className="text-cyan-400" />
                          ) : isSomeSelectableSelected ? (
                            <MinusSquare size={16} className="text-cyan-400" />
                          ) : (
                            <Square size={16} />
                          )}
                        </button>
                      </th>
                    )}
                    <th className="py-3.5 px-6">Pengguna</th>
                    <th className="py-3.5 px-6">Email</th>
                    <th className="py-3.5 px-6">Tanggal Daftar</th>
                    <th className="py-3.5 px-6">Role</th>
                    <th className="py-3.5 px-6 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-sm">
                  {paginatedUsers.map((u) => {
                    const isOwnerUser = u.role === 'owner';
                    const isAdminUser = u.role === 'admin';
                    const isCurrent = u.id === currentUserId;
                    const isUpdating = updatingId === u.id;
                    const isSelected = selectedUserIds.includes(u.id);

                    return (
                      <tr
                        key={u.id}
                        className={`transition-colors duration-150 ${
                          isSelected ? 'bg-cyan-950/20' : 'hover:bg-white/[0.02]'
                        }`}
                      >
                        {/* Checkbox column */}
                        {currentUserRole === 'owner' && (
                          <td className="py-3.5 px-4 text-center">
                            <button
                              type="button"
                              disabled={isOwnerUser}
                              onClick={() => toggleSelectUser(u.id)}
                              className={`transition-colors ${
                                isOwnerUser
                                  ? 'opacity-25 cursor-not-allowed text-slate-600'
                                  : isSelected
                                  ? 'text-cyan-400 hover:text-cyan-300'
                                  : 'text-slate-500 hover:text-white'
                              }`}
                              title={isOwnerUser ? 'Akun Owner tidak dapat dipilih' : 'Pilih akun'}
                            >
                              {isSelected ? <CheckSquare size={16} /> : <Square size={16} />}
                            </button>
                          </td>
                        )}

                        {/* User Info */}
                        <td className="py-3.5 px-6">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl overflow-hidden bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center flex-shrink-0 border border-white/10">
                              <img
                                src={u.avatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(u.username)}`}
                                alt={u.username}
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-extrabold text-white capitalize">{u.username}</span>
                                {isCurrent && (
                                  <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                                    Anda
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="text-[11px] text-slate-500 font-mono">
                                  ID: {u.id.substring(0, 10)}...
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleCopyId(u.id)}
                                  className="text-slate-500 hover:text-cyan-300 transition-colors"
                                  title="Salin ID"
                                >
                                  {copiedId === u.id ? <Check size={11} className="text-green-400" /> : <Copy size={11} />}
                                </button>
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Email */}
                        <td className="py-3.5 px-6 text-slate-300 font-medium">
                          {u.email}
                        </td>

                        {/* Joined Date */}
                        <td className="py-3.5 px-6 text-slate-400 text-xs">
                          {new Date(u.createdAt).toLocaleDateString('id-ID', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </td>

                        {/* Current Role Badge */}
                        <td className="py-3.5 px-6">
                          {isOwnerUser ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black bg-gradient-to-r from-amber-500/20 to-yellow-500/20 border border-amber-500/40 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.25)]">
                              <Crown size={12} className="text-amber-400 fill-amber-400" />
                              <span>OWNER</span>
                            </span>
                          ) : isAdminUser ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black bg-gradient-to-r from-cyan-500/20 to-sky-500/20 border border-cyan-500/40 text-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.25)]">
                              <ShieldCheck size={12} className="text-cyan-400" />
                              <span>ADMIN</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-white/5 border border-white/10 text-slate-300">
                              <Sparkles size={11} className="text-purple-400" />
                              <span>MEMBER</span>
                            </span>
                          )}
                        </td>

                        {/* Action Buttons */}
                        <td className="py-3.5 px-6 text-right">
                          {isOwnerUser ? (
                            <span className="text-xs text-slate-500 font-semibold italic">
                              Owner Utama
                            </span>
                          ) : currentUserRole === 'owner' ? (
                            <div className="flex items-center justify-end gap-2">
                              {isAdminUser ? (
                                <button
                                  type="button"
                                  disabled={isUpdating}
                                  onClick={() => handleRoleChange(u, 'member')}
                                  className="px-3 py-1.5 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 font-bold text-xs border border-purple-500/40 transition-all flex items-center gap-1.5 active:scale-95 disabled:opacity-50"
                                >
                                  {isUpdating ? (
                                    <RefreshCw size={12} className="animate-spin" />
                                  ) : (
                                    <UserX size={12} />
                                  )}
                                  <span>Jadikan Member</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  disabled={isUpdating}
                                  onClick={() => handleRoleChange(u, 'admin')}
                                  className="px-3 py-1.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 font-bold text-xs border border-cyan-500/40 transition-all flex items-center gap-1.5 active:scale-95 disabled:opacity-50"
                                >
                                  {isUpdating ? (
                                    <RefreshCw size={12} className="animate-spin" />
                                  ) : (
                                    <UserCheck size={12} />
                                  )}
                                  <span>Jadikan Admin</span>
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => setDeletingUser(u)}
                                className="p-2 rounded-xl bg-red-500/15 hover:bg-red-500/25 text-red-400 hover:text-red-300 border border-red-500/30 transition-all flex items-center justify-center active:scale-95"
                                title="Hapus Akun & Seluruh Data"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-500">
                              Khusus Owner
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Pagination Controls ── */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 sm:p-4 rounded-2xl bg-[#090e1f] border border-white/10 text-xs">
            <span className="text-slate-400 font-medium text-center sm:text-left">
              Menampilkan <strong className="text-white">{(currentPage - 1) * itemsPerPage + 1}</strong> -{' '}
              <strong className="text-white">
                {Math.min(currentPage * itemsPerPage, filteredUsers.length)}
              </strong>{' '}
              dari <strong className="text-white">{filteredUsers.length}</strong> pengguna
            </span>

            {totalPages > 1 && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 disabled:opacity-30 disabled:hover:bg-white/5 border border-white/10 transition-all flex items-center gap-1"
                >
                  <ChevronLeft size={14} />
                  <span>Sebelumnya</span>
                </button>

                <div className="flex items-center gap-1 px-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter((page) => {
                      if (totalPages <= 5) return true;
                      return Math.abs(page - currentPage) <= 1 || page === 1 || page === totalPages;
                    })
                    .map((page, idx, arr) => {
                      const prevPage = arr[idx - 1];
                      const showEllipsis = prevPage && page - prevPage > 1;
                      return (
                        <React.Fragment key={page}>
                          {showEllipsis && <span className="px-1 text-slate-500">...</span>}
                          <button
                            type="button"
                            onClick={() => setCurrentPage(page)}
                            className={`w-8 h-8 rounded-xl font-bold transition-all ${
                              currentPage === page
                                ? 'bg-cyan-500 text-black shadow-md shadow-cyan-500/20'
                                : 'bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10'
                            }`}
                          >
                            {page}
                          </button>
                        </React.Fragment>
                      );
                    })}
                </div>

                <button
                  type="button"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 disabled:opacity-30 disabled:hover:bg-white/5 border border-white/10 transition-all flex items-center gap-1"
                >
                  <span>Berikutnya</span>
                  <ChevronRight size={14} />
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Single Delete Confirmation Modal ── */}
      {deletingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-[#0c1328] border border-red-500/40 rounded-3xl p-5 sm:p-6 space-y-4 shadow-2xl animate-scale-up">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5 text-red-400">
                <div className="p-2.5 rounded-xl bg-red-500/20 border border-red-500/30">
                  <AlertTriangle size={20} />
                </div>
                <h3 className="text-base sm:text-lg font-black text-white">
                  Hapus Akun Pengguna
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setDeletingUser(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-3.5 rounded-2xl bg-black/40 border border-white/10 space-y-2 text-xs">
              <p className="text-slate-300">
                Apakah Anda yakin ingin menghapus akun{' '}
                <strong className="text-white capitalize">@{deletingUser.username}</strong> ({deletingUser.email})?
              </p>
              <div className="p-2.5 rounded-xl bg-red-950/30 border border-red-500/30 text-red-300 text-[11px] leading-relaxed">
                ⚠️ <strong>Peringatan Permanen:</strong> Seluruh data pengguna termasuk <em>Riwayat Nonton</em>, <em>Watchlist</em>, <em>Koleksi</em>, dan akun login akan <strong>dihapus secara permanen dari database</strong> dan tidak dapat dipulihkan.
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-1">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeletingUser(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white hover:bg-white/5 transition-all"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded-xl text-xs font-black bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/30 flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-50"
              >
                {isDeleting ? <RefreshCw size={13} className="animate-spin" /> : <Trash2 size={13} />}
                <span>{isDeleting ? 'Menghapus...' : 'Ya, Hapus Permanen'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Batch Delete Confirmation Modal ── */}
      {isBatchModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-[#0c1328] border border-red-500/40 rounded-3xl p-5 sm:p-6 space-y-4 shadow-2xl animate-scale-up">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5 text-red-400">
                <div className="p-2.5 rounded-xl bg-red-500/20 border border-red-500/30">
                  <Trash2 size={20} />
                </div>
                <h3 className="text-base sm:text-lg font-black text-white">
                  Hapus {selectedUserIds.length} Akun Terpilih
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsBatchModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-3.5 rounded-2xl bg-black/40 border border-white/10 space-y-2 text-xs">
              <p className="text-slate-300">
                Anda akan menghapus sebanyak <strong className="text-red-400">{selectedUserIds.length} akun pengguna</strong> sekaligus.
              </p>
              <div className="p-2.5 rounded-xl bg-red-950/30 border border-red-500/30 text-red-300 text-[11px] leading-relaxed">
                ⚠️ <strong>Tindakan Tidak Dapat Dibatalkan:</strong> Seluruh riwayat tontonan, watchlist, koleksi, dan kredensial untuk seluruh akun yang dipilih akan dihapus secara permanen dari database MongoDB.
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-1">
              <button
                type="button"
                disabled={isBatchDeleting}
                onClick={() => setIsBatchModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white hover:bg-white/5 transition-all"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isBatchDeleting}
                onClick={handleConfirmBatchDelete}
                className="px-4 py-2 rounded-xl text-xs font-black bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/30 flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-50"
              >
                {isBatchDeleting ? <RefreshCw size={13} className="animate-spin" /> : <Trash2 size={13} />}
                <span>{isBatchDeleting ? 'Menghapus Semua...' : `Ya, Hapus (${selectedUserIds.length})`}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
