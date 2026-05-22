import {
    isComponentExamplesEvent,
    isComponentScopedExampleInvalidated,
    isExampleInvalidatedEvent,
    isSituationScopedExampleInvalidated,
    type ComponentScopedExampleInvalidatedEvent,
    type SituationScopedExampleInvalidatedEvent,
} from './componentExamples'

describe('ComponentExamples invalidation guards', () => {
    const componentScoped: ComponentScopedExampleInvalidatedEvent = {
        type: 'ExampleInvalidated',
        componentIds: ['ROOM#test'],
        editAssetId: 'ASSET#overlay',
    }

    const situationScoped: SituationScopedExampleInvalidatedEvent = {
        type: 'ExampleInvalidated',
        situationId: 'SITUATION#default',
        editAssetId: 'ASSET#canon',
    }

    it('accepts component-scoped ExampleInvalidated', () => {
        expect(isComponentScopedExampleInvalidated(componentScoped)).toBe(true)
        expect(isExampleInvalidatedEvent(componentScoped)).toBe(true)
        expect(isComponentExamplesEvent(componentScoped)).toBe(true)
    })

    it('accepts component-scoped with optional affectedSituationIds', () => {
        const withAffected = {
            ...componentScoped,
            affectedSituationIds: ['SITUATION#one'],
        }
        expect(isComponentScopedExampleInvalidated(withAffected)).toBe(true)
    })

    it('accepts situation-scoped ExampleInvalidated', () => {
        expect(isSituationScopedExampleInvalidated(situationScoped)).toBe(true)
        expect(isExampleInvalidatedEvent(situationScoped)).toBe(true)
        expect(isComponentExamplesEvent(situationScoped)).toBe(true)
    })

    it('accepts situation-scoped with entityRemoved flag', () => {
        const removed = { ...situationScoped, entityRemoved: true as const }
        expect(isSituationScopedExampleInvalidated(removed)).toBe(true)
        expect(isSituationScopedExampleInvalidated({ ...situationScoped, entityRemoved: false })).toBe(false)
    })

    it('rejects empty componentIds', () => {
        expect(isComponentScopedExampleInvalidated({
            type: 'ExampleInvalidated',
            componentIds: [],
            editAssetId: 'ASSET#a',
        })).toBe(false)
    })

    it('rejects both componentIds and situationId', () => {
        expect(isComponentScopedExampleInvalidated({
            type: 'ExampleInvalidated',
            componentIds: ['ROOM#test'],
            situationId: 'SITUATION#default',
            editAssetId: 'ASSET#a',
        })).toBe(false)
        expect(isSituationScopedExampleInvalidated({
            type: 'ExampleInvalidated',
            componentIds: ['ROOM#test'],
            situationId: 'SITUATION#default',
            editAssetId: 'ASSET#a',
        })).toBe(false)
    })

    it('rejects mirror-only fields on invalidation payloads', () => {
        expect(isComponentScopedExampleInvalidated({
            ...componentScoped,
            exampleId: 'SITUATION#x',
        })).toBe(false)
        expect(isComponentScopedExampleInvalidated({
            ...componentScoped,
            example: { markState: { markValue: [] }, renderedContent: { description: [] }, provenance: { type: 'authored' } },
        })).toBe(false)
        expect(isSituationScopedExampleInvalidated({
            ...situationScoped,
            assetStack: ['ASSET#a'],
        })).toBe(false)
        expect(isSituationScopedExampleInvalidated({
            ...situationScoped,
            perspectiveMatcher: { requiredAssetIds: ['ASSET#a'] },
        })).toBe(false)
    })

    it('rejects invalid editAssetId and situationId', () => {
        expect(isComponentScopedExampleInvalidated({
            ...componentScoped,
            editAssetId: 'not-an-asset',
        })).toBe(false)
        expect(isSituationScopedExampleInvalidated({
            ...situationScoped,
            situationId: 'ROOM#not-situation',
        })).toBe(false)
    })
})
