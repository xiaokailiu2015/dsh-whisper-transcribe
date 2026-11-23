window.__ModuleLoader__.load({
  id: 'dsh-whisper-transcribe',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const NS = 'whisper-transcribe'

    const FIELDS = [
      { key: 'modelPath', label: '模型目录', hint: 'faster-whisper 的 CTranslate2 模型目录（含 model.bin）' },
      { key: 'pythonPath', label: 'Python 解释器', hint: '安装了 faster-whisper 的 python.exe 绝对路径' },
      { key: 'device', label: '运行设备', hint: '填 cuda 或 cpu' },
      { key: 'computeType', label: '计算精度', hint: 'GPU 用 float16；CPU 用 int8' },
      { key: 'language', label: '默认语言', hint: '留空自动识别，也可填 zh、en' },
      { key: 'outputDir', label: '输出目录', hint: '留空则写在音频文件旁边' },
      { key: 'nvidiaDir', label: 'CUDA 库目录', hint: 'site-packages\\nvidia；PATH 已配置时可留空' },
      { key: 'timeoutMs', label: '超时（毫秒）', hint: '单次转写的上限，默认 1800000' },
    ]

    const labelStyle = { display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }
    const hintStyle = { display: 'block', fontSize: 12, opacity: 0.7, marginBottom: 6 }
    const inputStyle = { width: '100%', padding: '6px 8px', fontSize: 13, boxSizing: 'border-box' }
    const rowStyle = { marginBottom: 14 }

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
          setDraft({ ...values })
        }, [snap && snap.revision])

        if (props && props.view === 'summary') return h('span', null, '本地 faster-whisper 语音转写')

        const writable = snap ? snap.writable !== false : true

        async function save() {
          const changed = FIELDS.filter((field) => String(draft[field.key] ?? '') !== String(values[field.key] ?? ''))
          if (changed.length === 0) {
            setStatus('没有改动')
            return
          }
          setStatus('保存中…')
          try {
            for (const field of changed) {
              const raw = draft[field.key]
              const value = field.key === 'timeoutMs' ? Number(raw) : raw
              await form.set(field.key, value)
            }
            setStatus('已保存')
          } catch (error) {
            setStatus('保存失败：' + (error && error.message ? error.message : String(error)))
          }
        }

        const inputs = FIELDS.map((field) => h('div', { key: field.key, style: rowStyle },
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

        return h('div', { style: { padding: '4px 0', maxWidth: 620 } },
          h('h3', { style: { fontSize: 16, margin: '0 0 12px' } }, '语音转写'),
          inputs,
          h('div', { style: { display: 'flex', gap: 8, alignItems: 'center' } },
            h('button', { type: 'button', disabled: !writable, onClick: () => { save() } }, '保存'),
            h('button', {
              type: 'button',
              disabled: !writable,
              onClick: () => { setDraft({ ...values }); setStatus('已还原') },
            }, '还原'),
            h('span', { style: { fontSize: 12, opacity: 0.8 } }, status)),
          h('p', { style: { fontSize: 12, opacity: 0.7, marginTop: 8 } },
            '模型目录与 Python 解释器必填；改动会立即作用于下一次转写。'))
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