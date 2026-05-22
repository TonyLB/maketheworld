import {
    DataSourceEventSerializer,
    StreamingEventHeader
} from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import {
    ComponentExamplesEvent
} from './componentExamples'

//
// Simple pass-through serializer for the mtw.assets.componentExamples data source.
// Internal and external payload shapes are identical; this exists to satisfy
// the DataSource boundary and keep the contract explicit.
//

export type ComponentExamplesEventUpdate = ComponentExamplesEvent
export type ComponentExamplesEventExternal = ComponentExamplesEvent

export class ComponentExamplesEventSerializer implements DataSourceEventSerializer<
ComponentExamplesEventUpdate,
ComponentExamplesEventExternal
> {
    serialize(params: { content: ComponentExamplesEventUpdate; header: StreamingEventHeader }): ComponentExamplesEventExternal {
        if (params.header?.type === 'Snapshot') {
            throw new Error('ComponentExamplesEventSerializer does not support snapshot serialization')
        }
        return params.content
    }

    async deserialize(params: { content: ComponentExamplesEventExternal; header: StreamingEventHeader }): Promise<ComponentExamplesEventUpdate | null> {
        if (params.header?.type === 'Snapshot') {
            return null
        }
        return params.content
    }
}

