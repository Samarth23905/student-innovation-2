import sys
import json
mentor = json.loads(sys.argv[1])
result = {
    "effectiveness_score": 0.92,
    "recommended_mentees": [101, 102],
    "feedback_analysis": "Positive, but improve response time"
}
print(json.dumps(result))
