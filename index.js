
import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";

const app = express();
app.use(express.json());

let tasks = [
  { id: "1", title: "Learn Node.js", priority: "high", completed: false },
  { id: "2", title: "Prepare MCP demo", priority: "high", completed: false },
  { id: "3", title: "Practice Angular", priority: "medium", completed: true }
];

function createMcpServer() {
  const server = new McpServer({
    name: "task-manager",
    version: "1.0.0"
  });

  server.registerTool(
    "get_tasks",
    { description: "Get all tasks" },
    async () => ({
      content: [{ type: "text", text: JSON.stringify(tasks, null, 2) }]
    })
  );

  server.registerTool(
    "add_task",
    {
      description: "Add a task with a title and priority",
      inputSchema: {
        title: z.string().min(1),
        priority: z.enum(["low", "medium", "high"])
      }
    },
    async ({ title, priority }) => {
      const newTask = {
        id: String(Date.now()),
        title,
        priority,
        completed: false
      };

      tasks.push(newTask);

      return {
        content: [{
          type: "text",
          text: `Task added: ${JSON.stringify(newTask)}`
        }]
      };
    }
  );

  server.registerTool(
    "complete_task",
    {
      description: "Complete a task using its ID",
      inputSchema: { taskId: z.string() }
    },
    async ({ taskId }) => {
      const task = tasks.find(t => t.id === taskId);

      if (!task) {
        return {
          content: [{ type: "text", text: "Task not found" }],
          isError: true
        };
      }

      task.completed = true;

      return {
        content: [{
          type: "text",
          text: `Completed: ${task.title}`
        }]
      };
    }
  );

  return server;
}

// MCP endpoint: stateless Streamable HTTP
app.post("/mcp", async (req, res) => {
  const server = createMcpServer();

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined
  });

  res.on("close", () => {
    transport.close();
    server.close();
  });

  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error("MCP error:", error);
    if (!res.headersSent) {
      res.status(500).json({ error: "Internal server error" });
    }
  }
});

app.get("/", (req, res) => {
  res.send("Task Manager MCP Server is running!");
});

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`MCP server listening on port ${PORT}`);
});
