import type { TypeDefinition } from "./types";

/**
 * Convert ABI type definition to TypeScript type
 */
export function convertType(type: TypeDefinition): string {
  switch (type.kind) {
    case "Path":
      return convertPathType(type);
    case "Tuple":
      return convertTupleType(type);
    case "Array":
      return convertArrayType(type);
    default:
      return "unknown";
  }
}

/**
 * Convert Path type
 */
function convertPathType(type: TypeDefinition): string {
  if (!type.path || type.path.length === 0) {
    return "unknown";
  }

  const typeName = type.path.join(".");

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
      return "number";
    case "bool":
      return "boolean";
    case "String":
      return "string";
    case "Vec":
      if (
        type.generic_args &&
        type.generic_args.length > 0 &&
        type.generic_args[0]
      ) {
        return `Array<${convertType(type.generic_args[0])}>`;
      }
      return "Array<unknown>";
    case "Option":
      if (
        type.generic_args &&
        type.generic_args.length > 0 &&
        type.generic_args[0]
      ) {
        return `${convertType(type.generic_args[0])} | null`;
      }
      return "unknown | null";
    case "Result":
      if (
        type.generic_args &&
        type.generic_args.length === 2 &&
        type.generic_args[0] &&
        type.generic_args[1]
      ) {
        return `{ ok: ${convertType(type.generic_args[0])}, err: ${convertType(
          type.generic_args[1]
        )} }`;
      }
      return "unknown";
    default:
      if (type.generic_args && type.generic_args.length > 0) {
        const genericParams = type.generic_args.map(convertType).join(", ");
        return `${typeName}<${genericParams}>`;
      }
      return typeName;
  }
}

/**
 * Convert Tuple type
 */
function convertTupleType(type: TypeDefinition): string {
  if (!type.tuple_args) {
    return "[unknown]";
  }

  if (type.tuple_args.length === 0) {
    return "[]";
  }

  const tupleTypes = type.tuple_args
    .map((arg) => (arg ? convertType(arg) : "unknown"))
    .join(", ");
  return `[${tupleTypes}]`;
}

/**
 * Convert Array type
 */
function convertArrayType(type: TypeDefinition): string {
  if (!type.elem) {
    return "unknown[]";
  }

  return `${convertType(type.elem)}[]`;
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

  if (type.elem) {
    imports.push(...getImportForType(type.elem));
  }

  return imports;
}
