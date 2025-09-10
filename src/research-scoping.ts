/**
 * User Clarification and Research Brief Generation.
 *
 * This module implements the scoping phase of the research workflow, where we:
 * 1. Assess if the user's request needs clarification
 * 2. Generate a detailed research brief from the conversation
 *
 * The workflow uses structured output to make deterministic decisions about
 * whether sufficient context exists to proceed with research.
 */

import {
  createClarifyWithUserInstructions,
  createTransformMessagesIntoResearchTopicInstructions,
} from "./shared/prompts";
import {
  ClarifyWithUser,
  ResearchQuestion,
  AgentState,
  AgentInputState,
} from "./shared/types";
import { getToday } from "./utils";
import { Command, START, END, StateGraph } from "@langchain/langgraph";
import {
  HumanMessage,
  AIMessage,
  getBufferString,
} from "@langchain/core/messages";
import { modelSecrets } from "./config";
import { AzureChatOpenAI } from "@langchain/openai";

const clarifyLLM = new AzureChatOpenAI({
  model: "gpt-4.1",
  azureOpenAIApiKey: modelSecrets.gpt41.apiKey,
  azureOpenAIApiDeploymentName: modelSecrets.gpt41.apiDeploymentName,
  azureOpenAIApiVersion: modelSecrets.gpt41.apiVersion,
  azureOpenAIApiInstanceName: modelSecrets.gpt41.apiInstanceName,
  temperature: 0.0,
});
const structuredClarifyLLM = clarifyLLM.withStructuredOutput(ClarifyWithUser);

const researchBriefLLM = new AzureChatOpenAI({
  model: "gpt-4.1",
  azureOpenAIApiKey: modelSecrets.gpt41.apiKey,
  azureOpenAIApiDeploymentName: modelSecrets.gpt41.apiDeploymentName,
  azureOpenAIApiVersion: modelSecrets.gpt41.apiVersion,
  azureOpenAIApiInstanceName: modelSecrets.gpt41.apiInstanceName,
  temperature: 0.0,
});
const structuredResearchBriefLLM =
  researchBriefLLM.withStructuredOutput(ResearchQuestion);

/* ===== WORKFLOW NODES ===== */

/**
 * Determine if the user's request contains sufficient information to proceed with research.
 *
 * Uses structured output to make deterministic decisions and avoid hallucination.
 * Routes to either research brief generation or ends with a clarification question.
 * @param state - The current state of the workflow.
 * @returns A command to either write a research brief or end the workflow.
 */
export async function clarifyWithUser(state: {
  messages: any[];
}): Promise<Command<"write_research_brief" | typeof END>> {
  // Invoke the model with clarification instructions
  const response = await structuredClarifyLLM.invoke([
    new HumanMessage(
      createClarifyWithUserInstructions(
        getBufferString(state.messages),
        getToday(),
      ),
    ),
  ]);

  // Route based on clarification need
  if (response.need_clarification) {
    return new Command({
      goto: END,
      update: { messages: [new AIMessage(response.question)] },
    });
  } else {
    return new Command({
      goto: "write_research_brief",
      update: { messages: [new AIMessage(response.verification)] },
    });
  }
}

/**
 * Transform the conversation history into a comprehensive research brief.
 *
 * Uses structured output to ensure the brief follows the required format
 * and contains all necessary details for effective research.
 * @param state - The current state of the workflow.
 * @returns A command to either write a research brief or end the workflow.
 */
export async function writeResearchBrief(state: {
  messages: any[];
}): Promise<{ research_brief: string; supervisor_messages: any[] }> {
  // Generate research brief from conversation history
  const response = await structuredResearchBriefLLM.invoke([
    new HumanMessage(
      createTransformMessagesIntoResearchTopicInstructions(
        getBufferString(state.messages),
        getToday(),
      ),
    ),
  ]);

  // Update state with generated research brief and pass it to the supervisor
  return {
    research_brief: response.research_brief,
    supervisor_messages: [new HumanMessage(`${response.research_brief}.`)],
  };
}

/* ===== GRAPH CONSTRUCTION ===== */

// Build the scoping workflow
const deepResearchBuilder = new StateGraph({
  stateSchema: AgentState,
  input: AgentInputState,
})
  // Add workflow nodes
  .addNode("clarify_with_user", clarifyWithUser, {
    ends: ["write_research_brief", END],
  })
  .addNode("write_research_brief", writeResearchBrief)

  // Add workflow edges
  .addEdge(START, "clarify_with_user")
  .addEdge("write_research_brief", END);

// Compile the workflow
export const scopeResearch = deepResearchBuilder.compile();
scopeResearch.name = "Scope Research";
