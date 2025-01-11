import type { Ref, ShallowReactive } from 'vue-demi';
import type { StyleType, ClassType } from '../../utils';

export type ReactiveData = {
  views: number;

  // 滚动距离
  offset: number;
  // 不包含插槽的高度
  listTotalSize: number;
  // 虚拟占位尺寸，是从0到renderBegin的尺寸
  virtualSize: number;
  // 可视区的起始下标
  inViewBegin: number;
  // 可视区的结束下标
  inViewEnd: number;

  // buffer的起始下标
  renderBegin: number;
  // buffer的结束下标
  renderEnd: number;

  bufferTop: number;
  bufferBottom: number;
};

export interface BaseListProps<T extends Record<string, string>> {
  list: T[];
  itemKey: string | number;
  minSize: number;
  itemGap?: number;
  scrollDistance?: number;
  headerClass: ClassType;
  headerStyle: StyleType;
  footerClass: ClassType;
  footerStyle: StyleType;
  stickyHeaderClass: ClassType;
  stickyHeaderStyle: StyleType;
  stickyFooterClass: ClassType;
  stickyFooterStyle: StyleType;
}

export interface VirtListProps<T extends Record<string, string>>
  extends BaseListProps<T> {
  renderControl?: (
    begin: number,
    end: number,
  ) => { begin: number; end: number };

  fixed?: boolean;
  buffer?: number;
  bufferTop?: number;
  bufferBottom?: number;
  horizontal?: boolean;
  fixSelection?: boolean;
  start?: number;
  offset?: number;
  listStyle?: StyleType;
  listClass?: ClassType;
  itemStyle?: StyleType | ((item: T, index: number) => StyleType);
  itemClass?: ClassType | ((item: T, index: number) => ClassType);
}

export interface EmitFunction<T> {
  scroll?: (e: Event) => void;
  toTop?: (item: T) => void;
  toBottom?: (item: T) => void;
  itemResize?: (id: string, newSize: number) => void;
  rangeUpdate?: (inViewBegin: number, inViewEnd: number) => void;
}

export type SlotSize = {
  clientSize: number;
  headerSize: number;
  footerSize: number;
  stickyHeaderSize: number;
  stickyFooterSize: number;
};

export type VirtListReturn<T extends Record<string, string>> = {
  props: Required<VirtListProps<T>>;

  renderList: Ref<T[]>;
  clientRefEl: Ref<HTMLElement | null>;
  listRefEl: Ref<HTMLElement | null>;
  headerRefEl: Ref<HTMLElement | null>;
  footerRefEl: Ref<HTMLElement | null>;
  stickyHeaderRefEl: Ref<HTMLElement | null>;
  stickyFooterRefEl: Ref<HTMLElement | null>;

  reactiveData: ShallowReactive<ReactiveData>;
  slotSize: ShallowReactive<SlotSize>;
  sizesMap: Map<string, number>;

  resizeObserver: ResizeObserver | undefined;

  getReactiveData: () => ShallowReactive<ReactiveData>;
  getOffset: () => number;
  getSlotSize: () => number;
  reset: () => void;
  scrollToIndex: (index: number) => void;
  scrollIntoView: (index: number) => void;
  scrollToTop: () => void;
  manualRender: (begin: number, end: number) => void;
  scrollToBottom: () => void;
  scrollToOffset: (offset: number) => void;
  getItemSize: (itemKey: string) => number;
  deleteItemSize: (itemKey: string) => void;
  // expose only
  deletedList2Top: (preList: T[]) => void;
  addedList2Top: (preList: T[]) => void;
  getItemPosByIndex: (index: number) => {
    top: number;
    current: number;
    bottom: number;
  };
  forceUpdate: () => void;
};
