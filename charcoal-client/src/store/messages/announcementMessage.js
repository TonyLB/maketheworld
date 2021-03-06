import baseMessage from './base.js'

export class announcementMessage extends baseMessage {
    constructor(props = {}) {
        super(props)
        const { Title = '', Message = '', Target = '' } = props
        this.Message = Message
        this.Title = Title
        this.Target = Target
    }
}

export default announcementMessage