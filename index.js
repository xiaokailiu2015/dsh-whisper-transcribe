import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import z from '@deepseek-ai/schemastery'
import { defineTool } from '@deepseek-ai/dsh-tools'

/** Entry id used by the bundle patch and the Loader row. */
const name = 'whisper-transcribe'

/** Services this plugin needs before it activates. */
const inject = ['tools']

/**
 * Local faster-whisper worker settings. Every field is volatile so the settings
 * form can edit it while the plugin keeps running; each read goes through
 * {@link live}.
 */
export const Config = z.object({
  pythonPath: z.string().required().volatile(),
  modelPath: z.string().required().volatile(),
  nvidiaDir: z.string().default('').volatile(),
  device: z.string().default('cuda').volatile(),
  computeType: z.string().default('float16').volatile(),
  language: z.string().default('').volatile(),
  outputDir: z.string().default('').volatile(),
  timeoutMs: z.natural().default(1800000).volatile(),
})

/**
 * Read one configuration field, which is a live reference because the field is volatile.
 * @param ref - the configuration reference.
 * @param fallback - value used when the reference resolves to nothing.
 * @returns the current value.
 */
function live(ref, fallback) {
  const value = typeof ref?.get === 'function' ? ref.get() : ref
  return value === undefined || value === null ? fallback : value
}

/**
 * Environment for the worker: UTF-8 output, plus the CUDA DLL directories when configured.
 * The PATH entry is harmless when the user already exported it system-wide.
 * @param config - validated plugin configuration.
 * @returns the child environment.
 */
function workerEnv(config) {
  const env = { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUNBUFFERED: '1' }
  const nvidiaDir = live(config.nvidiaDir, '')
  if (nvidiaDir) {
    const dirs = [join(nvidiaDir, 'cublas', 'bin'), join(nvidiaDir, 'cudnn', 'bin')]
    env.PATH = [...dirs, env.PATH ?? ''].join(';')
    env.DSH_WHISPER_NVIDIA_DIR = nvidiaDir
  }
  return env
}

/**
 * Run the Python worker once and return its parsed result.
 * @param config - validated plugin configuration.
 * @param payload - request handed to the worker on stdin.
 * @param signal - caller cancellation.
 * @returns the worker's JSON result.
 */
function runWorker(config, payload, signal) {
  const script = join(dirname(fileURLToPath(import.meta.url)), 'transcribe.py')
  return new Promise((resolve, reject) => {
    const child = spawn(live(config.pythonPath, 'python'), [script], {
      env: workerEnv(config),
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    })
    let stdout = ''
    let stderr = ''
    const onAbort = () => {
      child.kill()
      reject(new Error('transcription cancelled'))
    }
    signal?.addEventListener('abort', onAbort, { once: true })
    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', (chunk) => { if (stdout.length < 4_000_000) stdout += chunk })
    child.stderr.on('data', (chunk) => { if (stderr.length < 64_000) stderr += chunk })
    child.on('error', (error) => {
      signal?.removeEventListener('abort', onAbort)
      reject(new Error(`could not start Python (${live(config.pythonPath, 'python')}): ${error.message}`))
    })
    child.on('close', (code) => {
      signal?.removeEventListener('abort', onAbort)
      if (code !== 0) {
        const tail = stderr.trim().split(/\r?\n/).slice(-8).join('\n')
        reject(new Error(`transcription failed (exit ${code})${tail ? `:\n${tail}` : ''}`))
        return
      }
      const line = stdout.trim().split(/\r?\n/).reverse().find((entry) => entry.startsWith('{'))
      if (!line) {
        reject(new Error('transcription returned no result'))
        return
      }
      try {
        resolve(JSON.parse(line))
      } catch (error) {
        reject(new Error(`transcription result was not JSON: ${error.message}`))
      }
    })
    child.stdin.end(JSON.stringify(payload))
  })
}

/**
 * Register the `transcribe_audio` tool.
 * @param ctx - registrant context carrying the tool registry.
 * @param config - validated plugin configuration.
 */
export function apply(ctx, config) {
  const tool = defineTool({
    name: 'transcribe_audio',
    description: 'Transcribe a local audio or video file to text with the configured local faster-whisper model. '
      + 'Runs on the GPU when the model is CUDA-capable and writes a .txt transcript and .srt subtitles next to the file.',
    parameters: {
      path: {
        type: 'string',
        required: true,
        description: 'Absolute path of the audio or video file to transcribe.',
      },
      language: {
        type: 'string',
        description: 'Force a language code such as zh or en. Omit to use the configured default or detect it.',
      },
      save: {
        type: 'boolean',
        description: 'Write the transcript and subtitles to disk. Defaults to true.',
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          text: { type: 'string', required: true },
          language: { type: 'string', required: true },
          duration: { type: 'number', required: true },
          segments: { type: 'number', required: true },
          textPath: { type: 'string' },
          srtPath: { type: 'string' },
        },
      },
      render: (_args, value) => {
        const lines = [
          `Language: ${value.language} · ${value.duration.toFixed(1)}s · ${value.segments} segments`,
          '',
          value.text,
        ]
        if (value.textPath) lines.push('', `Transcript: ${value.textPath}`)
        if (value.srtPath) lines.push(`Subtitles: ${value.srtPath}`)
        return [{ type: 'text', text: lines.join('\n') }]
      },
    },
    timeoutMs: live(config.timeoutMs, 1800000),
    async execute(args, exec) {
      if (!existsSync(args.path)) throw new Error(`no such file: ${args.path}`)
      const result = await runWorker(config, {
        audio: args.path,
        model: live(config.modelPath, ''),
        device: live(config.device, 'cuda'),
        computeType: live(config.computeType, 'float16'),
        language: args.language ?? live(config.language, ''),
        outputDir: live(config.outputDir, ''),
        save: args.save !== false,
      }, exec.signal)
      return {
        text: String(result.text ?? ''),
        language: String(result.language ?? ''),
        duration: Number(result.duration ?? 0),
        segments: Number(result.segments ?? 0),
        ...result.textPath ? { textPath: String(result.textPath) } : {},
        ...result.srtPath ? { srtPath: String(result.srtPath) } : {},
      }
    },
  })
  ctx.effect(() => {
    const registration = ctx.tools.register(tool)
    return () => { registration?.dispose?.() }
  })
}

export { name, inject }