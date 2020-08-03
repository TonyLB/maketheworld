exports.gqlOutput = `
  MessageId
  CreatedTime
  ExpirationTime
  DisplayProtocol
  Target
  RoomId
  WorldMessage {
    Message
  }
  CharacterMessage {
    Message
    CharacterId
  }
  DirectMessage {
    Message
    CharacterId
    Title
    Recipients
  }
  AnnounceMessage {
    Message
    Title
  }
`
