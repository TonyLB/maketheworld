import { AssetPlayerSettingsAPIMessage } from '@tonylb/mtw-interfaces/ts/asset'

export type PlayerSettingsUpdatedEvent = {
    type: 'Player Settings Updated'
    actions: AssetPlayerSettingsAPIMessage['actions']
    RequestId?: string
}

export const isPlayerSettingsUpdatedEvent = (value: any): value is PlayerSettingsUpdatedEvent => (
    Boolean(
        value &&
        typeof value === 'object' &&
        value.type === 'Player Settings Updated' &&
        Array.isArray(value.actions) &&
        value.actions.every((action: any) => (
            action &&
            typeof action === 'object' &&
            typeof action.action === 'string' &&
            Array.isArray(action.values) &&
            action.values.every((entry: any) => typeof entry === 'string')
        )) &&
        (value.RequestId === undefined || typeof value.RequestId === 'string')
    )
)
