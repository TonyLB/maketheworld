import { StandardComponent } from "./components/baseClasses"
import { StandardKey } from "./components/reference"

export class KeyLookup {
    private components: StandardComponent[]

    constructor(components: StandardComponent[]) {
        this.components = components
    }

    lookup(key: StandardKey): { index: number; component?: StandardComponent } {
        // If key was constructed from a string (ComponentUUID), match by universalKey only
        if (!key.key) {
            const index = this.components.findIndex((component) => (component.universalKey === key.universalKey))
            if (index === -1) {
                return { index: -1 }
            }
            return { index, component: this.components[index] }
        }
        
        // Otherwise, match by key OR universalKey
        const index = this.components.findIndex((component) => (
            (component.key && component.key === key.key) ||
            (component.universalKey && component.universalKey === key.universalKey)
        ))
        if (index === -1) {
            return { index: -1 }
        }
        return { index, component: this.components[index] }
    }
}

