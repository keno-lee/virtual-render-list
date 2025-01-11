/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  isVue2,
  h,
  type Component,
  type ComponentPropsOptions,
  type ExtractPropTypes,
  type ComputedOptions,
  type MethodOptions,
  type VNode,
  type VNodeArrayChildren,
} from 'vue-demi';

export type RawChildren =
  | string
  | number
  | boolean
  | VNode
  | VNodeArrayChildren
  | (() => any);

export type RawSlots = {
  [name: string]: unknown;
  $stable?: boolean;
};

type Data = Record<string, unknown>;
type Props = Record<string, any> & {
  attrs?: Record<string, any>;
};

function vue2h<P>(
  ele:
    | Component<
        Readonly<
          P extends ComponentPropsOptions<Data> ? ExtractPropTypes<P> : P
        >,
        any,
        any,
        ComputedOptions,
        MethodOptions,
        {},
        any
      >
    | string,
  props: Props,
  children?: RawChildren | RawSlots,
) {
  const { attrs, on, ...rest } = props;
  return h(ele, { attrs, on, ...rest } as any, children);
}

function vue3h<P>(
  ele:
    | Component<
        Readonly<
          P extends ComponentPropsOptions<Data> ? ExtractPropTypes<P> : P
        >,
        any,
        any,
        ComputedOptions,
        MethodOptions,
        {},
        any
      >
    | string,
  props: Props,
  children?: RawChildren | RawSlots,
) {
  const { attrs, on, ...rest } = props;
  let event: Record<string, () => void> = {};
  if (on) {
    Object.entries(on).forEach((item) => {
      const [key, value] = item as [string, () => void];
      event[`on${key[0].toUpperCase() + key.slice(1)}`] = value;
    });
  }
  return h(ele, { ...attrs, ...event, ...rest } as any, children);
}

export const _h = isVue2 ? vue2h : vue3h;

function vue2hChild<P>(
  ele:
    | Component<
        Readonly<
          P extends ComponentPropsOptions<Data> ? ExtractPropTypes<P> : P
        >,
        any,
        any,
        ComputedOptions,
        MethodOptions,
        {},
        any
      >
    | string,
  props: Props,
  child?: VNode,
) {
  const { attrs, on, ...rest } = props;
  return h(ele, { attrs, on, ...rest } as any, [child]);
}

function vue3hChild<P>(
  ele:
    | Component<
        Readonly<
          P extends ComponentPropsOptions<Data> ? ExtractPropTypes<P> : P
        >,
        any,
        any,
        ComputedOptions,
        MethodOptions,
        {},
        any
      >
    | string,
  props: Props,
  child?: VNode,
) {
  const { attrs, on, ...rest } = props;
  let event: Record<string, () => void> = {};
  if (on) {
    Object.entries(on).forEach((item) => {
      const [key, value] = item as [string, () => void];
      event[`on${key[0].toUpperCase() + key.slice(1)}`] = value;
    });
  }
  // vue3 为了性能，推荐使用functional
  return h(ele, { ...attrs, ...event, ...rest } as any, {
    default: () => child,
  });
}

export const _hChild = isVue2 ? vue2hChild : vue3hChild;

function vue2h2Slot<P>(
  ele:
    | Component<
        Readonly<
          P extends ComponentPropsOptions<Data> ? ExtractPropTypes<P> : P
        >,
        any,
        any,
        ComputedOptions,
        MethodOptions,
        {},
        any
      >
    | string,
  props: Props,
  slots?: any,
) {
  const { attrs, on, ...rest } = props;
  return h(ele, { attrs, on, ...rest, scopedSlots: slots } as any);
}

// vue3 渲染slot时推荐使用functional
function vue3h2Slot<P>(
  ele:
    | Component<
        Readonly<
          P extends ComponentPropsOptions<Data> ? ExtractPropTypes<P> : P
        >,
        any,
        any,
        ComputedOptions,
        MethodOptions,
        {},
        any
      >
    | string,
  props: Props,
  slots?: any,
) {
  const { attrs, on, ...rest } = props;
  let event: Record<string, () => void> = {};
  if (on) {
    Object.entries(on).forEach((item) => {
      const [key, value] = item as [string, () => void];
      const eventName = `on${key[0].toUpperCase() + key.slice(1)}`;
      event[eventName] = value;
    });
  }
  return h(ele, { ...attrs, ...event, ...rest } as any, slots);
}

// 渲染传递插槽
export const _h2Slot = isVue2 ? vue2h2Slot : vue3h2Slot;

function vue2getSlot(_ctx: any, name: string) {
  return _ctx.$scopedSlots?.[name];
}

function vue3getSlot(_ctx: any, name: string) {
  return _ctx.$slots?.[name];
}

export const getSlot = isVue2 ? vue2getSlot : vue3getSlot;

export type StyleType =
  | string
  | Array<string | { [key: string]: any }>
  | { [key: string]: any };

export function mergeStyles(...styles: StyleType[]): string {
  let mergedStyles = '';
  styles.forEach((style) => {
    if (typeof style === 'string') {
      mergedStyles += style + ';';
    } else if (Array.isArray(style)) {
      mergedStyles += mergeStyles(...style);
    } else if (typeof style === 'object') {
      Object.entries(style).forEach(([key, value]) => {
        if (value) {
          mergedStyles += `${key}:${value};`;
        }
      });
    }
  });
  return mergedStyles;
}

export type ClassType = string | Array<string> | { [key: string]: boolean };

export function mergeClasses(...classes: ClassType[]): string {
  let mergedClasses = '';
  classes.forEach((cls) => {
    if (typeof cls === 'string') {
      mergedClasses += ' ' + cls;
    } else if (Array.isArray(cls)) {
      mergedClasses += mergeClasses(...cls);
    } else if (typeof cls === 'object') {
      Object.entries(cls).forEach(([key, value]) => {
        if (value) {
          mergedClasses += ' ' + key;
        }
      });
    }
  });
  console.log('mergedClasses', mergedClasses.trim());
  return mergedClasses.trim();
}
