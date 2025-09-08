import { conductResearch, ResearchComplete, thinkTool, getNotesFromToolCalls } from "./utils";
import { SupervisorState } from "./shared/types";
import { Command, END, StateGraph, START } from "@langchain/langgraph";
import { SystemMessage, ToolMessage, HumanMessage, AIMessage } from "@langchain/core/messages";
import { createLeadResearcherPrompt } from "./shared/prompts";
import { getToday } from "./utils";
import { modelSecrets } from "./config";
import { AzureChatOpenAI } from "@langchain/openai";

// Set up tools and model binding
const supervisorToolsArray = [conductResearch, ResearchComplete, thinkTool];
// Ensure models are initialized before binding tools
const supervisorModelWithTools = new AzureChatOpenAI({
    model: "gpt-4.1",
    azureOpenAIApiKey: modelSecrets.gpt41.apiKey,
    azureOpenAIApiDeploymentName: modelSecrets.gpt41.apiDeploymentName,
    azureOpenAIApiVersion: modelSecrets.gpt41.apiVersion,
    azureOpenAIApiInstanceName: modelSecrets.gpt41.apiInstanceName,
}).bindTools(supervisorToolsArray);

// ===== SUPERVISOR NODES =====

/**
 * Coordinate research activities.
 * 
 * Analyzes the research brief and current progress to decide:
 * - What research topics need investigation
 * - Whether to conduct parallel research
 * - When research is complete
 * 
 * @param state - Current supervisor state with messages and research progress
 * @returns Command to proceed to supervisor_tools node with updated state
 */
async function supervisor(
    state: typeof SupervisorState.State
): Promise<Command<"supervisor_tools">> {
    const supervisorMessages = state.supervisor_messages ?? [];

    // Prepare system message with current date and constraints
    const systemMessage = new SystemMessage(
        createLeadResearcherPrompt(
            getToday(),
            "3",
            "6",
        )
    );
    const messages = [systemMessage, ...supervisorMessages];

    // Make decision about next research steps
    const response = await supervisorModelWithTools.invoke(messages);

    return new Command({
        goto: "supervisor_tools",
        update: {
            supervisor_messages: [response],
            research_iterations: state.research_iterations + 1
        }
    });
}

/**
 * Execute supervisor decisions - either conduct research or end the process.
 * 
 * Handles:
 * - Executing think_tool calls for strategic reflection
 * - Launching parallel research agents for different topics
 * - Aggregating research results
 * - Determining when research is complete
 * @param state - Current supervisor state with messages and iteration count
 * @returns Command to continue supervision, end process, or handle errors
 */
async function supervisorTools(
    state: typeof SupervisorState.State
): Promise<Command<"supervisor" | typeof END>> {
    const supervisorMessages = state.supervisor_messages ?? [];
    const researchIterations = state.research_iterations ?? 0;
    const mostRecentMessage = supervisorMessages.at(-1);

    // Initialize variables for single return pattern
    const toolMessages: ToolMessage[] = [];
    const allRawNotes: string[] = [];
    let nextStep = "supervisor";
    let shouldEnd = false;

    // Check exit criteria first
    const exceededIterations = researchIterations >= 6;
    const noToolCalls = !(mostRecentMessage as AIMessage)?.tool_calls;
    const researchComplete = (mostRecentMessage as AIMessage)?.tool_calls?.some(
        (toolCall: any) => toolCall.name === "ResearchComplete"
    );

    if (exceededIterations || noToolCalls || researchComplete) {
        shouldEnd = true;
        nextStep = END;
    } else {
        // Execute ALL tool calls before deciding next step
        try {
            // Separate think_tool calls from ConductResearch calls
            const toolCalls = (mostRecentMessage as AIMessage).tool_calls || [];
            const thinkToolCalls = toolCalls.filter(
                (toolCall: any) => toolCall.name === "think_tool"
            );

            const conductResearchCalls = toolCalls.filter(
                (toolCall: any) => toolCall.name === "ConductResearch"
            );

            // Handle think_tool calls
            for (const toolCall of thinkToolCalls) {
                const observation = await thinkTool.invoke({ reflection: (toolCall.args as any)?.reflection || "" });
                toolMessages.push(
                    new ToolMessage(String(observation ?? "No response from tool"), toolCall.id || "", toolCall.name || "")
                );
            }

            // Handle ConductResearch calls
            if (conductResearchCalls.length > 0) {
                // Import researcher agent here to avoid circular dependencies
                const { researcherAgent } = await import("./research-agent");

                // Launch parallel research agents
                const researchPromises = conductResearchCalls.map(async (toolCall: any) => {
                    const result = await researcherAgent.invoke({
                        researcher_messages: [
                            new HumanMessage(toolCall.args.research_topic)
                        ],
                        research_topic: toolCall.args.research_topic
                    });

                    return { result, toolCall };
                });

                // Wait for all research to complete
                const researchResults = await Promise.all(researchPromises);

                // Format research results as tool messages
                // Each sub-agent returns compressed research findings in result.compressed_research
                // We write this compressed research as the content of a ToolMessage, which allows
                // the supervisor to later retrieve these findings via getNotesFromToolCalls()
                const researchToolMessages = researchResults.map(({ result, toolCall }: { result: any, toolCall: any }) => {
                    const compressedResearch = result.compressed_research || "Error synthesizing research report";
                    return new ToolMessage(compressedResearch, toolCall.id, toolCall.name);
                });

                toolMessages.push(...researchToolMessages);

                // Aggregate raw notes from all research
                allRawNotes.push(
                    ...researchResults.map(({ result }: { result: any }) =>
                        result.raw_notes ? result.raw_notes.join("\n") : ""
                    )
                );
            }

        } catch (error) {
            console.error("Error in supervisor tools:", error);
            shouldEnd = true;
            nextStep = END;
        }
    }

    // Single return point with appropriate state updates
    if (shouldEnd) {
        return new Command({
            goto: nextStep,
            update: {
                notes: getNotesFromToolCalls(supervisorMessages),
                research_brief: state.research_brief || ""
            }
        });
    } else {
        return new Command({
            goto: nextStep,
            update: {
                supervisor_messages: toolMessages,
                raw_notes: allRawNotes
            }
        });
    }
}

// ===== GRAPH CONSTRUCTION =====

// Build supervisor graph
const supervisorBuilder = new StateGraph(SupervisorState)
.addNode("supervisor", supervisor, {ends: ["supervisor_tools"]})
.addNode("supervisor_tools", supervisorTools, {ends: ["supervisor", END]})
.addEdge(START, "supervisor")
.addEdge("supervisor_tools", END);

export const supervisorAgent = supervisorBuilder.compile();
supervisorAgent.name = "Supervisor Agent";
