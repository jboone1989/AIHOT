import assert from "node:assert/strict";
import { test } from "node:test";
import { PRESETS } from "@aihot/site/models";

test("NVIDIA prototype presets use the NVIDIA key, independent from paid providers", () => {
  const keys = ["nvidia-gpt-oss-20b", "nvidia-glm-5.3-flash", "nvidia-nemotron-lightning"];
  for (const key of keys) {
    const preset = PRESETS[key];
    assert.ok(preset);
    assert.equal(preset.service, "nvidia");
    assert.equal(preset.baseUrlEnv, "NVIDIA_BASE_URL");
    assert.equal(preset.apiKeyEnv, "NVIDIA_API_KEY");
    assert.equal(preset.jsonMode, false);
    if(key !== "nvidia-nemotron-lightning") assert.equal(preset.extra?.reasoning_effort, "low");
  }
  assert.equal(PRESETS["nvidia-gpt-oss-20b"]?.model, "openai/gpt-oss-20b");
  assert.equal(PRESETS["nvidia-glm-5.3-flash"]?.model, "z-ai/glm-5.3-flash");
  assert.equal(PRESETS["nvidia-gpt-oss-20b"]?.vision, undefined);
  assert.equal(PRESETS["nvidia-glm-5.3-flash"]?.vision, true);
  assert.equal(PRESETS["nvidia-nemotron-lightning"]?.model, "nvidia/nemotron-3.5-lightning-30b-a3b");
  assert.deepEqual(PRESETS["nvidia-nemotron-lightning"]?.extra, {chat_template_kwargs:{enable_thinking:false}});
});
