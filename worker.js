import {
  AutoTokenizer,
  AutoModelForCausalLM,
  TextStreamer,
  InterruptableStoppingCriteria,
} from "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.5.0/+esm";

/**
 * Helper function to perform feature detection for WebGPU
 */
async function check() {
  try {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
      throw new Error("WebGPU is not supported (no adapter found)");
    }
  } catch (e) {
    self.postMessage({
      status: "error",
      data: e.toString(),
    });
  }
}

/**
 * This class uses the Singleton pattern to enable lazy-loading of the pipeline
 */
class TextGenerationPipeline {
  static model_id = "HuggingFaceTB/SmolLM2-1.7B-Instruct";
  
  static async getInstance(progress_callback = null) {
    const wrappedCallback = (progress) => {
      console.log('Raw progress data:', progress);
      
      // Only report .onnx file loading progress
      if (progress?.file?.includes('model_q4f16.onnx')) {
        const modelName = TextGenerationPipeline.model_id.split('/').pop();
        // Only send progress for actual loading updates
        if (progress.status === 'progress') {
          const loaded = progress.loaded || 0;
          self.postMessage({
            status: 'progress',
            loaded,
            modelName
          });
        } else if (progress.status === 'done') {
          self.postMessage({
            status: 'progress_complete',
            modelName
          });
        }
      }
    };

    if (!this.tokenizer) {
      console.log('Loading tokenizer...');
      this.tokenizer = await AutoTokenizer.from_pretrained(this.model_id);
    }

    if (!this.model) {
      const modelName = this.model_id.split('/').pop();
      self.postMessage({
        status: 'loading',
        modelName,
        data: `Loading ${modelName}...`
      });
      
      this.model = await AutoModelForCausalLM.from_pretrained(this.model_id, {
        dtype: "q4f16",
        device: "webgpu",
        progress_callback: wrappedCallback,
      });
    }

    return [this.tokenizer, this.model];
  }
}

const stopping_criteria = new InterruptableStoppingCriteria();

let past_key_values_cache = null;
async function generate(messages, speaker = null) {
  // Retrieve the text-generation pipeline.
  const [tokenizer, model] = await TextGenerationPipeline.getInstance();

  const inputs = tokenizer.apply_chat_template(messages, {
    add_generation_prompt: true,
    return_dict: true,
  });

  let startTime;
  let numTokens = 0;
  let tps;

  const token_callback_function = () => {
    startTime ??= performance.now();
    if (numTokens++ > 0) {
      tps = (numTokens / (performance.now() - startTime)) * 1000;
    }
  };

  const callback_function = (output) => {
    // Filter out any chat template artifacts during streaming
    if (output && 
        !output.toLowerCase().includes('assistant') &&
        !output.includes('You are Alex') && 
        !output.includes('You are Taylor') &&
        !output.includes('system') &&
        !output.includes('user') &&
        !output.includes('<|') &&
        !output.includes('|>') &&
        output.trim().length > 0) {
      // Send each token to the main thread
      self.postMessage({
        status: "token",
        output: output,
        speaker: speaker
      });
    }
  };

  const streamer = new TextStreamer(tokenizer, {
    skip_prompt: true,
    skip_special_tokens: true,
    callback_function,
    token_callback_function,
  });

  // Tell the main thread we are starting
  self.postMessage({ 
    status: "start",
    speaker: speaker 
  });

  const { past_key_values, sequences } = await model.generate({
    ...inputs,
    past_key_values: past_key_values_cache,
    do_sample: true,
    temperature: 0.8,
    top_p: 0.9,
    max_new_tokens: 256,
    streamer,
    stopping_criteria,
    return_dict_in_generate: true,
  });
  past_key_values_cache = past_key_values;

  const decoded = tokenizer.batch_decode(sequences, {
    skip_special_tokens: true,
  });

  // Clean up the final output to get just the assistant's response
  let finalOutput = decoded[0];
  
  // Remove the original prompt by finding the last occurrence of common chat template patterns
  const patterns = [
    'assistant\n',
    'Assistant:',
    'assistant:',
    '<|assistant|>',
    '</s>assistant\n',
    'assistant',
    '<|im_start|>assistant',
    '<|im_end|>'
  ];
  
  for (const pattern of patterns) {
    if (finalOutput.includes(pattern)) {
      const parts = finalOutput.split(pattern);
      if (parts.length > 1) {
        finalOutput = parts[parts.length - 1];
        break;
      }
    }
  }
  
  // Additional cleanup: remove any remaining template artifacts
  finalOutput = finalOutput
    .replace(/assistant\n?/gi, '')
    .replace(/Assistant:?\n?/gi, '')
    .replace(/<\|.*?\|>/g, '')
    .replace(/system\n?/gi, '')
    .replace(/user\n?/gi, '')
    .replace(/You are (Alex|Taylor)[^\n]*/gi, '');
  
  // Remove any remaining system prompt leakage and clean up lines
  const lines = finalOutput.split('\n');
  finalOutput = lines.filter(line => {
    const cleanLine = line.trim().toLowerCase();
    return cleanLine.length > 0 && 
           !cleanLine.includes('you are alex') && 
           !cleanLine.includes('you are taylor') &&
           !cleanLine.includes('assistant') &&
           !cleanLine.includes('system') &&
           !cleanLine.includes('user');
  }).join('\n');
  
  finalOutput = finalOutput.trim();

  // Send the complete output
  self.postMessage({
    status: "complete",
    output: finalOutput,
    speaker: speaker
  });
}

async function load() {
  self.postMessage({
    status: "loading",
    data: "Initializing model loading...",
  });

  // Load the pipeline and save it for future use
  const [tokenizer, model] = await TextGenerationPipeline.getInstance();

  // Warm up the model
  const inputs = tokenizer("a");
  await model.generate({ ...inputs, max_new_tokens: 1 });

  self.postMessage({ 
    status: "ready"
  });
}

// Listen for messages from the main thread
self.addEventListener("message", async (e) => {
  const { type, data, speaker } = e.data;

  switch (type) {
    case "check":
      check();
      break;

    case "load":
      load();
      break;

    case "generate":
      stopping_criteria.reset();
      generate(data, speaker);
      break;

    case "interrupt":
      stopping_criteria.interrupt();
      break;

    case "reset":
      past_key_values_cache = null;
      stopping_criteria.reset();
      break;
  }
});
