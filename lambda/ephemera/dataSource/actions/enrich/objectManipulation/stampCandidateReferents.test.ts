import type { EphemeraObjectId, EphemeraPresenceNodeId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import type { Change } from './plan/planStep'
import { stampCandidateReferents, type SpanName } from './stampCandidateReferents'

const ROPE = 'OBJECT#Rope' as EphemeraObjectId
const POST = 'OBJECT#Post' as EphemeraObjectId
const BOX_BINDING = 'PRESENCE#box-in-room' as EphemeraPresenceNodeId
const names = new Map<string, SpanName>([
    ['subjectRef', { id: ROPE, shortName: 'rope', gloss: 'hemp', presence: [BOX_BINDING] }],
    ['targetRef', { id: POST, shortName: 'post' }],
])

describe('stampCandidateReferents', () => {
    it('stamps id, shortName, gloss and presence onto every span referent with a matching key, nested under currentHost too', () => {
        const step: Change = {
            kind: 'change',
            primitive: 'transferMembership',
            object: { referentType: 'objectSpan', span: 'rope', stableRefKey: 'subjectRef' },
            from: { referentType: 'currentHost', referentTarget: { referentType: 'objectSpan', span: 'rope', stableRefKey: 'subjectRef' } },
            to: { referentType: 'objectSpan', span: 'post', stableRefKey: 'targetRef' },
        }

        expect(stampCandidateReferents(step, names)).toEqual({
            kind: 'change',
            primitive: 'transferMembership',
            object: { referentType: 'objectSpan', span: 'rope', stableRefKey: 'subjectRef', groundedId: ROPE, shortName: 'rope', gloss: 'hemp', groundedPresence: [BOX_BINDING] },
            from: {
                referentType: 'currentHost',
                referentTarget: { referentType: 'objectSpan', span: 'rope', stableRefKey: 'subjectRef', groundedId: ROPE, shortName: 'rope', gloss: 'hemp', groundedPresence: [BOX_BINDING] },
            },
            to: { referentType: 'objectSpan', span: 'post', stableRefKey: 'targetRef', groundedId: POST, shortName: 'post' },
        })
    })

    it('leaves derived referents and spans without a key in the map untouched', () => {
        const step: Change = {
            kind: 'change',
            primitive: 'transferMembership',
            object: { referentType: 'objectSpan', span: 'rope', stableRefKey: 'unknownRef' },
            from: { referentType: 'currentHost', referentTarget: { referentType: 'actingCharacter' } },
            to: { referentType: 'actingCharacter' },
        }

        expect(stampCandidateReferents(step, names)).toEqual(step)
    })

    it('does not mutate the step it is given', () => {
        const step: Change = {
            kind: 'change',
            primitive: 'establishRelation',
            subject: { referentType: 'objectSpan', span: 'rope', stableRefKey: 'subjectRef' },
            target: { referentType: 'objectSpan', span: 'post', stableRefKey: 'targetRef' },
            relationKind: 'Custom', relationLabel: 'under',
        }

        stampCandidateReferents(step, names)
        expect(step.subject).toEqual({ referentType: 'objectSpan', span: 'rope', stableRefKey: 'subjectRef' })
    })
})
