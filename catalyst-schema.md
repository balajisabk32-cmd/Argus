# Catalyst Data Store schema (generated from Datasets/*.csv)

Create each table in Console -> Data Store with EXACTLY these names and columns.

## CaseMaster  (5000 rows)

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

## Unit  (60 rows)

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

## District  (21 rows)

| Column | Type |
|---|---|
| DistrictID | Int |
| DistrictName | Text |
| StateID | Int |
| Active | Int |

## GravityOffence  (3 rows)

| Column | Type |
|---|---|
| GravityOffenceID | Int |
| LookupValue | Text |

## CrimeHead  (5 rows)

| Column | Type |
|---|---|
| CrimeHeadID | Int |
| CrimeGroupName | Text |
| Active | Int |

## Accused  (8571 rows)

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

## Victim  (3468 rows)

| Column | Type |
|---|---|
| VictimMasterID | Int |
| CaseMasterID | Int |
| VictimName | Text |
| AgeYear | Int |
| GenderID | Int |
| VictimPolice | Int |

## Employee  (250 rows)

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

## PersonMaster  (8149 rows)

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

## ArrestSurrender  (4643 rows)

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

## Anomalies  (152 rows)

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

## Hotspots  (4978 rows)

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

## TrendAlerts  (386 rows)

| Column | Type |
|---|---|
| DistrictName | Text |
| CrimeGroupName | Text |
| Month | Text |
| CaseCount | Int |
| BaselineMean | Double |
| ZScore | Double |
| AlertLevel | Text |

## StationRiskScore  (45 rows)

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

## ComplainantDetails  (5245 rows)

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

## OccupationMaster  (9 rows)

| Column | Type |
|---|---|
| OccupationID | Int |
| OccupationName | Text |

