import React, { createContext, ReactNode, useEffect, useState } from "react";
import { AppConfig } from "../AppConfig.js";
import api from "../services/api.js";

type AppConfigContextType = {
  appConfig: AppConfig | null;
  updateAppConfig: (newConfig: Partial<AppConfig>) => Promise<void>;
  isLoading: boolean;
};

const AppConfigContext = createContext<AppConfigContextType>({
  appConfig: null,
  updateAppConfig: async () => {},
  isLoading: true,
});

export const AppConfigProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [appConfig, setAppConfig] = useState<AppConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const cfgFromApi = await api.getAppConfig();
        setAppConfig(cfgFromApi);
      } catch (error) {
        console.error("Failed to fetch app config:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchConfig();
  }, []);

  const updateAppConfig = async (newConfig: Partial<AppConfig>) => {
    try {
      console.log("Updating app config:", newConfig);
      const cfgFromApi = await api.updateAppConfig(newConfig);
      console.log("Updated app config:", cfgFromApi);
      setAppConfig(cfgFromApi);
    } catch (error) {
      console.error("Failed to update app config:", error);
    }
  };

  return (
    <AppConfigContext.Provider value={{ appConfig, updateAppConfig, isLoading }}>
      {children}
    </AppConfigContext.Provider>
  );
};

export { AppConfigContext };
