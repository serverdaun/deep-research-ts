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
import { initChatModel } from "langchain/chat_models/universal";
import { Command, START, END, StateGraph } from "@langchain/langgraph";
import { config } from "./config";
import {
  HumanMessage,
  AIMessage,
  getBufferString,
} from "@langchain/core/messages";

// Initialize model
const model = await initChatModel(config.scopingModel, {
  temperature: config.scopingModelTemperature,
});

/* ===== WORKFLOW NODES ===== */

/**
 * Determine if the user's request contains sufficient information to proceed with research.
 *
 * Uses structured output to make deterministic decisions and avoid hallucination.
 * Routes to either research brief generation or ends with a clarification question.
 */
export async function clarifyWithUser(state: {
  messages: any[];
}): Promise<Command<"write_research_brief" | "__end__">> {
  // Set up structured output model
  const structuredOutputModel = model.withStructuredOutput(ClarifyWithUser);

  // Invoke the model with clarification instructions
  const response = await structuredOutputModel.invoke([
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
      goto: "__end__",
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
 */
export async function writeResearchBrief(state: {
  messages: any[];
}): Promise<{ research_brief: string; supervisor_messages: any[] }> {
  // Set up structured output model
  const structuredOutputModel = model.withStructuredOutput(ResearchQuestion);

  // Generate research brief from conversation history
  const response = await structuredOutputModel.invoke([
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
const deepResearchBuilder = new StateGraph(AgentState, AgentInputState)
  // Add workflow nodes
  .addNode("clarify_with_user", clarifyWithUser)
  .addNode("write_research_brief", writeResearchBrief)

  // Add workflow edges
  .addEdge(START, "clarify_with_user")
  .addEdge("write_research_brief", END);

// Compile the workflow
export const scopeResearch = deepResearchBuilder.compile();
scopeResearch.name = "Scope Research";
