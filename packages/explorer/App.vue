<template>
  <main>
    <header>
      <h1>Nabi-TS Generator</h1>
      <p>Convert JSON ABI to TypeScript code</p>
    </header>

    <div class="container">
      <Card>
        <CardHeader>
          <CardTitle>JSON ABI Input</CardTitle>
          <CardAction class="space-x-2">
            <Button @click="loadExample">Load Example</Button>
            <Button>
              <label class="w-full">
                Import JSON
                <input type="file" accept=".json" @change="handleFileSelect" class="file-input" />
              </label>
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent class="px-4">
          <textarea class="w-full border-2 whitespace-pre prose font-mono" v-model="jsonInput"
            placeholder="Paste your JSON ABI here..." rows="15"></textarea>
        </CardContent>
      </Card>

      <div class="flex gap-2 justify-center my-4">
        <Button @click="parseView" :disabled="!jsonInput">
          Parse Preview
        </Button>
        <Button @click="handleSubmit" :disabled="isLoading || !jsonInput">
          {{ isLoading ? "Converting..." : "Convert to TypeScript" }}
        </Button>
      </div>

      <div class="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Parse Preview</CardTitle>
            <CardAction class="space-x-2">
              <Button @click="copyToClipboard">Copy to Clipboard</Button>
            </CardAction>

          </CardHeader>
          <CardContent class="px-4 font-mono overflow-scroll">
            <div v-if="parsedJsonData" class="prose">
              <JsonStructViewer :jsonData="parsedJsonData" />
            </div>
            <div v-else-if="error" class="error">
              <p>Error: {{ error }}</p>
            </div>
            <div v-else class="placeholder">
              <p>Generated TypeScript will appear here</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>TypeScript Output</CardTitle>
            <CardAction class="space-x-2">
              <Button @click="copyToClipboard">Copy to Clipboard</Button>
            </CardAction>
          </CardHeader>
          <CardContent class="px-4 font-mono">
            <div v-if="tsOutput" class="prose">
              <pre class="whitespace-pre max-h-64 overflow-scroll">{{ tsOutput }}</pre>
            </div>
            <div v-else-if="error" class="error">
              <p>Error: {{ error }}</p>
            </div>
            <div v-else class="placeholder">
              <p>Generated TypeScript will appear here</p>
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  </main>
</template>

<script setup>
import { ref } from 'vue';
import JsonStructViewer from './components/JsonStructViewer.vue';
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardAction, CardContent } from '@/components/ui/card'
import { generateCode } from '@nabi-ts/cli/src/generator.js'
import testJson from '@nabi-ts/cli/data/data.json';

const jsonInput = ref("");
const tsOutput = ref("");
const error = ref("");
const isLoading = ref(false);
const parsedJsonData = ref(null);
const showJsonPreview = ref(false);

function loadExample() {
  jsonInput.value = JSON.stringify(testJson, null, 2);
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

async function handleSubmit() {
  error.value = "";
  isLoading.value = true;

  try {
    const entries = JSON.parse(jsonInput.value);

    const code = await generateCode(entries);

    tsOutput.value = code;
  } catch (e) {
    console.error('Error generating code:', e);
    error.value = e instanceof SyntaxError ? "Invalid JSON format" : e.message;
    tsOutput.value = "";
  } finally {
    isLoading.value = false;
  }
}

function parseView() {
  error.value = "";
  try {
    const jsonData = JSON.parse(jsonInput.value);
    parsedJsonData.value = jsonData;
    showJsonPreview.value = true;
  } catch (e) {
    error.value = e instanceof SyntaxError ? "Invalid JSON format" : e.message;
  }
}

function closeJsonPreview() {
  showJsonPreview.value = false;
}
</script>

<style>
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
  margin-bottom: 0.5rem;
}

.container {
  display: flex;
  flex-direction: column;
}

.file-input {
  display: none;
}
</style>
