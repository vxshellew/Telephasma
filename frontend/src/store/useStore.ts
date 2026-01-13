import { create } from 'zustand';
import type { Language } from '../lib/i18n';

// --- Specialized Internal Types ---
export interface User {
    id: number;
    username?: string;
    first_name?: string;
    bio?: string;
    depth?: number;
    type?: string;
    channel_links?: string[];
    gifts?: Gift[];
}

export interface Gift {
    id: number;
    sender_id?: number;
    date?: string;
    stars?: number;
    message?: string;
}

export interface GraphNode {
    id: string;
    label: string;
    group: string;
    val: number;
    title?: string;
    color?: string;
    isTarget?: boolean;
}

export interface GraphLink {
    source: string;
    target: string;
    value?: number;
    label?: string;
}

export interface ParsedUser {
    id: string;
    label: string;
    bio?: string;
    channels: string[];
    sourceType: 'target' | 'gifter' | 'discovered';
    depth: number;
    giftsSentTo: { userId: string; label: string; count: number }[];
    giftsReceivedFrom: { userId: string; label: string; count: number }[];
    totalGiftsSent: number;
    totalGiftsReceived: number;
    discoveredFrom?: string; // Metadata for "Via @User"
    commonGroupCount?: number; // Metadata for "X Common"
}

interface AppState {
    isAuthenticated: boolean;
    currentUser: User | null;

    activeTab: 'discovery' | 'scanner' | 'results' | 'network';
    scanQueue: string[];
    customScanTargets: string[];

    scanTargetChatId: string;
    scanRecursive: boolean;
    scanDepth: number;
    scanDelay: number;

    isScanning: boolean;
    scannedUsers: User[];
    graphData: { nodes: GraphNode[]; links: GraphLink[] };
    parsedUsers: ParsedUser[]; // Centralized Intelligence
    logs: string[];
    language: Language;

    // Network Graph Node Positions (persisted across tab switches)
    networkNodePositions: Record<string, { x: number; y: number; fx?: number; fy?: number }>;

    // Actions
    setAuth: (user: User) => void;
    setSettings: (settings: Partial<AppState>) => void;
    setActiveTab: (tab: 'discovery' | 'scanner' | 'results' | 'network') => void;
    startScan: () => void;
    stopScan: () => void;
    addLog: (msg: string) => void;
    processScanUpdate: (data: any) => void;
    setScanQueue: (queue: string[]) => void;
    setLanguage: (lang: Language) => void;
    updateNodePosition: (nodeId: string, position: { x: number; y: number; fx?: number; fy?: number }) => void;
    clearNodePositions: () => void;
}

export const useStore = create<AppState>((set, get) => ({
    isAuthenticated: false,
    currentUser: null,

    activeTab: 'discovery',
    scanQueue: [],
    customScanTargets: [],

    scanTargetChatId: '',
    scanRecursive: true,
    scanDepth: 3, // Increased default depth for recursive chaining
    scanDelay: 1.5,

    isScanning: false,
    scannedUsers: [],
    graphData: { nodes: [], links: [] },
    parsedUsers: [],
    logs: [],
    language: (localStorage.getItem('language') as Language) || 'tr',
    networkNodePositions: {},

    setAuth: (user) => set({ isAuthenticated: true, currentUser: user }),
    setSettings: (settings) => set((s) => ({ ...s, ...settings })),
    setActiveTab: (tab) => set({ activeTab: tab as any }),

    startScan: () => set({
        isScanning: true,
        scannedUsers: [],
        graphData: { nodes: [], links: [] },
        parsedUsers: [],
        logs: ["SCAN_INITIATED"]
    }),

    stopScan: () => set({
        isScanning: false,
        logs: [...get().logs, "SCAN_HALTED"]
    }),

    addLog: (msg) => set((s) => ({ logs: [...s.logs, msg] })),

    // --- High-Performance Update Engine ---
    processScanUpdate: (update) => {
        const state = get();
        const nodeMap = new Map(state.graphData.nodes.map(n => [n.id, { ...n }]));
        const linkMap = new Map(state.graphData.links.map(l => {
            const s = typeof l.source === 'string' ? l.source : (l.source as any).id;
            const t = typeof l.target === 'string' ? l.target : (l.target as any).id;
            return [`${s}-${t}`, { ...l }];
        }));
        let logs = [...state.logs];

        if (update.type === 'log') {
            set({ logs: [...logs, update.message] });
            return;
        }

        if (update.type === 'user_found' || update.type === 'user_detail') {
            const data = update.data;
            const uid = `u_${data.id}`;
            const label = data.username ? `@${data.username}` : (data.first_name || `U_${data.id}`);

            // New: Handle discovered_from
            const discoveredFrom = data.discovered_from || null;

            if (nodeMap.has(uid)) {
                const node = nodeMap.get(uid)!;
                if (data.username) node.label = label;
                if (data.type) node.group = data.type;
                if (data.bio) node.title = data.bio;
                // If discovered_from is missing/null, it means they are from the initial scan target list
                if (!node.isTarget && !data.discovered_from) node.isTarget = true;

                // Update discoveredFrom if we didn't have it and now we do (and preserve it if we did)
                if (discoveredFrom && !(node as any).discoveredFrom) {
                    (node as any).discoveredFrom = discoveredFrom;
                }
            } else {
                nodeMap.set(uid, {
                    id: uid, label: label, group: data.type || 'member',
                    val: data.depth === 0 ? 8 : 4.5, title: data.bio || '',
                    isTarget: !data.discovered_from, // Mark as target if no parent
                    ...({ discoveredFrom } as any) // Store metadata
                });
            }

            if (update.type === 'user_detail' && data.channel_links) {
                data.channel_links.forEach((clink: string) => {
                    const cid = `c_${clink}`;
                    if (!nodeMap.has(cid)) {
                        nodeMap.set(cid, { id: cid, label: `@${clink}`, group: 'channel', val: 6 });
                    }
                    const lkey = `${uid}-${cid}`;
                    if (!linkMap.has(lkey)) {
                        linkMap.set(lkey, { source: uid, target: cid, value: 1 });
                    }
                });
            }
        }

        if (update.type === 'user_gifts') {
            const { user_id, gifts, resolved_users } = update.data;
            const targetId = `u_${user_id}`;

            gifts.forEach((g: any) => {
                if (!g.sender_id) return;
                const srcId = `u_${g.sender_id}`;

                // Create or update sender node with proper naming from resolved_users
                if (!nodeMap.has(srcId)) {
                    const resolvedSender = resolved_users?.[g.sender_id];
                    let senderLabel = `U_${g.sender_id}`;

                    if (resolvedSender) {
                        if (resolvedSender.username) {
                            senderLabel = `@${resolvedSender.username}`;
                        } else if (resolvedSender.first_name) {
                            senderLabel = resolvedSender.first_name;
                        }
                    }

                    nodeMap.set(srcId, {
                        id: srcId,
                        label: senderLabel,
                        group: 'potential_gifter',
                        val: 3
                    });
                } else {
                    // Update existing node with better name if we have it and it's still a U_ID
                    const existingNode = nodeMap.get(srcId)!;
                    const resolvedSender = resolved_users?.[g.sender_id];

                    if (resolvedSender && existingNode.label.startsWith('U_')) {
                        if (resolvedSender.username) {
                            existingNode.label = `@${resolvedSender.username}`;
                        } else if (resolvedSender.first_name) {
                            existingNode.label = resolvedSender.first_name;
                        }
                    }
                }

                const lkey = `${srcId}-${targetId}`;
                if (linkMap.has(lkey)) {
                    const l = linkMap.get(lkey)!;
                    l.value = (l.value || 0) + 1;
                    l.label = `${l.value} GIFTS`;
                } else {
                    linkMap.set(lkey, { source: srcId, target: targetId, value: 1, label: '1 GIFT' });
                }
            });
        }

        // --- Optimized ParsedUser Generation (Single Pass) ---
        const finalNodes = Array.from(nodeMap.values());
        const finalLinks = Array.from(linkMap.values());

        const userPool = new Map<string, ParsedUser>();
        finalNodes.forEach(n => {
            if (n.group === 'channel') return;
            userPool.set(n.id, {
                id: n.id,
                label: n.label,
                bio: n.title,
                channels: [],
                sourceType: n.isTarget ? 'target' : 'discovered',
                depth: 0,
                giftsSentTo: [],
                giftsReceivedFrom: [],
                totalGiftsSent: 0,
                totalGiftsReceived: 0,
                discoveredFrom: (n as any).discoveredFrom // Map metadata to UI model
            });
        });

        finalLinks.forEach(l => {
            const s = typeof l.source === 'string' ? l.source : (l.source as any).id;
            const t = typeof l.target === 'string' ? l.target : (l.target as any).id;
            const sender = userPool.get(s);
            const receiver = userPool.get(t);

            if (t.startsWith('c_') && sender) {
                const chNode = nodeMap.get(t);
                if (chNode) sender.channels.push(chNode.label);
            } else if (sender && receiver) {
                const count = l.value || 1;
                sender.giftsSentTo.push({ userId: t, label: receiver.label, count });
                sender.totalGiftsSent += count;
                receiver.giftsReceivedFrom.push({ userId: s, label: sender.label, count });
                receiver.totalGiftsReceived += count;
                if (sender.sourceType === 'discovered') sender.sourceType = 'gifter';
            }
        });

        set({
            graphData: { nodes: finalNodes, links: finalLinks },
            parsedUsers: Array.from(userPool.values()),
            logs
        });
    },
    setScanQueue: (queue) => set({ scanQueue: queue }),
    setLanguage: (lang) => {
        localStorage.setItem('language', lang);
        set({ language: lang });
    },
    updateNodePosition: (nodeId, position) => set((s) => ({
        networkNodePositions: { ...s.networkNodePositions, [nodeId]: position }
    })),
    clearNodePositions: () => set({ networkNodePositions: {} })
}));
