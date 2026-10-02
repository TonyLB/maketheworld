import type { EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import { objectSpanRef } from '../plan/planStep'
import type { Assertion, ReferentAssignment } from '../plan/planStep'
import { groundAssertion } from './groundAssertion'

const TRAY_ID = 'OBJECT#Tray' as EphemeraObjectId
const TABLE_ID = 'OBJECT#Table' as EphemeraObjectId

describe('groundAssertion', () => {
    it('grounds a containedBy Assertion with negate: true preserved', () => {
        const assertion: Assertion = {
            kind: 'assertion',
            predicate: 'containedBy',
            subject: objectSpanRef('tray', 'trayRef'),
            object: objectSpanRef('table', 'tableRef'),
            negate: true,
        }
        const assignment: ReferentAssignment = {
            spans: new Map([['trayRef', TRAY_ID], ['tableRef', TABLE_ID]]),
            derived: new Map(),
        }

        expect(groundAssertion(assertion, assignment)).toEqual({
            kind: 'assertion',
            predicate: 'containedBy',
            subjectId: TRAY_ID,
            objectId: TABLE_ID,
            negate: true,
        })
    })

    it('throws when a referent has no span assignment for its stableRefKey', () => {
        const assertion: Assertion = {
            kind: 'assertion',
            predicate: 'containedBy',
            subject: objectSpanRef('tray', 'trayRef'),
            object: objectSpanRef('table', 'tableRef'),
            negate: false,
        }
        const assignment: ReferentAssignment = {
            spans: new Map([['tableRef', TABLE_ID]]),
            derived: new Map(),
        }

        expect(() => groundAssertion(assertion, assignment)).toThrow('no well-typed EphemeraObjectId span assignment')
    })
})
