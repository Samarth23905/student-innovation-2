import sys
import json
payload = json.loads(sys.argv[1])
assignment = payload.get("assignmentText","")
quiz = payload.get("quizAnswers",{})
# Example: Use ML for grading
result = {
    "assignment_grade": "A",
    "quiz_score": 4,
    "feedback": "Excellent work!"
}
print(json.dumps(result))
