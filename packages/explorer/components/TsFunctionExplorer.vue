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
                  <Label class="text-xs">
                    {{ param.name }} <span class="text-muted-foreground">({{ param.type }})</span>
                  </Label>

                  <div v-if="isObjectType(param.type)" class="ml-4 mt-2 pl-2 border-l border-gray-200 space-y-2">
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
                        Add Item
                      </Button>
                    </div>
                  </div>

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
import { ref, watch, computed } from 'vue';
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

    window.Bool = codecTypes.Bool;
    window.Bytes = codecTypes.Bytes;
    window.Null = codecTypes.Null;
    window.Struct = codecTypes.Struct;
    window.Option = codecTypes.Option;
    window.Result = codecTypes.Result;
    window.Vec = codecTypes.Vec;
    window.VecFixed = codecTypes.VecFixed;
    window.Tuple = codecTypes.Tuple;
    
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
  
  // Extract standalone struct definitions (struct A { ... })
  extractStructDefinitions(code, extractedClasses);
  
  // Extract class definitions (export class A extends Struct { ... })
  extractClassDefinitions(code, extractedClasses);
  
  return extractedClasses;
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

      // Handle object type
      if (type && (type.includes('{') || type.startsWith('Record<') || type.startsWith('object'))) {
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
  return type === 'object';
}

// Check if type is an array type
function isArrayType(type) {
  return type === 'array';
}

// Check if a type is a Polkadot struct type and return the struct if found
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
    default:
      return '';
  }
}

// Get placeholder for Polkadot type
function getPlaceholderForType(type) {
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
    return field.items.map(item => convertValueToPolkadotType(item.value, field.itemType));
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

// Prepare parameters for function execution
function prepareParameters(params) {
  return params.map(param => {
    if (param.type === 'object') {
      // Convert object properties to object
      const obj = {};
      param.properties.forEach(prop => {
        obj[prop.name] = convertValueToType(prop.value, prop.type);
      });
      return obj;
    } else if (param.type === 'array') {
      // Convert array items
      return param.items.map(item =>
        convertValueToType(item.value, param.itemType)
      );
    } else {
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
