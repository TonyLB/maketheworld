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
