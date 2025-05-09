import { useContext } from "react";
import { AppConfigContext } from "./AppConfigContext.jsx";

export const useAppConfig = () => useContext(AppConfigContext);
