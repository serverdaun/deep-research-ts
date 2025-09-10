/**
 * State Definitions and Pydantic Schemas for Research Scoping.
 *
 * This defines the state objects and structured schemas used for
 * the research agent scoping workflow, including researcher state management and output schemas.
 */

import { z } from "zod/v3";
import {
  MessagesAnnotation,
  Annotation,
  addMessages,
} from "@langchain/langgraph";
import { BaseMessage } from "@langchain/core/messages";
import { tool } from "@langchain/core/tools";

// ===== SCOPING STATE DEFINITIONS =====

// Input state for the full agent - only contains messages from user input.
export const AgentInputState = MessagesAnnotation;

// Main state for the full multi-agent research system.
// Extends MessagesState with additional fields for research coordination.
// Note: Some fields are duplicated across different state classes for proper
// state management between subgraphs and the main workflow.
export const AgentState = Annotation.Root({
  ...MessagesAnnotation.spec, // Spread in the messages state
  // Research brief generated from user conversation history
  research_brief: Annotation<string | undefined>({
    reducer: (x: string | undefined, y: string | undefined) => y ?? x,
  }),
  // Messages exchanged with the supervisor agent for coordination
  supervisor_messages: Annotation<BaseMessage[]>({
    reducer: addMessages,
    default: () => [],
  }),
  // Raw unprocessed research notes collected during the research phase
  raw_notes: Annotation<string[]>({
    reducer: (x: string[], y: string[]) => x.concat(y),
    default: () => [],
  }),
  // Processed and structured notes ready for report generation
  notes: Annotation<string[]>({
    reducer: (x: string[], y: string[]) => x.concat(y),
    default: () => [],
  }),
  // Final formatted research report
  final_report: Annotation<string>({
    reducer: (x: string, y: string) => y ?? x,
  }),
});

// ===== SCOPING STRUCTURED OUTPUT SCHEMAS =====

// Schema for user clarification decision and questions.
export const ClarifyWithUser = z.object({
  need_clarification: z
    .boolean()
    .describe("Whether the user needs to be asked a clarifying question."),
  question: z
    .string()
    .describe("A question to ask the user to clarify the report scope"),
  verification: z
    .string()
    .describe(
      "Verify message that we will start research after the user has provided the necessary information.",
    ),
});

// Schema for structured research brief generation.
export const ResearchQuestion = z.object({
  research_brief: z
    .string()
    .describe("A research question that will be used to guide the research."),
});

// ===== RESEARCHER STATE DEFINITIONS =====

// State for the researh agent containing message history and research metadata.
// This state tracks the researcher's conversation, iteration count for limiting
// tool calls, the research topic being investigated, compressed findings,
// and raw research notes for detailed analysis.
export const ResearcherState = Annotation.Root({
  researcher_messages: Annotation<BaseMessage[]>({
    reducer: addMessages,
    default: () => [],
  }),
  tool_call_iteration: Annotation<number>({
    reducer: (_x: number, y: number) => y,
    default: () => 0,
  }),
  research_topic: Annotation<string>({
    reducer: (x: string, y: string) => y ?? x,
    default: () => "",
  }),
  compressed_research: Annotation<string>({
    reducer: (x: string, y: string) => y ?? x,
    default: () => "",
  }),
  raw_notes: Annotation<string[]>({
    reducer: (x: string[], y: string[]) => x.concat(y),
    default: () => [],
  }),
});

// Output state for the research agent containing final research results.
// This repersents the final output of the research process with compressed
// research findings and all raw notes from the research process.
export const ResearcherOutputState = Annotation.Root({
  compressed_research: Annotation<string>({
    reducer: (x: string, y: string) => y ?? x,
    default: () => "",
  }),
  raw_notes: Annotation<string[]>({
    reducer: (x: string[], y: string[]) => x.concat(y),
    default: () => [],
  }),
  researcher_messages: Annotation<BaseMessage[]>({
    reducer: addMessages,
    default: () => [],
  }),
});

// ===== RESEARCHER STRUCTURED OUTPUT SCHEMAS =====

// Schema for webpage content summarization.
export const Summary = z.object({
  summary: z.string().describe("Concise summary of the webpage content"),
  key_excerpts: z
    .string()
    .describe("Important quotes and excerpts from the content"),
});

// ===== LEAD RESEARCHER STATE DEFINITIONS =====

// State for the multi-agent reserach supervisor.
//
// Manages coordination between supervisoer and research agents, tracking
// research progress and accumulating findings from multipe sub-agents.
export const SupervisorState = Annotation.Root({
  supervisor_messages: Annotation<BaseMessage[]>({
    reducer: addMessages,
    default: () => [],
  }),
  research_brief: Annotation<string>({
    reducer: (x: string, y: string) => y ?? x,
    default: () => "",
  }),
  notes: Annotation<string[]>({
    reducer: (x: string[], y: string[]) => x.concat(y),
    default: () => [],
  }),
  research_iterations: Annotation<number>({
    reducer: (_x: number, y: number) => y,
    default: () => 0,
  }),
  raw_notes: Annotation<string[]>({
    reducer: (x: string[], y: string[]) => x.concat(y),
    default: () => [],
  }),
});

// ===== SUPERVISOR TOOLS =====

// Tool for delegating a research task to a specialized sub-agent.
export const conductResearchTool = tool(
  async (input: unknown) => {
    // This tool will be used by the supervisor to delegate research tasks
    // The actual implementation will be handled by the supervisor agent
    const { research_topic } = input as { research_topic: string };
    return `Research task delegated: ${research_topic}`;
  },
  {
    name: "conduct_research",
    description:
      "Tool for delegating a research task to a specialized sub-agent.",
    schema: {
      type: "object" as const,
      properties: {
        research_topic: {
          type: "string" as const,
          description:
            "The topic to research. Should be a single topic, and should be described in high detail (at least a paragraph).",
        },
      },
      required: ["research_topic"],
    },
  },
);

// Tool for indicating that the research process is complete.
export const researchCompleteTool = tool(
  async (_input: unknown = {}) => {
    // This tool signals that the research process is finished
    return "Research process completed.";
  },
  {
    name: "research_complete",
    description: "Tool for indicating that the research process is complete.",
    schema: {
      type: "object" as const,
      properties: {},
    },
  },
);

// Export tools array for easy use in agents
export const supervisorTools = [conductResearchTool, researchCompleteTool];
