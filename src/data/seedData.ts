import { CorporateTrainer, ServiceDivision, TutorProfile } from '../types';

export const HERO_IMAGE_URL = '/src/assets/images/hero_tutorbridge_addis_1794897038110.jpg';
export const CORPORATE_HERO_IMAGE_URL =
  '/src/assets/images/corporate_training_addis_1794899645732.jpg';

export const SEED_TUTORS: TutorProfile[] = [
  {
    id: 'seed_tutor_dawit',
    userId: 'seed_user_dawit',
    fullName: 'Dawit Tadesse',
    headline: 'M.Sc. Physics & Senior Mathematics Educator',
    bio: 'Eight years preparing Addis Ababa secondary students for Grade 12 national examinations and university entrance mathematics and physics. Focuses on step-by-step problem solving and exam confidence.',
    photoUrl: '/src/assets/images/tutor_portrait_dawit_1794897037526.jpg',
    qualifications: 'M.Sc. in Applied Physics, Addis Ababa University; Certified Secondary Teacher',
    experienceYears: 8,
    division: 'Academic Tutoring',
    subjects: ['Mathematics', 'Physics', 'National Exam Prep'],
    grades: ['Secondary (Grades 9–12)', 'National Exam Prep (Grade 12)', 'University Level'],
    city: 'Addis Ababa',
    subCities: ['Bole', 'Yeka', 'Kirkos'],
    hourlyRateEtb: 650,
    availabilityDays: ['Monday', 'Wednesday', 'Friday', 'Saturday'],
    languages: ['Amharic', 'English'],
    ratingAvg: 4.9,
    reviewCount: 28,
    status: 'approved',
    isVerified: true,
  },
  {
    id: 'seed_tutor_mekdes',
    userId: 'seed_user_mekdes',
    fullName: 'Mekdes Alemu',
    headline: 'Bilingual English, Amharic & Academic Writing Specialist',
    bio: 'Experienced language instructor helping international-school learners, local primary students, and adult professionals strengthen reading comprehension, public speaking, and academic writing.',
    photoUrl: '/src/assets/images/tutor_portrait_mekdes_1794897038310.jpg',
    qualifications: 'M.A. in Teaching English as a Foreign Language (TEFL), Addis Ababa University',
    experienceYears: 6,
    division: 'Languages & Personal Development',
    subjects: ['English', 'Amharic', 'Public Speaking', 'Communication Skills'],
    grades: ['Primary (Grades 1–6)', 'Middle (Grades 7–8)', 'Secondary (Grades 9–12)', 'Adult / Professional'],
    city: 'Addis Ababa',
    subCities: ['Bole', 'Lideta', 'Kirkos', 'Lemi Kura'],
    hourlyRateEtb: 550,
    availabilityDays: ['Tuesday', 'Thursday', 'Saturday', 'Sunday'],
    languages: ['English', 'Amharic', 'Afaan Oromo'],
    ratingAvg: 4.9,
    reviewCount: 21,
    status: 'approved',
    isVerified: true,
  },
  {
    id: 'seed_tutor_yohannes',
    userId: 'seed_user_yohannes',
    fullName: 'Yohannes Bekele',
    headline: 'Software Engineering & Practical Digital Skills Instructor',
    bio: 'Full-stack software engineer teaching Python programming, web development, Microsoft Office, and graphic design fundamentals through hands-on local project portfolios.',
    photoUrl: '/src/assets/images/tutor_portrait_yohannes_1794897038908.jpg',
    qualifications: 'B.Sc. in Computer Science, Addis Ababa Institute of Technology (AAiT)',
    experienceYears: 5,
    division: 'Professional & Practical Skills',
    subjects: ['Programming', 'Web Development', 'Computer Fundamentals', 'Microsoft Office'],
    grades: ['Secondary (Grades 9–12)', 'University Level', 'Adult / Professional'],
    city: 'Addis Ababa',
    subCities: ['Arada', 'Yeka', 'Bole', 'Gulele'],
    hourlyRateEtb: 750,
    availabilityDays: ['Monday', 'Tuesday', 'Thursday', 'Saturday'],
    languages: ['Amharic', 'English'],
    ratingAvg: 4.8,
    reviewCount: 16,
    status: 'approved',
    isVerified: true,
  },
  {
    id: 'seed_tutor_selamawit',
    userId: 'seed_user_selamawit',
    fullName: 'Selamawit Girma',
    headline: 'Kindergarten & Primary Foundational Numeracy & Literacy Mentor',
    bio: 'Patient early-childhood and primary education specialist supporting Grades 1–6 students with foundational mathematics, science curiosity, study habits, and homework structure.',
    photoUrl: '/src/assets/images/tutor_portrait_selamawit_1794897040467.jpg',
    qualifications: 'B.Ed. in Primary Education & Child Development, Kotebe University of Education',
    experienceYears: 9,
    division: 'Academic Tutoring',
    subjects: ['Kindergarten', 'Primary Mathematics', 'Biology', 'Study Skills'],
    grades: ['Kindergarten', 'Primary (Grades 1–6)', 'Middle (Grades 7–8)'],
    city: 'Addis Ababa',
    subCities: ['Nifas Silk-Lafto', 'Lideta', 'Kirkos', 'Bole'],
    hourlyRateEtb: 500,
    availabilityDays: ['Monday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    languages: ['Amharic', 'English'],
    ratingAvg: 5.0,
    reviewCount: 34,
    status: 'approved',
    isVerified: true,
  },
];

export const SEED_CORPORATE_TRAINERS: CorporateTrainer[] = [
  {
    id: 'seed_corp_yohannes',
    userId: 'seed_user_yohannes',
    fullName: 'Yohannes Bekele',
    headline: 'Enterprise IT, Cloud Productivity & Data Automation Lead Trainer',
    bio: 'Corporate systems architect and technical facilitator specializing in hands-on Excel automation, enterprise IT support, database fundamentals, and cybersecurity awareness for banks, NGOs, and logistics firms.',
    photoUrl: '/src/assets/images/tutor_portrait_yohannes_1794897038908.jpg',
    qualifications: 'B.Sc. Computer Science (AAiT); Microsoft Certified Trainer; AWS Cloud Practitioner',
    certifications: [
      'Microsoft Certified Trainer (MCT)',
      'AWS Certified Cloud Practitioner',
      'CompTIA Security+ Awareness Instructor',
    ],
    workExperience:
      '7+ years delivering technical capacity-building cohorts for commercial banks, international NGOs, and telecom teams across Addis Ababa.',
    experienceYears: 7,
    categories: ['Digital Literacy', 'Information Technology'],
    topics: [
      'Excel and data management',
      'Microsoft Office',
      'Cybersecurity awareness',
      'Database fundamentals',
      'Cloud computing',
      'IT support',
    ],
    pastProjects: [
      'Financial Modeling & Excel Automation Bootcamp (120 commercial staff, 2024)',
      'NGO Cybersecurity & Cloud Hygiene Rollout (45 field coordinators, 2025)',
    ],
    portfolioSamples: [
      '3-Day Applied Excel & Power Query Curriculum Pack',
      'Enterprise Phishing & Zero-Trust Workshop Playbook',
    ],
    methodology:
      'Interactive lab-based workshops combining Ethiopian enterprise datasets, guided troubleshooting drills, and pre/post practical competency assessments.',
    availability: 'Weekdays & Saturdays (Full-day or modular half-day blocks)',
    preferredLocations: ['Bole', 'Kirkos', 'Yeka', 'Arada'],
    languages: ['Amharic', 'English'],
    ratingAvg: 4.9,
    reviewCount: 14,
    proposedDailyRateEtb: 8500,
    isTutorAlso: true,
    status: 'approved',
    isVerified: true,
  },
  {
    id: 'seed_corp_mekdes',
    userId: 'seed_user_mekdes',
    fullName: 'Mekdes Alemu',
    headline: 'Executive Communication, Leadership & Business Writing Facilitator',
    bio: 'Bilingual corporate communications specialist equipping managers, customer-facing teams, and development professionals with persuasive reporting, presentation confidence, and stakeholder facilitation skills.',
    photoUrl: '/src/assets/images/tutor_portrait_mekdes_1794897038310.jpg',
    qualifications: 'M.A. TEFL (Addis Ababa University); Certified Workplace Communication Coach',
    certifications: [
      'Certified Corporate Facilitation Specialist',
      'ICF-Aligned Leadership Coaching Foundations',
      'Business English & Executive Reporting Credential',
    ],
    workExperience:
      '8 years facilitating leadership retreats, donor-report writing clinics, and client communication programs for UN agencies, schools, and private enterprises.',
    experienceYears: 8,
    categories: ['Professional Development', 'Marketing and Business'],
    topics: [
      'Leadership',
      'Communication',
      'Public speaking',
      'Customer service',
      'Teamwork',
      'Management',
    ],
    pastProjects: [
      'Executive Presentation & Donor Proposal Clinic (60 NGO program leads, 2024)',
      'Service Excellence & Bilingual Client Communication Cohort (85 hospitality staff, 2025)',
    ],
    portfolioSamples: [
      '2-Day Executive Communication & Briefing Lab',
      'Structured Customer Service Escalation & Empathy Workbook',
    ],
    methodology:
      'Role-play simulations, recorded mini-presentations with rubric feedback, and real workplace document editing labs.',
    availability: 'Tuesday – Saturday (On-site Addis Ababa or Regional Hubs)',
    preferredLocations: ['Bole', 'Kirkos', 'Lideta', 'Lemi Kura'],
    languages: ['English', 'Amharic', 'Afaan Oromo'],
    ratingAvg: 4.9,
    reviewCount: 19,
    proposedDailyRateEtb: 7500,
    isTutorAlso: true,
    status: 'approved',
    isVerified: true,
  },
  {
    id: 'seed_corp_dawit',
    userId: 'seed_user_dawit',
    fullName: 'Dawit Tadesse',
    headline: 'Quantitative Analytics, Operations & Project Control Trainer',
    bio: 'Applied physicist and quantitative trainer translating complex data analysis, KPI tracking, and structured project management into practical daily workflows for institutional teams.',
    photoUrl: '/src/assets/images/tutor_portrait_dawit_1794897037526.jpg',
    qualifications: 'M.Sc. Applied Physics (AAU); Project Management & Statistical Quality Instructor',
    certifications: [
      'Project Management Professional (PMP) Prep Facilitator',
      'Applied Business Analytics & KPI Design Certificate',
    ],
    workExperience:
      '9 years coaching technical departments, university administrative teams, and manufacturing supervisors on structured problem solving and reporting.',
    experienceYears: 9,
    categories: ['Digital Literacy', 'Professional Development'],
    topics: [
      'Project management',
      'Time management',
      'Excel and data management',
      'Digital productivity',
      'Management',
    ],
    pastProjects: [
      'Operational KPI Dashboards & Project Scheduling Workshop (50 engineers, 2024)',
      'University Quality Assurance & Data Reporting Seminar (35 coordinators, 2025)',
    ],
    portfolioSamples: [
      'Project Milestones, Risk Register & Resource Allocation Toolkit',
      'Practical Statistical Tracking Workbook for Operations Teams',
    ],
    methodology:
      'Case-study sprints anchored in participants’ actual quarterly deliverables, ending with actionable 30-day team templates.',
    availability: 'Monday, Wednesday, Friday & Weekends',
    preferredLocations: ['Bole', 'Yeka', 'Kirkos', 'Nifas Silk-Lafto'],
    languages: ['Amharic', 'English'],
    ratingAvg: 4.8,
    reviewCount: 11,
    proposedDailyRateEtb: 8000,
    isTutorAlso: true,
    status: 'approved',
    isVerified: true,
  },
  {
    id: 'seed_corp_selamawit',
    userId: 'seed_user_selamawit',
    fullName: 'Selamawit Girma',
    headline: 'Educator Pedagogy, Digital Literacy & Workplace Inclusion Specialist',
    bio: 'Seasoned curriculum designer and institutional trainer partnering with schools, early-learning networks, and SMEs on digital productivity, collaborative teamwork, and structured instructional coaching.',
    photoUrl: '/src/assets/images/tutor_portrait_selamawit_1794897040467.jpg',
    qualifications: 'B.Ed. Education (Kotebe University); M.Ed. Curriculum Design (In Progress)',
    certifications: [
      'Certified Institutional Instructional Designer',
      'Google Workspace & Digital Classroom Productivity Trainer',
    ],
    workExperience:
      '10 years leading faculty development workshops across private academies and community education NGOs in Addis Ababa.',
    experienceYears: 10,
    categories: ['Digital Literacy', 'Professional Development', 'Creative and Technical Skills'],
    topics: [
      'Basic computer skills',
      'Digital productivity',
      'Online safety',
      'Teamwork',
      'Content creation',
      'Communication',
    ],
    pastProjects: [
      'School-Wide Digital Productivity & Assessment Modernization (90 teachers, 2024)',
      'SME Administrative Onboarding & Office Tools Bootcamp (30 staff, 2025)',
    ],
    portfolioSamples: [
      'Staff Digital Readiness & Safe Collaboration Curriculum',
      'Team Facilitation & Structured Lesson Observation Rubric',
    ],
    methodology:
      'Participatory micro-workshops, peer coaching circles, and step-by-step job aids designed for rapid workplace adoption.',
    availability: 'Weekdays & Saturdays',
    preferredLocations: ['Nifas Silk-Lafto', 'Lideta', 'Bole', 'Kirkos'],
    languages: ['Amharic', 'English'],
    ratingAvg: 5.0,
    reviewCount: 17,
    proposedDailyRateEtb: 7000,
    isTutorAlso: true,
    status: 'approved',
    isVerified: true,
  },
];


export const DIVISION_CARDS: {
  index: string;
  division: ServiceDivision;
  summary: string;
  subjects: string[];
}[] = [
  {
    index: '01.',
    division: 'Academic Tutoring',
    summary:
      'Structured support from Kindergarten through Grade 12 national examination prep and university courses.',
    subjects: ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'English', 'Amharic', 'Exam Prep'],
  },
  {
    index: '02.',
    division: 'Languages & Personal Development',
    summary:
      'Fluency, academic writing, public speaking, and disciplined study habits for learners of all ages.',
    subjects: ['English', 'Amharic', 'Afaan Oromo', 'Public Speaking', 'Communication', 'Study Skills'],
  },
  {
    index: '03.',
    division: 'Professional & Practical Skills',
    summary:
      'Career-ready in-person coaching in software, office productivity, design, finance, and music.',
    subjects: ['Programming', 'Web Development', 'Graphic Design', 'Video Editing', 'Accounting', 'Music'],
  },
  {
    index: '04.',
    division: 'Corporate & Organizational Training',
    summary:
      'Customized short-term and multi-week staff capacity-building programs for companies, NGOs, government institutions, schools, and SMEs.',
    subjects: ['Digital Literacy', 'Information Technology', 'Marketing & Business', 'Leadership', 'Creative Tech'],
  },
];

export const CORPORATE_TRAINING_CATEGORIES = [
  {
    code: 'A',
    name: 'Digital Literacy',
    topics: [
      'Basic computer skills',
      'Microsoft Office',
      'Excel and data management',
      'Internet and email',
      'Digital communication',
      'Online safety',
      'Digital productivity',
    ],
  },
  {
    code: 'B',
    name: 'Information Technology',
    topics: [
      'IT support',
      'Computer maintenance',
      'Networking',
      'Database fundamentals',
      'Programming',
      'Cloud computing',
      'Cybersecurity awareness',
    ],
  },
  {
    code: 'C',
    name: 'Marketing and Business',
    topics: [
      'Digital marketing',
      'Social media management',
      'Branding',
      'Sales',
      'Customer service',
      'Business development',
      'Marketing strategy',
    ],
  },
  {
    code: 'D',
    name: 'Professional Development',
    topics: [
      'Leadership',
      'Management',
      'Teamwork',
      'Communication',
      'Project management',
      'Time management',
      'Public speaking',
    ],
  },
  {
    code: 'E',
    name: 'Creative and Technical Skills',
    topics: [
      'Graphic design',
      'Video editing',
      'Photography',
      'Content creation',
      'Motion graphics',
      'Web design',
      'AI productivity tools',
    ],
  },
];

export const CORPORATE_WORKFLOW_STEPS = [
  '01. Organization registers and creates its institutional profile.',
  '02. Organization submits a training request with topics, participant count, dates, and budget.',
  '03. TutorBridge reviews objectives and identifies verified professional trainers.',
  '04. Trainers confirm availability and submit methodology.',
  '05. TutorBridge sends a trainer proposal and itemized quotation.',
  '06. Organization approves the proposal and quotation, establishing a training contract.',
  '07. Trainer delivers sessions at your premises or chosen venue with attendance tracking.',
  '08. Organization receives the completion report, invoice receipt, and submits feedback.',
];

export const TESTIMONIALS = [
  {
    quote:
      'Within two months of twice-weekly physics sessions in Bole, our son moved from struggling on mock tests to scoring 88% on his Grade 12 preparatory exam.',
    name: 'Rahel Tesfaye',
    role: 'Parent of Grade 12 Student',
    location: 'Bole, Addis Ababa',
  },
  {
    quote:
      'We used Managed Matching because we needed an Amharic-and-English speaking primary tutor near Old Airport. TutorBridge verified her degree and sent us weekly progress notes.',
    name: 'Dr. Bereket Haile',
    role: 'Parent of Grade 4 Student',
    location: 'Nifas Silk-Lafto, Addis Ababa',
  },
  {
    quote:
      'Having transparent 15% commission and confirmed Telebirr payments lets me focus entirely on preparing quality lessons for my students across Yeka and Arada.',
    name: 'Dawit Tadesse',
    role: 'Verified Physics & Math Educator',
    location: 'Yeka, Addis Ababa',
  },
];

export const FAQS = [
  {
    question: 'How does TutorBridge verify tutors and corporate trainers?',
    answer:
      'Every individual tutor and corporate trainer submits a valid national ID, academic or professional qualifications, undergoes competency and experience verification, and receives administrator approval before taking assignments.',
  },
  {
    question: 'Can companies, NGOs, and government offices request customized staff training?',
    answer:
      'Yes. Through Division 4 (Corporate & Organizational Training), organizations can register an account, submit a training request across Digital Literacy, IT, Marketing & Business, Leadership, or Creative Tech, and receive customized trainer proposals and itemized quotations.',
  },
  {
    question: 'How do itemized corporate quotations work?',
    answer:
      'Every corporate quotation transparently breaks down trainer compensation, logistical expenses, and TutorBridge service fees based on program duration, participant numbers, subject complexity, and venue.',
  },
  {
    question: 'How do Telebirr, CBE Birr, and Bank Transfer payments work?',
    answer:
      'For both individual tutoring bookings and corporate training invoices, you submit your Telebirr, CBE Birr, or bank transfer reference inside your dashboard, and TutorBridge verifies the transaction and records receipts.',
  },
];
