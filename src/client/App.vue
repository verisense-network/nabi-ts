<template>
  <main>
    <header>
      <h1>Nabi-TS Generator</h1>
      <p>Convert JSON ABI to TypeScript code</p>
    </header>

    <div class="container">
      <div class="input-section">
        <h2>JSON ABI Input</h2>
        <div class="actions">
          <button @click="loadExample">Load Example</button>
          <label class="file-btn">
            Import JSON
            <input type="file" accept=".json" @change="handleFileSelect" class="file-input" />
          </label>
        </div>
        <textarea
          v-model="jsonInput"
          placeholder="Paste your JSON ABI here..."
          rows="15"
        ></textarea>
      </div>

      <div class="controls">
        <div class="button-group">
          <button
            class="convert-btn"
            @click="handleSubmit"
            :disabled="isLoading || !jsonInput"
          >
            {{ isLoading ? "Converting..." : "Convert to TypeScript" }}
          </button>
          <button
            class="preview-btn"
            @click="renderJsonData"
            :disabled="!jsonInput"
          >
            Parse Preview
          </button>
        </div>
      </div>

      <div class="output-section">
        <h2>TypeScript Output</h2>
        <div v-if="tsOutput" class="output-content">
          <div class="actions">
            <button @click="copyToClipboard">Copy to Clipboard</button>
          </div>
          <pre>{{ tsOutput }}</pre>
        </div>
        <div v-else-if="error" class="error">
          <p>Error: {{ error }}</p>
        </div>
        <div v-else class="placeholder">
          <p>Generated TypeScript will appear here</p>
        </div>
      </div>
      
      <div class="parse-view-section" v-if="showJsonPreview">
        <h2>Parse Preview</h2>
        <div class="actions">
          <button @click="closeJsonPreview">Close Preview</button>
        </div>
        <div class="parse-view-container">
          <div v-for="(item, index) in parsedJsonData" :key="index" class="parse-view-item">
            <parse-view :data="item" :level="0" />
          </div>
        </div>
      </div>
    </div>
  </main>
</template>

<script setup>
import { ref } from 'vue';
import ParseView from './components/ParseView.vue';

const jsonInput = ref("");
const tsOutput = ref("");
const error = ref("");
const isLoading = ref(false);
const parsedJsonData = ref([]);
const showJsonPreview = ref(false);

async function handleSubmit() {
  error.value = "";
  isLoading.value = true;

  try {
    // Validate JSON input
    JSON.parse(jsonInput.value);

    // Send data to the API
    const response = await fetch("/api/convert", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ json: jsonInput.value }),
    });

    const data = await response.json();

    if (data.error) {
      error.value = data.error;
      tsOutput.value = "";
    } else {
      tsOutput.value = data.code;
    }
  } catch (e) {
    error.value = e instanceof SyntaxError ? "Invalid JSON format" : e.message;
    tsOutput.value = "";
  } finally {
    isLoading.value = false;
  }
}

function loadExample() {
  jsonInput.value = JSON.stringify(
    [
      {
          "fields": [
              {
                  "name": "a",
                  "type": {
                      "generic_args": [
                          {
                              "generic_args": [],
                              "kind": "Path",
                              "path": [
                                  "u32"
                              ]
                          }
                      ],
                      "kind": "Path",
                      "path": [
                          "Vec"
                      ]
                  }
              },
              {
                  "name": "b",
                  "type": {
                      "generic_args": [],
                      "kind": "Path",
                      "path": [
                          "i32"
                      ]
                  }
              },
              {
                  "name": "c",
                  "type": {
                      "generic_args": [],
                      "kind": "Path",
                      "path": [
                          "u32"
                      ]
                  }
              }
          ],
          "name": "E",
          "type": "struct"
      },
    ],
    null,
    2
  );
}

function handleFileSelect(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const content = e.target.result;
      JSON.parse(content);
      jsonInput.value = content;
      error.value = "";
    } catch (err) {
      error.value = "Selected file contains invalid JSON";
    }
  };
  reader.onerror = () => {
    error.value = "Error reading file";
  };
  reader.readAsText(file);
  
  event.target.value = null;
}

function copyToClipboard() {
  navigator.clipboard
    .writeText(tsOutput.value)
    .then(() => {
      alert("Code copied to clipboard!");
    })
    .catch((err) => {
      console.error("Failed to copy code:", err);
    });
}

function renderJsonData() {
  error.value = "";
  try {
    const jsonData = JSON.parse(jsonInput.value);
    parsedJsonData.value = Array.isArray(jsonData) ? jsonData : [jsonData];
    showJsonPreview.value = true;
  } catch (e) {
    error.value = e instanceof SyntaxError ? "无效的JSON格式" : e.message;
  }
}

function closeJsonPreview() {
  showJsonPreview.value = false;
}
</script>

<style>
body {
  margin: 0;
  font-family:
    -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu,
    Cantarell, "Open Sans", "Helvetica Neue", sans-serif;
  background-color: #f5f5f5;
  color: #333;
}

main {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}

header {
  text-align: center;
  margin-bottom: 2rem;
}

h1 {
  color: #4a56e2;
  margin-bottom: 0.5rem;
}

.container {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1.5rem;
}

@media (min-width: 900px) {
  .container {
    grid-template-columns: 1fr 1fr;
  }

  .controls {
    grid-column: span 2;
    display: flex;
    justify-content: center;
  }
  
  .json-preview-section {
    grid-column: span 2;
  }
}

.input-section,
.output-section {
  background-color: white;
  border-radius: 8px;
  padding: 1.5rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

h2 {
  margin-top: 0;
  color: #555;
  font-size: 1.3rem;
}

textarea,
pre {
  width: 100%;
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 1rem;
  font-family: "Courier New", monospace;
  font-size: 14px;
  box-sizing: border-box;
}

pre {
  background-color: #f8f8f8;
  overflow: auto;
  max-height: 400px;
  margin: 0;
}

button {
  background-color: #e0e0e0;
  border: none;
  border-radius: 4px;
  padding: 0.5rem 1rem;
  cursor: pointer;
  font-size: 14px;
  transition: background-color 0.2s;
}

button:hover {
  background-color: #d0d0d0;
}

.convert-btn {
  background-color: #4a56e2;
  color: white;
  padding: 0.7rem 2rem;
  font-size: 16px;
  margin: 1rem 0;
}

.convert-btn:hover {
  background-color: #3a46d2;
}

.convert-btn:disabled {
  background-color: #9aa0e2;
  cursor: not-allowed;
}

.preview-btn {
  background-color: #42b983;
  color: white;
  padding: 0.7rem 2rem;
  font-size: 16px;
  margin: 1rem 0;
}

.preview-btn:hover {
  background-color: #3aa876;
}

.preview-btn:disabled {
  background-color: #96d8bd;
  cursor: not-allowed;
}

.button-group {
  display: flex;
  gap: 1rem;
}

.actions {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 0.5rem;
}

.error {
  color: #d32f2f;
  background-color: #ffebee;
  padding: 1rem;
  border-radius: 4px;
  border-left: 4px solid #d32f2f;
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

.file-btn {
  display: inline-block;
  background-color: #e0e0e0;
  border: none;
  border-radius: 4px;
  padding: 0.5rem 1rem;
  cursor: pointer;
  font-size: 14px;
  transition: background-color 0.2s;
  margin-left: 8px;
}

.file-btn:hover {
  background-color: #d0d0d0;
}

.file-input {
  display: none;
}

.parse-view-section {
  background-color: white;
  border-radius: 8px;
  padding: 1.5rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  margin-top: 1.5rem;
}

.parse-view-container {
  max-height: 500px;
  overflow: auto;
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 1rem;
  background-color: #f8f8f8;
}


</style>
