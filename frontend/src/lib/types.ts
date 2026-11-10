export interface AuthUser {
  id: string;
  name: string;
  email: string;
  emailVerifiedAt: string | null;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  accessExpiresIn: number;
  refreshExpiresIn: number;
  user: AuthUser;
}

export interface User {
  id: string;
  name: string;
  email: string;
  emailVerifiedAt: string | null;
  createdAt: string;
}

export interface Child {
  id: string;
  evaluatorId: string;
  name: string;
  birthDate: string;
  ageAtEvaluation: number;
  age: string;
  sex: string | null;
  school: string | null;
  grade: string | null;
  notes: string | null;
  doesNotRead: boolean;
  /** Habilidade DHACA de 1 a 5; nulo quando não informado. */
  dhaca: number | null;
  createdAt: string;
  updatedAt: string;
  applicationsCount?: number;
  lastApplication?: {
    id: string;
    status: string;
    totalScore: number | null;
    classification: string | null;
    startedAt: string;
    completedAt: string | null;
    currentStep: number;
  } | null;
  applications?: ChildApplication[];
}

export interface ChildApplication {
  id: string;
  status: string;
  startedAt: string;
  completedAt: string | null;
  currentStep: number;
  totalScore: number | null;
  classification: string | null;
  notes: string | null;
  steps: ApplicationStep[];
}

export type ApplicationStatus = 'DRAFT' | 'IN_PROGRESS' | 'COMPLETED' | 'ARCHIVED';

export interface Application {
  id: string;
  childId: string;
  evaluatorId: string;
  status: ApplicationStatus;
  startedAt: string;
  completedAt: string | null;
  currentStep: number;
  totalScore: number | null;
  classification: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  child?: { id: string; name: string; birthDate: string; ageAtEvaluation: number; doesNotRead?: boolean };
  steps?: ApplicationStep[];
}

export interface ApplicationStep {
  id: string;
  applicationId: string;
  stepNumber: number;
  skill: string;
  maxScore: number | null;
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
  score: number;
  startedAt: string | null;
  completedAt: string | null;
  notes: string | null;
  sections: ApplicationSection[];
  items: ApplicationItem[];
}

export interface ApplicationSection {
  id: string;
  applicationStepId: string;
  substepOrder: number;
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'FINALIZED';
  finalizedReason: 'ALL_ITEMS_ANSWERED' | 'ERROR_LIMIT' | null;
  consecutiveErrors: number;
  startedAt: string | null;
  finalizedAt: string | null;
}

export interface ApplicationItem {
  id: string;
  applicationStepId: string;
  itemNumber: number;
  prompt: string | null;
  expectedAnswer: string | null;
  childAnswer: string | null;
  isCorrect: boolean | null;
  score: number;
  responseTimeMs: number | null;
  notes: string | null;
  updatedAt?: string;
}

export interface ProtocolItem {
  id: string;
  substepId: string;
  itemNumber: number;
  prompt: string | null;
  expectedAnswer: string | null;
  imageKey: string | null;
  isPending: boolean;
  responseType: string;
}

export interface ProtocolSubstep {
  id: string;
  stepNumber: number;
  order: number;
  title: string;
  instructions: string;
  trainingExamples: string[];
  maxScore: number | null;
  timerRequired: boolean;
  items: ProtocolItem[];
}

export interface ProtocolStep {
  id: string;
  stepNumber: number;
  title: string;
  skill: string;
  instructions: string;
  maxScore: number | null;
  timerRequired: boolean;
  position: number;
  substeps: ProtocolSubstep[];
}

export interface ItemResult {
  itemNumber: number;
  prompt: string | null;
  expectedAnswer: string | null;
  childAnswer: string | null;
  isCorrect: boolean | null;
  notes: string | null;
}

export interface ProgressItem {
  itemNumber: number;
  prompt: string | null;
  expectedAnswer: string | null;
  childAnswer: string | null;
  isCorrect: boolean | null;
  answered: boolean;
  notes: string | null;
}

export interface ProgressExample {
  label: string;
  detail: string | null;
}

export interface ProgressSubstep {
  order: number;
  title: string;
  status?: 'NOT_STARTED' | 'IN_PROGRESS' | 'FINALIZED';
  finalizedReason?: 'ALL_ITEMS_ANSWERED' | 'ERROR_LIMIT' | null;
  consecutiveErrors?: number;
  exampleCount: number;
  examples: ProgressExample[];
  totalItems: number;
  answeredItems: number;
  correctItems: number;
  wrongItems: number;
  /** Quando a primeira resposta da seção foi registrada; nulo sem respostas. */
  firstAnswerAt?: string | null;
  /** Última vez que alguma resposta da seção foi gravada ou corrigida. */
  lastAnswerAt?: string | null;
  items: ProgressItem[];
}

export interface StepResult {
  stepNumber: number;
  skill: string;
  status: string;
  score: number;
  maxScore: number | null;
  completedAt: string | null;
  timerMs: number | null;
  answeredItems: number;
  totalItems?: number;
  notes: string | null;
  items?: ItemResult[];
  substeps?: ProgressSubstep[];
}

export interface ApplicationResult {
  applicationId: string;
  status: ApplicationStatus;
  startedAt: string;
  completedAt: string | null;
  currentStep: number;
  totalScore: number | null;
  maxScore: number;
  classification: string | null;
  notes: string | null;
  child: {
    id: string;
    name: string;
    birthDate: string;
    ageAtEvaluation: number;
    age?: string;
    school: string | null;
    grade: string | null;
  };
  steps: StepResult[];
}

export interface ApiError {
  statusCode: number;
  message: string;
  errors?: unknown;
}