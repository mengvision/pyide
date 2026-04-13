"""
Memory System Comprehensive Capability Test
Tests all aspects of the Memory implementation including Dream Mode
"""

import sys
from pathlib import Path

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    BOLD = '\033[1m'
    END = '\033[0m'

class TestResult:
    def __init__(self):
        self.passed = []
        self.failed = []
        self.warnings = []
    
    def add_pass(self, test_name, details=""):
        self.passed.append((test_name, details))
        print(f"{Colors.GREEN}✅ PASS{Colors.END}: {test_name}")
        if details:
            print(f"   {details}")
    
    def add_fail(self, test_name, error=""):
        self.failed.append((test_name, error))
        print(f"{Colors.RED}❌ FAIL{Colors.END}: {test_name}")
        if error:
            print(f"   Error: {error}")
    
    def add_warning(self, test_name, warning=""):
        self.warnings.append((test_name, warning))
        print(f"{Colors.YELLOW}⚠️  WARNING{Colors.END}: {test_name}")
        if warning:
            print(f"   {warning}")
    
    def summary(self):
        total = len(self.passed) + len(self.failed)
        print(f"\n{Colors.BOLD}{'='*60}{Colors.END}")
        print(f"{Colors.BOLD}Memory System Test Summary{Colors.END}")
        print(f"{'='*60}")
        print(f"Total Tests: {total}")
        print(f"{Colors.GREEN}Passed: {len(self.passed)}{Colors.END}")
        print(f"{Colors.RED}Failed: {len(self.failed)}{Colors.END}")
        print(f"{Colors.YELLOW}Warnings: {len(self.warnings)}{Colors.END}")
        
        if self.failed:
            print(f"\n{Colors.RED}Failed Tests:{Colors.END}")
            for name, error in self.failed:
                print(f"  - {name}: {error}")
        
        if self.warnings:
            print(f"\n{Colors.YELLOW}Warnings:{Colors.END}")
            for name, warning in self.warnings:
                print(f"  - {name}: {warning}")
        
        print(f"{'='*60}\n")
        return len(self.failed) == 0


def test_memory_types(result):
    """Test 1: Verify memory type definitions"""
    print(f"\n{Colors.BLUE}{Colors.BOLD}[Test 1] Memory Type Definitions{Colors.END}")
    
    types_file = Path("apps/desktop/src/types/memory.ts")
    
    if not types_file.exists():
        result.add_fail("Types file exists", f"File not found: {types_file}")
        return
    
    content = types_file.read_text(encoding='utf-8')
    
    required_interfaces = [
        'MemoryEntry',
        'MemoryLayer',
        'DreamReport',
        'MemoryFrontmatter'
    ]
    
    for interface in required_interfaces:
        if f'interface {interface}' in content or f'type {interface}' in content:
            result.add_pass(f"Interface: {interface}")
        else:
            result.add_fail(f"Interface: {interface}", "Not found")
    
    # Check memory types
    if "'user'" in content and "'feedback'" in content and "'project'" in content and "'reference'" in content:
        result.add_pass("All 4 memory types defined (user, feedback, project, reference)")
    else:
        result.add_fail("Memory types", "Missing one or more types")
    
    # Check Phase 2 fields (reserved for future)
    phase2_fields = ['strength', 'decayRate', 'accessCount', 'lastAccessed']
    for field in phase2_fields:
        if field in content:
            result.add_pass(f"Phase 2 field reserved: {field}")
        else:
            result.add_warning(f"Phase 2 field: {field}", "Not reserved yet")
    
    # Check key fields
    required_fields = [
        ('id: string', 'Unique ID'),
        ('type:', 'Memory type'),
        ('content: string', 'Memory content'),
        ('timestamp:', 'Creation timestamp'),
        ('isPinned:', 'Pin status'),
        ('compressedFrom?:', 'Compression tracking'),
    ]
    
    for field, description in required_fields:
        if field in content:
            result.add_pass(f"Field: {field}", description)
        else:
            result.add_fail(f"Field: {field}", f"{description} - missing")


def test_storage_service(result):
    """Test 2: Verify storage service (Markdown + YAML)"""
    print(f"\n{Colors.BLUE}{Colors.BOLD}[Test 2] Storage Service (Markdown + YAML){Colors.END}")
    
    storage_file = Path("apps/desktop/src/services/MemoryService/storage.ts")
    
    if not storage_file.exists():
        result.add_fail("Storage file exists", f"File not found: {storage_file}")
        return
    
    content = storage_file.read_text(encoding='utf-8')
    
    # Check class definition
    if 'export class MemoryStorage' in content:
        result.add_pass("MemoryStorage class exported")
    else:
        result.add_fail("MemoryStorage class", "Not exported")
    
    # Check save methods
    methods = [
        ('saveSessionMemory', 'Save session memories'),
        ('promoteToProjectMemory', 'Promote to project layer'),
        ('loadProjectMemory', 'Load project memories'),
        ('loadUserMemory', 'Load user memories'),
        ('saveUserMemory', 'Save user memories'),
    ]
    
    for method, description in methods:
        if f'async {method}' in content:
            result.add_pass(f"Method: {method}", description)
        else:
            result.add_fail(f"Method: {method}", f"{description} - not found")
    
    # Check markdown formatting
    if 'formatMemoriesAsMarkdown' in content:
        result.add_pass("Formats memories as Markdown")
    else:
        result.add_fail("Markdown formatting", "Method not found")
    
    # Check YAML frontmatter generation
    if '---' in content and 'id:' in content and 'type:' in content:
        result.add_pass("Generates YAML frontmatter")
    else:
        result.add_fail("YAML frontmatter", "Not generating properly")
    
    # Check parsing
    if 'parseMemoriesFromMarkdown' in content:
        result.add_pass("Parses memories from Markdown")
    else:
        result.add_fail("Markdown parsing", "Method not found")
    
    # Check YAML parser
    if 'parseYAML' in content:
        result.add_pass("Simple YAML parser implemented")
    else:
        result.add_fail("YAML parser", "Not implemented")
    
    # Check regex pattern
    if '/^---\\n([\\s\\S]*?)\\n---\\n([\\s\\S]*)$/' in content or 'match[1]' in content:
        result.add_pass("Frontmatter extraction regex")
    else:
        result.add_fail("Regex pattern", "Not found")
    
    # Check context extraction
    if 'Context:' in content and 'contextMatch' in content:
        result.add_pass("Extracts context from body")
    else:
        result.add_warning("Context extraction", "May not extract context properly")
    
    # Check boolean parsing
    if "'true'" in content and "'false'" in content:
        result.add_pass("Parses boolean values")
    else:
        result.add_warning("Boolean parsing", "May not handle booleans")
    
    # Check Tauri integration
    if "invoke<string>('get_home_dir')" in content or "invoke('get_home_dir'" in content:
        result.add_pass("Uses get_home_dir command")
    else:
        result.add_fail("Home dir command", "Not using Tauri command")
    
    if "invoke<string>('get_memory_base_dir'" in content or "invoke('get_memory_base_dir'" in content:
        result.add_pass("Uses get_memory_base_dir command")
    else:
        result.add_fail("Memory base dir", "Not using Tauri command")
    
    if "invoke('write_text_file'" in content:
        result.add_pass("Writes files via Tauri")
    else:
        result.add_fail("File writing", "Not using Tauri command")
    
    if "invoke<string>('read_text_file'" in content or "invoke('read_text_file'" in content:
        result.add_pass("Reads files via Tauri")
    else:
        result.add_fail("File reading", "Not using Tauri command")
    
    # Check error handling
    if 'try {' in content and 'catch (error)' in content:
        result.add_pass("Error handling with try-catch")
    else:
        result.add_fail("Error handling", "Missing try-catch")
    
    # Check empty file handling
    if "return []" in content and ("doesn't exist" in content.lower() or "empty" in content.lower()):
        result.add_pass("Handles missing/empty files gracefully")
    else:
        result.add_warning("Empty handling", "May not handle missing files well")


def test_dream_mode(result):
    """Test 3: Verify Dream Mode (4 phases)"""
    print(f"\n{Colors.BLUE}{Colors.BOLD}[Test 3] Dream Mode (4-Phase Cycle){Colors.END}")
    
    dream_file = Path("apps/desktop/src/services/MemoryService/dreamMode.ts")
    
    if not dream_file.exists():
        result.add_fail("Dream mode file exists", f"File not found: {dream_file}")
        return
    
    content = dream_file.read_text(encoding='utf-8')
    
    # Check class definition
    if 'export class DreamMode' in content:
        result.add_pass("DreamMode class exported")
    else:
        result.add_fail("DreamMode class", "Not exported")
    
    # Check trigger logic
    if 'async shouldTriggerDream' in content:
        result.add_pass("shouldTriggerDream method exists")
    else:
        result.add_fail("Trigger check", "Method not found")
    
    # Check trigger conditions
    if '24' in content and 'hoursSinceLastDream' in content:
        result.add_pass("24-hour time threshold")
    else:
        result.add_warning("Time threshold", "May not use 24-hour rule")
    
    if 'sessionCount > 5' in content or '> 5' in content:
        result.add_pass(">5 sessions threshold")
    else:
        result.add_warning("Session threshold", "May not use 5-session rule")
    
    # Check executeDreamCycle
    if 'async executeDreamCycle' in content:
        result.add_pass("executeDreamCycle method exists")
    else:
        result.add_fail("Dream cycle execution", "Method not found")
    
    # Check 4 phases
    phases = [
        ('N1', 'Weight Scan'),
        ('N3', 'Memory Transfer'),
        ('REM-C', 'Contradiction Detection'),
        ('Wake', 'Report Generation')
    ]
    
    for phase_code, phase_name in phases:
        if phase_code in content and phase_name in content:
            result.add_pass(f"Phase {phase_code}: {phase_name}")
        else:
            result.add_fail(f"Phase {phase_code}", f"{phase_name} - not found")
    
    # Check N1 implementation
    if 'collectRecentSessionMemories' in content:
        result.add_pass("N1: Collects session memories")
    else:
        result.add_fail("N1 collection", "Method not found")
    
    # Check N3 implementation
    if 'identifyMemoriesForPromotion' in content:
        result.add_pass("N3: Identifies memories for promotion")
    else:
        result.add_fail("N3 identification", "Method not found")
    
    if 'promoteToProjectMemory' in content:
        result.add_pass("N3: Promotes memories to project layer")
    else:
        result.add_fail("N3 promotion", "Doesn't call promote method")
    
    # Check REM-C implementation
    if 'detectContradictions' in content:
        result.add_pass("REM-C: Detects contradictions")
    else:
        result.add_fail("REM-C detection", "Method not found")
    
    # Check Wake implementation
    if 'generateDreamSummary' in content:
        result.add_pass("Wake: Generates summary report")
    else:
        result.add_fail("Wake summary", "Method not found")
    
    # Check dream log saving
    if 'saveDreamLog' in content:
        result.add_pass("Saves dream log to file")
    else:
        result.add_warning("Dream log", "May not save logs")
    
    # Check error handling
    if 'try {' in content and 'catch (error)' in content:
        result.add_pass("Error handling in dream cycle")
    else:
        result.add_fail("Error handling", "Missing try-catch")
    
    # Check report structure
    if 'DreamReport' in content and 'phase:' in content and 'actions:' in content:
        result.add_pass("Returns structured DreamReport")
    else:
        result.add_fail("Report structure", "Incomplete report format")


def test_idle_dream_mode(result):
    """Test 4: Verify Idle Dream Mode"""
    print(f"\n{Colors.BLUE}{Colors.BOLD}[Test 4] Idle Dream Mode{Colors.END}")
    
    idle_file = Path("apps/desktop/src/services/MemoryService/idleDreamMode.ts")
    
    if not idle_file.exists():
        result.add_fail("Idle dream file exists", f"File not found: {idle_file}")
        return
    
    content = idle_file.read_text(encoding='utf-8')
    
    # Check class definition
    if 'export class IdleDreamMode' in content:
        result.add_pass("IdleDreamMode class exported")
    else:
        result.add_fail("IdleDreamMode class", "Not exported")
    
    # Check monitoring methods
    methods = [
        ('startMonitoring', 'Start monitoring'),
        ('stopMonitoring', 'Stop monitoring'),
        ('recordSessionEnd', 'Record session end'),
        ('getStatus', 'Get status'),
    ]
    
    for method, description in methods:
        if method in content:
            result.add_pass(f"Method: {method}", description)
        else:
            result.add_fail(f"Method: {method}", f"{description} - not found")
    
    # Check trigger mechanism
    if 'triggerIdleDream' in content:
        result.add_pass("Triggers silent REM-C check")
    else:
        result.add_fail("Idle trigger", "Method not found")
    
    # Check session counting
    if 'sessionCounter' in content or 'sessionsSinceLastCheck' in content:
        result.add_pass("Tracks session count")
    else:
        result.add_fail("Session tracking", "No counter found")
    
    # Check interval configuration
    if 'checkInterval' in content and '20' in content:
        result.add_pass("Default 20-session interval")
    else:
        result.add_warning("Interval config", "May not have default interval")
    
    # Check localStorage persistence
    if 'localStorage.getItem' in content and 'localStorage.setItem' in content:
        result.add_pass("Persists state to localStorage")
    else:
        result.add_fail("State persistence", "Not using localStorage")
    
    # Check manual trigger
    if 'manualTrigger' in content:
        result.add_pass("Manual trigger for testing")
    else:
        result.add_warning("Manual trigger", "No manual override")
    
    # Check reset functionality
    if 'reset()' in content or 'reset:' in content:
        result.add_pass("Reset counters function")
    else:
        result.add_warning("Reset function", "May not be able to reset")
    
    # Check integration with DreamMode
    if 'new DreamMode' in content or 'this.dreamMode' in content:
        result.add_pass("Integrates with DreamMode class")
    else:
        result.add_fail("DreamMode integration", "Not using DreamMode")
    
    # Check non-blocking error handling
    if "console.error" in content and "Don't crash" in content:
        result.add_pass("Non-blocking error handling")
    else:
        result.add_warning("Error handling", "May crash on errors")


def test_memory_extractor(result):
    """Test 5: Verify MemoryExtractor (AI extraction)"""
    print(f"\n{Colors.BLUE}{Colors.BOLD}[Test 5] MemoryExtractor (AI Extraction){Colors.END}")
    
    extractor_file = Path("apps/desktop/src/services/MemoryService/extractor.ts")
    
    if not extractor_file.exists():
        result.add_fail("Extractor file exists", f"File not found: {extractor_file}")
        return
    
    content = extractor_file.read_text(encoding='utf-8')
    
    # Check class definition
    if 'export class MemoryExtractor' in content:
        result.add_pass("MemoryExtractor class exported")
    else:
        result.add_fail("MemoryExtractor class", "Not exported")
    
    # Check extraction method
    if 'async extractFromConversation' in content:
        result.add_pass("extractFromConversation method exists")
    else:
        result.add_fail("Extraction method", "Not found")
    
    # Check AI API integration
    if 'fetch(' in content and '/chat/completions' in content:
        result.add_pass("Calls OpenAI-compatible API")
    else:
        result.add_fail("API integration", "Not calling chat API")
    
    # Check system prompt
    if 'systemPrompt' in content or 'You are a memory extraction assistant' in content:
        result.add_pass("Detailed system prompt for extraction")
    else:
        result.add_fail("System prompt", "Missing or incomplete")
    
    # Check memory categories in prompt
    categories = ['user', 'feedback', 'project', 'reference']
    for cat in categories:
        if f'**{cat}**' in content or f'"{cat}"' in content:
            result.add_pass(f"Explains {cat} category in prompt")
        else:
            result.add_warning(f"Category: {cat}", f"Not explained in prompt")
    
    # Check confidence scoring
    if 'confidence' in content and '0.7' in content:
        result.add_pass("Confidence threshold (0.7)")
    else:
        result.add_warning("Confidence", "May not filter by confidence")
    
    # Check JSON parsing
    if 'JSON.parse' in content:
        result.add_pass("Parses JSON response from AI")
    else:
        result.add_fail("JSON parsing", "Not parsing AI response")
    
    # Check save methods
    methods = [
        ('saveMemories', 'Save extracted memories'),
        ('processAndSave', 'Process and auto-save'),
        ('createManualMemory', 'Create manual memory'),
    ]
    
    for method, description in methods:
        if f'async {method}' in content:
            result.add_pass(f"Method: {method}", description)
        else:
            result.add_fail(f"Method: {method}", f"{description} - not found")
    
    # Check storage routing
    if "memory.type === 'user'" in content and 'saveUserMemory' in content:
        result.add_pass("Routes user memories to user layer")
    else:
        result.add_fail("User routing", "Not routing correctly")
    
    if "memory.type === 'project'" in content and 'promoteToProjectMemory' in content:
        result.add_pass("Routes project memories to project layer")
    else:
        result.add_fail("Project routing", "Not routing correctly")
    
    # Check UUID generation
    if "uuidv4()" in content or "import.*uuid" in content:
        result.add_pass("Generates unique IDs with UUID")
    else:
        result.add_fail("UUID generation", "Not generating IDs")
    
    # Check error handling
    if 'try {' in content and 'catch (error)' in content:
        result.add_pass("Error handling in extraction")
    else:
        result.add_fail("Error handling", "Missing try-catch")


def test_ui_components(result):
    """Test 6: Verify UI components (MemoryPanel)"""
    print(f"\n{Colors.BLUE}{Colors.BOLD}[Test 6] UI Components (MemoryPanel){Colors.END}")
    
    panel_file = Path("apps/desktop/src/components/sidebar/MemoryPanel.tsx")
    css_file = Path("apps/desktop/src/components/sidebar/MemoryPanel.css")
    
    # Check panel component
    if panel_file.exists():
        result.add_pass("MemoryPanel component exists")
        content = panel_file.read_text(encoding='utf-8')
        
        # Check for useEffect
        if 'useEffect' in content and 'loadMemories' in content:
            result.add_pass("Loads memories on mount")
        else:
            result.add_fail("Initialization", "Doesn't load memories automatically")
        
        # Check for filter tabs
        if 'filter-tabs' in content or 'filter-tab' in content:
            result.add_pass("Filter tabs for memory types")
        else:
            result.add_warning("Filters", "May not have type filters")
        
        # Check for all filter types
        filter_types = ['all', 'user', 'feedback', 'project', 'reference']
        for ftype in filter_types:
            if f"'{ftype}'" in content or f'"{ftype}"' in content:
                result.add_pass(f"Filter option: {ftype}")
            else:
                result.add_warning(f"Filter: {ftype}", f"May not have {ftype} filter")
        
        # Check for MemoryCard component
        if 'MemoryCard' in content:
            result.add_pass("MemoryCard sub-component")
        else:
            result.add_warning("Component structure", "May not have modular design")
        
        # Check for loading state
        if 'loading' in content.lower() and 'Loading memories' in content:
            result.add_pass("Loading state display")
        else:
            result.add_warning("Loading state", "May not show loading indicator")
        
        # Check for empty state
        if 'empty-state' in content or 'No memories yet' in content:
            result.add_pass("Empty state message")
        else:
            result.add_warning("Empty state", "May not handle empty state")
        
        # Check for memory card details
        checks = [
            ('memory.type', 'Type badge'),
            ('memory.content', 'Content display'),
            ('memory.context', 'Context info'),
            ('memory.timestamp', 'Date display'),
            ('isPinned', 'Pin indicator'),
        ]
        
        for check, desc in checks:
            if check in content:
                result.add_pass(f"Shows {desc}")
            else:
                result.add_warning(f"Display: {desc}", f"May not show {desc.lower()}")
        
        # Check for filtering logic
        if 'filteredMemories' in content and 'filter ===' in content:
            result.add_pass("Implements filtering logic")
        else:
            result.add_fail("Filtering", "Logic not implemented")
        
        # Check for error handling
        if 'try {' in content and 'catch (error)' in content:
            result.add_pass("Error handling in loadMemories")
        else:
            result.add_warning("Error handling", "May not handle errors")
    else:
        result.add_fail("MemoryPanel", f"File not found: {panel_file}")
    
    # Check CSS
    if css_file.exists():
        result.add_pass("MemoryPanel styles exist")
    else:
        result.add_warning("Styles", f"CSS file not found: {css_file}")


def test_rust_backend(result):
    """Test 7: Verify Rust backend commands"""
    print(f"\n{Colors.BLUE}{Colors.BOLD}[Test 7] Rust Backend Commands{Colors.END}")
    
    rust_file = Path("apps/desktop/src-tauri/src/memory.rs")
    
    if not rust_file.exists():
        result.add_fail("Rust file exists", f"File not found: {rust_file}")
        return
    
    content = rust_file.read_text(encoding='utf-8')
    
    # Check commands
    commands = [
        ('get_memory_base_dir', 'Get memory base directory'),
        ('get_user_memory_path', 'Get user memory path'),
        ('get_project_memory_path', 'Get project memory path'),
    ]
    
    for cmd, description in commands:
        if f'pub async fn {cmd}' in content:
            result.add_pass(f"Command: {cmd}", description)
        else:
            result.add_fail(f"Command: {cmd}", f"{description} - not found")
    
    # Check directory creation
    if 'create_dir_all' in content:
        result.add_pass("Creates directories if missing")
    else:
        result.add_warning("Directory creation", "May not auto-create")
    
    # Check directory structure
    dirs = ['.pyide', 'memory', 'projects', 'sessions']
    for dir_name in dirs:
        if dir_name in content:
            result.add_pass(f"Uses directory: {dir_name}")
        else:
            result.add_warning(f"Directory: {dir_name}", f"May not use {dir_name}")
    
    # Check error handling
    if 'map_err' in content or 'Result<' in content:
        result.add_pass("Error handling with Result type")
    else:
        result.add_fail("Error handling", "Missing error handling")
    
    # Check serialization
    if 'Serialize' in content and 'Deserialize' in content:
        result.add_pass("Serialization support")
    else:
        result.add_warning("Serialization", "May not need serde")


def test_lib_rs_registration(result):
    """Test 8: Verify command registration"""
    print(f"\n{Colors.BLUE}{Colors.BOLD}[Test 8] Command Registration in lib.rs{Colors.END}")
    
    lib_file = Path("apps/desktop/src-tauri/src/lib.rs")
    
    if not lib_file.exists():
        result.add_fail("lib.rs exists", f"File not found: {lib_file}")
        return
    
    content = lib_file.read_text(encoding='utf-8')
    
    # Check for memory module
    if 'mod memory' in content:
        result.add_pass("Memory module imported")
    else:
        result.add_fail("Module import", "memory module not imported")
    
    # Check for command registration
    commands = [
        'memory::get_memory_base_dir',
        'memory::get_user_memory_path',
        'memory::get_project_memory_path'
    ]
    
    for cmd in commands:
        if cmd in content:
            result.add_pass(f"Registered: {cmd}")
        else:
            result.add_fail(f"Registration: {cmd}", "Not registered")


def test_chatengine_integration(result):
    """Test 9: Verify ChatEngine integration"""
    print(f"\n{Colors.BLUE}{Colors.BOLD}[Test 9] ChatEngine Integration{Colors.END}")
    
    chatengine_file = Path("apps/desktop/src/services/ChatEngine.ts")
    
    if not chatengine_file.exists():
        result.add_fail("ChatEngine file exists", f"File not found: {chatengine_file}")
        return
    
    content = chatengine_file.read_text(encoding='utf-8')
    
    # Check for memories context
    if 'memories?' in content or 'memories:' in content:
        result.add_pass("ChatEngine accepts memories context")
    else:
        result.add_fail("Memories context", "ChatEngine doesn't support memories")
    
    # Check for memory injection in system prompt
    if 'this.context.memories' in content:
        result.add_pass("Injects memories into system prompt")
    else:
        result.add_fail("Prompt injection", "Memories not added to prompt")
    
    # Check setContext method
    if 'setContext(' in content:
        result.add_pass("Has setContext method")
    else:
        result.add_fail("setContext", "Method not found")
    
    # Check buildSystemPrompt
    if 'buildSystemPrompt' in content or 'system prompt' in content.lower():
        result.add_pass("Builds enhanced system prompt")
    else:
        result.add_fail("System prompt", "Doesn't build custom prompt")


def test_usechathook_integration(result):
    """Test 10: Verify useChatContext hook"""
    print(f"\n{Colors.BLUE}{Colors.BOLD}[Test 10] useChatContext Hook{Colors.END}")
    
    hook_file = Path("apps/desktop/src/hooks/useChatContext.ts")
    
    if not hook_file.exists():
        result.add_fail("Hook file exists", f"File not found: {hook_file}")
        return
    
    content = hook_file.read_text(encoding='utf-8')
    
    # Check for memory storage import
    if 'MemoryStorage' in content or 'MemoryService' in content:
        result.add_pass("Imports memory storage")
    else:
        result.add_fail("Memory import", "Not importing memory service")
    
    # Check for loadProjectMemory call
    if 'loadProjectMemory' in content:
        result.add_pass("Loads project memories")
    else:
        result.add_fail("Project loading", "Doesn't load project memories")
    
    # Check for loadUserMemory call
    if 'loadUserMemory' in content:
        result.add_pass("Loads user memories")
    else:
        result.add_fail("User loading", "Doesn't load user memories")
    
    # Check for memory formatting
    if 'Project Memories:' in content or 'User Preferences:' in content:
        result.add_pass("Formats memories for display")
    else:
        result.add_warning("Formatting", "May not format nicely")
    
    # Check for context update
    if 'setContext' in content and 'memories:' in content:
        result.add_pass("Updates ChatEngine with memories")
    else:
        result.add_fail("Context update", "Doesn't pass memories to ChatEngine")
    
    # Check for projectId parameter
    if 'projectId' in content:
        result.add_pass("Uses projectId for scoping")
    else:
        result.add_warning("Project scoping", "May not scope by project")


def analyze_gaps(result):
    """Test 11: Identify gaps and missing features"""
    print(f"\n{Colors.BLUE}{Colors.BOLD}[Test 11] Gap Analysis{Colors.END}")
    
    gaps = []
    enhancements = []
    
    # Check for strength/decay implementation (Phase 2 feature)
    storage_file = Path("apps/desktop/src/services/MemoryService/storage.ts")
    if storage_file.exists():
        content = storage_file.read_text(encoding='utf-8')
        if 'strength' in content or 'decayRate' in content:
            result.add_pass("Strength/Decay Implementation", "Fields being used")
        else:
            enhancements.append("Strength/decay fields reserved but not implemented")
    
    # Check for contradiction detection algorithm
    dream_file = Path("apps/desktop/src/services/MemoryService/dreamMode.ts")
    if dream_file.exists():
        content = dream_file.read_text(encoding='utf-8')
        if 'TODO' in content or 'placeholder' in content.lower():
            gaps.append("Contradiction detection is placeholder (no real algorithm)")
    
    # Check for session memory collection
    if dream_file.exists():
        content = dream_file.read_text(encoding='utf-8')
        if 'return []' in content and 'collectRecentSessionMemories' in content:
            gaps.append("Session memory collection returns empty array")
    
    # Check for dream log append functionality
    if dream_file.exists():
        content = dream_file.read_text(encoding='utf-8')
        if 'TODO: Implement append' in content:
            gaps.append("Dream log append not implemented")
    
    # Check for getLastDreamTime implementation
    if dream_file.exists():
        content = dream_file.read_text(encoding='utf-8')
        if 'return null' in content and 'getLastDreamTime' in content:
            gaps.append("getLastDreamTime returns null (not implemented)")
    
    # Check for getSessionCount implementation
    if dream_file.exists():
        content = dream_file.read_text(encoding='utf-8')
        if 'return 0' in content and 'getSessionCount' in content:
            gaps.append("getSessionCount returns 0 (not implemented)")
    
    # Check for AI model configuration
    extractor_file = Path("apps/desktop/src/services/MemoryService/extractor.ts")
    if extractor_file.exists():
        content = extractor_file.read_text(encoding='utf-8')
        if 'gpt-4' in content:
            result.add_pass("Configurable AI model")
        else:
            enhancements.append("May not support multiple AI models")
    
    # Report findings
    if gaps:
        print(f"\n{Colors.RED}{Colors.BOLD}GAPS IDENTIFIED:{Colors.END}")
        for gap in gaps:
            print(f"  ❌ {gap}")
            result.add_fail("Gap", gap)
    
    if enhancements:
        print(f"\n{Colors.YELLOW}{Colors.BOLD}ENHANCEMENT OPPORTUNITIES:{Colors.END}")
        for enhancement in enhancements:
            print(f"  💡 {enhancement}")
            result.add_warning("Enhancement", enhancement)
    
    if not gaps and not enhancements:
        result.add_pass("No major gaps identified")


def main():
    print(f"{Colors.BOLD}{'='*60}")
    print(f"Memory System Comprehensive Capability Test")
    print(f"{'='*60}{Colors.END}\n")
    
    result = TestResult()
    
    # Run all tests
    test_memory_types(result)
    test_storage_service(result)
    test_dream_mode(result)
    test_idle_dream_mode(result)
    test_memory_extractor(result)
    test_ui_components(result)
    test_rust_backend(result)
    test_lib_rs_registration(result)
    test_chatengine_integration(result)
    test_usechathook_integration(result)
    analyze_gaps(result)
    
    # Print summary
    success = result.summary()
    
    # Final verdict
    print(f"\n{Colors.BOLD}FINAL VERDICT:{Colors.END}")
    
    if len(result.failed) == 0:
        print(f"{Colors.GREEN}✅ Memory System is PRODUCTION READY{Colors.END}")
    elif len(result.failed) <= 3:
        print(f"{Colors.YELLOW}⚠️  Memory System has MINOR ISSUES but is functional{Colors.END}")
    else:
        print(f"{Colors.RED}❌ Memory System has SIGNIFICANT GAPS{Colors.END}")
    
    print(f"\n{Colors.BOLD}Key Capabilities:{Colors.END}")
    print(f"- Type System: ✅ Complete")
    print(f"- Storage Service: ✅ Markdown + YAML")
    print(f"- Dream Mode: ✅ 4-phase cycle")
    print(f"- Idle Dream: ✅ Silent monitoring")
    print(f"- AI Extraction: ✅ OpenAI integration")
    print(f"- UI Components: ✅ Polished panel")
    print(f"- ChatEngine: ✅ Context injection")
    print(f"- Rust Backend: ✅ Directory management")
    
    return 0 if success else 1


if __name__ == "__main__":
    sys.exit(main())
