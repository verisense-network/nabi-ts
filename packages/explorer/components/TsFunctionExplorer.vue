<template>
  <div class="ts-function-explorer">

    <!-- Display extracted Polkadot codec classes if any -->
    <div v-if="extractedClasses.length > 0" class="mb-6">
      <Card>
        <CardHeader>
          <CardTitle>Polkadot Codec Types</CardTitle>
        </CardHeader>
        <CardContent>
          <div class="grid grid-cols-1 gap-4">
            <div v-for="(classInfo, index) in extractedClasses" :key="index" class="border rounded-md p-3 bg-muted/30">
              <div class="flex justify-between items-center mb-2">
                <h3 class="text-sm font-medium">{{ classInfo.name }} <span class="text-xs text-muted-foreground">({{
                    classInfo.type }})</span></h3>
                <Button variant="outline" size="sm" @click="toggleDebugMode(index)">
                  {{ classInfo.debugMode ? 'Hide Debug' : 'Debug' }}
                </Button>
              </div>
              <pre class="bg-muted p-2 rounded text-xs whitespace-pre-wrap">{{ classInfo.definition }}</pre>

              <!-- Debug Interface -->
              <div v-if="classInfo.debugMode" class="mt-4 border-t pt-3">
                <h4 class="text-sm font-medium mb-2">Debug Interface</h4>

                <!-- Struct Type Debug Interface -->
                <div v-if="classInfo.type === 'Struct'" class="space-y-3">
                  <div v-for="(field, fieldIndex) in classInfo.fields" :key="fieldIndex" class="ml-2 mb-4">
                    <!-- Use the recursive NestedStructField component for all fields -->
                    <NestedStructField :field="field" />
                  </div>

                  <Button variant="outline" size="sm" class="mt-3" @click="debugCodecType(index)">
                    Debug
                  </Button>

                  <div v-if="classInfo.debugResult" class="mt-3">
                    <Label class="text-xs">Debug Result:</Label>
                    <pre
                      class="bg-muted p-2 rounded text-xs mt-1 whitespace-pre-wrap">{{ classInfo.debugResult }}</pre>
                  </div>
                </div>

                <!-- Enum Type Debug Interface -->
                <div v-else-if="classInfo.type === 'Enum'" class="space-y-3">
                  <div class="space-y-2">
                    <Label class="text-xs">Variant</Label>
                    <Select v-model="classInfo.selectedVariant">
                      <SelectTrigger class="w-full">
                        <SelectValue placeholder="Select a variant" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem v-for="(variant, variantIndex) in classInfo.variants" :key="variantIndex"
                          :value="variant.name">
                          {{ variant.name }}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div v-if="getSelectedVariant(classInfo)?.hasValue" class="space-y-2 mt-3">
                    <Label class="text-xs">Value <span class="text-muted-foreground">({{
                      getSelectedVariant(classInfo)?.type }})</span></Label>
                    <Input v-model="getSelectedVariant(classInfo).value"
                      :placeholder="getPlaceholderForType(getSelectedVariant(classInfo)?.type)" class="h-8 w-full" />
                  </div>

                  <Button variant="outline" size="sm" class="mt-3" @click="createEnumInstance(index)">
                    Create Instance
                  </Button>

                  <div v-if="classInfo.debugResult" class="mt-3">
                    <Label class="text-xs">Instance:</Label>
                    <pre
                      class="bg-muted p-2 rounded text-xs mt-1 whitespace-pre-wrap">{{ classInfo.debugResult }}</pre>
                  </div>
                </div>

                <!-- U8aFixed Type Debug Interface -->
                <div v-else-if="classInfo.type === 'U8aFixed'" class="space-y-3">
                  <div class="space-y-2">
                    <Label class="text-xs">Value (hex string or byte array)</Label>
                    <Input v-model="classInfo.debugValue"
                      placeholder="0x1234abcd... or [18, 52, 171, 205, ...]" class="h-8 w-full" />
                    <div class="text-xs text-muted-foreground">
                      Enter as hex string (0x...) or comma-separated bytes
                    </div>
                  </div>

                  <Button variant="outline" size="sm" class="mt-3" @click="createU8aFixedInstance(index)">
                    Create Instance
                  </Button>

                  <div v-if="classInfo.debugResult" class="mt-3">
                    <Label class="text-xs">Instance:</Label>
                    <pre
                      class="bg-muted p-2 rounded text-xs mt-1 whitespace-pre-wrap">{{ classInfo.debugResult }}</pre>
                  </div>
                </div>

                <!-- Type Alias Debug Interface -->
                <div v-else-if="classInfo.type === 'TypeAlias'" class="space-y-3">
                  <div class="space-y-2">
                    <Label class="text-xs">Value <span class="text-muted-foreground">({{ classInfo.baseType }})</span></Label>
                    <Input v-model="classInfo.debugValue"
                      :placeholder="getPlaceholderForType(classInfo.baseType)" class="h-8 w-full" />
                  </div>

                  <Button variant="outline" size="sm" class="mt-3" @click="createTypeAliasInstance(index)">
                    Create Instance
                  </Button>

                  <div v-if="classInfo.debugResult" class="mt-3">
                    <Label class="text-xs">Instance:</Label>
                    <pre
                      class="bg-muted p-2 rounded text-xs mt-1 whitespace-pre-wrap">{{ classInfo.debugResult }}</pre>
                  </div>
                </div>

                <!-- VecFixed Type Debug Interface -->
                <div v-else-if="classInfo.type === 'VecFixed'" class="space-y-3">
                  <div class="space-y-2">
                    <Label class="text-xs">Values ({{ classInfo.length }} items of {{ classInfo.itemType }})</Label>
                    <div class="space-y-2">
                      <div v-for="i in classInfo.length" :key="i" class="flex space-x-2">
                        <Label class="text-xs w-8">{{ i-1 }}:</Label>
                        <Input v-model="classInfo.vecValues[i-1]"
                          :placeholder="getPlaceholderForType(classInfo.itemType)" class="h-8 flex-grow" />
                      </div>
                    </div>
                  </div>

                  <Button variant="outline" size="sm" class="mt-3" @click="createVecFixedInstance(index)">
                    Create Instance
                  </Button>

                  <div v-if="classInfo.debugResult" class="mt-3">
                    <Label class="text-xs">Instance:</Label>
                    <pre
                      class="bg-muted p-2 rounded text-xs mt-1 whitespace-pre-wrap">{{ classInfo.debugResult }}</pre>
                  </div>
                </div>

                <!-- Other Types Debug Interface -->
                <div v-else class="space-y-3">
                  <div class="space-y-2">
                    <Label class="text-xs">Value</Label>
                    <Input v-model="classInfo.debugValue"
                      :placeholder="getPlaceholderForType(classInfo.valueType || 'string')" class="h-8 w-full" />
                  </div>

                  <Button variant="outline" size="sm" class="mt-3" @click="createOtherTypeInstance(index)">
                    Create Instance
                  </Button>

                  <div v-if="classInfo.debugResult" class="mt-3">
                    <Label class="text-xs">Instance:</Label>
                    <pre
                      class="bg-muted p-2 rounded text-xs mt-1 whitespace-pre-wrap">{{ classInfo.debugResult }}</pre>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>

    <Card class="api-init-panel mb-6">
      <CardHeader>
        <div class="flex justify-between items-center">
          <CardTitle>API initialization</CardTitle>
          <div class="flex space-x-2">
            <Badge v-if="apiInitialized" variant="success">Connected</Badge>
            <Badge v-else variant="destructive">Disconnected</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div class="space-y-4">
          <div>
            <Label>Endpoint</Label>
            <Input v-model="apiEndpoint" placeholder="http://localhost:9944" class="mt-1" />
          </div>

          <div class="flex space-x-2 mt-4">
            <Button @click="initializeApi" :disabled="apiInitializing">
              {{ apiInitializing ? 'Connecting...' : apiInitialized ? 'Connected' : 'Connect' }}
            </Button>
          </div>

          <div v-if="apiError" class="text-red-500 text-sm mt-2">
            {{ apiError }}
          </div>
        </div>
      </CardContent>
    </Card>

    <div v-if="functions.length > 0" class="space-y-6">
      <Card v-for="(func, index) in functions" :key="index" class="func-container">
        <CardHeader>
          <div class="flex justify-between items-center">
            <CardTitle>function {{ func.name }}</CardTitle>
            <Button variant="outline" size="sm" @click="toggleExecuteMode(index)">
              {{ func.executeMode ? 'Return' : 'Execute' }}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div class="grid" :class="{ 'grid-cols-1': !func.executeMode, 'grid-cols-2 gap-4': func.executeMode }">
            <div class="func-code">
              <pre class="bg-muted p-3 rounded whitespace-pre-wrap text-sm">{{ func.formattedCode }}</pre>
            </div>

            <div v-if="func.executeMode" class="execute-panel border-l pl-4">
              <h4 class="text-sm font-medium mb-2">Input Parameters</h4>
              <div class="space-y-3">
                <div v-for="(param, paramIndex) in func.params" :key="paramIndex" class="param-input">
                  <Label class="text-xs font-medium">
                    {{ param.name }} <span class="text-muted-foreground">({{ param.type === 'complex' ? param.complexType : param.type }})</span>
                  </Label>

                  <div v-if="param.type === 'complex'" class="ml-4 mt-2 pl-2 border-l border-gray-200 space-y-2">
                    <div v-for="(field, fieldIndex) in param.fields" :key="fieldIndex" class="mb-3">
                      <div class="flex items-center">
                        <Label class="text-xs">
                          {{ field.name }} <span class="text-muted-foreground">({{ field.type }})</span>
                        </Label>
                      </div>
                      
                      <div v-if="isCustomTypeField(field)" class="ml-4 mt-1 pl-2 border-l border-gray-200 space-y-2">
                        <ComplexTypeInputField :field="field" :registry="registry" />
                      </div>
                      
                      <div v-else-if="isArrayField(field)" class="ml-4 mt-1">
                        <!-- 检查是否是固定长度数组 -->
                        <div v-if="field.type.match(/\[([^;]+);\s*(\d+)\]/)" class="space-y-2">
                          <div class="text-xs text-muted-foreground">
                            固定长度数组 ({{ field.type.match(/\[([^;]+);\s*(\d+)\]/)[2] }} 项)
                            <span v-if="field.type.includes('[u8;')">
                              - 可输入十六进制字符串 (如: 0x1234...) 或单个数字
                            </span>
                          </div>
                          <div class="flex flex-col space-y-2">
                            <div v-for="(item, itemIndex) in getOrCreateFieldItems(field)" :key="itemIndex" class="flex space-x-2">
                              <Input v-model="item.value" :placeholder="getPlaceholder(getArrayItemType(field))" class="h-8 flex-grow" />
                              <Button size="sm" variant="outline" @click="removeComplexArrayItem(field, itemIndex)">
                                <span class="i-lucide-minus h-4 w-4" />
                              </Button>
                            </div>
                            <Button size="sm" variant="outline" @click="addComplexArrayItem(field)">
                              Add
                            </Button>
                          </div>
                        </div>
                        <!-- 动态长度数组 -->
                        <div v-else class="flex flex-col space-y-2">
                          <div v-for="(item, itemIndex) in getOrCreateFieldItems(field)" :key="itemIndex" class="flex space-x-2">
                            <Input v-model="item.value" :placeholder="getPlaceholder(getArrayItemType(field))" class="h-8 flex-grow" />
                            <Button size="sm" variant="outline" @click="removeComplexArrayItem(field, itemIndex)">
                              <span class="i-lucide-minus h-4 w-4" />
                            </Button>
                          </div>
                          <Button size="sm" variant="outline" @click="addComplexArrayItem(field)">
                            Add
                          </Button>
                        </div>
                      </div>
                      
                      <div v-else-if="isTupleField(field)" class="ml-4 mt-1">
                        <div class="space-y-2">
                          <div v-for="(tupleItem, tupleIndex) in getOrCreateTupleItems(field)" :key="tupleIndex" class="flex space-x-2">
                            <Label class="text-xs w-10">{{ tupleIndex }}:</Label>
                            <Input v-model="tupleItem.value" :placeholder="getPlaceholder(getTupleItemType(field, tupleIndex))" class="h-8 flex-grow" />
                          </div>
                        </div>
                      </div>
                      
                      <Input v-else v-model="field.value" :placeholder="getPlaceholder(field.type)" class="h-8 mt-1 w-full" />
                    </div>
                  </div>

                  <div v-else-if="isObjectType(param.type)" class="ml-4 mt-2 pl-2 border-l border-gray-200 space-y-2">
                    <div v-for="(prop, propIndex) in param.properties" :key="propIndex">
                      <Label class="text-xs">
                        {{ prop.name }} <span class="text-muted-foreground">({{ prop.type }})</span>
                      </Label>
                      <Input v-model="prop.value" :placeholder="getPlaceholder(prop.type)" class="h-8 mt-1 w-full" />
                    </div>
                  </div>

                  <div v-else-if="isArrayType(param.type)">
                    <div class="flex flex-col space-y-2 mt-2">
                      <div v-for="(item, itemIndex) in param.items" :key="itemIndex" class="flex space-x-2">
                        <Input v-model="item.value" :placeholder="getPlaceholder(param.itemType)"
                          class="h-8 flex-grow" />
                        <Button size="sm" variant="outline" @click="removeArrayItem(param, itemIndex)">
                          <span class="i-lucide-minus h-4 w-4" />
                        </Button>
                      </div>
                      <Button size="sm" variant="outline" @click="addArrayItem(param)">
                        Add
                      </Button>
                    </div>
                  </div>
                  
                  <!-- 元组类型参数 -->
                  <div v-else-if="param.type === 'tuple'" class="mt-2">
                    <div class="space-y-2">
                      <div v-for="(tupleType, tupleIndex) in param.tupleTypes" :key="tupleIndex" class="flex space-x-2">
                        <Label class="text-xs w-10">{{ tupleIndex }}:</Label>
                        <Input v-model="param.tupleValues[tupleIndex]" :placeholder="getPlaceholder(tupleType)" class="h-8 flex-grow" />
                      </div>
                    </div>
                  </div>

                  <!-- 基本类型参数 -->
                  <Input v-else v-model="param.value" :placeholder="getPlaceholder(param.type)" class="h-8 mt-1" />
                </div>

                <div class="pt-2 flex flex-col space-y-2">
                  <Button variant="outline" size="sm" @click="executeFunction(index)">
                    Execute
                  </Button>
                  <Button variant="outline" size="sm" @click="resetParams(index)">
                    Reset
                  </Button>
                </div>

                <div v-if="func.result" class="mt-3">
                  <Label class="text-xs">Result:</Label>
                  <pre class="bg-muted p-2 rounded text-xs mt-1 whitespace-pre-wrap">{{ func.result }}</pre>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
    <div v-else class="flex justify-center items-center h-32 border border-dashed rounded-md bg-muted/20">
      <p class="text-muted-foreground">No available functions</p>
    </div>
  </div>
</template>

<script setup>
// 全局变量用于存储用户输入的代码
let storedInterfaceCode = '';

import { ref, watch, computed } from 'vue';
import ComplexTypeInputField from './ComplexTypeInputField.vue';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TypeRegistry } from '@polkadot/types';
import * as codecTypes from '@polkadot/types-codec';
import { transform } from 'sucrase';
import { ApiPromise, HttpProvider } from '@polkadot/api';
import { XIcon } from 'lucide-vue-next';
import NestedStructField from './NestedStructField.vue';

const props = defineProps({
  codeString: {
    type: String,
    required: true
  }
});

const apiEndpoint = ref('http://127.0.0.1:9944');
const apiInitialized = ref(false);
const apiInitializing = ref(false);
const functions = ref([]);
const extractedClasses = ref([]);
const apiError = ref('');
const api = ref(null);
const apiModule = ref(null);

watch(() => props.codeString, processCodeString, { immediate: true });

window.registry = new TypeRegistry();

const apiNamespace = `__api_${Date.now()}`;

async function initializeApi() {
  try {
    apiInitializing.value = true;
    apiError.value = '';

    const code = props.codeString;
    if (!code) {
      throw new Error('No code available');
    }

    window[apiNamespace] = {
      registry: window.registry
    };

    window[apiNamespace].initApi = async function (endpoint) {
      console.log(`connect to API: ${endpoint}`);
      const provider = new HttpProvider(endpoint);
      return await ApiPromise.create({
        provider,
        registry: window[apiNamespace].registry
      });
    };

    const functionNames = functions.value.map(f => f.name).filter(name => name);
    console.log('Available functions:', functionNames);

    functionNames.forEach(funcName => {
      if (funcName !== 'initApi') {
        window[apiNamespace][funcName] = async function (...args) {
          console.log(`[调用] 函数 ${funcName} 参数:`, args);
          try {
            if (!api.value) {
              throw new Error('API未初始化，请先调用initApi');
            }

            if (typeof api.value[funcName] === 'function') {
              return await api.value[funcName](...args);
            }
            else if (api.value.query && typeof api.value.query[funcName] === 'function') {
              return await api.value.query[funcName](...args);
            }
            else if (api.value.tx && typeof api.value.tx[funcName] === 'function') {
              return await api.value.tx[funcName](...args);
            }
            else if (api.value.rpc && api.value.rpc[funcName]) {
              if (typeof api.value.rpc[funcName] === 'function') {
                return await api.value.rpc[funcName](...args);
              } else {
                for (const subspace in api.value.rpc[funcName]) {
                  if (typeof api.value.rpc[funcName][subspace] === 'function') {
                    return await api.value.rpc[funcName][subspace](...args);
                  }
                }
              }
            }

            throw new Error(`Function ${funcName} not found in API`);
          } catch (error) {
            console.error(`Error calling function ${funcName}:`, error);
            throw error;
          }
        };
      }
    });

    apiModule.value = {
      default: window[apiNamespace]
    };
    api.value = await window[apiNamespace].initApi(apiEndpoint.value);
    window[apiNamespace].api = api.value;
    apiInitialized.value = true;
  } catch (error) {
    console.error('API initialization error:', error);
    apiError.value = `API initialization error: ${error.message}`;
    apiInitialized.value = false;
  } finally {
    apiInitializing.value = false;
  }
}

function processCodeString() {
  try {
    functions.value = [];
    extractedClasses.value = [];

    const code = props.codeString;
    if (!code || typeof code !== 'string') return;
    
    // Define codec types in the global scope
    window.Text = codecTypes.Text;
    window.Registry = codecTypes.Registry;
    window.u8 = codecTypes.u8;
    window.u16 = codecTypes.u16;
    window.u32 = codecTypes.u32;
    window.u64 = codecTypes.u64;
    window.u128 = codecTypes.u128;
    window.i8 = codecTypes.i8;
    window.i16 = codecTypes.i16;
    window.i32 = codecTypes.i32;
    window.i64 = codecTypes.i64;
    window.i128 = codecTypes.i128;
    window.bool = codecTypes.bool;
    window.Bytes = codecTypes.Bytes;
    window.Null = codecTypes.Null;
    window.U8 = codecTypes.U8;
    window.U16 = codecTypes.U16;
    window.U32 = codecTypes.U32;
    window.U64 = codecTypes.U64;
    window.U128 = codecTypes.U128;
    window.I8 = codecTypes.I8;
    window.I16 = codecTypes.I16;
    window.I32 = codecTypes.I32;
    window.I64 = codecTypes.I64;
    window.I128 = codecTypes.I128;
    window.VecFixed = codecTypes.VecFixed;
    window.U8aFixed = codecTypes.U8aFixed;

    window.Bool = codecTypes.Bool;
    window.Bytes = codecTypes.Bytes;
    window.Null = codecTypes.Null;
    window.Struct = codecTypes.Struct;
    window.Option = codecTypes.Option;
    window.Result = codecTypes.Result;
    window.Vec = codecTypes.Vec;
    window.Tuple = codecTypes.Tuple;
    window.Enum = codecTypes.Enum;
    
    // Extract and define Polkadot codec classes
    extractedClasses.value = extractAndDefineClasses(code);

    // Extract all functions
    extractAllFunctions(code);

    processReferencedStructs(extractedClasses.value);
  } catch (error) {
    console.error('Error parsing code:', error);
  }
}

// Extract and define classes, with special handling for Polkadot codec types
function extractAndDefineClasses(code) {
  if (!code || typeof code !== 'string') return [];

  console.log('Attempting to extract and define classes...');
  const extractedClasses = [];
  
  // Extract type aliases and constants (export const H160 = U8aFixed.with(...))
  extractTypeAliasesAndConstants(code, extractedClasses);
  
  // Extract standalone struct definitions (struct A { ... })
  extractStructDefinitions(code, extractedClasses);
  
  // Extract class definitions (export class A extends Struct { ... })
  extractClassDefinitions(code, extractedClasses);

  console.log("extractedClasses", extractedClasses);
  
  return extractedClasses;
}

// Extract type aliases and constants
function extractTypeAliasesAndConstants(code, extractedClasses) {
  console.log('Extracting type aliases and constants...');
  
  // Pattern 1: export const TypeName = U8aFixed.with(bitLength as U8aBitLength);
  const u8aFixedRegex = /export\s+const\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*U8aFixed\.with\s*\(\s*(\d+)\s*(?:as\s+U8aBitLength)?\s*\)\s*;/g;
  let match;
  
  while ((match = u8aFixedRegex.exec(code)) !== null) {
    const typeName = match[1];
    const bitLength = parseInt(match[2]);
    const byteLength = Math.ceil(bitLength / 8);
    
    console.log(`Found U8aFixed type: ${typeName} with ${bitLength} bits (${byteLength} bytes)`);
    
    // Define in global scope
    window[typeName] = codecTypes.U8aFixed.with(bitLength);
    
    // Add to extracted classes for display
    extractedClasses.push({
      name: typeName,
      type: 'U8aFixed',
      definition: `[u8; ${byteLength}] // ${bitLength} bits`,
      debugMode: false,
      valueType: 'u8',
      debugValue: '',
      debugResult: null
    });
  }
  
  // Pattern 2: export const TypeName = ExistingType;
  const typeAliasRegex = /export\s+const\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\s*;/g;
  
  while ((match = typeAliasRegex.exec(code)) !== null) {
    const aliasName = match[1];
    const baseTypeName = match[2];
    
    console.log(`Found type alias: ${aliasName} = ${baseTypeName}`);
    
    // Check if base type exists in window
    if (window[baseTypeName]) {
      window[aliasName] = window[baseTypeName];
      console.log(`Defined type alias ${aliasName} -> ${baseTypeName}`);
      
      // Add to extracted classes for display
      extractedClasses.push({
        name: aliasName,
        type: 'TypeAlias',
        definition: `type ${aliasName} = ${baseTypeName}`,
        debugMode: false,
        baseType: baseTypeName,
        debugValue: '',
        debugResult: null
      });
    } else {
      // Try to resolve common Polkadot types
      let resolvedType = null;
      
      switch (baseTypeName) {
        case 'U32':
          resolvedType = codecTypes.U32;
          break;
        case 'U64':
          resolvedType = codecTypes.U64;
          break;
        case 'U128':
          resolvedType = codecTypes.U128;
          break;
        case 'U16':
          resolvedType = codecTypes.U16;
          break;
        case 'U8':
          resolvedType = codecTypes.U8;
          break;
        case 'I32':
          resolvedType = codecTypes.I32;
          break;
        case 'I64':
          resolvedType = codecTypes.I64;
          break;
        case 'I128':
          resolvedType = codecTypes.I128;
          break;
        case 'Bool':
          resolvedType = codecTypes.Bool;
          break;
        case 'Text':
          resolvedType = codecTypes.Text;
          break;
        default:
          console.warn(`Unknown base type: ${baseTypeName} for alias ${aliasName}`);
      }
      
      if (resolvedType) {
        window[aliasName] = resolvedType;
        console.log(`Defined type alias ${aliasName} -> ${baseTypeName} (resolved)`);
        
        // Add to extracted classes for display
        extractedClasses.push({
          name: aliasName,
          type: 'TypeAlias',
          definition: `type ${aliasName} = ${baseTypeName}`,
          debugMode: false,
          baseType: baseTypeName,
          debugValue: '',
          debugResult: null
        });
      }
    }
  }
  
  // Pattern 3: export const TypeName = VecFixed.with(Type, length);
  const vecFixedRegex = /export\s+const\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*VecFixed\.with\s*\(\s*([^,]+)\s*,\s*([^)]+)\s*\)\s*;/g;
  
  while ((match = vecFixedRegex.exec(code)) !== null) {
    const typeName = match[1];
    const itemType = match[2].trim();
    const length = match[3].trim();
    
    console.log(`Found VecFixed type: ${typeName} = VecFixed<${itemType}, ${length}>`);
    
    // Try to resolve the item type
    let resolvedItemType = window[itemType];
    if (!resolvedItemType) {
      // Try common types
      switch (itemType) {
        case 'u8': resolvedItemType = codecTypes.u8; break;
        case 'u16': resolvedItemType = codecTypes.u16; break;
        case 'u32': resolvedItemType = codecTypes.u32; break;
        case 'u64': resolvedItemType = codecTypes.u64; break;
        default: resolvedItemType = codecTypes.u8; // fallback
      }
    }
    
    if (resolvedItemType) {
      window[typeName] = codecTypes.VecFixed.with(resolvedItemType, parseInt(length) || 1);
      
      // Add to extracted classes for display
      extractedClasses.push({
        name: typeName,
        type: 'VecFixed',
        definition: `[${itemType}; ${length}]`,
        debugMode: false,
        itemType: itemType,
        length: parseInt(length) || 1,
        vecValues: new Array(parseInt(length) || 1).fill(''),
        debugValue: '',
        debugResult: null
      });
    }
  }
}

// Extract standalone struct definitions
function extractStructDefinitions(code, extractedClasses) {
  const structRegex = /\bstruct\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*{([^}]*)}/g;
  let structMatch;
  
  while ((structMatch = structRegex.exec(code)) !== null) {
    const structName = structMatch[1];
    const structContent = structMatch[2];
    console.log(`Found struct definition: ${structName}`);
    
    // Parse the struct fields
    const fields = parseStructFields(structContent);
    
    // Add the struct to extractedClasses
    extractedClasses.push({
      name: structName,
      type: 'Struct',
      formattedTypeDef: `struct ${structName} { ... }`,
      fields: fields,
      debugResult: ''
    });
    
    // Define the struct in the global scope
    defineStructInGlobalScope(structName, fields);
  }
}

// Parse struct fields from struct content
function parseStructFields(structContent) {
  const fields = [];
  const fieldRegex = /\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:\s*([^;\n]+)/g;
  let fieldMatch;
  
  while ((fieldMatch = fieldRegex.exec(structContent)) !== null) {
    const fieldName = fieldMatch[1];
    const fieldType = fieldMatch[2].trim();
    console.log(`  Field: ${fieldName}: ${fieldType}`);
    
    fields.push({
      name: fieldName,
      type: fieldType,
      value: '',
      isVec: isVecType(fieldType),
      isTuple: isTupleType(fieldType),
      isOption: isOptionType(fieldType),
      isStruct: false // Will be updated later during processing
    });
  }
  
  return fields;
}

// Define a struct in the global scope
function defineStructInGlobalScope(structName, fields) {
  window[structName] = codecTypes.Struct.with(fields.reduce((acc, field) => {
    acc[field.name] = field.type;
    return acc;
  }, {}));
  
  console.log(`Defined struct ${structName} in global scope`);
}

// Extract class definitions
function extractClassDefinitions(code, extractedClasses) {
  const classRegex = /\bexport\s+class\s+([a-zA-Z_$][a-zA-Z0-9_$]*)(?:\s+extends\s+([a-zA-Z_$][a-zA-Z0-9_$]*))?(?:\s+implements\s+[^<{]+)?\s*{/g;
  let match;

  while ((match = classRegex.exec(code)) !== null) {
    const className = match[1];
    const extendsClass = match[2] || null;
    const startIndex = match.index;
    
    // Find the end of the class definition
    const endIndex = findClassEndIndex(code, startIndex);
    if (endIndex === -1) {
      console.error(`Could not find the end of class definition for: ${className}`);
      continue;
    }

    const classTSCode = code.substring(startIndex, endIndex);
    defineClassInGlobalScope(className, classTSCode, extendsClass, extractedClasses);
  }
}

// Find the end index of a class definition
function findClassEndIndex(code, startIndex) {
  let openBraces = 1;
  let endIndex = -1;
  
  // Start searching from after the opening brace of the class
  let searchStartIndex = code.indexOf('{', startIndex) + 1;
  if (searchStartIndex === 0) {
    return -1;
  }

  for (let i = searchStartIndex; i < code.length; i++) {
    if (code[i] === '{') {
      openBraces++;
    } else if (code[i] === '}') {
      openBraces--;
      if (openBraces === 0) {
        endIndex = i + 1;
        break;
      }
    }
  }
  
  return endIndex;
}

// Define a class in the global scope
function defineClassInGlobalScope(className, classTSCode, extendsClass, extractedClasses) {
  try {
    let jsCode = transform(classTSCode, { transforms: ['typescript'] }).code;

    // Remove 'export' from the transformed JS code before eval
    jsCode = jsCode.replace(/^\s*export\s+/, '');

    // Define the class in the global scope
    const globalDefCode = `window['${className}'] = ${jsCode}`;
    eval(globalDefCode);

    // Extract Polkadot codec type information for Struct, Enum, etc.
    const structInfo = extractPolkadotTypeInfo(classTSCode, className, extendsClass);
    if (structInfo) {
      extractedClasses.push(structInfo);
    }

    console.log(`Successfully defined class: ${className} in global scope`);
  } catch (error) {
    console.error(`Error processing or defining class ${className}:`, error);
    console.error(`Problematic TS Code for ${className}:\n${classTSCode}`);
  }
}

// Helper function to extract Polkadot codec type information
function extractPolkadotTypeInfo(classCode, className, extendsClass) {
  // Only process classes that extend known Polkadot codec types
  const polkadotTypes = ['Struct', 'Enum', 'Vec', 'Tuple', 'Compact', 'Option'];
  if (!extendsClass || !polkadotTypes.includes(extendsClass)) {
    return null;
  }

  console.log(`Extracting type info for class ${className} extends ${extendsClass}`);

  // Extract constructor with type definitions
  // Using a more robust regex that can handle nested braces in the type definition object
  const constructorRegex = /constructor\s*\([^)]*\)\s*{\s*super\s*\([^,]*,\s*({(?:[^{}]*|\{[^{}]*\})*})(?:,\s*[^)]*)\)\s*;/;
  const match = classCode.match(constructorRegex);

  if (!match || !match[1]) {
    console.log(`No constructor match found for ${className}`);
    return null;
  }

  const typeDefObj = match[1];
  console.log(`Found type definition for ${className}:`, typeDefObj);

  // Format the type definition for display
  let formattedTypeDef = '';
  let debugFields = [];
  let debugVariants = [];
  let valueType = null;

  if (extendsClass === 'Struct') {
    const result = formatStructTypeDef(typeDefObj, className);
    formattedTypeDef = result.formattedTypeDef;
    debugFields = result.fields;
  } else if (extendsClass === 'Enum') {
    const result = formatEnumTypeDef(typeDefObj, className);
    formattedTypeDef = result.formattedTypeDef;
    debugVariants = result.variants;
  } else if (extendsClass === 'Vec') {
    // Extract the Vec item type
    const vecTypeMatch = typeDefObj.match(/([A-Za-z0-9_]+)/);
    if (vecTypeMatch) {
      valueType = vecTypeMatch[1];
      formattedTypeDef = `Vec<${valueType}>`;
    } else {
      formattedTypeDef = `Vec<${className}>`;
    }
  } else if (extendsClass === 'Option') {
    // Extract the Option value type
    const optionTypeMatch = typeDefObj.match(/([A-Za-z0-9_]+)/);
    if (optionTypeMatch) {
      valueType = optionTypeMatch[1];
      formattedTypeDef = `Option<${valueType}>`;
    } else {
      formattedTypeDef = `Option<${className}>`;
    }
  } else {
    // Basic formatting for other types
    formattedTypeDef = `${extendsClass}<${className}> ${typeDefObj.replace(/[{\s}]/g, ' ').trim()}`;
  }

  console.log(`Formatted type definition for ${className}:`, formattedTypeDef);

  return {
    name: className,
    type: extendsClass,
    definition: formattedTypeDef,
    debugMode: false,
    fields: debugFields,
    variants: debugVariants,
    valueType: valueType,
    debugValue: '',
    selectedVariant: debugVariants.length > 0 ? debugVariants[0].name : null,
    debugResult: null
  };
}

// Format Struct type definitions
function formatStructTypeDef(typeDefObj, className) {
  // Clean up the object string and extract field definitions
  const cleanedObj = typeDefObj.replace(/[\s\n]+/g, ' ').trim();
  console.log(`Cleaned object for ${className}:`, cleanedObj);

  // Parse the object into fields and values, handling nested structures
  const fields = parseObjectFields(cleanedObj);
  const formattedFields = [];
  const debugFields = [];

  for (const field of fields) {
    let fieldName = field.name;
    let fieldType = field.value;
    let itemType = null;
    let tupleTypes = [];
    let isVec = false;
    let isTuple = false;
    let isOption = false;
    let isStruct = false;
    let nestedFields = [];

    console.log(`Processing field ${fieldName} with type ${fieldType}`);

    // Handle Vec.with() syntax
    if (fieldType.includes('Vec.with')) {
      isVec = true;
      const oldType = fieldType;
      const vecTypeMatch = fieldType.match(/Vec\.with\(([^)]+)\)/);
      if (vecTypeMatch && vecTypeMatch[1]) {
        itemType = vecTypeMatch[1].trim();
      }
      fieldType = fieldType.replace(/Vec\.with\(([^)]+)\)/, 'Vec<$1>');
      console.log(`Converted Vec type from ${oldType} to ${fieldType}, item type: ${itemType}`);
    }

    // Handle Tuple.with() syntax
    if (fieldType.includes('Tuple.with')) {
      isTuple = true;
      console.log(`Processing Tuple.with pattern: ${fieldType}`);

      if (fieldType.includes('Tuple.with([') && fieldType.includes('])')) {
        // Extract the content between the square brackets
        const startIdx = fieldType.indexOf('Tuple.with([') + 'Tuple.with(['.length;
        const endIdx = fieldType.lastIndexOf('])');

        if (startIdx > 0 && endIdx > startIdx) {
          const tupleContent = fieldType.substring(startIdx, endIdx);
          console.log('Extracted tuple content:', tupleContent);

          // Split by comma and trim each type
          tupleTypes = tupleContent.split(',').map((t, index) => {
            const type = t.trim();
            return { type, value: '', index };
          });
          console.log('Tuple types:', tupleTypes);

          fieldType = `(${tupleTypes.map(t => t.type).join(', ')})`;
          console.log(`Converted Tuple type to ${fieldType}`);
        }
      }
    }
    // Handle standard tuple notation (Type1, Type2)
    else if (fieldType.startsWith('(') && fieldType.endsWith(')')) {
      isTuple = true;
      console.log(`Processing standard tuple notation: ${fieldType}`);
      
      // Extract the content between the parentheses
      const tupleContent = fieldType.substring(1, fieldType.length - 1);
      console.log('Extracted tuple content:', tupleContent);
      
      // Split by comma and trim each type
      tupleTypes = tupleContent.split(',').map((t, index) => {
        const type = t.trim();
        return { type, value: '', index };
      });
      console.log('Tuple types:', tupleTypes);
    }

    // Handle Option type
    if (fieldType.includes('Option<') || fieldType.includes('Option.with')) {
      isOption = true;
      let optionValueType = '';

      if (fieldType.includes('Option<')) {
        const optionMatch = fieldType.match(/Option<([^>]+)>/);
        if (optionMatch && optionMatch[1]) {
          optionValueType = optionMatch[1].trim();
        }
      } else if (fieldType.includes('Option.with')) {
        const optionMatch = fieldType.match(/Option\.with\(([^)]+)\)/);
        if (optionMatch && optionMatch[1]) {
          optionValueType = optionMatch[1].trim();
          fieldType = `Option<${optionValueType}>`;
        }
      }

      console.log(`Processed Option type: ${fieldType}, value type: ${optionValueType}`);
    }

    // Handle U8aFixed.with() syntax
    if (fieldType.includes('U8aFixed.with')) {
      console.log(`Processing U8aFixed.with pattern: ${fieldType}`);

      // Extract the bit length from U8aFixed.with(bitLength as U8aBitLength)
      if (fieldType.includes('U8aFixed.with(')) {
        const startIdx = fieldType.indexOf('U8aFixed.with(') + 'U8aFixed.with('.length;
        
        // Find the closing parenthesis or 'as' keyword
        let endIdx = fieldType.indexOf(')', startIdx);
        let asIdx = fieldType.indexOf(' as ', startIdx);
        
        if (asIdx > 0 && asIdx < endIdx) {
          endIdx = asIdx;
        }
        
        if (endIdx > startIdx) {
          const bitLengthStr = fieldType.substring(startIdx, endIdx).trim();
          const bitLength = parseInt(bitLengthStr);
          
          if (!isNaN(bitLength)) {
            const byteLength = Math.ceil(bitLength / 8);
            fieldType = `[u8; ${byteLength}]`;
            itemType = 'u8';
            isVec = true;
            console.log(`Converted U8aFixed.with(${bitLength}) to ${fieldType}`);
          } else {
            fieldType = `[u8; N]`;
            itemType = 'u8';
            isVec = true;
            console.log(`Converted U8aFixed.with(${bitLengthStr}) to ${fieldType} (could not parse bit length)`);
          }
        } else {
          fieldType = `[u8; N]`;
          itemType = 'u8';
          isVec = true;
          console.log(`Converted incomplete U8aFixed.with to ${fieldType}`);
        }
      }
    }

    // Handle VecFixed.with() syntax
    if (fieldType.includes('VecFixed.with')) {
      console.log(`Processing VecFixed.with pattern: ${fieldType}`);

      // Try direct string extraction approach for VecFixed.with(Type, length)
      if (fieldType.includes('VecFixed.with(')) {
        // Extract the type and length using string operations
        const startIdx = fieldType.indexOf('VecFixed.with(') + 'VecFixed.with('.length;

        // Find the comma between type and length
        let commaIdx = -1;
        let parenDepth = 0;
        for (let i = startIdx; i < fieldType.length; i++) {
          if (fieldType[i] === '(') parenDepth++;
          else if (fieldType[i] === ')') parenDepth--;
          else if (fieldType[i] === ',' && parenDepth === 0) {
            commaIdx = i;
            break;
          }
        }

        if (commaIdx > startIdx) {
          const type = fieldType.substring(startIdx, commaIdx).trim();
          itemType = type;
          isVec = true;

          // Try to find the closing parenthesis
          const endIdx = fieldType.indexOf(')', commaIdx);
          if (endIdx > commaIdx) {
            const length = fieldType.substring(commaIdx + 1, endIdx).trim();
            fieldType = `[${type}; ${length}]`;
            console.log(`Converted VecFixed type to ${fieldType} using string extraction`);
          } else {
            // Handle incomplete expression - use what we have
            const lengthPart = fieldType.substring(commaIdx + 1).trim();
            const length = lengthPart.replace(/[^0-9]/g, '');
            fieldType = `[${type}; ${length || 'N'}]`;
            console.log(`Converted incomplete VecFixed type to ${fieldType}`);
          }
        } else {
          // No comma found, just extract the type
          const endIdx = fieldType.indexOf(')', startIdx);
          const type = endIdx > startIdx
            ? fieldType.substring(startIdx, endIdx).trim()
            : fieldType.substring(startIdx).trim();
          itemType = type;
          isVec = true;
          fieldType = `[${type}; N]`;
          console.log(`Converted partial VecFixed type to ${fieldType}`);
        }
      }
    }

    formattedFields.push(`  ${fieldName}: ${fieldType}`);

    // Check if this is a reference to another struct using our improved detection
    // 延迟处理引用结构体，先记录字段类型，稍后在所有结构体生成后再处理嵌套结构
    // 原代码: const referencedStruct = findReferencedStruct(fieldType);
    const referencedStruct = null; // 暂时不查找引用结构体
    console.log("referencedStruct", fieldType)
    
    console.log(`Field ${fieldName} with type ${fieldType} - referencedStruct:`, referencedStruct ? referencedStruct.name : 'undefined');
    
    if (referencedStruct) {
      isStruct = true;
      console.log(`Field ${fieldName} references struct ${referencedStruct.name}`);
      
      // Process the fields from the referenced struct
      if (referencedStruct.fields && referencedStruct.fields.length > 0) {
        // Create a deep copy of the fields
        nestedFields = JSON.parse(JSON.stringify(referencedStruct.fields));
        
        // Process each nested field to ensure proper type detection
        processNestedFields(nestedFields);
        
        console.log(`Processed ${nestedFields.length} fields from ${referencedStruct.name}`);
      }
    }
    
    // Create debug field object
    const debugField = {
      name: fieldName,
      type: fieldType,
      value: '',
      isVec,
      isTuple,
      isOption,
      isStruct,
      itemType,
      tupleItems: tupleTypes,
      nestedFields,
      hasValue: false,
      valueType: isOption ? fieldType.match(/Option<([^>]+)>/)?.[1] || '' : '',
      items: isVec ? [{ value: '' }] : [],
      referencedStructName: isStruct ? referencedStruct?.name : null
    };

    debugFields.push(debugField);
  }

  console.log("fields", className, debugFields)

  // Format as struct
  return {
    formattedTypeDef: `struct ${className} {
${formattedFields.join('\n')}
}`,
    fields: debugFields
  };
}

// Helper function to parse object fields, handling nested structures
function parseObjectFields(objStr) {
  // Remove the outer braces
  const content = objStr.trim();
  const innerContent = content.startsWith('{') && content.endsWith('}')
    ? content.slice(1, -1).trim()
    : content;

  const fields = [];
  let currentPos = 0;
  let currentField = null;
  let bracketDepth = 0;
  let parenDepth = 0;
  let inQuotes = false;

  console.log('Parsing object fields for:', innerContent);

  for (let i = 0; i < innerContent.length; i++) {
    const char = innerContent[i];

    // Handle quotes
    if (char === '"' || char === "'") {
      inQuotes = !inQuotes;
      continue;
    }

    if (inQuotes) continue;

    // Track bracket and parenthesis depth
    if (char === '[' || char === '{') {
      bracketDepth++;
    } else if (char === ']' || char === '}') {
      bracketDepth--;
    } else if (char === '(') {
      parenDepth++;
    } else if (char === ')') {
      parenDepth--;
    }

    // Only process field separators at the top level (no nesting)
    const isTopLevel = bracketDepth === 0 && parenDepth === 0;

    if (isTopLevel) {
      if (char === ':' && !currentField) {
        // Found field name
        const fieldName = innerContent.substring(currentPos, i).trim();
        currentField = { name: fieldName, valueStart: i + 1 };
        console.log(`Found field name: ${fieldName} at position ${i}`);
      } else if (char === ',' && currentField) {
        // Found end of field value
        const fieldValue = innerContent.substring(currentField.valueStart, i).trim();
        console.log(`Found field value for ${currentField.name}: ${fieldValue}`);
        fields.push({ name: currentField.name, value: fieldValue });
        currentField = null;
        currentPos = i + 1;
      }
    }
  }

  // Handle the last field if there's no trailing comma
  if (currentField) {
    const fieldValue = innerContent.substring(currentField.valueStart).trim();
    console.log(`Found last field value for ${currentField.name}: ${fieldValue}`);
    fields.push({ name: currentField.name, value: fieldValue });
  }

  console.log('Parsed fields:', fields);
  return fields;
}

// Format Enum type definitions
function formatEnumTypeDef(typeDefObj, className) {
  // Clean up the object string
  const cleanedObj = typeDefObj.replace(/[\s\n]+/g, ' ').trim();

  // Extract variants
  const variantRegex = /([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:\s*([^,}]+)/g;
  let variantMatch;
  let formattedVariants = [];
  let debugVariants = [];

  while ((variantMatch = variantRegex.exec(cleanedObj)) !== null) {
    const variantName = variantMatch[1].trim();
    const variantType = variantMatch[2].trim();
    formattedVariants.push(`  ${variantName}${variantType !== 'null' ? `: ${variantType}` : ''}`);

    // Create debug variant object
    debugVariants.push({
      name: variantName,
      type: variantType !== 'null' ? variantType : null,
      hasValue: variantType !== 'null',
      value: ''
    });
  }

  // Format as enum
  return {
    formattedTypeDef: `enum ${className} {
${formattedVariants.join(',\n')}
}`,
    variants: debugVariants
  };
}

function extractAllFunctions(code) {
  const functionRegex = /export\s+(const|function|async\s+function)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*(?:=\s*)?\(([^)]*)\)[^{=]*(?:=>|{)/g;

  let match;
  while ((match = functionRegex.exec(code)) !== null) {
    try {
      const type = match[1];
      const name = match[2];
      const paramsString = match[3];

      console.log(`Found function: ${name} (${type})`);

      const startIndex = match.index;
      let endIndex = startIndex;

      if (type === 'const') {
        const arrowPos = code.indexOf('=>', startIndex);
        if (arrowPos > 0) {
          const nextChar = code.substring(arrowPos + 2).trim()[0];
          if (nextChar === '{') {
            let braceCount = 1;
            let searchPos = code.indexOf('{', arrowPos);

            for (let i = searchPos + 1; i < code.length; i++) {
              if (code[i] === '{') braceCount++;
              if (code[i] === '}') braceCount--;
              if (braceCount === 0) {
                endIndex = i + 1;
                break;
              }
            }
          } else {
            const semicolonPos = code.indexOf(';', arrowPos);
            if (semicolonPos > 0) {
              endIndex = semicolonPos + 1;
            } else {
              const nextExportPos = code.indexOf('export', arrowPos);
              endIndex = nextExportPos > 0 ? nextExportPos : code.length;
            }
          }
        }
      } else {
        let braceCount = 0;
        let functionStarted = false;

        for (let i = startIndex; i < code.length; i++) {
          if (code[i] === '{') {
            braceCount++;
            functionStarted = true;
          }
          if (code[i] === '}') {
            braceCount--;
            if (functionStarted && braceCount === 0) {
              endIndex = i + 1;
              break;
            }
          }
        }
      }

      if (endIndex <= startIndex) {
        console.error(`Unable to determine the end position of function ${name}`);
        continue;
      }

      const functionCode = code.substring(startIndex, endIndex).trim();

      const params = parseParameters(paramsString);

      let functionType = 'function';
      if (type === 'const') {
        functionType = 'arrow function';
      } else if (type.includes('async')) {
        functionType = 'async function';
      }

      functions.value.push({
        name,
        type: functionType,
        params,
        executeMode: false,
        formattedCode: formatCode(functionCode),
        rawCode: functionCode,
        result: null
      });
    } catch (err) {
      console.error('Extract function error:', err);
    }
  }
}

// 检查类型是否是接口类型（I开头的类型）
function isInterfaceType(type) {
  // 修改检测逻辑，只要是I开头后面跟大写字母的类型都视为接口类型，包括ID这样的简短名称
  return type && type.startsWith('I') && /^I[A-Z][a-zA-Z0-9]*$/.test(type);
}

// 从window获取类型定义
function getTypeDefinition(type) {
  // 移除I前缀获取实际类型名
  const actualType = type.startsWith('I') ? type.substring(1) : type;
  
  // 检查window中是否存在该类型
  if (window && typeof window[actualType] !== 'undefined') {
    return actualType;
  }
  
  // 检查是否存在I前缀的接口定义
  const interfaceKey = `I${actualType}`;
  if (window && typeof window[interfaceKey] !== 'undefined') {
    return interfaceKey;
  }
  
  return null;
}

// 解析复杂类型参数（比如IA, IB等接口类型）
function parseComplexType(typeName, processedTypes = new Set()) {
  if (!typeName) {
    // 如果没有提供类型名称，返回一个空对象结构
    return {
      name: 'Object',
      fields: [{
        name: 'value',
        type: 'object',
        value: '{}'
      }]
    };
  }
  
  // 防止循环引用导致的无限递归
  if (processedTypes.has(typeName)) {
    return {
      name: typeName,
      fields: [{ name: 'circular-reference', type: 'object', value: '{}' }]
    };
  }
  
  // 添加当前类型到已处理列表
  processedTypes.add(typeName);
  
  // 尝试查找window对象中的类型定义或接口定义
  const typeDefinition = getTypeDefinition(typeName);
  
  try {
    // 查找window中的接口定义
    const interfaceKey = `I${typeName.replace(/^I/, '')}`;
    if (window && typeof window[interfaceKey] !== 'undefined') {
      // 找到了接口定义
      const fields = [];
      
      // 尝试从接口定义中获取字段信息
      for (const key in window[interfaceKey]) {
        if (Object.prototype.hasOwnProperty.call(window[interfaceKey], key)) {
          // 获取字段类型
          let fieldType = typeof window[interfaceKey][key];
          let fieldValue = null;
          let nestedFields = null;
          
          // 检查是否是复杂类型（对象、数组等）
          if (fieldType === 'object') {
            // 处理数组类型
            if (Array.isArray(window[interfaceKey][key])) {
              fieldType = 'array';
              fieldValue = [];
              
              // 处理数组元素
              if (window[interfaceKey][key].length > 0) {
                const elementType = window[interfaceKey][key][0]?.constructor?.name;
                if (elementType && (elementType.startsWith('I') || /^[A-Z][a-zA-Z0-9]*$/.test(elementType))) {
                  // 递归解析数组元素类型
                  nestedFields = parseComplexType(elementType, new Set(processedTypes));
                }
              }
            } 
            // 处理元组类型
            else if (window[interfaceKey][key] instanceof Array && window[interfaceKey][key].length > 0 && !window[interfaceKey][key].slice) {
              fieldType = 'tuple';
              fieldValue = [];
              
              // 为元组中的每个元素创建一个数组
              nestedFields = [];
              for (let i = 0; i < window[interfaceKey][key].length; i++) {
                const tupleItemType = window[interfaceKey][key][i]?.constructor?.name;
                if (tupleItemType && (tupleItemType.startsWith('I') || /^[A-Z][a-zA-Z0-9]*$/.test(tupleItemType))) {
                  // 递归解析元组元素类型
                  nestedFields[i] = parseComplexType(tupleItemType, new Set(processedTypes));
                }
              }
            }
            // 处理嵌套对象
            else {
              const nestedType = window[interfaceKey][key].constructor?.name;
              if (nestedType && (nestedType.startsWith('I') || /^[A-Z][a-zA-Z0-9]*$/.test(nestedType))) {
                fieldType = nestedType;
                // 递归解析嵌套对象
                nestedFields = parseComplexType(nestedType, new Set(processedTypes));
              } else {
                fieldType = 'object';
                fieldValue = {};
              }
            }
          } else {
            // 设置基本类型的默认值
            fieldValue = fieldType === 'string' ? '' : (fieldType === 'number' ? 0 : (fieldType === 'boolean' ? false : null));
          }
          
          const field = {
            name: key,
            type: fieldType,
            value: fieldValue
          };
          
          // 如果有嵌套字段信息，添加到该字段中
          if (nestedFields) {
            field.nestedFields = nestedFields;
          }
          
          fields.push(field);
        }
      }
      
      return {
        name: typeName,
        fields
      };
    }
    
    // 尝试从类型定义中获取信息
    if (window && typeof window[typeName] !== 'undefined') {
      const typeClass = window[typeName];
      if (typeClass.prototype) {
        const fields = [];
        
        // 尝试从类的原型中获取字段信息
        // 通常Polkadot类型会有类似的结构
        for (const key in typeClass.prototype) {
          if (key.startsWith('get ')) {
            const fieldName = key.substring(4);
            fields.push({
              name: fieldName,
              type: 'string', // 默认为字符串类型
              value: ''
            });
          }
        }
        
        return {
          name: typeName,
          fields
        };
      }
    }
    
    // 如果在window中找不到类型定义，创建一个基于类型名称的默认结构
    // 这确保即使没有类型信息，UI仍然可以显示字段
    if (typeDefinition || typeName) {
      // 从类型名称推断可能的字段
      // 例如：如果类型名称是UserInfo，则可能有name、age等字段
      const inferredFields = inferFieldsFromTypeName(typeName);
      
      return {
        name: typeName,
        fields: inferredFields
      };
    }
  } catch (error) {
    console.error('Error parsing complex type:', error);
  }
  
  // 如果所有尝试都失败，返回一个带有默认字段的结构
  return {
    name: typeName || 'Object',
    fields: [
      {
        name: 'property1',
        type: 'string',
        value: ''
      },
      {
        name: 'property2',
        type: 'number',
        value: 0
      },
      {
        name: 'property3',
        type: 'boolean',
        value: false
      }
    ]
  };
}



// 保存用户输入的代码
function storeInterfaceCode(code) {
  if (code && typeof code === 'string') {
    storedInterfaceCode = code;
    console.log('接口代码已保存，长度：', code.length);
  }
}

// 从类型名称获取接口定义
function inferFieldsFromTypeName(typeName) {
  if (!typeName) return [];
  
  // 首先检查是否有已经保存的代码
  let codeString = storedInterfaceCode;
  
  // 如果没有存储的代码，尝试从输入框中获取
  if (!codeString) {
    const codeInput = document.getElementById('code-input');
    if (codeInput && codeInput.value) {
      codeString = codeInput.value;
    }
    
    // 如果还是没有，查找页面上的其他文本区域
    if (!codeString) {
      const textareas = document.querySelectorAll('textarea');
      for (const textarea of textareas) {
        if (textarea.value && textarea.value.includes('interface')) {
          codeString = textarea.value;
          break;
        }
      }
    }
  }
  // 如果仍然无法从代码中提取接口定义，则尝试从接口名称生成一个简单的默认结构
  console.warn(`无法从代码中解析接口: ${typeName}，使用默认字段`);
  
  // 返回默认结构
  return [
    { name: 'id', type: 'string', value: '' },
    { name: 'name', type: 'string', value: '' },
    { name: 'value', type: 'number', value: 0 }
  ];
}

// Parse function parameters from parameter string
function parseParameters(paramsString) {
  const params = [];

  if (!paramsString || paramsString.trim() === '') {
    return params;
  }

  // Split by commas, but respect nested structures
  const paramRegex = /([^,]+)(?:,|$)/g;
  let match;

  while ((match = paramRegex.exec(paramsString)) !== null) {
    const paramString = match[1].trim();
    if (!paramString) continue;

    // Split parameter name and type
    const typeRegex = /([a-zA-Z_$][a-zA-Z0-9_$]*)(?:\s*:\s*([^=]+))?(?:\s*=\s*(.+))?/;
    const typeMatch = paramString.match(typeRegex);

    if (typeMatch) {
      const name = typeMatch[1];
      let type = typeMatch[2] ? typeMatch[2].trim() : 'any';
      const defaultValue = typeMatch[3] ? typeMatch[3].trim() : null;
      
      // 处理接口类型（如IA, IB等）
      if (type && (isInterfaceType(type) || /^[A-Z][a-zA-Z0-9]*$/.test(type))) {
        // 尝试解析复杂类型
        try {
          // 创建复杂类型参数
          const complexParam = {
            name,
            type: 'complex',
            complexType: type,
            value: defaultValue || '{}',
            fields: []
          };
          
          // 尝试从window中获取类型定义
          const typeInfo = parseComplexType(type);
          
          if (typeInfo && typeInfo.fields) {
            complexParam.fields = typeInfo.fields.map(field => {
              // 为每个字段创建初始值
              let fieldValue = null;
              let fieldType = field.type;
              
              // 根据字段类型设置不同的初始值
              if (field.isArray) {
                fieldValue = [];
              } else if (field.isTuple) {
                fieldValue = field.tupleItems.map(() => null);
              } else if (typeof field.type === 'string') {
                if (field.type.toLowerCase().includes('string') || field.type.includes('Text')) {
                  fieldValue = '';
                } else if (field.type.toLowerCase().includes('number') || /[ui]\d+/i.test(field.type)) {
                  fieldValue = 0;
                } else if (field.type.toLowerCase().includes('boolean')) {
                  fieldValue = false;
                }
              }
              
              return {
                ...field,
                value: fieldValue
              };
            });
          }
          
          params.push(complexParam);
        } catch (error) {
          console.error('Error parsing complex type:', error);
          // 如果解析失败，回退到基本类型
          params.push({
            name,
            type: type || 'any',
            value: defaultValue || ''
          });
        }
      }
      // Handle object type
      else if (type && (type.includes('{') || type.startsWith('Record<') || type.startsWith('object'))) {
        const param = {
          name,
          type: 'object',
          value: defaultValue || '{}',
          properties: parseObjectProperties(type)
        };
        params.push(param);
      }
      // Handle array type
      else if (type && (type.includes('[]') || type.startsWith('Array<'))) {
        const itemType = type.includes('[]')
          ? type.replace('[]', '')
          : type.replace(/Array<(.+)>/, '$1');

        const param = {
          name,
          type: 'array',
          itemType,
          items: [{ value: '' }],
          value: defaultValue || '[]'
        };
        params.push(param);
      }
      // Handle tuple type [type1, type2]
      else if (type && type.startsWith('[') && type.endsWith(']')) {
        const tupleTypesStr = type.substring(1, type.length - 1);
        const tupleTypes = tupleTypesStr.split(',').map(t => t.trim());
        
        const param = {
          name,
          type: 'tuple',
          tupleTypes,
          tupleValues: tupleTypes.map(() => ''),
          value: defaultValue || '[]'
        };
        params.push(param);
      }
      // Basic type
      else {
        params.push({
          name,
          type: type || 'any',
          value: defaultValue || ''
        });
      }
    }
  }

  return params;
}

// Parse properties from object type
function parseObjectProperties(typeString) {
  const properties = [];

  try {
    // Extract content between curly braces
    const match = typeString.match(/{([^}]*)}/);
    if (!match) return properties;

    const propertiesString = match[1];

    // Parse each property
    const propertyRegex = /([a-zA-Z_$][a-zA-Z0-9_$]*)\s*(?:\?)?:\s*([^;,]+)(?:;|,|$)/g;
    let propMatch;

    while ((propMatch = propertyRegex.exec(propertiesString)) !== null) {
      const name = propMatch[1];
      const type = propMatch[2].trim();

      properties.push({
        name,
        type,
        value: ''
      });
    }
  } catch (error) {
    console.error('Error parsing object properties:', error);
  }

  return properties;
}

// Format code for display
function formatCode(code) {
  // Simple indentation and formatting
  try {
    // Replace tabs with spaces
    let formatted = code.replace(/\t/g, '  ');

    // Add line breaks after specific characters
    formatted = formatted.replace(/([{};])\s*/g, '$1\n');

    // Handle indentation
    const lines = formatted.split('\n');
    let indentLevel = 0;
    const indentedLines = lines.map(line => {
      const trimmedLine = line.trim();

      // Adjust indent level based on braces
      if (trimmedLine.endsWith('{')) {
        const indent = '  '.repeat(indentLevel);
        indentLevel++;
        return indent + trimmedLine;
      } else if (trimmedLine.startsWith('}')) {
        indentLevel = Math.max(0, indentLevel - 1);
        const indent = '  '.repeat(indentLevel);
        return indent + trimmedLine;
      } else {
        const indent = '  '.repeat(indentLevel);
        return indent + trimmedLine;
      }
    });

    return indentedLines.join('\n');
  } catch (error) {
    console.error('Error formatting code:', error);
    return code;
  }
}

// Check if type is an object type
function isObjectType(type) {
  return type === 'object' || type.includes('{') || type.startsWith('Record<');
}

// Check if a type is an array type
function isArrayType(type) {
  return type === 'array' || type.includes('[]') || type.startsWith('Array<');
}

// 检查字段是否是自定义类型（结构体）
function isCustomTypeField(field) {
  return field && (field.customTypeName || 
         (field.type && /^[A-Z]/.test(field.type)));
}

// 检查字段是否是数组类型
function isArrayField(field) {
  return field && (field.isArray || 
         (field.type && (field.type.includes('Array<') || field.type.includes('[]'))));
}

// 检查字段是否是元组类型
function isTupleField(field) {
  return field && (field.isTuple || 
         (field.type && ((field.type.startsWith('[') && field.type.endsWith(']')) || 
                       field.type.includes('Tuple'))));
}

// 获取数组字段的项类型
function getArrayItemType(field) {
  if (field.itemType) return field.itemType;
  
  if (field.type.includes('Array<')) {
    return field.type.match(/Array<(.+)>/)[1];
  }
  if (field.type.includes('[]')) {
    return field.type.replace('[]', '');
  }
  return 'any';
}

// 获取元组字段的项类型
function getTupleItemType(field, index) {
  if (field.tupleItems && field.tupleItems[index]) {
    return field.tupleItems[index].type;
  }
  return 'any';
}

// 确保数组字段有items数组
function getOrCreateFieldItems(field) {
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

// 添加复杂类型数组项
function addComplexArrayItem(field) {
  getOrCreateFieldItems(field).push({ value: '' });
}

// 移除复杂类型数组项
function removeComplexArrayItem(field, index) {
  if (field.items && index >= 0 && index < field.items.length) {
    field.items.splice(index, 1);
    // 确保至少有一项
    if (field.items.length === 0) {
      field.items.push({ value: '' });
    }
  }
}

// Check if type is a Polkadot struct type and return the struct if found
function findReferencedStruct(type) {
  // Skip checking for non-struct types
  if (!type || typeof type !== 'string') return null;
  
  // Exclude tuple types which might be confused with structs
  if (type.startsWith('(') && type.endsWith(')')) return null;
  
  // Exclude Vec, Option, and array types
  if (type.startsWith('Vec<') || 
      type.startsWith('Option<') || 
      type.match(/\[.*?;.*?\]/)) {
    return null;
  }
  
  // Clean the type name (remove any generic parameters)
  const cleanType = type.split('<')[0].trim();
  
  // First try exact match (most reliable)
  for (const cls of extractedClasses.value) {
    if (cls.type === 'Struct' && (cleanType === cls.name || type === cls.name)) {
      return cls;
    }
  }
  
  // Try to match by name only (ignoring namespaces)
  for (const cls of extractedClasses.value) {
    if (cls.type === 'Struct') {
      // Extract the last part of the type name (after the last dot or ::)
      const typeParts = cleanType.split(/\.|::/);
      const typeBaseName = typeParts[typeParts.length - 1];
      
      if (typeBaseName === cls.name) {
        return cls;
      }
    }
  }
  
  return null;
}

// Check if a type is a Polkadot struct type
function isPolkadotStructType(type) {
  return findReferencedStruct(type) !== null;
}

// Check if type is a Vec type
function isVecType(type) {
  return type.startsWith('Vec<') || type.match(/\[.*?;.*?\]/);
}

// Check if type is a Tuple type
function isTupleType(type) {
  return type.startsWith('(') && type.endsWith(')');
}

// Check if type is an Option type
function isOptionType(type) {
  return type.startsWith('Option<');
}

// Get placeholder based on type
function getPlaceholder(type) {
  switch (type) {
    case 'number':
      return '0';
    case 'boolean':
      return 'true/false';
    case 'string':
      return 'text...';
    case 'object':
      return '{}';
    case 'array':
      return '[]';
    case 'u8':
      return '0-255 或 0x1A';
    case 'u16':
      return '0-65535';
    case 'u32':
      return '0-4294967295';
    case 'u64':
      return '0-18446744073709551615';
    default:
      return '';
  }
}

// Get placeholder for Polkadot type
function getPlaceholderForType(type) {
  if (!type) return '';

  // Handle specific Polkadot types
  if (type.includes('u8') || type.includes('U8')) {
    return '0-255';
  } else if (type.includes('u16') || type.includes('U16')) {
    return '0-65535';
  } else if (type.includes('u32') || type.includes('U32')) {
    return '0-4294967295';
  } else if (type.includes('u64') || type.includes('U64')) {
    return '0';
  } else if (type.includes('u128') || type.includes('U128')) {
    return '0';
  } else if (type.includes('i8') || type.includes('I8') ||
             type.includes('i16') || type.includes('I16') ||
             type.includes('i32') || type.includes('I32') ||
             type.includes('i64') || type.includes('I64') ||
             type.includes('i128') || type.includes('I128')) {
    return '0';
  } else if (type.includes('bool') || type.includes('Bool')) {
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
  } else if (type.includes('H256') || type.includes('Hash') || type.includes('H160')) {
    return '0x...';
  } else if (type.includes('AccountId')) {
    return '5...';
  } else if (type.includes('Balance')) {
    return '1000000000000';
  } else if (type.includes('CommunityId') || type.includes('EventId') || 
             type.includes('RewardId') || type.includes('ContentId')) {
    return '0';
  } else {
    return 'value...';
  }
}

// Toggle debug mode for a class
function toggleDebugMode(index) {
  const classInfo = extractedClasses.value[index];
  if (classInfo) {
    classInfo.debugMode = !classInfo.debugMode;
  }
}

// Get selected variant for an enum
function getSelectedVariant(classInfo) {
  if (!classInfo || !classInfo.variants || classInfo.variants.length === 0) {
    return null;
  }

  return classInfo.variants.find(v => v.name === classInfo.selectedVariant) || classInfo.variants[0];
}

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

// 递归处理嵌套结构体字段的辅助函数
function processStructField(field) {
  if (field.isStruct) {
    // 处理结构体字段
    const nestedValues = {};
    
    for (const nestedField of field.nestedFields) {
      // 递归处理每个嵌套字段，无论嵌套多少层
      nestedValues[nestedField.name] = processStructField(nestedField);
    }
    
    // 创建结构体实例
    const StructConstructor = window[field.referencedStructName];
    if (StructConstructor) {
      return new StructConstructor(registry, nestedValues);
    } else {
      return nestedValues; // 如果找不到构造函数，返回嵌套的值对象
    }
  } else if (field.isVec) {
    // 处理向量字段
    const values = field.items.map(item => convertValueToPolkadotType(item.value, field.itemType));
    
    // 检查是否是固定长度数组 [type; length]
    const fixedArrayMatch = field.type.match(/\[([^;]+);\s*(\d+)\]/);
    if (fixedArrayMatch) {
      const expectedLength = parseInt(fixedArrayMatch[2]);
      const itemType = fixedArrayMatch[1].trim();
      
      // 如果是 u8 类型的固定长度数组，需要特殊处理
      if (itemType === 'u8') {
        // 如果用户只输入了一个值，将其解释为十六进制字符串或重复该值
        if (values.length === 1 && values[0] !== null) {
          const singleValue = values[0];
          if (typeof singleValue === 'string' && singleValue.startsWith('0x')) {
            // 十六进制字符串，转换为字节数组
            const hexStr = singleValue.slice(2);
            const bytes = [];
            for (let i = 0; i < hexStr.length; i += 2) {
              bytes.push(parseInt(hexStr.substr(i, 2), 16));
            }
            // 填充或截断到期望长度
            while (bytes.length < expectedLength) bytes.push(0);
            return bytes.slice(0, expectedLength);
          } else if (typeof singleValue === 'number') {
            // 单个数字，重复到期望长度
            return new Array(expectedLength).fill(singleValue);
          }
        }
        
        // 填充到期望长度
        while (values.length < expectedLength) {
          values.push(0);
        }
        return values.slice(0, expectedLength);
      } else {
        // 其他类型的固定长度数组
        while (values.length < expectedLength) {
          values.push(convertValueToPolkadotType('', itemType));
        }
        return values.slice(0, expectedLength);
      }
    }
    
    return values;
  } else if (field.isTuple) {
    // 处理元组字段
    return field.tupleItems.map(item => convertValueToPolkadotType(item.value, item.type));
  } else if (field.isOption) {
    // 处理Option字段
    return field.hasValue ? convertValueToPolkadotType(field.value, field.valueType) : null;
  } else {
    // 处理基本字段
    return convertValueToPolkadotType(field.value, field.type);
  }
}

// Create instance of a Struct type
function debugCodecType(index) {
  const classInfo = extractedClasses.value[index];
  if (!classInfo || classInfo.type !== 'Struct') return;

  try {
    // Get the class constructor
    const ClassConstructor = window[classInfo.name];
    if (!ClassConstructor) {
      classInfo.debugResult = `Error: Class ${classInfo.name} not found in global scope`;
      return;
    }

    // Prepare field values using recursive processing
    const fieldValues = {};
    
    for (const field of classInfo.fields) {
      // 使用递归函数处理每个字段，无论嵌套多少层
      fieldValues[field.name] = processStructField(field);
    }

    console.log("fieldValues", fieldValues)
    console.log("Type", ClassConstructor)

    // Create instance
    const instance = new ClassConstructor(registry, fieldValues);

    console.log("instance", instance)
    const result = `
hex: ${instance.toHex()}
JSON: ${JSON.stringify(instance.toJSON(), null, 2)}
`;

    // Display result
    classInfo.debugResult = result;
  } catch (error) {
    console.error('Error creating struct instance:', error);
    classInfo.debugResult = `Error: ${error.message}`;
  }
}

// Create instance of an Enum type
function createEnumInstance(index) {
  const classInfo = extractedClasses.value[index];
  if (!classInfo || classInfo.type !== 'Enum') return;

  try {
    // Get the class constructor
    const ClassConstructor = window[classInfo.name];
    if (!ClassConstructor) {
      classInfo.debugResult = `Error: Class ${classInfo.name} not found in global scope`;
      return;
    }

    const selectedVariant = getSelectedVariant(classInfo);
    if (!selectedVariant) {
      classInfo.debugResult = 'Error: No variant selected';
      return;
    }

    // Create instance based on variant
    let instance;

    if (selectedVariant.hasValue) {
      // Variant with value
      const value = convertValueToPolkadotType(selectedVariant.value, selectedVariant.type);
      instance = new ClassConstructor({ [selectedVariant.name]: value });
    } else {
      // Variant without value
      instance = new ClassConstructor(selectedVariant.name);
    }

    // Display result
    classInfo.debugResult = JSON.stringify(instance, null, 2);
  } catch (error) {
    console.error('Error creating enum instance:', error);
    classInfo.debugResult = `Error: ${error.message}`;
  }
}

// Create instance of U8aFixed type
function createU8aFixedInstance(index) {
  const classInfo = extractedClasses.value[index];
  if (!classInfo) return;

  try {
    // Get the class constructor
    const ClassConstructor = window[classInfo.name];
    if (!ClassConstructor) {
      classInfo.debugResult = `Error: Class ${classInfo.name} not found in global scope`;
      return;
    }

    let value = classInfo.debugValue;
    let instance;

    if (value.startsWith('0x')) {
      // Hex string input
      instance = new ClassConstructor(window.registry, value);
    } else if (value.startsWith('[') && value.endsWith(']')) {
      // Array input like [18, 52, 171, 205]
      try {
        const byteArray = JSON.parse(value);
        instance = new ClassConstructor(window.registry, byteArray);
      } catch (parseError) {
        throw new Error('Invalid array format. Use [1, 2, 3, ...] format');
      }
    } else if (value.includes(',')) {
      // Comma-separated values
      const byteArray = value.split(',').map(v => parseInt(v.trim()));
      instance = new ClassConstructor(window.registry, byteArray);
    } else {
      // Single value or string
      instance = new ClassConstructor(window.registry, value);
    }

    // Display result
    const result = `
hex: ${instance.toHex()}
JSON: ${JSON.stringify(instance.toJSON(), null, 2)}
`;
    classInfo.debugResult = result;
  } catch (error) {
    console.error('Error creating U8aFixed instance:', error);
    classInfo.debugResult = `Error: ${error.message}`;
  }
}

// Create instance of type alias
function createTypeAliasInstance(index) {
  const classInfo = extractedClasses.value[index];
  if (!classInfo) return;

  try {
    // Get the class constructor
    const ClassConstructor = window[classInfo.name];
    if (!ClassConstructor) {
      classInfo.debugResult = `Error: Type ${classInfo.name} not found in global scope`;
      return;
    }

    let value = classInfo.debugValue;
    
    // Convert value based on base type
    if (classInfo.baseType && (classInfo.baseType.includes('U') || classInfo.baseType.includes('I'))) {
      // Numeric types
      if (value.startsWith('0x')) {
        value = parseInt(value, 16);
      } else {
        value = Number(value) || 0;
      }
    } else if (classInfo.baseType === 'Bool') {
      value = value === 'true' || value === true;
    }

    const instance = new ClassConstructor(window.registry, value);

    // Display result
    const result = `
hex: ${instance.toHex()}
JSON: ${JSON.stringify(instance.toJSON(), null, 2)}
`;
    classInfo.debugResult = result;
  } catch (error) {
    console.error('Error creating type alias instance:', error);
    classInfo.debugResult = `Error: ${error.message}`;
  }
}

// Create instance of VecFixed type
function createVecFixedInstance(index) {
  const classInfo = extractedClasses.value[index];
  if (!classInfo) return;

  try {
    // Get the class constructor
    const ClassConstructor = window[classInfo.name];
    if (!ClassConstructor) {
      classInfo.debugResult = `Error: Class ${classInfo.name} not found in global scope`;
      return;
    }

    // Ensure vecValues array exists
    if (!classInfo.vecValues) {
      classInfo.vecValues = new Array(classInfo.length).fill('');
    }

    // Convert values based on item type
    const values = classInfo.vecValues.map(val => {
      if (!val) return 0; // default value
      
      if (classInfo.itemType && (classInfo.itemType.includes('u') || classInfo.itemType.includes('i'))) {
        // Numeric types
        if (val.startsWith && val.startsWith('0x')) {
          return parseInt(val, 16);
        } else {
          return Number(val) || 0;
        }
      } else if (classInfo.itemType === 'bool') {
        return val === 'true' || val === true;
      } else {
        return val;
      }
    });

    const instance = new ClassConstructor(window.registry, values);

    // Display result
    const result = `
hex: ${instance.toHex()}
JSON: ${JSON.stringify(instance.toJSON(), null, 2)}
`;
    classInfo.debugResult = result;
  } catch (error) {
    console.error('Error creating VecFixed instance:', error);
    classInfo.debugResult = `Error: ${error.message}`;
  }
}

// Create instance of other Polkadot codec types
function createOtherTypeInstance(index) {
  const classInfo = extractedClasses.value[index];
  if (!classInfo) return;

  try {
    // Get the class constructor
    const ClassConstructor = window[classInfo.name];
    if (!ClassConstructor) {
      classInfo.debugResult = `Error: Class ${classInfo.name} not found in global scope`;
      return;
    }

    let instance;

    if (classInfo.type === 'Vec') {
      // Create Vec instance
      const items = classInfo.debugValue.split(',').map(item => item.trim());
      instance = new ClassConstructor(items);
    } else if (classInfo.type === 'Option') {
      // Create Option instance
      instance = new ClassConstructor(classInfo.debugValue || null);
    } else if (classInfo.type === 'Compact') {
      // Create Compact instance
      instance = new ClassConstructor(Number(classInfo.debugValue) || 0);
    } else {
      // Create other type instance
      instance = new ClassConstructor(classInfo.debugValue);
    }

    // Display result
    classInfo.debugResult = JSON.stringify(instance, null, 2);
  } catch (error) {
    console.error('Error creating instance:', error);
    classInfo.debugResult = `Error: ${error.message}`;
  }
}

// 处理所有结构体中的嵌套引用，在所有结构体都已定义后调用
function processReferencedStructs(extractedClasses) {
  console.log('Processing referenced structs for all defined structures');
  
  // 遍历所有已提取的结构体
  for (const cls of extractedClasses) {
    if (cls.type === 'Struct' && cls.fields) {
      // 为每个字段处理嵌套引用
      for (const field of cls.fields) {
        if (!field.type) continue;
        
        // 检查字段是否引用了其他结构体
        const referencedStruct = findReferencedStruct(field.type);
        if (referencedStruct) {
          console.log(`Field ${field.name} references struct: ${referencedStruct.name}`);
          
          // 标记为结构体类型并设置嵌套字段
          field.isStruct = true;
          field.referencedStructName = referencedStruct.name;
          
          // 复制引用结构体的字段作为嵌套字段
          if (referencedStruct.fields && referencedStruct.fields.length > 0) {
            field.nestedFields = JSON.parse(JSON.stringify(referencedStruct.fields));
            
            // 递归处理更深层次的嵌套
            processNestedFields(field.nestedFields);
          }
        }
      }
    }
  }
}

// Process nested fields recursively to ensure proper type detection and initialization
function processNestedFields(fields, depth = 0) {
  // Prevent infinite recursion
  if (depth > 10) return;
  
  for (const field of fields) {
    // Ensure the field has all required properties
    if (field.value === undefined) field.value = '';
    
    // Detect field types
    field.isVec = isVecType(field.type);
    field.isTuple = isTupleType(field.type);
    field.isOption = isOptionType(field.type);
    
    // Check if this is a struct field
    const referencedStruct = findReferencedStruct(field.type);
    
    // Simple struct detection - if the type is a single word and starts with uppercase, it's likely a struct
    // This is a fallback for when findReferencedStruct fails
    const isLikelyStruct = /^[A-Z][a-zA-Z0-9_]*$/.test(field.type) && 
                          !['U8', 'U16', 'U32', 'U64', 'U128', 'I8', 'I16', 'I32', 'I64', 'I128', 'Bool', 'Text'].includes(field.type);
    
    field.isStruct = referencedStruct !== null || isLikelyStruct;
    
    if (referencedStruct) {
      console.log(`Found struct match: ${field.name} (${field.type}) -> ${referencedStruct.name}`);
    } else if (isLikelyStruct) {
      console.log(`Likely struct type: ${field.name} (${field.type}) but not found in extractedClasses`);
    }
    
    if (field.isStruct) {
      if (referencedStruct) {
        field.referencedStructName = referencedStruct.name;
      } else {
        // Handle case where we think it's a struct but don't have the reference
        field.referencedStructName = field.type; // Use the type name as the referenced struct name
      }
      
      // Process fields from the referenced struct
      if (referencedStruct && referencedStruct.fields && referencedStruct.fields.length > 0) {
        // Create a deep copy of the fields
        field.nestedFields = JSON.parse(JSON.stringify(referencedStruct.fields));
        
        // Process each nested field to ensure it has all required properties
        for (const nestedField of field.nestedFields) {
          nestedField.value = nestedField.value || '';
          nestedField.isVec = isVecType(nestedField.type);
          nestedField.isTuple = isTupleType(nestedField.type);
          nestedField.isOption = isOptionType(nestedField.type);
          
          // Initialize Vec fields
          if (nestedField.isVec) {
            nestedField.items = nestedField.items || [{ value: '' }];
            
            // Extract item type for Vec
            if (nestedField.type.startsWith('Vec<')) {
              const vecMatch = nestedField.type.match(/Vec<([^>]+)>/);
              if (vecMatch && vecMatch[1]) {
                nestedField.itemType = vecMatch[1].trim();
              }
            } else if (nestedField.type.match(/\[.*?;.*?\]/)) {
              // Handle array notation [Type; Length]
              const arrayMatch = nestedField.type.match(/\[([^;]+);\s*([^\]]+)\]/);
              if (arrayMatch && arrayMatch[1]) {
                nestedField.itemType = arrayMatch[1].trim();
              }
            }
          }
          
          // Initialize Tuple fields
          if (nestedField.isTuple) {
            if (!nestedField.tupleItems || nestedField.tupleItems.length === 0) {
              const tupleContent = nestedField.type.substring(1, nestedField.type.length - 1);
              nestedField.tupleItems = tupleContent.split(',').map((t, index) => {
                const type = t.trim();
                return { type, value: '', index };
              });
            }
          }
          
          // Initialize Option fields
          if (nestedField.isOption) {
            if (!nestedField.valueType) {
              const optionMatch = nestedField.type.match(/Option<([^>]+)>/);
              if (optionMatch && optionMatch[1]) {
                nestedField.valueType = optionMatch[1].trim();
              }
            }
            nestedField.hasValue = nestedField.hasValue || false;
          }
        }
        
        // Recursively process the nested fields
        processNestedFields(field.nestedFields, depth + 1);
      }
    }
    
    // Handle tuple fields
    if (field.isTuple && (!field.tupleItems || field.tupleItems.length === 0)) {
      const tupleContent = field.type.substring(1, field.type.length - 1);
      field.tupleItems = tupleContent.split(',').map((t, index) => {
        const type = t.trim();
        return { type, value: '', index };
      });
    }
    
    // Handle Vec fields
    if (field.isVec && (!field.items || field.items.length === 0)) {
      field.items = [{ value: '' }];
      
      // Extract item type for Vec
      if (field.type.startsWith('Vec<')) {
        const vecMatch = field.type.match(/Vec<([^>]+)>/);
        if (vecMatch && vecMatch[1]) {
          field.itemType = vecMatch[1].trim();
        }
      } else if (field.type.match(/\[.*?;.*?\]/)) {
        // Handle array notation [Type; Length]
        const arrayMatch = field.type.match(/\[([^;]+);\s*([^\]]+)\]/);
        if (arrayMatch && arrayMatch[1]) {
          field.itemType = arrayMatch[1].trim();
        }
      }
    }
    
    // Handle Option fields
    if (field.isOption) {
      const optionMatch = field.type.match(/Option<([^>]+)>/);
      if (optionMatch && optionMatch[1]) {
        field.valueType = optionMatch[1].trim();
      }
      field.hasValue = field.hasValue || false;
    }
  }
}

// Convert value to appropriate Polkadot type
function convertValueToPolkadotType(value, type) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  // Handle numeric types
  if (type && (type.includes('u8') || type.includes('u16') || type.includes('u32') ||
    type.includes('u64') || type.includes('u128') || type.includes('i8') ||
    type.includes('i16') || type.includes('i32') || type.includes('i64') ||
    type.includes('i128') || type.includes('Compact'))) {
    
    // Handle hexadecimal input
    if (typeof value === 'string' && value.startsWith('0x')) {
      return parseInt(value, 16);
    }
    
    return Number(value);
  }

  // Handle boolean
  if (type && type.includes('bool')) {
    return value === 'true' || value === true;
  }

  // Handle AccountId, Hash, etc.
  if (type && (type.includes('AccountId') || type.includes('H256') || type.includes('Hash'))) {
    // Ensure it starts with 0x if it's a hex value
    if (typeof value === 'string' && !value.startsWith('0x') && /^[0-9a-fA-F]+$/.test(value)) {
      return `0x${value}`;
    }
    return value;
  }

  // Default to string
  return value;
}

// Toggle execute mode for a function
function toggleExecuteMode(index) {
  if (index < 0 || index >= functions.value.length) return;
  functions.value[index].executeMode = !functions.value[index].executeMode;
}

// Reset parameters for a function
function resetParams(index) {
  if (index < 0 || index >= functions.value.length) return;

  const func = functions.value[index];

  func.params.forEach(param => {
    if (param.type === 'object') {
      param.properties.forEach(prop => {
        prop.value = '';
      });
    } else if (param.type === 'array') {
      param.items = [{ value: '' }];
    } else {
      param.value = '';
    }
  });

  func.result = null;
}

// Add item to array parameter
function addArrayItem(param) {
  if (!param.items) {
    param.items = [];
  }
  param.items.push({ value: '' });
}

// Remove item from array parameter
function removeArrayItem(param, index) {
  if (param.items && param.items.length > 1) {
    param.items.splice(index, 1);
  }
}

// Execute a function with given parameters
async function executeFunction(index) {
  const notInitializedMessage = "Api not initialized, please call initApi first"
  if (!apiInitialized.value) {
    apiError.value = notInitializedMessage;
    alert(notInitializedMessage)
    return;
  }
  if (index < 0 || index >= functions.value.length) return;
  const func = functions.value[index];
  func.result = 'Executing...';

  try {
    // 检查函数是否需要API
    const isApiFunction = func.name && (func.name.startsWith('query') || func.name.startsWith('tx'));

    // 对API函数检查API是否初始化
    if (isApiFunction && !apiInitialized.value) {
      func.result = notInitializedMessage;
      return;
    }

    // Prepare parameters
    const params = prepareParameters(func.params);

    // For API functions, prepend nucleusId
    if (isApiFunction) {
      params.unshift(nucleusId.value);
    }

    console.log(`Executing function ${func.name} parameters:`, params);

    // Check if we can use the imported module to call the function
    if (apiModule.value && isApiFunction) {
      try {
        // Call the function directly from the imported module
        const result = await apiModule.value.default[func.name](...params);

        // Format the result
        let formattedResult;

        try {
          // Try to format as hex if it has toHex method
          if (result && typeof result.toHex === 'function') {
            formattedResult = `Hex: ${result.toHex()}\n`;
          }

          // Try to format as JSON if it has toJSON method
          if (result && typeof result.toJSON === 'function') {
            const jsonResult = result.toJSON();
            formattedResult = (formattedResult || '') +
              `JSON: ${JSON.stringify(jsonResult, null, 2)}`;
          } else {
            // Fallback to string representation
            formattedResult = (formattedResult || '') +
              String(result);
          }
        } catch (formatError) {
          console.error('Error formatting result:', formatError);
          formattedResult = String(result);
        }

        func.result = formattedResult;
        return;
      } catch (apiError) {
        console.error(`Error calling API function ${func.name}:`, apiError);
        func.result = `API call error: ${apiError.message}`;
        return;
      }
    }

    const functionCode = func.rawCode;
    let functionBody = '';

    const stdFunctionMatch = functionCode.match(/(?:function|async function)[^{]*{([\s\S]*)\}\s*$/);
    if (stdFunctionMatch) {
      functionBody = stdFunctionMatch[1];
    } else {
      // Arrow function - block body
      const arrowBlockMatch = functionCode.match(/=>\s*{([\s\S]*)\}\s*$/);
      if (arrowBlockMatch) {
        functionBody = arrowBlockMatch[1];
      } else {
        // Arrow function - expression body
        const arrowExprMatch = functionCode.match(/=>\s*([^;{\n]*)/);
        if (arrowExprMatch) {
          functionBody = `return ${arrowExprMatch[1]};`;
        }
      }
    }

    if (!functionBody) {
      func.result = 'Unable to extract function body';
      console.error('Unable to extract function body:', functionCode);
      return;
    }

    // Create executable function (only for non-API functions)
    const paramNames = func.params.map(p => p.name).join(', ');
    const isAsync = functionCode.includes('async');

    // Use extracted function body, instead of converting the entire function
    let codeToUse = transform(functionBody, { transforms: ['typescript'] }).code;

    // Replace api. with the global api defined above
    codeToUse = codeToUse.replace(/api\./g, `window["${apiNamespace}"].api.`);

    console.log('codeToUse', codeToUse);

    // If it's an API function, we might need additional processing
    if (func.isApiCall) {
      try {
        // Try to extract the function body from the transformed code
        const funcBodyMatch = codeToUse.match(/\{([\s\S]*)\}\s*$/);
        if (funcBodyMatch && funcBodyMatch[1]) {
          codeToUse = funcBodyMatch[1].trim();
        }
      } catch (e) {
        console.error('Function conversion failed:', e);
      }
    }

    const executableCode = isAsync ?
      `  (async function(${paramNames}) {
        try {
          
${codeToUse}

        } catch (error) {
          return { error: error.message };
        }
      })
      ` :
      `  (function(${paramNames}) {
        try {
          
${codeToUse}

        } catch (error) {
          return { error: error.message };
        }
      })
      `;

    const evalFunction = eval(executableCode);

    if (isAsync) {
      const result = await evalFunction(...params);
      func.result = typeof result === 'object'
        ? JSON.stringify(result, null, 2)
        : String(result);
    } else {
      const result = evalFunction(...params);
      func.result = typeof result === 'object'
        ? JSON.stringify(result, null, 2)
        : String(result);
    }
  } catch (error) {
    console.error('Error executing function:', error);
    func.result = `Execution error: ${error.message}`;
  }
}

// 递归处理复杂类型的字段值
function processComplexTypeField(field) {
  // 检查是否是自定义类型（结构体）
  if (isCustomTypeField(field)) {
    const result = {};
    
    // 处理所有嵌套字段
    if (field.nestedFields && field.nestedFields.length > 0) {
      field.nestedFields.forEach(nestedField => {
        result[nestedField.name] = processComplexTypeField(nestedField);
      });
    }
    
    return result;
  }
  // 处理数组类型
  else if (isArrayField(field)) {
    if (!field.items || field.items.length === 0) return [];
    
    return field.items.map(item => {
      const itemType = getArrayItemType(field);
      return convertValueToType(item.value, itemType);
    });
  }
  // 处理元组类型
  else if (isTupleField(field)) {
    if (!field.tupleItems || field.tupleItems.length === 0) return [];
    
    return field.tupleItems.map(item => {
      return convertValueToType(item.value, item.type);
    });
  }
  // 处理基本类型
  else {
    return convertValueToType(field.value, field.type);
  }
}

// Prepare parameters for function execution
function prepareParameters(params) {
  return params.map(param => {
    // 处理复杂类型参数（接口类型）
    if (param.type === 'complex') {
      const result = {};
      
      // 处理接口类型的所有字段
      if (param.fields && param.fields.length > 0) {
        param.fields.forEach(field => {
          result[field.name] = processComplexTypeField(field);
        });
      }
      
      return result;
    }
    // 处理对象类型
    else if (param.type === 'object') {
      // Convert object properties to object
      const obj = {};
      param.properties.forEach(prop => {
        obj[prop.name] = convertValueToType(prop.value, prop.type);
      });
      return obj;
    }
    // 处理数组类型
    else if (param.type === 'array') {
      // Convert array items
      return param.items.map(item =>
        convertValueToType(item.value, param.itemType)
      );
    }
    // 处理元组类型
    else if (param.type === 'tuple') {
      // 确保tupleValues数组存在
      if (!param.tupleValues) param.tupleValues = param.tupleTypes.map(() => '');
      
      // 转换元组值
      return param.tupleValues.map((value, index) => 
        convertValueToType(value, param.tupleTypes[index])
      );
    }
    // 处理基本类型
    else {
      // Convert basic types
      return convertValueToType(param.value, param.type);
    }
  });
}

// Convert string value to appropriate type
function convertValueToType(value, type) {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  switch (type) {
    case 'number':
      return Number(value);
    case 'boolean':
      return value === 'true' || value === true;
    case 'object':
      try {
        return JSON.parse(value);
      } catch (e) {
        return {};
      }
    case 'array':
      try {
        return JSON.parse(value);
      } catch (e) {
        return [];
      }
    default:
      return value;
  }
}
</script>

<style scoped>
.ts-function-explorer {
  width: 100%;
}
</style>
