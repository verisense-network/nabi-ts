<template>
  <div class="json-struct-viewer">
    <pre v-if="formattedData">{{ formattedData }}</pre>
    <div v-else class="placeholder">
      <p>无数据可展示</p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';

const props = defineProps({
  jsonData: {
    type: [Object, Array, String],
    required: true
  }
});

const formattedData = computed(() => {
  try {
    const data = typeof props.jsonData === 'string'
      ? JSON.parse(props.jsonData)
      : props.jsonData;

    const normalizedData = Array.isArray(data) ? data : [data];

    return normalizedData.map(item => {
      if (item.type === "struct") {
        const fieldLines = item.fields.map(field => {
          let typeStr = formatType(field.type);
          return `   ${field.name}: ${typeStr},`;
        });

        return `struct ${item.name} {\n${fieldLines.join('\n')}\n}`;
      }
      return JSON.stringify(item, null, 2);
    }).join('\n\n');
  } catch (e) {
    console.error('解析JSON数据失败:', e);
    return null;
  }
});

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
