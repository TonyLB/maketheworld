import { MergeConflictError } from "@tonylb/mtw-base/ts/standardize"
import { StandardComponentExport, StandardComponentExportContent, StandardComponentImport, StandardComponentImportContent, StandardComponentImportRemove, StandardComponentImportReplace } from "./dataTypes/metaData";

export interface StandardImportItem {
    toJSON(): StandardComponentImport;
    merge(incoming: StandardImportItem): StandardImportItem | undefined;
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
}

export interface StandardExportItem {
    toJSON(): StandardComponentExport;
    merge(incoming: StandardExportItem): StandardExportItem | undefined;
    exportAs: string;
}

export class ExportItemContent implements StandardExportItem {
    _exportAs: string;

    constructor(exportAs: string) {
        this._exportAs = exportAs
    }

    get exportAs() { return this._exportAs }

    toJSON(): StandardComponentExportContent {
        return {
            action: 'Content',
            payload: this._exportAs
        }
    }

    merge(incoming: StandardExportItem): StandardExportItem | undefined {
        if (incoming instanceof ExportItemContent) {
            if (this.exportAs === incoming.exportAs) {
                return this
            }
            throw new MergeConflictError()
        }
        if (incoming instanceof ExportItemRemove) {
            if (this.exportAs === incoming.exportAs) {
                return undefined
            }
            throw new MergeConflictError()
        }
        if (incoming instanceof ExportItemReplace) {
            if (this.exportAs === incoming.exportAs) {
                return new ExportItemContent(incoming._payload)
            }
            throw new MergeConflictError()
        }
        return undefined
    }
}

export class ExportItemRemove implements StandardExportItem {
    _match: string;

    constructor(exportAs: string) {
        this._match = exportAs
    }

    get exportAs() { return this._match }

    toJSON(): StandardComponentExport {
        return {
            action: 'Remove',
            match: this.exportAs
        }
    }

    merge(incoming: StandardExportItem): StandardExportItem | undefined {
        if (incoming instanceof ExportItemRemove || incoming instanceof ExportItemReplace) {
            throw new MergeConflictError()
        }
        if (incoming instanceof ExportItemContent) {
            return new ExportItemReplace(
                this.exportAs,
                incoming.exportAs
            )
        }
        return undefined
    }
}

export class ExportItemReplace implements StandardExportItem {
    _match: string;
    _payload: string;

    constructor(match: string, payload: string) {
        this._payload = payload
        this._match = match
    }

    get exportAs() { return this._match }

    toJSON(): StandardComponentExport {
        return {
            action: 'Replace',
            match: this.exportAs,
            payload: this._payload
        }
    }

    merge(incoming: StandardExportItem): StandardExportItem | undefined {
        if (incoming instanceof ExportItemReplace) {
            if (this._payload === incoming.exportAs) {
                return new ExportItemReplace(
                    this._match,
                    incoming._payload
                )
            }
            throw new MergeConflictError()
        }
        if (incoming instanceof ExportItemRemove) {
            if (this._payload === incoming.exportAs) {
                return new ExportItemRemove(this._match)
            }
            throw new MergeConflictError()
        }
        if (incoming instanceof ExportItemContent) {
            const mergedPayload = new ExportItemContent(this._payload).merge(incoming)
            if (!mergedPayload) {
                throw new MergeConflictError()
            }
            return new ExportItemReplace(
                this._match,
                mergedPayload.exportAs
            )
        }
        return undefined
    }
}
