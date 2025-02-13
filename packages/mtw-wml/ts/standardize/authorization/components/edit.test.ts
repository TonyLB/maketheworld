import { mergeAuthWithEdits, StandardAuthRemove, StandardAuthReplace } from './edits'
import StandardGrant from './grant'
import { Schema, schemaToWML } from "../../../schema"
import { deIndentWML } from "../../../schema/utils"

describe('mergeAuthWithEdits function', () => {

    it('should merge two StandardGrant components correctly', () => {
        const base = new StandardGrant({ tag: 'Grant', player: 'testPlayer', actions: ['action1'] })
        const incoming = new StandardGrant({ tag: 'Grant', player: 'testPlayer', actions: ['action2'] })
        const result = mergeAuthWithEdits(base, incoming)
        expect(result).toBeDefined()
        expect(result?.player).toEqual('testPlayer')
        expect((result as StandardGrant).actions).toEqual(['action1', 'action2'])
    })

    it('should merge StandardGrant and StandardAuthRemove correctly', () => {
        const base = new StandardGrant({ tag: 'Grant', player: 'testPlayer', actions: ['action1', 'action2'] })
        const incoming = new StandardAuthRemove(new StandardGrant({ tag: 'Grant', player: 'testPlayer', actions: ['action2'] }))
        const result = mergeAuthWithEdits(base, incoming)
        expect(result).toBeDefined()
        expect(result?.player).toEqual('testPlayer')
        expect((result as StandardGrant).actions).toEqual(['action1'])
    })

    it('should merge StandardGrant and StandardAuthReplace correctly', () => {
        const base = new StandardGrant({ tag: 'Grant', player: 'testPlayer', actions: ['action1'] })
        const incoming = new StandardAuthReplace(
            new StandardGrant({ tag: 'Grant', player: 'testPlayer', actions: ['action1'] }),
            new StandardGrant({ tag: 'Grant', player: 'testPlayer', actions: ['action2'] })
        )
        const result = mergeAuthWithEdits(base, incoming)
        expect(result).toBeDefined()
        expect(result?.player).toEqual('testPlayer')
        expect((result as StandardGrant).actions).toEqual(['action2'])
    })

    it('should handle complex merge scenarios', () => {
        const base = new StandardAuthReplace(
            new StandardGrant({ tag: 'Grant', player: 'testPlayer', actions: ['action1'] }),
            new StandardGrant({ tag: 'Grant', player: 'testPlayer', actions: ['action2'] })
        )
        const incoming = new StandardAuthReplace(
            new StandardGrant({ tag: 'Grant', player: 'testPlayer', actions: ['action2'] }),
            new StandardGrant({ tag: 'Grant', player: 'testPlayer', actions: ['action3'] })
        )
        const result = mergeAuthWithEdits(base, incoming)
        expect(result).toBeDefined()
        expect(result?.player).toEqual('testPlayer')
        expect(((result as StandardAuthReplace)._match as StandardGrant).actions).toEqual(['action1'])
        expect(((result as StandardAuthReplace)._payload as StandardGrant).actions).toEqual(['action3'])
    })
})