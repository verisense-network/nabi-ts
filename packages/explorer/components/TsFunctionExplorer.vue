<template>
  <div class="ts-function-explorer">
    <!-- API初始化面板 -->
    <Card class="api-init-panel mb-6">
      <CardHeader>
        <div class="flex justify-between items-center">
          <CardTitle>API初始化</CardTitle>
          <div class="flex space-x-2">
            <Badge v-if="apiInitialized" variant="success">已连接</Badge>
            <Badge v-else variant="destructive">未连接</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div class="space-y-4">
          <div>
            <Label>API端点</Label>
            <Input v-model="apiEndpoint" placeholder="http://localhost:9944" class="mt-1" />
          </div>

          <div class="flex space-x-2 mt-4">
            <Button @click="initializeApi" :disabled="apiInitializing">
              {{ apiInitializing ? '连接中...' : apiInitialized ? '已连接' : '连接' }}
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
              {{ func.executeMode ? '返回' : '执行' }}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div class="grid" :class="{ 'grid-cols-1': !func.executeMode, 'grid-cols-2 gap-4': func.executeMode }">
            <div class="func-code">
              <pre class="bg-muted p-3 rounded whitespace-pre-wrap text-sm">{{ func.formattedCode }}</pre>
            </div>

            <div v-if="func.executeMode" class="execute-panel border-l pl-4">
              <h4 class="text-sm font-medium mb-2">输入参数</h4>
              <div class="space-y-3">
                <div v-for="(param, paramIndex) in func.params" :key="paramIndex" class="param-input">
                  <Label class="text-xs">
                    {{ param.name }} <span class="text-muted-foreground">({{ param.type }})</span>
                  </Label>

                  <!-- 嵌套对象参数 -->
                  <div v-if="isObjectType(param.type)" class="ml-4 mt-2 pl-2 border-l border-gray-200 space-y-2">
                    <div v-for="(prop, propIndex) in param.properties" :key="propIndex">
                      <Label class="text-xs">
                        {{ prop.name }} <span class="text-muted-foreground">({{ prop.type }})</span>
                      </Label>
                      <Input v-model="prop.value" :placeholder="getPlaceholder(prop.type)" class="h-8 mt-1 w-full" />
                    </div>
                  </div>

                  <!-- 数组参数 -->
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
                        添加项
                      </Button>
                    </div>
                  </div>

                  <!-- 基本类型参数 -->
                  <Input v-else v-model="param.value" :placeholder="getPlaceholder(param.type)" class="h-8 mt-1" />
                </div>

                <div class="pt-2 flex flex-col space-y-2">
                  <Button variant="outline" size="sm" @click="executeFunction(index)">
                    执行
                  </Button>
                  <Button variant="outline" size="sm" @click="resetParams(index)">
                    重置
                  </Button>
                </div>

                <div v-if="func.result" class="mt-3">
                  <Label class="text-xs">结果:</Label>
                  <pre class="bg-muted p-2 rounded text-xs mt-1 whitespace-pre-wrap">{{ func.result }}</pre>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
    <div v-else class="flex justify-center items-center h-32 border border-dashed rounded-md bg-muted/20">
      <p class="text-muted-foreground">没有可用的函数</p>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import * as codecTypes from '@polkadot/types-codec';
import { ApiPromise, HttpProvider } from '@polkadot/api';
import { TypeRegistry } from '@polkadot/types';
import { transform } from 'sucrase';

const props = defineProps({
  codeString: {
    type: String,
    required: true
  }
});

const functions = ref([]);

// API 初始化相关状态
const apiEndpoint = ref('http://localhost:9944');
const nucleusId = ref('');
const apiInitialized = ref(false);
const apiInitializing = ref(false);
const apiError = ref('');
const api = ref(null);
const apiModule = ref(null);

watch(() => props.codeString, processCodeString, { immediate: true });


const apiNamespace = `__api_${Date.now()}`;

async function initializeApi() {
  try {
    apiInitializing.value = true;
    apiError.value = '';

    // 获取代码字符串
    const code = props.codeString;
    if (!code) {
      throw new Error('No code available');
    }

    console.log('创建模拟 API 环境...');

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

    window.registry = new TypeRegistry();

    window[apiNamespace] = {
      registry: window.registry
    };


    // 真实的初始化函数 - 独立于其他API函数，直接定义在命名空间上
    window[apiNamespace].initApi = async function (endpoint) {
      console.log(`[实际连接] 使用端点初始化API: ${endpoint}`);
      const provider = new HttpProvider(endpoint);
      return await ApiPromise.create({
        provider,
        registry: window[apiNamespace].registry
      });
    };

    // 处理代码中的导出函数
    const functionNames = functions.value.map(f => f.name).filter(name => name);
    console.log('可用函数:', functionNames);

    // 注意：对于除initApi以外的函数，才需要通过API实例调用
    // 为每个函数创建一个包装器，以便于错误处理
    functionNames.forEach(funcName => {
      if (funcName !== 'initApi') { // 排除initApi函数，因为它已经单独定义
        window[apiNamespace][funcName] = async function (...args) {
          console.log(`[调用] 函数 ${funcName} 参数:`, args);
          try {
            if (!api.value) {
              throw new Error('API未初始化，请先调用initApi');
            }

            // 先尝试直接调用
            if (typeof api.value[funcName] === 'function') {
              return await api.value[funcName](...args);
            }
            // 尝试在query命名空间查找
            else if (api.value.query && typeof api.value.query[funcName] === 'function') {
              return await api.value.query[funcName](...args);
            }
            // 尝试在tx命名空间查找
            else if (api.value.tx && typeof api.value.tx[funcName] === 'function') {
              return await api.value.tx[funcName](...args);
            }
            // 尝试在rpc命名空间查找
            else if (api.value.rpc && api.value.rpc[funcName]) {
              // rpc可能有子命名空间
              if (typeof api.value.rpc[funcName] === 'function') {
                return await api.value.rpc[funcName](...args);
              } else {
                // 遍历子命名空间
                for (const subspace in api.value.rpc[funcName]) {
                  if (typeof api.value.rpc[funcName][subspace] === 'function') {
                    return await api.value.rpc[funcName][subspace](...args);
                  }
                }
              }
            }

            // 如果所有尝试都失败
            throw new Error(`函数 ${funcName} 在API中不存在`);
          } catch (error) {
            console.error(`调用函数 ${funcName} 时出错:`, error);
            throw error;
          }
        };
      }
    });

    console.log('真实API环境已就绪');

    // 保存模拟模块引用
    apiModule.value = {
      default: window[apiNamespace]
    };

    // 直接调用我们自己定义的initApi函数，而不是通过api.value
    api.value = await window[apiNamespace].initApi(apiEndpoint.value);
    window[apiNamespace].api = api.value;
    console.log('API实例成功创建:', api.value);
    apiInitialized.value = true;
  } catch (error) {
    console.error('API initialization error:', error);
    apiError.value = `API初始化错误: ${error.message}`;
    apiInitialized.value = false;
  } finally {
    apiInitializing.value = false;
  }
}

// Extract functions from TypeScript code
function processCodeString() {
  try {
    // Reset functions array
    functions.value = [];

    const code = props.codeString;
    if (!code || typeof code !== 'string') return;

    console.log(`代码长度: ${code.length}`);

    // 提取所有类型的函数（一次性提取）
    extractAllFunctions(code);

    console.log(`找到 ${functions.value.length} 个函数`);
  } catch (error) {
    console.error('Error parsing code:', error);
  }
}

// 提取所有类型的函数
function extractAllFunctions(code) {
  // 使用统一的正则表达式提取所有类型的导出函数
  const functionRegex = /export\s+(const|function|async\s+function)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*(?:=\s*)?\(([^)]*)\)[^{=]*(?:=>|{)/g;

  let match;
  while ((match = functionRegex.exec(code)) !== null) {
    try {
      const type = match[1]; // const, function 或 async function
      const name = match[2]; // 函数名
      const paramsString = match[3]; // 参数字符串

      console.log(`找到函数: ${name} (${type})`);

      // 提取完整函数代码
      const startIndex = match.index;
      let endIndex = startIndex;

      // 查找函数结束位置
      if (type === 'const') {
        // 处理箭头函数
        const arrowPos = code.indexOf('=>', startIndex);
        if (arrowPos > 0) {
          // 检查是花括号开始还是直接表达式
          const nextChar = code.substring(arrowPos + 2).trim()[0];
          if (nextChar === '{') {
            // 块体箭头函数
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
            // 表达式体箭头函数
            const semicolonPos = code.indexOf(';', arrowPos);
            if (semicolonPos > 0) {
              endIndex = semicolonPos + 1;
            } else {
              // 如果没有分号，尝试找到下一个导出或函数结束
              const nextExportPos = code.indexOf('export', arrowPos);
              endIndex = nextExportPos > 0 ? nextExportPos : code.length;
            }
          }
        }
      } else {
        // 处理标准函数和异步函数
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
        console.error(`无法确定函数 ${name} 的结束位置`);
        continue;
      }

      // 提取完整函数代码
      const functionCode = code.substring(startIndex, endIndex).trim();
      console.log(`函数代码长度: ${functionCode.length}`);

      // 解析参数
      const params = parseParameters(paramsString);

      // 确定函数类型
      let functionType = 'function';
      if (type === 'const') {
        functionType = 'arrow function';
      } else if (type.includes('async')) {
        functionType = 'async function';
      }

      // 创建函数对象
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
      console.error('提取函数出错:', err);
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

// Get placeholder based on type
function getPlaceholder(type) {
  switch (type) {
    case 'string':
      return 'Text...';
    case 'number':
      return '0';
    case 'boolean':
      return 'true/false';
    case 'object':
      return '{}';
    case 'array':
      return '[]';
    default:
      return type;
  }
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
  if (index < 0 || index >= functions.value.length) return;
  const func = functions.value[index];
  func.result = '执行中...';

  try {
    // 检查函数是否需要API
    const isApiFunction = func.name && (func.name.startsWith('query') || func.name.startsWith('tx'));

    // 对API函数检查API是否初始化
    if (isApiFunction && !apiInitialized.value) {
      func.result = 'API未初始化，请先初始化API';
      return;
    }

    // Prepare parameters
    const params = prepareParameters(func.params);

    // For API functions, prepend nucleusId
    if (isApiFunction) {
      params.unshift(nucleusId.value);
    }

    console.log(`执行函数 ${func.name} 参数:`, params);

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
        func.result = `API调用错误: ${apiError.message}`;
        return;
      }
    }

    // Fallback to client-side execution for non-API functions or if API module not available
    // Create a function from the code
    const functionCode = func.rawCode;

    // 提取函数体
    let functionBody = '';

    // 标准函数或异步函数
    const stdFunctionMatch = functionCode.match(/(?:function|async function)[^{]*{([\s\S]*)\}\s*$/);
    if (stdFunctionMatch) {
      functionBody = stdFunctionMatch[1];
    } else {
      // 箭头函数 - 块体
      const arrowBlockMatch = functionCode.match(/=>\s*{([\s\S]*)\}\s*$/);
      if (arrowBlockMatch) {
        functionBody = arrowBlockMatch[1];
      } else {
        // 箭头函数 - 表达式体
        const arrowExprMatch = functionCode.match(/=>\s*([^;{\n]*)/);
        if (arrowExprMatch) {
          functionBody = `return ${arrowExprMatch[1]};`;
        }
      }
    }

    if (!functionBody) {
      func.result = '无法提取函数体';
      console.error('无法提取函数体:', functionCode);
      return;
    }

    // Create executable function (only for non-API functions)
    const paramNames = func.params.map(p => p.name).join(', ');
    const isAsync = functionCode.includes('async');

    // 直接使用提取出的函数体，而不是转换整个函数
    let codeToUse = transform(functionBody, { transforms: ['typescript'] }).code;

    // 替换 api. 为 全局上面定义的 api
    codeToUse = codeToUse.replace(/api\./g, `window["${apiNamespace}"].api.`);

    // 如果是API函数，可能需要额外处理
    if (func.isApiCall) {
      try {
        // 尝试从转换后的代码中提取函数体
        const funcBodyMatch = codeToUse.match(/\{([\s\S]*)\}\s*$/);
        if (funcBodyMatch && funcBodyMatch[1]) {
          codeToUse = funcBodyMatch[1].trim();
        }
      } catch (e) {
        console.error('函数转换失败:', e);
        // 转换失败时仍然使用原始函数体
      }
    }

    console.log(`处理后函数代码: ${codeToUse}`);

    // Use an async wrapper if needed
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

    console.log(`可执行代码: ${executableCode}`);

    // Execute function with eval (for demo purposes only)
    // In a real application, you'd want a safer evaluation method
    const evalFunction = eval(executableCode);

    // Handle async functions
    if (isAsync) {
      const result = await evalFunction(...params);
      // Format and display result
      func.result = typeof result === 'object'
        ? JSON.stringify(result, null, 2)
        : String(result);
    } else {
      const result = evalFunction(...params);
      // Format and display result
      func.result = typeof result === 'object'
        ? JSON.stringify(result, null, 2)
        : String(result);
    }
  } catch (error) {
    console.error('Error executing function:', error);
    func.result = `执行错误: ${error.message}`;
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
