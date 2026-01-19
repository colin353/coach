// Tool definitions for Claude API
export const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'complete_session',
      description: 'End the coaching session and generate a summary. Use this when the user indicates they are done, says goodbye, or the conversation has naturally concluded. Always provide a warm goodbye message before calling this tool.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'start_presentation_practice',
      description: 'Start a presentation practice session where the user can record themselves giving a presentation and receive detailed feedback. Use this when the user wants to practice a presentation, pitch, speech, or any verbal delivery. The user will record audio and video, then receive timestamped feedback on clarity, accuracy, engagement, and delivery.',
      parameters: {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            description: 'A brief title for the presentation (e.g., "Product Pitch", "Team Update", "Conference Talk")',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'write_scratchpad',
      description: 'Write content to the session scratchpad. This creates or overwrites the scratchpad with markdown content. Use this to create tables, lists, diagrams, or structured notes that help organize thoughts during the conversation. Examples: SWOT analysis, pros/cons lists, financial projections, action item lists, comparison tables.',
      parameters: {
        type: 'object',
        properties: {
          content: {
            type: 'string',
            description: 'The markdown content to write to the scratchpad. Use proper markdown formatting for tables, lists, headers, etc.',
          },
        },
        required: ['content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'edit_scratchpad',
      description: 'Edit the session scratchpad by replacing a specific string with new content. Use this to update or modify existing scratchpad content without rewriting everything.',
      parameters: {
        type: 'object',
        properties: {
          old_str: {
            type: 'string',
            description: 'The exact string to find and replace in the scratchpad.',
          },
          new_str: {
            type: 'string',
            description: 'The new string to replace the old string with.',
          },
        },
        required: ['old_str', 'new_str'],
      },
    },
  },
];

// Tool descriptions for system prompt
export const TOOLS_PROMPT = `
## Available Tools
You have access to the following tools that you can use when appropriate:

### complete_session
Use this to end the coaching session when:
- The user says goodbye, thanks you, or indicates they're done
- The conversation has naturally reached a conclusion
- The user says they'll "talk later", "catch up next time", etc.

When ending a session:
1. First, give a warm, brief goodbye message summarizing any key takeaways or encouragement
2. Then call the complete_session tool

### start_presentation_practice
Use this to help the user practice presentations when:
- They want to rehearse a pitch, speech, or presentation
- They're preparing for a meeting, interview, or public speaking
- They want feedback on how they communicate ideas verbally

When suggesting or starting presentation practice:
1. Briefly explain what will happen (they'll record themselves, then get detailed feedback)
2. Call the tool with an appropriate title
3. After they finish recording and receive feedback, discuss the feedback with them

You can proactively suggest this tool if the conversation involves:
- Preparing for an important presentation or pitch
- Practicing for job interviews
- Improving public speaking skills
- Rehearsing for a meeting

### write_scratchpad / edit_scratchpad
Use the scratchpad to create visual, structured content that helps organize the conversation:
- **SWOT analysis**: Create a 2x2 table for Strengths, Weaknesses, Opportunities, Threats
- **Pros/Cons lists**: Side-by-side comparison when weighing decisions
- **Financial projections**: Tables with numbers, revenue forecasts, etc.
- **Action items**: Checkbox lists of next steps
- **Comparison tables**: When evaluating multiple options
- **Timelines**: Structured plans with dates/milestones

**IMPORTANT**: Once a scratchpad exists, ALWAYS prefer edit_scratchpad over write_scratchpad.
- Use write_scratchpad ONLY for the initial creation
- Use edit_scratchpad for ALL updates, additions, or modifications
- edit_scratchpad preserves context and shows incremental progress
- Overwriting with write_scratchpad loses the collaborative feel

The scratchpad appears in a panel next to the chat - use it when visual structure adds value.
Don't announce you're using the scratchpad, just use it naturally when helpful.

Do NOT announce that you're using a tool or ask for confirmation. Just do it naturally.
`;
