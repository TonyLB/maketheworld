import { deepEqual } from "../../lib/objects";
import { GenericTree, GenericTreeNode } from "@tonylb/mtw-base/ts/genericTree";
import { SerializeNDJSONMixin, StandardComponentData } from "../baseClasses";
import { StandardComponent } from "./baseClasses";
import { StandardComponentNonEditData, StandardRemoveData, StandardReplaceData } from "./dataTypes";
import { StandardComponentExport, StandardComponentImport } from "./dataTypes/metaData";
import { KeyPayload } from "./key";
import { StandardExportItem, StandardImportItem } from "./metaData";
import { removeNDJSONOnlyProperties } from "../utils";
import { SchemaTag } from "@tonylb/mtw-base/ts/schema";
import { MergeConflictError } from "@tonylb/mtw-base/ts/standardize"
import { ComponentTag } from "./dataTypes/abstract";

//
// StandardRemove class provides a class that contains a matching StandardComponent to be removed. Note that merge
// methods at this level do NOT contain the functionality to handle component-level edits ... that is included
// at the StandardForm level, rather than on the individual component classes.
//
export class StandardRemove implements StandardComponent {
    _key: KeyPayload;
    _match: StandardComponent;
    tag: ComponentTag | 'Remove' | 'Replace' = 'Remove' as const;
    constructor(props: StandardRemove | StandardComponent) {
        if (props instanceof StandardRemove) {
            this._key = props._key
            this._match = props._match.clone()
            return
        }
        this._key = new KeyPayload({ key: props.key, universalKey: props.universalKey })
        this._match = props as StandardComponent
        return
    }

    get key() { return this._key.key }
    get universalKey() { return this._key.universalKey }
    get fileName() { return this._key.fileName }
    get import() { return this._match.import }
    get export() { return this._match.export }
    get global() { return this._match.global }

    referencedKeys(): { key: string; referenceType: "Link" | "Position" | "Exit" | "Direct" | "Dependency" }[] {
        return this._match.referencedKeys()
    }

    clone(): StandardRemove {
        return new StandardRemove(this)
    }

    mapContents(callback: (incoming: GenericTree<SchemaTag>) => GenericTree<SchemaTag>): StandardRemove {
        const returnValue = this.clone()
        returnValue._match = returnValue._match.mapContents(callback)
        return returnValue
    }

    toJSON(): StandardRemoveData {
        return {
            key: this.key,
            tag: 'Remove',
            component: this._match.toJSON() as StandardComponentNonEditData & SerializeNDJSONMixin
        }
    }

    toNDJSON(): StandardComponentData & SerializeNDJSONMixin {
        return this.toJSON()
    }

    get schema(): GenericTreeNode<SchemaTag> {
        return {
            data: { tag: 'Remove' },
            children: [this._match.schema]
        }
    }

    nestedSchema(byId: Record<string, StandardComponent>): GenericTreeNode<SchemaTag> {
        return {
            data: { tag: 'Remove' },
            children: [this._match.nestedSchema(byId)]
        }
    }

    merge(incoming: StandardComponent): StandardComponent | undefined {
        throw new Error('StandardRemove types cannot be directly merged')
    }

    diff(incoming: StandardComponent): StandardComponent | undefined {
        return undefined
    }

    withKey(key: string): StandardComponent {
        const returnValue = this.clone()
        returnValue._match = this._match.withKey(key)
        returnValue._key._key = returnValue._match.key
        returnValue._key._fileName = returnValue._match.fileName
        returnValue._key._universalKey = returnValue._match.universalKey
        return returnValue
    }

    withUniversalKey(key: string | undefined): StandardComponent {
        const returnValue = this.clone()
        returnValue._match = this._match.withUniversalKey(key)
        returnValue._key._key = returnValue._match.key
        returnValue._key._fileName = returnValue._match.fileName
        returnValue._key._universalKey = returnValue._match.universalKey
        return returnValue
    }

    withFileName(key: string | undefined): StandardComponent {
        const returnValue = this.clone()
        returnValue._match = this._match.withFileName(key)
        returnValue._key._key = returnValue._match.key
        returnValue._key._fileName = key
        returnValue._key._universalKey = returnValue._match.universalKey
        return returnValue
    }

    withImport(importData: StandardImportItem | StandardComponentImport | undefined): StandardComponent {
        const returnValue = this.clone()
        returnValue._match = this._match.withImport(importData)
        returnValue._key._key = returnValue._match.key
        returnValue._key._fileName = returnValue._match.fileName
        returnValue._key._universalKey = returnValue._match.universalKey
        return returnValue
    }

    withExport(exportData: StandardExportItem | StandardComponentExport | string | undefined): StandardComponent {
        const returnValue = this.clone()
        returnValue._match = this._match.withExport(exportData)
        returnValue._key._key = returnValue._match.key
        returnValue._key._fileName = returnValue._match.fileName
        returnValue._key._universalKey = returnValue._match.universalKey
        return returnValue
    }
}

//
// StandardReplace class provides a class that contains a matching StandardComponent to be removed. Note that merge
// methods at this level do NOT contain the functionality to handle component-level edits ... that is included
// at the StandardForm level, rather than on the individual component classes.
//
export class StandardReplace implements StandardComponent {
    _key: KeyPayload;
    _match: StandardComponent;
    _payload: StandardComponent
    tag: ComponentTag | 'Remove' | 'Replace' = 'Replace' as const;
    constructor(...propsArray: [StandardReplace] | [StandardComponent, StandardComponent]) {
        if (propsArray.length > 1) {
            const match = propsArray[0] as StandardComponent
            const payload = propsArray[1] as StandardComponent
            if (!(match.key === payload.key && match.tag === payload.tag)) {
                console.log(`Match: ${JSON.stringify(match.toJSON())}`)
                console.log(`Payload: ${JSON.stringify(payload.toJSON())}`)
                throw new Error('Match and payload mistmatch in StandardReplace constructor call.')
            }
            this._match = match
            this._payload = payload
            this._key = new KeyPayload({ key: match.key, universalKey: match.universalKey })
            return
        }
        const [props] = propsArray as [string | StandardReplaceData | GenericTreeNode<SchemaTag> | StandardReplace]
        if (props instanceof StandardReplace) {
            this._key = props._key
            this._match = props._match.clone()
            this._payload = props._payload.clone()
            return
        }
        throw new Error('StandardReplace constructor called with invalid arguments')
    }

    get key() { return this._key.key }
    get universalKey() { return this._key.universalKey }
    get fileName() { return this._key.fileName }
    get import() { return this._match.import }
    get export() { return this._match.export }
    get global() { return this._match.global }

    clone(): StandardReplace {
        return new StandardReplace(this)
    }

    mapContents(callback: (incoming: GenericTree<SchemaTag>) => GenericTree<SchemaTag>): StandardReplace {
        const returnValue = new StandardReplace(this)
        returnValue._match = returnValue._match.mapContents(callback)
        returnValue._payload = returnValue._payload.mapContents(callback)
        return returnValue
    }

    toJSON(): StandardReplaceData {
        return {
            key: this.key,
            tag: 'Replace',
            match: this._match.toJSON() as StandardComponentNonEditData & SerializeNDJSONMixin,
            payload: this._payload.toJSON() as StandardComponentNonEditData & SerializeNDJSONMixin
        }
    }

    toNDJSON(): StandardComponentData & SerializeNDJSONMixin {
        return this.toJSON()
    }

    get schema(): GenericTreeNode<SchemaTag> {
        return {
            data: { tag: 'Replace' },
            children: [
                { data: { tag: 'ReplaceMatch' }, children: [this._match.schema] },
                { data: { tag: 'ReplacePayload' }, children: [this._payload.schema] }
            ]
        }
    }

    nestedSchema(byId: Record<string, StandardComponent>): GenericTreeNode<SchemaTag> {
        return {
            data: { tag: 'Replace' },
            children: [
                { data: { tag: 'ReplaceMatch' }, children: [this._match.nestedSchema(byId)] },
                { data: { tag: 'ReplacePayload' }, children: [this._payload.nestedSchema(byId)] }
            ]
        }
    }

    merge(incoming: StandardComponent): StandardComponent | undefined {
        if (!(incoming instanceof StandardReplace)) {
            throw new Error('Type mismatch in StandardReplace merge')
        }
        if (!(deepEqual(removeNDJSONOnlyProperties(this._payload.toJSON()), removeNDJSONOnlyProperties(incoming._match.toJSON())))) {
            throw new MergeConflictError()
        }
        return new StandardReplace(this, incoming._payload).withUniversalKey(this.universalKey)
    }

    diff(incoming: StandardComponent): StandardComponent | undefined {
        return undefined
    }

    referencedKeys(): { key: string; referenceType: "Link" | "Position" | "Exit" | "Direct" | "Dependency" }[] {
        return [
            ...this._match.referencedKeys(),
            ...this._payload.referencedKeys()
        ]
    }

    withKey(key: string): StandardComponent {
        const returnValue = this.clone()
        returnValue._match = this._match.withKey(key)
        returnValue._payload = this._match.withKey(key)
        returnValue._key._universalKey = key
        returnValue._key._fileName = this.fileName
        return returnValue
    }

    withUniversalKey(key: string | undefined): StandardComponent {
        const returnValue = this.clone()
        returnValue._match = this._match.withUniversalKey(key)
        returnValue._payload = this._match.withUniversalKey(key)
        returnValue._key._universalKey = key
        returnValue._key._fileName = this.fileName
        return returnValue
    }

    withFileName(key: string | undefined): StandardComponent {
        const returnValue = this.clone()
        returnValue._match = this._match.withFileName(key)
        returnValue._payload = this._payload.withFileName(key)
        returnValue._key._fileName = key
        returnValue._key._universalKey = this._key._universalKey
        return returnValue
    }

    withImport(importData: StandardImportItem | StandardComponentImport | undefined): StandardComponent {
        const returnValue = this.clone()
        returnValue._match = this._match.withImport(importData)
        returnValue._payload = this._payload.withImport(importData)
        returnValue._key._key = returnValue._match.key
        returnValue._key._fileName = returnValue._match.fileName
        returnValue._key._universalKey = returnValue._match.universalKey
        return returnValue
    }

    withExport(exportData: StandardExportItem | StandardComponentExport | string | undefined): StandardComponent {
        const returnValue = this.clone()
        returnValue._match = this._match.withExport(exportData)
        returnValue._payload = this._payload.withExport(exportData)
        returnValue._key._key = returnValue._match.key
        returnValue._key._fileName = returnValue._match.fileName
        returnValue._key._universalKey = returnValue._match.universalKey
        return returnValue
    }

}

export const mergeWithEdits = (base: StandardComponent, incomingComponent: StandardComponent): StandardComponent | undefined => {
    //
    // Branch out to the several possible cases of combining edit tags and/or content
    //
    if (base) {
        if (incomingComponent) {
            if (base instanceof StandardRemove) {
                if (incomingComponent instanceof StandardRemove) {
                    throw new Error('StandardRemove types cannot be directly merged')
                }
                if (incomingComponent instanceof StandardReplace) {
                    throw new MergeConflictError()
                }
                //
                // A remove operation followed by an add should be merged into a Replace
                //
                return new StandardReplace(base._match, incomingComponent)
            }
            else if (base instanceof StandardReplace) {
                //
                // A replace followed by a remove should be merged into a remove of the original content
                //
                if (incomingComponent instanceof StandardRemove) {
                    if (!deepEqual(removeNDJSONOnlyProperties(base._payload.toJSON()), removeNDJSONOnlyProperties(incomingComponent._match.toJSON()))) {
                        throw new MergeConflictError()
                    }
                    return new StandardRemove(base._match)
                }
                //
                // Two replace operations should be merged into a single chained operation
                //
                if (incomingComponent instanceof StandardReplace) {
                    if (!deepEqual(removeNDJSONOnlyProperties(base._payload.toJSON()), removeNDJSONOnlyProperties(incomingComponent._match.toJSON()))) {
                        throw new MergeConflictError()
                    }
                    return new StandardReplace(base._match, incomingComponent._payload)
                }
                //
                // A replace operation followed by more content should be merged to a replace with combined payload
                //
                const mergedPayload = base._payload.merge(incomingComponent)
                if (!mergedPayload) {
                    throw new MergeConflictError()
                }
                return new StandardReplace(base._match, mergedPayload)
            }
            else {
                //
                // Remove should evaluate the match and then remove the relevant component
                //
                if (incomingComponent instanceof StandardRemove) {
                    if (!deepEqual(removeNDJSONOnlyProperties(base.toJSON()), removeNDJSONOnlyProperties(incomingComponent._match.toJSON()))) {
                        throw new MergeConflictError()
                    }
                    return undefined
                }
                //
                // Replace should evaluate the match and then replace the relevant component
                //
                if (incomingComponent instanceof StandardReplace) {
                    if (!deepEqual(removeNDJSONOnlyProperties(base.toJSON()), removeNDJSONOnlyProperties(incomingComponent._match.toJSON()))) {
                        throw new MergeConflictError()
                    }
                    return incomingComponent._payload
                }
                return base.merge(incomingComponent as any)
            }
        }
        else {
            return base
        }
    }
    else {
        return incomingComponent
    }
}
