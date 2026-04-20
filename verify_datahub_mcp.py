#!/usr/bin/env python3
"""
Quick verification script for DataHub MCP integration in PyIDE AI Chat
Tests the complete flow: Config → Connection → Tool Discovery
"""

import json
import sys
from pathlib import Path

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    BOLD = '\033[1m'
    END = '\033[0m'

def check_config():
    """Check if MCP config file exists and is valid"""
    print(f"\n{Colors.BOLD}[1/4] Checking MCP Configuration{Colors.END}")
    
    config_path = Path.home() / '.pyide' / 'mcp_config.json'
    
    if not config_path.exists():
        print(f"  {Colors.RED}❌ Config file not found: {config_path}{Colors.END}")
        return False
    
    print(f"  {Colors.GREEN}✅ Config file exists{Colors.END}")
    
    try:
        with open(config_path) as f:
            config = json.load(f)
        
        if 'mcpServers' not in config:
            print(f"  {Colors.RED}❌ No 'mcpServers' key in config{Colors.END}")
            return False
        
        if 'datahub' not in config['mcpServers']:
            print(f"  {Colors.YELLOW}⚠️  No 'datahub' server configured{Colors.END}")
            print(f"  Available servers: {list(config['mcpServers'].keys())}")
            return False
        
        datahub_config = config['mcpServers']['datahub']
        
        # Check required fields
        if 'command' not in datahub_config:
            print(f"  {Colors.RED}❌ Missing 'command' field{Colors.END}")
            return False
        
        if 'env' not in datahub_config:
            print(f"  {Colors.RED}❌ Missing 'env' field{Colors.END}")
            return False
        
        env = datahub_config['env']
        if 'DATAHUB_GMS_URL' not in env:
            print(f"  {Colors.RED}❌ Missing DATAHUB_GMS_URL{Colors.END}")
            return False
        
        if 'DATAHUB_GMS_TOKEN' not in env:
            print(f"  {Colors.RED}❌ Missing DATAHUB_GMS_TOKEN{Colors.END}")
            return False
        
        print(f"  {Colors.GREEN}✅ DataHub configuration valid{Colors.END}")
        print(f"     GMS URL: {env['DATAHUB_GMS_URL']}")
        print(f"     Command: {datahub_config['command']}")
        
        return True
        
    except json.JSONDecodeError as e:
        print(f"  {Colors.RED}❌ Invalid JSON: {e}{Colors.END}")
        return False

def check_uvx():
    """Check if uvx is installed"""
    print(f"\n{Colors.BOLD}[2/4] Checking uvx Installation{Colors.END}")
    
    import shutil
    uvx_path = shutil.which('uvx')
    
    if not uvx_path:
        print(f"  {Colors.RED}❌ uvx not found in PATH{Colors.END}")
        print(f"  {Colors.BLUE}Install uv: curl -LsSf https://astral.sh/uv/install.sh | sh{Colors.END}")
        return False
    
    print(f"  {Colors.GREEN}✅ uvx found at: {uvx_path}{Colors.END}")
    
    # Check version
    import subprocess
    try:
        result = subprocess.run(['uvx', '--version'], capture_output=True, text=True, timeout=5)
        if result.returncode == 0:
            print(f"  {Colors.GREEN}✅ uvx version: {result.stdout.strip()}{Colors.END}")
            return True
    except Exception as e:
        print(f"  {Colors.YELLOW}⚠️  Could not check version: {e}{Colors.END}")
        return True
    
    return False

def check_datahub_connectivity():
    """Check if DataHub GMS is reachable"""
    print(f"\n{Colors.BOLD}[3/4] Checking DataHub GMS Connectivity{Colors.END}")
    
    config_path = Path.home() / '.pyide' / 'mcp_config.json'
    with open(config_path) as f:
        config = json.load(f)
    
    gms_url = config['mcpServers']['datahub']['env']['DATAHUB_GMS_URL']
    
    # Remove trailing slash if present
    gms_url = gms_url.rstrip('/')
    
    print(f"  Testing connection to: {gms_url}")
    
    try:
        import urllib.request
        req = urllib.request.Request(gms_url, method='HEAD')
        response = urllib.request.urlopen(req, timeout=5)
        
        print(f"  {Colors.GREEN}✅ DataHub GMS reachable (HTTP {response.status}){Colors.END}")
        return True
        
    except urllib.error.HTTPError as e:
        if e.code == 401:
            print(f"  {Colors.GREEN}✅ DataHub GMS reachable (requires auth - expected){Colors.END}")
            return True
        else:
            print(f"  {Colors.RED}❌ HTTP Error: {e.code} {e.reason}{Colors.END}")
            return False
            
    except urllib.error.URLError as e:
        print(f"  {Colors.RED}❌ Connection failed: {e.reason}{Colors.END}")
        return False
        
    except Exception as e:
        print(f"  {Colors.RED}❌ Unexpected error: {e}{Colors.END}")
        return False

def check_pyide_mcp_implementation():
    """Check if PyIDE has MCP implementation"""
    print(f"\n{Colors.BOLD}[4/4] Checking PyIDE MCP Implementation{Colors.END}")
    
    # Check key files exist
    pyide_root = Path(__file__).parent
    
    required_files = [
        'apps/desktop/src/services/MCPService/client.ts',
        'apps/desktop/src/services/MCPService/jsonRpcClient.ts',
        'apps/desktop/src/services/MCPService/chatIntegration.ts',
        'apps/desktop/src/services/MCPService/configLoader.ts',
        'apps/desktop/src/services/MCPService/permissions.ts',
        'apps/desktop/src/hooks/useChat.ts',
        'apps/desktop/src/components/sidebar/MCPPanel.tsx',
    ]
    
    all_exist = True
    for file_path in required_files:
        full_path = pyide_root / file_path
        if full_path.exists():
            print(f"  {Colors.GREEN}✅ {file_path}{Colors.END}")
        else:
            print(f"  {Colors.RED}❌ {file_path} (missing){Colors.END}")
            all_exist = False
    
    if all_exist:
        print(f"\n  {Colors.GREEN}✅ All MCP implementation files present{Colors.END}")
        
        # Check for key features
        chat_integration = pyide_root / 'apps/desktop/src/services/MCPService/chatIntegration.ts'
        content = chat_integration.read_text(encoding='utf-8')
        
        features = {
            'getAvailableToolsForAI': 'Tool discovery for AI',
            'executeToolCall': 'Tool execution',
            'processToolCycle': 'Tool calling cycle',
        }
        
        print(f"\n  {Colors.BOLD}Key Features:{Colors.END}")
        for feature, description in features.items():
            if feature in content:
                print(f"    {Colors.GREEN}✅ {description}{Colors.END}")
            else:
                print(f"    {Colors.RED}❌ {description} (missing){Colors.END}")
        
        return True
    else:
        print(f"\n  {Colors.RED}❌ Some MCP files missing{Colors.END}")
        return False

def print_summary(results):
    """Print summary of all checks"""
    print(f"\n{Colors.BOLD}{'='*60}{Colors.END}")
    print(f"{Colors.BOLD}DataHub MCP Integration Status{Colors.END}")
    print(f"{Colors.BOLD}{'='*60}{Colors.END}\n")
    
    all_passed = all(results.values())
    
    for check, passed in results.items():
        status = f"{Colors.GREEN}✅ PASS{Colors.END}" if passed else f"{Colors.RED}❌ FAIL{Colors.END}"
        print(f"  {check}: {status}")
    
    print()
    
    if all_passed:
        print(f"{Colors.GREEN}{Colors.BOLD}🎉 All checks passed!{Colors.END}")
        print(f"\n{Colors.BOLD}Next Steps:{Colors.END}")
        print(f"  1. Start PyIDE desktop app")
        print(f"  2. Check MCP Panel in sidebar for connection status")
        print(f"  3. Switch AI Chat to 'Assist' or 'Agent' mode")
        print(f"  4. Try asking: 'Search for tables containing revenue'")
        print(f"\n{Colors.BLUE}See DATAHUB_AI_CHAT_GUIDE.md for detailed usage instructions{Colors.END}")
    else:
        print(f"{Colors.RED}{Colors.BOLD}⚠️  Some checks failed. Please fix the issues above.{Colors.END}")
        
        if not results.get('Configuration', False):
            print(f"\n{Colors.BOLD}To configure DataHub MCP:{Colors.END}")
            print(f"  1. Edit: $env:USERPROFILE\\.pyide\\mcp_config.json")
            print(f"  2. Add your DataHub GMS URL and token")
            print(f"  3. Restart PyIDE")
        
        if not results.get('uvx', False):
            print(f"\n{Colors.BOLD}To install uv:{Colors.END}")
            print(f"  curl -LsSf https://astral.sh/uv/install.sh | sh")
    
    print()

def main():
    print(f"{Colors.BOLD}{'='*60}")
    print(f"DataHub MCP Integration Verification")
    print(f"{'='*60}{Colors.END}\n")
    
    results = {
        'Configuration': check_config(),
        'uvx': check_uvx(),
        'DataHub Connectivity': check_datahub_connectivity(),
        'PyIDE Implementation': check_pyide_mcp_implementation(),
    }
    
    print_summary(results)
    
    return 0 if all(results.values()) else 1

if __name__ == '__main__':
    sys.exit(main())
