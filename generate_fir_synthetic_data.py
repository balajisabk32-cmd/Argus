"""
Police FIR System - Schema-Compliant Synthetic Data Generator
Karnataka Police Department ER Diagram

Generates one CSV per table, with:
  - correct PK data types (INT, sequential)
  - correct FK linkages (child rows reference real parent IDs)
  - correct cardinalities (1:M / M:1 exactly as in the Relationship Matrix)
  - CrimeNo / CaseNo built exactly per the documented format:
        1-digit CaseCategoryCode + 4-digit DistrictID + 4-digit PoliceStationID(UnitID)
        + 4-digit Year + 5-digit running serial (per station+category+year)

Run:  python3 generate_fir_synthetic_data.py
Output: ./output/<TableName>.csv  (one file per table)
"""

import random
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from pathlib import Path
from faker import Faker

# --------------------------------------------------------------------------
# CONFIG - tune volumes here
# --------------------------------------------------------------------------
SEED = 42
NUM_CASES = 5000                 # rows in CaseMaster
NUM_EMPLOYEES = 250
STATIONS_PER_DISTRICT = (2, 4)    # min, max police stations per district
YEAR_RANGE = (2023, 2026)
OUT_DIR = Path("./output")

# Repeat-offender identity linking (drives the network graph's "same person,
# multiple FIRs" edges). Each repeat identity gets ONE PersonMasterID that is
# reused across 2-5 distinct cases; everyone else gets a PersonMasterID used
# exactly once. NUM_REPEAT_PERSONS is a *count of distinct people*, not a
# fraction of accused rows -- tune it directly against how dense you want the
# repeat-offender network to look.
NUM_REPEAT_PERSONS = int(NUM_CASES * 0.05)   # ~5% of cases seed a repeat identity
REPEAT_PERSON_CASE_COUNT_WEIGHTS = {2: 55, 3: 25, 4: 12, 5: 8}
SAME_DISTRICT_BIAS = 0.7          # probability a repeat offender's other cases stay in their home district

random.seed(SEED)
np.random.seed(SEED)
fake = Faker("en_IN")
Faker.seed(SEED)

OUT_DIR.mkdir(exist_ok=True)


def save(df: pd.DataFrame, name: str):
    df.to_csv(OUT_DIR / f"{name}.csv", index=False)
    print(f"  {name:28s} {len(df):>6} rows")


def pk_range(n, start=1):
    return list(range(start, start + n))


# --------------------------------------------------------------------------
# 1. State
# --------------------------------------------------------------------------
state_rows = [
    {"StateID": 1, "StateName": "Karnataka", "NationalityID": 1, "Active": 1},
    {"StateID": 2, "StateName": "Tamil Nadu", "NationalityID": 1, "Active": 1},
    {"StateID": 3, "StateName": "Andhra Pradesh", "NationalityID": 1, "Active": 1},
    {"StateID": 4, "StateName": "Maharashtra", "NationalityID": 1, "Active": 1},
]
State = pd.DataFrame(state_rows)

# --------------------------------------------------------------------------
# 2. District  (Karnataka districts are the operational focus; a few districts
#    from neighbouring states exist only so ArrestSurrender can reference an
#    inter-state arrest, matching the ER note "arrest/surrender occurred" in
#    any state/district)
# --------------------------------------------------------------------------
karnataka_districts = [
    "Bangalore Urban", "Mysore", "Dakshina Kannada", "Belgaum", "Gulbarga",
    "Bellary", "Tumkur", "Bijapur", "Dharwad", "Udupi", "Kodagu", "Shimoga",
    "Raichur", "Chitradurga", "Hassan",
]
other_districts = {
    2: ["Chennai", "Coimbatore"],
    3: ["Vijayawada", "Visakhapatnam"],
    4: ["Mumbai City", "Pune"],
}

district_rows = []
did = 1
for name in karnataka_districts:
    district_rows.append({"DistrictID": did, "DistrictName": name, "StateID": 1, "Active": 1})
    did += 1
for state_id, names in other_districts.items():
    for name in names:
        district_rows.append({"DistrictID": did, "DistrictName": name, "StateID": state_id, "Active": 1})
        did += 1
District = pd.DataFrame(district_rows)
karnataka_district_ids = District[District.StateID == 1].DistrictID.tolist()

DISTRICT_BBOXES = {
    "Bangalore Urban": {"lat": (12.8, 13.1), "lon": (77.4, 77.7)},
    "Mysore": {"lat": (11.9, 12.3), "lon": (76.2, 76.8)},
    "Dakshina Kannada": {"lat": (12.7, 13.1), "lon": (74.8, 75.2)},
    "Belgaum": {"lat": (15.5, 16.2), "lon": (74.3, 75.0)},
    "Gulbarga": {"lat": (16.8, 17.5), "lon": (76.6, 77.3)},
    "Bellary": {"lat": (14.8, 15.3), "lon": (76.7, 77.1)},
    "Tumkur": {"lat": (13.0, 14.1), "lon": (76.7, 77.3)},
    "Bijapur": {"lat": (16.4, 17.1), "lon": (75.5, 76.3)},
    "Dharwad": {"lat": (15.2, 15.6), "lon": (74.9, 75.3)},
    "Udupi": {"lat": (13.1, 13.8), "lon": (74.7, 74.9)},
    "Kodagu": {"lat": (12.0, 12.6), "lon": (75.6, 76.0)},
    "Shimoga": {"lat": (13.7, 14.3), "lon": (74.9, 75.6)},
    "Raichur": {"lat": (15.9, 16.4), "lon": (76.5, 77.4)},
    "Chitradurga": {"lat": (13.8, 14.6), "lon": (76.2, 76.8)},
    "Hassan": {"lat": (12.8, 13.3), "lon": (75.9, 76.4)},
}

# --------------------------------------------------------------------------
# 3. UnitType
# --------------------------------------------------------------------------
UnitType = pd.DataFrame([
    {"UnitTypeID": 1, "UnitTypeName": "Police Station", "CityDistState": "City", "Hierarchy": 3, "Active": 1},
    {"UnitTypeID": 2, "UnitTypeName": "Circle Office", "CityDistState": "District", "Hierarchy": 2, "Active": 1},
    {"UnitTypeID": 3, "UnitTypeName": "District SP Office", "CityDistState": "District", "Hierarchy": 1, "Active": 1},
])

# --------------------------------------------------------------------------
# 4. Unit (police stations, one Circle Office + N Police Stations per Karnataka district)
#    UnitID's last 4 digits ARE the "Police Station (Unit) ID" used inside CrimeNo,
#    so we deliberately keep UnitID itself as that 4-digit code.
# --------------------------------------------------------------------------
unit_rows = []
unit_id = 1
station_ids_by_district = {}
for d in karnataka_district_ids:
    circle_id = unit_id
    unit_rows.append({
        "UnitID": unit_id, "UnitName": f"{District.loc[District.DistrictID == d, 'DistrictName'].values[0]} Circle Office",
        "TypeID": 2, "ParentUnit": None, "NationalityID": 1, "StateID": 1, "DistrictID": d, "Active": 1,
    })
    unit_id += 1
    n_stations = random.randint(*STATIONS_PER_DISTRICT)
    station_ids_by_district[d] = []
    for i in range(n_stations):
        unit_rows.append({
            "UnitID": unit_id,
            "UnitName": f"{District.loc[District.DistrictID == d, 'DistrictName'].values[0]} PS-{i+1}",
            "TypeID": 1, "ParentUnit": circle_id, "NationalityID": 1, "StateID": 1, "DistrictID": d, "Active": 1,
        })
        station_ids_by_district[d].append(unit_id)
        unit_id += 1
Unit = pd.DataFrame(unit_rows)
all_station_ids = [s for lst in station_ids_by_district.values() for s in lst]

# --------------------------------------------------------------------------
# 5. Rank / Designation
# --------------------------------------------------------------------------
Rank = pd.DataFrame([
    {"RankID": 1, "RankName": "Constable", "Hierarchy": 6, "Active": 1},
    {"RankID": 2, "RankName": "Head Constable", "Hierarchy": 5, "Active": 1},
    {"RankID": 3, "RankName": "Asst. Sub Inspector", "Hierarchy": 4, "Active": 1},
    {"RankID": 4, "RankName": "Sub Inspector", "Hierarchy": 3, "Active": 1},
    {"RankID": 5, "RankName": "Inspector", "Hierarchy": 2, "Active": 1},
    {"RankID": 6, "RankName": "Dy. Superintendent of Police", "Hierarchy": 1, "Active": 1},
])
Designation = pd.DataFrame([
    {"DesignationID": 1, "DesignationName": "Investigating Officer", "Active": 1, "SortOrder": 1},
    {"DesignationID": 2, "DesignationName": "Station House Officer", "Active": 1, "SortOrder": 2},
    {"DesignationID": 3, "DesignationName": "Beat Officer", "Active": 1, "SortOrder": 3},
    {"DesignationID": 4, "DesignationName": "Record Clerk", "Active": 1, "SortOrder": 4},
])

# --------------------------------------------------------------------------
# 6. Employee
# --------------------------------------------------------------------------
employee_rows = []
for eid in pk_range(NUM_EMPLOYEES):
    district_id = random.choice(karnataka_district_ids)
    unit_id_choice = random.choice(station_ids_by_district[district_id])
    dob = fake.date_of_birth(minimum_age=25, maximum_age=58)
    employee_rows.append({
        "EmployeeID": eid,
        "DistrictID": district_id,
        "UnitID": unit_id_choice,
        "RankID": random.choice(Rank.RankID.tolist()),
        "DesignationID": random.choice(Designation.DesignationID.tolist()),
        "KGID": f"KGID{100000 + eid}",
        "FirstName": fake.first_name(),
        "EmployeeDOB": dob.isoformat(),
        "GenderID": random.choice([1, 2]),          # 1=M, 2=F
        "BloodGroupID": random.randint(1, 8),
        "PhysicallyChallenged": random.choices([0, 1], weights=[97, 3])[0],
        "AppointmentDate": fake.date_between(start_date=dob + timedelta(days=21 * 365), end_date="today").isoformat(),
    })
Employee = pd.DataFrame(employee_rows)

# --------------------------------------------------------------------------
# 7. Court
# --------------------------------------------------------------------------
court_rows = []
cid = 1
for d in karnataka_district_ids:
    for court_type in ["JMFC Court", "Sessions Court"]:
        dname = District.loc[District.DistrictID == d, "DistrictName"].values[0]
        court_rows.append({"CourtID": cid, "CourtName": f"{court_type}, {dname}", "DistrictID": d, "StateID": 1, "Active": 1})
        cid += 1
Court = pd.DataFrame(court_rows)

# --------------------------------------------------------------------------
# 8. CaseCategory  -- codes exactly per the documented CrimeNo spec
# --------------------------------------------------------------------------
CaseCategory = pd.DataFrame([
    {"CaseCategoryID": 1, "LookupValue": "FIR", "CategoryCode": "1"},
    {"CaseCategoryID": 2, "LookupValue": "UDR", "CategoryCode": "3"},
    {"CaseCategoryID": 3, "LookupValue": "Zero FIR", "CategoryCode": "8"},
    {"CaseCategoryID": 4, "LookupValue": "PAR", "CategoryCode": "4"},
])
# case category is overwhelmingly "FIR" in real data
CASE_CATEGORY_WEIGHTS = [0.85, 0.05, 0.05, 0.05]

# --------------------------------------------------------------------------
# 9. GravityOffence
# --------------------------------------------------------------------------
GravityOffence = pd.DataFrame([
    {"GravityOffenceID": 1, "LookupValue": "Heinous"},
    {"GravityOffenceID": 2, "LookupValue": "Non-Heinous"},
    {"GravityOffenceID": 3, "LookupValue": "Petty"},
])

# --------------------------------------------------------------------------
# 10. CrimeHead / CrimeSubHead
# --------------------------------------------------------------------------
CrimeHead = pd.DataFrame([
    {"CrimeHeadID": 1, "CrimeGroupName": "Crimes Against Body", "Active": 1},
    {"CrimeHeadID": 2, "CrimeGroupName": "Crimes Against Property", "Active": 1},
    {"CrimeHeadID": 3, "CrimeGroupName": "Crimes Against Women", "Active": 1},
    {"CrimeHeadID": 4, "CrimeGroupName": "Cybercrime", "Active": 1},
    {"CrimeHeadID": 5, "CrimeGroupName": "Economic Offences", "Active": 1},
])
CrimeSubHead = pd.DataFrame([
    {"CrimeSubHeadID": 1, "CrimeHeadID": 1, "CrimeHeadName": "Murder", "SeqID": 1},
    {"CrimeSubHeadID": 2, "CrimeHeadID": 1, "CrimeHeadName": "Grievous Hurt", "SeqID": 2},
    {"CrimeSubHeadID": 3, "CrimeHeadID": 1, "CrimeHeadName": "Assault", "SeqID": 3},
    {"CrimeSubHeadID": 4, "CrimeHeadID": 2, "CrimeHeadName": "Theft in Dwelling House", "SeqID": 1},
    {"CrimeSubHeadID": 5, "CrimeHeadID": 2, "CrimeHeadName": "Ordinary Theft", "SeqID": 2},
    {"CrimeSubHeadID": 6, "CrimeHeadID": 2, "CrimeHeadName": "Burglary", "SeqID": 3},
    {"CrimeSubHeadID": 7, "CrimeHeadID": 2, "CrimeHeadName": "Robbery", "SeqID": 4},
    {"CrimeSubHeadID": 8, "CrimeHeadID": 3, "CrimeHeadName": "Dowry Harassment", "SeqID": 1},
    {"CrimeSubHeadID": 9, "CrimeHeadID": 3, "CrimeHeadName": "Molestation", "SeqID": 2},
    {"CrimeSubHeadID": 10, "CrimeHeadID": 4, "CrimeHeadName": "Financial Fraud", "SeqID": 1},
    {"CrimeSubHeadID": 11, "CrimeHeadID": 4, "CrimeHeadName": "Identity Theft", "SeqID": 2},
    {"CrimeSubHeadID": 12, "CrimeHeadID": 5, "CrimeHeadName": "Cheating", "SeqID": 1},
    {"CrimeSubHeadID": 13, "CrimeHeadID": 5, "CrimeHeadName": "Criminal Breach of Trust", "SeqID": 2},
])

# --------------------------------------------------------------------------
# 11. Act / Section / CrimeHeadActSection
#     (Bharatiya Nyaya Sanhita, BNS, replaced the IPC nationwide from 1 Jul 2024)
# --------------------------------------------------------------------------
Act = pd.DataFrame([
    {"ActCode": "IPC", "ActDescription": "Indian Penal Code, 1860", "ShortName": "IPC", "Active": 0},
    {"ActCode": "BNS", "ActDescription": "Bharatiya Nyaya Sanhita, 2023", "ShortName": "BNS", "Active": 1},
    {"ActCode": "NDPS", "ActDescription": "Narcotic Drugs and Psychotropic Substances Act, 1985", "ShortName": "NDPS", "Active": 1},
    {"ActCode": "ITACT", "ActDescription": "Information Technology Act, 2000", "ShortName": "IT Act", "Active": 1},
])
Section = pd.DataFrame([
    {"ActCode": "BNS", "SectionCode": "103", "SectionDescription": "Murder", "Active": 1},
    {"ActCode": "BNS", "SectionCode": "115", "SectionDescription": "Voluntarily causing hurt", "Active": 1},
    {"ActCode": "BNS", "SectionCode": "303", "SectionDescription": "Theft", "Active": 1},
    {"ActCode": "BNS", "SectionCode": "305", "SectionDescription": "Theft in a dwelling house", "Active": 1},
    {"ActCode": "BNS", "SectionCode": "331", "SectionDescription": "House-breaking / Burglary", "Active": 1},
    {"ActCode": "BNS", "SectionCode": "309", "SectionDescription": "Robbery", "Active": 1},
    {"ActCode": "BNS", "SectionCode": "85", "SectionDescription": "Cruelty by husband/relatives (Dowry)", "Active": 1},
    {"ActCode": "BNS", "SectionCode": "74", "SectionDescription": "Assault/use of criminal force to woman", "Active": 1},
    {"ActCode": "BNS", "SectionCode": "318", "SectionDescription": "Cheating", "Active": 1},
    {"ActCode": "ITACT", "SectionCode": "66C", "SectionDescription": "Identity theft", "Active": 1},
    {"ActCode": "ITACT", "SectionCode": "66D", "SectionDescription": "Cheating by personation using computer", "Active": 1},
])
CrimeHeadActSection = pd.DataFrame([
    {"CrimeHeadID": 1, "ActCode": "BNS", "SectionCode": "103"},
    {"CrimeHeadID": 1, "ActCode": "BNS", "SectionCode": "115"},
    {"CrimeHeadID": 2, "ActCode": "BNS", "SectionCode": "303"},
    {"CrimeHeadID": 2, "ActCode": "BNS", "SectionCode": "305"},
    {"CrimeHeadID": 2, "ActCode": "BNS", "SectionCode": "331"},
    {"CrimeHeadID": 2, "ActCode": "BNS", "SectionCode": "309"},
    {"CrimeHeadID": 3, "ActCode": "BNS", "SectionCode": "85"},
    {"CrimeHeadID": 3, "ActCode": "BNS", "SectionCode": "74"},
    {"CrimeHeadID": 4, "ActCode": "ITACT", "SectionCode": "66C"},
    {"CrimeHeadID": 4, "ActCode": "ITACT", "SectionCode": "66D"},
    {"CrimeHeadID": 5, "ActCode": "BNS", "SectionCode": "318"},
])

# map each CrimeSubHead -> plausible (ActCode, SectionCode) for use at CaseMaster time
subhead_to_section = {
    1: ("BNS", "103"), 2: ("BNS", "115"), 3: ("BNS", "115"),
    4: ("BNS", "305"), 5: ("BNS", "303"), 6: ("BNS", "331"), 7: ("BNS", "309"),
    8: ("BNS", "85"), 9: ("BNS", "74"),
    10: ("ITACT", "66D"), 11: ("ITACT", "66C"),
    12: ("BNS", "318"), 13: ("BNS", "318"),
}

# --------------------------------------------------------------------------
# 12. CaseStatusMaster
# --------------------------------------------------------------------------
CaseStatusMaster = pd.DataFrame([
    {"CaseStatusID": 1, "CaseStatusName": "Under Investigation"},
    {"CaseStatusID": 2, "CaseStatusName": "Charge Sheeted"},
    {"CaseStatusID": 3, "CaseStatusName": "Closed"},
    {"CaseStatusID": 4, "CaseStatusName": "Undetected"},
])

# --------------------------------------------------------------------------
# 13. OccupationMaster / ReligionMaster / CasteMaster
# --------------------------------------------------------------------------
OccupationMaster = pd.DataFrame([
    {"OccupationID": i + 1, "OccupationName": n} for i, n in enumerate(
        ["Farmer", "Government Employee", "Private Employee", "Business", "Student",
         "Homemaker", "Daily Wage Labourer", "Unemployed", "Retired"])
])
ReligionMaster = pd.DataFrame([
    {"ReligionID": i + 1, "ReligionName": n} for i, n in enumerate(
        ["Hindu", "Muslim", "Christian", "Jain", "Sikh", "Buddhist", "Other"])
])
CasteMaster = pd.DataFrame([
    {"caste_master_id": i + 1, "caste_master_name": n} for i, n in enumerate(
        ["General", "OBC", "SC", "ST", "Minority"])
])

# --------------------------------------------------------------------------
# 14. CaseMaster  -- the core table, with spec-compliant CrimeNo/CaseNo
# --------------------------------------------------------------------------
# running-serial counter, keyed per (PoliceStationID, CaseCategoryID, Year)
serial_counter = {}

case_rows = []
act_section_rows = []
complainant_rows = []
victim_rows = []

first_names = None  # placeholder, faker handles names directly

for i in range(1, NUM_CASES + 1):
    case_id = i
    district_id = random.choice(karnataka_district_ids)
    station_id = random.choice(station_ids_by_district[district_id])
    category_row = CaseCategory.sample(1, weights=CASE_CATEGORY_WEIGHTS).iloc[0]
    category_id, category_code = category_row.CaseCategoryID, category_row.CategoryCode

    year = random.randint(*YEAR_RANGE)
    key = (station_id, category_id, year)
    serial_counter[key] = serial_counter.get(key, 0) + 1
    serial = serial_counter[key]

    crime_no = f"{category_code}{district_id:04d}{station_id:04d}{year}{serial:05d}"
    case_no = f"{year}{serial:05d}"

    subhead = CrimeSubHead.sample(1).iloc[0]
    crime_head_id = int(subhead.CrimeHeadID)
    crime_subhead_id = int(subhead.CrimeSubHeadID)
    act_code, section_code = subhead_to_section[crime_subhead_id]

    gravity_id = random.choices([1, 2, 3], weights=[15, 55, 30])[0]

    incident_from = fake.date_time_between(start_date=datetime(year, 1, 1), end_date=datetime(year, 12, 31))
    incident_to = incident_from + timedelta(hours=random.randint(0, 48))
    info_received = incident_to + timedelta(hours=random.randint(0, 72))
    registered_date = info_received.date()

    status_id = random.choices([1, 2, 3, 4], weights=[35, 35, 20, 10])[0]
    court_id = int(Court.loc[Court.DistrictID == district_id, "CourtID"].sample(1).iloc[0])
    officer_id = int(Employee.loc[Employee.UnitID == station_id, "EmployeeID"].sample(1).iloc[0]) \
        if not Employee.loc[Employee.UnitID == station_id].empty else int(Employee.EmployeeID.sample(1).iloc[0])

    # Assign location based on district
    dname = District.loc[District.DistrictID == district_id, "DistrictName"].values[0]
    if dname in DISTRICT_BBOXES:
        bbox = DISTRICT_BBOXES[dname]
        lat = round(random.uniform(bbox["lat"][0], bbox["lat"][1]), 6)
        lon = round(random.uniform(bbox["lon"][0], bbox["lon"][1]), 6)
    else:
        lat = round(random.uniform(11.6, 18.4), 6)   # fallback Karnataka bounding box
        lon = round(random.uniform(74.0, 78.6), 6)

    case_rows.append({
        "CaseMasterID": case_id,
        "CrimeNo": crime_no,
        "CaseNo": case_no,
        "CrimeRegisteredDate": registered_date.isoformat(),
        "PolicePersonID": officer_id,
        "PoliceStationID": station_id,
        "CaseCategoryID": int(category_id),
        "GravityOffenceID": gravity_id,
        "CrimeMajorHeadID": crime_head_id,
        "CrimeMinorHeadID": crime_subhead_id,
        "CaseStatusID": status_id,
        "CourtID": court_id,
        "IncidentFromDate": incident_from.isoformat(sep=" "),
        "IncidentToDate": incident_to.isoformat(sep=" "),
        "InfoReceivedPSDate": info_received.isoformat(sep=" "),
        "latitude": lat,
        "longitude": lon,
        "BriefFacts": fake.sentence(nb_words=16),
    })

    # ---- ActSectionAssociation (1-2 per case) ----
    n_sections = random.choices([1, 2], weights=[80, 20])[0]
    for order, _ in enumerate(range(n_sections), start=1):
        act_section_rows.append({
            "CaseMasterID": case_id, "ActID": act_code, "SectionID": section_code,
            "ActOrderID": order, "SectionOrderID": order,
        })

    # ---- ComplainantDetails (usually 1, rarely 2) ----
    n_complainants = random.choices([1, 2], weights=[95, 5])[0]
    for _ in range(n_complainants):
        gender = random.choice([1, 2])
        complainant_rows.append({
            "ComplainantID": len(complainant_rows) + 1,
            "CaseMasterID": case_id,
            "ComplainantName": fake.name_male() if gender == 1 else fake.name_female(),
            "AgeYear": random.randint(18, 75),
            "OccupationID": int(OccupationMaster.OccupationID.sample(1).iloc[0]),
            "ReligionID": int(ReligionMaster.ReligionID.sample(1).iloc[0]),
            "CasteID": int(CasteMaster.caste_master_id.sample(1).iloc[0]),
            "GenderID": gender,
        })

    # ---- Victim (0-3; crimes against body/women almost always have one, property crimes often none) ----
    if crime_head_id in (1, 3):
        n_victims = random.choices([1, 2, 3], weights=[75, 20, 5])[0]
    else:
        n_victims = random.choices([0, 1], weights=[70, 30])[0]
    for _ in range(n_victims):
        gender = random.choice([1, 2, 3])  # M/F/T
        victim_rows.append({
            "VictimMasterID": len(victim_rows) + 1,
            "CaseMasterID": case_id,
            "VictimName": fake.name(),
            "AgeYear": random.randint(1, 85),
            "GenderID": gender,
            "VictimPolice": random.choices([0, 1], weights=[97, 3])[0],
        })

CaseMaster = pd.DataFrame(case_rows)
ActSectionAssociation = pd.DataFrame(act_section_rows)
ComplainantDetails = pd.DataFrame(complainant_rows)
Victim = pd.DataFrame(victim_rows)

# --------------------------------------------------------------------------
# 15. Accused (1-4 per case; NOT 1:1 -- matches the documented one-to-many FK)
#
#     PersonMasterID is an ADDITION to the base ER schema: a real-world-identity
#     key that can recur across multiple CaseMasterIDs. Every Accused row still
#     gets its own unique AccusedMasterID (one row = one appearance in one FIR),
#     but rows that represent the same real person across different FIRs share
#     a PersonMasterID. This is what lets the network graph draw genuine
#     "same individual, multiple cases" edges instead of inferring it from an
#     ID string or a hand-set boolean flag.
#
#     MO (Modus Operandi) is also an ADDITION, not part of the base ER schema.
#     A repeat offender is given ONE primary MO drawn from a vocabulary specific
#     to their preferred CrimeHead, and their case selection is now biased
#     toward cases of that SAME crime head -- consistent MO across jurisdictions
#     is the actual investigative signal the brief asks the platform to surface,
#     so it needs to exist in the data, not just be a random string per row.
# --------------------------------------------------------------------------
MO_BY_CRIME_HEAD = {
    1: ["Blunt weapon assault", "Knife-related assault", "Unarmed physical assault", "Ambush attack at night"],
    2: ["Forced window/door entry", "Lock-picking", "Daylight chain/bag snatching", "Vehicle theft with duplicate key"],
    3: ["Persistent online stalking before offence", "Workplace harassment", "Family/relative-perpetrated"],
    4: ["Phishing link / fake link", "Fake KYC update call", "OTP fraud", "Social media impersonation"],
    5: ["Ponzi / fake investment scheme", "Cheque bounce fraud", "Loan-default cheating", "Shell company fraud"],
}

case_ids = CaseMaster.CaseMasterID.tolist()
station_to_district = Unit.set_index("UnitID")["DistrictID"].to_dict()
case_district = {
    cid: station_to_district[station]
    for cid, station in zip(CaseMaster.CaseMasterID, CaseMaster.PoliceStationID)
}
case_year = {
    cid: pd.to_datetime(d).year
    for cid, d in zip(CaseMaster.CaseMasterID, CaseMaster.CrimeRegisteredDate)
}
case_crimehead = dict(zip(CaseMaster.CaseMasterID, CaseMaster.CrimeMajorHeadID))
cases_by_district = {}
for cid, d in case_district.items():
    cases_by_district.setdefault(d, []).append(cid)

remaining_slots = {
    cid: random.choices([1, 2, 3, 4], weights=[55, 25, 12, 8])[0] for cid in case_ids
}

assignments = []          # flat list of {CaseMasterID, PersonMasterID, AccusedName, AgeYear, GenderID, MO}
person_master_rows = []   # one row per distinct real-world identity
next_person_id = 1
counts = list(REPEAT_PERSON_CASE_COUNT_WEIGHTS.keys())
weights = list(REPEAT_PERSON_CASE_COUNT_WEIGHTS.values())

for _ in range(NUM_REPEAT_PERSONS):
    gender = random.choice(["M", "F", "T"])
    name = fake.name_male() if gender == "M" else (fake.name_female() if gender == "F" else fake.name())
    base_age = random.randint(18, 55)
    home_district = random.choice(karnataka_district_ids)
    k = random.choices(counts, weights=weights)[0]
    primary_crime_head = random.choice(list(MO_BY_CRIME_HEAD.keys()))
    primary_mo = random.choice(MO_BY_CRIME_HEAD[primary_crime_head])

    # Prefer cases matching this person's primary crime head (real MO consistency);
    # fall back to any open case if the district+crime-head pool is too thin.
    district_pool = cases_by_district.get(home_district, []) if random.random() < SAME_DISTRICT_BIAS else case_ids
    same_mo_candidates = [c for c in district_pool if remaining_slots.get(c, 0) > 0 and case_crimehead.get(c) == primary_crime_head]
    random.shuffle(same_mo_candidates)
    chosen = same_mo_candidates[:k]
    if len(chosen) < 2:
        fallback = [c for c in case_ids if remaining_slots.get(c, 0) > 0 and case_crimehead.get(c) == primary_crime_head]
        random.shuffle(fallback)
        chosen = fallback[:k]
    if len(chosen) < 2:
        continue  # not enough open same-crime-head slots left to form a genuine repeat chain -- skip this identity

    person_id = next_person_id
    next_person_id += 1
    first_year = min(case_year[c] for c in chosen)

    for cid in chosen:
        remaining_slots[cid] -= 1
        age_at_case = base_age + max(0, case_year[cid] - first_year)  # ages slightly across later cases
        assignments.append({
            "CaseMasterID": cid, "PersonMasterID": person_id,
            "AccusedName": name, "AgeYear": age_at_case, "GenderID": gender, "MO": primary_mo,
        })

    person_master_rows.append({
        "PersonMasterID": person_id, "PersonName": name, "GenderID": gender,
        "HomeDistrictID": home_district, "PrimaryCrimeHeadID": primary_crime_head, "PrimaryMO": primary_mo,
        "TotalCasesLinked": len(chosen), "IsRepeatOffender": 1,
    })

# fill every still-open accused slot with a one-off (non-repeating) identity
for cid in case_ids:
    for _ in range(remaining_slots[cid]):
        gender = random.choice(["M", "F", "T"])
        name = fake.name_male() if gender == "M" else (fake.name_female() if gender == "F" else fake.name())
        age = random.randint(16, 65)
        person_id = next_person_id
        next_person_id += 1
        mo = random.choice(MO_BY_CRIME_HEAD.get(case_crimehead.get(cid), MO_BY_CRIME_HEAD[2]))
        assignments.append({
            "CaseMasterID": cid, "PersonMasterID": person_id,
            "AccusedName": name, "AgeYear": age, "GenderID": gender, "MO": mo,
        })
        person_master_rows.append({
            "PersonMasterID": person_id, "PersonName": name, "GenderID": gender,
            "HomeDistrictID": case_district[cid], "PrimaryCrimeHeadID": case_crimehead.get(cid), "PrimaryMO": mo,
            "TotalCasesLinked": 1, "IsRepeatOffender": 0,
        })

# group by case, shuffle so repeat/one-off identities interleave naturally, then label A1..An
by_case = {}
for a in assignments:
    by_case.setdefault(a["CaseMasterID"], []).append(a)

accused_rows = []
for cid in case_ids:
    lst = by_case.get(cid, [])
    random.shuffle(lst)
    for j, a in enumerate(lst, start=1):
        accused_rows.append({
            "AccusedMasterID": len(accused_rows) + 1,
            "CaseMasterID": cid,
            "PersonMasterID": a["PersonMasterID"],
            "AccusedName": a["AccusedName"],
            "AgeYear": a["AgeYear"],
            "GenderID": a["GenderID"],
            "PersonID": f"A{j}",
            "MO": a["MO"],
        })

Accused = pd.DataFrame(accused_rows)
PersonMaster = pd.DataFrame(person_master_rows)

# --------------------------------------------------------------------------
# 16. ArrestSurrender  (0-N per case, referencing real Accused rows)
# --------------------------------------------------------------------------
arrest_rows = []
for _, acc in Accused.iterrows():
    if random.random() > 0.55:   # ~55% of accused have no arrest/surrender event yet (absconding/under investigation)
        continue
    case = CaseMaster.loc[CaseMaster.CaseMasterID == acc.CaseMasterID].iloc[0]
    event_state = 1 if random.random() > 0.05 else random.choice(State.StateID.tolist())
    # pick district matching the case's station, occasionally an out-of-state one
    if event_state == 1:
        event_district_id = int(Unit.loc[Unit.UnitID == case.PoliceStationID, "DistrictID"].iloc[0])
        event_station_id = int(case.PoliceStationID)
    else:
        event_district_id = int(District.loc[District.StateID == event_state, "DistrictID"].sample(1).iloc[0])
        event_station_id = int(case.PoliceStationID)  # handling station remains the FIR's station

    arrest_date = pd.to_datetime(case.CrimeRegisteredDate) + timedelta(days=random.randint(0, 60))
    arrest_rows.append({
        "ArrestSurrenderID": len(arrest_rows) + 1,
        "CaseMasterID": int(acc.CaseMasterID),
        "ArrestSurrenderTypeID": random.choices([1, 2], weights=[80, 20])[0],  # 1=Arrest, 2=Surrender
        "ArrestSurrenderDate": arrest_date.date().isoformat(),
        "ArrestSurrenderStateId": event_state,
        "ArrestSurrenderDistrictId": event_district_id,
        "PoliceStationID": event_station_id,
        "IOID": int(case.PolicePersonID),
        "CourtID": int(case.CourtID),
        "AccusedMasterID": int(acc.AccusedMasterID),
        "IsAccused": 1,
        "IsComplainantAccused": random.choices([0, 1], weights=[97, 3])[0],
    })
ArrestSurrender = pd.DataFrame(arrest_rows)

# --------------------------------------------------------------------------
# 17. ChargesheetDetails (only for cases with CaseStatusID = 2, "Charge Sheeted")
# --------------------------------------------------------------------------
chargesheet_rows = []
for _, case in CaseMaster[CaseMaster.CaseStatusID == 2].iterrows():
    cs_date = pd.to_datetime(case.CrimeRegisteredDate) + timedelta(days=random.randint(30, 90))
    chargesheet_rows.append({
        "CSID": len(chargesheet_rows) + 1,
        "CaseMasterID": int(case.CaseMasterID),
        "csdate": cs_date.isoformat(sep=" "),
        "cstype": random.choices(["A", "B", "C"], weights=[85, 10, 5])[0],
        "PolicePersonID": int(case.PolicePersonID),
    })
ChargesheetDetails = pd.DataFrame(chargesheet_rows)

# --------------------------------------------------------------------------
# WRITE OUT
# --------------------------------------------------------------------------
print("Writing tables to", OUT_DIR.resolve())
save(State, "State")
save(District, "District")
save(UnitType, "UnitType")
save(Unit, "Unit")
save(Rank, "Rank")
save(Designation, "Designation")
save(Employee, "Employee")
save(Court, "Court")
save(CaseCategory, "CaseCategory")
save(GravityOffence, "GravityOffence")
save(CrimeHead, "CrimeHead")
save(CrimeSubHead, "CrimeSubHead")
save(Act, "Act")
save(Section, "Section")
save(CrimeHeadActSection, "CrimeHeadActSection")
save(CaseStatusMaster, "CaseStatusMaster")
save(OccupationMaster, "OccupationMaster")
save(ReligionMaster, "ReligionMaster")
save(CasteMaster, "CasteMaster")
save(CaseMaster, "CaseMaster")
save(ComplainantDetails, "ComplainantDetails")
save(ActSectionAssociation, "ActSectionAssociation")
save(Victim, "Victim")
save(Accused, "Accused")
save(PersonMaster, "PersonMaster")
save(ArrestSurrender, "ArrestSurrender")
save(ChargesheetDetails, "ChargesheetDetails")

n_repeat = int((PersonMaster.IsRepeatOffender == 1).sum())
n_links = int((PersonMaster.loc[PersonMaster.IsRepeatOffender == 1, "TotalCasesLinked"]).sum())
print(f"\nRepeat-offender identities: {n_repeat}  (touching {n_links} case-accused rows total)")
print("Done.")
