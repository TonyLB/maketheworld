/**
 * The physical-forest invariant (positions contract), pinned over the worked cases: drop every Concept node, and
 * each remaining binding's parents all belong to one host (a join may have several parents, all bindings of one
 * host). The invariant is relied on by the scene's rendering and is NOT enforced by a write-time guard, so these
 * tests state the rule and show that each modelling the plan accepts satisfies it; the negative cases show the
 * check bites. Bindings are plain `{ owner, key, parents }` records: the rule is about the parent structure, not the store.
 */
import { isEphemeraConceptId } from '@tonylb/mtw-interfaces/ts/baseClasses'

type Binding = { owner: string; key: string; parents: { owner: string; key: string }[] }

const binding = (owner: string, key: string, ...parents: [string, string][]): Binding => ({
    owner,
    key,
    parents: parents.map(([parentOwner, parentKey]) => ({ owner: parentOwner, key: parentKey })),
})

/** The hosts a binding's physical parents belong to: its parents with every Concept-owned binding dropped. */
const physicalParentHosts = (b: Binding): string[] => [...new Set(b.parents.map(({ owner }) => owner).filter((owner) => !isEphemeraConceptId(owner)))]

/** Every binding whose physical parents lie on more than one host. */
const violations = (bindings: Binding[]): Binding[] => bindings.filter((b) => physicalParentHosts(b).length > 1)

describe('the physical-forest invariant', () => {
    it('the rope end on a table: the end is read through the rope, so the rope has one parent host', () => {
        const bindings = [
            binding('OBJECT#Table', 'onFloor', ['ROOM#Lab', 'Base']),
            binding('OBJECT#Rope', 'onTable', ['OBJECT#Table', 'onFloor']),
        ]
        expect(violations(bindings)).toEqual([])
        expect(physicalParentHosts(bindings[1])).toEqual(['OBJECT#Table'])
    })

    it('the plank on two sawhorses: two bindings, each under one sawhorse', () => {
        const bindings = [
            binding('OBJECT#SawhorseA', 'a', ['ROOM#Lab', 'Base']),
            binding('OBJECT#SawhorseB', 'b', ['ROOM#Lab', 'Base']),
            binding('OBJECT#Plank', 'onA', ['OBJECT#SawhorseA', 'a']),
            binding('OBJECT#Plank', 'onB', ['OBJECT#SawhorseB', 'b']),
        ]
        expect(violations(bindings)).toEqual([])
    })

    it('PR-C5 re-expressed: the backgammon set joins under one host; the chest has no physical placement in the attic', () => {
        const chestA = binding('OBJECT#SteamerChest', 'chestA', ['CONCEPT#InheritedFurniture', 'inAttic'])
        const chestB = binding('OBJECT#SteamerChest', 'chestB', ['CONCEPT#Boardgames', 'inAttic'])
        const bindings = [
            binding('CONCEPT#InheritedFurniture', 'inAttic', ['ROOM#Attic', 'Base']),
            binding('CONCEPT#Boardgames', 'inAttic', ['ROOM#Attic', 'Base']),
            chestA,
            chestB,
            binding('OBJECT#Backgammon', 'set', ['OBJECT#SteamerChest', 'chestA'], ['OBJECT#SteamerChest', 'chestB']),
        ]
        expect(violations(bindings)).toEqual([])
        expect(physicalParentHosts(bindings[4])).toEqual(['OBJECT#SteamerChest'])
        // The finding handed to the scene plan: only the associations place the chest.
        expect(physicalParentHosts(chestA)).toEqual([])
        expect(physicalParentHosts(chestB)).toEqual([])
    })

    describe('the cup in the place setting', () => {
        const table = binding('OBJECT#Table', 'inRoom', ['ROOM#Hall', 'Base'])

        it('is on the table transitively, through the place setting: one parent host at each level', () => {
            const setting = binding('OBJECT#PlaceSetting', 'onTable', ['OBJECT#Table', 'inRoom'])
            const cup = binding('OBJECT#Cup', 'inSetting', ['OBJECT#PlaceSetting', 'onTable'])
            expect(violations([table, setting, cup])).toEqual([])
        })

        it('fails as the shipped fixture draws it (direct member of the table and the place setting)', () => {
            const setting = binding('OBJECT#PlaceSetting', 'onTable', ['OBJECT#Table', 'inRoom'])
            const cup = binding('OBJECT#Cup', 'both', ['OBJECT#Table', 'inRoom'], ['OBJECT#PlaceSetting', 'onTable'])
            expect(violations([table, setting, cup])).toEqual([cup])
        })
    })

    describe("the primer's spring", () => {
        const box = binding('OBJECT#Box', 'inLab', ['ROOM#Lab', 'Base'])

        it('modelled with the contraption a Concept: the spring is In the box and Associated with the contraption', () => {
            const contraption = binding('CONCEPT#Contraption', 'inLab', ['ROOM#Lab', 'Base'])
            const inBox = binding('OBJECT#Spring', 'inBox', ['OBJECT#Box', 'inLab'])
            const associated = binding('OBJECT#Spring', 'assoc', ['CONCEPT#Contraption', 'inLab'])
            expect(violations([box, contraption, inBox, associated])).toEqual([])
            expect(physicalParentHosts(associated)).toEqual([])
        })

        it('modelled with the contraption an Object in the box: the spring is in the box transitively', () => {
            const contraption = binding('OBJECT#Contraption', 'inBox', ['OBJECT#Box', 'inLab'])
            const spring = binding('OBJECT#Spring', 'partOf', ['OBJECT#Contraption', 'inBox'])
            expect(violations([box, contraption, spring])).toEqual([])
        })

        it('fails as the primer draws it (a direct member of two physical hosts)', () => {
            const contraption = binding('OBJECT#Contraption', 'inLab', ['ROOM#Lab', 'Base'])
            const spring = binding('OBJECT#Spring', 'both', ['OBJECT#Box', 'inLab'], ['OBJECT#Contraption', 'inLab'])
            expect(violations([box, contraption, spring])).toEqual([spring])
        })
    })

    it('a join under a multi-binding host: several parents, all bindings of one host', () => {
        const bindings = [
            binding('OBJECT#Cloth', 'overTable', ['ROOM#Hall', 'Base']),
            binding('OBJECT#Cloth', 'overChair', ['ROOM#Hall', 'Base']),
            binding('OBJECT#Candle', 'joined', ['OBJECT#Cloth', 'overTable'], ['OBJECT#Cloth', 'overChair']),
        ]
        expect(violations(bindings)).toEqual([])
        expect(physicalParentHosts(bindings[2])).toEqual(['OBJECT#Cloth'])
    })
})
