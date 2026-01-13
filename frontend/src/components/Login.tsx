import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '../store/useStore';
import axios from 'axios';
import { Loader2 } from 'lucide-react';
import { t } from '../lib/i18n';
import type { Language } from '../lib/i18n';
import { languageFlags, languageNames } from '../lib/i18n';

export const Login: React.FC = () => {
    const [step, setStep] = useState<'phone' | 'code' | 'password'>('phone');
    const [phone, setPhone] = useState('');
    const [code, setCode] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const [apiId, setApiId] = useState(() => localStorage.getItem('apiId') || '');
    const [apiHash, setApiHash] = useState(() => localStorage.getItem('apiHash') || '');

    const { setAuth, language, setLanguage } = useStore();
    const [langMenuOpen, setLangMenuOpen] = useState(false);

    const languages: Language[] = ['tr', 'en', 'ru'];

    const handlePhoneSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        localStorage.setItem('apiId', apiId);
        localStorage.setItem('apiHash', apiHash);

        try {
            await axios.post('http://localhost:8000/api/login', {
                phone,
                api_id: apiId,
                api_hash: apiHash
            });
            setStep('code');
        } catch (err: any) {
            console.error(err);
            setError(err.response?.data?.detail || err.message || t('login.error_connection', language));
        }
        setLoading(false);
    };

    const handleCodeSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            const res = await axios.post('http://localhost:8000/api/verify', { phone, code });
            // Check if 2FA is required (backend returns status: "2fa_required")
            if (res.data.status === '2fa_required') {
                setStep('password');
            } else {
                setAuth(res.data.user);
            }
        } catch (err: any) {
            // Also check error response for 2FA requirement
            if (err.response?.data?.detail?.includes("2FA") ||
                err.response?.data?.status === '2fa_required') {
                setStep('password');
            } else {
                setError(err.response?.data?.detail || t('login.error_invalid_code', language));
            }
        }
        setLoading(false);
    };

    const handlePasswordSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await axios.post('http://localhost:8000/api/verify', { phone, code, password });
            setAuth(res.data.user);
        } catch (err) {
            setError(t('login.error_invalid_password', language));
        }
        setLoading(false);
    };

    const inputStyle = {
        width: '100%',
        padding: '10px 12px',
        background: 'rgba(0,0,0,0.3)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '8px',
        color: '#fff',
        fontSize: '13px',
        outline: 'none',
        transition: 'border-color 0.2s'
    };

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #0f0f14 0%, #1a1a24 50%, #0d0d12 100%)',
            fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif"
        }}>
            {/* Subtle grid pattern */}
            <div style={{
                position: 'absolute',
                inset: 0,
                backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.03) 1px, transparent 0)',
                backgroundSize: '40px 40px',
                pointerEvents: 'none'
            }} />

            {/* Language Selector - Top Right */}
            <div style={{ position: 'absolute', top: '20px', right: '20px', zIndex: 100 }}>
                <button
                    onClick={() => setLangMenuOpen(!langMenuOpen)}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '8px 12px',
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '8px',
                        color: '#9ca3af',
                        fontSize: '13px',
                        cursor: 'pointer'
                    }}
                >
                    <span>{languageFlags[language]}</span>
                    <span>{languageNames[language]}</span>
                </button>

                {langMenuOpen && (
                    <>
                        <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={() => setLangMenuOpen(false)} />
                        <div style={{
                            position: 'absolute',
                            top: '100%',
                            right: 0,
                            marginTop: '4px',
                            background: '#1a1a24',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '8px',
                            boxShadow: '0 10px 40px rgba(0,0,0,0.4)',
                            overflow: 'hidden',
                            zIndex: 100,
                            minWidth: '120px'
                        }}>
                            {languages.map((lang) => (
                                <button
                                    key={lang}
                                    onClick={() => { setLanguage(lang); setLangMenuOpen(false); }}
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
                                        textAlign: 'left'
                                    }}
                                >
                                    <span>{languageFlags[lang]}</span>
                                    <span>{languageNames[lang]}</span>
                                    {language === lang && <span style={{ marginLeft: 'auto', color: '#6366f1' }}>✓</span>}
                                </button>
                            ))}
                        </div>
                    </>
                )}
            </div>

            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                style={{
                    width: '100%',
                    maxWidth: '380px',
                    padding: '40px',
                    background: 'rgba(20, 20, 28, 0.8)',
                    borderRadius: '16px',
                    border: '1px solid rgba(255,255,255,0.06)',
                    boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
                    backdropFilter: 'blur(20px)',
                    position: 'relative',
                    zIndex: 1
                }}
            >
                {/* Simple Logo */}
                <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                    <div style={{
                        width: '48px',
                        height: '48px',
                        margin: '0 auto 16px',
                        background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                        borderRadius: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '20px',
                        fontWeight: 700,
                        color: 'white',
                        letterSpacing: '-1px'
                    }}>
                        T
                    </div>
                    <h1 style={{
                        fontSize: '22px',
                        fontWeight: 600,
                        color: '#fff',
                        marginBottom: '4px',
                        letterSpacing: '-0.5px'
                    }}>
                        {t('login.title', language)}
                    </h1>
                    <p style={{ fontSize: '13px', color: '#6b7280' }}>
                        {step === 'phone' && t('login.subtitle_phone', language)}
                        {step === 'code' && t('login.subtitle_code', language)}
                        {step === 'password' && t('login.subtitle_password', language)}
                    </p>
                </div>

                <AnimatePresence mode="wait">
                    {step === 'phone' && (
                        <motion.form
                            key="phone"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onSubmit={handlePhoneSubmit}
                        >
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '11px', color: '#9ca3af', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                        {t('login.api_id', language)}
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={apiId}
                                        onChange={(e) => setApiId(e.target.value)}
                                        style={inputStyle}
                                        onFocus={(e) => e.target.style.borderColor = 'rgba(99,102,241,0.5)'}
                                        onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '11px', color: '#9ca3af', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                        {t('login.api_hash', language)}
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={apiHash}
                                        onChange={(e) => setApiHash(e.target.value)}
                                        style={inputStyle}
                                        onFocus={(e) => e.target.style.borderColor = 'rgba(99,102,241,0.5)'}
                                        onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}
                                    />
                                </div>
                            </div>

                            <div style={{ marginBottom: '20px' }}>
                                <label style={{ display: 'block', fontSize: '11px', color: '#9ca3af', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                    {t('login.phone', language)}
                                </label>
                                <input
                                    type="tel"
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    placeholder={t('login.phone_placeholder', language)}
                                    style={{ ...inputStyle, padding: '12px 14px', fontSize: '14px' }}
                                    onFocus={(e) => e.target.style.borderColor = 'rgba(99,102,241,0.5)'}
                                    onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                style={{
                                    width: '100%',
                                    padding: '12px',
                                    background: loading ? '#4f46e5' : 'linear-gradient(135deg, #6366f1 0%, #7c3aed 100%)',
                                    border: 'none',
                                    borderRadius: '8px',
                                    color: '#fff',
                                    fontSize: '14px',
                                    fontWeight: 500,
                                    cursor: loading ? 'wait' : 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '8px',
                                    transition: 'opacity 0.2s'
                                }}
                            >
                                {loading ? <Loader2 style={{ width: 18, height: 18, animation: 'spin 1s linear infinite' }} /> : t('login.send_code', language)}
                            </button>
                        </motion.form>
                    )}

                    {step === 'code' && (
                        <motion.form
                            key="code"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onSubmit={handleCodeSubmit}
                        >
                            <div style={{ marginBottom: '20px' }}>
                                <label style={{ display: 'block', fontSize: '11px', color: '#9ca3af', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                    {t('login.verification_code', language)}
                                </label>
                                <input
                                    type="text"
                                    value={code}
                                    onChange={(e) => setCode(e.target.value)}
                                    placeholder="12345"
                                    style={{
                                        ...inputStyle,
                                        padding: '14px',
                                        fontSize: '20px',
                                        fontWeight: 500,
                                        textAlign: 'center',
                                        letterSpacing: '8px'
                                    }}
                                    onFocus={(e) => e.target.style.borderColor = 'rgba(99,102,241,0.5)'}
                                    onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}
                                />
                                <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '8px', textAlign: 'center' }}>
                                    {t('login.code_hint', language)}
                                </p>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                style={{
                                    width: '100%',
                                    padding: '12px',
                                    background: 'linear-gradient(135deg, #6366f1 0%, #7c3aed 100%)',
                                    border: 'none',
                                    borderRadius: '8px',
                                    color: '#fff',
                                    fontSize: '14px',
                                    fontWeight: 500,
                                    cursor: loading ? 'wait' : 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '8px'
                                }}
                            >
                                {loading ? <Loader2 style={{ width: 18, height: 18, animation: 'spin 1s linear infinite' }} /> : t('login.verify', language)}
                            </button>

                            <button
                                type="button"
                                onClick={() => setStep('phone')}
                                style={{
                                    width: '100%',
                                    marginTop: '12px',
                                    padding: '10px',
                                    background: 'transparent',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: '8px',
                                    color: '#9ca3af',
                                    fontSize: '13px',
                                    cursor: 'pointer'
                                }}
                            >
                                {t('login.back', language)}
                            </button>
                        </motion.form>
                    )}

                    {step === 'password' && (
                        <motion.form
                            key="password"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onSubmit={handlePasswordSubmit}
                        >
                            <div style={{
                                padding: '10px 14px',
                                background: 'rgba(234,179,8,0.1)',
                                border: '1px solid rgba(234,179,8,0.2)',
                                borderRadius: '8px',
                                marginBottom: '16px'
                            }}>
                                <p style={{ fontSize: '12px', color: '#fbbf24', textAlign: 'center' }}>
                                    {t('login.twofa_detected', language)}
                                </p>
                            </div>

                            <div style={{ marginBottom: '20px' }}>
                                <label style={{ display: 'block', fontSize: '11px', color: '#9ca3af', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                    {t('login.cloud_password', language)}
                                </label>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    style={{ ...inputStyle, padding: '12px 14px', fontSize: '14px' }}
                                    onFocus={(e) => e.target.style.borderColor = 'rgba(99,102,241,0.5)'}
                                    onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                style={{
                                    width: '100%',
                                    padding: '12px',
                                    background: 'linear-gradient(135deg, #6366f1 0%, #7c3aed 100%)',
                                    border: 'none',
                                    borderRadius: '8px',
                                    color: '#fff',
                                    fontSize: '14px',
                                    fontWeight: 500,
                                    cursor: loading ? 'wait' : 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '8px'
                                }}
                            >
                                {loading ? <Loader2 style={{ width: 18, height: 18, animation: 'spin 1s linear infinite' }} /> : t('login.login_btn', language)}
                            </button>
                        </motion.form>
                    )}
                </AnimatePresence>

                {error && (
                    <motion.div
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        style={{
                            marginTop: '16px',
                            padding: '10px 14px',
                            background: 'rgba(239,68,68,0.1)',
                            border: '1px solid rgba(239,68,68,0.2)',
                            borderRadius: '8px',
                            fontSize: '13px',
                            color: '#f87171',
                            textAlign: 'center'
                        }}
                    >
                        {error}
                    </motion.div>
                )}
            </motion.div>

            <style>{`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
}
