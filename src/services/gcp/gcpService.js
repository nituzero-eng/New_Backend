const config = require('../../../config/config');
const axios = require('axios');

/**
 * GCP Real-Data Service
 * Uses GCP REST APIs with API Key or Service Account
 * Only called when USE_REAL_DATA=true
 */

// ─── AUTH ─────────────────────────────────────────────────────────────────────
function getApiKey() {
  if (!config.gcp.apiKey && !config.gcp.credentialsFile) {
    throw new Error('GCP credentials not configured. Set GCP_API_KEY or GOOGLE_APPLICATION_CREDENTIALS in .env');
  }
  return config.gcp.apiKey;
}

// ─── COMPUTE ENGINE ───────────────────────────────────────────────────────────
async function fetchComputeInstances() {
  const apiKey = getApiKey();
  const projectId = config.gcp.projectId;
  const url = `https://compute.googleapis.com/compute/v1/projects/${projectId}/aggregated/instances?key=${apiKey}`;

  const resp = await axios.get(url);
  const instances = [];
  for (const [zone, zoneData] of Object.entries(resp.data.items || {})) {
    for (const inst of zoneData.instances || []) {
      instances.push({
        id: inst.selfLink,
        name: inst.name,
        machine_type: inst.machineType?.split('/').pop(),
        status: inst.status,
        zone: zone.replace('zones/', ''),
        tags: inst.labels || {},
        monthly_cost: 0,
        recommendations: [],
      });
    }
  }
  return instances;
}

// ─── CLOUD STORAGE ────────────────────────────────────────────────────────────
async function fetchStorageBuckets() {
  const apiKey = getApiKey();
  const projectId = config.gcp.projectId;
  const url = `https://storage.googleapis.com/storage/v1/b?project=${projectId}&key=${apiKey}`;

  const resp = await axios.get(url);
  return (resp.data.items || []).map(b => ({
    id: b.id,
    name: b.name,
    location: b.location,
    storage_class: b.storageClass,
    monthly_cost: 0,
    recommendations: [],
  }));
}

// ─── BILLING DATA (Cloud Billing API) ────────────────────────────────────────
async function fetchBillingData() {
  // Note: Cloud Billing Export to BigQuery is recommended for production
  // This is a simplified stub that returns structured data
  console.warn('[GCP] Billing API requires BigQuery export setup — returning estimates');
  return {};
}

// ─── MAIN FETCH ALL ───────────────────────────────────────────────────────────
async function fetchAll() {
  const [instances, buckets] = await Promise.allSettled([
    fetchComputeInstances(), fetchStorageBuckets(),
  ]);

  return {
    meta: { cloud: 'gcp', project_id: config.gcp.projectId, last_updated: new Date().toISOString() },
    summary: {
      total_monthly_cost: 0,
      active_services: 8,
      total_resources: (instances.value || []).length + (buckets.value || []).length,
      cost_alerts: 0,
      projected_monthly_cost: 0,
    },
    services: {
      compute_engine: { service_name: 'Compute Engine', monthly_cost: 0, instances: instances.value || [] },
      cloud_storage: { service_name: 'Cloud Storage', monthly_cost: 0, buckets: buckets.value || [] },
    },
    alerts: [],
    top_cost_services: [],
  };
}

module.exports = { fetchAll };
