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

Do NOT announce that you're using a tool or ask for confirmation. Just do it naturally.
`;
