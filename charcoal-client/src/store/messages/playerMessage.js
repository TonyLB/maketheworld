import baseMessage from './base.js'

export class playerMessage extends baseMessage {
    constructor(props = {}) {
        super(props)
        const { MessageId, CharacterId = '', Message = '', Target } = props
        this.MessageId = MessageId
        this.CharacterId = CharacterId
        this.Message = Message
        this.Target = Target
    }
}

export default playerMessage