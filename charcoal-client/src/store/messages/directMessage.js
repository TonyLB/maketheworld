import baseMessage from './base.js'

export class directMessage extends baseMessage {
    constructor(props = {}) {
        super(props)
        const { MessageId, Message = '', CharacterId, Recipients, ThreadId } = props
        this.MessageId = MessageId
        this.Message = Message
        this.CharacterId = CharacterId
        this.Recipients = Recipients
        this.ThreadId = ThreadId
    }
}

export default directMessage