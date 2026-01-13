import React from 'react';
import { useStore } from '../store/useStore';
import { Scanner } from './Scanner';
import { Discovery } from './Discovery';
import { ResultsPanel } from './ResultsPanel';
import { NetworkGraph } from './NetworkGraph';
import { LanguageSelector } from './LanguageSelector';
import { t } from '../lib/i18n';

import { Search, Activity, Table } from 'lucide-react';

export const Dashboard: React.FC = () => {
    const { activeTab, setActiveTab, language } = useStore();

    return (
        <div className="flex flex-col h-screen w-full bg-background overflow-hidden">
            {/* Top Navigation */}
            <div className="h-14 border-b border-white/10 flex items-center px-4 justify-between bg-black/20 backdrop-blur-sm">
                <div className="flex items-center gap-6">
                    <h1 className="font-bold text-xl bg-clip-text text-transparent bg-gradient-to-r from-primary to-purple-400">
                        Telephasma
                    </h1>

                    <div className="flex items-center gap-1 bg-white/5 p-1 rounded-lg">
                        <button
                            onClick={() => setActiveTab('discovery')}
                            className={`px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-2 transition-all ${activeTab === 'discovery' ? 'bg-primary text-white shadow-lg' : 'text-gray-400 hover:text-white'
                                }`}
                        >
                            <Search className="w-4 h-4" /> {t('nav.discovery', language)}
                        </button>
                        <button
                            onClick={() => setActiveTab('scanner')}
                            className={`px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-2 transition-all ${activeTab === 'scanner' ? 'bg-primary text-white shadow-lg' : 'text-gray-400 hover:text-white'
                                }`}
                        >
                            <Activity className="w-4 h-4" /> {t('nav.live_scan', language)}
                        </button>
                        <button
                            onClick={() => setActiveTab('results')}
                            className={`px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-2 transition-all ${activeTab === 'results' ? 'bg-primary text-white shadow-lg' : 'text-gray-400 hover:text-white'
                                }`}
                        >
                            <Table className="w-4 h-4" /> {t('nav.results', language)}
                        </button>
                        <button
                            onClick={() => setActiveTab('network')}
                            className={`px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-2 transition-all ${activeTab === 'network' ? 'bg-primary text-white shadow-lg' : 'text-gray-400 hover:text-white'
                                }`}
                        >
                            <Activity className="w-4 h-4" /> {t('nav.network', language)}
                        </button>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <LanguageSelector />
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-hidden p-4">
                {activeTab === 'discovery' && (
                    <Discovery />
                )}

                {activeTab === 'scanner' && (
                    <div className="h-full w-full">
                        <Scanner />
                    </div>
                )}

                {activeTab === 'results' && (
                    <div className="h-full w-full">
                        <ResultsPanel />
                    </div>
                )}

                {activeTab === 'network' && (
                    <div className="h-full w-full">
                        <NetworkGraph />
                    </div>
                )}


            </div>
        </div>
    );
};
