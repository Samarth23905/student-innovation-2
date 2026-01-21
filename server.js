import express from 'express';
import bodyParser from 'body-parser';
import multer from 'multer';
import path from 'path';
import pkg from 'pg';
const { Pool } = pkg;
import bcrypt from 'bcrypt';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import session from 'express-session';
import http from 'http';
import { Server } from 'socket.io';
import { execFile } from 'child_process';
import dotenv from 'dotenv';

dotenv.config();

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

const port = process.env.PORT || 5000;


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

// PostgreSQL connection
let db;
if (process.env.DATABASE_URL) {
    // Use connection string for deployed environments (Render, Railway, etc.)
    db = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false } // For cloud deployments
    });
} else {
    // Use individual parameters for local development
    db = new Pool({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || '1QGEaryidPA215amou85oTAOv0tOA9eB',
        database: process.env.DB_NAME || 'student_innovation_hub',
        port: process.env.DB_PORT || 5432
    });
}

// Test connection
db.query('SELECT NOW()', (err, result) => {
    if (err) {
        console.error('Database connection failed:', err.stack);
        return;
    }
    console.log('✅ Database connected successfully');
    console.log(`📊 Connected to: ${process.env.DB_NAME || 'student_innovation_hub'}`);
});

// AI/ML integration
const PYTHON_PATH = 'python'; // Change if using venv

// Mentor prediction endpoint
app.get('/mentor/predict/:id', (req, res) => {
    const mentorId = req.params.id;
    db.query('SELECT * FROM users WHERE id = $1 AND userType = $2::user_type', [mentorId, 'Mentor'], (err, result) => {
        if (err || !result || result.rows.length === 0) return res.status(404).send('Mentor not found');
        const mentor = result.rows[0];
        // Fetch all students
        db.query('SELECT * FROM users WHERE userType = $1::user_type', ['Student'], (sErr, sResult) => {
            if (sErr) return res.status(500).send('DB error');
            const students = sResult?.rows || [];
            // Fetch grades and badges
            db.query('SELECT * FROM quiz_attempts', [], (gErr, gResult) => {
                const grades = gResult?.rows || [];
                if (gErr) return res.status(500).send('DB error');
                db.query('SELECT * FROM badges', [], (bErr, bResult) => {
                    const badges = bResult?.rows || [];
                    if (bErr) return res.status(500).send('DB error');
                    // Call Python script for mentee prediction
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
    db.query('SELECT * FROM users WHERE userType = ANY($1::user_type[])', [['Mentor', 'Student']], (err, result) => {
        if (err) return res.status(500).send('DB error');
        const users = result?.rows || [];
        // Fetch fest data
        db.query('SELECT * FROM techfest', [], (festErr, festResult) => {
            if (festErr) return res.status(500).send('DB error');
            const fests = festResult?.rows || [];
                // Fetch mentor ratings and feedbacks
                db.query('SELECT * FROM mentor_ratings', [], (rErr, rResult) => {
                    if (rErr) return res.status(500).send('DB error');
                    const ratings = rResult?.rows || [];
                    db.query('SELECT * FROM mentor_feedback', [], (fErr, fResult) => {
                        if (fErr) return res.status(500).send('DB error');
                        const feedbacks = fResult?.rows || [];
                        // Call Python script for dashboard analytics (judges)
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
                VALUES ($1, $2, $3, $4, $5::user_type, $6, $7, $8, $9, $10, $11, $12)
            `;
            params = [profile_pic, fullName, email, hashedPassword, userType, collegeName, branch, year, city, state, github, linkedin];
            db.query(query, params, (err, result) => {
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
                INSERT INTO users (profile_pic, fullName, email, hashedPassword, userType, expertise, collegeName, experience, city, state, github, linkedin, portfolio) 
                VALUES ($1, $2, $3, $4, $5::user_type, $6, $7, $8, $9, $10, $11, $12, $13)
                RETURNING id
            `;
            params = [profile_pic, fullName, email, hashedPassword, userType, expertise, collegeName, experience, city, state, github, linkedin, portfolio];
            db.query(query, params, (err, result) => {
                if (err) {
                    console.error(err);
                    return res.status(500).send('Server error');
                }
                const insertId = result.rows[0].id;
                // Pass mentorId to mentorsCred page
                res.render('mentorsCred', { mentorId: insertId });
            });
        } else if (userType === 'College') {
            if (!collegeName || !collegeCode || !collegeEmail || !city || !state || !pincode || !contactName || !contactEmail || !collegeType) {
                return res.status(400).send('All fields are required for colleges');
            }
            query = `
                INSERT INTO users (profile_pic, collegeName, collegeEmail, collegeCode, hashedPassword, userType, city, state, pincode, contactName, contactEmail, collegeType) 
                VALUES ($1, $2, $3, $4, $5, $6::user_type, $7, $8, $9, $10, $11, $12)
            `;
            params = [profile_pic, collegeName, collegeEmail, collegeCode, hashedPassword, userType, city, state, pincode, contactName, contactEmail, collegeType];
            db.query(query, params, (err) => {
                if (err) {
                    console.error(err);
                    return res.status(500).send('Server error');
                }
                db.query('SELECT * FROM techfest', [], (err, result) => {
                    if (err) return res.status(500).send('Server error');
                    res.render('collegeDashboard', { fests: result.rows });
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

    const query = 'SELECT * FROM users WHERE email = $1 OR collegeEmail = $1';
    db.query(query, [email], async (err, result) => {
        if (err) {
            console.error('Error fetching user:', err);
            return res.status(500).send('Server error');
        }
        if (!result || result.rows.length === 0) {
            return res.status(401).send('Invalid email or password');
        }

        const user = result.rows[0];
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
            // Mentor approved
            return res.redirect(`/mentorDashboard?mentorId=${user.id}`);
        } else if (user.userType === 'Student') {
            return res.redirect(`/studentDashboard?currentUserId=${user.id}`);
        } else if (user.userType === 'College' && (user.collegeEmail === email || user.email === email)) {
            db.query('SELECT * FROM techfest', [], (err, result) => {
                if (err) return res.status(500).send('Server error');
                res.render('collegeDashboard', { fests: result.rows, collegeId: user.id });
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
        return res.redirect(`/mentorDashboard?mentorId=${req.session.userId}`);
    } else if (req.session.userType === 'Student') {
        return res.redirect('/studentDashboard');
    } else {
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
        SET qualification = $1, experience = $2, specialization = $3, bio = $4
        WHERE id = $5 AND userType = $6::user_type
    `;
    db.query(query, [qualification, experience, specialization, bio, mentorId, 'Mentor'], (err) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Server error');
        }
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
    db.query(
        'UPDATE users SET livecoding = $1 WHERE id = $2 AND userType = $3::user_type',
        [JSON.stringify(livecodingData), mentorId, 'Mentor'],
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
    db.query('SELECT min_score FROM quizzes WHERE id = $1 AND language = $2', [quizId, language], (err, result) => {
        if (err) return res.status(500).send('DB error');
        const minScore = result?.rows[0]?.min_score || 0;
        db.query('INSERT INTO quiz_attempts (student_id, quiz_id, score) VALUES ($1, $2, $3)', [studentId, quizId, score], (err) => {
            if (err) return res.status(500).send('DB error');
            if (score >= minScore) {
                db.query('INSERT INTO badges (student_id, language, badge_name) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', [studentId, language, 'Quiz Master'], (err) => {
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
    const query = `SELECT id, profile_pic, fullName, collegeName, experience, expertise, linkedin, github, state, livecoding FROM users WHERE userType = $1::user_type AND (approved IS NULL OR approved = 0)`;
    db.query(query, ['Mentor'], (err, result) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Server error');
        }
        res.render('adminDashboard', { mentors: result.rows });
    });
});

// Approve mentor
app.post('/approveMentor', (req, res) => {
    const { mentorId } = req.body;
    db.query('UPDATE users SET approved = 1 WHERE id = $1', [mentorId], (err) => {
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
    db.query('UPDATE users SET approved = -1 WHERE id = $1', [mentorId], (err) => {
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
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)
    `;
    const params = [
        collegeName, affiliation, festName, editionInt, startDate, endDate, venue, pincode,
        contactPerson, designation, email, phone, website, registrationLink,
        instagram, twitter, expectedParticipantsInt, scale, mode, description, brochure, logo, events
    ];

    db.query(query, params, (err) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Server error');
        }
        db.query('SELECT * FROM techfest', [], (err, result) => {
            if (err) return res.status(500).send('Server error');
            res.render('collegeDashboard', { success: true, fests: result.rows });
        });
    });
});

app.get('/student/leaderboard', (req, res) => {
    db.query(
        `SELECT u.id, u.fullName AS name, COUNT(b.id) AS badgeCount
         FROM users u
         LEFT JOIN badges b ON u.id = b.student_id
         WHERE u.userType = $1::user_type
         GROUP BY u.id
         ORDER BY badgeCount DESC, name ASC`,
        ['Student'],
        (err, result) => {
            if (err) {
                console.error(err);
                return res.status(500).send('Server error');
            }
            res.json(result.rows);
        }
    );
});

// Student dashboard: fetch mentors, fests, and student info
app.get('/studentDashboard', requireLogin, (req, res) => {
    const currentUserId = req.session.userId;

    db.query('SELECT profile_pic, fullName FROM users WHERE id = $1 AND userType = $2::user_type', [currentUserId, 'Student'], (err, result) => {
        if (err || !result || result.rows.length === 0) {
            return res.status(500).send('Error fetching student profile');
        }
        const studentProfilePic = result.rows[0].profile_pic;
        const studentName = result.rows[0].fullName;

        const mentorQuery = `
            SELECT u.*, AVG(mr.rating) as avgRating, COUNT(mr.id) as ratingCount
            FROM users u
            LEFT JOIN mentor_ratings mr ON u.id = mr.mentor_id
            WHERE u.userType = $1::user_type
            GROUP BY u.id
            ORDER BY avgRating DESC NULLS LAST, u.fullName ASC
        `;
        db.query(mentorQuery, ['Mentor'], (err, result) => {
            if (err) {
                console.error(err);
                return res.status(500).send('Error fetching mentors');
            }
            const mentors = result.rows;

            db.query('SELECT * FROM techfest', [], (festErr, festResult) => {
                if (festErr) return res.status(500).send('Error fetching fests');
                const fests = festResult.rows;

                db.query('SELECT * FROM quizzes WHERE assigned_to = $1 OR assigned_to IS NULL', [currentUserId], (quizErr, quizResult) => {
                    if (quizErr) return res.status(500).send('Error fetching quizzes');
                    const quizzes = quizResult.rows;

                    db.query('SELECT DISTINCT language FROM quizzes', [], (langErr, langResult) => {
                        if (langErr) return res.status(500).send('Error fetching quiz languages');
                        const quizLanguages = langResult.rows.map(row => row.language);

                        db.query(
                            `SELECT u.id, u.fullName AS name, COUNT(b.id) AS badgeCount
                             FROM users u
                             LEFT JOIN badges b ON u.id = b.student_id
                             WHERE u.userType = $1::user_type
                             GROUP BY u.id
                             ORDER BY badgeCount DESC, name ASC`,
                            ['Student'],
                            (lbErr, lbResult) => {
                                let leaderboard = [];
                                if (!lbErr && lbResult) {
                                    leaderboard = lbResult.rows;
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
        `SELECT id, fullName, email, collegeName, branch, year, city, state, linkedin, github, techStack FROM users WHERE userType = $1::user_type AND id != $2`,
        ['Student', currentUserId],
        (err, result) => {
            if (err) {
                console.error(err);
                return res.status(500).send('Server error');
            }
            const students = result.rows;
            const studentIds = students.map(s => s.id);
            if (studentIds.length === 0) {
                return res.render('exploreStud', { students, currentUserId });
            }
            db.query(
                `SELECT qa.student_id, q.language FROM quiz_attempts qa JOIN quizzes q ON qa.quiz_id = q.id WHERE qa.student_id = ANY($1::int[]) GROUP BY qa.student_id, q.language`,
                [studentIds],
                (langErr, langResult) => {
                    if (langErr) {
                        console.error(langErr);
                        return res.render('exploreStud', { students, currentUserId });
                    }
                    db.query(
                        `SELECT student_id, language, badge_name, mentor_id FROM badges WHERE student_id = ANY($1::int[])`,
                        [studentIds],
                        (badgeErr, badgeResult) => {
                            if (badgeErr) {
                                console.error(badgeErr);
                                return res.render('exploreStud', { students, currentUserId });
                            }
                            const langRows = langResult.rows;
                            const badgeRows = badgeResult.rows;
                            
                            const langMap = {};
                            langRows.forEach(row => {
                                if (!langMap[row.student_id]) langMap[row.student_id] = [];
                                langMap[row.student_id].push(row.language);
                            });
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
        `SELECT id, profile_pic, fullName FROM users WHERE id = $1 AND userType = $2::user_type`,
        [mentorId, 'Mentor'],
        (err, result) => {
            if (err || !result || result.rows.length === 0) return res.status(404).send('Mentor not found');
            const mentorProfilePic = result.rows[0].profile_pic;
            const mentorName = result.rows[0].fullName;

            db.query(
                `SELECT u.id, u.profile_pic, u.fullName, u.email, u.collegeName, u.branch, u.year, u.city, u.state, u.linkedin, u.github
                 FROM users u
                 JOIN student_mentor sm ON u.id = sm.student_id
                 WHERE sm.mentor_id = $1`,
                [mentorId],
                (err, result) => {
                    if (err) return res.status(500).send('Error fetching mentees');
                    const mentees = result.rows;
                    const menteeIds = mentees.map(s => s.id);

                    if (menteeIds.length === 0) {
                        db.query('SELECT id, profile_pic, fullName, email, collegeName, branch, year, city, state, linkedin, github FROM users WHERE userType = $1::user_type', ['Student'], (err2, result2) => {
                            if (err2) return res.status(500).send('Error fetching students');
                            db.query('SELECT * FROM techfest', [], (festErr, festResult) => {
                                if (festErr) return res.status(500).send('Error fetching fests');
                                res.render('mentorDashboard', { mentorId, mentorProfilePic, mentorName, students: result2.rows, fests: festResult.rows, menteeProgress: [] });
                            });
                        });
                        return;
                    }
                    db.query(
                        `SELECT a.student_id, COUNT(a.id) as assignmentCount
                         FROM assignments a
                         WHERE a.student_id = ANY($1::int[]) AND a.mentor_id = $2
                         GROUP BY a.student_id`,
                        [menteeIds, mentorId],
                        (err, result) => {
                            if (err) return res.status(500).send('Error fetching assignments');
                            const assignmentMap = {};
                            result.rows.forEach(row => {
                                assignmentMap[row.student_id] = row.assignmentCount;
                            });
                            const menteeProgress = mentees.map(stud => ({
                                ...stud,
                                assignmentCount: assignmentMap[stud.id] || 0
                            })).sort((a, b) => b.assignmentCount - a.assignmentCount);

                            db.query('SELECT id, profile_pic, fullName, email, collegeName, branch, year, city, state, linkedin, github FROM users WHERE userType = $1::user_type', ['Student'], (err2, result2) => {
                                if (err2) return res.status(500).send('Error fetching students');
                                db.query('SELECT * FROM techfest', [], (festErr, festResult) => {
                                    if (festErr) return res.status(500).send('Error fetching fests');
                                    res.render('mentorDashboard', { mentorId, mentorProfilePic, mentorName, students: result2.rows, fests: festResult.rows, menteeProgress });
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
    db.query('SELECT * FROM users WHERE id = $1 AND userType = $2::user_type', [studentId, 'Student'], (err, result) => {
        if (err || !result || result.rows.length === 0) return res.status(404).send('Student not found');
        const student = result.rows[0];
        db.query('SELECT language, badge_name FROM badges WHERE student_id = $1', [studentId], (bErr, bResult) => {
            student.badges = bResult?.rows || [];
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
        [],
        (err, result) => {
            if (err) return res.status(500).send('Server error');
            let currentUserId = null;
            let currentUserName = null;
            if (req.session && req.session.userId) {
                currentUserId = req.session.userId;
                currentUserName = req.session.fullName || req.session.userName || 'Student';
            }
            res.render('chat', { messages: result.rows, currentUserId, currentUserName });
        }
    );
});
app.post('/studentsChat', (req, res) => {
    res.redirect('/studentsChat');
});

app.post('/chooseMentor', (req, res) => {
    const { studentId, mentorId } = req.body;
    if (!studentId || !mentorId) return res.status(400).send('Missing fields');
    db.query('SELECT * FROM student_mentor WHERE student_id = $1 AND mentor_id = $2', [studentId, mentorId], (err, result) => {
        if (err) return res.status(500).send('Database error');
        if (result && result.rows.length > 0) {
            return res.redirect(`/studentDashboard?currentUserId=${studentId}`);
        }
        db.query('INSERT INTO student_mentor (student_id, mentor_id) VALUES ($1, $2)', [studentId, mentorId], (err2) => {
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
         WHERE sm.mentor_id = $1`,
        [mentorId],
        (err, result) => {
            if (err) return res.status(500).send('Server error');
            res.render('viewMentees', { mentees: result.rows, mentorId });
        }
    );
});

app.get('/student-mentorChat/:mentorId', (req, res) => {
    const mentorId = req.params.mentorId;
    const studentId = req.query.studentId || req.session.userId;
    if (!mentorId || !studentId) return res.status(400).send('Missing IDs');
    db.query(
        `SELECT * FROM student_mentor_chat WHERE student_id = $1 AND mentor_id = $2 ORDER BY createdAt ASC`,
        [studentId, mentorId],
        (err, result) => {
            if (err) return res.status(500).send('Server error');
            const messages = result.rows;
            db.query(
                `SELECT id, fullName, profile_pic, userType FROM users WHERE id = ANY($1::int[])`,
                [[mentorId, studentId]],
                (err2, result2) => {
                    if (err2) return res.status(500).send('Server error');
                    const users = result2.rows;
                    const mentor = users.find(u => u.id == mentorId);
                    const student = users.find(u => u.id == studentId);
                    const userType = req.session.userType;
                    res.render('student-mentorChat', { messages, mentor, student, studentId, mentorId, userType });
                }
            );
        }
    );
});
app.post('/student-mentorChat/:mentorId', (req, res) => {
    res.redirect(`/student-mentorChat/${req.params.mentorId}?studentId=${req.body.studentId}`);
});

// 1-to-1 student chat
app.get('/studentChat/:studentId', (req, res) => {
    const currentUserId = req.query.currentUserId;
    const otherStudentId = req.params.studentId;
    if (!currentUserId) return res.status(400).send('Current user not specified');
    db.query(
        `SELECT id, fullName, profile_pic, collegeName, branch, year, city, state, linkedin, github FROM users WHERE id = ANY($1::int[]) AND userType = $2::user_type`,
        [[currentUserId, otherStudentId], 'Student'],
        (err, result) => {
            if (err || !result || result.rows.length < 2) return res.status(404).send('Users not found');
            const users = result.rows;
            const currentUser = users.find(u => u.id == currentUserId);
            const otherUser = users.find(u => u.id == otherStudentId);
            db.query(
                `SELECT * FROM student_private_chat 
                 WHERE (senderId = $1 AND receiverId = $2) OR (senderId = $2 AND receiverId = $1)
                 ORDER BY createdAt ASC`,
                [currentUserId, otherStudentId],
                (err2, result2) => {
                    if (err2) return res.status(500).send('Server error');
                    res.render('studentChat', {
                        currentUser,
                        otherUser,
                        messages: result2.rows
                    });
                }
            );
        }
    );
});
app.post('/studentChat/:studentId', (req, res) => {
    res.redirect(`/studentChat/${req.params.studentId}?currentUserId=${req.body.senderId}`);
});

// Mentor uploads a resource
app.post('/uploadResource', upload.single('resourceFile'), (req, res) => {
    const { mentorId, title, description } = req.body;
    if (!mentorId || !title || !req.file) {
        return res.status(400).send('Mentor, title, and file are required');
    }
    const file_path = req.file.path;
    db.query(
        'INSERT INTO resources (mentor_id, title, description, file_path) VALUES ($1, $2, $3, $4)',
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
    db.query(
        'INSERT INTO assignments (student_id, mentor_id, title, description, file_path) VALUES ($1, NULL, $2, $3, $4)',
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
    db.query('SELECT r.*, u.fullName as mentorName FROM resources r JOIN users u ON r.mentor_id = u.id', [], (err, result) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Server error');
        }
        res.json(result.rows);
    });
});

// List all assignments for a student (or all, if admin/mentor)
app.get('/assignments', (req, res) => {
    const { studentId } = req.query;
    let query = 'SELECT a.*, u.fullName as studentName, m.fullName as mentorName FROM assignments a JOIN users u ON a.student_id = u.id LEFT JOIN users m ON a.mentor_id = m.id';
    let params = [];
    if (studentId) {
        query += ' WHERE a.student_id = $1';
        params.push(studentId);
    }
    db.query(query, params, (err, result) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Server error');
        }
        res.json(result.rows);
    });
});

// Mentor assigns an assignment to a mentee
app.post('/assignAssignment', upload.single('assignmentFile'), (req, res) => {
    const { mentorId, studentId, title, description } = req.body;
    if (!mentorId || !studentId || !title || !req.file) {
        return res.status(400).send('Mentor, student, title, and file are required');
    }
    const file_path = req.file.path;
    db.query(
        'INSERT INTO assignments (student_id, mentor_id, title, description, file_path) VALUES ($1, $2, $3, $4, $5)',
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
    db.query('SELECT mentor_id FROM student_mentor WHERE student_id = $1', [studentId], (err, result) => {
        if (err || !result || result.rows.length === 0) return res.json([]);
        const mentorId = result.rows[0].mentor_id;
        db.query(
            'SELECT a.*, m.fullName as mentorName FROM assignments a JOIN users m ON a.mentor_id = m.id WHERE a.student_id = $1 AND a.mentor_id = $2',
            [studentId, mentorId],
            (err2, result2) => {
                if (err2) return res.json([{ mentorId }]);
                if (!result2 || result2.rows.length === 0) {
                    return res.json([{ mentorId }]);
                }
                const withMentorId = result2.rows.map(a => ({ ...a, mentorId }));
                res.json(withMentorId);
            }
        );
    });
});

app.get('/collegeDashboard', requireLogin, (req, res) => {
    db.query('SELECT * FROM techfest', [], (err, result) => {
        if (err) return res.status(500).send('Server error');
        res.render('collegeDashboard', { fests: result.rows });
    });
});

// Show fest registration form
app.get('/registerFest', (req, res) => {
    const festId = req.query.festId;
    const studentId = req.query.studentId;
    if (!festId || !studentId) return res.status(400).send('Missing fest or student');
    db.query('SELECT festName FROM techfest WHERE id = $1', [festId], (err, result) => {
        if (err || !result || result.rows.length === 0) return res.status(404).send('Fest not found');
        res.render('registerFest', { festId, studentId, festName: result.rows[0].festName });
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
    db.query(
        `INSERT INTO fest_registrations 
        (fest_id, team_name, team_size, leader_id, member1_name, member1_email, member2_name, member2_email, member3_name, member3_email, member4_name, member4_email, member5_name, member5_email, member6_name, member6_email)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
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
    db.query(
        'INSERT INTO fest_judges (fest_id, mentor_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
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
    db.query('SELECT * FROM fest_registrations WHERE fest_id = $1', [festId], (err, result) => {
        if (err) return res.status(500).send('Server error');
        res.render('viewFestRegistrations', { registrations: result.rows });
    });
});

// College dashboard: view mentors who applied for judging
app.get('/viewFestJudges', (req, res) => {
    const festId = req.query.festId;
    if (!festId) return res.status(400).send('Missing fest');
    db.query(
        `SELECT m.*, u.fullName, u.email, u.collegeName, u.expertise FROM fest_judges m JOIN users u ON m.mentor_id = u.id WHERE m.fest_id = $1`,
        [festId],
        (err, result) => {
            if (err) return res.status(500).send('Server error');
            res.render('viewFestJudges', { judges: result.rows });
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
    const query = `INSERT INTO quizzes (question, option1, option2, option3, option4, correct_option, type, language, min_score, assigned_by, assigned_to) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NULL, NULL)`;
    db.query(query, [question, option1, option2, option3, option4, correct_option, type, language, minScore], (err) => {
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
    db.query(
        `INSERT INTO mentor_ratings (mentor_id, student_id, rating) VALUES ($1, $2, $3) 
         ON CONFLICT (mentor_id, student_id) DO UPDATE SET rating = $3`,
        [mentorId, studentId, rating],
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
    db.query(
        'INSERT INTO mentor_feedback (mentor_id, student_id, feedback) VALUES ($1, $2, $3) ON CONFLICT (mentor_id, student_id) DO UPDATE SET feedback = $3',
        [mentorId, studentId, feedback],
        (err) => {
            if (err) return res.json({ success: false, error: 'DB error' });
            res.json({ success: true });
        }
    );
});

// AI: Student mentor recommendations (with feedback analysis)
app.get('/student/predict/:id', (req, res) => {
    const studentId = req.params.id;
    db.query('SELECT * FROM users WHERE userType = $1::user_type', ['Mentor'], (err, result) => {
        if (err) return res.status(500).send('DB error');
        const mentors = result.rows;
        db.query('SELECT * FROM mentor_feedback', [], (fErr, fResult) => {
            if (fErr) return res.status(500).send('DB error');
            const feedbacks = fResult.rows;
            db.query('SELECT * FROM mentor_ratings', [], (rErr, rResult) => {
                if (rErr) return res.status(500).send('DB error');
                const ratings = rResult.rows;
                execFile(PYTHON_PATH, ['ai/student_mentor_recommend.py', JSON.stringify({ studentId, mentors, feedbacks, ratings })], (error, stdout, stderr) => {
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

// Mentor rating: get average rating
app.get('/api/mentor/averageRating', (req, res) => {
    const mentorId = req.query.mentorId;
    if (!mentorId) return res.status(400).send('Missing mentorId');
    db.query(
        `SELECT AVG(rating) as avgRating, COUNT(*) as count FROM mentor_ratings WHERE mentor_id = $1`,
        [mentorId],
        (err, result) => {
            if (err) return res.status(500).send('DB error');
            const row = result?.rows[0] || {};
            res.json({ avgRating: row.avgRating || 0, count: row.count || 0 });
        }
    );
});

// Mentor profile API for My Mentor section
app.get('/api/mentor/profile', (req, res) => {
    const mentorId = req.query.mentorId;
    if (!mentorId) return res.status(400).json({ error: 'Missing mentorId' });
    db.query('SELECT id, fullName, profile_pic, collegeName, expertise FROM users WHERE id = $1 AND userType = $2::user_type', [mentorId, 'Mentor'], (err, result) => {
        if (err || !result || result.rows.length === 0) return res.status(404).json({ error: 'Mentor not found' });
        res.json(result.rows[0]);
    });
});

// View assigned mentor for student
app.get('/viewMentors', (req, res) => {
    const currentUserId = req.session.userId;
    if (!currentUserId) return res.redirect('/login.html');
    db.query('SELECT mentor_id FROM student_mentor WHERE student_id = $1', [currentUserId], (err, result) => {
        if (err || !result || result.rows.length === 0) return res.render('viewMentors', { mentors: [], currentUserId });
        const mentorIds = result.rows.map(r => r.mentor_id);
        if (mentorIds.length === 0) return res.render('viewMentors', { mentors: [], currentUserId });
        db.query('SELECT * FROM users WHERE id = ANY($1::int[]) AND userType = $2::user_type', [mentorIds, 'Mentor'], (err2, result2) => {
            if (err2 || !result2 || result2.rows.length === 0) return res.render('viewMentors', { mentors: [], currentUserId });
            res.render('viewMentors', { mentors: result2.rows, currentUserId });
        });
    });
});

// API: Mentor - View submitted work (assignments/resources) by mentees
app.get('/api/mentor/submittedWork', (req, res) => {
    const mentorId = req.query.mentorId;
    if (!mentorId) return res.status(400).json({ error: 'Missing mentorId' });
    const assignmentsQuery = `
        SELECT a.id, a.title, a.description, a.file_path, a.uploaded_at, u.fullName as menteeName, u.email as menteeEmail, u.id as menteeId, 'Assignment' as type
        FROM assignments a
        JOIN users u ON a.student_id = u.id
        WHERE a.mentor_id = $1
        ORDER BY a.uploaded_at DESC
    `;
    const resourcesQuery = `
        SELECT r.id, r.title, r.description, r.file_path, r.uploaded_at, u.fullName as menteeName, u.email as menteeEmail, u.id as menteeId, 'Resource' as type
        FROM resources r
        JOIN users u ON r.student_id = u.id
        WHERE r.mentor_id = $1
        ORDER BY r.uploaded_at DESC
    `;
    db.query(assignmentsQuery, [mentorId], (err, result) => {
        if (err) return res.status(500).json({ error: 'DB error (assignments)' });
        const assignments = result.rows;
        db.query(resourcesQuery, [mentorId], (err2, result2) => {
            if (err2) return res.status(500).json({ error: 'DB error (resources)' });
            const resources = result2.rows;
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
    const badgeName = `${type}: ${title}`;
    db.query('SELECT * FROM badges WHERE student_id = $1 AND badge_name = $2 AND assignment_id = $3', [studentId, badgeName, assignmentId], (err, result) => {
        if (err) return res.json({ success: false, error: 'DB error' });
        if (result && result.rows && result.rows.length > 0) return res.json({ success: false, error: 'Badge already assigned' });
        db.query('INSERT INTO badges (student_id, badge_name, mentor_id, assignment_id) VALUES ($1, $2, $3, $4)', [studentId, badgeName, mentorId, assignmentId], (err2) => {
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
        if (!data.userId || !data.userName || !data.message) return;
        db.query('SELECT profile_pic FROM users WHERE id = $1', [data.userId], (err, result) => {
            const profile_pic = (result && result.rows && result.rows[0] && result.rows[0].profile_pic) ? result.rows[0].profile_pic : 'uploads/default.jpg';
            db.query('INSERT INTO studentschat (userName, userId, originalMessage, message) VALUES ($1, $2, $3, $4)',
                [data.userName, data.userId, data.message, data.message],
                (err2) => {
                    if (err2) console.error('Group chat DB error:', err2);
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
        if (!data.senderId || !data.receiverId || !data.message) return;
        db.query('INSERT INTO student_private_chat (senderId, receiverId, message) VALUES ($1, $2, $3)',
            [data.senderId, data.receiverId, data.message],
            (err2) => {
                if (err2) console.error('Private chat DB error:', err2);
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
        if (!data.studentId || !data.mentorId || !data.senderType || !data.message) return;
        db.query('INSERT INTO student_mentor_chat (student_id, mentor_id, sender_type, message) VALUES ($1, $2, $3::sender_type_enum, $4)',
            [data.studentId, data.mentorId, data.senderType, data.message],
            (err2) => {
                if (err2) console.error('Mentor-student chat DB error:', err2);
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
app.post('/student/attemptQuiz', (req, res) => {
    const { quiz_id, answers } = req.body;
    const studentId = req.session.userId;
    if (!studentId) return res.status(401).json({ error: 'Not logged in' });
    if (!quiz_id || !answers || !Array.isArray(answers) || answers.length === 0) return res.status(400).json({ error: 'Missing fields' });
    
    const quizIds = answers.map(a => a.questionId);
    db.query('SELECT * FROM quizzes WHERE id = ANY($1::int[])', [quizIds], (err, result) => {
        if (err || !result || !result.rows.length) return res.status(404).json({ error: 'Quiz questions not found' });
        
        const quizRows = result.rows;
        let score = 0;
        let min_score = 0;
        let language = quizRows[0].language;
        
        quizRows.forEach((quiz, idx) => {
            const ans = answers.find(a => String(a.questionId) === String(quiz.id));
            if (ans && Number(ans.selectedOption) === Number(quiz.correct_option)) score++;
            if (quiz.min_score && quiz.min_score > min_score) min_score = quiz.min_score;
        });
        
        const is_passed = score >= min_score ? true : false;
        db.query(
            'INSERT INTO quiz_results (quiz_id, student_id, is_passed) VALUES ($1, $2, $3) ON CONFLICT (quiz_id, student_id) DO UPDATE SET is_passed = $3',
            [quiz_id, studentId, is_passed],
            (err2) => {
                if (err2) return res.status(500).json({ error: 'DB error' });
                if (is_passed) {
                    db.query('INSERT INTO badges (student_id, language, badge_name) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', [studentId, language, 'Quiz Master'], () => {
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
