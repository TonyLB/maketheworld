import { harnessRoomObjects } from '../../../testHarness/coyoteEngineTestFixtures'
import { buildCandidatePrompt } from './buildCandidatePrompt'

describe('buildCandidatePrompt', () => {
    it('includes stage-one contract anchors and dynamic seam/snapshot sections', () => {
        const parts = buildCandidatePrompt({
            roomObjectsByRoom: {
                'ROOM#STRAIGHTAWAY': harnessRoomObjects('straightaway', ['rocket skates']),
                'ROOM#VORTEX': [],
                'ROOM#CLIFFTOP': [],
                'ROOM#CORNER': [],
                'ROOM#BRIDGE': [],
            },
        })
        const full = parts.invariantPrefix + parts.dynamicSuffix
        // Spot-check only: keep invariantPrefix checks intentionally minimal.
        // Update these for major contract shifts, but avoid adding new string
        // checkpoints by default when prompt wording changes.
        expect(parts.invariantPrefix).toContain('## World topology')
        expect(parts.invariantPrefix).toContain('Scene Dressing clustering')
        expect(full).toContain('affordancesProvided')
        expect(full).toContain('## Gimmick (per candidate)')
        expect(full).toContain('free-form orienting text')
        expect(full).toContain('## Stage one JSON contract')
        expect(full).toContain('"tropeFunction":')
        expect(full).not.toContain('intendedRole')
        expect(full).toContain('"tropeAssignments": {')
        expect(full).not.toContain('"tropeAssignments": [')
        expect(parts.dynamicSuffix).toContain('## Seam room labels')
        expect(parts.dynamicSuffix).toContain('`ROOM#STRAIGHTAWAY` → **STRAIGHTAWAY**')
        expect(parts.dynamicSuffix).toContain('## Current staged objects')
        expect(parts.dynamicSuffix).toContain('Use this JSON as authoritative staged-object input')
        expect(parts.dynamicSuffix).toContain('```json')
        expect(parts.dynamicSuffix).toContain('"decisionFocus"')
        expect(parts.dynamicSuffix).toContain('"anchorStableKeys"')
        expect(parts.dynamicSuffix).toContain('"expanderStableKeys"')
        expect(parts.dynamicSuffix).toContain('"objects"')
        expect(parts.dynamicSuffix).not.toContain('"roomId"')
        expect(parts.dynamicSuffix).toContain('"room": "STRAIGHTAWAY"')
        expect(parts.dynamicSuffix).toContain('"shortName": "rocket skates"')
        expect(parts.dynamicSuffix).toContain('"stableKey": "rocket-skates-0"')
        expect(parts.dynamicSuffix).toContain('"tropeAffinities"')
    })

    it('lists helmet and goggles under expanderStableKeys for clean-001-shaped staging', () => {
        const parts = buildCandidatePrompt({
            roomObjectsByRoom: {
                'ROOM#STRAIGHTAWAY': [
                    {
                        uuid: 'OBJECT#rs' as `OBJECT#${string}`,
                        shortName: 'rocket skates',
                        stableKey: 'rocket-skates-0',
                        tropeAffinities: [{
                            trope: 'Contraption',
                            aptness: 'High',
                            narrowing: 'coyote mobility or pursuit rig',
                        }],
                    },
                    {
                        uuid: 'OBJECT#h' as `OBJECT#${string}`,
                        shortName: 'helmet',
                        stableKey: 'helmet-0',
                        tropeAffinities: [{
                            trope: 'Scene Dressing',
                            aptness: 'Good',
                            narrowing: 'protective equipment',
                        }],
                    },
                    {
                        uuid: 'OBJECT#g' as `OBJECT#${string}`,
                        shortName: 'goggles',
                        stableKey: 'goggles-0',
                        tropeAffinities: [{
                            trope: 'Scene Dressing',
                            aptness: 'Good',
                            narrowing: 'racing gear',
                        }],
                    },
                ],
            },
        })
        expect(parts.dynamicSuffix).toContain('"rocket-skates-0"')
        expect(parts.dynamicSuffix).toContain('"helmet-0"')
        expect(parts.dynamicSuffix).toContain('"goggles-0"')
        const snapshot = parts.dynamicSuffix.match(/```json\n([\s\S]*?)\n```/)?.[1]
        expect(snapshot).toBeDefined()
        const parsed = JSON.parse(snapshot!) as {
            decisionFocus: { anchorStableKeys: string[]; expanderStableKeys: string[] }
        }
        expect(parsed.decisionFocus.anchorStableKeys).toEqual(['rocket-skates-0'])
        expect(parsed.decisionFocus.expanderStableKeys).toEqual(['goggles-0', 'helmet-0'])
    })

    it('rejoins parts consistently', () => {
        const input = {
            roomObjectsByRoom: {
                'ROOM#STRAIGHTAWAY': harnessRoomObjects('straightaway', ['rocket']),
                'ROOM#VORTEX': [],
                'ROOM#CLIFFTOP': [],
                'ROOM#CORNER': [],
                'ROOM#BRIDGE': [],
            },
        }
        const parts = buildCandidatePrompt(input)
        expect(parts.dynamicSuffix.startsWith('\n## Seam room labels')).toBe(true)
        expect(parts.dynamicSuffix).toContain('## Current staged objects')
        expect(parts.dynamicSuffix).toContain('```json')
    })
})
