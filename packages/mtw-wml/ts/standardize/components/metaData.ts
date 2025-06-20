import { MergeConflictError } from "@tonylb/mtw-base/ts/standardize"
import { StandardComponentImport, StandardComponentImportContent, StandardComponentImportRemove, StandardComponentImportReplace } from "./dataTypes/metaData";

export interface StandardImportItem {
    toJSON(): StandardComponentImport;
    merge(incoming: StandardImportItem): StandardImportItem | undefined;
    diff(incoming: StandardImportItem): StandardImportItem | undefined;
    assetId: string;
    fromKey: string;
}

export class ImportItemContent implements StandardImportItem {
    _assetId: string;
    _fromKey: string;

    constructor(assetId: string, fromKey: string) {
        this._assetId = assetId
        this._fromKey = fromKey
    }

    get assetId() { return this._assetId }
    get fromKey() { return this._fromKey }

    toJSON(): StandardComponentImportContent {
        return {
            action: 'Content',
            payload: {
                assetId: this.assetId,
                fromKey: this.fromKey
            }
        }
    }

    merge(incoming: StandardImportItem): StandardImportItem | undefined {
        if (incoming instanceof ImportItemContent) {
            if (this.assetId === incoming.assetId && this.fromKey === incoming.fromKey) {
                return this
            }
            throw new MergeConflictError()
        }
        if (incoming instanceof ImportItemRemove) {
            if (this.assetId === incoming.assetId && this.fromKey === incoming.fromKey) {
                return undefined
            }
            throw new MergeConflictError()
        }
        if (incoming instanceof ImportItemReplace) {
            if (this.assetId === incoming.assetId && this.fromKey === incoming.fromKey) {
                return new ImportItemContent(incoming._payload.assetId, incoming._payload.fromKey)
            }
            throw new MergeConflictError()
        }
        return undefined
    }

    diff(incoming: StandardImportItem): StandardImportItem | undefined {
        if (incoming instanceof ImportItemContent) {
            if (this.assetId === incoming.assetId && this.fromKey === incoming.fromKey) {
                return undefined
            }
            return new ImportItemReplace(this, incoming)
        }
        if (incoming instanceof ImportItemRemove || incoming instanceof ImportItemReplace) {
            throw new MergeConflictError()
        }
        return undefined
    }
}

export class ImportItemRemove implements StandardImportItem {
    _assetId: string;
    _fromKey: string;

    constructor(assetId: string, fromKey: string) {
        this._assetId = assetId
        this._fromKey = fromKey
    }

    get assetId() { return this._assetId }
    get fromKey() { return this._fromKey }

    toJSON(): StandardComponentImportRemove {
        return {
            action: 'Remove',
            match: {
                assetId: this.assetId,
                fromKey: this.fromKey
            }
        }
    }

    merge(incoming: StandardImportItem): StandardImportItem | undefined {
        if (incoming instanceof ImportItemRemove || incoming instanceof ImportItemReplace) {
            throw new MergeConflictError()
        }
        if (incoming instanceof ImportItemContent) {
            return new ImportItemReplace(
                { assetId: this.assetId, fromKey: this.fromKey },
                { assetId: incoming.assetId, fromKey: incoming.fromKey }
            )
        }
        return undefined
    }

    diff(incoming: StandardImportItem): StandardImportItem | undefined {
        if (incoming instanceof ImportItemRemove) {
            if (this.assetId === incoming.assetId && this.fromKey === incoming.fromKey) {
                return undefined
            }
            throw new ImportItemReplace(this, incoming)
        }
        if (incoming instanceof ImportItemReplace) {
            if (this.assetId === incoming._match.assetId && this.fromKey === incoming._match.fromKey) {
                return new ImportItemContent(incoming._payload.assetId, incoming._payload.fromKey)
            }
        }
        throw new MergeConflictError()
    }
}

export class ImportItemReplace implements StandardImportItem {
    _match: {
        assetId: string;
        fromKey: string;    
    }
    _payload: {
        assetId: string;
        fromKey: string;    
    }

    constructor(match: { assetId: string, fromKey: string }, payload: { assetId: string, fromKey: string }) {
        this._payload = payload
        this._match = match
    }

    get assetId() { return this._match.assetId }
    get fromKey() { return this._match.fromKey }

    toJSON(): StandardComponentImportReplace {
        return {
            action: 'Replace',
            match: {
                assetId: this.assetId,
                fromKey: this.fromKey
            },
            payload: {
                assetId: this._payload.assetId,
                fromKey: this._payload.fromKey
            }
        }
    }

    merge(incoming: StandardImportItem): StandardImportItem | undefined {
        if (incoming instanceof ImportItemReplace) {
            if (this._payload.assetId === incoming.assetId && this._payload.fromKey === incoming.fromKey) {
                return new ImportItemReplace(
                    this._match,
                    incoming._payload
                )
            }
            throw new MergeConflictError()
        }
        if (incoming instanceof ImportItemRemove) {
            if (this._payload.assetId === incoming.assetId && this._payload.fromKey === incoming.fromKey) {
                return new ImportItemRemove(this.assetId, this.fromKey)
            }
            throw new MergeConflictError()
        }
        if (incoming instanceof ImportItemContent) {
            const mergedPayload = new ImportItemContent(this._payload.assetId, this._payload.fromKey).merge(incoming)
            if (!mergedPayload) {
                throw new MergeConflictError()
            }
            return new ImportItemReplace(
                this._match,
                { assetId: mergedPayload.assetId, fromKey: mergedPayload.fromKey }
            )
        }
        return undefined
    }

    diff(incoming: StandardImportItem): StandardImportItem | undefined {
        if (incoming instanceof ImportItemReplace) {
            if (this._match.assetId === incoming._match.assetId && this._match.fromKey === incoming._match.fromKey) {
                if (this._payload.assetId === incoming._payload.assetId && this._payload.fromKey === incoming._payload.fromKey) {
                    return undefined
                }
                return new ImportItemReplace(
                    { assetId: this._payload.assetId, fromKey: this._payload.fromKey },
                    { assetId: incoming._payload.assetId, fromKey: incoming._payload.fromKey }
                )
            }
            throw new MergeConflictError()
        }
        if (incoming instanceof ImportItemRemove) {
            if (this._match.assetId === incoming.assetId && this._match.fromKey === incoming.fromKey) {
                return new ImportItemRemove(this._payload.assetId, this._payload.fromKey)
            }
        }
        throw new MergeConflictError()
    }
}
