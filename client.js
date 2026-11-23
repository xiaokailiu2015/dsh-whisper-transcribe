window.__ModuleLoader__.load({
  id: 'dsh-whisper-transcribe',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const NS = 'whisper-transcribe'

    const TEXT_FIELDS = [
      { key: 'modelPath', label: '模型目录', hint: 'faster-whisper 的 CTranslate2 模型目录（含 model.bin）' },
      { key: 'pythonPath', label: 'Python 解释器', hint: '安装了 faster-whisper 的 python.exe 绝对路径' },
      { key: 'language', label: '默认语言', hint: '留空自动识别，也可填 zh、en' },
      { key: 'outputDir', label: '输出目录', hint: '留空则写在音频文件旁边' },
      { key: 'nvidiaDir', label: 'CUDA 库目录', hint: 'site-packages\\nvidia；PATH 已配置时可留空' },
    ]

    const DEVICES = [
      { value: 'cuda', label: 'cuda（GPU）' },
      { value: 'cpu', label: 'cpu（处理器）' },
    ]

    const labelStyle = { display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }
    const hintStyle = { display: 'block', fontSize: 12, opacity: 0.7, marginBottom: 6 }
    const inputStyle = { width: '100%', padding: '6px 8px', fontSize: 13, boxSizing: 'border-box' }
    const rowStyle = { marginBottom: 14 }

    /**
     * Compute type implied by the chosen device.
     * @param {string} device - cuda or cpu.
     * @returns {string} the compute type the worker should use.
     */
    function computeTypeFor(device) {
      return device === 'cpu' ? 'int8' : 'float16'
    }

    /**
     * Read the current accepted values from a configuration form.
     * @param {object} form - shared configuration form of this entry.
     * @returns {object|undefined} the snapshot, when available.
     */
    function snapshotOf(form) {
      try {
        if (typeof form.getSnapshot === 'function') return form.getSnapshot()
        if (typeof form.snapshot === 'function') return form.snapshot()
      } catch {
        return undefined
      }
      return undefined
    }

    /**
     * Build the settings form component for one configuration form.
     * @param {object} form - shared configuration form of this entry.
     * @returns {Function} the React component.
     */
    function makeForm(form) {
      return function WhisperSettingsForm(props) {
        const [snap, setSnap] = React.useState(() => snapshotOf(form))
        const [draft, setDraft] = React.useState({})
        const [status, setStatus] = React.useState('')

        React.useEffect(() => {
          if (typeof form.ensure === 'function') {
            Promise.resolve(form.ensure()).catch((error) => { setStatus('读取失败：' + error.message) })
          }
          if (typeof form.subscribe !== 'function') return undefined
          const dispose = form.subscribe(() => { setSnap(snapshotOf(form)) })
          return typeof dispose === 'function' ? dispose : undefined
        }, [])

        const values = (snap && snap.value) || {}
        React.useEffect(() => {
          const device = values.device || 'cuda'
          setDraft({ ...values, device, computeType: computeTypeFor(device) })
        }, [snap && snap.revision])

        if (props && props.view === 'summary') return h('span', null, '本地 faster-whisper 语音转写')

        const writable = snap ? snap.writable !== false : true
        const device = draft.device || 'cuda'
        const computeType = computeTypeFor(device)

        async function save() {
          const next = { ...draft, computeType }
          const keys = [...TEXT_FIELDS.map((field) => field.key), 'timeoutMs', 'device', 'computeType']
          const changed = keys.filter((key) => String(next[key] ?? '') !== String(values[key] ?? ''))
          if (changed.length === 0) {
            setStatus('没有改动')
            return
          }
          setStatus('保存中…')
          try {
            for (const key of changed) {
              const raw = next[key]
              const value = key === 'timeoutMs' ? Number(raw) : raw
              await form.set(key, value)
            }
            setStatus('已保存')
          } catch (error) {
            setStatus('保存失败：' + (error && error.message ? error.message : String(error)))
          }
        }

        const inputs = TEXT_FIELDS.map((field) => h('div', { key: field.key, style: rowStyle },
          h('label', { style: labelStyle, htmlFor: 'whisper-' + field.key }, field.label),
          h('span', { style: hintStyle }, field.hint),
          h('input', {
            id: 'whisper-' + field.key,
            style: inputStyle,
            value: draft[field.key] ?? '',
            disabled: !writable,
            onChange: (event) => {
              const next = event.target.value
              setDraft((current) => ({ ...current, [field.key]: next }))
            },
          })))

        inputs.splice(2, 0, h('div', { key: 'device', style: rowStyle },
          h('label', { style: labelStyle, htmlFor: 'whisper-device' }, '运行设备'),
          h('span', { style: hintStyle }, 'GPU 更快；没有可用的 CUDA 时选 cpu'),
          h('select', {
            id: 'whisper-device',
            style: inputStyle,
            value: device,
            disabled: !writable,
            onChange: (event) => {
              const next = event.target.value
              setDraft((current) => ({ ...current, device: next, computeType: computeTypeFor(next) }))
            },
          }, ...DEVICES.map((item) => h('option', { key: item.value, value: item.value }, item.label)))))

        inputs.splice(3, 0, h('div', { key: 'computeType', style: rowStyle },
          h('label', { style: labelStyle, htmlFor: 'whisper-computeType' }, '计算精度'),
          h('span', { style: hintStyle }, '跟随运行设备自动决定，不需要手动改'),
          h('input', {
            id: 'whisper-computeType',
            style: { ...inputStyle, opacity: 0.7 },
            value: computeType,
            readOnly: true,
            disabled: true,
          })))

        inputs.push(h('div', { key: 'timeoutMs', style: rowStyle },
          h('label', { style: labelStyle, htmlFor: 'whisper-timeoutMs' }, '超时（毫秒）'),
          h('span', { style: hintStyle }, '单次转写的上限，默认 1800000'),
          h('input', {
            id: 'whisper-timeoutMs',
            style: inputStyle,
            value: draft.timeoutMs ?? '',
            disabled: !writable,
            onChange: (event) => {
              const next = event.target.value
              setDraft((current) => ({ ...current, timeoutMs: next }))
            },
          })))

        return h('div', { style: { padding: '4px 0', maxWidth: 620 } },
          h('h3', { style: { fontSize: 16, margin: '0 0 12px' } }, '语音转写'),
          inputs,
          h('div', { style: { display: 'flex', gap: 8, alignItems: 'center' } },
            h('button', { type: 'button', disabled: !writable, onClick: () => { save() } }, '保存'),
            h('button', {
              type: 'button',
              disabled: !writable,
              onClick: () => {
                const base = values.device || 'cuda'
                setDraft({ ...values, device: base, computeType: computeTypeFor(base) })
                setStatus('已还原')
              },
            }, '还原'),
            h('span', { style: { fontSize: 12, opacity: 0.8 } }, status)),
          h('p', { style: { fontSize: 12, opacity: 0.7, marginTop: 8 } },
            '模型目录与 Python 解释器必填；改动会立即作用于下一次转写。'),
          h('p', { style: { fontSize: 11, opacity: 0.55, marginTop: 4 } },
            'Powered by DeepSeek V4.1 Flash 1017'))
      }
    }

    return {
      inject: ['slots', 'configForms'],
      apply(ctx) {
        const form = ctx.configForms.get(NS)
        const Form = makeForm(form)

        ctx.slots.inject('settings.section', () => ctx.slots.register({
          name: 'settings.section',
          id: 'whisper-transcribe',
          order: 60,
          label: () => '语音转写',
        }, Form))

        ctx.slots.inject('plugins.row.config', () => ctx.slots.register({
          name: 'plugins.row.config',
          key: 'dsh-whisper-transcribe#whisper-transcribe',
        }, Form))
      },
    }
  },
})