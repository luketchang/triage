import { Logger } from "winston";

import { getLogger } from "./logger";

// This proxy exists so we always get the up-to-date logger object. Without using proxy pattern, there are cases where import { logger } from "@triage/common" will run before the caller sets the logger to have desired config. Proxy ensures we always pass through call to the result of getLogger
const loggerProxy = new Proxy(
  {},
  {
    get(_target, prop): Logger {
      return Reflect.get(getLogger(), prop);
    },
  }
) as ReturnType<typeof getLogger>;

export default loggerProxy;
