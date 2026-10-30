export const env = {
  appUrl: process.env.APP_URL ?? "http://localhost:3000",
  secret: process.env.APP_SECRET ?? "dev-secret-change-me",
  isProd: process.env.NODE_ENV === "production",
  resendKey: process.env.RESEND_API_KEY,
  mailFrom: process.env.MAIL_FROM ?? "Poppsie <noreply@poppsie.ch>",
  turnstileSecret: process.env.TURNSTILE_SECRET_KEY,
  turnstileSiteKey: process.env.TURNSTILE_SITE_KEY,
  adminUsername: process.env.ADMIN_USERNAME,
  bucket: {
    name: process.env.BUCKET,
    endpoint: process.env.ENDPOINT,
    region: process.env.REGION ?? "auto",
    accessKeyId: process.env.ACCESS_KEY_ID,
    secretAccessKey: process.env.SECRET_ACCESS_KEY,
  },
};

export const hasBucket = Boolean(env.bucket.name && env.bucket.endpoint && env.bucket.accessKeyId && env.bucket.secretAccessKey);
