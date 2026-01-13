import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useStore } from '../store/useStore';
import { Search, Loader2, Play, Users, ArrowLeft, Check, Hash, MessageSquare, ExternalLink, UserSearch } from 'lucide-react';
import { t } from '../lib/i18n';

interface Dialog {
    id: number;
    name: string;
    type: string;
}

interface Member {
    id: number;
    username: string;
    first_name: string;
    last_name?: string;
    bot: boolean;
    found_in?: string;
}

type FilterType = 'all' | 'group' | 'megagroup';
type ViewMode = 'groups' | 'members' | 'search';

export const Discovery: React.FC = () => {
    const { isAuthenticated, setScanQueue, setActiveTab, setSettings, language } = useStore();
    const [dialogs, setDialogs] = useState<Dialog[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState<FilterType>('all');

    const [viewMode, setViewMode] = useState<ViewMode>('groups');
    const [currentGroup, setCurrentGroup] = useState<Dialog | null>(null);
    const [members, setMembers] = useState<Member[]>([]);
    const [selectedMemberIds, setSelectedMemberIds] = useState<Set<number>>(new Set());
    const [memberSearch, setMemberSearch] = useState('');

    // Global user search
    const [globalSearchResults, setGlobalSearchResults] = useState<Member[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [userSearchQuery, setUserSearchQuery] = useState('');

    useEffect(() => {
        if (!isAuthenticated || viewMode !== 'groups') return;

        const fetchDialogs = async () => {
            setLoading(true);
            try {
                const response = await fetch('http://localhost:8000/api/dialogs');
                if (response.ok) {
                    const data = await response.json();
                    setDialogs(data);
                }
            } catch (error) {
                console.error("Failed to fetch dialogs", error);
            } finally {
                setLoading(false);
            }
        };
        fetchDialogs();
    }, [isAuthenticated, viewMode]);

    // Global user search
    const handleGlobalSearch = useCallback(async () => {
        if (!userSearchQuery.trim() || userSearchQuery.length < 2) return;

        setIsSearching(true);
        setViewMode('search');
        setGlobalSearchResults([]);

        try {
            const response = await fetch(`http://localhost:8000/api/search/users?query=${encodeURIComponent(userSearchQuery)}`);
            if (response.ok) {
                const data = await response.json();
                setGlobalSearchResults(data);
            }
        } catch (error) {
            console.error("Search failed", error);
        } finally {
            setIsSearching(false);
        }
    }, [userSearchQuery]);

    const handleViewMembers = async (dialog: Dialog) => {
        setCurrentGroup(dialog);
        setViewMode('members');
        setLoading(true);
        setMembers([]);
        setSelectedMemberIds(new Set());
        setMemberSearch('');

        try {
            const response = await fetch(`http://localhost:8000/api/chat/${dialog.id}/members`);
            if (response.ok) {
                const data = await response.json();
                setMembers(data);
            }
        } catch (error) {
            console.error("Failed to fetch members", error);
        } finally {
            setLoading(false);
        }
    };

    const toggleSelection = (id: number) => {
        const idStr = id.toString();
        const newSet = new Set(selectedIds);
        if (newSet.has(idStr)) newSet.delete(idStr);
        else newSet.add(idStr);
        setSelectedIds(newSet);
    };

    const toggleMemberSelection = (id: number) => {
        const newSet = new Set(selectedMemberIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedMemberIds(newSet);
    };

    const filteredDialogs = useMemo(() => {
        return dialogs.filter(d => {
            if (d.type === 'channel') return false;
            if (filterType === 'group' && d.type !== 'group') return false;
            if (filterType === 'megagroup' && d.type !== 'megagroup') return false;
            if (searchTerm) {
                return d.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    d.id.toString().includes(searchTerm);
            }
            return true;
        });
    }, [dialogs, searchTerm, filterType]);

    const filteredMembers = useMemo(() => {
        return members.filter(m => {
            if (!memberSearch) return true;
            const search = memberSearch.toLowerCase();
            return (m.username || "").toLowerCase().includes(search) ||
                (m.first_name || "").toLowerCase().includes(search) ||
                m.id.toString().includes(search);
        });
    }, [members, memberSearch]);

    const stats = useMemo(() => ({
        groups: dialogs.filter(d => d.type === 'group').length,
        megagroups: dialogs.filter(d => d.type === 'megagroup').length
    }), [dialogs]);

    const handleStartAnalysis = () => {
        if (selectedIds.size === 0) return;
        setScanQueue(Array.from(selectedIds));
        setSettings({ scanTargetChatId: Array.from(selectedIds)[0] });
        setActiveTab('scanner');
    };

    const handleStartMemberAnalysis = () => {
        if (selectedMemberIds.size === 0) return;
        setSettings({ scanTargetChatId: 'custom', customScanTargets: Array.from(selectedMemberIds).map(String) });
        setActiveTab('scanner');
    };

    const selectAll = () => {
        if (viewMode === 'groups') {
            if (selectedIds.size === filteredDialogs.length) setSelectedIds(new Set());
            else setSelectedIds(new Set(filteredDialogs.map(d => d.id.toString())));
        } else {
            const list = viewMode === 'search' ? globalSearchResults : filteredMembers;
            if (selectedMemberIds.size === list.length) setSelectedMemberIds(new Set());
            else setSelectedMemberIds(new Set(list.map(m => m.id)));
        }
    };

    const getTypeBadge = (type: string) => {
        switch (type) {
            case 'megagroup': return 'bg-green-500/20 text-green-300';
            default: return 'bg-purple-500/20 text-purple-300';
        }
    };

    if (!isAuthenticated) {
        return (
            <div className="h-full flex items-center justify-center text-gray-500 bg-[#0a0a0f]">
                <div className="text-center"><div className="text-4xl mb-2">🔐</div><div>{t('discovery.please_login', language)}</div></div>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col bg-[#0a0a0f] overflow-hidden">
            {/* Header */}
            <div className="p-3 border-b border-white/10">
                <div className="flex items-center gap-3">
                    {viewMode !== 'groups' && (
                        <button onClick={() => { setViewMode('groups'); setGlobalSearchResults([]); setUserSearchQuery(''); }} className="p-1.5 hover:bg-white/10 rounded-lg">
                            <ArrowLeft className="w-4 h-4" />
                        </button>
                    )}

                    <div className="flex-1">
                        <h2 className="font-semibold text-lg">
                            {viewMode === 'groups' ? t('discovery.title', language) : viewMode === 'search' ? t('discovery.user_search', language) : currentGroup?.name}
                        </h2>
                        <p className="text-xs text-gray-500">
                            {viewMode === 'groups'
                                ? `${stats.megagroups} ${t('discovery.supergroups', language)} • ${stats.groups} ${t('discovery.groups', language)}`
                                : viewMode === 'search'
                                    ? `${globalSearchResults.length} ${t('discovery.users_found', language)}`
                                    : `${members.length} ${t('discovery.members', language)}`
                            }
                        </p>
                    </div>

                    {(viewMode === 'members' || viewMode === 'search') && (
                        <button onClick={selectAll} className="text-xs text-purple-400 hover:text-purple-300 px-2 py-1">
                            {selectedMemberIds.size === (viewMode === 'search' ? globalSearchResults : filteredMembers).length ? t('discovery.deselect_all', language) : t('discovery.select_all', language)}
                        </button>
                    )}
                </div>

                {/* Search */}
                <div className="mt-3 flex gap-2">
                    {viewMode === 'groups' ? (
                        <>
                            {/* Global User Search */}
                            <div className="flex-1 relative">
                                <UserSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-400" />
                                <input
                                    type="text"
                                    placeholder={t('discovery.search_users_placeholder', language)}
                                    value={userSearchQuery}
                                    onChange={(e) => setUserSearchQuery(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleGlobalSearch()}
                                    className="w-full pl-9 pr-20 py-2 bg-green-500/10 border border-green-500/30 rounded-lg text-sm text-white placeholder-green-400/50 focus:outline-none focus:border-green-500"
                                />
                                <button
                                    onClick={handleGlobalSearch}
                                    disabled={userSearchQuery.length < 2}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 bg-green-600 hover:bg-green-500 disabled:opacity-50 rounded text-xs font-medium"
                                >
                                    {t('discovery.search', language)}
                                </button>
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                            <input
                                type="text"
                                placeholder={t('discovery.filter_members', language)}
                                value={memberSearch}
                                onChange={(e) => setMemberSearch(e.target.value)}
                                className="w-full pl-9 pr-8 py-2 bg-[#1a1a2f] border border-white/10 rounded-lg text-sm text-white"
                            />
                        </div>
                    )}

                    {viewMode === 'groups' && (
                        <div className="flex bg-white/5 rounded-lg p-0.5">
                            {[{ key: 'all', label: t('discovery.all', language) }, { key: 'megagroup', label: '👥' }, { key: 'group', label: '💬' }].map(f => (
                                <button
                                    key={f.key}
                                    onClick={() => setFilterType(f.key as FilterType)}
                                    className={`px-2 py-1 rounded text-xs ${filterType === f.key ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'}`}
                                >
                                    {f.label}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Group Search (secondary) */}
                {viewMode === 'groups' && (
                    <div className="mt-2 relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                        <input
                            type="text"
                            placeholder={t('discovery.filter_groups', language)}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-8 py-1.5 bg-[#1a1a2f] border border-white/10 rounded-lg text-xs text-white placeholder-gray-500"
                        />
                    </div>
                )}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto p-3">
                {loading || isSearching ? (
                    <div className="flex items-center justify-center h-full">
                        <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
                    </div>
                ) : viewMode === 'search' ? (
                    /* Global Search Results */
                    <div className="space-y-1">
                        {globalSearchResults.length === 0 ? (
                            <div className="text-center text-gray-500 py-8">
                                <UserSearch className="w-12 h-12 mx-auto mb-2 opacity-50" />
                                <div>{t('discovery.no_users_found', language)} "{userSearchQuery}"</div>
                            </div>
                        ) : (
                            globalSearchResults.map(user => {
                                const isSelected = selectedMemberIds.has(user.id);
                                return (
                                    <div
                                        key={user.id}
                                        onClick={() => toggleMemberSelection(user.id)}
                                        className={`p-3 rounded-xl border cursor-pointer flex items-center gap-3 transition-all ${isSelected ? 'bg-green-500/15 border-green-500/40' : 'bg-white/5 border-white/10 hover:bg-white/10'
                                            }`}
                                    >
                                        <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center text-lg">
                                            👤
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="font-medium text-sm">
                                                {user.first_name} {user.last_name || ''}
                                                {user.username && <span className="text-gray-400 ml-1">@{user.username}</span>}
                                            </div>
                                            <div className="text-[10px] text-gray-500 flex items-center gap-2">
                                                <span>ID: {user.id}</span>
                                                {user.found_in && <span className="text-green-400">📍 {user.found_in}</span>}
                                                {user.bot && <span className="text-blue-400">🤖 BOT</span>}
                                            </div>
                                        </div>
                                        {user.username && (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); window.open(`https://t.me/${user.username}`, '_blank'); }}
                                                className="p-1.5 bg-white/10 hover:bg-white/20 rounded-lg"
                                            >
                                                <ExternalLink className="w-3 h-3" />
                                            </button>
                                        )}
                                        <div className={`w-5 h-5 rounded flex items-center justify-center ${isSelected ? 'bg-green-500' : 'bg-white/10'}`}>
                                            {isSelected && <Check className="w-3 h-3" />}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                ) : viewMode === 'groups' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
                        {filteredDialogs.map(dialog => {
                            const isSelected = selectedIds.has(dialog.id.toString());
                            return (
                                <div
                                    key={dialog.id}
                                    className={`p-3 rounded-xl border transition-all cursor-pointer group ${isSelected ? 'bg-purple-500/15 border-purple-500/40' : 'bg-white/5 border-white/10 hover:bg-white/10'
                                        }`}
                                    onClick={() => toggleSelection(dialog.id)}
                                >
                                    <div className="flex items-start gap-3">
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${getTypeBadge(dialog.type)}`}>
                                            {dialog.type === 'megagroup' ? <Users className="w-4 h-4" /> : <MessageSquare className="w-4 h-4" />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="font-medium text-sm truncate">{dialog.name}</div>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className={`px-1.5 py-0.5 rounded text-[10px] uppercase ${getTypeBadge(dialog.type)}`}>
                                                    {dialog.type === 'megagroup' ? t('discovery.super', language) : t('discovery.group', language)}
                                                </span>
                                                <span className="text-[10px] text-gray-500"><Hash className="w-2.5 h-2.5 inline" />{dialog.id}</span>
                                            </div>
                                        </div>
                                        <div className={`w-5 h-5 rounded flex items-center justify-center ${isSelected ? 'bg-purple-500' : 'bg-white/10'}`}>
                                            {isSelected && <Check className="w-3 h-3" />}
                                        </div>
                                    </div>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleViewMembers(dialog); }}
                                        className="mt-2 w-full py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-xs text-gray-400 hover:text-white transition-all flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100"
                                    >
                                        <Users className="w-3 h-3" /> {t('discovery.view_members', language)}
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    /* Members View */
                    <div className="space-y-1">
                        {filteredMembers.map(member => {
                            const isSelected = selectedMemberIds.has(member.id);
                            return (
                                <div
                                    key={member.id}
                                    onClick={() => toggleMemberSelection(member.id)}
                                    className={`p-2.5 rounded-lg border cursor-pointer flex items-center gap-3 transition-all ${isSelected ? 'bg-purple-500/15 border-purple-500/40' : 'bg-white/5 border-white/10 hover:bg-white/10'
                                        }`}
                                >
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${member.bot ? 'bg-blue-500/20' : 'bg-green-500/20'}`}>
                                        {member.bot ? '🤖' : '👤'}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="font-medium text-sm truncate">
                                            {member.first_name || 'Unknown'}
                                            {member.username && <span className="text-gray-400"> @{member.username}</span>}
                                        </div>
                                        <div className="text-[10px] text-gray-500">ID: {member.id} {member.bot && <span className="text-blue-400">BOT</span>}</div>
                                    </div>
                                    {member.username && (
                                        <button onClick={(e) => { e.stopPropagation(); window.open(`https://t.me/${member.username}`, '_blank'); }} className="p-1.5 bg-white/10 hover:bg-white/20 rounded-lg">
                                            <ExternalLink className="w-3 h-3" />
                                        </button>
                                    )}
                                    <div className={`w-5 h-5 rounded flex items-center justify-center ${isSelected ? 'bg-purple-500' : 'bg-white/10'}`}>
                                        {isSelected && <Check className="w-3 h-3" />}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Action Bar */}
            {(viewMode === 'groups' ? selectedIds.size > 0 : selectedMemberIds.size > 0) && (
                <div className="p-3 border-t border-white/10 bg-[#0a0a0f]">
                    <button
                        onClick={viewMode === 'groups' ? handleStartAnalysis : handleStartMemberAnalysis}
                        className="w-full py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 rounded-xl font-medium flex items-center justify-center gap-2"
                    >
                        <Play className="w-4 h-4 fill-current" />
                        {t('discovery.analyze', language)} {viewMode === 'groups' ? `${selectedIds.size} ${t('discovery.groups', language)}` : `${selectedMemberIds.size} ${t('common.users', language) || 'Users'}`}
                    </button>
                </div>
            )}
        </div>
    );
};
