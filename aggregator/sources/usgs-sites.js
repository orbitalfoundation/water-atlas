// USGS stream gauges across the atlas's West Coast footprint + latest mean-daily discharge.
// Built on the modernized USGS Water Data OGC API (legacy NWIS waterservices is decom Q1 2027).
//   monitoring-locations -> features (layer "gauges")
//   latest-daily (param 00060 discharge, stat 00003 mean) -> observations (discharge_cfs)
// Both endpoints take state_code (FIPS), so coverage is a plain list — add a state, rerun.
const ID = 'usgs-sites';
const LAYER = 'gauges';
const BASE = 'https://api.waterdata.usgs.gov/ogcapi/v0';
const STATES = [
  ['06', 'CA'],
  ['41', 'OR'],
  ['32', 'NV'],
  ['53', 'WA'],
];

const nextLink = (fc) => (fc.links || []).find((l) => l.rel === 'next')?.href || null;

export default {
  id: ID,
  title: 'USGS stream gauges + live flow',
  layer: LAYER,
  description: 'Stream monitoring locations in CA · OR · NV · WA with latest mean daily discharge (cfs).',
  style: { color: '#3aa0d1', cluster: false, kind: 'gauge' },

  async run({ store, http, log }) {
    let sites = 0;
    let flow = 0;

    for (const [fips, abbr] of STATES) {
      // 1) Stream monitoring locations -> features (paginated via OGC `next` cursor links)
      let url = `${BASE}/collections/monitoring-locations/items?state_code=${fips}&site_type_code=ST&limit=1000&f=json`;
      let stateSites = 0;
      for (let page = 1; url; page++) {
        const fc = await http.getJson(url);
        for (const f of fc.features || []) {
          const p = f.properties || {};
          const [lon, lat] = f.geometry?.coordinates || [];
          store.feature({
            source: ID, layer: LAYER, external_id: p.id, name: p.monitoring_location_name, lat, lon,
            props: {
              number: p.monitoring_location_number, agency: p.agency_code, state: abbr,
              county: p.county_name, huc: p.hydrologic_unit_code,
              site_type: p.site_type, drainage_area: p.drainage_area,
            },
          });
          stateSites++;
        }
        url = nextLink(fc);
        if (page % 5 === 0) log.dim(`  ${abbr} sites so far: ${stateSites}`);
      }
      sites += stateSites;
      log.info(`${abbr}: ${stateSites} stream sites`);

      // 2) Latest mean-daily discharge -> observations (joined to gauges by external_id)
      url = `${BASE}/collections/latest-daily/items?state_code=${fips}&parameter_code=00060&statistic_id=00003&limit=1000&f=json`;
      let stateFlow = 0;
      while (url) {
        const fc = await http.getJson(url);
        for (const f of fc.features || []) {
          const p = f.properties || {};
          store.observation({
            source: ID, feature_external_id: p.monitoring_location_id,
            variable: 'discharge_cfs', value: p.value, unit: 'cfs', observed_at: p.time,
          });
          stateFlow++;
        }
        url = nextLink(fc);
      }
      flow += stateFlow;
      log.info(`${abbr}: ${stateFlow} latest discharge observations`);
    }

    log.info(`stream sites upserted: ${sites}; observations: ${flow}`);
    return { stats: { sites, flow } };
  },
};
