-- Create database
CREATE DATABASE student_innovation_hub;
\c student_innovation_hub;

-- Create ENUM type for userType
CREATE TYPE user_type AS ENUM ('Student', 'Mentor', 'College');
CREATE TYPE sender_type_enum AS ENUM ('student', 'mentor');

CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    userType user_type NOT NULL,
    profile_pic VARCHAR(255),
    -- Common Fields
    fullName VARCHAR(100),
    email VARCHAR(100) UNIQUE,
    hashedPassword VARCHAR(255), 
    collegeName VARCHAR(100),
    city VARCHAR(100),
    state VARCHAR(100),
    livecoding TEXT,
    techStack VARCHAR(255),
    
    -- Student-specific
    branch VARCHAR(100),
    year VARCHAR(20),
    github VARCHAR(255),
    linkedin VARCHAR(255),

    -- Mentor-specific
    expertise TEXT,
    experience VARCHAR(20),
    specialization VARCHAR(255),
    portfolio VARCHAR(255),
    qualification VARCHAR(255),
    bio TEXT,
    score INTEGER,
    approved INTEGER DEFAULT 0,

    -- College-specific
    collegeCode VARCHAR(50),
    collegeEmail VARCHAR(100),
    pincode VARCHAR(20),
    contactName VARCHAR(100),
    contactEmail VARCHAR(100),
    collegeType VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE techfest (
    id SERIAL PRIMARY KEY,
    collegeName VARCHAR(255) NOT NULL,
    affiliation VARCHAR(255),
    festName VARCHAR(255) NOT NULL,
    edition INTEGER,
    startDate DATE,
    endDate DATE,
    venue VARCHAR(255),
    pincode VARCHAR(20),
    contactPerson VARCHAR(100),
    designation VARCHAR(100),
    email VARCHAR(100),
    phone VARCHAR(20),
    website VARCHAR(255),
    registrationLink VARCHAR(255),
    instagram VARCHAR(255),
    twitter VARCHAR(255),
    expectedParticipants INTEGER,
    scale VARCHAR(50),
    mode VARCHAR(50),
    description TEXT,
    brochure VARCHAR(255),
    logo VARCHAR(255),
    events JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE studentschat (
    id SERIAL PRIMARY KEY,
    userName VARCHAR(100),
    userId INTEGER,
    originalMessage TEXT,
    message TEXT,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add index for faster group chat queries
CREATE INDEX idx_studentschat_createdAt ON studentschat(createdAt);


CREATE TABLE student_private_chat (
    id SERIAL PRIMARY KEY,
    senderId INTEGER,
    receiverId INTEGER,
    message TEXT,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (senderId) REFERENCES users(id),
    FOREIGN KEY (receiverId) REFERENCES users(id)
);

-- Add index for faster 1-to-1 chat queries
CREATE INDEX idx_student_private_chat_createdAt ON student_private_chat(createdAt);


CREATE TABLE student_mentor (
    id SERIAL PRIMARY KEY,
    student_id INTEGER,
    mentor_id INTEGER,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES users(id),
    FOREIGN KEY (mentor_id) REFERENCES users(id),
    UNIQUE (student_id, mentor_id)
);


CREATE TABLE student_mentor_chat (
    id SERIAL PRIMARY KEY,
    student_id INTEGER,
    mentor_id INTEGER,
    sender_type sender_type_enum,
    message TEXT,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES users(id),
    FOREIGN KEY (mentor_id) REFERENCES users(id)
);

-- Add index for faster mentor-student chat queries
CREATE INDEX idx_student_mentor_chat_createdAt ON student_mentor_chat(createdAt);

CREATE TABLE resources (
    id SERIAL PRIMARY KEY,
    mentor_id INTEGER,
    student_id INTEGER,
    title VARCHAR(255),
    description TEXT,
    file_path VARCHAR(255),
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (mentor_id) REFERENCES users(id),
    FOREIGN KEY (student_id) REFERENCES users(id)
);


CREATE TABLE assignments (
    id SERIAL PRIMARY KEY,
    student_id INTEGER,
    mentor_id INTEGER,
    title VARCHAR(255),
    description TEXT,
    file_path VARCHAR(255),
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES users(id),
    FOREIGN KEY (mentor_id) REFERENCES users(id)
);

CREATE TABLE fest_registrations (
    id SERIAL PRIMARY KEY,
    fest_id INTEGER,
    team_name VARCHAR(100),
    team_size INTEGER,
    leader_id INTEGER,
    member1_name VARCHAR(100),
    member1_email VARCHAR(100),
    member2_name VARCHAR(100),
    member2_email VARCHAR(100),
    member3_name VARCHAR(100),
    member3_email VARCHAR(100),
    member4_name VARCHAR(100),
    member4_email VARCHAR(100),
    member5_name VARCHAR(100),
    member5_email VARCHAR(100),
    member6_name VARCHAR(100),
    member6_email VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (fest_id) REFERENCES techfest(id)
);

CREATE TABLE fest_judges (
    id SERIAL PRIMARY KEY,
    fest_id INTEGER,
    mentor_id INTEGER,
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (fest_id) REFERENCES techfest(id),
    FOREIGN KEY (mentor_id) REFERENCES users(id)
);

CREATE TABLE quizzes (
    id SERIAL PRIMARY KEY,
    question TEXT NOT NULL,
    option1 VARCHAR(255) NOT NULL,
    option2 VARCHAR(255) NOT NULL,
    option3 VARCHAR(255) NOT NULL,
    option4 VARCHAR(255) NOT NULL,
    correct_option SMALLINT NOT NULL, -- 1 to 4
    language VARCHAR(50),
    min_score INTEGER DEFAULT 0,
    type VARCHAR(50),
    assigned_by INTEGER, -- mentor id
    assigned_to INTEGER, -- student id (or NULL for all)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE quiz_attempts (
    id SERIAL PRIMARY KEY,
    quiz_id INTEGER NOT NULL,
    student_id INTEGER NOT NULL,
    selected_option SMALLINT NOT NULL,
    is_correct BOOLEAN NOT NULL,
    attempted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    score INTEGER DEFAULT 0,
    FOREIGN KEY (quiz_id) REFERENCES quizzes(id),
    FOREIGN KEY (student_id) REFERENCES users(id)
);


CREATE TABLE badges (
    id SERIAL PRIMARY KEY,
    student_id INTEGER,
    language VARCHAR(100),
    badge_name VARCHAR(100),
    mentor_id INTEGER DEFAULT NULL,
    assignment_id INTEGER DEFAULT NULL,
    earned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES users(id),
    FOREIGN KEY (mentor_id) REFERENCES users(id),
    FOREIGN KEY (assignment_id) REFERENCES assignments(id)
);

CREATE TABLE mentor_ratings (
    id SERIAL PRIMARY KEY,
    mentor_id INTEGER NOT NULL,
    student_id INTEGER NOT NULL,
    rating INTEGER NOT NULL,
    rated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (mentor_id, student_id),
    FOREIGN KEY (mentor_id) REFERENCES users(id),
    FOREIGN KEY (student_id) REFERENCES users(id)
);

-- Add mentor_feedback table for AI feedback storage
CREATE TABLE mentor_feedback (
    id SERIAL PRIMARY KEY,
    mentor_id INTEGER NOT NULL,
    student_id INTEGER NOT NULL,
    feedback TEXT NOT NULL,
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (mentor_id) REFERENCES users(id),
    FOREIGN KEY (student_id) REFERENCES users(id),
    UNIQUE (mentor_id, student_id)
);

CREATE TABLE quiz_results (
    id SERIAL PRIMARY KEY,
    quiz_id INTEGER NOT NULL,
    student_id INTEGER NOT NULL,
    is_passed BOOLEAN NOT NULL,
    attempted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (quiz_id) REFERENCES quizzes(id),
    FOREIGN KEY (student_id) REFERENCES users(id),
    UNIQUE (quiz_id, student_id)
);
