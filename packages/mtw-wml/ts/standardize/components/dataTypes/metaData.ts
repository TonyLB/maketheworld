export type StandardComponentImportPayload = {
    assetId: string;
    fromKey: string;
}

export type StandardComponentImportContent = {
    action: 'Content';
    payload: StandardComponentImportPayload;
}

export type StandardComponentImportRemove = {
    action: 'Remove';
    match: StandardComponentImportPayload;
}

export type StandardComponentImportReplace = {
    action: 'Replace';
    match: StandardComponentImportPayload;
    payload: StandardComponentImportPayload
}

export type StandardComponentImport = StandardComponentImportContent | StandardComponentImportRemove | StandardComponentImportReplace

export type StandardComponentExportContent = {
    action: 'Content';
    payload: string;
}

export type StandardComponentExportRemove = {
    action: 'Remove';
    match: string;
}

export type StandardComponentExportReplace = {
    action: 'Replace';
    match: string;
    payload: string;
}

export type StandardComponentExport = StandardComponentExportContent | StandardComponentExportRemove | StandardComponentExportReplace
