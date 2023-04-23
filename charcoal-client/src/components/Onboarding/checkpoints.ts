export const onboardingCheckpointSequence = [
    'navigateSettings',
    'navigateHome',
    'navigateKnowledge',
    'knowledgeDetail',
    'closeTab',
] as const

export type OnboardingKey = typeof onboardingCheckpointSequence[number]
