<template>
  <div class="json-node" :class="'level-' + level">
    <template v-if="typeof data === 'object' && data !== null">
      <div class="json-label" @click="toggleExpand">
        <span class="expand-icon">{{ expanded ? '▼' : '►' }}</span>
        <span v-if="Array.isArray(data)" class="json-key">数组 [{{ data.length }}]</span>
        <span v-else class="json-key">对象 { {{ Object.keys(data).length }} }</span>
        

        
        <!-- 如果是ABI对象，显示预览按钮 -->
        <span v-if="isAbiSchema(data)" class="preview-buttons">
          <button @click.stop="showTsPreview(data)" class="preview-btn">TS</button>
          <button @click.stop="showRustPreview(data)" class="preview-btn">Rust</button>
        </span>
      </div>
      
      <!-- ABI预览模态框 -->
      <div v-if="previewVisible" class="abi-preview-modal" @click.self="closePreview">
        <div class="abi-preview-content">
          <div class="abi-preview-header">
            <h3>{{ previewMode === 'ts' ? 'TypeScript' : 'Rust' }} 预览</h3>
            <div class="preview-controls">
              <button v-if="previewMode === 'rust'" @click="toggleRustStyle" class="style-btn">
                {{ rustUseDerives ? '简化样式' : '完整样式' }}
              </button>
              <button @click="closePreview" class="close-btn">×</button>
            </div>
          </div>
          <pre class="abi-preview-code">{{ previewCode }}</pre>
        </div>
      </div>
      
      <div v-if="expanded" class="json-children">
        <div class="rust-container">
          <div class="rust-code-block">
            <!-- 如果是结构体类型的对象 -->
            <template v-if="data.type === 'struct' || isStructLike(data)">
              <span class="rust-struct">
                <span class="rust-keyword">struct</span> <span class="rust-type">{{ getTypeName(data) }}</span> <span class="rust-bracket">{{'{'}}</span>
                
                <!-- 处理 fields 数组形式的字段定义 -->
                <template v-if="data.fields && Array.isArray(data.fields)">
                  <div v-for="field in data.fields" :key="field.name" class="rust-field">
                    <span class="rust-field-name">    {{ field.name }}</span><span class="rust-separator">: </span>
                    <span class="rust-field-type">{{ parseTypeToRust(field.type) }}</span><span class="rust-separator">,</span>
                  </div>
                </template>
                
                <!-- 处理普通对象形式的字段 -->
                <template v-else>
                  <div v-for="(value, key) in data" :key="key" class="rust-field" v-if="key !== 'type' && key !== 'name'">
                    <span class="rust-field-name">    {{ key }}</span><span class="rust-separator">: </span>
                    <span class="rust-field-type">{{ getRustType(value) }}</span><span class="rust-separator">,</span>
                  </div>
                </template>
                
                <span class="rust-bracket">{{'}'}}</span>
              </span>
            </template>
            <!-- 如果是枚举类型的对象 -->
            <template v-else-if="data.type === 'enum' || isEnumLike(data)">
              <span class="rust-enum">
                <span class="rust-keyword">pub enum</span> <span class="rust-type">{{ getTypeName(data) }}</span> <span class="rust-bracket">{{'{'}}</span>
                <div v-for="(value, key) in getEnumVariants(data)" :key="key" class="rust-variant">
                  <span class="rust-variant-name">{{ key }}</span>
                  <template v-if="typeof value === 'object' && value !== null">
                    <span class="rust-bracket">{{'{'}}</span>
                    <div v-for="(field, fieldName) in value" :key="fieldName" class="rust-field">
                      <span class="rust-field-name">{{ fieldName }}</span><span class="rust-separator">: </span>
                      <span class="rust-field-type">{{ getRustType(field) }}</span><span class="rust-separator">,</span>
                    </div>
                    <span class="rust-bracket">{{'}'}}</span>
                  </template>
                  <span v-else class="rust-separator">,</span>
                </div>
                <span class="rust-bracket">{{'}'}}</span>
              </span>
            </template>
            <!-- 其他对象类型 -->
            <template v-else>
              <div v-for="(value, key) in data" :key="key" class="rust-property">
                <span class="rust-field-name">{{ key }}</span><span class="rust-separator">: </span>
                <parse-view :data="value" :level="level + 1" />
              </div>
            </template>
          </div>
        </div>
      </div>
    </template>
    <template v-else>
      <span :class="'rust-primitive rust-' + getType(data)">
        {{ formatRustValue(data) }}
      </span>
    </template>
  </div>
</template>

<script>
import { ref } from 'vue';

export default {
  name: 'ParseView',
  props: {
    data: {
      type: [Object, Array, String, Number, Boolean, null],
      required: true
    },
    level: {
      type: Number,
      default: 0
    }
  },
  setup(props) {
    const expanded = ref(props.level < 2); // 前两层默认展开
    const previewVisible = ref(false);
    const previewCode = ref('');
    const previewMode = ref('ts'); // 'ts' 或 'rust'

    const rustUseDerives = ref(true); // 默认使用完整的Rust样式（包含派生宏等）
    
    const toggleExpand = () => {
      expanded.value = !expanded.value;
    };
    

    
    const toggleRustStyle = () => {
      rustUseDerives.value = !rustUseDerives.value;
      // 重新生成预览代码
      if (previewMode.value === 'rust') {
        previewCode.value = generateRustCode(currentPreviewData.value);
      }
    };
    
    // 存储当前预览的数据
    const currentPreviewData = ref(null);
    
    const getType = (value) => {
      if (value === null) return 'null';
      if (Array.isArray(value)) return 'array';
      return typeof value;
    };
    
    const formatValue = (value) => {
      if (value === null) return 'null';
      if (value === undefined) return 'undefined';
      if (typeof value === 'string') return `"${value}"`; 
      return String(value);
    };
    
    // 格式化Rust原始值
    const formatRustValue = (value) => {
      if (value === null) return 'None';
      if (value === undefined) return '()';
      if (typeof value === 'string') return `"${value}"`;
      if (typeof value === 'boolean') return value ? 'true' : 'false';
      if (typeof value === 'number') {
        if (Number.isInteger(value)) {
          return `${value}i32`; // Rust默认整数
        } else {
          return `${value}f64`; // Rust默认浮点数
        }
      }
      return String(value);
    };
    
    // 判断是否为ABI结构数据
    const isAbiSchema = (obj) => {
      // 检查结构体定义
      if (obj && obj.type === 'struct' && obj.name && obj.fields) {
        return true;
      }
      // 也可以扩展检查枚举等其他类型
      return false;
    };
    
    // 显示TypeScript预览
    const showTsPreview = (data) => {
      previewMode.value = 'ts';
      previewCode.value = generateTsCode(data);
      previewVisible.value = true;
    };
    
    // 显示Rust预览
    const showRustPreview = (data) => {
      previewMode.value = 'rust';
      currentPreviewData.value = data;
      previewCode.value = generateRustCode(data);
      previewVisible.value = true;
    };
    
    // 关闭预览
    const closePreview = () => {
      previewVisible.value = false;
    };
    
    // 生成TypeScript代码
    const generateTsCode = (data) => {
      if (data.type === 'struct') {
        let code = `export class ${data.name} extends Struct {\n`;
        code += `  constructor(registry: Registry, value?: any) {\n`;
        code += `    super(registry, {\n`;
        
        // 处理字段
        const fields = data.fields.map(field => {
          const typeName = parseTypeToTs(field.type);
          return `      ${field.name}: ${typeName}`;
        });
        
        code += fields.join(',\n');
        code += `\n    }, value);\n`;
        code += `  }\n\n`;
        
        // 添加getter方法
        data.fields.forEach(field => {
          code += `  get ${field.name}(): any {\n`;
          code += `    return this.get('${field.name}');\n`;
          code += `  }\n\n`;
        });
        
        // 添加from静态方法
        code += `  static from(registry: Registry, obj: any): ${data.name} | null {\n`;
        code += `    if (!obj) return null;\n`;
        code += `    return new ${data.name}(registry, obj);\n`;
        code += `  }\n`;
        code += `}`;
        
        return code;
      }
      
      return '// 不支持的类型';
    };
    
    const generateRustCode = (data) => {
      if (data.type === 'struct') {
        // 添加Rust属性和文档注释
        let code = '';
        
        // 如果有文档添加文档注释
        if (data.docs && rustUseDerives.value) {
          const docs = Array.isArray(data.docs) ? data.docs : [data.docs];
          docs.forEach(doc => {
            code += `/// ${doc}\n`;
          });
        }
        
        // 添加结构体定义
        code += rustUseDerives.value ? `pub struct ${data.name} {\n` : `struct ${data.name} {\n`;
        
        // 处理字段，添加字段文档和属性
        let fields = [];
        
        // 检查数据形式并相应处理
        if (data.fields && Array.isArray(data.fields)) {
          // 标准ABI格式
          fields = data.fields.map(field => {
            let fieldCode = '';
            
            // 根据用户偏好添加文档注释
            if (field.docs && rustUseDerives.value) {
              const docs = Array.isArray(field.docs) ? field.docs : [field.docs];
              docs.forEach(doc => {
                fieldCode += `    /// ${doc}\n`;
              });
            }
            
            // 根据用户偏好添加字段定义
            const typeName = parseTypeToRust(field.type);
            fieldCode += rustUseDerives.value 
              ? `    pub ${field.name}: ${typeName}`
              : `    ${field.name}: ${typeName}`;
            return fieldCode;
          });
        } else {
          // 处理其他格式的结构体描述
          for (const key in data) {
            if (key !== 'type' && key !== 'name' && key !== 'docs') {
              let fieldCode = '';
              const value = data[key];
              
              // 添加文档注释
              if (value.docs && rustUseDerives.value) {
                const docs = Array.isArray(value.docs) ? value.docs : [value.docs];
                docs.forEach(doc => {
                  fieldCode += `    /// ${doc}\n`;
                });
              }
              
              // 确定字段类型
              let typeStr = getRustType(value);
              if (value.type) {
                typeStr = value.type;
              }
              
              fieldCode += rustUseDerives.value 
                ? `    pub ${key}: ${typeStr}`
                : `    ${key}: ${typeStr}`;
              
              fields.push(fieldCode);
            }
          }
        }
        
        code += fields.join(',\n');
        code += `\n}`;
        
        // 根据用户偏好决定是否添加impl块
        if ((data.methods || data.name.includes('Event') || data.name.includes('Command')) && rustUseDerives.value) {
          code += `\n\nimpl ${data.name} {\n`;
          code += `    pub fn new(`;          
          // 添加构造函数参数
          const params = data.fields.map(field => {
            const typeName = parseTypeToRust(field.type);
            return `${field.name}: ${typeName}`;
          });
          code += params.join(', ');
          code += `) -> Self {\n`;
          code += `        Self {\n`;
          
          // 添加字段初始化
          const initializers = data.fields.map(field => {
            return `            ${field.name}`;
          });
          code += initializers.join(',\n');
          code += `\n        }\n`;
          code += `    }\n`;
          code += `}`;
        }
        
        return code;
      } else if (data.type === 'enum') {
        // 处理枚举类型
        let code = '';
        
        if (rustUseDerives.value) {
          code += '#[derive(Debug, Clone, PartialEq)]\n';
          
          // 添加文档注释
          if (data.docs) {
            const docs = Array.isArray(data.docs) ? data.docs : [data.docs];
            docs.forEach(doc => {
              code += `/// ${doc}\n`;
            });
          }
        }
        
        code += rustUseDerives.value 
          ? `pub enum ${data.name} {\n`
          : `enum ${data.name} {\n`;
        
        // 处理枚举变体
        if (data.variants && Array.isArray(data.variants)) {
          const variants = data.variants.map(variant => {
            let variantCode = '';
            // 根据用户偏好添加变体文档
            if (variant.docs && rustUseDerives.value) {
              const docs = Array.isArray(variant.docs) ? variant.docs : [variant.docs];
              docs.forEach(doc => {
                variantCode += `    /// ${doc}\n`;
              });
            }
            
            variantCode += `    ${variant.name}`;
            
            // 处理变体字段
            if (variant.fields && variant.fields.length > 0) {
              if (variant.fields.every(field => !field.name)) {
                // 元组变体
                variantCode += `(${variant.fields.map(field => parseTypeToRust(field.type)).join(', ')})`;
              } else {
                // 结构体变体
                variantCode += ` {\n`;
                const fields = variant.fields.map(field => {
                  return rustUseDerives.value 
                    ? `        pub ${field.name}: ${parseTypeToRust(field.type)}`
                    : `        ${field.name}: ${parseTypeToRust(field.type)}`;
                });
                variantCode += fields.join(',\n');
                variantCode += `\n    }`;
              }
            }
            
            return variantCode;
          });
          
          code += variants.join(',\n\n');
        }
        
        code += `\n}`;
        return code;
      }
      
      return '// 不支持的类型';
    };
    
    // 将类型转换为TS类型
    const parseTypeToTs = (type) => {
      // Check if type is null or undefined
      if (type === undefined || type === null) {
        return 'any';
      }
      
      if (type && type.kind === 'Path') {
        const basePath = type.path[0];
        
        // 处理Vec类型
        if (basePath === 'Vec' && type.generic_args && type.generic_args.length > 0) {
          const innerType = parseTypeToTs(type.generic_args[0]);
          return `Vec.with(${innerType})`;
        }
        
        // 映射基本类型
        const typeMap = {
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
          'String': 'Str'
        };
        
        return typeMap[basePath] || basePath;
      } else if (type && type.kind === 'Tuple') {
        // Handle Tuple type
        if (type.tuple_args && type.tuple_args.length > 0) {
          const tupleTypes = type.tuple_args.map(arg => parseTypeToTs(arg));
          return `Tuple.with([${tupleTypes.join(', ')}])`;
        }
        return 'Tuple.with([])';  
      } else if (type && type.kind === 'Array') {
        // 处理数组类型
        const elemType = parseTypeToTs(type.elem);
        return `${elemType}[]`;
      }
      
      return 'any';
    };
    
    // 将类型转换为Rust类型
    const parseTypeToRust = (type) => {
      // 检查类型是否为空
      if (type === undefined || type === null) {
        return 'unknown';
      }
      
      // 处理字符串类型描述
      if (typeof type === 'string') {
        // 处理常见类型名称转换
        const typeMap = {
          'u8': 'u8', 'u16': 'u16', 'u32': 'u32', 'u64': 'u64', 'u128': 'u128',
          'i8': 'i8', 'i16': 'i16', 'i32': 'i32', 'i64': 'i64', 'i128': 'i128',
          'f32': 'f32', 'f64': 'f64', 'bool': 'bool', 'String': 'String',
          'string': 'String', 'int': 'i32', 'float': 'f64', 'integer': 'i32',
          'number': 'f64', 'boolean': 'bool', 'array': 'Vec<T>'
        };
        
        // 如果能直接映射为已知类型则直接返回
        if (typeMap[type.toLowerCase()]) {
          return typeMap[type.toLowerCase()];
        }
        
        // 处理常见泛型类型格式
        if (type.includes('<') && type.includes('>')) {
          // 处理泛型类型
          const match = type.match(/([^<]+)<(.+)>/);
          if (match) {
            const container = match[1].trim();
            const innerType = match[2].trim();
            
            // 确保容器类型正确
            let rustContainer;
            if (container.toLowerCase() === 'vec' || container.toLowerCase() === 'vector') {
              rustContainer = 'Vec';
            } else if (container.toLowerCase() === 'option') {
              rustContainer = 'Option';
            } else if (container.toLowerCase() === 'result') {
              rustContainer = 'Result';
            } else {
              rustContainer = container;
            }
            
            // 递归处理内部类型
            const rustInnerType = parseTypeToRust(innerType);
            return `${rustContainer}<${rustInnerType}>`;
          }
        }
        
        // 尝试处理数组类型的简写形式
        if (type.endsWith('[]')) {
          const elemType = type.slice(0, -2);
          return `Vec<${parseTypeToRust(elemType)}>`;
        }
        
        return type; // 保持原样返回
      }
      
      if (type.kind === 'Path') {
        const basePath = type.path[0];
        
        // 处理泛型类型
        if (type.generic_args && type.generic_args.length > 0) {
          const innerTypes = type.generic_args.map(arg => parseTypeToRust(arg));
          
          // 处理常见集合类型
          if (basePath === 'Vec') {
            return `Vec<${innerTypes[0]}>`;
          } else if (basePath === 'Option') {
            return `Option<${innerTypes[0]}>`;
          } else if (basePath === 'Result') {
            if (innerTypes.length === 2) {
              return `Result<${innerTypes[0]}, ${innerTypes[1]}>`;
            }
            return `Result<${innerTypes[0]}, Error>`;
          } else if (basePath === 'HashMap' || basePath === 'BTreeMap') {
            if (innerTypes.length === 2) {
              return `${basePath}<${innerTypes[0]}, ${innerTypes[1]}>`; 
            }
            return `${basePath}<String, Value>`;
          } else if (basePath === 'HashSet' || basePath === 'BTreeSet') {
            return `${basePath}<${innerTypes[0]}>`;
          } else if (basePath === 'Box') {
            return `Box<${innerTypes[0]}>`;
          } else if (basePath === 'Rc' || basePath === 'Arc') {
            return `${basePath}<${innerTypes[0]}>`;
          } else {
            // 其他泛型类型
            return `${basePath}<${innerTypes.join(', ')}>`;
          }
        }
        
        // 映射基本类型
        const typeMap = {
          // 标准数值类型
          'u8': 'u8', 'u16': 'u16', 'u32': 'u32', 'u64': 'u64', 'u128': 'u128', 'usize': 'usize',
          'i8': 'i8', 'i16': 'i16', 'i32': 'i32', 'i64': 'i64', 'i128': 'i128', 'isize': 'isize',
          'f32': 'f32', 'f64': 'f64',
          
          // 其他标准类型
          'bool': 'bool',
          'String': 'String',
          'str': '&str',
          'char': 'char',
          
          // 自定义类型映射
          'Uint8': 'u8',
          'Uint16': 'u16',
          'Uint32': 'u32',
          'Uint64': 'u64',
          'Integer': 'i32',
          'Float': 'f64',
          'Text': 'String'
        };
        
        return typeMap[basePath] || basePath;
      } else if (type && type.kind === 'Array') {
        // 处理数组类型
        const elemType = parseTypeToRust(type.elem);
        const size = type.len || 0;
        return `[${elemType}; ${size}]`;
      } else if (type && type.kind === 'Reference') {
        // 处理引用类型
        const referType = parseTypeToRust(type.referType);
        const lifetime = type.lifetime ? `'${type.lifetime} ` : '';
        const mutability = type.mutable ? 'mut ' : '';
        return `&${lifetime}${mutability}${referType}`;
      } else if (type && type.kind === 'Tuple') {
        // 处理元组类型
        if (type.tuple_args && type.tuple_args.length > 0) {
          const tupleTypes = type.tuple_args.map(arg => parseTypeToRust(arg));
          return `(${tupleTypes.join(', ')})`;
        }
        return '()';
      }
      
      return 'unknown';
    };
    
    // 判断是否为结构体类似的对象
    const isStructLike = (obj) => {
      return obj && typeof obj === 'object' && !Array.isArray(obj) && 
             (obj.fields || obj.properties || (Object.keys(obj).length > 0 && !obj.variants));
    };
    
    // 判断是否为枚举类似的对象
    const isEnumLike = (obj) => {
      return obj && typeof obj === 'object' && !Array.isArray(obj) && 
             (obj.variants || obj.kind === 'enum' || obj.enumValues);
    };
    
    // 获取对象的类型名称
    const getTypeName = (obj) => {
      if (obj.name) return obj.name;
      if (obj.typeName) return obj.typeName;
      return 'UnnamedType';
    };
    
    // 获取枚举变体
    const getEnumVariants = (obj) => {
      if (obj.variants) return obj.variants;
      if (obj.enumValues) return obj.enumValues;
      
      // 尝试推断变体
      const variants = {};
      Object.keys(obj).forEach(key => {
        if (key !== 'type' && key !== 'name' && key !== 'typeName') {
          variants[key] = obj[key];
        }
      });
      return variants;
    };
    
    // 获取 Rust 类型
    const getRustType = (value) => {
      if (value === null) return 'Option<()>';
      if (value === undefined) return '()';
      if (typeof value === 'string') {
        // 处理字符串类型描述
        if (value.includes('Vec<') || value.includes('Option<') || 
            value.includes('Result<') || value.includes('String') ||
            value.match(/[ui]\d{1,3}/) || value === 'bool') {
          return value; // 已经是Rust类型字符串
        }
        return 'String';
      }
      if (typeof value === 'number') {
        return Number.isInteger(value) ? 'i32' : 'f64';
      }
      if (typeof value === 'boolean') return 'bool';
      if (Array.isArray(value)) {
        if (value.length > 0) {
          const itemType = getRustType(value[0]);
          return `Vec<${itemType}>`;
        }
        return 'Vec<T>';
      }
      if (typeof value === 'object') {
        if (value.type) {
          if (typeof value.type === 'string') {
            if (value.type.match(/^[ui]\d{1,3}$/) || 
                value.type === 'String' || value.type === 'bool') {
              return value.type; // 基本类型
            } else if (value.type === 'array' || value.type === 'vector') {
              const elemType = value.elemType ? parseTypeToRust(value.elemType) : 'T';
              return `Vec<${elemType}>`;
            } else if (value.type === 'struct') {
              return value.name || 'Struct';
            }
          }
        }
        return 'struct';
      }
      return 'unknown';
    };
    
    return {
      expanded,
      previewVisible,
      previewCode,
      previewMode,
      rustUseDerives,
      currentPreviewData,
      toggleExpand,

      toggleRustStyle,
      getType,
      formatValue,
      formatRustValue,
      isAbiSchema,
      showTsPreview,
      showRustPreview,
      closePreview,
      isStructLike,
      isEnumLike,
      getTypeName,
      getEnumVariants,
      getRustType,
      parseTypeToRust
    };
  }
}
</script>

<style scoped>
.json-node {
  padding-left: 1.5rem;
  position: relative;
}

.json-node.level-0 {
  padding-left: 0;
}

.json-label {
  cursor: pointer;
  padding: 3px 0;
  white-space: nowrap;
  display: flex;
  align-items: center;
}

.expand-icon {
  display: inline-block;
  width: 12px;
  color: #555;
  margin-right: 5px;
  font-size: 10px;
}

.json-property {
  padding: 2px 0;
}

.json-children {
  padding-left: 1rem;
}

.json-property-key {
  color: #7d2625;
  margin-right: 5px;
  font-weight: bold;
}

.json-array-index {
  color: #666;
  margin-right: 5px;
}

.rust-primitive {
  display: inline;
}

.rust-string {
  color: #718c00; /* 绿色 */
}

.rust-number {
  color: #f5871f; /* 橙色 */
}

.rust-boolean {
  color: #8959a8; /* 紫色 */
}

.rust-null {
  color: #808080; /* 灰色 */
}

/* ABI预览相关样式 */
.preview-buttons {
  margin-left: 10px;
  display: inline-flex;
  gap: 5px;
}

.preview-btn {
  background-color: #4a56e2;
  color: white;
  border: none;
  border-radius: 3px;
  padding: 2px 6px;
  font-size: 11px;
  cursor: pointer;
}

.preview-btn:hover {
  background-color: #3a46d2;
}



.abi-preview-modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.abi-preview-content {
  background-color: white;
  border-radius: 8px;
  width: 80%;
  max-width: 800px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
}

.abi-preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px 20px;
  border-bottom: 1px solid #eee;
}

.abi-preview-header h3 {
  margin: 0;
  color: #333;
}

.abi-preview-code {
  padding: 20px;
  overflow: auto;
  background-color: #f5f5f5;
  border-radius: 0 0 8px 8px;
  font-family: 'Courier New', monospace;
  line-height: 1.5;
  margin: 0;
  max-height: calc(90vh - 70px);
  white-space: pre-wrap;
}
/* Rust 语法风格 */
.rust-container {
  font-family: 'Fira Code', 'Consolas', monospace;
}

.rust-code-block {
  padding: 5px;
  background-color: #f8f8f8;
  border-radius: 3px;
  line-height: 1.5;
}

.rust-keyword {
  color: #8959a8; /* 紫色 */
  font-weight: bold;
}

.rust-type {
  color: #4271ae; /* 蓝色 */
}

.rust-field-name, .rust-variant-name {
  color: #c82829; /* 红色 */
}

.rust-field-type {
  color: #4271ae; /* 蓝色 */
}

.rust-comment {
  color: #8e908c; /* 灰色 */
  font-style: italic;
}

.rust-string {
  color: #718c00; /* 绿色 */
}

.rust-number {
  color: #f5871f; /* 橙色 */
}

.rust-boolean {
  color: #8959a8; /* 紫色 */
}

.rust-separator {
  color: #4d4d4c; /* 浅灰色 */
}

.rust-bracket {
  color: #4d4d4c; /* 浅灰色 */
}

.rust-vector-item {
  margin-left: 1rem;
}

.rust-struct, .rust-enum {
  display: block;
}

.rust-field, .rust-variant {
  margin-left: 1.5rem;
  display: block;
}
</style>
