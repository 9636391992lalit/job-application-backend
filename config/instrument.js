// ESM
import * as Sentry from "@sentry/node";

Sentry.init({
  dsn: "https://f4192a6a9a695004d50b0005fe0195ff@o4510073547587584.ingest.us.sentry.io/4510088321040384",
  sendDefaultPii: true, // will include IP/user info
});
