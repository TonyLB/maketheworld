import { normalizedPhasePlanStableKey } from '@tonylb/mtw-interfaces/ts/coyotePhasePlan'
import {
    buildCoyotePhasePlanValidationContext,
    collectCoyoteSnapshotStableKeys,
    coyoteTopologyAllowlistFromRooms,
} from './coyoteHypothesisPhasePlanContext'
import { harnessRoomObjects } from '../../testHarness/coyoteEngineTestFixtures'

describe('coyoteHypothesisPhasePlanContext', () => {
    const vortexObjects = harnessRoomObjects('vortex', ['anvil', 'crate'])
    const roomObjectsByRoom = {
        'ROOM#VORTEX': vortexObjects,
        'ROOM#BRIDGE': [],
    }

    it('collects normalized snapshot stable keys', () => {
        const keys = collectCoyoteSnapshotStableKeys(roomObjectsByRoom)
        for (const o of vortexObjects) {
            expect(keys.has(normalizedPhasePlanStableKey(o.stableKey))).toBe(true)
        }
    })

    it('topology allowlist uses seam labels for non-empty rooms only', () => {
        const topo = coyoteTopologyAllowlistFromRooms(roomObjectsByRoom)
        expect(topo.has('CLIFFBASE')).toBe(true)
        expect(topo.has('BRIDGE')).toBe(false)
    })

    it('buildCoyotePhasePlanValidationContext merges snapshot + topology', () => {
        const ctx = buildCoyotePhasePlanValidationContext(roomObjectsByRoom)
        expect(ctx.snapshotStableKeys?.has(normalizedPhasePlanStableKey(vortexObjects[0].stableKey))).toBe(true)
        expect(ctx.allowedTopologyRefTokens?.has('CLIFFBASE')).toBe(true)
    })
})
