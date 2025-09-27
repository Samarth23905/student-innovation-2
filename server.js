import express from 'express';
import bodyParser from 'body-parser';
import multer from 'multer';
import path from 'path';
import mysql from 'mysql2';
import bcrypt from 'bcrypt';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import session from 'express-session';
import http from 'http';
import { Server } from 'socket.io';
import { execFile } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);


const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(session({
    secret: process.env.SESSION_SECRET || '70a3e18a884aeac97d68bf6cd110ac6144885052b103c71b13d521c7a9d5d5ce',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
}));

const port = 5000;


// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static('public'));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
function requireLogin(req, res, next) {
    if (!req.session.userId) {
        return res.redirect('/login.html');
    }
    next();
}

// Multer setup
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// MySQL connection
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'Skh@23092005',
    database: 'sih'
});

db.connect((err) => {
    if (err) {
        console.error('Database connection failed:', err.stack);
        return;
    }
    console.log('Database connected successfully');
});

// AI/ML integration
const PYTHON_PATH = 'python'; // Change if using venv

// Student prediction endpoint
app.get('/student/predict/:id', (req, res) => {
    const studentId = req.params.id;
    // Fetch student data
    db.query('SELECT * FROM users WHERE id = ? AND userType = "Student"', [studentId], (err, rows) => {
        if (err || rows.length === 0) return res.status(404).send('Student not found');
        const student = rows[0];
        // Call Python script for prediction
        execFile(PYTHON_PATH, ['ai/predict_student.py', JSON.stringify(student)], (error, stdout, stderr) => {
            if (error) return res.status(500).send('AI error: ' + stderr);
            try {
                const result = JSON.parse(stdout);
                res.json(result);
            } catch {
                res.status(500).send('Invalid AI response');
            }
        });
    });
});

// Mentor prediction endpoint
app.get('/mentor/predict/:id', (req, res) => {
    const mentorId = req.params.id;
    db.query('SELECT * FROM users WHERE id = ? AND userType = "Mentor"', [mentorId], (err, mentorRows) => {
        if (err || mentorRows.length === 0) return res.status(404).send('Mentor not found');
        const mentor = mentorRows[0];
        // Fetch all students
        db.query('SELECT * FROM users WHERE userType = "Student"', (sErr, students) => {
            if (sErr) return res.status(500).send('DB error');
            // Fetch grades and badges
            db.query('SELECT * FROM quiz_attempts', (gErr, grades) => {
                if (gErr) return res.status(500).send('DB error');
                db.query('SELECT * FROM badges', (bErr, badges) => {
                    if (bErr) return res.status(500).send('DB error');
                    // Call Python script for mentee prediction
                    const { execFile } = require('child_process');
                    const PYTHON_PATH = 'python';
                    execFile(PYTHON_PATH, ['ai/mentor_mentee_recommend.py', JSON.stringify({ mentor, students, grades, badges })], (error, stdout, stderr) => {
                        if (error) return res.status(500).send('AI error: ' + stderr);
                        try {
                            const result = JSON.parse(stdout);
                            res.json(result);
                        } catch {
                            res.status(500).send('Invalid AI response');
                        }
                    });
                });
            });
        });
    });
});

// College dashboard AI analytics
app.get('/collegeDashboardAI', (req, res) => {
    // Fetch all mentors and students
    db.query('SELECT * FROM users WHERE userType IN ("Mentor", "Student")', (err, users) => {
        if (err) return res.status(500).send('DB error');
        // Fetch fest data
        db.query('SELECT * FROM techfest', (festErr, fests) => {
            if (festErr) return res.status(500).send('DB error');
                // Fetch mentor ratings and feedbacks
                db.query('SELECT * FROM mentor_ratings', (rErr, ratings) => {
                    if (rErr) return res.status(500).send('DB error');
                    db.query('SELECT * FROM mentor_feedback', (fErr, feedbacks) => {
                        if (fErr) return res.status(500).send('DB error');
                        // Call Python script for dashboard analytics (judges)
                        const { execFile } = require('child_process');
                        const PYTHON_PATH = 'python';
                        execFile(PYTHON_PATH, ['ai/college_dashboard_judges.py', JSON.stringify({ users, fests, ratings, feedbacks })], (error, stdout, stderr) => {
                            if (error) return res.status(500).send('AI error: ' + stderr);
                            try {
                                const result = JSON.parse(stdout);
                                res.json(result);
                            } catch {
                                res.status(500).send('Invalid AI response');
                            }
                        });
                    });
                });
        });
    });
});

// AI-powered chatbot endpoint
app.post('/ai/chatbot', (req, res) => {
    const { message, userType } = req.body;
    execFile(PYTHON_PATH, ['ai/chatbot.py', message, userType || 'Student'], (error, stdout, stderr) => {
        if (error) return res.status(500).send('AI error: ' + stderr);
        res.json({ reply: stdout });
    });
});

// Sentiment analysis for feedback
app.post('/feedback/sentiment', (req, res) => {
    const { feedback } = req.body;
    execFile(PYTHON_PATH, ['ai/sentiment.py', feedback], (error, stdout, stderr) => {
        if (error) return res.status(500).send('AI error: ' + stderr);
        try {
            const result = JSON.parse(stdout);
            res.json(result);
        } catch {
            res.status(500).send('Invalid AI response');
        }
    });
});

// Automated grading endpoint
app.post('/ai/grade', (req, res) => {
    const { assignmentText, quizAnswers } = req.body;
    execFile(PYTHON_PATH, ['ai/grader.py', JSON.stringify({ assignmentText, quizAnswers })], (error, stdout, stderr) => {
        if (error) return res.status(500).send('AI error: ' + stderr);
        try {
            const result = JSON.parse(stdout);
            res.json(result);
        } catch {
            res.status(500).send('Invalid AI response');
        }
    });
});

app.get('/', (req, res) => {
    res.redirect('home.html');
});

app.get('/mentorsQuiz', (req, res) => {
    const mentorId = req.query.mentorId;
    res.render('mentorsQuiz', { mentorId });
});

// Registration route
app.post('/register', upload.single('profile_pic'), async (req, res) => {
    const {
        userType,
        fullName,
        email,
        password,
        confirmPassword,
        collegeName,
        collegeCode,
        collegeEmail,
        expertise,
        github,
        branch,
        year,
        city,
        state,
        linkedin,
        experience,
        portfolio,
        pincode,
        contactName,
        contactEmail,
        collegeType
    } = req.body;

    let profile_pic;
    if (req.file && req.file.path) {
        profile_pic = req.file.path;
    } else {
        profile_pic = 'uploads/default.jpg';
    }

    if (!userType || !password || !confirmPassword) {
        return res.status(400).send('User type, password, and confirm password are required');
    }
    if (password !== confirmPassword) {
        return res.status(400).send('Passwords do not match');
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        let query;
        let params;

        if (userType === 'Student') {
            if (!fullName || !email || !collegeName || !branch || !year || !city || !state || !github || !linkedin) {
                return res.status(400).send('All fields are required for students');
            }
            query = `
                INSERT INTO users (profile_pic, fullName, email, hashedPassword, userType, collegeName, branch, year, city, state, github, linkedin) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;
            params = [profile_pic, fullName, email, hashedPassword, userType, collegeName, branch, year, city, state, github, linkedin];
            db.execute(query, params, (err, result) => {
                if (err) {
                    console.error(err);
                    return res.status(500).send('Server error');
                }
                // Redirect to login so dashboard loads with all data
                res.redirect('/login.html');
            });
        } else if (userType === 'Mentor') {
            if (!fullName || !email || !collegeName || !expertise || !experience || !city || !state || !github || !portfolio) {
                return res.status(400).send('All fields are required for mentors');
            }
            query = `
                INSERT INTO users (profile_pic, fullName, email, hashedPassword, userType, expertise, collegeName, experience, city, state, github, portfolio) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;
            params = [profile_pic, fullName, email, hashedPassword, userType, expertise, collegeName, experience, city, state, github, portfolio];
            db.execute(query, params, (err, result) => {
                if (err) {
                    console.error(err);
                    return res.status(500).send('Server error');
                }
                // Pass mentorId to mentorsCred page
                res.render('mentorsCred', { mentorId: result.insertId });
            });
        } else if (userType === 'College') {
            if (!collegeName || !collegeCode || !collegeEmail || !city || !state || !pincode || !contactName || !contactEmail || !collegeType) {
                return res.status(400).send('All fields are required for colleges');
            }
            query = `
                INSERT INTO users (profile_pic, collegeName, collegeEmail, collegeCode, hashedPassword, userType, city, state, pincode, contactName, contactEmail, collegeType) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;
            params = [profile_pic, collegeName, collegeEmail, collegeCode, hashedPassword, userType, city, state, pincode, contactName, contactEmail, collegeType];
            db.execute(query, params, (err) => {
                if (err) {
                    console.error(err);
                    return res.status(500).send('Server error');
                }
                db.query('SELECT * FROM techfest', (err, fests) => {
                    if (err) return res.status(500).send('Server error');
                    res.render('collegeDashboard', { fests });
                });
            });
        } else {
            return res.status(400).send('Invalid user type');
        }
    } catch (error) {
        console.error(error);
        res.status(500).send('Server error');
    }
});

app.post('/login', (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).send('Email and password are required');
    }

    const query = 'SELECT * FROM users WHERE email = ? OR collegeEmail = ?';
    db.execute(query, [email, email], async (err, results) => {
        if (err) {
            console.error('Error fetching user:', err);
            return res.status(500).send('Server error');
        }
        if (results.length === 0) {
            return res.status(401).send('Invalid email or password');
        }

        const user = results[0];
        let passwordHash = user.hashedPassword;
        if (!passwordHash) {
            return res.status(401).send('Invalid email or password');
        }
        const passwordMatch = await bcrypt.compare(password, passwordHash);
        if (!passwordMatch) {
            return res.status(401).send('Invalid email or password');
        }

        req.session.userId = user.id;
        req.session.userType = user.userType;
        req.session.collegeId = user.userType === 'College' ? user.id : undefined;
        req.session.fullName = user.fullName;

        if (user.userType === 'Mentor') {
            if (!user.approved || user.approved !== 1) {
                return res.send(`<script>alert('Your account is pending admin approval. Please wait.'); window.location.href='/login.html';</script>`);
            }
            // Mentor approved: fetch all students for mentor dashboard
            db.query(
                `SELECT id, profile_pic, fullName, email, collegeName, branch, year, city, state, linkedin, github FROM users WHERE userType = 'Student'`,
                (err, students) => {
                    if (err) {
                        console.error(err);
                        return res.status(500).send('Server error');
                    }
                    return res.redirect(`/mentorDashboard?mentorId=${user.id}`);
                }
            );
        } else if (user.userType === 'Student') {
            // Redirect to dashboard with user id as query
            return res.redirect(`/studentDashboard?currentUserId=${user.id}`);
        } else if (user.userType === 'College' && (user.collegeEmail === email || user.email === email)) {
            db.query('SELECT * FROM techfest', (err, fests) => {
                if (err) return res.status(500).send('Server error');
                res.render('collegeDashboard', { fests, collegeId: user.id });
            });
        } else {
            return res.status(400).send('Unknown user type');
        }
    });
});

// Universal dashboard redirect based on user type
app.get('/dashboard', (req, res) => {
    if (!req.session || !req.session.userId || !req.session.userType) {
        return res.redirect('/login');
    }
    if (req.session.userType === 'Mentor') {
        // Mentor: redirect to mentorDashboard with mentorId
        return res.redirect(`/mentorDashboard?mentorId=${req.session.userId}`);
    } else if (req.session.userType === 'Student') {
        // Student: redirect to studentDashboard
        return res.redirect('/studentDashboard');
    } else {
        // Default fallback
        return res.redirect('/login');
    }
});

// Mentor credentials page (EJS)
app.get('/mentorsCred', (req, res) => {
    const mentorId = req.query.mentorId;
    if (!mentorId) return res.status(400).send('Mentor ID required');
    res.render('mentorsCred', { mentorId });
});

// Mentor credentials POST
app.post('/mentorCred', (req, res) => {
    const { mentorId, qualification, experience, specialization, bio } = req.body;
    if (!mentorId || !qualification || !experience || !specialization || !bio) {
        return res.status(400).send('All fields are required');
    }
    const query = `
        UPDATE users 
        SET qualification = ?, experience = ?, specialization = ?, bio = ?
        WHERE id = ? AND userType = 'Mentor'
    `;
    db.execute(query, [qualification, experience, specialization, bio, mentorId], (err) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Server error');
        }
        // Render the live coding page with mentorId (skip quiz)
        res.render('mentors-liveCode', { mentorId });
    });
});

// Mentor live coding submission
app.post('/submitLiveCode', upload.single('screenRecording'), (req, res) => {
    const { mentorId, q1, q2 } = req.body;
    if (!mentorId || !q1 || !q2 || !req.file) {
        return res.status(400).send('All fields and screen recording are required');
    }
    const livecodingData = {
        q1,
        q2,
        screenRecording: req.file.path,
        submittedAt: new Date().toISOString()
    };
    db.execute(
        'UPDATE users SET livecoding = ? WHERE id = ? AND userType = "Mentor"',
        [JSON.stringify(livecodingData), mentorId],
        (err) => {
            if (err) {
                console.error(err);
                return res.status(500).send('Server error');
            }
            res.send('<script>alert("Live coding test submitted successfully!"); window.location.href="/login.html";</script>');
        }
    );
});

app.post('/submitQuizScore', async (req, res) => {
    const { studentId, quizId, score, language } = req.body;
    // Fetch minimum score for this quiz/language (set by mentor/admin)
    db.query('SELECT min_score FROM quizzes WHERE id = ? AND language = ?', [quizId, language], (err, results) => {
        if (err) return res.status(500).send('DB error');
        const minScore = results[0]?.min_score || 0;
        // Save quiz attempt
        db.query('INSERT INTO quiz_attempts (student_id, quiz_id, score) VALUES (?, ?, ?)', [studentId, quizId, score], (err) => {
            if (err) return res.status(500).send('DB error');
            // Award badge if score >= minScore
            if (score >= minScore) {
                db.query('INSERT INTO badges (student_id, language, badge_name) VALUES (?, ?, ?)', [studentId, language, 'Quiz Master'], (err) => {
                    // Ignore duplicate badge error
                    return res.json({ success: true, badgeEarned: score >= minScore });
                });
            } else {
                return res.json({ success: true, badgeEarned: false });
            }
        });
    });
});

// Admin dashboard
app.get('/adminDashboard', (req, res) => {
    const query = `SELECT id, profile_pic, fullName, collegeName, experience, expertise, linkedin, github, state, livecoding FROM users WHERE userType = 'Mentor' AND (approved IS NULL OR approved = 0)`;
    db.query(query, (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Server error');
        }
        res.render('adminDashboard', { mentors: results });
    });
});

// Approve mentor
app.post('/approveMentor', (req, res) => {
    const { mentorId } = req.body;
    db.execute('UPDATE users SET approved = 1 WHERE id = ?', [mentorId], (err) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Server error');
        }
        res.redirect('/adminDashboard');
    });
});

// Reject mentor
app.post('/rejectMentor', (req, res) => {
    const { mentorId } = req.body;
    db.execute('UPDATE users SET approved = -1 WHERE id = ?', [mentorId], (err) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Server error');
        }
        res.redirect('/adminDashboard');
    });
});

// Tech Fest Submission Route
app.post('/submitTechFest', upload.fields([
    { name: 'logo', maxCount: 1 },
    { name: 'brochure', maxCount: 1 }
]), (req, res) => {
    const {
        collegeName, affiliation, festName, edition, startDate, endDate, venue, pincode,
        contactPerson, designation, email, phone, website, registrationLink,
        instagram, twitter, expectedParticipants, scale, mode, description
    } = req.body;

    const logo = req.files['logo'] && req.files['logo'][0] ? req.files['logo'][0].path : 'uploads/default.jpg';
    const brochure = req.files['brochure'] && req.files['brochure'][0] ? req.files['brochure'][0].path : null;

    let events = [];
    try {
        events = JSON.stringify(req.body.events ? JSON.parse(req.body.events) : []);
    } catch {
        events = JSON.stringify([]);
    }

    const expectedParticipantsInt = expectedParticipants && expectedParticipants.trim() !== '' ? parseInt(expectedParticipants) : null;
    const editionInt = edition && edition.trim() !== '' ? parseInt(edition) : null;

    const query = `
        INSERT INTO techfest (
            collegeName, affiliation, festName, edition, startDate, endDate, venue, pincode,
            contactPerson, designation, email, phone, website, registrationLink,
            instagram, twitter, expectedParticipants, scale, mode, description, brochure, logo, events
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const params = [
        collegeName, affiliation, festName, editionInt, startDate, endDate, venue, pincode,
        contactPerson, designation, email, phone, website, registrationLink,
        instagram, twitter, expectedParticipantsInt, scale, mode, description, brochure, logo, events
    ];

    db.execute(query, params, (err) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Server error');
        }
        db.query('SELECT * FROM techfest', (err, fests) => {
            if (err) return res.status(500).send('Server error');
            res.render('collegeDashboard', { success: true, fests });
        });
    });
});

app.get('/student/leaderboard', (req, res) => {
    db.query(
        `SELECT u.id, u.fullName AS name, COUNT(b.id) AS badgeCount
         FROM users u
         LEFT JOIN badges b ON u.id = b.student_id
         WHERE u.userType = 'Student'
         GROUP BY u.id
         ORDER BY badgeCount DESC, name ASC`,
        (err, rows) => {
            if (err) {
                console.error(err);
                return res.status(500).send('Server error');
            }
            res.json(rows);
        }
    );
});

// Student dashboard: fetch mentors, fests, and student info
app.get('/studentDashboard', requireLogin, (req, res) => {
    const currentUserId = req.session.userId;

    // Fetch student profile info
    db.query('SELECT profile_pic, fullName FROM users WHERE id = ? AND userType = "Student"', [currentUserId], (err, studentRows) => {
        if (err || studentRows.length === 0) {
            return res.status(500).send('Error fetching student profile');
        }
        const studentProfilePic = studentRows[0].profile_pic;
        const studentName = studentRows[0].fullName;

        // Fetch mentors with average rating, sort by rating desc
        // MySQL does not support NULLS LAST, so use IS NULL in ORDER BY
        const mentorQuery = `
            SELECT u.*, AVG(mr.rating) as avgRating, COUNT(mr.id) as ratingCount
            FROM users u
            LEFT JOIN mentor_ratings mr ON u.id = mr.mentor_id
            WHERE u.userType = 'Mentor'
            GROUP BY u.id
            ORDER BY (avgRating IS NULL), avgRating DESC, u.fullName ASC
        `;
        db.query(mentorQuery, [], (err, mentors) => {
            if (err) {
                console.error(err);
                return res.status(500).send('Error fetching mentors');
            }

            // Fetch fests
            db.query('SELECT * FROM techfest', (festErr, fests) => {
                if (festErr) return res.status(500).send('Error fetching fests');

                // Fetch quizzes assigned to this student or open quizzes
                db.query('SELECT * FROM quizzes WHERE assigned_to = ? OR assigned_to IS NULL', [currentUserId], (quizErr, quizzes) => {
                    if (quizErr) return res.status(500).send('Error fetching quizzes');

                    // Fetch quiz languages
                    db.query('SELECT DISTINCT language FROM quizzes', (langErr, quizLanguagesRows) => {
                        if (langErr) return res.status(500).send('Error fetching quiz languages');
                        const quizLanguages = quizLanguagesRows.map(row => row.language);

                        // Fetch leaderboard: students ordered by badge count
                        db.query(
                            `SELECT u.id, u.fullName AS name, COUNT(b.id) AS badgeCount
                             FROM users u
                             LEFT JOIN badges b ON u.id = b.student_id
                             WHERE u.userType = 'Student'
                             GROUP BY u.id
                             ORDER BY badgeCount DESC, name ASC`,
                            (lbErr, leaderboard) => {
                                if (lbErr) {
                                    console.error(lbErr);
                                    leaderboard = [];
                                }
                                res.render('studentDashboard', {
                                    mentors,
                                    fests,
                                    currentUserId,
                                    studentProfilePic,
                                    studentName,
                                    quizzes,
                                    leaderboard,
                                    quizLanguages
                                });
                            }
                        );
                    });
                });
            });
        });
    });
});


// Explore students: show all except the logged-in student
app.get('/exploreStud', (req, res) => {
    const currentUserId = req.query.currentUserId;
    if (!currentUserId) return res.status(400).send('User not specified');
    db.query(
        `SELECT id, fullName, email, collegeName, branch, year, city, state, linkedin, github, techStack FROM users WHERE userType = 'Student' AND id != ?`,
        [currentUserId],
        (err, students) => {
            if (err) {
                console.error(err);
                return res.status(500).send('Server error');
            }
            const studentIds = students.map(s => s.id);
            if (studentIds.length === 0) {
                return res.render('exploreStud', { students, currentUserId });
            }
            // Get completed languages
            db.query(
                `SELECT qa.student_id, q.language FROM quiz_attempts qa JOIN quizzes q ON qa.quiz_id = q.id WHERE qa.student_id IN (?) GROUP BY qa.student_id, q.language`,
                [studentIds],
                (langErr, langRows) => {
                    if (langErr) {
                        console.error(langErr);
                        return res.render('exploreStud', { students, currentUserId });
                    }
                    // Get badges for all students
                    db.query(
                        `SELECT student_id, language, badge_name, mentor_id FROM badges WHERE student_id IN (?)`,
                        [studentIds],
                        (badgeErr, badgeRows) => {
                            if (badgeErr) {
                                console.error(badgeErr);
                                return res.render('exploreStud', { students, currentUserId });
                            }
                            // Map student_id to array of languages
                            const langMap = {};
                            langRows.forEach(row => {
                                if (!langMap[row.student_id]) langMap[row.student_id] = [];
                                langMap[row.student_id].push(row.language);
                            });
                            // Map student_id to array of badges and mentorBadges
                            const badgeMap = {};
                            const mentorBadgeMap = {};
                            badgeRows.forEach(row => {
                                if (!badgeMap[row.student_id]) badgeMap[row.student_id] = [];
                                badgeMap[row.student_id].push({
                                    language: row.language,
                                    badge_name: row.badge_name
                                });
                                if (row.mentor_id) {
                                    if (!mentorBadgeMap[row.student_id]) mentorBadgeMap[row.student_id] = [];
                                    mentorBadgeMap[row.student_id].push({
                                        badge_name: row.badge_name
                                    });
                                }
                            });
                            // Attach completedLanguages, badges, and mentorBadges to each student
                            students.forEach(stud => {
                                stud.completedLanguages = langMap[stud.id] || [];
                                stud.badges = badgeMap[stud.id] || [];
                                stud.mentorBadges = mentorBadgeMap[stud.id] || [];
                            });
                            res.render('exploreStud', { students, currentUserId });
                        }
                    );
                }
            );
        }
    );
});

// Mentor dashboard: fetch all students
app.get('/mentorDashboard', requireLogin, (req, res) => {
    const mentorId = req.query.mentorId;
    if (!mentorId) return res.status(400).send('Mentor not specified');

    db.query(
        `SELECT id, profile_pic, fullName FROM users WHERE id = ? AND userType = 'Mentor'`,
        [mentorId],
        (err, mentorRows) => {
            if (err || mentorRows.length === 0) return res.status(404).send('Mentor not found');
            const mentorProfilePic = mentorRows[0].profile_pic;
            const mentorName = mentorRows[0].fullName;

            // Get only students assigned to this mentor (mentees)
            db.query(
                `SELECT u.id, u.profile_pic, u.fullName, u.email, u.collegeName, u.branch, u.year, u.city, u.state, u.linkedin, u.github
                 FROM users u
                 JOIN student_mentor sm ON u.id = sm.student_id
                 WHERE sm.mentor_id = ?`,
                [mentorId],
                (err, mentees) => {
                    if (err) return res.status(500).send('Error fetching mentees');
                    const menteeIds = mentees.map(s => s.id);

                    // Get assignment counts for these mentees
                    if (menteeIds.length === 0) {
                        // Still need to fetch all students for the table
                        db.query('SELECT id, profile_pic, fullName, email, collegeName, branch, year, city, state, linkedin, github FROM users WHERE userType = "Student"', (err2, allStudents) => {
                            if (err2) return res.status(500).send('Error fetching students');
                            db.query('SELECT * FROM techfest', (festErr, fests) => {
                                if (festErr) return res.status(500).send('Error fetching fests');
                                res.render('mentorDashboard', { mentorId, mentorProfilePic, mentorName, students: allStudents, fests, menteeProgress: [] });
                            });
                        });
                        return;
                    }
                    db.query(
                        `SELECT a.student_id, COUNT(a.id) as assignmentCount
                         FROM assignments a
                         WHERE a.student_id IN (?) AND a.mentor_id = ?
                         GROUP BY a.student_id`,
                        [menteeIds, mentorId],
                        (err, assignmentRows) => {
                            if (err) return res.status(500).send('Error fetching assignments');
                            // Map studentId to assignmentCount
                            const assignmentMap = {};
                            assignmentRows.forEach(row => {
                                assignmentMap[row.student_id] = row.assignmentCount;
                            });
                            // Build menteeProgress array
                            const menteeProgress = mentees.map(stud => ({
                                ...stud,
                                assignmentCount: assignmentMap[stud.id] || 0
                            })).sort((a, b) => b.assignmentCount - a.assignmentCount);

                            // Fetch all students for the table
                            db.query('SELECT id, profile_pic, fullName, email, collegeName, branch, year, city, state, linkedin, github FROM users WHERE userType = "Student"', (err2, allStudents) => {
                                if (err2) return res.status(500).send('Error fetching students');
                                db.query('SELECT * FROM techfest', (festErr, fests) => {
                                    if (festErr) return res.status(500).send('Error fetching fests');
                                    res.render('mentorDashboard', { mentorId, mentorProfilePic, mentorName, students: allStudents, fests, menteeProgress });
                                });
                            });
                        }
                    );
                }
            );
        }
    );
});

// View all details of a student
app.get('/student/:studentId', (req, res) => {
    const studentId = req.params.studentId;
    db.query('SELECT * FROM users WHERE id = ? AND userType = "Student"', [studentId], (err, rows) => {
        if (err || rows.length === 0) return res.status(404).send('Student not found');
        const student = rows[0];
        db.query('SELECT language, badge_name FROM badges WHERE student_id = ?', [studentId], (bErr, badgeRows) => {
            student.badges = badgeRows || [];
            res.render('student', { student });
        });
    });
});

// Group chat for students
app.get('/studentsChat', (req, res) => {
    db.query(
        `SELECT sc.userName, sc.userId, sc.originalMessage, sc.createdAt, u.profile_pic, u.fullName
         FROM studentschat sc
         LEFT JOIN users u ON sc.userId = u.id
         ORDER BY sc.createdAt DESC LIMIT 50`,
        (err, results) => {
            if (err) return res.status(500).send('Server error');
            let currentUserId = null;
            let currentUserName = null;
            if (req.session && req.session.userId) {
                currentUserId = req.session.userId;
                currentUserName = req.session.fullName || req.session.userName || 'Student';
            }
            res.render('chat', { messages: results, currentUserId, currentUserName });
        }
    );
});
app.post('/studentsChat', (req, res) => {
    // Disabled: now handled by socket.io
    res.redirect('/studentsChat');
});

app.post('/chooseMentor', (req, res) => {
    const { studentId, mentorId } = req.body;
    if (!studentId || !mentorId) return res.status(400).send('Missing fields');
    // Only insert if this (student, mentor) pair does not already exist
    db.query('SELECT * FROM student_mentor WHERE student_id = ? AND mentor_id = ?', [studentId, mentorId], (err, rows) => {
        if (err) return res.status(500).send('Database error');
        if (rows.length > 0) {
            // Already assigned, do nothing
            return res.redirect(`/studentDashboard?currentUserId=${studentId}`);
        }
        // Insert new assignment
        db.execute('INSERT INTO student_mentor (student_id, mentor_id) VALUES (?, ?)', [studentId, mentorId], (err2) => {
            if (err2) return res.status(500).send('Database error');
            res.redirect(`/studentDashboard?currentUserId=${studentId}`);
        });
    });
});

app.get('/viewMentees', (req, res) => {
    const mentorId = req.query.mentorId;
    if (!mentorId) return res.status(400).send('Mentor not specified');
    db.query(
        `SELECT u.* FROM users u
         JOIN student_mentor sm ON u.id = sm.student_id
         WHERE sm.mentor_id = ?`,
        [mentorId],
        (err, mentees) => {
            if (err) return res.status(500).send('Server error');
            res.render('viewMentees', { mentees, mentorId }); // <-- pass mentorId here
        }
    );
});

app.get('/student-mentorChat/:mentorId', (req, res) => {
    const mentorId = req.params.mentorId;
    // Fallback to session if studentId is not in query
    const studentId = req.query.studentId || req.session.userId;
    if (!mentorId || !studentId) return res.status(400).send('Missing IDs');
    db.query(
        `SELECT * FROM student_mentor_chat WHERE student_id = ? AND mentor_id = ? ORDER BY createdAt ASC`,
        [studentId, mentorId],
        (err, messages) => {
            if (err) return res.status(500).send('Server error');
            // Fetch mentor and student info for display
            db.query(
                `SELECT id, fullName, profile_pic, userType FROM users WHERE id IN (?, ?)`,
                [mentorId, studentId],
                (err2, users) => {
                    if (err2) return res.status(500).send('Server error');
                    const mentor = users.find(u => u.id == mentorId);
                    const student = users.find(u => u.id == studentId);
                    // Determine userType from session
                    const userType = req.session.userType;
                    res.render('student-mentorChat', { messages, mentor, student, studentId, mentorId, userType });
                }
            );
        }
    );
});
app.post('/student-mentorChat/:mentorId', (req, res) => {
    // Disabled: now handled by socket.io
    res.redirect(`/student-mentorChat/${req.params.mentorId}?studentId=${req.body.studentId}`);
});

// 1-to-1 student chat
app.get('/studentChat/:studentId', (req, res) => {
    const currentUserId = req.query.currentUserId;
    const otherStudentId = req.params.studentId;
    if (!currentUserId) return res.status(400).send('Current user not specified');
    db.query(
        `SELECT id, fullName, profile_pic, collegeName, branch, year, city, state, linkedin, github FROM users WHERE id IN (?, ?) AND userType = 'Student'`,
        [currentUserId, otherStudentId],
        (err, users) => {
            if (err || users.length < 2) return res.status(404).send('Users not found');
            const currentUser = users.find(u => u.id == currentUserId);
            const otherUser = users.find(u => u.id == otherStudentId);
            db.query(
                `SELECT * FROM student_private_chat 
                 WHERE (senderId = ? AND receiverId = ?) OR (senderId = ? AND receiverId = ?)
                 ORDER BY createdAt ASC`,
                [currentUserId, otherStudentId, otherStudentId, currentUserId],
                (err2, messages) => {
                    if (err2) return res.status(500).send('Server error');
                    res.render('studentChat', {
                        currentUser,
                        otherUser,
                        messages
                    });
                }
            );
        }
    );
});
app.post('/studentChat/:studentId', (req, res) => {
    // Disabled: now handled by socket.io
    res.redirect(`/studentChat/${req.params.studentId}?currentUserId=${req.body.senderId}`);
});

// Mentor uploads a resource
app.post('/uploadResource', upload.single('resourceFile'), (req, res) => {
    const { mentorId, title, description } = req.body;
    if (!mentorId || !title || !req.file) {
        return res.status(400).send('Mentor, title, and file are required');
    }
    const file_path = req.file.path;
    db.execute(
        'INSERT INTO resources (mentor_id, title, description, file_path) VALUES (?, ?, ?, ?)',
        [mentorId, title, description, file_path],
        (err) => {
            if (err) {
                console.error(err);
                return res.status(500).send('Server error');
            }
            res.send('<script>alert("Resource uploaded successfully!"); window.history.back();</script>');
        }
    );
});

// Student uploads an assignment
app.post('/uploadAssignment', upload.single('assignmentFile'), (req, res) => {
    const { studentId, title, description } = req.body;
    if (!studentId || !title || !req.file) {
        return res.status(400).send('Student, title, and file are required');
    }
    const file_path = req.file.path;
    // Student self-uploaded assignments have mentor_id as NULL
    db.execute(
        'INSERT INTO assignments (student_id, mentor_id, title, description, file_path) VALUES (?, NULL, ?, ?, ?)',
        [studentId, title, description, file_path],
        (err) => {
            if (err) {
                console.error(err);
                return res.status(500).send('Server error');
            }
            res.send('<script>alert("Assignment uploaded successfully!"); window.history.back();</script>');
        }
    );
});

// List all resources (for students/mentors)
app.get('/resources', (req, res) => {
    db.query('SELECT r.*, u.fullName as mentorName FROM resources r JOIN users u ON r.mentor_id = u.id', (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Server error');
        }
        res.json(results);
    });
});

// List all assignments for a student (or all, if admin/mentor)
app.get('/assignments', (req, res) => {
    const { studentId } = req.query;
    let query = 'SELECT a.*, u.fullName as studentName FROM assignments a JOIN users u ON a.student_id = u.id';
    let params = [];
    if (studentId) {
        query += ' WHERE a.student_id = ?';
        params.push(studentId);
    }
    db.query(query, params, (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Server error');
        }
        res.json(results);
    });
});
// List all assignments for a student (or all, if admin/mentor)
app.get('/assignments', (req, res) => {
    const { studentId } = req.query;
    let query = 'SELECT a.*, u.fullName as studentName, m.fullName as mentorName FROM assignments a JOIN users u ON a.student_id = u.id LEFT JOIN users m ON a.mentor_id = m.id';
    let params = [];
    if (studentId) {
        query += ' WHERE a.student_id = ?';
        params.push(studentId);
    }
    db.query(query, params, (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Server error');
        }
        res.json(results);
    });
});

// Mentor assigns an assignment to a mentee
app.post('/assignAssignment', upload.single('assignmentFile'), (req, res) => {
    const { mentorId, studentId, title, description } = req.body;
    if (!mentorId || !studentId || !title || !req.file) {
        return res.status(400).send('Mentor, student, title, and file are required');
    }
    const file_path = req.file.path;
    db.execute(
        'INSERT INTO assignments (student_id, mentor_id, title, description, file_path) VALUES (?, ?, ?, ?, ?)',
        [studentId, mentorId, title, description, file_path],
        (err) => {
            if (err) {
                console.error(err);
                return res.status(500).send('Server error');
            }
            res.send('<script>alert("Assignment assigned successfully!"); window.history.back();</script>');
        }
    );
});

// List assignments for a student from their mentor only (for My Mentor section)
app.get('/myMentorAssignments', (req, res) => {
    const { studentId } = req.query;
    if (!studentId) return res.status(400).send('Student not specified');
    // Find mentor for this student
    db.query('SELECT mentor_id FROM student_mentor WHERE student_id = ?', [studentId], (err, rows) => {
        if (err || rows.length === 0) return res.json([]);
        const mentorId = rows[0].mentor_id;
        db.query(
            'SELECT a.*, m.fullName as mentorName FROM assignments a JOIN users m ON a.mentor_id = m.id WHERE a.student_id = ? AND a.mentor_id = ?',
            [studentId, mentorId],
            (err2, results) => {
                if (err2) return res.json([{ mentorId }]);
                // Always return mentorId, even if no assignments
                if (!results || results.length === 0) {
                    return res.json([{ mentorId }]);
                }
                // Add mentorId to each assignment object
                const withMentorId = results.map(a => ({ ...a, mentorId }));
                res.json(withMentorId);
            }
        );
    });
});

app.get('/collegeDashboard', requireLogin, (req, res) => {
    db.query('SELECT * FROM techfest', (err, fests) => {
        if (err) return res.status(500).send('Server error');
        res.render('collegeDashboard', { fests });
    });
});

// Show fest registration form
app.get('/registerFest', (req, res) => {
    const festId = req.query.festId;
    const studentId = req.query.studentId;
    if (!festId || !studentId) return res.status(400).send('Missing fest or student');
    db.query('SELECT festName FROM techfest WHERE id = ?', [festId], (err, rows) => {
        if (err || rows.length === 0) return res.status(404).send('Fest not found');
        res.render('registerFest', { festId, studentId, festName: rows[0].festName });
    });
});

// Handle fest registration POST
app.post('/registerFest', (req, res) => {
    const {
        fest_id, team_name, team_size, leader_id,
        member1_name, member1_email,
        member2_name, member2_email,
        member3_name, member3_email,
        member4_name, member4_email,
        member5_name, member5_email,
        member6_name, member6_email
    } = req.body;
    if (!fest_id || !team_name || !team_size || !leader_id) return res.status(400).send('Missing fields');
    const params = [
        fest_id, team_name, team_size, leader_id,
        member1_name, member1_email,
        member2_name, member2_email,
        member3_name, member3_email,
        member4_name, member4_email,
        member5_name, member5_email,
        member6_name, member6_email
    ];
    db.execute(
        `INSERT INTO fest_registrations 
        (fest_id, team_name, team_size, leader_id, member1_name, member1_email, member2_name, member2_email, member3_name, member3_email, member4_name, member4_email, member5_name, member5_email, member6_name, member6_email)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        params,
        (err) => {
            if (err) return res.status(500).send('Server error');
            res.send('<script>alert("Registered successfully!"); window.location.href="/studentDashboard?currentUserId='+leader_id+'";</script>');
        }
    );
});

// Mentor applies for judging
app.post('/applyJudge', (req, res) => {
    const { mentorId, festId } = req.body;
    if (!mentorId || !festId) return res.status(400).send('Missing fields');
    db.execute(
        'INSERT IGNORE INTO fest_judges (fest_id, mentor_id) VALUES (?, ?)',
        [festId, mentorId],
        (err) => {
            if (err) return res.status(500).send('Server error');
            res.send('<script>alert("Applied for judging!"); window.history.back();</script>');
        }
    );
});

// College dashboard: view registered students for each fest
app.get('/viewFestRegistrations', (req, res) => {
    const festId = req.query.festId;
    if (!festId) return res.status(400).send('Missing fest');
    db.query('SELECT * FROM fest_registrations WHERE fest_id = ?', [festId], (err, registrations) => {
        if (err) return res.status(500).send('Server error');
        res.render('viewFestRegistrations', { registrations });
    });
});

// College dashboard: view mentors who applied for judging
app.get('/viewFestJudges', (req, res) => {
    const festId = req.query.festId;
    if (!festId) return res.status(400).send('Missing fest');
    db.query(
        `SELECT m.*, u.fullName, u.email, u.collegeName, u.expertise FROM fest_judges m JOIN users u ON m.mentor_id = u.id WHERE m.fest_id = ?`,
        [festId],
        (err, judges) => {
            if (err) return res.status(500).send('Server error');
            res.render('viewFestJudges', { judges });
        }
    );
});

// Admin quiz assignment page (EJS)
app.get('/adminQuizAssign', (req, res) => {
    res.render('adminQuizAssign');
});

// Admin assigns quiz/coding challenge to all students
app.post('/admin/assignQuiz', (req, res) => {
    const { question, option1, option2, option3, option4, correct_option, type, language, minScore } = req.body;
    const query = `INSERT INTO quizzes (question, option1, option2, option3, option4, correct_option, type, language, min_score, assigned_by, assigned_to) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL)`;
    db.execute(query, [question, option1, option2, option3, option4, correct_option, type, language, minScore], (err) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Error assigning quiz');
        }
        res.send('<script>alert("Quiz/Coding Challenge assigned successfully!"); window.location.href="/adminQuizAssign";</script>');
    });
});

// Mentor rating: submit rating
app.post('/api/mentor/rate', (req, res) => {
    const { mentorId, studentId, rating } = req.body;
    if (!mentorId || !studentId || !rating) {
        return res.status(400).json({ success: false, error: 'Missing fields' });
    }
    db.execute(
        `INSERT INTO mentor_ratings (mentor_id, student_id, rating) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE rating = ?`,
        [mentorId, studentId, rating, rating],
        (err) => {
            if (err) return res.status(500).json({ success: false, error: 'DB error' });
            res.json({ success: true });
        }
    );
});

// Mentor feedback: submit textual feedback
app.post('/api/mentor/feedback', (req, res) => {
    const { mentorId, studentId, feedback } = req.body;
    if (!mentorId || !studentId || !feedback) {
        return res.json({ success: false, error: 'Missing fields' });
    }
    db.execute(
        'INSERT INTO mentor_feedback (mentor_id, student_id, feedback) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE feedback = ?',
        [mentorId, studentId, feedback, feedback],
        (err) => {
            if (err) return res.json({ success: false, error: 'DB error' });
            res.json({ success: true });
        }
    );
});

// AI: Student mentor recommendations (with feedback analysis)
app.get('/student/predict/:id', (req, res) => {
    const studentId = req.params.id;
    // Fetch student and mentor data
    db.query('SELECT * FROM users WHERE userType = "Mentor"', (err, mentors) => {
        if (err) return res.status(500).send('DB error');
        db.query('SELECT * FROM mentor_feedback', (fErr, feedbacks) => {
            if (fErr) return res.status(500).send('DB error');
            // Call Python script for mentor recommendations
            const { execFile } = require('child_process');
            const PYTHON_PATH = 'python';
            execFile(PYTHON_PATH, ['ai/student_mentor_recommend.py', JSON.stringify({ studentId, mentors, feedbacks })], (error, stdout, stderr) => {
                if (error) return res.status(500).send('AI error: ' + stderr);
                try {
                    const result = JSON.parse(stdout);
                    res.json(result);
                } catch {
                    res.status(500).send('Invalid AI response');
                }
            });
        });
    });
});

// Mentor rating: get average rating
app.get('/api/mentor/averageRating', (req, res) => {
    const mentorId = req.query.mentorId;
    if (!mentorId) return res.status(400).send('Missing mentorId');
    db.query(
        `SELECT AVG(rating) as avgRating, COUNT(*) as count FROM mentor_ratings WHERE mentor_id = ?`,
        [mentorId],
        (err, rows) => {
            if (err) return res.status(500).send('DB error');
            res.json({ avgRating: rows[0]?.avgRating || 0, count: rows[0]?.count || 0 });
        }
    );
});

// Mentor profile API for My Mentor section
app.get('/api/mentor/profile', (req, res) => {
    const mentorId = req.query.mentorId;
    if (!mentorId) return res.status(400).json({ error: 'Missing mentorId' });
    db.query('SELECT id, fullName, profile_pic, collegeName, expertise FROM users WHERE id = ? AND userType = "Mentor"', [mentorId], (err, rows) => {
        if (err || rows.length === 0) return res.status(404).json({ error: 'Mentor not found' });
        res.json(rows[0]);
    });
});

// View assigned mentor for student
app.get('/viewMentors', (req, res) => {
    const currentUserId = req.session.userId;
    if (!currentUserId) return res.redirect('/login.html');
    // Find all assigned mentors
    db.query('SELECT mentor_id FROM student_mentor WHERE student_id = ?', [currentUserId], (err, rows) => {
        if (err || rows.length === 0) return res.render('viewMentors', { mentors: [], currentUserId });
        const mentorIds = rows.map(r => r.mentor_id);
        if (mentorIds.length === 0) return res.render('viewMentors', { mentors: [], currentUserId });
        db.query('SELECT * FROM users WHERE id IN (' + mentorIds.map(() => '?').join(',') + ') AND userType = "Mentor"', mentorIds, (err2, mentorRows) => {
            if (err2 || mentorRows.length === 0) return res.render('viewMentors', { mentors: [], currentUserId });
            res.render('viewMentors', { mentors: mentorRows, currentUserId });
        });
    });
});

// API: Mentor - View submitted work (assignments/resources) by mentees
app.get('/api/mentor/submittedWork', (req, res) => {
    const mentorId = req.query.mentorId;
    if (!mentorId) return res.status(400).json({ error: 'Missing mentorId' });
    // Get all assignments and resources submitted by mentees for this mentor
    // Assignments: where mentor_id = mentorId
    // Resources: where mentor_id = mentorId and student_id IS NOT NULL (student uploaded resource)
    const assignmentsQuery = `
        SELECT a.id, a.title, a.description, a.file_path, a.uploaded_at, u.fullName as menteeName, u.email as menteeEmail, u.id as menteeId, 'Assignment' as type
        FROM assignments a
        JOIN users u ON a.student_id = u.id
        WHERE a.mentor_id = ?
        ORDER BY a.uploaded_at DESC
    `;
    const resourcesQuery = `
        SELECT r.id, r.title, r.description, r.file_path, r.uploaded_at, u.fullName as menteeName, u.email as menteeEmail, u.id as menteeId, 'Resource' as type
        FROM resources r
        JOIN users u ON r.student_id = u.id
        WHERE r.mentor_id = ?
        ORDER BY r.uploaded_at DESC
    `;
    // Run both queries and merge results
    db.query(assignmentsQuery, [mentorId], (err, assignments) => {
        if (err) return res.status(500).json({ error: 'DB error (assignments)' });
        db.query(resourcesQuery, [mentorId], (err2, resources) => {
            if (err2) return res.status(500).json({ error: 'DB error (resources)' });
            // Merge and sort by uploaded_at desc
            const all = [...assignments, ...resources].sort((a, b) => new Date(b.uploaded_at) - new Date(a.uploaded_at));
            res.json(all);
        });
    });
});

// API: Mentor assigns badge to student for assignment/resource
app.post('/api/mentor/assignBadge', (req, res) => {
    const { studentId, mentorId, title, type, assignmentId } = req.body;
    if (!studentId || !mentorId || !title || !type || !assignmentId) {
        return res.json({ success: false, error: 'Missing fields' });
    }
    // Badge name: e.g. 'Assignment: <title>' or 'Resource: <title>'
    const badgeName = `${type}: ${title}`;
    // Optionally, you can add a language or category if needed
    // Prevent duplicate badge for same assignment/resource
    db.query('SELECT * FROM badges WHERE student_id = ? AND badge_name = ? AND assignment_id = ?', [studentId, badgeName, assignmentId], (err, rows) => {
        if (err) return res.json({ success: false, error: 'DB error' });
        if (rows && rows.length > 0) return res.json({ success: false, error: 'Badge already assigned' });
        db.execute('INSERT INTO badges (student_id, badge_name, mentor_id, assignment_id) VALUES (?, ?, ?, ?)', [studentId, badgeName, mentorId, assignmentId], (err2) => {
            if (err2) return res.json({ success: false, error: 'DB error' });
            res.json({ success: true });
        });
    });
});



app.post('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.status(500).send('Could not log out.');
        }
        res.clearCookie('connect.sid');
        res.redirect('/login.html');
    });
});



// Socket.io logic
io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // GROUP CHAT
    socket.on('group-chat', (data) => {
        // data: { userId, userName, message }
        if (!data.userId || !data.userName || !data.message) return;
        // Fetch profile_pic for this user
        db.query('SELECT profile_pic FROM users WHERE id = ?', [data.userId], (err, rows) => {
            const profile_pic = (rows && rows[0] && rows[0].profile_pic) ? rows[0].profile_pic : 'uploads/default.jpg';
            // Save to DB
            db.execute('INSERT INTO studentschat (userName, userId, originalMessage, message) VALUES (?, ?, ?, ?)',
                [data.userName, data.userId, data.message, data.message],
                (err2) => {
                    if (err2) console.error('Group chat DB error:', err2);
                    // Broadcast to all
                    io.emit('group-chat', {
                        userId: data.userId,
                        userName: data.userName,
                        message: data.message,
                        profile_pic
                    });
                }
            );
        });
    });

    // 1-to-1 STUDENT CHAT
    socket.on('student-private-chat', (data) => {
        // data: { senderId, receiverId, message }
        if (!data.senderId || !data.receiverId || !data.message) return;
        db.execute('INSERT INTO student_private_chat (senderId, receiverId, message) VALUES (?, ?, ?)',
            [data.senderId, data.receiverId, data.message],
            (err2) => {
                if (err2) console.error('Private chat DB error:', err2);
                // Emit to both sender and receiver
                io.emit('student-private-chat', {
                    senderId: data.senderId,
                    receiverId: data.receiverId,
                    message: data.message
                });
            }
        );
    });

    // MENTOR-STUDENT CHAT
    socket.on('mentor-student-chat', (data) => {
        // data: { studentId, mentorId, senderType, message }
        if (!data.studentId || !data.mentorId || !data.senderType || !data.message) return;
        db.execute('INSERT INTO student_mentor_chat (student_id, mentor_id, sender_type, message) VALUES (?, ?, ?, ?)',
            [data.studentId, data.mentorId, data.senderType, data.message],
            (err2) => {
                if (err2) console.error('Mentor-student chat DB error:', err2);
                // Emit to both mentor and student
                io.emit('mentor-student-chat', {
                    studentId: data.studentId,
                    mentorId: data.mentorId,
                    senderType: data.senderType,
                    message: data.message
                });
            }
        );
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

// Student attempts a quiz
// Student attempts a quiz (pass/fail only)
app.post('/student/attemptQuiz', (req, res) => {
    const { quiz_id, answers } = req.body; // answers: [{questionId, selectedOption}]
    const studentId = req.session.userId;
    if (!studentId) return res.status(401).json({ error: 'Not logged in' });
    if (!quiz_id || !answers || !Array.isArray(answers) || answers.length === 0) return res.status(400).json({ error: 'Missing fields' });
    // Get all quiz questions for this quiz set (assume all answers are for the same quiz set/language)
    // If you want to support multi-question quizzes, you should have a quiz_group_id or similar. For now, fetch all quiz_ids in answers.
    const quizIds = answers.map(a => a.questionId);
    db.query('SELECT * FROM quizzes WHERE id IN (?)', [quizIds], (err, quizRows) => {
        if (err || !quizRows.length) return res.status(404).json({ error: 'Quiz questions not found' });
        // Calculate score
        let score = 0;
        let min_score = 0;
        let language = quizRows[0].language;
        // For pass/fail, use the highest min_score among the questions (or you can use the first)
        quizRows.forEach((quiz, idx) => {
            const ans = answers.find(a => String(a.questionId) === String(quiz.id));
            if (ans && Number(ans.selectedOption) === Number(quiz.correct_option)) score++;
            if (quiz.min_score && quiz.min_score > min_score) min_score = quiz.min_score;
        });
        const is_passed = score >= min_score ? 1 : 0;
        // Save pass/fail result for the first quiz_id (or you can use a quiz_group_id if you have it)
        db.query(
            'INSERT INTO quiz_results (quiz_id, student_id, is_passed) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE is_passed = ?',
            [quiz_id, studentId, is_passed, is_passed],
            (err2) => {
                if (err2) return res.status(500).json({ error: 'DB error' });
                // Award badge if passed
                if (is_passed) {
                    db.query('INSERT IGNORE INTO badges (student_id, language, badge_name) VALUES (?, ?, ?)', [studentId, language, 'Quiz Master'], () => {
                        return res.json({ is_passed: true, message: 'Passed! Badge awarded.' });
                    });
                } else {
                    return res.json({ is_passed: false, message: 'Not passed.' });
                }
            }
        );
    });
});

server.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
    console.log(`Admin dashboard is available at http://localhost:${port}/adminDashboard`);
    console.log(`Admin quiz assignment is available at http://localhost:${port}/adminQuizAssign`);
});