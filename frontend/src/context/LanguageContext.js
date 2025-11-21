
import React, { createContext, useState, useContext, useEffect } from 'react';
import { translations } from '../i18n/translations';

const LanguageContext = createContext();

export const LanguageProvider = ({ children }) => {
    // Lay config tu localStorage hoac mac dinh la 'vi'
    const [language, setLanguage] = useState(() => {
        return localStorage.getItem('app_language') || 'vi';
    });

    useEffect(() => {
        localStorage.setItem('app_language', language);
    }, [language]);

    // Helper function de lay text
    const t = (key) => {
        return translations[language][key] || key;
    };

    return (
        <LanguageContext.Provider value={{ language, setLanguage, t }}>
            {children}
        </LanguageContext.Provider>
    );
};

export const useLanguage = () => useContext(LanguageContext);