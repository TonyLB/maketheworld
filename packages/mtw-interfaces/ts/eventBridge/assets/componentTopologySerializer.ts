import type { ComponentTopologyInvalidatedEvent } from './componentTopology'

//
// Pass-through serializer for mtw.assets.componentTopology (invalidation-only).
//

export class ComponentTopologyEventSerializer {
    serialize(event: ComponentTopologyInvalidatedEvent): ComponentTopologyInvalidatedEvent {
        return event
    }

    deserialize(event: ComponentTopologyInvalidatedEvent): ComponentTopologyInvalidatedEvent {
        return event
    }
}
