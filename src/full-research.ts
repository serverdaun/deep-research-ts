/**
 * Full Multi-Agent Research System.
 *
 * This module integrates all components of the research system:
 * - User clarification and scoping
 * - Research brief generation
 * - Multi-agent research coordination
 * - Final report generation
 *
 * The system orchestrates the complete research workflow from initial user
 * input through final report delivery.
 */
import { modelSecrets } from "./config";
import { AzureChatOpenAI } from "@langchain/openai";
import { AgentState, AgentInputState } from "./shared/types";
import { createFinalReportGenerationPrompt } from "./shared/prompts";
import { END, START, StateGraph } from "@langchain/langgraph";
import { HumanMessage } from "@langchain/core/messages";
import { getToday } from "./utils";
import { clarifyWithUser, writeResearchBrief } from "./research-scoping";
import { supervisorAgent } from "./multi-agent-supervisor";

const llm = new AzureChatOpenAI({
  model: "gpt-4.1",
  azureOpenAIApiKey: modelSecrets.gpt41.apiKey,
  azureOpenAIApiDeploymentName: modelSecrets.gpt41.apiDeploymentName,
  azureOpenAIApiVersion: modelSecrets.gpt41.apiVersion,
  azureOpenAIApiInstanceName: modelSecrets.gpt41.apiInstanceName,
});

/**
 * Final report generation node.
 *
 * Synthesizes all research findings into a comprehensive final report
 * @param state - The current state of the workflow
 */
async function finalReportGeneration(state: typeof AgentState.State): Promise<{
  final_report: string;
  messages: string[];
}> {
  const notes = state.notes ?? [];
  const findings = notes.join("\n");
  const finalReportPrompt = createFinalReportGenerationPrompt(
    state.research_brief ?? "",
    findings,
    getToday(),
  );

  const finalReport = await llm.invoke([new HumanMessage(finalReportPrompt)]);

  return {
    final_report: finalReport.content as string,
    messages: ["Here is the final report: " + finalReport.content],
  };
}

// ===== GRAPH CONSTRUCTION =====
const deepResearchBuilder = new StateGraph({
  stateSchema: AgentState,
  input: AgentInputState,
})
  // Add workflow nodes
  .addNode("clarify_with_user", clarifyWithUser, {
    ends: ["write_research_brief", END],
  })
  .addNode("write_research_brief", writeResearchBrief, {
    ends: ["supervisor_subgraph"],
  })
  .addNode("supervisor_subgraph", supervisorAgent)
  .addNode("final_report_generation", finalReportGeneration, { ends: [END] })

  // Add workflow edges
  .addEdge(START, "clarify_with_user")
  .addEdge("write_research_brief", "supervisor_subgraph")
  .addEdge("supervisor_subgraph", "final_report_generation")
  .addEdge("final_report_generation", END);

export const deepResearch = deepResearchBuilder.compile();
deepResearch.name = "Deep Research";
