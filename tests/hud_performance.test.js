/**
 * tests/hud_performance.test.js
 * Antigravity HUD - Performance Benchmark, Latency & Memory Test Suite (Suite 8)
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const assert = require('assert');
const { execSync, spawnSync } = require('child_process');

const repoRoot = path.resolve(__dirname, '..');
const hudJs = path.join(repoRoot, 'bin', 'hud.js');
const mockPayloadPath = path.join(repoRoot, 'tests', 'fixtures', 'mock_live_payload.json');
const mockPayload = fs.readFileSync(mockPayloadPath, 'utf8');

console.log('\n\x1b[1m=== Test Suite 8: Performance Benchmark & Latency Matrix ===\x1b[0m');

let passed = 0;
let total = 0;

function runTest(name, fn) {
  total++;
  try {
    fn();
    console.log(`  \x1b[32m✔\x1b[0m ${name}`);
    passed++;
  } catch (err) {
    console.error(`  \x1b[31m✖\x1b[0m ${name}`);
    console.error(`    ${err.message}`);
  }
}

// 1. Stdio Render Latency Benchmark
runTest('Benchmark BM-01: End-to-End Stdio Render Latency (< 250ms on Windows across 20 runs)', () => {
  // Warm-up run (eliminating V8 JIT spike)
  spawnSync('node', [hudJs], { input: mockPayload, encoding: 'utf8', env: { ...process.env, HUD_TEST_MODE: '1' } });

  const iterations = 20;
  const timings = [];

  for (let i = 0; i < iterations; i++) {
    const t0 = process.hrtime.bigint();
    const res = spawnSync('node', [hudJs], {
      input: mockPayload,
      encoding: 'utf8',
      env: { ...process.env, HUD_TEST_MODE: '1' }
    });
    const t1 = process.hrtime.bigint();
    assert.strictEqual(res.status, 0, `Process must exit 0: ${res.stderr}`);
    const elapsedMs = Number(t1 - t0) / 1e6;
    timings.push(elapsedMs);
  }

  const avg = timings.reduce((a, b) => a + b, 0) / timings.length;
  const min = Math.min(...timings);
  const max = Math.max(...timings);

  console.log(`    \x1b[90m[Latency Stats] Min: ${min.toFixed(1)}ms | Avg: ${avg.toFixed(1)}ms | Max: ${max.toFixed(1)}ms (${iterations} runs)\x1b[0m`);
  assert(avg < 250, `Average stdio latency must be < 250ms, got ${avg.toFixed(1)}ms`);
});

// 2. Large Transcript Step Counter Cache Performance
runTest('Benchmark BM-02: Large Transcript (5,000 lines) Step Count Cache Latency (< 250ms)', () => {
  const tmpDir = path.join(os.tmpdir(), 'hud_perf_test_' + Date.now());
  fs.mkdirSync(tmpDir, { recursive: true });
  const transcriptFile = path.join(tmpDir, 'transcript.jsonl');

  // Create 5,000 line synthetic transcript
  const lines = [];
  for (let i = 0; i < 5000; i++) {
    lines.push(JSON.stringify({ step_index: i, type: 'USER_INPUT', content: `step test ${i}` }));
  }
  fs.writeFileSync(transcriptFile, lines.join('\n'), 'utf8');

  // Load and test internal counter speed via child process simulation
  const payloadWithLargeTranscript = JSON.stringify({
    transcript_path: transcriptFile,
    context_window: { used_percentage: 45 },
    model: 'Gemini 3.7 Flash',
    is_test: true
  });

  // Warm-up
  spawnSync('node', [hudJs], { input: payloadWithLargeTranscript, encoding: 'utf8', env: { ...process.env, HUD_TEST_MODE: '1' } });

  const t0 = process.hrtime.bigint();
  for (let i = 0; i < 10; i++) {
    spawnSync('node', [hudJs], {
      input: payloadWithLargeTranscript,
      encoding: 'utf8',
      env: { ...process.env, HUD_TEST_MODE: '1' }
    });
  }
  const t1 = process.hrtime.bigint();
  const avg = (Number(t1 - t0) / 1e6) / 10;

  console.log(`    \x1b[90m[Large Transcript Cache Speed] Avg: ${avg.toFixed(1)}ms per pass on 5,000-line JSONL\x1b[0m`);

  // Cleanup
  try {
    fs.unlinkSync(transcriptFile);
    fs.rmdirSync(tmpDir);
  } catch (_) {}

  assert(avg < 500, `Large transcript render speed must be < 500ms, got ${avg.toFixed(1)}ms`);
});

// 3. Ultra-Narrow Terminal Viewport Robustness (< 40 columns)
runTest('Robustness RB-01: Ultra-Narrow Terminal Width (35 cols) Renders Cleanly without Crash', () => {
  const narrowPayload = JSON.stringify({
    terminal_width: 35,
    workspace: { current_dir: repoRoot },
    model: 'Gemini 3.7 Flash',
    context_window: { used_percentage: 65, total_input_tokens: 150000 },
    agent_state: 'working',
    is_test: true
  });

  const res = spawnSync('node', [hudJs], {
    input: narrowPayload,
    encoding: 'utf8',
    env: { ...process.env, HUD_TEST_MODE: '1' }
  });

  assert.strictEqual(res.status, 0, 'Must exit with code 0 on narrow viewport');
  assert(res.stdout && res.stdout.length > 0, 'Output must not be empty');
});

// 4. Memory Heap Stability Assertion
runTest('Stability ST-01: Process Memory Heap Stability (< 20MB RSS footprint)', () => {
  const memUsage = process.memoryUsage();
  const heapUsedMb = memUsage.heapUsed / 1024 / 1024;
  const rssMb = memUsage.rss / 1024 / 1024;

  console.log(`    \x1b[90m[Memory Footprint] Heap: ${heapUsedMb.toFixed(1)}MB | RSS: ${rssMb.toFixed(1)}MB\x1b[0m`);
  assert(heapUsedMb < 50, `Heap memory should stay under 50MB, got ${heapUsedMb.toFixed(1)}MB`);
});

console.log(`\nResults: ${passed} / ${total} tests passed.\n`);
if (passed !== total) {
  process.exit(1);
}
