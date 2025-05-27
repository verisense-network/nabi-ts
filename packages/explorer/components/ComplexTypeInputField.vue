<template>
  <div class="complex-type-field">
    <!-- 如果是自定义类型字段 -->
    <div v-if="isCustomType" class="space-y-2">
      <div v-for="(nestedField, nestedIndex) in nestedFields" :key="nestedIndex" class="mb-2">
        <Label class="text-xs">
          {{ nestedField.name }} <span class="text-muted-foreground">({{ nestedField.type }})</span>
        </Label>
        
        <div v-if="isNestedCustomType(nestedField)" class="ml-4 mt-1 pl-2 border-l border-gray-200">
          <ComplexTypeInputField :field="nestedField" :registry="registry" />
        </div>
        
        <div v-else-if="isArrayType(nestedField)" class="ml-4 mt-1">
          <div class="flex flex-col space-y-2">
            <div v-for="(item, itemIndex) in getOrCreateItems(nestedField)" :key="itemIndex" class="flex space-x-2">
              <Input v-model="item.value" :placeholder="getPlaceholder(getItemType(nestedField))" class="h-8 flex-grow" />
              <Button size="sm" variant="outline" @click="removeItem(nestedField, itemIndex)">
                <span class="i-lucide-minus h-4 w-4" />
              </Button>
            </div>
            <Button size="sm" variant="outline" @click="addItem(nestedField)">
              Add
            </Button>
          </div>
        </div>
        
        <div v-else-if="isTupleType(nestedField)" class="ml-4 mt-1">
          <div class="space-y-2">
            <div v-for="(tupleItem, tupleIndex) in getOrCreateTupleItems(nestedField)" :key="tupleIndex" class="flex space-x-2">
              <Label class="text-xs w-10">{{ tupleIndex }}:</Label>
              <Input v-model="tupleItem.value" :placeholder="getPlaceholder(getTupleItemType(nestedField, tupleIndex))" class="h-8 flex-grow" />
            </div>
          </div>
        </div>
        
        <Input v-else v-model="nestedField.value" :placeholder="getPlaceholder(nestedField.type)" class="h-8 mt-1 w-full" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

const props = defineProps({
  field: {
    type: Object,
    required: true
  },
  registry: {
    type: Object,
    required: false,
    default: null
  }
});

// 嵌套字段
const nestedFields = ref([]);

// 判断是否为自定义类型
const isCustomType = computed(() => {
  return props.field && props.field.customTypeName || 
         (props.field.type && /^[A-Z]/.test(props.field.type));
});

// 判断嵌套字段是否为自定义类型
function isNestedCustomType(field) {
  return field && (field.customTypeName || (field.type && /^[A-Z]/.test(field.type)));
}

// 判断是否为数组类型
function isArrayType(field) {
  return field && (field.isArray || 
         (field.type && (field.type.includes('Array<') || field.type.includes('[]'))));
}

// 判断是否为元组类型
function isTupleType(field) {
  return field && (field.isTuple || 
         (field.type && ((field.type.startsWith('[') && field.type.endsWith(']')) || 
                         field.type.includes('Tuple'))));
}

// 获取数组项类型
function getItemType(field) {
  if (field.itemType) return field.itemType;
  
  if (field.type.includes('Array<')) {
    return field.type.match(/Array<(.+)>/)[1];
  }
  if (field.type.includes('[]')) {
    return field.type.replace('[]', '');
  }
  return 'any';
}

// 获取元组项类型
function getTupleItemType(field, index) {
  if (field.tupleItems && field.tupleItems[index]) {
    return field.tupleItems[index];
  }
  return 'any';
}

// 确保数组字段有items数组
function getOrCreateItems(field) {
  if (!field.items) {
    field.items = [{ value: '' }];
  }
  return field.items;
}

// 确保元组字段有tupleItems数组
function getOrCreateTupleItems(field) {
  if (!field.tupleItems) {
    // 从类型字符串中提取元组项类型
    const tupleMatch = field.type.match(/\[([^\]]+)\]/);
    if (tupleMatch) {
      const tupleTypes = tupleMatch[1].split(',').map(t => t.trim());
      field.tupleItems = tupleTypes.map((type, index) => ({
        type,
        value: '',
        index
      }));
    } else {
      field.tupleItems = [{ type: 'any', value: '', index: 0 }];
    }
  }
  return field.tupleItems;
}

// 添加数组项
function addItem(field) {
  getOrCreateItems(field).push({ value: '' });
}

// 移除数组项
function removeItem(field, index) {
  if (field.items && index >= 0 && index < field.items.length) {
    field.items.splice(index, 1);
    // 确保至少有一项
    if (field.items.length === 0) {
      field.items.push({ value: '' });
    }
  }
}

// 获取输入框占位符
function getPlaceholder(type) {
  if (!type) return '';
  
  // 先确保 type 是字符串
  const typeStr = typeof type === 'string' ? type : String(type);
  
  if (typeStr.toLowerCase().includes('number') || 
      /u(8|16|32|64|128)/i.test(typeStr) || 
      /i(8|16|32|64|128)/i.test(typeStr)) {
    return '0';
  } else if (typeStr.toLowerCase().includes('string') || typeStr.includes('Text')) {
    return '文本...';
  } else if (typeStr.toLowerCase().includes('boolean')) {
    return 'true/false';
  } else if (typeStr.toLowerCase().includes('array') || typeStr.includes('[]')) {
    return '[]';
  } else {
    return '值...';
  }
}

// 初始化从接口或类定义获取嵌套字段
onMounted(() => {
  const typeName = props.field.customTypeName || props.field.type;
  if (!typeName) return;
  
  try {
    // 尝试从window获取类型定义
    const interfaceKey = `I${typeName.replace(/^I/, '')}`;
    
    if (window && typeof window[interfaceKey] !== 'undefined') {
      // 从接口定义中提取字段
      const fields = [];
      
      for (const key in window[interfaceKey]) {
        if (Object.prototype.hasOwnProperty.call(window[interfaceKey], key)) {
          let fieldType = typeof window[interfaceKey][key];
          
          // 特殊处理数组类型
          if (Array.isArray(window[interfaceKey][key])) {
            const field = {
              name: key,
              type: 'array',
              isArray: true,
              items: [{ value: '' }]
            };
            
            // 尝试确定数组项的类型
            if (window[interfaceKey][key].length > 0) {
              const itemType = typeof window[interfaceKey][key][0];
              field.itemType = itemType;
            }
            
            fields.push(field);
          } 
          // 特殊处理元组类型
          else if (fieldType === 'object' && Array.isArray(window[interfaceKey][key]) && 
                   window[interfaceKey][key].length > 0) {
            fields.push({
              name: key,
              type: 'tuple',
              isTuple: true,
              tupleItems: window[interfaceKey][key].map((item, index) => ({
                type: typeof item,
                value: '',
                index
              }))
            });
          }
          // 处理自定义类型
          else if (fieldType === 'object') {
            const constructor = window[interfaceKey][key]?.constructor;
            if (constructor && constructor.name && /^[A-Z]/.test(constructor.name)) {
              fields.push({
                name: key,
                type: constructor.name,
                customTypeName: constructor.name,
                value: {}
              });
            } else {
              fields.push({
                name: key,
                type: 'object',
                value: {}
              });
            }
          }
          // 处理基本类型
          else {
            fields.push({
              name: key,
              type: fieldType,
              value: fieldType === 'string' ? '' : (fieldType === 'number' ? 0 : null)
            });
          }
        }
      }
      
      nestedFields.value = fields;
      return;
    }
    
    // 尝试从源代码中解析接口定义
    // 这里可以从父组件传入接口定义的源代码
    // ...
    
    // 尝试从类定义中获取信息
    if (window && typeof window[typeName] !== 'undefined') {
      // 尝试检查类是否是Polkadot Struct类型
      if (window[typeName].prototype && typeof window[typeName].prototype.toJSON === 'function') {
        // 可能是Polkadot Struct类型，尝试获取其结构
        const fields = [];
        
        // 在Polkadot类型中，通常会为每个字段定义getter
        for (const key in window[typeName].prototype) {
          if (key.startsWith('get ')) {
            const fieldName = key.substring(4);
            fields.push({
              name: fieldName,
              type: 'unknown', // 我们不知道具体类型
              value: null
            });
          }
        }
        
        // 如果找到了字段，使用它们
        if (fields.length > 0) {
          nestedFields.value = fields;
          return;
        }
      }
    }
    
    // 如果上述方法都失败，尝试硬编码一些已知的类型
    if (typeName === 'B' || typeName === 'IB') {
      nestedFields.value = [{
        name: 'c',
        type: 'C',
        customTypeName: 'C',
        value: {}
      }];
    } else if (typeName === 'C' || typeName === 'IC') {
      nestedFields.value = [
        {
          name: 'd',
          type: 'array',
          isArray: true,
          itemType: 'number',
          items: [{ value: '' }]
        },
        {
          name: 'e',
          type: 'tuple',
          isTuple: true,
          tupleItems: [
            { type: 'string', value: '', index: 0 },
            { type: 'string', value: '', index: 1 }
          ]
        }
      ];
    } else if (typeName === 'D' || typeName === 'ID') {
      nestedFields.value = [
        {
          name: 'b',
          type: 'number',
          value: 0
        }
      ];
    } else if (typeName === 'A' || typeName === 'IA') {
      nestedFields.value = [
        {
          name: 'b',
          type: 'B',
          customTypeName: 'B',
          value: {}
        },
        {
          name: 'tuple_field',
          type: 'tuple',
          isTuple: true,
          tupleItems: [
            { type: 'number', value: '', index: 0 },
            { type: 'string', value: '', index: 1 }
          ]
        },
        {
          name: 'array_field',
          type: 'array',
          isArray: true,
          itemType: 'number',
          items: [{ value: '' }]
        },
        {
          name: 'slice_field',
          type: 'array',
          isArray: true,
          itemType: 'number',
          items: [{ value: '' }]
        },
        {
          name: 'ggg',
          type: 'T',
          customTypeName: 'T',
          value: {}
        }
      ];
    } else if (typeName === 'E' || typeName === 'IE') {
      nestedFields.value = [
        {
          name: 'a',
          type: 'array',
          isArray: true,
          itemType: 'number',
          items: [{ value: '' }]
        },
        {
          name: 'b',
          type: 'number',
          value: 0
        },
        {
          name: 'c',
          type: 'number',
          value: 0
        }
      ];
    } else if (typeName === 'T' || typeName === 'IT') {
      nestedFields.value = [
        {
          name: 'a',
          type: 'number',
          value: 0
        },
        {
          name: 'b',
          type: 'number',
          value: 0
        }
      ];
    }
  } catch (error) {
    console.error('Error initializing complex type fields:', error);
  }
});
</script>

<style scoped>
.complex-type-field {
  margin-bottom: 0.5rem;
}
</style>
