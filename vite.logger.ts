import { createLogger, type Logger } from "vite";

const GEOTIFF_MISSING_SOURCEMAP_RE =
  /Sourcemap for ".*\/node_modules\/@developmentseed\/geotiff\/dist\/.*" points to missing source files/;

function shouldSuppressWarning(message: string): boolean {
  return GEOTIFF_MISSING_SOURCEMAP_RE.test(message);
}

export function createFilteredViteLogger(): Logger {
  const logger = createLogger();
  const warn = logger.warn.bind(logger);
  const warnOnce = logger.warnOnce.bind(logger);

  logger.warn = (message, options) => {
    if (shouldSuppressWarning(message)) return;
    warn(message, options);
  };

  logger.warnOnce = (message, options) => {
    if (shouldSuppressWarning(message)) return;
    warnOnce(message, options);
  };

  return logger;
}
