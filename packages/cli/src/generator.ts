import type {
  AbiEntry,
  StructEntry,
  EnumEntry,
  FunctionEntry,
  TypeAliasEntry,
  TypeDefinition,
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

/**
 * 将 Polkadot.js 类型转换为 TypeScript 原生类型
 */
function mapPolkadotTypeToTs(polkadotType: string): string {
  if (!polkadotType) return "unknown";

  const trimmedType = polkadotType.trim();
  switch (trimmedType) {
    case "U8":
    case "U16":
    case "U32":
    case "U64":
    case "U128":
    case "I8":
    case "I16":
    case "I32":
    case "I64":
    case "I128":
    case "u8":
    case "u16":
    case "u32":
    case "u64":
    case "u128":
    case "i8":
    case "i16":
    case "i32":
    case "i64":
    case "i128":
      return "number";
    case "bool":
    case "Bool":
      return "boolean";
    case "Text":
    case "String":
      return "string";
    default:
      // 处理可能的复合类型
      if (trimmedType.startsWith("Option<") && trimmedType.endsWith(">")) {
        const innerType = trimmedType.substring(7, trimmedType.length - 1);
        return `${mapPolkadotTypeToTs(innerType)} | null`;
      }

      if (trimmedType.startsWith("Vec<") && trimmedType.endsWith(">")) {
        const innerType = trimmedType.substring(4, trimmedType.length - 1);
        return `Array<${mapPolkadotTypeToTs(innerType)}>`;
      }

      if (trimmedType.startsWith("Result<") && trimmedType.endsWith(">")) {
        const typeParts = trimmedType
          .substring(7, trimmedType.length - 1)
          .split(",");
        if (typeParts.length === 2) {
          const okType = mapPolkadotTypeToTs(typeParts[0].trim());
          const errType = mapPolkadotTypeToTs(typeParts[1].trim());
          return `{ ok: ${okType}, err: ${errType} }`;
        }
      }

      return trimmedType; // 默认情况下保持原样
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
  const interfaceTypes: string[] = [];
  const enumTypes: string[] = [];
  const typeAliases: string[] = []; // 添加类型别名数组
  const functions: string[] = [];
  const jsExports: string[] = [];

  const dependencyGraph = new Map<string, Set<string>>();

  for (const entry of entries) {
    switch (entry.type) {
      case "struct":
        processStruct(
          entry,
          structTypes,
          interfaceTypes,
          neededImports,
          dependencyGraph
        );
        break;
      case "enum":
        processEnum(entry, enumTypes, neededImports, dependencyGraph);
        break;
      case "fn":
        processFunction(entry, functions, jsExports, neededImports);
        break;
      case "type_alias":
        processTypeAlias(entry, typeAliases, neededImports, dependencyGraph);
        break;
    }
  }

  const tsCode = generateTemplateCode(
    jsExports,
    Array.from(neededImports),
    importPath || "@polkadot/types-codec",
    structTypes,
    enumTypes,
    interfaceTypes,
    typeAliases // 添加类型别名数组参数
  );

  return tsCode;
}

function processStruct(
  entry: StructEntry,
  structTypes: string[],
  interfaceTypes: string[],
  neededImports: Set<string>,
  dependencyGraph: Map<string, Set<string>>
) {
  const dependencies = new Set<string>();
  dependencyGraph.set(entry.name, dependencies);

  neededImports.add("Struct");

  const fields: string[] = [];
  const interfaceFields: string[] = [];
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

    let fieldType = convertType(field.type);

    fields.push(`  /** ${field.name} field type: ${fieldType} */`);

    let tsNativeType = fieldType;
    tsNativeType = tsNativeType.replace(/Vec\.with\([^)]+\)/g, (match) => {
      const innerTypeMatch = match.match(/Vec\.with\(([^)]+)\)/);
      if (innerTypeMatch) {
        const innerType = innerTypeMatch[1];
        return `Array<${mapPolkadotTypeToTs(innerType)}>`;
      }
      return "Array<unknown>";
    });

    tsNativeType = tsNativeType.replace(
      /VecFixed\.with\([^,]+, \d+\)/g,
      (match) => {
        const innerTypeMatch = match.match(/VecFixed\.with\(([^,]+), \d+\)/);
        if (innerTypeMatch) {
          const innerType = innerTypeMatch[1];
          return `Array<${mapPolkadotTypeToTs(innerType)}>`;
        }
        return "Array<unknown>";
      }
    );

    if (tsNativeType.startsWith("[") && tsNativeType.endsWith("]")) {
      const tupleContent = tsNativeType.substring(1, tsNativeType.length - 1);
      const tupleTypes = tupleContent
        .split(",")
        .map((t) => mapPolkadotTypeToTs(t.trim()));
      tsNativeType = `[${tupleTypes.join(", ")}]`;
    }

    tsNativeType = mapPolkadotTypeToTs(tsNativeType);

    tsNativeType = tsNativeType.replace(/\bu\d+\b/g, "number");
    tsNativeType = tsNativeType.replace(/\bi\d+\b/g, "number");

    tsNativeType = tsNativeType.replace(
      /Array<([^>]+)>/g,
      (match, innerType) => {
        const convertedInnerType = innerType
          .trim()
          .replace(/\bu\d+\b/g, "number")
          .replace(/\bi\d+\b/g, "number");
        return `Array<${convertedInnerType}>`;
      }
    );

    interfaceFields.push(`    ${field.name}: ${tsNativeType};`);
  }

  let interfaceContent = interfaceFields.join("\n");

  interfaceContent = interfaceContent
    .replace(/\bu\d+\b/g, "number")
    .replace(/\bi\d+\b/g, "number")
    .replace(/Array<([^>]+)>/g, (match, innerType) => {
      const convertedInnerType = innerType
        .trim()
        .replace(/\bu\d+\b/g, "number")
        .replace(/\bi\d+\b/g, "number");
      return `Array<${convertedInnerType}>`;
    });

  const interfaceType = `export interface I${entry.name} {
${interfaceContent}
}`;

  interfaceTypes.push(interfaceType);

  const methods: string[] = [`  constructor(registry: any, value?: any);`];

  for (const field of entry.fields) {
    methods.push(`  get ${field.name}(): any;`);
  }

  methods.push(
    `  static from(registry: Registry, obj: I${entry.name}): ${entry.name} | null;`
  );

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
      if (inputDef) {
        let paramType = convertInputType(inputDef);

        // 检查是否是结构体类型，如果是，使用对应的接口类型
        if (
          paramType.match(/^[A-Z][A-Za-z0-9_]*$/) &&
          ![
            "String",
            "Text",
            "U8",
            "U16",
            "U32",
            "U64",
            "U128",
            "I8",
            "I16",
            "I32",
            "I64",
            "I128",
            "Bool",
          ].includes(paramType)
        ) {
          // 可能是用户定义的结构体类型，添加 I 前缀
          paramType = `I${paramType}`;
        } else if (paramType.startsWith("[") && paramType.endsWith("]")) {
          // 处理元组类型，可能包含结构体
          const tupleContent = paramType.substring(1, paramType.length - 1);
          const tupleTypes = tupleContent.split(",").map((type) => {
            const trimmedType = type.trim();
            if (
              trimmedType.match(/^[A-Z][A-Za-z0-9_]*$/) &&
              ![
                "String",
                "Text",
                "U8",
                "U16",
                "U32",
                "U64",
                "U128",
                "I8",
                "I16",
                "I32",
                "I64",
                "I128",
                "Bool",
              ].includes(trimmedType)
            ) {
              return `I${trimmedType}`;
            } else {
              return trimmedType
                .replace(/\bu\d+\b/g, "number")
                .replace(/\bi\d+\b/g, "number");
            }
          });
          paramType = `[${tupleTypes.join(", ")}]`;
        } else {
          // 转换为 TypeScript 原生类型
          paramType = paramType.replace(/\bu\d+\b/g, "number");
          paramType = paramType.replace(/\bi\d+\b/g, "number");

          // 处理嵌套类型
          paramType = paramType.replace(
            /Array<([^>]+)>/g,
            (match, innerType) => {
              const innerTypeTrimmed = innerType.trim();
              if (
                innerTypeTrimmed.match(/^[A-Z][A-Za-z0-9_]*$/) &&
                ![
                  "String",
                  "Text",
                  "U8",
                  "U16",
                  "U32",
                  "U64",
                  "U128",
                  "I8",
                  "I16",
                  "I32",
                  "I64",
                  "I128",
                  "Bool",
                ].includes(innerTypeTrimmed)
              ) {
                return `Array<I${innerTypeTrimmed}>`;
              } else {
                const convertedInnerType = innerTypeTrimmed
                  .replace(/\bu\d+\b/g, "number")
                  .replace(/\bi\d+\b/g, "number");
                return `Array<${convertedInnerType}>`;
              }
            }
          );
        }

        // 使用 Arg 后缀来区分参数名称
        return `${param}Arg: ${paramType}`;
      }
      return `${param}Arg: any`;
    })
    .join(", ");

  const nucleusMethod = `nucleus_${entry.method}`;

  // 生成实例创建代码和调用代码
  const createInstancesCode: string[] = [];
  const callParams: string[] = ["nucleusId", `'${entry.name}'`];

  for (let i = 1; i < jsInputParams.length; i++) {
    const param = jsInputParams[i];
    const paramName = `${param}Arg`; // 采用不同的参数名以避免冲突
    const inputType = inputParams.find((input) => input.startsWith(param));

    if (!inputType) continue;

    const typeStr = inputType.split(":")[1].trim();

    // 检查是否是泛型类型别名，比如 TypeName<GenericType>
    const genericTypeAliasMatch =
      typeStr.match(/^([A-Z][A-Za-z0-9_]*)<([^>]+)>$/) ||
      typeStr.match(/^([A-Z][A-Za-z0-9_]*)\[(.*)\]$/);

    if (genericTypeAliasMatch) {
      const typeName = genericTypeAliasMatch[1];
      const innerType = genericTypeAliasMatch[2] || "any";

      // 转换内部类型
      let polkadotInnerType;
      if (innerType === "string") {
        polkadotInnerType = "Text";
      } else if (innerType === "number") {
        polkadotInnerType = "U32";
      } else if (innerType === "boolean") {
        polkadotInnerType = "Bool";
      } else if (innerType === "u32") {
        polkadotInnerType = "U32";
      } else if (innerType === "u64") {
        polkadotInnerType = "U64";
      } else if (innerType === "i32") {
        polkadotInnerType = "I32";
      } else if (innerType === "i64") {
        polkadotInnerType = "I64";
      } else {
        polkadotInnerType = innerType;
      }

      // 查找是否存在相应的创建函数
      const createFuncName = `create${typeName}TypeResult`;

      // 使用创建函数（如果存在），否则使用直接创建实例
      createInstancesCode.push(
        `  const Type = ${createFuncName}(${polkadotInnerType === innerType ? `"${polkadotInnerType}"` : polkadotInnerType})`
      );
      createInstancesCode.push(
        `  const ${param} = new Type(registry, ${paramName});`
      );
      callParams.push(`${param}?.toHex()`);
    }
    // 检查是否是结构体类型
    else if (
      typeStr.match(/^I[A-Z][A-Za-z0-9_]*$/) &&
      ![
        "IString",
        "IText",
        "IU8",
        "IU16",
        "IU32",
        "IU64",
        "IU128",
        "II8",
        "II16",
        "II32",
        "II64",
        "II128",
        "IBool",
      ].includes(typeStr)
    ) {
      // 是结构体接口类型，创建对应的 Polkadot 类型
      const polkadotType = typeStr.substring(1); // 去掉 I 前缀
      createInstancesCode.push(`  const Type = ${polkadotType};`);
      createInstancesCode.push(
        `  const ${param} = new Type(registry, ${paramName});`
      );
      callParams.push(`${param}?.toHex()`);
    }
    // 检查是否是元组类型 [IA, string]
    else if (typeStr.startsWith("[") && typeStr.endsWith("]")) {
      // 是元组类型，创建 Tuple.with
      const tupleContent = typeStr.substring(1, typeStr.length - 1);
      // 将 IA 转换为 A，将 string 转换为 Text 等
      const tuplePolkadotTypes = tupleContent.split(",").map((t) => {
        const trimmed = t.trim();
        if (
          trimmed.match(/^I[A-Z][A-Za-z0-9_]*$/) &&
          ![
            "IString",
            "IText",
            "IU8",
            "IU16",
            "IU32",
            "IU64",
            "IU128",
            "II8",
            "II16",
            "II32",
            "II64",
            "II128",
            "IBool",
          ].includes(trimmed)
        ) {
          return trimmed.substring(1); // 去掉 I 前缀
        } else if (trimmed === "string") {
          return "Text";
        } else if (trimmed === "number") {
          return "U32";
        } else if (trimmed === "boolean") {
          return "Bool";
        }
        return trimmed;
      });

      createInstancesCode.push(
        `  const Type = Tuple.with([${tuplePolkadotTypes.join(", ")}]);`
      );
      createInstancesCode.push(
        `  const ${param} = new Type(registry, ${paramName});`
      );
      callParams.push(`${param}?.toHex()`);
    }
    // 处理基本类型
    else {
      let polkadotType;
      if (typeStr === "string") {
        polkadotType = "Text";
      } else if (typeStr === "number") {
        polkadotType = "U32";
      } else if (typeStr === "boolean") {
        polkadotType = "Bool";
      } else {
        polkadotType = typeStr;
      }

      createInstancesCode.push(
        `  const Type${param.charAt(0).toUpperCase() + param.slice(1)} = ${polkadotType};`
      );
      createInstancesCode.push(
        `  const ${param} = new Type${param.charAt(0).toUpperCase() + param.slice(1)}(registry, ${paramName});`
      );
      callParams.push(`${param}?.toHex()`);
    }
  }

  const instancesCode = createInstancesCode.join("\n");
  const rpcParams = callParams.join(", ");

  const jsImplementation = `
export async function ${entry.name}(${paramTypes}): Promise<${returnType}> {
  if (!api) throw new Error('API not initialized');
${instancesCode}
  const result = await api.rpc('${nucleusMethod}', ${rpcParams});
  return result as any;
}`;
  jsExports.push(jsImplementation);
}

/**
 * Generate TypeScript implementation file
 */
function generateTemplateCode(
  jsExports: string[],
  imports: string[],
  importPath: string,
  structTypes: string[],
  enumTypes: string[],
  interfaceTypes: string[] = [],
  typeAliases: string[] = [] // 添加类型别名数组参数
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
import { ApiPromise, HttpProvider } from "@polkadot/api";
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
  const provider = new HttpProvider(endpoint);
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
            let polkadotType: string | null = null;
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

  static from(registry: Registry, obj: I${className}): ${className} | null {
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

  // 添加接口定义到最终生成的代码中
  const interfaceDefinitions = interfaceTypes.join("\n\n");

  // 添加类型别名定义
  const typeAliasDefinitions = typeAliases.join("\n\n");

  return `${fileHeader}${importStatements}${finalApiInit}
${typeAliasDefinitions}
${interfaceDefinitions}
${jsStructImplementations}
${jsEnumImplementations}
${jsExports.join("\n")}`;
}

/**
 * Process type alias entry
 */
function processTypeAlias(
  entry: TypeAliasEntry,
  typeAliases: string[],
  neededImports: Set<string>,
  dependencyGraph: Map<string, Set<string>>
) {
  const dependencies = new Set<string>();
  const { name, target, generics } = entry;

  // 获取类型别名的实际类型表示
  const targetType = convertType(target);

  // 收集导入信息
  const imports = getImportForType(target);
  imports.forEach((imp) => neededImports.add(imp));

  // 创建类型别名定义
  let typeAliasDefinition = "";

  if (generics && generics.length > 0) {
    // 带泛型参数的类型别名
    const genericParams = generics.join(", ");
    typeAliasDefinition = `export type ${name}<${genericParams}> = ${targetType};`;

    // 对于 Result 类型，添加创建辅助函数
    if (target.kind === "Path" && target.path && target.path[0] === "Result") {
      // 为 Result 类型别名添加工厂函数
      const helperFunction = generateResultTypeAliasHelper(name, target);
      if (helperFunction) {
        typeAliasDefinition += "\n\n" + helperFunction;
      }
    }
  } else {
    // 普通类型别名
    typeAliasDefinition = `export type ${name} = ${targetType};`;

    // 为普通类型别名添加辅助函数（如果适用）
    if (target.kind === "Path" && target.path) {
      const helperFunction = generateTypeAliasHelper(name, target);
      if (helperFunction) {
        typeAliasDefinition += "\n\n" + helperFunction;
      }
    }
  }

  // 添加到类型别名列表
  typeAliases.push(typeAliasDefinition);

  // 更新依赖图
  dependencyGraph.set(name, dependencies);
}

/**
 * 为 Result 类型的类型别名生成辅助函数
 */
function generateResultTypeAliasHelper(
  name: string,
  target: TypeDefinition
): string | null {
  if (!target.generic_args || target.generic_args.length !== 2) {
    return null;
  }

  const okType = target.generic_args[0];
  const errType = target.generic_args[1];

  // 从错误类型中获取实际类型（通常是 String）
  let errTypeStr = "Text";
  if (errType.kind === "Path" && errType.path) {
    const typeName = errType.path[errType.path.length - 1];
    if (typeName === "String") {
      errTypeStr = "Text";
    } else {
      // 对于其他类型，使用原始类型名
      errTypeStr = typeName;
    }
  }

  // 生成工厂函数
  return `
export function create${name}TypeResult(OkType: any) {
  return Result.with({
    Ok: OkType,
    Err: ${errTypeStr}
  });
}`;
}

/**
 * 为普通类型别名生成辅助函数
 */
function generateTypeAliasHelper(
  name: string,
  target: TypeDefinition
): string | null {
  // 暂时只为特定类型生成辅助函数
  if (!target.path || target.path.length === 0) {
    return null;
  }

  // 这里可以为其他类型添加特定的辅助函数
  return null;
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
