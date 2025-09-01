export type SchemaTagType = 
    'Asset' |
    'Pronouns' |
    'Character' |
    'Image' |
    'Variable' |
    'Computed' |
    'Action' |
    'Import' |
    'Meta' |
    'Selected' |
    'If' |
    'ElseIf' |
    'Else' |
    'Remove' |
    'Replace' |
    'With' |
    'Exit' |
    'Description' |
    'Summary' |
    'br' |
    'Space' |
    'Link' |
    'ShortName' |
    'Name' |
    'Example' |
    'Room' |
    'Feature' |
    'Knowledge' |
    'Position' |
    'Map' |
    'String' |
    'Message' |
    'Moment' |
    'Grant'

export const isLegalSchemaTag = (value: any): value is SchemaTagType => (
    typeof value === 'string' && [
        'Asset',
        'Pronouns',
        'Character',
        'Image',
        'Variable',
        'Computed',
        'Action',
        'Import',
        'Meta',
        'Selected',
        'If',
        'ElseIf',
        'Else',
        'Remove',
        'Replace',
        'With',
        'Exit',
        'Description',
        'Summary',
        'br',
        'Space',
        'Link',
        'ShortName',
        'Name',
        'Example',
        'Room',
        'Feature',
        'Knowledge',
        'Position',
        'Map',
        'String',
        'Message',
        'Moment',
        'Grant'
    ].includes(value)
)
