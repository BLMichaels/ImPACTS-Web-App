-- Create users table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    hospital_name VARCHAR(255),
    role VARCHAR(50) NOT NULL DEFAULT 'user',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create activity_categories table (for admin configuration)
CREATE TABLE activity_categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create simulation_types table (for admin configuration)
CREATE TABLE simulation_types (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create feedback_form_types table
CREATE TABLE feedback_form_types (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create activities table
CREATE TABLE activities (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    date DATE NOT NULL,
    activity_note TEXT NOT NULL,
    category_id INTEGER REFERENCES activity_categories(id),
    hours DECIMAL(4,2) NOT NULL,
    simulation_type_id INTEGER REFERENCES simulation_types(id),
    simulation_participants INTEGER,
    feedback_forms_submitted_id INTEGER REFERENCES feedback_form_types(id),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create hospital_contacts table
CREATE TABLE hospital_contacts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    name VARCHAR(255) NOT NULL,
    role VARCHAR(100),
    department VARCHAR(100),
    email VARCHAR(255),
    phone VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create prs_scores table
CREATE TABLE prs_scores (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    assessment_date DATE NOT NULL,
    score DECIMAL(5,2) NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create milestones table
CREATE TABLE milestones (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    completed BOOLEAN DEFAULT false,
    due_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create milestone_categories table
CREATE TABLE milestone_categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    display_order INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create milestone_items table
CREATE TABLE milestone_items (
    id SERIAL PRIMARY KEY,
    category_id INTEGER REFERENCES milestone_categories(id),
    title TEXT NOT NULL,
    description TEXT,
    link_url TEXT,
    link_text VARCHAR(255),
    display_order INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create user_milestones table to track completion status
CREATE TABLE user_milestones (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    milestone_item_id INTEGER REFERENCES milestone_items(id),
    completed BOOLEAN DEFAULT false,
    completed_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, milestone_item_id)
);

-- Insert default activity categories
INSERT INTO activity_categories (name) VALUES
    ('General Administration Tasks'),
    ('PECC role education and advancement'),
    ('Meeting with Pediatric Readiness Mentor'),
    ('Simulation Case Preparations'),
    ('Simulation Facilitation'),
    ('Hospital-based Pediatric Educational Activities (NOT including simulation)'),
    ('Ensuring all Pediatric Policies and Procedures are implemented and updated'),
    ('Facilitating and participating in ED pediatric QI/PI activities'),
    ('Collaborative work with PECC counterpart, EMS, or other EDs'),
    ('Staffing competency evaluations'),
    ('Promoting pediatric disaster preparedness'),
    ('Promoting patient and family education in injury prevention'),
    ('Ensuring equipment, medication, and supplies are available to all ED staff'),
    ('Ensuring ED staff are prepared to care for all children, including those with special health needs');

-- Insert default simulation types
INSERT INTO simulation_types (name) VALUES
    ('Agitation'),
    ('Altered Mental Status'),
    ('Anaphylaxis'),
    ('Asthma/Child with a Wheeze'),
    ('Bronchiolitis/Respiratory Distress'),
    ('Newborn Resuscitation'),
    ('Pediatric Trauma/Abdominal'),
    ('Postpartum Hemmorhage'),
    ('Scald Burn'),
    ('Seizing Child'),
    ('Seizing Infant'),
    ('Severe Head Trauma'),
    ('Sick Neonate'),
    ('Vomiting Infant'),
    ('Other');

-- Insert feedback form types
INSERT INTO feedback_form_types (name) VALUES
    ('Facilitator Form'),
    ('Participant Form'),
    ('BOTH Facilitator & Participant Forms');

-- Insert milestone categories
INSERT INTO milestone_categories (name, display_order) VALUES
    ('Administration & Coordination', 1);

-- Insert milestone items for Administration & Coordination
INSERT INTO milestone_items (category_id, title, description, link_url, link_text, display_order) VALUES
    ((SELECT id FROM milestone_categories WHERE name = 'Administration & Coordination'), 
    'Reach out and contact your ED nursing leadership (manager, educator, director) and physician partners (medical director)',
    NULL,
    'https://example.com/email-template',
    'Email template',
    1),
    
    ((SELECT id FROM milestone_categories WHERE name = 'Administration & Coordination'),
    'Share information about Pediatric Readiness with the ED',
    NULL,
    'https://example.com/joint-policy',
    'Joint Policy Statement',
    2),
    
    ((SELECT id FROM milestone_categories WHERE name = 'Administration & Coordination'),
    NULL,
    NULL,
    'https://example.com/readiness-assessment',
    'Pediatric Readiness Assessment',
    3),
    
    ((SELECT id FROM milestone_categories WHERE name = 'Administration & Coordination'),
    NULL,
    NULL,
    'https://example.com/saves-lives',
    'Pediatric Readiness Saves Lives',
    4),
    
    ((SELECT id FROM milestone_categories WHERE name = 'Administration & Coordination'),
    NULL,
    NULL,
    'https://example.com/pecc-importance',
    'Importance of the PECC',
    5),
    
    ((SELECT id FROM milestone_categories WHERE name = 'Administration & Coordination'),
    'Identify PECC or champion and sign community',
    NULL,
    'https://example.com/commitment-letter',
    'ED commitment letter',
    6),
    
    ((SELECT id FROM milestone_categories WHERE name = 'Administration & Coordination'),
    'Review',
    NULL,
    'https://example.com/job-description',
    'PECC Job Description',
    7),
    
    ((SELECT id FROM milestone_categories WHERE name = 'Administration & Coordination'),
    'Identify',
    NULL,
    'https://example.com/eiic',
    'EIIC website',
    8),
    
    ((SELECT id FROM milestone_categories WHERE name = 'Administration & Coordination'),
    'Review',
    'Review EIIC modules on 7 domains of pediatric readiness',
    'https://example.com/eiic-modules',
    'EIIC modules',
    9),
    
    ((SELECT id FROM milestone_categories WHERE name = 'Administration & Coordination'),
    'Choose date(s) and time for first in situ simulation in ED',
    'Minimum 1 team will run through 1 simulation',
    NULL,
    NULL,
    10),
    
    ((SELECT id FROM milestone_categories WHERE name = 'Administration & Coordination'),
    'Review',
    NULL,
    'https://example.com/sim-guide',
    'Simulation/Education Guide',
    11),
    
    ((SELECT id FROM milestone_categories WHERE name = 'Administration & Coordination'),
    'Review sim case you will be running (if needed) and assign roles',
    NULL,
    NULL,
    NULL,
    12),
    
    ((SELECT id FROM milestone_categories WHERE name = 'Administration & Coordination'),
    'Review technology for day of sim (internet, computer(s), speakers, external monitor, etc.)',
    NULL,
    NULL,
    NULL,
    13),
    
    ((SELECT id FROM milestone_categories WHERE name = 'Administration & Coordination'),
    'Complete',
    '(PRS) on ED site',
    'https://example.com/readiness-score',
    'Pediatric Readiness Score',
    14),
    
    ((SELECT id FROM milestone_categories WHERE name = 'Administration & Coordination'),
    'Complete in situ',
    'in the ED staff (at least 1 team participating in 1 sim)',
    'https://example.com/simbox',
    'SimBox',
    15),
    
    ((SELECT id FROM milestone_categories WHERE name = 'Administration & Coordination'),
    'Complete associated Facilitator checklist with that scenario and encourage all participants to complete participant survey in order to receive simulation report out',
    NULL,
    NULL,
    NULL,
    16),
    
    ((SELECT id FROM milestone_categories WHERE name = 'Administration & Coordination'),
    'Schedule additional in situ SimBox dates quarterly',
    NULL,
    NULL,
    NULL,
    17),
    
    ((SELECT id FROM milestone_categories WHERE name = 'Administration & Coordination'),
    'Review PRS gaps and update your gap tracker',
    NULL,
    NULL,
    NULL,
    18),
    
    ((SELECT id FROM milestone_categories WHERE name = 'Administration & Coordination'),
    'Choose at least 1 gap to address over the next 3 months, and locate resources on',
    'under each domain',
    'https://example.com/impacts',
    'ImPACTS Website',
    19);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_activities_updated_at
    BEFORE UPDATE ON activities
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_hospital_contacts_updated_at
    BEFORE UPDATE ON hospital_contacts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_prs_scores_updated_at
    BEFORE UPDATE ON prs_scores
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_milestones_updated_at
    BEFORE UPDATE ON milestones
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_milestones_updated_at
    BEFORE UPDATE ON user_milestones
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column(); 