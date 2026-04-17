import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { parseHypothesisStageOneOutput, stripHypothesisStageOneFence } from './parseHypothesisStageOneOutput'

const singleObjectRoomMap: Record<EphemeraRoomId, string[]> = {
    'ROOM#VORTEX': ['anvil'],
    'ROOM#STRAIGHTAWAY': [],
    'ROOM#CLIFFTOP': [],
    'ROOM#CORNER': [],
    'ROOM#BRIDGE': [],
}

const validSeamSingleObject = `## Objects

### VORTEX · anvil
- **Function:** Drop weight on the Road Runner below.
- **Affinity:** coyoteOperated

## Clusters

### Cliff trap
- **Members:** VORTEX · anvil
- **Coyote role:** participant
- **Summary:** Uses gravity from above.
`

describe('stripHypothesisStageOneFence', () => {
    it('removes fenced markdown wrapper', () => {
        expect(stripHypothesisStageOneFence('```markdown\n## Objects\n\n### VORTEX · x\n')).toContain('## Objects')
        expect(stripHypothesisStageOneFence('```markdown\n## Objects\n\n### VORTEX · x\n')).not.toContain('```')
    })
})

describe('parseHypothesisStageOneOutput', () => {
    it('accepts valid seam matching snapshot multiset', () => {
        const r = parseHypothesisStageOneOutput(validSeamSingleObject, singleObjectRoomMap)
        expect(r.ok).toBe(true)
        if (r.ok) {
            expect(r.markdown).toContain('## Objects')
        }
    })

    it('accepts optional ROOM# prefix on room tokens (normalized to shorthand)', () => {
        const withPrefix = validSeamSingleObject
            .replace('### VORTEX ·', '### ROOM#VORTEX ·')
            .replace('**Members:** VORTEX ·', '**Members:** ROOM#VORTEX ·')
        expect(parseHypothesisStageOneOutput(withPrefix, singleObjectRoomMap).ok).toBe(true)
    })

    it('rejects invalid affinity token', () => {
        const bad = validSeamSingleObject.replace('coyoteOperated', 'wrong')
        expect(parseHypothesisStageOneOutput(bad, singleObjectRoomMap).ok).toBe(false)
    })

    it('rejects multiset mismatch', () => {
        const twoObjMap: Record<EphemeraRoomId, string[]> = {
            ...singleObjectRoomMap,
            'ROOM#BRIDGE': ['rope'],
        }
        expect(parseHypothesisStageOneOutput(validSeamSingleObject, twoObjMap).ok).toBe(false)
    })

    it('rejects more than two clusters', () => {
        const bad = `## Objects

### VORTEX · anvil
- **Function:** Drop weight.
- **Affinity:** coyoteOperated

## Clusters

### One
- **Members:** VORTEX · anvil
- **Coyote role:** participant
- **Summary:** First.

### Two
- **Members:** VORTEX · anvil
- **Coyote role:** participant
- **Summary:** Second.

### Three
- **Members:** VORTEX · anvil
- **Coyote role:** participant
- **Summary:** Third.
`
        expect(parseHypothesisStageOneOutput(bad, singleObjectRoomMap).ok).toBe(false)
    })
})
