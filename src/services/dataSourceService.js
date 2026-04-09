const config = require('../../config/config');
const path = require('path');
const fs = require('fs');

// In-memory store — single source of truth for both mock & real data
let dataStore = {
  aws: null,
  azure: null,
  gcp: null,
  lastUpdated: null,
};

// ─── MOCK DATA LOADER ─────────────────────────────────────────────────────────
function loadMockData(cloud) {
  const filePath = path.join(__dirname, '../../data/mock', `${cloud}-mock.json`);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Mock data file not found: ${filePath}`);
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

// ─── REAL DATA LOADERS (stubbed — connected in individual cloud services) ─────
async function fetchAWSData() {
  const awsService = require('./aws/awsService');
  return awsService.fetchAll();
}

async function fetchAzureData() {
  const azureService = require('./azure/azureService');
  return azureService.fetchAll();
}

async function fetchGCPData() {
  const gcpService = require('./gcp/gcpService');
  return gcpService.fetchAll();
}

// ─── MAIN DATA FETCHER — Reads the USE_REAL_DATA flag ─────────────────────────
async function getData(cloud) {
  if (!['aws', 'azure', 'gcp'].includes(cloud)) {
    throw new Error(`Unknown cloud provider: ${cloud}`);
  }

  // Return cached data if fresh (< 5 minutes)
  if (dataStore[cloud] && dataStore.lastUpdated) {
    const ageMs = Date.now() - dataStore.lastUpdated;
    if (ageMs < 5 * 60 * 1000) {
      return dataStore[cloud];
    }
  }

  let data;
  if (config.useRealData) {
    console.log(`[DataSource] USE_REAL_DATA=true — fetching live ${cloud.toUpperCase()} data`);
    try {
      if (cloud === 'aws') data = await fetchAWSData();
      else if (cloud === 'azure') data = await fetchAzureData();
      else if (cloud === 'gcp') data = await fetchGCPData();
    } catch (err) {
      console.error(`[DataSource] ⚠️ Real data fetch failed for ${cloud}: ${err.message}`);
      console.warn('[DataSource] Falling back to mock data');
      data = loadMockData(cloud);
      data._meta_fallback = true;
      data.alerts = data.alerts || [];
      data.alerts.push({
         type: "error",
         title: "Live Data Fetch Failed",
         message: `Failed to fetch live cloud data. Showing mock data instead. Error: ${err.message}`
      });
    }
  } else {
    console.log(`[DataSource] USE_REAL_DATA=false — loading mock ${cloud.toUpperCase()} data`);
    data = loadMockData(cloud);
  }

  // Store in memory cache
  dataStore[cloud] = data;
  dataStore.lastUpdated = Date.now();

  return data;
}

// Get data for multiple clouds at once
async function getMultiCloudData(clouds) {
  const results = {};
  await Promise.all(
    clouds.map(async (cloud) => {
      try {
        results[cloud] = await getData(cloud);
      } catch (err) {
        results[cloud] = { error: err.message };
      }
    })
  );
  return results;
}

// Force refresh (bypass cache)
function invalidateCache(cloud) {
  if (cloud) {
    dataStore[cloud] = null;
  } else {
    dataStore = { aws: null, azure: null, gcp: null, lastUpdated: null };
  }
}

// Get current data source mode
function getDataSourceMode() {
  const isFallback = dataStore.aws && dataStore.aws._meta_fallback;
  return {
    useRealData: config.useRealData,
    mode: config.useRealData ? (isFallback ? 'mock' : 'real') : 'mock',
    cacheStatus: {
      aws: !!dataStore.aws,
      azure: !!dataStore.azure,
      gcp: !!dataStore.gcp,
      lastUpdated: dataStore.lastUpdated ? new Date(dataStore.lastUpdated).toISOString() : null,
    },
  };
}

module.exports = { getData, getMultiCloudData, invalidateCache, getDataSourceMode };
