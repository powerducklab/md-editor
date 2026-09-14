import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  type CSSProperties
} from 'react';
import {
  MarkdownEditor,
  type EditorMode,
  type EditorTheme,
  type MarkdownEditorOptions
} from '../index.js';

export interface MarkdownEditorProps
  extends Omit<MarkdownEditorOptions, 'value' | 'onChange'> {
  /** Controlled value. When provided and different from internal state, syncs the editor. */
  value?: string;
  /** Uncontrolled initial value. Only applied on mount. */
  defaultValue?: string;
  onChange?: (value: string) => void;
  className?: string;
  style?: CSSProperties;
}

export interface MarkdownEditorHandle {
  getValue: () => string;
  setValue: (value: string) => void;
  getHtml: () => string;
  focus: () => void;
  setMode: (mode: EditorMode) => void;
  setTheme: (theme: EditorTheme) => void;
  /** Manually trigger a preview render when autoPreview is false. */
  renderNow: () => void;
}

/**
 * Only "structural" options (mode, math, mindmap, preview, autoPreview,
 * renderDebounce) trigger a destroy-and-recreate of the underlying instance,
 * because they change DOM structure or the rendering pipeline.
 *
 * theme and value use their own lightweight sync paths and never recreate
 * the instance -- critical for large documents where rebuilding CodeMirror
 * and clearing the incremental render cache on every React re-render would
 * be prohibitively expensive.
 */
export const MarkdownEditorReact = forwardRef<MarkdownEditorHandle, MarkdownEditorProps>(
  function MarkdownEditorReact(props, ref) {
    const {
      value,
      defaultValue,
      onChange,
      className,
      style,
      mode,
      theme,
      math,
      mindmap,
      preview,
      autoPreview,
      renderDebounce,
      // All remaining options (mention, docLink, toolbar, onImageUpload,
      // includeCommonHeaders, includeCookies, lineNumbers, placeholder, etc.)
      // are passed through to the underlying MarkdownEditor instance.
      ...rest
    } = props;

    const containerRef = useRef<HTMLDivElement>(null);
    const instanceRef = useRef<MarkdownEditor | null>(null);
    const onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;

    useLayoutEffect(() => {
      if (!containerRef.current) return;
      const instance = new MarkdownEditor(containerRef.current, {
        value: value ?? defaultValue ?? '',
        mode,
        theme,
        math,
        mindmap,
        preview,
        autoPreview,
        renderDebounce,
        onChange: (v) => onChangeRef.current?.(v),
        ...rest
      });
      instanceRef.current = instance;
      return () => {
        instance.destroy();
        instanceRef.current = null;
      };
      // Only structural options cause a recreate. value/onChange are excluded
      // to avoid frequent rebuilds in controlled usage. mention/docLink/toolbar
      // and other config props are applied at construction time; wrap them in
      // useCallback / useMemo if you need them to be stable.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mode, math, mindmap, preview, autoPreview, renderDebounce]);

    // Controlled value sync: only write when external value differs from
    // internal state, to avoid interrupting IME composition or cursor position.
    useEffect(() => {
      const instance = instanceRef.current;
      if (!instance || value === undefined) return;
      if (instance.getValue() !== value) {
        instance.setValue(value);
      }
    }, [value]);

    useEffect(() => {
      if (instanceRef.current && theme) instanceRef.current.setTheme(theme);
    }, [theme]);

    useImperativeHandle(
      ref,
      () => ({
        getValue: () => instanceRef.current?.getValue() ?? '',
        setValue: (v: string) => instanceRef.current?.setValue(v),
        getHtml: () => instanceRef.current?.getHtml() ?? '',
        focus: () => instanceRef.current?.focus(),
        setMode: (m: EditorMode) => instanceRef.current?.setMode(m),
        setTheme: (t: EditorTheme) => instanceRef.current?.setTheme(t),
        renderNow: () => instanceRef.current?.renderNow()
      }),
      []
    );

    return <div ref={containerRef} className={className} style={style} />;
  }
);
