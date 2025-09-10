# Deep Research TypeScript

A multi-agent research system that orchestrates AI agents to conduct comprehensive research on complex topics. Built with LangGraph and TypeScript, this system uses a hierarchical supervisor pattern to coordinate multiple specialized research agents.

Based on [langchain-ai/deep_research_from_scratch](https://github.com/langchain-ai/deep_research_from_scratch).

## Features

- **Multi-Agent Coordination**: Supervisor agent delegates research tasks to specialized sub-agents
- **Parallel Research**: Multiple research agents work on different aspects simultaneously  
- **Interactive Clarification**: System asks clarifying questions before starting research
- **Comprehensive Reports**: Synthesizes findings from multiple sources into structured reports
- **Visual Debugging**: LangGraph Studio provides real-time workflow visualization

## Architecture

The system consists of four main components:

1. **Scoping Agent**: Clarifies user requirements and generates research briefs
2. **Research Agents**: Conduct web searches and synthesize information on specific topics
3. **Supervisor Agent**: Coordinates multiple research agents and aggregates findings
4. **Report Generator**: Creates comprehensive final reports from all research findings

## Prerequisites

- Node.js 20+
- Azure OpenAI API access
- Tavily Search API key

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd deep-reasearch-ts
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
```

Fill in your API keys in `.env`:
```
TAVILY_API_KEY=your_tavily_key
AZURE_OPENAI_API_KEY=your_azure_key
AZURE_OPENAI_API_DEPLOYMENT_NAME_4_1=your_gpt4_deployment
AZURE_OPENAI_API_VERSION_4_1=your_api_version
AZURE_OPENAI_API_DEPLOYMENT_NAME_4_1_MINI=your_gpt4_mini_deployment
AZURE_OPENAI_API_VERSION_4_1_MINI=your_mini_api_version
AZURE_OPENAI_API_INSTANCE_NAME=your_instance_name
```

## Usage

### Development with LangGraph Studio

Start the development server:
```bash
npx @langchain/langgraph-cli dev
```

This opens LangGraph Studio in your browser where you can:
- Test the research workflow interactively
- Visualize agent interactions and state transitions
- Debug research processes step-by-step
- Monitor performance and iterations

### Available Graphs

- **`deep_research`**: Complete end-to-end research workflow (recommended)
- **`scope_research`**: User clarification and research brief generation
- **`research_agent`**: Individual research agent for testing specific topics
- **`supervisor_agent`**: Multi-agent coordination system

### Example Research Query

In LangGraph Studio, try queries like:
- "What are the latest developments in quantum computing for drug discovery?"
- "Compare the environmental impact of different renewable energy sources"
- "Analyze the current state of autonomous vehicle regulation across different countries"

## How It Works

1. **Clarification**: The system first assesses if your research question needs clarification
2. **Brief Generation**: Creates a structured research brief from the conversation
3. **Task Delegation**: Supervisor breaks down the research into specific sub-topics
4. **Parallel Research**: Multiple agents conduct web searches on different aspects
5. **Synthesis**: Findings are compressed and aggregated across all research threads
6. **Report Generation**: Creates a comprehensive final report with all discoveries

## Development

Build the project:
```bash
npm run build
```

For more detailed development information, see [CLAUDE.md](./CLAUDE.md).

## License

MIT License