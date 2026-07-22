const catalyst = require('zcatalyst-sdk-node');
const fs = require('fs');
const path = require('path');

// Map markdown schema types to Catalyst Data Store types
const TYPE_MAPPING = {
  'Int': 'bigint',
  'Text': 'varchar',
  'Date': 'datetime',
  'Datetime': 'datetime',
  'Double': 'double',
  'Boolean': 'boolean'
};

function parseSchema() {
  const content = `
## CaseMaster

| Column | Type |
|---|---|
| CaseMasterID | Int |
| CrimeNo | Text |
| CaseNo | Int |
| CrimeRegisteredDate | Date |
| PolicePersonID | Int |
| PoliceStationID | Int |
| CaseCategoryID | Int |
| GravityOffenceID | Int |
| CrimeMajorHeadID | Int |
| CrimeMinorHeadID | Int |
| CaseStatusID | Int |
| CourtID | Int |
| IncidentFromDate | Datetime |
| IncidentToDate | Datetime |
| InfoReceivedPSDate | Datetime |
| latitude | Double |
| longitude | Double |
| BriefFacts | Text |

## Unit

| Column | Type |
|---|---|
| UnitID | Int |
| UnitName | Text |
| TypeID | Int |
| ParentUnit | Double |
| NationalityID | Int |
| StateID | Int |
| DistrictID | Int |
| Active | Int |

## District

| Column | Type |
|---|---|
| DistrictID | Int |
| DistrictName | Text |
| StateID | Int |
| Active | Int |

## GravityOffence

| Column | Type |
|---|---|
| GravityOffenceID | Int |
| LookupValue | Text |

## CrimeHead

| Column | Type |
|---|---|
| CrimeHeadID | Int |
| CrimeGroupName | Text |
| Active | Int |

## Accused

| Column | Type |
|---|---|
| AccusedMasterID | Int |
| CaseMasterID | Int |
| PersonMasterID | Int |
| AccusedName | Text |
| AgeYear | Int |
| GenderID | Text |
| PersonID | Text |
| MO | Text |

## Victim

| Column | Type |
|---|---|
| VictimMasterID | Int |
| CaseMasterID | Int |
| VictimName | Text |
| AgeYear | Int |
| GenderID | Int |
| VictimPolice | Int |

## Employee

| Column | Type |
|---|---|
| EmployeeID | Int |
| DistrictID | Int |
| UnitID | Int |
| RankID | Int |
| DesignationID | Int |
| KGID | Text |
| FirstName | Text |
| EmployeeDOB | Date |
| GenderID | Int |
| BloodGroupID | Int |
| PhysicallyChallenged | Int |
| AppointmentDate | Date |

## PersonMaster

| Column | Type |
|---|---|
| PersonMasterID | Int |
| PersonName | Text |
| GenderID | Text |
| HomeDistrictID | Int |
| PrimaryCrimeHeadID | Int |
| PrimaryMO | Text |
| TotalCasesLinked | Int |
| IsRepeatOffender | Int |

## ArrestSurrender

| Column | Type |
|---|---|
| ArrestSurrenderID | Int |
| CaseMasterID | Int |
| ArrestSurrenderTypeID | Int |
| ArrestSurrenderDate | Date |
| ArrestSurrenderStateId | Int |
| ArrestSurrenderDistrictId | Int |
| PoliceStationID | Int |
| IOID | Int |
| CourtID | Int |
| AccusedMasterID | Int |
| IsAccused | Int |
| IsComplainantAccused | Int |

## Anomalies

| Column | Type |
|---|---|
| CaseMasterID | Int |
| CrimeMajorHeadID | Int |
| AnomalyScore | Double |
| PrimaryDrivers | Text |
| ReportingDelayHours | Double |
| NumAccused | Int |
| NumVictims | Int |
| DistFromStationTypicalKm | Double |

## Hotspots

| Column | Type |
|---|---|
| DistrictName | Text |
| GridLat | Double |
| GridLon | Double |
| TimeBucket | Text |
| CaseCount | Int |
| AvgGravity | Double |
| DensityScore | Double |
| IsHotspot | Boolean |

## TrendAlerts

| Column | Type |
|---|---|
| DistrictName | Text |
| CrimeGroupName | Text |
| Month | Text |
| CaseCount | Int |
| BaselineMean | Double |
| ZScore | Double |
| AlertLevel | Text |

## StationRiskScore

| Column | Type |
|---|---|
| PoliceStationID | Int |
| UnitName | Text |
| DistrictName | Text |
| VelocityScore | Double |
| SeverityScore | Double |
| RepeatScore | Double |
| RiskScore | Double |
| RiskTier | Text |

## ComplainantDetails

| Column | Type |
|---|---|
| ComplainantID | Int |
| CaseMasterID | Int |
| ComplainantName | Text |
| AgeYear | Int |
| OccupationID | Int |
| ReligionID | Int |
| CasteID | Int |
| GenderID | Int |

## OccupationMaster

| Column | Type |
|---|---|
| OccupationID | Int |
| OccupationName | Text |
`;

  const lines = content.split('\n');
  
  const tables = [];
  let currentTable = null;

  for (const line of lines) {
    const tableMatch = line.match(/^##\s+([A-Za-z0-9_]+)/);
    if (tableMatch) {
      currentTable = {
        tableName: tableMatch[1],
        columns: []
      };
      tables.push(currentTable);
      continue;
    }

    if (currentTable && line.startsWith('|') && !line.includes('---|---') && !line.includes('Column | Type')) {
      const parts = line.split('|').map(p => p.trim()).filter(Boolean);
      if (parts.length === 2) {
        const colName = parts[0];
        const colType = parts[1];
        
        currentTable.columns.push({
          column_name: colName,
          data_type: TYPE_MAPPING[colType] || 'varchar',
          max_length: TYPE_MAPPING[colType] === 'varchar' ? 255 : null,
          is_mandatory: false
        });
      }
    }
  }
  
  return tables;
}

module.exports = async (cronDetails, context) => {
  try {
    const app = catalyst.initialize(context);
    const datastore = app.datastore();

    console.log(`Parsing embedded schema...\n`);
    const tables = parseSchema();
    console.log(`Found ${tables.length} tables in schema.\n`);

    for (const tableDef of tables) {
      const { tableName, columns } = tableDef;
      
      console.log(`Creating table '${tableName}' with ${columns.length} columns...\n`);
      
      const columnsToCreate = columns.map(col => {
        const c = { ...col };
        if (c.data_type !== 'varchar') delete c.max_length;
        return c;
      });

      try {
        const createdTable = await datastore.createTable({
          table_name: tableName,
          columns: columnsToCreate
        });
        console.log(`Successfully created table '${tableName}' (ID: ${createdTable.table_id})\n`);
      } catch (err) {
        if (err.toString().includes('ALREADY_EXISTS') || (err.message && err.message.includes('exists'))) {
          console.log(`Table '${tableName}' already exists. Skipping.\n`);
        } else {
          console.log(`Failed to create table '${tableName}': ${err.toString()}\n`);
          // Continue with next table
        }
      }
    }

    context.closeWithSuccess('Table creation complete.');
  } catch (error) {
    context.closeWithFailure(`Initialization error: ${error.toString()}`);
  }
};
