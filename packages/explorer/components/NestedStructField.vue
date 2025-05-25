<template>
  <div class="nested-struct-field">
    <Label class="text-xs font-medium">
      {{ field.name }} <span class="text-muted-foreground">({{ field.type }})</span>
    </Label>

    <!-- Nested Struct Field -->
    <div v-if="field.isStruct" class="ml-4 mt-2 pl-2 border-l border-gray-200 space-y-2">
      <div class="text-xs text-muted-foreground mb-2">{{ field.referencedStructName }} fields:</div>
      <div v-for="(nestedField, nestedIndex) in field.nestedFields" :key="nestedIndex" class="mb-3">
        <!-- Recursively render nested fields -->
        <NestedStructField :field="nestedField" />
      </div>
    </div>

    <!-- Vec Field -->
    <div v-else-if="field.isVec" class="mt-2">
      <div class="flex flex-col space-y-2">
        <div v-for="(item, itemIndex) in field.items" :key="itemIndex" class="flex space-x-2">
          <Input v-model="item.value" :placeholder="getPlaceholderForType(field.itemType)" class="h-8 flex-grow" />
          <Button variant="outline" size="icon" class="h-8 w-8" @click="removeVecItem(field, itemIndex)">
            <span class="sr-only">Remove</span>
            <XIcon class="h-4 w-4" />
          </Button>
        </div>
        <Button variant="outline" size="sm" class="w-full mt-1" @click="addVecItem(field)">
          Add Item
        </Button>
      </div>
    </div>

    <!-- Tuple Field -->
    <div v-else-if="field.isTuple" class="mt-2">
      <div class="space-y-2">
        <div v-for="(tupleItem, tupleIndex) in field.tupleItems" :key="tupleIndex" class="flex space-x-2">
          <Label class="text-xs w-10">{{ tupleIndex }}:</Label>
          <Input v-model="tupleItem.value" :placeholder="getPlaceholderForType(tupleItem.type)" class="h-8 flex-grow" />
        </div>
      </div>
    </div>

    <!-- Option Field -->
    <div v-else-if="field.isOption" class="mt-2">
      <div class="flex items-center space-x-2 mb-2">
        <Checkbox v-model="field.hasValue" :id="`field-has-value-${field.name}`" />
        <Label :for="`field-has-value-${field.name}`" class="text-xs">Has Value</Label>
      </div>
      <div v-if="field.hasValue">
        <Input v-model="field.value" :placeholder="getPlaceholderForType(field.valueType)" class="h-8 w-full" />
      </div>
    </div>

    <!-- Basic Field -->
    <div v-else class="mt-1">
      <Input v-model="field.value" :placeholder="getPlaceholderForType(field.type)" class="h-8 w-full" />
    </div>
  </div>
</template>

<script setup>
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { XIcon } from 'lucide-vue-next';

const props = defineProps({
  field: {
    type: Object,
    required: true
  }
});

// Import helper functions from parent
const getPlaceholderForType = (type) => {
  if (!type) return '';
  
  if (type.includes('u8') || type.includes('u16') || type.includes('u32') ||
    type.includes('u64') || type.includes('u128') || type.includes('i8') ||
    type.includes('i16') || type.includes('i32') || type.includes('i64') ||
    type.includes('i128')) {
    return '0';
  } else if (type.includes('bool')) {
    return 'true/false';
  } else if (type.includes('str') || type.includes('String') || type.includes('Text')) {
    return 'text...';
  } else if (type.includes('Vec<') || type.match(/\[.*?;.*?\]/)) {
    return '[]';
  } else if (type.includes('Compact')) {
    return '0';
  } else if (type.includes('Option')) {
    return 'value...';
  } else if (type.includes('Tuple') || (type.startsWith('(') && type.endsWith(')'))) {
    return '(...)';
  } else if (type.includes('H256') || type.includes('Hash')) {
    return '0x...';
  } else if (type.includes('AccountId')) {
    return '5...';
  } else if (type.includes('Balance')) {
    return '1000000000000';
  } else {
    return 'value...';
  }
};

// Add item to Vec field
function addVecItem(field) {
  if (field && field.items) {
    field.items.push({ value: '' });
  }
}

// Remove item from Vec field
function removeVecItem(field, index) {
  if (field && field.items && index >= 0 && index < field.items.length) {
    field.items.splice(index, 1);
    // Ensure there's always at least one item
    if (field.items.length === 0) {
      field.items.push({ value: '' });
    }
  }
}
</script>

<style scoped>
.nested-struct-field {
  margin-bottom: 0.5rem;
}
</style>
