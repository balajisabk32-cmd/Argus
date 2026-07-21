"""
Crime Intelligence Analysis Layer
Karnataka SCRB Platform -- Phase 3 (Pattern & Trend Discovery / Risk Scoring)

Consumes the tables produced by generate_fir_synthetic_data.py and produces
three analysis-ready CSVs that back new API routes:

  Hotspots.csv       -> /api/hotspots     (spatiotemporal density clusters)
  TrendAlerts.csv     -> /api/trends       ("emerging trend" spike flags)
  StationRiskScore.csv -> /api/risk-score  (0-100 composite risk per station)

IMPORTANT FRAMING NOTE (be honest about this in the pitch):
This is a *statistical / rule-based* intelligence layer, not a trained ML
model -- z-score spike detection and a weighted composite score. That's a
legitimate and defensible v1 for "AI-driven" pattern discovery (it's exactly
what real crime-analysis units use before they have enough labeled outcome
data to train a supervised risk model), but don't oversell it as ML in a
pitch. The natural v2 upgrade path (mentioned at the bottom) is a trained
model once real historical outcomes exist to learn from.

Run:  python3 crime_intelligence_analysis.py [data_dir]
      (data_dir defaults to ./output; point it at your project's Datasets
       folder, e.g. `python3 crime_intelligence_analysis.py ../Datasets`,
       to read the real CSVs and write the three new ones alongside them)
Reads from:  <data_dir>/*.csv   (CaseMaster, Unit, District, CrimeHead, Accused, PersonMaster)
Writes to:   <data_dir>/*.csv   (adds Hotspots.csv, TrendAlerts.csv, StationRiskScore.csv)
"""

import sys
import numpy as np
import pandas as pd
from pathlib import Path

DATA_DIR = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("./output")

CaseMaster = pd.read_csv(DATA_DIR / "CaseMaster.csv", parse_dates=["IncidentFromDate", "CrimeRegisteredDate"])
Unit = pd.read_csv(DATA_DIR / "Unit.csv")
District = pd.read_csv(DATA_DIR / "District.csv")
CrimeHead = pd.read_csv(DATA_DIR / "CrimeHead.csv")
Accused = pd.read_csv(DATA_DIR / "Accused.csv")
PersonMaster = pd.read_csv(DATA_DIR / "PersonMaster.csv")

cm = CaseMaster.merge(Unit[["UnitID", "DistrictID"]], left_on="PoliceStationID", right_on="UnitID", how="left")
cm = cm.merge(District[["DistrictID", "DistrictName"]], on="DistrictID", how="left")
cm = cm.merge(CrimeHead[["CrimeHeadID", "CrimeGroupName"]], left_on="CrimeMajorHeadID", right_on="CrimeHeadID", how="left")
cm["Month"] = cm["IncidentFromDate"].dt.to_period("M")
cm["Hour"] = cm["IncidentFromDate"].dt.hour


# ---------------------------------------------------------------------------
# 1. SPATIOTEMPORAL HOTSPOTS
#    Bin lat/lon into a coarse grid (~0.05 deg ~ 5km cells) and cross with a
#    4-bucket time-of-day window. A "hotspot" is a grid-cell/time-window
#    combination with case density well above the district's own average --
#    this is what layers "time of day with location" per the brief.
# ---------------------------------------------------------------------------
GRID_SIZE = 0.05  # degrees, roughly 5km at this latitude

def time_bucket(hour):
    if 5 <= hour < 12:
        return "Morning"
    if 12 <= hour < 17:
        return "Afternoon"
    if 17 <= hour < 22:
        return "Evening"
    return "Night"

cm["GridLat"] = (cm["latitude"] / GRID_SIZE).round() * GRID_SIZE
cm["GridLon"] = (cm["longitude"] / GRID_SIZE).round() * GRID_SIZE
cm["TimeBucket"] = cm["Hour"].apply(time_bucket)

hotspot = (
    cm.groupby(["DistrictName", "GridLat", "GridLon", "TimeBucket"])
    .agg(CaseCount=("CaseMasterID", "count"), AvgGravity=("GravityOffenceID", "mean"))
    .reset_index()
)
# Density score relative to the district's own median cell -- keeps hotspots
# comparable across districts of very different overall case volume.
district_median = hotspot.groupby("DistrictName")["CaseCount"].transform("median").replace(0, 1)
hotspot["DensityScore"] = (hotspot["CaseCount"] / district_median).round(2)
hotspot["IsHotspot"] = hotspot["DensityScore"] >= 2.0  # cell has 2x+ its district's typical density
hotspot = hotspot.sort_values("DensityScore", ascending=False)
hotspot.to_csv(DATA_DIR / "Hotspots.csv", index=False)


# ---------------------------------------------------------------------------
# 2. TREND ALERTS (emerging-trend spike detection)
#    For each District x CrimeHead, build a monthly case-count series, then
#    flag months where the count is a statistical outlier vs. the trailing
#    6-month baseline (z-score >= 1.5). This is the "red-zone pulsing" signal.
# ---------------------------------------------------------------------------
monthly = (
    cm.groupby(["DistrictName", "CrimeGroupName", "Month"])
    .size()
    .reset_index(name="CaseCount")
    .sort_values(["DistrictName", "CrimeGroupName", "Month"])
)

alerts = []
for (district, crime), grp in monthly.groupby(["DistrictName", "CrimeGroupName"]):
    grp = grp.sort_values("Month").reset_index(drop=True)
    counts = grp["CaseCount"].tolist()
    months = grp["Month"].astype(str).tolist()
    for i in range(len(counts)):
        window = counts[max(0, i - 6):i]  # trailing baseline, excludes current month
        if len(window) < 3:
            continue  # not enough history yet to call something a "spike"
        mean, std = np.mean(window), np.std(window)
        z = (counts[i] - mean) / std if std > 0 else (2.0 if counts[i] > mean else 0.0)
        if z >= 1.5:
            alerts.append({
                "DistrictName": district, "CrimeGroupName": crime, "Month": months[i],
                "CaseCount": counts[i], "BaselineMean": round(mean, 1), "ZScore": round(z, 2),
                "AlertLevel": "High" if z >= 2.5 else "Moderate",
            })

TrendAlerts = pd.DataFrame(alerts).sort_values("ZScore", ascending=False)
TrendAlerts.to_csv(DATA_DIR / "TrendAlerts.csv", index=False)


# ---------------------------------------------------------------------------
# 3. STATION-LEVEL RISK SCORE (Predictive ML Model)
#    Uses a RandomForestRegressor to predict next month's case volume
#    based on historical features per station. The predicted volume is 
#    then scaled to a 0-100 risk score.
# ---------------------------------------------------------------------------
from sklearn.ensemble import RandomForestRegressor

# Create a monthly time series panel for all stations
station_monthly = cm.groupby(["PoliceStationID", "Month"]).size().reset_index(name="CaseCount")

cm["IsHeinous"] = (cm["GravityOffenceID"] == 1).astype(int)
severity_monthly = cm.groupby(["PoliceStationID", "Month"])["IsHeinous"].mean().reset_index(name="HeinousShare")

acc_case = Accused.merge(cm[["CaseMasterID", "PoliceStationID", "Month"]], on="CaseMasterID")
acc_case = acc_case.merge(PersonMaster[["PersonMasterID", "IsRepeatOffender"]], on="PersonMasterID")
repeat_monthly = (
    acc_case.groupby(["PoliceStationID", "Month"])
    .agg(TotalAccused=("AccusedMasterID", "count"), RepeatAccused=("IsRepeatOffender", "sum"))
    .reset_index()
)
repeat_monthly["RepeatShare"] = repeat_monthly["RepeatAccused"] / repeat_monthly["TotalAccused"].replace(0, 1)

panel = station_monthly.merge(severity_monthly, on=["PoliceStationID", "Month"], how="outer")
panel = panel.merge(repeat_monthly[["PoliceStationID", "Month", "RepeatShare"]], on=["PoliceStationID", "Month"], how="outer")
panel = panel.fillna(0).sort_values(["PoliceStationID", "Month"])

# Create Lag 1 features for prediction
panel["Lag1_CaseCount"] = panel.groupby("PoliceStationID")["CaseCount"].shift(1)
panel["Lag1_HeinousShare"] = panel.groupby("PoliceStationID")["HeinousShare"].shift(1)
panel["Lag1_RepeatShare"] = panel.groupby("PoliceStationID")["RepeatShare"].shift(1)

model_df = panel.dropna().copy()
latest_month = model_df["Month"].max()

train_df = model_df[model_df["Month"] < latest_month].copy()
test_df = model_df[model_df["Month"] == latest_month].copy()

FEATURES = ["Lag1_CaseCount", "Lag1_HeinousShare", "Lag1_RepeatShare"]
TARGET = "CaseCount"

if len(train_df) > 0 and len(test_df) > 0:
    rf = RandomForestRegressor(n_estimators=100, random_state=42)
    rf.fit(train_df[FEATURES], train_df[TARGET])
    test_df["PredictedCases"] = rf.predict(test_df[FEATURES])
else:
    test_df = model_df[model_df["Month"] == latest_month].copy()
    test_df["PredictedCases"] = test_df["CaseCount"]

def minmax(s):
    lo, hi = s.min(), s.max()
    return (s - lo) / (hi - lo) * 100 if hi > lo else pd.Series(50.0, index=s.index)

# To keep frontend happy, we also calculate the old component scores for the latest month
test_df["VelocityScore"] = minmax(test_df["Lag1_CaseCount"])
test_df["SeverityScore"] = minmax(test_df["Lag1_HeinousShare"])
test_df["RepeatScore"] = minmax(test_df["Lag1_RepeatShare"])
test_df["RiskScore"] = minmax(test_df["PredictedCases"]).round(1)

risk = test_df[["PoliceStationID", "VelocityScore", "SeverityScore", "RepeatScore", "PredictedCases", "RiskScore"]].copy()

risk = risk.merge(Unit[["UnitID", "UnitName", "DistrictID"]], left_on="PoliceStationID", right_on="UnitID", how="left")
risk = risk.merge(District[["DistrictID", "DistrictName"]], on="DistrictID", how="left")
risk["RiskTier"] = pd.cut(risk["RiskScore"], bins=[-1, 33, 66, 100], labels=["Low", "Medium", "High"])

StationRiskScore = risk[[
    "PoliceStationID", "UnitName", "DistrictName", "VelocityScore", "SeverityScore",
    "RepeatScore", "RiskScore", "RiskTier",
]].sort_values("RiskScore", ascending=False)
StationRiskScore.to_csv(DATA_DIR / "StationRiskScore.csv", index=False)


# ---------------------------------------------------------------------------
print(f"Hotspots.csv          {len(hotspot):>5} grid-cell/time-window rows  ({int(hotspot.IsHotspot.sum())} flagged hotspots)")
print(f"TrendAlerts.csv       {len(TrendAlerts):>5} spike-flagged district/crime/month rows")
print(f"StationRiskScore.csv  {len(StationRiskScore):>5} stations scored  (top tier: {(StationRiskScore.RiskTier=='High').sum()} High)")
