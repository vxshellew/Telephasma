import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { ChevronRight, ChevronDown, Copy, ExternalLink, Search, FileText, Check, Loader2, Users, GitBranch } from 'lucide-react';
import { t } from '../lib/i18n';
import type { Language } from '../lib/i18n';

interface CommonGroup {
    id: number;
    name: string;
    type: string;
}

// --- Helper Components ---



const UserRow = ({ user, expanded, onToggleExpand, commonGroups, loadingGroups, onCopy, copiedId, language }: {
    user: any; expanded: boolean; onToggleExpand: () => void;
    commonGroups?: CommonGroup[]; loadingGroups: boolean; onCopy: (text: string, id?: string) => void; copiedId: string | null;
    language: Language;
}) => {

    // Status Badge Logic - Priority: discoveredFrom > sourceType
    const getStatusBadge = () => {
        // If discovered via gift chain, show DISCOVERED badge (not TARGET)
        if (user.discoveredFrom) {
            // Build a more descriptive discovery path
            let giftContext = '';
            if (user.giftsSentTo && user.giftsSentTo.length > 0) {
                const recipient = user.giftsSentTo[0].label;
                giftContext = ` → ${t('results.sent_to', language)} ${recipient}`;
            }

            return (
                <div className="flex items-center gap-2">
                    <span
                        className="flex items-center gap-1 text-[10px] font-bold text-orange-300 bg-orange-500/10 px-2 py-0.5 rounded border border-orange-500/20 uppercase tracking-widest leading-none cursor-help"
                        title={`${user.discoveredFrom} ${t('results.via', language)}${giftContext}`}
                    >
                        {t('labels.discovered', language)}
                    </span>
                    <span className="flex items-center gap-1 text-[10px] text-emerald-300 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 leading-none">
                        <GitBranch size={10} />
                        {t('results.via', language)} {user.discoveredFrom}
                    </span>
                </div>
            );
        }

        // Original channel/group members = TARGET
        if (user.sourceType === 'target') {
            return (
                <span className="flex items-center gap-1 text-[10px] font-bold text-red-400 bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20 uppercase tracking-widest leading-none">
                    {t('labels.target', language)}
                </span>
            );
        }

        return null;
    };

    // Common Groups Badge
    const commonCount = commonGroups ? commonGroups.length : (user.commonGroupCount || 0);
    const commonBadge = (
        <span className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider leading-none ml-2 ${commonCount > 0 ? 'text-green-400 bg-green-500/10 border-green-500/30' : 'text-gray-500 bg-gray-800 border-gray-700'} transition-all`}>
            {loadingGroups ? <Loader2 size={8} className="animate-spin" /> : '♥'} {commonCount} common
        </span>
    );


    return (
        <div className="group flex flex-col border border-gray-800/50 bg-[#1a1a20] hover:bg-[#202026] hover:border-gray-700 transition-all rounded-lg mb-2 overflow-hidden shadow-sm">
            {/* Main Header Row */}
            <div
                className="flex items-center gap-4 px-4 py-3 cursor-pointer select-none"
                onClick={onToggleExpand}
            >
                {/* Expand Icon */}
                <div className="text-gray-600 transition-transform duration-200">
                    {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </div>

                {/* Avatar & Name */}
                <div className="flex items-center gap-3 min-w-[300px]">
                    <div className={`w-8 h-8 rounded-full border border-white/5 flex items-center justify-center text-xs font-bold ${user.sourceType === 'target' ? 'bg-red-500/10 text-red-400' : 'bg-indigo-500/10 text-indigo-300'}`}>
                        {user.label.substring(0, 1).toUpperCase()}
                    </div>
                    <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-gray-200 group-hover:text-white transition-colors">{user.label}</span>
                            {getStatusBadge()}
                        </div>
                    </div>
                    {commonBadge}
                </div>

                {/* Channels Preview (Horizontal) */}
                <div className="flex-1 flex gap-2 overflow-hidden items-center">
                    {user.channels.slice(0, 3).map((ch: string, i: number) => (
                        <span key={i} className="text-[10px] bg-purple-500/10 text-purple-300 px-1.5 py-0.5 rounded border border-purple-500/20 truncate max-w-[100px]">
                            {ch}
                        </span>
                    ))}
                    {user.channels.length > 3 && <span className="text-[10px] text-gray-500">+{user.channels.length - 3}</span>}
                </div>


                {/* Stats (Right Aligned) */}
                <div className="ml-auto flex items-center gap-3">
                    {/* Gift Stats */}
                    {(user.totalGiftsSent > 0 || user.totalGiftsReceived > 0) && (
                        <div className="flex items-center gap-3 text-[10px] font-mono opacity-60">
                            {user.totalGiftsSent > 0 && <span className="text-green-400 flex items-center gap-0.5">↑{user.totalGiftsSent}</span>}
                            {user.totalGiftsReceived > 0 && <span className="text-yellow-400 flex items-center gap-0.5">↓{user.totalGiftsReceived}</span>}
                        </div>
                    )}
                    <div className="flex gap-1 ml-2">
                        <button onClick={(e) => { e.stopPropagation(); onCopy(user.id); }} className="p-1 hover:bg-gray-700 rounded text-gray-500 hover:text-white">
                            {copiedId === user.id ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                        </button>
                    </div>
                </div>
            </div>

            {/* Expanded Content */}
            {expanded && (
                <div className="px-4 pb-4 pt-1 pl-14 space-y-3 text-sm border-t border-gray-800/30 bg-[#15151a]">

                    {/* Common Groups List */}
                    <div className="flex items-start gap-3">
                        <span className="text-[10px] uppercase tracking-wider text-gray-500 mt-1.5 min-w-[70px] text-right">{t('results.groups', language)}</span>
                        <div className="flex flex-wrap gap-1.5 mt-0.5">
                            {loadingGroups ? (
                                <span className="text-xs text-gray-600 animate-pulse flex items-center gap-1"><Loader2 size={10} className="animate-spin" /> {t('results.checking', language)}</span>
                            ) : (commonGroups && commonGroups.length > 0) ? (
                                commonGroups.map((g, i) => (
                                    <span key={i} className="px-2 py-0.5 bg-green-900/10 text-green-400/80 rounded border border-green-900/20 text-[10px]">
                                        {g.name}
                                    </span>
                                ))
                            ) : (
                                <span className="text-[10px] text-gray-600 italic mt-0.5">{t('results.no_common_groups', language)}</span>
                            )}
                        </div>
                    </div>

                    {/* Gifts Row */}
                    {(user.giftsSentTo.length > 0 || user.giftsReceivedFrom.length > 0) && (
                        <div className="flex items-start gap-3">
                            <span className="text-[10px] uppercase tracking-wider text-gray-500 mt-1 min-w-[70px] text-right">{t('results.gifts', language)}</span>
                            <div className="flex flex-col gap-1.5 w-full">
                                {user.giftsSentTo.length > 0 && (
                                    <div className="flex flex-wrap gap-2 items-center">
                                        <span className="text-[10px] text-green-500/70 uppercase">{t('results.sent_to', language)}</span>
                                        {user.giftsSentTo.map((g: any, i: number) => (
                                            <span key={i} className="text-xs text-green-300 bg-green-500/5 px-1.5 py-0.5 rounded flex items-center gap-1">
                                                @{g.label} <span className="opacity-50 text-[10px]">x{g.count}</span>
                                            </span>
                                        ))}
                                    </div>
                                )}
                                {user.giftsReceivedFrom.length > 0 && (
                                    <div className="flex flex-wrap gap-2 items-center">
                                        <span className="text-[10px] text-yellow-500/70 uppercase">{t('results.recv_from', language)}</span>
                                        {user.giftsReceivedFrom.map((g: any, i: number) => (
                                            <span key={i} className="text-xs text-yellow-300 bg-yellow-500/5 px-1.5 py-0.5 rounded flex items-center gap-1">
                                                @{g.label} <span className="opacity-50 text-[10px]">x{g.count}</span>
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Channels Row */}
                    {user.channels.length > 0 && (
                        <div className="flex items-start gap-3">
                            <span className="text-[10px] uppercase tracking-wider text-gray-500 mt-1 min-w-[70px] text-right">{t('results.channels', language)}</span>
                            <div className="flex flex-wrap gap-1.5 mt-0.5">
                                {user.channels.map((ch: string, i: number) => (
                                    <a
                                        key={i}
                                        href={`https://t.me/${ch.replace('@', '')}`}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="px-2 py-0.5 bg-purple-500/10 text-purple-300 rounded border border-purple-500/20 text-xs hover:bg-purple-500/20 transition-colors flex items-center gap-1.5 group/link"
                                    >
                                        <Users size={10} className="group-hover/link:text-purple-200" />
                                        {ch}
                                        <ExternalLink size={8} className="opacity-0 group-hover/link:opacity-100 transition-opacity" />
                                    </a>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Bio */}
                    {user.bio && (
                        <div className="flex items-start gap-3">
                            <span className="text-[10px] uppercase tracking-wider text-gray-500 mt-1 min-w-[70px] text-right">{t('results.bio', language)}</span>
                            <p className="text-gray-400 text-xs italic bg-white/[0.02] px-2 py-1 rounded w-full border border-white/5">
                                {user.bio}
                            </p>
                        </div>
                    )}

                </div>
            )}
        </div>
    );
};

export const ResultsPanel: React.FC = () => {
    const { parsedUsers, language } = useStore();
    const [searchQuery, setSearchQuery] = useState('');
    const [filterType, setFilterType] = useState<'all' | 'target' | 'discovered' | 'no_common'>('all');
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set());
    const [currentPage, setCurrentPage] = useState(1);
    const [showExportMenu, setShowExportMenu] = useState(false);
    const [, setExportSuccess] = useState<string | null>(null);
    const [commonGroupsCache, setCommonGroupsCache] = useState<Record<string, CommonGroup[]>>({});
    const [loadingGroups, setLoadingGroups] = useState<Set<string>>(new Set());
    const ITEMS_PER_PAGE = 50;

    const allChannels = useMemo(() => {
        const channelSet = new Set<string>();
        parsedUsers.forEach(u => u.channels.forEach(c => channelSet.add(c)));
        return Array.from(channelSet);
    }, [parsedUsers]);

    // Count users with no common groups
    const noCommonGroupsCount = useMemo(() => {
        return parsedUsers.filter(u => {
            const groups = commonGroupsCache[u.id];
            return groups !== undefined && groups.length === 0;
        }).length;
    }, [parsedUsers, commonGroupsCache]);

    // Filter and search
    const filteredUsers = useMemo(() => {
        return parsedUsers
            .filter(user => {
                // Only show users with channels OR original targets (no discoveredFrom)
                const hasChannels = user.channels.length > 0;
                const isOriginalTarget = !user.discoveredFrom;

                // Base visibility: show if has channels or is original target
                if (!hasChannels && !isOriginalTarget) return false;

                // Apply specific filters
                if (filterType === 'target' && user.discoveredFrom) return false;
                if (filterType === 'discovered' && !user.discoveredFrom) return false;

                if (filterType === 'no_common') {
                    const groups = commonGroupsCache[user.id];
                    if (groups === undefined || groups.length > 0) return false;
                }
                if (searchQuery) {
                    const q = searchQuery.toLowerCase();
                    return user.label.toLowerCase().includes(q) ||
                        (user.bio?.toLowerCase() || '').includes(q) ||
                        user.channels.some(c => c.toLowerCase().includes(q));
                }
                return true;
            })
            .sort((a, b) => {
                // Sort Priority:
                // 1. Targets
                // 2. Verified Channel Owners (Recursively found)
                // 3. Usernames alphabetical

                if (a.sourceType === 'target' && b.sourceType !== 'target') return -1;
                if (b.sourceType === 'target' && a.sourceType !== 'target') return 1;

                // Prioritize those with discovered paths
                const aHasVia = !!a.discoveredFrom;
                const bHasVia = !!b.discoveredFrom;
                if (aHasVia && !bHasVia) return -1;
                if (!aHasVia && bHasVia) return 1;

                return b.channels.length - a.channels.length;
            });
    }, [parsedUsers, searchQuery, filterType, commonGroupsCache]);

    const totalPages = Math.ceil(filteredUsers.length / ITEMS_PER_PAGE);
    const paginatedUsers = filteredUsers.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

    const fetchCommonGroups = useCallback(async (userId: string) => {
        if (commonGroupsCache[userId] || loadingGroups.has(userId)) return;

        setLoadingGroups(prev => new Set(prev).add(userId));
        try {
            const numericId = userId.replace('u_', '');
            const res = await fetch(`http://localhost:8000/api/user/${numericId}/common-groups`);
            if (res.ok) {
                const groups = await res.json();
                setCommonGroupsCache(prev => ({ ...prev, [userId]: groups }));
            }
        } catch (e) {
            console.error('Failed to fetch common groups', e);
        } finally {
            setLoadingGroups(prev => {
                const newSet = new Set(prev);
                newSet.delete(userId);
                return newSet;
            });
        }
    }, [commonGroupsCache, loadingGroups]);

    const processedTargets = React.useRef<Set<string>>(new Set());

    // OPTIMIZATION: Auto-fetch common groups for displayed users
    useEffect(() => {
        paginatedUsers.forEach(u => {
            if (!processedTargets.current.has(u.id)) {
                processedTargets.current.add(u.id);
                fetchCommonGroups(u.id);
            }
        });
    }, [paginatedUsers, fetchCommonGroups]);

    const toggleExpand = (id: string) => {
        const newSet = new Set(expandedUsers);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setExpandedUsers(newSet);
    };

    const copyToClipboard = (text: string, id?: string) => {
        navigator.clipboard.writeText(text);
        if (id) {
            setCopiedId(id);
            setTimeout(() => setCopiedId(null), 1500);
        }
    };

    const runExport = (type: 'channels' | 'users') => {
        if (type === 'channels') {
            const content = allChannels.map(ch => `https://t.me/${ch.replace('@', '')}`).join('\n');
            downloadFile(content, 'channels.txt', 'text/plain');
            showSuccess('channels.txt');
        } else {
            const data = filteredUsers.map(u => ({
                username: u.label, id: u.id, type: u.sourceType, bio: u.bio || '',
                channels: u.channels, giftsSent: u.totalGiftsSent, giftsReceived: u.totalGiftsReceived,
                commonGroups: commonGroupsCache[u.id] || [],
                via: u.discoveredFrom || 'Direct'
            }));
            downloadFile(JSON.stringify(data, null, 2), 'users.json', 'application/json');
            showSuccess('users.json');
        }
    };

    const downloadFile = (content: string, fileName: string, contentType: string) => {
        const a = document.createElement("a");
        const file = new Blob([content], { type: contentType });
        a.href = URL.createObjectURL(file);
        a.download = fileName;
        a.click();
    };

    const showSuccess = (msg: string) => {
        setExportSuccess(msg);
        setTimeout(() => setExportSuccess(null), 3000);
    };

    return (
        <div className="bg-[#1e1e24] rounded-xl shadow-2xl border border-gray-800/50 backdrop-blur-sm overflow-hidden flex flex-col h-full font-sans">
            {/* Header */}
            <div className="p-4 border-b border-gray-800/50 flex flex-col gap-4 bg-[#1e1e24]/95 backdrop-blur z-20">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <h2 className="text-xl font-bold bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent">Results</h2>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => runExport('channels')} className="px-3 py-1.5 bg-[#2a2a35] hover:bg-[#32323e] rounded border border-gray-700 text-xs text-blue-300 transition-colors flex items-center gap-2">
                            <FileText size={12} /> {t('results.export_channels', language)}
                        </button>
                        <button onClick={() => runExport('users')} className="px-3 py-1.5 bg-[#2a2a35] hover:bg-[#32323e] rounded border border-gray-700 text-xs text-purple-300 transition-colors flex items-center gap-2">
                            <Users size={12} /> {t('results.export_users', language)}
                        </button>
                    </div>
                </div>

                {/* Filter Buttons Row */}
                <div className="flex items-center gap-2 flex-wrap">
                    <button
                        onClick={() => setFilterType('all')}
                        style={{
                            padding: '6px 14px',
                            background: filterType === 'all' ? 'rgba(168,85,247,0.25)' : 'rgba(168,85,247,0.08)',
                            color: '#c084fc',
                            borderRadius: '8px',
                            fontSize: '12px',
                            fontWeight: 600,
                            border: filterType === 'all' ? '1px solid rgba(168,85,247,0.5)' : '1px solid rgba(168,85,247,0.2)',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                        }}
                    >
                        📊 {parsedUsers.filter(u => u.channels.length > 0 || !u.discoveredFrom).length} {t('stats.total', language)}
                    </button>
                    <button
                        onClick={() => setFilterType('target')}
                        style={{
                            padding: '6px 14px',
                            background: filterType === 'target' ? 'rgba(239,68,68,0.25)' : 'rgba(239,68,68,0.08)',
                            color: '#fca5a5',
                            borderRadius: '8px',
                            fontSize: '12px',
                            fontWeight: 500,
                            border: filterType === 'target' ? '1px solid rgba(239,68,68,0.5)' : '1px solid rgba(239,68,68,0.2)',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                        }}
                    >
                        🎯 {parsedUsers.filter(u => !u.discoveredFrom).length} {t('stats.target', language)}
                    </button>
                    <button
                        onClick={() => setFilterType('discovered')}
                        style={{
                            padding: '6px 14px',
                            background: filterType === 'discovered' ? 'rgba(249,115,22,0.25)' : 'rgba(249,115,22,0.08)',
                            color: '#fdba74',
                            borderRadius: '8px',
                            fontSize: '12px',
                            fontWeight: 500,
                            border: filterType === 'discovered' ? '1px solid rgba(249,115,22,0.5)' : '1px solid rgba(249,115,22,0.2)',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                        }}
                    >
                        🔗 {parsedUsers.filter(u => !!u.discoveredFrom).length} {t('stats.discovered', language)}
                    </button>
                    <button
                        onClick={() => setFilterType('no_common')}
                        style={{
                            padding: '6px 14px',
                            background: filterType === 'no_common' ? 'rgba(234,179,8,0.25)' : 'rgba(234,179,8,0.08)',
                            color: '#fde047',
                            borderRadius: '8px',
                            fontSize: '12px',
                            fontWeight: 500,
                            border: filterType === 'no_common' ? '1px solid rgba(234,179,8,0.5)' : '1px solid rgba(234,179,8,0.2)',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                        }}
                    >
                        ⚠️ {noCommonGroupsCount} {t('stats.no_common', language)}
                    </button>

                    <div style={{ flex: 1 }} />

                    {/* Search */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={14} />
                        <input
                            type="text"
                            placeholder={t('results.search', language)}
                            className="bg-[#15151a] border border-gray-800 rounded-lg py-2 pl-9 pr-4 text-xs text-gray-300 placeholder-gray-600 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20 transition-all w-48"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto min-h-0 p-4 scrollbar-thin scrollbar-thumb-gray-800 scrollbar-track-transparent space-y-2">
                {paginatedUsers.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-gray-500 gap-3">
                        <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center">
                            <Search size={24} className="opacity-20" />
                        </div>
                        <p className="text-sm font-medium text-gray-400">{t('results.no_results', language)}</p>
                        <p className="text-xs opacity-50 max-w-[200px] text-center">{t('results.no_results_hint', language)}</p>
                    </div>
                ) : (
                    paginatedUsers.map((user) => (
                        <UserRow
                            key={user.id}
                            user={user}
                            expanded={expandedUsers.has(user.id)}
                            onToggleExpand={() => toggleExpand(user.id)}
                            commonGroups={commonGroupsCache[user.id]}
                            loadingGroups={loadingGroups.has(user.id)}
                            onCopy={copyToClipboard}
                            copiedId={copiedId}
                            language={language}
                        />
                    ))
                )}
            </div>

            {/* Simple Footer/Pagination */}
            {totalPages > 1 && (
                <div className="p-3 border-t border-gray-800 bg-[#1e1e24] flex items-center justify-between text-xs text-gray-500">
                    <span>{t('common.page', language)} {currentPage} {t('common.of', language)} {totalPages}</span>
                    <div className="flex gap-1">
                        <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-2 py-1 bg-white/5 hover:bg-white/10 rounded disabled:opacity-30">{t('common.prev', language)}</button>
                        <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="px-2 py-1 bg-white/5 hover:bg-white/10 rounded disabled:opacity-30">{t('common.next', language)}</button>
                    </div>
                </div>
            )}
        </div>
    );
};
