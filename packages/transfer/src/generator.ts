import type {
  AbiEntry,
  StructEntry,
  EnumEntry,
  FunctionEntry,
  GeneratorOptions,
} from "./types";
import {
  convertType,
  convertInputType,
  getImportForType,
} from "./typeConverter";

function mapTsToPolkadotType(tsType: string): string {
  switch (tsType.trim()) {
    case "number":
      return "u32";
    case "string":
      return "Text";
    case "boolean":
      return "bool";
    case "i32":
      return "i32"; // 确保 i32 映射为 i32（小写）
    default:
      return tsType.trim();
  }
}

function getPolkadotCodecType(tsType: string): string {
  switch (tsType.trim()) {
    case "number":
      return "U32";
    case "string":
      return "Text";
    case "boolean":
      return "Bool";
    case "i32":
      return "I32"; // 确保 i32 映射到 I32
    case "u32":
      return "U32";
    case "i64":
      return "I64";
    case "u64":
      return "U64";
    case "i128":
      return "I128";
    case "u128":
      return "U128";
    default:
      return tsType.trim();
  }
}

export async function generateCode(
  entries: AbiEntry[],
  options: GeneratorOptions = {}
): Promise<string> {
  const importPath = options.importPath || "@polkadot/types-codec";

  const neededImports = new Set<string>();

  const structTypes: string[] = [];
  const enumTypes: string[] = [];
  const functions: string[] = [];
  const jsExports: string[] = [];

  const dependencyGraph = new Map<string, Set<string>>();

  for (const entry of entries) {
    switch (entry.type) {
      case "struct":
        processStruct(entry, structTypes, neededImports, dependencyGraph);
        break;
      case "enum":
        processEnum(entry, enumTypes, neededImports, dependencyGraph);
        break;
      case "fn":
        processFunction(entry, functions, jsExports, neededImports);
        break;
    }
  }

  const tsCode = generateTemplateCode(
    jsExports,
    Array.from(neededImports),
    importPath || "@polkadot/types-codec",
    structTypes,
    enumTypes
  );

  return tsCode;
}

function processStruct(
  entry: StructEntry,
  structTypes: string[],
  neededImports: Set<string>,
  dependencyGraph: Map<string, Set<string>>
) {
  const dependencies = new Set<string>();
  dependencyGraph.set(entry.name, dependencies);

  neededImports.add("Struct");

  const fields: string[] = [];
  for (const field of entry.fields) {
    const fieldImports = getImportForType(field.type);
    fieldImports.forEach((imp) => neededImports.add(imp));

    if (
      field.type.kind === "Path" &&
      field.type.path &&
      field.type.path.length === 1 &&
      field.type.path[0] &&
      !isPrimitiveType(field.type.path[0])
    ) {
      dependencies.add(field.type.path[0]);
    }

    fields.push(
      `  /** ${field.name} field type: ${convertType(field.type)} */`
    );
  }

  const methods: string[] = [`  constructor(registry: any, value?: any);`];

  for (const field of entry.fields) {
    methods.push(`  get ${field.name}(): any;`);
  }

  methods.push(`  static from(registry: any, obj: any): ${entry.name} | null;`);

  const structType = `export class ${entry.name} extends Struct {
${fields.join("\n")}
${methods.join("\n")}
}`;
  structTypes.push(structType);
}

function processEnum(
  entry: EnumEntry,
  enumTypes: string[],
  neededImports: Set<string>,
  dependencyGraph: Map<string, Set<string>>
) {
  const dependencies = new Set<string>();
  dependencyGraph.set(entry.name, dependencies);

  const variants: string[] = [];
  for (const variant of entry.variants) {
    if (variant.fields.length > 0) {
      const fieldTypes: string[] = [];
      for (const fieldType of variant.fields) {
        const typeImports = getImportForType(fieldType);
        typeImports.forEach((imp) => neededImports.add(imp));

        if (
          fieldType.kind === "Path" &&
          fieldType.path &&
          fieldType.path.length === 1 &&
          fieldType.path[0] &&
          !isPrimitiveType(fieldType.path[0])
        ) {
          dependencies.add(fieldType.path[0]);
        }

        fieldTypes.push(convertType(fieldType));
      }

      variants.push(
        `  { type: '${variant.name}', value: [${fieldTypes.join(", ")}] }`
      );
    } else {
      variants.push(`  { type: '${variant.name}' }`);
    }
  }

  const enumType = `export type ${entry.name} =
${variants.join(" | ")}
`;
  enumTypes.push(enumType);
}

/**
 * Process function entry
 */
function processFunction(
  entry: FunctionEntry,
  functions: string[],
  jsExports: string[],
  neededImports: Set<string>
) {
  const inputParams: string[] = ["nucleusId: string"];
  const jsInputParams: string[] = ["nucleusId"];

  for (const input of entry.inputs) {
    const inputImports = getImportForType(input.type);
    inputImports.forEach((imp) => neededImports.add(imp));

    inputParams.push(`${input.name}: ${convertType(input.type)}`);
    jsInputParams.push(input.name);
  }

  let returnType = "void";
  if (entry.output) {
    const outputImports = getImportForType(entry.output);
    outputImports.forEach((imp) => neededImports.add(imp));
    returnType = convertType(entry.output);
  }

  const functionDecl = `export function ${entry.name}(${inputParams.join(
    ", "
  )}): Promise<${returnType}>;`;
  functions.push(functionDecl);

  const paramTypes = jsInputParams
    .map((param, index) => {
      if (index === 0) return `${param}: string`;
      const inputDef = entry.inputs[index - 1];
      return inputDef
        ? `${param}: ${convertInputType(inputDef)}`
        : `${param}: any`;
    })
    .join(", ");

  const nucleusMethod = `nucleus_${entry.method}`;

  const rpcParams =
    jsInputParams.slice(1).length > 0
      ? `nucleusId, '${entry.name}', ${jsInputParams.slice(1).join(", ")}`
      : `nucleusId, '${entry.name}'`;

  const jsImplementation = `
export async function ${entry.name}(${paramTypes}): Promise<${returnType}> {
  if (!api) throw new Error('API not initialized');
  const result = await api.rpc('${nucleusMethod}', [${rpcParams}]);
  return result as any;
}`;
  jsExports.push(jsImplementation);
}

/**
 * Generate TypeScript declaration file
 */
function generateTypeScriptCode(
  structTypes: string[],
  enumTypes: string[],
  functions: string[],
  imports: string[],
  importPath: string
): string {
  const importStatements =
    imports.length > 0
      ? `import { ${imports.join(", ")} } from '${importPath}';\n`
      : "";

  const apiImport = `import { ApiPromise } from '@polkadot/api';\n\n`;

  const initApiTypeDecl = `export function initApi(endpoint: string): Promise<ApiPromise>;`;

  return `${importStatements}${apiImport}${structTypes.join(
    "\n\n"
  )}\n\n${enumTypes.join("\n\n")}\n\n${initApiTypeDecl}\n${functions.join(
    "\n"
  )}`;
}

/**
 * Generate TypeScript implementation file
 */
function generateTemplateCode(
  jsExports: string[],
  imports: string[],
  importPath: string,
  structTypes: string[],
  enumTypes: string[]
): string {
  const neededTypes = new Set([
    "Struct",
    "Vec",
    "Tuple",
    "Option",
    "Result",
    "U32",
    "I32",
    "Text",
  ]);

  structTypes.forEach((structDef) => {
    const structLines = structDef.split("\n");
    structLines.forEach((line) => {
      if (line.includes(":")) {
        const typeMatch = line.match(/:\s*([^;|]+)/);
        if (typeMatch && typeMatch[1]) {
          const typeStr = typeMatch[1].trim();

          const codecType = getPolkadotCodecType(typeStr);
          if (
            [
              "U32",
              "I32",
              "U64",
              "I64",
              "U128",
              "I128",
              "Bool",
              "Text",
            ].includes(codecType)
          ) {
            neededTypes.add(codecType);
          }
        }
      }
    });
  });

  const allImports = [...new Set([...imports, ...neededTypes])];

  const importStatements =
    allImports.length > 0
      ? `import { ${allImports.join(", ")} } from '${importPath}';\n\n`
      : "";

  const fileHeader = `/**
 * This is an automatically generated file. DO NOT MODIFY IT DIRECTLY.
 * Generated by nabi-ts code generator.
 * 警告: 请勿手动修改此文件，所有更改都会在下次代码生成时被覆盖
 * WARNING: Any manual changes to this file will be overwritten on next generation
 */
`;

  const apiInit = `
import { ApiPromise, WsProvider } from '@polkadot/api';
import { TypeRegistry } from '@polkadot/types';
import type { Registry } from '@polkadot/types/types';

export const registry: Registry = new TypeRegistry() as unknown as Registry;
let api: ApiPromise;

function registerTypes(): Registry {
  try {
    registry.register({
      $STRUCT_TYPES$
    });
  } catch (error) {
    console.warn('type register error:', error);
  }
  
  return registry;
}

registerTypes();

export async function initApi(endpoint: string): Promise<ApiPromise> {
  const provider = new WsProvider(endpoint);
  api = await ApiPromise.create({ 
    provider,
    registry 
  });
  return api;
}
`;

  const structTypeNames = structTypes
    .filter((structDef) => {
      if (!structDef) return false;
      const structLines = structDef.split("\n");
      if (!structLines || structLines.length === 0) return false;
      const line = structLines[0];
      if (!line) return false;
      const classNameMatch = line.match(
        /class\s+([^\s\s]+)\s+extends\s+Struct/
      );
      return classNameMatch !== null && classNameMatch[1] !== undefined;
    })
    .map((structDef) => {
      const structLines = structDef.split("\n");
      if (structLines.length === 0) return "";
      const firstLine = structLines[0];
      if (!firstLine) return "";
      const classNameMatch = firstLine.match(
        /class\s+([^\s\s]+)\s+extends\s+Struct/
      );
      return classNameMatch ? classNameMatch[1] : "";
    })
    .filter((name) => name !== "");

  const typeRegistrations = structTypeNames
    .map((name) => `    ${name}: { _enum: ['_${name}'] }`)
    .join(",\n");
  const finalApiInit = apiInit.replace("$STRUCT_TYPES$", typeRegistrations);
  const jsStructImplementations = structTypes
    .filter((structDef) => {
      if (!structDef) return false;
      const structLines = structDef.split("\n");
      if (!structLines || structLines.length === 0) return false;
      const line = structLines[0];
      if (!line) return false;
      const classNameMatch = line.match(
        /class\s+([^\s\s]+)\s+extends\s+Struct/
      );
      return classNameMatch !== null && classNameMatch[1] !== undefined;
    })
    .map((structDef) => {
      if (!structDef) return "";
      const structLines = structDef.split("\n");
      if (!structLines || structLines.length === 0) return "";
      const firstLine = structLines[0];
      if (!firstLine) return "";
      const classNameMatch = firstLine.match(
        /class\s+([^\s\s]+)\s+extends\s+Struct/
      );
      if (!classNameMatch || !classNameMatch[1]) {
        return "";
      }
      const className = classNameMatch[1];
      const fieldLines = structLines.filter(
        (line) => line.includes("/** ") && line.includes("field type:")
      );
      const fieldTypesInfo = fieldLines
        .map((line) => {
          const fieldMatch = line.match(
            /\s*\/\*\* (\w+) field type: ([^*]+) \*\//
          );
          if (fieldMatch) {
            const fieldName = fieldMatch[1];
            const fieldTypeStr = fieldMatch[2]?.trim() || "";
            let polkadotType = null;
            if (fieldTypeStr.startsWith("Array<")) {
              polkadotType = "Vec";
            } else if (fieldTypeStr.includes(" | null")) {
              polkadotType = "Option";
            } else if (fieldTypeStr.startsWith("{ ok:")) {
              polkadotType = "Result";
            }

            return {
              name: fieldName,
              typeStr: fieldTypeStr,
              polkadotType,
            };
          }
          return null;
        })
        .filter(
          (
            item
          ): item is {
            name: string;
            typeStr: string;
            polkadotType: string | null;
          } => item !== null
        );

      const getters = fieldTypesInfo
        .map((field) => {
          if (!field) return "";
          const typeStr = field.typeStr;
          let returnType;

          if (typeStr.startsWith("Array<")) {
            returnType = `Vec<${typeStr
              .replace("Array<", "")
              .replace(">", "")}>`;
          } else if (typeStr.includes(" | null")) {
            returnType = `Option<${typeStr.replace(" | null", "")}>`;
          } else if (typeStr.startsWith("{ ok:")) {
            returnType = `Result<${
              typeStr.match(/ok:\s*([^,]+)/)?.[1]?.trim() || "unknown"
            }, ${typeStr.match(/err:\s*([^}]+)/)?.[1]?.trim() || "unknown"}>`;
          } else {
            returnType = mapTsToPolkadotType(typeStr);
          }

          return `  get ${field.name}(): any {
    return this.get('${field.name}');
  }`;
        })
        .filter((getter) => getter !== "")
        .join("\n\n");

      const typeDefinitions = fieldTypesInfo
        .map((field) => {
          if (!field) return "";
          const fieldName = field.name;
          const fieldTypeStr = field.typeStr;

          if (fieldTypeStr.startsWith("Array<")) {
            const innerType = fieldTypeStr
              .replace("Array<", "")
              .replace(">", "");
            return `      ${fieldName}: Vec.with(${getPolkadotCodecType(
              innerType
            )})`;
          } else if (fieldTypeStr.includes(" | null")) {
            const baseType = fieldTypeStr.replace(" | null", "");
            return `      ${fieldName}: Option.with(${getPolkadotCodecType(
              baseType
            )})`;
          } else if (
            fieldTypeStr.startsWith("[") &&
            fieldTypeStr.endsWith("]")
          ) {
            const tupleTypes = fieldTypeStr
              .substring(1, fieldTypeStr.length - 1)
              .split(",");
            const polkadotTupleTypes = tupleTypes
              .map((t) => {
                const trimmedType = t.trim();
                return getPolkadotCodecType(trimmedType);
              })
              .join(", ");
            return `      ${fieldName}: Tuple.with([${polkadotTupleTypes}])`;
          } else if (fieldTypeStr.endsWith("[]")) {
            const baseType = fieldTypeStr.replace("[]", "");
            return `      ${fieldName}: Vec.with(${getPolkadotCodecType(
              baseType
            )})`;
          } else {
            const codecType = getPolkadotCodecType(fieldTypeStr);
            return `      ${fieldName}: ${codecType}`;
          }
        })
        .filter((def) => def !== "")
        .join(",\n");

      return `
export class ${className} extends Struct {
  constructor(registry: Registry, value?: any) {
    super(registry, {
${typeDefinitions}
    }, value);
  }

${getters}

  static from(registry: Registry, obj: any): ${className} | null {
    if (!obj) return null;
    return new ${className}(registry, obj);
  }
}`;
    })
    .join("\n");

  const jsEnumImplementations = enumTypes
    .filter((enumDef) => {
      if (!enumDef) return false;
      const enumLines = enumDef.split("\n");
      if (!enumLines || enumLines.length === 0) return false;
      const line = enumLines[0];
      if (!line) return false;
      const enumNameMatch = line.match(/type\s+([^\s=]+)/);
      return enumNameMatch !== null && enumNameMatch[1] !== undefined;
    })
    .map((enumDef) => {
      if (!enumDef) return "";
      const enumLines = enumDef.split("\n");
      if (!enumLines || enumLines.length === 0) return "";
      const firstLine = enumLines[0];
      if (!firstLine) return "";
      const enumNameMatch = firstLine.match(/type\s+([^\s=]+)/);

      if (!enumNameMatch || !enumNameMatch[1]) {
        return "";
      }
      const enumName = enumNameMatch[1];

      return `
export const ${enumName} = {
  create(type, ...values) {
    if (typeof type !== 'string') throw new Error('Enum variant type must be a string');
    if (values && values.length > 0) {
      return { type, value: values };
    }
    return { type };
  }
};`;
    })
    .join("\n");

  return `${fileHeader}${importStatements}${finalApiInit}
${jsStructImplementations}
${jsEnumImplementations}
${jsExports.join("\n")}`;
}

/**
 * Check if a type name is a primitive type
 */
function isPrimitiveType(typeName: string): boolean {
  const primitiveTypes = [
    "u8",
    "u16",
    "u32",
    "u64",
    "i8",
    "i16",
    "i32",
    "i64",
    "f32",
    "f64",
    "bool",
    "String",
    "Vec",
    "Option",
    "Result",
  ];
  return primitiveTypes.includes(typeName);
}
