import React, { useEffect, useRef, useState, useMemo } from 'react';
import { useStore } from '../store/useStore';
import { Activity, Search, ExternalLink, Copy, Check, ChevronRight } from 'lucide-react';
import { t } from '../lib/i18n';

export const Scanner: React.FC = () => {
    const {
        scanTargetChatId, setSettings,
        scanRecursive, scanDepth, scanDelay,
        isScanning, startScan, stopScan,
        addLog, processScanUpdate, logs,
        scanQueue, setScanQueue, customScanTargets,
        parsedUsers, language
    } = useStore();

    const wsRef = useRef<WebSocket | null>(null);
    const [autoProcess] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [giftsFilter, setGiftsFilter] = useState('all');

    // Get unique gift recipients for the dropdown
    const giftRecipients = useMemo(() => {
        const recipients = new Set<string>();
        parsedUsers.forEach(user => {
            user.giftsSentTo?.forEach((g: any) => {
                if (g.label) recipients.add(g.label);
            });
        });
        return Array.from(recipients).sort();
    }, [parsedUsers]);

    const filteredUsers = useMemo(() => {
        return parsedUsers.filter((user) => {
            // Only show users with channels OR targets
            if (user.channels.length === 0 && user.sourceType !== 'target') return false;

            // Apply gifts filter
            if (giftsFilter === 'targets') {
                if (user.sourceType !== 'target' || user.discoveredFrom) return false;
            } else if (giftsFilter === 'discovered') {
                if (!user.discoveredFrom) return false;
            } else if (giftsFilter === 'gifters') {
                if (user.totalGiftsSent === 0) return false;
            } else if (giftsFilter === 'has_gifts') {
                if (user.totalGiftsSent === 0 && user.totalGiftsReceived === 0) return false;
            } else if (giftsFilter.startsWith('to:')) {
                const recipient = giftsFilter.replace('to:', '');
                if (!user.giftsSentTo?.some((g: any) => g.label === recipient)) return false;
            }

            if (searchQuery) {
                const q = searchQuery.toLowerCase();
                return user.label?.toLowerCase().includes(q) ||
                    user.channels.some((c: string) => c.toLowerCase().includes(q));
            }
            return true;
        }).sort((a, b) => {
            if (a.sourceType === 'target') return -1;
            if (b.sourceType === 'target') return 1;
            return b.channels.length - a.channels.length;
        });
    }, [parsedUsers, searchQuery, giftsFilter]);

    const stats = useMemo(() => {
        // Count from parsedUsers (visible ones only - with channels or targets)
        const visibleUsers = parsedUsers.filter(u => u.channels.length > 0 || (u.sourceType === 'target' && !u.discoveredFrom));

        return {
            total: visibleUsers.length,
            // Targets = original group members (no discoveredFrom)
            targets: visibleUsers.filter((u) => !u.discoveredFrom).length,
            // Gifters = users who sent gifts
            gifters: visibleUsers.filter((u) => u.totalGiftsSent > 0).length,
            // Discovered = found via gift chain (has discoveredFrom)
            discovered: visibleUsers.filter((u) => !!u.discoveredFrom).length
        };
    }, [parsedUsers]);

    const startScanForId = (chatId: string) => {
        if (!chatId) return;
        setSettings({ scanTargetChatId: chatId });
        startScan();
        addLog(chatId === 'custom' ? `Connecting to scan ${customScanTargets.length} selected users...` : `Connecting to ${chatId}...`);

        const ws = new WebSocket(`ws://localhost:8000/ws/scan/${chatId}?depth=${scanDepth}&delay=${scanDelay}`);
        wsRef.current = ws;

        ws.onopen = () => {
            addLog("Connected to scanning engine.");
            if (chatId === 'custom') {
                // Send comma-separated string, backend parses it
                const targets = customScanTargets.join(',');
                ws.send(JSON.stringify({ user_ids: customScanTargets, targets: targets, depth: scanDepth, delay: scanDelay }));
            }
        };

        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.type === 'complete') {
                ws.close();
                addLog(`Scan complete for ${chatId}.`);
            } else if (data.type === 'error') {
                addLog(`Error: ${data.message}`);
            } else {
                processScanUpdate(data);
                if (data.type === 'user_found') addLog(`Found: ${data.data.username || data.data.id}`);
                if (data.type === 'user_gifts') addLog(`Gifts: Found ${data.data.gifts.length} for ${data.data.user_id}`);
            }
        };

        ws.onclose = () => {
            // Check if we manually stopped scanning
            if (!useStore.getState().isScanning) {
                addLog("Scan stopped immediately.");
                return;
            }

            // Normal completion delay
            setTimeout(() => {
                const currentQueue = useStore.getState().scanQueue;
                // Double check scanning state after timeout
                if (!useStore.getState().isScanning) return;

                if (currentQueue.length > 0 && autoProcess) {
                    const nextQueue = [...currentQueue];
                    const nextId = nextQueue.shift();
                    setScanQueue(nextQueue);
                    if (nextId) startScanForId(nextId);
                } else {
                    stopScan();
                    addLog("Scan stopped.");
                }
            }, 1000);
        };
    };

    useEffect(() => {
        if (scanQueue.length > 0 && !isScanning && autoProcess) {
            const nextQueue = [...scanQueue];
            const nextId = nextQueue.shift();
            if (nextId) {
                setScanQueue(nextQueue);
                startScanForId(nextId);
            }
        }
    }, [scanQueue, isScanning, autoProcess]);

    const handleStop = async () => {
        setScanQueue([]);
        stopScan(); // Update state immediately
        if (wsRef.current) wsRef.current.close();

        try {
            await fetch('http://localhost:8000/api/stop-scan', { method: 'POST' });
        } catch (e) {
            console.error('Failed to trigger backend stop', e);
        }

        addLog("Manual stop requested - Signal Sent.");
    };

    const copyToClipboard = (text: string, id: string) => {
        navigator.clipboard.writeText(text);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 1500);
    };

    return (
        <div style={{ display: 'flex', height: '100%', gap: '16px' }}>
            {/* Left Panel */}
            <div style={{ width: '240px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Scan Configuration */}
                <div className="glass-panel text-sm" style={{ padding: '16px', background: '#0a0a0f', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                        <div className={`w-2 h-2 rounded-full ${isScanning ? 'bg-green-500 animate-pulse' : 'bg-gray-600'}`} />
                        <h3 className="font-semibold text-gray-200">{t('scanner.configuration', language)}</h3>
                    </div>

                    {scanTargetChatId === 'custom' ? (
                        <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-lg mb-4">
                            <div className="text-[10px] text-purple-300 uppercase tracking-wider mb-1">{t('scanner.active_target', language)}</div>
                            <div className="text-purple-400 font-medium">{customScanTargets.length} {t('scanner.users_selected', language)}</div>
                            <div className="text-[10px] text-gray-500 mt-1 truncate" title={customScanTargets.join(', ')}>
                                {customScanTargets.join(', ')}
                            </div>
                            <button
                                onClick={() => setSettings({ scanTargetChatId: '', customScanTargets: [] })}
                                className="mt-2 text-[10px] text-red-400 hover:text-red-300 underline"
                            >
                                {t('scanner.clear_selection', language)}
                            </button>
                        </div>
                    ) : (
                        <div className="mb-4 group">
                            <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1.5 block group-focus-within:text-purple-400 transition-colors">{t('scanner.target_chat', language)}</label>
                            <input
                                type="text"
                                value={scanTargetChatId}
                                onChange={(e) => {
                                    if (isScanning) return;
                                    const val = e.target.value;
                                    setSettings({ scanTargetChatId: val });
                                    // Check if multiple targets
                                    if (val.includes(',')) {
                                        const targets = val.split(',').map(s => s.trim()).filter(Boolean);
                                        if (targets.length > 0) {
                                            setSettings({ scanTargetChatId: 'custom', customScanTargets: targets });
                                        }
                                    }
                                }}
                                className="w-full bg-[#13131f] border border-white/5 rounded-lg px-3 py-2 text-xs text-gray-300 font-mono focus:outline-none focus:border-purple-500/50 transition-all placeholder:text-gray-700"
                                placeholder="@username, 123456, https://t.me/..."
                                disabled={isScanning}
                            />
                            <div className="text-[9px] text-gray-600 mt-1">{t('scanner.multi_target_hint', language)}</div>
                        </div>
                    )}

                    <div className="space-y-4 mb-6">
                        <label className="flex items-center gap-2 cursor-pointer group">
                            <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${scanRecursive ? 'bg-purple-600 border-purple-600' : 'border-gray-600 group-hover:border-gray-500'}`}>
                                {scanRecursive && <Check size={10} className="text-white" />}
                            </div>
                            <input type="checkbox" checked={scanRecursive}
                                onChange={(e) => !isScanning && setSettings({ scanRecursive: e.target.checked })}
                                disabled={isScanning} className="hidden" />
                            <span className="text-xs text-gray-400 group-hover:text-gray-300 transition-colors">{t('scanner.recursive_mapping', language)}</span>
                        </label>

                        <div>
                            <div className="flex justify-between text-[10px] text-gray-500 mb-2">
                                <span>{t('scanner.depth', language)}</span>
                                <span className="text-gray-300 font-mono">{scanDepth}</span>
                            </div>
                            <input type="range" min="1" max="3" value={scanDepth}
                                onChange={(e) => !isScanning && setSettings({ scanDepth: parseInt(e.target.value) })}
                                disabled={isScanning}
                                className="w-full h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-purple-500 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:hover:bg-purple-400" />
                        </div>

                        <div>
                            <div className="flex justify-between text-[10px] text-gray-500 mb-2">
                                <span>{t('scanner.delay', language)}</span>
                                <span className="text-gray-300 font-mono">{scanDelay}s</span>
                            </div>
                            <input type="range" min="0.5" max="5" step="0.1" value={scanDelay}
                                onChange={(e) => !isScanning && setSettings({ scanDelay: parseFloat(e.target.value) })}
                                disabled={isScanning}
                                className="w-full h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-purple-500 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:hover:bg-purple-400" />
                        </div>
                    </div>

                    <button
                        onClick={isScanning ? handleStop : () => startScanForId(scanTargetChatId)}
                        disabled={!isScanning && !scanTargetChatId && scanQueue.length === 0 && customScanTargets.length === 0}
                        className={`w-full py-2.5 rounded-lg text-xs font-semibold tracking-wide uppercase transition-all flex items-center justify-center gap-2 ${isScanning
                            ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20'
                            : 'bg-purple-600 text-white hover:bg-purple-500 shadow-lg shadow-purple-900/20'
                            } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                        {isScanning ? (
                            <>
                                <span className="w-2 h-2 rounded bg-red-400 animate-pulse" /> {t('scanner.stop_scan', language)}
                            </>
                        ) : t('scanner.start_mapping', language)}
                    </button>
                </div>

                {/* Live Feed */}
                <div className="glass-panel flex-1 flex flex-col overflow-hidden bg-[#0a0a0f] border border-white/5">
                    <div className="p-3 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
                        <div className="flex items-center gap-2">
                            <Activity size={12} className="text-purple-400" />
                            <span className="text-xs font-medium text-gray-300">{t('scanner.live_feed', language)}</span>
                        </div>
                        <span className="text-[10px] text-gray-600 font-mono">{logs.length} {t('scanner.events', language)}</span>
                    </div>
                    <div className="flex-1 overflow-y-auto p-3 font-mono text-[10px] space-y-1.5 custom-scrollbar">
                        {logs.length === 0 && (
                            <div className="text-center text-gray-700 py-8 italic">{t('scanner.waiting', language)}</div>
                        )}
                        {logs.slice(-50).map((log, i) => (
                            <div key={i} className="text-gray-400 break-all leading-relaxed pl-2 border-l border-white/5 hover:border-purple-500/30 hover:text-gray-300 transition-colors">
                                {log}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Right Panel - Table */}
            <div className="glass-panel" style={{ flex: 1, padding: '12px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
                    <button
                        onClick={() => setGiftsFilter('all')}
                        style={{
                            padding: '6px 12px',
                            background: giftsFilter === 'all' ? 'rgba(168,85,247,0.3)' : 'rgba(168,85,247,0.1)',
                            color: '#c084fc',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: 600,
                            border: giftsFilter === 'all' ? '1px solid rgba(168,85,247,0.5)' : '1px solid transparent',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                        }}
                    >
                        📊 {stats.total} {t('stats.total', language)}
                    </button>
                    <button
                        onClick={() => setGiftsFilter('targets')}
                        style={{
                            padding: '6px 12px',
                            background: giftsFilter === 'targets' ? 'rgba(239,68,68,0.3)' : 'rgba(239,68,68,0.1)',
                            color: '#fca5a5',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: 500,
                            border: giftsFilter === 'targets' ? '1px solid rgba(239,68,68,0.5)' : '1px solid transparent',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                        }}
                    >
                        🎯 {stats.targets} {t('stats.target', language)}
                    </button>
                    <button
                        onClick={() => setGiftsFilter('gifters')}
                        style={{
                            padding: '6px 12px',
                            background: giftsFilter === 'gifters' ? 'rgba(34,197,94,0.3)' : 'rgba(34,197,94,0.1)',
                            color: '#86efac',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: 500,
                            border: giftsFilter === 'gifters' ? '1px solid rgba(34,197,94,0.5)' : '1px solid transparent',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                        }}
                    >
                        🎁 {stats.gifters} {t('stats.gifter', language)}
                    </button>
                    <button
                        onClick={() => setGiftsFilter('discovered')}
                        style={{
                            padding: '6px 12px',
                            background: giftsFilter === 'discovered' ? 'rgba(249,115,22,0.3)' : 'rgba(249,115,22,0.1)',
                            color: '#fdba74',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: 500,
                            border: giftsFilter === 'discovered' ? '1px solid rgba(249,115,22,0.5)' : '1px solid transparent',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                        }}
                    >
                        🔗 {stats.discovered} {t('stats.discovered', language)}
                    </button>

                    <div style={{ flex: 1 }} />

                    <span style={{ fontSize: '11px', color: '#6b7280' }}>{t('stats.filter', language)}:</span>
                    <select value={giftsFilter} onChange={(e) => setGiftsFilter(e.target.value)}
                        style={{ padding: '4px 8px', background: '#1a1a24', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '4px', fontSize: '11px', color: 'white', cursor: 'pointer' }}>
                        <option value="all" style={{ background: '#1a1a24', color: 'white' }}>🔍 {t('stats.all_users', language)}</option>
                        <option value="targets" style={{ background: '#1a1a24', color: 'white' }}>🎯 {t('stats.targets_only', language)}</option>
                        <option value="discovered" style={{ background: '#1a1a24', color: 'white' }}>🔗 {t('stats.discovered_only', language)}</option>
                        <option value="gifters" style={{ background: '#1a1a24', color: 'white' }}>🎁 {t('stats.gifters_only', language)}</option>
                        <option value="has_gifts" style={{ background: '#1a1a24', color: 'white' }}>💎 {t('stats.with_gifts', language)}</option>
                        {giftRecipients.length > 0 && (
                            <optgroup label={t('stats.gifts_sent_to', language)} style={{ background: '#1a1a24', color: '#a78bfa' }}>
                                {giftRecipients.map(r => (
                                    <option key={r} value={`to:${r}`} style={{ background: '#1a1a24', color: 'white' }}>→ {r}</option>
                                ))}
                            </optgroup>
                        )}
                    </select>

                    <div style={{ position: 'relative' }}>
                        <Search size={12} style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', color: '#6b7280' }} />
                        <input type="text" placeholder="Search..." value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            style={{ paddingLeft: '28px', paddingRight: '8px', paddingTop: '4px', paddingBottom: '4px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', fontSize: '11px', width: '100px', color: 'white' }} />
                    </div>
                </div>

                {/* Table */}
                <div style={{ flex: 1, overflow: 'auto' }}>
                    <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ textAlign: 'left', color: '#6b7280', fontSize: '10px', textTransform: 'uppercase', position: 'sticky', top: 0, background: '#0d0d15' }}>
                                <th style={{ padding: '8px' }}>#</th>
                                <th style={{ padding: '8px' }}>{t('table.user', language)}</th>
                                <th style={{ padding: '8px' }}>{t('table.source', language)}</th>
                                <th style={{ padding: '8px' }}>{t('table.stats', language)}</th>
                                <th style={{ padding: '8px' }}>{t('table.channels', language)}</th>
                                <th style={{ padding: '8px', width: '60px' }}>{t('table.actions', language)}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredUsers.map((user: any, idx: number) => (
                                <tr key={user.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                    <td style={{ padding: '8px', color: '#6b7280' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <ChevronRight size={12} style={{ color: '#6b7280' }} />
                                            {idx + 1}
                                        </div>
                                    </td>
                                    <td style={{ padding: '8px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: user.sourceType === 'target' ? '#ef4444' : user.sourceType === 'gifter' ? '#22c55e' : '#3b82f6' }} />
                                            <span style={{ fontWeight: 500 }}>{user.label || user.id}</span>
                                            {user.sourceType === 'target' && !user.discoveredFrom && (
                                                <span style={{ padding: '2px 6px', background: 'rgba(239,68,68,0.3)', color: '#fca5a5', borderRadius: '4px', fontSize: '10px' }}>{t('labels.target', language)}</span>
                                            )}
                                            {user.discoveredFrom && (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    <span style={{ padding: '2px 6px', background: 'rgba(249,115,22,0.2)', color: '#fdba74', borderRadius: '4px', fontSize: '10px' }}>{t('labels.discovered', language)}</span>
                                                    <span style={{ padding: '2px 6px', background: 'rgba(16,185,129,0.2)', color: '#6ee7b7', borderRadius: '4px', fontSize: '9px' }}>{t('results.via', language)} {user.discoveredFrom}</span>
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                    <td style={{ padding: '8px' }}>
                                        {user.giftsSentTo.length > 0 ? (
                                            <span style={{ color: '#86efac', fontSize: '11px' }}>
                                                → {user.giftsSentTo.slice(0, 2).map((g: any) => g.label).join(', ')}
                                                {user.giftsSentTo.length > 2 && <span style={{ color: '#6b7280' }}> +{user.giftsSentTo.length - 2}</span>}
                                            </span>
                                        ) : <span style={{ color: '#4b5563' }}>—</span>}
                                    </td>
                                    <td style={{ padding: '8px' }}>
                                        <div style={{ display: 'flex', gap: '8px', fontSize: '11px' }}>
                                            {user.totalGiftsSent > 0 && <span style={{ color: '#86efac' }}>↑{user.totalGiftsSent}</span>}
                                            {user.totalGiftsReceived > 0 && <span style={{ color: '#fbbf24' }}>↓{user.totalGiftsReceived}</span>}
                                            {user.totalGiftsSent === 0 && user.totalGiftsReceived === 0 && <span style={{ color: '#4b5563' }}>—</span>}
                                        </div>
                                    </td>
                                    <td style={{ padding: '8px' }}>
                                        {user.channels.length > 0 ? (
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                                {user.channels.slice(0, 2).map((ch: string, i: number) => (
                                                    <span key={i}
                                                        style={{ padding: '2px 6px', background: 'rgba(168,85,247,0.2)', color: '#c084fc', borderRadius: '4px', fontSize: '10px', cursor: 'pointer' }}
                                                        onClick={() => window.open(`https://t.me/${ch.replace('@', '')}`, '_blank')}>
                                                        {ch}
                                                    </span>
                                                ))}
                                                {user.channels.length > 2 && <span style={{ color: '#6b7280', fontSize: '10px' }}>+{user.channels.length - 2}</span>}
                                            </div>
                                        ) : <span style={{ color: '#4b5563' }}>—</span>}
                                    </td>
                                    <td style={{ padding: '8px' }}>
                                        <div style={{ display: 'flex', gap: '4px' }}>
                                            {user.label.startsWith('@') && (
                                                <button onClick={() => window.open(`https://t.me/${user.label.replace('@', '')}`, '_blank')} style={{ padding: '4px', background: 'transparent', border: 'none', cursor: 'pointer' }}>
                                                    <ExternalLink size={14} style={{ color: '#6b7280' }} />
                                                </button>
                                            )}
                                            <button onClick={() => copyToClipboard(user.label, user.id)} style={{ padding: '4px', background: 'transparent', border: 'none', cursor: 'pointer' }}>
                                                {copiedId === user.id ? <Check size={14} style={{ color: '#22c55e' }} /> : <Copy size={14} style={{ color: '#6b7280' }} />}
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {filteredUsers.length === 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '200px', color: '#6b7280' }}>
                            <Activity size={32} style={{ opacity: 0.5, marginBottom: '8px' }} />
                            <div>{t('common.no_users', language)}</div>
                            <div style={{ fontSize: '11px', marginTop: '4px' }}>{t('common.start_scan_hint', language)}</div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
