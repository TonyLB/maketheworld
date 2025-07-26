import { SerializeNDJSONMixin, StandardComponentData } from "./baseClasses"

export const isLegalKey = (value: string) => (value.match(/^[a-zA-Z\_][a-zA-Z0-9\_\.]+$/))

export const removeNDJSONOnlyProperties = (props: StandardComponentData & SerializeNDJSONMixin): Omit<StandardComponentData & SerializeNDJSONMixin, 'universalKey' | 'from' | 'exportAs'> => {
    return Object.assign({}, 
        ...Object.entries(props)
            .filter(([key]) => (!['universalKey', 'from', 'exportAs'].includes(key)))
            .map(([key, value]) => ({ [key]: value }))
    )
}
