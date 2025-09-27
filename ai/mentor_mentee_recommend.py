import sys
import json
# Input: { mentor, students, grades, badges }
data = json.loads(sys.argv[1])
students = data.get('students', [])
grades = data.get('grades', [])
badges = data.get('badges', [])

# Example: Score students by quiz grades and badge count
student_scores = {}
for s in students:
    s_id = s['id']
    s_grades = [g for g in grades if g['student_id'] == s_id]
    s_badges = [b for b in badges if b['student_id'] == s_id]
    score = sum([g['score'] for g in s_grades]) + len(s_badges) * 2
    student_scores[s_id] = score
    s['grade'] = sum([g['score'] for g in s_grades]) if s_grades else 0
    s['badge_count'] = len(s_badges)

# Sort students by score
recommended = sorted(students, key=lambda x: student_scores.get(x['id'], 0), reverse=True)[:5]

result = {
    "recommended_mentees": [
        {
            "id": s['id'],
            "name": s['fullName'],
            "email": s.get('email', ''),
            "grade": s.get('grade', 0),
            "badge_count": s.get('badge_count', 0)
        } for s in recommended
    ]
}
print(json.dumps(result))
