# Markdown-to-Slack Formatter Implementation Plan

## Overview
Implement a markdown formatter for all final Slack messages in n8n workflows using a markdown-to-slack conversion library.

## Library Evaluation

### 1. md-to-slack (nicoespeon) ✅ SELECTED
**Pros:**
- Higher trust score: 9.2/10
- Modern TypeScript implementation
- Simple API: `markdownToSlack(text)`
- 12 code examples available
- Active maintenance (pnpm, modern tooling)
- Clean conversion: `**bold**` → `*bold*`

**Example Usage:**
```javascript
import { markdownToSlack } from "md-to-slack";
const slackText = markdownToSlack("Hello **world**!");
// Output: "Hello *world*!"
```

### 2. slackify-markdown (jsarafajr) ❌ NOT SELECTED
**Cons:**
- Lower trust score: 7.3/10
- Older CommonJS implementation
- Less documentation (2 snippets vs 12)
- Less actively maintained

## Implementation Strategy

### Phase 1: Create Custom Code Node
Create a reusable n8n Code node that:
1. Installs md-to-slack via dynamic import
2. Processes markdown content in message text
3. Returns formatted Slack mrkdwn

### Phase 2: Integration Points
Apply formatter to these workflow components:
1. **Production Workflow**: Final response messages in `Send Final Response` node
2. **Template Workflows**: All Slack message nodes in workflow templates
3. **Streaming Updates**: Real-time block message formatting

### Phase 3: Testing
1. Test with sample markdown content
2. Verify Slack mrkdwn compatibility
3. Ensure no breaking changes to existing workflows

## Technical Implementation

### Custom Formatter Node Code
```javascript
// Markdown to Slack Formatter
// Dynamically import md-to-slack and convert message content

const items = $input.all();
const results = [];

// Import the library (dynamic import for n8n compatibility)
const { markdownToSlack } = await import('md-to-slack');

for (const item of items) {
  const originalData = item.json;
  
  // Format text fields that might contain markdown
  const formattedData = { ...originalData };
  
  if (formattedData.text) {
    formattedData.text = markdownToSlack(formattedData.text);
  }
  
  if (formattedData.result) {
    formattedData.result = markdownToSlack(formattedData.result);
  }
  
  results.push({ json: formattedData });
}

return results;
```

### Installation Requirements
The md-to-slack package needs to be available in the n8n environment:
```bash
npm install md-to-slack
```

## Workflow Integration Points

### 1. Production Workflow (`PERSISTENT_COLLABORATIVE_WORKFLOW.json`)
- Insert formatter before `Send Final Response` node
- Position between Claude Code output and Slack message

### 2. Template Workflows
- `automatic-bug-fixer.json`: Format GitHub issue comments
- `customer-support-automation.json`: Format customer emails and responses  
- `codebase-documentation-generator.json`: Format documentation notifications

### 3. Streaming Updates
- Format real-time block messages in `Simplified Streaming Processor`
- Ensure markdown in block content is properly converted

## Benefits
1. **Consistent Formatting**: All Slack messages use proper mrkdwn syntax
2. **Improved Readability**: Bold, italic, code blocks render correctly in Slack
3. **Minimal Changes**: Non-breaking addition to existing workflows
4. **Reusable**: Single formatter node can be copied across workflows

## Implementation Steps
1. ✅ Evaluate libraries and select md-to-slack
2. 🔄 Create custom formatter code node
3. 🔄 Test formatter with sample content
4. 🔄 Integrate into production workflow
5. 🔄 Update workflow templates
6. 🔄 Document usage and examples

## File Locations
- Formatter implementation: `/src/workflows/markdown-to-slack-formatter.js`
- Updated production workflow: `/workflows/production/PERSISTENT_COLLABORATIVE_WORKFLOW.json`
- Updated templates: `/workflow-templates/*.json`