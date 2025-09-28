import sys
import json
# Input: { studentId, mentors, feedbacks, ratings }
data = json.loads(sys.argv[1])
mentors = data.get('mentors', [])
feedbacks = data.get('feedbacks', [])
ratings = data.get('ratings', [])

# Calculate average rating for each mentor
mentor_ratings = {}
for m in mentors:
    m_id = m['id']
    m_ratings = [r['rating'] for r in ratings if r['mentor_id'] == m_id]
    avg_rating = sum(m_ratings) / len(m_ratings) if m_ratings else 0
    mentor_ratings[m_id] = avg_rating

# Recommend top mentors by feedback count and rating
mentor_scores = {}
for m in mentors:
    m_id = m['id']
    m_feedbacks = [f for f in feedbacks if f['mentor_id'] == m_id]
    score = len(m_feedbacks)
    m['feedback'] = m_feedbacks[0]['feedback'] if m_feedbacks else ''
    m['rating'] = mentor_ratings.get(m_id, 0)
    mentor_scores[m_id] = score

# Exclude mentors with both rating == 0 and feedback count == 0
filtered_mentors = [m for m in mentors if m.get('rating', 0) > 0 or mentor_scores.get(m['id'], 0) > 0]
top_mentors = sorted(filtered_mentors, key=lambda x: (x.get('rating', 0), mentor_scores.get(x['id'], 0)), reverse=True)[:5]

result = {
    "mentor_recommendations": [
        {
            "name": m['fullName'],
            "expertise": m.get('expertise', ''),
            "rating": round(m.get('rating', 0), 2),
            "feedback": m.get('feedback', '')
        } for m in top_mentors
    ]
}
print(json.dumps(result))
