// Markdown to Slack Formatter
// Converts markdown content to Slack-compatible mrkdwn syntax
// Uses md-to-slack library for reliable conversion

const items = $input.all();
const results = [];

// Note: md-to-slack needs to be installed in n8n environment
// Run: npm install md-to-slack

try {
  // Dynamic import for n8n compatibility
  const { markdownToSlack } = await import('md-to-slack');
  
  for (const item of items) {
    const originalData = item.json;
    const formattedData = { ...originalData };
    
    // Format common text fields that might contain markdown
    const fieldsToFormat = [
      'text',           // Main message text
      'result',         // Claude Code result text
      'content',        // Block message content
      'message',        // Generic message field
      'body',           // Email/comment body
      'description'     // Description field
    ];
    
    fieldsToFormat.forEach(field => {
      if (formattedData[field] && typeof formattedData[field] === 'string') {
        try {
          formattedData[field] = markdownToSlack(formattedData[field]);
        } catch (formatError) {
          // If formatting fails, keep original text and log warning
          console.warn(`Failed to format field '${field}':`, formatError.message);
        }
      }
    });
    
    // Handle nested block structures (for Slack Block Kit)
    if (formattedData.blocks && Array.isArray(formattedData.blocks)) {
      formattedData.blocks = formattedData.blocks.map(block => {
        if (block.text && block.text.text) {
          try {
            block.text.text = markdownToSlack(block.text.text);
          } catch (formatError) {
            console.warn('Failed to format block text:', formatError.message);
          }
        }
        return block;
      });
    }
    
    // Add metadata about formatting
    formattedData._formatting = {
      processed: true,
      timestamp: new Date().toISOString(),
      formatter: 'md-to-slack'
    };
    
    results.push({ json: formattedData });
  }
  
} catch (importError) {
  // Fallback: if md-to-slack is not available, pass through unchanged
  console.warn('md-to-slack not available, skipping formatting:', importError.message);
  
  for (const item of items) {
    const data = { ...item.json };
    data._formatting = {
      processed: false,
      error: 'md-to-slack library not available',
      timestamp: new Date().toISOString()
    };
    results.push({ json: data });
  }
}

return results;