import type { TypeDefinition, Field } from "./types";

/**
 * Convert ABI type definition to TypeScript type
 * @param type 类型定义
 * @param useNativeTypes 是否使用TypeScript原生类型（而非Polkadot.js类型）
 */
export function convertType(
  type: TypeDefinition,
  useNativeTypes: boolean = false
): string {
  switch (type.kind) {
    case "Path":
      return convertPathType(type, useNativeTypes);
    case "Tuple":
      return convertTupleType(type, useNativeTypes);
    case "Array":
      return convertArrayType(type, useNativeTypes);
    case "TypeAlias":
      if (type.target) {
        return convertType(type.target, useNativeTypes);
      }
      return "unknown";
    default:
      return "unknown";
  }
}

/**
 * Convert function input parameter type
 * @param input 函数参数字段
 * @param useNativeTypes 是否使用TypeScript原生类型
 */
export function convertInputType(
  input: Field,
  useNativeTypes: boolean = true
): string {
  if (input && input.type) {
    return convertType(input.type, useNativeTypes);
  }
  return "unknown";
}

/**
 * Convert Path type
 * @param type 类型定义
 * @param useNativeTypes 是否使用TypeScript原生类型（而非Polkadot.js类型）
 */
function convertPathType(
  type: TypeDefinition,
  useNativeTypes: boolean = false
): string {
  if (!type.path || type.path.length === 0) {
    return "unknown";
  }

  const typeName = type.path[type.path.length - 1];

  switch (typeName) {
    case "u8":
    case "u16":
    case "u32":
    case "u64":
    case "i8":
    case "i16":
    case "i32":
    case "i64":
    case "f32":
    case "f64":
      return useNativeTypes ? "number" : typeName;
    case "bool":
      return "boolean";
    case "String":
      return useNativeTypes ? "string" : "Text";
    case "Vec":
      if (
        type.generic_args &&
        type.generic_args.length > 0 &&
        type.generic_args[0]
      ) {
        return `Array<${convertType(type.generic_args[0], useNativeTypes)}>`;
      }
      return "Array<unknown>";
    case "Option":
      if (
        type.generic_args &&
        type.generic_args.length > 0 &&
        type.generic_args[0]
      ) {
        return `${convertType(type.generic_args[0], useNativeTypes)} | null`;
      }
      return "unknown | null";
    case "Result":
      if (
        type.generic_args &&
        type.generic_args.length === 2 &&
        type.generic_args[0] &&
        type.generic_args[1]
      ) {
        if (useNativeTypes) {
          return `{ ok: ${convertType(type.generic_args[0], true)} | null, err: ${convertType(
            type.generic_args[1],
            true
          )} | null }`;
        } else {
          return `Result<${convertType(type.generic_args[0], false)}, ${convertType(
            type.generic_args[1],
            false
          )}>`;
        }
      }
      return "unknown";
    default:
      if (type.generic_args && type.generic_args.length > 0) {
        const genericParams = type.generic_args
          .map((arg) => convertType(arg, useNativeTypes))
          .join(", ");
        return `${typeName}<${genericParams}>`;
      }
      return typeName;
  }
}

/**
 * Convert Tuple type
 * @param type 类型定义
 * @param useNativeTypes 是否使用TypeScript原生类型
 */
function convertTupleType(
  type: TypeDefinition,
  useNativeTypes: boolean = false
): string {
  if (!type.tuple_args) {
    return "[unknown]";
  }

  if (type.tuple_args.length === 0) {
    return "Null";
  }

  const tupleElements = type.tuple_args
    .map((t) => convertType(t, useNativeTypes))
    .join(", ");
  return `[${tupleElements}]`;
}

/**
 * Convert Array type
 * @param type 类型定义
 * @param useNativeTypes 是否使用TypeScript原生类型
 */
function convertArrayType(
  type: TypeDefinition,
  useNativeTypes: boolean = false
): string {
  if (!type.elem) {
    return "unknown[]";
  }

  if (type.len !== undefined) {
    if (useNativeTypes) {
      return `${convertType(type.elem, useNativeTypes)}[]`;
    }

    const elemType = convertType(type.elem, false);
    const isBasicType = /^[ui]\d+$/.test(elemType);

    if (isBasicType) {
      return `VecFixed.with(${elemType.toUpperCase()}, ${type.len})`;
    } else {
      return `VecFixed.with(${elemType}, ${type.len})`;
    }
  }

  return `${convertType(type.elem, useNativeTypes)}[]`;
}

/**
 * Get import information for a type
 */
export function getImportForType(type: TypeDefinition): string[] {
  const imports: string[] = [];

  switch (type.kind) {
    case "Path":
      return getImportsForPathType(type);
    case "Tuple":
      return getImportsForTupleType(type);
    case "Array":
      return getImportsForArrayType(type);
    case "TypeAlias":
      if (type.target) {
        return getImportForType(type.target);
      }
      return [];
    default:
      return [];
  }
}

/**
 * Get import information for a Path type
 */
function getImportsForPathType(type: TypeDefinition): string[] {
  const imports: string[] = [];

  if (!type.path || type.path.length === 0) {
    return imports;
  }

  const typeName = type.path[type.path.length - 1] || "";

  switch (typeName) {
    case "Vec":
      imports.push("Vec");
      break;
    case "Option":
      imports.push("Option");
      break;
    case "Result":
      imports.push("Result");
      break;
    case "u8":
    case "u16":
    case "u32":
    case "u64":
      imports.push("U8", "U16", "U32", "U64");
      break;
    case "i8":
    case "i16":
    case "i32":
    case "i64":
      imports.push("I8", "I16", "I32", "I64");
      break;
  }

  if (type.generic_args) {
    for (const arg of type.generic_args) {
      if (arg) {
        imports.push(...getImportForType(arg));
      }
    }
  }

  return imports;
}

/**
 * Get import information for a Tuple type
 */
function getImportsForTupleType(type: TypeDefinition): string[] {
  const imports: string[] = [];

  if (type.tuple_args) {
    for (const arg of type.tuple_args) {
      if (arg) {
        imports.push(...getImportForType(arg));
      }
    }
  }

  return imports;
}

/**
 * Get import information for an Array type
 */
function getImportsForArrayType(type: TypeDefinition): string[] {
  const imports: string[] = [];

  if (type.len !== undefined) {
    imports.push("VecFixed");
  }

  if (type.elem) {
    imports.push(...getImportForType(type.elem));
  }

  return imports;
}
