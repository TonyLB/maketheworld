import { GenericTree } from "@tonylb/mtw-base/ts/genericTree"
import { v2StandardEditableFactory, StandardEditablePayload } from "../../generics/editable"
import { isSchemaComponentUUID, SchemaTag } from "@tonylb/mtw-base/ts/schema"
import { MergeConflictError } from "@tonylb/mtw-base/ts/standardize"
import { StandardEditableData } from "@tonylb/mtw-base/ts/editable"
import { isSchemaString } from "@tonylb/mtw-base/ts/schema/renderTree"
import { StandardKeyData, isStandardKeyData } from "../components/dataTypes/reference"
import StandardReference from "../components/reference"
import { StandardKey } from "../keys/key"
import { isSchemaExit } from "@tonylb/mtw-base/ts/schema/components"
import { isStandardLiteralData, StandardLiteral } from "../literal"
import { deepEqual } from "../../lib/objects"
import { excludeUndefined, zipperList } from "../../lib/lists"
import { ReferenceFormat } from "./utils/references"

export type StandardExitData = {
    to: StandardKeyData;
    description?: StandardEditableData<string>;
}

// Typeguard for plain exit data
const isSimpleExitData = (value: any): value is StandardExitData => {
    return (typeof value === 'object' && value !== null && 'to' in value && isStandardKeyData(value.to) && (!value.description || isStandardLiteralData(value.description)))
}

//
// StandardExitBase holds the contents for a simple StandardExit
//
export class StandardExitBase implements StandardEditablePayload<StandardExitData> {
    to: StandardKey;
    description?: StandardLiteral;
    get schema() {
        const toKey = this.to.toFormat('key')
        return [{ data: { tag: 'Exit' as const, to: toKey.key ?? toKey.universalKey ?? '' }, children: this.description?.schema ?? [] }]
    }
    constructor(data: StandardExitData) {
        this.to = new StandardKey(data.to)
        if (data.description) {
            this.description = new StandardLiteral(data.description)
        }
    }
    clone() {
        return new StandardExitBase(this.toJSON())
    }
    toJSON: () => StandardExitData = () => ({
        to: this.to.toJSON(),
        description: this.description ? this.description.toJSON() : undefined
    })

    remapReferences(props: { mapTo: ReferenceFormat, mappings: StandardReference[] }): StandardExitBase {
        const returnValue = this.clone()
        const mapReference = props.mappings.find((mapping) => (mapping.standardKey.equals(this.to)))?.standardKey ?? this.to
        returnValue.to = mapReference.toFormat(props.mapTo)
        return returnValue
    }
}

const payloadFactory = (props: GenericTree<SchemaTag> | StandardExitData): StandardExitBase | undefined => {
    if (isSimpleExitData(props)) {
        return new StandardExitBase(props)
    }
    if (props.length === 1 && isSchemaExit(props[0].data)) {
        const to = props[0].data.to
        return new StandardExitBase({
            to: isSchemaComponentUUID(to)
                ? to
                : { key: to },
            description: props[0].children.length > 0 && isSchemaString(props[0].children[0].data) ? new StandardLiteral([props[0].children[0]]).toJSON() : undefined
        })
    }
    throw new Error('Invalid argument in StandardExitBase constructor')
}

const standardExitAdd = (base: StandardExitData, incoming: StandardExitData): StandardExitData => {
    if (!deepEqual(base.to, incoming.to)) {
        throw new MergeConflictError('Cannot add exit with different target')
    }
    const mergedDescription = base.description && incoming.description ? new StandardLiteral(base.description).merge(new StandardLiteral(incoming.description))?.toJSON() : base.description ?? incoming.description
    return { to: base.to, description: mergedDescription }
}

const standardExitSubtract = (base: StandardExitData, incoming: StandardExitData): { add?: StandardExitData, remove?: StandardExitData } => {
    if (!deepEqual(base.to, incoming.to)) {
        throw new MergeConflictError('Cannot subtract exit with different target')
    }
    if (deepEqual(base.description ?? '', incoming.description ?? '')) {
        return {}
    }
    return { add: base, remove: base }
}

const standardExitDiff = (base: StandardExitData, incoming: StandardExitData): { add?: StandardExitData, remove?: StandardExitData } => {
    if (!deepEqual(base.to, incoming.to)) {
        throw new MergeConflictError('Cannot subtract exit with different target')
    }
    if (deepEqual(base.description ?? '', incoming.description ?? '')) {
        return {}
    }
    return { add: incoming, remove: base }
}

// Create v2 editable factory for StandardExit
export const { EditableClass, PlainClass, RemoveClass, ReplaceClass, dataTypeguard } = v2StandardEditableFactory({
    typeguard: isSimpleExitData,
    payloadFactory: payloadFactory,
    payload: StandardExitBase,
    add: standardExitAdd,
    subtract: standardExitSubtract,
    diff: standardExitDiff
}, 'StandardExit')

// Create type aliases for all classes
export type StandardExit = InstanceType<typeof EditableClass>;
export type StandardExitPlain = InstanceType<typeof PlainClass>;
export type StandardExitRemove = InstanceType<typeof RemoveClass>;
export type StandardExitReplace = InstanceType<typeof ReplaceClass>;

// Export the classes for runtime use
export const StandardExit = EditableClass;
export const StandardExitPlain = PlainClass;
export const StandardExitRemove = RemoveClass;
export const StandardExitReplace = ReplaceClass;

// Export the comprehensive typeguard from v2StandardEditableFactory
// This handles all three cases: plain, remove, and replace
export const isStandardExitData = dataTypeguard;

export const mergeStandardExitList = (list: StandardExit[]): StandardExit[] => {
    return list.reduce<StandardExit[]>((previous, current) => {
        const findMatchIndex = previous.findIndex((item) => ((current.plain?.to && item.plain?.to.equals(current.plain?.to)) ?? false))
        if (findMatchIndex === -1) {
            return [...previous, current]
        }
        return previous.map((item, index) => {
            if (index === findMatchIndex) {
                return item.merge(current)
            }
            return item
        }, []).filter(excludeUndefined)
    }, [])
}

export const diffStandardExitList = (base: StandardExit[], incoming: StandardExit[]): StandardExit[] => {
    const zipper = zipperList<StandardExit>((a, b) => ((b.plain?.to && a.plain?.to.equals(b.plain?.to)) ?? false))(base, incoming)
    return zipper.reduce<StandardExit[]>((previous, { base: baseItem, incoming: incomingItem }) => {
        if (baseItem && incomingItem) {
            const diff = baseItem.diff(incomingItem)
            if (diff) {
                return [...previous, diff]
            }
        }
        else if (baseItem) {
            const { add, remove } = baseItem._delta
            const invert = StandardExit.fromDelta({ add: remove, remove: add })
            if (invert) {
                return [...previous, invert]
            }
        }
        else if (incomingItem) {
            return [...previous, incomingItem]
        }
        return previous
    }, [])
}
