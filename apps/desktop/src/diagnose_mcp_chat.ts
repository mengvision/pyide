/**
 * MCP + AI Chat Integration Diagnostic Script
 * Run this in browser console to diagnose the integration
 */

// Check 1: Verify MCP Client is initialized
console.log('=== MCP + AI Chat Integration Diagnostic ===\n');

// Check if mcpClient exists and has connections
const checkMCPClient = async () => {
  console.log('[1/5] Checking MCP Client...');
  
  try {
    // Import the mcpClient (this works in the app context)
    const { mcpClient } = await import('./services/MCPService/client.ts');
    
    const connections = mcpClient.getAllConnections();
    console.log('  Connections:', connections);
    
    if (connections.length === 0) {
      console.warn('  ❌ No MCP servers connected');
      return false;
    }
    
    const datahubConn = connections.find(c => c.serverName === 'datahub');
    if (!datahubConn) {
      console.warn('  ❌ DataHub server not found');
      return false;
    }
    
    if (datahubConn.status !== 'connected') {
      console.warn(`  ❌ DataHub status: ${datahubConn.status}`);
      return false;
    }
    
    console.log(`  ✅ DataHub connected with ${datahubConn.tools.length} tools`);
    
    if (datahubConn.tools.length === 0) {
      console.warn('  ⚠️  No tools discovered! This is the problem.');
      console.log('  Attempting to rediscover tools...');
      
      try {
        const tools = await mcpClient.discoverTools('datahub');
        console.log(`  Discovered ${tools.length} tools:`, tools.map(t => t.name));
      } catch (err) {
        console.error('  ❌ Tool discovery failed:', err);
      }
    } else {
      console.log('  Tools:', datahubConn.tools.map(t => t.name));
    }
    
    return true;
  } catch (err) {
    console.error('  ❌ Error accessing MCP client:', err);
    return false;
  }
};

// Check 2: Verify MCP Chat Integration
const checkMCPChatIntegration = async () => {
  console.log('\n[2/5] Checking MCP Chat Integration...');
  
  try {
    const { mcpChatIntegration } = await import('./services/MCPService/chatIntegration.ts');
    
    const toolsForAI = await mcpChatIntegration.getAvailableToolsForAI();
    
    if (!toolsForAI || toolsForAI.trim() === '') {
      console.warn('  ❌ No tools formatted for AI');
      console.log('  This means getAvailableToolsForAI() returned empty string');
      return false;
    }
    
    console.log('  ✅ Tools formatted for AI:');
    console.log('  ', toolsForAI.substring(0, 200) + '...');
    return true;
  } catch (err) {
    console.error('  ❌ Error in chat integration:', err);
    return false;
  }
};

// Check 3: Check Chat Mode
const checkChatMode = () => {
  console.log('\n[3/5] Checking Chat Mode...');
  
  try {
    const { useChatStore } = await import('./stores/chatStore.ts');
    const state = useChatStore.getState();
    
    console.log(`  Current mode: ${state.chatMode}`);
    
    if (state.chatMode === 'chat') {
      console.warn('  ❌ MCP tools are disabled in Chat mode');
      console.log('  Switch to Assist or Agent mode to enable MCP tools');
      return false;
    }
    
    console.log(`  ✅ Mode "${state.chatMode}" supports MCP tools`);
    return true;
  } catch (err) {
    console.error('  ❌ Error checking chat mode:', err);
    return false;
  }
};

// Check 4: Verify Tool Call Parser
const checkToolCallParser = () => {
  console.log('\n[4/5] Checking Tool Call Parser...');
  
  // Test the parser with sample tool call
  const sampleResponse = 'Let me search for you.\n[TOOL_CALL: datahub.search({"query": "revenue"})]';
  
  try {
    const { parseToolCalls } = await import('./utils/toolCallParser.ts');
    const toolCalls = parseToolCalls(sampleResponse);
    
    if (toolCalls.length === 0) {
      console.warn('  ❌ Tool call parser not detecting tool calls');
      console.log('  Sample:', sampleResponse);
      return false;
    }
    
    console.log(`  ✅ Parser detected ${toolCalls.length} tool call(s)`);
    console.log('  Parsed:', toolCalls);
    return true;
  } catch (err) {
    console.error('  ❌ Error in tool call parser:', err);
    return false;
  }
};

// Check 5: Simulate AI Message Flow
const checkMessageFlow = async () => {
  console.log('\n[5/5] Checking Message Flow...');
  
  try {
    const { useChatStore } = await import('./stores/chatStore.ts');
    const { mcpChatIntegration } = await import('./services/MCPService/chatIntegration.ts');
    
    const chatMode = useChatStore.getState().chatMode;
    
    if (chatMode === 'chat') {
      console.log('  ⏭️  Skipped (Chat mode doesn\'t use tools)');
      return true;
    }
    
    // Get tools that would be injected into system prompt
    const toolsContext = await mcpChatIntegration.getAvailableToolsForAI();
    
    console.log('  System prompt would include:');
    console.log('  ', toolsContext ? 'YES - MCP tools context' : 'NO - Empty context');
    
    if (toolsContext && toolsContext.includes('datahub')) {
      console.log('  ✅ DataHub tools are in the context');
      return true;
    } else {
      console.warn('  ❌ DataHub tools NOT in context');
      return false;
    }
  } catch (err) {
    console.error('  ❌ Error checking message flow:', err);
    return false;
  }
};

// Run all checks
const runDiagnostics = async () => {
  const results = {
    'MCP Client': await checkMCPClient(),
    'Chat Integration': await checkMCPChatIntegration(),
    'Chat Mode': checkChatMode(),
    'Tool Call Parser': checkToolCallParser(),
    'Message Flow': await checkMessageFlow(),
  };
  
  console.log('\n=== Summary ===');
  for (const [check, passed] of Object.entries(results)) {
    console.log(`${passed ? '✅' : '❌'} ${check}`);
  }
  
  const allPassed = Object.values(results).every(r => r);
  
  if (allPassed) {
    console.log('\n✅ All checks passed! MCP should be working.');
    console.log('If AI still doesn\'t use tools, the issue might be:');
    console.log('  1. AI model doesn\'t understand the tool format');
    console.log('  2. System prompt not being sent correctly');
    console.log('  3. Tool call syntax not recognized by AI');
  } else {
    console.log('\n❌ Some checks failed. See details above.');
    console.log('\nMost likely issue:');
    if (!results['MCP Client']) {
      console.log('  → MCP server not connected or tools not discovered');
    } else if (!results['Chat Integration']) {
      console.log('  → Tools not being formatted for AI prompt');
    } else if (!results['Chat Mode']) {
      console.log('  → Wrong chat mode (need Assist or Agent)');
    }
  }
};

// Run
runDiagnostics().catch(console.error);
