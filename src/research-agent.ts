/**
 * Research Agent Implementation.
 *
 * This module implements a reserach agent htat can perform iterative web searches
 * and synthesis to answer complex research questions.
 */

import { StateGraph, START, END } from "@langchain/langgraph";
import {
  HumanMessage,
  SystemMessage,
  ToolMessage,
  filterMessages,
} from "@langchain/core/messages";
import { modelSecrets} from "./config";
import { ResearcherState, ResearcherOutputState } from "./shared/types";
import { tavilySearch, thinkTool } from "./utils";
import {
  createCompressResearchHumanMessage,
  createCompressResearchSystemPrompt,
  createResearchAgentPrompt,
} from "./shared/prompts";
import { AzureChatOpenAI } from "@langchain/openai";


// Set up tools and model binding
const tools = [tavilySearch, thinkTool];
const toolsByName = new Map(tools.map((tool) => [tool.name, tool]));

// ===== AGENT NODES =====

/**
 * Analyze current state and decide on next actions.
 *
 * The model analyzes the current conversation state and decides whether to:
 * 1. Call search tool to gather more information
 * 2. Provide a final answer based on gathered information
 * @param state - The current state of the research agent
 * @returns Updated state with the model's response
 */
async function llmCall(state: { researcher_messages: any[] }): Promise<{
  researcher_messages: any[];
}> {
  const modelWithTools = new AzureChatOpenAI({
    model: "gpt-4.1",
    azureOpenAIApiKey: modelSecrets.gpt41.apiKey,
    azureOpenAIApiDeploymentName: modelSecrets.gpt41.apiDeploymentName,
    azureOpenAIApiVersion: modelSecrets.gpt41.apiVersion,
    azureOpenAIApiInstanceName: modelSecrets.gpt41.apiInstanceName,
  }).bindTools(tools);

  return {
    researcher_messages: [
      await modelWithTools.invoke([
        new SystemMessage(createResearchAgentPrompt()),
        ...state.researcher_messages,
      ]),
    ],
  };
}

/**
 * Execute all tool call from the previous LLM response.
 *
 * @param state - The current state of the research agent
 * @returns Updated state with tool execution results.
 */
async function toolNode(state: { researcher_messages: any[] }): Promise<{
  researcher_messages: any[];
}> {
  const lastMessage = state.researcher_messages.at(-1);
  const toolCalls = lastMessage?.tool_calls ?? [];

  // Execute each tool call and always emit a corresponding ToolMessage
  const toolOutputs: ToolMessage[] = [];
  for (const toolCall of toolCalls) {
    const tool = toolsByName.get(toolCall.name);
    let observation: any;

    if (!tool) {
      // Still emit a ToolMessage so the LLM sees a response for every tool_call_id
      observation = `Error: tool '${toolCall.name}' not found.`;
    } else {
      try {
        observation = await (tool as any).invoke(toolCall.args);
      } catch (error) {
        console.error(`Error executing tool ${toolCall.name}:`, error);
        observation = `Error executing tool '${toolCall.name}': ${String(error)}`;
      }
    }

    toolOutputs.push(new ToolMessage(observation, toolCall.id, toolCall.name));
  }

  return {
    // LangGraph will append these to the running message history via the reducer
    researcher_messages: toolOutputs,
  };
}

/**
 * Compress research findings into a concise summary.
 *
 * Takes all the research messages and tool outputs and creates
 * a compressed summary suitable for the supervisor's decision-making.
 * @param state - The current state of the research agent
 * @returns Updated state with the compressed research summary and raw notes
 */
async function compressResearch(state: typeof ResearcherState.State): Promise<{
  compressed_research: string;
  raw_notes: string[];
}> {
  const systemMessage = createCompressResearchSystemPrompt();
  const messages = [
    new SystemMessage(systemMessage),
    ...state.researcher_messages,
    new HumanMessage(createCompressResearchHumanMessage(state.research_topic)),
  ];
  const compressModel = new AzureChatOpenAI({
    model: "gpt-4.1",
    azureOpenAIApiKey: modelSecrets.gpt41.apiKey,
    azureOpenAIApiDeploymentName: modelSecrets.gpt41.apiDeploymentName,
    azureOpenAIApiVersion: modelSecrets.gpt41.apiVersion,
    azureOpenAIApiInstanceName: modelSecrets.gpt41.apiInstanceName,
    maxTokens: 32000,
  });
  const response = await compressModel.invoke(messages);

  // Extract raw notes from tool and AI messages
  const rawNotes = [
    ...filterMessages(state.researcher_messages, {
      includeTypes: ["tool", "ai"],
    }).map((m) => String(m.content)),
  ];

  return {
    compressed_research: String(response.content),
    raw_notes: [rawNotes.join("\n")],
  };
}

// ===== ROUTING LOGIC =====

/**
 * Determine whether to continue research or provide final answer.
 *
 * Determines whether the agent should continue the research loop or provide
 * a final answer based on whether the LLM made tool calls.
 * @param state - The current state of the research agent
 * @returns "tool_node": Continue to tool execution
 *          "compress_research": Compress research findings
 */
function shouldContinue(state: typeof ResearcherState.State): string {
  const messages = state.researcher_messages;
  const lastMessage = messages.at(-1);

  // If the LLM makes a tool call, continue to tool execution
  const hasToolCalls =
    Array.isArray((lastMessage as any)?.tool_calls) &&
    (lastMessage as any).tool_calls.length > 0;
  if (hasToolCalls) {
    return "tool_node";
  }

  // Otherwise, we have a final answer
  return "compress_research";
}

// ===== GRAPH CONSTRUCTION =====

// Build the agent workflow
const agentBuilder = new StateGraph(ResearcherState, ResearcherOutputState)
  // Add nodes to the graph
  .addNode("llm_call", llmCall)
  .addNode("tool_node", toolNode)
  .addNode("compress_research", compressResearch)

  // Add edges to connect nodes
  .addEdge(START, "llm_call")
  .addConditionalEdges("llm_call", shouldContinue, {
    tool_node: "tool_node",
    compress_research: "compress_research",
  })
  .addEdge("tool_node", "llm_call") // Loop back to llm_call after tool execution
  .addEdge("compress_research", END);

export const researcherAgent = agentBuilder.compile();
researcherAgent.name = "Researcher Agent";
