# Architectural Philosophy - Agent Navigation Guide

## Overview

Make The World's architecture embodies a fundamental philosophical principle: **events should only generate computational work when there are active viewpoint characters to perceive the results**. This perception-driven processing model shapes every aspect of the system's design, from cost optimization to narrative immersion.

## Core Philosophy: "If a Tree Falls in the Forest..."

The classic philosophical question "If a tree falls in the forest and nobody is there to hear it, does it make a sound?" receives a definitive answer in Make The World's architecture: **NO**.

### The Principle

**Perception-Driven Processing**: The system only calculates and caches perception events when there are active characters positioned to perceive them. This principle operates at multiple levels:

- **Event Generation**: World changes only trigger perception calculations when viewpoint characters are present
- **Cache Updates**: Perception-related cache entries are only updated when characters can observe the results  
- **Message Routing**: Messages are only generated and routed when there are character recipients
- **Resource Allocation**: Computational resources are only expended when the results will be experienced

### Implementation Overview

The system implements this principle through character presence detection before any perception processing occurs. The primary mechanism checks for active characters in relevant rooms before expending computational resources.

**Key Decision Point**: Before any perception rendering or cache updates occur, the system verifies character presence. If no characters are present, no computational work is performed.

For detailed technical implementation, see **[Event Architecture](AGENT.architecture.events.md)** which covers the complete event processing pipeline, character presence detection mechanisms, and specific code examples.

## Dual-Mode Processing Model

The system maintains a critical distinction between authoring and playing contexts. For detailed user experience implementation of these modes, see **[Client Architecture](charcoal-client/AGENT.md)** which documents how this philosophical distinction manifests in the frontend interface.

### **Authoring Mode: Immediate Updates**
When users work as collaborative authors, updates happen immediately regardless of character presence:
- **WML Changes**: Asset modifications are reflected in real-time for all authors
- **Collaborative Editing**: Multiple authors see each other's changes instantly
- **Version Control**: Asset state synchronization happens continuously
- **Administrative Functions**: Permission changes and asset management occur immediately

**Rationale**: Authors need immediate feedback on their creative work. The cost of these updates is justified because they serve the fundamental content creation purpose.

### **Playing Mode: Perception-Driven Updates**
When users engage through character perspectives, updates only occur when characters can perceive them:
- **Room Descriptions**: Only rendered when characters are present in the room
- **Environmental Changes**: Only calculated and cached when observable
- **Character Interactions**: Only processed when affecting perceived reality
- **Narrative Events**: Only generated when there are character witnesses

**Rationale**: This maintains both narrative immersion and cost efficiency. Characters experience a consistent fictional reality while avoiding unnecessary computational expense.

## Cost Optimization Strategy

### Scale-to-Zero Architecture

The perception-driven model directly supports the system's scale-to-zero cost optimization goals:

**Primary Objective**: Enable community storytelling platforms that cost **pennies per month** for small communities, scaling sub-linearly to **~$10/month** for communities of dozens or hundreds of users.

**Target Users**: Other people who want to install MTW on their own AWS accounts to support community storytelling, particularly small communities just starting out.

### Carrying Costs Minimization

**"Carrying Costs"** are the AWS service costs incurred even when the system is inactive. The perception-driven model minimizes these costs by:

#### **Event-Driven Computation**
- **Lambda Functions**: Only execute when triggered by actual user activity
- **Database Operations**: Only occur when needed for active character perspectives
- **Cache Updates**: Only happen when characters are present to benefit from them
- **Message Processing**: Only routes messages when there are recipients

#### **Avoided Services**
Several AWS services would simplify development but create carrying costs:
- **OpenSearch**: Would enable vector search for AI generation but has constant costs
- **Neptune**: Would provide robust graph database but requires always-on instances  
- **ElastiCache**: Would improve performance but adds baseline costs
- **RDS**: Traditional databases require constant provisioning

#### **Cost vs. Performance Trade-offs**
The system explicitly chooses **affordability over performance**:
- **Slower AI**: Uses cost-effective models rather than premium options
- **Cold Start Delays**: Accepts Lambda warm-up time to avoid reserved capacity costs
- **Higher Latency**: Triple-digit millisecond response times rather than single-digit
- **Development Complexity**: More complex serverless architecture to minimize ongoing costs

**Philosophy**: "Make The World is a Honda Civic, not a Lamborghini" - frugal by design, optimized for accessibility rather than luxury performance.

## Technical Architecture Overview

The perception-driven principle influences every aspect of the technical architecture:

### **Event Processing Philosophy**
1. **Event Trigger**: World change events occur
2. **Context Determination**: System distinguishes authoring vs playing contexts  
3. **Presence-Based Routing**: Playing events check for character witnesses before processing
4. **Resource Conservation**: Computational work only occurs when results will be perceived

### **Caching Philosophy**
- **Selective Population**: Caches only populated when characters can benefit
- **Real-Time Presence Tracking**: Character location maintained for filtering decisions
- **Context-Aware Invalidation**: Different invalidation strategies for authoring vs playing

For complete technical details including code examples, event flow diagrams, caching mechanisms, and implementation patterns, see **[Event Architecture](AGENT.architecture.events.md)**.

## Philosophical Benefits

### Narrative Consistency
The perception-driven model supports immersive storytelling by ensuring:
- **Consistent Reality**: Characters experience a coherent fictional world
- **No Meta-Gaming**: Players can't access information their characters shouldn't know
- **Authentic Perspective**: All information flows through character viewpoints

### Resource Respect
The model demonstrates respect for community resources:
- **Financial Accessibility**: Keeps costs low for small communities
- **Environmental Responsibility**: Minimizes unnecessary computation
- **Community Sustainability**: Enables long-term platform viability

### Development Clarity
The philosophical consistency provides clear decision-making criteria:
- **Feature Decisions**: "Does this serve character perception or authoring collaboration?"
- **Performance Trade-offs**: "Does this optimization justify increased carrying costs?"
- **Architecture Choices**: "Can this be event-driven rather than always-on?"

## Implementation Philosophy in Practice

The perception-driven principle manifests in concrete ways throughout the system:

### **Room Updates**
- **Authoring Changes**: WML modifications are immediately visible to all authors
- **Character Perception**: Room description updates only propagate to characters when they are present to perceive them
- **Resource Conservation**: No computational work occurs for empty rooms

### **Character Movement**
- **Location Tracking**: Character locations are always maintained for presence detection
- **Witness-Based Messages**: Departure and arrival messages only sent when other characters are present  
- **Individual Perception**: Moving characters always receive their new room description

For detailed code examples and implementation patterns, see **[Event Architecture](AGENT.architecture.events.md)**.

## Future Architectural Considerations

### Planned Extensions

The perception-driven philosophy will guide future development:

#### **Real-Time Collaborative Editing**
- **Authoring Mode**: Immediate updates for multiple authors working on shared content
- **Character Mode**: Perception-driven updates only when characters would observe changes

#### **Advanced AI Integration**
- **Cost-Conscious AI**: Only invoke AI processing when characters are present to benefit
- **Perception-Filtered AI**: AI responses filtered through character knowledge and perspective
- **Selective AI Features**: Premium AI features only when usage justifies costs

#### **Performance Optimization**
- **Smart Preloading**: Anticipate character movement to preload likely perceptions
- **Perception Caching**: Cache common perceptions while maintaining character-specific filtering
- **Adaptive Resource Allocation**: Scale resources based on active character count

### Architectural Patterns

The philosophy establishes patterns for future system expansion:

#### **New Feature Evaluation**
1. **Does it serve character perception or authoring collaboration?**
2. **Can it be event-driven rather than continuous?**
3. **Does the value justify any carrying costs?**
4. **Can it respect the character viewpoint limitations?**

#### **Service Selection Criteria**
1. **Does it scale to zero?**
2. **Are carrying costs justified by essential functionality?**
3. **Can equivalent functionality be achieved with event-driven alternatives?**
4. **Does it support the community affordability goal?**

## Navigation Tips

1. **Start with Philosophy**: Understand the "perception-driven" principle before diving into implementation
2. **Client Implementation**: See [Client Architecture](charcoal-client/AGENT.md) for how authoring vs playing modes are implemented in the user interface
3. **Technical Details**: Review [Event Architecture](AGENT.architecture.events.md) for detailed event processing and character presence filtering
4. **Cost Documentation**: See `documentation/foundations.md` for scale-to-zero service details
5. **Foundational Concepts**: Check `documentation/foundations.md` for additional architectural background

## Development Notes

### Current Implementation
- **Perception Filtering**: Active and working in production
- **Cost Optimization**: Successfully achieving pennies-per-month for small communities
- **Dual-Mode Processing**: Clear separation between authoring and playing contexts
- **Character Presence Detection**: Real-time tracking via `RoomCharacterList` cache

### Future Enhancements
- **Advanced Presence Prediction**: Anticipate likely character movements for preloading
- **Granular Permission Filtering**: More sophisticated character access control
- **Performance Monitoring**: Track cost-per-character metrics for optimization
- **Community Analytics**: Help communities understand their usage patterns and costs

### Philosophical Consistency
The perception-driven principle provides a clear North Star for all architectural decisions: **serve character perception and community affordability above all else**. This philosophical consistency enables confident decision-making even in complex technical trade-off situations.

This architecture demonstrates that philosophical principles, when consistently applied, can create both technical elegance and practical value - enabling communities to tell stories together without financial barriers while maintaining immersive fictional experiences.
