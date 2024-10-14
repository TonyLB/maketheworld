export type SubscribeAPIMessage = {
    message: 'subscribe';
    source: string;
    detailType?: string;
}

export type SubscriptionsAPIMessage = SubscribeAPIMessage

export const isSubscribeAPIMessage = (message: SubscriptionsAPIMessage): message is SubscribeAPIMessage => (message.message === 'subscribe')

export const isSubscriptionsAPIMessage = (message: Record<string, any>): message is SubscriptionsAPIMessage => {
    if (!('message' in message)) {
        return false
    }
    switch(message.message) {
        case 'subscribe':
            return ('source' in message)
                && typeof message.source === 'string'
                && (!('detailType' in message) || typeof message.detailType === 'undefined' || typeof message.detailType === 'string')
        default: return false
    }
}
