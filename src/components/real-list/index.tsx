/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  defineComponent,
  onBeforeUnmount,
  onBeforeUpdate,
  onMounted,
  onUpdated,
  ref,
  shallowReactive,
  watch,
  type ShallowReactive,
  type VNode,
} from 'vue-demi';
import { ObserverItem } from '../common/ObserverItem';
import { _h, _hChild, getSlot, mergeStyles } from '../../utils';
import type { SlotSize } from '../virt-list/type';
import type { NormalEmitFunction, RealListProps } from './type';

const defaultProps = {
  itemKey: 'id',
  miniSize: 40,
  list: [],
  scrollDistance: 100,
  headerClass: '',
  headerStyle: '',
  footerClass: '',
  footerStyle: '',
  stickyHeaderClass: '',
  stickyHeaderStyle: '',
  stickyFooterClass: '',
  stickyFooterStyle: '',
};

const useRealList = <T extends Record<string, any>>(
  userProps: ShallowReactive<RealListProps<T>>,
  emitFunction?: NormalEmitFunction<T>,
) => {
  const props = new Proxy(userProps, {
    get(target, key) {
      return Reflect.get(target, key) ?? Reflect.get(defaultProps, key);
    },
  }) as Required<RealListProps<T>>;

  const clientRefEl = ref<HTMLElement | null>(null);
  const listRefEl = ref<HTMLElement | null>(null);
  const headerRefEl = ref<HTMLElement | null>(null);
  const footerRefEl = ref<HTMLElement | null>(null);
  const stickyHeaderRefEl = ref<HTMLElement | null>(null);
  const stickyFooterRefEl = ref<HTMLElement | null>(null);

  const sizesMap = new Map();
  const offsetMap = new Map();

  // 插槽的相关尺寸数据
  const slotSize: ShallowReactive<SlotSize> = shallowReactive({
    clientSize: 0,
    headerSize: 0,
    footerSize: 0,
    stickyHeaderSize: 0,
    stickyFooterSize: 0,
  });
  const reactiveData = shallowReactive({
    listTotalSize: 0, // 不包含插槽的高度
    begin: '',
    end: '',
  });

  // 滚动到顶部和底部的标志位
  const isScrollTop = ref(false);
  const isScrollBottom = ref(false);

  const isUpdating = ref(false);

  const calcListTotalSize = () => {
    // 计算当前所有列表的高度
    const { itemKey } = props;
    let re = 0;
    for (let i = 0; i <= props.list.length - 1; i += 1) {
      re += getItemSize(props.list[i]?.[itemKey]);
    }
    reactiveData.listTotalSize = re;
  };

  const getItemSize = (itemKey: string) =>
    sizesMap.get(String(itemKey)) ?? props.minSize;

  const setItemSize = (itemKey: string, size: number) => {
    sizesMap.set(String(itemKey), size);
  };

  // 获取当前的容器的滚动偏移量
  const getScrollOffset = () =>
    clientRefEl.value ? clientRefEl.value.scrollTop : 0;

  let resizeObserver: ResizeObserver | undefined = undefined;
  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver((entries) => {
      // 尺寸变化的时候其实需要去更新元素的sizeMap和offsetMap
      let diff = 0;
      for (const entry of entries) {
        const { id } = (entry.target as HTMLElement).dataset;

        if (id) {
          const prevSize = getItemSize(id);
          const currentSize = entry.borderBoxSize[0].blockSize;

          if (id === 'client') {
            slotSize.clientSize = currentSize;
          } else if (id === 'header') {
            slotSize.headerSize = currentSize;
          } else if (id === 'footer') {
            slotSize.footerSize = currentSize;
          } else if (id === 'stickyHeader') {
            slotSize.stickyHeaderSize = currentSize;
          } else if (id === 'stickyFooter') {
            slotSize.stickyFooterSize = currentSize;
          } else if (prevSize !== currentSize) {
            setItemSize(id, currentSize);
            diff += currentSize - prevSize;

            emitFunction?.itemResize?.(id, currentSize);
          }
        }
      }

      // 更新列表的整体尺寸
      reactiveData.listTotalSize += diff;

      // 纠正所有列表的误差，防止有的列表没有更新diff
      calcListTotalSize();
      updateOffset();

      // 只有列表更新时候的尺寸变化才需要主动修正位置
      if (isUpdating.value) {
        if (isScrollTop.value) scrollIntoPosition('forward');
        if (isScrollBottom.value) scrollIntoPosition('backward');
        return;
      }

      // 元素尺寸变化的时候，需要判断是否触底或者触顶
      const currentScrollOffset = getScrollOffset();
      checkScrollStatus(currentScrollOffset);
    });
  }

  const getItemOffset = (itemKey: string) =>
    offsetMap.get(String(itemKey)) ?? -1;

  const setItemOffset = (itemKey: string, size: number) => {
    offsetMap.set(String(itemKey), size);
  };

  const updateOffset = () => {
    const { itemKey } = props;
    offsetMap.clear();
    let offset = 0;
    for (let i = 0; i < props.list.length; i += 1) {
      setItemOffset(props.list[i]?.[itemKey], offset);
      offset += getItemSize(props.list[i]?.[itemKey]);
    }
  };

  const getSlotSize = () =>
    slotSize.headerSize + slotSize.stickyFooterSize + slotSize.stickyHeaderSize;

  const debounce = (func: () => void, wait: number) => {
    let timeout: NodeJS.Timeout;

    return function () {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(), wait);
    };
  };

  // 当前可视区域内的第一个元素的key
  let currentKey = '';

  const updateFirstKey = debounce(() => {
    currentKey = getCurrentFirstItem();
    emitFunction?.updateCurrent?.(currentKey);
    // ctx.emit('updateCurrent', currentKey);
  }, 200);

  /**
   * @description 判断当前滚动的状态，判断是否触顶或者触底
   * @param currentScrollOffset 当前列表滚动的偏移量
   */
  const checkScrollStatus = (currentScrollOffset: number) => {
    if (props.list.length <= 0) return;
    if (currentScrollOffset <= props.scrollDistance) {
      reactiveData.begin = props.list[0][props.itemKey];
      if (props.list.length > props.pageSize) {
        reactiveData.end =
          props.list[props.list.length - props.pageSize - 1][props.itemKey];
      } else {
        reactiveData.end = props.list[props.list.length - 1][props.itemKey];
      }
      emitFunction?.toTop?.(props.list[0]);
      // ctx.emit('toTop', props.list[0]);
      isScrollBottom.value = false;
      isScrollTop.value = true;
    }
    // 内容总高度 = 列表总高度 + 头部插槽高度 + 尾部插槽高度
    // reactiveData.listTotalSize + slotSize.headerSize + slotSize.footerSize
    // 滚动高度 + 可视区域高度 + 阈值 >= 内容总高度
    if (
      currentScrollOffset + props.scrollDistance >=
      reactiveData.listTotalSize + getSlotSize() - slotSize.clientSize
    ) {
      reactiveData.end = props.list[props.list.length - 1][props.itemKey];
      if (props.list.length > props.pageSize) {
        reactiveData.begin = props.list[props.pageSize][props.itemKey];
      } else {
        reactiveData.begin = props.list[0][props.itemKey];
      }
      emitFunction?.toBottom?.(props.list[props.list.length - 1]);
      // ctx.emit('toBottom', props.list[props.list.length - 1]);
      isScrollBottom.value = true;
      isScrollTop.value = false;
    }
  };

  const onScroll = (evt: Event) => {
    emitFunction?.scroll?.(evt);
    // ctx.emit('scroll', evt);
    if (props.list.length <= 0) return;
    const currentScrollOffset = getScrollOffset();
    if (isUpdating.value) {
      const currentStartOffset = getItemOffset(reactiveData.begin);
      if (currentScrollOffset < currentStartOffset) {
        scrollToOffset(currentStartOffset);
      }
      return;
    }

    updateFirstKey();
    checkScrollStatus(currentScrollOffset);
  };

  const scrollToOffset = (offset: number) => {
    const directionKey = 'scrollTop';
    if (clientRefEl.value) clientRefEl.value[directionKey] = offset;
  };

  /**
   * @description 将指定下标的元素滚动到可视区域
   * @param index 目标元素下标
   */
  const scrollIntoView = (index: number) => {
    // 滚动指定元素到可视区域
    const targetMin = getItemOffset(props.list[index]?.[props.itemKey]);

    const scrollTargetToView = async (
      targetMin: number,
      resolve: (val?: unknown) => void,
    ) => {
      // 如果没有拿到目标元素的位置，那么就等一下再去拿
      if (targetMin === -1) {
        setTimeout(() => {
          const offset = getItemOffset(props.list[index]?.[props.itemKey]);
          scrollTargetToView(offset, resolve);
        }, 3);
        return;
      }

      const currentSize = getItemSize(props.list[index]?.[props.itemKey]);
      const targetMax = targetMin + currentSize;

      const offsetMin = getScrollOffset();
      const offsetMax = getScrollOffset() + slotSize.clientSize;
      if (
        targetMin < offsetMin &&
        offsetMin < targetMax &&
        currentSize < slotSize.clientSize
      ) {
        // 如果目标元素上方看不到，底部看得到，那么滚动到顶部部看得到就行了
        scrollToOffset(targetMin + slotSize.headerSize);
        resolve();
        return;
      }
      if (
        targetMin + slotSize.stickyHeaderSize < offsetMax &&
        offsetMax < targetMax + slotSize.stickyHeaderSize &&
        currentSize < slotSize.clientSize
      ) {
        // 如果目标元素上方看得到，底部看不到，那么滚动到底部看得到就行了
        scrollToOffset(
          targetMax - slotSize.clientSize + slotSize.stickyHeaderSize,
        );
        resolve();
        return;
      }
      // 屏幕下方
      if (targetMin + slotSize.stickyHeaderSize >= offsetMax) {
        await scrollToIndex(index);
        resolve();
        return;
      }

      // 屏幕上方
      if (targetMax <= offsetMin) {
        await scrollToIndex(index);
      }
      resolve();

      // 在中间就不动了
    };
    return new Promise((resolve) => {
      scrollTargetToView(targetMin, resolve);
    });
  };

  const getOffsetByIndex = (index: number) => {
    const key = props.list[index]?.[props.itemKey];
    return getItemOffset(key);
  };

  /**
   * @description 获取当前可视区域内的第一个元素的key
   * @returns 当前可视区域的一个元素的key
   */
  const getCurrentFirstItem = () => {
    let currentKey = '';
    const currentScrollOffset = getScrollOffset();
    const preDistance =
      currentScrollOffset + slotSize.stickyHeaderSize - slotSize.headerSize;
    const distance = preDistance < 0 ? 0 : preDistance;
    for (const [key, value] of offsetMap) {
      if (value <= distance && value + getItemSize(key) > currentScrollOffset) {
        currentKey = key;
        break;
      }
    }
    return currentKey;
  };

  /**
   * @description 将指定下标的元素滚动到可视区域第一个位置
   * @param index 目标元素下标
   */
  const scrollToIndex = (index: number) => {
    // 滚动到指定元素
    if (index < 0) return;
    // 如果要去的位置大于长度，那么就直接调用去底部的方法
    if (index >= props.list.length - 1) {
      scrollToBottom();
      return;
    }

    const offset = getItemOffset(props.list[index]?.[props.itemKey]);
    const scrollToTargetOffset = (
      targetOffset: number,
      resolve: (val?: unknown) => void,
    ) => {
      if (targetOffset === -1) {
        setTimeout(() => {
          const offset = getItemOffset(props.list[index]?.[props.itemKey]);
          scrollToTargetOffset(offset, resolve);
        }, 3);
        return;
      }
      scrollToOffset(targetOffset + slotSize.headerSize);
      resolve();
    };
    return new Promise((resolve) => {
      scrollToTargetOffset(offset, resolve);
    });
  };

  const scrollToBottom = () => {
    const bottomOffset =
      reactiveData.listTotalSize + slotSize.headerSize + slotSize.footerSize;
    scrollToOffset(bottomOffset);
  };
  let preScrollOffset = 0;

  const scrollIntoPosition = (direction: 'forward' | 'backward') => {
    if (!clientRefEl.value) return;
    if (direction === 'forward') {
      scrollToOffset(preScrollOffset + getItemOffset(reactiveData.begin));
    } else {
      scrollToOffset(preScrollOffset);
    }
  };

  const reset = () => {
    // 重置所有的数据
    reactiveData.listTotalSize = 0;

    reactiveData.begin = '';
    reactiveData.end = '';

    sizesMap.clear();
    offsetMap.clear();
  };

  watch(
    () => props.list,
    () => {
      // 在数据变化的时候才去将更新状态位设置为true
      // 防止多次触发分页操作
      isUpdating.value = true;
    },
    {
      deep: false,
    },
  );

  onBeforeUpdate(() => {
    // 已经拿到了新的列表
    if (isScrollTop.value) {
      preScrollOffset = getScrollOffset();
    }
    if (isScrollBottom.value) {
      preScrollOffset =
        getScrollOffset() - offsetMap.get(String(reactiveData.begin));
    }
  });

  onUpdated(() => {
    // 这个时候已经更新完成了 但是滚动会触发阈值的判断，所以需要延迟一下
    setTimeout(() => {
      isUpdating.value = false;
    }, 10);
  });

  onMounted(() => {
    if (clientRefEl.value) {
      clientRefEl.value.addEventListener('scroll', onScroll);
      resizeObserver?.observe(clientRefEl.value);
    }

    if (stickyHeaderRefEl.value) {
      resizeObserver?.observe(stickyHeaderRefEl.value);
    }
    if (stickyFooterRefEl.value) {
      resizeObserver?.observe(stickyFooterRefEl.value);
    }
    if (headerRefEl.value) {
      resizeObserver?.observe(headerRefEl.value);
    }
    if (footerRefEl.value) {
      resizeObserver?.observe(footerRefEl.value);
    }
  });

  onBeforeUnmount(() => {
    if (clientRefEl.value) {
      clientRefEl.value.removeEventListener('scroll', onScroll);
      resizeObserver?.unobserve(clientRefEl.value);
      slotSize.clientSize = 0;
    }

    if (stickyHeaderRefEl.value) {
      resizeObserver?.unobserve(stickyHeaderRefEl.value);
      slotSize.stickyHeaderSize = 0;
    }
    if (stickyFooterRefEl.value) {
      resizeObserver?.unobserve(stickyFooterRefEl.value);
      slotSize.stickyFooterSize = 0;
    }
    if (headerRefEl.value) {
      resizeObserver?.unobserve(headerRefEl.value);
      slotSize.headerSize = 0;
    }
    if (footerRefEl.value) {
      resizeObserver?.unobserve(footerRefEl.value);
      slotSize.footerSize = 0;
    }
  });

  return {
    props,
    resizeObserver,
    sizesMap,
    slotSize,

    clientRefEl,
    listRefEl,
    headerRefEl,
    footerRefEl,
    stickyHeaderRefEl,
    stickyFooterRefEl,

    scrollIntoView,
    scrollToIndex,
    reset,
    getItemOffset,
    getCurrentFirstItem,
    getOffsetByIndex,
    scrollToOffset,
  };
};

const RealList = defineComponent({
  name: 'RealList',
  emits: {
    scroll: (e: Event) => e,
    toTop: (firstItem: any) => firstItem,
    toBottom: (lastItem: any) => lastItem,
    itemResize: (id: string, newSize: number) => true,
    updateCurrent: (key: string | number) => true,
  },
  props: {
    itemKey: {
      type: [String, Number],
      default: 'id',
    },
    list: {
      type: Array<any>,
      default: () => [],
    },
    minSize: {
      type: Number,
      default: 40,
    },
    pageSize: {
      type: Number,
      default: 30,
    },
    scrollDistance: {
      type: Number,
      default: 100,
    },
    headerClass: {
      type: [String, Array, Object],
      default: '',
    },
    headerStyle: {
      type: [String, Array, Object],
      default: '',
    },
    footerClass: {
      type: [String, Array, Object],
      default: '',
    },
    footerStyle: {
      type: [String, Array, Object],
      default: '',
    },
    stickyHeaderClass: {
      type: [String, Array, Object],
      default: '',
    },
    stickyHeaderStyle: {
      type: [String, Array, Object],
      default: '',
    },
    stickyFooterClass: {
      type: [String, Array, Object],
      default: '',
    },
    stickyFooterStyle: {
      type: [String, Array, Object],
      default: '',
    },
  },
  setup(props: any, ctx) {
    const emitFunction: NormalEmitFunction<any> = {
      scroll: (e: Event) => {
        ctx.emit('scroll', e);
      },
      toTop: (firstItem: any) => {
        ctx.emit('toTop', firstItem);
      },
      toBottom: (lastItem: any) => {
        ctx.emit('toBottom', lastItem);
      },
      itemResize: (id: string, newSize: number) => {
        ctx.emit('itemResize', id, newSize);
      },
      updateCurrent: (key: string | number) => {
        ctx.emit('updateCurrent', key);
      },
    };

    return useRealList(props, emitFunction);
  },
  render() {
    const { props, resizeObserver } = this;

    const {
      itemKey,
      headerClass,
      headerStyle,
      footerClass,
      footerStyle,
      stickyHeaderClass,
      stickyHeaderStyle,
      stickyFooterClass,
      stickyFooterStyle,
    } = props as RealListProps<any>;

    const renderStickyHeaderSlot = (): VNode | null =>
      getSlot(this, 'stickyHeader')
        ? _h(
            'div',
            {
              key: 'slot-sticky-header',
              class: stickyHeaderClass,
              style: mergeStyles(
                'position: sticky; z-index: 10; top: 0;',
                stickyHeaderStyle,
              ),
              ref: 'stickyHeaderRefEl',
              attrs: {
                'data-id': 'stickyHeader',
              },
            },
            [getSlot(this, 'stickyHeader')?.()],
          )
        : null;

    const renderStickyFooterSlot = (): VNode | null =>
      getSlot(this, 'stickyFooter')
        ? _h(
            'div',
            {
              key: 'slot-sticky-footer',
              class: stickyFooterClass,
              style: mergeStyles(
                'position: sticky; z-index: 10; bottom: 0;',
                stickyFooterStyle,
              ),
              ref: 'stickyFooterRefEl',
              attrs: {
                'data-id': 'stickyFooter',
              },
            },
            [getSlot(this, 'stickyFooter')?.()],
          )
        : null;

    const renderHeaderSlot = (): VNode | null =>
      getSlot(this, 'header')
        ? _h(
            'div',
            {
              key: 'slot-header',
              class: headerClass,
              style: headerStyle,
              ref: 'headerRefEl',
              attrs: {
                'data-id': 'header',
              },
            },
            [getSlot(this, 'header')?.()],
          )
        : null;

    const renderFooterSlot = (): VNode | null =>
      getSlot(this, 'footer')
        ? _h(
            'div',
            {
              key: 'slot-footer',
              class: footerClass,
              style: footerStyle,
              ref: 'footerRefEl',
              attrs: {
                'data-id': 'footer',
              },
            },
            [getSlot(this, 'footer')?.()],
          )
        : null;

    const renderMainList = (): VNode | null => {
      const mainList = [];
      for (let i = 0; i < props.list.length; i++) {
        const currentItem = props.list[i];
        mainList.push(
          _hChild(
            ObserverItem,
            {
              key: currentItem[itemKey],
              attrs: {
                id: currentItem[itemKey],
                resizeObserver: resizeObserver,
              },
            },
            getSlot(
              this,
              'default',
            )?.({
              itemData: currentItem,
            }),
          ),
        );
      }
      return _h(
        'div',
        {
          ref: 'listRefEl',
        },
        [mainList],
      );
    };

    return _h(
      'div',
      {
        ref: 'clientRefEl',
        style: `width: 100%; height: 100%; overflow: overlay;`,
        attrs: {
          'data-id': 'client',
        },
      },
      [
        renderStickyHeaderSlot(),
        renderHeaderSlot(),
        renderMainList(),
        renderFooterSlot(),
        renderStickyFooterSlot(),
      ],
    );
  },
});

export { RealList };
