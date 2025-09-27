import sys
import json
# Input: { studentId, mentors, feedbacks }
data = json.loads(sys.argv[1])
mentors = data.get('mentors', [])
feedbacks = data.get('feedbacks', [])

# Example: Recommend top mentors by feedback count and rating
mentor_scores = {}
for m in mentors:
    m_id = m['id']
    m_feedbacks = [f for f in feedbacks if f['mentor_id'] == m_id]
    score = len(m_feedbacks)
    m['feedback'] = m_feedbacks[0]['feedback'] if m_feedbacks else ''
    m['rating'] = m.get('avgRating', 4.5)  # fallback
    mentor_scores[m_id] = score

# Sort mentors by score (feedback count)
top_mentors = sorted(mentors, key=lambda x: mentor_scores.get(x['id'], 0), reverse=True)[:5]

result = {
    "mentor_recommendations": [
        {
            "name": m['fullName'],
            "expertise": m.get('expertise', ''),
            "rating": m.get('rating', 4.5),
            "feedback": m.get('feedback', '')
        } for m in top_mentors
    ]
}
print(json.dumps(result))
