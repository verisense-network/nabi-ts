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

  // 确保不是基本类型或泛型类型
  const isVec = type.kind === 'Path' && type.path && type.path[0] === 'Vec';
  const isBasicType = ['String', 'u8', 'u16', 'u32', 'u64', 'u128', 'i8', 'i16', 'i32', 'i64', 'i128']
    .some(t => type.path && type.path.includes(t));

  return type.kind === 'Path' &&
    type.path &&
    type.path.length === 1 &&
    /^[A-Z]/.test(type.path[0]) &&
    !isVec &&
    !isBasicType;
}

function getNestedStructDef(typeName) {
  const data = typeof props.jsonData === 'string' ? JSON.parse(props.jsonData) : props.jsonData;
  const normalizedData = Array.isArray(data) ? data : [data];

  return normalizedData.find(item =>
    item.type === 'struct' && item.name === typeName
  );
}

function getNestedTypeClass(type) {
  if (!type || !type.path || !type.path[0]) return null;

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

  try {
    // Create field objects for the struct
    const fields = structDef.fields.map(field => {
      let fieldTypeClass = null;

      // 处理嵌套结构体字段
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
  } catch (e) {
    console.error(`Error creating typeClass for ${typeName}:`, e);
    return null;
  }
}

function getNestedFields(type) {
  if (!isNestedType(type) || !type.path || !type.path[0]) return [];

  const typeName = type.path[0];
  const structDef = getNestedStructDef(typeName);

  if (!structDef || !structDef.fields) return [];

  return structDef.fields.map(field => ({
    ...field,
    formatType: formatType(field.type),
    typeClass: codec.getTypeClass(field.type)
  }));
}

// 预先注册所有结构体类型，以便嵌套类型可以引用它们
function registerAllStructTypes(data) {
  const normalizedData = Array.isArray(data) ? data : [data];
  const structs = normalizedData.filter(item => item.type === "struct");

  console.log(`Registering ${structs.length} struct types`);

  // 第一步：预处理所有字段类型
  structs.forEach(struct => {
    const fields = struct.fields.map(field => {
      const typeClass = codec.getTypeClass(field.type);
      return {
        name: field.name,
        type: field.type,
        value: null,
        typeClass
      };
    });

    // 第二步：使用 handleStructType 创建结构体类型
    try {
      const typeClass = codec.handleStructType(fields);
      structTypeClasses[struct.name] = typeClass;
      console.log(`Pre-registered struct ${struct.name}: ${typeClass ? 'Success' : 'Failed'}`);
    } catch (e) {
      console.error(`Error pre-registering struct ${struct.name}:`, e);
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
          const typeClass = codec.getTypeClass(field.type);
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
  const isNestedType = type.kind === 'Path' && !isNumber && !isArray &&
    type.path && type.path.length === 1 && type.path[0] !== 'String' &&
    /^[A-Z]/.test(type.path[0]);

  if (isArray) return '1, 2, 3';
  if (isNumber) return '42';
  if (isNestedType) return `{ "field1": "value1", "field2": 42 }`;
  return 'Enter value';
}


function convertValues(structIndex) {
  if (structIndex < 0 || structIndex >= structures.value.length) return;

  try {
    const struct = structures.value[structIndex];
    console.log("struct", struct);

    const fields = struct.fields
      .map(field => {
        if (field.type.path && field.type.path[0] === 'Vec') {
          if (!field.debugValue) return null;

          const innerType = field.type.generic_args && field.type.generic_args[0];
          const innerTypeName = innerType && innerType.path ? innerType.path[0] : null;

          const values = field.debugValue.split(',').map(value => {
            const trimmed = value.trim();
            if (!trimmed) return null;

            if (innerTypeName && ['u8', 'u16', 'u32', 'u64', 'u128', 'i8', 'i16', 'i32', 'i64', 'i128'].includes(innerTypeName)) {
              return Number(trimmed);
            }

            return trimmed;
          }).filter(v => v !== null);

          return [field.name, values];
        } else if (isNestedType(field.type)) {
          // 先获取嵌套类型的typeClass
          const nestedTypeClass = getNestedTypeClass(field.type);
          console.log(`Field ${field.name} typeClass: ${nestedTypeClass ? 'Found' : 'Not found'}`);

          if (Object.keys(field.nestedValues || {}).length > 0) {
            try {
              const processedValues = {};
              Object.entries(field.nestedValues).forEach(([key, value]) => {
                if (value && !isNaN(Number(value)) && value.trim() !== '') {
                  processedValues[key] = Number(value);
                } else if (value) {
                  processedValues[key] = value;
                }
              });

              if (Object.keys(processedValues).length > 0) {
                if (nestedTypeClass) {
                  try {
                    // 确保传入的值是对象形式
                    if (typeof processedValues === 'object' && processedValues !== null) {
                      const nestedInstance = new nestedTypeClass(registry, processedValues);
                      // 验证创建的实例有效
                      if (nestedInstance && typeof nestedInstance === 'object') {
                        return [field.name, nestedInstance];
                      }
                    }
                    // 如果未能成功创建实例，返回原始值
                    console.log(`Using raw values for ${field.name}:`, processedValues);
                    return [field.name, processedValues];
                  } catch (nestedError) {
                    console.error(`Failed to create instance for ${field.name}:`, nestedError);
                    // 返回原始值
                    return [field.name, processedValues];
                  }
                } else {
                  // 没有typeClass但有值，返回原始值
                  return [field.name, processedValues];
                }
              }
            } catch (e) {
              console.error('Failed to process nested struct values:', e);
              if (Object.keys(field.nestedValues).length > 0) {
                return [field.name, field.nestedValues];
              }
            }
          } else if (field.debugValue) {
            try {
              const parsedValue = JSON.parse(field.debugValue);
              const nestedTypeClass = getNestedTypeClass(field.type);

              if (nestedTypeClass) {
                try {
                  const nestedInstance = new nestedTypeClass(registry, parsedValue);
                  return [field.name, nestedInstance];
                } catch (e) {
                  console.error('Failed to create nested struct instance from JSON:', e);
                  return [field.name, parsedValue];
                }
              } else {
                return [field.name, parsedValue];
              }
            } catch (e) {
              console.error('Failed to parse nested struct JSON:', e);
              if (field.debugValue.trim()) {
                return [field.name, field.debugValue];
              }
            }
          }
          return null;
        } else {
          // 简单类型只有有值时才返回
          if (field.debugValue && field.debugValue.trim()) {
            // 尝试转换数字
            if (!isNaN(Number(field.debugValue)) && field.type.path &&
              ['u8', 'u16', 'u32', 'u64', 'u128', 'i8', 'i16', 'i32', 'i64', 'i128']
                .includes(field.type.path[0])) {
              return [field.name, Number(field.debugValue)];
            }
            return [field.name, field.debugValue];
          }
          return null;
        }
      });

    const validFields = fields.filter(field => field !== null);

    const inputValue = Object.fromEntries(validFields);

    console.log("inputValue", inputValue);

    if (!struct.typeClass) {
      struct.debugResult = "TypeClass not found";
      return;
    }

    // 检查inputValue是否为空对象
    if (Object.keys(inputValue).length === 0) {
      struct.debugResult = "No valid field values provided";
      return;
    }

    // 使用安全的方法创建和转换结构体实例
    let result;
    try {
      // 首先验证所有嵌套值是否有效
      for (const [key, value] of Object.entries(inputValue)) {
        // 如果值是对象但可能缺少必要属性，尝试确保它是安全的
        if (value && typeof value === 'object' && !(value instanceof Uint8Array)) {
          // 将嵌套对象转换为简单的JSON对象
          try {
            inputValue[key] = JSON.parse(JSON.stringify(value));
          } catch (e) {
            console.warn(`Could not stringify nested object for ${key}:`, e);
          }
        }
      }
      console.log('Sanitized inputValue:', inputValue);
      result = new struct.typeClass(registry, inputValue);
    } catch (initError) {
      console.error('Error creating struct instance:', initError);
      struct.debugResult = `Error creating instance: ${initError.message}`;
      return;
    }

    // 检查 result 是否有效
    if (!result) {
      struct.debugResult = "Failed to create instance";
      return;
    }

    try {
      // 使用 try-catch 分别处理 toHex 和 toJSON
      let hexResult = "[Error converting to hex]";
      let jsonResult = "[Error converting to JSON]";

      try {
        hexResult = result.toHex();
      } catch (hexError) {
        console.error('Error converting to hex:', hexError);
      }

      try {
        jsonResult = JSON.stringify(result.toJSON(), null, 2);
      } catch (jsonError) {
        console.error('Error converting to JSON:', jsonError);
      }

      struct.debugResult = `toHex: ${hexResult}
toJSON: ${jsonResult}`;
    } catch (innerError) {
      console.error('Error creating or processing instance:', innerError);
      struct.debugResult = `Error processing instance: ${innerError.message}`;
    }
  } catch (e) {
    console.error('Error during conversion:', e);
    structures.value[structIndex].debugResult = `Error: ${e.message}`;
  }
}
</script>

<style scoped>
.json-struct-viewer {
  width: 100%;
}
</style>
