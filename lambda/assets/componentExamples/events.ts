import type {
    ComponentExamplesEvent,
    ComponentExamplesInvalidatedEvent,
    ComponentExamplesMirrorEvent,
    ComponentScopedExampleInvalidatedEvent,
    SituationScopedExampleInvalidatedEvent,
} from '@tonylb/mtw-interfaces/ts/eventBridge/assets/componentExamples'

export type {
    ComponentExamplesEvent,
    ComponentExamplesInvalidatedEvent,
    ComponentExamplesMirrorEvent,
    ComponentScopedExampleInvalidatedEvent,
    SituationScopedExampleInvalidatedEvent,
}

/** @deprecated Use ComponentExamplesMirrorEvent from mtw-interfaces. */
export type ExampleLifecycleBase = never

/** Mirror-era aliases retained for index.ts until migration; prefer mtw-interfaces types. */
export type ExampleAdded = Extract<ComponentExamplesMirrorEvent, { type: 'ExampleAdded' }>
export type ExampleUpdated = Extract<ComponentExamplesMirrorEvent, { type: 'ExampleUpdated' }>
export type ExampleRemoved = Extract<ComponentExamplesMirrorEvent, { type: 'ExampleRemoved' }>

export type ComponentExamplesEventUpdate = ComponentExamplesEvent
