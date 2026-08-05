/**
 * The built-in 4-stage site checklist shown when a program has no custom checklist.
 * Shared by the mentor checklist view and reporting so both describe the same items.
 */
export interface DefaultChecklistLink {
  text: string;
  url: string;
}

export interface DefaultChecklistTask {
  id: string;
  text: string;
  links?: DefaultChecklistLink[];
}

export interface DefaultChecklistStage {
  id: string;
  title: string;
  tasks: DefaultChecklistTask[];
}

export const DEFAULT_SITE_CHECKLIST_STAGES: DefaultChecklistStage[] = [
  {
    id: 'stage1',
    title: 'Stage 1: Establish',
    tasks: [
      {
        id: '1.1',
        text: 'Review the role responsibilities for Nurse PECC or Physician PECC',
        links: [
          { text: 'Nurse PECC', url: 'https://emscimprovement.center/domains/pediatric-readiness-project/readiness-toolkit/readiness-toolkit-checklist/pecc/role-of-the-nursing-pecc-in-the-ed/' },
          { text: 'Physician PECC', url: 'https://emscimprovement.center/domains/pediatric-readiness-project/readiness-toolkit/readiness-toolkit-checklist/pecc/md-pecc/' },
        ],
      },
      {
        id: '1.2',
        text: 'Complete the Emergency Medical Services for Children (EMSC) PECC Modules',
        links: [{ text: 'PECC Modules', url: 'https://emscimprovement.center/domains/pecc/pecc-module-ed/' }],
      },
      {
        id: '1.3',
        text: 'Contact your emergency department (ED) nursing leadership and/or physician partners with the following email template',
        links: [{ text: 'email template', url: 'https://docs.google.com/document/d/14QcAO6S8llniLOKo-NoIuwDpYgo63GCN/edit' }],
      },
      {
        id: '1.4',
        text: 'Share Pediatric Readiness resources with ED leadership',
        links: [
          { text: 'Joint Policy Statement', url: 'https://publications.aap.org/pediatrics/article/142/5/e20182459/38608/Pediatric-Readiness-in-the-Emergency-Department' },
          { text: 'How Pediatric Readiness Saves Lives', url: 'https://emscimprovement.center/domains/pediatric-readiness-project/' },
          { text: 'The National Pediatric Readiness Project Assessment', url: 'https://www.pedsready.org/' },
          { text: 'Importance of a PECC', url: 'https://emscimprovement.center/domains/pecc/' },
        ],
      },
      { id: '1.5', text: 'Meet your PRISM mentor (virtual or in-person) and schedule monthly check-ins' },
      {
        id: '1.6',
        text: 'Join the ImPACTS Community of Practice and attend or watch the monthly virtual meetings',
        links: [{ text: 'monthly virtual meetings', url: 'https://docs.google.com/spreadsheets/d/1_LFNGpLBj67rx8lOTl5xQFxBUw7gh-JnRzJA1L53R40/edit?gid=0#gid=0' }],
      },
      { id: '1.7', text: 'Review the National Pediatric Readiness Project assessment with your PRISM' },
      { id: '1.8', text: 'Work with your PRISM to attend an in-person PECC training event' },
      {
        id: '1.9',
        text: 'Review SimBox How-To Video and Simulation/Education Guide',
        links: [
          { text: 'How-To Video', url: 'https://www.emergencysimbox.com/how-to-use' },
          { text: 'Simulation/Education Guide', url: 'https://www.emergencysimbox.com/respiratory-distress' },
        ],
      },
      {
        id: '1.10',
        text: 'Plan your in-person simulation with your PRISM by selecting a simulation case, assigning roles, and setting up technology to run during Stage 2',
        links: [{ text: 'simulation case', url: 'https://www.emergencysimbox.com/' }],
      },
      { id: '1.11', text: 'Communicate to leadership your progress' },
    ],
  },
  {
    id: 'stage2',
    title: 'Stage 2: Implement',
    tasks: [
      { id: '2.1', text: 'Complete Stage 1 objectives' },
      { id: '2.2', text: 'After completing Stage 1 objectives, re-evaluate your available time commitment to Pediatric Readiness' },
      {
        id: '2.3',
        text: 'Continue engagement with the ImPACTS Community of Practice and attend or watch the monthly virtual meetings',
        links: [{ text: 'monthly virtual meetings', url: 'https://docs.google.com/spreadsheets/d/1_LFNGpLBj67rx8lOTl5xQFxBUw7gh-JnRzJA1L53R40/edit?gid=0#gid=0' }],
      },
      { id: '2.4', text: 'Complete your National Pediatric Readiness Project assessment and review score with your PRISM' },
      { id: '2.5', text: 'Review, prioritize, and address one ongoing gap utilizing resources from ImPACTS with your PRISM' },
      { id: '2.6', text: 'Create a SMART aim goal to address the prioritized gap with support from your PRISM' },
      { id: '2.7', text: 'Schedule your first simulation with an ED team with support from your PRISM' },
      { id: '2.8', text: 'Run and complete your first simulation with support from your PRISM' },
      {
        id: '2.9',
        text: 'Complete the associated Facilitator Checklist with that scenario',
        links: [{ text: 'Facilitator Checklist', url: 'https://yalesurvey.ca1.qualtrics.com/jfe/form/SV_2i2AQF9Lq5ixm6i' }],
      },
      {
        id: '2.10',
        text: 'Ask all participants to complete the Participant Survey to access the simulation report',
        links: [{ text: 'Participant Survey', url: 'https://yalesurvey.ca1.qualtrics.com/jfe/form/SV_3vXMUgYvIPFWKUK' }],
      },
      { id: '2.11', text: 'Communicate to leadership your progress' },
    ],
  },
  {
    id: 'stage3',
    title: 'Stage 3: Lead',
    tasks: [
      { id: '3.1', text: 'Complete Stage 2 objectives' },
      { id: '3.2', text: 'After completing Stage 2 objectives, re-evaluate your available time commitment to Pediatric Readiness' },
      {
        id: '3.3',
        text: 'Continue engagement with the ImPACTS Community of Practice and attend or watch the monthly virtual meetings',
        links: [{ text: 'monthly virtual meetings', url: 'https://docs.google.com/spreadsheets/d/1_LFNGpLBj67rx8lOTl5xQFxBUw7gh-JnRzJA1L53R40/edit?gid=0#gid=0' }],
      },
      { id: '3.4', text: 'Continue addressing prioritized gaps from Stage 2 with virtual support and consultation from your PRISM' },
      { id: '3.5', text: 'Review the "Gap Analysis" tab on your PECC Support Tool with your PRISM' },
      { id: '3.6', text: 'Begin logging activities in your PECC Support Tool' },
      { id: '3.7', text: 'Independently create a SMART aim goal to address ongoing gaps, with consultation and feedback from your PRISM' },
      {
        id: '3.8',
        text: 'Schedule and facilitate quarterly simulations with an ED team with virtual support from your PRISM',
        links: [{ text: 'simulations', url: 'https://www.emergencysimbox.com/' }],
      },
      { id: '3.9', text: 'Communicate to leadership your progress' },
    ],
  },
  {
    id: 'stage4',
    title: 'Stage 4: Sustain',
    tasks: [
      { id: '4.1', text: 'Complete Stage 3 objectives' },
      { id: '4.2', text: 'After completing Stage 3 objectives, re-evaluate your available time commitment to Pediatric Readiness' },
      {
        id: '4.3',
        text: 'Continue engagement with the ImPACTS Community of Practice and attend or watch the monthly virtual meetings',
        links: [{ text: 'monthly virtual meetings', url: 'https://docs.google.com/spreadsheets/d/1_LFNGpLBj67rx8lOTl5xQFxBUw7gh-JnRzJA1L53R40/edit?gid=0#gid=0' }],
      },
      { id: '4.4', text: 'Review and update the status of the current "Gap Analysis" on your PECC Support Tool' },
      { id: '4.5', text: 'Log monthly activities on your PECC Support Tool' },
      { id: '4.6', text: 'Present your PECC Support Tool snapshots to ED and hospital leadership' },
      {
        id: '4.7',
        text: 'Each year, complete the National Pediatric Readiness Project assessment, address new or ongoing gaps utilizing resources from ImPACTS, and create a SMART aim goal to tackle the next identified gap',
        links: [{ text: 'National Pediatric Readiness Project assessment', url: 'https://www.pedsready.org/' }],
      },
      {
        id: '4.8',
        text: 'Facilitate, independently, ongoing quarterly simulations in the ED',
        links: [{ text: 'simulations', url: 'https://www.emergencysimbox.com/' }],
      },
      { id: '4.9', text: 'Fill out the ImPACTS Program Evaluation Survey to share your feedback and indicate interest in becoming a PRISM' },
    ],
  },
];
