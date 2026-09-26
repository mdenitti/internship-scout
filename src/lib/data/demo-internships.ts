import type { InternshipCandidate } from '@/lib/domain/types';

/**
 * Demo catalogue.
 *
 * These records exist so the dashboard, filters and evaluation flow are immediately usable
 * without a network. They are deliberately realistic (mixed company types, work modes,
 * missing fields, deadlines) and are flagged as demo data when imported, which makes them
 * easy to spot and remove with one click (`DELETE /api/seed`).
 *
 * They are *not* test fixtures: unit tests build their own records.
 */

export interface DemoCandidateSeed extends InternshipCandidate {
  /** How long ago this opportunity was "discovered", so the demo data stays fresh. */
  discoveredDaysAgo: number;
}

export const DEMO_CANDIDATES: DemoCandidateSeed[] = [
  {
    discoveredDaysAgo: 14,
    title: 'Internship Full-stack Developer (React / Node.js)',
    company: 'Studio Kempen',
    url: 'https://www.example-devshop.be/jobs/fullstack-internship?utm_source=demo&utm_campaign=spring',
    source: 'demo',
    location: 'Hasselt, Limburg, Belgium',
    technologies: ['TypeScript', 'React', 'Node.js', 'Next.js', 'PostgreSQL'],
    description:
      'Studio Kempen is a 24-person development agency in Hasselt building web platforms for regional clients in logistics and healthcare. You join a squad of four developers and work on a production React/TypeScript codebase from day one. Expect code reviews twice a week, a personal mentor and your own feature area by week three. A thesis internship is possible, where you research and ship an accessibility tooling improvement. Internship allowance of 750 euro per month plus travel expenses.',
    compensation: '€750 / month',
    duration: '12 weeks',
    workMode: 'hybrid',
    internshipType: 'software development',
    companyType: 'devshop',
  },
  {
    discoveredDaysAgo: 21,
    title: 'Stage Software Engineering — Java & Angular',
    company: 'Ventus Logics',
    url: 'https://ventus-logics.example.com/careers/stage-software-engineering',
    source: 'demo',
    location: 'Leuven, Flanders, Belgium',
    technologies: ['Java', 'Angular', 'Spring Boot', 'SQL', 'Docker'],
    description:
      'Ventus Logics builds planning software for the manufacturing industry. As an intern you take ownership of a well scoped module in our scheduling engine and present it to the engineering guild at the end of your internship. The team works in two week sprints with a strong emphasis on automated tests. Dutch is useful but not required: the documentation is in English.',
    duration: '16 weeks',
    workMode: 'hybrid',
    internshipType: 'software development',
    companyType: 'software company',
  },
  {
    discoveredDaysAgo: 28,
    title: 'Remote Internship Frontend Engineer (Vue + TypeScript)',
    company: 'Driftless Labs',
    url: 'https://driftless.example.io/hiring/frontend-intern?ref=jobboard',
    source: 'demo',
    location: 'Remote (Europe)',
    technologies: ['Vue', 'TypeScript', 'Tailwind CSS', 'Vite'],
    description:
      'Fully remote four month internship at a product startup of eleven people. You build dashboards used by logistics customers. We work asynchronously with written update documents, so you need to be comfortable asking questions in writing. Small monthly stipend, hardware provided, flexible university schedule.',
    compensation: '€500 / month',
    duration: '4 months',
    workMode: 'remote',
    internshipType: 'software development',
    companyType: 'startup',
  },
  {
    discoveredDaysAgo: 21,
    title: 'Stage Web Development PHP / Laravel',
    company: 'Meulen Technologies',
    url: 'https://meulen-tech.example.be/vacatures/stage-php-laravel',
    source: 'demo',
    location: 'Genk, Limburg, Belgium',
    technologies: ['PHP', 'Laravel', 'MySQL', 'JavaScript'],
    description:
      'Our in-house Laravel application administrates maintenance planning for 400 field engineers. You help migrate legacy modules to Laravel 11, write feature tests and improve release automation. Our lead developer reviews every pull request within a day. A good fit for students who want to understand the full stack rather than only the frontend.',
    workMode: 'onsite',
    internshipType: 'software development',
    companyType: 'software company',
    duration: '14 weeks',
    compensation: '€600 / month',
  },
  {
    discoveredDaysAgo: 38,
    title: 'Internship Data & AI — machine learning for manufacturing',
    company: 'Flanders Institute for Smart Industry',
    url: 'https://fisi.example.be/en/internships/data-ai-machine-learning',
    source: 'demo',
    location: 'Diepenbeek, Limburg, Belgium',
    technologies: ['Python', 'Machine Learning', 'SQL', 'Docker'],
    description:
      'Research driven internship in a public-private lab. You work with production datasets from metal processing companies to detect tool wear from sensor data. Strong guidance from a PhD researcher, publication is possible and encouraged. A thesis friendly internship for students in computer science or engineering.',
    duration: '5 months',
    workMode: 'onsite',
    internshipType: 'data & AI',
    companyType: 'research',
  },
  {
    discoveredDaysAgo: 14,
    title: 'Internship DevOps / Platform Engineering',
    company: 'Streamline Commerce',
    url: 'https://streamline.example.nl/jobs/internship-devops',
    source: 'demo',
    location: 'Eindhoven, North Brabant, Netherlands',
    technologies: ['Kubernetes', 'Docker', 'Terraform', 'AWS', 'Go'],
    description:
      'Help our platform team reduce deployment lead time from one hour to ten minutes. You work with Kubernetes, GitHub Actions and Terraform, and you are encouraged to automate yourself out of repetitive work. Hybrid: two days in the Eindhoven office, three days from wherever you work best.',
    workMode: 'hybrid',
    internshipType: 'devops & cloud',
    companyType: 'software company',
    duration: '6 months',
    compensation: '€900 / month',
  },
  {
    discoveredDaysAgo: 21,
    title: 'Stage functionele analyse bij een overheidsdienst',
    company: 'Provincie Dienst Digitale Zaken',
    url: 'https://overheid.example.be/stages/functionele-analyse-digitale-diensten',
    source: 'demo',
    location: 'Hasselt, Limburg, Belgium',
    technologies: ['SQL'],
    description:
      'The digital services department is digitising permit applications. As an intern you map existing processes, write user stories and help test the new portal. A good fit for students who want to understand how public services work, with little to no programming involved.',
    workMode: 'hybrid',
    internshipType: 'business analysis',
    companyType: 'government',
    duration: '10 weeks',
  },
  {
    discoveredDaysAgo: 38,
    title: 'Internship Backend Development C# / .NET',
    company: 'Nordwind Group',
    url: 'https://nordwind.example.com/en/careers/internship-backend-dotnet',
    source: 'demo',
    location: 'Antwerp, Flanders, Belgium',
    technologies: ['C#', '.NET', 'Azure', 'SQL Server'],
    description:
      'Large logistics group with 4.000 employees. The internship sits in a product team maintaining order intake services used across twelve countries. You get a real backlog slice, a buddy and access to an internal training catalogue. Structured programme, clearly described expectations and a possibility to stay on afterwards.',
    workMode: 'hybrid',
    internshipType: 'software development',
    companyType: 'corporate',
    duration: '12 weeks',
    compensation: '€850 / month',
  },
  {
    discoveredDaysAgo: 14,
    title: 'Remote internship QA & test automation',
    company: 'Bluewave Software',
    url: 'https://bluewave.example.io/jobs/qa-automation-intern',
    source: 'demo',
    location: 'Remote (Worldwide)',
    technologies: ['Playwright', 'TypeScript', 'Testing', 'GitHub Actions'],
    description:
      'Work alongside two QA engineers to expand our Playwright suite and integrate it into continuous integration. You learn how to design test data, how to isolate flaky tests and how to report quality signals to a product team.',
    workMode: 'remote',
    internshipType: 'qa & testing',
    companyType: 'software company',
    duration: '3 months',
    compensation: '€400 / month',
  },
  {
    discoveredDaysAgo: 21,
    title: 'Stage UX/UI design & front-end prototyping',
    company: 'Klein & Co Digital',
    url: 'https://kleinandco.example.be/stages/ux-ui-frontend',
    source: 'demo',
    location: 'Brussels, Brussels-Capital, Belgium',
    technologies: ['Figma', 'React', 'CSS'],
    description:
      'Small agency in Brussels with a focus on government and cultural sector projects. You translate user research into prototypes and then implement them in React. We ask for a portfolio, no specific diploma requirements.',
    workMode: 'hybrid',
    internshipType: 'ux & design',
    companyType: 'devshop',
    duration: '10 weeks',
  },
  {
    discoveredDaysAgo: 28,
    title: 'Internship growth marketing (unpaid, commission only)',
    company: 'Hypeful Media',
    url: 'https://hypeful.example.com/join/growth-marketing-intern',
    source: 'demo',
    location: 'Amsterdam, Randstad, Netherlands',
    technologies: ['SEO', 'Analytics'],
    description:
      'Commission only internship focused on cold calling and door-to-door sales for local businesses. No code and no product work: you learn direct sales and account management. Unpaid, with the possibility of a fee per closed deal.',
    workMode: 'onsite',
    internshipType: 'marketing & growth',
    companyType: 'consultancy',
    duration: '6 months',
  },
  {
    discoveredDaysAgo: 14,
    title: 'Stage embedded software (C++ / Kotlin)',
    company: 'Circuitry Dynamics',
    url: 'https://circuitry.example.be/jobs/stage-embedded-software',
    source: 'demo',
    location: 'Leuven, Flanders, Belgium',
    technologies: ['C++', 'Kotlin', 'Testing'],
    description:
      'Circuitry Dynamics develops firmware and companion apps for industrial sensors. You work on a driver stability assignment: reproduce intermittent failures, add instrumentation and harden the retry logic. On-site lab access is required for part of the work; remote work is possible for the software side.',
    workMode: 'hybrid',
    internshipType: 'software development',
    companyType: 'software company',
    duration: '4 months',
    compensation: '€700 / month',
  },
];
