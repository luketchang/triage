import React, { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { AppConfig } from "../../config";
import api from "../services/api";

type AppConfigContextType = {
  config: AppConfig | null;
  isLoading: boolean;
  updateConfig: (newConfig: Partial<AppConfig>) => Promise<void>;
};

const AppConfigContext = createContext<AppConfigContextType>({
  config: null,
  isLoading: true,
  updateConfig: async () => {},
});

export const useAppConfig = () => useContext(AppConfigContext);

export const AppConfigProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const appConfig = await api.getAppConfig();
        setConfig(appConfig);
      } catch (error) {
        console.error("Failed to fetch app config:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchConfig();
  }, []);

  const updateConfig = async (newConfig: Partial<AppConfig>) => {
    try {
      const updatedConfig = await api.updateAppConfig(newConfig);
      setConfig(updatedConfig);
    } catch (error) {
      console.error("Failed to update app config:", error);
    }
  };

  return (
    <AppConfigContext.Provider value={{ config, isLoading, updateConfig }}>
      {children}
    </AppConfigContext.Provider>
  );
};
