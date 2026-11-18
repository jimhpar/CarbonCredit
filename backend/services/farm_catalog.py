import random

BANGLADESH_HUBS = [
    ("Bogura", "Sherpur", 24.6712, 89.4173),
    ("Bogura", "Shibganj", 25.0042, 89.3186),
    ("Satkhira", "Shyamnagar", 22.3306, 89.1028),
    ("Satkhira", "Assasuni", 22.5514, 89.1742),
    ("Rajshahi", "Godagari", 24.4667, 88.3306),
    ("Rajshahi", "Tanore", 24.6021, 88.5792),
    ("Dinajpur", "Birganj", 25.8531, 88.6512),
    ("Rangpur", "Mithapukur", 25.5419, 89.2775),
    ("Naogaon", "Manda", 24.7824, 88.6651),
    ("Sunamganj", "Tahirpur", 25.0956, 91.1764),
    ("Sylhet", "Companiganj", 25.0762, 91.7581),
    ("Khulna", "Dacope", 22.5722, 89.5111),
    ("Jessore", "Jhikargacha", 23.1014, 89.1008),
    ("Barishal", "Babuganj", 22.8319, 90.3197),
    ("Patuakhali", "Kalapara", 21.9861, 90.2422),
    ("Bhola", "Char Fasson", 22.1856, 90.7614),
    ("Mymensingh", "Trishal", 24.5819, 90.3944),
    ("Netrokona", "Mohanganj", 24.8689, 90.9675),
    ("Comilla", "Daudkandi", 23.5356, 90.7158),
    ("Tangail", "Madhupur", 24.6156, 90.0258),
]

PRACTICES = ["AWD_RICE", "SALINITY_SMART", "ORGANIC_SOIL"]
CLUSTER_SUFFIXES = [
    "Boro AWD Block",
    "Climate-Smart Rice Zone",
    "Green Paddy Cooperative",
    "Carbon-Sync Agri Cluster",
    "Low-Methane Irrigation Plot",
]


def generate_100_farms(existing_farms: list[dict]) -> list[dict]:
    """Ensure a total of 100 realistic Bangladesh farm clusters."""
    farms = list(existing_farms)
    existing_ids = {f["id"] for f in farms}
    rng = random.Random(2026)

    idx = 1
    while len(farms) < 100:
        district, upazila, base_lat, base_lng = BANGLADESH_HUBS[(idx - 1) % len(BANGLADESH_HUBS)]
        fid = f"farm-bd-{idx:03d}"
        if fid in existing_ids:
            idx += 1
            continue

        # Slight geographic offset around upazila center
        lat = round(base_lat + rng.uniform(-0.045, 0.045), 4)
        lng = round(base_lng + rng.uniform(-0.045, 0.045), 4)
        d = 0.0014

        if district in ("Satkhira", "Khulna", "Patuakhali", "Bhola", "Barishal"):
            practice = rng.choice(["SALINITY_SMART", "AWD_RICE"])
            salinity = round(rng.uniform(2.2, 6.2), 1)
        else:
            practice = rng.choice(["AWD_RICE", "AWD_RICE", "ORGANIC_SOIL"])
            salinity = round(rng.uniform(0.4, 1.8), 1)

        area_acres = round(rng.uniform(18.0, 145.0), 1)
        farmer_count = max(10, int(area_acres * rng.uniform(0.55, 0.9)))
        suffix = CLUSTER_SUFFIXES[idx % len(CLUSTER_SUFFIXES)]

        farms.append(
            {
                "id": fid,
                "name": f"{upazila} {suffix} #{idx:02d}",
                "district": district,
                "farmer_count": farmer_count,
                "area_acres": area_acres,
                "practice": practice,
                "center": [lat, lng],
                "polygon": [
                    [round(lat - d, 4), round(lng - d, 4)],
                    [round(lat + d, 4), round(lng - d, 4)],
                    [round(lat + d, 4), round(lng + d, 4)],
                    [round(lat - d, 4), round(lng + d, 4)],
                ],
                "iot": {
                    "device_id": f"ESP32-{district[:3].upper()}-{idx:02d}",
                    "soil_moisture_pct": round(rng.uniform(28.0, 68.0), 1),
                    "salinity_dsm": salinity,
                    "water_level_cm": round(rng.uniform(-14.0, 4.0), 1),
                    "battery_v": round(rng.uniform(3.65, 4.15), 2),
                },
            }
        )
        idx += 1

    return farms[:100]
