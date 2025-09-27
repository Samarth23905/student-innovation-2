import sys
import json
# Input: { users, fests, ratings, feedbacks }
data = json.loads(sys.argv[1])
users = data.get('users', [])
ratings = data.get('ratings', [])
feedbacks = data.get('feedbacks', [])

# Filter mentors
mentors = [u for u in users if u.get('userType') == 'Mentor']

# Calculate average rating and feedback count for each mentor
mentor_stats = {}
for m in mentors:
    m_id = m['id']
    m_ratings = [r for r in ratings if r['mentor_id'] == m_id]
    avg_rating = sum([r['rating'] for r in m_ratings]) / len(m_ratings) if m_ratings else 0
    feedback_count = len([f for f in feedbacks if f['mentor_id'] == m_id])
    mentor_stats[m_id] = {
        'avg_rating': avg_rating,
        'feedback_count': feedback_count
    }

# Sort mentors by avg_rating, then feedback_count
sorted_mentors = sorted(mentors, key=lambda m: (mentor_stats[m['id']]['avg_rating'], mentor_stats[m['id']]['feedback_count']), reverse=True)

result = {
    "mentor_ranking": [
        {
            "fullName": m['fullName'],
            "expertise": m.get('expertise', ''),
            "experience": m.get('experience', ''),
            "avg_rating": round(mentor_stats[m['id']]['avg_rating'], 2),
            "feedback_count": mentor_stats[m['id']]['feedback_count']
        } for m in sorted_mentors[:5]
    ]
}
print(json.dumps(result))
