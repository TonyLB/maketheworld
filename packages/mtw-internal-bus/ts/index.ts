type InternalMessageItem<PayloadType> = {
    processedBy: string[];
    payload: PayloadType;
}

export class InternalMessageBus<PayloadType> {
    _stream: InternalMessageItem<PayloadType>[] = []

    send(payload: PayloadType): void {
        this._stream.push({
            processedBy: [],
            payload
        })
    }
}
