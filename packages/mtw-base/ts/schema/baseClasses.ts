import { AssetUUID } from ".";

export type SchemaBase = {
}

export type SchemaWrapper = {
    wrapperKey?: string;
}

export type SchemaImportableBase = SchemaBase & {
    from?: AssetUUID;
    origin?: AssetUUID[];
}
