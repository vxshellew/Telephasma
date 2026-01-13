import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { useStore } from '../store/useStore';
import { Search, X, RefreshCcw, Lock, Unlock, Binary, Minimize2, Maximize2, ExternalLink } from 'lucide-react';
import { forceCollide, forceRadial, forceManyBody, forceLink } from 'd3-force';

// --- Uyumlu ve Ayırt Edilebilir Renkler ---
const THEME = {
    bg: '#12141a',
    nodeTarget: '#ff6b6b',      // Canlı kırmızı-mercan
    nodeDiscovered: '#4ecdc4',  // Turkuaz
    nodeChannel: '#a78bfa',     // Mor-lila
    edge: 'rgba(100, 120, 140, 0.3)',
    edgeActive: '#6ee7b7',      // Mint yeşili
    textMain: '#e2e8f0',
    textDim: '#94a3b8',
    panelBg: '#1a1d26',
    panelBorder: 'rgba(255, 255, 255, 0.08)',
};

// --- Types ---
interface AnalystNode {
    id: string;
    label: string;
    type: 'target' | 'discovered' | 'channel';
    val: number;
    x?: number; y?: number; fx?: number; fy?: number;
    connections: string[];
    metrics: { sent: number; recv: number; degree: number };
    meta?: any;
}

interface AnalystLink {
    source: string | any;
    target: string | any;
    value: number;
}

// --- Error Boundary ---
class IntelErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; errorInfo: string }> {
    state = { hasError: false, errorInfo: '' };
    static getDerivedStateFromError(error: any) {
        console.error('NetworkGraph Error:', error);
        return { hasError: true, errorInfo: error?.message || 'Unknown error' };
    }
    componentDidCatch(error: any, info: any) {
        console.error('NetworkGraph Error Details:', error, info);
    }
    render() {
        if (this.state.hasError) {
            return (
                <div className="h-full flex flex-col items-center justify-center text-slate-500 font-sans p-12 text-center select-none" style={{ background: THEME.bg }}>
                    <Binary size={30} className="mb-4 opacity-50" />
                    <h2 className="text-xs font-bold tracking-widest uppercase mb-3">Visualization Error</h2>
                    <p className="text-xs text-slate-600 mb-4">{this.state.errorInfo}</p>
                    <button onClick={() => this.setState({ hasError: false, errorInfo: '' })} className="px-5 py-2 border border-slate-700 bg-slate-800 rounded-lg text-xs font-medium hover:bg-slate-700 text-slate-300 transition-colors">RETRY</button>
                </div>
            );
        }
        return this.props.children;
    }
}

// --- Main Component ---
const NetworkGraphContent: React.FC = () => {
    const { parsedUsers, networkNodePositions, updateNodePosition, clearNodePositions } = useStore();
    const graphRef = useRef<any>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [hoveredId, setHoveredId] = useState<string | null>(null);
    const [layoutMode, setLayoutMode] = useState<'organic' | 'radial'>('organic');
    const [isSimulating, setIsSimulating] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [isPanelMinimized, setIsPanelMinimized] = useState(false);
    const [searchedNodeId, setSearchedNodeId] = useState<string | null>(null);

    const isFirstRender = useRef(true);

    // --- Data Processing ---
    const processedData = useMemo(() => {
        const nodes: AnalystNode[] = [];
        const links: AnalystLink[] = [];
        const nodeMap = new Map<string, AnalystNode>();

        const validUsers = parsedUsers.filter(u =>
            u.sourceType === 'target' || u.channels.length > 0
        );
        const validUserIds = new Set(validUsers.map(u => u.id));

        validUsers.forEach(u => {
            // Preserve previous position from store
            const savedPos = networkNodePositions[u.id];
            const node: AnalystNode = {
                id: u.id,
                label: u.label,
                type: u.sourceType === 'target' ? 'target' : 'discovered',
                val: 8,
                metrics: { sent: u.totalGiftsSent, recv: u.totalGiftsReceived, degree: 0 },
                connections: [],
                meta: u,
                ...(savedPos ? { x: savedPos.x, y: savedPos.y, fx: savedPos.fx, fy: savedPos.fy } : {})
            };
            nodeMap.set(u.id, node);
            nodes.push(node);
        });

        validUsers.forEach(u => {
            u.channels.forEach(ch => {
                const cid = `c_${ch}`;
                if (!nodeMap.has(cid)) {
                    const savedPos = networkNodePositions[cid];
                    const chNode: AnalystNode = {
                        id: cid,
                        label: ch,
                        type: 'channel',
                        val: 7,
                        metrics: { sent: 0, recv: 0, degree: 0 },
                        connections: [],
                        ...(savedPos ? { x: savedPos.x, y: savedPos.y, fx: savedPos.fx, fy: savedPos.fy } : {})
                    };
                    nodeMap.set(cid, chNode);
                    nodes.push(chNode);
                }

                const chNode = nodeMap.get(cid)!;
                const userNode = nodeMap.get(u.id)!;

                links.push({ source: u.id, target: cid, value: 1 });

                if (!chNode.connections.includes(u.id)) chNode.connections.push(u.id);
                if (!userNode.connections.includes(cid)) userNode.connections.push(cid);
                chNode.metrics.degree++;
                userNode.metrics.degree++;
            });
        });

        validUsers.forEach(sender => {
            sender.giftsSentTo.forEach(gift => {
                const recipientId = gift.userId;
                if (validUserIds.has(recipientId)) {
                    links.push({ source: sender.id, target: recipientId, value: gift.count });

                    const sNode = nodeMap.get(sender.id)!;
                    const tNode = nodeMap.get(recipientId)!;

                    if (!sNode.connections.includes(recipientId)) sNode.connections.push(recipientId);
                    if (!tNode.connections.includes(sender.id)) tNode.connections.push(sender.id);
                    sNode.metrics.degree++;
                    tNode.metrics.degree++;
                }
            });
        });

        return { nodes, links };
    }, [parsedUsers]);

    // --- Interaction ---
    const isRelated = useCallback((node: any) => {
        const focusId = selectedId || hoveredId || searchedNodeId;
        if (!focusId) return true;
        if (node.id === focusId) return true;
        const focusNode = processedData.nodes.find(n => n.id === focusId);
        return focusNode?.connections.includes(node.id) || false;
    }, [selectedId, hoveredId, searchedNodeId, processedData.nodes]);

    // Arama fonksiyonu
    const handleSearch = useCallback(() => {
        if (!searchQuery.trim()) {
            setSearchedNodeId(null);
            return;
        }
        const q = searchQuery.toLowerCase();
        const found = processedData.nodes.find(n =>
            n.label.toLowerCase().includes(q) || n.id.toLowerCase().includes(q)
        );
        if (found && graphRef.current) {
            setSearchedNodeId(found.id);
            setSelectedId(found.id);
            // Kamerayı node'a odakla
            const node = graphRef.current.graphData().nodes.find((n: any) => n.id === found.id);
            if (node) {
                graphRef.current.centerAt(node.x, node.y, 800);
                graphRef.current.zoom(2, 800);
            }
        }
    }, [searchQuery, processedData.nodes]);

    const isLinkRelated = useCallback((link: any) => {
        const focusId = selectedId || hoveredId;
        if (!focusId) return true;
        const sId = typeof link.source === 'string' ? link.source : (link.source?.id || link.source);
        const tId = typeof link.target === 'string' ? link.target : (link.target?.id || link.target);
        return sId === focusId || tId === focusId;
    }, [selectedId, hoveredId]);

    const onNodeClick = useCallback((node: any) => {
        if (!node) return;
        setSelectedId(node.id);
        setIsPanelMinimized(false);
        // Kameraya müdahale etme - kullanıcı kendi kontrol etsin
    }, []);

    // Node sürüklendiğinde pozisyonu sabitle
    const onNodeDragEnd = useCallback((node: any) => {
        if (!node) return;
        node.fx = node.x;
        node.fy = node.y;
        updateNodePosition(node.id, { x: node.x, y: node.y, fx: node.x, fy: node.y });
    }, [updateNodePosition]);

    // --- Render Node ---
    const paintNode = useCallback((node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
        const related = isRelated(node);
        const selected = selectedId === node.id;
        const hovered = hoveredId === node.id;
        const viewingAny = selectedId || hoveredId;

        ctx.globalAlpha = (!related && viewingAny) ? 0.2 : 1.0;

        const size = node.val;
        let color = THEME.textDim;
        if (node.type === 'target') color = THEME.nodeTarget;
        else if (node.type === 'channel') color = THEME.nodeChannel;
        else if (node.type === 'discovered') color = THEME.nodeDiscovered;

        // Glow efekti
        if (selected || hovered) {
            ctx.beginPath();
            ctx.arc(node.x, node.y, size + 4, 0, 2 * Math.PI);
            ctx.fillStyle = color + '40';
            ctx.fill();
        }

        ctx.beginPath();
        if (node.type === 'channel') {
            const s = size * 0.9;
            ctx.rect(node.x - s, node.y - s, s * 2, s * 2);
        } else {
            ctx.arc(node.x, node.y, size, 0, 2 * Math.PI);
        }

        ctx.fillStyle = color;
        ctx.fill();

        ctx.lineWidth = (selected || hovered) ? 2 : 1;
        ctx.strokeStyle = (selected || hovered) ? '#ffffff' : 'rgba(0,0,0,0.4)';
        ctx.stroke();

        // İsimleri göster - zoom seviyesine göre
        const showLabel = globalScale > 0.8 || selected || hovered;
        if (showLabel) {
            const fontSize = Math.max(10, Math.min(14, 12 / globalScale));
            ctx.font = `600 ${fontSize}px 'Inter', system-ui, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';

            // Arka plan kutucuğu - okunabilirlik için
            const text = node.label;
            const textWidth = ctx.measureText(text).width;
            const padding = 3;
            const bgHeight = fontSize + 4;

            ctx.fillStyle = 'rgba(18, 20, 26, 0.85)';
            ctx.fillRect(
                node.x - textWidth / 2 - padding,
                node.y + size + 4,
                textWidth + padding * 2,
                bgHeight
            );

            ctx.fillStyle = THEME.textMain;
            ctx.fillText(text, node.x, node.y + size + 6);
        }

        ctx.globalAlpha = 1.0;
    }, [selectedId, hoveredId, isRelated]);

    // --- Render Link ---
    const paintLink = useCallback((link: any, ctx: CanvasRenderingContext2D) => {
        const active = isLinkRelated(link);
        const viewingAny = selectedId || hoveredId;

        ctx.globalAlpha = (!active && viewingAny) ? 0.1 : (active ? 0.8 : 0.35);
        ctx.beginPath();
        ctx.strokeStyle = active ? THEME.edgeActive : THEME.edge;
        ctx.lineWidth = active ? 2 : 1;

        const s = link.source, t = link.target;
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(t.x, t.y);
        ctx.stroke();
    }, [selectedId, hoveredId, isLinkRelated]);

    // --- Sizing ---
    useEffect(() => {
        if (!containerRef.current) return;
        const obs = new ResizeObserver(() => {
            if (containerRef.current) setDimensions({ width: containerRef.current.offsetWidth, height: containerRef.current.offsetHeight });
        });
        obs.observe(containerRef.current);
        return () => obs.disconnect();
    }, []);

    // --- Physics (sadece ilk yüklemede reheat) ---
    useEffect(() => {
        const g = graphRef.current;
        if (!g || !isSimulating || !g.d3Force) return;

        g.d3Force('collide', forceCollide((n: any) => n.val + 20).strength(0.8));
        g.d3Force('charge', forceManyBody().strength(-250).distanceMax(500));
        g.d3Force('link', forceLink().id((d: any) => d.id).distance(80));

        if (layoutMode === 'radial') {
            g.d3Force('radial', forceRadial((n: any) => n.type === 'channel' ? 200 : 100).strength(0.3));
        } else {
            g.d3Force('radial', null);
        }

        // Sadece ilk render'da reheat yap
        if (isFirstRender.current) {
            g.d3ReheatSimulation();
            isFirstRender.current = false;
        }
    }, [isSimulating, layoutMode]);

    // Save node positions when data changes (but don't move camera)
    useEffect(() => {
        const g = graphRef.current;
        if (!g || typeof g.graphData !== 'function') return;

        // Save current node positions
        const currentNodes = g.graphData()?.nodes || [];
        currentNodes.forEach((n: any) => {
            if (n.x !== undefined && n.y !== undefined) {
                updateNodePosition(n.id, { x: n.x, y: n.y, fx: n.fx, fy: n.fy });
            }
        });
    }, [processedData, updateNodePosition]);

    const selectedNode = selectedId ? processedData.nodes.find(n => n.id === selectedId) : null;

    const getTelegramUsername = (label: string) => {
        return label.replace(/^[@]/, '').replace(/^[cu]_/, '');
    };

    return (
        <div className="h-full flex flex-col font-sans select-none overflow-hidden relative" style={{ background: THEME.bg }}>

            {/* Toolbar */}
            <div className="absolute top-4 left-5 right-5 flex items-center justify-between z-20 pointer-events-none">
                <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl pointer-events-auto" style={{ background: THEME.panelBg, border: `1px solid ${THEME.panelBorder}` }}>
                    <span className="text-xs font-semibold tracking-wide" style={{ color: THEME.textDim }}>NETWORK</span>
                    <div className="h-4 w-px" style={{ background: THEME.panelBorder }} />
                    <button onClick={() => setLayoutMode(m => m === 'organic' ? 'radial' : 'organic')} className="text-xs font-medium uppercase hover:opacity-80 transition-opacity" style={{ color: THEME.textMain }}>
                        {layoutMode === 'organic' ? 'ORGANIC' : 'RADIAL'}
                    </button>
                    <div className="h-4 w-px" style={{ background: THEME.panelBorder }} />
                    <button onClick={() => setIsSimulating(!isSimulating)} className="hover:opacity-80 transition-opacity" style={{ color: THEME.textDim }}>
                        {isSimulating ? <Lock size={14} /> : <Unlock size={14} />}
                    </button>
                    <button onClick={() => {
                        const g = graphRef.current;
                        if (g) {
                            const nodes = g.graphData()?.nodes || [];
                            nodes.forEach((n: any) => { n.fx = undefined; n.fy = undefined; });
                            clearNodePositions();
                            isFirstRender.current = true;
                            g.d3ReheatSimulation();
                        }
                    }} className="hover:opacity-80 transition-opacity" style={{ color: THEME.textDim }}>
                        <RefreshCcw size={14} />
                    </button>
                </div>

                <div className="pointer-events-auto">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 cursor-pointer hover:opacity-80" size={14} style={{ color: THEME.textDim }} onClick={handleSearch} />
                        <input
                            className="rounded-xl pl-9 pr-4 py-2.5 text-xs outline-none transition-all"
                            style={{
                                background: THEME.panelBg,
                                border: `1px solid ${THEME.panelBorder}`,
                                color: THEME.textMain,
                                width: '180px'
                            }}
                            placeholder="Ara... (Enter)"
                            value={searchQuery}
                            onChange={e => {
                                setSearchQuery(e.target.value);
                                if (!e.target.value) setSearchedNodeId(null);
                            }}
                            onKeyDown={e => {
                                if (e.key === 'Enter') handleSearch();
                            }}
                        />
                    </div>
                </div>
            </div>

            {/* Graph */}
            <div ref={containerRef} className="flex-1 relative cursor-grab active:cursor-grabbing">
                <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)', backgroundSize: '24px 24px' }} />

                {/* Empty State */}
                {processedData.nodes.length === 0 && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <Binary size={40} className="mb-4 opacity-30" style={{ color: THEME.textDim }} />
                        <h3 className="text-sm font-medium mb-2" style={{ color: THEME.textDim }}>No Network Data</h3>
                        <p className="text-xs text-center max-w-xs" style={{ color: THEME.textDim, opacity: 0.7 }}>
                            Start a scan from the Live Scan tab to visualize user relationships and gift networks.
                        </p>
                    </div>
                )}

                {dimensions.width > 0 && processedData.nodes.length > 0 && (
                    <ForceGraph2D
                        ref={graphRef}
                        width={dimensions.width}
                        height={dimensions.height}
                        graphData={processedData}
                        nodeCanvasObject={paintNode}
                        linkCanvasObject={paintLink}
                        onNodeClick={onNodeClick}
                        onNodeDragEnd={onNodeDragEnd}
                        onNodeHover={n => setHoveredId(n?.id || null)}
                        backgroundColor="transparent"
                        d3AlphaDecay={0.02}
                        d3VelocityDecay={0.4}
                        cooldownTicks={100}
                        enableNodeDrag={true}
                    />
                )}

                {/* Legend */}
                <div className="absolute bottom-5 left-5 flex flex-col gap-2 p-3 rounded-xl text-xs font-medium" style={{ background: THEME.panelBg, border: `1px solid ${THEME.panelBorder}`, color: THEME.textDim }}>
                    <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full" style={{ background: THEME.nodeTarget }} /> TARGET</div>
                    <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full" style={{ background: THEME.nodeDiscovered }} /> DISCOVERED</div>
                    <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-sm" style={{ background: THEME.nodeChannel }} /> CHANNEL</div>
                </div>
            </div>

            {/* Detail Panel */}
            {selectedNode && (
                <div className={`absolute right-5 top-20 transition-all duration-300 z-30 ${isPanelMinimized ? 'w-auto' : 'w-80'} rounded-2xl flex flex-col overflow-hidden`} style={{ background: THEME.panelBg, border: `1px solid ${THEME.panelBorder}` }}>
                    <div className="p-4 flex items-center justify-between" style={{ borderBottom: `1px solid ${THEME.panelBorder}` }}>
                        <h3 className="font-semibold text-sm truncate max-w-[200px]" style={{ color: THEME.textMain }}>{selectedNode.label}</h3>
                        <div className="flex gap-1">
                            <button onClick={() => setIsPanelMinimized(!isPanelMinimized)} className="p-1.5 rounded-lg hover:opacity-80 transition-opacity" style={{ color: THEME.textDim }}>
                                {isPanelMinimized ? <Maximize2 size={13} /> : <Minimize2 size={13} />}
                            </button>
                            <button onClick={() => setSelectedId(null)} className="p-1.5 rounded-lg hover:opacity-80 transition-opacity" style={{ color: THEME.textDim }}>
                                <X size={13} />
                            </button>
                        </div>
                    </div>

                    {!isPanelMinimized && (
                        <div className="p-5 space-y-5">
                            <div className="flex justify-center">
                                <div className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl" style={{ background: selectedNode.type === 'channel' ? 'rgba(167,139,250,0.15)' : 'rgba(78,205,196,0.15)' }}>
                                    {selectedNode.type === 'channel' ? '📢' : '👤'}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3 text-center">
                                <div className="p-3 rounded-xl" style={{ background: 'rgba(110,231,183,0.1)', border: '1px solid rgba(110,231,183,0.2)' }}>
                                    <div className="text-[10px] font-semibold uppercase" style={{ color: THEME.textDim }}>Sent</div>
                                    <div className="text-lg font-bold" style={{ color: '#6ee7b7' }}>{selectedNode.metrics.sent}</div>
                                </div>
                                <div className="p-3 rounded-xl" style={{ background: 'rgba(78,205,196,0.1)', border: '1px solid rgba(78,205,196,0.2)' }}>
                                    <div className="text-[10px] font-semibold uppercase" style={{ color: THEME.textDim }}>Received</div>
                                    <div className="text-lg font-bold" style={{ color: '#4ecdc4' }}>{selectedNode.metrics.recv}</div>
                                </div>
                            </div>

                            <button
                                onClick={() => {
                                    const username = getTelegramUsername(selectedNode.label);
                                    if (username) {
                                        window.open(`https://t.me/${username}`, '_blank');
                                    }
                                }}
                                className="w-full py-2.5 text-xs font-semibold rounded-xl flex items-center justify-center gap-2 transition-all hover:opacity-90"
                                style={{
                                    background: 'rgba(78,205,196,0.15)',
                                    border: '1px solid rgba(78,205,196,0.3)',
                                    color: '#4ecdc4'
                                }}
                            >
                                <ExternalLink size={13} /> OPEN IN TELEGRAM
                            </button>

                            {selectedNode.meta?.bio && (
                                <div
                                    className="text-xs p-3 rounded-xl select-text cursor-text"
                                    style={{ background: 'rgba(148,163,184,0.08)', color: THEME.textDim }}
                                >
                                    {selectedNode.meta.bio}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export const NetworkGraph = () => (
    <IntelErrorBoundary>
        <NetworkGraphContent />
    </IntelErrorBoundary>
);
