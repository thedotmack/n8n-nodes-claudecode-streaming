# Multi-Agent Slack Router Setup Guide

## Overview

The multi-agent router enables a single n8n workflow to handle multiple Slack channels, each connected to different Claude Code agent personalities. This setup builds on the existing streaming infrastructure while adding intelligent routing capabilities.

## Architecture

```
Slack Events → Router Workflow → Agent Personality Loading → Claude Code → Channel-Specific Response
```

## Setup Instructions

### 1. Import Router Workflow

Import `workflows/multi-agent-slack-router.json` into your n8n instance.

**Webhook URL:** `https://n8n.empire.markets/webhook/slack-multi-agent`

### 2. Configure Channel Mappings

Update the channel-to-agent mapping in the "Route to Agent" node:

```javascript
const channelAgentMapping = {
  'C1234567890': 'empire-ceo-agent',      // Replace with actual channel IDs
  'C1234567891': 'empire-product-hunter-agent',
  'C1234567892': 'empire-store-builder-agent',
  'C1234567893': 'empire-ad-manager-agent',
  'C1234567894': 'empire-creative-director-agent',
  'C1234567895': 'empire-data-analyst-agent',
  'C1234567896': 'empire-supply-chain-agent'
};
```

### 3. Verify Agent Folder Structure

Ensure each agent folder exists with a `CLAUDE.md` file:

```
/home/node/empire-ceo-agent/CLAUDE.md
/home/node/empire-product-hunter-agent/CLAUDE.md
/home/node/empire-store-builder-agent/CLAUDE.md
/home/node/empire-ad-manager-agent/CLAUDE.md
/home/node/empire-creative-director-agent/CLAUDE.md
/home/node/empire-data-analyst-agent/CLAUDE.md
/home/node/empire-supply-chain-agent/CLAUDE.md
```

### 4. Configure Slack App Events

Add the router webhook URL to your Slack app's Event Subscriptions:

1. Go to your Slack app settings
2. Navigate to "Event Subscriptions"
3. Set Request URL: `https://n8n.empire.markets/webhook/slack-multi-agent`
4. Subscribe to workspace events: `message.channels`

### 5. Update Streaming Webhook (Optional)

If using real-time streaming, ensure the streaming webhook handler is configured to accept channel-specific routing data.

## Features

### Automatic Agent Selection
- Maps Slack channel IDs to specific agent personalities
- Loads appropriate `CLAUDE.md` files dynamically
- Injects personality context into Claude Code requests

### Per-Channel Conversation Persistence
- Uses channel ID as conversation identifier
- Maintains separate conversation threads per channel
- Leverages Claude Code SDK's built-in persistence

### Real-Time Streaming Support
- Integrates with existing streaming infrastructure
- Routes streaming updates to correct channels
- Includes agent identification in stream messages

### Error Handling
- Graceful fallback for unmapped channels
- Agent loading error handling
- Slack error notifications with channel context

## Testing

### Single Channel Test
1. Send a message in a configured Slack channel
2. Verify the correct agent personality responds
3. Check that responses include agent identification
4. Confirm conversation persistence across messages

### Multi-Channel Test
1. Send concurrent messages to different channels
2. Verify each channel receives responses from the correct agent
3. Check that conversations remain isolated per channel
4. Test real-time streaming to multiple channels

## Configuration Files

- **Router Workflow:** `workflows/multi-agent-slack-router.json`
- **Streaming Handler:** `workflows/streaming-webhook-handler.json` (updated for multi-channel)
- **Node Enhancement:** `nodes/ClaudeCode/ClaudeCodeStreaming.node.ts` (added channel context)

## Agent Folder Structure Verified

✅ **Compatible Agent Folders Found:**
- `/home/node/empire-blaze-agent/` (Store Builder)
- `/home/node/empire-hunter-agent/` (Product Hunter) 
- `/home/node/empire-oracle-agent/` (Data Analyst)
- `/home/node/empire-phoenix-agent/` (Creative Director)
- `/home/node/empire-rocco-agent/` (CEO)
- `/home/node/empire-steel-agent/` (Supply Chain)
- `/home/node/empire-tank-agent/` (Ad Manager)

Each folder contains a properly formatted `CLAUDE.md` file with agent personality and operational instructions.

## Benefits

1. **Resource Efficiency:** Single workflow handles all agents
2. **Centralized Management:** Easy to add/modify agents
3. **Conversation Isolation:** Separate threads per channel
4. **Real-Time Updates:** Streaming works across all channels
5. **Agent Identification:** Clear attribution in responses

## Troubleshooting

### Channel Not Mapped
- Check channel ID in Slack (right-click channel → Copy link → extract ID)
- Update `channelAgentMapping` in "Route to Agent" node
- Verify channel format matches the expected pattern

### Agent Loading Errors
- Confirm agent folder exists at specified path
- Verify `CLAUDE.md` file is present and readable
- Check file permissions and content format

### Streaming Issues
- Ensure streaming webhook handler is imported
- Verify webhook URL configuration in Claude Code node
- Check channel routing in streaming processor

### Slack Authentication
- Confirm Slack app OAuth permissions
- Verify bot token has `chat:write` scope
- Check webhook URL accessibility from Slack

## Next Steps

1. Import and configure the router workflow
2. Map your actual Slack channel IDs to agents
3. Test with single channel messages
4. Scale to multiple concurrent channels
5. Monitor agent performance and conversation quality

The multi-agent router provides a scalable foundation for deploying specialized AI agents across your Slack workspace while maintaining efficient resource usage and clear conversation boundaries.