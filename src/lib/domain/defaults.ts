import type {
  AiSettings,
  AppSettings,
  ClassificationColor,
  ClassificationKind,
  ClassificationValue,
  EvaluationProfile,
  SearchSettings,
} from './types';

/**
 * Seed data only.
 *
 * Nothing in this file is consulted by business logic at runtime: these values are written
 * into the user editable registry on first run and can then be renamed, extended or
 * deleted through the Settings UI.
 */

export const DEFAULT_AI_BASE_URL = 'https://text.pollinations.ai/openai';
export const DEFAULT_POLLINATIONS_GATEWAY = 'https://gen.pollinations.ai/v1/chat/completions';
export const DEFAULT_AI_MODEL = 'openai';
export const DEFAULT_PROFILE_ID = 'default';

interface SeedValue {
  label: string;
  aliases?: string[];
  color?: ClassificationColor;
  description?: string;
}

const SEED: Record<ClassificationKind, SeedValue[]> = {
  companyType: [
    { label: 'devshop', aliases: ['software agency', 'digital agency', 'development agency'], color: 'terracotta' },
    { label: 'software company', aliases: ['product company', 'saas', 'software vendor'], color: 'sky' },
    { label: 'startup', aliases: ['scale-up', 'scaleup'], color: 'plum' },
    { label: 'corporate', aliases: ['enterprise', 'multinational', 'groot bedrijf'], color: 'slate' },
    { label: 'consultancy', aliases: ['consulting', 'consultant'], color: 'sand' },
    { label: 'government', aliases: ['public sector', 'overheid', 'municipality'], color: 'sage' },
    { label: 'nonprofit', aliases: ['ngo', 'vzw', 'non-profit'], color: 'sage' },
    { label: 'research', aliases: ['university', 'academic', 'onderzoeksinstelling'], color: 'plum' },
    { label: 'freelance', aliases: ['independent', 'self-employed'], color: 'sand' },
  ],
  location: [
    { label: 'Limburg', aliases: ['hasselt', 'genk', 'diepenbeek', 'tienen'], color: 'terracotta' },
    { label: 'Leuven', aliases: ['heverlee', 'louvain'], color: 'terracotta' },
    { label: 'Antwerp', aliases: ['antwerpen', 'mechelen'], color: 'terracotta' },
    { label: 'Brussels', aliases: ['brussel', 'bruxelles'], color: 'terracotta' },
    { label: 'Ghent', aliases: ['gent'], color: 'terracotta' },
    {
      label: 'Netherlands',
      aliases: ['nederland', 'amsterdam', 'eindhoven', 'utrecht', 'rotterdam'],
      color: 'sky',
    },
    { label: 'Germany', aliases: ['deutschland', 'berlin', 'munchen', 'munich'], color: 'sky' },
    { label: 'Remote', aliases: ['anywhere', 'worldwide', 'fully remote'], color: 'sage' },
  ],
  region: [
    { label: 'Limburg', aliases: ['hasselt', 'genk', 'diepenbeek'], color: 'terracotta' },
    { label: 'Flanders', aliases: ['vlaanderen', 'antwerpen', 'gent', 'leuven'], color: 'sand' },
    { label: 'Brussels-Capital', aliases: ['brussels', 'brussel', 'bruxelles'], color: 'sand' },
    { label: 'Wallonia', aliases: ['wallonie', 'liege', 'luik', 'namur'], color: 'sand' },
    { label: 'North Brabant', aliases: ['noord-brabant', 'eindhoven', 'tilburg', 'breda'], color: 'sky' },
    { label: 'Randstad', aliases: ['amsterdam', 'utrecht', 'rotterdam', 'den haag'], color: 'sky' },
    { label: 'Remote / distributed', aliases: ['distributed', 'anywhere'], color: 'sage' },
  ],
  country: [
    { label: 'Belgium', aliases: ['belgie', 'be'], color: 'terracotta' },
    { label: 'Netherlands', aliases: ['nederland', 'nl'], color: 'sky' },
    { label: 'Germany', aliases: ['deutschland', 'de'], color: 'sky' },
    { label: 'France', aliases: ['fr'], color: 'sky' },
    { label: 'Worldwide', aliases: ['global'], color: 'sage' },
  ],
  workMode: [
    { label: 'onsite', aliases: ['on-site', 'on site', 'office', 'kantoor', 'in-house'], color: 'sand' },
    { label: 'hybrid', aliases: ['hybride', 'partly remote', 'two days office'], color: 'plum' },
    { label: 'remote', aliases: ['fully remote', 'telework', 'thuiswerk', 'wfh'], color: 'sage' },
  ],
  internshipType: [
    {
      label: 'software development',
      aliases: ['developer', 'programming', 'coding', 'full stack', 'fullstack', 'backend', 'frontend'],
      color: 'terracotta',
    },
    { label: 'data & AI', aliases: ['machine learning', 'data science', 'data engineer', 'ai'], color: 'plum' },
    { label: 'devops & cloud', aliases: ['devops', 'cloud', 'infrastructure', 'sre', 'platform'], color: 'sky' },
    { label: 'qa & testing', aliases: ['qa', 'test automation', 'quality assurance'], color: 'slate' },
    {
      label: 'business analysis',
      aliases: ['business analyst', 'functional analyst', 'product owner'],
      color: 'sand',
    },
    { label: 'ux & design', aliases: ['ux', 'ui', 'design', 'product design'], color: 'plum' },
    { label: 'marketing & growth', aliases: ['marketing', 'growth', 'seo', 'content'], color: 'sand' },
    { label: 'sales & support', aliases: ['sales', 'customer support', 'helpdesk', 'commercial'], color: 'slate' },
    { label: 'research & academia', aliases: ['research', 'phd', 'thesis'], color: 'plum' },
  ],
  technology: [
    { label: 'JavaScript', aliases: ['js', 'es6'], color: 'sand' },
    { label: 'TypeScript', aliases: ['ts'], color: 'sky' },
    { label: 'React', aliases: ['reactjs'], color: 'sky' },
    { label: 'Next.js', aliases: ['nextjs'], color: 'sky' },
    { label: 'Angular', aliases: ['angularjs'], color: 'terracotta' },
    { label: 'Vue', aliases: ['vuejs'], color: 'sage' },
    { label: 'Node.js', aliases: ['nodejs'], color: 'sage' },
    { label: 'PHP', aliases: ['php8'], color: 'plum' },
    { label: 'Laravel', aliases: [], color: 'plum' },
    { label: 'Python', aliases: [], color: 'sky' },
    { label: 'Django', aliases: [], color: 'sage' },
    { label: 'Java', aliases: ['spring boot'], color: 'terracotta' },
    { label: 'C#', aliases: ['csharp', '.net', 'dotnet'], color: 'plum' },
    { label: 'SQL', aliases: ['postgres', 'postgresql', 'mysql', 'mssql'], color: 'sand' },
    { label: 'Docker', aliases: ['containers'], color: 'sky' },
    { label: 'Kubernetes', aliases: ['k8s'], color: 'sky' },
    { label: 'AWS', aliases: ['amazon web services'], color: 'sand' },
    { label: 'Azure', aliases: ['microsoft azure'], color: 'sky' },
    { label: 'Git', aliases: ['github', 'gitlab'], color: 'slate' },
    { label: 'Testing', aliases: ['jest', 'vitest', 'playwright', 'cypress', 'unit testing'], color: 'sage' },
    { label: 'Machine Learning', aliases: ['pytorch', 'tensorflow'], color: 'plum' },
    { label: 'Kotlin', aliases: ['android'], color: 'terracotta' },
    { label: 'Swift', aliases: ['ios'], color: 'terracotta' },
    { label: 'Go', aliases: ['golang'], color: 'sage' },
  ],
  status: [
    { label: 'new', aliases: ['discovered', 'inbox'], color: 'sky' },
    { label: 'reviewing', aliases: ['in review', 'triaging'], color: 'sand' },
    { label: 'shortlisted', aliases: ['shortlist', 'favourite', 'favorite', 'starred'], color: 'sage' },
    { label: 'applied', aliases: ['application sent'], color: 'plum' },
    { label: 'rejected', aliases: ['declined', 'no-go'], color: 'slate' },
    { label: 'archived', aliases: ['expired', 'closed'], color: 'slate' },
  ],
};

export function createDefaultClassifications(): ClassificationValue[] {
  const values: ClassificationValue[] = [];
  for (const kind of Object.keys(SEED) as ClassificationKind[]) {
    SEED[kind].forEach((seed, index) => {
      values.push({
        id: toId(seed.label),
        kind,
        label: seed.label,
        aliases: seed.aliases ?? [],
        color: seed.color ?? 'slate',
        builtin: true,
        order: index,
      });
    });
  }
  return values;
}

function toId(label: string): string {
  return (
    label
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/&/g, 'and')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'value'
  );
}

export function createDefaultProfile(now: Date = new Date()): EvaluationProfile {
  return {
    id: DEFAULT_PROFILE_ID,
    name: 'Junior full-stack developer internship',
    description:
      'Looks for hands-on software internships with a real codebase, modern JavaScript/TypeScript tooling and a team that mentors students.',
    targetTechnologies: [
      'JavaScript',
      'TypeScript',
      'React',
      'Angular',
      'Node.js',
      'Next.js',
      'PHP',
      'Laravel',
      'SQL',
      'Git',
    ],
    preferredLocations: ['Limburg', 'Leuven', 'Hasselt', 'Antwerp', 'Brussels', 'Remote'],
    preferredRegions: ['Limburg', 'Flanders', 'Remote / distributed'],
    preferredCompanyTypes: ['devshop', 'software company', 'startup'],
    preferredWorkModes: ['hybrid', 'remote'],
    preferredInternshipTypes: ['software development', 'data & AI', 'devops & cloud'],
    boostKeywords: ['mentorship', 'code review', 'real project', 'production', 'thesis', 'team of developers'],
    avoidKeywords: ['unpaid', 'commission only', 'door-to-door', 'cold calling', 'administrative'],
    minRelevance: 50,
    criteria: [
      {
        key: 'technology',
        label: 'Technology match',
        weight: 3,
        description: 'How well the stack and the work match the target technologies.',
      },
      {
        key: 'location',
        label: 'Location match',
        weight: 2,
        description: 'Commute friendliness versus the preferred locations and regions.',
      },
      {
        key: 'company',
        label: 'Company match',
        weight: 1.5,
        description: 'Company type and whether a student actually learns there.',
      },
      {
        key: 'quality',
        label: 'Company-as-internship-host quality',
        weight: 2.5,
        description:
          'Would this company be a good internship host: clarity of the work, engineering team size and mentorship potential, ownership for a student, and any signs of student friendliness (interns, thesis topics, training).',
      },
    ],
    matchLevels: [
      { id: 'high', label: 'High match', minScore: 75 },
      { id: 'medium', label: 'Medium match', minScore: 55 },
      { id: 'low', label: 'Low match', minScore: 35 },
      { id: 'poor', label: 'Poor match', minScore: 0 },
    ],
    updatedAt: now.toISOString(),
  };
}

export function createDefaultAiSettings(overrides: Partial<AiSettings> = {}): AiSettings {
  return {
    provider: 'pollinations',
    baseUrl: DEFAULT_AI_BASE_URL,
    model: DEFAULT_AI_MODEL,
    temperature: 0.2,
    maxTokens: 900,
    timeoutMs: 45000,
    concurrency: 2,
    minDelayMs: 1500,
    allowHeuristicFallback: false,
    ...overrides,
  };
}

export function createDefaultSearchSettings(overrides: Partial<SearchSettings> = {}): SearchSettings {
  return {
    enabledProviders: ['demo', 'arbeitnow', 'hackernews'],
    defaultQuery: 'software developer javascript typescript',
    resultsPerProvider: 20,
    timeoutMs: 15000,
    contact: 'internship-scout',
    internshipKeywords: ['intern', 'internship', 'stage', 'stagiair', 'student', 'graduate', 'trainee', 'werkstudent'],
    /**
     * Discovery mode: false means we collect ALL software development postings, because a
     * company that is hiring developers is usually also open to interns. The AI evaluation
     * then scores each company's internship suitability. Users who want internship-only
     * results can flip this back on in Settings → Search.
     */
    requireInternshipKeyword: false,
    ...overrides,
  };
}

export function createDefaultSettings(overrides: Partial<AppSettings> = {}): AppSettings {
  const now = new Date();
  return {
    profile: createDefaultProfile(now),
    ai: createDefaultAiSettings(),
    search: createDefaultSearchSettings(),
    general: { autoSeedDemo: true },
    updatedAt: now.toISOString(),
    ...overrides,
  };
}

