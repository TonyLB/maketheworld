import { normalizeExitName } from '../../roomExitTargetsForCharacter'

export type ObjectManipulationVerb = 'drop' | 'pickUp'

export function inferObjectManipulationVerb(command: string): ObjectManipulationVerb {
    const normalized = normalizeExitName(command)
    if (!normalized) {
        return 'pickUp'
    }
    if (/\bdrop\b/.test(normalized)) {
        return 'drop'
    }
    if (normalized === 'put down' || normalized.startsWith('put down ')) {
        return 'drop'
    }
    if (/\bput\b.+\bdown\b/.test(normalized)) {
        return 'drop'
    }
    return 'pickUp'
}
