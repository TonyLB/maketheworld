export const onboardingCheckpointSequence = [
    'navigateSettings',
    'navigateHome'
] as const

export type OnboardingKey = typeof onboardingCheckpointSequence[number]
