import { isFixedContainmentDrifted } from './classification'

const AREA = 'AREA#Overworld'
const ROOM = 'ROOM#Kitchen'
const FEATURE = 'FEATURE#Stove'
const OBJECT = 'OBJECT#Pot'

const root = { tag: 'Presence', universalKey: 'PRESENCE#Base', cover: { members: [] } }
const partOfNode = (tag: string, universalKey: string, hostingKind = 'PartOf') => ({ tag, universalKey, hostingKind })
const pointingAt = (host: string, presence = 'PRESENCE#Base', members: unknown[] = []) => ({
    nodes: [{ tag: 'Presence', universalKey: 'PRESENCE#Base', fromHostPresences: [{ host, presence }], cover: { members } }],
})
const carveOut = (members: unknown[] = []) => ({
    nodes: [root, { tag: 'Presence', universalKey: 'PRESENCE#c', fromHostPresences: [{ host: AREA, presence: 'PRESENCE#Base' }], cover: { members } }],
})
const areaGraph = { nodes: [root, partOfNode('Room', ROOM)] }
const roomGraph = { nodes: [root, partOfNode('Feature', FEATURE)] }

describe('isFixedContainmentDrifted', () => {
    it('passes a fully populated nesting', () => {
        expect(isFixedContainmentDrifted(AREA, areaGraph, [ROOM], () => carveOut())).toBe(false)
        expect(isFixedContainmentDrifted(ROOM, roomGraph, [FEATURE], () => pointingAt(ROOM))).toBe(false)
    })

    it('flags a parent whose node list lacks the child', () => {
        expect(isFixedContainmentDrifted(AREA, { ...areaGraph, nodes: [root] }, [ROOM], () => carveOut())).toBe(true)
    })

    it('flags a parent whose node for the child lacks the PartOf kind', () => {
        expect(isFixedContainmentDrifted(AREA, { nodes: [root, ROOM] }, [ROOM], () => carveOut())).toBe(true)
        expect(isFixedContainmentDrifted(AREA, { nodes: [root, partOfNode('Room', ROOM, 'In')] }, [ROOM], () => carveOut())).toBe(true)
    })

    it('flags an authored child that was never populated (no row, or no binding at the parent)', () => {
        expect(isFixedContainmentDrifted(AREA, areaGraph, [ROOM], () => undefined)).toBe(true)
        expect(isFixedContainmentDrifted(AREA, areaGraph, [ROOM], () => ({ nodes: [root] }))).toBe(true)
    })

    it('flags a child pointer naming the wrong parent binding', () => {
        expect(isFixedContainmentDrifted(ROOM, roomGraph, [FEATURE], () => pointingAt(ROOM, 'PRESENCE#Other'))).toBe(true)
    })

    it('flags a Room binding into an Area that lists members instead of a carve-out', () => {
        expect(isFixedContainmentDrifted(AREA, areaGraph, [ROOM], () => carveOut([{ host: FEATURE, presence: 'PRESENCE#f' }]))).toBe(true)
    })

    it('flags a Room or Area with no hostless root, including one with no stored graph', () => {
        expect(isFixedContainmentDrifted(ROOM, { nodes: [] }, [], () => undefined)).toBe(true)
        expect(isFixedContainmentDrifted(ROOM, undefined, [], () => undefined)).toBe(true)
        expect(isFixedContainmentDrifted(AREA, pointingAt(ROOM), [], () => undefined)).toBe(true)
    })

    it('passes a Room or Area with only its root, and a Feature or Object with no children', () => {
        expect(isFixedContainmentDrifted(ROOM, { nodes: [root] }, [], () => undefined)).toBe(false)
        expect(isFixedContainmentDrifted(FEATURE, pointingAt(ROOM), [], () => undefined)).toBe(false)
        expect(isFixedContainmentDrifted(FEATURE, undefined, [], () => undefined)).toBe(false)
    })

    it('flags a Feature with an authored child and no binding to name', () => {
        expect(isFixedContainmentDrifted(FEATURE, undefined, ['FEATURE#Knob'], () => undefined)).toBe(true)
    })

    it('ignores an Object child, and a child of the wrong kind for the parent', () => {
        expect(isFixedContainmentDrifted(ROOM, { nodes: [root] }, [OBJECT, 'ROOM#Other'], () => undefined)).toBe(false)
    })

    it('does not sense a stored nesting the asset no longer declares (de-authoring is out of scope)', () => {
        expect(isFixedContainmentDrifted(AREA, areaGraph, [], () => carveOut())).toBe(false)
    })

    it('refuses to judge children of a parent with several bindings and no root to name', () => {
        const two = { nodes: [
            { tag: 'Presence', universalKey: 'PRESENCE#a', fromHostPresences: [{ host: ROOM, presence: 'PRESENCE#Base' }], cover: { members: [] } },
            { tag: 'Presence', universalKey: 'PRESENCE#b', fromHostPresences: [{ host: 'ROOM#Other', presence: 'PRESENCE#Base' }], cover: { members: [] } },
        ] }
        expect(isFixedContainmentDrifted(FEATURE, two, ['FEATURE#Knob'], () => undefined)).toBe(false)
    })
})

describe('isFixedContainmentDrifted (a child with several bindings)', () => {
    it('passes when a later binding names the root, even if an earlier one under the same host names another binding', () => {
        const two = { nodes: [
            { tag: 'Presence', universalKey: 'PRESENCE#a', fromHostPresences: [{ host: ROOM, presence: 'PRESENCE#Other' }], cover: { members: [] } },
            { tag: 'Presence', universalKey: 'PRESENCE#b', fromHostPresences: [{ host: 'ROOM#Else', presence: 'PRESENCE#Base' }, { host: ROOM, presence: 'PRESENCE#Base' }], cover: { members: [] } },
        ] }
        expect(isFixedContainmentDrifted(ROOM, roomGraph, [FEATURE], () => two)).toBe(false)
    })

    it('flags when no binding names the root', () => {
        const none = { nodes: [
            { tag: 'Presence', universalKey: 'PRESENCE#a', fromHostPresences: [{ host: ROOM, presence: 'PRESENCE#Other' }], cover: { members: [] } },
        ] }
        expect(isFixedContainmentDrifted(ROOM, roomGraph, [FEATURE], () => none)).toBe(true)
    })
})
