# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Build
```bash
npm run build
```

### Development with LangGraph Studio

**Primary Development Workflow:**
```bash
npx @langchain/langgraph-cli dev
```

This starts the LangGraph development server with hot reloading and opens LangGraph Studio in your browser. LangGraph Studio provides:

- **Interactive Agent Testing**: Test individual agents and the full research workflow through a chat interface
- **Graph Visualization**: View the state machine flow and agent interactions in real-time  
- **State Inspection**: Examine agent state at each step of the research process
- **Debug Tools**: Step through agent decisions and tool executions
- **Performance Monitoring**: Track research iterations and response times

**Available Graphs in Studio:**
- `scope_research`: User clarification and research brief generation
- `research_agent`: Individual research agent for specific topics  
- `supervisor_agent`: Multi-agent coordination and research delegation
- `deep_research`: Full end-to-end research workflow (recommended for testing)

**Recommended Development Process:**
1. Start LangGraph Studio: `npx @langchain/langgraph-cli dev`
2. Navigate to LangGraph Studio in your browser (typically http://localhost:8123)
3. Select the `deep_research` graph for full workflow testing
4. Test research queries through the Studio chat interface
5. Use state inspection to debug agent behavior and state transitions
6. Make code changes - Studio will automatically reload with hot reloading

**Alternative: Direct TypeScript Execution**
For component testing outside of LangGraph Studio:
```bash
npx ts-node --esm src/filename.ts
```

## Architecture Overview

This is a multi-agent research system built with LangGraph that orchestrates AI agents to conduct comprehensive research tasks. The system follows a hierarchical agent pattern with specialized roles:

### Core Components

**Multi-Agent Supervisor Pattern** (`src/multi-agent-supervisor.ts`)
- Coordinates research across multiple specialized agents
- Delegates research tasks to sub-agents in parallel
- Aggregates and compresses findings from multiple sources
- Uses Azure OpenAI GPT-4.1 for decision-making and coordination

**Research Agent** (`src/research-agent.ts`) 
- Performs iterative web searches using Tavily API
- Synthesizes information through multiple search rounds
- Compresses findings into structured summaries
- Maintains conversation state and research context

**Research Scoping** (`src/research-scoping.ts`)
- Clarifies user requirements before starting research
- Generates structured research briefs from conversations
- Uses structured output for deterministic decision-making

**Full Research Orchestration** (`src/full-research.ts`)
- Integrates all workflow components end-to-end
- Manages state flow between scoping, research, and reporting phases
- Generates final comprehensive research reports

### State Management

The system uses LangGraph's state management with strongly-typed state definitions in `src/shared/types.ts`:

- **AgentState**: Main workflow state with research brief, notes, and final report
- **ResearcherState**: Individual researcher state with messages and research metadata
- **SupervisorState**: Coordination state for multi-agent research management

All state objects use Zod schemas for validation and structured output enforcement.

### Configuration

**Model Configuration** (`src/config.ts`)
- Azure OpenAI integration with separate configs for GPT-4.1 and GPT-4.1-mini
- Tavily search API client initialization
- Environment variable management through dotenv

**Required Environment Variables:**
```
TAVILY_API_KEY
AZURE_OPENAI_API_KEY
AZURE_OPENAI_API_DEPLOYMENT_NAME_4_1
AZURE_OPENAI_API_VERSION_4_1
AZURE_OPENAI_API_DEPLOYMENT_NAME_4_1_MINI
AZURE_OPENAI_API_VERSION_4_1_MINI
AZURE_OPENAI_API_INSTANCE_NAME
```

### Key Design Patterns

**Command Pattern**: Uses LangGraph Commands for explicit state transitions and updates
**Parallel Execution**: Research agents run concurrently for efficiency
**Structured Output**: Zod schemas ensure consistent data flow between agents  
**State Isolation**: Each research agent maintains independent context windows
**Tool Integration**: Custom tools for search, summarization, and research coordination

### Important Implementation Details

- TypeScript with strict mode enabled and comprehensive type checking
- ES modules with Node.js 20+ compatibility
- LangGraph state reducers for message aggregation and note accumulation
- Error handling with graceful fallbacks in tool execution
- Research iteration limits to prevent infinite loops
- Compressed research summaries to manage context window limits