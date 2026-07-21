// ARGUS backend — Catalyst Advanced I/O function.
// Faithful port of the 7 Next.js API routes (argus/src/app/api/*) onto the
// Catalyst Data Store. Response shapes are byte-compatible with the originals
// so the frontend only changes its base URL.
//
// Data flow: raw CSV archive lives in Stratus; the 14 curated tables live in
// the Data Store. Full-table reads use the Data Store SDK's paged reads
// (300 rows/page) and are memoised in module scope so warm invocations skip
// the round-trips; point lookups use ZCQL.

const express = require('express');
const catalyst = require('zcatalyst-sdk-node');
const { forceSimulation, forceLink, forceManyBody, forceCenter } = require('d3-force-3d');

const app = express();
app.use(express.json());

// Same-origin in production (AppSail + functions share the Catalyst domain);
// permissive CORS kept for local `next dev` against `catalyst serve`.
app.use((req, res, next) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  next();
});

// ---------------------------------------------------------------------------
// Data Store access
// ---------------------------------------------------------------------------

// Warm-instance cache: table name -> { rows, ts }. Catalyst Cache caps values
// at sizes far below these payloads, so module memory is the right layer here.
const TABLE_TTL_MS = 10 * 60 * 1000;
const tableCache = new Map();

async function fetchTable(capp, tableName) {
  const hit = tableCache.get(tableName);
  if (hit && Date.now() - hit.ts < TABLE_TTL_MS) return hit.rows;

  const table = capp.datastore().table(tableName);
  const rows = [];
  let nextToken;
  do {
    const page = await table.getPagedRows({ nextToken, maxRows: 300 });
    (page.data || []).forEach((r) => rows.push(r));
    nextToken = page.next_token || page.nextToken || null;
  } while (nextToken);

  tableCache.set(tableName, { rows, ts: Date.now() });
  return rows;
}

const S = (v) => (v === null || v === undefined ? '' : String(v));
const N = (v) => parseFloat(S(v));
const isTrue = (v) => S(v).toLowerCase() === 'true' || S(v) === '1';

// GravityOffence lookup (1=Heinous, 2=Non-Heinous, 3=Petty) projected onto the
// 0-10 severity scale the frontend legend uses ("High Gravity FIR >= 5").
const TIER_SEVERITY = { Heinous: 9, 'Non-Heinous': 5, Petty: 2 };

async function gravityMaps(capp) {
  const rows = await fetchTable(capp, 'GravityOffence');
  const tierById = new Map();
  rows.forEach((g) => tierById.set(S(g.GravityOffenceID), S(g.LookupValue)));
  const severityById = new Map();
  tierById.forEach((tier, id) => severityById.set(id, TIER_SEVERITY[tier] ?? 2));
  return { tierById, severityById };
}

// Matches the frontend's district-id normalization
const normalizeDistrict = (s) => S(s).toLowerCase().replace(/[^a-z]/g, '');

// ---------------------------------------------------------------------------
// GET /cases
// ---------------------------------------------------------------------------
app.get('/cases', async (req, res) => {
  try {
    const capp = catalyst.initialize(req);
    const [cases, units, districts, { tierById, severityById }] = await Promise.all([
      fetchTable(capp, 'CaseMaster'),
      fetchTable(capp, 'Unit'),
      fetchTable(capp, 'District'),
      gravityMaps(capp),
    ]);

    const unitToDistrict = {};
    units.forEach((u) => { unitToDistrict[S(u.UnitID)] = S(u.DistrictID); });
    const districtNameById = {};
    districts.forEach((d) => { districtNameById[S(d.DistrictID)] = S(d.DistrictName); });

    const records = cases.map((c) => {
      const districtId = unitToDistrict[S(c.PoliceStationID)];
      const gid = S(c.GravityOffenceID);
      return {
        ...c,
        CaseMasterID: S(c.CaseMasterID),
        PoliceStationID: S(c.PoliceStationID),
        PolicePersonID: S(c.PolicePersonID),
        CaseCategoryID: S(c.CaseCategoryID),
        latitude: N(c.latitude),
        longitude: N(c.longitude),
        GravityOffenceID: parseInt(gid, 10),
        GravityTier: tierById.get(gid) ?? 'Petty',
        GravityOffence: String(severityById.get(gid) ?? 2),
        DistrictID: districtId ?? null,
        DistrictName: districtId ? (districtNameById[districtId] ?? 'Unknown') : 'Unknown',
      };
    });

    res.json(records);
  } catch (e) {
    console.error('cases:', e);
    res.status(500).json({ error: 'Failed to load cases data' });
  }
});

// ---------------------------------------------------------------------------
// GET /network  (?district=&all=true)
// ---------------------------------------------------------------------------
app.get('/network', async (req, res) => {
  try {
    const capp = catalyst.initialize(req);
    const districtFilter = req.query.district || null;
    const showAll = req.query.all === 'true';

    const [cases, accused, victims, units, districts, employees, { severityById }] = await Promise.all([
      fetchTable(capp, 'CaseMaster'),
      fetchTable(capp, 'Accused'),
      fetchTable(capp, 'Victim'),
      fetchTable(capp, 'Unit'),
      fetchTable(capp, 'District'),
      fetchTable(capp, 'Employee'),
      gravityMaps(capp),
    ]);

    const districtNameById = {};
    districts.forEach((d) => { districtNameById[S(d.DistrictID)] = S(d.DistrictName); });
    const unitById = {};
    units.forEach((u) => { unitById[S(u.UnitID)] = u; });
    const employeeById = {};
    employees.forEach((e) => { employeeById[S(e.EmployeeID)] = e; });

    const districtCases = districtFilter
      ? cases.filter((c) => {
          const unit = unitById[S(c.PoliceStationID)];
          const dName = unit ? districtNameById[S(unit.DistrictID)] : undefined;
          return dName && normalizeDistrict(dName) === normalizeDistrict(districtFilter);
        })
      : cases;

    // Repeat offenders: any PersonMasterID appearing against 2+ distinct cases
    const casesByPersonGlobal = {};
    accused.forEach((a) => {
      const pid = S(a.PersonMasterID);
      if (!pid) return;
      if (!casesByPersonGlobal[pid]) casesByPersonGlobal[pid] = new Set();
      casesByPersonGlobal[pid].add(S(a.CaseMasterID));
    });
    const repeatOffenderCaseIds = new Set();
    Object.values(casesByPersonGlobal).forEach((set) => {
      if (set.size >= 2) set.forEach((id) => repeatOffenderCaseIds.add(id));
    });

    const activeCases = showAll
      ? districtCases
      : districtCases.filter((c) => repeatOffenderCaseIds.has(S(c.CaseMasterID)));
    const activeCaseIds = new Set(activeCases.map((c) => S(c.CaseMasterID)));
    const activeAccused = accused.filter((a) => activeCaseIds.has(S(a.CaseMasterID)));

    const caseNodes = activeCases.map((c) => ({
      id: `case-${S(c.CaseMasterID)}`,
      type: 'case',
      gravity: severityById.get(S(c.GravityOffenceID)) ?? 2,
      status: S(c.CaseStatusID),
    }));
    const stationIds = Array.from(new Set(activeCases.map((c) => S(c.PoliceStationID))));
    const stationNodes = stationIds.map((uid) => ({
      id: `station-${uid}`,
      type: 'unit',
      name: unitById[uid] ? S(unitById[uid].UnitName) : 'Unknown Station',
    }));
    const officerIds = Array.from(new Set(activeCases.map((c) => S(c.PolicePersonID))));
    const officerNodes = officerIds.map((eid) => ({
      id: `officer-${eid}`,
      type: 'officer',
      name: employeeById[eid] ? S(employeeById[eid].FirstName) : 'Unknown Officer',
    }));
    const activeVictims = victims.filter((v) => activeCaseIds.has(S(v.CaseMasterID)));
    const victimNodes = activeVictims.map((v) => ({
      id: `victim-${S(v.VictimMasterID)}`,
      type: 'victim',
      name: S(v.VictimName) || 'Unknown Victim',
    }));

    const nodes = [...caseNodes, ...stationNodes, ...officerNodes, ...victimNodes];

    const links = [];
    activeCases.forEach((c) => {
      links.push({ source: `case-${S(c.CaseMasterID)}`, target: `station-${S(c.PoliceStationID)}`, type: 'case_station' });
    });
    activeCases.forEach((c) => {
      links.push({ source: `case-${S(c.CaseMasterID)}`, target: `officer-${S(c.PolicePersonID)}`, type: 'case_officer' });
    });
    activeVictims.forEach((v) => {
      links.push({ source: `case-${S(v.CaseMasterID)}`, target: `victim-${S(v.VictimMasterID)}`, type: 'case_victim' });
    });
    const casesByPerson = {};
    activeAccused.forEach((a) => {
      const pid = S(a.PersonMasterID);
      if (!pid) return;
      if (!casesByPerson[pid]) casesByPerson[pid] = new Set();
      casesByPerson[pid].add(S(a.CaseMasterID));
    });
    Object.values(casesByPerson).forEach((set) => {
      const list = Array.from(set);
      if (list.length < 2) return;
      for (let i = 0; i < list.length; i++) {
        for (let j = i + 1; j < list.length; j++) {
          links.push({ source: `case-${list[i]}`, target: `case-${list[j]}`, type: 'repeat_offender' });
        }
      }
    });

    const simulation = forceSimulation(nodes)
      .numDimensions(3)
      .force('link', forceLink(links).id((d) => d.id).distance(15))
      .force('charge', forceManyBody().strength(-10))
      .force('center', forceCenter(0, 0, 0));
    simulation.tick(150);

    res.json({
      nodes: nodes.map((n) => ({
        id: n.id, type: n.type, name: n.name,
        graphX: n.x, graphY: n.y, graphZ: n.z,
      })),
      links,
    });
  } catch (e) {
    console.error('network:', e);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ---------------------------------------------------------------------------
// GET /hotspots  (?district=&onlyFlagged=true)
// ---------------------------------------------------------------------------
app.get('/hotspots', async (req, res) => {
  try {
    const capp = catalyst.initialize(req);
    let rows = await fetchTable(capp, 'Hotspots');

    if (req.query.district) {
      rows = rows.filter((r) => normalizeDistrict(r.DistrictName) === normalizeDistrict(req.query.district));
    }
    if (req.query.onlyFlagged === 'true') {
      rows = rows.filter((r) => isTrue(r.IsHotspot));
    }

    res.json(rows.map((r) => ({
      districtName: S(r.DistrictName),
      gridLat: N(r.GridLat),
      gridLon: N(r.GridLon),
      timeBucket: S(r.TimeBucket),
      caseCount: parseInt(S(r.CaseCount), 10),
      avgGravity: N(r.AvgGravity),
      densityScore: N(r.DensityScore),
      isHotspot: isTrue(r.IsHotspot),
    })));
  } catch (e) {
    console.error('hotspots:', e);
    res.status(500).json({ error: 'Failed to load hotspot data' });
  }
});

// ---------------------------------------------------------------------------
// GET /trends  (?district=&level=&limit=)
// ---------------------------------------------------------------------------
app.get('/trends', async (req, res) => {
  try {
    const capp = catalyst.initialize(req);
    let rows = await fetchTable(capp, 'TrendAlerts');
    const limit = parseInt(req.query.limit ?? '50', 10);

    if (req.query.district) {
      rows = rows.filter((r) => normalizeDistrict(r.DistrictName) === normalizeDistrict(req.query.district));
    }
    if (req.query.level) {
      rows = rows.filter((r) => S(r.AlertLevel) === req.query.level);
    }

    const records = rows
      .map((r) => ({
        districtName: S(r.DistrictName),
        crimeGroupName: S(r.CrimeGroupName),
        month: S(r.Month),
        caseCount: parseInt(S(r.CaseCount), 10),
        baselineMean: N(r.BaselineMean),
        zScore: N(r.ZScore),
        alertLevel: S(r.AlertLevel),
      }))
      .sort((a, b) => b.zScore - a.zScore)
      .slice(0, limit);

    res.json(records);
  } catch (e) {
    console.error('trends:', e);
    res.status(500).json({ error: 'Failed to load trend alert data' });
  }
});

// ---------------------------------------------------------------------------
// GET /risk-score  (?district=&tier=&stationId=)
// ---------------------------------------------------------------------------
app.get('/risk-score', async (req, res) => {
  try {
    const capp = catalyst.initialize(req);
    let rows = await fetchTable(capp, 'StationRiskScore');

    if (req.query.district) {
      rows = rows.filter((r) => normalizeDistrict(r.DistrictName) === normalizeDistrict(req.query.district));
    }
    if (req.query.tier) {
      rows = rows.filter((r) => S(r.RiskTier) === req.query.tier);
    }
    if (req.query.stationId) {
      rows = rows.filter((r) => S(r.PoliceStationID) === req.query.stationId);
    }

    const records = rows
      .map((r) => ({
        policeStationId: S(r.PoliceStationID),
        unitName: S(r.UnitName),
        districtName: S(r.DistrictName),
        velocityScore: N(r.VelocityScore),
        severityScore: N(r.SeverityScore),
        repeatScore: N(r.RepeatScore),
        riskScore: N(r.RiskScore),
        riskTier: S(r.RiskTier),
      }))
      .sort((a, b) => b.riskScore - a.riskScore);

    res.json(records);
  } catch (e) {
    console.error('risk-score:', e);
    res.status(500).json({ error: 'Failed to load risk score data' });
  }
});

// ---------------------------------------------------------------------------
// GET /anomalies  (?caseId=&limit=)
// ---------------------------------------------------------------------------
app.get('/anomalies', async (req, res) => {
  try {
    const capp = catalyst.initialize(req);
    const limit = parseInt(req.query.limit ?? '50', 10);
    const caseId = req.query.caseId;

    // Always pull the full flagged set (152 rows, cached) so the 0-100 Anomaly
    // Index normalizes against the whole population even for a single-case
    // lookup. Raw Isolation Forest scores are tiny negative floats that round
    // to "0.00" and mean nothing to an analyst; the index (100 = most
    // anomalous) makes the signal legible.
    const allRows = await fetchTable(capp, 'Anomalies');
    const scores = allRows.map((r) => N(r.AnomalyScore));
    const mostAnomalous = Math.min(...scores);
    const leastAnomalous = Math.max(...scores);
    const span = leastAnomalous - mostAnomalous || 1;
    const toIndex = (s) => Math.max(1, Math.round(((leastAnomalous - s) / span) * 100));

    let rows = allRows;
    if (caseId && /^[0-9]+$/.test(caseId)) {
      rows = allRows.filter((r) => S(r.CaseMasterID) === S(caseId));
    }

    const records = rows
      .map((r) => {
        const anomalyScore = N(r.AnomalyScore);
        return {
          caseMasterId: S(r.CaseMasterID),
          crimeMajorHeadId: S(r.CrimeMajorHeadID),
          anomalyScore,
          anomalyIndex: toIndex(anomalyScore),
          primaryDrivers: S(r.PrimaryDrivers),
          reportingDelayHours: N(r.ReportingDelayHours),
          numAccused: parseInt(S(r.NumAccused), 10),
          numVictims: parseInt(S(r.NumVictims), 10),
          distFromStationTypicalKm: N(r.DistFromStationTypicalKm),
        };
      })
      .sort((a, b) => a.anomalyScore - b.anomalyScore)
      .slice(0, limit);

    res.json(records);
  } catch (e) {
    console.error('anomalies:', e);
    res.status(500).json({ error: 'Failed to load anomaly data' });
  }
});

// ---------------------------------------------------------------------------
// GET /offender-profile  (?caseId=)
// ---------------------------------------------------------------------------
app.get('/offender-profile', async (req, res) => {
  const caseId = req.query.caseId;
  if (!caseId) {
    return res.status(400).json({ error: 'caseId query param is required' });
  }
  try {
    const capp = catalyst.initialize(req);
    const [accused, persons, victims, cases, units, districts, crimeHeads, arrests, { tierById }] = await Promise.all([
      fetchTable(capp, 'Accused'),
      fetchTable(capp, 'PersonMaster'),
      fetchTable(capp, 'Victim'),
      fetchTable(capp, 'CaseMaster'),
      fetchTable(capp, 'Unit'),
      fetchTable(capp, 'District'),
      fetchTable(capp, 'CrimeHead'),
      fetchTable(capp, 'ArrestSurrender'),
      gravityMaps(capp),
    ]);

    const personById = new Map(persons.map((p) => [S(p.PersonMasterID), p]));
    const caseById = new Map(cases.map((c) => [S(c.CaseMasterID), c]));
    const districtNameById = new Map(districts.map((d) => [S(d.DistrictID), S(d.DistrictName)]));
    const unitDistrict = new Map(units.map((u) => [S(u.UnitID), districtNameById.get(S(u.DistrictID)) ?? 'Unknown']));
    const crimeGroupById = new Map(crimeHeads.map((h) => [S(h.CrimeHeadID), S(h.CrimeGroupName)]));

    const victimsByCase = new Map();
    victims.forEach((v) => {
      const key = S(v.CaseMasterID);
      const list = victimsByCase.get(key) ?? [];
      list.push({ victimMasterId: S(v.VictimMasterID), name: S(v.VictimName), age: S(v.AgeYear) });
      victimsByCase.set(key, list);
    });

    const casePersonIds = new Set(
      accused.filter((a) => S(a.CaseMasterID) === caseId && S(a.PersonMasterID)).map((a) => S(a.PersonMasterID))
    );

    const profiles = Array.from(casePersonIds).map((personId) => {
      const person = personById.get(personId) ?? {};
      const personAccusedRows = accused.filter((a) => S(a.PersonMasterID) === personId);
      const accusedRowIds = new Set(personAccusedRows.map((a) => S(a.AccusedMasterID)));

      const linkedCases = personAccusedRows
        .map((a) => {
          const c = caseById.get(S(a.CaseMasterID));
          if (!c) return null;
          return {
            caseMasterId: S(c.CaseMasterID),
            crimeNo: S(c.CrimeNo),
            registeredDate: S(c.CrimeRegisteredDate),
            districtName: unitDistrict.get(S(c.PoliceStationID)) ?? 'Unknown',
            crimeGroup: crimeGroupById.get(S(c.CrimeMajorHeadID)) ?? 'Unknown',
            gravityTier: tierById.get(S(c.GravityOffenceID)) ?? 'Unknown',
            mo: S(a.MO) || null,
            isCurrentCase: S(c.CaseMasterID) === caseId,
            latitude: N(c.latitude),
            longitude: N(c.longitude),
            victims: victimsByCase.get(S(c.CaseMasterID)) ?? [],
          };
        })
        .filter(Boolean)
        .sort((a, b) => (a.registeredDate < b.registeredDate ? 1 : -1));

      const arrestHistory = arrests
        .filter((ar) => accusedRowIds.has(S(ar.AccusedMasterID)))
        .map((ar) => ({
          date: S(ar.ArrestSurrenderDate),
          districtName: districtNameById.get(S(ar.ArrestSurrenderDistrictId)) ?? 'Unknown',
          type: S(ar.ArrestSurrenderTypeID) === '1' ? 'Arrest' : 'Surrender',
        }))
        .sort((a, b) => (a.date < b.date ? 1 : -1));

      const jurisdictions = Array.from(new Set(linkedCases.map((lc) => lc.districtName)));

      return {
        personMasterId: personId,
        name: S(person.PersonName) || S(personAccusedRows[0]?.AccusedName) || 'Unknown',
        isRepeatOffender: S(person.IsRepeatOffender) === '1' || linkedCases.length >= 2,
        totalCasesLinked: linkedCases.length,
        primaryMO: S(person.PrimaryMO) || null,
        primaryCrimeGroup: crimeGroupById.get(S(person.PrimaryCrimeHeadID)) ?? null,
        homeDistrict: districtNameById.get(S(person.HomeDistrictID)) ?? null,
        jurisdictions,
        linkedCases,
        arrestHistory,
      };
    });

    profiles.sort((a, b) => Number(b.isRepeatOffender) - Number(a.isRepeatOffender) || b.totalCasesLinked - a.totalCasesLinked);
    res.json(profiles);
  } catch (e) {
    console.error('offender-profile:', e);
    res.status(500).json({ error: 'Failed to build offender profile' });
  }
});

// ---------------------------------------------------------------------------
// GET /forecast  (?district=&limit=)
// Per-district monthly counts -> 3-month moving average + trailing-6-month
// least-squares slope, projected one month ahead. Transparent statistics,
// mirrors argus/src/app/api/forecast exactly.
// ---------------------------------------------------------------------------
app.get('/forecast', async (req, res) => {
  const districtFilter = req.query.district;
  const limit = parseInt(req.query.limit ?? '10', 10);
  try {
    const capp = catalyst.initialize(req);
    const [cases, units, districts] = await Promise.all([
      fetchTable(capp, 'CaseMaster'),
      fetchTable(capp, 'Unit'),
      fetchTable(capp, 'District'),
    ]);

    const districtNameById = new Map(districts.map((d) => [S(d.DistrictID), S(d.DistrictName)]));
    const unitDistrictName = new Map(units.map((u) => [S(u.UnitID), districtNameById.get(S(u.DistrictID)) ?? 'Unknown']));

    const byDistrict = {};
    const stateMonths = {};
    cases.forEach((c) => {
      const m = S(c.CrimeRegisteredDate).slice(0, 7);
      if (!/^\d{4}-\d{2}$/.test(m)) return;
      const dn = unitDistrictName.get(S(c.PoliceStationID)) ?? 'Unknown';
      (byDistrict[dn] ??= {})[m] = (byDistrict[dn][m] ?? 0) + 1;
      stateMonths[m] = (stateMonths[m] ?? 0) + 1;
    });

    const allMonths = Object.keys(stateMonths).sort();
    if (allMonths.length === 0) return res.json({ state: null, districts: [] });

    const series = (counts) => allMonths.map((m) => counts[m] ?? 0);
    const analyse = (values) => {
      const window = values.slice(-6);
      const n = window.length;
      const xMean = (n - 1) / 2;
      const yMean = window.reduce((a, b) => a + b, 0) / n;
      let num = 0;
      let den = 0;
      window.forEach((y, x) => {
        num += (x - xMean) * (y - yMean);
        den += (x - xMean) ** 2;
      });
      const slope = den ? num / den : 0;
      const ma3 = values.slice(-3).reduce((a, b) => a + b, 0) / Math.min(3, values.length);
      const projectedNext = Math.max(0, Math.round(ma3 + slope));
      const baseline = values.reduce((a, b) => a + b, 0) / values.length;
      const pctChange = baseline ? ((projectedNext - baseline) / baseline) * 100 : 0;
      const direction = slope > 0.5 ? 'rising' : slope < -0.5 ? 'falling' : 'stable';
      return { slope: +slope.toFixed(2), movingAvg3: +ma3.toFixed(1), projectedNext, pctChange: +pctChange.toFixed(1), direction };
    };

    let districtRows = Object.entries(byDistrict)
      .filter(([dn]) => dn !== 'Unknown')
      .map(([districtName, counts]) => {
        const values = series(counts);
        return { districtName, lastMonth: values[values.length - 1], ...analyse(values) };
      });

    if (districtFilter) {
      districtRows = districtRows.filter((r) => normalizeDistrict(r.districtName) === normalizeDistrict(districtFilter));
    }
    districtRows.sort((a, b) => b.slope - a.slope || b.projectedNext - a.projectedNext);

    const stateValues = series(stateMonths);
    res.json({
      state: { months: allMonths, counts: stateValues, ...analyse(stateValues) },
      districts: districtRows.slice(0, limit),
    });
  } catch (e) {
    console.error('forecast:', e);
    res.status(500).json({ error: 'Failed to compute forecast' });
  }
});

// ---------------------------------------------------------------------------
// GET /demographics  (?district=)
// Victim/accused demographic profile + complainant occupation distribution.
// Mirrors argus/src/app/api/demographics exactly.
// ---------------------------------------------------------------------------
const AGE_BANDS = [
  ['<18', 0, 17],
  ['18-30', 18, 30],
  ['31-45', 31, 45],
  ['46-60', 46, 60],
  ['60+', 61, 200],
];
const genderOf = (v) => {
  const s = S(v).toUpperCase();
  if (s === '1' || s === 'M') return 'male';
  if (s === '2' || s === 'F') return 'female';
  return 'other';
};
const demoProfile = (people) => {
  const ages = people.map((p) => p.age).filter((a) => !isNaN(a)).sort((a, b) => a - b);
  const median = ages.length ? ages[Math.floor(ages.length / 2)] : null;
  const bands = AGE_BANDS.map(([label, lo, hi]) => ({
    band: label,
    count: ages.filter((a) => a >= lo && a <= hi).length,
  }));
  const gender = { male: 0, female: 0, other: 0 };
  people.forEach((p) => gender[p.gender]++);
  return { total: people.length, medianAge: median, ageBands: bands, gender };
};

app.get('/demographics', async (req, res) => {
  const districtFilter = req.query.district;
  try {
    const capp = catalyst.initialize(req);
    const [cases, units, districts, victims, accused, complainants, occupations] = await Promise.all([
      fetchTable(capp, 'CaseMaster'),
      fetchTable(capp, 'Unit'),
      fetchTable(capp, 'District'),
      fetchTable(capp, 'Victim'),
      fetchTable(capp, 'Accused'),
      fetchTable(capp, 'ComplainantDetails'),
      fetchTable(capp, 'OccupationMaster'),
    ]);

    const districtNameById = new Map(districts.map((d) => [S(d.DistrictID), S(d.DistrictName)]));
    const unitDistrict = new Map(units.map((u) => [S(u.UnitID), districtNameById.get(S(u.DistrictID)) ?? 'Unknown']));
    const occupationById = new Map(occupations.map((o) => [S(o.OccupationID), S(o.OccupationName)]));

    const inScope = new Set(
      cases
        .filter((c) => {
          if (!districtFilter) return true;
          const dn = unitDistrict.get(S(c.PoliceStationID));
          return dn && normalizeDistrict(dn) === normalizeDistrict(districtFilter);
        })
        .map((c) => S(c.CaseMasterID))
    );

    const victimProfile = demoProfile(
      victims
        .filter((v) => inScope.has(S(v.CaseMasterID)))
        .map((v) => ({ age: parseInt(S(v.AgeYear), 10), gender: genderOf(v.GenderID) }))
    );
    const accusedProfile = demoProfile(
      accused
        .filter((a) => inScope.has(S(a.CaseMasterID)))
        .map((a) => ({ age: parseInt(S(a.AgeYear), 10), gender: genderOf(a.GenderID) }))
    );

    const occCounts = new Map();
    complainants.forEach((c) => {
      if (!inScope.has(S(c.CaseMasterID))) return;
      const name = occupationById.get(S(c.OccupationID)) ?? 'Unknown';
      occCounts.set(name, (occCounts.get(name) ?? 0) + 1);
    });
    const topOccupations = Array.from(occCounts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    res.json({
      district: districtFilter ?? null,
      victims: victimProfile,
      accused: accusedProfile,
      topOccupations,
    });
  } catch (e) {
    console.error('demographics:', e);
    res.status(500).json({ error: 'Failed to compute demographics' });
  }
});

// Health check — also reports which tables are reachable, for setup debugging
app.get('/health', async (req, res) => {
  const capp = catalyst.initialize(req);
  const tables = ['CaseMaster', 'Unit', 'District', 'GravityOffence', 'CrimeHead', 'Accused',
    'Victim', 'Employee', 'PersonMaster', 'ArrestSurrender', 'Anomalies', 'Hotspots',
    'TrendAlerts', 'StationRiskScore', 'ComplainantDetails', 'OccupationMaster'];
  const status = {};
  for (const t of tables) {
    try {
      const page = await capp.datastore().table(t).getPagedRows({ maxRows: 1 });
      status[t] = (page.data || []).length > 0 ? 'ok' : 'empty';
    } catch {
      status[t] = 'missing';
    }
  }
  res.json(status);
});

module.exports = app;
