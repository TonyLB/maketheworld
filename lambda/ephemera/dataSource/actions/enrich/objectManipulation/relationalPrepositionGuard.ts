import { normalizeExitName } from '../../roomExitTargetsForCharacter'

export function commandHasRelationalPreposition(command: string): boolean {
    const normalized = normalizeExitName(command)
    if (!normalized) {
        return false
    }
    return /\bon\b/.test(normalized) || /\bunder\b/.test(normalized)
}
