import {
  h,
  defineComponent,
  ref,
  computed,
  PropType,
  toRef,
  watchEffect,
  VNode,
  withDirectives,
  Transition,
  CSSProperties
} from 'vue'
import {
  hsv2rgb,
  rgb2hsv,
  rgba,
  hsva,
  hsla,
  hsl2hsv,
  hsv2hsl,
  rgb2hsl,
  hsl2rgb,
  toRgbaString,
  toHsvaString,
  toHslaString,
  HSVA,
  RGBA,
  HSLA
} from 'seemly'
import HueSlider from './HueSlider'
import AlphaSlider from './AlphaSlider'
import Pallete from './Pallete'
import type { PalleteInst } from './Pallete'
import ColorInput from './ColorInput'
import style from './styles/index.cssr'
import type { ThemeProps } from '../../_mixins'
import { useConfig, useTheme } from '../../_mixins'
import { useIsMounted, useMergedState } from 'vooks'
import { call, MaybeArray, useAdjustedTo } from '../../_utils'
import { getModeFromValue } from './utils'
import type { ColorPickerMode } from './utils'
import { VBinder, VFollower, VTarget } from 'vueuc'
import ColorPickerTrigger from './ColorPickerTrigger'
import { clickoutside } from 'vdirs'
import { colorPickerLight } from '../styles'
import type { ColorPickerTheme } from '../styles'

export const colorPickerPanelProps = {
  ...(useTheme.props as ThemeProps<ColorPickerTheme>),
  value: String,
  show: {
    type: Boolean,
    default: undefined
  },
  defaultShow: {
    type: Boolean,
    default: false
  },
  defaultValue: {
    type: String as PropType<string | null>,
    default: null
  },
  to: useAdjustedTo.propTo,
  onComplete: Function as PropType<(value: string) => void>,
  'onUpdate:show': [Function, Array] as PropType<
  MaybeArray<(value: boolean) => void>
  >,
  onUpdateShow: [Function, Array] as PropType<
  MaybeArray<(value: boolean) => void>
  >,
  'onUpdate:value': [Function, Array] as PropType<
  MaybeArray<(value: string) => void>
  >,
  onUpdateValue: [Function, Array] as PropType<
  MaybeArray<(value: string) => void>
  >
} as const

export default defineComponent({
  name: 'ColorPicker',
  props: colorPickerPanelProps,
  setup (props) {
    const palleteInstRef = ref<PalleteInst | null>(null)
    const selfRef = ref<HTMLElement | null>(null)
    let upcomingValue: string | null = null

    const themeRef = useTheme(
      'ColorPicker',
      'ColorPicker',
      style,
      colorPickerLight,
      props
    )
    const uncontrolledShowRef = ref(props.defaultShow)
    const mergedShowRef = useMergedState(
      toRef(props, 'show'),
      uncontrolledShowRef
    )
    function doUpdateShow (value: boolean): void {
      const { onUpdateShow, 'onUpdate:show': _onUpdateShow } = props
      if (onUpdateShow) call(onUpdateShow, value)
      if (_onUpdateShow) call(_onUpdateShow, value)
      uncontrolledShowRef.value = value
    }

    const uncontrolledValueRef = ref(props.defaultValue)
    const mergedValueRef = useMergedState(
      toRef(props, 'value'),
      uncontrolledValueRef
    )

    const valueModeRef = computed(() => getModeFromValue(mergedValueRef.value))

    const displayedModeRef = ref<ColorPickerMode>(
      getModeFromValue(mergedValueRef.value) || 'rgba'
    )

    function handleUpdateDisplayedMode (): void {
      const { value: displayedMode } = displayedModeRef
      switch (displayedMode) {
        case 'rgba':
          displayedModeRef.value = 'hexa'
          break
        case 'hexa':
          displayedModeRef.value = 'hsva'
          break
        case 'hsva':
          displayedModeRef.value = 'hsla'
          break
        case 'hsla':
          displayedModeRef.value = 'rgba'
          break
      }
    }

    let _h: number, // avoid conflict with render function's h
      s: number,
      l: number,
      v: number,
      r: number,
      g: number,
      b: number,
      a: number

    const hsvaRef = computed<HSVA | null>(() => {
      const { value: mergedValue } = mergedValueRef
      if (!mergedValue) return null
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      switch (valueModeRef.value!) {
        case 'hsva':
          return hsva(mergedValue)
        case 'hsla':
          ;[_h, s, l, a] = hsla(mergedValue)
          return [...hsl2hsv(_h, s, l), a]
        case 'rgba':
        case 'hexa':
          ;[r, g, b, a] = rgba(mergedValue)
          return [...rgb2hsv(r, g, b), a]
      }
    })

    const rgbaRef = computed<RGBA | null>(() => {
      const { value: mergedValue } = mergedValueRef
      if (!mergedValue) return null
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      switch (valueModeRef.value!) {
        case 'rgba':
        case 'hexa':
          return rgba(mergedValue)
        case 'hsva':
          ;[_h, s, v, a] = hsva(mergedValue)
          return [...hsv2rgb(_h, s, v), a]
        case 'hsla':
          ;[_h, s, l, a] = hsla(mergedValue)
          return [...hsl2rgb(_h, s, l), a]
      }
    })

    const hslaRef = computed<HSLA | null>(() => {
      const { value: mergedValue } = mergedValueRef
      if (!mergedValue) return null
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      switch (valueModeRef.value!) {
        case 'hsla':
          return hsla(mergedValue)
        case 'hsva':
          ;[_h, s, v, a] = hsva(mergedValue)
          return [...hsv2hsl(_h, s, v), a]
        case 'rgba':
        case 'hexa':
          ;[r, g, b, a] = rgba(mergedValue)
          return [...rgb2hsl(r, g, b), a]
      }
    })

    const mergedValueArrRef = computed(() => {
      switch (displayedModeRef.value) {
        case 'rgba':
        case 'hexa':
          return rgbaRef.value
        case 'hsva':
          return hsvaRef.value
        case 'hsla':
          return hslaRef.value
      }
    })

    const displayedHueRef = ref<number>(0)
    const displayedAlphaRef = ref<number>(1)

    function handleUpdateSv (s: number, v: number): void {
      const { value: hsvaArr } = hsvaRef
      const hue = displayedHueRef.value
      const alpha = hsvaArr ? hsvaArr[3] : 1
      switch (displayedModeRef.value) {
        case 'hsva':
          doUpdateValue(toHsvaString([hue, s, v, alpha]), 'cursor')
          break
        case 'hsla':
          doUpdateValue(toHslaString([...hsv2hsl(hue, s, v), alpha]), 'cursor')
          break
        case 'rgba':
        case 'hexa':
          doUpdateValue(toRgbaString([...hsv2rgb(hue, s, v), alpha]), 'cursor')
          break
      }
    }

    function handleUpdateHue (hue: number): void {
      displayedHueRef.value = hue
      const { value: hsvaArr } = hsvaRef
      if (!hsvaArr) {
        return
      }
      const [, s, v, a] = hsvaArr
      switch (displayedModeRef.value) {
        case 'hsva':
          doUpdateValue(toHsvaString([hue, s, v, a]), 'cursor')
          break
        case 'rgba':
        case 'hexa':
          doUpdateValue(toRgbaString([...hsv2rgb(hue, s, v), a]), 'cursor')
          break
        case 'hsla':
          doUpdateValue(toHslaString([...hsv2hsl(hue, s, v), a]), 'cursor')
          break
      }
    }

    function handleUpdateAlpha (alpha: number): void {
      switch (displayedModeRef.value) {
        case 'hsva':
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          ;[_h, s, v] = hsvaRef.value!
          doUpdateValue(toHsvaString([_h, s, v, alpha]), 'cursor')
          break
        case 'rgba':
        case 'hexa':
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          ;[r, g, b] = rgbaRef.value!
          doUpdateValue(toRgbaString([r, g, b, alpha]), 'cursor')
          break
        case 'hsla':
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          ;[_h, s, l] = hslaRef.value!
          doUpdateValue(toHslaString([_h, s, l, alpha]), 'cursor')
          break
      }
      displayedAlphaRef.value = alpha
    }

    function doUpdateValue (
      value: string,
      updateSource: 'cursor' | 'input'
    ): void {
      if (updateSource === 'cursor') {
        upcomingValue = value
      } else {
        upcomingValue = null
      }
      const { onUpdateValue, 'onUpdate:value': _onUpdateValue } = props
      if (onUpdateValue) call(onUpdateValue, value)
      if (_onUpdateValue) call(_onUpdateValue, value)
      uncontrolledValueRef.value = value
    }

    function handleInputUpdateValue (value: string): void {
      doUpdateValue(value, 'input')
      handleComplete()
    }

    function handleComplete (): void {
      const { value } = mergedValueRef
      // no value & only hue changes will complete with no value
      if (value) {
        props.onComplete?.(value)
      }
    }

    watchEffect(() => {
      if (upcomingValue && upcomingValue === mergedValueRef.value) {
        // let it works in uncontrolled mode
      } else {
        const { value } = hsvaRef
        if (value) {
          displayedHueRef.value = value[0]
          displayedAlphaRef.value = value[3]
          palleteInstRef.value?.setSv(value[1], value[2])
        }
      }
      upcomingValue = null
    })

    const cssVarsRef = computed(() => {
      const {
        common: { cubicBezierEaseInOut },
        self: { textColor, color, fontSize, boxShadow, border, borderRadius }
      } = themeRef.value
      return {
        '--bezier': cubicBezierEaseInOut,
        '--text-color': textColor,
        '--color': color,
        '--font-size': fontSize,
        '--box-shadow': boxShadow,
        '--border': border,
        '--border-radius': borderRadius
      }
    })

    function renderPanel (): VNode {
      const { value: rgba } = rgbaRef
      const { value: displayedMode } = displayedModeRef
      const { value: displayedHue } = displayedHueRef
      return (
        <div
          class="n-color-picker-panel"
          onDragstart={(e) => {
            e.preventDefault()
          }}
          style={cssVarsRef.value as CSSProperties}
        >
          <Pallete
            ref={palleteInstRef}
            rgba={rgba}
            displayedHue={displayedHue}
            onUpdateSV={handleUpdateSv}
            onComplete={handleComplete}
          />
          <div class="n-color-picker-control">
            <HueSlider
              hue={displayedHue}
              onUpdateHue={handleUpdateHue}
              onComplete={handleComplete}
            />
            <AlphaSlider
              rgba={rgba}
              alpha={displayedAlphaRef.value}
              onUpdateAlpha={handleUpdateAlpha}
              onComplete={handleComplete}
            />
            <ColorInput
              mode={displayedMode}
              onUpdateMode={handleUpdateDisplayedMode}
              value={mergedValueArrRef.value}
              onUpdateValue={handleInputUpdateValue}
            />
          </div>
        </div>
      )
    }

    return {
      ...useConfig(props),
      selfRef,
      hsla: hslaRef,
      rgba: rgbaRef,
      mergedShow: mergedShowRef,
      isMounted: useIsMounted(),
      adjustedTo: useAdjustedTo(props),
      mergedValue: mergedValueRef,
      handleTriggerClick () {
        doUpdateShow(true)
      },
      handleClickOutside (e: MouseEvent) {
        if (selfRef.value?.contains(e.target as Node)) return
        doUpdateShow(false)
      },
      renderPanel,
      cssVars: cssVarsRef
    }
  },
  render () {
    return (
      <div class="n-color-picker" ref="selfRef">
        <VBinder>
          {{
            default: () => [
              <VTarget>
                {{
                  default: () => (
                    <ColorPickerTrigger
                      value={this.mergedValue}
                      style={this.cssVars as CSSProperties}
                      hsla={this.hsla}
                      onClick={this.handleTriggerClick}
                    />
                  )
                }}
              </VTarget>,
              <VFollower
                placement="bottom-start"
                show={this.mergedShow}
                containerClass={this.namespace}
                teleportDisabled={this.adjustedTo === useAdjustedTo.tdkey}
                to={this.adjustedTo}
              >
                {{
                  default: () => (
                    <Transition
                      name="n-fade-in-scale-up-transition"
                      appear={this.isMounted}
                    >
                      {{
                        default: () =>
                          this.mergedShow
                            ? withDirectives(this.renderPanel(), [
                              [clickoutside, this.handleClickOutside]
                            ])
                            : null
                      }}
                    </Transition>
                  )
                }}
              </VFollower>
            ]
          }}
        </VBinder>
      </div>
    )
  }
})