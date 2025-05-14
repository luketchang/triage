// logger-shim.ts
import { Logger } from "winston";

import { getLogger } from "./logger";

const loggerProxy = new Proxy(
  {},
  {
    get(_target, prop): Logger {
      return Reflect.get(getLogger(), prop);
    },
  }
) as ReturnType<typeof getLogger>;

export default loggerProxy;
