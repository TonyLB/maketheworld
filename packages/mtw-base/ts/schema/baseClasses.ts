export type SchemaBase = {
}

export type SchemaWrapper = {
    wrapperKey?: string;
}

export type SchemaImportableBase = SchemaBase & {
    as?: string;
}
