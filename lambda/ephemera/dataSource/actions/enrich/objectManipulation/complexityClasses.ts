import { objectManipulationErrorMessages } from './resolveObjectSpan'

export const complexComplexityClasses = new Set([
    'relationalPlacement',
    'multiObject',
    'unimplementedVerb',
])

export function complexErrorMessage(complexityClass: string): string {
    switch (complexityClass) {
        case 'relationalPlacement':
            return objectManipulationErrorMessages.complexRelational
        case 'multiObject':
            return objectManipulationErrorMessages.complexMultiObject
        case 'unimplementedVerb':
            return objectManipulationErrorMessages.complexUnimplementedVerb
        default:
            return objectManipulationErrorMessages.complexUnimplementedVerb
    }
}
