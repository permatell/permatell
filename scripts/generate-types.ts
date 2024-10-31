interface HandlerDefinition {
  action: string;
  parameters: string[];
  description?: string;
  returnType?: string;
  isMutation: boolean;
}

interface ProcessABI {
  handlers: HandlerDefinition[];
}

function parseLuaProcess(luaContent: string): ProcessABI {
  const handlers: HandlerDefinition[] = [];

  const handlerRegex =
    /--\s*@(mutation|view)\s*\n\s*Handlers\.add\(['"]([\w_]+)['"],\s*{\s*Action\s*=\s*['"]([\w_]+)['"].*?\},\s*function\((msg)\)([\s\S]*?end\s*\))/g;

  const parameterRegex = /msg\.([\w_]+)/g;

  const returnRegex = /return\s+({[^}]*}|\w+)/g;

  let match;
  while ((match = handlerRegex.exec(luaContent)) !== null) {
    const [_, annotationType, handlerName, action, _msg, functionBody] = match;

    const isMutation = annotationType === "mutation";

    const parameters = new Set<string>();
    let paramMatch;
    while ((paramMatch = parameterRegex.exec(functionBody)) !== null) {
      const param = paramMatch[1];
      if (param !== "From" && param !== "Action") {
        parameters.add(param);
      }
    }

    let returnType: string | undefined;
    const returnMatch = returnRegex.exec(functionBody);
    if (returnMatch) {
      returnType = returnMatch[1].trim();
    }

    handlers.push({
      action,
      parameters: Array.from(parameters),
      description: extractCommentAboveHandler(functionBody),
      returnType,
      isMutation,
    });
  }

  return { handlers };
}

function extractCommentAboveHandler(functionBody: string): string | undefined {
  return undefined;
}

const fs = require("fs");
const path = require("path");

function generateABIFromFile(filePath: string): void {
  const content = fs.readFileSync(filePath, "utf8");
  const abi = parseLuaProcess(content);
  const baseFileName = path.basename(filePath, path.extname(filePath));

  let tsTypes = ``;

  abi.handlers.forEach((handler) => {
    tsTypes += `export type ${handler.action}Handler = {\n`;
    tsTypes += `  action: '${handler.action}';\n`;
    tsTypes += `  isMutation: ${handler.isMutation};\n`;
    handler.parameters.forEach((param) => {
      tsTypes += `  ${param}: string;\n`;
    });
    if (handler.returnType) {
      tsTypes += `  returns: ${handler.returnType};\n`;
    }
    tsTypes += `};\n\n`;
  });

  const typesPath = path.join(
    path.dirname(filePath),
    `${baseFileName}-types.ts`
  );
  const jsonPath = path.join(path.dirname(filePath), `${baseFileName}.json`);

  fs.writeFileSync(typesPath, tsTypes);
  fs.writeFileSync(jsonPath, JSON.stringify(abi, null, 2));
}

if (require.main === module) {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error("Please provide a file path as an argument");
    process.exit(1);
  }
  generateABIFromFile(filePath);
}
