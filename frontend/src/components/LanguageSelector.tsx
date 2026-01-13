import React from 'react';
import { useStore } from '../store/useStore';
import type { Language } from '../lib/i18n';
import { languageFlags, languageNames } from '../lib/i18n';

export const LanguageSelector: React.FC = () => {
    const { language, setLanguage } = useStore();
    const [isOpen, setIsOpen] = React.useState(false);

    const languages: Language[] = ['tr', 'en', 'ru'];

    return (
        <div style={{ position: 'relative' }}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 10px',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '6px',
                    color: '#9ca3af',
                    fontSize: '12px',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
                    e.currentTarget.style.color = '#fff';
                }}
                onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                    e.currentTarget.style.color = '#9ca3af';
                }}
            >
                <span>{languageFlags[language]}</span>
                <span>{languageNames[language]}</span>
                <span style={{ fontSize: '8px', opacity: 0.6 }}>▼</span>
            </button>

            {isOpen && (
                <>
                    {/* Backdrop */}
                    <div
                        style={{
                            position: 'fixed',
                            inset: 0,
                            zIndex: 998
                        }}
                        onClick={() => setIsOpen(false)}
                    />

                    {/* Dropdown */}
                    <div
                        style={{
                            position: 'absolute',
                            top: '100%',
                            right: 0,
                            marginTop: '4px',
                            background: '#1a1a24',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '8px',
                            boxShadow: '0 10px 40px rgba(0,0,0,0.4)',
                            overflow: 'hidden',
                            zIndex: 999,
                            minWidth: '120px'
                        }}
                    >
                        {languages.map((lang) => (
                            <button
                                key={lang}
                                onClick={() => {
                                    setLanguage(lang);
                                    setIsOpen(false);
                                }}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    width: '100%',
                                    padding: '10px 14px',
                                    background: language === lang ? 'rgba(99,102,241,0.15)' : 'transparent',
                                    border: 'none',
                                    color: language === lang ? '#a5b4fc' : '#9ca3af',
                                    fontSize: '13px',
                                    cursor: 'pointer',
                                    textAlign: 'left',
                                    transition: 'background 0.15s'
                                }}
                                onMouseEnter={(e) => {
                                    if (language !== lang) {
                                        e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                                    }
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.background = language === lang ? 'rgba(99,102,241,0.15)' : 'transparent';
                                }}
                            >
                                <span>{languageFlags[lang]}</span>
                                <span>{languageNames[lang]}</span>
                                {language === lang && (
                                    <span style={{ marginLeft: 'auto', color: '#6366f1' }}>✓</span>
                                )}
                            </button>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
};
