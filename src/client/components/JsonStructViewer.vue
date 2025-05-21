<template>
  <div class="json-struct-viewer">
    <div v-if="structures.length > 0" class="space-y-6">
      <Card v-for="(struct, index) in structures" :key="index" class="struct-container">
        <CardHeader>
          <div class="flex justify-between items-center">
            <CardTitle>struct {{ struct.name }}</CardTitle>
            <Button variant="outline" size="sm" @click="toggleDebugMode(index)">
              {{ struct.debugMode ? '退出调试' : '调试模式' }}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div class="grid" :class="{ 'grid-cols-1': !struct.debugMode, 'grid-cols-2 gap-4': struct.debugMode }">
            <!-- 结构体定义 -->
            <div class="struct-code">
              <pre class="bg-muted p-3 rounded whitespace-pre-wrap text-sm">{{ struct.formattedCode }}</pre>
            </div>

            <!-- 调试面板 -->
            <div v-if="struct.debugMode" class="debug-panel border-l pl-4">
              <h4 class="text-sm font-medium mb-2">调试数值</h4>
              <div class="space-y-3">
                <div v-for="(field, fieldIndex) in struct.fields" :key="fieldIndex" class="field-input">
                  <Label class="text-xs">
                    {{ field.name }} <span class="text-muted-foreground">({{ field.typeDisplay }})</span>
                  </Label>
                  <Input v-model="field.debugValue" :placeholder="getPlaceholder(field.type)" class="h-8 mt-1" />
                </div>

                <div class="pt-2 flex flex-col space-y-2">
                  <Button variant="outline" size="sm" @click="convertValues(index)">
                    转为十六进制
                  </Button>
                  <Button variant="outline" size="sm" @click="resetValues(index)">
                    重置数值
                  </Button>
                </div>

                <div v-if="struct.debugResult" class="mt-3">
                  <Label class="text-xs">结果:</Label>
                  <pre class="bg-muted p-2 rounded text-xs mt-1">{{ struct.debugResult }}</pre>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
    <div v-else class="flex justify-center items-center h-32 border border-dashed rounded-md bg-muted/20">
      <p class="text-muted-foreground">无数据显示</p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, reactive, watch } from 'vue';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TypeRegistry } from '@polkadot/types';
import * as codecTypes from '@polkadot/types-codec';
import { hexToU8a, isHex, u8aToHex } from '@polkadot/util';

const registry = new TypeRegistry();

const TYPE_MAP = {
  'u8': 'U8',
  'u16': 'U16',
  'u32': 'U32',
  'u64': 'U64',
  'u128': 'U128',
  'i8': 'I8',
  'i16': 'I16',
  'i32': 'I32',
  'i64': 'I64',
  'i128': 'I128',
  'bool': 'Bool',
  'Text': 'Text',
  'str': 'Text',
  'Bytes': 'Bytes',
  'byte': 'Bytes',
  'Vec': 'Vec',
  'Option': 'Option'
};

const props = defineProps({
  jsonData: {
    type: [Object, Array, String],
    required: true
  }
});

// Process structures for advanced display and debugging
const structures = ref([]);

// Watch for changes in jsonData
watch(() => props.jsonData, processJsonData, { immediate: true });

function processJsonData() {
  try {
    const data = typeof props.jsonData === 'string'
      ? JSON.parse(props.jsonData)
      : props.jsonData;

    const normalizedData = Array.isArray(data) ? data : [data];

    // Process each struct
    structures.value = normalizedData
      .filter(item => item.type === "struct")
      .map(item => {
        // Process fields for display and debugging
        const fields = item.fields.map(field => {
          return {
            ...field,
            typeDisplay: formatType(field.type),
            debugValue: '',
            originalType: field.type // Keep original type info for conversions
          };
        });

        // Format code display
        const fieldLines = fields.map(field => {
          return `   ${field.name}: ${field.typeDisplay},`;
        });

        const formattedCode = `struct ${item.name} {
${fieldLines.join('\n')}
}`;

        return {
          name: item.name,
          fields: fields,
          formattedCode: formattedCode,
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

// Format type for display
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

  return 'unknown';
}

// Toggle debug mode for a structure
function toggleDebugMode(index) {
  if (index >= 0 && index < structures.value.length) {
    structures.value[index].debugMode = !structures.value[index].debugMode;
    // Reset debug result when toggling
    structures.value[index].debugResult = null;
  }
}

// Reset debug values
function resetValues(index) {
  if (index >= 0 && index < structures.value.length) {
    structures.value[index].fields.forEach(field => {
      field.debugValue = '';
    });
    structures.value[index].debugResult = null;
  }
}

// Get placeholder based on type
function getPlaceholder(type) {
  if (!type) return 'Enter value';

  const isArray = type.path && type.path[0] === 'Vec';
  const isNumber = ['i8', 'i16', 'i32', 'i64', 'i128', 'u8', 'u16', 'u32', 'u64', 'u128'].some(t =>
    type.path && type.path.includes(t));

  if (isArray) return '[1, 2, 3]';
  if (isNumber) return '42';
  return 'Enter value';
}


function convertValues(structIndex) {
  if (structIndex < 0 || structIndex >= structures.value.length) return;

  const struct = structures.value[structIndex];
  const result = {};

  try {
    struct.fields.forEach(field => {
      if (!field.debugValue) return;

      const typeName = field.originalType.path ? field.originalType.path[0] : 'unknown';
      const innerTypePath = field.originalType.generic_args && field.originalType.generic_args[0]?.path;
      const innerType = innerTypePath ? innerTypePath[0] : null;

      let value = field.debugValue.trim();

      try {
        const TypeClass = codecTypes[TYPE_MAP[typeName]];

        if (!TypeClass) {
          result[field.name] = value;
          return;
        }
        if (typeName === 'Vec') {
          handleVecType(field.name, value, innerType, result);
        } else if (typeName === 'Option') {
          handleOptionType(field.name, value, innerType, result);
        } else {
          result.typeClass = TypeClass;
          result.hex = new TypeClass(registry, value).toHex();
          result[field.name] = new TypeClass(registry, value).toJSON();
        }
      } catch (e) {
        console.error(`Error converting field ${field.name}:`, e);
        result[field.name] = `Error: ${e.message}`;
      }
    });

    console.log("result", result);

    struct.debugResult = JSON.stringify(result, null, 2);
  } catch (e) {
    console.error('Error during conversion:', e);
    struct.debugResult = `Error: ${e.message}`;
  }
}

// 处理Vec类型
function handleVecType(fieldName, value, innerType, result) {
  try {
    // 格式化输入
    if (!value.startsWith('[')) {
      value = '[' + value + ']';
    }
    value = value.replace(/'/g, '"');

    const parsed = JSON.parse(value);

    // Vec<u8>特殊处理
    if (innerType === 'u8') {
      if (Array.isArray(parsed)) {
        const bytesArray = new Uint8Array(parsed);
        result[fieldName] = u8aToHex(bytesArray);
      } else {
        const bytes = new codecTypes.Bytes(registry, parsed);
        result[fieldName] = bytes.toHex();
      }
      return;
    }

    // 其他Vec类型
    const InnerTypeClass = codecTypes[TYPE_MAP[innerType]];
    if (InnerTypeClass) {
      const vec = new codecTypes.Vec(registry, InnerTypeClass, parsed);
      result[fieldName] = vec.toJSON();
    } else {
      result[fieldName] = parsed;
    }
  } catch (e) {
    throw new Error(`Vec parsing error: ${e.message}`);
  }
}

function handleOptionType(fieldName, value, innerType, result) {
  if (value === 'None' || value === 'null' || value === '') {
    result[fieldName] = null;
    return;
  }

  if (value.startsWith('Some(') && value.endsWith(')')) {
    value = value.slice(5, -1).trim();
  }

  const InnerTypeClass = codecTypes[TYPE_MAP[innerType]];
  if (InnerTypeClass) {
    const option = new codecTypes.Option(registry, InnerTypeClass, value);
    result[fieldName] = option.toJSON();
  } else {
    result[fieldName] = value;
  }
}

</script>

<style scoped>
.json-struct-viewer {
  width: 100%;
}

pre {
  width: 100%;
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 1rem;
  font-family: "Courier New", monospace;
  font-size: 14px;
  background-color: #f8f8f8;
  overflow: auto;
  max-height: 400px;
  margin: 0;
  white-space: pre-wrap;
  box-sizing: border-box;
}

.placeholder {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 200px;
  background-color: #f8f8f8;
  border: 1px dashed #ddd;
  border-radius: 4px;
  color: #999;
}
</style>
