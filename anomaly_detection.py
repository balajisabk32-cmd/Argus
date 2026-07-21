import sys
import numpy as np
import pandas as pd
from pathlib import Path
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler

DATA_DIR = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("./output")
CONTAMINATION = 0.03   # ~3% of cases per crime-head group get flagged
RANDOM_STATE = 42

CaseMaster = pd.read_csv(DATA_DIR / "CaseMaster.csv", parse_dates=["IncidentFromDate", "IncidentToDate", "InfoReceivedPSDate"])
Accused = pd.read_csv(DATA_DIR / "Accused.csv")
Victim = pd.read_csv(DATA_DIR / "Victim.csv")

# ---------------------------------------------------------------------------
# Feature engineering
# ---------------------------------------------------------------------------
df = CaseMaster.copy()

hour = df["IncidentFromDate"].dt.hour + df["IncidentFromDate"].dt.minute / 60
df["HourSin"] = np.sin(2 * np.pi * hour / 24)
df["HourCos"] = np.cos(2 * np.pi * hour / 24)

delay_hours = (df["InfoReceivedPSDate"] - df["IncidentToDate"]).dt.total_seconds() / 3600
df["ReportingDelayHours"] = delay_hours.clip(lower=0)

df["Gravity"] = df["GravityOffenceID"]

n_accused = Accused.groupby("CaseMasterID").size().rename("NumAccused")
n_victims = Victim.groupby("CaseMasterID").size().rename("NumVictims")
df = df.merge(n_accused, left_on="CaseMasterID", right_index=True, how="left")
df = df.merge(n_victims, left_on="CaseMasterID", right_index=True, how="left")
df["NumAccused"] = df["NumAccused"].fillna(0)
df["NumVictims"] = df["NumVictims"].fillna(0)

# Distance (km, equirectangular approx -- fine at this scale) from the
# registering station's own median incident location.
station_centroid = df.groupby("PoliceStationID")[["latitude", "longitude"]].transform("median")
lat_rad = np.radians(df["latitude"])
dlat = np.radians(df["latitude"] - station_centroid["latitude"])
dlon = np.radians(df["longitude"] - station_centroid["longitude"])
R = 6371
df["DistFromStationTypical"] = R * np.sqrt(dlat**2 + (dlon * np.cos(lat_rad))**2)

FEATURES = ["HourSin", "HourCos", "ReportingDelayHours", "Gravity", "NumAccused", "NumVictims", "DistFromStationTypical"]
FEATURE_LABELS = {
    "HourSin": "Off-pattern time of day", "HourCos": "Off-pattern time of day",
    "ReportingDelayHours": "Unusual reporting delay",
    "Gravity": "Unusual gravity classification for this crime type",
    "NumAccused": "Unusual number of accused", "NumVictims": "Unusual number of victims",
    "DistFromStationTypical": "Unusual location for this station",
}

# ---------------------------------------------------------------------------
# Fit Isolation Forest per crime-head group
# ---------------------------------------------------------------------------
results = []
for crime_head_id, group in df.groupby("CrimeMajorHeadID"):
    if len(group) < 20:
        continue  # too few cases in this group for a meaningful model

    X = group[FEATURES].fillna(0).values
    scaler = StandardScaler()
    Xs = scaler.fit_transform(X)

    model = IsolationForest(contamination=CONTAMINATION, random_state=RANDOM_STATE, n_estimators=200)
    raw_scores = model.fit_predict(Xs)          # -1 = anomaly, 1 = normal
    anomaly_score = model.decision_function(Xs)  # lower = more anomalous

    # per-feature z-scores within this crime-head group, for explainability
    z = pd.DataFrame(Xs, columns=FEATURES, index=group.index)

    for idx, is_anom, score in zip(group.index, raw_scores, anomaly_score):
        if is_anom != -1:
            continue
        row_z = z.loc[idx].abs().sort_values(ascending=False)
        top_features = row_z.index[:2].tolist()
        drivers = sorted(set(FEATURE_LABELS[f] for f in top_features))
        results.append({
            "CaseMasterID": df.loc[idx, "CaseMasterID"],
            "CrimeMajorHeadID": crime_head_id,
            "AnomalyScore": round(float(score), 4),   # more negative = more anomalous
            "PrimaryDrivers": "; ".join(drivers),
            "ReportingDelayHours": round(float(df.loc[idx, "ReportingDelayHours"]), 1),
            "NumAccused": int(df.loc[idx, "NumAccused"]),
            "NumVictims": int(df.loc[idx, "NumVictims"]),
            "DistFromStationTypicalKm": round(float(df.loc[idx, "DistFromStationTypical"]), 2),
        })

Anomalies = pd.DataFrame(results).sort_values("AnomalyScore")  # most anomalous first
Anomalies.to_csv(DATA_DIR / "Anomalies.csv", index=False)

print(f"Anomalies.csv   {len(Anomalies):>5} flagged cases out of {len(df)} total ({len(Anomalies)/len(df)*100:.1f}%)")
if len(Anomalies):
    print("\nMost anomalous cases:")
    print(Anomalies.head(5)[["CaseMasterID", "AnomalyScore", "PrimaryDrivers"]].to_string(index=False))
