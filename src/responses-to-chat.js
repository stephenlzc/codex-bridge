import { asArray, stringifyJson } from "./json.js";
import {
  buildToolContext,
  chatMessageFromToolOutput,
  chatToolCallFromResponseItem,
  isResponseToolCallItem,
  isResponseToolOutputItem,
} from "./tools.js";

export function responsesToChatRequest(request, route, history) {
  const toolContext = buildToolContext(request.tools || []);
  const priorMessages = history.get(request.previous_response_id);
  const currentMessages = responseInputToChatMessages(
    request.messages ?? request.input,
    toolContext,
  );

  const messages = [];
  const instructions = systemInstructionsFromRequest(request);
  if (instructions) {
    messages.push({ role: "system", content: instructions });
  }
  messages.push(...priorMessages, ...currentMessages);

  const body = {
    model: route.model,
    messages,
    stream: false,
  };

  if (toolContext.chatTools.length > 0) {
    body.tools = toolContext.chatTools;
    const toolChoice = chatToolChoice(request.tool_choice, toolContext);
    if (toolChoice) {
      body.tool_choice = toolChoice;
    }
    if (!shouldDrop(route, "parallel_tool_calls")) {
      body.parallel_tool_calls = request.parallel_tool_calls ?? true;
    }
  }

  copyScalar(request, body, "temperature");
  copyScalar(request, body, "top_p");
  copyScalar(request, body, "presence_penalty");
  copyScalar(request, body, "frequency_penalty");
  copyScalar(request, body, "seed");
  copyScalar(request, body, "user");
  if (request.max_output_tokens !== undefined) {
    body.max_tokens = request.max_output_tokens;
  } else {
    copyScalar(request, body, "max_tokens");
    copyScalar(request, body, "max_completion_tokens");
  }
  if (request.stop !== undefined) {
    body.stop = request.stop;
  }
  if (request.response_format !== undefined && !shouldDrop(route, "response_format")) {
    body.response_format = request.response_format;
  }

  return {
    body,
    toolContext,
    wantsStream: Boolean(request.stream),
    messagesForHistory: messages,
  };
}

export function responseInputToChatMessages(input, toolContext) {
  if (input === undefined || input === null) {
    return [];
  }
  if (typeof input === "string") {
    return [{ role: "user", content: input }];
  }

  const items = Array.isArray(input) ? input : [input];
  const messages = [];
  let pendingToolCalls = [];

  const flushToolCalls = () => {
    if (pendingToolCalls.length === 0) {
      return;
    }
    messages.push({
      role: "assistant",
      content: null,
      tool_calls: pendingToolCalls,
    });
    pendingToolCalls = [];
  };

  for (const item of items) {
    if (isResponseToolCallItem(item)) {
      pendingToolCalls.push(chatToolCallFromResponseItem(item, toolContext));
      continue;
    }

    flushToolCalls();

    if (
      item &&
      typeof item === "object" &&
      ["system", "developer"].includes(item.role)
    ) {
      continue;
    }

    if (isResponseToolOutputItem(item)) {
      messages.push(chatMessageFromToolOutput(item));
      continue;
    }

    const message = responseMessageToChatMessage(item);
    if (message) {
      messages.push(message);
    }
  }

  flushToolCalls();
  return messages;
}

export function responseMessageToChatMessage(item) {
  if (typeof item === "string") {
    return { role: "user", content: item };
  }
  if (!item || typeof item !== "object") {
    return null;
  }

  if (item.type === "reasoning") {
    return null;
  }

  const role = normalizeRole(item.role || roleFromType(item.type));
  if (!role) {
    return null;
  }

  const message = {
    role,
    content: contentToText(item.content ?? item.text ?? item.output ?? ""),
  };

  if (Array.isArray(item.tool_calls)) {
    message.tool_calls = item.tool_calls;
    if (!message.content) {
      message.content = null;
    }
  }

  return message;
}

export function contentToText(content) {
  if (content === undefined || content === null) {
    return "";
  }
  if (typeof content === "string") {
    return content;
  }
  if (!Array.isArray(content)) {
    if (typeof content.text === "string") {
      return content.text;
    }
    return stringifyJson(content);
  }

  const parts = [];
  for (const part of content) {
    if (typeof part === "string") {
      parts.push(part);
      continue;
    }
    if (!part || typeof part !== "object") {
      continue;
    }
    if (typeof part.text === "string") {
      parts.push(part.text);
    } else if (typeof part.output_text === "string") {
      parts.push(part.output_text);
    } else if (part.type?.includes("image")) {
      parts.push("[image input omitted by codex-multi-router]");
    } else if (part.type && Object.keys(part).length > 0) {
      parts.push(stringifyJson(part));
    }
  }
  return parts.filter(Boolean).join("\n");
}

function systemInstructionsFromRequest(request) {
  const parts = [];
  if (typeof request.instructions === "string" && request.instructions.trim()) {
    parts.push(request.instructions.trim());
  }
  for (const message of asArray(request.input)) {
    if (
      message &&
      typeof message === "object" &&
      ["system", "developer"].includes(message.role)
    ) {
      const text = contentToText(message.content);
      if (text) {
        parts.push(text);
      }
    }
  }
  return parts.join("\n\n");
}

function roleFromType(type) {
  if (type === "message") {
    return "user";
  }
  return null;
}

function normalizeRole(role) {
  if (role === "developer") {
    return "system";
  }
  if (["system", "user", "assistant", "tool"].includes(role)) {
    return role;
  }
  return null;
}

function chatToolChoice(toolChoice, toolContext) {
  if (!toolChoice) {
    return "auto";
  }
  if (typeof toolChoice === "string") {
    return toolChoice;
  }
  const name = toolChoice.name || toolChoice.function?.name;
  if (!name) {
    return "auto";
  }
  const chatName = toolContext.responseNameToChatName.get(name) || name;
  return { type: "function", function: { name: chatName } };
}

function shouldDrop(route, param) {
  return Array.isArray(route.dropParams) && route.dropParams.includes(param);
}

function copyScalar(source, target, key) {
  if (source[key] !== undefined) {
    target[key] = source[key];
  }
}
