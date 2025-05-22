<template>
  <div class="json-struct-viewer">
    <div v-if="structures.length > 0" class="space-y-6">
      <Card v-for="(struct, index) in structures" :key="index" class="struct-container">
        <CardHeader>
          <div class="flex justify-between items-center">
            <CardTitle>struct {{ struct.name }}</CardTitle>
            <Button variant="outline" size="sm" @click="toggleDebugMode(index)">
              {{ struct.debugMode ? 'Exit debug' : 'Debug mode' }}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div class="grid" :class="{ 'grid-cols-1': !struct.debugMode, 'grid-cols-2 gap-4': struct.debugMode }">
            <div class="struct-code">
              <pre class="bg-muted p-3 rounded whitespace-pre-wrap text-sm">{{ struct.formattedCode }}</pre>
            </div>

            <div v-if="struct.debugMode" class="debug-panel border-l pl-4">
              <h4 class="text-sm font-medium mb-2">Debug values</h4>
              <div class="space-y-3">
                <div v-for="(field, fieldIndex) in struct.fields" :key="fieldIndex" class="field-input">
                  <Label class="text-xs">
                    {{ field.name }} <span class="text-muted-foreground">({{ field.formatType }})</span>
                  </Label>

                  <!-- 嵌套结构体显示 -->
                  <div v-if="isNestedType(field.type)" class="ml-4 mt-2 pl-2 border-l border-gray-200 space-y-2">
                    <div v-for="(nestedField, i) in getNestedFields(field.type)" :key="i">
                      <Label class="text-xs">
                        {{ nestedField.name }} <span class="text-muted-foreground">({{ nestedField.formatType }})</span>
                      </Label>
                      <Input :value="field.nestedValues[nestedField.name] || ''"
                        @input="e => updateNestedValue(field, nestedField.name, e.target.value)"
                        :placeholder="getPlaceholder(nestedField.type)" class="h-8 mt-1 w-full" />
                    </div>
                  </div>

                  <!-- 标准输入框 -->
                  <Input v-else v-model="field.debugValue" :placeholder="getPlaceholder(field.type)" class="h-8 mt-1" />
                </div>

                <div class="pt-2 flex flex-col space-y-2">
                  <Button variant="outline" size="sm" @click="convertValues(index)">
                    Debug
                  </Button>
                  <Button variant="outline" size="sm" @click="resetValues(index)">
                    Reset
                  </Button>
                </div>

                <div v-if="struct.debugResult" class="mt-3">
                  <Label class="text-xs">Result:</Label>
                  <pre class="bg-muted p-2 rounded text-xs mt-1">{{ struct.debugResult }}</pre>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
    <div v-else class="flex justify-center items-center h-32 border border-dashed rounded-md bg-muted/20">
      <p class="text-muted-foreground">No data available</p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, reactive, watch } from 'vue';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { codec, registry } from '@/utils/codec';

// 建立结构体类型字典，用于缓存创建的结构体类型
const structTypeClasses = {};

const props = defineProps({
  jsonData: {
    type: [Object, Array, String],
    required: true
  }
});

const structures = ref([]);

watch(() => props.jsonData, processJsonData, { immediate: true });

function isNestedType(type) {
  if (!type) return false;

  // Check basic types
  const isVec = type.kind === 'Path' && type.path && type.path[0] === 'Vec';
  const isBasicType = ['String', 'u8', 'u16', 'u32', 'u64', 'u128', 'i8', 'i16', 'i32', 'i64', 'i128']
    .some(t => type.path && type.path.includes(t));

  // Check for complex struct type (capitalized single path)
  const isStructType = type.kind === 'Path' &&
    type.path &&
    type.path.length === 1 &&
    /^[A-Z]/.test(type.path[0]) &&
    !isVec &&
    !isBasicType;

  // Check for tuple type
  const isTuple = type.kind === 'Tuple';

  // Check for array type
  const isArray = type.kind === 'Array';

  // Check for complex path type (e.g., quote::T)
  const isComplexPath = type.kind === 'Path' && type.path && type.path.length > 1;

  return isStructType || isTuple || isArray || isComplexPath;
}

function getNestedStructDef(typeName) {
  const data = typeof props.jsonData === 'string' ? JSON.parse(props.jsonData) : props.jsonData;
  const normalizedData = Array.isArray(data) ? data : [data];

  return normalizedData.find(item =>
    item.type === 'struct' && item.name === typeName
  );
}

function getNestedTypeClass(type) {
  // Handle different types of nested structures
  if (!type) return null;

  try {
    // Handle struct types (single capitalized path)
    if (type.kind === 'Path' && type.path && type.path.length === 1 && /^[A-Z]/.test(type.path[0])) {
      const typeName = type.path[0];

      // Try to get from cache first
      if (structTypeClasses[typeName]) {
        return structTypeClasses[typeName];
      }

      const structDef = getNestedStructDef(typeName);

      if (!structDef) {
        console.error(`Struct definition for ${typeName} not found`);
        return null;
      }

      // Create field objects for the struct
      const fields = structDef.fields.map(field => {
        let fieldTypeClass = null;

        // Process nested fields recursively
        if (isNestedType(field.type)) {
          fieldTypeClass = getNestedTypeClass(field.type);
          console.log(`Field ${field.name} typeClass: ${fieldTypeClass ? 'Found' : 'Not found'}`);
        } else {
          fieldTypeClass = codec.getTypeClass(field.type);
        }

        return {
          name: field.name,
          type: field.type,
          value: null,
          typeClass: fieldTypeClass
        };
      });

      // Use handleStructType to create struct type
      const typeClass = codec.handleStructType(fields);

      // Cache the result
      structTypeClasses[typeName] = typeClass;
      console.log(`Created typeClass for ${typeName}: ${typeClass ? 'Success' : 'Failed'}`);

      return typeClass;
    }
    // Handle tuple types
    else if (type.kind === 'Tuple') {
      // 元组类型需要特殊处理
      console.log(`Processing tuple type with ${type.tuple_args ? type.tuple_args.length : 0} args`);

      try {
        // 检查元组类型的缓存
        const tupleKey = `Tuple_${type.tuple_args ? type.tuple_args.length : 0}`;
        if (structTypeClasses[tupleKey]) {
          return structTypeClasses[tupleKey];
        }

        // 尝试直接使用codec
        const typeClass = codec.getTypeClass(type);
        if (typeClass) {
          structTypeClasses[tupleKey] = typeClass;
          return typeClass;
        }

        // 我们需要为元组类型创建正确的类型类
        // 检查codec是否支持元组类型
        try {
          // 尝试获取元组类型的直接实现
          if ('createTupleType' in codec) {
            const tupleTypes = [];
            if (type.tuple_args) {
              for (let i = 0; i < type.tuple_args.length; i++) {
                const argType = type.tuple_args[i];
                let argTypeClass = null;

                if (isNestedType(argType)) {
                  argTypeClass = getNestedTypeClass(argType);
                } else {
                  argTypeClass = codec.getTypeClass(argType);
                }

                tupleTypes.push(argTypeClass);
              }
            }

            // 使用codec的专用元组方法
            const tupleTypeClass = codec.createTupleType(tupleTypes);
            console.log(`Created direct tuple type class: ${tupleTypeClass ? 'Success' : 'Failed'}`);
            return tupleTypeClass;
          }
        } catch (tupleError) {
          console.warn(`Failed to create direct tuple type:`, tupleError);
        }

        // 如果上述方法失败，尝试使用Registry API
        try {
          if (registry && 'createType' in registry) {
            // 构建元组类型字符串，如 "(String, u32)"
            const typeNames = type.tuple_args ? type.tuple_args.map(arg => {
              if (arg.path && arg.path.length > 0) {
                return arg.path.join('::');
              }
              return 'unknown';
            }) : [];

            const tupleTypeStr = `(${typeNames.join(', ')})`;
            console.log(`Creating tuple type via registry: ${tupleTypeStr}`);

            // 使用registry创建元组类型
            const tupleTypeClass = registry.createType(tupleTypeStr);
            return tupleTypeClass;
          }
        } catch (registryError) {
          console.warn(`Failed to create tuple type via registry:`, registryError);
        }
        // 尝试创建模拟的元组类型
        // 创建一个带有数字索引字段的对象来模拟元组
        // 最后一种方法：直接使用基本的getTypeClass尝试
        try {
          console.log('Falling back to direct type class for tuple');
          const directTypeClass = codec.getTypeClass(type);

          // 如果直接方法成功，就使用它
          if (directTypeClass) {
            structTypeClasses[tupleKey] = directTypeClass;
            console.log(`Using direct type class for tuple: Success`);
            return directTypeClass;
          }
        } catch (directError) {
          console.warn(`Direct type class for tuple failed:`, directError);
        }

        // 如果所有方法都失败，尝试创建一个简单的代理类
        console.warn(`Creating simplified proxy class for tuple type`);

        // 定义一个简单的元组代理类
        const SimpleTupleClass = function (registry, value) {
          this._registry = registry;

          // 确保值是数组形式
          if (Array.isArray(value)) {
            this._value = value;
          } else if (typeof value === 'object' && value !== null) {
            // 如果是对象格式，转换为数组
            const arr = [];
            const indices = Object.keys(value)
              .filter(k => !isNaN(parseInt(k)))
              .sort((a, b) => parseInt(a) - parseInt(b));

            for (const idx of indices) {
              arr[parseInt(idx)] = value[idx];
            }
            this._value = arr;
          } else {
            this._value = [];
          }

          // 添加必要的方法
          this.toJSON = function () {
            return this._value;
          };

          this.toHex = function () {
            return '0x' + Buffer.from(JSON.stringify(this._value)).toString('hex');
          };
        };

        // 标记这是一个元组类型
        SimpleTupleClass.kind = 'Tuple';

        structTypeClasses[tupleKey] = SimpleTupleClass;
        return SimpleTupleClass;

        console.warn(`Failed to create type class for tuple type`);
        return null;
      } catch (e) {
        console.error(`Error processing tuple type:`, e);
        return null;
      }
    }
    // Handle array types
    else if (type.kind === 'Array' && type.elem) {
      // 对于数组类型，同样使用标准方法
      console.log(`Using direct codec method for array type`);
      return codec.getTypeClass(type);
    }
    // Handle complex path types (e.g., quote::T)
    else if (type.kind === 'Path' && type.path && type.path.length > 1) {
      // 对于复合路径，首先尝试获取完整路径字符串，例如 "quote::T"
      const fullPathStr = type.path.join('::');
      console.log(`Processing complex path type: ${fullPathStr}`);

      // 首先检查是否有已缓存的类型
      if (structTypeClasses[fullPathStr]) {
        return structTypeClasses[fullPathStr];
      }

      // 尝试使用codec直接处理这些类型
      try {
        const typeClass = codec.getTypeClass(type);
        // 如果成功，缓存结果
        if (typeClass) {
          structTypeClasses[fullPathStr] = typeClass;
        }
        return typeClass;
      } catch (e) {
        console.error(`Failed to get type class for complex path ${fullPathStr}:`, e);
        return null;
      }
    }
    // Handle Vec types with nested elements
    else if (type.kind === 'Path' && type.path && type.path[0] === 'Vec' &&
      type.generic_args && type.generic_args.length > 0) {
      const elemArg = type.generic_args[0];
      if (isNestedType(elemArg)) {
        const elemTypeClass = getNestedTypeClass(elemArg);
        if (elemTypeClass) {
          return codec.getVecClass(elemTypeClass);
        }
      }
      // Fall back to default codec handling
      return codec.getTypeClass(type);
    }

    // Default fallback to codec handling
    return codec.getTypeClass(type);
  } catch (e) {
    console.error(`Error creating typeClass for complex type:`, e, type);
    return null;
  }
}

function getNestedFields(type) {
  // 处理结构体类型
  if (type.kind === 'Path' && type.path && type.path.length === 1) {
    const typeName = type.path[0];
    const structDef = getNestedStructDef(typeName);

    if (!structDef || !structDef.fields) return [];

    return structDef.fields.map(field => ({
      ...field,
      formatType: formatType(field.type),
      typeClass: codec.getTypeClass(field.type)
    }));
  }
  // 处理元组类型
  else if (type.kind === 'Tuple' && type.tuple_args) {
    // 为元组中的每个位置创建字段
    return type.tuple_args.map((argType, index) => ({
      name: index.toString(), // 使用索引作为字段名
      type: argType,
      formatType: formatType(argType),
      typeClass: codec.getTypeClass(argType)
    }));
  }
  // 处理数组类型
  else if (type.kind === 'Array' && type.elem) {
    return [{
      name: 'items',
      type: type.elem,
      formatType: formatType(type.elem),
      typeClass: codec.getTypeClass(type.elem)
    }];
  }

  return [];
}

// 预先注册所有结构体类型，以便嵌套类型可以引用它们
function registerAllStructTypes(data) {
  const normalizedData = Array.isArray(data) ? data : [data];
  const structs = normalizedData.filter(item => item.type === "struct");

  console.log(`Registering ${structs.length} struct types`);

  // 先创建所有结构体的基本类型定义（不包含嵌套类型的详细定义）
  // 这样嵌套类型可以先引用它们
  structs.forEach(struct => {
    // 只为尚未注册的类型创建初始类型类
    if (!structTypeClasses[struct.name]) {
      try {
        // 创建简单字段，不处理嵌套类型
        const basicFields = struct.fields.map(field => {
          // 简单类型直接使用codec获取类型类
          const typeClass = !isNestedType(field.type) ? codec.getTypeClass(field.type) : null;

          return {
            name: field.name,
            type: field.type,
            value: null,
            typeClass
          };
        });

        // 注册基本类型类，即使嵌套类型尚未完全解析
        const basicTypeClass = codec.handleStructType(basicFields);
        structTypeClasses[struct.name] = basicTypeClass;
        console.log(`First-pass registration for ${struct.name}: ${basicTypeClass ? 'Success' : 'Failed'}`);
      } catch (e) {
        console.error(`Error in first-pass registration for ${struct.name}:`, e);
      }
    }
  });

  // 第二步：处理所有结构体，包括嵌套类型
  structs.forEach(struct => {
    try {
      // 为结构体的每个字段获取完整的类型类
      const fields = struct.fields.map(field => {
        let fieldTypeClass = null;

        // 处理嵌套类型
        if (isNestedType(field.type)) {
          // 递归获取嵌套类型
          fieldTypeClass = getNestedTypeClass(field.type);
          console.log("fieldTypeClass", fieldTypeClass, field.type)
          console.log(`Nested field ${struct.name}.${field.name} typeClass: ${fieldTypeClass ? 'Found:' + (fieldTypeClass.name || fieldTypeClass) : 'Not found'}`);
        } else {
          // 基本类型直接获取
          fieldTypeClass = codec.getTypeClass(field.type);
        }

        return {
          name: field.name,
          type: field.type,
          value: null,
          typeClass: fieldTypeClass
        };
      });

      // 更新结构体类型类，现在包含完整的嵌套类型信息
      const updatedTypeClass = codec.handleStructType(fields);
      structTypeClasses[struct.name] = updatedTypeClass;
      console.log(`Second-pass registration for ${struct.name}: ${updatedTypeClass ? 'Success' : 'Failed'}`);
    } catch (e) {
      console.error(`Error in second-pass registration for ${struct.name}:`, e);
    }
  });

  return structs;
}

function processJsonData() {
  try {
    const data = typeof props.jsonData === 'string'
      ? JSON.parse(props.jsonData)
      : props.jsonData;

    // 预先注册所有结构体
    const structs = registerAllStructTypes(data);

    const normalizedData = Array.isArray(data) ? data : [data];

    structures.value = normalizedData
      .filter(item => item.type === "struct")
      .map(item => {
        const fields = item.fields.map(field => {
          // 获取字段类型的类型类
          let typeClass;

          // 处理嵌套类型
          if (isNestedType(field.type)) {
            // 使用我们已经注册的嵌套类型
            typeClass = getNestedTypeClass(field.type);
          } else {
            // 基本类型直接获取
            typeClass = codec.getTypeClass(field.type);
          }

          console.log(`Field ${item.name}.${field.name} typeClass: ${typeClass ? 'Found' : 'Not found'}`);

          return {
            ...field,
            typeClass,
            formatType: formatType(field.type),
            debugValue: '',
            nestedValues: {},
            originalType: field.type
          };
        });

        const fieldLines = fields.map(field => {
          return `   ${field.name}: ${field.formatType},`;
        });

        const formattedCode = `struct ${item.name} {
${fieldLines.join('\n')}
}`;

        // 获取结构体本身的类型类
        let typeClass;
        try {
          if (item.type === 'struct') {
            // 使用缓存的结构体类型
            typeClass = structTypeClasses[item.name];

            // 如果缓存中没有，尝试重新创建
            if (!typeClass) {
              console.log(`Trying to recreate typeClass for ${item.name}`);
              typeClass = codec.handleStructType(fields.map(f => ({
                name: f.name,
                type: f.originalType,
                value: null,
                typeClass: f.typeClass
              })));

              // 将创建的类型缓存
              if (typeClass) {
                structTypeClasses[item.name] = typeClass;
              }
            }

            console.log(`Struct ${item.name} typeClass: ${typeClass ? 'Found' : 'Not found'}`);
          } else if (item.type && typeof item.type === 'object' && item.type.path) {
            typeClass = codec.getTypeClass(item.type);
          }
        } catch (e) {
          console.error(`Error getting typeClass for struct ${item.name}:`, e);
        }

        return {
          name: item.name,
          fields: fields,
          formattedCode: formattedCode,
          typeClass: typeClass,
          debugMode: false,
          debugResult: null
        };
      });

    // For non-struct items
    if (structures.value.length === 0 && normalizedData.length > 0) {
      const nonStructData = normalizedData.map(item => JSON.stringify(item, null, 2)).join('\n\n');
      console.log('Non-struct data:', nonStructData);
    }
  } catch (e) {
    console.error('Failed to process JSON data:', e);
    structures.value = [];
  }
}

function formatType(type) {
  if (!type) return 'unknown';

  if (type.kind === 'Path') {
    const baseName = type.path.join('::');

    if (type.generic_args && type.generic_args.length > 0) {
      const args = type.generic_args.map(arg => formatType(arg)).join(', ');
      return `${baseName}<${args}>`;
    }

    if (['i8', 'i16', 'i32', 'i64', 'i128', 'u8', 'u16', 'u32', 'u64', 'u128'].includes(baseName)) {
      return baseName.charAt(0).toUpperCase() + baseName.substring(1).toUpperCase();
    }

    return baseName;
  }

  if (type.kind === 'Tuple' && type.tuple_args && type.tuple_args.length > 0) {
    const tupleTypes = type.tuple_args.map(arg => formatType(arg)).join(', ');
    return `(${tupleTypes})`;
  }

  if (type.kind === 'Array' && type.elem && type.len !== undefined) {
    const elemType = formatType(type.elem);
    return `[${elemType}; ${type.len}]`;
  }

  return 'unknown';
}

function toggleDebugMode(index) {
  if (index >= 0 && index < structures.value.length) {
    structures.value[index].debugMode = !structures.value[index].debugMode;
    structures.value[index].debugResult = null;
  }
}

function resetValues(index) {
  if (index >= 0 && index < structures.value.length) {
    structures.value[index].fields.forEach(field => {
      field.debugValue = '';
      field.nestedValues = {};
    });
    structures.value[index].debugResult = null;
  }
}

function updateNestedValue(field, key, value) {
  if (!field.nestedValues) {
    field.nestedValues = {};
  }

  field.nestedValues[key] = value;
}

function getPlaceholder(type) {
  if (!type) return 'Enter value';

  const isArray = type.path && type.path[0] === 'Vec';
  const isNumber = ['i8', 'i16', 'i32', 'i64', 'i128', 'u8', 'u16', 'u32', 'u64', 'u128'].some(t =>
    type.path && type.path.includes(t));
  const isTuple = type.path && type.path[0] === '()';
  const isNestedType = type.kind === 'Path' && !isNumber && !isArray && !isTuple &&
    type.path && type.path.length === 1 && type.path[0] !== 'String' &&
    /^[A-Z]/.test(type.path[0]);

  if (isArray) return '1, 2, 3';
  if (isNumber) return '42';
  if (isTuple) return '["value1", "value2"]';
  if (isNestedType) return `{ "field1": "value1", "field2": 42 }`;
  return 'Enter value';
}


function convertValues(structIndex) {
  if (structIndex < 0 || structIndex >= structures.value.length) return;

  const struct = structures.value[structIndex];
  console.log("struct", struct);

  try {
    // 1. 处理字段值
    const processedFields = processStructFields(struct);
    if (!processedFields) return;

    const { inputValue } = processedFields;

    // 2. 处理元组类型
    processTupleFields(inputValue, struct);

    // 3. 创建实例
    const result = createStructInstance(inputValue, struct);
    if (!result) return;

    // 4. 生成结果
    generateResult(result, struct);
  } catch (error) {
    console.error('Error in convertValues:', error);
    struct.debugResult = `Error: ${error.message}`;
  }
}

// 处理结构体字段值
function processStructFields(struct) {
  if (!struct.typeClass) {
    struct.debugResult = "TypeClass not found";
    return null;
  }

  const fields = struct.fields.map(field => {
    // 处理数组类型
    if (field.type.path && field.type.path[0] === 'Vec') {
      return processVecField(field);
    }
    // 处理嵌套类型
    else if (isNestedType(field.type)) {
      return processNestedField(field);
    }
    // 处理元组类型
    else if (field.type.path && field.type.path[0] === '()') {
      return processTupleField(field);
    }
    // 处理简单类型
    else {
      return processSimpleField(field);
    }
  });

  const validFields = fields.filter(field => field !== null);
  const inputValue = Object.fromEntries(validFields);
  console.log("inputValue", inputValue);

  if (Object.keys(inputValue).length === 0) {
    struct.debugResult = "No valid field values provided";
    return null;
  }

  return { inputValue };
}

// 处理Vec类型字段
function processVecField(field) {
  if (!field.debugValue) return null;

  const innerType = field.type.generic_args && field.type.generic_args[0];
  const innerTypeName = innerType && innerType.path ? innerType.path[0] : null;

  const values = field.debugValue.split(',')
    .map(value => {
      const trimmed = value.trim();
      if (!trimmed) return null;

      if (innerTypeName && ['u8', 'u16', 'u32', 'u64', 'u128', 'i8', 'i16', 'i32', 'i64', 'i128'].includes(innerTypeName)) {
        return Number(trimmed);
      }

      return trimmed;
    })
    .filter(v => v !== null);

  return [field.name, values];
}

// 处理嵌套类型字段
function processNestedField(field) {
  const nestedTypeClass = getNestedTypeClass(field.type);
  const nestedTypeName = field.type.path ? field.type.path[0] : null;
  const nestedStructDef = nestedTypeName ? getNestedStructDef(nestedTypeName) : null;

  // 处理嵌套值
  if (Object.keys(field.nestedValues || {}).length > 0) {
    try {
      const processedValues = {};

      // 设置默认值
      if (nestedStructDef && nestedStructDef.fields) {
        nestedStructDef.fields.forEach(nestedField => {
          processedValues[nestedField.name] = '';
        });
      }

      // 填充用户输入的值
      Object.entries(field.nestedValues).forEach(([key, value]) => {
        if (value && !isNaN(Number(value)) && value.trim() !== '') {
          processedValues[key] = Number(value);
        } else if (value && value.trim() !== '') {
          processedValues[key] = value;
        }
      });

      if (Object.keys(processedValues).length === 0) return null;

      // 创建嵌套实例
      if (nestedTypeClass) {
        try {
          let nestedInstance = createNestedInstance(nestedTypeClass, processedValues);
          return nestedInstance ? [field.name, nestedInstance] : [field.name, processedValues];
        } catch (error) {
          console.error(`Failed to create nested instance for ${field.name}:`, error);
          return [field.name, processedValues];
        }
      }

      return [field.name, processedValues];
    } catch (error) {
      console.error('Failed to process nested values:', error);
      return Object.keys(field.nestedValues).length > 0 ? [field.name, field.nestedValues] : null;
    }
  }
  // 处理调试值
  else if (field.debugValue) {
    try {
      const parsedValue = JSON.parse(field.debugValue);

      if (nestedTypeClass) {
        try {
          const nestedInstance = new nestedTypeClass(registry, parsedValue);
          return [field.name, nestedInstance];
        } catch (error) {
          console.error('Failed to create nested instance from JSON:', error);
          return [field.name, parsedValue];
        }
      }

      return [field.name, parsedValue];
    } catch (error) {
      console.error('Failed to parse nested JSON:', error);
      return field.debugValue.trim() ? [field.name, field.debugValue] : null;
    }
  }

  return null;
}

// 创建嵌套实例
function createNestedInstance(typeClass, values) {
  if (typeof typeClass === 'function') {
    if (typeClass.kind === 'Tuple') {
      // 元组类型
      const tupleArray = [];
      const tupleSize = Object.keys(values).length;

      for (let i = 0; i < tupleSize; i++) {
        const key = i.toString();
        if (key in values) {
          tupleArray[i] = values[key];
        }
      }

      return new typeClass(registry, tupleArray);
    } else {
      // 普通类型
      return new typeClass(registry, values);
    }
  } else if (typeof typeClass === 'object' && typeClass !== null) {
    // 对象类型
    if (typeof typeClass.create === 'function') {
      return typeClass.create(values);
    } else if (typeof typeClass.construct === 'function') {
      return typeClass.construct(values);
    } else if (typeof typeClass.clone === 'function') {
      const instance = typeClass.clone();
      return Object.assign(instance, values);
    } else {
      return { ...typeClass, ...values };
    }
  }

  return values;
}
// 处理简单类型字段
function processSimpleField(field) {
  if (!field.debugValue || !field.debugValue.trim()) return null;

  // 转换数字
  if (!isNaN(Number(field.debugValue)) &&
    field.type.path &&
    ['u8', 'u16', 'u32', 'u64', 'u128', 'i8', 'i16', 'i32', 'i64', 'i128'].includes(field.type.path[0])) {
    return [field.name, Number(field.debugValue)];
  }

  return [field.name, field.debugValue];
}

// 处理元组类型字段
function processTupleFields(inputValue, struct) {
  for (const key in inputValue) {
    const field = struct.fields.find(f => f.name === key);

    const isTuple = field && (
      (field.type.path && field.type.path[0] === '()') ||
      (field.type.kind === 'Tuple') ||
      (field.formatType && field.formatType.includes('(') && field.formatType.includes(')') &&
        !field.formatType.includes('Vec') && !field.formatType.startsWith('fn'))
    );

    if (isTuple) {
      processTupleField(inputValue, key, field);
    }
    else if (field && field.type && field.type.kind === 'Tuple') {
      createTupleInstance(inputValue, key, field);
    }
  }
}

// 处理元组字段
function processTupleField(inputValue, key, field) {
  try {
    const value = inputValue[key];
    let tupleArray;

    // 标准化元组值为数组
    if (typeof value === 'string') {
      if (value.trim().startsWith('[')) {
        tupleArray = JSON.parse(value);
      } else {
        tupleArray = value.split(',').map(v => v.trim());
      }
    } else if (typeof value === 'object') {
      if (Array.isArray(value)) {
        tupleArray = [...value];
      } else {
        // 对象转数组
        tupleArray = [];
        const indices = Object.keys(value)
          .filter(k => !isNaN(parseInt(k)))
          .sort((a, b) => parseInt(a) - parseInt(b));

        for (const idx of indices) {
          tupleArray[parseInt(idx)] = value[idx];
        }
      }
    } else {
      tupleArray = [];
    }

    // 确保元组值格式正确
    const tupleSize = field.type.tuple_args ? field.type.tuple_args.length : 0;

    // 处理元组项类型
    for (let i = 0; i < tupleSize; i++) {
      if (i >= tupleArray.length) tupleArray.push('');

      const argType = field.type.tuple_args && field.type.tuple_args[i];
      if (!argType) continue;

      // 类型转换
      if (typeof tupleArray[i] === 'string') {
        const strValue = tupleArray[i].trim();

        // 数字类型
        if (!isNaN(Number(strValue)) && argType.path &&
          ['u8', 'u16', 'u32', 'u64', 'u128', 'i8', 'i16', 'i32', 'i64', 'i128'].includes(argType.path[0])) {
          tupleArray[i] = Number(strValue);
        }
        // 布尔类型
        else if (['true', 'false'].includes(strValue.toLowerCase()) &&
          argType.path && argType.path[0] === 'bool') {
          tupleArray[i] = strValue.toLowerCase() === 'true';
        }
      }
    }

    // 空元组处理
    if (tupleArray.every(item => item === '' || item === undefined || item === null)) {
      const defaultValues = [];
      for (let i = 0; i < tupleSize; i++) {
        const argType = field.type.tuple_args && field.type.tuple_args[i];
        if (argType && argType.path) {
          const typeName = argType.path[0];
          if (['u8', 'u16', 'u32', 'u64', 'u128', 'i8', 'i16', 'i32', 'i64', 'i128'].includes(typeName)) {
            defaultValues.push(0);
          } else if (typeName === 'String') {
            defaultValues.push('');
          } else if (typeName === 'bool') {
            defaultValues.push(false);
          } else {
            defaultValues.push(null);
          }
        } else {
          defaultValues.push(null);
        }
      }
      tupleArray = defaultValues;
    }

    inputValue[key] = tupleArray;
    console.log(`Processed tuple field ${key}:`, tupleArray);
  } catch (error) {
    console.error(`Failed to process tuple field ${key}:`, error);
  }
}

// 创建元组实例
function createTupleInstance(inputValue, key, field) {
  try {
    const tupleValues = inputValue[key];
    const tupleType = field.type;

    // 获取元组类型字符串
    const tupleTypeStr = tupleType.tuple_args
      ? tupleType.tuple_args.map(arg => {
        if (arg.path) return arg.path.join('::');
        return 'unknown';
      }).join(', ')
      : '';

    if (!registry.createType) return;

    try {
      // 尝试创建元组实例
      inputValue[key] = registry.createType(`(${tupleTypeStr})`, tupleValues);
      console.log(`Successfully created tuple instance for ${key}`);
    } catch (error) {
      console.warn(`Failed to create tuple using standard method: ${error.message}`);

      // 备选方法
      try {
        const valuesStr = Array.isArray(tupleValues)
          ? tupleValues.map(v => {
            if (v === '') return '""';
            if (v === null || v === undefined) return 'null';
            return v;
          }).join(', ')
          : '';

        // 格式化字符串
        const formattedValues = Array.isArray(tupleValues) ? [...tupleValues] : [];
        for (let i = 0; i < formattedValues.length; i++) {
          const argType = tupleType.tuple_args && tupleType.tuple_args[i];
          if (argType && argType.path && argType.path[0] === 'String' &&
            typeof formattedValues[i] === 'string' &&
            !formattedValues[i].startsWith('"') && !formattedValues[i].endsWith('"')) {
            formattedValues[i] = `"${formattedValues[i]}"`;
          }
        }

        // 尝试多种方法创建元组
        let tupleInstance;
        try {
          tupleInstance = registry.createType(`(${tupleTypeStr})`, `(${valuesStr})`);
        } catch (err1) {
          try {
            tupleInstance = registry.createType(`(${tupleTypeStr})`, formattedValues);
          } catch (err2) {
            try {
              const TupleClass = registry.findMetaType(`(${tupleTypeStr})`);
              if (TupleClass) {
                tupleInstance = new TupleClass(registry, formattedValues);
              } else {
                throw new Error('Could not find tuple type class');
              }
            } catch (err3) {
              throw new Error(`All tuple creation methods failed`);
            }
          }
        }

        inputValue[key] = tupleInstance;
      } catch (formatError) {
        console.error(`All tuple creation methods failed for ${key}:`, formatError);
      }
    }
  } catch (error) {
    console.error(`Failed to pre-process tuple field ${key}:`, error);
  }
}

// 创建结构体实例
function createStructInstance(inputValue, struct) {
  let result;
  let lastError = null;

  // 尝试多种方法创建实例
  try {
    // 方法1: 构造函数
    result = new struct.typeClass(registry, inputValue);
  } catch (e1) {
    lastError = e1;

    try {
      // 方法2: registry.createType
      if (registry && typeof registry.createType === 'function') {
        result = registry.createType(struct.name, inputValue);
      } else {
        throw new Error('Registry createType not available');
      }
    } catch (e2) {
      lastError = e2;

      try {
        // 方法3: 简化输入（无元组）
        const simplifiedInput = { ...inputValue };

        // 移除元组字段
        for (const key in simplifiedInput) {
          const field = struct.fields.find(f => f.name === key);
          if (field && field.type && field.type.kind === 'Tuple') {
            delete simplifiedInput[key];
          }
        }

        if (Object.keys(simplifiedInput).length > 0) {
          result = new struct.typeClass(registry, simplifiedInput);

          // 单独处理元组字段
          for (const key in inputValue) {
            const field = struct.fields.find(f => f.name === key);
            if (field && field.type && field.type.kind === 'Tuple') {
              try {
                result[key] = inputValue[key];
              } catch (error) {
                console.warn(`Could not set tuple field ${key} after creation:`, error);
              }
            }
          }
        } else {
          throw new Error('No non-tuple fields available');
        }
      } catch (e3) {
        lastError = e3;

        try {
          // 方法4: JSON字符串
          const jsonStr = JSON.stringify(inputValue);
          if (registry && typeof registry.createType === 'function') {
            result = registry.createType(struct.name, jsonStr);
          } else {
            throw new Error('Registry createType not available');
          }
        } catch (e4) {
          lastError = e4;

          try {
            // 方法5: 空对象手动填充
            const emptyObj = new struct.typeClass(registry, {});

            for (const [k, v] of Object.entries(inputValue)) {
              try {
                emptyObj[k] = v;
              } catch (e) {
                console.warn(`Could not set field ${k}:`, e);
              }
            }

            result = emptyObj;
          } catch (e5) {
            lastError = e5;
            struct.debugResult = `All creation attempts failed. Last error: ${lastError.message}`;
            return null;
          }
        }
      }
    }
  }

  return result;
}

// 生成结果
function generateResult(result, struct) {
  try {
    let hexResult = "[Error converting to hex]";
    let jsonResult = "[Error converting to JSON]";

    try {
      hexResult = result.toHex();
    } catch (error) {
      console.error('Error converting to hex:', error);
    }

    try {
      jsonResult = JSON.stringify(result.toJSON(), null, 2);
    } catch (error) {
      console.error('Error converting to JSON:', error);
    }

    struct.debugResult = `toHex: ${hexResult}\ntoJSON: ${jsonResult}`;
  } catch (error) {
    console.error('Error creating or processing instance:', error);
    struct.debugResult = `Error processing instance: ${error.message}`;
  }
}
</script>

<style scoped>
.json-struct-viewer {
  width: 100%;
}
</style>
