import { TypeRegistry } from "@polkadot/types";
import * as codecTypes from "@polkadot/types-codec";
import { hexToU8a, isHex, u8aToHex } from "@polkadot/util";

export const registry = new TypeRegistry();

export const TYPE_MAP = {
  u8: "U8",
  u16: "U16",
  u32: "U32",
  u64: "U64",
  u128: "U128",
  i8: "I8",
  i16: "I16",
  i32: "I32",
  i64: "I64",
  i128: "I128",
  bool: "Bool",
  Text: "Text",
  str: "Text",
  Bytes: "Bytes",
  byte: "Bytes",
  Vec: "Vec",
  Option: "Option",
  Compact: "Compact",
  BitVec: "BitVec",
  BTreeMap: "BTreeMap",
  BTreeSet: "BTreeSet",
  HashMap: "HashMap",
  Tuple: "Tuple",
  Struct: "Struct",
  struct: "Struct",
  Enum: "Enum",
  enum: "Enum",
};

/**
 * Codec class for managing polkadot-js codec type creation and conversion
 */
export class Codec {
  private registry: TypeRegistry;

  constructor() {
    this.registry = new TypeRegistry();
  }

  /**
   * Get the corresponding Codec class based on type name or type object
   * @param typeInfo Type name or complex type object
   * @returns Corresponding Codec class or undefined
   */
  getTypeClass(typeInfo: string | any): any {
    if (!typeInfo) return undefined;

    if (typeof typeInfo === "object" && typeInfo.kind === "Path") {
      const typeName = typeInfo.path[0];

      if (typeInfo.generic_args && typeInfo.generic_args.length > 0) {
        const baseType = typeName.toLowerCase();
        const genericType = typeInfo.generic_args[0];

        const codecTypeName = TYPE_MAP[typeName as keyof typeof TYPE_MAP];
        if (!codecTypeName) return undefined;

        const BaseClass = (codecTypes as any)[codecTypeName];

        let InnerTypeClass;
        if (genericType && genericType.kind === "Path") {
          const innerTypeName = genericType.path[0];
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
            ].includes(innerTypeName)
          ) {
            const properTypeName =
              innerTypeName.charAt(0).toUpperCase() +
              innerTypeName.substr(1).toUpperCase();
            InnerTypeClass = (codecTypes as any)[properTypeName];
          } else {
            InnerTypeClass = this.getTypeClass(genericType);
          }
        } else {
          InnerTypeClass = this.getTypeClass(genericType);
        }

        if (BaseClass && InnerTypeClass) {
          return BaseClass.with(InnerTypeClass);
        }
      }

      const codecTypeName = TYPE_MAP[typeName as keyof typeof TYPE_MAP];
      return codecTypeName ? (codecTypes as any)[codecTypeName] : undefined;
    }

    if (typeof typeInfo === "string") {
      if (
        typeInfo.toLowerCase() === "struct" ||
        typeInfo.toLowerCase() === "type"
      ) {
        return (codecTypes as any)["Struct"];
      }

      const codecTypeName = TYPE_MAP[typeInfo as keyof typeof TYPE_MAP];
      return codecTypeName ? (codecTypes as any)[codecTypeName] : undefined;
    }

    return undefined;
  }

  /**
   * Create an instance of the specified type
   * @param typeName Type name
   * @param value Value
   * @returns Created instance
   */
  createInstance(typeName: string, value: any): any {
    const TypeClass = this.getTypeClass(typeName);
    if (!TypeClass) {
      throw new Error(`Unknown type: ${typeName}`);
    }
    return new TypeClass(this.registry, value);
  }

  /**
   * Handle Vec type
   * @param innerType Type of elements in Vec
   * @param value Value
   * @returns Processing result
   */
  handleVecType(innerType: string | undefined, value: any): any {
    try {
      if (!innerType) {
        return {
          hex: null,
          json: Array.isArray(value) ? value : [],
        };
      }

      let formattedValue = value;
      if (typeof value === "string") {
        if (!value.startsWith("[")) {
          formattedValue = "[" + value + "]";
        }
        formattedValue = formattedValue.replace(/'/g, '"');
        formattedValue = JSON.parse(formattedValue);
      }

      if (innerType === "u8") {
        if (Array.isArray(formattedValue)) {
          const bytesArray = new Uint8Array(formattedValue);
          return {
            hex: u8aToHex(bytesArray),
            json: Array.from(bytesArray),
          };
        } else {
          const bytes = new codecTypes.Bytes(this.registry, formattedValue);
          return {
            hex: bytes.toHex(),
            json: bytes.toJSON(),
          };
        }
      }

      let InnerTypeClass;
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
        ].includes(innerType)
      ) {
        const properTypeName =
          innerType.charAt(0).toUpperCase() +
          innerType.substring(1).toUpperCase();
        InnerTypeClass = (codecTypes as any)[properTypeName];
      } else {
        InnerTypeClass = this.getTypeClass(innerType);
      }
      if (InnerTypeClass) {
        const vec = new codecTypes.Vec(
          this.registry,
          InnerTypeClass,
          formattedValue
        );
        return {
          hex: vec.toHex(),
          json: vec.toJSON(),
        };
      }

      return {
        hex: null,
        json: formattedValue,
      };
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      throw new Error(`Vec parsing error: ${errorMessage}`);
    }
  }

  /**
   * Handle Option type
   * @param innerType Type of element in Option
   * @param value Value
   * @returns Processing result
   */
  handleOptionType(innerType: string | undefined, value: any): any {
    if (!innerType) {
      return {
        hex: null,
        json: value,
      };
    }
    if (
      value === "None" ||
      value === "null" ||
      value === "" ||
      value === undefined
    ) {
      return {
        hex: "0x00",
        json: null,
      };
    }

    let parsedValue = value;
    if (
      typeof value === "string" &&
      value.startsWith("Some(") &&
      value.endsWith(")")
    ) {
      parsedValue = value.slice(5, -1).trim();
    }

    const InnerTypeClass = this.getTypeClass(innerType);
    if (InnerTypeClass) {
      const option = new codecTypes.Option(
        this.registry,
        InnerTypeClass,
        parsedValue
      );
      return {
        hex: option.toHex(),
        json: option.toJSON(),
      };
    }

    return {
      hex: null,
      json: parsedValue,
    };
  }

  /**
   * Handle Compact type
   * @param innerType Type in Compact
   * @param value Value
   * @returns Processing result
   */
  handleCompactType(innerType: string | undefined, value: any): any {
    if (!innerType) {
      return {
        hex: null,
        json: value,
      };
    }
    const InnerTypeClass = this.getTypeClass(innerType);
    if (InnerTypeClass) {
      const compact = new codecTypes.Compact(
        this.registry,
        InnerTypeClass,
        value
      );
      return {
        hex: compact.toHex(),
        json: compact.toJSON(),
      };
    }

    return {
      hex: null,
      json: value,
    };
  }

  /**
   * Convert value to hexadecimal and JSON representation of specified type
   * @param typeName Type name
   * @param value Value
   * @param innerType Inner type (for generic types)
   * @returns Conversion result
   */
  convertValue(
    typeName: string,
    value: any,
    innerType?: string
  ): { hex: string | null; json: any } {
    try {
      if (typeName === "Vec") {
        return this.handleVecType(innerType, value);
      } else if (typeName === "Option") {
        return this.handleOptionType(innerType, value);
      } else if (typeName === "Compact") {
        return this.handleCompactType(innerType, value);
      } else {
        const instance = this.createInstance(typeName, value);
        return {
          hex: instance.toHex(),
          json: instance.toJSON(),
        };
      }
    } catch (e: unknown) {
      console.error(`Error converting value for type ${typeName}:`, e);
      const errorMessage = e instanceof Error ? e.message : String(e);
      return {
        hex: null,
        json: `Error: ${errorMessage}`,
      };
    }
  }

  /**
   * Handle Struct type with fields
   * @param fields Fields to include in the struct
   * @returns Processing result
   */
  handleStructType(
    fields: Array<{ name: string; type: any; value: any; typeClass: any }>
  ): any {
    try {
      const typeMap: Record<string, any> = {};
      fields.forEach((field) => {
        typeMap[field.name] = field.typeClass;
      });
      return codecTypes.Struct.with(typeMap);
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      console.error("Struct error:", errorMessage);
      throw new Error(`Struct error: ${errorMessage}`);
    }
  }
}

export const codec = new Codec();
