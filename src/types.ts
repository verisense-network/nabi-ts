export type AbiEntry = StructEntry | EnumEntry | FunctionEntry;

export interface StructEntry {
  type: "struct";
  name: string;
  fields: Field[];
}

export interface EnumEntry {
  type: "enum";
  name: string;
  variants: Variant[];
}

export interface FunctionEntry {
  type: "fn";
  name: string;
  method: "init" | "get" | "post" | "callback";
  inputs: Field[];
  output: TypeDefinition | null;
}

export interface Field {
  name: string;
  type: TypeDefinition;
}

export interface Variant {
  name: string;
  fields: TypeDefinition[];
}

export interface TypeDefinition {
  kind: "Path" | "Tuple" | "Array";

  path?: string[];
  generic_args?: TypeDefinition[];

  tuple_args?: TypeDefinition[];

  elem?: TypeDefinition;
  len?: number;
}

export interface GeneratorOptions {
  importPath?: string;
}
