import { useContext } from "react";
import { AppConfigContext } from "./AppConfigContext.js";

export const useAppConfig = () => useContext(AppConfigContext);
