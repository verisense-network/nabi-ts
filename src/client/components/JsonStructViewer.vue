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
                  <Input v-model="field.debugValue" :placeholder="getPlaceholder(field.type)" class="h-8 mt-1" />
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

const props = defineProps({
  jsonData: {
    type: [Object, Array, String],
    required: true
  }
});

const structures = ref([]);

watch(() => props.jsonData, processJsonData, { immediate: true });

function processJsonData() {
  try {
    const data = typeof props.jsonData === 'string'
      ? JSON.parse(props.jsonData)
      : props.jsonData;

    const normalizedData = Array.isArray(data) ? data : [data];

    structures.value = normalizedData
      .filter(item => item.type === "struct")
      .map(item => {
        const fields = item.fields.map(field => {
          const typeClass = codec.getTypeClass(field.type);

          return {
            ...field,
            typeClass,
            formatType: formatType(field.type),
            debugValue: '',
            originalType: field.type
          };
        });

        const fieldLines = fields.map(field => {
          return `   ${field.name}: ${field.formatType},`;
        });

        const formattedCode = `struct ${item.name} {
${fieldLines.join('\n')}
}`;

        let typeClass;
        if (item.type === 'struct') {
          typeClass = codec.handleStructType(fields);
        } else if (item.type && typeof item.type === 'object' && item.type.path) {
          typeClass = codec.getTypeClass(item.type.path[0]);
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
    });
    structures.value[index].debugResult = null;
  }
}

function getPlaceholder(type) {
  if (!type) return 'Enter value';

  const isArray = type.path && type.path[0] === 'Vec';
  const isNumber = ['i8', 'i16', 'i32', 'i64', 'i128', 'u8', 'u16', 'u32', 'u64', 'u128'].some(t =>
    type.path && type.path.includes(t));

  if (isArray) return '1, 2, 3';
  if (isNumber) return '42';
  return 'Enter value';
}


function convertValues(structIndex) {
  if (structIndex < 0 || structIndex >= structures.value.length) return;

  const struct = structures.value[structIndex];

  try {
    console.log("struct", struct);

    const fields = struct.fields
      .filter(field => field.debugValue)
      .map(field => {
        if (!field.debugValue) return null;

        if (field.type.path && field.type.path[0] === 'Vec') {
          const innerType = field.type.generic_args && field.type.generic_args[0];
          const innerTypeName = innerType && innerType.path ? innerType.path[0] : null;

          const values = field.debugValue.split(',').map(value => {
            const trimmed = value.trim();

            if (innerTypeName && ['u8', 'u16', 'u32', 'u64', 'u128', 'i8', 'i16', 'i32', 'i64', 'i128'].includes(innerTypeName)) {
              return Number(trimmed);
            }

            return trimmed;
          });

          return [field.name, values];
        } else {
          return [field.name, field.debugValue];
        }
      });

    const inputValue = Object.fromEntries(fields);

    console.log("inputValue", inputValue);

    if (!struct.typeClass) {
      struct.debugResult = "TypeClass not found";
      return;
    }

    const result = new struct.typeClass(registry, inputValue);

    struct.debugResult = `toHex: ${result.toHex()}
toJSON: ${JSON.stringify(result.toJSON(), null, 2)}`;
  } catch (e) {
    console.error('Error during conversion:', e);
    struct.debugResult = `Error: ${e.message}`;
  }
}
</script>

<style scoped>
.json-struct-viewer {
  width: 100%;
}
</style>
