import { deepEqual } from "../lib/objects";
import { isSchemaRemove, isSchemaReplace, isSchemaReplaceMatch, isSchemaReplacePayload, isSchemaWithKey, SchemaTag, SchemaWithKey } from "../schema/baseClasses";
import { GenericTreeNode, treeNodeTypeguard } from "../tree/baseClasses";
import { MergeConflictError, SerializeNDJSONMixin, StandardComponentData } from "./baseClasses";
import { StandardComponent } from "./components/component";
import { StandardComponentNonEditData, StandardRemoveData, StandardReplaceData } from "./components/dataTypes";
import { StandardComponentExport, StandardComponentImport } from "./components/dataTypes/metaData";
import { KeyPayload } from "./components/key";
import { StandardExportItem, StandardImportItem } from "./components/metaData";
import { isSchemaTreeNode } from "./components/utils";
import standardNonEditComponentFactory from "./nonEditFactory";
import { nodeFromWML, removeNDJSONOnlyProperties } from "./utils";

//
// StandardRemove class provides a class that contains a matching StandardComponent to be removed. Note that merge
// methods at this level do NOT contain the functionality to handle component-level edits ... that is included
// at the StandardForm level, rather than on the individual component classes.
//
export class StandardRemove implements StandardComponent {
    _key: KeyPayload;
    _match: StandardComponent;
    tag: SchemaWithKey["tag"] | 'Remove' | 'Replace' = 'Remove' as const;
    constructor(props: string | StandardRemoveData | GenericTreeNode<SchemaTag> | StandardRemove) {
        if (props instanceof StandardRemove) {
            this._key = props._key
            this._match = props._match.clone()
            return
        }
        if (isSchemaTreeNode(props) || typeof props === 'string') {
            const node = typeof props === 'string'
                ? nodeFromWML(props)
                : props
            if (!treeNodeTypeguard(isSchemaRemove)(node)) {
                throw new Error(`Schema mismatch in StandardRemove constructor call.`)
            }
            const child = node.children[0]
            if (!treeNodeTypeguard(isSchemaWithKey)(child)) {
                throw new Error(`No key found in StandardRemove constructor call.`)
            }
            this._key = new KeyPayload(child.data.key)
            const match = standardNonEditComponentFactory(child)
            if (!match) {
                throw new Error('No payload found in StandardRemove constructor call.')
            }
            this._match = match
            this._key._universalKey = match.universalKey
            return
        }
        const match = standardNonEditComponentFactory(props.component)
        if (!match) {
            throw new Error('No payload found in StandardRemove constructor call.')
        }
        this._match = match
        this._key = new KeyPayload({ key: match.key, universalKey: match.universalKey })
    }

    get key() { return this._key.key }
    get universalKey() { return this._key.universalKey }
    get fileName() { return this._key.fileName }
    get import() { return this._match.import }
    get export() { return this._match.export }

    referencedKeys(): { key: string; referenceType: "Link" | "Position" | "Exit" | "Direct" | "Dependency" }[] {
        return this._match.referencedKeys()
    }

    clone(): StandardRemove {
        return new StandardRemove(this)
    }

    mapContents(callback): StandardRemove {
        const returnValue = new StandardRemove(this)
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

    merge(incoming: StandardComponent): StandardComponent | undefined {
        throw new Error('StandardRemove types cannot be directly merged')
    }

    withKey(key: string): StandardComponent {
        const returnValue = new StandardRemove(this.schema)
        returnValue._match = this._match.withKey(key)
        returnValue._key._key = returnValue._match.key
        returnValue._key._fileName = returnValue._match.fileName
        returnValue._key._universalKey = returnValue._match.universalKey
        return returnValue
    }

    withUniversalKey(key: string | undefined): StandardComponent {
        const returnValue = new StandardRemove(this.schema)
        returnValue._match = this._match.withUniversalKey(key)
        returnValue._key._key = returnValue._match.key
        returnValue._key._fileName = returnValue._match.fileName
        returnValue._key._universalKey = returnValue._match.universalKey
        return returnValue
    }

    withFileName(key: string | undefined): StandardComponent {
        const returnValue = new StandardRemove(this.schema)
        returnValue._match = this._match.withFileName(key)
        returnValue._key._key = returnValue._match.key
        returnValue._key._fileName = key
        returnValue._key._universalKey = returnValue._match.universalKey
        return returnValue
    }

    withImport(importData: StandardImportItem | StandardComponentImport | undefined): StandardComponent {
        const returnValue = new StandardRemove(this.schema)
        returnValue._match = this._match.withImport(importData)
        returnValue._key._key = returnValue._match.key
        returnValue._key._fileName = returnValue._match.fileName
        returnValue._key._universalKey = returnValue._match.universalKey
        return returnValue
    }

    withExport(exportData: StandardExportItem | StandardComponentExport | string | undefined): StandardComponent {
        const returnValue = new StandardRemove(this.schema)
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
    tag: SchemaWithKey["tag"] | 'Remove' | 'Replace' = 'Replace' as const;
    constructor(props: string | StandardReplaceData | GenericTreeNode<SchemaTag> | StandardReplace) {
        if (props instanceof StandardReplace) {
            this._key = props._key
            this._match = props._match.clone()
            this._payload = props._payload.clone()
            return
        }
        if (isSchemaTreeNode(props) || typeof props === 'string') {
            const node = typeof props === 'string'
                ? nodeFromWML(props)
                : props
            if (!treeNodeTypeguard(isSchemaReplace)(node)) {
                throw new Error(`Schema mismatch in StandardReplace constructor call.`)
            }
            const matchNode = node.children.find(treeNodeTypeguard(isSchemaReplaceMatch))?.children?.[0]
            const match = matchNode ? standardNonEditComponentFactory(matchNode) : undefined
            const payloadNode = node.children.find(treeNodeTypeguard(isSchemaReplacePayload))?.children?.[0]
            const payload = payloadNode ? standardNonEditComponentFactory(payloadNode) : undefined
            if (!match) {
                throw new Error('No match found in StandardReplace constructor call.')
            }
            if (!payload) {
                throw new Error('No payload found in StandardReplace constructor call.')
            }
            if (!(match.key === payload.key && match.tag === payload.tag)) {
                throw new Error('Match and payload mistmatch in StandardReplace constructor call.')
            }
            this._match = match
            this._payload = payload
            this._key = new KeyPayload({ key: match.key, universalKey: match.universalKey })
            return
        }
        const match = standardNonEditComponentFactory(props.match)
        if (!match) {
            throw new Error('No payload found in StandardRemove constructor call.')
        }
        const payload = standardNonEditComponentFactory(props.payload)
        if (!payload) {
            throw new Error('No payload found in StandardRemove constructor call.')
        }
        if (!(match.key === payload.key && match.tag === payload.tag)) {
            throw new Error('Match and payload mistmatch in StandardReplace constructor call.')
        }
        this._match = match
        this._payload = payload
        this._key = new KeyPayload({ key: match.key, universalKey: match.universalKey })
    }

    get key() { return this._key.key }
    get universalKey() { return this._key.universalKey }
    get fileName() { return this._key.fileName }
    get import() { return this._match.import }
    get export() { return this._match.export }

    clone(): StandardReplace {
        return new StandardReplace(this)
    }

    mapContents(callback): StandardReplace {
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

    merge(incoming: StandardComponent): StandardComponent | undefined {
        if (!(incoming instanceof StandardReplace)) {
            throw new Error('Type mismatch in StandardReplace merge')
        }
        if (!(deepEqual(removeNDJSONOnlyProperties(this._payload.toJSON()), removeNDJSONOnlyProperties(incoming._match.toJSON())))) {
            throw new MergeConflictError()
        }
        return new StandardReplace({
            key: this.key,
            tag: 'Replace',
            match: this._match.toJSON() as StandardComponentNonEditData,
            payload: incoming._payload.toJSON() as StandardComponentNonEditData
        }).withUniversalKey(this.universalKey)
    }

    referencedKeys(): { key: string; referenceType: "Link" | "Position" | "Exit" | "Direct" | "Dependency" }[] {
        return [
            ...this._match.referencedKeys(),
            ...this._payload.referencedKeys()
        ]
    }

    withKey(key: string): StandardComponent {
        const returnValue = new StandardReplace(this.schema)
        returnValue._match = this._match.withKey(key)
        returnValue._payload = this._match.withKey(key)
        returnValue._key._universalKey = key
        returnValue._key._fileName = this.fileName
        return returnValue
    }

    withUniversalKey(key: string | undefined): StandardComponent {
        const returnValue = new StandardReplace(this.schema)
        returnValue._match = this._match.withUniversalKey(key)
        returnValue._payload = this._match.withUniversalKey(key)
        returnValue._key._universalKey = key
        returnValue._key._fileName = this.fileName
        return returnValue
    }

    withFileName(key: string | undefined): StandardComponent {
        const returnValue = new StandardReplace(this.schema)
        returnValue._match = this._match.withFileName(key)
        returnValue._payload = this._payload.withFileName(key)
        returnValue._key._fileName = key
        returnValue._key._universalKey = this._key._universalKey
        return returnValue
    }

    withImport(importData: StandardImportItem | StandardComponentImport | undefined): StandardComponent {
        const returnValue = new StandardReplace(this.schema)
        returnValue._match = this._match.withImport(importData)
        returnValue._payload = this._payload.withImport(importData)
        returnValue._key._key = returnValue._match.key
        returnValue._key._fileName = returnValue._match.fileName
        returnValue._key._universalKey = returnValue._match.universalKey
        return returnValue
    }

    withExport(exportData: StandardExportItem | StandardComponentExport | string | undefined): StandardComponent {
        const returnValue = new StandardReplace(this.schema)
        returnValue._match = this._match.withExport(exportData)
        returnValue._payload = this._payload.withExport(exportData)
        returnValue._key._key = returnValue._match.key
        returnValue._key._fileName = returnValue._match.fileName
        returnValue._key._universalKey = returnValue._match.universalKey
        return returnValue
    }

}
