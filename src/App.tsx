import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';

type ViewName = 'dashboard' | 'calendar' | 'clients' | 'programs' | 'session' | 'library';
type NavIconName = 'home' | 'calendar' | 'clients' | 'programs' | 'session' | 'library' | 'tools';

type CalendarBookingStatus = 'planned' | 'completed' | 'cancelled';

type Exercise = {
  id: string;
  name: string;
  category: string;
  equipment: string;
  defaultSets: number;
  defaultReps: string;
  defaultRest: string;
  notes: string;
};

type Client = {
  id: string;
  name: string;
  email: string;
  phone: string;
  goal: string;
  status: string;
  notes: string;
  archived: boolean;
  measurements: ClientMeasurements;
  measurementHistory: MeasurementSnapshot[];
  checkIns: CheckInRecord[];
};

type ClientMeasurements = {
  bodyWeightKg: string;
  heightCm: string;
  bodyFatPercent: string;
  chestCm: string;
  waistCm: string;
  hipsCm: string;
  armCm: string;
  thighCm: string;
  calfCm: string;
};

type MeasurementSnapshot = {
  id: string;
  recordedAt: string;
  measurements: ClientMeasurements;
};

type CheckInRecord = {
  id: string;
  recordedAt: string;
  sleepHours: string;
  steps: string;
  stress: string;
  soreness: string;
  energy: string;
  notes: string;
};

type ProgramExercise = {
  id: string;
  exerciseId: string;
  sets: number;
  reps: string;
  rest: string;
  notes: string;
};

type Program = {
  id: string;
  clientId: string;
  title: string;
  focus: string;
  schedule: string;
  notes: string;
  archived: boolean;
  exercises: ProgramExercise[];
};

type SessionSet = {
  completed: boolean;
  reps: string;
  weight: string;
};

type SessionEntry = {
  id: string;
  exerciseId: string;
  exerciseName: string;
  targetSets: number;
  targetReps: string;
  rest: string;
  notes: string;
  setStates: SessionSet[];
};

type ActiveSession = {
  clientId: string;
  clientName: string;
  programId: string;
  programName: string;
  startedAt: string;
  notes: string;
  entries: SessionEntry[];
};

type SessionRecord = {
  id: string;
  clientId: string;
  clientName: string;
  programId: string;
  programName: string;
  startedAt: string;
  finishedAt: string;
  notes: string;
  completedExercises: number;
  completedSets: number;
  totalReps: number;
  totalLoadKg: number;
};

type CalendarBooking = {
  id: string;
  clientId: string;
  clientName: string;
  title: string;
  startAt: string;
  endAt: string;
  status: CalendarBookingStatus;
  notes: string;
  createdAt: string;
  seriesId: string;
  recurrence: 'none' | 'weekly';
};

type ImportedData = {
  clients?: Client[];
  exercises?: Exercise[];
  programs?: Program[];
  sessions?: SessionRecord[];
  bookings?: CalendarBooking[];
};

type UndoSnapshot = {
  id: string;
  label: string;
  clients: Client[];
  programs: Program[];
};

type ProgramTemplateKey = 'strength' | 'hypertrophy' | 'fat-loss';
type RecentlyEditedEntityType = 'client' | 'program' | 'exercise';
type RecentlyEditedFilter = 'all' | RecentlyEditedEntityType;

type RecentlyEditedItem = {
  entityType: RecentlyEditedEntityType;
  entityId: string;
  label: string;
  detail: string;
  editedAt: string;
};

type ClientTimelineEvent = {
  id: string;
  kind: 'session' | 'booking' | 'measurement' | 'check-in';
  kindLabel: string;
  occurredAt: string;
  title: string;
  detail: string;
};

type CommandPaletteItem = {
  id: string;
  type: 'action' | 'client' | 'program' | 'exercise' | 'booking';
  label: string;
  detail: string;
  keywords: string;
  execute: () => void;
};

type UndoWindow = {
  id: string;
  label: string;
  kind: 'snapshot' | 'bookings';
  expiresAt: number;
  bookingsSnapshot?: CalendarBooking[];
};

type DueCheckInDismissals = Record<string, string>;

const STORAGE_KEYS = {
  clients: 'superset.clients',
  exercises: 'superset.exercises',
  programs: 'superset.programs',
  sessions: 'superset.sessions',
  bookings: 'superset.bookings',
  activeSessionDraft: 'superset.active-session-draft',
  lockHash: 'superset.lock.hash',
  recentlyEdited: 'superset.recently-edited',
  dueCheckInDismissals: 'superset.due-checkin-dismissals'
};

const MOMENT_QUOTES = [
  '"mini Kratos attak!"',
  '"Get a haircut, hippy"',
  '"Lover of Notredame"',
  '"dingus"'
];

const PROGRAM_TEMPLATES: Record<ProgramTemplateKey, {
  title: string;
  focus: string;
  schedule: string;
  notes: string;
  blocks: Array<{
    preferredExerciseIds: string[];
    sets: number;
    reps: string;
    rest: string;
    notes: string;
  }>;
}> = {
  strength: {
    title: 'Strength Base Block',
    focus: 'Primary compound lifts with lower reps and longer rest.',
    schedule: 'Mon / Wed / Fri',
    notes: 'Prioritize load quality and bar speed consistency.',
    blocks: [
      { preferredExerciseIds: ['ex-squat', 'ex-front-squat'], sets: 5, reps: '3-5', rest: '150 sec', notes: 'Main lower body strength lift.' },
      { preferredExerciseIds: ['ex-bench', 'ex-overhead-press'], sets: 5, reps: '3-5', rest: '150 sec', notes: 'Main push pattern.' },
      { preferredExerciseIds: ['ex-deadlift', 'ex-rdl'], sets: 4, reps: '3-5', rest: '150 sec', notes: 'Posterior chain strength focus.' },
      { preferredExerciseIds: ['ex-row', 'ex-lat-pulldown'], sets: 4, reps: '6-8', rest: '120 sec', notes: 'Upper back support work.' }
    ]
  },
  hypertrophy: {
    title: 'Hypertrophy Build Block',
    focus: 'Moderate reps with enough volume for muscle growth.',
    schedule: 'Mon / Tue / Thu / Fri',
    notes: 'Keep 1-2 reps in reserve on most sets.',
    blocks: [
      { preferredExerciseIds: ['ex-leg-press', 'ex-goblet-squat'], sets: 4, reps: '10-12', rest: '90 sec', notes: 'Quad dominant volume.' },
      { preferredExerciseIds: ['ex-incline-db-press', 'ex-bench'], sets: 4, reps: '8-12', rest: '90 sec', notes: 'Chest and front delts.' },
      { preferredExerciseIds: ['ex-db-row', 'ex-lat-pulldown'], sets: 4, reps: '10-12', rest: '75 sec', notes: 'Back density and width.' },
      { preferredExerciseIds: ['ex-lateral-raise', 'ex-tricep-pushdown'], sets: 3, reps: '12-15', rest: '60 sec', notes: 'Accessory finisher work.' }
    ]
  },
  'fat-loss': {
    title: 'Fat Loss Conditioning Block',
    focus: 'Full-body density work with conditioning finishers.',
    schedule: 'Mon / Wed / Sat',
    notes: 'Keep session pace high and transitions tight.',
    blocks: [
      { preferredExerciseIds: ['ex-step-up', 'ex-bulgarian-split'], sets: 3, reps: '10 each', rest: '60 sec', notes: 'Single-leg stability plus demand.' },
      { preferredExerciseIds: ['ex-overhead-press', 'ex-dips'], sets: 3, reps: '8-10', rest: '60 sec', notes: 'Upper push pairing.' },
      { preferredExerciseIds: ['ex-row', 'ex-pullup'], sets: 3, reps: '8-10', rest: '60 sec', notes: 'Upper pull pairing.' },
      { preferredExerciseIds: ['ex-bike-sprint', 'ex-rower-interval'], sets: 6, reps: 'work interval', rest: '60 sec', notes: 'Conditioning closer.' }
    ]
  }
};

const seedExercises: Exercise[] = [
  {
    id: 'ex-squat',
    name: 'Back Squat',
    category: 'Lower Body',
    equipment: 'Barbell',
    defaultSets: 4,
    defaultReps: '5',
    defaultRest: '120 sec',
    notes: 'Brace hard and stay stacked through the midfoot.'
  },
  {
    id: 'ex-bench',
    name: 'Bench Press',
    category: 'Push',
    equipment: 'Barbell',
    defaultSets: 4,
    defaultReps: '6',
    defaultRest: '120 sec',
    notes: 'Control the descent and drive with leg tension.'
  },
  {
    id: 'ex-row',
    name: 'Chest Supported Row',
    category: 'Pull',
    equipment: 'Machine',
    defaultSets: 3,
    defaultReps: '10',
    defaultRest: '90 sec',
    notes: 'Pause at the top and keep the ribs down.'
  },
  {
    id: 'ex-rdl',
    name: 'Romanian Deadlift',
    category: 'Posterior Chain',
    equipment: 'Barbell',
    defaultSets: 4,
    defaultReps: '8',
    defaultRest: '90 sec',
    notes: 'Push hips back and keep the bar close to the legs.'
  },
  {
    id: 'ex-lunge',
    name: 'Walking Lunge',
    category: 'Lower Body',
    equipment: 'Dumbbells',
    defaultSets: 3,
    defaultReps: '12 each',
    defaultRest: '75 sec',
    notes: 'Own every step and maintain a tall torso.'
  },
  {
    id: 'ex-plank',
    name: 'Front Plank',
    category: 'Core',
    equipment: 'Bodyweight',
    defaultSets: 3,
    defaultReps: '45 sec',
    defaultRest: '45 sec',
    notes: 'Ribs down, glutes on, and breathe behind the shield.'
  },
  {
    id: 'ex-deadlift',
    name: 'Conventional Deadlift',
    category: 'Posterior Chain',
    equipment: 'Barbell',
    defaultSets: 4,
    defaultReps: '4',
    defaultRest: '150 sec',
    notes: 'Keep lats tight and push the floor away.'
  },
  {
    id: 'ex-front-squat',
    name: 'Front Squat',
    category: 'Lower Body',
    equipment: 'Barbell',
    defaultSets: 3,
    defaultReps: '6',
    defaultRest: '120 sec',
    notes: 'Keep elbows high and torso tall.'
  },
  {
    id: 'ex-leg-press',
    name: 'Leg Press',
    category: 'Lower Body',
    equipment: 'Machine',
    defaultSets: 4,
    defaultReps: '10',
    defaultRest: '90 sec',
    notes: 'Control depth and drive evenly through both feet.'
  },
  {
    id: 'ex-leg-curl',
    name: 'Lying Leg Curl',
    category: 'Hamstrings',
    equipment: 'Machine',
    defaultSets: 3,
    defaultReps: '12',
    defaultRest: '75 sec',
    notes: 'Pause at peak contraction.'
  },
  {
    id: 'ex-hip-thrust',
    name: 'Barbell Hip Thrust',
    category: 'Glutes',
    equipment: 'Barbell',
    defaultSets: 4,
    defaultReps: '8',
    defaultRest: '90 sec',
    notes: 'Posterior pelvic tilt at lockout.'
  },
  {
    id: 'ex-lat-pulldown',
    name: 'Lat Pulldown',
    category: 'Pull',
    equipment: 'Cable',
    defaultSets: 4,
    defaultReps: '10',
    defaultRest: '75 sec',
    notes: 'Drive elbows down and back.'
  },
  {
    id: 'ex-pullup',
    name: 'Pull-Up',
    category: 'Pull',
    equipment: 'Bodyweight',
    defaultSets: 4,
    defaultReps: 'AMRAP',
    defaultRest: '120 sec',
    notes: 'Full range and controlled tempo.'
  },
  {
    id: 'ex-db-row',
    name: 'Single Arm Dumbbell Row',
    category: 'Pull',
    equipment: 'Dumbbell',
    defaultSets: 3,
    defaultReps: '10 each',
    defaultRest: '75 sec',
    notes: 'Keep hips square and pull to the pocket.'
  },
  {
    id: 'ex-overhead-press',
    name: 'Overhead Press',
    category: 'Push',
    equipment: 'Barbell',
    defaultSets: 4,
    defaultReps: '6',
    defaultRest: '120 sec',
    notes: 'Squeeze glutes and avoid overextension.'
  },
  {
    id: 'ex-incline-db-press',
    name: 'Incline Dumbbell Press',
    category: 'Push',
    equipment: 'Dumbbells',
    defaultSets: 3,
    defaultReps: '10',
    defaultRest: '90 sec',
    notes: 'Maintain a neutral wrist and slight pause on chest.'
  },
  {
    id: 'ex-dips',
    name: 'Parallel Bar Dips',
    category: 'Push',
    equipment: 'Bodyweight',
    defaultSets: 3,
    defaultReps: '8',
    defaultRest: '90 sec',
    notes: 'Stay controlled through shoulder range.'
  },
  {
    id: 'ex-cable-fly',
    name: 'Cable Fly',
    category: 'Push',
    equipment: 'Cable',
    defaultSets: 3,
    defaultReps: '12',
    defaultRest: '60 sec',
    notes: 'Soft elbows and squeeze through midline.'
  },
  {
    id: 'ex-bicep-curl',
    name: 'EZ Bar Curl',
    category: 'Arms',
    equipment: 'Barbell',
    defaultSets: 3,
    defaultReps: '12',
    defaultRest: '60 sec',
    notes: 'Keep upper arm stable and avoid body swing.'
  },
  {
    id: 'ex-tricep-pushdown',
    name: 'Cable Tricep Pushdown',
    category: 'Arms',
    equipment: 'Cable',
    defaultSets: 3,
    defaultReps: '12',
    defaultRest: '60 sec',
    notes: 'Lock elbows to sides and fully extend.'
  },
  {
    id: 'ex-lateral-raise',
    name: 'Dumbbell Lateral Raise',
    category: 'Shoulders',
    equipment: 'Dumbbells',
    defaultSets: 3,
    defaultReps: '15',
    defaultRest: '60 sec',
    notes: 'Lift through elbows and avoid shrugging.'
  },
  {
    id: 'ex-face-pull',
    name: 'Face Pull',
    category: 'Shoulders',
    equipment: 'Cable',
    defaultSets: 3,
    defaultReps: '15',
    defaultRest: '60 sec',
    notes: 'Pull to eye level and externally rotate.'
  },
  {
    id: 'ex-calf-raise',
    name: 'Standing Calf Raise',
    category: 'Lower Body',
    equipment: 'Machine',
    defaultSets: 4,
    defaultReps: '12',
    defaultRest: '60 sec',
    notes: 'Pause at top and stretch at bottom.'
  },
  {
    id: 'ex-bulgarian-split',
    name: 'Bulgarian Split Squat',
    category: 'Lower Body',
    equipment: 'Dumbbells',
    defaultSets: 3,
    defaultReps: '10 each',
    defaultRest: '90 sec',
    notes: 'Stay upright and drive through front heel.'
  },
  {
    id: 'ex-goblet-squat',
    name: 'Goblet Squat',
    category: 'Lower Body',
    equipment: 'Dumbbell',
    defaultSets: 3,
    defaultReps: '12',
    defaultRest: '75 sec',
    notes: 'Use this for groove and depth quality.'
  },
  {
    id: 'ex-step-up',
    name: 'Dumbbell Step-Up',
    category: 'Lower Body',
    equipment: 'Dumbbells',
    defaultSets: 3,
    defaultReps: '10 each',
    defaultRest: '75 sec',
    notes: 'Control down phase and avoid pushing off back foot.'
  },
  {
    id: 'ex-hamstring-curl-ball',
    name: 'Swiss Ball Hamstring Curl',
    category: 'Hamstrings',
    equipment: 'Bodyweight',
    defaultSets: 3,
    defaultReps: '12',
    defaultRest: '60 sec',
    notes: 'Keep hips high and curl smoothly.'
  },
  {
    id: 'ex-dead-bug',
    name: 'Dead Bug',
    category: 'Core',
    equipment: 'Bodyweight',
    defaultSets: 3,
    defaultReps: '10 each',
    defaultRest: '45 sec',
    notes: 'Exhale as you extend and keep spine neutral.'
  },
  {
    id: 'ex-pallof-press',
    name: 'Pallof Press',
    category: 'Core',
    equipment: 'Cable',
    defaultSets: 3,
    defaultReps: '12 each',
    defaultRest: '45 sec',
    notes: 'Do not rotate through the torso.'
  },
  {
    id: 'ex-farmers-carry',
    name: "Farmer's Carry",
    category: 'Conditioning',
    equipment: 'Dumbbells',
    defaultSets: 4,
    defaultReps: '30 m',
    defaultRest: '60 sec',
    notes: 'Stay tall and walk with controlled tempo.'
  },
  {
    id: 'ex-bike-sprint',
    name: 'Bike Sprint Intervals',
    category: 'Conditioning',
    equipment: 'Bike',
    defaultSets: 8,
    defaultReps: '20 sec hard / 70 sec easy',
    defaultRest: 'N/A',
    notes: 'Track peak RPM and keep power consistent.'
  },
  {
    id: 'ex-rower-interval',
    name: 'Rower Intervals',
    category: 'Conditioning',
    equipment: 'Rower',
    defaultSets: 6,
    defaultReps: '250 m',
    defaultRest: '75 sec',
    notes: 'Stay smooth early and surge in final 50 m.'
  },
  {
    id: 'ex-burpee',
    name: 'Burpee',
    category: 'Conditioning',
    equipment: 'Bodyweight',
    defaultSets: 4,
    defaultReps: '12',
    defaultRest: '60 sec',
    notes: 'Keep movement quality high under fatigue.'
  }
];

function mergeSeedExercises(existingExercises: Exercise[]) {
  const normalizedExistingNames = new Set(existingExercises.map((exercise) => exercise.name.trim().toLowerCase()));
  const existingIds = new Set(existingExercises.map((exercise) => exercise.id));
  const missingSeeds = seedExercises.filter(
    (seedExercise) => !existingIds.has(seedExercise.id) && !normalizedExistingNames.has(seedExercise.name.trim().toLowerCase())
  );

  return [...existingExercises, ...missingSeeds];
}

const seedClients: Client[] = [
  {
    id: 'client-ava',
    name: 'Ava Johnson',
    email: 'ava@example.com',
    phone: '555-0148',
    goal: 'Build strength while cleaning up movement quality.',
    status: 'Active',
    notes: 'Prefers morning sessions and responds well to clear progress targets.',
    archived: false,
    measurements: {
      bodyWeightKg: '62',
      heightCm: '168',
      bodyFatPercent: '24',
      chestCm: '88',
      waistCm: '72',
      hipsCm: '95',
      armCm: '29',
      thighCm: '54',
      calfCm: '35'
    },
    measurementHistory: [
      {
        id: 'ms-ava-1',
        recordedAt: '2026-01-15T09:00:00.000Z',
        measurements: {
          bodyWeightKg: '62',
          heightCm: '168',
          bodyFatPercent: '24',
          chestCm: '88',
          waistCm: '72',
          hipsCm: '95',
          armCm: '29',
          thighCm: '54',
          calfCm: '35'
        }
      }
    ],
    checkIns: [
      {
        id: 'ci-ava-1',
        recordedAt: '2026-05-27T09:00:00.000Z',
        sleepHours: '7.5',
        steps: '9800',
        stress: '2',
        soreness: '2',
        energy: '4',
        notes: 'Felt recovered and hit all targets.'
      }
    ]
  },
  {
    id: 'client-noah',
    name: 'Noah Patel',
    email: 'noah@example.com',
    phone: '555-0172',
    goal: 'Trim body fat without losing pressing strength.',
    status: 'Check-in',
    notes: 'Track sleep and step count on heavier weeks.',
    archived: false,
    measurements: {
      bodyWeightKg: '84',
      heightCm: '180',
      bodyFatPercent: '18',
      chestCm: '103',
      waistCm: '86',
      hipsCm: '99',
      armCm: '35',
      thighCm: '58',
      calfCm: '38'
    },
    measurementHistory: [
      {
        id: 'ms-noah-1',
        recordedAt: '2026-01-16T09:00:00.000Z',
        measurements: {
          bodyWeightKg: '84',
          heightCm: '180',
          bodyFatPercent: '18',
          chestCm: '103',
          waistCm: '86',
          hipsCm: '99',
          armCm: '35',
          thighCm: '58',
          calfCm: '38'
        }
      }
    ],
    checkIns: [
      {
        id: 'ci-noah-1',
        recordedAt: '2026-05-28T09:00:00.000Z',
        sleepHours: '6.2',
        steps: '11200',
        stress: '3',
        soreness: '3',
        energy: '3',
        notes: 'Lower energy. Reduced accessory volume by one set.'
      }
    ]
  }
];

function blankMeasurements(): ClientMeasurements {
  return {
    bodyWeightKg: '',
    heightCm: '',
    bodyFatPercent: '',
    chestCm: '',
    waistCm: '',
    hipsCm: '',
    armCm: '',
    thighCm: '',
    calfCm: ''
  };
}

function normalizeMeasurements(measurements?: Partial<ClientMeasurements>): ClientMeasurements {
  return {
    ...blankMeasurements(),
    ...(measurements ?? {})
  };
}

function hasAnyMeasurementValue(measurements: ClientMeasurements) {
  return Object.values(measurements).some((value) => value.trim().length > 0);
}

function measurementsEqual(left: ClientMeasurements, right: ClientMeasurements) {
  return JSON.stringify(normalizeMeasurements(left)) === JSON.stringify(normalizeMeasurements(right));
}

function normalizeMeasurementSnapshot(snapshot: Partial<MeasurementSnapshot>): MeasurementSnapshot {
  return {
    id: snapshot.id ?? `ms-${Math.random().toString(36).slice(2, 10)}`,
    recordedAt: snapshot.recordedAt ?? new Date().toISOString(),
    measurements: normalizeMeasurements(snapshot.measurements)
  };
}

function normalizeCheckInRecord(record: Partial<CheckInRecord>): CheckInRecord {
  return {
    id: record.id ?? `ci-${Math.random().toString(36).slice(2, 10)}`,
    recordedAt: record.recordedAt ?? new Date().toISOString(),
    sleepHours: record.sleepHours ?? '',
    steps: record.steps ?? '',
    stress: record.stress ?? '',
    soreness: record.soreness ?? '',
    energy: record.energy ?? '',
    notes: record.notes ?? ''
  };
}

function normalizeClient(client: Partial<Client>): Client {
  const measurements = normalizeMeasurements(client.measurements);
  const normalizedHistory = Array.isArray(client.measurementHistory)
    ? client.measurementHistory.map((snapshot) => normalizeMeasurementSnapshot(snapshot))
    : [];

  const measurementHistory = normalizedHistory.length
    ? normalizedHistory
    : hasAnyMeasurementValue(measurements)
      ? [
          {
            id: `ms-${Math.random().toString(36).slice(2, 10)}`,
            recordedAt: new Date().toISOString(),
            measurements
          }
        ]
      : [];

  const checkIns = Array.isArray(client.checkIns)
    ? client.checkIns.map((entry) => normalizeCheckInRecord(entry))
    : [];

  return {
    id: client.id ?? '',
    name: client.name ?? '',
    email: client.email ?? '',
    phone: client.phone ?? '',
    goal: client.goal ?? '',
    status: client.status ?? 'Active',
    notes: client.notes ?? '',
    archived: client.archived ?? false,
    measurements,
    measurementHistory,
    checkIns
  };
}

function normalizeProgram(program: Partial<Program>): Program {
  return {
    id: program.id ?? '',
    clientId: program.clientId ?? '',
    title: program.title ?? '',
    focus: program.focus ?? '',
    schedule: program.schedule ?? '',
    notes: program.notes ?? '',
    archived: program.archived ?? false,
    exercises: Array.isArray(program.exercises) ? program.exercises : []
  };
}

const seedPrograms: Program[] = [
  {
    id: 'program-ava-hybrid',
    clientId: 'client-ava',
    title: 'Ava Hybrid Strength',
    focus: 'Upper / lower strength split with short finishers.',
    schedule: 'Mon / Wed / Fri',
    notes: 'Keep technique sharp and add load only when the reps are clean.',
    archived: false,
    exercises: [
      { id: 'pe1', exerciseId: 'ex-squat', sets: 4, reps: '5', rest: '120 sec', notes: 'Top priority.' },
      { id: 'pe2', exerciseId: 'ex-bench', sets: 4, reps: '6', rest: '120 sec', notes: 'Use a controlled pause.' },
      { id: 'pe3', exerciseId: 'ex-row', sets: 3, reps: '10', rest: '75 sec', notes: 'Squeeze the shoulder blade.' }
    ]
  },
  {
    id: 'program-noah-cut',
    clientId: 'client-noah',
    title: 'Noah Cut Phase',
    focus: 'Full body maintenance with volume control.',
    schedule: 'Tue / Thu / Sat',
    notes: 'Stay aggressive with effort, conservative with fatigue.',
    archived: false,
    exercises: [
      { id: 'pe4', exerciseId: 'ex-rdl', sets: 4, reps: '8', rest: '90 sec', notes: 'Keep hamstrings loaded.' },
      { id: 'pe5', exerciseId: 'ex-lunge', sets: 3, reps: '12 each', rest: '75 sec', notes: 'Use smooth tempo.' },
      { id: 'pe6', exerciseId: 'ex-plank', sets: 3, reps: '45 sec', rest: '45 sec', notes: 'Finish with anti-extension.' }
    ]
  }
];

const seedBookings: CalendarBooking[] = [
  {
    id: 'booking-ava-1',
    clientId: 'client-ava',
    clientName: 'Ava Johnson',
    title: 'Strength Session',
    startAt: '2026-06-02T06:30:00.000Z',
    endAt: '2026-06-02T07:30:00.000Z',
    status: 'planned',
    notes: 'Focus on squat and bench intensity blocks.',
    createdAt: '2026-05-30T15:00:00.000Z',
    seriesId: '',
    recurrence: 'none'
  },
  {
    id: 'booking-noah-1',
    clientId: 'client-noah',
    clientName: 'Noah Patel',
    title: 'Conditioning Session',
    startAt: '2026-06-03T09:00:00.000Z',
    endAt: '2026-06-03T09:45:00.000Z',
    status: 'planned',
    notes: 'Intervals plus mobility cooldown.',
    createdAt: '2026-05-30T16:00:00.000Z',
    seriesId: '',
    recurrence: 'none'
  }
];

function createId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function loadCollection<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') {
    return fallback;
  }

  const storedValue = window.localStorage.getItem(key);
  if (!storedValue) {
    return fallback;
  }

  try {
    return JSON.parse(storedValue) as T;
  } catch {
    return fallback;
  }
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString([], {
    dateStyle: 'medium',
    timeStyle: 'short'
  });
}

function formatDateOnly(value: string) {
  return new Date(value).toLocaleDateString([], {
    dateStyle: 'medium'
  });
}

function formatTimeOnly(value: string) {
  return new Date(value).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit'
  });
}

function formatProgramCopyDateTag(value: Date) {
  return value.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function formatLocalDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getWeekStartDate(value: Date) {
  const date = new Date(value);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function normalizeSessionRecord(record: Partial<SessionRecord>): SessionRecord {
  return {
    id: record.id ?? createId('history'),
    clientId: record.clientId ?? '',
    clientName: record.clientName ?? '',
    programId: record.programId ?? '',
    programName: record.programName ?? '',
    startedAt: record.startedAt ?? new Date().toISOString(),
    finishedAt: record.finishedAt ?? new Date().toISOString(),
    notes: record.notes ?? '',
    completedExercises: record.completedExercises ?? 0,
    completedSets: record.completedSets ?? 0,
    totalReps: record.totalReps ?? 0,
    totalLoadKg: record.totalLoadKg ?? 0
  };
}

function normalizeSessionSet(setState: Partial<SessionSet>): SessionSet {
  return {
    completed: Boolean(setState.completed),
    reps: setState.reps ?? '',
    weight: setState.weight ?? ''
  };
}

function normalizeSessionEntry(entry: Partial<SessionEntry>): SessionEntry {
  const initialSetStates = Array.isArray(entry.setStates)
    ? entry.setStates.map((setState) => normalizeSessionSet(setState))
    : [];
  const parsedTargetSets = Number(entry.targetSets ?? initialSetStates.length ?? 1);
  const targetSets = Number.isFinite(parsedTargetSets) && parsedTargetSets > 0
    ? Math.floor(parsedTargetSets)
    : Math.max(1, initialSetStates.length);

  const setStates = initialSetStates.length
    ? initialSetStates
    : Array.from({ length: targetSets }, () => ({ completed: false, reps: entry.targetReps ?? '', weight: '' }));

  return {
    id: entry.id ?? createId('session-entry'),
    exerciseId: entry.exerciseId ?? '',
    exerciseName: entry.exerciseName ?? 'Exercise',
    targetSets,
    targetReps: entry.targetReps ?? '',
    rest: entry.rest ?? '',
    notes: entry.notes ?? '',
    setStates
  };
}

function normalizeActiveSession(session: Partial<ActiveSession> | null | undefined): ActiveSession | null {
  if (!session || !session.clientId || !session.programId) {
    return null;
  }

  return {
    clientId: session.clientId,
    clientName: session.clientName ?? '',
    programId: session.programId,
    programName: session.programName ?? '',
    startedAt: session.startedAt ?? new Date().toISOString(),
    notes: session.notes ?? '',
    entries: Array.isArray(session.entries)
      ? session.entries.map((entry) => normalizeSessionEntry(entry))
      : []
  };
}

function normalizeCalendarBooking(booking: Partial<CalendarBooking>): CalendarBooking {
  const startAt = booking.startAt ?? new Date().toISOString();
  const endAt = booking.endAt ?? new Date(new Date(startAt).getTime() + 60 * 60000).toISOString();

  return {
    id: booking.id ?? createId('booking'),
    clientId: booking.clientId ?? '',
    clientName: booking.clientName ?? '',
    title: booking.title ?? 'Training Session',
    startAt,
    endAt,
    status: booking.status ?? 'planned',
    notes: booking.notes ?? '',
    createdAt: booking.createdAt ?? new Date().toISOString(),
    seriesId: booking.seriesId ?? '',
    recurrence: booking.recurrence ?? 'none'
  };
}

function addMinutesToIsoDate(isoValue: string, minutes: number) {
  return new Date(new Date(isoValue).getTime() + minutes * 60000).toISOString();
}

function addDaysToIsoDate(isoValue: string, days: number) {
  return new Date(new Date(isoValue).getTime() + days * 24 * 60 * 60000).toISOString();
}

function toDateTimeLocalValue(isoValue: string) {
  const date = new Date(isoValue);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const timezoneOffset = date.getTimezoneOffset() * 60000;
  const local = new Date(date.getTime() - timezoneOffset);
  return local.toISOString().slice(0, 16);
}

function escapeIcsText(value: string) {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

function formatIcsDate(value: string) {
  return new Date(value).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function buildBookingsIcs(bookings: CalendarBooking[], calendarName: string) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Superset Trainer//EN',
    'CALSCALE:GREGORIAN',
    `X-WR-CALNAME:${escapeIcsText(calendarName)}`
  ];

  bookings
    .slice()
    .sort((left, right) => (left.startAt < right.startAt ? -1 : 1))
    .forEach((booking) => {
      lines.push('BEGIN:VEVENT');
      lines.push(`UID:${booking.id}@superset`);
      lines.push(`DTSTAMP:${formatIcsDate(new Date().toISOString())}`);
      lines.push(`DTSTART:${formatIcsDate(booking.startAt)}`);
      lines.push(`DTEND:${formatIcsDate(booking.endAt)}`);
      lines.push(`SUMMARY:${escapeIcsText(`${booking.clientName} - ${booking.title}`)}`);
      lines.push(`DESCRIPTION:${escapeIcsText(booking.notes || 'No notes')}`);
      if (booking.status === 'cancelled') {
        lines.push('STATUS:CANCELLED');
      } else if (booking.status === 'completed') {
        lines.push('STATUS:CONFIRMED');
      } else {
        lines.push('STATUS:TENTATIVE');
      }
      lines.push('END:VEVENT');
    });

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

function hashPin(pin: string) {
  return window.btoa(pin.split('').reverse().join(''));
}

function parseRestToSeconds(rest: string) {
  const trimmed = rest.trim().toLowerCase();
  if (!trimmed) {
    return 90;
  }

  const clockMatch = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (clockMatch) {
    return Number(clockMatch[1]) * 60 + Number(clockMatch[2]);
  }

  const numberMatch = trimmed.match(/\d+(\.\d+)?/);
  if (!numberMatch) {
    return 90;
  }

  const value = Number(numberMatch[0]);
  if (Number.isNaN(value) || value <= 0) {
    return 90;
  }

  if (trimmed.includes('min')) {
    return Math.round(value * 60);
  }

  return Math.round(value);
}

function formatTimer(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function blankCheckIn(): CheckInRecord {
  return {
    id: createId('ci'),
    recordedAt: new Date().toISOString(),
    sleepHours: '',
    steps: '',
    stress: '',
    soreness: '',
    energy: '',
    notes: ''
  };
}

function csvEscape(value: string | number) {
  const text = String(value ?? '');
  if (text.includes(',') || text.includes('"') || text.includes('\n')) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function buildProgramExerciseLine(exercise: ProgramExercise, exercises: Exercise[]) {
  const exerciseName = exercises.find((item) => item.id === exercise.exerciseId)?.name ?? 'Exercise';
  return `- ${exerciseName}: ${exercise.sets} sets x ${exercise.reps} (${exercise.rest} rest)`;
}

function buildClientUpdateText(client: Client, program: Program, exercises: Exercise[]) {
  const latestMeasurement = client.measurementHistory.slice(-1)[0]?.measurements ?? client.measurements;
  const latestCheckIn = client.checkIns.slice(-1)[0] ?? null;

  const exerciseLines = program.exercises.map((exercise) => buildProgramExerciseLine(exercise, exercises)).join('\n');
  const checkInLine = latestCheckIn
    ? `Sleep ${latestCheckIn.sleepHours || '-'}h, Stress ${latestCheckIn.stress || '-'}, Energy ${latestCheckIn.energy || '-'}, Steps ${latestCheckIn.steps || '-'}`
    : 'No check-ins yet';

  return [
    `Client Update: ${client.name}`,
    `Date: ${new Date().toLocaleDateString()}`,
    '',
    `Program: ${program.title}`,
    `Focus: ${program.focus || 'N/A'}`,
    `Schedule: ${program.schedule || 'N/A'}`,
    '',
    'Program Details',
    exerciseLines || '- No exercises added',
    '',
    'Latest Progress Snapshot',
    `Body weight: ${latestMeasurement.bodyWeightKg || '-'} kg`,
    `Body fat: ${latestMeasurement.bodyFatPercent || '-'} %`,
    `Waist: ${latestMeasurement.waistCm || '-'} cm`,
    `Check-in: ${checkInLine}`,
    '',
    'Coach Notes',
    program.notes || 'No additional notes this week.'
  ].join('\n');
}

function buildClientProgressCsv(clients: Client[]) {
  const rows: string[] = [];
  rows.push([
    'clientName',
    'recordType',
    'recordedAt',
    'bodyWeightKg',
    'bodyFatPercent',
    'waistCm',
    'sleepHours',
    'steps',
    'stress',
    'soreness',
    'energy',
    'notes'
  ].join(','));

  clients.forEach((client) => {
    client.measurementHistory.forEach((snapshot) => {
      rows.push([
        csvEscape(client.name),
        'measurement',
        csvEscape(snapshot.recordedAt),
        csvEscape(snapshot.measurements.bodyWeightKg),
        csvEscape(snapshot.measurements.bodyFatPercent),
        csvEscape(snapshot.measurements.waistCm),
        '',
        '',
        '',
        '',
        '',
        ''
      ].join(','));
    });

    client.checkIns.forEach((checkIn) => {
      rows.push([
        csvEscape(client.name),
        'check-in',
        csvEscape(checkIn.recordedAt),
        '',
        '',
        '',
        csvEscape(checkIn.sleepHours),
        csvEscape(checkIn.steps),
        csvEscape(checkIn.stress),
        csvEscape(checkIn.soreness),
        csvEscape(checkIn.energy),
        csvEscape(checkIn.notes)
      ].join(','));
    });
  });

  return rows.join('\n');
}

function createTemplateProgramExercises(templateKey: ProgramTemplateKey, exercises: Exercise[]) {
  const fallbackExerciseId = exercises[0]?.id ?? '';
  const template = PROGRAM_TEMPLATES[templateKey];

  return template.blocks.map((block) => {
    const exerciseId =
      block.preferredExerciseIds.find((id) => exercises.some((exercise) => exercise.id === id)) ?? fallbackExerciseId;

    return {
      id: createId('prog-ex'),
      exerciseId,
      sets: block.sets,
      reps: block.reps,
      rest: block.rest,
      notes: block.notes
    };
  });
}

function blankClient(): Client {
  return {
    id: '',
    name: '',
    email: '',
    phone: '',
    goal: '',
    status: 'Active',
    notes: '',
    archived: false,
    measurements: blankMeasurements(),
    measurementHistory: [],
    checkIns: []
  };
}

function blankExercise(): Exercise {
  return {
    id: '',
    name: '',
    category: '',
    equipment: '',
    defaultSets: 3,
    defaultReps: '8',
    defaultRest: '90 sec',
    notes: ''
  };
}

function blankProgram(clientId: string, exerciseId: string): Program {
  return {
    id: '',
    clientId,
    title: '',
    focus: '',
    schedule: '',
    notes: '',
    archived: false,
    exercises: [
      {
        id: createId('prog-ex'),
        exerciseId,
        sets: 3,
        reps: '8',
        rest: '90 sec',
        notes: ''
      }
    ]
  };
}

function buildSessionEntry(programExercise: ProgramExercise, exerciseName: string): SessionEntry {
  return {
    id: createId('session-entry'),
    exerciseId: programExercise.exerciseId,
    exerciseName,
    targetSets: programExercise.sets,
    targetReps: programExercise.reps,
    rest: programExercise.rest,
    notes: programExercise.notes,
    setStates: Array.from({ length: programExercise.sets }, () => ({
      completed: false,
      reps: programExercise.reps,
      weight: ''
    }))
  };
}

function totalCompletedSets(entries: SessionEntry[]) {
  return entries.reduce(
    (completedCount, entry) => completedCount + entry.setStates.filter((setState) => setState.completed).length,
    0
  );
}

function serializeClientDraft(client: Client) {
  return JSON.stringify(normalizeClient(client));
}

function serializeProgramDraft(program: Program) {
  return JSON.stringify(program);
}

function serializeExerciseDraft(exercise: Exercise) {
  return JSON.stringify(exercise);
}

function serializeCreateBookingDraft(payload: {
  bookingClientId: string;
  bookingStartAtInput: string;
  bookingTitle: string;
  bookingDurationMinutes: string;
  bookingNotes: string;
  isRecurringBooking: boolean;
  recurringWeeks: string;
}) {
  return JSON.stringify(payload);
}

function serializeMoveBookingDraft(payload: {
  moveBookingId: string;
  moveBookingStartAtInput: string;
  moveBookingDurationMinutes: string;
}) {
  return JSON.stringify(payload);
}

function App() {
  const [view, setView] = useState<ViewName>('dashboard');
  const [clients, setClients] = useState<Client[]>(() => {
    const stored = loadCollection<Client[]>(STORAGE_KEYS.clients, seedClients);
    return stored.map((client) => normalizeClient(client));
  });
  const [exercises, setExercises] = useState<Exercise[]>(() => {
    const stored = loadCollection<Exercise[]>(STORAGE_KEYS.exercises, []);
    if (!stored.length) {
      return seedExercises;
    }

    return mergeSeedExercises(stored);
  });
  const [programs, setPrograms] = useState<Program[]>(() => {
    const stored = loadCollection<Program[]>(STORAGE_KEYS.programs, seedPrograms);
    return stored.map((program) => normalizeProgram(program));
  });
  const [sessionHistory, setSessionHistory] = useState<SessionRecord[]>(() => {
    const stored = loadCollection<SessionRecord[]>(STORAGE_KEYS.sessions, []);
    return stored.map((record) => normalizeSessionRecord(record));
  });
  const [bookings, setBookings] = useState<CalendarBooking[]>(() => {
    const stored = loadCollection<CalendarBooking[]>(STORAGE_KEYS.bookings, seedBookings);
    return stored.map((booking) => normalizeCalendarBooking(booking));
  });
  const [recentlyEdited, setRecentlyEdited] = useState<RecentlyEditedItem[]>(() => {
    const stored = loadCollection<RecentlyEditedItem[]>(STORAGE_KEYS.recentlyEdited, []);
    return stored
      .filter((item) =>
        Boolean(
          item &&
          item.entityId &&
          item.label &&
          (item.entityType === 'client' || item.entityType === 'program' || item.entityType === 'exercise')
        )
      )
      .slice(0, 8);
  });
  const [dueCheckInDismissals, setDueCheckInDismissals] = useState<DueCheckInDismissals>(() =>
    loadCollection<DueCheckInDismissals>(STORAGE_KEYS.dueCheckInDismissals, {})
  );
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(() =>
    normalizeActiveSession(loadCollection<Partial<ActiveSession> | null>(STORAGE_KEYS.activeSessionDraft, null))
  );
  const [showRecoveredSessionNotice, setShowRecoveredSessionNotice] = useState(() =>
    Boolean(normalizeActiveSession(loadCollection<Partial<ActiveSession> | null>(STORAGE_KEYS.activeSessionDraft, null)))
  );

  const [clientDraft, setClientDraft] = useState<Client>(blankClient());
  const [exerciseDraft, setExerciseDraft] = useState<Exercise>(blankExercise());
  const [programDraft, setProgramDraft] = useState<Program>(blankProgram(seedClients[0]?.id ?? '', seedExercises[0]?.id ?? ''));
  const [checkInDraft, setCheckInDraft] = useState<CheckInRecord>(blankCheckIn());
  const [sessionClientId, setSessionClientId] = useState(seedClients[0]?.id ?? '');
  const [sessionProgramId, setSessionProgramId] = useState(seedPrograms[0]?.id ?? '');
  const [bookingClientId, setBookingClientId] = useState(seedClients[0]?.id ?? '');
  const [bookingTitle, setBookingTitle] = useState('Training Session');
  const [bookingStartAtInput, setBookingStartAtInput] = useState(() => toDateTimeLocalValue(addMinutesToIsoDate(new Date().toISOString(), 60)));
  const [bookingDurationMinutes, setBookingDurationMinutes] = useState('60');
  const [bookingNotes, setBookingNotes] = useState('');
  const [visibleWeekStartIso, setVisibleWeekStartIso] = useState(() => getWeekStartDate(new Date()).toISOString());
  const [isRecurringBooking, setIsRecurringBooking] = useState(false);
  const [recurringWeeks, setRecurringWeeks] = useState('8');
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [moveBookingId, setMoveBookingId] = useState('');
  const [moveBookingStartAtInput, setMoveBookingStartAtInput] = useState('');
  const [moveBookingDurationMinutes, setMoveBookingDurationMinutes] = useState('60');
  const [selectedClientId, setSelectedClientId] = useState(seedClients[0]?.id ?? '');
  const [timelineClientId, setTimelineClientId] = useState(seedClients[0]?.id ?? '');
  const [selectedExerciseId, setSelectedExerciseId] = useState(seedExercises[0]?.id ?? '');
  const [selectedProgramId, setSelectedProgramId] = useState(seedPrograms[0]?.id ?? '');
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [isProgramModalOpen, setIsProgramModalOpen] = useState(false);
  const [isExerciseModalOpen, setIsExerciseModalOpen] = useState(false);
  const [recentlyEditedFilter, setRecentlyEditedFilter] = useState<RecentlyEditedFilter>('all');
  const [clientSearch, setClientSearch] = useState('');
  const [programSearch, setProgramSearch] = useState('');
  const [exerciseSearch, setExerciseSearch] = useState('');
  const [showArchivedClients, setShowArchivedClients] = useState(false);
  const [showArchivedPrograms, setShowArchivedPrograms] = useState(false);
  const [programTemplateKey, setProgramTemplateKey] = useState<ProgramTemplateKey>('strength');
  const [clientModalBaseline, setClientModalBaseline] = useState('');
  const [programModalBaseline, setProgramModalBaseline] = useState('');
  const [exerciseModalBaseline, setExerciseModalBaseline] = useState('');
  const [createBookingModalBaseline, setCreateBookingModalBaseline] = useState('');
  const [moveBookingModalBaseline, setMoveBookingModalBaseline] = useState('');
  const [undoSnapshots, setUndoSnapshots] = useState<UndoSnapshot[]>([]);
  const [sessionEditHistory, setSessionEditHistory] = useState<ActiveSession[]>([]);
  const [restTimerSeconds, setRestTimerSeconds] = useState(0);
  const [restTimerLabel, setRestTimerLabel] = useState('');
  const [isSecurityModalOpen, setIsSecurityModalOpen] = useState(false);
  const [lockPinInput, setLockPinInput] = useState('');
  const [newPinInput, setNewPinInput] = useState('');
  const [confirmPinInput, setConfirmPinInput] = useState('');
  const [isUnlocked, setIsUnlocked] = useState(() => !window.localStorage.getItem(STORAGE_KEYS.lockHash));
  const [lockHash, setLockHash] = useState(() => window.localStorage.getItem(STORAGE_KEYS.lockHash) ?? '');
  const [isDataDrawerOpen, setIsDataDrawerOpen] = useState(false);
  const [isSecurityDrawerOpen, setIsSecurityDrawerOpen] = useState(false);
  const [isMobileToolsOpen, setIsMobileToolsOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [commandPaletteQuery, setCommandPaletteQuery] = useState('');
  const [undoWindow, setUndoWindow] = useState<UndoWindow | null>(null);
  const [notice, setNotice] = useState('');
  const [momentQuote] = useState(
    () => MOMENT_QUOTES[Math.floor(Math.random() * MOMENT_QUOTES.length)]
  );
  const importInputRef = useRef<HTMLInputElement>(null);
  const commandPaletteInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEYS.clients, JSON.stringify(clients));
  }, [clients]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEYS.exercises, JSON.stringify(exercises));
  }, [exercises]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEYS.programs, JSON.stringify(programs));
  }, [programs]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEYS.sessions, JSON.stringify(sessionHistory));
  }, [sessionHistory]);

  useEffect(() => {
    if (activeSession) {
      window.localStorage.setItem(STORAGE_KEYS.activeSessionDraft, JSON.stringify(activeSession));
      return;
    }

    window.localStorage.removeItem(STORAGE_KEYS.activeSessionDraft);
  }, [activeSession]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEYS.bookings, JSON.stringify(bookings));
  }, [bookings]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEYS.recentlyEdited, JSON.stringify(recentlyEdited));
  }, [recentlyEdited]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEYS.dueCheckInDismissals, JSON.stringify(dueCheckInDismissals));
  }, [dueCheckInDismissals]);

  useEffect(() => {
    const nextClientId = clients[0]?.id ?? '';
    if (!selectedClientId && nextClientId && !isClientModalOpen) {
      setSelectedClientId(nextClientId);
    }
    if (!sessionClientId && nextClientId) {
      setSessionClientId(nextClientId);
    }
    if (!bookingClientId && nextClientId) {
      setBookingClientId(nextClientId);
    }
  }, [bookingClientId, clients, isClientModalOpen, selectedClientId, sessionClientId]);

  useEffect(() => {
    const nextExerciseId = exercises[0]?.id ?? '';
    if (!selectedExerciseId && nextExerciseId && !isExerciseModalOpen) {
      setSelectedExerciseId(nextExerciseId);
    }
    if (programDraft.exercises.length === 0 && nextExerciseId) {
      setProgramDraft((current) => ({
        ...current,
        exercises: [blankProgram(current.clientId || clients[0]?.id || '', nextExerciseId).exercises[0]]
      }));
    }
  }, [clients, exercises, isExerciseModalOpen, programDraft.exercises.length, selectedExerciseId]);

  useEffect(() => {
    const nextProgramId =
      programs.find((program) => program.clientId === sessionClientId && !program.archived)?.id ??
      programs.find((program) => !program.archived)?.id ??
      '';
    if (!sessionProgramId && nextProgramId) {
      setSessionProgramId(nextProgramId);
    }
  }, [programs, sessionClientId, sessionProgramId]);

  useEffect(() => {
    if (restTimerSeconds <= 0) {
      return;
    }

    const timer = window.setInterval(() => {
      setRestTimerSeconds((current) => Math.max(current - 1, 0));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [restTimerSeconds]);

  useEffect(() => {
    if (restTimerSeconds !== 0 || !restTimerLabel) {
      return;
    }

    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate([140, 80, 140]);
    }

    try {
      const audioContext = new window.AudioContext();
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = 880;
      gain.gain.value = 0.07;
      oscillator.connect(gain);
      gain.connect(audioContext.destination);
      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.24);
      window.setTimeout(() => {
        void audioContext.close();
      }, 320);
    } catch {
      // No-op when audio context is unavailable.
    }

    flash(`Rest complete: ${restTimerLabel}`);
    setRestTimerLabel('');
  }, [restTimerLabel, restTimerSeconds]);

  const selectedClient = clients.find((client) => client.id === selectedClientId) ?? clients[0] ?? null;
  const selectedExercise = exercises.find((exercise) => exercise.id === selectedExerciseId) ?? exercises[0] ?? null;
  const selectedProgram = programs.find((program) => program.id === selectedProgramId) ?? programs[0] ?? null;

  const filteredClients = useMemo(() => {
    const term = clientSearch.trim().toLowerCase();
    return clients.filter((client) => {
      if (!showArchivedClients && client.archived) {
        return false;
      }

      if (!term) {
        return true;
      }

      return [client.name, client.email, client.phone, client.goal, client.status].some((value) =>
        value.toLowerCase().includes(term)
      );
    });
  }, [clientSearch, clients, showArchivedClients]);

  const filteredPrograms = useMemo(() => {
    const term = programSearch.trim().toLowerCase();
    return programs.filter((program) => {
      if (!showArchivedPrograms && program.archived) {
        return false;
      }

      if (!term) {
        return true;
      }

      const clientName = clients.find((client) => client.id === program.clientId)?.name ?? '';
      return [program.title, program.focus, program.schedule, clientName]
        .some((value) => value.toLowerCase().includes(term));
    });
  }, [clients, programSearch, programs, showArchivedPrograms]);

  const filteredExercises = useMemo(() => {
    const term = exerciseSearch.trim().toLowerCase();
    if (!term) {
      return exercises;
    }

    return exercises.filter((exercise) =>
      [exercise.name, exercise.category, exercise.equipment, exercise.notes].some((value) =>
        value.toLowerCase().includes(term)
      )
    );
  }, [exerciseSearch, exercises]);

  const visibleClientCount = showArchivedClients
    ? clients.length
    : clients.filter((client) => !client.archived).length;
  const visibleProgramCount = showArchivedPrograms
    ? programs.length
    : programs.filter((program) => !program.archived).length;
  const hasClientFilters = Boolean(clientSearch.trim()) || showArchivedClients;
  const hasProgramFilters = Boolean(programSearch.trim()) || showArchivedPrograms;
  const hasExerciseFilters = Boolean(exerciseSearch.trim());

  const filteredRecentlyEdited = useMemo(() => {
    if (recentlyEditedFilter === 'all') {
      return recentlyEdited;
    }

    return recentlyEdited.filter((item) => item.entityType === recentlyEditedFilter);
  }, [recentlyEdited, recentlyEditedFilter]);

  const sessionProgramOptions = useMemo(
    () =>
      programs
        .filter((program) => !program.archived)
        .filter((program) => program.clientId === sessionClientId || !sessionClientId)
        .map((program) => ({ value: program.id, label: program.title })),
    [programs, sessionClientId]
  );

  const hasSessionProgramsForClient = programs.some(
    (program) => program.clientId === sessionClientId && !program.archived
  );

  const timelineClient = useMemo(
    () => clients.find((client) => client.id === timelineClientId) ?? null,
    [clients, timelineClientId]
  );

  const clientTimelineEvents = useMemo(() => {
    if (!timelineClient) {
      return [] as ClientTimelineEvent[];
    }

    const measurementEvents: ClientTimelineEvent[] = timelineClient.measurementHistory.map((snapshot) => ({
      id: `measurement-${snapshot.id}`,
      kind: 'measurement',
      kindLabel: 'Measurement',
      occurredAt: snapshot.recordedAt,
      title: 'Body stats updated',
      detail: `Weight ${snapshot.measurements.bodyWeightKg || '-'} kg · Body fat ${snapshot.measurements.bodyFatPercent || '-'}% · Waist ${snapshot.measurements.waistCm || '-'} cm`
    }));

    const checkInEvents: ClientTimelineEvent[] = timelineClient.checkIns.map((checkIn) => ({
      id: `checkin-${checkIn.id}`,
      kind: 'check-in',
      kindLabel: 'Check-in',
      occurredAt: checkIn.recordedAt,
      title: 'Wellness check-in logged',
      detail: `Sleep ${checkIn.sleepHours || '-'} h · Stress ${checkIn.stress || '-'} · Energy ${checkIn.energy || '-'} · Steps ${checkIn.steps || '-'}`
    }));

    const bookingEvents: ClientTimelineEvent[] = bookings
      .filter((booking) => booking.clientId === timelineClient.id)
      .map((booking) => ({
        id: `booking-${booking.id}`,
        kind: 'booking',
        kindLabel: 'Booking',
        occurredAt: booking.startAt,
        title: `${booking.title} (${booking.status})`,
        detail: `${formatDateTime(booking.startAt)} - ${formatTimeOnly(booking.endAt)}${booking.recurrence === 'weekly' ? ' · Weekly' : ''}`
      }));

    const sessionEvents: ClientTimelineEvent[] = sessionHistory
      .filter((record) => record.clientId === timelineClient.id)
      .map((record) => ({
        id: `session-${record.id}`,
        kind: 'session',
        kindLabel: 'Session',
        occurredAt: record.finishedAt,
        title: `${record.programName} saved`,
        detail: `${record.completedSets} sets · ${record.totalReps} reps · ${Math.round(record.totalLoadKg)} kg load`
      }));

    return [...sessionEvents, ...bookingEvents, ...measurementEvents, ...checkInEvents]
      .filter((event) => !Number.isNaN(new Date(event.occurredAt).getTime()))
      .sort((left, right) => (left.occurredAt > right.occurredAt ? -1 : 1));
  }, [bookings, sessionHistory, timelineClient]);

  const bookableClients = useMemo(
    () => clients.filter((client) => !client.archived),
    [clients]
  );

  const clientOptionValues = useMemo(
    () => bookableClients.map((client) => ({ value: client.id, label: client.name })),
    [bookableClients]
  );

  const upcomingBookings = useMemo(() => {
    const now = Date.now();
    return bookings
      .filter((booking) => booking.status === 'planned')
      .filter((booking) => new Date(booking.endAt).getTime() >= now)
      .sort((left, right) => (left.startAt < right.startAt ? -1 : 1));
  }, [bookings]);

  const DAY_START_HOUR = 5;
  const DAY_END_HOUR = 22;
  const visibleWeekDays = useMemo(() => {
    const start = new Date(visibleWeekStartIso);
    const today = new Date();
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      const isToday =
        date.getFullYear() === today.getFullYear() &&
        date.getMonth() === today.getMonth() &&
        date.getDate() === today.getDate();
      return {
        key: formatLocalDateKey(date),
        weekdayLabel: date.toLocaleDateString([], { weekday: 'long' }),
        dateLabel: date.toLocaleDateString([], { month: 'short', day: 'numeric' }),
        isToday
      };
    });
  }, [visibleWeekStartIso]);

  const visibleWeekLabel = useMemo(() => {
    const first = new Date(visibleWeekStartIso);
    const last = new Date(first);
    last.setDate(first.getDate() + 6);
    return `${formatDateOnly(first.toISOString())} - ${formatDateOnly(last.toISOString())}`;
  }, [visibleWeekStartIso]);

  const weekTimeSlots = useMemo(() => {
    return Array.from({ length: DAY_END_HOUR - DAY_START_HOUR + 1 }, (_, index) => {
      const hour = DAY_START_HOUR + index;
      const stamp = new Date();
      stamp.setHours(hour, 0, 0, 0);
      return {
        hour,
        label: stamp.toLocaleTimeString([], { hour: 'numeric' })
      };
    });
  }, [DAY_END_HOUR, DAY_START_HOUR]);

  const weekBookingsByDay = useMemo(() => {
    const map = new Map<string, CalendarBooking[]>();
    visibleWeekDays.forEach((day) => {
      map.set(day.key, []);
    });

    bookings
      .filter((booking) => booking.status === 'planned')
      .forEach((booking) => {
        const key = formatLocalDateKey(new Date(booking.startAt));
        const bucket = map.get(key);
        if (bucket) {
          bucket.push(booking);
        }
      });

    map.forEach((dayBookings, key) => {
      map.set(
        key,
        dayBookings.slice().sort((left, right) => (left.startAt < right.startAt ? -1 : 1))
      );
    });

    return map;
  }, [bookings, visibleWeekDays]);

  const moveBookingTarget = useMemo(
    () => bookings.find((booking) => booking.id === moveBookingId) ?? null,
    [bookings, moveBookingId]
  );

  const bookingConflictNotice = useMemo(() => {
    if (!bookingClientId) {
      return '';
    }

    const startDate = new Date(bookingStartAtInput);
    if (Number.isNaN(startDate.getTime())) {
      return '';
    }

    const duration = Number(bookingDurationMinutes);
    if (!Number.isFinite(duration) || duration < 15 || duration > 240) {
      return '';
    }

    const recurrenceCount = Number(recurringWeeks);
    if (isRecurringBooking && (!Number.isFinite(recurrenceCount) || recurrenceCount < 2 || recurrenceCount > 52)) {
      return '';
    }

    const startAt = startDate.toISOString();
    const totalOccurrences = isRecurringBooking ? Math.max(2, Math.floor(recurrenceCount)) : 1;
    const firstConflict = Array.from({ length: totalOccurrences }, (_, index) => {
      const occurrenceStart = addDaysToIsoDate(startAt, index * 7);
      return {
        startAt: occurrenceStart,
        endAt: addMinutesToIsoDate(occurrenceStart, duration)
      };
    }).find((candidate) => hasPlannedBookingOverlap(candidate.startAt, candidate.endAt));

    if (!firstConflict) {
      return '';
    }

    if (isRecurringBooking) {
      return `Recurring booking conflicts with an existing planned session on ${formatDateTime(firstConflict.startAt)}.`;
    }

    return 'Selected time overlaps an existing planned session.';
  }, [
    bookingClientId,
    bookingDurationMinutes,
    bookingStartAtInput,
    isRecurringBooking,
    recurringWeeks,
    bookings
  ]);

  const recurringBookingSummary = useMemo(() => {
    if (!isRecurringBooking) {
      return '';
    }

    const recurrenceCount = Number(recurringWeeks);
    if (!Number.isFinite(recurrenceCount) || recurrenceCount < 2 || recurrenceCount > 52) {
      return 'Choose 2 to 52 weeks for recurring bookings.';
    }

    const totalOccurrences = Math.max(2, Math.floor(recurrenceCount));
    return `Will create ${totalOccurrences} weekly bookings.`;
  }, [isRecurringBooking, recurringWeeks]);

  const bookingConflictSuggestions = useMemo(() => {
    if (!bookingConflictNotice) {
      return [] as string[];
    }

    const startDate = new Date(bookingStartAtInput);
    if (Number.isNaN(startDate.getTime())) {
      return [] as string[];
    }

    const duration = Number(bookingDurationMinutes);
    if (!Number.isFinite(duration) || duration < 15 || duration > 240) {
      return [] as string[];
    }

    const recurrenceCount = Number(recurringWeeks);
    if (isRecurringBooking && (!Number.isFinite(recurrenceCount) || recurrenceCount < 2 || recurrenceCount > 52)) {
      return [] as string[];
    }

    const totalOccurrences = isRecurringBooking ? Math.max(2, Math.floor(recurrenceCount)) : 1;
    const suggestions: string[] = [];
    let cursor = addMinutesToIsoDate(startDate.toISOString(), 15);

    // Search forward in 15-minute increments and suggest the first few valid slots.
    for (let step = 0; step < 320 && suggestions.length < 4; step += 1) {
      const hasSeriesConflict = Array.from({ length: totalOccurrences }, (_, index) => {
        const occurrenceStart = addDaysToIsoDate(cursor, index * 7);
        return {
          startAt: occurrenceStart,
          endAt: addMinutesToIsoDate(occurrenceStart, duration)
        };
      }).some((candidate) => hasPlannedBookingOverlap(candidate.startAt, candidate.endAt));

      if (!hasSeriesConflict) {
        suggestions.push(cursor);
        cursor = addMinutesToIsoDate(cursor, 30);
        continue;
      }

      cursor = addMinutesToIsoDate(cursor, 15);
    }

    return suggestions;
  }, [
    bookingConflictNotice,
    bookingDurationMinutes,
    bookingStartAtInput,
    isRecurringBooking,
    recurringWeeks,
    bookings
  ]);

  const moveBookingConflictNotice = useMemo(() => {
    if (!moveBookingId) {
      return '';
    }

    const startDate = new Date(moveBookingStartAtInput);
    if (Number.isNaN(startDate.getTime())) {
      return '';
    }

    const duration = Number(moveBookingDurationMinutes);
    if (!Number.isFinite(duration) || duration < 15 || duration > 240) {
      return '';
    }

    const startAt = startDate.toISOString();
    const endAt = addMinutesToIsoDate(startAt, duration);
    const hasConflict = hasPlannedBookingOverlap(startAt, endAt, moveBookingId);
    return hasConflict ? 'Moved time overlaps an existing planned session.' : '';
  }, [bookings, moveBookingDurationMinutes, moveBookingId, moveBookingStartAtInput]);

  const todayBookingCount = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    return bookings.filter((booking) => {
      const stamp = new Date(booking.startAt).getTime();
      return booking.status === 'planned' && stamp >= start.getTime() && stamp < end.getTime();
    }).length;
  }, [bookings]);

  const isClientDirty = isClientModalOpen && clientModalBaseline !== serializeClientDraft(clientDraft);
  const isProgramDirty = isProgramModalOpen && programModalBaseline !== serializeProgramDraft(programDraft);
  const isExerciseDirty = isExerciseModalOpen && exerciseModalBaseline !== serializeExerciseDraft(exerciseDraft);
  const isCreateBookingDirty = isBookingModalOpen && !moveBookingTarget && createBookingModalBaseline !== serializeCreateBookingDraft({
    bookingClientId,
    bookingStartAtInput,
    bookingTitle,
    bookingDurationMinutes,
    bookingNotes,
    isRecurringBooking,
    recurringWeeks
  });
  const isMoveBookingDirty = isBookingModalOpen && Boolean(moveBookingTarget) && moveBookingModalBaseline !== serializeMoveBookingDraft({
    moveBookingId,
    moveBookingStartAtInput,
    moveBookingDurationMinutes
  });

  const previousSessionForActive = useMemo(() => {
    if (!activeSession) {
      return null;
    }

    return sessionHistory.find(
      (record) => record.clientId === activeSession.clientId && record.programId === activeSession.programId
    ) ?? null;
  }, [activeSession, sessionHistory]);

  const liveCompletedSets = activeSession ? totalCompletedSets(activeSession.entries) : 0;

  const dueCheckInClientEntries = useMemo(() => {
    const now = Date.now();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

    return clients
      .filter((client) => !client.archived)
      .flatMap((client) => {
        const latestCheckIn = client.checkIns.slice(-1)[0];
        if (!latestCheckIn) {
          return [{ client, marker: 'none' }];
        }

        if (now - new Date(latestCheckIn.recordedAt).getTime() <= sevenDaysMs) {
          return [];
        }

        return [{ client, marker: latestCheckIn.recordedAt }];
      });
  }, [clients]);

  const dueCheckInClients = useMemo(
    () => dueCheckInClientEntries.map((entry) => entry.client),
    [dueCheckInClientEntries]
  );

  const dueCheckInCount = useMemo(
    () =>
      dueCheckInClientEntries.filter(
        (entry) => dueCheckInDismissals[entry.client.id] !== entry.marker
      ).length,
    [dueCheckInClientEntries, dueCheckInDismissals]
  );

  const sessionTrendRows = useMemo(() => {
    const bucket = new Map<string, { label: string; completedSets: number; totalReps: number; totalLoadKg: number }>();

    sessionHistory.forEach((record) => {
      const date = new Date(record.finishedAt);
      const weekStart = new Date(date);
      const day = weekStart.getDay();
      const diff = day === 0 ? -6 : 1 - day;
      weekStart.setDate(weekStart.getDate() + diff);
      weekStart.setHours(0, 0, 0, 0);
      const key = weekStart.toISOString();

      const existing = bucket.get(key) ?? {
        label: formatDateOnly(key),
        completedSets: 0,
        totalReps: 0,
        totalLoadKg: 0
      };

      existing.completedSets += record.completedSets;
      existing.totalReps += record.totalReps;
      existing.totalLoadKg += record.totalLoadKg;
      bucket.set(key, existing);
    });

    return Array.from(bucket.entries())
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .slice(-6)
      .map(([, value]) => value);
  }, [sessionHistory]);

  const maxTrendLoad = useMemo(() => {
    const max = sessionTrendRows.reduce((best, row) => Math.max(best, row.totalLoadKg), 0);
    return max <= 0 ? 1 : max;
  }, [sessionTrendRows]);

  const hasUndoPending = undoSnapshots.length > 0;

  const pendingToolsCount = useMemo(() => {
    const undoActionCount = hasUndoPending ? 1 : 0;
    return undoActionCount + dueCheckInCount;
  }, [dueCheckInCount, hasUndoPending]);

  const hasToolsAttention = pendingToolsCount > 0;
  const toolsBadgeLabel = pendingToolsCount > 99 ? '99+' : String(pendingToolsCount);

  const navItems: Array<{ key: ViewName; label: string; mobileLabel: string; icon: NavIconName }> = [
    { key: 'dashboard', label: 'Dashboard', mobileLabel: 'Home', icon: 'home' },
    { key: 'calendar', label: 'Calendar', mobileLabel: 'Calendar', icon: 'calendar' },
    { key: 'clients', label: 'Clients', mobileLabel: 'Clients', icon: 'clients' },
    { key: 'programs', label: 'Programs', mobileLabel: 'Programs', icon: 'programs' },
    { key: 'session', label: 'Session Mode', mobileLabel: 'Session', icon: 'session' },
    { key: 'library', label: 'Exercise Library', mobileLabel: 'Library', icon: 'library' }
  ];

  useEffect(() => {
    if (isClientModalOpen && !selectedClientId) {
      // Creating a new client — don't override the blank draft with the fallback client
      return;
    }
    if (selectedClient && selectedClientId !== selectedClient.id) {
      setSelectedClientId(selectedClient.id);
    }
    if (selectedClient) {
      setClientDraft(selectedClient);
    }
  }, [selectedClient, selectedClientId, isClientModalOpen]);

  useEffect(() => {
    const activeClientIds = clients.filter((client) => !client.archived).map((client) => client.id);
    if (!activeClientIds.length) {
      if (timelineClientId) {
        setTimelineClientId('');
      }
      return;
    }

    if (!timelineClientId || !activeClientIds.includes(timelineClientId)) {
      setTimelineClientId(activeClientIds[0]);
    }
  }, [clients, timelineClientId]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        openCommandPalette();
        return;
      }

      if (event.key === 'Escape' && isCommandPaletteOpen) {
        event.preventDefault();
        closeCommandPalette();
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isCommandPaletteOpen]);

  useEffect(() => {
    if (!isCommandPaletteOpen) {
      return;
    }

    const timer = window.setTimeout(() => {
      commandPaletteInputRef.current?.focus();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [isCommandPaletteOpen]);

  useEffect(() => {
    if (!undoWindow) {
      return;
    }

    const remainingMs = Math.max(0, undoWindow.expiresAt - Date.now());
    const timer = window.setTimeout(() => {
      setUndoWindow((current) => (current?.id === undoWindow.id ? null : current));
    }, remainingMs);

    return () => window.clearTimeout(timer);
  }, [undoWindow]);

  useEffect(() => {
    if (isExerciseModalOpen && !selectedExerciseId) {
      // Creating a new exercise — don't replace the blank draft with fallback selection.
      return;
    }
    if (selectedExercise && selectedExerciseId !== selectedExercise.id) {
      setSelectedExerciseId(selectedExercise.id);
    }
    if (selectedExercise) {
      setExerciseDraft(selectedExercise);
    }
  }, [isExerciseModalOpen, selectedExercise, selectedExerciseId]);

  useEffect(() => {
    if (selectedProgram && selectedProgramId !== selectedProgram.id) {
      setSelectedProgramId(selectedProgram.id);
    }
    if (selectedProgram) {
      setProgramDraft(selectedProgram);
    }
  }, [selectedProgram, selectedProgramId]);

  const clientPrograms = programs.filter((program) => program.clientId === (selectedClient?.id ?? ''));

  const dashboardStats = useMemo(() => {
    const activeClients = clients.filter((client) => !client.archived && client.status !== 'Inactive').length;
    const workoutCount = sessionHistory.length;
    const totalExercises = exercises.length;
    const livePrograms = programs.filter((program) => !program.archived).length;
    const scheduledBookings = bookings.filter((booking) => booking.status === 'planned').length;

    return [
      { label: 'Clients', value: clients.length, note: `${activeClients} active` },
      { label: 'Programs', value: programs.length, note: `${livePrograms} active` },
      { label: 'Exercise Library', value: totalExercises, note: 'Editable catalog' },
      { label: 'Logged Sessions', value: workoutCount, note: 'Saved histories' },
      { label: 'Booked Sessions', value: scheduledBookings, note: `${todayBookingCount} today` }
    ];
  }, [bookings, clients, exercises.length, programs, sessionHistory.length, todayBookingCount]);

  const analyticsCards = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const monthBookings = bookings.filter((booking) => {
      const stamp = new Date(booking.startAt).getTime();
      return stamp >= monthStart.getTime() && stamp < nextMonthStart.getTime();
    });

    const completedMonthBookings = monthBookings.filter((booking) => booking.status === 'completed').length;
    const cancelledMonthBookings = monthBookings.filter((booking) => booking.status === 'cancelled').length;
    const resolvedMonthBookings = completedMonthBookings + cancelledMonthBookings;
    const adherencePercent = resolvedMonthBookings > 0
      ? Math.round((completedMonthBookings / resolvedMonthBookings) * 100)
      : 0;

    const sixWeeksMs = 6 * 7 * 24 * 60 * 60 * 1000;
    const sixWeeksAgo = now.getTime() - sixWeeksMs;
    const recentSessions = sessionHistory.filter((record) => new Date(record.finishedAt).getTime() >= sixWeeksAgo);
    const totalRecentLoad = recentSessions.reduce((sum, record) => sum + record.totalLoadKg, 0);
    const averageWeeklyLoad = totalRecentLoad / 6;
    const averageWeeklySessions = recentSessions.length / 6;

    return [
      {
        label: 'Adherence This Month',
        value: `${adherencePercent}%`,
        note: `${completedMonthBookings} completed | ${cancelledMonthBookings} cancelled`
      },
      {
        label: 'Missed Bookings This Month',
        value: String(cancelledMonthBookings),
        note: `${monthBookings.length} total bookings in month`
      },
      {
        label: 'Average Weekly Load (6w)',
        value: `${Math.round(averageWeeklyLoad)} kg`,
        note: `${averageWeeklySessions.toFixed(1)} sessions/week average`
      }
    ];
  }, [bookings, sessionHistory]);

  const commandPaletteItems = useMemo(() => {
    const actionItems: CommandPaletteItem[] = [
      {
        id: 'action-dashboard',
        type: 'action',
        label: 'Go to Dashboard',
        detail: 'Open studio overview and quick actions',
        keywords: 'home dashboard overview',
        execute: () => {
          setView('dashboard');
          closeCommandPalette();
        }
      },
      {
        id: 'action-calendar',
        type: 'action',
        label: 'Go to Calendar',
        detail: 'Plan sessions and resolve booking conflicts',
        keywords: 'calendar bookings schedule',
        execute: () => {
          setView('calendar');
          closeCommandPalette();
        }
      },
      {
        id: 'action-clients',
        type: 'action',
        label: 'Go to Clients',
        detail: 'Open client list and check-ins',
        keywords: 'clients check-ins progress',
        execute: () => {
          setView('clients');
          closeCommandPalette();
        }
      },
      {
        id: 'action-programs',
        type: 'action',
        label: 'Go to Programs',
        detail: 'Open program builder and templates',
        keywords: 'programs templates workouts',
        execute: () => {
          setView('programs');
          closeCommandPalette();
        }
      },
      {
        id: 'action-session',
        type: 'action',
        label: 'Go to Session Mode',
        detail: 'Start and track an active workout session',
        keywords: 'session workout run training',
        execute: () => {
          setView('session');
          closeCommandPalette();
        }
      },
      {
        id: 'action-library',
        type: 'action',
        label: 'Go to Exercise Library',
        detail: 'Browse and edit saved exercises',
        keywords: 'library exercises catalog',
        execute: () => {
          setView('library');
          closeCommandPalette();
        }
      },
      {
        id: 'action-new-client',
        type: 'action',
        label: 'Create New Client',
        detail: 'Open client editor with a blank draft',
        keywords: 'new add client create',
        execute: () => {
          openQuickClientCreate();
          closeCommandPalette();
        }
      },
      {
        id: 'action-new-program',
        type: 'action',
        label: 'Create New Program',
        detail: 'Open program builder',
        keywords: 'new add program create',
        execute: () => {
          setView('programs');
          openNewProgramModal();
          closeCommandPalette();
        }
      }
    ];

    const clientItems: CommandPaletteItem[] = clients
      .filter((client) => !client.archived)
      .map((client) => ({
        id: `client-${client.id}`,
        type: 'client',
        label: client.name,
        detail: `Client | ${client.status || 'Active'} | ${client.goal || 'No goal added'}`,
        keywords: `${client.name} ${client.email} ${client.phone} ${client.goal} ${client.status}`.toLowerCase(),
        execute: () => {
          setView('clients');
          openClientEditor(client);
          closeCommandPalette();
        }
      }));

    const programItems: CommandPaletteItem[] = programs
      .filter((program) => !program.archived)
      .map((program) => {
        const clientName = clients.find((client) => client.id === program.clientId)?.name ?? 'Unassigned';
        return {
          id: `program-${program.id}`,
          type: 'program' as const,
          label: program.title,
          detail: `Program | ${clientName} | ${program.exercises.length} exercises`,
          keywords: `${program.title} ${program.focus} ${program.schedule} ${clientName}`.toLowerCase(),
          execute: () => {
            setView('programs');
            openProgramEditor(program);
            closeCommandPalette();
          }
        };
      });

    const exerciseItems: CommandPaletteItem[] = exercises.map((exercise) => ({
      id: `exercise-${exercise.id}`,
      type: 'exercise',
      label: exercise.name,
      detail: `Exercise | ${exercise.category} | ${exercise.equipment}`,
      keywords: `${exercise.name} ${exercise.category} ${exercise.equipment} ${exercise.notes}`.toLowerCase(),
      execute: () => {
        setView('library');
        openExerciseEditor(exercise);
        closeCommandPalette();
      }
    }));

    const bookingItems: CommandPaletteItem[] = upcomingBookings.slice(0, 20).map((booking) => ({
      id: `booking-${booking.id}`,
      type: 'booking',
      label: `${booking.clientName} - ${booking.title}`,
      detail: `Booking | ${formatDateTime(booking.startAt)}`,
      keywords: `${booking.clientName} ${booking.title} ${booking.notes} booking calendar`.toLowerCase(),
      execute: () => {
        setView('calendar');
        closeCommandPalette();
      }
    }));

    return [...actionItems, ...clientItems, ...programItems, ...exerciseItems, ...bookingItems];
  }, [clients, exercises, programs, upcomingBookings]);

  const commandPaletteResults = useMemo(() => {
    const query = commandPaletteQuery.trim().toLowerCase();
    if (!query) {
      return commandPaletteItems.slice(0, 14);
    }

    return commandPaletteItems
      .filter((item) => {
        const haystack = `${item.label} ${item.detail} ${item.keywords}`.toLowerCase();
        return query.split(/\s+/).every((token) => haystack.includes(token));
      })
      .slice(0, 14);
  }, [commandPaletteItems, commandPaletteQuery]);

  function flash(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 2200);
  }

  function openCommandPalette() {
    setCommandPaletteQuery('');
    setIsCommandPaletteOpen(true);
  }

  function closeCommandPalette() {
    setIsCommandPaletteOpen(false);
  }

  function openUndoWindow(payload: { label: string; kind: 'snapshot' | 'bookings'; bookingsSnapshot?: CalendarBooking[] }) {
    setUndoWindow({
      id: createId('undo-window'),
      label: payload.label,
      kind: payload.kind,
      bookingsSnapshot: payload.bookingsSnapshot,
      expiresAt: Date.now() + 8000
    });
  }

  function applyUndoWindow() {
    if (!undoWindow) {
      return;
    }

    const target = undoWindow;
    setUndoWindow(null);

    if (target.kind === 'snapshot') {
      undoLastSnapshot();
      return;
    }

    if (target.bookingsSnapshot) {
      setBookings(target.bookingsSnapshot.map((booking) => ({ ...booking })));
      flash('Booking change undone.');
    }
  }

  function pushUndoSnapshot(label: string) {
    setUndoSnapshots((current) => [
      {
        id: createId('undo'),
        label,
        clients,
        programs
      },
      ...current
    ].slice(0, 20));
  }

  function undoLastSnapshot() {
    setUndoSnapshots((current) => {
      if (!current.length) {
        return current;
      }

      const [latest, ...rest] = current;
      setClients(latest.clients);
      setPrograms(latest.programs);
      flash(`Undid: ${latest.label}`);
      return rest;
    });
  }

  function applySessionUpdate(transform: (session: ActiveSession) => ActiveSession) {
    if (!activeSession) {
      return;
    }

    setSessionEditHistory((history) => [activeSession, ...history].slice(0, 40));
    setActiveSession(transform(activeSession));
  }

  function undoSessionEdit() {
    setSessionEditHistory((history) => {
      if (!history.length) {
        return history;
      }

      const [latest, ...rest] = history;
      setActiveSession(latest);
      return rest;
    });
  }

  function dismissRecoveredSessionNotice() {
    setShowRecoveredSessionNotice(false);
  }

  function discardActiveSession() {
    if (!activeSession) {
      return;
    }
    if (!window.confirm('Discard this in-progress session?')) {
      return;
    }

    setActiveSession(null);
    setSessionEditHistory([]);
    setShowRecoveredSessionNotice(false);
    flash('In-progress session discarded.');
  }

  function openSecurityModal() {
    setLockPinInput('');
    setNewPinInput('');
    setConfirmPinInput('');
    setIsSecurityModalOpen(true);
  }

  function openQuickClientCreate() {
    openNewClientModal();
    setView('clients');
  }

  function openSessionView() {
    setView('session');
  }

  function openBookingModalForCreate() {
    cancelMoveBooking();
    setCreateBookingModalBaseline(serializeCreateBookingDraft({
      bookingClientId,
      bookingStartAtInput,
      bookingTitle,
      bookingDurationMinutes,
      bookingNotes,
      isRecurringBooking,
      recurringWeeks
    }));
    setIsBookingModalOpen(true);
  }

  function closeBookingModal() {
    if (moveBookingTarget) {
      if (isMoveBookingDirty && !window.confirm('Discard unsaved booking move changes?')) {
        return;
      }
    } else if (isCreateBookingDirty && !window.confirm('Discard unsaved booking changes?')) {
      return;
    }

    cancelMoveBooking();
    setIsBookingModalOpen(false);
  }

  function lockNow() {
    if (!lockHash) {
      flash('Set a PIN first.');
      return;
    }

    setIsUnlocked(false);
    flash('App locked.');
  }

  function unlockApp() {
    if (!lockHash) {
      setIsUnlocked(true);
      return;
    }

    if (hashPin(lockPinInput) !== lockHash) {
      flash('Incorrect PIN.');
      return;
    }

    setIsUnlocked(true);
    setLockPinInput('');
  }

  function savePin() {
    if (!newPinInput || !confirmPinInput) {
      flash('Enter and confirm a PIN.');
      return;
    }

    if (newPinInput !== confirmPinInput) {
      flash('PIN values do not match.');
      return;
    }

    if (!/^\d{4,8}$/.test(newPinInput)) {
      flash('Use a 4 to 8 digit PIN.');
      return;
    }

    const hash = hashPin(newPinInput);
    window.localStorage.setItem(STORAGE_KEYS.lockHash, hash);
    setLockHash(hash);
    setNewPinInput('');
    setConfirmPinInput('');
    setIsSecurityModalOpen(false);
    flash('PIN updated.');
  }

  function removePin() {
    window.localStorage.removeItem(STORAGE_KEYS.lockHash);
    setLockHash('');
    setIsUnlocked(true);
    setIsSecurityModalOpen(false);
    setNewPinInput('');
    setConfirmPinInput('');
    setLockPinInput('');
    flash('PIN removed.');
  }

  function startRestTimer(seconds: number, label: string) {
    const normalizedSeconds = Math.max(1, Math.floor(seconds));
    setRestTimerSeconds(normalizedSeconds);
    setRestTimerLabel(label);
  }

  function cancelRestTimer() {
    setRestTimerSeconds(0);
    setRestTimerLabel('');
  }

  function applyProgramTemplate(templateKey: ProgramTemplateKey) {
    const template = PROGRAM_TEMPLATES[templateKey];
    const templateExercises = createTemplateProgramExercises(templateKey, exercises);
    setProgramDraft((current) => ({
      ...current,
      title: current.title.trim() ? current.title : template.title,
      focus: template.focus,
      schedule: template.schedule,
      notes: template.notes,
      exercises: templateExercises
    }));
    flash(`${template.title} applied.`);
  }

  function addClientCheckIn() {
    if (!checkInDraft.sleepHours && !checkInDraft.steps && !checkInDraft.notes && !checkInDraft.energy && !checkInDraft.stress && !checkInDraft.soreness) {
      flash('Fill at least one check-in field first.');
      return;
    }

    const checkIn = normalizeCheckInRecord(checkInDraft);
    setClientDraft((current) => ({
      ...current,
      checkIns: [...current.checkIns, checkIn]
    }));
    setCheckInDraft(blankCheckIn());
    flash('Check-in added. Save client to keep it.');
  }

  function exportProgressCsv() {
    const payload = buildClientProgressCsv(clients);
    const blob = new Blob([payload], { type: 'text/csv;charset=utf-8' });
    const link = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = link;
    anchor.download = 'superset-client-progress.csv';
    anchor.click();
    URL.revokeObjectURL(link);
    flash('Client progress CSV exported.');
  }

  async function copyClientUpdate(program: Program) {
    const client = clients.find((entry) => entry.id === program.clientId);
    if (!client) {
      flash('Assign a client to the program first.');
      return;
    }

    const text = buildClientUpdateText(client, program, exercises);

    try {
      await navigator.clipboard.writeText(text);
      flash('Client update copied.');
    } catch {
      const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
      const link = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = link;
      anchor.download = `${client.name.replace(/\s+/g, '-').toLowerCase()}-update.txt`;
      anchor.click();
      URL.revokeObjectURL(link);
      flash('Clipboard unavailable, downloaded update file instead.');
    }
  }

  function downloadClientUpdate(program: Program) {
    const client = clients.find((entry) => entry.id === program.clientId);
    if (!client) {
      flash('Assign a client to the program first.');
      return;
    }

    const text = buildClientUpdateText(client, program, exercises);
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const link = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = link;
    anchor.download = `${client.name.replace(/\s+/g, '-').toLowerCase()}-program-update.txt`;
    anchor.click();
    URL.revokeObjectURL(link);
    flash('Client update file downloaded.');
  }

  function printClientSummary(client: Client) {
    const latestMeasurement = client.measurementHistory.slice(-1)[0]?.measurements ?? client.measurements;
    const latestCheckIn = client.checkIns.slice(-1)[0] ?? null;
    const activePrograms = programs.filter((program) => program.clientId === client.id && !program.archived);

    const html = `
      <html>
        <head>
          <title>${client.name} Summary</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #111827; }
            h1, h2 { margin: 0 0 8px; }
            .meta { margin-bottom: 14px; color: #374151; }
            .block { margin-top: 18px; }
            ul { margin: 6px 0 0 18px; }
          </style>
        </head>
        <body>
          <h1>${client.name}</h1>
          <div class="meta">Generated ${new Date().toLocaleString()}</div>

          <div class="block">
            <h2>Client Details</h2>
            <div>Email: ${client.email || '-'}</div>
            <div>Phone: ${client.phone || '-'}</div>
            <div>Goal: ${client.goal || '-'}</div>
          </div>

          <div class="block">
            <h2>Latest Measurements</h2>
            <div>Weight: ${latestMeasurement.bodyWeightKg || '-'} kg</div>
            <div>Body fat: ${latestMeasurement.bodyFatPercent || '-'} %</div>
            <div>Waist: ${latestMeasurement.waistCm || '-'} cm</div>
          </div>

          <div class="block">
            <h2>Latest Check-in</h2>
            ${latestCheckIn
              ? `<div>Date: ${formatDateTime(latestCheckIn.recordedAt)}</div>
                 <div>Sleep: ${latestCheckIn.sleepHours || '-'} h</div>
                 <div>Stress: ${latestCheckIn.stress || '-'}</div>
                 <div>Energy: ${latestCheckIn.energy || '-'}</div>
                 <div>Notes: ${latestCheckIn.notes || '-'}</div>`
              : '<div>No check-ins yet.</div>'}
          </div>

          <div class="block">
            <h2>Active Programs</h2>
            <ul>
              ${activePrograms.length ? activePrograms.map((program) => `<li>${program.title} (${program.schedule || 'No schedule'})</li>`).join('') : '<li>No active program assigned.</li>'}
            </ul>
          </div>
        </body>
      </html>
    `;

    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (!printWindow) {
      flash('Popup blocked. Allow popups to print summary.');
      return;
    }

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  }

  function downloadCalendarFile(fileName: string, calendarName: string, entries: CalendarBooking[]) {
    if (!entries.length) {
      flash('No bookings to export yet.');
      return;
    }

    const payload = buildBookingsIcs(entries, calendarName);
    const blob = new Blob([payload], { type: 'text/calendar;charset=utf-8' });
    const link = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = link;
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(link);
    flash('Calendar file downloaded.');
  }

  function downloadAllBookingsCalendar() {
    const exportable = bookings.filter((booking) => booking.status !== 'cancelled');
    downloadCalendarFile('superset-bookings.ics', 'Superset Bookings', exportable);
  }

  function downloadClientBookingsCalendar(client: Client) {
    const exportable = bookings.filter((booking) => booking.clientId === client.id && booking.status !== 'cancelled');
    const fileLabel = `${client.name.replace(/\s+/g, '-').toLowerCase()}-sessions.ics`;
    downloadCalendarFile(fileLabel, `${client.name} Sessions`, exportable);
  }

  function hasPlannedBookingOverlap(startAt: string, endAt: string, excludedBookingId?: string) {
    const candidateStart = new Date(startAt).getTime();
    const candidateEnd = new Date(endAt).getTime();
    if (Number.isNaN(candidateStart) || Number.isNaN(candidateEnd)) {
      return false;
    }

    return bookings.some((existing) => {
      if (existing.status !== 'planned') {
        return false;
      }
      if (excludedBookingId && existing.id === excludedBookingId) {
        return false;
      }

      const existingStart = new Date(existing.startAt).getTime();
      const existingEnd = new Date(existing.endAt).getTime();
      return candidateStart < existingEnd && candidateEnd > existingStart;
    });
  }

  function addBooking() {
    if (!bookingClientId) {
      flash('Select a client before creating a booking.');
      return;
    }

    const client = clients.find((entry) => entry.id === bookingClientId);
    if (!client) {
      flash('Selected client is no longer available.');
      return;
    }

    const startDate = new Date(bookingStartAtInput);
    if (Number.isNaN(startDate.getTime())) {
      flash('Enter a valid session date and time.');
      return;
    }

    const duration = Number(bookingDurationMinutes);
    if (!Number.isFinite(duration) || duration < 15 || duration > 240) {
      flash('Duration must be between 15 and 240 minutes.');
      return;
    }

    const recurrenceCount = Number(recurringWeeks);
    if (isRecurringBooking && (!Number.isFinite(recurrenceCount) || recurrenceCount < 2 || recurrenceCount > 52)) {
      flash('Recurring weeks must be between 2 and 52.');
      return;
    }

    const startAt = startDate.toISOString();
    const title = bookingTitle.trim() || 'Training Session';
    const createdAt = new Date().toISOString();
    const seriesId = isRecurringBooking ? createId('series') : '';
    const totalOccurrences = isRecurringBooking ? Math.max(2, Math.floor(recurrenceCount)) : 1;

    const createdBookings = Array.from({ length: totalOccurrences }, (_, index) => {
      const occurrenceStart = addDaysToIsoDate(startAt, index * 7);
      return normalizeCalendarBooking({
        id: createId('booking'),
        clientId: client.id,
        clientName: client.name,
        title,
        startAt: occurrenceStart,
        endAt: addMinutesToIsoDate(occurrenceStart, duration),
        status: 'planned',
        notes: bookingNotes.trim(),
        createdAt,
        seriesId,
        recurrence: isRecurringBooking ? 'weekly' : 'none'
      });
    });

    const hasConflict = createdBookings.some((candidate) => hasPlannedBookingOverlap(candidate.startAt, candidate.endAt));

    if (hasConflict) {
      flash('This booking overlaps an existing planned session.');
      return;
    }

    setBookings((current) => [...current, ...createdBookings]);
    setBookingNotes('');
    setBookingTitle('Training Session');
    setIsBookingModalOpen(false);
    if (isRecurringBooking) {
      flash(`Recurring booking added for ${createdBookings.length} weeks.`);
    } else {
      flash('Session booking added to calendar.');
    }
  }

  function setBookingStatus(bookingId: string, status: CalendarBookingStatus) {
    const previousBookings = bookings.map((booking) => ({ ...booking }));

    setBookings((current) =>
      current.map((booking) =>
        booking.id === bookingId
          ? {
              ...booking,
              status
            }
          : booking
      )
    );

    const statusLabel = status === 'cancelled'
      ? 'Booking cancelled.'
      : status === 'completed'
        ? 'Booking marked as completed.'
        : 'Booking moved back to planned.';

    openUndoWindow({
      label: `${statusLabel} Undo available for a few seconds.`,
      kind: 'bookings',
      bookingsSnapshot: previousBookings
    });

    if (status === 'completed') {
      flash('Booking marked as completed.');
    } else if (status === 'cancelled') {
      flash('Booking cancelled.');
    } else {
      flash('Booking moved back to planned.');
    }
  }

  function duplicateBookingToNextWeek(bookingId: string) {
    const source = bookings.find((booking) => booking.id === bookingId);
    if (!source) {
      flash('Booking not found for duplication.');
      return;
    }

    const durationMinutes = Math.max(
      15,
      Math.round((new Date(source.endAt).getTime() - new Date(source.startAt).getTime()) / 60000)
    );
    const nextStartAt = addDaysToIsoDate(source.startAt, 7);

    const duplicate = normalizeCalendarBooking({
      ...source,
      id: createId('booking'),
      startAt: nextStartAt,
      endAt: addMinutesToIsoDate(nextStartAt, durationMinutes),
      status: 'planned',
      createdAt: new Date().toISOString(),
      seriesId: '',
      recurrence: 'none'
    });

    if (hasPlannedBookingOverlap(duplicate.startAt, duplicate.endAt)) {
      flash('Duplicated booking overlaps an existing planned session.');
      return;
    }

    setBookings((current) => [duplicate, ...current]);
    flash(`Booking duplicated to ${formatDateTime(nextStartAt)}.`);
  }

  function startMoveBooking(booking: CalendarBooking) {
    const currentDuration = Math.max(15, Math.round((new Date(booking.endAt).getTime() - new Date(booking.startAt).getTime()) / 60000));
    const nextStartAtInput = toDateTimeLocalValue(booking.startAt);
    setMoveBookingId(booking.id);
    setMoveBookingStartAtInput(nextStartAtInput);
    setMoveBookingDurationMinutes(String(currentDuration));
    setMoveBookingModalBaseline(serializeMoveBookingDraft({
      moveBookingId: booking.id,
      moveBookingStartAtInput: nextStartAtInput,
      moveBookingDurationMinutes: String(currentDuration)
    }));
    setIsBookingModalOpen(true);
  }

  function cancelMoveBooking() {
    setMoveBookingId('');
    setMoveBookingStartAtInput('');
    setMoveBookingDurationMinutes('60');
    setCreateBookingModalBaseline(serializeCreateBookingDraft({
      bookingClientId,
      bookingStartAtInput,
      bookingTitle,
      bookingDurationMinutes,
      bookingNotes,
      isRecurringBooking,
      recurringWeeks
    }));
  }

  function saveMovedBooking() {
    if (!moveBookingId) {
      return;
    }

    const startDate = new Date(moveBookingStartAtInput);
    if (Number.isNaN(startDate.getTime())) {
      flash('Enter a valid date and time to move this booking.');
      return;
    }

    const duration = Number(moveBookingDurationMinutes);
    if (!Number.isFinite(duration) || duration < 15 || duration > 240) {
      flash('Move duration must be between 15 and 240 minutes.');
      return;
    }

    const startAt = startDate.toISOString();
    const endAt = addMinutesToIsoDate(startAt, duration);

    const hasConflict = hasPlannedBookingOverlap(startAt, endAt, moveBookingId);

    if (hasConflict) {
      flash('Moved booking overlaps an existing planned session.');
      return;
    }

    setBookings((current) =>
      current.map((booking) =>
        booking.id === moveBookingId
          ? {
              ...booking,
              startAt,
              endAt,
              status: 'planned'
            }
          : booking
      )
    );

    cancelMoveBooking();
    setIsBookingModalOpen(false);
    flash('Booking moved for this week.');
  }

  function shiftVisibleWeek(weekOffset: number) {
    setVisibleWeekStartIso((currentIso) => {
      const date = new Date(currentIso);
      date.setDate(date.getDate() + weekOffset * 7);
      date.setHours(0, 0, 0, 0);
      return date.toISOString();
    });
  }

  function jumpToCurrentWeek() {
    const todayWeekIso = getWeekStartDate(new Date()).toISOString();
    if (todayWeekIso === visibleWeekStartIso) {
      flash('Already showing current week.');
      return;
    }

    setVisibleWeekStartIso(todayWeekIso);
    flash('Showing current week.');
  }

  function clearClientFilters() {
    setClientSearch('');
    setShowArchivedClients(false);
  }

  function clearProgramFilters() {
    setProgramSearch('');
    setShowArchivedPrograms(false);
  }

  function clearExerciseFilters() {
    setExerciseSearch('');
  }

  function openClientCheckIn(client: Client) {
    setView('clients');
    openClientEditor(client);
  }

  function clearRecentlyEdited() {
    setRecentlyEdited([]);
    flash('Recent edits cleared.');
  }

  function markDueCheckInsReviewed() {
    if (!dueCheckInClientEntries.length) {
      flash('No due check-ins right now.');
      return;
    }

    setDueCheckInDismissals((current) => {
      const next = { ...current };
      dueCheckInClientEntries.forEach((entry) => {
        next[entry.client.id] = entry.marker;
      });
      return next;
    });
    flash('Due check-ins marked as reviewed.');
  }

  function attemptCloseClientModal() {
    if (isClientDirty && !window.confirm('Discard unsaved client changes?')) {
      return;
    }

    setIsClientModalOpen(false);
  }

  function attemptCloseProgramModal() {
    if (isProgramDirty && !window.confirm('Discard unsaved program changes?')) {
      return;
    }

    setIsProgramModalOpen(false);
  }

  function attemptCloseExerciseModal() {
    if (isExerciseDirty && !window.confirm('Discard unsaved exercise changes?')) {
      return;
    }

    setIsExerciseModalOpen(false);
  }

  function trackRecentlyEdited(item: Omit<RecentlyEditedItem, 'editedAt'>) {
    const nextItem: RecentlyEditedItem = {
      ...item,
      editedAt: new Date().toISOString()
    };

    setRecentlyEdited((current) => {
      const deduped = current.filter(
        (entry) => !(entry.entityType === nextItem.entityType && entry.entityId === nextItem.entityId)
      );
      return [nextItem, ...deduped].slice(0, 8);
    });
  }

  function openRecentlyEditedItem(item: RecentlyEditedItem) {
    if (item.entityType === 'client') {
      const client = clients.find((entry) => entry.id === item.entityId);
      if (!client) {
        setRecentlyEdited((current) =>
          current.filter(
            (entry) => !(entry.entityType === item.entityType && entry.entityId === item.entityId)
          )
        );
        flash('Client no longer exists. Removed from recently edited.');
        return;
      }

      setView('clients');
      openClientEditor(client);
      return;
    }

    if (item.entityType === 'program') {
      const program = programs.find((entry) => entry.id === item.entityId);
      if (!program) {
        setRecentlyEdited((current) =>
          current.filter(
            (entry) => !(entry.entityType === item.entityType && entry.entityId === item.entityId)
          )
        );
        flash('Program no longer exists. Removed from recently edited.');
        return;
      }

      setView('programs');
      openProgramEditor(program);
      return;
    }

    const exercise = exercises.find((entry) => entry.id === item.entityId);
    if (!exercise) {
      setRecentlyEdited((current) =>
        current.filter(
          (entry) => !(entry.entityType === item.entityType && entry.entityId === item.entityId)
        )
      );
      flash('Exercise no longer exists. Removed from recently edited.');
      return;
    }

    setView('library');
    openExerciseEditor(exercise);
  }

  function saveClient(saveAndAddAnother = false) {
    if (!clientDraft.name.trim()) {
      flash('Add a client name first.');
      return;
    }

    const recordBase = normalizeClient({ ...clientDraft, id: clientDraft.id || createId('client') });
    const existingClient = clients.find((client) => client.id === recordBase.id);
    const shouldAddSnapshot = existingClient
      ? !measurementsEqual(existingClient.measurements, recordBase.measurements)
      : hasAnyMeasurementValue(recordBase.measurements);

    const measurementHistory = shouldAddSnapshot
      ? [
          ...recordBase.measurementHistory,
          {
            id: createId('ms'),
            recordedAt: new Date().toISOString(),
            measurements: normalizeMeasurements(recordBase.measurements)
          }
        ]
      : recordBase.measurementHistory;

    const record = {
      ...recordBase,
      measurementHistory
    };

    trackRecentlyEdited({
      entityType: 'client',
      entityId: record.id,
      label: record.name,
      detail: record.status || 'Client'
    });

    setClients((current) => {
      const existingIndex = current.findIndex((client) => client.id === record.id);
      if (existingIndex >= 0) {
        const next = [...current];
        next[existingIndex] = record;
        return next;
      }
      return [record, ...current];
    });

    if (saveAndAddAnother) {
      openNewClientModal();
      flash('Client saved. Ready to add another.');
      return;
    }

    setClientDraft(record);
    setSelectedClientId(record.id);
    setIsClientModalOpen(false);
    setClientModalBaseline(serializeClientDraft(record));
    flash('Client saved.');
  }

  function deleteClient(clientId: string) {
    pushUndoSnapshot('archive client');
    setClients((current) =>
      current.map((client) =>
        client.id === clientId
          ? {
              ...client,
              archived: true
            }
          : client
      )
    );
    setPrograms((current) =>
      current.map((program) =>
        program.clientId === clientId
          ? {
              ...program,
              archived: true
            }
          : program
      )
    );
    setClientDraft((current) => ({ ...current, archived: true }));
    setClientModalBaseline(serializeClientDraft({ ...clientDraft, archived: true }));
    setIsClientModalOpen(false);
    flash('Client archived.');
    openUndoWindow({
      label: 'Client archived. Undo available for a few seconds.',
      kind: 'snapshot'
    });
  }

  function restoreClient(clientId: string) {
    pushUndoSnapshot('restore client');
    setClients((current) =>
      current.map((client) =>
        client.id === clientId
          ? {
              ...client,
              archived: false
            }
          : client
      )
    );
    const restored = { ...clientDraft, archived: false };
    setClientDraft(restored);
    setClientModalBaseline(serializeClientDraft(restored));
    setIsClientModalOpen(false);
    flash('Client restored.');
  }

  function updateClientMeasurement(field: keyof ClientMeasurements, value: string) {
    setClientDraft((current) => ({
      ...current,
      measurements: {
        ...current.measurements,
        [field]: value
      }
    }));
  }

  function openClientEditor(client: Client) {
    const normalizedClient = normalizeClient(client);
    setSelectedClientId(normalizedClient.id);
    setClientDraft(normalizedClient);
    setCheckInDraft(blankCheckIn());
    setClientModalBaseline(serializeClientDraft(normalizedClient));
    setIsClientModalOpen(true);
  }

  function openNewClientModal() {
    const emptyClient = blankClient();
    setSelectedClientId('');
    setClientDraft(emptyClient);
    setCheckInDraft(blankCheckIn());
    setClientModalBaseline(serializeClientDraft(emptyClient));
    setIsClientModalOpen(true);
  }

  function saveExercise(saveAndAddAnother = false) {
    if (!exerciseDraft.name.trim()) {
      flash('Add an exercise name first.');
      return;
    }

    const record = { ...exerciseDraft, id: exerciseDraft.id || createId('exercise') };

    trackRecentlyEdited({
      entityType: 'exercise',
      entityId: record.id,
      label: record.name,
      detail: record.category || record.equipment || 'Exercise'
    });

    setExercises((current) => {
      const existingIndex = current.findIndex((exercise) => exercise.id === record.id);
      if (existingIndex >= 0) {
        const next = [...current];
        next[existingIndex] = record;
        return next;
      }
      return [record, ...current];
    });

    if (saveAndAddAnother) {
      openNewExerciseModal();
      flash('Exercise saved. Ready to add another.');
      return;
    }

    setExerciseDraft(record);
    setSelectedExerciseId(record.id);
    setIsExerciseModalOpen(false);
    setExerciseModalBaseline(serializeExerciseDraft(record));
    flash('Exercise saved.');
  }

  function deleteExercise(exerciseId: string) {
    setExercises((current) => current.filter((exercise) => exercise.id !== exerciseId));
    setPrograms((current) =>
      current.map((program) => ({
        ...program,
        exercises: program.exercises.filter((exercise) => exercise.exerciseId !== exerciseId)
      }))
    );
    if (selectedExerciseId === exerciseId) {
      setSelectedExerciseId('');
    }
    setIsExerciseModalOpen(false);
    const emptyExercise = blankExercise();
    setExerciseDraft(emptyExercise);
    setExerciseModalBaseline(serializeExerciseDraft(emptyExercise));
  }

  function openExerciseEditor(exercise: Exercise) {
    setSelectedExerciseId(exercise.id);
    setExerciseDraft(exercise);
    setExerciseModalBaseline(serializeExerciseDraft(exercise));
    setIsExerciseModalOpen(true);
  }

  function openNewExerciseModal() {
    const emptyExercise = blankExercise();
    setSelectedExerciseId('');
    setExerciseDraft(emptyExercise);
    setExerciseModalBaseline(serializeExerciseDraft(emptyExercise));
    setIsExerciseModalOpen(true);
  }

  function saveProgram() {
    if (!programDraft.title.trim()) {
      flash('Add a program title first.');
      return;
    }

    if (!programDraft.clientId) {
      flash('Assign the program to a client.');
      return;
    }

    const record = {
      ...programDraft,
      id: programDraft.id || createId('program'),
      exercises: programDraft.exercises.length ? programDraft.exercises : blankProgram(programDraft.clientId, exercises[0]?.id ?? '').exercises
    };

    const recordClientName = clients.find((client) => client.id === record.clientId)?.name ?? 'Unassigned client';
    trackRecentlyEdited({
      entityType: 'program',
      entityId: record.id,
      label: record.title,
      detail: recordClientName
    });

    setPrograms((current) => {
      const existingIndex = current.findIndex((program) => program.id === record.id);
      if (existingIndex >= 0) {
        const next = [...current];
        next[existingIndex] = record;
        return next;
      }
      return [record, ...current];
    });
    setProgramDraft(record);
    setSelectedProgramId(record.id);
    setSessionProgramId(record.id);
    setIsProgramModalOpen(false);
    setProgramModalBaseline(serializeProgramDraft(record));
    flash('Program saved.');
  }

  function deleteProgram(programId: string) {
    pushUndoSnapshot('archive program');
    setPrograms((current) =>
      current.map((program) =>
        program.id === programId
          ? {
              ...program,
              archived: true
            }
          : program
      )
    );
    const archivedDraft = { ...programDraft, archived: true };
    setProgramDraft(archivedDraft);
    setProgramModalBaseline(serializeProgramDraft(archivedDraft));
    setIsProgramModalOpen(false);
    flash('Program archived.');
    openUndoWindow({
      label: 'Program archived. Undo available for a few seconds.',
      kind: 'snapshot'
    });
  }

  function restoreProgram(programId: string) {
    pushUndoSnapshot('restore program');
    setPrograms((current) =>
      current.map((program) =>
        program.id === programId
          ? {
              ...program,
              archived: false
            }
          : program
      )
    );
    const restoredDraft = { ...programDraft, archived: false };
    setProgramDraft(restoredDraft);
    setProgramModalBaseline(serializeProgramDraft(restoredDraft));
    setIsProgramModalOpen(false);
    flash('Program restored.');
  }

  function duplicateProgram(programId: string) {
    const source = programs.find((program) => program.id === programId);
    if (!source) {
      return;
    }

    const copyDateTag = formatProgramCopyDateTag(new Date());

    const copy: Program = {
      ...source,
      id: createId('program'),
      title: `${source.title} (${copyDateTag})`,
      archived: false,
      exercises: source.exercises.map((exercise) => ({ ...exercise, id: createId('prog-ex') }))
    };

    const copyClientName = clients.find((client) => client.id === copy.clientId)?.name ?? 'Unassigned client';
    trackRecentlyEdited({
      entityType: 'program',
      entityId: copy.id,
      label: copy.title,
      detail: copyClientName
    });

    setPrograms((current) => [copy, ...current]);
    setSelectedProgramId(copy.id);
    setSessionProgramId(copy.id);
    setProgramDraft(copy);
    setProgramModalBaseline(serializeProgramDraft(copy));
    setIsProgramModalOpen(true);
    flash(`Program duplicated as ${copy.title}.`);
  }

  function openProgramEditor(program: Program) {
    setSelectedProgramId(program.id);
    setProgramDraft(program);
    setSessionProgramId(program.id);
    setSessionClientId(program.clientId);
    setProgramModalBaseline(serializeProgramDraft(program));
    setIsProgramModalOpen(true);
  }

  function openNewProgramModal() {
    const emptyProgram = blankProgram(selectedClient?.id ?? clients[0]?.id ?? '', exercises[0]?.id ?? '');
    setSelectedProgramId('');
    setProgramDraft(emptyProgram);
    setProgramModalBaseline(serializeProgramDraft(emptyProgram));
    setIsProgramModalOpen(true);
  }

  function startSession() {
    if (activeSession && !window.confirm('Replace the current in-progress session?')) {
      return;
    }

    const client = clients.find((entry) => entry.id === sessionClientId);
    const program = programs.find((entry) => entry.id === sessionProgramId);

    if (!client || !program) {
      flash('Pick a client and program first.');
      return;
    }

    const entries = program.exercises.map((programExercise) => {
      const exerciseName = exercises.find((exercise) => exercise.id === programExercise.exerciseId)?.name ?? 'Exercise';
      return buildSessionEntry(programExercise, exerciseName);
    });

    setActiveSession({
      clientId: client.id,
      clientName: client.name,
      programId: program.id,
      programName: program.title,
      startedAt: new Date().toISOString(),
      notes: '',
      entries
    });
    setSessionEditHistory([]);
    setShowRecoveredSessionNotice(false);
    flash('Session ready.');
  }

  function pickRecentProgramForSessionClient() {
    if (!sessionClientId) {
      flash('Pick a client first.');
      return;
    }

    const activeProgramsForClient = programs.filter(
      (program) => program.clientId === sessionClientId && !program.archived
    );
    if (!activeProgramsForClient.length) {
      flash('No active programs available for this client.');
      return;
    }

    const activeProgramIds = new Set(activeProgramsForClient.map((program) => program.id));
    const recentProgramId = sessionHistory.find(
      (record) => record.clientId === sessionClientId && activeProgramIds.has(record.programId)
    )?.programId;

    const fallbackProgramId = activeProgramsForClient[0]?.id ?? '';
    const targetProgramId = recentProgramId ?? fallbackProgramId;
    const targetProgram = programs.find((program) => program.id === targetProgramId);

    if (!targetProgram) {
      flash('Unable to load a program for this client.');
      return;
    }

    setSessionProgramId(targetProgram.id);
    if (recentProgramId) {
      flash(`Loaded recent program: ${targetProgram.title}.`);
      return;
    }

    flash(`No recent session found. Loaded: ${targetProgram.title}.`);
  }

  function setPresetReps(entryId: string, setIndex: number, reps: string) {
    updateSetField(entryId, setIndex, 'reps', reps);
  }

  function nudgeSetWeight(entryId: string, setIndex: number, delta: number) {
    if (!activeSession) {
      return;
    }

    const entry = activeSession.entries.find((item) => item.id === entryId);
    const setState = entry?.setStates[setIndex];
    if (!setState) {
      return;
    }

    const parsed = Number.parseFloat((setState.weight || '0').replace(/[^0-9.-]/g, ''));
    const base = Number.isNaN(parsed) ? 0 : parsed;
    const next = Math.max(0, Math.round((base + delta) * 100) / 100);
    updateSetField(entryId, setIndex, 'weight', Number.isInteger(next) ? String(next) : next.toFixed(2));
  }

  function toggleSetCompletion(entryId: string, setIndex: number, completed: boolean) {
    applySessionUpdate((session) => ({
      ...session,
      entries: session.entries.map((entry) => {
        if (entry.id !== entryId) {
          return entry;
        }

        return {
          ...entry,
          setStates: entry.setStates.map((setState, index) =>
            index === setIndex ? { ...setState, completed } : setState
          )
        };
      })
    }));
  }

  function updateSetField(entryId: string, setIndex: number, field: 'reps' | 'weight', value: string) {
    applySessionUpdate((session) => ({
      ...session,
      entries: session.entries.map((entry) => {
        if (entry.id !== entryId) {
          return entry;
        }

        return {
          ...entry,
          setStates: entry.setStates.map((setState, index) =>
            index === setIndex ? { ...setState, [field]: value } : setState
          )
        };
      })
    }));
  }

  function addSessionSet(entryId: string) {
    applySessionUpdate((session) => ({
      ...session,
      entries: session.entries.map((entry) => {
        if (entry.id !== entryId) {
          return entry;
        }

        return {
          ...entry,
          targetSets: entry.targetSets + 1,
          setStates: [...entry.setStates, { completed: false, reps: entry.targetReps, weight: '' }]
        };
      })
    }));
  }

  function removeLastSessionSet(entryId: string) {
    applySessionUpdate((session) => ({
      ...session,
      entries: session.entries.map((entry) => {
        if (entry.id !== entryId) {
          return entry;
        }

        if (entry.setStates.length <= 1) {
          return entry;
        }

        return {
          ...entry,
          targetSets: entry.targetSets - 1,
          setStates: entry.setStates.slice(0, -1)
        };
      })
    }));
  }

  function saveSession() {
    if (!activeSession) {
      return;
    }

    const completedSets = totalCompletedSets(activeSession.entries);
    const completedExercises = activeSession.entries.filter((entry) =>
      entry.setStates.some((setState) => setState.completed)
    ).length;
    const totalReps = activeSession.entries.reduce((sum, entry) => {
      return sum + entry.setStates.reduce((entrySum, setState) => {
        if (!setState.completed) {
          return entrySum;
        }
        const parsedReps = Number.parseFloat((setState.reps || '0').replace(/[^0-9.-]/g, ''));
        return entrySum + (Number.isNaN(parsedReps) ? 0 : parsedReps);
      }, 0);
    }, 0);
    const totalLoadKg = activeSession.entries.reduce((sum, entry) => {
      return sum + entry.setStates.reduce((entrySum, setState) => {
        if (!setState.completed) {
          return entrySum;
        }
        const parsedReps = Number.parseFloat((setState.reps || '0').replace(/[^0-9.-]/g, ''));
        const parsedWeight = Number.parseFloat((setState.weight || '0').replace(/[^0-9.-]/g, ''));
        if (Number.isNaN(parsedReps) || Number.isNaN(parsedWeight)) {
          return entrySum;
        }
        return entrySum + parsedReps * parsedWeight;
      }, 0);
    }, 0);

    setSessionHistory((current) => [
      {
        id: createId('history'),
        clientId: activeSession.clientId,
        clientName: activeSession.clientName,
        programId: activeSession.programId,
        programName: activeSession.programName,
        startedAt: activeSession.startedAt,
        finishedAt: new Date().toISOString(),
        notes: activeSession.notes,
        completedExercises,
        completedSets,
        totalReps,
        totalLoadKg
      },
      ...current
    ]);
    setActiveSession(null);
    setSessionEditHistory([]);
    setShowRecoveredSessionNotice(false);
    flash('Session saved.');
  }

  function exportData() {
    const payload = JSON.stringify(
      {
        version: 1,
        clients,
        exercises,
        programs,
        sessions: sessionHistory,
        bookings
      },
      null,
      2
    );

    const blob = new Blob([payload], { type: 'application/json' });
    const link = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = link;
    anchor.download = 'superset-backup.json';
    anchor.click();
    URL.revokeObjectURL(link);
    flash('Backup downloaded.');
  }

  async function importData(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const text = await file.text();
    const parsed = JSON.parse(text) as ImportedData;
    if (parsed.clients) {
      setClients(parsed.clients.map((client) => normalizeClient(client)));
    }
    if (parsed.exercises) {
      setExercises(parsed.exercises);
    }
    if (parsed.programs) {
      setPrograms(parsed.programs.map((program) => normalizeProgram(program)));
    }
    if (parsed.sessions) {
      setSessionHistory(parsed.sessions.map((record) => normalizeSessionRecord(record)));
    }
    if (parsed.bookings) {
      setBookings(parsed.bookings.map((booking) => normalizeCalendarBooking(booking)));
    }

    flash('Backup imported.');
    event.target.value = '';
  }

  function addProgramExercise() {
    const fallbackExerciseId = exercises[0]?.id ?? '';
    setProgramDraft((current) => ({
      ...current,
      exercises: [
        ...current.exercises,
        {
          id: createId('prog-ex'),
          exerciseId: fallbackExerciseId,
          sets: 3,
          reps: '8',
          rest: '90 sec',
          notes: ''
        }
      ]
    }));
  }

  function updateProgramExercise(exerciseId: string, field: keyof ProgramExercise, value: string | number) {
    setProgramDraft((current) => ({
      ...current,
      exercises: current.exercises.map((exercise) =>
        exercise.id === exerciseId ? { ...exercise, [field]: value } : exercise
      )
    }));
  }

  function removeProgramExercise(exerciseId: string) {
    setProgramDraft((current) => ({
      ...current,
      exercises: current.exercises.filter((exercise) => exercise.id !== exerciseId)
    }));
  }

  const selectedProgramClient = clients.find((client) => client.id === programDraft.clientId) ?? clients[0] ?? null;

  useEffect(() => {
    if (selectedProgramClient && programDraft.clientId !== selectedProgramClient.id) {
      setProgramDraft((current) => ({ ...current, clientId: selectedProgramClient.id }));
    }
  }, [programDraft.clientId, selectedProgramClient]);

  useEffect(() => {
    if (programDraft.clientId && !programs.some((program) => program.clientId === programDraft.clientId) && sessionClientId !== programDraft.clientId) {
      setSessionClientId(programDraft.clientId);
    }
  }, [programDraft.clientId, programs, sessionClientId]);

  useEffect(() => {
    if (sessionClientId && programDraft.clientId !== sessionClientId) {
      const matchingProgram = programs.find((program) => program.clientId === sessionClientId && !program.archived);
      if (matchingProgram) {
        setSessionProgramId(matchingProgram.id);
      }
    }
  }, [programDraft.clientId, programs, sessionClientId]);

  return (
    <div className="app-shell">
      {!isUnlocked ? (
        <div className="lock-screen card">
          <h1>Superset Locked</h1>
          <p>Enter trainer PIN to continue.</p>
          <input
            className="field-input"
            inputMode="numeric"
            maxLength={8}
            type="password"
            value={lockPinInput}
            onChange={(event) => setLockPinInput(event.target.value)}
            placeholder="PIN"
          />
          <div className="actions-row">
            <button className="button button-primary" onClick={unlockApp} type="button">
              Unlock
            </button>
          </div>
        </div>
      ) : null}

      {isUnlocked ? (
        <>
      <header className="hero card">
        <div>
          <div className="hero-title-row">
            <h1>Superset</h1>
            <span className="moment-quote">{momentQuote}</span>
          </div>
          <p className="hero-copy">
            Manage client notes, build workout programs, and run a touch-friendly session view from any browser.
            Data stays in the device unless you export it.
          </p>
        </div>

        <div className="hero-actions">
          <div className="action-drawer card">
            <button className="button button-secondary drawer-toggle" onClick={() => setIsDataDrawerOpen((current) => !current)} type="button">
              {isDataDrawerOpen ? 'Hide data tools' : 'Show data tools'}
            </button>
            {isDataDrawerOpen ? (
              <div className="drawer-content">
                <button className="button button-secondary" onClick={openCommandPalette} type="button">
                  Search everywhere
                </button>
                <button className="button button-primary" onClick={exportData} type="button">
                  Export backup
                </button>
                <button className="button button-secondary" onClick={exportProgressCsv} type="button">
                  Export progress CSV
                </button>
                <button className="button button-secondary" onClick={undoLastSnapshot} disabled={!undoSnapshots.length} type="button">
                  Undo archive action
                </button>
                <button className="button button-secondary" onClick={() => importInputRef.current?.click()} type="button">
                  Import backup
                </button>
              </div>
            ) : null}
          </div>

          <div className="action-drawer card">
            <button className="button button-secondary drawer-toggle" onClick={() => setIsSecurityDrawerOpen((current) => !current)} type="button">
              {isSecurityDrawerOpen ? 'Hide security' : 'Show security'}
            </button>
            {isSecurityDrawerOpen ? (
              <div className="drawer-content">
                <button className="button button-secondary" onClick={openSecurityModal} type="button">
                  Security settings
                </button>
                <button className="button button-secondary" onClick={lockNow} type="button">
                  {lockHash ? 'Lock now' : 'Set PIN to lock'}
                </button>
              </div>
            ) : null}
          </div>
        </div>
        <input ref={importInputRef} accept="application/json" hidden type="file" onChange={importData} />
      </header>

      <nav className="tab-bar card desktop-nav" aria-label="App sections">
        {navItems.map((item) => (
          <button
            key={item.key}
            className={view === item.key ? 'tab active' : 'tab'}
            onClick={() => setView(item.key)}
            aria-label={item.label}
            title={item.label}
            type="button"
          >
            <NavIcon name={item.icon} />
            <span className="nav-tablet-label" aria-hidden="true">{item.mobileLabel}</span>
            <span className="sr-only">{item.label}</span>
          </button>
        ))}
      </nav>

      {notice ? <div className="notice card">{notice}</div> : null}

      {undoWindow ? (
        <div className="undo-window card" role="status" aria-live="polite">
          <p>{undoWindow.label}</p>
          <button className="button button-secondary compact-button" onClick={applyUndoWindow} type="button">
            Undo
          </button>
        </div>
      ) : null}

      {isMobileToolsOpen ? (
        <div className="mobile-sheet-backdrop" role="presentation" onClick={() => setIsMobileToolsOpen(false)}>
          <section className="mobile-tools-sheet card" role="dialog" aria-modal="true" aria-label="Tools menu" onClick={(event) => event.stopPropagation()}>
            <div className="section-heading compact">
              <div>
                <span className="eyebrow">Tools</span>
                <h2>Data and security</h2>
              </div>
            </div>
            <section className="tools-attention-block" aria-label="Items needing attention">
              <p className="tools-attention-title">Needs attention</p>
              {hasToolsAttention ? (
                <>
                  <div className="tools-attention-list">
                    {dueCheckInCount ? <span className="pill">{dueCheckInCount} check-in{dueCheckInCount > 1 ? 's' : ''} due</span> : null}
                    {hasUndoPending ? <span className="pill">Undo archive ready</span> : null}
                  </div>
                  <div className="actions-row">
                    {dueCheckInCount ? (
                      <button
                        className="button button-secondary"
                        onClick={() => {
                          setView('clients');
                          setIsMobileToolsOpen(false);
                        }}
                        type="button"
                      >
                        Review due check-ins
                      </button>
                    ) : null}
                    {dueCheckInCount ? (
                      <button
                        className="button button-secondary"
                        onClick={() => {
                          markDueCheckInsReviewed();
                          setIsMobileToolsOpen(false);
                        }}
                        type="button"
                      >
                        Mark reviewed
                      </button>
                    ) : null}
                    {hasUndoPending ? (
                      <button
                        className="button button-secondary"
                        onClick={() => {
                          undoLastSnapshot();
                          setIsMobileToolsOpen(false);
                        }}
                        type="button"
                      >
                        Apply undo now
                      </button>
                    ) : null}
                  </div>
                </>
              ) : (
                <p className="empty-copy">All clear right now.</p>
              )}
            </section>
            <div className="drawer-content">
              <button className="button button-secondary" onClick={() => { openCommandPalette(); setIsMobileToolsOpen(false); }} type="button">
                Search everywhere
              </button>
              <button className="button button-primary" onClick={() => { exportData(); setIsMobileToolsOpen(false); }} type="button">
                Export backup
              </button>
              <button className="button button-secondary" onClick={() => { exportProgressCsv(); setIsMobileToolsOpen(false); }} type="button">
                Export progress CSV
              </button>
              <button className="button button-secondary" onClick={() => { undoLastSnapshot(); setIsMobileToolsOpen(false); }} disabled={!hasUndoPending} type="button">
                Undo archive action
              </button>
              <button className="button button-secondary" onClick={() => { importInputRef.current?.click(); setIsMobileToolsOpen(false); }} type="button">
                Import backup
              </button>
              <button className="button button-secondary" onClick={() => { openSecurityModal(); setIsMobileToolsOpen(false); }} type="button">
                Security settings
              </button>
              <button className="button button-secondary" onClick={() => { lockNow(); setIsMobileToolsOpen(false); }} type="button">
                {lockHash ? 'Lock now' : 'Set PIN to lock'}
              </button>
              <button className="button button-secondary" onClick={() => setIsMobileToolsOpen(false)} type="button">
                Close tools
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {isSecurityModalOpen ? (
        <div className="modal-backdrop" role="presentation" onClick={() => setIsSecurityModalOpen(false)}>
          <section className="modal card" role="dialog" aria-modal="true" aria-label="Security settings" onClick={(event) => event.stopPropagation()}>
            <div className="section-heading">
              <div>
                <span className="eyebrow">Security</span>
                <h2>Trainer PIN Lock</h2>
              </div>
            </div>
            <div className="form-grid two-up">
              <Field label="New PIN (4-8 digits)" value={newPinInput} onChange={setNewPinInput} />
              <Field label="Confirm PIN" value={confirmPinInput} onChange={setConfirmPinInput} />
            </div>
            <div className="actions-row">
              <button className="button button-primary" onClick={savePin} type="button">
                Save PIN
              </button>
              {lockHash ? (
                <button className="button button-danger" onClick={removePin} type="button">
                  Remove PIN
                </button>
              ) : null}
              <button className="button button-secondary" onClick={() => setIsSecurityModalOpen(false)} type="button">
                Close
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {isCommandPaletteOpen ? (
        <div className="modal-backdrop" role="presentation" onClick={closeCommandPalette}>
          <section
            className="modal card command-palette"
            role="dialog"
            aria-modal="true"
            aria-label="Search everywhere"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="section-heading compact">
              <div>
                <span className="eyebrow">Search</span>
                <h2>Command palette</h2>
              </div>
              <button className="button button-secondary compact-button" onClick={closeCommandPalette} type="button">
                Close
              </button>
            </div>

            <input
              ref={commandPaletteInputRef}
              className="field-input command-palette-input"
              value={commandPaletteQuery}
              onChange={(event) => setCommandPaletteQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && commandPaletteResults[0]) {
                  event.preventDefault();
                  commandPaletteResults[0].execute();
                }
              }}
              placeholder="Search clients, programs, exercises, bookings, or actions..."
            />

            <div className="command-palette-results">
              {commandPaletteResults.length ? (
                commandPaletteResults.map((item) => (
                  <button className="item-row command-palette-item" key={item.id} onClick={item.execute} type="button">
                    <div>
                      <strong>{item.label}</strong>
                      <p>{item.detail}</p>
                    </div>
                    <span className="pill">{item.type}</span>
                  </button>
                ))
              ) : (
                <p className="empty-copy">No matches found. Try another search phrase.</p>
              )}
            </div>
          </section>
        </div>
      ) : null}

      <main className="content-grid">
        {view === 'dashboard' ? (
          <>
            <section className="panel card panel-span-2">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">At a glance</span>
                  <h2>Training studio overview</h2>
                </div>
                <p className="section-copy">Everything you need to keep a coaching day moving on one screen.</p>
              </div>

              <div className="stats-grid">
                {dashboardStats.map((stat) => (
                  <article className="stat-card" key={stat.label}>
                    <span className="stat-label">{stat.label}</span>
                    <strong>{stat.value}</strong>
                    <span className="stat-note">{stat.note}</span>
                  </article>
                ))}
              </div>
            </section>

            <section className="panel card">
              <div className="section-heading compact">
                <div>
                  <span className="eyebrow">Today</span>
                  <h2>Quick actions</h2>
                </div>
              </div>
              <div className="quick-stack">
                <button className="button button-primary full-width" onClick={() => setView('clients')} type="button">
                  Add or edit clients
                </button>
                <button className="button button-secondary full-width" onClick={() => setView('programs')} type="button">
                  Build a new program
                </button>
                <button className="button button-secondary full-width" onClick={() => setView('session')} type="button">
                  Run a session
                </button>
                <button className="button button-secondary full-width" onClick={() => setView('calendar')} type="button">
                  Open calendar planner
                </button>
              </div>
            </section>

            <section className="panel card">
              <div className="section-heading compact">
                <div>
                  <span className="eyebrow">Calendar</span>
                  <h2>Upcoming sessions</h2>
                </div>
                <span className="pill">{upcomingBookings.length} upcoming</span>
              </div>

              <div className="record-list">
                {upcomingBookings.length ? (
                  upcomingBookings.slice(0, 3).map((booking) => (
                    <article className="record-row" key={booking.id}>
                      <div>
                        <strong>{booking.clientName}</strong>
                        <p>{booking.title} • {formatDateTime(booking.startAt)}</p>
                      </div>
                      <span className="pill">{booking.recurrence === 'weekly' ? 'Weekly' : 'Planned'}</span>
                    </article>
                  ))
                ) : (
                  <p className="empty-copy">No upcoming sessions scheduled yet.</p>
                )}
              </div>

              <div className="actions-row">
                <button className="button button-secondary" onClick={() => setView('calendar')} type="button">
                  Manage all bookings
                </button>
              </div>
            </section>

            <section className="panel card">
              <div className="section-heading compact">
                <div>
                  <span className="eyebrow">Recent sessions</span>
                  <h2>Saved workout history</h2>
                </div>
              </div>

              <div className="record-list">
                {sessionHistory.length ? (
                  sessionHistory.slice(0, 4).map((record) => (
                    <article className="record-row" key={record.id}>
                      <div>
                        <strong>{record.clientName}</strong>
                        <p>{record.programName}</p>
                      </div>
                      <div>
                        <span>{record.completedExercises} exercises</span>
                        <span>{record.completedSets} sets</span>
                      </div>
                    </article>
                  ))
                ) : (
                  <p className="empty-copy">No sessions saved yet. Your first run will appear here.</p>
                )}
              </div>
            </section>

            <section className="panel card">
              <div className="section-heading compact">
                <div>
                  <span className="eyebrow">Recent edits</span>
                  <h2>Jump back in fast</h2>
                </div>
              </div>

              <div className="recent-edits-controls">
                <div className="recent-edits-filter-group">
                  {(['all', 'client', 'program', 'exercise'] as RecentlyEditedFilter[]).map((filterKey) => (
                    <button
                      key={filterKey}
                      className={recentlyEditedFilter === filterKey ? 'button button-secondary compact-button recent-filter-button active' : 'button button-secondary compact-button recent-filter-button'}
                      onClick={() => setRecentlyEditedFilter(filterKey)}
                      type="button"
                    >
                      {filterKey === 'all' ? 'All' : `${filterKey}s`}
                    </button>
                  ))}
                </div>
                <button
                  className="button button-secondary compact-button"
                  onClick={clearRecentlyEdited}
                  disabled={!recentlyEdited.length}
                  type="button"
                >
                  Clear recent
                </button>
              </div>

              <div className="record-list">
                {filteredRecentlyEdited.length ? (
                  filteredRecentlyEdited.map((item) => (
                    <button
                      className="item-row"
                      key={`${item.entityType}-${item.entityId}`}
                      onClick={() => openRecentlyEditedItem(item)}
                      type="button"
                    >
                      <div>
                        <strong>{item.label}</strong>
                        <p>{item.detail}</p>
                      </div>
                      <div className="recent-item-meta">
                        <span className="pill">{item.entityType}</span>
                        <span className="muted-text">{formatDateTime(item.editedAt)}</span>
                      </div>
                    </button>
                  ))
                ) : recentlyEdited.length ? (
                  <p className="empty-copy">No {recentlyEditedFilter === 'all' ? '' : `${recentlyEditedFilter} `}items in this filter.</p>
                ) : (
                  <p className="empty-copy">Save a client, program, or exercise to pin it here for quick reopen.</p>
                )}
              </div>
            </section>

            <section className="panel card">
              <div className="section-heading compact">
                <div>
                  <span className="eyebrow">Weekly reminders</span>
                  <h2>Check-ins due</h2>
                </div>
              </div>
              <div className="record-list">
                {dueCheckInClients.length ? (
                  dueCheckInClients.slice(0, 5).map((client) => (
                    <article className="record-row" key={client.id}>
                      <div>
                        <strong>{client.name}</strong>
                        <p>{client.goal || 'No goal added'}</p>
                      </div>
                      <span className="pill">Due</span>
                    </article>
                  ))
                ) : (
                  <p className="empty-copy">No clients due this week.</p>
                )}
              </div>
            </section>

            <section className="panel card panel-span-2">
              <div className="section-heading compact">
                <div>
                  <span className="eyebrow">Trends</span>
                  <h2>Session volume and load (last 6 weeks)</h2>
                </div>
              </div>
              <div className="trend-list">
                {sessionTrendRows.length ? (
                  sessionTrendRows.map((row) => (
                    <article className="trend-row" key={row.label}>
                      <strong>{row.label}</strong>
                      <span>{row.completedSets} sets</span>
                      <span>{row.totalReps} reps</span>
                      <span>{Math.round(row.totalLoadKg)} kg load</span>
                      <div className="trend-bar-track">
                        <div className="trend-bar-fill" style={{ width: `${Math.max((row.totalLoadKg / maxTrendLoad) * 100, 6)}%` }} />
                      </div>
                    </article>
                  ))
                ) : (
                  <p className="empty-copy">Save sessions with set weight to see load trends.</p>
                )}
              </div>
            </section>

            <section className="panel card panel-span-2">
              <div className="section-heading compact">
                <div>
                  <span className="eyebrow">Analytics</span>
                  <h2>Coaching metrics at a glance</h2>
                </div>
              </div>
              <div className="stats-grid">
                {analyticsCards.map((card) => (
                  <article className="stat-card" key={card.label}>
                    <span className="stat-label">{card.label}</span>
                    <strong>{card.value}</strong>
                    <span className="stat-note">{card.note}</span>
                  </article>
                ))}
              </div>
            </section>
          </>
        ) : null}

        {view === 'calendar' ? (
          <>
            <section className="panel card panel-span-2">
              <div className="section-heading compact">
                <div>
                  <span className="eyebrow">Calendar</span>
                  <h2>Schedule sessions</h2>
                </div>
                <span className="pill">{upcomingBookings.length} upcoming</span>
              </div>

              <section className="week-scheduler">
                <div className="section-heading compact">
                  <div>
                    <span className="eyebrow">Current week</span>
                    <h3>{visibleWeekLabel}</h3>
                  </div>
                  <div className="actions-row">
                    <button className="button button-secondary compact-button" onClick={() => shiftVisibleWeek(-1)} type="button">
                      Prev
                    </button>
                    <button className="button button-secondary compact-button" onClick={jumpToCurrentWeek} type="button">
                      Today
                    </button>
                    <button className="button button-secondary compact-button" onClick={() => shiftVisibleWeek(1)} type="button">
                      Next
                    </button>
                  </div>
                </div>

                <div className="week-scheduler-scroll">
                  <div className="week-scheduler-grid">
                    <div className="week-time-header" />
                    {visibleWeekDays.map((day) => {
                      const dayBookings = weekBookingsByDay.get(day.key) ?? [];
                      return (
                        <header className={day.isToday ? 'week-day-header is-today' : 'week-day-header'} key={day.key}>
                          <strong>{day.weekdayLabel}</strong>
                          <span>{day.dateLabel}</span>
                          <em>{dayBookings.length} bookings</em>
                        </header>
                      );
                    })}

                    <div className="week-time-rail">
                      {weekTimeSlots.map((slot) => (
                        <span
                          className="week-time-label"
                          key={slot.hour}
                          style={{ top: `${((slot.hour - DAY_START_HOUR) / (DAY_END_HOUR - DAY_START_HOUR)) * 100}%` }}
                        >
                          {slot.label}
                        </span>
                      ))}
                    </div>

                    {visibleWeekDays.map((day) => {
                      const dayBookings = weekBookingsByDay.get(day.key) ?? [];
                      return (
                        <div className={day.isToday ? 'week-day-track is-today' : 'week-day-track'} key={`${day.key}-track`}>
                          {weekTimeSlots.map((slot) => (
                            <span
                              className="week-hour-line"
                              key={`${day.key}-${slot.hour}`}
                              style={{ top: `${((slot.hour - DAY_START_HOUR) / (DAY_END_HOUR - DAY_START_HOUR)) * 100}%` }}
                            />
                          ))}
                          {dayBookings.map((booking) => {
                            const start = new Date(booking.startAt);
                            const end = new Date(booking.endAt);
                            const dayStartMinutes = DAY_START_HOUR * 60;
                            const dayEndMinutes = DAY_END_HOUR * 60;
                            const startMinutes = start.getHours() * 60 + start.getMinutes();
                            const endMinutes = end.getHours() * 60 + end.getMinutes();
                            const clampedStart = Math.max(startMinutes, dayStartMinutes);
                            const clampedEnd = Math.min(Math.max(endMinutes, clampedStart + 20), dayEndMinutes);
                            const top = ((clampedStart - dayStartMinutes) / (dayEndMinutes - dayStartMinutes)) * 100;
                            const height = ((clampedEnd - clampedStart) / (dayEndMinutes - dayStartMinutes)) * 100;

                            return (
                              <button
                                className="week-booking-block"
                                key={booking.id}
                                onClick={() => startMoveBooking(booking)}
                                style={{ top: `${top}%`, height: `${Math.max(height, 5)}%` }}
                                type="button"
                              >
                                <span>{formatTimeOnly(booking.startAt)}</span>
                                <strong>{booking.clientName}</strong>
                              </button>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </section>

              <div className="calendar-actions-row">
                <button className="button button-primary" onClick={openBookingModalForCreate} type="button" disabled={!clientOptionValues.length}>
                  New booking
                </button>
                <button className="button button-secondary" onClick={downloadAllBookingsCalendar} type="button" disabled={!bookings.length}>
                  Export calendar (.ics)
                </button>
              </div>

              <div className="record-list">
                {upcomingBookings.length ? (
                  upcomingBookings.slice(0, 12).map((booking) => (
                    <article className="record-row" key={booking.id}>
                      <div>
                        <strong>{booking.clientName}</strong>
                        <p>{booking.title} • {formatDateTime(booking.startAt)}</p>
                      </div>
                      <div className="session-set-actions">
                        <span className="pill">Planned</span>
                        {booking.recurrence === 'weekly' ? <span className="pill">Weekly</span> : null}
                        <button
                          className="button button-secondary compact-button"
                          onClick={() => duplicateBookingToNextWeek(booking.id)}
                          type="button"
                        >
                          Duplicate +1 week
                        </button>
                        <button className="button button-secondary compact-button" onClick={() => startMoveBooking(booking)} type="button">
                          Move week
                        </button>
                        <button className="button button-secondary compact-button" onClick={() => setBookingStatus(booking.id, 'completed')} type="button">
                          Complete
                        </button>
                        <button className="button button-danger compact-button" onClick={() => setBookingStatus(booking.id, 'cancelled')} type="button">
                          Cancel
                        </button>
                      </div>
                    </article>
                  ))
                ) : (
                  <p className="empty-copy">No upcoming sessions scheduled yet.</p>
                )}
              </div>
            </section>

            {isBookingModalOpen ? (
              <div className="modal-backdrop" role="presentation" onClick={closeBookingModal}>
                <section className="modal card" role="dialog" aria-modal="true" aria-label="Booking editor" onClick={(event) => event.stopPropagation()}>
                  <div className="section-heading compact">
                    <div>
                      <span className="eyebrow">Calendar booking</span>
                      <h2>{moveBookingTarget ? 'Move booking' : 'Create booking'}</h2>
                    </div>
                    <button className="button button-secondary compact-button" onClick={closeBookingModal} type="button">
                      Close
                    </button>
                  </div>

                  {moveBookingTarget ? (
                    <section className="tools-attention-block">
                      <p className="tools-attention-title">Move one weekly booking</p>
                      <p className="empty-copy">
                        Updating <strong>{moveBookingTarget.clientName}</strong> on {formatDateTime(moveBookingTarget.startAt)} only.
                      </p>
                      <div className="form-grid two-up">
                        <label className="field">
                          <span>New date and time</span>
                          <input
                            className="field-input"
                            type="datetime-local"
                            value={moveBookingStartAtInput}
                            onChange={(event) => setMoveBookingStartAtInput(event.target.value)}
                          />
                        </label>
                        <label className="field">
                          <span>Duration (minutes)</span>
                          <input
                            className="field-input"
                            type="number"
                            min={15}
                            max={240}
                            step={5}
                            value={moveBookingDurationMinutes}
                            onChange={(event) => setMoveBookingDurationMinutes(event.target.value)}
                          />
                        </label>
                      </div>
                      <div className="booking-modal-actions">
                        <button className="button button-primary" onClick={saveMovedBooking} type="button" disabled={Boolean(moveBookingConflictNotice)}>
                          Save moved week
                        </button>
                        <button className="button button-secondary" onClick={cancelMoveBooking} type="button">
                          Clear move target
                        </button>
                      </div>
                      {moveBookingConflictNotice ? <p className="inline-warning">{moveBookingConflictNotice}</p> : null}
                    </section>
                  ) : null}

                  {!moveBookingTarget ? (
                    <>
                      <div className="form-grid two-up">
                        <SelectField
                          label="Client"
                          value={bookingClientId}
                          options={clientOptionValues}
                          onChange={setBookingClientId}
                        />
                        <label className="field">
                          <span>Session date and time</span>
                          <input
                            className="field-input"
                            type="datetime-local"
                            value={bookingStartAtInput}
                            onChange={(event) => setBookingStartAtInput(event.target.value)}
                          />
                        </label>
                        <Field label="Session title" value={bookingTitle} onChange={setBookingTitle} />
                        <label className="field">
                          <span>Duration (minutes)</span>
                          <input
                            className="field-input"
                            type="number"
                            min={15}
                            max={240}
                            step={5}
                            value={bookingDurationMinutes}
                            onChange={(event) => setBookingDurationMinutes(event.target.value)}
                          />
                        </label>
                      </div>

                      <div className="form-grid two-up">
                        <label className="toggle-row">
                          <input
                            checked={isRecurringBooking}
                            onChange={(event) => setIsRecurringBooking(event.target.checked)}
                            type="checkbox"
                          />
                          <span>Repeat weekly</span>
                        </label>
                        {isRecurringBooking ? (
                          <label className="field">
                            <span>How many weeks</span>
                            <input
                              className="field-input"
                              type="number"
                              min={2}
                              max={52}
                              value={recurringWeeks}
                              onChange={(event) => setRecurringWeeks(event.target.value)}
                            />
                          </label>
                        ) : (
                          <div />
                        )}
                      </div>

                      <Field label="Booking notes" value={bookingNotes} onChange={setBookingNotes} textarea />

                      <div className="booking-modal-actions">
                        <button
                          className="button button-primary"
                          onClick={addBooking}
                          type="button"
                          disabled={!clientOptionValues.length || !bookingClientId || Boolean(bookingConflictNotice)}
                        >
                          {isRecurringBooking ? 'Add recurring booking' : 'Add booking'}
                        </button>
                        <button className="button button-secondary" onClick={closeBookingModal} type="button">
                          Cancel
                        </button>
                      </div>
                      {recurringBookingSummary && !bookingConflictNotice ? <p className="booking-helper muted-text">{recurringBookingSummary}</p> : null}
                      {bookingConflictNotice ? <p className="inline-warning">{bookingConflictNotice}</p> : null}
                      {bookingConflictSuggestions.length ? (
                        <div className="booking-suggestion-row">
                          <span className="muted-text">Try next free slot:</span>
                          {bookingConflictSuggestions.map((isoValue) => (
                            <button
                              key={isoValue}
                              className="button button-secondary compact-button"
                              onClick={() => setBookingStartAtInput(toDateTimeLocalValue(isoValue))}
                              type="button"
                            >
                              {formatDateTime(isoValue)}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </>
                  ) : null}
                </section>
              </div>
            ) : null}
          </>
        ) : null}

        {view === 'clients' ? (
          <>
            <section className="panel card panel-span-2">
              <div className="section-heading compact">
                <div>
                  <span className="eyebrow">Clients</span>
                  <h2>Client list</h2>
                </div>
                <button className="button button-primary" onClick={openNewClientModal} type="button">
                  Add client
                </button>
              </div>

              <input
                className="field-input search-input"
                value={clientSearch}
                onChange={(event) => setClientSearch(event.target.value)}
                placeholder="Search clients by name, status, goal, email..."
              />

              <label className="toggle-row">
                <input
                  checked={showArchivedClients}
                  onChange={(event) => setShowArchivedClients(event.target.checked)}
                  type="checkbox"
                />
                <span>Show archived clients</span>
              </label>

              <div className="filter-summary-row">
                <p className="section-copy">Showing {filteredClients.length} of {visibleClientCount} clients</p>
                <button
                  className="button button-secondary compact-button"
                  onClick={clearClientFilters}
                  disabled={!hasClientFilters}
                  type="button"
                >
                  Clear filters
                </button>
              </div>

              <section className="tools-attention-block clients-due-card">
                <div className="section-heading compact">
                  <div>
                    <span className="eyebrow">Client workflow</span>
                    <h3>Due check-ins</h3>
                  </div>
                  <span className="pill">{dueCheckInClients.length} due</span>
                </div>

                <div className="record-list">
                  {dueCheckInClients.length ? (
                    dueCheckInClients.slice(0, 6).map((client) => (
                      <article className="record-row" key={`due-client-${client.id}`}>
                        <div>
                          <strong>{client.name}</strong>
                          <p>{client.goal || 'No goal added'}</p>
                        </div>
                        <div className="session-set-actions">
                          <span className="pill">Due</span>
                          <button
                            className="button button-secondary compact-button"
                            onClick={() => openClientCheckIn(client)}
                            type="button"
                          >
                            Log check-in now
                          </button>
                        </div>
                      </article>
                    ))
                  ) : (
                    <p className="empty-copy">No client check-ins due right now.</p>
                  )}
                </div>
              </section>

              <section className="tools-attention-block clients-timeline-card">
                <div className="section-heading compact">
                  <div>
                    <span className="eyebrow">Client timeline</span>
                    <h3>Progress and activity feed</h3>
                  </div>
                  <span className="pill">{clientTimelineEvents.length} events</span>
                </div>

                <div className="timeline-controls">
                  <SelectField
                    label="Timeline client"
                    value={timelineClientId}
                    options={clientOptionValues}
                    onChange={setTimelineClientId}
                  />
                </div>

                <div className="history-list">
                  {clientTimelineEvents.length ? (
                    clientTimelineEvents.slice(0, 18).map((event) => (
                      <article className="history-row" key={event.id}>
                        <strong>{formatDateTime(event.occurredAt)}</strong>
                        <span className={`timeline-kind timeline-kind-${event.kind}`}>{event.kindLabel}</span>
                        <span>{event.title}</span>
                        <span>{event.detail}</span>
                      </article>
                    ))
                  ) : (
                    <p className="empty-copy">No timeline activity yet for this client.</p>
                  )}
                </div>
              </section>

              <div className="item-list">
                {filteredClients.map((client) => (
                  <button
                    key={client.id}
                    className={selectedClientId === client.id ? 'item-row active' : 'item-row'}
                    onClick={() => openClientEditor(client)}
                    type="button"
                  >
                    <div>
                      <strong>{client.name}</strong>
                      <p>{client.goal}</p>
                    </div>
                    <span className="pill">{client.archived ? 'Archived' : client.status}</span>
                  </button>
                ))}
                {filteredClients.length === 0 ? <p className="empty-copy">No clients match this filter.</p> : null}
              </div>
            </section>

            {isClientModalOpen ? (
              <div className="modal-backdrop" role="presentation" onClick={attemptCloseClientModal}>
                <section
                  className="modal card"
                  role="dialog"
                  aria-modal="true"
                  aria-label="Client editor"
                  onClick={(event) => event.stopPropagation()}
                >
                  <div className="section-heading">
                    <div>
                      <span className="eyebrow">Client editor</span>
                      <h2>{clientDraft.id ? 'Edit client' : 'Create client'}</h2>
                    </div>
                    <button className="button button-secondary compact-button" onClick={attemptCloseClientModal} type="button">
                      Close
                    </button>
                  </div>

                  <div className="form-grid two-up">
                    <Field label="Name" value={clientDraft.name} onChange={(value) => setClientDraft({ ...clientDraft, name: value })} />
                    <Field label="Email" value={clientDraft.email} onChange={(value) => setClientDraft({ ...clientDraft, email: value })} />
                    <Field label="Phone" value={clientDraft.phone} onChange={(value) => setClientDraft({ ...clientDraft, phone: value })} />
                    <Field label="Status" value={clientDraft.status} onChange={(value) => setClientDraft({ ...clientDraft, status: value })} />
                  </div>

                  <div className="section-heading compact">
                    <div>
                      <span className="eyebrow">Measurements</span>
                      <h3>Body stats</h3>
                    </div>
                  </div>

                  <div className="form-grid two-up">
                    <Field label="Body weight (kg)" value={clientDraft.measurements.bodyWeightKg} onChange={(value) => updateClientMeasurement('bodyWeightKg', value)} />
                    <Field label="Height (cm)" value={clientDraft.measurements.heightCm} onChange={(value) => updateClientMeasurement('heightCm', value)} />
                    <Field label="Body fat (%)" value={clientDraft.measurements.bodyFatPercent} onChange={(value) => updateClientMeasurement('bodyFatPercent', value)} />
                    <Field label="Chest (cm)" value={clientDraft.measurements.chestCm} onChange={(value) => updateClientMeasurement('chestCm', value)} />
                    <Field label="Waist (cm)" value={clientDraft.measurements.waistCm} onChange={(value) => updateClientMeasurement('waistCm', value)} />
                    <Field label="Hips (cm)" value={clientDraft.measurements.hipsCm} onChange={(value) => updateClientMeasurement('hipsCm', value)} />
                    <Field label="Arm (cm)" value={clientDraft.measurements.armCm} onChange={(value) => updateClientMeasurement('armCm', value)} />
                    <Field label="Thigh (cm)" value={clientDraft.measurements.thighCm} onChange={(value) => updateClientMeasurement('thighCm', value)} />
                    <Field label="Calf (cm)" value={clientDraft.measurements.calfCm} onChange={(value) => updateClientMeasurement('calfCm', value)} />
                  </div>

                  <div className="section-heading compact">
                    <div>
                      <span className="eyebrow">Measurement timeline</span>
                      <h3>Recent check-ins</h3>
                    </div>
                  </div>

                  <div className="history-list">
                    {clientDraft.measurementHistory.slice(-6).reverse().map((snapshot) => (
                      <article className="history-row" key={snapshot.id}>
                        <strong>{formatDateTime(snapshot.recordedAt)}</strong>
                        <span>Weight: {snapshot.measurements.bodyWeightKg || '-'} kg</span>
                        <span>Body fat: {snapshot.measurements.bodyFatPercent || '-'}%</span>
                        <span>Waist: {snapshot.measurements.waistCm || '-'} cm</span>
                      </article>
                    ))}
                    {clientDraft.measurementHistory.length === 0 ? (
                      <p className="empty-copy">No measurement history yet. Saving new measurements adds a check-in snapshot.</p>
                    ) : null}
                  </div>

                  <div className="section-heading compact">
                    <div>
                      <span className="eyebrow">Client check-in</span>
                      <h3>Wellness questionnaire</h3>
                    </div>
                    <button className="button button-secondary compact-button" onClick={addClientCheckIn} type="button">
                      Add check-in
                    </button>
                  </div>

                  <div className="form-grid two-up">
                    <Field label="Sleep hours" value={checkInDraft.sleepHours} onChange={(value) => setCheckInDraft({ ...checkInDraft, sleepHours: value })} />
                    <Field label="Steps" value={checkInDraft.steps} onChange={(value) => setCheckInDraft({ ...checkInDraft, steps: value })} />
                    <Field label="Stress (1-5)" value={checkInDraft.stress} onChange={(value) => setCheckInDraft({ ...checkInDraft, stress: value })} />
                    <Field label="Soreness (1-5)" value={checkInDraft.soreness} onChange={(value) => setCheckInDraft({ ...checkInDraft, soreness: value })} />
                    <Field label="Energy (1-5)" value={checkInDraft.energy} onChange={(value) => setCheckInDraft({ ...checkInDraft, energy: value })} />
                    <Field label="Check-in date" value={checkInDraft.recordedAt.slice(0, 10)} onChange={(value) => setCheckInDraft({ ...checkInDraft, recordedAt: `${value}T09:00:00.000Z` })} />
                  </div>

                  <Field label="Check-in notes" value={checkInDraft.notes} onChange={(value) => setCheckInDraft({ ...checkInDraft, notes: value })} textarea />

                  <div className="history-list">
                    {clientDraft.checkIns.slice(-5).reverse().map((checkIn) => (
                      <article className="history-row" key={checkIn.id}>
                        <strong>{formatDateTime(checkIn.recordedAt)}</strong>
                        <span>Sleep: {checkIn.sleepHours || '-'} h</span>
                        <span>Stress: {checkIn.stress || '-'}</span>
                        <span>Energy: {checkIn.energy || '-'}</span>
                        <span>Steps: {checkIn.steps || '-'}</span>
                      </article>
                    ))}
                  </div>

                  <Field label="Goal" value={clientDraft.goal} onChange={(value) => setClientDraft({ ...clientDraft, goal: value })} textarea />
                  <Field label="Notes" value={clientDraft.notes} onChange={(value) => setClientDraft({ ...clientDraft, notes: value })} textarea />

                  <div className="actions-row">
                    <button className="button button-primary" onClick={() => saveClient()} type="button">
                      Save client
                    </button>
                    {!clientDraft.id ? (
                      <button className="button button-secondary" onClick={() => saveClient(true)} type="button">
                        Save and add another
                      </button>
                    ) : null}
                    {clientDraft.id ? (
                      <button
                        className="button button-danger"
                        onClick={() => (clientDraft.archived ? restoreClient(clientDraft.id) : deleteClient(clientDraft.id))}
                        type="button"
                      >
                        {clientDraft.archived ? 'Restore client' : 'Archive client'}
                      </button>
                    ) : null}
                    {clientDraft.id ? (
                      <button className="button button-secondary" onClick={() => printClientSummary(clientDraft)} type="button">
                        Print summary
                      </button>
                    ) : null}
                    {clientDraft.id ? (
                      <button className="button button-secondary" onClick={() => downloadClientBookingsCalendar(clientDraft)} type="button">
                        Export sessions (.ics)
                      </button>
                    ) : null}
                    <button className="button button-secondary" onClick={attemptCloseClientModal} type="button">
                      Cancel
                    </button>
                  </div>
                </section>
              </div>
            ) : null}
          </>
        ) : null}

        {view === 'programs' ? (
          <>
            <section className="panel card panel-span-2">
              <div className="section-heading compact">
                <div>
                  <span className="eyebrow">Programs</span>
                  <h2>Program list</h2>
                </div>
                <button className="button button-primary" onClick={openNewProgramModal} type="button">
                  Add program
                </button>
              </div>

              <input
                className="field-input search-input"
                value={programSearch}
                onChange={(event) => setProgramSearch(event.target.value)}
                placeholder="Search programs by title, focus, schedule, client..."
              />

              <label className="toggle-row">
                <input
                  checked={showArchivedPrograms}
                  onChange={(event) => setShowArchivedPrograms(event.target.checked)}
                  type="checkbox"
                />
                <span>Show archived programs</span>
              </label>

              <div className="filter-summary-row">
                <p className="section-copy">Showing {filteredPrograms.length} of {visibleProgramCount} programs</p>
                <button
                  className="button button-secondary compact-button"
                  onClick={clearProgramFilters}
                  disabled={!hasProgramFilters}
                  type="button"
                >
                  Clear filters
                </button>
              </div>

              <div className="item-list">
                {filteredPrograms.map((program) => {
                  const client = clients.find((entry) => entry.id === program.clientId);
                  return (
                    <article key={program.id} className={selectedProgramId === program.id ? 'item-row active' : 'item-row'}>
                      <button
                        className="text-button"
                        onClick={() => openProgramEditor(program)}
                        type="button"
                      >
                        <strong>{program.title}</strong>
                        <p>{client?.name ?? 'Unassigned client'}</p>
                      </button>
                      <div className="program-item-meta">
                        <span className="pill">{program.archived ? 'Archived' : `${program.exercises.length} moves`}</span>
                        <button
                          className="button button-secondary compact-button"
                          onClick={() => duplicateProgram(program.id)}
                          type="button"
                        >
                          Duplicate
                        </button>
                      </div>
                    </article>
                  );
                })}
                {filteredPrograms.length === 0 ? <p className="empty-copy">No programs match this filter.</p> : null}
              </div>
            </section>

            {isProgramModalOpen ? (
              <div className="modal-backdrop" role="presentation" onClick={attemptCloseProgramModal}>
                <section
                  className="modal card modal-wide"
                  role="dialog"
                  aria-modal="true"
                  aria-label="Program builder"
                  onClick={(event) => event.stopPropagation()}
                >
                  <div className="section-heading">
                    <div>
                      <span className="eyebrow">Program builder</span>
                      <h2>{programDraft.id ? 'Edit program' : 'Create program'}</h2>
                    </div>
                    <button className="button button-secondary compact-button" onClick={attemptCloseProgramModal} type="button">
                      Close
                    </button>
                  </div>

                  <div className="form-grid two-up">
                    <SelectField
                      label="Client"
                      value={programDraft.clientId}
                      options={clients.map((client) => ({ value: client.id, label: client.name }))}
                      onChange={(value) => setProgramDraft({ ...programDraft, clientId: value })}
                    />
                    <Field label="Title" value={programDraft.title} onChange={(value) => setProgramDraft({ ...programDraft, title: value })} />
                    <Field label="Focus" value={programDraft.focus} onChange={(value) => setProgramDraft({ ...programDraft, focus: value })} />
                    <Field label="Schedule" value={programDraft.schedule} onChange={(value) => setProgramDraft({ ...programDraft, schedule: value })} />
                  </div>

                  <div className="template-row">
                    <label className="field">
                      <span>Session template</span>
                      <select className="field-input" value={programTemplateKey} onChange={(event) => setProgramTemplateKey(event.target.value as ProgramTemplateKey)}>
                        <option value="strength">Strength</option>
                        <option value="hypertrophy">Hypertrophy</option>
                        <option value="fat-loss">Fat loss</option>
                      </select>
                    </label>
                    <button className="button button-secondary compact-button" onClick={() => applyProgramTemplate(programTemplateKey)} type="button">
                      Apply template
                    </button>
                  </div>

                  <Field label="Program notes" value={programDraft.notes} onChange={(value) => setProgramDraft({ ...programDraft, notes: value })} textarea />

                  <div className="exercise-editor-header">
                    <div>
                      <span className="eyebrow">Program exercises</span>
                      <h3>Build the session structure</h3>
                    </div>
                    <button className="button button-secondary" onClick={addProgramExercise} type="button">
                      Add exercise block
                    </button>
                  </div>

                  <div className="stack-list">
                    {programDraft.exercises.map((exerciseBlock, index) => (
                      <article className="exercise-block" key={exerciseBlock.id}>
                        <div className="exercise-block-top">
                          <strong>Exercise {index + 1}</strong>
                          <button className="text-button" onClick={() => removeProgramExercise(exerciseBlock.id)} type="button">
                            Remove
                          </button>
                        </div>
                        <div className="form-grid two-up">
                          <SelectField
                            label="Exercise"
                            value={exerciseBlock.exerciseId}
                            options={exercises.map((exercise) => ({ value: exercise.id, label: exercise.name }))}
                            onChange={(value) => updateProgramExercise(exerciseBlock.id, 'exerciseId', value)}
                          />
                          <Field
                            label="Sets"
                            value={String(exerciseBlock.sets)}
                            onChange={(value) => updateProgramExercise(exerciseBlock.id, 'sets', Number(value || 0))}
                          />
                          <Field
                            label="Reps"
                            value={exerciseBlock.reps}
                            onChange={(value) => updateProgramExercise(exerciseBlock.id, 'reps', value)}
                          />
                          <Field
                            label="Rest"
                            value={exerciseBlock.rest}
                            onChange={(value) => updateProgramExercise(exerciseBlock.id, 'rest', value)}
                          />
                        </div>
                        <Field
                          label="Block notes"
                          value={exerciseBlock.notes}
                          onChange={(value) => updateProgramExercise(exerciseBlock.id, 'notes', value)}
                          textarea
                        />
                      </article>
                    ))}
                  </div>

                  <div className="actions-row">
                    <button className="button button-primary" onClick={saveProgram} type="button">
                      Save program
                    </button>
                    {programDraft.id ? (
                      <button
                        className="button button-danger"
                        onClick={() => (programDraft.archived ? restoreProgram(programDraft.id) : deleteProgram(programDraft.id))}
                        type="button"
                      >
                        {programDraft.archived ? 'Restore program' : 'Archive program'}
                      </button>
                    ) : null}
                    {programDraft.id ? (
                      <button className="button button-secondary" onClick={() => duplicateProgram(programDraft.id)} type="button">
                        Duplicate program
                      </button>
                    ) : null}
                    {programDraft.id ? (
                      <button className="button button-secondary" onClick={() => copyClientUpdate(programDraft)} type="button">
                        Copy client update
                      </button>
                    ) : null}
                    {programDraft.id ? (
                      <button className="button button-secondary" onClick={() => downloadClientUpdate(programDraft)} type="button">
                        Download update
                      </button>
                    ) : null}
                    <button className="button button-secondary" onClick={attemptCloseProgramModal} type="button">
                      Cancel
                    </button>
                  </div>
                </section>
              </div>
            ) : null}
          </>
        ) : null}

        {view === 'session' ? (
          <>
            <section className="panel card">
              <div className="section-heading compact">
                <div>
                  <span className="eyebrow">Session setup</span>
                  <h2>Pick the workout</h2>
                </div>
              </div>

              <div className="form-grid single-column">
                <SelectField
                  label="Client"
                  value={sessionClientId}
                  options={clients.filter((client) => !client.archived).map((client) => ({ value: client.id, label: client.name }))}
                  onChange={(value) => {
                    setSessionClientId(value);
                    const firstProgramForClient = programs.find((program) => program.clientId === value && !program.archived);
                    if (firstProgramForClient) {
                      setSessionProgramId(firstProgramForClient.id);
                    }
                  }}
                />
                <SelectField
                  label="Program"
                  value={sessionProgramId}
                  options={sessionProgramOptions}
                  onChange={(value) => setSessionProgramId(value)}
                />
                <div className="actions-row">
                  <button
                    className="button button-secondary"
                    onClick={pickRecentProgramForSessionClient}
                    disabled={!sessionClientId || !hasSessionProgramsForClient}
                    type="button"
                  >
                    Use recent program
                  </button>
                  <button className="button button-primary" onClick={startSession} type="button">
                    Start session
                  </button>
                </div>
              </div>

              <div className="record-list">
                {sessionHistory.slice(0, 3).map((record) => (
                  <article className="record-row" key={record.id}>
                    <div>
                      <strong>{record.clientName}</strong>
                      <p>{record.programName}</p>
                    </div>
                    <span>{formatDateTime(record.finishedAt)}</span>
                  </article>
                ))}
              </div>
            </section>

            <section className="panel card panel-span-2">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">Workout view</span>
                  <h2>Use this on the gym floor</h2>
                </div>
                <p className="section-copy">Tap through each set, enter the work, and save the run when the session is done.</p>
              </div>

              {activeSession ? (
                <>
                  {showRecoveredSessionNotice ? (
                    <section className="tools-attention-block">
                      <p className="tools-attention-title">Recovered session draft</p>
                      <p className="empty-copy">Resumed your in-progress session after refresh.</p>
                      <div className="actions-row">
                        <button className="button button-secondary compact-button" onClick={dismissRecoveredSessionNotice} type="button">
                          Keep working
                        </button>
                        <button className="button button-danger compact-button" onClick={discardActiveSession} type="button">
                          Discard draft
                        </button>
                      </div>
                    </section>
                  ) : null}

                  <div className="detail-strip">
                    <span>{activeSession.clientName}</span>
                    <span>{activeSession.programName}</span>
                    <span>{formatDateTime(activeSession.startedAt)}</span>
                  </div>

                  <div className="timer-strip">
                    <span className="timer-clock">Rest timer: {restTimerSeconds > 0 ? formatTimer(restTimerSeconds) : 'idle'}</span>
                    <span>{restTimerLabel || 'Tap Start rest on an exercise block.'}</span>
                    <button className="button button-secondary compact-button" onClick={cancelRestTimer} type="button">
                      Stop timer
                    </button>
                  </div>

                  {previousSessionForActive ? (
                    <div className="comparison-card">
                      <strong>Previous session</strong>
                      <span>{formatDateTime(previousSessionForActive.finishedAt)}</span>
                      <span>{previousSessionForActive.completedSets} completed sets last time</span>
                      <span>{liveCompletedSets} completed sets this session</span>
                    </div>
                  ) : null}

                  <Field
                    label="Session notes"
                    value={activeSession.notes}
                    onChange={(value) => applySessionUpdate((session) => ({ ...session, notes: value }))}
                    textarea
                  />

                  <div className="stack-list">
                    {activeSession.entries.map((entry) => (
                      <article className="session-entry" key={entry.id}>
                        <div className="exercise-block-top">
                          <div>
                            <strong>{entry.exerciseName}</strong>
                            <p>
                              {entry.setStates.length} sets · {entry.targetReps} · {entry.rest}
                            </p>
                          </div>
                          <div className="session-set-actions">
                            <span className="pill">
                              {entry.setStates.filter((setState) => setState.completed).length}/{entry.setStates.length} done
                            </span>
                            <button
                              className="button button-secondary compact-button"
                              onClick={() => startRestTimer(parseRestToSeconds(entry.rest), `${entry.exerciseName} rest`) }
                              type="button"
                            >
                              Start rest
                            </button>
                            <button className="button button-secondary compact-button" onClick={() => addSessionSet(entry.id)} type="button">
                              Add set
                            </button>
                            <button
                              className="button button-secondary compact-button"
                              onClick={() => removeLastSessionSet(entry.id)}
                              disabled={entry.setStates.length <= 1}
                              type="button"
                            >
                              Remove set
                            </button>
                          </div>
                        </div>

                        <p className="muted-text">{entry.notes || 'No extra notes for this block.'}</p>

                        <div className="set-grid">
                          {entry.setStates.map((setState, index) => (
                            <div className="set-row" key={`${entry.id}-${index}`}>
                              <label>
                                <span>Set {index + 1}</span>
                                <input
                                  checked={setState.completed}
                                  onChange={(event) => toggleSetCompletion(entry.id, index, event.target.checked)}
                                  type="checkbox"
                                />
                              </label>
                              <input
                                aria-label={`Reps for set ${index + 1}`}
                                className="field-input"
                                value={setState.reps}
                                onChange={(event) => updateSetField(entry.id, index, 'reps', event.target.value)}
                                placeholder="Reps"
                              />
                              <input
                                aria-label={`Weight for set ${index + 1}`}
                                className="field-input"
                                value={setState.weight}
                                onChange={(event) => updateSetField(entry.id, index, 'weight', event.target.value)}
                                placeholder="Weight"
                              />
                              <div className="set-quick-actions">
                                <button className="chip-button" onClick={() => setPresetReps(entry.id, index, '6')} type="button">6r</button>
                                <button className="chip-button" onClick={() => setPresetReps(entry.id, index, '8')} type="button">8r</button>
                                <button className="chip-button" onClick={() => setPresetReps(entry.id, index, '10')} type="button">10r</button>
                                <button className="chip-button" onClick={() => nudgeSetWeight(entry.id, index, 2.5)} type="button">+2.5</button>
                                <button className="chip-button" onClick={() => nudgeSetWeight(entry.id, index, 5)} type="button">+5</button>
                                <button className="chip-button" onClick={() => nudgeSetWeight(entry.id, index, -2.5)} type="button">-2.5</button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </article>
                    ))}
                  </div>

                  <div className="actions-row sticky-actions">
                    <button className="button button-primary" onClick={saveSession} type="button">
                      Save session
                    </button>
                    <button className="button button-secondary" onClick={undoSessionEdit} disabled={!sessionEditHistory.length} type="button">
                      Undo last edit
                    </button>
                    <button className="button button-secondary" onClick={discardActiveSession} type="button">
                      Discard session
                    </button>
                    <button className="button button-secondary" onClick={discardActiveSession} type="button">
                      Reset view
                    </button>
                  </div>
                </>
              ) : (
                <div className="empty-state">
                  <h3>No active session yet</h3>
                  <p>Choose a client and program above to generate the live workout view.</p>
                </div>
              )}
            </section>
          </>
        ) : null}

        {view === 'library' ? (
          <>
            <section className="panel card panel-span-2">
              <div className="section-heading compact">
                <div>
                  <span className="eyebrow">Exercise library</span>
                  <h2>Saved exercises</h2>
                </div>
                <button className="button button-primary" onClick={openNewExerciseModal} type="button">
                  Add exercise
                </button>
              </div>

              <input
                className="field-input search-input"
                value={exerciseSearch}
                onChange={(event) => setExerciseSearch(event.target.value)}
                placeholder="Search exercises by name, category, equipment..."
              />

              <div className="filter-summary-row">
                <p className="section-copy">Showing {filteredExercises.length} of {exercises.length} exercises</p>
                <button
                  className="button button-secondary compact-button"
                  onClick={clearExerciseFilters}
                  disabled={!hasExerciseFilters}
                  type="button"
                >
                  Clear search
                </button>
              </div>

              <div className="item-list">
                {filteredExercises.map((exercise) => (
                  <button
                    key={exercise.id}
                    className={selectedExerciseId === exercise.id ? 'item-row active' : 'item-row'}
                    onClick={() => openExerciseEditor(exercise)}
                    type="button"
                  >
                    <div>
                      <strong>{exercise.name}</strong>
                      <p>{exercise.category}</p>
                    </div>
                    <span className="pill">{exercise.equipment}</span>
                  </button>
                ))}
                {filteredExercises.length === 0 ? <p className="empty-copy">No exercises match this filter.</p> : null}
              </div>
            </section>

            {isExerciseModalOpen ? (
              <div className="modal-backdrop" role="presentation" onClick={attemptCloseExerciseModal}>
                <section
                  className="modal card"
                  role="dialog"
                  aria-modal="true"
                  aria-label="Exercise editor"
                  onClick={(event) => event.stopPropagation()}
                >
                  <div className="section-heading">
                    <div>
                      <span className="eyebrow">Exercise editor</span>
                      <h2>{exerciseDraft.id ? 'Edit exercise' : 'Create exercise'}</h2>
                    </div>
                    <button className="button button-secondary compact-button" onClick={attemptCloseExerciseModal} type="button">
                      Close
                    </button>
                  </div>

                  <div className="form-grid two-up">
                    <Field label="Name" value={exerciseDraft.name} onChange={(value) => setExerciseDraft({ ...exerciseDraft, name: value })} />
                    <Field label="Category" value={exerciseDraft.category} onChange={(value) => setExerciseDraft({ ...exerciseDraft, category: value })} />
                    <Field label="Equipment" value={exerciseDraft.equipment} onChange={(value) => setExerciseDraft({ ...exerciseDraft, equipment: value })} />
                    <Field
                      label="Default sets"
                      value={String(exerciseDraft.defaultSets)}
                      onChange={(value) => setExerciseDraft({ ...exerciseDraft, defaultSets: Number(value || 0) })}
                    />
                    <Field
                      label="Default reps"
                      value={exerciseDraft.defaultReps}
                      onChange={(value) => setExerciseDraft({ ...exerciseDraft, defaultReps: value })}
                    />
                    <Field
                      label="Default rest"
                      value={exerciseDraft.defaultRest}
                      onChange={(value) => setExerciseDraft({ ...exerciseDraft, defaultRest: value })}
                    />
                  </div>

                  <Field label="Exercise notes" value={exerciseDraft.notes} onChange={(value) => setExerciseDraft({ ...exerciseDraft, notes: value })} textarea />

                  <div className="actions-row">
                    <button className="button button-primary" onClick={() => saveExercise()} type="button">
                      Save exercise
                    </button>
                    {!exerciseDraft.id ? (
                      <button className="button button-secondary" onClick={() => saveExercise(true)} type="button">
                        Save and add another
                      </button>
                    ) : null}
                    {exerciseDraft.id ? (
                      <button className="button button-danger" onClick={() => deleteExercise(exerciseDraft.id)} type="button">
                        Delete exercise
                      </button>
                    ) : null}
                    <button className="button button-secondary" onClick={attemptCloseExerciseModal} type="button">
                      Cancel
                    </button>
                  </div>
                </section>
              </div>
            ) : null}
          </>
        ) : null}
      </main>

      <div className="mobile-quick-actions">
        <button className="button button-primary" onClick={openQuickClientCreate} type="button">
          Add client
        </button>
        <button className="button button-secondary" onClick={openSessionView} type="button">
          Start session
        </button>
        <button className="button button-secondary" onClick={openCommandPalette} type="button">
          Search
        </button>
      </div>

      <nav className="mobile-nav card" aria-label="Mobile app sections">
        {navItems.map((item) => (
          <button
            key={item.key}
            className={view === item.key ? 'mobile-tab active' : 'mobile-tab'}
            onClick={() => {
              setView(item.key);
              setIsMobileToolsOpen(false);
            }}
            aria-label={item.mobileLabel}
            title={item.mobileLabel}
            type="button"
          >
            <NavIcon name={item.icon} />
            <span className="sr-only">{item.mobileLabel}</span>
          </button>
        ))}
        <button
          className={hasToolsAttention ? `${isMobileToolsOpen ? 'mobile-tab active' : 'mobile-tab'} attention` : isMobileToolsOpen ? 'mobile-tab active' : 'mobile-tab'}
          onClick={() => setIsMobileToolsOpen((current) => !current)}
          aria-label={hasToolsAttention ? `Tools with ${toolsBadgeLabel} pending items` : 'Tools'}
          title="Tools"
          type="button"
        >
          <NavIcon name="tools" />
          <span className="sr-only">Tools</span>
          {hasToolsAttention ? <span className="mobile-tab-badge">{toolsBadgeLabel}</span> : null}
        </button>
      </nav>
      </>
      ) : null}
    </div>
  );
}

type FieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  textarea?: boolean;
};

function Field({ label, value, onChange, textarea }: FieldProps) {
  return (
    <label className="field">
      <span>{label}</span>
      {textarea ? (
        <textarea className="field-input field-textarea" value={value} onChange={(event) => onChange(event.target.value)} />
      ) : (
        <input className="field-input" value={value} onChange={(event) => onChange(event.target.value)} />
      )}
    </label>
  );
}

type OptionValue = {
  value: string;
  label: string;
};

type SelectFieldProps = {
  label: string;
  value: string;
  options: OptionValue[];
  onChange: (value: string) => void;
};

type NavIconProps = {
  name: NavIconName;
};

function NavIcon({ name }: NavIconProps) {
  if (name === 'home') {
    return (
      <svg className="nav-icon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M3 11.5L12 4l9 7.5" />
        <path d="M6.5 10.5V20h11V10.5" />
      </svg>
    );
  }

  if (name === 'calendar') {
    return (
      <svg className="nav-icon" viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
        <path d="M8 3.5V7" />
        <path d="M16 3.5V7" />
        <path d="M3.5 9H20.5" />
      </svg>
    );
  }

  if (name === 'clients') {
    return (
      <svg className="nav-icon" viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3.5" y="4" width="17" height="16" rx="2.5" />
        <circle cx="9" cy="10" r="2.4" />
        <path d="M5.8 16c.8-1.8 2-2.8 3.2-2.8 1.2 0 2.4 1 3.2 2.8" />
        <path d="M14.5 8.5h4" />
        <path d="M14.5 12h4" />
      </svg>
    );
  }

  if (name === 'programs') {
    return (
      <svg className="nav-icon" viewBox="0 0 24 24" aria-hidden="true">
        <rect x="5" y="3.5" width="14" height="17" rx="2.5" />
        <path d="M9 3.5v3" />
        <path d="M15 3.5v3" />
        <path d="M8 10h8" />
        <path d="M8 14h8" />
        <path d="M8 18h5" />
      </svg>
    );
  }

  if (name === 'session') {
    return (
      <svg className="nav-icon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M3.5 10h4" />
        <path d="M16.5 10h4" />
        <rect x="7.5" y="8" width="2.5" height="4" rx="0.8" />
        <rect x="14" y="8" width="2.5" height="4" rx="0.8" />
        <path d="M10 10h4" />
        <path d="M3.5 14h4" />
        <path d="M16.5 14h4" />
        <rect x="7.5" y="12" width="2.5" height="4" rx="0.8" />
        <rect x="14" y="12" width="2.5" height="4" rx="0.8" />
        <path d="M10 14h4" />
      </svg>
    );
  }

  if (name === 'library') {
    return (
      <svg className="nav-icon" viewBox="0 0 24 24" aria-hidden="true">
        <rect x="4" y="4" width="4.5" height="16" rx="1" />
        <rect x="9.8" y="4" width="4.5" height="16" rx="1" />
        <rect x="15.6" y="4" width="4.5" height="16" rx="1" />
      </svg>
    );
  }

  return (
    <svg className="nav-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 7h11" />
      <circle cx="18" cy="7" r="2" />
      <path d="M4 12h6" />
      <circle cx="13" cy="12" r="2" />
      <path d="M4 17h13" />
      <circle cx="20" cy="17" r="2" />
    </svg>
  );
}

function SelectField({ label, value, options, onChange }: SelectFieldProps) {
  return (
    <label className="field">
      <span>{label}</span>
      <select className="field-input" value={value} onChange={(event) => onChange(event.target.value)}>
        {options.length ? (
          options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))
        ) : (
          <option value="">No options available</option>
        )}
      </select>
    </label>
  );
}

export default App;