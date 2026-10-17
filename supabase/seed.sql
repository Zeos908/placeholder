-- 40 fake listings (10 per type) with mixed deadlines, locations, grades and tags.
-- All organizations are fictional. Rows are enriched=true with no images, so the
-- listings trigger queues an 'image' job for each one (§6.3).
-- Deadlines are relative to now() so the seed stays useful whenever it's loaded.

with raw (n, type, title, org, tags, loc, lat, lng, remote, gmin, gmax, due_days, comp, amount, summary, eligibility) as (
  values
  -- ---------- internships ----------
  (1,  'internship', 'Summer Rocketry Lab Intern', 'Orbital Youth Lab', '{stem,engineering,research}', 'Houston, TX', 29.7604, -95.3698, false, 11, 14, 5, '$18/hr', null,
       'Build and test model rocket payloads alongside lab engineers for eight weeks this summer.', 'Rising juniors through college sophomores; basic physics helpful.'),
  (2,  'internship', 'Junior Web Developer Intern', 'Brightline Studio', '{coding,media}', 'Remote', null, null, true, 12, 16, 12, '$20/hr', null,
       'Ship real features on a small product team using React and TypeScript, fully remote.', 'Some coding experience; portfolio or GitHub link encouraged.'),
  (3,  'internship', 'Hospital Patient Experience Intern', 'Lakeside Community Health', '{healthcare,community}', 'Chicago, IL', 41.8781, -87.6298, false, 11, 13, 2, 'Unpaid, school credit', null,
       'Shadow care teams and help improve how patients and families experience hospital visits.', 'Ages 16+; health clearance required.'),
  (4,  'internship', 'Climate Data Research Assistant', 'Greenfield Climate Institute', '{environment,science,research,coding}', 'Boston, MA', 42.3601, -71.0589, false, 13, 16, 25, '$19/hr', null,
       'Clean and map local climate data and present findings to the research team in August.', 'College students; Python or spreadsheets experience.'),
  (5,  'internship', 'Marketing & Social Media Intern', 'Corner Bakehouse Co.', '{business,media,writing}', 'Austin, TX', 30.2672, -97.7431, false, 11, 16, 9, '$15/hr', null,
       'Plan posts, shoot short videos, and track what works for a growing neighborhood bakery chain.', 'High school juniors and up.'),
  (6,  'internship', 'City Hall Policy Intern', 'Office of Civic Innovation', '{government,law,leadership}', 'New York, NY', 40.7128, -74.0060, false, 12, 16, 40, 'Stipend $1,500', 1500,
       'Research local policy questions and brief staff on what residents are asking for.', 'Seniors and college students; strong writing.'),
  (7,  'internship', 'Finance Analyst Summer Intern', 'Harborview Capital Partners', '{finance,business}', 'New York, NY', 40.7128, -74.0060, false, 14, 16, 60, '$28/hr', null,
       'Build models and market summaries with a small investment team over ten weeks.', 'College sophomores to seniors.'),
  (8,  'internship', 'Wildlife Rehab Intern', 'Cedar Ridge Wildlife Center', '{animals,environment,outdoors}', 'Atlanta, GA', 33.7490, -84.3880, false, 10, 16, null, 'Unpaid', null,
       'Care for injured native animals and help prepare them for release. Rolling applications.', 'Ages 15+; weekend availability.'),
  (9,  'internship', 'Game Design Intern', 'Pixel Harbor Games', '{coding,arts,media}', 'San Francisco, CA', 37.7749, -122.4194, false, 12, 16, 18, '$22/hr', null,
       'Prototype levels and playtest new mechanics with an indie studio for the summer.', 'Seniors and college students; any game-making experience.'),
  (10, 'internship', 'Legal Aid Clinic Intern', 'Northside Legal Aid', '{law,social-justice,community}', 'Chicago, IL', 41.8781, -87.6298, false, 13, 17, 30, '$17/hr', null,
       'Help a legal aid team prepare intake files and support residents at weekly clinics.', 'College students and grad students.'),

  -- ---------- volunteering ----------
  (11, 'volunteer', 'Riverside Cleanup Crew', 'Riverkeepers Alliance', '{environment,outdoors,community}', 'Austin, TX', 30.2672, -97.7431, false, 9, 17, 6, null, null,
       'Join a Saturday crew pulling trash and invasive plants from the river trail. Gloves provided.', 'All ages; under 16 with a guardian.'),
  (12, 'volunteer', 'Homework Help Tutor', 'Open Door Learning Center', '{tutoring,education,community}', 'New York, NY', 40.7128, -74.0060, false, 10, 17, null, null, null,
       'Tutor elementary students in reading and math two afternoons a week after school.', 'Grades 10+; background check for 18+.'),
  (13, 'volunteer', 'Animal Shelter Weekend Helper', 'Second Chance Paws', '{animals,community}', 'Atlanta, GA', 33.7490, -84.3880, false, 9, 17, 14, null, null,
       'Walk dogs, socialize cats, and help adoption events run smoothly on weekends.', 'Ages 14+.'),
  (14, 'volunteer', 'Virtual Coding Mentor', 'CodeBridge Youth', '{coding,tutoring,stem}', 'Remote', null, null, true, 11, 17, 21, null, null,
       'Mentor middle schoolers through their first Scratch and Python projects over video calls.', 'Comfortable with Python basics.'),
  (15, 'volunteer', 'Food Bank Packing Shifts', 'Harvest Table Food Bank', '{community,social-justice}', 'Chicago, IL', 41.8781, -87.6298, false, 9, 17, null, null, null,
       'Pack and sort food boxes for families in need; shifts every weekday evening.', 'All ages welcome.'),
  (16, 'volunteer', 'Hospital Volunteer Program', 'St. Brigid Medical Center', '{healthcare,community}', 'Boston, MA', 42.3601, -71.0589, false, 10, 16, 3, null, null,
       'Greet visitors, deliver supplies, and support nurses on non-clinical tasks.', 'Ages 15+; TB test and orientation required.'),
  (17, 'volunteer', 'Community Mural Painter', 'Eastside Arts Collective', '{arts,community}', 'San Francisco, CA', 37.7749, -122.4194, false, 9, 17, 10, null, null,
       'Help design and paint a neighborhood mural over three weekends this fall.', 'No art experience needed.'),
  (18, 'volunteer', 'Voter Registration Volunteer', 'Every Voice Civic Project', '{government,leadership,social-justice}', 'Remote', null, null, true, 11, 17, 8, null, null,
       'Phone-bank and text new voters with registration info from anywhere.', 'Ages 16+.'),
  (19, 'volunteer', 'Trail Restoration Weekend', 'High Country Trails', '{outdoors,environment,sports}', 'Denver, CO', 39.7392, -104.9903, false, 10, 17, 35, null, null,
       'Rebuild eroded hiking trails with a crew leader; camping and meals provided.', 'Ages 15+; moderate fitness.'),
  (20, 'volunteer', 'Senior Center Tech Buddy', 'Golden Years Center', '{community,education,coding}', 'Austin, TX', 30.2672, -97.7431, false, 9, 17, null, null, null,
       'Help older adults set up phones, video calls, and email in friendly one-on-one sessions.', 'Patience and basic phone skills.'),

  -- ---------- events ----------
  (21, 'event', 'City Youth Hackathon', 'HackTheCity', '{coding,stem,entrepreneurship}', 'New York, NY', 40.7128, -74.0060, false, 9, 16, 4, 'Free; prizes', null,
       'A 24-hour hackathon for students with mentors, workshops, food, and $5k in prizes.', 'Grades 9 through college.'),
  (22, 'event', 'College Essay Workshop', 'Pathway Admissions Lab', '{writing,education}', 'Remote', null, null, true, 11, 12, 7, 'Free', null,
       'Live online workshop on brainstorming and drafting a strong personal statement.', 'High school juniors and seniors.'),
  (23, 'event', 'Women in Engineering Day', 'Northeast Tech University', '{engineering,stem,leadership}', 'Boston, MA', 42.3601, -71.0589, false, 9, 12, 16, 'Free', null,
       'Hands-on labs, campus tours, and a panel of engineers sharing how they got started.', 'High school students.'),
  (24, 'event', 'Startup Pitch Night', 'Founders Garage', '{entrepreneurship,business}', 'San Francisco, CA', 37.7749, -122.4194, false, 11, 17, 11, '$10 ticket', null,
       'Watch student founders pitch, then network with local investors and mentors.', 'Ages 16+.'),
  (25, 'event', 'Youth Climate Summit', 'Greenfield Climate Institute', '{environment,leadership,government}', 'Chicago, IL', 41.8781, -87.6298, false, 9, 16, 28, 'Free', null,
       'A day of workshops on organizing climate projects at your school and in your city.', 'Grades 9 through college.'),
  (26, 'event', 'Medical School Open House', 'Midwest College of Medicine', '{healthcare,science}', 'Chicago, IL', 41.8781, -87.6298, false, 13, 17, 45, 'Free', null,
       'Tour simulation labs and hear from current med students about the path to medicine.', 'College students.'),
  (27, 'event', 'Poetry Slam Open Mic', 'Lantern Writers House', '{writing,arts,music}', 'Atlanta, GA', 33.7490, -84.3880, false, 9, 17, null, 'Free', null,
       'Monthly open mic for young poets and musicians. Sign up at the door.', 'All ages.'),
  (28, 'event', 'Robotics Build Weekend', 'Gearworks Makerspace', '{engineering,stem,coding}', 'Austin, TX', 30.2672, -97.7431, false, 9, 12, 2, '$25, scholarships available', null,
       'Build and program a small robot over one weekend; take it home at the end.', 'High school students; no experience needed.'),
  (29, 'event', 'Virtual Career Fair: Public Service', 'Civic Careers Network', '{government,law,community}', 'Remote', null, null, true, 13, 17, 20, 'Free', null,
       'Meet recruiters from public agencies and nonprofits hiring interns and new grads.', 'College and grad students.'),
  (30, 'event', 'Youth Orchestra Open Rehearsal', 'Bay Youth Symphony', '{music,arts}', 'San Francisco, CA', 37.7749, -122.4194, false, 9, 12, 13, 'Free', null,
       'Sit in on a rehearsal and meet section leaders before spring auditions.', 'High school musicians.'),

  -- ---------- scholarships ----------
  (31, 'scholarship', 'Future STEM Leaders Scholarship', 'Brightpath Foundation', '{stem,leadership}', 'Remote', null, null, true, 12, 12, 9, '$5,000', 5000,
       'A $5,000 award for seniors planning to study science, technology, engineering, or math.', 'High school seniors; 3.0+ GPA.'),
  (32, 'scholarship', 'Community Service Award', 'Neighbors United Fund', '{community,leadership}', 'Remote', null, null, true, 9, 12, 30, '$1,000', 1000,
       'Recognizes students who have led a service project in their community.', 'Grades 9–12; 50+ service hours.'),
  (33, 'scholarship', 'First-Gen College Scholarship', 'Open Gates Foundation', '{education,social-justice}', 'Remote', null, null, true, 12, 13, 21, '$2,500 renewable', 2500,
       'Renewable award for first-generation students heading to a two- or four-year college.', 'First in family to attend college.'),
  (34, 'scholarship', 'Young Writers Prize', 'Lantern Writers House', '{writing,arts}', 'Remote', null, null, true, 9, 12, 3, '$750', 750,
       'Submit a short story or essay up to 2,000 words for a cash prize and publication.', 'High school students.'),
  (35, 'scholarship', 'Healthcare Heroes Scholarship', 'Lakeside Community Health', '{healthcare,science}', 'Chicago, IL', 41.8781, -87.6298, false, 12, 16, 50, '$3,000', 3000,
       'Supports students pursuing nursing, pre-med, or public health at an Illinois college.', 'Illinois residents; seniors and college students.'),
  (36, 'scholarship', 'Women in Coding Scholarship', 'CodeBridge Youth', '{coding,stem}', 'Remote', null, null, true, 12, 16, 15, '$4,000', 4000,
       'Award plus a summer mentor for women and nonbinary students studying computing.', 'Seniors and college students.'),
  (37, 'scholarship', 'Environmental Stewardship Grant', 'Riverkeepers Alliance', '{environment,research,outdoors}', 'Remote', null, null, true, 10, 16, 75, 'Up to $2,000', 2000,
       'Project grant for students who propose a local environmental improvement project.', 'Grades 10 through college.'),
  (38, 'scholarship', 'Young Entrepreneurs Award', 'Founders Garage', '{entrepreneurship,business,finance}', 'Remote', null, null, true, 10, 14, 26, '$2,000', 2000,
       'For students who have started a business, club, or product. Include a short pitch video.', 'Grades 10 through college year 2.'),
  (39, 'scholarship', 'Arts & Music Merit Scholarship', 'Bay Youth Symphony', '{music,arts}', 'San Francisco, CA', 37.7749, -122.4194, false, 11, 12, 40, '$1,500', 1500,
       'Merit award for student artists and musicians; submit a portfolio or recording.', 'High school juniors and seniors.'),
  (40, 'scholarship', 'Student Athlete Scholar Award', 'Hometown Sports League', '{sports,leadership,education}', 'Remote', null, null, true, 12, 12, null, '$1,000', 1000,
       'Recognizes senior athletes who balance sports, grades, and community involvement. Rolling.', 'High school seniors on a school team.')
)
insert into listings (
  source, source_id, url, title, org_name, type, description, summary, tags,
  location_text, lat, lng, is_remote, grade_min, grade_max, eligibility_text,
  deadline, starts_at, compensation_text, amount_usd, enriched, dedupe_hash, created_at
)
select
  'seed',
  'seed-' || lpad(n::text, 2, '0'),
  'https://example.com/opportunities/' || n,
  title, org, type::opp_type,
  summary || E'\n\n' || 'Eligibility: ' || eligibility
    || E'\n\nThis is sample data for development; the organization is fictional.',
  summary,
  tags::text[],
  loc, lat, lng, remote, gmin, gmax, eligibility,
  case when due_days is null then null
       else date_trunc('hour', now()) + make_interval(days => due_days) + interval '23 hours 59 minutes' end,
  case when type = 'event' and due_days is not null
       then date_trunc('day', now()) + make_interval(days => due_days + 3) + interval '10 hours' end,
  comp, amount,
  true,
  encode(sha256(convert_to(lower(title) || '|' || lower(org) || '|' || 'https://example.com/opportunities/' || n, 'UTF8')), 'hex'),
  -- Stagger created_at over the last two weeks so freshness varies.
  now() - make_interval(hours => (n * 7) % 330)
from raw
on conflict (source, source_id) do nothing;
