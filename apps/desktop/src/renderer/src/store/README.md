# Zustand Store Implementation

This directory contains the Zustand store implementation for the Triage desktop application. Zustand is a lightweight state management library that simplifies state management across the application.

## Stores

### Chat Store (`chatStore.ts`)

The chat store manages all chat-related state, including:

- Messages in the current chat
- Current chat ID
- Chat history
- Input message state
- Context items

#### Key Actions:

- `sendMessage`: Sends a message to the agent and handles the response
- `selectChat`: Loads a specific chat by ID
- `createChat`: Creates a new chat
- `clearChat`: Clears the current chat
- `setContextItems`: Sets context items for the next message
- `removeContextItem`: Removes a specific context item

### UI Store (`uiStore.ts`)

The UI store manages UI-related state, including:

- Active tab
- Sidebar visibility
- Active sidebar message ID

#### Key Actions:

- `setActiveTab`: Sets the active tab
- `toggleFactsSidebar`: Toggles the facts sidebar visibility
- `showFactsForMessage`: Shows facts for a specific message

### Agent Store (`agentStore.ts`)

The agent store manages agent-related state and events, including:

- Cell manager for streaming updates
- Agent update registration

#### Key Actions:

- `setCellManager`: Sets the current cell manager
- `registerAgentUpdates`: Registers for agent updates
- `unregisterAgentUpdates`: Unregisters from agent updates

## Usage

Import stores from the index file:

```typescript
import { useChatStore, useUIStore, useAgentStore } from "../store";

// Access state and actions
const { messages, sendMessage } = useChatStore();
const { showFactsSidebar, toggleFactsSidebar } = useUIStore();
```

## Agent Events

Use the `useAgentEvents` hook to register for agent events:

```typescript
import { useAgentEvents } from "../hooks/useAgentEvents";

// In your component
const { cellManager } = useChatStore();
useAgentEvents(cellManager);
```
