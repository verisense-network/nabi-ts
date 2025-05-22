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
      return "i32";
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
          const okType = mapPolkadotTypeToTs(typeParts[0].trim()) || 'any';
          const errType = mapPolkadotTypeToTs(typeParts[1].trim()) || 'any';
          return `{ ok: ${okType}, err: ${errType} }`;
        }
      }

      return trimmedType;
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
      return "I32";
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
  const typeAliases: string[] = [];
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
    typeAliases
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
      if (innerTypeMatch && innerTypeMatch[1]) {
        const innerType = innerTypeMatch[1];
        return `Array<${mapPolkadotTypeToTs(innerType) || 'unknown'}>`;
      }
      return "Array<unknown>";
    });

    tsNativeType = tsNativeType.replace(
      /VecFixed\.with\([^,]+, \d+\)/g,
      (match) => {
        const innerTypeMatch = match.match(/VecFixed\.with\(([^,]+), \d+\)/);
        if (innerTypeMatch && innerTypeMatch[1]) {
          const innerType = innerTypeMatch[1];
          return `Array<${mapPolkadotTypeToTs(innerType) || 'unknown'}>`;
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

    inputParams.push(`${input.name}: ${convertType(input.type, true)}`);
    jsInputParams.push(input.name);
  }

  let returnType = "void";
  if (entry.output) {
    const outputImports = getImportForType(entry.output);
    outputImports.forEach((imp) => neededImports.add(imp));
    returnType = convertType(entry.output, false);
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
          paramType = `I${paramType}`;
        } else if (paramType.startsWith("[") && paramType.endsWith("]")) {
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
          paramType = paramType.replace(/\bu\d+\b/g, "number");
          paramType = paramType.replace(/\bi\d+\b/g, "number");

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

        return `${param}Arg: ${paramType}`;
      }
      return `${param}Arg: any`;
    })
    .join(", ");

  const nucleusMethod = `nucleus_${entry.method}`;

  const createInstancesCode: string[] = [];
  const callParams: string[] = ["nucleusId", `'${entry.name}'`];

  const allSimpleTypes =
    entry.inputs.length > 1 &&
    entry.inputs.every((input) => {
      if (input.type.kind !== "Path") return false;
      const typePath = input.type.path && input.type.path[0];
      return (
        typePath !== undefined &&
        [
          "String",
          "u8",
          "u16",
          "u32",
          "u64",
          "u128",
          "i8",
          "i16",
          "i32",
          "i64",
          "i128",
          "bool",
        ].includes(typePath)
      );
    });

  if (allSimpleTypes) {
    const tuplePolkadotTypes = entry.inputs.map((input) => {
      const typePath = input.type.path && input.type.path[0];
      if (!typePath) return "Unknown";

      if (typePath === "String") return "Text";
      if (typePath === "bool") return "Bool";

      if (
        [
          "u8",
          "u16",
          "u32",
          "u64",
          "u128",
          "i8",
          "i16",
          "i32",
          "i64",
          "i128",
        ].includes(typePath)
      ) {
        return typePath.charAt(0).toUpperCase() + typePath.slice(1);
      }
      return typePath;
    });

    const argNames = entry.inputs.map((_, i) => `${jsInputParams[i + 1]}Arg`);

    createInstancesCode.push(
      `  const Type = Tuple.with([${tuplePolkadotTypes.join(", ")}]);`
    );
    createInstancesCode.push(
      `  const payload = new Type(registry, [${argNames.join(", ")}]);`
    );
    callParams.push("payload?.toHex()");
  } else {
    for (let i = 1; i < jsInputParams.length; i++) {
      const param = jsInputParams[i];
      const paramName = `${param}Arg`;
      const inputType = inputParams.find((input) => input.startsWith(param));

      if (!inputType) continue;
      
      const parts = inputType.split(":");
      if (parts.length < 2) continue;
      
      const typeStr = parts[1].trim();

      const genericTypeAliasMatch =
        typeStr.match(/^([A-Z][A-Za-z0-9_]*)<([^>]+)>$/) ||
        typeStr.match(/^([A-Z][A-Za-z0-9_]*)\[(.*)]$/);

      if (genericTypeAliasMatch && genericTypeAliasMatch[1]) {
        const typeName = genericTypeAliasMatch[1];
        const innerType = (genericTypeAliasMatch[2] || "any").trim();

        let polkadotInnerType;
        if (innerType === "string") {
          polkadotInnerType = "Text";
        } else if (innerType === "number") {
          polkadotInnerType = "U32";
        } else if (innerType === "boolean") {
          polkadotInnerType = "Bool";
        } else {
          polkadotInnerType = innerType;
        }

        const createFuncName = `create${typeName}TypeResult`;

        createInstancesCode.push(
          `  const Type = ${createFuncName}(${polkadotInnerType === innerType ? `"${polkadotInnerType}"` : polkadotInnerType})`
        );
        createInstancesCode.push(
          `  const ${param} = new Type(registry, ${paramName});`
        );
        callParams.push(`${param}?.toHex()`);
      } else if (
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
        const polkadotType = typeStr.substring(1);
        createInstancesCode.push(`  const Type = ${polkadotType};`);
        createInstancesCode.push(
          `  const ${param} = new Type(registry, ${paramName});`
        );
        callParams.push(`${param}?.toHex()`);
      } else if (typeStr.startsWith("[") && typeStr.endsWith("]")) {
        const tupleContent = typeStr.substring(1, typeStr.length - 1);

        const tuplePolkadotTypes = tupleContent.split(",").map((t) => {
          const trimmedType = t.trim();
          if (
            trimmedType.match(/^I[A-Z][A-Za-z0-9_]*$/) &&
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
            ].includes(trimmedType)
          ) {
            return trimmedType.substring(1);
          } else if (trimmedType === "string") {
            return "Text";
          } else if (trimmedType === "number") {
            return "U32";
          } else if (trimmedType === "boolean") {
            return "Bool";
          }
          return trimmedType;
        });

        createInstancesCode.push(
          `  const Type = Tuple.with([${tuplePolkadotTypes.join(", ")}]);`
        );
        createInstancesCode.push(
          `  const ${param} = new Type(registry, ${paramName});`
        );
        callParams.push(`${param}?.toHex()`);
      } else {
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

        if (param) {
          createInstancesCode.push(
            `  const Type${param.charAt(0).toUpperCase() + param.slice(1)} = ${polkadotType};`
          );
          createInstancesCode.push(
            `  const ${param} = new Type${param.charAt(0).toUpperCase() + param.slice(1)}(registry, ${paramName});`
          );
          callParams.push(`${param}?.toHex()`);
        }
      }
    }
  }

  const instancesCode = createInstancesCode.join("\n");
  const rpcParams = callParams.join(", ");

  const isResultType =
    entry.output &&
    entry.output.kind === "Path" &&
    entry.output.path &&
    entry.output.path[0] === "Result" &&
    entry.output.generic_args &&
    entry.output.generic_args.length === 2;

  const isTypeAlias =
    entry.output &&
    entry.output.kind === "Path" &&
    entry.output.path &&
    entry.output.path.length > 0 &&
    entry.output.path[0].match(/^[A-Z]$/) &&
    entry.output.generic_args &&
    entry.output.generic_args.length > 0;

  if (isTypeAlias) {
    returnType = "any";
  }

  let resultOkType = "";
  let resultErrType = "";
  let resultHandlingCode = "";

  let typeAliasName = "";
  let typeAliasOkType = "";
  let typeAliasHandlingCode = "";

  if (isResultType && entry.output && entry.output.generic_args) {
    const okType = entry.output.generic_args[0];
    const errType = entry.output.generic_args[1];

    if (
      okType.kind === "Tuple" &&
      okType.tuple_args &&
      okType.tuple_args.length === 0
    ) {
      resultOkType = "Null";

      neededImports.add("Null");
    } else if (okType.kind === "Path" && okType.path && okType.path.length > 0) {
      const typeName = okType.path[0];
      if (typeName === "String") {
        resultOkType = "Text";
      } else if (typeName === "bool") {
        resultOkType = "Bool";
      } else if (typeName === "Null") {
        resultOkType = "Null";
      } else if (
        [
          "u8",
          "u16",
          "u32",
          "u64",
          "u128",
          "i8",
          "i16",
          "i32",
          "i64",
          "i128",
        ].includes(typeName)
      ) {
        resultOkType = typeName.charAt(0).toUpperCase() + typeName.slice(1);
      } else {
        resultOkType = typeName;
      }
    }

    if (
      errType.kind === "Tuple" &&
      errType.tuple_args &&
      errType.tuple_args.length === 0
    ) {
      resultErrType = "Null";

      neededImports.add("Null");
    } else if (errType.kind === "Path" && errType.path && errType.path.length > 0) {
      const typeName = errType.path[errType.path.length - 1];
      if (typeName === "String") {
        resultErrType = "Text";
      } else if (typeName === "bool") {
        resultErrType = "Bool";
      } else if (typeName === "Null") {
        resultErrType = "Null";
      } else if (
        [
          "u8",
          "u16",
          "u32",
          "u64",
          "u128",
          "i8",
          "i16",
          "i32",
          "i64",
          "i128",
        ].includes(typeName)
      ) {
        resultErrType = typeName.charAt(0).toUpperCase() + typeName.slice(1);
      } else {
        resultErrType = typeName;
      }
    }

    resultHandlingCode = `
  const responseBytes = Buffer.from(response as string, "hex");

  const ResultType = Result.with({
    Ok: ${resultOkType},
    Err: ${resultErrType},
  });
  return new ResultType(registry, responseBytes);`;
  }

  if (
    isTypeAlias &&
    entry.output &&
    entry.output.path &&
    entry.output.generic_args
  ) {
    typeAliasName = entry.output.path[0];
    const genericArg = entry.output.generic_args[0];

    if (
      genericArg.kind === "Tuple" &&
      genericArg.tuple_args &&
      genericArg.tuple_args.length === 0
    ) {
      typeAliasOkType = "Null";

      neededImports.add("Null");
    } else if (genericArg.kind === "Path" && genericArg.path && genericArg.path.length > 0) {
      const typeName = genericArg.path[genericArg.path.length - 1];
      if (typeName === "String") {
        typeAliasOkType = "Text";
      } else if (typeName === "bool") {
        typeAliasOkType = "Bool";
      } else if (typeName === "Null") {
        typeAliasOkType = "Null";
      } else if (
        [
          "u8",
          "u16",
          "u32",
          "u64",
          "u128",
          "i8",
          "i16",
          "i32",
          "i64",
          "i128",
        ].includes(typeName)
      ) {
        typeAliasOkType = typeName.charAt(0).toUpperCase() + typeName.slice(1);
      } else {
        typeAliasOkType = typeName;
      }
    }

    typeAliasHandlingCode = `
  const responseBytes = Buffer.from(response as string, "hex");

  const ResultType = create${typeAliasName}TypeResult(${typeAliasOkType});
  return new ResultType(registry, responseBytes);`;
  }

  const jsImplementation = `
export async function ${entry.name}(${paramTypes}): Promise<${returnType}> {
  if (!api) throw new Error('API not initialized');
${instancesCode}
  const response = await api.rpc('${nucleusMethod}', ${rpcParams});
${isResultType ? resultHandlingCode : isTypeAlias ? typeAliasHandlingCode : "  return response as any;"}
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
  typeAliases: string[] = []
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

  const needsCodecImport = typeAliases.some((alias) =>
    alias.includes("extends Codec")
  );

  let importStatements =
    allImports.length > 0
      ? `import { ${allImports.join(", ")} } from '${importPath}';\n\n`
      : "";

  if (needsCodecImport) {
    importStatements += `import type { Codec } from '@polkadot/types-codec/types';\n\n`;
  }

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
    .map((name) => `    ${name}: ${name}`)
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

  const interfaceDefinitions = interfaceTypes.join("\n\n");

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

  const targetType = convertType(target, true);

  const imports = getImportForType(target);
  imports.forEach((imp) => neededImports.add(imp));

  let typeAliasDefinition = "";

  if (generics && generics.length > 0) {
    let genericParams = generics.join(", ");

    typeAliasDefinition = `export type ${name}<${genericParams}> = ${targetType};`;

    if (target.kind === "Path" && target.path && target.path[0] === "Result") {
      const helperFunction = generateResultTypeAliasHelper(name, target);
      if (helperFunction) {
        typeAliasDefinition += "\n\n" + helperFunction;
      }
    }
  } else {
    typeAliasDefinition = `export type ${name} = ${targetType};`;

    if (target.kind === "Path" && target.path) {
      const helperFunction = generateTypeAliasHelper(name, target);
      if (helperFunction) {
        typeAliasDefinition += "\n\n" + helperFunction;
      }
    }
  }

  typeAliases.push(typeAliasDefinition);

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

  let errTypeStr = "Text";
  if (errType.kind === "Path" && errType.path && errType.path.length > 0) {
    const typeName = errType.path[errType.path.length - 1];
    if (typeName === "String") {
      errTypeStr = "Text";
    } else {
      errTypeStr = typeName;
    }
  }

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
  if (!target.path || target.path.length === 0) {
    return null;
  }

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
