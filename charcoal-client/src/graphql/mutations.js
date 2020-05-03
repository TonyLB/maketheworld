/* eslint-disable */
// this is an auto generated file. This will be overwritten

export const putPlayer = /* GraphQL */ `
  mutation PutPlayer($PlayerName: String, $CodeOfConductConsent: Boolean) {
    putPlayer(
      PlayerName: $PlayerName
      CodeOfConductConsent: $CodeOfConductConsent
    ) {
      PlayerName
      CodeOfConductConsent
    }
  }
`;
export const putCharacter = /* GraphQL */ `
  mutation PutCharacter(
    $Name: String!
    $CharacterId: String
    $Pronouns: String
    $FirstImpression: String
    $Outfit: String
    $OneCoolThing: String
    $HomeId: String
  ) {
    putCharacter(
      Name: $Name
      CharacterId: $CharacterId
      Pronouns: $Pronouns
      FirstImpression: $FirstImpression
      Outfit: $Outfit
      OneCoolThing: $OneCoolThing
      HomeId: $HomeId
    ) {
      PlayerName
      Name
      CharacterId
      Pronouns
      FirstImpression
      Outfit
      OneCoolThing
      HomeId
      Grants {
        Resource
        Action
      }
    }
  }
`;
export const addCharacterInPlay = /* GraphQL */ `
  mutation AddCharacterInPlay($CharacterId: String!, $ConnectionId: String!) {
    addCharacterInPlay(CharacterId: $CharacterId, ConnectionId: $ConnectionId) {
      CharacterId
      Character {
        PlayerName
        Name
        CharacterId
        Pronouns
        FirstImpression
        Outfit
        OneCoolThing
        HomeId
      }
      RoomId
      ConnectionId
    }
  }
`;
export const deleteCharacterInPlay = /* GraphQL */ `
  mutation DeleteCharacterInPlay($ConnectionId: String!) {
    deleteCharacterInPlay(ConnectionId: $ConnectionId) {
      CharacterId
      Character {
        PlayerName
        Name
        CharacterId
        Pronouns
        FirstImpression
        Outfit
        OneCoolThing
        HomeId
      }
      RoomId
      ConnectionId
    }
  }
`;
export const moveCharacter = /* GraphQL */ `
  mutation MoveCharacter($CharacterId: String!, $RoomId: String!) {
    moveCharacter(CharacterId: $CharacterId, RoomId: $RoomId) {
      CharacterId
      Character {
        PlayerName
        Name
        CharacterId
        Pronouns
        FirstImpression
        Outfit
        OneCoolThing
        HomeId
      }
      RoomId
      ConnectionId
    }
  }
`;
export const putNeighborhood = /* GraphQL */ `
  mutation PutNeighborhood(
    $PermanentId: String
    $Name: String!
    $Description: String
    $ParentId: String
    $Visibility: String
  ) {
    putNeighborhood(
      PermanentId: $PermanentId
      Name: $Name
      Description: $Description
      ParentId: $ParentId
      Visibility: $Visibility
    ) {
      PermanentId
      Type
      Name
      Ancestry
      Description
      ParentId
      Visibility
    }
  }
`;
export const externalPutNeighborhood = /* GraphQL */ `
  mutation ExternalPutNeighborhood(
    $PermanentId: String!
    $Name: String!
    $Ancestry: String!
    $Description: String
    $ParentId: String
    $Visibility: String
  ) {
    externalPutNeighborhood(
      PermanentId: $PermanentId
      Name: $Name
      Ancestry: $Ancestry
      Description: $Description
      ParentId: $ParentId
      Visibility: $Visibility
    ) {
      PermanentId
      Type
      Name
      Ancestry
      Description
      ParentId
      Visibility
    }
  }
`;
export const putRoom = /* GraphQL */ `
  mutation PutRoom(
    $PermanentId: String
    $Name: String!
    $Description: String
    $ParentId: String
    $Visibility: String
    $Exits: [PathInput]
    $Entries: [PathInput]
  ) {
    putRoom(
      PermanentId: $PermanentId
      Name: $Name
      Description: $Description
      ParentId: $ParentId
      Visibility: $Visibility
      Exits: $Exits
      Entries: $Entries
    ) {
      PermanentId
      Type
      Name
      Ancestry
      Description
      ParentId
      Visibility
      Exits {
        Name
        RoomId
        Ancestry
      }
      Entries {
        Name
        RoomId
      }
    }
  }
`;
export const externalPutRoom = /* GraphQL */ `
  mutation ExternalPutRoom(
    $PermanentId: String!
    $Name: String!
    $Ancestry: String!
    $Description: String
    $ParentId: String
    $Visibility: String
  ) {
    externalPutRoom(
      PermanentId: $PermanentId
      Name: $Name
      Ancestry: $Ancestry
      Description: $Description
      ParentId: $ParentId
      Visibility: $Visibility
    ) {
      PermanentId
      Type
      Name
      Ancestry
      Description
      ParentId
      Visibility
    }
  }
`;
export const putRoomMessage = /* GraphQL */ `
  mutation PutRoomMessage(
    $RoomId: String!
    $Message: String!
    $MessageType: String
    $Title: String
    $FromCharacterId: String
    $MessageId: String
    $CreatedTime: Long
  ) {
    putRoomMessage(
      RoomId: $RoomId
      Message: $Message
      MessageType: $MessageType
      Title: $Title
      FromCharacterId: $FromCharacterId
      MessageId: $MessageId
      CreatedTime: $CreatedTime
    ) {
      MessageId
      CreatedTime
      Target
      Message
      RoomId
      CharacterId
      FromCharacterId
      ToCharacterId
      Recap
      ExpirationTime
      Type
      Title
    }
  }
`;
export const putDirectMessage = /* GraphQL */ `
  mutation PutDirectMessage(
    $CharacterId: String!
    $Message: String!
    $FromCharacterId: String!
    $ToCharacterId: String!
    $MessageId: String
    $CreatedTime: Long
  ) {
    putDirectMessage(
      CharacterId: $CharacterId
      Message: $Message
      FromCharacterId: $FromCharacterId
      ToCharacterId: $ToCharacterId
      MessageId: $MessageId
      CreatedTime: $CreatedTime
    ) {
      MessageId
      CreatedTime
      Target
      Message
      RoomId
      CharacterId
      FromCharacterId
      ToCharacterId
      Recap
      ExpirationTime
      Type
      Title
    }
  }
`;
