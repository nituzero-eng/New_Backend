require('dotenv').config();

const config = {
  server: {
    port: parseInt(process.env.PORT) || 3000,
    env: process.env.NODE_ENV || 'development',
  },

  auth: {
    jwtSecret: process.env.JWT_SECRET || 'fallback_secret_change_me',
    sessionTimeoutHours: parseInt(process.env.SESSION_TIMEOUT_HOURS) || 8,
  },

  // ─── THE KEY FLAG ────────────────────────────────────────────────────────────
  // true  → fetch real-time data from cloud APIs
  // false → serve data from /data/mock/*.json files
  useRealData: process.env.USE_REAL_DATA === 'true',

  gemini: {
    apiKey: process.env.GEMINI_API_KEY || '',
  },

  aws: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    region: process.env.AWS_REGION || 'us-east-1',
  },

  azure: {
    subscriptionId: process.env.AZURE_SUBSCRIPTION_ID || '',
    tenantId: process.env.AZURE_TENANT_ID || '',
    clientId: process.env.AZURE_CLIENT_ID || '',
    clientSecret: process.env.AZURE_CLIENT_SECRET || '',
  },

  gcp: {
    projectId: process.env.GCP_PROJECT_ID || '',
    apiKey: process.env.GCP_API_KEY || '',
    credentialsFile: process.env.GOOGLE_APPLICATION_CREDENTIALS || '',
  },

  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MINUTES || '15') * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  },
};

// Validate critical settings on startup
function validate() {
  const warnings = [];
  if (!config.gemini.apiKey || config.gemini.apiKey === 'your_gemini_api_key_here') {
    warnings.push('⚠️  GEMINI_API_KEY not set — AI features will return placeholder responses');
  }
  if (config.useRealData) {
    if (!config.aws.accessKeyId) warnings.push('⚠️  USE_REAL_DATA=true but AWS_ACCESS_KEY_ID is empty');
    if (!config.azure.subscriptionId) warnings.push('⚠️  USE_REAL_DATA=true but AZURE_SUBSCRIPTION_ID is empty');
    if (!config.gcp.projectId) warnings.push('⚠️  USE_REAL_DATA=true but GCP_PROJECT_ID is empty');
  }
  if (warnings.length) console.warn('\n' + warnings.join('\n') + '\n');
}

validate();

module.exports = config;
