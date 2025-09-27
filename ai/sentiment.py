import sys
import json
feedback = sys.argv[1]
# Example: Use transformers or TextBlob for real sentiment
result = {
    "sentiment": "positive" if "good" in feedback.lower() else "neutral",
    "score": 0.85
}
print(json.dumps(result))
