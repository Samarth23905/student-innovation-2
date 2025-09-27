import sys
import json
payload = json.loads(sys.argv[1])
users = payload["users"]
fests = payload["fests"]
result = {
    "mentor_ranking": sorted([u for u in users if u["userType"]=="Mentor"], key=lambda x: x.get("experience",0), reverse=True),
    "student_ranking": sorted([u for u in users if u["userType"]=="Student"], key=lambda x: x.get("year",0), reverse=True),
    "fest_participation_prediction": "High",
    "event_recommendations": ["Hackathon", "AI Bootcamp"],
    "activity_trends": "Increasing engagement"
}
print(json.dumps(result))
