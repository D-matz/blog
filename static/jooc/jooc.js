// build/dev/javascript/prelude.mjs
class CustomType {
  withFields(fields) {
    let properties = Object.keys(this).map((label) => (label in fields) ? fields[label] : this[label]);
    return new this.constructor(...properties);
  }
}

class List {
  static fromArray(array, tail) {
    return toList(array, tail);
  }
  [Symbol.iterator]() {
    return new ListIterator(this);
  }
  toArray() {
    return [...this];
  }
  atLeastLength(desired) {
    let current = this;
    while (desired-- > 0 && current)
      current = current.tail;
    return current !== undefined;
  }
  hasLength(desired) {
    let current = this;
    while (desired-- > 0 && current)
      current = current.tail;
    return desired === -1 && current instanceof Empty;
  }
  countLength() {
    let current = this;
    let length = 0;
    while (current) {
      current = current.tail;
      length++;
    }
    return length - 1;
  }
}
function prepend(element, tail) {
  return new NonEmpty(element, tail);
}
function toList(elements, tail) {
  let t = tail || List$Empty$const;
  for (let i = elements.length - 1;i >= 0; --i) {
    t = new NonEmpty(elements[i], t);
  }
  return t;
}

class ListIterator {
  #current;
  constructor(current) {
    this.#current = current;
  }
  next() {
    if (this.#current instanceof Empty) {
      return { done: true };
    } else {
      let { head, tail } = this.#current;
      this.#current = tail;
      return { value: head, done: false };
    }
  }
}

class Empty extends List {
}
var List$Empty$const = new Empty;
var List$Empty = () => List$Empty$const;
var List$isEmpty = (value) => value instanceof Empty;

class NonEmpty extends List {
  constructor(head, tail) {
    super();
    this.head = head;
    this.tail = tail;
  }
}
var List$NonEmpty = (head, tail) => new NonEmpty(head, tail);
var List$isNonEmpty = (value) => value instanceof NonEmpty;
var List$NonEmpty$first = (value) => value.head;
var List$NonEmpty$rest = (value) => value.tail;

class BitArray {
  bitSize;
  byteSize;
  bitOffset;
  rawBuffer;
  constructor(buffer, bitSize, bitOffset) {
    if (!(buffer instanceof Uint8Array)) {
      throw globalThis.Error("BitArray can only be constructed from a Uint8Array");
    }
    this.bitSize = bitSize ?? buffer.length * 8;
    this.byteSize = Math.trunc((this.bitSize + 7) / 8);
    this.bitOffset = bitOffset ?? 0;
    if (this.bitSize < 0) {
      throw globalThis.Error(`BitArray bit size is invalid: ${this.bitSize}`);
    }
    if (this.bitOffset < 0 || this.bitOffset > 7) {
      throw globalThis.Error(`BitArray bit offset is invalid: ${this.bitOffset}`);
    }
    if (buffer.length !== Math.trunc((this.bitOffset + this.bitSize + 7) / 8)) {
      throw globalThis.Error("BitArray buffer length is invalid");
    }
    this.rawBuffer = buffer;
  }
  byteAt(index) {
    if (index < 0 || index >= this.byteSize) {
      return;
    }
    return bitArrayByteAt(this.rawBuffer, this.bitOffset, index);
  }
  equals(other) {
    if (this.bitSize !== other.bitSize) {
      return false;
    }
    const wholeByteCount = Math.trunc(this.bitSize / 8);
    if (this.bitOffset === 0 && other.bitOffset === 0) {
      for (let i = 0;i < wholeByteCount; i++) {
        if (this.rawBuffer[i] !== other.rawBuffer[i]) {
          return false;
        }
      }
      const trailingBitsCount = this.bitSize % 8;
      if (trailingBitsCount) {
        const unusedLowBitCount = 8 - trailingBitsCount;
        if (this.rawBuffer[wholeByteCount] >> unusedLowBitCount !== other.rawBuffer[wholeByteCount] >> unusedLowBitCount) {
          return false;
        }
      }
    } else {
      for (let i = 0;i < wholeByteCount; i++) {
        const a = bitArrayByteAt(this.rawBuffer, this.bitOffset, i);
        const b = bitArrayByteAt(other.rawBuffer, other.bitOffset, i);
        if (a !== b) {
          return false;
        }
      }
      const trailingBitsCount = this.bitSize % 8;
      if (trailingBitsCount) {
        const a = bitArrayByteAt(this.rawBuffer, this.bitOffset, wholeByteCount);
        const b = bitArrayByteAt(other.rawBuffer, other.bitOffset, wholeByteCount);
        const unusedLowBitCount = 8 - trailingBitsCount;
        if (a >> unusedLowBitCount !== b >> unusedLowBitCount) {
          return false;
        }
      }
    }
    return true;
  }
  get buffer() {
    if (this.bitOffset !== 0 || this.bitSize % 8 !== 0) {
      throw new globalThis.Error("BitArray.buffer does not support unaligned bit arrays");
    }
    return this.rawBuffer;
  }
  get length() {
    if (this.bitOffset !== 0 || this.bitSize % 8 !== 0) {
      throw new globalThis.Error("BitArray.length does not support unaligned bit arrays");
    }
    return this.rawBuffer.length;
  }
}
var BitArray$BitArray = (buffer, bitSize, bitOffset) => new BitArray(buffer, bitSize, bitOffset);
function bitArrayByteAt(buffer, bitOffset, index) {
  if (bitOffset === 0) {
    return buffer[index] ?? 0;
  } else {
    const a = buffer[index] << bitOffset & 255;
    const b = buffer[index + 1] >> 8 - bitOffset;
    return a | b;
  }
}

class UtfCodepoint {
  constructor(value) {
    this.value = value;
  }
}
function toBitArray(segments) {
  if (segments.length === 0) {
    return new BitArray(new Uint8Array);
  }
  if (segments.length === 1) {
    const segment = segments[0];
    if (segment instanceof BitArray) {
      return segment;
    }
    if (segment instanceof Uint8Array) {
      return new BitArray(segment);
    }
    return new BitArray(new Uint8Array(segments));
  }
  let bitSize = 0;
  let areAllSegmentsNumbers = true;
  for (const segment of segments) {
    if (segment instanceof BitArray) {
      bitSize += segment.bitSize;
      areAllSegmentsNumbers = false;
    } else if (segment instanceof Uint8Array) {
      bitSize += segment.byteLength * 8;
      areAllSegmentsNumbers = false;
    } else {
      bitSize += 8;
    }
  }
  if (areAllSegmentsNumbers) {
    return new BitArray(new Uint8Array(segments));
  }
  const buffer = new Uint8Array(Math.trunc((bitSize + 7) / 8));
  let cursor = 0;
  for (let segment of segments) {
    const isCursorByteAligned = cursor % 8 === 0;
    if (segment instanceof BitArray) {
      if (isCursorByteAligned && segment.bitOffset === 0) {
        buffer.set(segment.rawBuffer, cursor / 8);
        cursor += segment.bitSize;
        const trailingBitsCount = segment.bitSize % 8;
        if (trailingBitsCount !== 0) {
          const lastByteIndex = Math.trunc(cursor / 8);
          buffer[lastByteIndex] >>= 8 - trailingBitsCount;
          buffer[lastByteIndex] <<= 8 - trailingBitsCount;
        }
      } else {
        appendUnalignedBits(segment.rawBuffer, segment.bitSize, segment.bitOffset);
      }
    } else if (segment instanceof Uint8Array) {
      if (isCursorByteAligned) {
        buffer.set(segment, cursor / 8);
        cursor += segment.byteLength * 8;
      } else {
        appendUnalignedBits(segment, segment.byteLength * 8, 0);
      }
    } else {
      if (isCursorByteAligned) {
        buffer[cursor / 8] = segment;
        cursor += 8;
      } else {
        appendUnalignedBits(new Uint8Array([segment]), 8, 0);
      }
    }
  }
  function appendUnalignedBits(unalignedBits, size, offset) {
    if (size === 0) {
      return;
    }
    const byteSize = Math.trunc(size + 7 / 8);
    const highBitsCount = cursor % 8;
    const lowBitsCount = 8 - highBitsCount;
    let byteIndex = Math.trunc(cursor / 8);
    for (let i = 0;i < byteSize; i++) {
      let byte = bitArrayByteAt(unalignedBits, offset, i);
      if (size < 8) {
        byte >>= 8 - size;
        byte <<= 8 - size;
      }
      buffer[byteIndex] |= byte >> highBitsCount;
      let appendedBitsCount = size - Math.max(0, size - lowBitsCount);
      size -= appendedBitsCount;
      cursor += appendedBitsCount;
      if (size === 0) {
        break;
      }
      buffer[++byteIndex] = byte << lowBitsCount;
      appendedBitsCount = size - Math.max(0, size - highBitsCount);
      size -= appendedBitsCount;
      cursor += appendedBitsCount;
    }
  }
  return new BitArray(buffer, bitSize);
}
class Result extends CustomType {
  static isResult(data) {
    return data instanceof Result;
  }
}

class Ok extends Result {
  constructor(value) {
    super();
    this[0] = value;
  }
  isOk() {
    return true;
  }
}
var Result$Ok = (value) => new Ok(value);
var Result$isOk = (value) => value instanceof Ok;
var Result$Ok$0 = (value) => value[0];

class Error extends Result {
  constructor(detail) {
    super();
    this[0] = detail;
  }
  isOk() {
    return false;
  }
}
var Result$Error = (detail) => new Error(detail);
var Result$isError = (value) => value instanceof Error;
function isEqual(x, y) {
  let values = [x, y];
  while (values.length) {
    let a = values.pop();
    let b = values.pop();
    if (a === b)
      continue;
    if (!isObject(a) || !isObject(b))
      return false;
    let unequal = !structurallyCompatibleObjects(a, b) || unequalDates(a, b) || unequalBuffers(a, b) || unequalArrays(a, b) || unequalMaps(a, b) || unequalSets(a, b) || unequalRegExps(a, b);
    if (unequal)
      return false;
    const proto = Object.getPrototypeOf(a);
    if (proto !== null && typeof proto.equals === "function") {
      try {
        if (a.equals(b))
          continue;
        else
          return false;
      } catch {}
    }
    let [keys, get] = getters(a);
    const ka = keys(a);
    const kb = keys(b);
    if (ka.length !== kb.length)
      return false;
    for (let k of ka) {
      values.push(get(a, k), get(b, k));
    }
  }
  return true;
}
function getters(object) {
  if (object instanceof Map) {
    return [(x) => x.keys(), (x, y) => x.get(y)];
  } else {
    let extra = object instanceof globalThis.Error ? ["message"] : [];
    return [(x) => [...extra, ...Object.keys(x)], (x, y) => x[y]];
  }
}
function unequalDates(a, b) {
  return a instanceof Date && (a > b || a < b);
}
function unequalBuffers(a, b) {
  return !(a instanceof BitArray) && a.buffer instanceof ArrayBuffer && a.BYTES_PER_ELEMENT && !(a.byteLength === b.byteLength && a.every((n, i) => n === b[i]));
}
function unequalArrays(a, b) {
  return Array.isArray(a) && a.length !== b.length;
}
function unequalMaps(a, b) {
  return a instanceof Map && a.size !== b.size;
}
function unequalSets(a, b) {
  return a instanceof Set && (a.size != b.size || [...a].some((e) => !b.has(e)));
}
function unequalRegExps(a, b) {
  return a instanceof RegExp && (a.source !== b.source || a.flags !== b.flags);
}
function isObject(a) {
  return typeof a === "object" && a !== null;
}
function structurallyCompatibleObjects(a, b) {
  if (typeof a !== "object" && typeof b !== "object" && (!a || !b))
    return false;
  let nonstructural = [Promise, WeakSet, WeakMap, Function];
  if (nonstructural.some((c) => a instanceof c))
    return false;
  return a.constructor === b.constructor;
}
function remainderInt(a, b) {
  if (b === 0) {
    return 0;
  } else {
    return a % b;
  }
}
function divideInt(a, b) {
  return Math.trunc(divideFloat(a, b));
}
function divideFloat(a, b) {
  if (b === 0) {
    return 0;
  } else {
    return a / b;
  }
}
function makeError(variant, file, module, line, fn, message, extra) {
  let error = new globalThis.Error(message);
  error.gleam_error = variant;
  error.file = file;
  error.module = module;
  error.line = line;
  error.function = fn;
  error.fn = fn;
  for (let k in extra)
    error[k] = extra[k];
  return error;
}
// build/dev/javascript/gleam_stdlib/gleam/order.mjs
class Lt extends CustomType {
}
var Order$Lt$const = new Lt;
var Order$Lt = () => Order$Lt$const;
class Eq extends CustomType {
}
var Order$Eq$const = new Eq;
var Order$Eq = () => Order$Eq$const;
class Gt extends CustomType {
}
var Order$Gt$const = new Gt;
var Order$Gt = () => Order$Gt$const;
function break_tie(order, other) {
  if (order instanceof Lt) {
    return order;
  } else if (order instanceof Eq) {
    return other;
  } else {
    return order;
  }
}

// build/dev/javascript/gleam_stdlib/gleam/option.mjs
class Some extends CustomType {
  constructor($0) {
    super();
    this[0] = $0;
  }
}
var Option$isSome = (value) => value instanceof Some;
var Option$Some$0 = (value) => value[0];

class None extends CustomType {
}
var Option$None$const = new None;
function reverse_and_prepend(loop$prefix, loop$suffix) {
  while (true) {
    let prefix = loop$prefix;
    let suffix = loop$suffix;
    if (prefix instanceof Empty) {
      return suffix;
    } else {
      let first = prefix.head;
      let rest = prefix.tail;
      loop$prefix = rest;
      loop$suffix = prepend(first, suffix);
    }
  }
}
function reverse(list) {
  return reverse_and_prepend(list, List$Empty$const);
}
function is_some(option) {
  return !(option instanceof None);
}
function to_result(option, e) {
  if (option instanceof Some) {
    let a = option[0];
    return new Ok(a);
  } else {
    return new Error(e);
  }
}
function from_result(result) {
  if (result instanceof Ok) {
    let a = result[0];
    return new Some(a);
  } else {
    return Option$None$const;
  }
}
function unwrap(option, default$) {
  if (option instanceof Some) {
    let x = option[0];
    return x;
  } else {
    return default$;
  }
}
function then$(option, fun) {
  if (option instanceof Some) {
    let x = option[0];
    return fun(x);
  } else {
    return option;
  }
}
function values_loop(loop$list, loop$acc) {
  while (true) {
    let list = loop$list;
    let acc = loop$acc;
    if (list instanceof Empty) {
      return reverse(acc);
    } else {
      let $ = list.head;
      if ($ instanceof Some) {
        let rest = list.tail;
        let first = $[0];
        loop$list = rest;
        loop$acc = prepend(first, acc);
      } else {
        let rest = list.tail;
        loop$list = rest;
        loop$acc = acc;
      }
    }
  }
}
function values(options) {
  return values_loop(options, List$Empty$const);
}

// build/dev/javascript/gleam_stdlib/dict.mjs
var referenceMap = /* @__PURE__ */ new WeakMap;
var tempDataView = /* @__PURE__ */ new DataView(/* @__PURE__ */ new ArrayBuffer(8));
var referenceUID = 0;
function hashByReference(o) {
  const known = referenceMap.get(o);
  if (known !== undefined) {
    return known;
  }
  const hash = referenceUID++;
  if (referenceUID === 2147483647) {
    referenceUID = 0;
  }
  referenceMap.set(o, hash);
  return hash;
}
function hashMerge(a, b) {
  return a ^ b + 2654435769 + (a << 6) + (a >> 2) | 0;
}
function hashString(s) {
  let hash = 0;
  const len = s.length;
  for (let i = 0;i < len; i++) {
    hash = Math.imul(31, hash) + s.charCodeAt(i) | 0;
  }
  return hash;
}
function hashNumber(n) {
  tempDataView.setFloat64(0, n);
  const i = tempDataView.getInt32(0);
  const j = tempDataView.getInt32(4);
  return Math.imul(73244475, i >> 16 ^ i) ^ j;
}
function hashBigInt(n) {
  return hashString(n.toString());
}
function hashObject(o) {
  const proto = Object.getPrototypeOf(o);
  if (proto !== null && typeof proto.hashCode === "function") {
    try {
      const code = o.hashCode(o);
      if (typeof code === "number") {
        return code;
      }
    } catch {}
  }
  if (o instanceof Promise || o instanceof WeakSet || o instanceof WeakMap) {
    return hashByReference(o);
  }
  if (o instanceof Date) {
    return hashNumber(o.getTime());
  }
  let h = 0;
  if (o instanceof ArrayBuffer) {
    o = new Uint8Array(o);
  }
  if (Array.isArray(o) || o instanceof Uint8Array) {
    for (let i = 0;i < o.length; i++) {
      h = Math.imul(31, h) + getHash(o[i]) | 0;
    }
  } else if (o instanceof Set) {
    o.forEach((v) => {
      h = h + getHash(v) | 0;
    });
  } else if (o instanceof Map) {
    o.forEach((v, k) => {
      h = h + hashMerge(getHash(v), getHash(k)) | 0;
    });
  } else {
    const keys = Object.keys(o);
    for (let i = 0;i < keys.length; i++) {
      const k = keys[i];
      const v = o[k];
      h = h + hashMerge(getHash(v), hashString(k)) | 0;
    }
  }
  return h;
}
function getHash(u) {
  if (u === null)
    return 1108378658;
  if (u === undefined)
    return 1108378659;
  if (u === true)
    return 1108378657;
  if (u === false)
    return 1108378656;
  switch (typeof u) {
    case "number":
      return hashNumber(u);
    case "string":
      return hashString(u);
    case "bigint":
      return hashBigInt(u);
    case "object":
      return hashObject(u);
    case "symbol":
      return hashByReference(u);
    case "function":
      return hashByReference(u);
    default:
      return 0;
  }
}

class Dict {
  constructor(size, root) {
    this.size = size;
    this.root = root;
  }
}
var bits = 5;
var mask = (1 << bits) - 1;
var noElementMarker = Symbol();

class Node {
  constructor(generation, datamap, nodemap, data) {
    this.datamap = datamap;
    this.nodemap = nodemap;
    this.data = data;
    this.generation = generation;
  }
  equals(other) {
    if (this === other)
      return true;
    if (!(other instanceof Node))
      return false;
    if (this.datamap !== other.datamap || this.nodemap !== other.nodemap) {
      return false;
    }
    const leftData = this.data;
    const rightData = other.data;
    if (leftData.length !== rightData.length)
      return false;
    if (this.datamap === 0 && this.nodemap === 0) {
      return this.#equalsOverflowEntries(rightData);
    }
    const edgesStart = leftData.length - popcount(this.nodemap);
    for (let i = 0;i < edgesStart; i += 2) {
      if (!isEqual(leftData[i], rightData[i]) || !isEqual(leftData[i + 1], rightData[i + 1])) {
        return false;
      }
    }
    for (let i = edgesStart;i < leftData.length; ++i) {
      if (!leftData[i].equals(rightData[i]))
        return false;
    }
    return true;
  }
  #equalsOverflowEntries(otherData) {
    const data = this.data;
    entries:
      for (let i = 0;i < data.length; i += 2) {
        for (let j = 0;j < otherData.length; j += 2) {
          if (isEqual(data[i], otherData[j])) {
            if (!isEqual(data[i + 1], otherData[j + 1]))
              return false;
            continue entries;
          }
        }
        return false;
      }
    return true;
  }
  hashCode() {
    const data = this.data;
    const edgesStart = data.length - popcount(this.nodemap);
    let hash = 0;
    for (let i = 0;i < edgesStart; i += 2) {
      hash = hash + hashMerge(getHash(data[i + 1]), getHash(data[i])) | 0;
    }
    for (let i = edgesStart;i < data.length; ++i) {
      hash = hash + data[i].hashCode() | 0;
    }
    return hash;
  }
}
var emptyNode = /* @__PURE__ */ newNode(0);
var emptyDict = /* @__PURE__ */ new Dict(0, emptyNode);
var errorNil = /* @__PURE__ */ Result$Error(undefined);
function newNode(generation) {
  return new Node(generation, 0, 0, []);
}
function copyNode(node, generation) {
  if (node.generation === generation) {
    return node;
  }
  const newData = node.data.slice(0);
  return new Node(generation, node.datamap, node.nodemap, newData);
}
function copyAndSet(node, generation, idx, val) {
  if (node.data[idx] === val) {
    return node;
  }
  node = copyNode(node, generation);
  node.data[idx] = val;
  return node;
}
function copyAndInsertPair(node, generation, bit, idx, key, val) {
  const data = node.data;
  const length = data.length;
  const newData = new Array(length + 2);
  let readIndex = 0;
  let writeIndex = 0;
  while (readIndex < idx)
    newData[writeIndex++] = data[readIndex++];
  newData[writeIndex++] = key;
  newData[writeIndex++] = val;
  while (readIndex < length)
    newData[writeIndex++] = data[readIndex++];
  return new Node(generation, node.datamap | bit, node.nodemap, newData);
}
function copyAndRemovePair(node, generation, bit, idx) {
  node = copyNode(node, generation);
  const data = node.data;
  const length = data.length;
  for (let w = idx, r = idx + 2;r < length; ++r, ++w) {
    data[w] = data[r];
  }
  data.pop();
  data.pop();
  node.datamap ^= bit;
  return node;
}
function make() {
  return emptyDict;
}
function size(dict) {
  return dict.size;
}
function get(dict, key) {
  const result = lookup(dict.root, key, getHash(key));
  return result !== noElementMarker ? Result$Ok(result) : errorNil;
}
function has(dict, key) {
  return lookup(dict.root, key, getHash(key)) !== noElementMarker;
}
function lookup(node, key, hash) {
  for (let shift = 0;shift < 32; shift += bits) {
    const data = node.data;
    const bit = hashbit(hash, shift);
    if (node.nodemap & bit) {
      node = data[data.length - 1 - index(node.nodemap, bit)];
    } else if (node.datamap & bit) {
      const dataidx = Math.imul(index(node.datamap, bit), 2);
      return isEqual(key, data[dataidx]) ? data[dataidx + 1] : noElementMarker;
    } else {
      return noElementMarker;
    }
  }
  const overflow = node.data;
  for (let i = 0;i < overflow.length; i += 2) {
    if (isEqual(key, overflow[i])) {
      return overflow[i + 1];
    }
  }
  return noElementMarker;
}
function toTransient(dict) {
  return {
    generation: nextGeneration(dict),
    root: dict.root,
    size: dict.size,
    dict
  };
}
function fromTransient(transient) {
  if (transient.root === transient.dict.root) {
    return transient.dict;
  }
  return new Dict(transient.size, transient.root);
}
function nextGeneration(dict) {
  const root = dict.root;
  if (root.generation < Number.MAX_SAFE_INTEGER) {
    return root.generation + 1;
  }
  const queue = [root];
  while (queue.length) {
    const node = queue.pop();
    node.generation = 0;
    const nodeStart = node.data.length - popcount(node.nodemap);
    for (let i = nodeStart;i < node.data.length; ++i) {
      queue.push(node.data[i]);
    }
  }
  return 1;
}
var globalTransient = /* @__PURE__ */ toTransient(emptyDict);
function insert(dict, key, value) {
  globalTransient.generation = nextGeneration(dict);
  globalTransient.size = dict.size;
  const hash = getHash(key);
  const root = insertIntoNode(globalTransient, dict.root, key, value, hash, 0);
  if (root === dict.root) {
    return dict;
  }
  return new Dict(globalTransient.size, root);
}
function destructiveTransientInsert(key, value, transient) {
  const hash = getHash(key);
  transient.root = insertIntoNode(transient, transient.root, key, value, hash, 0);
  return transient;
}
function destructiveTransientUpdateWith(key, fun, value, transient) {
  const hash = getHash(key);
  const existing = lookup(transient.root, key, hash);
  if (existing !== noElementMarker) {
    value = fun(existing);
  }
  transient.root = insertIntoNode(transient, transient.root, key, value, hash, 0);
  return transient;
}
function insertIntoNode(transient, node, key, value, hash, shift) {
  const data = node.data;
  const generation = transient.generation;
  if (shift > 32) {
    for (let i = 0;i < data.length; i += 2) {
      if (isEqual(key, data[i])) {
        return copyAndSet(node, generation, i + 1, value);
      }
    }
    transient.size += 1;
    return copyAndInsertPair(node, generation, 0, data.length, key, value);
  }
  const bit = hashbit(hash, shift);
  if (node.nodemap & bit) {
    const nodeidx2 = data.length - 1 - index(node.nodemap, bit);
    let child2 = data[nodeidx2];
    child2 = insertIntoNode(transient, child2, key, value, hash, shift + bits);
    return copyAndSet(node, generation, nodeidx2, child2);
  }
  const dataidx = Math.imul(index(node.datamap, bit), 2);
  if ((node.datamap & bit) === 0) {
    transient.size += 1;
    return copyAndInsertPair(node, generation, bit, dataidx, key, value);
  }
  if (isEqual(key, data[dataidx])) {
    return copyAndSet(node, generation, dataidx + 1, value);
  }
  const childShift = shift + bits;
  let child = emptyNode;
  child = insertIntoNode(transient, child, key, value, hash, childShift);
  const key2 = data[dataidx];
  const value2 = data[dataidx + 1];
  const hash2 = getHash(key2);
  child = insertIntoNode(transient, child, key2, value2, hash2, childShift);
  transient.size -= 1;
  const length = data.length;
  const nodeidx = length - 1 - index(node.nodemap, bit);
  const newData = new Array(length - 1);
  let readIndex = 0;
  let writeIndex = 0;
  while (readIndex < dataidx)
    newData[writeIndex++] = data[readIndex++];
  readIndex += 2;
  while (readIndex <= nodeidx)
    newData[writeIndex++] = data[readIndex++];
  newData[writeIndex++] = child;
  while (readIndex < length)
    newData[writeIndex++] = data[readIndex++];
  return new Node(generation, node.datamap ^ bit, node.nodemap | bit, newData);
}
function destructiveTransientDelete(key, transient) {
  const hash = getHash(key);
  transient.root = deleteFromNode(transient, transient.root, key, hash, 0);
  return transient;
}
function deleteFromNode(transient, node, key, hash, shift) {
  const data = node.data;
  const generation = transient.generation;
  if (shift > 32) {
    for (let i = 0;i < data.length; i += 2) {
      if (isEqual(key, data[i])) {
        transient.size -= 1;
        return copyAndRemovePair(node, generation, 0, i);
      }
    }
    return node;
  }
  const bit = hashbit(hash, shift);
  const dataidx = Math.imul(index(node.datamap, bit), 2);
  if ((node.nodemap & bit) !== 0) {
    const nodeidx = data.length - 1 - index(node.nodemap, bit);
    let child = data[nodeidx];
    child = deleteFromNode(transient, child, key, hash, shift + bits);
    if (child.nodemap !== 0 || child.data.length > 2) {
      return copyAndSet(node, generation, nodeidx, child);
    }
    const length = data.length;
    const newData = new Array(length + 1);
    let readIndex = 0;
    let writeIndex = 0;
    while (readIndex < dataidx)
      newData[writeIndex++] = data[readIndex++];
    newData[writeIndex++] = child.data[0];
    newData[writeIndex++] = child.data[1];
    while (readIndex < nodeidx)
      newData[writeIndex++] = data[readIndex++];
    readIndex++;
    while (readIndex < length)
      newData[writeIndex++] = data[readIndex++];
    return new Node(generation, node.datamap | bit, node.nodemap ^ bit, newData);
  }
  if ((node.datamap & bit) === 0 || !isEqual(key, data[dataidx])) {
    return node;
  }
  transient.size -= 1;
  return copyAndRemovePair(node, generation, bit, dataidx);
}
function fold(dict, state, fun) {
  const queue = [dict.root];
  while (queue.length) {
    const node = queue.pop();
    const data = node.data;
    const edgesStart = data.length - popcount(node.nodemap);
    for (let i = 0;i < edgesStart; i += 2) {
      state = fun(state, data[i], data[i + 1]);
    }
    for (let i = edgesStart;i < data.length; ++i) {
      queue.push(data[i]);
    }
  }
  return state;
}
function popcount(n) {
  n -= n >>> 1 & 1431655765;
  n = (n & 858993459) + (n >>> 2 & 858993459);
  return Math.imul(n + (n >>> 4) & 252645135, 16843009) >>> 24;
}
function index(bitmap, bit) {
  return popcount(bitmap & bit - 1);
}
function hashbit(hash, shift) {
  return 1 << (hash >>> shift & mask);
}

// build/dev/javascript/gleam_stdlib/gleam/dict.mjs
function to_list(dict) {
  return fold(dict, List$Empty$const, (acc, key, value) => {
    return prepend([key, value], acc);
  });
}
function from_list_loop(loop$transient, loop$list) {
  while (true) {
    let transient = loop$transient;
    let list = loop$list;
    if (list instanceof Empty) {
      return fromTransient(transient);
    } else {
      let rest = list.tail;
      let key = list.head[0];
      let value = list.head[1];
      loop$transient = destructiveTransientInsert(key, value, transient);
      loop$list = rest;
    }
  }
}
function from_list(list) {
  return from_list_loop(toTransient(make()), list);
}
function keys(dict) {
  return fold(dict, List$Empty$const, (acc, key, _) => {
    return prepend(key, acc);
  });
}
function delete$(dict, key) {
  let _pipe = toTransient(dict);
  let _pipe$1 = ((_capture) => {
    return destructiveTransientDelete(key, _capture);
  })(_pipe);
  return fromTransient(_pipe$1);
}
function group_loop(loop$transient, loop$to_key, loop$list) {
  while (true) {
    let transient = loop$transient;
    let to_key = loop$to_key;
    let list = loop$list;
    if (list instanceof Empty) {
      return fromTransient(transient);
    } else {
      let value = list.head;
      let rest = list.tail;
      let key = to_key(value);
      let update = (existing) => {
        return prepend(value, existing);
      };
      let _pipe = transient;
      let _pipe$1 = ((_capture) => {
        return destructiveTransientUpdateWith(key, update, prepend(value, List$Empty$const), _capture);
      })(_pipe);
      loop$transient = _pipe$1;
      loop$to_key = to_key;
      loop$list = rest;
    }
  }
}
function group(key, list) {
  return group_loop(toTransient(make()), key, list);
}

// build/dev/javascript/gleam_stdlib/gleam/list.mjs
class Ascending extends CustomType {
}
var Sorting$Ascending$const = new Ascending;

class Descending extends CustomType {
}
var Sorting$Descending$const = new Descending;
function length_loop(loop$list, loop$count) {
  while (true) {
    let list = loop$list;
    let count = loop$count;
    if (list instanceof Empty) {
      return count;
    } else {
      let list$1 = list.tail;
      loop$list = list$1;
      loop$count = count + 1;
    }
  }
}
function length(list) {
  return length_loop(list, 0);
}
function reverse_and_prepend2(loop$prefix, loop$suffix) {
  while (true) {
    let prefix = loop$prefix;
    let suffix = loop$suffix;
    if (prefix instanceof Empty) {
      return suffix;
    } else {
      let first$1 = prefix.head;
      let rest$1 = prefix.tail;
      loop$prefix = rest$1;
      loop$suffix = prepend(first$1, suffix);
    }
  }
}
function reverse2(list) {
  return reverse_and_prepend2(list, List$Empty$const);
}
function contains(loop$list, loop$elem) {
  while (true) {
    let list = loop$list;
    let elem = loop$elem;
    if (list instanceof Empty) {
      return false;
    } else {
      let first$1 = list.head;
      if (isEqual(first$1, elem)) {
        return true;
      } else {
        let rest$1 = list.tail;
        loop$list = rest$1;
        loop$elem = elem;
      }
    }
  }
}
function first(list) {
  if (list instanceof Empty) {
    return new Error(undefined);
  } else {
    let first$1 = list.head;
    return new Ok(first$1);
  }
}
function group2(list, key) {
  return group(key, list);
}
function filter_loop(loop$list, loop$fun, loop$acc) {
  while (true) {
    let list = loop$list;
    let fun = loop$fun;
    let acc = loop$acc;
    if (list instanceof Empty) {
      return reverse2(acc);
    } else {
      let first$1 = list.head;
      let rest$1 = list.tail;
      let _block;
      let $ = fun(first$1);
      if ($) {
        _block = prepend(first$1, acc);
      } else {
        _block = acc;
      }
      let new_acc = _block;
      loop$list = rest$1;
      loop$fun = fun;
      loop$acc = new_acc;
    }
  }
}
function filter(list, predicate) {
  return filter_loop(list, predicate, List$Empty$const);
}
function filter_map_loop(loop$list, loop$fun, loop$acc) {
  while (true) {
    let list = loop$list;
    let fun = loop$fun;
    let acc = loop$acc;
    if (list instanceof Empty) {
      return reverse2(acc);
    } else {
      let first$1 = list.head;
      let rest$1 = list.tail;
      let _block;
      let $ = fun(first$1);
      if ($ instanceof Ok) {
        let first$2 = $[0];
        _block = prepend(first$2, acc);
      } else {
        _block = acc;
      }
      let new_acc = _block;
      loop$list = rest$1;
      loop$fun = fun;
      loop$acc = new_acc;
    }
  }
}
function filter_map(list, fun) {
  return filter_map_loop(list, fun, List$Empty$const);
}
function map_loop(loop$list, loop$fun, loop$acc) {
  while (true) {
    let list = loop$list;
    let fun = loop$fun;
    let acc = loop$acc;
    if (list instanceof Empty) {
      return reverse2(acc);
    } else {
      let first$1 = list.head;
      let rest$1 = list.tail;
      loop$list = rest$1;
      loop$fun = fun;
      loop$acc = prepend(fun(first$1), acc);
    }
  }
}
function map2(list, fun) {
  return map_loop(list, fun, List$Empty$const);
}
function index_map_loop(loop$list, loop$fun, loop$index, loop$acc) {
  while (true) {
    let list = loop$list;
    let fun = loop$fun;
    let index2 = loop$index;
    let acc = loop$acc;
    if (list instanceof Empty) {
      return reverse2(acc);
    } else {
      let first$1 = list.head;
      let rest$1 = list.tail;
      let acc$1 = prepend(fun(first$1, index2), acc);
      loop$list = rest$1;
      loop$fun = fun;
      loop$index = index2 + 1;
      loop$acc = acc$1;
    }
  }
}
function index_map(list, fun) {
  return index_map_loop(list, fun, 0, List$Empty$const);
}
function try_map_loop(loop$list, loop$fun, loop$acc) {
  while (true) {
    let list = loop$list;
    let fun = loop$fun;
    let acc = loop$acc;
    if (list instanceof Empty) {
      return new Ok(reverse2(acc));
    } else {
      let first$1 = list.head;
      let rest$1 = list.tail;
      let $ = fun(first$1);
      if ($ instanceof Ok) {
        let first$2 = $[0];
        loop$list = rest$1;
        loop$fun = fun;
        loop$acc = prepend(first$2, acc);
      } else {
        return $;
      }
    }
  }
}
function try_map(list, fun) {
  return try_map_loop(list, fun, List$Empty$const);
}
function drop(loop$list, loop$n) {
  while (true) {
    let list = loop$list;
    let n = loop$n;
    let $ = n <= 0;
    if ($) {
      return list;
    } else {
      if (list instanceof Empty) {
        return list;
      } else {
        let rest$1 = list.tail;
        loop$list = rest$1;
        loop$n = n - 1;
      }
    }
  }
}
function take_loop(loop$list, loop$n, loop$acc) {
  while (true) {
    let list = loop$list;
    let n = loop$n;
    let acc = loop$acc;
    let $ = n <= 0;
    if ($) {
      return reverse2(acc);
    } else {
      if (list instanceof Empty) {
        return reverse2(acc);
      } else {
        let first$1 = list.head;
        let rest$1 = list.tail;
        loop$list = rest$1;
        loop$n = n - 1;
        loop$acc = prepend(first$1, acc);
      }
    }
  }
}
function take(list, n) {
  return take_loop(list, n, List$Empty$const);
}
function append_loop(loop$first, loop$second) {
  while (true) {
    let first2 = loop$first;
    let second = loop$second;
    if (first2 instanceof Empty) {
      return second;
    } else {
      let first$1 = first2.head;
      let rest$1 = first2.tail;
      loop$first = rest$1;
      loop$second = prepend(first$1, second);
    }
  }
}
function append(first2, second) {
  return append_loop(reverse2(first2), second);
}
function prepend2(list, item) {
  return prepend(item, list);
}
function flatten_loop(loop$lists, loop$acc) {
  while (true) {
    let lists = loop$lists;
    let acc = loop$acc;
    if (lists instanceof Empty) {
      return reverse2(acc);
    } else {
      let list = lists.head;
      let further_lists = lists.tail;
      loop$lists = further_lists;
      loop$acc = reverse_and_prepend2(list, acc);
    }
  }
}
function flatten(lists) {
  return flatten_loop(lists, List$Empty$const);
}
function flat_map(list, fun) {
  return flatten(map2(list, fun));
}
function fold2(loop$list, loop$initial, loop$fun) {
  while (true) {
    let list = loop$list;
    let initial = loop$initial;
    let fun = loop$fun;
    if (list instanceof Empty) {
      return initial;
    } else {
      let first$1 = list.head;
      let rest$1 = list.tail;
      loop$list = rest$1;
      loop$initial = fun(initial, first$1);
      loop$fun = fun;
    }
  }
}
function index_fold_loop(loop$over, loop$acc, loop$with, loop$index) {
  while (true) {
    let over = loop$over;
    let acc = loop$acc;
    let with$ = loop$with;
    let index2 = loop$index;
    if (over instanceof Empty) {
      return acc;
    } else {
      let first$1 = over.head;
      let rest$1 = over.tail;
      loop$over = rest$1;
      loop$acc = with$(acc, first$1, index2);
      loop$with = with$;
      loop$index = index2 + 1;
    }
  }
}
function index_fold(list, initial, fun) {
  return index_fold_loop(list, initial, fun, 0);
}
function try_fold(loop$list, loop$initial, loop$fun) {
  while (true) {
    let list = loop$list;
    let initial = loop$initial;
    let fun = loop$fun;
    if (list instanceof Empty) {
      return new Ok(initial);
    } else {
      let first$1 = list.head;
      let rest$1 = list.tail;
      let $ = fun(initial, first$1);
      if ($ instanceof Ok) {
        let result = $[0];
        loop$list = rest$1;
        loop$initial = result;
        loop$fun = fun;
      } else {
        return $;
      }
    }
  }
}
function find_map(loop$list, loop$fun) {
  while (true) {
    let list = loop$list;
    let fun = loop$fun;
    if (list instanceof Empty) {
      return new Error(undefined);
    } else {
      let first$1 = list.head;
      let rest$1 = list.tail;
      let $ = fun(first$1);
      if ($ instanceof Ok) {
        return $;
      } else {
        loop$list = rest$1;
        loop$fun = fun;
      }
    }
  }
}
function all(loop$list, loop$predicate) {
  while (true) {
    let list = loop$list;
    let predicate = loop$predicate;
    if (list instanceof Empty) {
      return true;
    } else {
      let first$1 = list.head;
      let rest$1 = list.tail;
      let $ = predicate(first$1);
      if ($) {
        loop$list = rest$1;
        loop$predicate = predicate;
      } else {
        return $;
      }
    }
  }
}
function any(loop$list, loop$predicate) {
  while (true) {
    let list = loop$list;
    let predicate = loop$predicate;
    if (list instanceof Empty) {
      return false;
    } else {
      let first$1 = list.head;
      let rest$1 = list.tail;
      let $ = predicate(first$1);
      if ($) {
        return $;
      } else {
        loop$list = rest$1;
        loop$predicate = predicate;
      }
    }
  }
}
function zip_loop(loop$one, loop$other, loop$acc) {
  while (true) {
    let one = loop$one;
    let other = loop$other;
    let acc = loop$acc;
    if (one instanceof Empty) {
      return reverse2(acc);
    } else if (other instanceof Empty) {
      return reverse2(acc);
    } else {
      let first_one = one.head;
      let rest_one = one.tail;
      let first_other = other.head;
      let rest_other = other.tail;
      loop$one = rest_one;
      loop$other = rest_other;
      loop$acc = prepend([first_one, first_other], acc);
    }
  }
}
function zip(list, other) {
  return zip_loop(list, other, List$Empty$const);
}
function unzip_loop(loop$input, loop$one, loop$other) {
  while (true) {
    let input = loop$input;
    let one = loop$one;
    let other = loop$other;
    if (input instanceof Empty) {
      return [reverse2(one), reverse2(other)];
    } else {
      let rest$1 = input.tail;
      let first_one = input.head[0];
      let first_other = input.head[1];
      loop$input = rest$1;
      loop$one = prepend(first_one, one);
      loop$other = prepend(first_other, other);
    }
  }
}
function unzip(input) {
  return unzip_loop(input, List$Empty$const, List$Empty$const);
}
function unique_loop(loop$list, loop$seen, loop$acc) {
  while (true) {
    let list = loop$list;
    let seen = loop$seen;
    let acc = loop$acc;
    if (list instanceof Empty) {
      return reverse2(acc);
    } else {
      let first$1 = list.head;
      let rest$1 = list.tail;
      let $ = has(seen, first$1);
      if ($) {
        loop$list = rest$1;
        loop$seen = seen;
        loop$acc = acc;
      } else {
        loop$list = rest$1;
        loop$seen = insert(seen, first$1, undefined);
        loop$acc = prepend(first$1, acc);
      }
    }
  }
}
function unique(list) {
  return unique_loop(list, make(), List$Empty$const);
}
function merge_descendings(loop$list1, loop$list2, loop$compare, loop$acc) {
  while (true) {
    let list1 = loop$list1;
    let list2 = loop$list2;
    let compare2 = loop$compare;
    let acc = loop$acc;
    if (list1 instanceof Empty) {
      let list = list2;
      return reverse_and_prepend2(list, acc);
    } else if (list2 instanceof Empty) {
      let list = list1;
      return reverse_and_prepend2(list, acc);
    } else {
      let first1 = list1.head;
      let rest1 = list1.tail;
      let first2 = list2.head;
      let rest2 = list2.tail;
      let $ = compare2(first1, first2);
      if ($ instanceof Lt) {
        loop$list1 = list1;
        loop$list2 = rest2;
        loop$compare = compare2;
        loop$acc = prepend(first2, acc);
      } else if ($ instanceof Eq) {
        loop$list1 = rest1;
        loop$list2 = list2;
        loop$compare = compare2;
        loop$acc = prepend(first1, acc);
      } else {
        loop$list1 = rest1;
        loop$list2 = list2;
        loop$compare = compare2;
        loop$acc = prepend(first1, acc);
      }
    }
  }
}
function merge_descending_pairs(loop$sequences, loop$compare, loop$acc) {
  while (true) {
    let sequences = loop$sequences;
    let compare2 = loop$compare;
    let acc = loop$acc;
    if (sequences instanceof Empty) {
      return reverse2(acc);
    } else {
      let $ = sequences.tail;
      if ($ instanceof Empty) {
        let sequence = sequences.head;
        return reverse2(prepend(reverse2(sequence), acc));
      } else {
        let descending1 = sequences.head;
        let descending2 = $.head;
        let rest$1 = $.tail;
        let ascending = merge_descendings(descending1, descending2, compare2, List$Empty$const);
        loop$sequences = rest$1;
        loop$compare = compare2;
        loop$acc = prepend(ascending, acc);
      }
    }
  }
}
function merge_ascendings(loop$list1, loop$list2, loop$compare, loop$acc) {
  while (true) {
    let list1 = loop$list1;
    let list2 = loop$list2;
    let compare2 = loop$compare;
    let acc = loop$acc;
    if (list1 instanceof Empty) {
      let list = list2;
      return reverse_and_prepend2(list, acc);
    } else if (list2 instanceof Empty) {
      let list = list1;
      return reverse_and_prepend2(list, acc);
    } else {
      let first1 = list1.head;
      let rest1 = list1.tail;
      let first2 = list2.head;
      let rest2 = list2.tail;
      let $ = compare2(first1, first2);
      if ($ instanceof Lt) {
        loop$list1 = rest1;
        loop$list2 = list2;
        loop$compare = compare2;
        loop$acc = prepend(first1, acc);
      } else if ($ instanceof Eq) {
        loop$list1 = list1;
        loop$list2 = rest2;
        loop$compare = compare2;
        loop$acc = prepend(first2, acc);
      } else {
        loop$list1 = list1;
        loop$list2 = rest2;
        loop$compare = compare2;
        loop$acc = prepend(first2, acc);
      }
    }
  }
}
function merge_ascending_pairs(loop$sequences, loop$compare, loop$acc) {
  while (true) {
    let sequences = loop$sequences;
    let compare2 = loop$compare;
    let acc = loop$acc;
    if (sequences instanceof Empty) {
      return reverse2(acc);
    } else {
      let $ = sequences.tail;
      if ($ instanceof Empty) {
        let sequence = sequences.head;
        return reverse2(prepend(reverse2(sequence), acc));
      } else {
        let ascending1 = sequences.head;
        let ascending2 = $.head;
        let rest$1 = $.tail;
        let descending = merge_ascendings(ascending1, ascending2, compare2, List$Empty$const);
        loop$sequences = rest$1;
        loop$compare = compare2;
        loop$acc = prepend(descending, acc);
      }
    }
  }
}
function merge_all(loop$sequences, loop$direction, loop$compare) {
  while (true) {
    let sequences = loop$sequences;
    let direction = loop$direction;
    let compare2 = loop$compare;
    if (sequences instanceof Empty) {
      return sequences;
    } else if (direction instanceof Ascending) {
      if (sequences.tail instanceof Empty) {
        let sequence = sequences.head;
        return sequence;
      } else {
        let sequences$1 = merge_ascending_pairs(sequences, compare2, List$Empty$const);
        loop$sequences = sequences$1;
        loop$direction = Sorting$Descending$const;
        loop$compare = compare2;
      }
    } else if (sequences.tail instanceof Empty) {
      let sequence = sequences.head;
      return reverse2(sequence);
    } else {
      let sequences$1 = merge_descending_pairs(sequences, compare2, List$Empty$const);
      loop$sequences = sequences$1;
      loop$direction = Sorting$Ascending$const;
      loop$compare = compare2;
    }
  }
}
function sequences(loop$list, loop$compare, loop$growing, loop$direction, loop$prev, loop$acc) {
  while (true) {
    let list = loop$list;
    let compare2 = loop$compare;
    let growing = loop$growing;
    let direction = loop$direction;
    let prev = loop$prev;
    let acc = loop$acc;
    let growing$1 = prepend(prev, growing);
    if (list instanceof Empty) {
      if (direction instanceof Ascending) {
        return prepend(reverse2(growing$1), acc);
      } else {
        return prepend(growing$1, acc);
      }
    } else {
      let new$1 = list.head;
      let rest$1 = list.tail;
      let $ = compare2(prev, new$1);
      if (direction instanceof Ascending) {
        if ($ instanceof Lt) {
          loop$list = rest$1;
          loop$compare = compare2;
          loop$growing = growing$1;
          loop$direction = direction;
          loop$prev = new$1;
          loop$acc = acc;
        } else if ($ instanceof Eq) {
          loop$list = rest$1;
          loop$compare = compare2;
          loop$growing = growing$1;
          loop$direction = direction;
          loop$prev = new$1;
          loop$acc = acc;
        } else {
          let _block;
          if (direction instanceof Ascending) {
            _block = prepend(reverse2(growing$1), acc);
          } else {
            _block = prepend(growing$1, acc);
          }
          let acc$1 = _block;
          if (rest$1 instanceof Empty) {
            return prepend(prepend(new$1, List$Empty$const), acc$1);
          } else {
            let next = rest$1.head;
            let rest$2 = rest$1.tail;
            let _block$1;
            let $1 = compare2(new$1, next);
            if ($1 instanceof Lt) {
              _block$1 = Sorting$Ascending$const;
            } else if ($1 instanceof Eq) {
              _block$1 = Sorting$Ascending$const;
            } else {
              _block$1 = Sorting$Descending$const;
            }
            let direction$1 = _block$1;
            loop$list = rest$2;
            loop$compare = compare2;
            loop$growing = prepend(new$1, List$Empty$const);
            loop$direction = direction$1;
            loop$prev = next;
            loop$acc = acc$1;
          }
        }
      } else if ($ instanceof Lt) {
        let _block;
        if (direction instanceof Ascending) {
          _block = prepend(reverse2(growing$1), acc);
        } else {
          _block = prepend(growing$1, acc);
        }
        let acc$1 = _block;
        if (rest$1 instanceof Empty) {
          return prepend(prepend(new$1, List$Empty$const), acc$1);
        } else {
          let next = rest$1.head;
          let rest$2 = rest$1.tail;
          let _block$1;
          let $1 = compare2(new$1, next);
          if ($1 instanceof Lt) {
            _block$1 = Sorting$Ascending$const;
          } else if ($1 instanceof Eq) {
            _block$1 = Sorting$Ascending$const;
          } else {
            _block$1 = Sorting$Descending$const;
          }
          let direction$1 = _block$1;
          loop$list = rest$2;
          loop$compare = compare2;
          loop$growing = prepend(new$1, List$Empty$const);
          loop$direction = direction$1;
          loop$prev = next;
          loop$acc = acc$1;
        }
      } else if ($ instanceof Eq) {
        let _block;
        if (direction instanceof Ascending) {
          _block = prepend(reverse2(growing$1), acc);
        } else {
          _block = prepend(growing$1, acc);
        }
        let acc$1 = _block;
        if (rest$1 instanceof Empty) {
          return prepend(prepend(new$1, List$Empty$const), acc$1);
        } else {
          let next = rest$1.head;
          let rest$2 = rest$1.tail;
          let _block$1;
          let $1 = compare2(new$1, next);
          if ($1 instanceof Lt) {
            _block$1 = Sorting$Ascending$const;
          } else if ($1 instanceof Eq) {
            _block$1 = Sorting$Ascending$const;
          } else {
            _block$1 = Sorting$Descending$const;
          }
          let direction$1 = _block$1;
          loop$list = rest$2;
          loop$compare = compare2;
          loop$growing = prepend(new$1, List$Empty$const);
          loop$direction = direction$1;
          loop$prev = next;
          loop$acc = acc$1;
        }
      } else {
        loop$list = rest$1;
        loop$compare = compare2;
        loop$growing = growing$1;
        loop$direction = direction;
        loop$prev = new$1;
        loop$acc = acc;
      }
    }
  }
}
function sort(list, compare2) {
  if (list instanceof Empty) {
    return list;
  } else {
    let $ = list.tail;
    if ($ instanceof Empty) {
      return list;
    } else {
      let x = list.head;
      let y = $.head;
      let rest$1 = $.tail;
      let _block;
      let $1 = compare2(x, y);
      if ($1 instanceof Lt) {
        _block = Sorting$Ascending$const;
      } else if ($1 instanceof Eq) {
        _block = Sorting$Ascending$const;
      } else {
        _block = Sorting$Descending$const;
      }
      let direction = _block;
      let sequences$1 = sequences(rest$1, compare2, prepend(x, List$Empty$const), direction, y, List$Empty$const);
      return merge_all(sequences$1, Sorting$Ascending$const, compare2);
    }
  }
}
function key_find(keyword_list, desired_key) {
  return find_map(keyword_list, (keyword) => {
    let key = keyword[0];
    let value = keyword[1];
    let $ = isEqual(key, desired_key);
    if ($) {
      return new Ok(value);
    } else {
      return new Error(undefined);
    }
  });
}
function each(loop$list, loop$f) {
  while (true) {
    let list = loop$list;
    let f = loop$f;
    if (list instanceof Empty) {
      return;
    } else {
      let first$1 = list.head;
      let rest$1 = list.tail;
      f(first$1);
      loop$list = rest$1;
      loop$f = f;
    }
  }
}
function partition_loop(loop$list, loop$categorise, loop$trues, loop$falses) {
  while (true) {
    let list = loop$list;
    let categorise = loop$categorise;
    let trues = loop$trues;
    let falses = loop$falses;
    if (list instanceof Empty) {
      return [reverse2(trues), reverse2(falses)];
    } else {
      let first$1 = list.head;
      let rest$1 = list.tail;
      let $ = categorise(first$1);
      if ($) {
        loop$list = rest$1;
        loop$categorise = categorise;
        loop$trues = prepend(first$1, trues);
        loop$falses = falses;
      } else {
        loop$list = rest$1;
        loop$categorise = categorise;
        loop$trues = trues;
        loop$falses = prepend(first$1, falses);
      }
    }
  }
}
function partition(list, categorise) {
  return partition_loop(list, categorise, List$Empty$const, List$Empty$const);
}
function permutation_prepend(loop$el, loop$permutations, loop$list_1, loop$list_2, loop$acc) {
  while (true) {
    let el = loop$el;
    let permutations = loop$permutations;
    let list_1 = loop$list_1;
    let list_2 = loop$list_2;
    let acc = loop$acc;
    if (permutations instanceof Empty) {
      return permutation_zip(list_1, list_2, acc);
    } else {
      let head = permutations.head;
      let tail = permutations.tail;
      loop$el = el;
      loop$permutations = tail;
      loop$list_1 = list_1;
      loop$list_2 = list_2;
      loop$acc = prepend(prepend(el, head), acc);
    }
  }
}
function permutation_zip(list, rest, acc) {
  if (list instanceof Empty) {
    return reverse2(acc);
  } else {
    let head = list.head;
    let tail = list.tail;
    return permutation_prepend(head, permutations(reverse_and_prepend2(rest, tail)), tail, prepend(head, rest), acc);
  }
}
function permutations(list) {
  if (list instanceof Empty) {
    return prepend(List$Empty$const, List$Empty$const);
  } else {
    let l = list;
    return permutation_zip(l, List$Empty$const, List$Empty$const);
  }
}
function window_loop(loop$acc, loop$list, loop$n) {
  while (true) {
    let acc = loop$acc;
    let list = loop$list;
    let n = loop$n;
    let window$1 = take(list, n);
    let $ = length(window$1) === n;
    if ($) {
      loop$acc = prepend(window$1, acc);
      loop$list = drop(list, 1);
      loop$n = n;
    } else {
      return reverse2(acc);
    }
  }
}
function window2(list, n) {
  let $ = n <= 0;
  if ($) {
    return List$Empty$const;
  } else {
    return window_loop(List$Empty$const, list, n);
  }
}
function last(loop$list) {
  while (true) {
    let list = loop$list;
    if (list instanceof Empty) {
      return new Error(undefined);
    } else {
      let $ = list.tail;
      if ($ instanceof Empty) {
        let last$1 = list.head;
        return new Ok(last$1);
      } else {
        let rest$1 = $;
        loop$list = rest$1;
      }
    }
  }
}

// build/dev/javascript/gleam_stdlib/gleam/string_tree.mjs
class All extends CustomType {
}
var Direction$All$const = new All;

// build/dev/javascript/gleam_stdlib/gleam/string.mjs
class Leading extends CustomType {
}
var Direction$Leading$const = new Leading;

class Trailing extends CustomType {
}
var Direction$Trailing$const = new Trailing;
function replace(string, pattern, substitute) {
  let _pipe = string;
  let _pipe$1 = identity(_pipe);
  let _pipe$2 = string_replace(_pipe$1, pattern, substitute);
  return identity(_pipe$2);
}
function compare2(a, b) {
  let $ = a === b;
  if ($) {
    return Order$Eq$const;
  } else {
    let $1 = less_than(a, b);
    if ($1) {
      return Order$Lt$const;
    } else {
      return Order$Gt$const;
    }
  }
}
function slice(string, idx, len) {
  let $ = len <= 0;
  if ($) {
    return "";
  } else {
    let $1 = idx < 0;
    if ($1) {
      let translated_idx = string_length(string) + idx;
      let $2 = translated_idx < 0;
      if ($2) {
        return "";
      } else {
        return string_grapheme_slice(string, translated_idx, len);
      }
    } else {
      return string_grapheme_slice(string, idx, len);
    }
  }
}
function drop_start(string, num_graphemes) {
  let $ = num_graphemes <= 0;
  if ($) {
    return string;
  } else {
    let prefix = string_grapheme_slice(string, 0, num_graphemes);
    let prefix_size = byte_size(prefix);
    return string_byte_slice(string, prefix_size, byte_size(string) - prefix_size);
  }
}
function split2(x, substring) {
  if (substring === "") {
    return graphemes(x);
  } else {
    let _pipe = x;
    let _pipe$1 = identity(_pipe);
    let _pipe$2 = split(_pipe$1, substring);
    return map2(_pipe$2, identity);
  }
}
function concat_loop(loop$strings, loop$accumulator) {
  while (true) {
    let strings = loop$strings;
    let accumulator = loop$accumulator;
    if (strings instanceof Empty) {
      return accumulator;
    } else {
      let string = strings.head;
      let strings$1 = strings.tail;
      loop$strings = strings$1;
      loop$accumulator = accumulator + string;
    }
  }
}
function concat2(strings) {
  return concat_loop(strings, "");
}
function join_loop(loop$strings, loop$separator, loop$accumulator) {
  while (true) {
    let strings = loop$strings;
    let separator = loop$separator;
    let accumulator = loop$accumulator;
    if (strings instanceof Empty) {
      return accumulator;
    } else {
      let string = strings.head;
      let strings$1 = strings.tail;
      loop$strings = strings$1;
      loop$separator = separator;
      loop$accumulator = accumulator + separator + string;
    }
  }
}
function join(strings, separator) {
  if (strings instanceof Empty) {
    return "";
  } else {
    let first$1 = strings.head;
    let rest = strings.tail;
    return join_loop(rest, separator, first$1);
  }
}
function trim(string) {
  let _pipe = string;
  let _pipe$1 = trim_start(_pipe);
  return trim_end(_pipe$1);
}
function first2(string) {
  let $ = pop_grapheme(string);
  if ($ instanceof Ok) {
    let first$1 = $[0][0];
    return new Ok(first$1);
  } else {
    return $;
  }
}

// build/dev/javascript/gleam_stdlib/gleam/dynamic/decode.mjs
class DecodeError extends CustomType {
  constructor(expected, found, path) {
    super();
    this.expected = expected;
    this.found = found;
    this.path = path;
  }
}
var DecodeError$DecodeError = (expected, found, path) => new DecodeError(expected, found, path);
class Decoder extends CustomType {
  constructor(function$) {
    super();
    this.function = function$;
  }
}
var float2 = /* @__PURE__ */ new Decoder(decode_float);
var int2 = /* @__PURE__ */ new Decoder(decode_int);
var string2 = /* @__PURE__ */ new Decoder(decode_string);
function run(data, decoder) {
  let $ = decoder.function(data);
  let maybe_invalid_data = $[0];
  let errors = $[1];
  if (errors instanceof Empty) {
    return new Ok(maybe_invalid_data);
  } else {
    return new Error(errors);
  }
}
function run_dynamic_function(data, name, f) {
  let $ = f(data);
  if ($ instanceof Ok) {
    let data$1 = $[0];
    return [data$1, List$Empty$const];
  } else {
    let placeholder = $[0];
    return [
      placeholder,
      prepend(new DecodeError(name, classify_dynamic(data), List$Empty$const), List$Empty$const)
    ];
  }
}
function decode_float(data) {
  return run_dynamic_function(data, "Float", float);
}
function map3(decoder, transformer) {
  return new Decoder((d) => {
    let $ = decoder.function(d);
    let data = $[0];
    let errors = $[1];
    return [transformer(data), errors];
  });
}
function decode_int(data) {
  return run_dynamic_function(data, "Int", int);
}
function decode_string(data) {
  return run_dynamic_function(data, "String", string);
}
function run_decoders(loop$data, loop$failure, loop$decoders) {
  while (true) {
    let data = loop$data;
    let failure = loop$failure;
    let decoders = loop$decoders;
    if (decoders instanceof Empty) {
      return failure;
    } else {
      let decoder = decoders.head;
      let decoders$1 = decoders.tail;
      let $ = decoder.function(data);
      let layer = $;
      let errors = $[1];
      if (errors instanceof Empty) {
        return layer;
      } else {
        loop$data = data;
        loop$failure = failure;
        loop$decoders = decoders$1;
      }
    }
  }
}
function one_of(first3, alternatives) {
  return new Decoder((dynamic_data) => {
    let $ = first3.function(dynamic_data);
    let layer = $;
    let errors = $[1];
    if (errors instanceof Empty) {
      return layer;
    } else {
      return run_decoders(dynamic_data, layer, alternatives);
    }
  });
}
function path_segment_to_string(key) {
  let decoder = one_of(string2, prepend((() => {
    let _pipe = int2;
    return map3(_pipe, to_string);
  })(), prepend((() => {
    let _pipe = float2;
    return map3(_pipe, float_to_string);
  })(), List$Empty$const)));
  let $ = run(key, decoder);
  if ($ instanceof Ok) {
    let key$1 = $[0];
    return key$1;
  } else {
    return "<" + classify_dynamic(key) + ">";
  }
}
function push_path(layer, path) {
  let path$1 = map2(path, (key) => {
    let _pipe = key;
    let _pipe$1 = identity(_pipe);
    return path_segment_to_string(_pipe$1);
  });
  let errors = map2(layer[1], (error) => {
    return new DecodeError(error.expected, error.found, append(path$1, error.path));
  });
  return [layer[0], errors];
}
function list2(inner) {
  return new Decoder((data) => {
    return list(data, inner.function, (p, k) => {
      return push_path(p, prepend(k, List$Empty$const));
    }, 0, List$Empty$const);
  });
}
function index3(loop$path, loop$position, loop$inner, loop$data, loop$handle_miss) {
  while (true) {
    let path = loop$path;
    let position = loop$position;
    let inner = loop$inner;
    let data = loop$data;
    let handle_miss = loop$handle_miss;
    if (path instanceof Empty) {
      let _pipe = data;
      let _pipe$1 = inner(_pipe);
      return push_path(_pipe$1, reverse2(position));
    } else {
      let key = path.head;
      let path$1 = path.tail;
      let $ = index2(data, key);
      if ($ instanceof Ok) {
        let $1 = $[0];
        if ($1 instanceof Some) {
          let data$1 = $1[0];
          loop$path = path$1;
          loop$position = prepend(key, position);
          loop$inner = inner;
          loop$data = data$1;
          loop$handle_miss = handle_miss;
        } else {
          return handle_miss(data, prepend(key, position));
        }
      } else {
        let kind = $[0];
        let $1 = inner(data);
        let default$ = $1[0];
        let _pipe = [
          default$,
          prepend(new DecodeError(kind, classify_dynamic(data), List$Empty$const), List$Empty$const)
        ];
        return push_path(_pipe, reverse2(position));
      }
    }
  }
}
function subfield(field_path, field_decoder, next) {
  return new Decoder((data) => {
    let $ = index3(field_path, List$Empty$const, field_decoder.function, data, (data2, position) => {
      let $12 = field_decoder.function(data2);
      let default$ = $12[0];
      let _pipe = [
        default$,
        prepend(new DecodeError("Field", "Nothing", List$Empty$const), List$Empty$const)
      ];
      return push_path(_pipe, reverse2(position));
    });
    let out = $[0];
    let errors1 = $[1];
    let $1 = next(out).function(data);
    let out$1 = $1[0];
    let errors2 = $1[1];
    return [out$1, append(errors1, errors2)];
  });
}
function success(data) {
  return new Decoder((_) => {
    return [data, List$Empty$const];
  });
}
function decode_error(expected, found) {
  return prepend(new DecodeError(expected, classify_dynamic(found), List$Empty$const), List$Empty$const);
}
function field(field_name, field_decoder, next) {
  return subfield(prepend(field_name, List$Empty$const), field_decoder, next);
}
function optional(inner) {
  return new Decoder((data) => {
    let $ = is_null(data);
    if ($) {
      return [Option$None$const, List$Empty$const];
    } else {
      let $1 = inner.function(data);
      let data$1 = $1[0];
      let errors = $1[1];
      return [new Some(data$1), errors];
    }
  });
}
function failure(placeholder, name) {
  return new Decoder((d) => {
    return [placeholder, decode_error(name, d)];
  });
}

// build/dev/javascript/gleam_stdlib/gleam_stdlib.mjs
var Nil = undefined;
function identity(x) {
  return x;
}
function parse_int(value) {
  if (/^[-+]?(\d+)$/.test(value)) {
    return Result$Ok(parseInt(value));
  } else {
    return Result$Error(Nil);
  }
}
function to_string(term) {
  return term.toString();
}
function string_replace(string3, target, substitute) {
  return string3.replaceAll(target, substitute);
}
function string_length(string3) {
  if (string3 === "") {
    return 0;
  }
  const iterator = graphemes_iterator(string3);
  if (iterator) {
    let i = 0;
    for (const _ of iterator) {
      i++;
    }
    return i;
  } else {
    return string3.match(/./gsu).length;
  }
}
function graphemes(string3) {
  const iterator = graphemes_iterator(string3);
  if (iterator) {
    return arrayToList(Array.from(iterator).map((item) => item.segment));
  } else {
    return arrayToList(string3.match(/./gsu));
  }
}
var segmenter = undefined;
function graphemes_iterator(string3) {
  if (globalThis.Intl && Intl.Segmenter) {
    segmenter ||= new Intl.Segmenter;
    return segmenter.segment(string3)[Symbol.iterator]();
  }
}
function pop_grapheme(string3) {
  let first3;
  const iterator = graphemes_iterator(string3);
  if (iterator) {
    first3 = iterator.next().value?.segment;
  } else {
    first3 = string3.match(/./su)?.[0];
  }
  if (first3) {
    return Result$Ok([first3, string3.slice(first3.length)]);
  } else {
    return Result$Error(Nil);
  }
}
function pop_codeunit(str) {
  return [str.charCodeAt(0) | 0, str.slice(1)];
}
function lowercase(string3) {
  return string3.toLowerCase();
}
function uppercase(string3) {
  return string3.toUpperCase();
}
function less_than(a, b) {
  return a < b;
}
function split(xs, pattern) {
  return arrayToList(xs.split(pattern));
}
function string_byte_slice(string3, index4, length3) {
  return string3.slice(index4, index4 + length3);
}
function string_grapheme_slice(string3, idx, len) {
  if (len <= 0 || idx >= string3.length) {
    return "";
  }
  const iterator = graphemes_iterator(string3);
  if (iterator) {
    while (idx-- > 0) {
      iterator.next();
    }
    let result = "";
    while (len-- > 0) {
      const v = iterator.next().value;
      if (v === undefined) {
        break;
      }
      result += v.segment;
    }
    return result;
  } else {
    return string3.match(/./gsu).slice(idx, idx + len).join("");
  }
}
function string_codeunit_slice(str, from2, length3) {
  return str.slice(from2, from2 + length3);
}
function starts_with(haystack, needle) {
  return haystack.startsWith(needle);
}
function split_once(haystack, needle) {
  const index4 = haystack.indexOf(needle);
  if (index4 >= 0) {
    const before = haystack.slice(0, index4);
    const after = haystack.slice(index4 + needle.length);
    return Result$Ok([before, after]);
  } else {
    return Result$Error(Nil);
  }
}
var unicode_whitespaces = [
  " ",
  "\t",
  `
`,
  "\v",
  "\f",
  "\r",
  "",
  "\u2028",
  "\u2029"
].join("");
var trim_start_regex = /* @__PURE__ */ new RegExp(`^[${unicode_whitespaces}]*`);
var trim_end_regex = /* @__PURE__ */ new RegExp(`[${unicode_whitespaces}]*$`);
function trim_start(string3) {
  return string3.replace(trim_start_regex, "");
}
function trim_end(string3) {
  return string3.replace(trim_end_regex, "");
}
function unsafe_percent_decode(string3) {
  return decodeURIComponent(string3 || "");
}
function percent_decode(string3) {
  try {
    return Result$Ok(unsafe_percent_decode(string3));
  } catch {
    return Result$Error(Nil);
  }
}
function percent_encode(string3) {
  return encodeURIComponent(string3).replaceAll("%2B", "+");
}
function classify_dynamic(data) {
  if (typeof data === "string") {
    return "String";
  } else if (typeof data === "boolean") {
    return "Bool";
  } else if (isResult(data)) {
    return "Result";
  } else if (isList(data)) {
    return "List";
  } else if (data instanceof BitArray) {
    return "BitArray";
  } else if (data instanceof Dict) {
    return "Dict";
  } else if (Number.isInteger(data)) {
    return "Int";
  } else if (Array.isArray(data)) {
    return `Array`;
  } else if (typeof data === "number") {
    return "Float";
  } else if (data === null) {
    return "Nil";
  } else if (data === undefined) {
    return "Nil";
  } else {
    const type = typeof data;
    return type.charAt(0).toUpperCase() + type.slice(1);
  }
}
function byte_size(string3) {
  return new TextEncoder().encode(string3).length;
}
var MIN_I32 = -(2 ** 31);
var MAX_I32 = 2 ** 31 - 1;
var U32 = 2 ** 32;
var MAX_SAFE = Number.MAX_SAFE_INTEGER;
var MIN_SAFE = Number.MIN_SAFE_INTEGER;
function float_to_string(float3) {
  const string3 = float3.toString().replace("+", "");
  if (string3.indexOf(".") >= 0) {
    return string3;
  } else {
    const index4 = string3.indexOf("e");
    if (index4 >= 0) {
      return string3.slice(0, index4) + ".0" + string3.slice(index4);
    } else {
      return string3 + ".0";
    }
  }
}

class Inspector {
  #references = new Set;
  inspect(v) {
    const t = typeof v;
    if (v === true)
      return "True";
    if (v === false)
      return "False";
    if (v === null)
      return "//js(null)";
    if (v === undefined)
      return "Nil";
    if (t === "string")
      return this.#string(v);
    if (t === "bigint" || Number.isInteger(v))
      return v.toString();
    if (t === "number")
      return float_to_string(v);
    if (v instanceof UtfCodepoint)
      return this.#utfCodepoint(v);
    if (v instanceof BitArray)
      return this.#bit_array(v);
    if (v instanceof RegExp)
      return `//js(${v})`;
    if (v instanceof Date)
      return `//js(Date("${v.toISOString()}"))`;
    if (v instanceof globalThis.Error)
      return `//js(${v.toString()})`;
    if (v instanceof Function) {
      const args = [];
      for (const i of Array(v.length).keys())
        args.push(String.fromCharCode(i + 97));
      return `//fn(${args.join(", ")}) { ... }`;
    }
    if (this.#references.size === this.#references.add(v).size) {
      return "//js(circular reference)";
    }
    let printed;
    if (Array.isArray(v)) {
      printed = `#(${v.map((v2) => this.inspect(v2)).join(", ")})`;
    } else if (isList(v)) {
      printed = this.#list(v);
    } else if (v instanceof CustomType) {
      printed = this.#customType(v);
    } else if (v instanceof Dict) {
      printed = this.#dict(v);
    } else if (v instanceof Set) {
      return `//js(Set(${[...v].map((v2) => this.inspect(v2)).join(", ")}))`;
    } else {
      printed = this.#object(v);
    }
    this.#references.delete(v);
    return printed;
  }
  #object(v) {
    const name = Object.getPrototypeOf(v)?.constructor?.name || "Object";
    const props = [];
    for (const k of Object.keys(v)) {
      props.push(`${this.inspect(k)}: ${this.inspect(v[k])}`);
    }
    const body = props.length ? " " + props.join(", ") + " " : "";
    const head = name === "Object" ? "" : name + " ";
    return `//js(${head}{${body}})`;
  }
  #dict(map4) {
    let body = "dict.from_list([";
    let first3 = true;
    body = fold(map4, body, (body2, key, value) => {
      if (!first3)
        body2 = body2 + ", ";
      first3 = false;
      return body2 + "#(" + this.inspect(key) + ", " + this.inspect(value) + ")";
    });
    return body + "])";
  }
  #customType(record) {
    const props = Object.keys(record).map((label) => {
      const value = this.inspect(record[label]);
      return isNaN(parseInt(label)) ? `${label}: ${value}` : value;
    }).join(", ");
    return props ? `${record.constructor.name}(${props})` : record.constructor.name;
  }
  #list(list3) {
    if (List$isEmpty(list3)) {
      return "[]";
    }
    let char_out = 'charlist.from_string("';
    let list_out = "[";
    let current = list3;
    while (List$isNonEmpty(current)) {
      let element = current.head;
      current = current.tail;
      if (list_out !== "[") {
        list_out += ", ";
      }
      list_out += this.inspect(element);
      if (char_out) {
        if (Number.isInteger(element) && element >= 32 && element <= 126) {
          char_out += String.fromCharCode(element);
        } else {
          char_out = null;
        }
      }
    }
    if (char_out) {
      return char_out + '")';
    } else {
      return list_out + "]";
    }
  }
  #string(str) {
    let new_str = '"';
    for (let i = 0;i < str.length; i++) {
      const char = str[i];
      switch (char) {
        case `
`:
          new_str += "\\n";
          break;
        case "\r":
          new_str += "\\r";
          break;
        case "\t":
          new_str += "\\t";
          break;
        case "\f":
          new_str += "\\f";
          break;
        case "\\":
          new_str += "\\\\";
          break;
        case '"':
          new_str += "\\\"";
          break;
        default:
          if (char < " " || char > "~" && char < " ") {
            new_str += "\\u{" + char.charCodeAt(0).toString(16).toUpperCase().padStart(4, "0") + "}";
          } else {
            new_str += char;
          }
      }
    }
    new_str += '"';
    return new_str;
  }
  #utfCodepoint(codepoint2) {
    return `//utfcodepoint(${String.fromCodePoint(codepoint2.value)})`;
  }
  #bit_array(bits2) {
    if (bits2.bitSize === 0) {
      return "<<>>";
    }
    let acc = "<<";
    for (let i = 0;i < bits2.byteSize - 1; i++) {
      acc += bits2.byteAt(i).toString();
      acc += ", ";
    }
    if (bits2.byteSize * 8 === bits2.bitSize) {
      acc += bits2.byteAt(bits2.byteSize - 1).toString();
    } else {
      const trailingBitsCount = bits2.bitSize % 8;
      acc += bits2.byteAt(bits2.byteSize - 1) >> 8 - trailingBitsCount;
      acc += `:size(${trailingBitsCount})`;
    }
    acc += ">>";
    return acc;
  }
}
function index2(data, key) {
  if (data instanceof Dict) {
    const result = get(data, key);
    return Result$Ok(result.isOk() ? new Some(result[0]) : new None);
  }
  if (data instanceof WeakMap || data instanceof Map) {
    const token = {};
    const entry = data.get(key, token);
    if (entry === token)
      return Result$Ok(new None);
    return Result$Ok(new Some(entry));
  }
  const key_is_int = Number.isInteger(key);
  if (key_is_int && key >= 0 && key < 8 && isList(data)) {
    let i = 0;
    for (const value of data) {
      if (i === key)
        return Result$Ok(new Some(value));
      i++;
    }
    return Result$Error("Indexable");
  }
  if (key_is_int && Array.isArray(data) || data && typeof data === "object" || data && Object.getPrototypeOf(data) === Object.prototype) {
    if (key in data)
      return Result$Ok(new Some(data[key]));
    return Result$Ok(new None);
  }
  return Result$Error(key_is_int ? "Indexable" : "Dict");
}
function list(data, decode, pushPath, index4, emptyList) {
  if (!(isList(data) || Array.isArray(data))) {
    const error = DecodeError$DecodeError("List", classify_dynamic(data), emptyList);
    return [emptyList, arrayToList([error])];
  }
  const decoded = [];
  for (const element of data) {
    const layer = decode(element);
    const [out, errors] = layer;
    if (List$isNonEmpty(errors)) {
      const [_, errors2] = pushPath(layer, index4.toString());
      return [emptyList, errors2];
    }
    decoded.push(out);
    index4++;
  }
  return [arrayToList(decoded), emptyList];
}
function float(data) {
  if (typeof data === "number")
    return Result$Ok(data);
  return Result$Error(0);
}
function int(data) {
  if (Number.isInteger(data))
    return Result$Ok(data);
  return Result$Error(0);
}
function string(data) {
  if (typeof data === "string")
    return Result$Ok(data);
  return Result$Error("");
}
function is_null(data) {
  return data === null || data === undefined;
}
function arrayToList(array) {
  let list3 = List$Empty();
  let i = array.length;
  while (i--) {
    list3 = List$NonEmpty(array[i], list3);
  }
  return list3;
}
function isList(data) {
  return List$isEmpty(data) || List$isNonEmpty(data);
}
function isResult(data) {
  return Result$isOk(data) || Result$isError(data);
}

// build/dev/javascript/gleam_stdlib/gleam/int.mjs
function absolute_value(x) {
  let $ = x >= 0;
  if ($) {
    return x;
  } else {
    return x * -1;
  }
}
function max(a, b) {
  let $ = a > b;
  if ($) {
    return a;
  } else {
    return b;
  }
}
function min(a, b) {
  let $ = a < b;
  if ($) {
    return a;
  } else {
    return b;
  }
}
function compare3(a, b) {
  let $ = a === b;
  if ($) {
    return Order$Eq$const;
  } else {
    let $1 = a < b;
    if ($1) {
      return Order$Lt$const;
    } else {
      return Order$Gt$const;
    }
  }
}
function range_loop(loop$current, loop$stop, loop$increment, loop$acc, loop$reducer) {
  while (true) {
    let current = loop$current;
    let stop = loop$stop;
    let increment = loop$increment;
    let acc = loop$acc;
    let reducer = loop$reducer;
    let $ = current === stop;
    if ($) {
      return acc;
    } else {
      let acc$1 = reducer(acc, current);
      let current$1 = current + increment;
      loop$current = current$1;
      loop$stop = stop;
      loop$increment = increment;
      loop$acc = acc$1;
      loop$reducer = reducer;
    }
  }
}
function range(start, stop, acc, reducer) {
  let _block;
  let $ = start < stop;
  if ($) {
    _block = 1;
  } else {
    _block = -1;
  }
  let increment = _block;
  return range_loop(start, stop, increment, acc, reducer);
}
// build/dev/javascript/edit_distance/edit_distance.mjs
var FILEPATH = "src/edit_distance.gleam";
function update_distances(loop$grapheme, loop$other, loop$previous_distances, loop$last_distance, loop$new_distances) {
  while (true) {
    let grapheme = loop$grapheme;
    let other = loop$other;
    let previous_distances = loop$previous_distances;
    let last_distance = loop$last_distance;
    let new_distances = loop$new_distances;
    if (other instanceof Empty) {
      return reverse2(new_distances);
    } else if (previous_distances instanceof Empty) {
      return reverse2(new_distances);
    } else {
      let $ = previous_distances.tail;
      if ($ instanceof Empty) {
        return reverse2(new_distances);
      } else {
        let first3 = other.head;
        let other$1 = other.tail;
        let previous_distance = previous_distances.head;
        let rest = $;
        let second_distance;
        if (rest instanceof Empty) {
          throw makeError("let_assert", FILEPATH, "edit_distance", 101, "update_distances", "Pattern match failed, no pattern matched the value.", {
            value: rest,
            start: 3817,
            end: 3856,
            pattern_start: 3828,
            pattern_end: 3849
          });
        } else {
          second_distance = rest.head;
        }
        let insertion_distance = last_distance + 1;
        let deletion_distance = second_distance + 1;
        let _block;
        let $1 = grapheme === first3;
        if ($1) {
          _block = previous_distance;
        } else {
          _block = previous_distance + 1;
        }
        let substitution_distance = _block;
        let _block$1;
        let _pipe = substitution_distance;
        let _pipe$1 = min(_pipe, insertion_distance);
        _block$1 = min(_pipe$1, deletion_distance);
        let new_distance = _block$1;
        let new_distances$1 = prepend(new_distance, new_distances);
        loop$grapheme = grapheme;
        loop$other = other$1;
        loop$previous_distances = rest;
        loop$last_distance = new_distance;
        loop$new_distances = new_distances$1;
      }
    }
  }
}
function levenshtein_loop(loop$one, loop$other, loop$distances, loop$prefix_size) {
  while (true) {
    let one = loop$one;
    let other = loop$other;
    let distances = loop$distances;
    let prefix_size = loop$prefix_size;
    if (one instanceof Empty) {
      let $ = last(distances);
      let distance;
      if ($ instanceof Ok) {
        distance = $[0];
      } else {
        throw makeError("let_assert", FILEPATH, "edit_distance", 52, "levenshtein_loop", "distance list will always have at least one item", {
          value: $,
          start: 1928,
          end: 1974,
          pattern_start: 1939,
          pattern_end: 1951
        });
      }
      return distance;
    } else {
      let first3 = one.head;
      let rest = one.tail;
      let prefix_size$1 = prefix_size + 1;
      let new_distances = prepend(prefix_size$1, List$Empty$const);
      let distance_list = update_distances(first3, other, distances, prefix_size$1, new_distances);
      loop$one = rest;
      loop$other = other;
      loop$distances = distance_list;
      loop$prefix_size = prefix_size$1;
    }
  }
}
function levenshtein(one, other) {
  if (one === other) {
    return 0;
  } else if (one === "") {
    let string3 = other;
    return string_length(string3);
  } else if (other === "") {
    let string3 = one;
    return string_length(string3);
  } else {
    let one$1 = one;
    let other$1 = other;
    let one$2 = graphemes(one$1);
    let other$2 = graphemes(other$1);
    let distance_list = range(length(other$2), -1, List$Empty$const, prepend2);
    return levenshtein_loop(one$2, other$2, distance_list, 0);
  }
}

// build/dev/javascript/gleam_stdlib/gleam/bool.mjs
function guard(requirement, consequence, alternative) {
  if (requirement) {
    return consequence;
  } else {
    return alternative();
  }
}
function lazy_guard(requirement, consequence, alternative) {
  if (requirement) {
    return consequence();
  } else {
    return alternative();
  }
}

// build/dev/javascript/gleam_stdlib/gleam/result.mjs
function is_ok(result) {
  if (result instanceof Ok) {
    return true;
  } else {
    return false;
  }
}
function map4(result, fun) {
  if (result instanceof Ok) {
    let x = result[0];
    return new Ok(fun(x));
  } else {
    return result;
  }
}
function map_error(result, fun) {
  if (result instanceof Ok) {
    return result;
  } else {
    let error = result[0];
    return new Error(fun(error));
  }
}
function try$(result, fun) {
  if (result instanceof Ok) {
    let x = result[0];
    return fun(x);
  } else {
    return result;
  }
}
function unwrap2(result, default$) {
  if (result instanceof Ok) {
    let v = result[0];
    return v;
  } else {
    return default$;
  }
}
function replace_error(result, error) {
  if (result instanceof Ok) {
    return result;
  } else {
    return new Error(error);
  }
}
function values3(results) {
  return filter_map(results, (result) => {
    return result;
  });
}

// build/dev/javascript/gleam_stdlib/gleam/uri.mjs
class Uri extends CustomType {
  constructor(scheme, userinfo, host, port, path, query, fragment) {
    super();
    this.scheme = scheme;
    this.userinfo = userinfo;
    this.host = host;
    this.port = port;
    this.path = path;
    this.query = query;
    this.fragment = fragment;
  }
}
var empty = /* @__PURE__ */ new Uri(Option$None$const, Option$None$const, Option$None$const, Option$None$const, "", Option$None$const, Option$None$const);
function parse_fragment(rest, pieces) {
  return new Ok(new Uri(pieces.scheme, pieces.userinfo, pieces.host, pieces.port, pieces.path, pieces.query, new Some(rest)));
}
function parse_query_with_question_mark_loop(loop$original, loop$uri_string, loop$pieces, loop$size) {
  while (true) {
    let original = loop$original;
    let uri_string = loop$uri_string;
    let pieces = loop$pieces;
    let size2 = loop$size;
    if (uri_string.charCodeAt(0) === 35) {
      if (size2 === 0) {
        let rest = uri_string.slice(1);
        return parse_fragment(rest, pieces);
      } else {
        let rest$1 = uri_string.slice(1);
        let query = string_codeunit_slice(original, 0, size2);
        let pieces$1 = new Uri(pieces.scheme, pieces.userinfo, pieces.host, pieces.port, pieces.path, new Some(query), pieces.fragment);
        return parse_fragment(rest$1, pieces$1);
      }
    } else if (uri_string === "") {
      return new Ok(new Uri(pieces.scheme, pieces.userinfo, pieces.host, pieces.port, pieces.path, new Some(original), pieces.fragment));
    } else {
      let $ = pop_codeunit(uri_string);
      let rest = $[1];
      loop$original = original;
      loop$uri_string = rest;
      loop$pieces = pieces;
      loop$size = size2 + 1;
    }
  }
}
function parse_query_with_question_mark(uri_string, pieces) {
  return parse_query_with_question_mark_loop(uri_string, uri_string, pieces, 0);
}
function parse_path_loop(loop$original, loop$uri_string, loop$pieces, loop$size) {
  while (true) {
    let original = loop$original;
    let uri_string = loop$uri_string;
    let pieces = loop$pieces;
    let size2 = loop$size;
    let $ = uri_string.charCodeAt(0);
    if ($ === 63) {
      let rest = uri_string.slice(1);
      let path = string_codeunit_slice(original, 0, size2);
      let pieces$1 = new Uri(pieces.scheme, pieces.userinfo, pieces.host, pieces.port, path, pieces.query, pieces.fragment);
      return parse_query_with_question_mark(rest, pieces$1);
    } else if ($ === 35) {
      let rest = uri_string.slice(1);
      let path = string_codeunit_slice(original, 0, size2);
      let pieces$1 = new Uri(pieces.scheme, pieces.userinfo, pieces.host, pieces.port, path, pieces.query, pieces.fragment);
      return parse_fragment(rest, pieces$1);
    } else if (uri_string === "") {
      return new Ok(new Uri(pieces.scheme, pieces.userinfo, pieces.host, pieces.port, original, pieces.query, pieces.fragment));
    } else {
      let $1 = pop_codeunit(uri_string);
      let rest = $1[1];
      loop$original = original;
      loop$uri_string = rest;
      loop$pieces = pieces;
      loop$size = size2 + 1;
    }
  }
}
function parse_path(uri_string, pieces) {
  return parse_path_loop(uri_string, uri_string, pieces, 0);
}
function parse_port_loop(loop$uri_string, loop$pieces, loop$port) {
  while (true) {
    let uri_string = loop$uri_string;
    let pieces = loop$pieces;
    let port = loop$port;
    let $ = uri_string.charCodeAt(0);
    if ($ === 48) {
      let rest = uri_string.slice(1);
      loop$uri_string = rest;
      loop$pieces = pieces;
      loop$port = port * 10;
    } else if ($ === 49) {
      let rest = uri_string.slice(1);
      loop$uri_string = rest;
      loop$pieces = pieces;
      loop$port = port * 10 + 1;
    } else if ($ === 50) {
      let rest = uri_string.slice(1);
      loop$uri_string = rest;
      loop$pieces = pieces;
      loop$port = port * 10 + 2;
    } else if ($ === 51) {
      let rest = uri_string.slice(1);
      loop$uri_string = rest;
      loop$pieces = pieces;
      loop$port = port * 10 + 3;
    } else if ($ === 52) {
      let rest = uri_string.slice(1);
      loop$uri_string = rest;
      loop$pieces = pieces;
      loop$port = port * 10 + 4;
    } else if ($ === 53) {
      let rest = uri_string.slice(1);
      loop$uri_string = rest;
      loop$pieces = pieces;
      loop$port = port * 10 + 5;
    } else if ($ === 54) {
      let rest = uri_string.slice(1);
      loop$uri_string = rest;
      loop$pieces = pieces;
      loop$port = port * 10 + 6;
    } else if ($ === 55) {
      let rest = uri_string.slice(1);
      loop$uri_string = rest;
      loop$pieces = pieces;
      loop$port = port * 10 + 7;
    } else if ($ === 56) {
      let rest = uri_string.slice(1);
      loop$uri_string = rest;
      loop$pieces = pieces;
      loop$port = port * 10 + 8;
    } else if ($ === 57) {
      let rest = uri_string.slice(1);
      loop$uri_string = rest;
      loop$pieces = pieces;
      loop$port = port * 10 + 9;
    } else if ($ === 63) {
      let rest = uri_string.slice(1);
      let pieces$1 = new Uri(pieces.scheme, pieces.userinfo, pieces.host, new Some(port), pieces.path, pieces.query, pieces.fragment);
      return parse_query_with_question_mark(rest, pieces$1);
    } else if ($ === 35) {
      let rest = uri_string.slice(1);
      let pieces$1 = new Uri(pieces.scheme, pieces.userinfo, pieces.host, new Some(port), pieces.path, pieces.query, pieces.fragment);
      return parse_fragment(rest, pieces$1);
    } else if ($ === 47) {
      let pieces$1 = new Uri(pieces.scheme, pieces.userinfo, pieces.host, new Some(port), pieces.path, pieces.query, pieces.fragment);
      return parse_path(uri_string, pieces$1);
    } else if (uri_string === "") {
      return new Ok(new Uri(pieces.scheme, pieces.userinfo, pieces.host, new Some(port), pieces.path, pieces.query, pieces.fragment));
    } else {
      return new Error(undefined);
    }
  }
}
function parse_port(uri_string, pieces) {
  let $ = uri_string.charCodeAt(0);
  if (uri_string.startsWith(":0")) {
    let rest = uri_string.slice(2);
    return parse_port_loop(rest, pieces, 0);
  } else if (uri_string.startsWith(":1")) {
    let rest = uri_string.slice(2);
    return parse_port_loop(rest, pieces, 1);
  } else if (uri_string.startsWith(":2")) {
    let rest = uri_string.slice(2);
    return parse_port_loop(rest, pieces, 2);
  } else if (uri_string.startsWith(":3")) {
    let rest = uri_string.slice(2);
    return parse_port_loop(rest, pieces, 3);
  } else if (uri_string.startsWith(":4")) {
    let rest = uri_string.slice(2);
    return parse_port_loop(rest, pieces, 4);
  } else if (uri_string.startsWith(":5")) {
    let rest = uri_string.slice(2);
    return parse_port_loop(rest, pieces, 5);
  } else if (uri_string.startsWith(":6")) {
    let rest = uri_string.slice(2);
    return parse_port_loop(rest, pieces, 6);
  } else if (uri_string.startsWith(":7")) {
    let rest = uri_string.slice(2);
    return parse_port_loop(rest, pieces, 7);
  } else if (uri_string.startsWith(":8")) {
    let rest = uri_string.slice(2);
    return parse_port_loop(rest, pieces, 8);
  } else if (uri_string.startsWith(":9")) {
    let rest = uri_string.slice(2);
    return parse_port_loop(rest, pieces, 9);
  } else if (uri_string === ":") {
    return new Ok(pieces);
  } else if (uri_string === "") {
    return new Ok(pieces);
  } else if ($ === 63) {
    let rest = uri_string.slice(1);
    return parse_query_with_question_mark(rest, pieces);
  } else if (uri_string.startsWith(":?")) {
    let rest = uri_string.slice(2);
    return parse_query_with_question_mark(rest, pieces);
  } else if ($ === 35) {
    let rest = uri_string.slice(1);
    return parse_fragment(rest, pieces);
  } else if (uri_string.startsWith(":#")) {
    let rest = uri_string.slice(2);
    return parse_fragment(rest, pieces);
  } else if ($ === 47) {
    return parse_path(uri_string, pieces);
  } else if ($ === 58) {
    let rest = uri_string.slice(1);
    if (rest.charCodeAt(0) === 47) {
      return parse_path(rest, pieces);
    } else {
      return new Error(undefined);
    }
  } else {
    return new Error(undefined);
  }
}
function parse_host_outside_of_brackets_loop(loop$original, loop$uri_string, loop$pieces, loop$size) {
  while (true) {
    let original = loop$original;
    let uri_string = loop$uri_string;
    let pieces = loop$pieces;
    let size2 = loop$size;
    let $ = uri_string.charCodeAt(0);
    if (uri_string === "") {
      return new Ok(new Uri(pieces.scheme, pieces.userinfo, new Some(original), pieces.port, pieces.path, pieces.query, pieces.fragment));
    } else if ($ === 58) {
      let host = string_codeunit_slice(original, 0, size2);
      let pieces$1 = new Uri(pieces.scheme, pieces.userinfo, new Some(host), pieces.port, pieces.path, pieces.query, pieces.fragment);
      return parse_port(uri_string, pieces$1);
    } else if ($ === 47) {
      let host = string_codeunit_slice(original, 0, size2);
      let pieces$1 = new Uri(pieces.scheme, pieces.userinfo, new Some(host), pieces.port, pieces.path, pieces.query, pieces.fragment);
      return parse_path(uri_string, pieces$1);
    } else if ($ === 63) {
      let rest = uri_string.slice(1);
      let host = string_codeunit_slice(original, 0, size2);
      let pieces$1 = new Uri(pieces.scheme, pieces.userinfo, new Some(host), pieces.port, pieces.path, pieces.query, pieces.fragment);
      return parse_query_with_question_mark(rest, pieces$1);
    } else if ($ === 35) {
      let rest = uri_string.slice(1);
      let host = string_codeunit_slice(original, 0, size2);
      let pieces$1 = new Uri(pieces.scheme, pieces.userinfo, new Some(host), pieces.port, pieces.path, pieces.query, pieces.fragment);
      return parse_fragment(rest, pieces$1);
    } else {
      let $1 = pop_codeunit(uri_string);
      let rest = $1[1];
      loop$original = original;
      loop$uri_string = rest;
      loop$pieces = pieces;
      loop$size = size2 + 1;
    }
  }
}
function parse_host_outside_of_brackets(uri_string, pieces) {
  return parse_host_outside_of_brackets_loop(uri_string, uri_string, pieces, 0);
}
function is_valid_host_within_brackets_char(char) {
  return 48 >= char && char <= 57 || 65 >= char && char <= 90 || 97 >= char && char <= 122 || char === 58 || char === 46;
}
function parse_host_within_brackets_loop(loop$original, loop$uri_string, loop$pieces, loop$size) {
  while (true) {
    let original = loop$original;
    let uri_string = loop$uri_string;
    let pieces = loop$pieces;
    let size2 = loop$size;
    let $ = uri_string.charCodeAt(0);
    if (uri_string === "") {
      return new Ok(new Uri(pieces.scheme, pieces.userinfo, new Some(uri_string), pieces.port, pieces.path, pieces.query, pieces.fragment));
    } else if ($ === 93) {
      if (size2 === 0) {
        let rest = uri_string.slice(1);
        return parse_port(rest, pieces);
      } else {
        let rest$1 = uri_string.slice(1);
        let host = string_codeunit_slice(original, 0, size2 + 1);
        let pieces$1 = new Uri(pieces.scheme, pieces.userinfo, new Some(host), pieces.port, pieces.path, pieces.query, pieces.fragment);
        return parse_port(rest$1, pieces$1);
      }
    } else if ($ === 47) {
      if (size2 === 0) {
        return parse_path(uri_string, pieces);
      } else {
        let host = string_codeunit_slice(original, 0, size2);
        let pieces$1 = new Uri(pieces.scheme, pieces.userinfo, new Some(host), pieces.port, pieces.path, pieces.query, pieces.fragment);
        return parse_path(uri_string, pieces$1);
      }
    } else if ($ === 63) {
      if (size2 === 0) {
        let rest = uri_string.slice(1);
        return parse_query_with_question_mark(rest, pieces);
      } else {
        let rest$1 = uri_string.slice(1);
        let host = string_codeunit_slice(original, 0, size2);
        let pieces$1 = new Uri(pieces.scheme, pieces.userinfo, new Some(host), pieces.port, pieces.path, pieces.query, pieces.fragment);
        return parse_query_with_question_mark(rest$1, pieces$1);
      }
    } else if ($ === 35) {
      if (size2 === 0) {
        let rest = uri_string.slice(1);
        return parse_fragment(rest, pieces);
      } else {
        let rest$1 = uri_string.slice(1);
        let host = string_codeunit_slice(original, 0, size2);
        let pieces$1 = new Uri(pieces.scheme, pieces.userinfo, new Some(host), pieces.port, pieces.path, pieces.query, pieces.fragment);
        return parse_fragment(rest$1, pieces$1);
      }
    } else {
      let $1 = pop_codeunit(uri_string);
      let char = $1[0];
      let rest = $1[1];
      let $2 = is_valid_host_within_brackets_char(char);
      if ($2) {
        loop$original = original;
        loop$uri_string = rest;
        loop$pieces = pieces;
        loop$size = size2 + 1;
      } else {
        return parse_host_outside_of_brackets_loop(original, original, pieces, 0);
      }
    }
  }
}
function parse_host_within_brackets(uri_string, pieces) {
  return parse_host_within_brackets_loop(uri_string, uri_string, pieces, 0);
}
function parse_host(uri_string, pieces) {
  let $ = uri_string.charCodeAt(0);
  if ($ === 91) {
    return parse_host_within_brackets(uri_string, pieces);
  } else if ($ === 58) {
    let pieces$1 = new Uri(pieces.scheme, pieces.userinfo, new Some(""), pieces.port, pieces.path, pieces.query, pieces.fragment);
    return parse_port(uri_string, pieces$1);
  } else if (uri_string === "") {
    return new Ok(new Uri(pieces.scheme, pieces.userinfo, new Some(""), pieces.port, pieces.path, pieces.query, pieces.fragment));
  } else {
    return parse_host_outside_of_brackets(uri_string, pieces);
  }
}
function parse_userinfo_loop(loop$original, loop$uri_string, loop$pieces, loop$size) {
  while (true) {
    let original = loop$original;
    let uri_string = loop$uri_string;
    let pieces = loop$pieces;
    let size2 = loop$size;
    let $ = uri_string.charCodeAt(0);
    if ($ === 64) {
      if (size2 === 0) {
        let rest = uri_string.slice(1);
        return parse_host(rest, pieces);
      } else {
        let rest$1 = uri_string.slice(1);
        let userinfo = string_codeunit_slice(original, 0, size2);
        let pieces$1 = new Uri(pieces.scheme, new Some(userinfo), pieces.host, pieces.port, pieces.path, pieces.query, pieces.fragment);
        return parse_host(rest$1, pieces$1);
      }
    } else if (uri_string === "") {
      return parse_host(original, pieces);
    } else if ($ === 47) {
      return parse_host(original, pieces);
    } else if ($ === 63) {
      return parse_host(original, pieces);
    } else if ($ === 35) {
      return parse_host(original, pieces);
    } else {
      let $1 = pop_codeunit(uri_string);
      let rest = $1[1];
      loop$original = original;
      loop$uri_string = rest;
      loop$pieces = pieces;
      loop$size = size2 + 1;
    }
  }
}
function parse_authority_pieces(string3, pieces) {
  return parse_userinfo_loop(string3, string3, pieces, 0);
}
function parse_authority_with_slashes(uri_string, pieces) {
  if (uri_string === "//") {
    return new Ok(new Uri(pieces.scheme, pieces.userinfo, new Some(""), pieces.port, pieces.path, pieces.query, pieces.fragment));
  } else if (uri_string.startsWith("//")) {
    let rest = uri_string.slice(2);
    return parse_authority_pieces(rest, pieces);
  } else {
    return parse_path(uri_string, pieces);
  }
}
function parse_scheme_loop(loop$original, loop$uri_string, loop$pieces, loop$size) {
  while (true) {
    let original = loop$original;
    let uri_string = loop$uri_string;
    let pieces = loop$pieces;
    let size2 = loop$size;
    let $ = uri_string.charCodeAt(0);
    if ($ === 47) {
      if (size2 === 0) {
        return parse_authority_with_slashes(uri_string, pieces);
      } else {
        let scheme = string_codeunit_slice(original, 0, size2);
        let pieces$1 = new Uri(new Some(lowercase(scheme)), pieces.userinfo, pieces.host, pieces.port, pieces.path, pieces.query, pieces.fragment);
        return parse_authority_with_slashes(uri_string, pieces$1);
      }
    } else if ($ === 63) {
      if (size2 === 0) {
        let rest = uri_string.slice(1);
        return parse_query_with_question_mark(rest, pieces);
      } else {
        let rest$1 = uri_string.slice(1);
        let scheme = string_codeunit_slice(original, 0, size2);
        let pieces$1 = new Uri(new Some(lowercase(scheme)), pieces.userinfo, pieces.host, pieces.port, pieces.path, pieces.query, pieces.fragment);
        return parse_query_with_question_mark(rest$1, pieces$1);
      }
    } else if ($ === 35) {
      if (size2 === 0) {
        let rest = uri_string.slice(1);
        return parse_fragment(rest, pieces);
      } else {
        let rest$1 = uri_string.slice(1);
        let scheme = string_codeunit_slice(original, 0, size2);
        let pieces$1 = new Uri(new Some(lowercase(scheme)), pieces.userinfo, pieces.host, pieces.port, pieces.path, pieces.query, pieces.fragment);
        return parse_fragment(rest$1, pieces$1);
      }
    } else if ($ === 58) {
      if (size2 === 0) {
        return new Error(undefined);
      } else {
        let rest = uri_string.slice(1);
        let scheme = string_codeunit_slice(original, 0, size2);
        let pieces$1 = new Uri(new Some(lowercase(scheme)), pieces.userinfo, pieces.host, pieces.port, pieces.path, pieces.query, pieces.fragment);
        return parse_authority_with_slashes(rest, pieces$1);
      }
    } else if (uri_string === "") {
      return new Ok(new Uri(pieces.scheme, pieces.userinfo, pieces.host, pieces.port, original, pieces.query, pieces.fragment));
    } else {
      let $1 = pop_codeunit(uri_string);
      let rest = $1[1];
      loop$original = original;
      loop$uri_string = rest;
      loop$pieces = pieces;
      loop$size = size2 + 1;
    }
  }
}
function parse(uri_string) {
  return parse_scheme_loop(uri_string, uri_string, empty, 0);
}
function to_string2(uri) {
  let _block;
  let $ = uri.scheme;
  if ($ instanceof Some) {
    let scheme = $[0];
    _block = scheme + ":";
  } else {
    _block = "";
  }
  let out = _block;
  let _block$1;
  let $1 = uri.host;
  if ($1 instanceof Some) {
    let host = $1[0];
    let out$12 = out + "//";
    let _block$22;
    let $22 = uri.userinfo;
    if ($22 instanceof Some) {
      let userinfo = $22[0];
      _block$22 = out$12 + userinfo + "@";
    } else {
      _block$22 = out$12;
    }
    let out$22 = _block$22;
    let out$32 = out$22 + host;
    let _block$32;
    let $32 = uri.port;
    if ($32 instanceof Some) {
      let port = $32[0];
      _block$32 = out$32 + ":" + to_string(port);
    } else {
      _block$32 = out$32;
    }
    let out$4 = _block$32;
    let _block$4;
    let $4 = uri.path;
    if ($4 === "") {
      _block$4 = out$4;
    } else if ($4.charCodeAt(0) === 47) {
      _block$4 = out$4 + uri.path;
    } else {
      _block$4 = out$4 + "/" + uri.path;
    }
    let out$5 = _block$4;
    _block$1 = out$5;
  } else {
    _block$1 = out + uri.path;
  }
  let out$1 = _block$1;
  let _block$2;
  let $2 = uri.query;
  if ($2 instanceof Some) {
    let query = $2[0];
    _block$2 = out$1 + "?" + query;
  } else {
    _block$2 = out$1;
  }
  let out$2 = _block$2;
  let _block$3;
  let $3 = uri.fragment;
  if ($3 instanceof Some) {
    let fragment = $3[0];
    _block$3 = out$2 + "#" + fragment;
  } else {
    _block$3 = out$2;
  }
  let out$3 = _block$3;
  return out$3;
}
// build/dev/javascript/splitter/splitter_ffi.mjs
function make2(patterns) {
  let pattern = "";
  let cursor = patterns;
  while (List$isNonEmpty(cursor)) {
    if (pattern !== "")
      pattern += "|";
    pattern += escapeRegExp(List$NonEmpty$first(cursor));
    cursor = List$NonEmpty$rest(cursor);
  }
  return new RegExp(pattern);
}
function split_before(splitter, string3) {
  const match = string3.match(splitter);
  if (!match)
    return [string3, ""];
  const split_point = match.index;
  return [string3.slice(0, split_point), string3.slice(split_point)];
}
function escapeRegExp(string3) {
  return string3.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// build/dev/javascript/splitter/splitter.mjs
function new$(substrings) {
  let _pipe = substrings;
  let _pipe$1 = filter(_pipe, (x) => {
    return x !== "";
  });
  return make2(_pipe$1);
}
// build/dev/javascript/gleam_http/gleam/http.mjs
class Get extends CustomType {
}
var Method$Get$const = new Get;
class Post extends CustomType {
}
var Method$Post$const = new Post;
class Patch extends CustomType {
}
var Method$Patch$const = new Patch;
class Put extends CustomType {
}
var Method$Put$const = new Put;
class Delete extends CustomType {
}
var Method$Delete$const = new Delete;
class Head extends CustomType {
}
var Method$Head$const = new Head;
class Options extends CustomType {
}
var Method$Options$const = new Options;
class Trace extends CustomType {
}
var Method$Trace$const = new Trace;
class Connect extends CustomType {
}
var Method$Connect$const = new Connect;
class Http extends CustomType {
}
var Scheme$Http$const = new Http;
class Https extends CustomType {
}
var Scheme$Https$const = new Https;
function method_to_string(method) {
  if (method instanceof Get) {
    return "GET";
  } else if (method instanceof Post) {
    return "POST";
  } else if (method instanceof Patch) {
    return "PATCH";
  } else if (method instanceof Put) {
    return "PUT";
  } else if (method instanceof Delete) {
    return "DELETE";
  } else if (method instanceof Head) {
    return "HEAD";
  } else if (method instanceof Options) {
    return "OPTIONS";
  } else if (method instanceof Trace) {
    return "TRACE";
  } else if (method instanceof Connect) {
    return "CONNECT";
  } else {
    let method$1 = method[0];
    return method$1;
  }
}
function scheme_to_string(scheme) {
  if (scheme instanceof Http) {
    return "http";
  } else {
    return "https";
  }
}
function scheme_from_string(scheme) {
  let $ = lowercase(scheme);
  if ($ === "http") {
    return new Ok(Scheme$Http$const);
  } else if ($ === "https") {
    return new Ok(Scheme$Https$const);
  } else {
    return new Error(undefined);
  }
}

// build/dev/javascript/gleam_http/gleam/http/cookie.mjs
class Lax extends CustomType {
}
var SameSitePolicy$Lax$const = new Lax;
class Strict extends CustomType {
}
var SameSitePolicy$Strict$const = new Strict;
class None2 extends CustomType {
}
var SameSitePolicy$None$const = new None2;

// build/dev/javascript/gleam_http/gleam/http/request.mjs
class Request extends CustomType {
  constructor(method, headers, body, scheme, host, port, path, query) {
    super();
    this.method = method;
    this.headers = headers;
    this.body = body;
    this.scheme = scheme;
    this.host = host;
    this.port = port;
    this.path = path;
    this.query = query;
  }
}
function to_uri(request) {
  return new Uri(new Some(scheme_to_string(request.scheme)), Option$None$const, new Some(request.host), request.port, request.path, request.query, Option$None$const);
}
function from_uri(uri) {
  return try$((() => {
    let _pipe = uri.scheme;
    let _pipe$1 = unwrap(_pipe, "");
    return scheme_from_string(_pipe$1);
  })(), (scheme) => {
    return try$((() => {
      let _pipe = uri.host;
      return to_result(_pipe, undefined);
    })(), (host) => {
      let req = new Request(Method$Get$const, List$Empty$const, "", scheme, host, uri.port, uri.path, uri.query);
      return new Ok(req);
    });
  });
}
function set_body(req, body) {
  return new Request(req.method, req.headers, body, req.scheme, req.host, req.port, req.path, req.query);
}
function set_method(req, method) {
  return new Request(method, req.headers, req.body, req.scheme, req.host, req.port, req.path, req.query);
}
function to(url) {
  let _pipe = url;
  let _pipe$1 = parse(_pipe);
  return try$(_pipe$1, from_uri);
}

// build/dev/javascript/gleam_http/gleam/http/response.mjs
class Response2 extends CustomType {
  constructor(status, headers, body) {
    super();
    this.status = status;
    this.headers = headers;
    this.body = body;
  }
}
var Response$Response = (status, headers, body) => new Response2(status, headers, body);
function set_body2(response, body) {
  return new Response2(response.status, response.headers, body);
}
function get_header(response, key) {
  return key_find(response.headers, lowercase(key));
}
function map6(response, transform) {
  let _pipe = response.body;
  let _pipe$1 = transform(_pipe);
  return ((_capture) => {
    return set_body2(response, _capture);
  })(_pipe$1);
}
// build/dev/javascript/gleam_json/gleam_json_ffi.mjs
function json_to_string(json) {
  return JSON.stringify(json);
}
function identity2(x) {
  return x;
}
function array(list3) {
  const array2 = [];
  while (List$isNonEmpty(list3)) {
    array2.push(List$NonEmpty$first(list3));
    list3 = List$NonEmpty$rest(list3);
  }
  return array2;
}

// build/dev/javascript/gleam_json/gleam/json.mjs
class UnexpectedEndOfInput extends CustomType {
}
var DecodeError$UnexpectedEndOfInput$const = new UnexpectedEndOfInput;
function to_string3(json) {
  return json_to_string(json);
}
function string3(input) {
  return identity2(input);
}
function bool(input) {
  return identity2(input);
}
function preprocessed_array(from2) {
  return array(from2);
}
function array2(entries, inner_type) {
  let _pipe = entries;
  let _pipe$1 = map2(_pipe, inner_type);
  return preprocessed_array(_pipe$1);
}
// build/dev/javascript/gleam_time/gleam/time/duration.mjs
class Duration extends CustomType {
  constructor(seconds, nanoseconds) {
    super();
    this.seconds = seconds;
    this.nanoseconds = nanoseconds;
  }
}

class Nanosecond extends CustomType {
}
var Unit$Nanosecond$const = new Nanosecond;
class Microsecond extends CustomType {
}
var Unit$Microsecond$const = new Microsecond;
class Millisecond extends CustomType {
}
var Unit$Millisecond$const = new Millisecond;
class Second extends CustomType {
}
var Unit$Second$const = new Second;
class Minute extends CustomType {
}
var Unit$Minute$const = new Minute;
class Hour extends CustomType {
}
var Unit$Hour$const = new Hour;
class Day extends CustomType {
}
var Unit$Day$const = new Day;
class Week extends CustomType {
}
var Unit$Week$const = new Week;
class Month extends CustomType {
}
var Unit$Month$const = new Month;
class Year extends CustomType {
}
var Unit$Year$const = new Year;
function normalise(duration) {
  let multiplier = 1e9;
  let nanoseconds$1 = remainderInt(duration.nanoseconds, multiplier);
  let overflow = duration.nanoseconds - nanoseconds$1;
  let seconds$1 = duration.seconds + divideInt(overflow, multiplier);
  let $ = nanoseconds$1 >= 0;
  if ($) {
    return new Duration(seconds$1, nanoseconds$1);
  } else {
    return new Duration(seconds$1 - 1, multiplier + nanoseconds$1);
  }
}
function approximate(duration) {
  let s = duration.seconds;
  let ns = duration.nanoseconds;
  let minute = 60;
  let hour = minute * 60;
  let day = hour * 24;
  let week = day * 7;
  let year = day * 365 + hour * 6;
  let month = globalThis.Math.trunc(year / 12);
  let microsecond = 1000;
  let millisecond = microsecond * 1000;
  let $ = undefined;
  if (s < 0) {
    let _block;
    let _pipe = new Duration(-s, -ns);
    let _pipe$1 = normalise(_pipe);
    _block = approximate(_pipe$1);
    let $1 = _block;
    let amount = $1[0];
    let unit = $1[1];
    return [-amount, unit];
  } else if (s >= year) {
    return [divideInt(s, year), Unit$Year$const];
  } else if (s >= month) {
    return [divideInt(s, month), Unit$Month$const];
  } else if (s >= week) {
    return [divideInt(s, week), Unit$Week$const];
  } else if (s >= day) {
    return [divideInt(s, day), Unit$Day$const];
  } else if (s >= hour) {
    return [divideInt(s, hour), Unit$Hour$const];
  } else if (s >= minute) {
    return [divideInt(s, minute), Unit$Minute$const];
  } else if (s > 0) {
    return [s, Unit$Second$const];
  } else if (ns >= millisecond) {
    return [divideInt(ns, millisecond), Unit$Millisecond$const];
  } else if (ns >= microsecond) {
    return [divideInt(ns, microsecond), Unit$Microsecond$const];
  } else {
    return [ns, Unit$Nanosecond$const];
  }
}
function add2(left, right) {
  let _pipe = new Duration(left.seconds + right.seconds, left.nanoseconds + right.nanoseconds);
  return normalise(_pipe);
}
function seconds(amount) {
  return new Duration(amount, 0);
}
function nanoseconds(amount) {
  let _pipe = new Duration(0, amount);
  return normalise(_pipe);
}

// build/dev/javascript/gleam_time/gleam_time_ffi.mjs
function system_time() {
  const now = Date.now();
  const milliseconds = now % 1000;
  const nanoseconds2 = milliseconds * 1e6;
  const seconds2 = (now - milliseconds) / 1000;
  return [seconds2, nanoseconds2];
}

// build/dev/javascript/gleam_time/gleam/time/calendar.mjs
class Monday extends CustomType {
}
var DayOfWeek$Monday$const = new Monday;
class Tuesday extends CustomType {
}
var DayOfWeek$Tuesday$const = new Tuesday;
class Wednesday extends CustomType {
}
var DayOfWeek$Wednesday$const = new Wednesday;
class Thursday extends CustomType {
}
var DayOfWeek$Thursday$const = new Thursday;
class Friday extends CustomType {
}
var DayOfWeek$Friday$const = new Friday;
class Saturday extends CustomType {
}
var DayOfWeek$Saturday$const = new Saturday;
class Sunday extends CustomType {
}
var DayOfWeek$Sunday$const = new Sunday;
class January extends CustomType {
}
var Month$January$const = new January;
class February extends CustomType {
}
var Month$February$const = new February;
class March extends CustomType {
}
var Month$March$const = new March;
class April extends CustomType {
}
var Month$April$const = new April;
class May extends CustomType {
}
var Month$May$const = new May;
class June extends CustomType {
}
var Month$June$const = new June;
class July extends CustomType {
}
var Month$July$const = new July;
class August extends CustomType {
}
var Month$August$const = new August;
class September extends CustomType {
}
var Month$September$const = new September;
class October extends CustomType {
}
var Month$October$const = new October;
class November extends CustomType {
}
var Month$November$const = new November;
class December extends CustomType {
}
var Month$December$const = new December;

// build/dev/javascript/gleam_time/gleam/time/timestamp.mjs
class Timestamp extends CustomType {
  constructor(seconds2, nanoseconds2) {
    super();
    this.seconds = seconds2;
    this.nanoseconds = nanoseconds2;
  }
}
function normalise2(timestamp) {
  let multiplier = 1e9;
  let nanoseconds2 = remainderInt(timestamp.nanoseconds, multiplier);
  let overflow = timestamp.nanoseconds - nanoseconds2;
  let seconds2 = timestamp.seconds + divideInt(overflow, multiplier);
  let $ = nanoseconds2 >= 0;
  if ($) {
    return new Timestamp(seconds2, nanoseconds2);
  } else {
    return new Timestamp(seconds2 - 1, multiplier + nanoseconds2);
  }
}
function system_time2() {
  let $ = system_time();
  let seconds2 = $[0];
  let nanoseconds2 = $[1];
  return normalise2(new Timestamp(seconds2, nanoseconds2));
}
function difference(left, right) {
  let seconds2 = seconds(right.seconds - left.seconds);
  let nanoseconds2 = nanoseconds(right.nanoseconds - left.nanoseconds);
  return add2(seconds2, nanoseconds2);
}
function from_unix_seconds(seconds2) {
  return new Timestamp(seconds2, 0);
}
// build/dev/javascript/gleam_erlang/gleam/erlang/process.mjs
class Normal extends CustomType {
}
var ExitReason$Normal$const = new Normal;
class Killed extends CustomType {
}
var ExitReason$Killed$const = new Killed;
class Anything extends CustomType {
}
var AnythingSelectorTag$Anything$const = new Anything;

class Process extends CustomType {
}
var ProcessMonitorFlag$Process$const = new Process;
class TimerNotFound extends CustomType {
}
var Cancelled$TimerNotFound$const = new TimerNotFound;
class Kill extends CustomType {
}
var KillFlag$Kill$const = new Kill;
// build/dev/javascript/gleam_otp/gleam/otp/system.mjs
class Running extends CustomType {
}
var Mode$Running$const = new Running;
class Suspended extends CustomType {
}
var Mode$Suspended$const = new Suspended;
class NoDebug extends CustomType {
}
var DebugOption$NoDebug$const = new NoDebug;

// build/dev/javascript/gleam_otp/gleam/otp/actor.mjs
class InitTimeout extends CustomType {
}
var StartError$InitTimeout$const = new InitTimeout;

// build/dev/javascript/gleam_otp/gleam/otp/supervision.mjs
class Permanent extends CustomType {
}
var Restart$Permanent$const = new Permanent;
class Transient extends CustomType {
}
var Restart$Transient$const = new Transient;
class Temporary extends CustomType {
}
var Restart$Temporary$const = new Temporary;
class Supervisor extends CustomType {
}
var ChildType$Supervisor$const = new Supervisor;

// build/dev/javascript/gleam_otp/gleam/otp/factory_supervisor.mjs
class SimpleOneForOne extends CustomType {
}
var Strategy$SimpleOneForOne$const = new SimpleOneForOne;

// build/dev/javascript/gleam_stdlib/gleam/function.mjs
function identity3(x) {
  return x;
}
// build/dev/javascript/houdini/houdini.ffi.mjs
function escape(string4) {
  return string4.replaceAll(/[><&"']/g, (replaced) => {
    switch (replaced) {
      case ">":
        return "&gt;";
      case "<":
        return "&lt;";
      case "'":
        return "&#39;";
      case "&":
        return "&amp;";
      case '"':
        return "&quot;";
      default:
        return replaced;
    }
  });
}

// build/dev/javascript/lustre/lustre/internals/constants.mjs
var empty_list = List$Empty$const;
var error_nil = /* @__PURE__ */ new Error(undefined);
function singleton_list(item) {
  return prepend(item, empty_list);
}

// build/dev/javascript/lustre/lustre/vdom/vattr.ffi.mjs
var GT = /* @__PURE__ */ Order$Gt();
var LT = /* @__PURE__ */ Order$Lt();
var EQ = /* @__PURE__ */ Order$Eq();
function compare4(a, b) {
  if (a.name === b.name) {
    return EQ;
  } else if (a.name < b.name) {
    return LT;
  } else {
    return GT;
  }
}

// build/dev/javascript/lustre/lustre/vdom/vattr.mjs
class Attribute extends CustomType {
  constructor(kind, name, value) {
    super();
    this.kind = kind;
    this.name = name;
    this.value = value;
  }
}
class Property extends CustomType {
  constructor(kind, name, value) {
    super();
    this.kind = kind;
    this.name = name;
    this.value = value;
  }
}
class Event2 extends CustomType {
  constructor(kind, name, handler, include, prevent_default, stop_propagation, debounce, throttle) {
    super();
    this.kind = kind;
    this.name = name;
    this.handler = handler;
    this.include = include;
    this.prevent_default = prevent_default;
    this.stop_propagation = stop_propagation;
    this.debounce = debounce;
    this.throttle = throttle;
  }
}
class Handler extends CustomType {
  constructor(prevent_default, stop_propagation, message) {
    super();
    this.prevent_default = prevent_default;
    this.stop_propagation = stop_propagation;
    this.message = message;
  }
}
class Never extends CustomType {
  constructor(kind) {
    super();
    this.kind = kind;
  }
}
var attribute_kind = 0;
var property_kind = 1;
var event_kind = 2;
var never_kind = 0;
var never = /* @__PURE__ */ new Never(never_kind);
var always_kind = 2;
function attribute(name, value) {
  return new Attribute(attribute_kind, name, value);
}
function property(name, value) {
  return new Property(property_kind, name, value);
}
function event(name, handler, include, prevent_default, stop_propagation, debounce, throttle) {
  return new Event2(event_kind, name, handler, include, prevent_default, stop_propagation, debounce, throttle);
}
function merge(loop$attributes, loop$merged) {
  while (true) {
    let attributes = loop$attributes;
    let merged = loop$merged;
    if (attributes instanceof Empty) {
      return merged;
    } else {
      let $ = attributes.head;
      if ($ instanceof Attribute) {
        let $1 = $.name;
        if ($1 === "") {
          let rest = attributes.tail;
          loop$attributes = rest;
          loop$merged = merged;
        } else if ($1 === "class") {
          let $2 = $.value;
          if ($2 === "") {
            let rest = attributes.tail;
            loop$attributes = rest;
            loop$merged = merged;
          } else {
            let $3 = attributes.tail;
            if ($3 instanceof Empty) {
              let attribute$1 = $;
              let rest = $3;
              loop$attributes = rest;
              loop$merged = prepend(attribute$1, merged);
            } else {
              let $4 = $3.head;
              if ($4 instanceof Attribute && $4.name === "class") {
                let kind = $.kind;
                let class1 = $2;
                let rest = $3.tail;
                let class2 = $4.value;
                let value = class1 + " " + class2;
                let attribute$1 = new Attribute(kind, "class", value);
                loop$attributes = prepend(attribute$1, rest);
                loop$merged = merged;
              } else {
                let attribute$1 = $;
                let rest = $3;
                loop$attributes = rest;
                loop$merged = prepend(attribute$1, merged);
              }
            }
          }
        } else if ($1 === "style") {
          let $2 = $.value;
          if ($2 === "") {
            let rest = attributes.tail;
            loop$attributes = rest;
            loop$merged = merged;
          } else {
            let $3 = attributes.tail;
            if ($3 instanceof Empty) {
              let attribute$1 = $;
              let rest = $3;
              loop$attributes = rest;
              loop$merged = prepend(attribute$1, merged);
            } else {
              let $4 = $3.head;
              if ($4 instanceof Attribute && $4.name === "style") {
                let kind = $.kind;
                let style1 = $2;
                let rest = $3.tail;
                let style2 = $4.value;
                let value = style1 + ";" + style2;
                let attribute$1 = new Attribute(kind, "style", value);
                loop$attributes = prepend(attribute$1, rest);
                loop$merged = merged;
              } else {
                let attribute$1 = $;
                let rest = $3;
                loop$attributes = rest;
                loop$merged = prepend(attribute$1, merged);
              }
            }
          }
        } else {
          let attribute$1 = $;
          let rest = attributes.tail;
          loop$attributes = rest;
          loop$merged = prepend(attribute$1, merged);
        }
      } else {
        let attribute$1 = $;
        let rest = attributes.tail;
        loop$attributes = rest;
        loop$merged = prepend(attribute$1, merged);
      }
    }
  }
}
function prepare(attributes) {
  if (attributes instanceof Empty) {
    return attributes;
  } else if (attributes.tail instanceof Empty) {
    return attributes;
  } else {
    let _pipe = attributes;
    let _pipe$1 = sort(_pipe, (a, b) => {
      return compare4(b, a);
    });
    return merge(_pipe$1, empty_list);
  }
}

// build/dev/javascript/lustre/lustre/attribute.mjs
function attribute2(name, value) {
  return attribute(name, value);
}
function property2(name, value) {
  return property(name, value);
}
function boolean_attribute(name, value) {
  if (value) {
    return attribute2(name, "");
  } else {
    return property2(name, bool(false));
  }
}
function class$(name) {
  return attribute2("class", name);
}
function do_classes(loop$names, loop$class) {
  while (true) {
    let names = loop$names;
    let class$2 = loop$class;
    if (names instanceof Empty) {
      return class$2;
    } else if (names.head[1]) {
      let rest = names.tail;
      let name$1 = names.head[0];
      return class$2 + name$1 + " " + do_classes(rest, class$2);
    } else {
      let rest = names.tail;
      loop$names = rest;
      loop$class = class$2;
    }
  }
}
function classes(names) {
  return class$(do_classes(names, ""));
}
function style(property3, value) {
  if (property3 === "") {
    return class$("");
  } else if (value === "") {
    return class$("");
  } else {
    return attribute2("style", property3 + ":" + value + ";");
  }
}
function do_styles(loop$properties, loop$styles) {
  while (true) {
    let properties = loop$properties;
    let styles = loop$styles;
    if (properties instanceof Empty) {
      return styles;
    } else {
      let $ = properties.head[0];
      if ($ === "") {
        let rest = properties.tail;
        loop$properties = rest;
        loop$styles = styles;
      } else {
        let $1 = properties.head[1];
        if ($1 === "") {
          let rest = properties.tail;
          loop$properties = rest;
          loop$styles = styles;
        } else {
          let rest = properties.tail;
          let name$1 = $;
          let value$1 = $1;
          loop$properties = rest;
          loop$styles = styles + name$1 + ":" + value$1 + ";";
        }
      }
    }
  }
}
function styles(properties) {
  return attribute2("style", do_styles(properties, ""));
}
function href(url) {
  return attribute2("href", url);
}
function src(url) {
  return attribute2("src", url);
}
function disabled(is_disabled) {
  return boolean_attribute("disabled", is_disabled);
}
function placeholder(text) {
  return attribute2("placeholder", text);
}
function type_(control_type) {
  return attribute2("type", control_type);
}
function value(control_value) {
  return attribute2("value", control_value);
}
function colspan(value2) {
  return attribute2("colspan", to_string(value2));
}

// build/dev/javascript/lustre/lustre/effect.mjs
class Effect extends CustomType {
  constructor(synchronous, before_paint, after_paint) {
    super();
    this.synchronous = synchronous;
    this.before_paint = before_paint;
    this.after_paint = after_paint;
  }
}

class Actions extends CustomType {
  constructor(dispatch, emit, select, root, provide, subscribe, unsubscribe) {
    super();
    this.dispatch = dispatch;
    this.emit = emit;
    this.select = select;
    this.root = root;
    this.provide = provide;
    this.subscribe = subscribe;
    this.unsubscribe = unsubscribe;
  }
}
var empty3 = /* @__PURE__ */ new Effect(empty_list, empty_list, empty_list);
function none() {
  return empty3;
}
function from2(effect) {
  let task = (actions) => {
    let dispatch = actions.dispatch;
    return effect(dispatch);
  };
  return new Effect(singleton_list(task), empty3.before_paint, empty3.after_paint);
}
function batch(effects) {
  return fold2(effects, empty3, (acc, eff) => {
    return new Effect(fold2(eff.synchronous, acc.synchronous, prepend2), fold2(eff.before_paint, acc.before_paint, prepend2), fold2(eff.after_paint, acc.after_paint, prepend2));
  });
}
function perform(effect, dispatch, emit, select, root, provide, subscribe, unsubscribe) {
  let actions = new Actions(dispatch, emit, select, root, provide, subscribe, unsubscribe);
  return each(effect.synchronous, (run2) => {
    return run2(actions);
  });
}

// build/dev/javascript/lustre/lustre/internals/mutable_map.ffi.mjs
function empty4() {
  return null;
}
function get2(map7, key) {
  return map7?.get(key);
}
function get_or_compute(map7, key, compute) {
  return map7?.get(key) ?? compute();
}
function has_key(map7, key) {
  return map7 && map7.has(key);
}
function insert2(map7, key, value2) {
  map7 ??= new Map;
  map7.set(key, value2);
  return map7;
}
function remove(map7, key) {
  map7?.delete(key);
  return map7;
}

// build/dev/javascript/lustre/lustre/internals/ref.ffi.mjs
function sameValueZero(x, y) {
  if (typeof x === "number" && typeof y === "number") {
    return x === y || x !== x && y !== y;
  }
  return x === y;
}

// build/dev/javascript/lustre/lustre/internals/ref.mjs
function equal_lists(loop$xs, loop$ys) {
  while (true) {
    let xs = loop$xs;
    let ys = loop$ys;
    if (xs instanceof Empty) {
      if (ys instanceof Empty) {
        return true;
      } else {
        return false;
      }
    } else if (ys instanceof Empty) {
      return false;
    } else {
      let x = xs.head;
      let xs$1 = xs.tail;
      let y = ys.head;
      let ys$1 = ys.tail;
      let $ = sameValueZero(x, y);
      if ($) {
        loop$xs = xs$1;
        loop$ys = ys$1;
      } else {
        return $;
      }
    }
  }
}

// build/dev/javascript/lustre/lustre/vdom/vnode.mjs
class Fragment extends CustomType {
  constructor(kind, key, children, keyed_children) {
    super();
    this.kind = kind;
    this.key = key;
    this.children = children;
    this.keyed_children = keyed_children;
  }
}
class Element extends CustomType {
  constructor(kind, key, namespace, tag, attributes, children, keyed_children, self_closing, void$) {
    super();
    this.kind = kind;
    this.key = key;
    this.namespace = namespace;
    this.tag = tag;
    this.attributes = attributes;
    this.children = children;
    this.keyed_children = keyed_children;
    this.self_closing = self_closing;
    this.void = void$;
  }
}
class Text extends CustomType {
  constructor(kind, key, content) {
    super();
    this.kind = kind;
    this.key = key;
    this.content = content;
  }
}
class UnsafeInnerHtml extends CustomType {
  constructor(kind, key, namespace, tag, attributes, inner_html) {
    super();
    this.kind = kind;
    this.key = key;
    this.namespace = namespace;
    this.tag = tag;
    this.attributes = attributes;
    this.inner_html = inner_html;
  }
}
class Map2 extends CustomType {
  constructor(kind, key, mapper, child) {
    super();
    this.kind = kind;
    this.key = key;
    this.mapper = mapper;
    this.child = child;
  }
}
class Memo extends CustomType {
  constructor(kind, key, dependencies, view) {
    super();
    this.kind = kind;
    this.key = key;
    this.dependencies = dependencies;
    this.view = view;
  }
}
var fragment_kind = 0;
var element_kind = 1;
var text_kind = 2;
var unsafe_inner_html_kind = 3;
var map_kind = 4;
var memo_kind = 5;
function fragment(key, children, keyed_children) {
  return new Fragment(fragment_kind, key, children, keyed_children);
}
function element(key, namespace, tag, attributes, children, keyed_children, self_closing, void$) {
  return new Element(element_kind, key, namespace, tag, prepare(attributes), children, keyed_children, self_closing, void$);
}
function is_void_html_element(tag, namespace) {
  if (namespace === "") {
    if (tag === "area") {
      return true;
    } else if (tag === "base") {
      return true;
    } else if (tag === "br") {
      return true;
    } else if (tag === "col") {
      return true;
    } else if (tag === "embed") {
      return true;
    } else if (tag === "hr") {
      return true;
    } else if (tag === "img") {
      return true;
    } else if (tag === "input") {
      return true;
    } else if (tag === "link") {
      return true;
    } else if (tag === "meta") {
      return true;
    } else if (tag === "param") {
      return true;
    } else if (tag === "source") {
      return true;
    } else if (tag === "track") {
      return true;
    } else if (tag === "wbr") {
      return true;
    } else {
      return false;
    }
  } else {
    return false;
  }
}
function text(key, content) {
  return new Text(text_kind, key, content);
}
function map7(element2, mapper) {
  if (element2 instanceof Map2) {
    let child_mapper = element2.mapper;
    return new Map2(map_kind, element2.key, (handler) => {
      return identity3(mapper)(child_mapper(handler));
    }, identity3(element2.child));
  } else {
    return new Map2(map_kind, element2.key, identity3(mapper), identity3(element2));
  }
}
function memo(key, dependencies, view) {
  return new Memo(memo_kind, key, dependencies, view);
}
function to_keyed(key, node) {
  if (node instanceof Fragment) {
    return new Fragment(node.kind, key, node.children, node.keyed_children);
  } else if (node instanceof Element) {
    return new Element(node.kind, key, node.namespace, node.tag, node.attributes, node.children, node.keyed_children, node.self_closing, node.void);
  } else if (node instanceof Text) {
    return new Text(node.kind, key, node.content);
  } else if (node instanceof UnsafeInnerHtml) {
    return new UnsafeInnerHtml(node.kind, key, node.namespace, node.tag, node.attributes, node.inner_html);
  } else if (node instanceof Map2) {
    let child = node.child;
    return new Map2(node.kind, key, node.mapper, to_keyed(key, child));
  } else {
    let view = node.view;
    return new Memo(node.kind, key, node.dependencies, () => {
      return to_keyed(key, view());
    });
  }
}

// build/dev/javascript/lustre/lustre/element.mjs
class Html extends CustomType {
}
var DocumentType$Html$const = new Html;

class HeadOnly extends CustomType {
}
var DocumentType$HeadOnly$const = new HeadOnly;

class BodyOnly extends CustomType {
}
var DocumentType$BodyOnly$const = new BodyOnly;

class HeadAndBody extends CustomType {
}
var DocumentType$HeadAndBody$const = new HeadAndBody;

class Other extends CustomType {
}
var DocumentType$Other$const = new Other;
function element2(tag, attributes, children) {
  return element("", "", tag, attributes, children, empty4(), false, is_void_html_element(tag, ""));
}
function text2(content) {
  return text("", content);
}
function none2() {
  return text("", "");
}
function memo2(dependencies, view) {
  return memo("", dependencies, view);
}
function ref(value2) {
  return identity3(value2);
}
function map8(element3, f) {
  return map7(element3, f);
}

// build/dev/javascript/lustre/lustre/element/html.mjs
function text3(content) {
  return text2(content);
}
function footer(attrs, children) {
  return element2("footer", attrs, children);
}
function div(attrs, children) {
  return element2("div", attrs, children);
}
function p(attrs, children) {
  return element2("p", attrs, children);
}
function pre(attrs, children) {
  return element2("pre", attrs, children);
}
function a(attrs, children) {
  return element2("a", attrs, children);
}
function br(attrs) {
  return element2("br", attrs, empty_list);
}
function code(attrs, children) {
  return element2("code", attrs, children);
}
function mark(attrs, children) {
  return element2("mark", attrs, children);
}
function span(attrs, children) {
  return element2("span", attrs, children);
}
function strong(attrs, children) {
  return element2("strong", attrs, children);
}
function wbr(attrs) {
  return element2("wbr", attrs, empty_list);
}
function img(attrs) {
  return element2("img", attrs, empty_list);
}
function col(attrs) {
  return element2("col", attrs, empty_list);
}
function colgroup(attrs, children) {
  return element2("colgroup", attrs, children);
}
function table(attrs, children) {
  return element2("table", attrs, children);
}
function tbody(attrs, children) {
  return element2("tbody", attrs, children);
}
function td(attrs, children) {
  return element2("td", attrs, children);
}
function th(attrs, children) {
  return element2("th", attrs, children);
}
function thead(attrs, children) {
  return element2("thead", attrs, children);
}
function tr(attrs, children) {
  return element2("tr", attrs, children);
}
function button(attrs, children) {
  return element2("button", attrs, children);
}
function input(attrs) {
  return element2("input", attrs, empty_list);
}

// build/dev/javascript/gleam_stdlib/gleam/set.mjs
class Set2 extends CustomType {
  constructor(dict2) {
    super();
    this.dict = dict2;
  }
}
var token = undefined;
function new$3() {
  return new Set2(make());
}
function insert3(set, member) {
  return new Set2(insert(set.dict, member, token));
}
function contains2(set, member) {
  let _pipe = set.dict;
  let _pipe$1 = get(_pipe, member);
  return is_ok(_pipe$1);
}
function delete$2(set, member) {
  return new Set2(delete$(set.dict, member));
}
function from_list2(members) {
  let dict2 = fold2(members, make(), (m, k) => {
    return insert(m, k, token);
  });
  return new Set2(dict2);
}
function fold3(set, initial, reducer) {
  return fold(set.dict, initial, (a2, k, _) => {
    return reducer(a2, k);
  });
}
function order(first3, second) {
  let $ = size(first3.dict) > size(second.dict);
  if ($) {
    return [first3, second];
  } else {
    return [second, first3];
  }
}
function union(first3, second) {
  let $ = order(first3, second);
  let larger = $[0];
  let smaller = $[1];
  return fold3(smaller, larger, insert3);
}

// build/dev/javascript/lustre/lustre/vdom/patch.mjs
class Patch2 extends CustomType {
  constructor(index4, path, removed, changes, children) {
    super();
    this.index = index4;
    this.path = path;
    this.removed = removed;
    this.changes = changes;
    this.children = children;
  }
}
class ReplaceText extends CustomType {
  constructor(kind, content) {
    super();
    this.kind = kind;
    this.content = content;
  }
}
class ReplaceInnerHtml extends CustomType {
  constructor(kind, inner_html) {
    super();
    this.kind = kind;
    this.inner_html = inner_html;
  }
}
class Update extends CustomType {
  constructor(kind, added, removed) {
    super();
    this.kind = kind;
    this.added = added;
    this.removed = removed;
  }
}
class Move extends CustomType {
  constructor(kind, key, before) {
    super();
    this.kind = kind;
    this.key = key;
    this.before = before;
  }
}
class Replace extends CustomType {
  constructor(kind, index4, with$) {
    super();
    this.kind = kind;
    this.index = index4;
    this.with = with$;
  }
}
class Remove extends CustomType {
  constructor(kind, index4) {
    super();
    this.kind = kind;
    this.index = index4;
  }
}
class Insert extends CustomType {
  constructor(kind, children, before) {
    super();
    this.kind = kind;
    this.children = children;
    this.before = before;
  }
}
var replace_text_kind = 0;
var replace_inner_html_kind = 1;
var update_kind = 2;
var move_kind = 3;
var remove_kind = 4;
var replace_kind = 5;
var insert_kind = 6;
function new$5(index4, removed, changes, children) {
  return new Patch2(index4, empty_list, removed, changes, children);
}
function replace_text(content) {
  return new ReplaceText(replace_text_kind, content);
}
function replace_inner_html(inner_html) {
  return new ReplaceInnerHtml(replace_inner_html_kind, inner_html);
}
function update(added, removed) {
  return new Update(update_kind, added, removed);
}
function move(key, before) {
  return new Move(move_kind, key, before);
}
function remove2(index4) {
  return new Remove(remove_kind, index4);
}
function replace2(index4, with$) {
  return new Replace(replace_kind, index4, with$);
}
function insert4(children, before) {
  return new Insert(insert_kind, children, before);
}
function add_parent(child, index4) {
  return new Patch2(index4, prepend(child.index, child.path), child.removed, child.changes, child.children);
}

// build/dev/javascript/lustre/lustre/runtime/transport.mjs
class Mount extends CustomType {
  constructor(kind, open_shadow_root, will_adopt_styles, observed_attributes, observed_properties, requested_contexts, provided_contexts, vdom, memos) {
    super();
    this.kind = kind;
    this.open_shadow_root = open_shadow_root;
    this.will_adopt_styles = will_adopt_styles;
    this.observed_attributes = observed_attributes;
    this.observed_properties = observed_properties;
    this.requested_contexts = requested_contexts;
    this.provided_contexts = provided_contexts;
    this.vdom = vdom;
    this.memos = memos;
  }
}
class Reconcile extends CustomType {
  constructor(kind, patch, memos) {
    super();
    this.kind = kind;
    this.patch = patch;
    this.memos = memos;
  }
}
class Emit extends CustomType {
  constructor(kind, name, data) {
    super();
    this.kind = kind;
    this.name = name;
    this.data = data;
  }
}
class Provide extends CustomType {
  constructor(kind, key, value2) {
    super();
    this.kind = kind;
    this.key = key;
    this.value = value2;
  }
}
class Subscribe extends CustomType {
  constructor(kind, key) {
    super();
    this.kind = kind;
    this.key = key;
  }
}
class Unsubscribe extends CustomType {
  constructor(kind, key) {
    super();
    this.kind = kind;
    this.key = key;
  }
}
class Batch extends CustomType {
  constructor(kind, messages) {
    super();
    this.kind = kind;
    this.messages = messages;
  }
}
var ServerMessage$isBatch = (value2) => value2 instanceof Batch;
class AttributeChanged extends CustomType {
  constructor(kind, name, value2) {
    super();
    this.kind = kind;
    this.name = name;
    this.value = value2;
  }
}
var ServerMessage$isAttributeChanged = (value2) => value2 instanceof AttributeChanged;
class PropertyChanged extends CustomType {
  constructor(kind, name, value2) {
    super();
    this.kind = kind;
    this.name = name;
    this.value = value2;
  }
}
var ServerMessage$isPropertyChanged = (value2) => value2 instanceof PropertyChanged;
class EventFired extends CustomType {
  constructor(kind, path, name, event2) {
    super();
    this.kind = kind;
    this.path = path;
    this.name = name;
    this.event = event2;
  }
}
var ServerMessage$isEventFired = (value2) => value2 instanceof EventFired;
class ContextProvided extends CustomType {
  constructor(kind, key, value2) {
    super();
    this.kind = kind;
    this.key = key;
    this.value = value2;
  }
}
var ServerMessage$isContextProvided = (value2) => value2 instanceof ContextProvided;
var mount_kind = 0;
var reconcile_kind = 1;
var emit_kind = 2;
var provide_kind = 3;
var subscribe_kind = 4;
var unsubscribe_kind = 5;
function mount(open_shadow_root, will_adopt_styles, observed_attributes, observed_properties, requested_contexts, provided_contexts, vdom, memos) {
  return new Mount(mount_kind, open_shadow_root, will_adopt_styles, observed_attributes, observed_properties, requested_contexts, provided_contexts, vdom, memos);
}
function reconcile(patch, memos) {
  return new Reconcile(reconcile_kind, patch, memos);
}
function emit(name, data) {
  return new Emit(emit_kind, name, data);
}
function provide(key, value2) {
  return new Provide(provide_kind, key, value2);
}
function subscribe(key) {
  return new Subscribe(subscribe_kind, key);
}
function unsubscribe(key) {
  return new Unsubscribe(unsubscribe_kind, key);
}

// build/dev/javascript/lustre/lustre/vdom/path.mjs
class Root extends CustomType {
}
var Path$Root$const = new Root;

class Key extends CustomType {
  constructor(key, parent) {
    super();
    this.key = key;
    this.parent = parent;
  }
}

class Index extends CustomType {
  constructor(index4, parent) {
    super();
    this.index = index4;
    this.parent = parent;
  }
}

class Subtree extends CustomType {
  constructor(parent) {
    super();
    this.parent = parent;
  }
}
var separator_subtree = "\r";
var separator_element = "\t";
var separator_event = `
`;
var root = Path$Root$const;
function finish_to_string(acc) {
  if (acc instanceof Empty) {
    return "";
  } else {
    let segments = acc.tail;
    return concat2(segments);
  }
}
function do_to_string(loop$full, loop$path, loop$acc) {
  while (true) {
    let full = loop$full;
    let path = loop$path;
    let acc = loop$acc;
    if (path instanceof Root) {
      return finish_to_string(acc);
    } else if (path instanceof Key) {
      let key = path.key;
      let parent = path.parent;
      loop$full = full;
      loop$path = parent;
      loop$acc = prepend(separator_element, prepend(key, acc));
    } else if (path instanceof Index) {
      let index4 = path.index;
      let parent = path.parent;
      let acc$1 = prepend(separator_element, prepend(to_string(index4), acc));
      loop$full = full;
      loop$path = parent;
      loop$acc = acc$1;
    } else if (!full) {
      return finish_to_string(acc);
    } else {
      let parent = path.parent;
      if (acc instanceof Empty) {
        loop$full = full;
        loop$path = parent;
        loop$acc = acc;
      } else {
        let acc$1 = acc.tail;
        loop$full = full;
        loop$path = parent;
        loop$acc = prepend(separator_subtree, acc$1);
      }
    }
  }
}
function to_string5(path) {
  return do_to_string(true, path, empty_list);
}
function do_matches(loop$path, loop$candidates) {
  while (true) {
    let path = loop$path;
    let candidates = loop$candidates;
    if (candidates instanceof Empty) {
      return false;
    } else {
      let candidate = candidates.head;
      let rest = candidates.tail;
      let $ = starts_with(path, candidate);
      if ($) {
        return $;
      } else {
        loop$path = path;
        loop$candidates = rest;
      }
    }
  }
}
function matches(path, candidates) {
  if (candidates instanceof Empty) {
    return false;
  } else {
    return do_matches(to_string5(path), candidates);
  }
}
function split_subtree_path(path) {
  return split2(path, separator_subtree);
}
function add3(parent, index4, key) {
  if (key === "") {
    return new Index(index4, parent);
  } else {
    return new Key(key, parent);
  }
}
function subtree(path) {
  return new Subtree(path);
}
function event2(path, event3) {
  return do_to_string(false, path, prepend(separator_event, prepend(event3, empty_list)));
}
function child(path) {
  return do_to_string(false, path, empty_list);
}

// build/dev/javascript/lustre/lustre/vdom/cache.mjs
class Cache extends CustomType {
  constructor(events, vdoms, old_vdoms, dispatched_paths, next_dispatched_paths) {
    super();
    this.events = events;
    this.vdoms = vdoms;
    this.old_vdoms = old_vdoms;
    this.dispatched_paths = dispatched_paths;
    this.next_dispatched_paths = next_dispatched_paths;
  }
}

class Events extends CustomType {
  constructor(handlers, children) {
    super();
    this.handlers = handlers;
    this.children = children;
  }
}

class Child extends CustomType {
  constructor(mapper, events) {
    super();
    this.mapper = mapper;
    this.events = events;
  }
}

class AddedChildren extends CustomType {
  constructor(handlers, children, vdoms) {
    super();
    this.handlers = handlers;
    this.children = children;
    this.vdoms = vdoms;
  }
}

class DecodedEvent extends CustomType {
  constructor(path, handler) {
    super();
    this.path = path;
    this.handler = handler;
  }
}

class DispatchedEvent extends CustomType {
  constructor(path) {
    super();
    this.path = path;
  }
}
function compose_mapper(mapper, child_mapper) {
  return (message) => {
    return mapper(child_mapper(message));
  };
}
function new_events() {
  return new Events(empty4(), empty4());
}
function new$6() {
  return new Cache(new_events(), empty4(), empty4(), empty_list, empty_list);
}
function do_add_event(handlers, path, name, handler) {
  return insert2(handlers, event2(path, name), handler);
}
function add_attributes(handlers, path, attributes) {
  return fold2(attributes, handlers, (events, attribute3) => {
    if (attribute3 instanceof Event2) {
      let name = attribute3.name;
      let handler = attribute3.handler;
      return do_add_event(events, path, name, handler);
    } else {
      return events;
    }
  });
}
function do_add_children(loop$handlers, loop$children, loop$vdoms, loop$parent, loop$child_index, loop$nodes) {
  while (true) {
    let handlers = loop$handlers;
    let children = loop$children;
    let vdoms = loop$vdoms;
    let parent = loop$parent;
    let child_index = loop$child_index;
    let nodes = loop$nodes;
    let next = child_index + 1;
    if (nodes instanceof Empty) {
      return new AddedChildren(handlers, children, vdoms);
    } else {
      let $ = nodes.head;
      if ($ instanceof Fragment) {
        let rest = nodes.tail;
        let key = $.key;
        let nodes$1 = $.children;
        let path = add3(parent, child_index, key);
        let $1 = do_add_children(handlers, children, vdoms, path, 0, nodes$1);
        let handlers$1 = $1.handlers;
        let children$1 = $1.children;
        let vdoms$1 = $1.vdoms;
        loop$handlers = handlers$1;
        loop$children = children$1;
        loop$vdoms = vdoms$1;
        loop$parent = parent;
        loop$child_index = next;
        loop$nodes = rest;
      } else if ($ instanceof Element) {
        let rest = nodes.tail;
        let key = $.key;
        let attributes = $.attributes;
        let nodes$1 = $.children;
        let path = add3(parent, child_index, key);
        let handlers$1 = add_attributes(handlers, path, attributes);
        let $1 = do_add_children(handlers$1, children, vdoms, path, 0, nodes$1);
        let handlers$2 = $1.handlers;
        let children$1 = $1.children;
        let vdoms$1 = $1.vdoms;
        loop$handlers = handlers$2;
        loop$children = children$1;
        loop$vdoms = vdoms$1;
        loop$parent = parent;
        loop$child_index = next;
        loop$nodes = rest;
      } else if ($ instanceof Text) {
        let rest = nodes.tail;
        loop$handlers = handlers;
        loop$children = children;
        loop$vdoms = vdoms;
        loop$parent = parent;
        loop$child_index = next;
        loop$nodes = rest;
      } else if ($ instanceof UnsafeInnerHtml) {
        let rest = nodes.tail;
        let key = $.key;
        let attributes = $.attributes;
        let path = add3(parent, child_index, key);
        let handlers$1 = add_attributes(handlers, path, attributes);
        loop$handlers = handlers$1;
        loop$children = children;
        loop$vdoms = vdoms;
        loop$parent = parent;
        loop$child_index = next;
        loop$nodes = rest;
      } else if ($ instanceof Map2) {
        let rest = nodes.tail;
        let key = $.key;
        let mapper = $.mapper;
        let child2 = $.child;
        let path = add3(parent, child_index, key);
        let added = do_add_children(empty4(), empty4(), vdoms, subtree(path), 0, singleton_list(child2));
        let vdoms$1 = added.vdoms;
        let child_events = new Events(added.handlers, added.children);
        let child$1 = new Child(mapper, child_events);
        let children$1 = insert2(children, child(path), child$1);
        loop$handlers = handlers;
        loop$children = children$1;
        loop$vdoms = vdoms$1;
        loop$parent = parent;
        loop$child_index = next;
        loop$nodes = rest;
      } else {
        let rest = nodes.tail;
        let view = $.view;
        let child_node = view();
        let vdoms$1 = insert2(vdoms, view, child_node);
        let next$1 = child_index;
        let rest$1 = prepend(child_node, rest);
        loop$handlers = handlers;
        loop$children = children;
        loop$vdoms = vdoms$1;
        loop$parent = parent;
        loop$child_index = next$1;
        loop$nodes = rest$1;
      }
    }
  }
}
function add_children(cache, events, path, child_index, nodes) {
  let vdoms = cache.vdoms;
  let handlers = events.handlers;
  let children = events.children;
  let $ = do_add_children(handlers, children, vdoms, path, child_index, nodes);
  let handlers$1 = $.handlers;
  let children$1 = $.children;
  let vdoms$1 = $.vdoms;
  return [
    new Cache(cache.events, vdoms$1, cache.old_vdoms, cache.dispatched_paths, cache.next_dispatched_paths),
    new Events(handlers$1, children$1)
  ];
}
function add_child(cache, events, parent, index4, child2) {
  let children = singleton_list(child2);
  return add_children(cache, events, parent, index4, children);
}
function from_node(root2) {
  let cache = new$6();
  let $ = add_child(cache, cache.events, root, 0, root2);
  let cache$1 = $[0];
  let events$1 = $[1];
  return new Cache(events$1, cache$1.vdoms, cache$1.old_vdoms, cache$1.dispatched_paths, cache$1.next_dispatched_paths);
}
function tick(cache) {
  return new Cache(cache.events, empty4(), cache.vdoms, cache.next_dispatched_paths, empty_list);
}
function events(cache) {
  return cache.events;
}
function update_events(cache, events2) {
  return new Cache(events2, cache.vdoms, cache.old_vdoms, cache.dispatched_paths, cache.next_dispatched_paths);
}
function memos(cache) {
  return cache.vdoms;
}
function get_old_memo(cache, old, new$7) {
  return get_or_compute(cache.old_vdoms, old, new$7);
}
function keep_memo(cache, old, new$7) {
  let node = get_or_compute(cache.old_vdoms, old, new$7);
  let vdoms = insert2(cache.vdoms, new$7, node);
  return new Cache(cache.events, vdoms, cache.old_vdoms, cache.dispatched_paths, cache.next_dispatched_paths);
}
function add_memo(cache, new$7, node) {
  let vdoms = insert2(cache.vdoms, new$7, node);
  return new Cache(cache.events, vdoms, cache.old_vdoms, cache.dispatched_paths, cache.next_dispatched_paths);
}
function get_subtree(events2, path, old_mapper) {
  let child2 = get_or_compute(events2.children, path, () => {
    return new Child(old_mapper, new_events());
  });
  return child2.events;
}
function update_subtree(parent, path, mapper, events2) {
  let new_child = new Child(mapper, events2);
  let children = insert2(parent.children, path, new_child);
  return new Events(parent.handlers, children);
}
function add_event(events2, path, name, handler) {
  let handlers = do_add_event(events2.handlers, path, name, handler);
  return new Events(handlers, events2.children);
}
function do_remove_event(handlers, path, name) {
  return remove(handlers, event2(path, name));
}
function remove_event(events2, path, name) {
  let handlers = do_remove_event(events2.handlers, path, name);
  return new Events(handlers, events2.children);
}
function remove_attributes(handlers, path, attributes) {
  return fold2(attributes, handlers, (events2, attribute3) => {
    if (attribute3 instanceof Event2) {
      let name = attribute3.name;
      return do_remove_event(events2, path, name);
    } else {
      return events2;
    }
  });
}
function do_remove_children(loop$handlers, loop$children, loop$vdoms, loop$parent, loop$index, loop$nodes) {
  while (true) {
    let handlers = loop$handlers;
    let children = loop$children;
    let vdoms = loop$vdoms;
    let parent = loop$parent;
    let index4 = loop$index;
    let nodes = loop$nodes;
    let next = index4 + 1;
    if (nodes instanceof Empty) {
      return new Events(handlers, children);
    } else {
      let $ = nodes.head;
      if ($ instanceof Fragment) {
        let rest = nodes.tail;
        let key = $.key;
        let nodes$1 = $.children;
        let path = add3(parent, index4, key);
        let $1 = do_remove_children(handlers, children, vdoms, path, 0, nodes$1);
        let handlers$1 = $1.handlers;
        let children$1 = $1.children;
        loop$handlers = handlers$1;
        loop$children = children$1;
        loop$vdoms = vdoms;
        loop$parent = parent;
        loop$index = next;
        loop$nodes = rest;
      } else if ($ instanceof Element) {
        let rest = nodes.tail;
        let key = $.key;
        let attributes = $.attributes;
        let nodes$1 = $.children;
        let path = add3(parent, index4, key);
        let handlers$1 = remove_attributes(handlers, path, attributes);
        let $1 = do_remove_children(handlers$1, children, vdoms, path, 0, nodes$1);
        let handlers$2 = $1.handlers;
        let children$1 = $1.children;
        loop$handlers = handlers$2;
        loop$children = children$1;
        loop$vdoms = vdoms;
        loop$parent = parent;
        loop$index = next;
        loop$nodes = rest;
      } else if ($ instanceof Text) {
        let rest = nodes.tail;
        loop$handlers = handlers;
        loop$children = children;
        loop$vdoms = vdoms;
        loop$parent = parent;
        loop$index = next;
        loop$nodes = rest;
      } else if ($ instanceof UnsafeInnerHtml) {
        let rest = nodes.tail;
        let key = $.key;
        let attributes = $.attributes;
        let path = add3(parent, index4, key);
        let handlers$1 = remove_attributes(handlers, path, attributes);
        loop$handlers = handlers$1;
        loop$children = children;
        loop$vdoms = vdoms;
        loop$parent = parent;
        loop$index = next;
        loop$nodes = rest;
      } else if ($ instanceof Map2) {
        let rest = nodes.tail;
        let key = $.key;
        let path = add3(parent, index4, key);
        let children$1 = remove(children, child(path));
        loop$handlers = handlers;
        loop$children = children$1;
        loop$vdoms = vdoms;
        loop$parent = parent;
        loop$index = next;
        loop$nodes = rest;
      } else {
        let rest = nodes.tail;
        let view = $.view;
        let $1 = has_key(vdoms, view);
        if ($1) {
          let child2 = get2(vdoms, view);
          let nodes$1 = prepend(child2, rest);
          loop$handlers = handlers;
          loop$children = children;
          loop$vdoms = vdoms;
          loop$parent = parent;
          loop$index = index4;
          loop$nodes = nodes$1;
        } else {
          loop$handlers = handlers;
          loop$children = children;
          loop$vdoms = vdoms;
          loop$parent = parent;
          loop$index = next;
          loop$nodes = rest;
        }
      }
    }
  }
}
function remove_child(cache, events2, parent, child_index, child2) {
  return do_remove_children(events2.handlers, events2.children, cache.old_vdoms, parent, child_index, singleton_list(child2));
}
function replace_child(cache, events2, parent, child_index, prev, next) {
  let events$1 = remove_child(cache, events2, parent, child_index, prev);
  return add_child(cache, events$1, parent, child_index, next);
}
function get_handler(loop$events, loop$path, loop$mapper) {
  while (true) {
    let events2 = loop$events;
    let path = loop$path;
    let mapper = loop$mapper;
    if (path instanceof Empty) {
      return error_nil;
    } else {
      let $ = path.tail;
      if ($ instanceof Empty) {
        let key = path.head;
        let $1 = has_key(events2.handlers, key);
        if ($1) {
          let handler = get2(events2.handlers, key);
          return new Ok(map3(handler, (handler2) => {
            return new Handler(handler2.prevent_default, handler2.stop_propagation, identity3(mapper)(handler2.message));
          }));
        } else {
          return error_nil;
        }
      } else {
        let key = path.head;
        let path$1 = $;
        let $1 = has_key(events2.children, key);
        if ($1) {
          let child2 = get2(events2.children, key);
          let mapper$1 = compose_mapper(mapper, child2.mapper);
          loop$events = child2.events;
          loop$path = path$1;
          loop$mapper = mapper$1;
        } else {
          return error_nil;
        }
      }
    }
  }
}
function decode2(cache, path, name, event3) {
  let parts = split_subtree_path(path + separator_event + name);
  let $ = get_handler(cache.events, parts, identity3);
  if ($ instanceof Ok) {
    let handler = $[0];
    let $1 = run(event3, handler);
    if ($1 instanceof Ok) {
      let handler$1 = $1[0];
      return new DecodedEvent(path, handler$1);
    } else {
      return new DispatchedEvent(path);
    }
  } else {
    return new DispatchedEvent(path);
  }
}
function dispatch(cache, event3) {
  let next_dispatched_paths = prepend(event3.path, cache.next_dispatched_paths);
  let cache$1 = new Cache(cache.events, cache.vdoms, cache.old_vdoms, cache.dispatched_paths, next_dispatched_paths);
  if (event3 instanceof DecodedEvent) {
    let handler = event3.handler;
    return [cache$1, new Ok(handler)];
  } else {
    return [cache$1, error_nil];
  }
}
function handle(cache, path, name, event3) {
  let _pipe = decode2(cache, path, name, event3);
  return ((_capture) => {
    return dispatch(cache, _capture);
  })(_pipe);
}
function has_dispatched_events(cache, path) {
  return matches(path, cache.dispatched_paths);
}

// build/dev/javascript/lustre/lustre/runtime/server/runtime.mjs
class ClientDispatchedMessage extends CustomType {
  constructor(message) {
    super();
    this.message = message;
  }
}
var Message$isClientDispatchedMessage = (value2) => value2 instanceof ClientDispatchedMessage;
class ClientRegisteredCallback extends CustomType {
  constructor(callback) {
    super();
    this.callback = callback;
  }
}
var Message$isClientRegisteredCallback = (value2) => value2 instanceof ClientRegisteredCallback;
class ClientDeregisteredCallback extends CustomType {
  constructor(callback) {
    super();
    this.callback = callback;
  }
}
var Message$isClientDeregisteredCallback = (value2) => value2 instanceof ClientDeregisteredCallback;
class EffectDispatchedMessage extends CustomType {
  constructor(message) {
    super();
    this.message = message;
  }
}
var Message$EffectDispatchedMessage = (message) => new EffectDispatchedMessage(message);
var Message$isEffectDispatchedMessage = (value2) => value2 instanceof EffectDispatchedMessage;
class EffectEmitEvent extends CustomType {
  constructor(name, data) {
    super();
    this.name = name;
    this.data = data;
  }
}
var Message$EffectEmitEvent = (name, data) => new EffectEmitEvent(name, data);
var Message$isEffectEmitEvent = (value2) => value2 instanceof EffectEmitEvent;
class EffectProvidedValue extends CustomType {
  constructor(key, value2) {
    super();
    this.key = key;
    this.value = value2;
  }
}
var Message$EffectProvidedValue = (key, value2) => new EffectProvidedValue(key, value2);
var Message$isEffectProvidedValue = (value2) => value2 instanceof EffectProvidedValue;
class EffectRequestedContextSubscription extends CustomType {
  constructor(key, decoder) {
    super();
    this.key = key;
    this.decoder = decoder;
  }
}
var Message$EffectRequestedContextSubscription = (key, decoder) => new EffectRequestedContextSubscription(key, decoder);
var Message$isEffectRequestedContextSubscription = (value2) => value2 instanceof EffectRequestedContextSubscription;
class EffectRemovedContextSubscription extends CustomType {
  constructor(key) {
    super();
    this.key = key;
  }
}
var Message$EffectRemovedContextSubscription = (key) => new EffectRemovedContextSubscription(key);
var Message$isEffectRemovedContextSubscription = (value2) => value2 instanceof EffectRemovedContextSubscription;
class SystemRequestedShutdown extends CustomType {
}
var Message$SystemRequestedShutdown$const = new SystemRequestedShutdown;
var Message$isSystemRequestedShutdown = (value2) => value2 instanceof SystemRequestedShutdown;

// build/dev/javascript/lustre/lustre/runtime/app.mjs
class App extends CustomType {
  constructor(name, init, update2, view, config) {
    super();
    this.name = name;
    this.init = init;
    this.update = update2;
    this.view = view;
    this.config = config;
  }
}
class Config2 extends CustomType {
  constructor(open_shadow_root, adopt_styles, delegates_focus, attributes, properties, contexts, is_form_associated, on_form_autofill, on_form_reset, on_form_restore, on_form_disabled, on_connect, on_adopt, on_disconnect) {
    super();
    this.open_shadow_root = open_shadow_root;
    this.adopt_styles = adopt_styles;
    this.delegates_focus = delegates_focus;
    this.attributes = attributes;
    this.properties = properties;
    this.contexts = contexts;
    this.is_form_associated = is_form_associated;
    this.on_form_autofill = on_form_autofill;
    this.on_form_reset = on_form_reset;
    this.on_form_restore = on_form_restore;
    this.on_form_disabled = on_form_disabled;
    this.on_connect = on_connect;
    this.on_adopt = on_adopt;
    this.on_disconnect = on_disconnect;
  }
}
var default_config = /* @__PURE__ */ new Config2(true, true, false, empty_list, empty_list, empty_list, false, Option$None$const, Option$None$const, Option$None$const, Option$None$const, Option$None$const, Option$None$const, Option$None$const);

// build/dev/javascript/lustre/lustre/internals/equals.ffi.mjs
var isEqual2 = (a2, b) => {
  if (a2 === b) {
    return true;
  }
  if (a2 == null || b == null) {
    return false;
  }
  const type = typeof a2;
  if (type !== typeof b) {
    return false;
  }
  if (type !== "object") {
    return false;
  }
  const ctor = a2.constructor;
  if (ctor !== b.constructor) {
    return false;
  }
  if (Array.isArray(a2)) {
    return areArraysEqual(a2, b);
  }
  return areObjectsEqual(a2, b);
};
var areArraysEqual = (a2, b) => {
  let index4 = a2.length;
  if (index4 !== b.length) {
    return false;
  }
  while (index4--) {
    if (!isEqual2(a2[index4], b[index4])) {
      return false;
    }
  }
  return true;
};
var areObjectsEqual = (a2, b) => {
  const properties = Object.keys(a2);
  let index4 = properties.length;
  if (Object.keys(b).length !== index4) {
    return false;
  }
  while (index4--) {
    const property3 = properties[index4];
    if (!Object.hasOwn(b, property3)) {
      return false;
    }
    if (!isEqual2(a2[property3], b[property3])) {
      return false;
    }
  }
  return true;
};

// build/dev/javascript/lustre/lustre/vdom/diff.mjs
class Diff extends CustomType {
  constructor(patch, cache) {
    super();
    this.patch = patch;
    this.cache = cache;
  }
}
class PartialDiff extends CustomType {
  constructor(patch, cache, events2) {
    super();
    this.patch = patch;
    this.cache = cache;
    this.events = events2;
  }
}

class AttributeChange extends CustomType {
  constructor(added, removed, events2) {
    super();
    this.added = added;
    this.removed = removed;
    this.events = events2;
  }
}
function diff_attributes(loop$controlled, loop$path, loop$events, loop$old, loop$new, loop$added, loop$removed) {
  while (true) {
    let controlled = loop$controlled;
    let path = loop$path;
    let events2 = loop$events;
    let old = loop$old;
    let new$7 = loop$new;
    let added = loop$added;
    let removed = loop$removed;
    if (old instanceof Empty) {
      if (new$7 instanceof Empty) {
        return new AttributeChange(added, removed, events2);
      } else {
        let $ = new$7.head;
        if ($ instanceof Event2) {
          let next = $;
          let new$1 = new$7.tail;
          let name = $.name;
          let handler = $.handler;
          let events$1 = add_event(events2, path, name, handler);
          let added$1 = prepend(next, added);
          loop$controlled = controlled;
          loop$path = path;
          loop$events = events$1;
          loop$old = old;
          loop$new = new$1;
          loop$added = added$1;
          loop$removed = removed;
        } else {
          let next = $;
          let new$1 = new$7.tail;
          let added$1 = prepend(next, added);
          loop$controlled = controlled;
          loop$path = path;
          loop$events = events2;
          loop$old = old;
          loop$new = new$1;
          loop$added = added$1;
          loop$removed = removed;
        }
      }
    } else if (new$7 instanceof Empty) {
      let $ = old.head;
      if ($ instanceof Event2) {
        let prev = $;
        let old$1 = old.tail;
        let name = $.name;
        let events$1 = remove_event(events2, path, name);
        let removed$1 = prepend(prev, removed);
        loop$controlled = controlled;
        loop$path = path;
        loop$events = events$1;
        loop$old = old$1;
        loop$new = new$7;
        loop$added = added;
        loop$removed = removed$1;
      } else {
        let prev = $;
        let old$1 = old.tail;
        let removed$1 = prepend(prev, removed);
        loop$controlled = controlled;
        loop$path = path;
        loop$events = events2;
        loop$old = old$1;
        loop$new = new$7;
        loop$added = added;
        loop$removed = removed$1;
      }
    } else {
      let prev = old.head;
      let remaining_old = old.tail;
      let next = new$7.head;
      let remaining_new = new$7.tail;
      let $ = compare4(prev, next);
      if ($ instanceof Lt) {
        if (prev instanceof Event2) {
          let name = prev.name;
          loop$controlled = controlled;
          loop$path = path;
          loop$events = remove_event(events2, path, name);
          loop$old = remaining_old;
          loop$new = new$7;
          loop$added = added;
          loop$removed = prepend(prev, removed);
        } else {
          loop$controlled = controlled;
          loop$path = path;
          loop$events = events2;
          loop$old = remaining_old;
          loop$new = new$7;
          loop$added = added;
          loop$removed = prepend(prev, removed);
        }
      } else if ($ instanceof Eq) {
        if (prev instanceof Attribute) {
          if (next instanceof Attribute) {
            let _block;
            let $1 = next.name;
            if ($1 === "value") {
              _block = controlled || prev.value !== next.value;
            } else if ($1 === "checked") {
              _block = controlled || prev.value !== next.value;
            } else if ($1 === "selected") {
              _block = controlled || prev.value !== next.value;
            } else {
              _block = prev.value !== next.value;
            }
            let has_changes = _block;
            let _block$1;
            if (has_changes) {
              _block$1 = prepend(next, added);
            } else {
              _block$1 = added;
            }
            let added$1 = _block$1;
            loop$controlled = controlled;
            loop$path = path;
            loop$events = events2;
            loop$old = remaining_old;
            loop$new = remaining_new;
            loop$added = added$1;
            loop$removed = removed;
          } else if (next instanceof Event2) {
            let name = next.name;
            let handler = next.handler;
            loop$controlled = controlled;
            loop$path = path;
            loop$events = add_event(events2, path, name, handler);
            loop$old = remaining_old;
            loop$new = remaining_new;
            loop$added = prepend(next, added);
            loop$removed = prepend(prev, removed);
          } else {
            loop$controlled = controlled;
            loop$path = path;
            loop$events = events2;
            loop$old = remaining_old;
            loop$new = remaining_new;
            loop$added = prepend(next, added);
            loop$removed = prepend(prev, removed);
          }
        } else if (prev instanceof Property) {
          if (next instanceof Property) {
            let _block;
            let $1 = next.name;
            if ($1 === "scrollLeft") {
              _block = true;
            } else if ($1 === "scrollRight") {
              _block = true;
            } else if ($1 === "value") {
              _block = controlled || !isEqual2(prev.value, next.value);
            } else if ($1 === "checked") {
              _block = controlled || !isEqual2(prev.value, next.value);
            } else if ($1 === "selected") {
              _block = controlled || !isEqual2(prev.value, next.value);
            } else {
              _block = !isEqual2(prev.value, next.value);
            }
            let has_changes = _block;
            let _block$1;
            if (has_changes) {
              _block$1 = prepend(next, added);
            } else {
              _block$1 = added;
            }
            let added$1 = _block$1;
            loop$controlled = controlled;
            loop$path = path;
            loop$events = events2;
            loop$old = remaining_old;
            loop$new = remaining_new;
            loop$added = added$1;
            loop$removed = removed;
          } else if (next instanceof Event2) {
            let name = next.name;
            let handler = next.handler;
            loop$controlled = controlled;
            loop$path = path;
            loop$events = add_event(events2, path, name, handler);
            loop$old = remaining_old;
            loop$new = remaining_new;
            loop$added = prepend(next, added);
            loop$removed = prepend(prev, removed);
          } else {
            loop$controlled = controlled;
            loop$path = path;
            loop$events = events2;
            loop$old = remaining_old;
            loop$new = remaining_new;
            loop$added = prepend(next, added);
            loop$removed = prepend(prev, removed);
          }
        } else if (next instanceof Event2) {
          let name = next.name;
          let handler = next.handler;
          let has_changes = prev.prevent_default.kind !== next.prevent_default.kind || prev.stop_propagation.kind !== next.stop_propagation.kind || prev.debounce !== next.debounce || prev.throttle !== next.throttle;
          let _block;
          if (has_changes) {
            _block = prepend(next, added);
          } else {
            _block = added;
          }
          let added$1 = _block;
          loop$controlled = controlled;
          loop$path = path;
          loop$events = add_event(events2, path, name, handler);
          loop$old = remaining_old;
          loop$new = remaining_new;
          loop$added = added$1;
          loop$removed = removed;
        } else {
          let name = prev.name;
          loop$controlled = controlled;
          loop$path = path;
          loop$events = remove_event(events2, path, name);
          loop$old = remaining_old;
          loop$new = remaining_new;
          loop$added = prepend(next, added);
          loop$removed = prepend(prev, removed);
        }
      } else if (next instanceof Event2) {
        let name = next.name;
        let handler = next.handler;
        loop$controlled = controlled;
        loop$path = path;
        loop$events = add_event(events2, path, name, handler);
        loop$old = old;
        loop$new = remaining_new;
        loop$added = prepend(next, added);
        loop$removed = removed;
      } else {
        loop$controlled = controlled;
        loop$path = path;
        loop$events = events2;
        loop$old = old;
        loop$new = remaining_new;
        loop$added = prepend(next, added);
        loop$removed = removed;
      }
    }
  }
}
function is_controlled(cache, namespace, tag, path) {
  if (tag === "input" && namespace === "") {
    return has_dispatched_events(cache, path);
  } else if (tag === "select" && namespace === "") {
    return has_dispatched_events(cache, path);
  } else if (tag === "textarea" && namespace === "") {
    return has_dispatched_events(cache, path);
  } else {
    return false;
  }
}
function do_diff(loop$old, loop$old_keyed, loop$new, loop$new_keyed, loop$moved, loop$moved_offset, loop$removed, loop$node_index, loop$patch_index, loop$changes, loop$children, loop$path, loop$cache, loop$events) {
  while (true) {
    let old = loop$old;
    let old_keyed = loop$old_keyed;
    let new$7 = loop$new;
    let new_keyed = loop$new_keyed;
    let moved = loop$moved;
    let moved_offset = loop$moved_offset;
    let removed = loop$removed;
    let node_index = loop$node_index;
    let patch_index = loop$patch_index;
    let changes = loop$changes;
    let children = loop$children;
    let path = loop$path;
    let cache = loop$cache;
    let events2 = loop$events;
    if (old instanceof Empty) {
      if (new$7 instanceof Empty) {
        let _block;
        let $ = is_browser();
        if (changes instanceof Empty) {
          if (children instanceof Empty) {
            _block = new$5(patch_index, removed, changes, children);
          } else if (!$ && children.tail instanceof Empty && removed === 0) {
            let child2 = children.head;
            _block = add_parent(child2, patch_index);
          } else {
            _block = new$5(patch_index, removed, changes, children);
          }
        } else {
          _block = new$5(patch_index, removed, changes, children);
        }
        let patch = _block;
        return new PartialDiff(patch, cache, events2);
      } else {
        let $ = add_children(cache, events2, path, node_index, new$7);
        let cache$1 = $[0];
        let events$1 = $[1];
        let insert5 = insert4(new$7, node_index - moved_offset);
        let changes$1 = prepend(insert5, changes);
        let patch = new$5(patch_index, removed, changes$1, children);
        return new PartialDiff(patch, cache$1, events$1);
      }
    } else if (new$7 instanceof Empty) {
      let prev = old.head;
      let old$1 = old.tail;
      let $ = prev.key === "" || !has_key(moved, prev.key);
      if ($) {
        let events$1 = remove_child(cache, events2, path, node_index, prev);
        loop$old = old$1;
        loop$old_keyed = old_keyed;
        loop$new = new$7;
        loop$new_keyed = new_keyed;
        loop$moved = moved;
        loop$moved_offset = moved_offset;
        loop$removed = removed + 1;
        loop$node_index = node_index;
        loop$patch_index = patch_index;
        loop$changes = changes;
        loop$children = children;
        loop$path = path;
        loop$cache = cache;
        loop$events = events$1;
      } else {
        loop$old = old$1;
        loop$old_keyed = old_keyed;
        loop$new = new$7;
        loop$new_keyed = new_keyed;
        loop$moved = moved;
        loop$moved_offset = moved_offset;
        loop$removed = removed;
        loop$node_index = node_index;
        loop$patch_index = patch_index;
        loop$changes = changes;
        loop$children = children;
        loop$path = path;
        loop$cache = cache;
        loop$events = events2;
      }
    } else {
      let prev = old.head;
      let next = new$7.head;
      if (prev.key !== next.key) {
        let old_remaining = old.tail;
        let new_remaining = new$7.tail;
        let next_did_exist = has_key(old_keyed, next.key);
        let prev_does_exist = has_key(new_keyed, prev.key);
        if (prev_does_exist) {
          if (next_did_exist) {
            let $ = has_key(moved, prev.key);
            if ($) {
              loop$old = old_remaining;
              loop$old_keyed = old_keyed;
              loop$new = new$7;
              loop$new_keyed = new_keyed;
              loop$moved = moved;
              loop$moved_offset = moved_offset - 1;
              loop$removed = removed;
              loop$node_index = node_index;
              loop$patch_index = patch_index;
              loop$changes = changes;
              loop$children = children;
              loop$path = path;
              loop$cache = cache;
              loop$events = events2;
            } else {
              let match = get2(old_keyed, next.key);
              let before = node_index - moved_offset;
              let changes$1 = prepend(move(next.key, before), changes);
              let moved$1 = insert2(moved, next.key, undefined);
              loop$old = prepend(match, old);
              loop$old_keyed = old_keyed;
              loop$new = new$7;
              loop$new_keyed = new_keyed;
              loop$moved = moved$1;
              loop$moved_offset = moved_offset + 1;
              loop$removed = removed;
              loop$node_index = node_index;
              loop$patch_index = patch_index;
              loop$changes = changes$1;
              loop$children = children;
              loop$path = path;
              loop$cache = cache;
              loop$events = events2;
            }
          } else {
            let before = node_index - moved_offset;
            let $ = add_child(cache, events2, path, node_index, next);
            let cache$1 = $[0];
            let events$1 = $[1];
            let insert5 = insert4(singleton_list(next), before);
            let changes$1 = prepend(insert5, changes);
            loop$old = old;
            loop$old_keyed = old_keyed;
            loop$new = new_remaining;
            loop$new_keyed = new_keyed;
            loop$moved = moved;
            loop$moved_offset = moved_offset + 1;
            loop$removed = removed;
            loop$node_index = node_index + 1;
            loop$patch_index = patch_index;
            loop$changes = changes$1;
            loop$children = children;
            loop$path = path;
            loop$cache = cache$1;
            loop$events = events$1;
          }
        } else if (next_did_exist) {
          let index4 = node_index - moved_offset;
          let changes$1 = prepend(remove2(index4), changes);
          let events$1 = remove_child(cache, events2, path, node_index, prev);
          loop$old = old_remaining;
          loop$old_keyed = old_keyed;
          loop$new = new$7;
          loop$new_keyed = new_keyed;
          loop$moved = moved;
          loop$moved_offset = moved_offset - 1;
          loop$removed = removed;
          loop$node_index = node_index;
          loop$patch_index = patch_index;
          loop$changes = changes$1;
          loop$children = children;
          loop$path = path;
          loop$cache = cache;
          loop$events = events$1;
        } else {
          let change = replace2(node_index - moved_offset, next);
          let $ = replace_child(cache, events2, path, node_index, prev, next);
          let cache$1 = $[0];
          let events$1 = $[1];
          loop$old = old_remaining;
          loop$old_keyed = old_keyed;
          loop$new = new_remaining;
          loop$new_keyed = new_keyed;
          loop$moved = moved;
          loop$moved_offset = moved_offset;
          loop$removed = removed;
          loop$node_index = node_index + 1;
          loop$patch_index = patch_index;
          loop$changes = prepend(change, changes);
          loop$children = children;
          loop$path = path;
          loop$cache = cache$1;
          loop$events = events$1;
        }
      } else {
        let $ = old.head;
        if ($ instanceof Fragment) {
          let $1 = new$7.head;
          if ($1 instanceof Fragment) {
            let prev$1 = $;
            let old$1 = old.tail;
            let next$1 = $1;
            let new$1 = new$7.tail;
            let $2 = do_diff(prev$1.children, prev$1.keyed_children, next$1.children, next$1.keyed_children, empty4(), 0, 0, 0, node_index, empty_list, empty_list, add3(path, node_index, next$1.key), cache, events2);
            let patch = $2.patch;
            let cache$1 = $2.cache;
            let events$1 = $2.events;
            let _block;
            if (patch.changes instanceof Empty && patch.children instanceof Empty && patch.removed === 0) {
              _block = children;
            } else {
              _block = prepend(patch, children);
            }
            let children$1 = _block;
            loop$old = old$1;
            loop$old_keyed = old_keyed;
            loop$new = new$1;
            loop$new_keyed = new_keyed;
            loop$moved = moved;
            loop$moved_offset = moved_offset;
            loop$removed = removed;
            loop$node_index = node_index + 1;
            loop$patch_index = patch_index;
            loop$changes = changes;
            loop$children = children$1;
            loop$path = path;
            loop$cache = cache$1;
            loop$events = events$1;
          } else {
            let prev$1 = $;
            let old_remaining$1 = old.tail;
            let next$1 = $1;
            let new_remaining$1 = new$7.tail;
            let change = replace2(node_index - moved_offset, next$1);
            let $2 = replace_child(cache, events2, path, node_index, prev$1, next$1);
            let cache$1 = $2[0];
            let events$1 = $2[1];
            loop$old = old_remaining$1;
            loop$old_keyed = old_keyed;
            loop$new = new_remaining$1;
            loop$new_keyed = new_keyed;
            loop$moved = moved;
            loop$moved_offset = moved_offset;
            loop$removed = removed;
            loop$node_index = node_index + 1;
            loop$patch_index = patch_index;
            loop$changes = prepend(change, changes);
            loop$children = children;
            loop$path = path;
            loop$cache = cache$1;
            loop$events = events$1;
          }
        } else if ($ instanceof Element) {
          let $1 = new$7.head;
          if ($1 instanceof Element) {
            let prev$1 = $;
            let next$1 = $1;
            if (prev$1.namespace === next$1.namespace && prev$1.tag === next$1.tag) {
              let old$1 = old.tail;
              let new$1 = new$7.tail;
              let child_path = add3(path, node_index, next$1.key);
              let controlled = is_controlled(cache, next$1.namespace, next$1.tag, child_path);
              let $2 = diff_attributes(controlled, child_path, events2, prev$1.attributes, next$1.attributes, empty_list, empty_list);
              let added_attrs = $2.added;
              let removed_attrs = $2.removed;
              let events$1 = $2.events;
              let _block;
              if (added_attrs instanceof Empty && removed_attrs instanceof Empty) {
                _block = empty_list;
              } else {
                _block = singleton_list(update(added_attrs, removed_attrs));
              }
              let initial_child_changes = _block;
              let $3 = do_diff(prev$1.children, prev$1.keyed_children, next$1.children, next$1.keyed_children, empty4(), 0, 0, 0, node_index, initial_child_changes, empty_list, child_path, cache, events$1);
              let patch = $3.patch;
              let cache$1 = $3.cache;
              let events$2 = $3.events;
              let _block$1;
              if (patch.changes instanceof Empty && patch.children instanceof Empty && patch.removed === 0) {
                _block$1 = children;
              } else {
                _block$1 = prepend(patch, children);
              }
              let children$1 = _block$1;
              loop$old = old$1;
              loop$old_keyed = old_keyed;
              loop$new = new$1;
              loop$new_keyed = new_keyed;
              loop$moved = moved;
              loop$moved_offset = moved_offset;
              loop$removed = removed;
              loop$node_index = node_index + 1;
              loop$patch_index = patch_index;
              loop$changes = changes;
              loop$children = children$1;
              loop$path = path;
              loop$cache = cache$1;
              loop$events = events$2;
            } else {
              let prev$2 = $;
              let old_remaining$1 = old.tail;
              let next$2 = $1;
              let new_remaining$1 = new$7.tail;
              let change = replace2(node_index - moved_offset, next$2);
              let $4 = replace_child(cache, events2, path, node_index, prev$2, next$2);
              let cache$2 = $4[0];
              let events$3 = $4[1];
              loop$old = old_remaining$1;
              loop$old_keyed = old_keyed;
              loop$new = new_remaining$1;
              loop$new_keyed = new_keyed;
              loop$moved = moved;
              loop$moved_offset = moved_offset;
              loop$removed = removed;
              loop$node_index = node_index + 1;
              loop$patch_index = patch_index;
              loop$changes = prepend(change, changes);
              loop$children = children;
              loop$path = path;
              loop$cache = cache$2;
              loop$events = events$3;
            }
          } else {
            let prev$1 = $;
            let old_remaining$1 = old.tail;
            let next$1 = $1;
            let new_remaining$1 = new$7.tail;
            let change = replace2(node_index - moved_offset, next$1);
            let $2 = replace_child(cache, events2, path, node_index, prev$1, next$1);
            let cache$1 = $2[0];
            let events$1 = $2[1];
            loop$old = old_remaining$1;
            loop$old_keyed = old_keyed;
            loop$new = new_remaining$1;
            loop$new_keyed = new_keyed;
            loop$moved = moved;
            loop$moved_offset = moved_offset;
            loop$removed = removed;
            loop$node_index = node_index + 1;
            loop$patch_index = patch_index;
            loop$changes = prepend(change, changes);
            loop$children = children;
            loop$path = path;
            loop$cache = cache$1;
            loop$events = events$1;
          }
        } else if ($ instanceof Text) {
          let $1 = new$7.head;
          if ($1 instanceof Text) {
            let prev$1 = $;
            let next$1 = $1;
            if (prev$1.content === next$1.content) {
              let old$1 = old.tail;
              let new$1 = new$7.tail;
              loop$old = old$1;
              loop$old_keyed = old_keyed;
              loop$new = new$1;
              loop$new_keyed = new_keyed;
              loop$moved = moved;
              loop$moved_offset = moved_offset;
              loop$removed = removed;
              loop$node_index = node_index + 1;
              loop$patch_index = patch_index;
              loop$changes = changes;
              loop$children = children;
              loop$path = path;
              loop$cache = cache;
              loop$events = events2;
            } else {
              let old$2 = old.tail;
              let next$2 = $1;
              let new$22 = new$7.tail;
              let child2 = new$5(node_index, 0, singleton_list(replace_text(next$2.content)), empty_list);
              loop$old = old$2;
              loop$old_keyed = old_keyed;
              loop$new = new$22;
              loop$new_keyed = new_keyed;
              loop$moved = moved;
              loop$moved_offset = moved_offset;
              loop$removed = removed;
              loop$node_index = node_index + 1;
              loop$patch_index = patch_index;
              loop$changes = changes;
              loop$children = prepend(child2, children);
              loop$path = path;
              loop$cache = cache;
              loop$events = events2;
            }
          } else {
            let prev$1 = $;
            let old_remaining$1 = old.tail;
            let next$1 = $1;
            let new_remaining$1 = new$7.tail;
            let change = replace2(node_index - moved_offset, next$1);
            let $2 = replace_child(cache, events2, path, node_index, prev$1, next$1);
            let cache$1 = $2[0];
            let events$1 = $2[1];
            loop$old = old_remaining$1;
            loop$old_keyed = old_keyed;
            loop$new = new_remaining$1;
            loop$new_keyed = new_keyed;
            loop$moved = moved;
            loop$moved_offset = moved_offset;
            loop$removed = removed;
            loop$node_index = node_index + 1;
            loop$patch_index = patch_index;
            loop$changes = prepend(change, changes);
            loop$children = children;
            loop$path = path;
            loop$cache = cache$1;
            loop$events = events$1;
          }
        } else if ($ instanceof UnsafeInnerHtml) {
          let $1 = new$7.head;
          if ($1 instanceof UnsafeInnerHtml) {
            let prev$1 = $;
            let old$1 = old.tail;
            let next$1 = $1;
            let new$1 = new$7.tail;
            let child_path = add3(path, node_index, next$1.key);
            let $2 = diff_attributes(false, child_path, events2, prev$1.attributes, next$1.attributes, empty_list, empty_list);
            let added_attrs = $2.added;
            let removed_attrs = $2.removed;
            let events$1 = $2.events;
            let _block;
            if (added_attrs instanceof Empty && removed_attrs instanceof Empty) {
              _block = empty_list;
            } else {
              _block = singleton_list(update(added_attrs, removed_attrs));
            }
            let child_changes = _block;
            let _block$1;
            let $3 = prev$1.inner_html === next$1.inner_html;
            if ($3) {
              _block$1 = child_changes;
            } else {
              _block$1 = prepend(replace_inner_html(next$1.inner_html), child_changes);
            }
            let child_changes$1 = _block$1;
            let _block$2;
            if (child_changes$1 instanceof Empty) {
              _block$2 = children;
            } else {
              _block$2 = prepend(new$5(node_index, 0, child_changes$1, empty_list), children);
            }
            let children$1 = _block$2;
            loop$old = old$1;
            loop$old_keyed = old_keyed;
            loop$new = new$1;
            loop$new_keyed = new_keyed;
            loop$moved = moved;
            loop$moved_offset = moved_offset;
            loop$removed = removed;
            loop$node_index = node_index + 1;
            loop$patch_index = patch_index;
            loop$changes = changes;
            loop$children = children$1;
            loop$path = path;
            loop$cache = cache;
            loop$events = events$1;
          } else {
            let prev$1 = $;
            let old_remaining$1 = old.tail;
            let next$1 = $1;
            let new_remaining$1 = new$7.tail;
            let change = replace2(node_index - moved_offset, next$1);
            let $2 = replace_child(cache, events2, path, node_index, prev$1, next$1);
            let cache$1 = $2[0];
            let events$1 = $2[1];
            loop$old = old_remaining$1;
            loop$old_keyed = old_keyed;
            loop$new = new_remaining$1;
            loop$new_keyed = new_keyed;
            loop$moved = moved;
            loop$moved_offset = moved_offset;
            loop$removed = removed;
            loop$node_index = node_index + 1;
            loop$patch_index = patch_index;
            loop$changes = prepend(change, changes);
            loop$children = children;
            loop$path = path;
            loop$cache = cache$1;
            loop$events = events$1;
          }
        } else if ($ instanceof Map2) {
          let $1 = new$7.head;
          if ($1 instanceof Map2) {
            let prev$1 = $;
            let old$1 = old.tail;
            let next$1 = $1;
            let new$1 = new$7.tail;
            let child_path = add3(path, node_index, next$1.key);
            let child_key = child(child_path);
            let $2 = do_diff(singleton_list(prev$1.child), empty4(), singleton_list(next$1.child), empty4(), empty4(), 0, 0, 0, node_index, empty_list, empty_list, subtree(child_path), cache, get_subtree(events2, child_key, prev$1.mapper));
            let patch = $2.patch;
            let cache$1 = $2.cache;
            let child_events = $2.events;
            let events$1 = update_subtree(events2, child_key, next$1.mapper, child_events);
            let _block;
            if (patch.changes instanceof Empty && patch.children instanceof Empty && patch.removed === 0) {
              _block = children;
            } else {
              _block = prepend(patch, children);
            }
            let children$1 = _block;
            loop$old = old$1;
            loop$old_keyed = old_keyed;
            loop$new = new$1;
            loop$new_keyed = new_keyed;
            loop$moved = moved;
            loop$moved_offset = moved_offset;
            loop$removed = removed;
            loop$node_index = node_index + 1;
            loop$patch_index = patch_index;
            loop$changes = changes;
            loop$children = children$1;
            loop$path = path;
            loop$cache = cache$1;
            loop$events = events$1;
          } else {
            let prev$1 = $;
            let old_remaining$1 = old.tail;
            let next$1 = $1;
            let new_remaining$1 = new$7.tail;
            let change = replace2(node_index - moved_offset, next$1);
            let $2 = replace_child(cache, events2, path, node_index, prev$1, next$1);
            let cache$1 = $2[0];
            let events$1 = $2[1];
            loop$old = old_remaining$1;
            loop$old_keyed = old_keyed;
            loop$new = new_remaining$1;
            loop$new_keyed = new_keyed;
            loop$moved = moved;
            loop$moved_offset = moved_offset;
            loop$removed = removed;
            loop$node_index = node_index + 1;
            loop$patch_index = patch_index;
            loop$changes = prepend(change, changes);
            loop$children = children;
            loop$path = path;
            loop$cache = cache$1;
            loop$events = events$1;
          }
        } else {
          let $1 = new$7.head;
          if ($1 instanceof Memo) {
            let prev$1 = $;
            let old$1 = old.tail;
            let next$1 = $1;
            let new$1 = new$7.tail;
            let $2 = equal_lists(prev$1.dependencies, next$1.dependencies);
            if ($2) {
              let cache$1 = keep_memo(cache, prev$1.view, next$1.view);
              loop$old = old$1;
              loop$old_keyed = old_keyed;
              loop$new = new$1;
              loop$new_keyed = new_keyed;
              loop$moved = moved;
              loop$moved_offset = moved_offset;
              loop$removed = removed;
              loop$node_index = node_index + 1;
              loop$patch_index = patch_index;
              loop$changes = changes;
              loop$children = children;
              loop$path = path;
              loop$cache = cache$1;
              loop$events = events2;
            } else {
              let prev_node = get_old_memo(cache, prev$1.view, prev$1.view);
              let next_node = next$1.view();
              let cache$1 = add_memo(cache, next$1.view, next_node);
              loop$old = prepend(prev_node, old$1);
              loop$old_keyed = old_keyed;
              loop$new = prepend(next_node, new$1);
              loop$new_keyed = new_keyed;
              loop$moved = moved;
              loop$moved_offset = moved_offset;
              loop$removed = removed;
              loop$node_index = node_index;
              loop$patch_index = patch_index;
              loop$changes = changes;
              loop$children = children;
              loop$path = path;
              loop$cache = cache$1;
              loop$events = events2;
            }
          } else {
            let prev$1 = $;
            let old_remaining$1 = old.tail;
            let next$1 = $1;
            let new_remaining$1 = new$7.tail;
            let change = replace2(node_index - moved_offset, next$1);
            let $2 = replace_child(cache, events2, path, node_index, prev$1, next$1);
            let cache$1 = $2[0];
            let events$1 = $2[1];
            loop$old = old_remaining$1;
            loop$old_keyed = old_keyed;
            loop$new = new_remaining$1;
            loop$new_keyed = new_keyed;
            loop$moved = moved;
            loop$moved_offset = moved_offset;
            loop$removed = removed;
            loop$node_index = node_index + 1;
            loop$patch_index = patch_index;
            loop$changes = prepend(change, changes);
            loop$children = children;
            loop$path = path;
            loop$cache = cache$1;
            loop$events = events$1;
          }
        }
      }
    }
  }
}
function diff(cache, old, new$7) {
  let cache$1 = tick(cache);
  let $ = do_diff(singleton_list(old), empty4(), singleton_list(new$7), empty4(), empty4(), 0, 0, 0, 0, empty_list, empty_list, root, cache$1, events(cache$1));
  let patch = $.patch;
  let cache$2 = $.cache;
  let events2 = $.events;
  return new Diff(patch, update_events(cache$2, events2));
}

// build/dev/javascript/lustre/lustre/internals/list.ffi.mjs
var toList2 = (arr) => arr.reduceRight((xs, x) => List$NonEmpty(x, xs), empty_list);
var iterate = (list4, callback) => {
  if (Array.isArray(list4)) {
    for (let i = 0;i < list4.length; i++) {
      callback(list4[i]);
    }
  } else if (list4) {
    for (list4;List$NonEmpty$rest(list4); list4 = List$NonEmpty$rest(list4)) {
      callback(List$NonEmpty$first(list4));
    }
  }
};
var append4 = (a2, b) => {
  if (!List$NonEmpty$rest(a2)) {
    return b;
  } else if (!List$NonEmpty$rest(b)) {
    return a2;
  } else {
    return append(a2, b);
  }
};

// build/dev/javascript/lustre/lustre/internals/constants.ffi.mjs
var NAMESPACE_HTML = "http://www.w3.org/1999/xhtml";
var ELEMENT_NODE = 1;
var TEXT_NODE = 3;
var COMMENT_NODE = 8;
var SUPPORTS_MOVE_BEFORE = !!globalThis.HTMLElement?.prototype?.moveBefore;

// build/dev/javascript/lustre/lustre/vdom/reconciler.ffi.mjs
var setTimeout = globalThis.setTimeout;
var clearTimeout = globalThis.clearTimeout;
var createElementNS = (ns, name) => globalThis.document.createElementNS(ns, name);
var createTextNode = (data) => globalThis.document.createTextNode(data);
var createComment = (data) => globalThis.document.createComment(data);
var createDocumentFragment = () => globalThis.document.createDocumentFragment();
var insertBefore = (parent, node, reference) => parent.insertBefore(node, reference);
var moveBefore = SUPPORTS_MOVE_BEFORE ? (parent, node, reference) => parent.moveBefore(node, reference) : insertBefore;
var removeChild = (parent, child2) => parent.removeChild(child2);
var getAttribute = (node, name) => node.getAttribute(name);
var setAttribute = (node, name, value2) => node.setAttribute(name, value2);
var removeAttribute = (node, name) => node.removeAttribute(name);
var addEventListener = (node, name, handler, options) => node.addEventListener(name, handler, options);
var removeEventListener = (node, name, handler) => node.removeEventListener(name, handler);
var setInnerHtml = (node, innerHtml) => node.innerHTML = innerHtml;
var setData = (node, data) => node.data = data;
var meta = Symbol("lustre");

class MetadataNode {
  constructor(kind, parent, node, key) {
    this.kind = kind;
    this.key = key;
    this.parent = parent;
    this.children = [];
    this.node = node;
    this.endNode = null;
    this.handlers = new Map;
    this.throttles = new Map;
    this.debouncers = new Map;
  }
  get isVirtual() {
    return this.kind === fragment_kind || this.kind === map_kind;
  }
  get parentNode() {
    return this.isVirtual ? this.node.parentNode : this.node;
  }
}
var insertMetadataChild = (kind, parent, node, index4, key) => {
  const child2 = new MetadataNode(kind, parent, node, key);
  node[meta] = child2;
  parent?.children.splice(index4, 0, child2);
  return child2;
};
var getPath = (node) => {
  let path = "";
  for (let current = node[meta];current.parent; current = current.parent) {
    const separator = current.parent && current.parent.kind === map_kind ? separator_subtree : separator_element;
    if (current.key) {
      path = `${separator}${current.key}${path}`;
    } else {
      const index4 = current.parent.children.indexOf(current);
      path = `${separator}${index4}${path}`;
    }
  }
  return path.slice(1);
};

class Reconciler {
  #root = null;
  #decodeEvent;
  #dispatch;
  #debug = false;
  constructor(root2, decodeEvent, dispatch2, { debug = false } = {}) {
    this.#root = root2;
    this.#decodeEvent = decodeEvent;
    this.#dispatch = dispatch2;
    this.#debug = debug;
  }
  mount(vdom) {
    insertMetadataChild(element_kind, null, this.#root, 0, null);
    this.#insertChild(this.#root, null, this.#root[meta], 0, vdom);
  }
  push(patch, memos2 = null) {
    this.#memos = memos2;
    this.#stack.push({ node: this.#root[meta], patch });
    this.#reconcile();
  }
  #memos;
  #stack = [];
  #reconcile() {
    const stack = this.#stack;
    while (stack.length) {
      let { node, patch } = stack.pop();
      const { path, changes, removed, children: childPatches } = patch;
      iterate(path, (index4) => {
        node = node.children[index4];
      });
      const { children: childNodes } = node;
      iterate(changes, (change) => this.#patch(node, change));
      if (removed) {
        this.#removeChildren(node, childNodes.length - removed, removed);
      }
      iterate(childPatches, (childPatch) => {
        const child2 = childNodes[childPatch.index | 0];
        this.#stack.push({ node: child2, patch: childPatch });
      });
    }
  }
  #patch(node, change) {
    switch (change.kind) {
      case replace_text_kind:
        this.#replaceText(node, change);
        break;
      case replace_inner_html_kind:
        this.#replaceInnerHtml(node, change);
        break;
      case update_kind:
        this.#update(node, change);
        break;
      case move_kind:
        this.#move(node, change);
        break;
      case remove_kind:
        this.#remove(node, change);
        break;
      case replace_kind:
        this.#replace(node, change);
        break;
      case insert_kind:
        this.#insert(node, change);
        break;
    }
  }
  #insert(parent, { children, before }) {
    const fragment2 = createDocumentFragment();
    const beforeEl = this.#getReference(parent, before);
    this.#insertChildren(fragment2, null, parent, before | 0, children);
    insertBefore(parent.parentNode, fragment2, beforeEl);
  }
  #replace(parent, { index: index4, with: child2 }) {
    this.#removeChildren(parent, index4 | 0, 1);
    const beforeEl = this.#getReference(parent, index4);
    this.#insertChild(parent.parentNode, beforeEl, parent, index4 | 0, child2);
  }
  #getReference(node, index4) {
    index4 = index4 | 0;
    const { children } = node;
    const childCount = children.length;
    if (index4 < childCount)
      return children[index4].node;
    if (node.endNode)
      return node.endNode;
    if (!node.isVirtual)
      return null;
    while (node.isVirtual && node.children.length) {
      if (node.endNode)
        return node.endNode.nextSibling;
      node = node.children[node.children.length - 1];
    }
    return node.node.nextSibling;
  }
  #move(parent, { key, before }) {
    before = before | 0;
    const { children, parentNode } = parent;
    const beforeEl = children[before].node;
    let prev = children[before];
    for (let i = before + 1;i < children.length; ++i) {
      const next = children[i];
      children[i] = prev;
      prev = next;
      if (next.key === key) {
        children[before] = next;
        break;
      }
    }
    this.#moveChild(parentNode, prev, beforeEl);
  }
  #moveChildren(domParent, children, beforeEl) {
    for (let i = 0;i < children.length; ++i) {
      this.#moveChild(domParent, children[i], beforeEl);
    }
  }
  #moveChild(domParent, child2, beforeEl) {
    moveBefore(domParent, child2.node, beforeEl);
    if (child2.isVirtual) {
      this.#moveChildren(domParent, child2.children, beforeEl);
    }
    if (child2.endNode) {
      moveBefore(domParent, child2.endNode, beforeEl);
    }
  }
  #remove(parent, { index: index4 }) {
    this.#removeChildren(parent, index4, 1);
  }
  #removeChildren(parent, index4, count) {
    const { children, parentNode } = parent;
    const deleted = children.splice(index4, count);
    for (let i = 0;i < deleted.length; ++i) {
      const child2 = deleted[i];
      const { node, endNode, isVirtual, children: nestedChildren } = child2;
      removeChild(parentNode, node);
      if (endNode) {
        removeChild(parentNode, endNode);
      }
      this.#removeDebouncers(child2);
      if (isVirtual) {
        deleted.push(...nestedChildren);
      }
    }
  }
  #removeDebouncers(node) {
    const { debouncers, children } = node;
    for (const { timeout } of debouncers.values()) {
      if (timeout) {
        clearTimeout(timeout);
      }
    }
    debouncers.clear();
    iterate(children, (child2) => this.#removeDebouncers(child2));
  }
  #update({ node, handlers, throttles, debouncers }, { added, removed }) {
    iterate(removed, ({ name }) => {
      if (handlers.delete(name)) {
        removeEventListener(node, name, handleEvent);
        this.#updateDebounceThrottle(throttles, name, 0);
        this.#updateDebounceThrottle(debouncers, name, 0);
      } else {
        removeAttribute(node, name);
        SYNCED_ATTRIBUTES[name]?.removed?.(node, name);
      }
    });
    iterate(added, (attribute3) => this.#createAttribute(node, attribute3));
  }
  #replaceText({ node }, { content }) {
    setData(node, content ?? "");
  }
  #replaceInnerHtml({ node }, { inner_html }) {
    setInnerHtml(node, inner_html ?? "");
  }
  #insertChildren(domParent, beforeEl, metaParent, index4, children) {
    iterate(children, (child2) => this.#insertChild(domParent, beforeEl, metaParent, index4++, child2));
  }
  #insertChild(domParent, beforeEl, metaParent, index4, vnode) {
    switch (vnode.kind) {
      case element_kind: {
        const node = this.#createElement(metaParent, index4, vnode);
        this.#insertChildren(node, null, node[meta], 0, vnode.children);
        insertBefore(domParent, node, beforeEl);
        break;
      }
      case text_kind: {
        const node = this.#createTextNode(metaParent, index4, vnode);
        insertBefore(domParent, node, beforeEl);
        break;
      }
      case fragment_kind: {
        const marker = "lustre:fragment";
        const head = this.#createHead(marker, metaParent, index4, vnode);
        insertBefore(domParent, head, beforeEl);
        this.#insertChildren(domParent, beforeEl, head[meta], 0, vnode.children);
        if (this.#debug) {
          head[meta].endNode = createComment(` /${marker} `);
          insertBefore(domParent, head[meta].endNode, beforeEl);
        }
        break;
      }
      case unsafe_inner_html_kind: {
        const node = this.#createElement(metaParent, index4, vnode);
        this.#replaceInnerHtml({ node }, vnode);
        insertBefore(domParent, node, beforeEl);
        break;
      }
      case map_kind: {
        const head = this.#createHead("lustre:map", metaParent, index4, vnode);
        insertBefore(domParent, head, beforeEl);
        this.#insertChild(domParent, beforeEl, head[meta], 0, vnode.child);
        break;
      }
      case memo_kind: {
        const child2 = this.#memos?.get(vnode.view) ?? vnode.view();
        this.#insertChild(domParent, beforeEl, metaParent, index4, child2);
        break;
      }
    }
  }
  #createElement(parent, index4, { kind, key, tag, namespace, attributes }) {
    const node = createElementNS(namespace || NAMESPACE_HTML, tag);
    insertMetadataChild(kind, parent, node, index4, key);
    if (this.#debug && key) {
      setAttribute(node, "data-lustre-key", key);
    }
    iterate(attributes, (attribute3) => this.#createAttribute(node, attribute3));
    return node;
  }
  #createTextNode(parent, index4, { kind, key, content }) {
    const node = createTextNode(content ?? "");
    insertMetadataChild(kind, parent, node, index4, key);
    return node;
  }
  #createHead(marker, parent, index4, { kind, key }) {
    const node = this.#debug ? createComment(markerComment(marker, key)) : createTextNode("");
    insertMetadataChild(kind, parent, node, index4, key);
    return node;
  }
  #createAttribute(node, attribute3) {
    const { debouncers, handlers, throttles } = node[meta];
    const {
      kind,
      name,
      value: value2,
      prevent_default: prevent,
      debounce: debounceDelay,
      throttle: throttleDelay
    } = attribute3;
    switch (kind) {
      case attribute_kind: {
        const valueOrDefault = value2 ?? "";
        if (name === "virtual:defaultValue") {
          node.defaultValue = valueOrDefault;
          return;
        } else if (name === "virtual:defaultChecked") {
          node.defaultChecked = true;
          return;
        } else if (name === "virtual:defaultSelected") {
          node.defaultSelected = true;
          return;
        }
        if (valueOrDefault !== getAttribute(node, name)) {
          setAttribute(node, name, valueOrDefault);
        }
        SYNCED_ATTRIBUTES[name]?.added?.(node, valueOrDefault);
        break;
      }
      case property_kind:
        node[name] = value2;
        break;
      case event_kind: {
        if (handlers.has(name)) {
          removeEventListener(node, name, handleEvent);
        }
        const passive = prevent.kind === never_kind;
        addEventListener(node, name, handleEvent, { passive });
        this.#updateDebounceThrottle(throttles, name, throttleDelay);
        this.#updateDebounceThrottle(debouncers, name, debounceDelay);
        handlers.set(name, (event3) => this.#handleEvent(attribute3, event3));
        break;
      }
    }
  }
  #updateDebounceThrottle(map9, name, delay) {
    const debounceOrThrottle = map9.get(name);
    if (delay > 0) {
      if (debounceOrThrottle) {
        debounceOrThrottle.delay = delay;
      } else {
        map9.set(name, { delay });
      }
    } else if (debounceOrThrottle) {
      const { timeout } = debounceOrThrottle;
      if (timeout) {
        clearTimeout(timeout);
      }
      map9.delete(name);
    }
  }
  #handleEvent(attribute3, event3) {
    const { currentTarget, type } = event3;
    const { debouncers, throttles } = currentTarget[meta];
    const path = getPath(currentTarget);
    const {
      prevent_default: prevent,
      stop_propagation: stop,
      include
    } = attribute3;
    if (prevent.kind === always_kind)
      event3.preventDefault();
    if (stop.kind === always_kind)
      event3.stopPropagation();
    if (type === "submit") {
      event3.detail ??= {};
      event3.detail.formData = [
        ...new FormData(event3.target, event3.submitter).entries()
      ];
    }
    const data = this.#decodeEvent(event3, path, type, include);
    const throttle = throttles.get(type);
    if (throttle) {
      const now = Date.now();
      const last2 = throttle.last || 0;
      if (now > last2 + throttle.delay) {
        throttle.last = now;
        throttle.lastEvent = event3;
        this.#dispatch(event3, data);
      }
    }
    const debounce = debouncers.get(type);
    if (debounce) {
      clearTimeout(debounce.timeout);
      debounce.timeout = setTimeout(() => {
        if (event3 === throttles.get(type)?.lastEvent)
          return;
        this.#dispatch(event3, data);
      }, debounce.delay);
    }
    if (!throttle && !debounce) {
      this.#dispatch(event3, data);
    }
  }
}
var markerComment = (marker, key) => {
  if (key) {
    return ` ${marker} key="${escape(key)}" `;
  } else {
    return ` ${marker} `;
  }
};
var handleEvent = (event3) => {
  const { currentTarget, type } = event3;
  const handler = currentTarget[meta].handlers.get(type);
  handler(event3);
};
var syncedBooleanAttribute = (name) => {
  return {
    added(node) {
      node[name] = true;
    },
    removed(node) {
      node[name] = false;
    }
  };
};
var syncedAttribute = (name) => {
  return {
    added(node, value2) {
      node[name] = value2;
    }
  };
};
var SYNCED_ATTRIBUTES = {
  checked: syncedBooleanAttribute("checked"),
  selected: syncedBooleanAttribute("selected"),
  value: syncedAttribute("value"),
  autofocus: {
    added(node) {
      queueMicrotask(() => {
        node.focus?.();
      });
    }
  },
  autoplay: {
    added(node) {
      try {
        node.play?.();
      } catch (e) {
        console.error(e);
      }
    }
  }
};

// build/dev/javascript/lustre/lustre/element/keyed.mjs
function do_extract_keyed_children(loop$key_children_pairs, loop$keyed_children, loop$children) {
  while (true) {
    let key_children_pairs = loop$key_children_pairs;
    let keyed_children = loop$keyed_children;
    let children = loop$children;
    if (key_children_pairs instanceof Empty) {
      return [keyed_children, reverse2(children)];
    } else {
      let rest = key_children_pairs.tail;
      let key = key_children_pairs.head[0];
      let element$1 = key_children_pairs.head[1];
      let keyed_element = to_keyed(key, element$1);
      let _block;
      if (key === "") {
        _block = keyed_children;
      } else {
        _block = insert2(keyed_children, key, keyed_element);
      }
      let keyed_children$1 = _block;
      let children$1 = prepend(keyed_element, children);
      loop$key_children_pairs = rest;
      loop$keyed_children = keyed_children$1;
      loop$children = children$1;
    }
  }
}
function extract_keyed_children(children) {
  return do_extract_keyed_children(children, empty4(), empty_list);
}
function element3(tag, attributes, children) {
  let $ = extract_keyed_children(children);
  let keyed_children = $[0];
  let children$1 = $[1];
  return element("", "", tag, attributes, children$1, keyed_children, false, is_void_html_element(tag, ""));
}
function namespaced2(namespace, tag, attributes, children) {
  let $ = extract_keyed_children(children);
  let keyed_children = $[0];
  let children$1 = $[1];
  return element("", namespace, tag, attributes, children$1, keyed_children, false, is_void_html_element(tag, namespace));
}
function fragment2(children) {
  let $ = extract_keyed_children(children);
  let keyed_children = $[0];
  let children$1 = $[1];
  return fragment("", children$1, keyed_children);
}

// build/dev/javascript/lustre/lustre/vdom/virtualise.ffi.mjs
var virtualise = (root2) => {
  const rootMeta = insertMetadataChild(element_kind, null, root2, 0, null);
  const { children } = virtualiseChildren(rootMeta, root2, root2.firstChild);
  if (children.length > 1) {
    const rootNodeMeta = insertMetadataChild(element_kind, null, root2, 0, null);
    rootMeta.kind = fragment_kind;
    rootMeta.node = globalThis.document.createTextNode("");
    rootMeta.parent = rootNodeMeta;
    rootNodeMeta.children.push(rootMeta);
    root2.insertBefore(rootMeta.node, root2.firstChild);
    return fragment2(toList3(children));
  }
  if (children.length === 1) {
    return children[0][1];
  }
  const placeholder2 = globalThis.document.createTextNode("");
  insertMetadataChild(text_kind, rootMeta, placeholder2, 0, null);
  root2.insertBefore(placeholder2, root2.firstChild);
  return none2();
};
var virtualiseChild = (meta2, domParent, child2, index4) => {
  if (child2.nodeType === COMMENT_NODE) {
    const data = child2.data.trim();
    if (data.startsWith("lustre:fragment")) {
      return virtualiseFragment(meta2, domParent, child2, index4);
    }
    if (data.startsWith("lustre:map")) {
      return virtualiseMap(meta2, domParent, child2, index4);
    }
    if (data.startsWith("lustre:memo")) {
      return virtualiseMemo(meta2, domParent, child2, index4);
    }
    return null;
  }
  if (child2.nodeType === ELEMENT_NODE) {
    return virtualiseElement(meta2, child2, index4);
  }
  if (child2.nodeType === TEXT_NODE) {
    return virtualiseText(meta2, child2, index4);
  }
  return null;
};
var virtualiseElement = (metaParent, node, index4) => {
  const key = node.getAttribute("data-lustre-key") ?? "";
  if (key) {
    node.removeAttribute("data-lustre-key");
  }
  const meta2 = insertMetadataChild(element_kind, metaParent, node, index4, key);
  const tag = node.localName;
  const namespace = node.namespaceURI;
  const isHtmlElement = !namespace || namespace === NAMESPACE_HTML;
  if (isHtmlElement && INPUT_ELEMENTS.includes(tag)) {
    virtualiseInputEvents(tag, node);
  }
  const attributes = virtualiseAttributes(node);
  const { children } = virtualiseChildren(meta2, node, node.firstChild);
  const vnode = isHtmlElement ? element3(tag, attributes, toList3(children)) : namespaced2(namespace, tag, attributes, toList3(children));
  return childResult(key, vnode, node.nextSibling);
};
var virtualiseChildren = (meta2, domParent, childNode) => {
  const children = [];
  while (childNode && (childNode.nodeType !== COMMENT_NODE || childNode.data.trim() !== "/lustre:fragment")) {
    const child2 = virtualiseChild(meta2, domParent, childNode, children.length);
    if (child2) {
      children.push([child2.key, child2.vnode]);
      childNode = child2.next;
    } else {
      childNode = childNode.nextSibling;
    }
  }
  return { children, end: childNode };
};
var virtualiseText = (meta2, node, index4) => {
  insertMetadataChild(text_kind, meta2, node, index4, null);
  return childResult("", text2(node.data), node.nextSibling);
};
var virtualiseFragment = (metaParent, domParent, node, index4) => {
  const key = parseKey(node.data);
  const meta2 = insertMetadataChild(fragment_kind, metaParent, node, index4, key);
  const { children, end } = virtualiseChildren(meta2, domParent, node.nextSibling);
  meta2.endNode = end;
  const vnode = fragment2(toList3(children));
  return childResult(key, vnode, end?.nextSibling);
};
var virtualiseMap = (metaParent, domParent, node, index4) => {
  const key = parseKey(node.data);
  const meta2 = insertMetadataChild(map_kind, metaParent, node, index4, key);
  const child2 = virtualiseNextChild(meta2, domParent, node, 0);
  if (!child2)
    return null;
  const vnode = map8(child2.vnode, (x) => x);
  return childResult(key, vnode, child2.next);
};
var virtualiseMemo = (meta2, domParent, node, index4) => {
  const key = parseKey(node.data);
  const child2 = virtualiseNextChild(meta2, domParent, node, index4);
  if (!child2)
    return null;
  domParent.removeChild(node);
  const vnode = memo2(toList3([ref({})]), () => child2.vnode);
  return childResult(key, vnode, child2.next);
};
var virtualiseNextChild = (meta2, domParent, node, index4) => {
  while (true) {
    node = node.nextSibling;
    if (!node)
      return null;
    const child2 = virtualiseChild(meta2, domParent, node, index4);
    if (child2)
      return child2;
  }
};
var childResult = (key, vnode, next) => {
  return { key, vnode, next };
};
var virtualiseAttributes = (node) => {
  const attributes = [];
  for (let i = 0;i < node.attributes.length; i++) {
    const attr = node.attributes[i];
    if (attr.name !== "xmlns") {
      attributes.push(attribute2(attr.localName, attr.value));
    }
  }
  return toList3(attributes);
};
var INPUT_ELEMENTS = ["input", "select", "textarea"];
var virtualiseInputEvents = (tag, node) => {
  const value2 = node.value;
  const checked = node.checked;
  if (tag === "input" && node.type === "checkbox" && !checked)
    return;
  if (tag === "input" && node.type === "radio" && !checked)
    return;
  if (node.type !== "checkbox" && node.type !== "radio" && !value2)
    return;
  queueMicrotask(() => {
    node.value = value2;
    node.checked = checked;
    node.dispatchEvent(new Event("input", { bubbles: true }));
    node.dispatchEvent(new Event("change", { bubbles: true }));
    if (globalThis.document.activeElement !== node) {
      node.dispatchEvent(new Event("blur", { bubbles: true }));
    }
  });
};
var parseKey = (data) => {
  const keyMatch = data.match(/key="([^"]*)"/);
  if (!keyMatch)
    return "";
  return unescapeKey(keyMatch[1]);
};
var unescapeKey = (key) => {
  return key.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&#39;/g, "'");
};
var toList3 = (arr) => arr.reduceRight((xs, x) => List$NonEmpty(x, xs), empty_list);

// build/dev/javascript/lustre/lustre/runtime/client/runtime.ffi.mjs
var is_browser = () => !!globalThis.document;
class Runtime {
  constructor(root2, [model, effects], view, update2, options) {
    this.root = root2;
    this.#model = model;
    this.#view = view;
    this.#update = update2;
    this.root.addEventListener("context-request", (event3) => {
      if (!(event3.context && event3.callback))
        return;
      if (!this.#contexts.has(event3.context))
        return;
      event3.stopImmediatePropagation();
      const context = this.#contexts.get(event3.context);
      if (event3.subscribe) {
        const unsubscribe2 = () => {
          context.subscribers = context.subscribers.filter((subscriber) => subscriber !== event3.callback);
        };
        context.subscribers.push([event3.callback, unsubscribe2]);
        event3.callback(context.value, unsubscribe2);
      } else {
        event3.callback(context.value);
      }
    });
    const decodeEvent = (event3, path, name) => decode2(this.#cache, path, name, event3);
    const dispatch2 = (event3, data) => {
      const [cache, result] = dispatch(this.#cache, data);
      this.#cache = cache;
      if (Result$isOk(result)) {
        const handler = Result$Ok$0(result);
        if (handler.stop_propagation)
          event3.stopPropagation();
        if (handler.prevent_default)
          event3.preventDefault();
        this.dispatch(handler.message, false);
      }
    };
    this.#reconciler = new Reconciler(this.root, decodeEvent, dispatch2, options);
    this.#vdom = virtualise(this.root);
    this.#cache = new$6();
    this.#handleEffects(effects);
    this.#render();
  }
  root = null;
  dispatch(message, shouldFlush = false) {
    if (this.#shouldQueue) {
      this.#queue.push(message);
    } else {
      const [model, effects] = this.#update(this.#model, message);
      this.#model = model;
      this.#scheduleRender(shouldFlush);
      this.#handleEffects(effects);
    }
  }
  emit(event3, data) {
    const target = this.root.host ?? this.root;
    target.dispatchEvent(new LustreEvent(event3, data));
  }
  provide(key, value2) {
    if (!this.#contexts.has(key)) {
      this.#contexts.set(key, { value: value2, subscribers: [] });
    } else {
      const context = this.#contexts.get(key);
      if (isEqual2(context.value, value2)) {
        return;
      }
      context.value = value2;
      for (let i = context.subscribers.length - 1;i >= 0; i--) {
        const [subscriber, unsubscribe2] = context.subscribers[i];
        if (!subscriber) {
          context.subscribers.splice(i, 1);
          continue;
        }
        subscriber(value2, unsubscribe2);
      }
    }
  }
  subscribe(key, decoder) {
    if (!key)
      return;
    this.#contextSubscriptions.get(key)?.();
    const target = this.root.host ?? this.root;
    target.dispatchEvent(new ContextRequestEvent(key, (value2, unsubscribe2) => {
      const previousUnsubscribe = this.#contextSubscriptions.get(key);
      if (previousUnsubscribe !== unsubscribe2) {
        previousUnsubscribe?.();
      }
      const decoded = run(value2, decoder);
      this.#contextSubscriptions.set(key, unsubscribe2);
      if (Result$isOk(decoded)) {
        this.dispatch(Result$Ok$0(decoded), true);
      }
    }, true));
  }
  unsubscribe(key) {
    const unsubscribe2 = this.#contextSubscriptions.get(key);
    if (unsubscribe2) {
      unsubscribe2();
      this.#contextSubscriptions.delete(key);
    }
  }
  unsubscribeAll() {
    for (const [_, unsubscribe2] of this.#contextSubscriptions) {
      unsubscribe2?.();
    }
    this.#contextSubscriptions.clear();
  }
  #model;
  #view;
  #update;
  #vdom;
  #cache;
  #reconciler;
  #contexts = new Map;
  #contextSubscriptions = new Map;
  #shouldQueue = false;
  #queue = [];
  #beforePaint = empty_list;
  #afterPaint = empty_list;
  #renderTimer = null;
  #actions = {
    dispatch: (message) => this.dispatch(message),
    emit: (event3, data) => this.emit(event3, data),
    select: () => {},
    root: () => this.root,
    provide: (key, value2) => this.provide(key, value2),
    subscribe: (key, decoder) => this.subscribe(key, decoder),
    unsubscribe: (key) => this.unsubscribe(key)
  };
  #scheduleRender(shouldFlush = false) {
    if (this.#renderTimer)
      return;
    if (shouldFlush) {
      this.#renderTimer = "sync";
      queueMicrotask(() => this.#render());
    } else {
      this.#renderTimer = window.requestAnimationFrame(() => this.#render());
    }
  }
  #handleEffects(effects) {
    this.#shouldQueue = true;
    let updateCalledDuringEffects = false;
    while (true) {
      iterate(effects.synchronous, (effect) => effect(this.#actions));
      this.#beforePaint = append4(this.#beforePaint, effects.before_paint);
      this.#afterPaint = append4(this.#afterPaint, effects.after_paint);
      if (!this.#queue.length)
        break;
      const message = this.#queue.shift();
      [this.#model, effects] = this.#update(this.#model, message);
      updateCalledDuringEffects = true;
    }
    this.#shouldQueue = false;
    return updateCalledDuringEffects;
  }
  #handleAsyncEffects(effects) {
    if (this.#handleEffects(effects)) {
      this.#scheduleRender(true);
    }
  }
  #render() {
    this.#renderTimer = null;
    const next = this.#view(this.#model);
    const { patch, cache } = diff(this.#cache, this.#vdom, next);
    this.#cache = cache;
    this.#vdom = next;
    this.#reconciler.push(patch, memos(cache));
    if (List$isNonEmpty(this.#beforePaint)) {
      const effects = makeEffect(this.#beforePaint);
      this.#beforePaint = empty_list;
      queueMicrotask(() => this.#handleAsyncEffects(effects));
    }
    if (List$isNonEmpty(this.#afterPaint)) {
      const effects = makeEffect(this.#afterPaint);
      this.#afterPaint = empty_list;
      window.requestAnimationFrame(() => this.#handleAsyncEffects(effects));
    }
  }
}
function makeEffect(synchronous) {
  return {
    synchronous,
    after_paint: empty_list,
    before_paint: empty_list
  };
}
var copiedStyleSheets = new WeakMap;
class ContextRequestEvent extends Event {
  constructor(context, callback, subscribe2) {
    super("context-request", { bubbles: true, composed: true });
    this.context = context;
    this.callback = callback;
    this.subscribe = subscribe2;
  }
}

class LustreEvent extends CustomEvent {
  isLustreEvent = true;
  constructor(name, detail) {
    super(name, { detail, bubbles: true, composed: true });
  }
}

// build/dev/javascript/lustre/lustre/runtime/client/spa.ffi.mjs
class Spa {
  #runtime;
  constructor(root2, [init, effects], update2, view) {
    this.#runtime = new Runtime(root2, [init, effects], view, update2);
  }
  send(message) {
    if (Message$isEffectDispatchedMessage(message)) {
      this.dispatch(message.message, false);
    } else if (Message$isEffectEmitEvent(message)) {
      this.emit(message.name, message.data);
    } else if (Message$isSystemRequestedShutdown(message)) {}
  }
  dispatch(message) {
    this.#runtime.dispatch(message);
  }
  emit(event3, data) {
    this.#runtime.emit(event3, data);
  }
}
var start = ({ init, update: update2, view }, selector, flags) => {
  if (!is_browser())
    return Result$Error(Error$NotABrowser());
  const root2 = selector instanceof HTMLElement ? selector : globalThis.document.querySelector(selector);
  if (!root2)
    return Result$Error(Error$ElementNotFound(selector));
  return Result$Ok(new Spa(root2, init(flags), update2, view));
};

// build/dev/javascript/lustre/lustre/runtime/server/runtime.ffi.mjs
class Runtime2 {
  #model;
  #update;
  #view;
  #config;
  #vdom;
  #cache;
  #providers = make();
  #callbacks = /* @__PURE__ */ new Set;
  constructor(_, init, update2, view, config, start_arguments) {
    const [model, effects] = init(start_arguments);
    this.#model = model;
    this.#update = update2;
    this.#view = view;
    this.#config = config;
    this.#vdom = this.#view(this.#model);
    this.#cache = from_node(this.#vdom);
    this.#handle_effect(effects);
  }
  send(message) {
    if (Message$isClientDispatchedMessage(message)) {
      const { message: message2 } = message2;
      const next = this.#handle_client_message(message2);
      const diff2 = diff(this.#cache, this.#vdom, next);
      this.#vdom = next;
      this.#cache = diff2.cache;
      this.broadcast(reconcile(diff2.patch, memos(diff2.cache)));
    } else if (Message$isClientRegisteredCallback(message)) {
      const { callback } = message;
      this.#callbacks.add(callback);
      callback(mount(this.#config.open_shadow_root, this.#config.adopt_styles, keys(this.#config.attributes), keys(this.#config.properties), keys(this.#config.contexts), this.#providers, this.#vdom, memos(this.#cache)));
      if (Option$isSome(this.#config.on_connect)) {
        this.#dispatch(Option$Some$0(this.#config.on_connect));
      }
    } else if (Message$isClientDeregisteredCallback(message)) {
      const { callback } = message;
      this.#callbacks.delete(callback);
      if (Option$isSome(this.#config.on_disconnect)) {
        this.#dispatch(Option$Some$0(this.#config.on_disconnect));
      }
    } else if (Message$isEffectDispatchedMessage(message)) {
      const { message: message2 } = message2;
      const [model, effect] = this.#update(this.#model, message2);
      const next = this.#view(model);
      const diff2 = diff(this.#cache, this.#vdom, next);
      this.#handle_effect(effect);
      this.#model = model;
      this.#vdom = next;
      this.#cache = diff2.cache;
      this.broadcast(reconcile(diff2.patch, memos(diff2.cache)));
    } else if (Message$isEffectEmitEvent(message)) {
      const { name, data } = message;
      this.broadcast(emit(name, data));
    } else if (Message$isEffectProvidedValue(message)) {
      const { key, value: value2 } = message;
      const existing = get(this.#providers, key);
      if (Result$isOk(existing) && isEqual2(Result$Ok$0(existing), value2)) {
        return;
      }
      this.#providers = insert(this.#providers, key, value2);
      this.broadcast(provide(key, value2));
    } else if (Message$isEffectRequestedContextSubscription(message)) {
      const { key, decoder } = message;
      this.broadcast(subscribe(key));
      this.#config.contexts = insert(this.#config.contexts, key, decoder);
    } else if (Message$isEffectRemovedContextSubscription(message)) {
      const { key } = message;
      this.broadcast(unsubscribe(key));
      this.#config.contexts = delete$(this.#config.contexts, key);
    } else if (Message$isSystemRequestedShutdown(message)) {
      this.#model = null;
      this.#update = null;
      this.#view = null;
      this.#config = null;
      this.#vdom = null;
      this.#cache = null;
      this.#providers = null;
      this.#callbacks.clear();
    }
  }
  broadcast(message) {
    for (const callback of this.#callbacks) {
      callback(message);
    }
  }
  #handle_client_message(message) {
    if (ServerMessage$isBatch(message)) {
      const { messages } = message;
      let model = this.#model;
      let effect = none();
      for (let list4 = messages;List$NonEmpty$rest(list4); list4 = List$NonEmpty$rest(list4)) {
        const result = this.#handle_client_message(List$NonEmpty$first(list4));
        if (Result$isOk(result)) {
          model = Result$Ok$0(result)[0];
          effect = batch(toList2([effect, Result$Ok$0(result)[1]]));
          break;
        }
      }
      this.#handle_effect(effect);
      this.#model = model;
      return this.#view(model);
    } else if (ServerMessage$isAttributeChanged(message)) {
      const { name, value: value2 } = message;
      const result = this.#handle_attribute_change(name, value2);
      if (!Result$isOk(result)) {
        return this.#vdom;
      }
      return this.#dispatch(Result$Ok$0(result));
    } else if (ServerMessage$isPropertyChanged(message)) {
      const { name, value: value2 } = message;
      const result = this.#handle_properties_change(name, value2);
      if (!Result$isOk(result)) {
        return this.#vdom;
      }
      return this.#dispatch(Result$Ok$0(result));
    } else if (ServerMessage$isEventFired(message)) {
      const { path, name, event: event3 } = message2;
      const [cache, result] = handle(this.#cache, path, name, event3);
      this.#cache = cache;
      if (!Result$isOk(result)) {
        return this.#vdom;
      }
      const { message: message2 } = Result$Ok$0(result);
      return this.#dispatch(message2);
    } else if (ServerMessage$isContextProvided(message)) {
      const { key, value: value2 } = message;
      let result = get(this.#config.contexts, key);
      if (!Result$isOk(result)) {
        return this.#vdom;
      }
      result = run(value2, Result$Ok$0(result));
      if (!Result$isOk(result)) {
        return this.#vdom;
      }
      return this.#dispatch(Result$Ok$0(result));
    }
  }
  #dispatch(message) {
    const [model, effects] = this.#update(this.#model, message);
    this.#handle_effect(effects);
    this.#model = model;
    return this.#view(this.#model);
  }
  #handle_attribute_change(name, value2) {
    const result = get(this.#config.attributes, name);
    if (!Result$isOk(result)) {
      return result;
    }
    return Result$Ok$0(result)(value2);
  }
  #handle_properties_change(name, value2) {
    const result = get(this.#config.properties, name);
    if (!Result$isOk(result)) {
      return result;
    }
    return Result$Ok$0(result)(value2);
  }
  #handle_effect(effect) {
    const dispatch2 = (message) => this.send(Message$EffectDispatchedMessage(message));
    const emit2 = (name, data) => this.send(Message$EffectEmitEvent(name, data));
    const select = () => {
      return;
    };
    const internals = () => {
      return;
    };
    const provide2 = (key, value2) => this.send(Message$EffectProvidedValue(key, value2));
    const subscribe2 = (key, decoder) => this.send(Message$EffectRequestedContextSubscription(key, decoder));
    const unsubscribe2 = (key) => this.send(Message$EffectRemovedContextSubscription(key));
    globalThis.queueMicrotask(() => {
      perform(effect, dispatch2, emit2, select, internals, provide2, subscribe2, unsubscribe2);
    });
  }
}

// build/dev/javascript/lustre/lustre.mjs
class ElementNotFound extends CustomType {
  constructor(selector) {
    super();
    this.selector = selector;
  }
}
var Error$ElementNotFound = (selector) => new ElementNotFound(selector);
class NotABrowser extends CustomType {
}
var Error$NotABrowser$const = new NotABrowser;
var Error$NotABrowser = () => Error$NotABrowser$const;
function application(init, update2, view) {
  return new App(Option$None$const, init, update2, view, default_config);
}
function start4(app, selector, arguments$) {
  return guard(!is_browser(), new Error(Error$NotABrowser$const), () => {
    return start(app, selector, arguments$);
  });
}

// build/dev/javascript/lustre/lustre/event.mjs
function on(name, handler) {
  return event(name, map3(handler, (message) => {
    return new Handler(false, false, message);
  }), empty_list, never, never, 0, 0);
}
function debounce(event4, delay) {
  if (event4 instanceof Event2) {
    return new Event2(event4.kind, event4.name, event4.handler, event4.include, event4.prevent_default, event4.stop_propagation, max(0, delay), event4.throttle);
  } else {
    return event4;
  }
}
function on_click(message) {
  return on("click", success(message));
}
function on_input(message) {
  return on("input", subfield(prepend("target", prepend("value", List$Empty$const)), string2, (value2) => {
    return success(message(value2));
  }));
}
// build/dev/javascript/modem/modem.ffi.mjs
var initial_location = globalThis?.window?.location?.href;
var do_initial_uri = () => {
  if (!initial_location) {
    return new Error(undefined);
  } else {
    return new Ok(uri_from_url(new URL(initial_location)));
  }
};
var do_push = (uri) => {
  window.history.pushState({}, "", to_string2(uri));
  window.requestAnimationFrame(() => {
    if (uri.fragment[0]) {
      document.getElementById(uri.fragment[0])?.scrollIntoView();
    }
  });
  window.dispatchEvent(new CustomEvent("modem-push", { detail: uri }));
};
var uri_from_url = (url) => {
  return new Uri(url.protocol ? new Some(url.protocol.slice(0, -1)) : new None, new None, url.hostname ? new Some(url.hostname) : new None, url.port ? new Some(Number(url.port)) : new None, url.pathname, url.search ? new Some(url.search.slice(1)) : new None, url.hash ? new Some(url.hash.slice(1)) : new None);
};

// build/dev/javascript/modem/modem.mjs
var relative = /* @__PURE__ */ new Uri(Option$None$const, Option$None$const, Option$None$const, Option$None$const, "", Option$None$const, Option$None$const);
function non_empty(string5) {
  if (string5 === "") {
    return Option$None$const;
  } else {
    return new Some(string5);
  }
}
function push(path, query, fragment3) {
  return from2((_) => {
    return guard(!is_browser(), undefined, () => {
      return do_push(new Uri(relative.scheme, relative.userinfo, relative.host, relative.port, path, then$(query, non_empty), then$(fragment3, non_empty)));
    });
  });
}
// build/dev/javascript/gleam_javascript/gleam_javascript_ffi.mjs
class PromiseLayer {
  constructor(promise) {
    this.promise = promise;
  }
  static wrap(value2) {
    return value2 instanceof Promise ? new PromiseLayer(value2) : value2;
  }
  static unwrap(value2) {
    return value2 instanceof PromiseLayer ? value2.promise : value2;
  }
}
function resolve(value2) {
  return Promise.resolve(PromiseLayer.wrap(value2));
}
function then_await(promise, fn) {
  return promise.then((value2) => fn(PromiseLayer.unwrap(value2)));
}
function map_promise(promise, fn) {
  return promise.then((value2) => PromiseLayer.wrap(fn(PromiseLayer.unwrap(value2))));
}
function rescue(promise, fn) {
  return promise.catch((error) => fn(error));
}

// build/dev/javascript/gleam_javascript/gleam/javascript/promise.mjs
function tap(promise, callback) {
  let _pipe = promise;
  return map_promise(_pipe, (a2) => {
    callback(a2);
    return a2;
  });
}
function try_await(promise, callback) {
  let _pipe = promise;
  return then_await(_pipe, (result) => {
    if (result instanceof Ok) {
      let a2 = result[0];
      return callback(a2);
    } else {
      let e = result[0];
      return resolve(new Error(e));
    }
  });
}
// build/dev/javascript/gleam_fetch/gleam_fetch_ffi.mjs
async function raw_send(request) {
  try {
    return Result$Ok(await fetch(request));
  } catch (error) {
    return Result$Error(FetchError$NetworkError(error.toString()));
  }
}
function from_fetch_response(response) {
  let headers = [...response.headers].reverse();
  return Response$Response(response.status, arrayToList2(headers), response);
}
function request_common(request) {
  let url = to_string2(to_uri(request));
  let method = method_to_string(request.method).toUpperCase();
  let options = {
    headers: make_headers(request.headers),
    method
  };
  return [url, options];
}
function to_fetch_request(request) {
  let [url, options] = request_common(request);
  if (options.method !== "GET" && options.method !== "HEAD")
    options.body = request.body;
  return new globalThis.Request(url, options);
}
function bitarray_request_to_fetch_request(request) {
  let [url, options] = request_common(request);
  if (options.method !== "GET" && options.method !== "HEAD")
    options.body = request.body.rawBuffer;
  return new globalThis.Request(url, options);
}
function make_headers(headersList) {
  let headers = new globalThis.Headers;
  for (let [k, v] of headersList)
    headers.append(k.toLowerCase(), v);
  return headers;
}
async function read_bytes_body(response) {
  let body;
  try {
    body = await response.body.arrayBuffer();
  } catch (error) {
    return Result$Error(FetchError$UnableToReadBody());
  }
  body = BitArray$BitArray(new Uint8Array(body));
  return Result$Ok(map6(response, () => body));
}
async function read_text_body(response) {
  let body;
  try {
    body = await response.body.text();
  } catch (error) {
    return Result$Error(FetchError$UnableToReadBody());
  }
  return Result$Ok(map6(response, () => body));
}
function arrayToList2(array3) {
  let list4 = List$Empty();
  for (const element4 of array3) {
    list4 = List$NonEmpty(element4, list4);
  }
  return list4;
}

// build/dev/javascript/gleam_fetch/gleam/fetch.mjs
class NetworkError extends CustomType {
  constructor($0) {
    super();
    this[0] = $0;
  }
}
var FetchError$NetworkError = ($0) => new NetworkError($0);
class UnableToReadBody extends CustomType {
}
var FetchError$UnableToReadBody$const = new UnableToReadBody;
var FetchError$UnableToReadBody = () => FetchError$UnableToReadBody$const;
class InvalidJsonBody extends CustomType {
}
var FetchError$InvalidJsonBody$const = new InvalidJsonBody;
function send2(request) {
  let _pipe = request;
  let _pipe$1 = to_fetch_request(_pipe);
  let _pipe$2 = raw_send(_pipe$1);
  return try_await(_pipe$2, (resp) => {
    return resolve(new Ok(from_fetch_response(resp)));
  });
}
function send_bits(request) {
  let _pipe = request;
  let _pipe$1 = bitarray_request_to_fetch_request(_pipe);
  let _pipe$2 = raw_send(_pipe$1);
  return try_await(_pipe$2, (resp) => {
    return resolve(new Ok(from_fetch_response(resp)));
  });
}
// build/dev/javascript/rsvp/rsvp.mjs
class BadBody extends CustomType {
}
var Error$BadBody$const = new BadBody;
class HttpError extends CustomType {
  constructor($0) {
    super();
    this[0] = $0;
  }
}
class NetworkError2 extends CustomType {
}
var Error$NetworkError$const = new NetworkError2;
class UnhandledResponse extends CustomType {
  constructor($0) {
    super();
    this[0] = $0;
  }
}
class Handler2 extends CustomType {
  constructor(run2) {
    super();
    this.run = run2;
  }
}
function expect_ok_response(handler) {
  return new Handler2((result) => {
    return handler(try$(result, (response) => {
      let $ = response.status;
      let code2 = $;
      if (code2 >= 200 && code2 < 300) {
        return new Ok(response);
      } else {
        let code$1 = $;
        if (code$1 >= 400 && code$1 < 600) {
          return new Error(new HttpError(response));
        } else {
          return new Error(new UnhandledResponse(response));
        }
      }
    }));
  });
}
function do_send(request, handler) {
  return from2((dispatch2) => {
    let _pipe = send2(request);
    let _pipe$1 = try_await(_pipe, read_text_body);
    let _pipe$2 = map_promise(_pipe$1, (_capture) => {
      return map_error(_capture, (error) => {
        if (error instanceof NetworkError) {
          return Error$NetworkError$const;
        } else if (error instanceof UnableToReadBody) {
          return Error$BadBody$const;
        } else {
          return Error$BadBody$const;
        }
      });
    });
    let _pipe$3 = rescue(_pipe$2, (_) => {
      return new Error(Error$NetworkError$const);
    });
    let _pipe$4 = map_promise(_pipe$3, handler.run);
    tap(_pipe$4, dispatch2);
    return;
  });
}
function send3(request, handler) {
  return do_send(request, handler);
}
function do_send_bits(request, handler) {
  return from2((dispatch2) => {
    let _pipe = send_bits(request);
    let _pipe$1 = try_await(_pipe, read_bytes_body);
    let _pipe$2 = map_promise(_pipe$1, (_capture) => {
      return map_error(_capture, (error) => {
        if (error instanceof NetworkError) {
          return Error$NetworkError$const;
        } else if (error instanceof UnableToReadBody) {
          return Error$BadBody$const;
        } else {
          return Error$BadBody$const;
        }
      });
    });
    let _pipe$3 = rescue(_pipe$2, (_) => {
      return new Error(Error$NetworkError$const);
    });
    let _pipe$4 = map_promise(_pipe$3, handler.run);
    tap(_pipe$4, dispatch2);
    return;
  });
}
function send_bits2(request, handler) {
  return do_send_bits(request, handler);
}
// build/dev/javascript/glexer/glexer.ffi.mjs
function slice_bytes(string5, start5, size3) {
  return string5.slice(start5, start5 + size3);
}
function drop_byte(string5) {
  return string5.slice(1);
}
function string_length2(string5) {
  return string5.length;
}

// build/dev/javascript/glexer/glexer/token.mjs
class Name extends CustomType {
  constructor($0) {
    super();
    this[0] = $0;
  }
}
class UpperName extends CustomType {
  constructor($0) {
    super();
    this[0] = $0;
  }
}
class DiscardName extends CustomType {
  constructor($0) {
    super();
    this[0] = $0;
  }
}
class Int extends CustomType {
  constructor($0) {
    super();
    this[0] = $0;
  }
}
class Float extends CustomType {
  constructor($0) {
    super();
    this[0] = $0;
  }
}
class String2 extends CustomType {
  constructor($0) {
    super();
    this[0] = $0;
  }
}
class CommentDoc extends CustomType {
  constructor($0) {
    super();
    this[0] = $0;
  }
}
class CommentNormal extends CustomType {
  constructor($0) {
    super();
    this[0] = $0;
  }
}
class CommentModule extends CustomType {
  constructor($0) {
    super();
    this[0] = $0;
  }
}
class As extends CustomType {
}
var Token$As$const = new As;
class Assert extends CustomType {
}
var Token$Assert$const = new Assert;
class Auto extends CustomType {
}
var Token$Auto$const = new Auto;
class Case extends CustomType {
}
var Token$Case$const = new Case;
class Const extends CustomType {
}
var Token$Const$const = new Const;
class Delegate extends CustomType {
}
var Token$Delegate$const = new Delegate;
class Derive extends CustomType {
}
var Token$Derive$const = new Derive;
class Echo extends CustomType {
}
var Token$Echo$const = new Echo;
class Else extends CustomType {
}
var Token$Else$const = new Else;
class Fn extends CustomType {
}
var Token$Fn$const = new Fn;
class If extends CustomType {
}
var Token$If$const = new If;
class Implement extends CustomType {
}
var Token$Implement$const = new Implement;
class Import extends CustomType {
}
var Token$Import$const = new Import;
class Let extends CustomType {
}
var Token$Let$const = new Let;
class Macro extends CustomType {
}
var Token$Macro$const = new Macro;
class Opaque extends CustomType {
}
var Token$Opaque$const = new Opaque;
class Panic extends CustomType {
}
var Token$Panic$const = new Panic;
class Pub extends CustomType {
}
var Token$Pub$const = new Pub;
class Test extends CustomType {
}
var Token$Test$const = new Test;
class Todo extends CustomType {
}
var Token$Todo$const = new Todo;
class Type extends CustomType {
}
var Token$Type$const = new Type;
class Use extends CustomType {
}
var Token$Use$const = new Use;
class LeftParen extends CustomType {
}
var Token$LeftParen$const = new LeftParen;
class RightParen extends CustomType {
}
var Token$RightParen$const = new RightParen;
class LeftBrace extends CustomType {
}
var Token$LeftBrace$const = new LeftBrace;
class RightBrace extends CustomType {
}
var Token$RightBrace$const = new RightBrace;
class LeftSquare extends CustomType {
}
var Token$LeftSquare$const = new LeftSquare;
class RightSquare extends CustomType {
}
var Token$RightSquare$const = new RightSquare;
class Plus extends CustomType {
}
var Token$Plus$const = new Plus;
class Minus extends CustomType {
}
var Token$Minus$const = new Minus;
class Star extends CustomType {
}
var Token$Star$const = new Star;
class Slash extends CustomType {
}
var Token$Slash$const = new Slash;
class Less extends CustomType {
}
var Token$Less$const = new Less;
class Greater extends CustomType {
}
var Token$Greater$const = new Greater;
class LessEqual extends CustomType {
}
var Token$LessEqual$const = new LessEqual;
class GreaterEqual extends CustomType {
}
var Token$GreaterEqual$const = new GreaterEqual;
class Percent extends CustomType {
}
var Token$Percent$const = new Percent;
class PlusDot extends CustomType {
}
var Token$PlusDot$const = new PlusDot;
class MinusDot extends CustomType {
}
var Token$MinusDot$const = new MinusDot;
class StarDot extends CustomType {
}
var Token$StarDot$const = new StarDot;
class SlashDot extends CustomType {
}
var Token$SlashDot$const = new SlashDot;
class LessDot extends CustomType {
}
var Token$LessDot$const = new LessDot;
class GreaterDot extends CustomType {
}
var Token$GreaterDot$const = new GreaterDot;
class LessEqualDot extends CustomType {
}
var Token$LessEqualDot$const = new LessEqualDot;
class GreaterEqualDot extends CustomType {
}
var Token$GreaterEqualDot$const = new GreaterEqualDot;
class LessGreater extends CustomType {
}
var Token$LessGreater$const = new LessGreater;
class At extends CustomType {
}
var Token$At$const = new At;
class Colon extends CustomType {
}
var Token$Colon$const = new Colon;
class Comma extends CustomType {
}
var Token$Comma$const = new Comma;
class Hash extends CustomType {
}
var Token$Hash$const = new Hash;
class Bang extends CustomType {
}
var Token$Bang$const = new Bang;
class Equal extends CustomType {
}
var Token$Equal$const = new Equal;
class EqualEqual extends CustomType {
}
var Token$EqualEqual$const = new EqualEqual;
class NotEqual extends CustomType {
}
var Token$NotEqual$const = new NotEqual;
class VBar extends CustomType {
}
var Token$VBar$const = new VBar;
class VBarVBar extends CustomType {
}
var Token$VBarVBar$const = new VBarVBar;
class AmperAmper extends CustomType {
}
var Token$AmperAmper$const = new AmperAmper;
class LessLess extends CustomType {
}
var Token$LessLess$const = new LessLess;
class GreaterGreater extends CustomType {
}
var Token$GreaterGreater$const = new GreaterGreater;
class Pipe extends CustomType {
}
var Token$Pipe$const = new Pipe;
class Dot extends CustomType {
}
var Token$Dot$const = new Dot;
class DotDot extends CustomType {
}
var Token$DotDot$const = new DotDot;
class LeftArrow extends CustomType {
}
var Token$LeftArrow$const = new LeftArrow;
class RightArrow extends CustomType {
}
var Token$RightArrow$const = new RightArrow;
class EndOfFile extends CustomType {
}
var Token$EndOfFile$const = new EndOfFile;
class Space extends CustomType {
  constructor($0) {
    super();
    this[0] = $0;
  }
}
class UnterminatedString extends CustomType {
  constructor($0) {
    super();
    this[0] = $0;
  }
}
class UnexpectedGrapheme extends CustomType {
  constructor($0) {
    super();
    this[0] = $0;
  }
}
function to_source(tok) {
  if (tok instanceof Name) {
    let str = tok[0];
    return str;
  } else if (tok instanceof UpperName) {
    let str = tok[0];
    return str;
  } else if (tok instanceof DiscardName) {
    let str = tok[0];
    return "_" + str;
  } else if (tok instanceof Int) {
    let str = tok[0];
    return str;
  } else if (tok instanceof Float) {
    let str = tok[0];
    return str;
  } else if (tok instanceof String2) {
    let str = tok[0];
    return '"' + str + '"';
  } else if (tok instanceof CommentDoc) {
    let str = tok[0];
    return "///" + str;
  } else if (tok instanceof CommentNormal) {
    let str = tok[0];
    return "//" + str;
  } else if (tok instanceof CommentModule) {
    let str = tok[0];
    return "////" + str;
  } else if (tok instanceof As) {
    return "as";
  } else if (tok instanceof Assert) {
    return "assert";
  } else if (tok instanceof Auto) {
    return "auto";
  } else if (tok instanceof Case) {
    return "case";
  } else if (tok instanceof Const) {
    return "const";
  } else if (tok instanceof Delegate) {
    return "delegate";
  } else if (tok instanceof Derive) {
    return "derive";
  } else if (tok instanceof Echo) {
    return "echo";
  } else if (tok instanceof Else) {
    return "else";
  } else if (tok instanceof Fn) {
    return "fn";
  } else if (tok instanceof If) {
    return "if";
  } else if (tok instanceof Implement) {
    return "implement";
  } else if (tok instanceof Import) {
    return "import";
  } else if (tok instanceof Let) {
    return "let";
  } else if (tok instanceof Macro) {
    return "macro";
  } else if (tok instanceof Opaque) {
    return "opaque";
  } else if (tok instanceof Panic) {
    return "panic";
  } else if (tok instanceof Pub) {
    return "pub";
  } else if (tok instanceof Test) {
    return "test";
  } else if (tok instanceof Todo) {
    return "todo";
  } else if (tok instanceof Type) {
    return "type";
  } else if (tok instanceof Use) {
    return "use";
  } else if (tok instanceof LeftParen) {
    return "(";
  } else if (tok instanceof RightParen) {
    return ")";
  } else if (tok instanceof LeftBrace) {
    return "{";
  } else if (tok instanceof RightBrace) {
    return "}";
  } else if (tok instanceof LeftSquare) {
    return "[";
  } else if (tok instanceof RightSquare) {
    return "]";
  } else if (tok instanceof Plus) {
    return "+";
  } else if (tok instanceof Minus) {
    return "-";
  } else if (tok instanceof Star) {
    return "*";
  } else if (tok instanceof Slash) {
    return "/";
  } else if (tok instanceof Less) {
    return "<";
  } else if (tok instanceof Greater) {
    return ">";
  } else if (tok instanceof LessEqual) {
    return "<=";
  } else if (tok instanceof GreaterEqual) {
    return ">=";
  } else if (tok instanceof Percent) {
    return "%";
  } else if (tok instanceof PlusDot) {
    return "+.";
  } else if (tok instanceof MinusDot) {
    return "-.";
  } else if (tok instanceof StarDot) {
    return "*.";
  } else if (tok instanceof SlashDot) {
    return "/.";
  } else if (tok instanceof LessDot) {
    return "<.";
  } else if (tok instanceof GreaterDot) {
    return ">.";
  } else if (tok instanceof LessEqualDot) {
    return "<=.";
  } else if (tok instanceof GreaterEqualDot) {
    return ">=.";
  } else if (tok instanceof LessGreater) {
    return "<>";
  } else if (tok instanceof At) {
    return "@";
  } else if (tok instanceof Colon) {
    return ":";
  } else if (tok instanceof Comma) {
    return ",";
  } else if (tok instanceof Hash) {
    return "#";
  } else if (tok instanceof Bang) {
    return "!";
  } else if (tok instanceof Equal) {
    return "=";
  } else if (tok instanceof EqualEqual) {
    return "==";
  } else if (tok instanceof NotEqual) {
    return "!=";
  } else if (tok instanceof VBar) {
    return "|";
  } else if (tok instanceof VBarVBar) {
    return "||";
  } else if (tok instanceof AmperAmper) {
    return "&&";
  } else if (tok instanceof LessLess) {
    return "<<";
  } else if (tok instanceof GreaterGreater) {
    return ">>";
  } else if (tok instanceof Pipe) {
    return "|>";
  } else if (tok instanceof Dot) {
    return ".";
  } else if (tok instanceof DotDot) {
    return "..";
  } else if (tok instanceof LeftArrow) {
    return "<-";
  } else if (tok instanceof RightArrow) {
    return "->";
  } else if (tok instanceof EndOfFile) {
    return "";
  } else if (tok instanceof Space) {
    let str = tok[0];
    return str;
  } else if (tok instanceof UnterminatedString) {
    let str = tok[0];
    return '"' + str;
  } else {
    let str = tok[0];
    return str;
  }
}

// build/dev/javascript/glexer/glexer.mjs
class Lexer extends CustomType {
  constructor(original_source, source, byte_offset, preserve_whitespace, preserve_comments, mode, newlines) {
    super();
    this.original_source = original_source;
    this.source = source;
    this.byte_offset = byte_offset;
    this.preserve_whitespace = preserve_whitespace;
    this.preserve_comments = preserve_comments;
    this.mode = mode;
    this.newlines = newlines;
  }
}

class Normal2 extends CustomType {
}
var LexerMode$Normal$const = new Normal2;

class CheckForMinus extends CustomType {
}
var LexerMode$CheckForMinus$const = new CheckForMinus;

class HasNestedDot extends CustomType {
}
var LexerMode$HasNestedDot$const = new HasNestedDot;

class Position extends CustomType {
  constructor(byte_offset) {
    super();
    this.byte_offset = byte_offset;
  }
}
class RegularComment extends CustomType {
}
var CommentKind$RegularComment$const = new RegularComment;

class DocComment extends CustomType {
}
var CommentKind$DocComment$const = new DocComment;

class ModuleComment extends CustomType {
}
var CommentKind$ModuleComment$const = new ModuleComment;

class LexInt extends CustomType {
}
var LexNumberMode$LexInt$const = new LexInt;

class LexFloat extends CustomType {
}
var LexNumberMode$LexFloat$const = new LexFloat;

class LexFloatExponent extends CustomType {
}
var LexNumberMode$LexFloatExponent$const = new LexFloatExponent;
function new$8(source) {
  return new Lexer(source, source, 0, true, true, LexerMode$Normal$const, new$(prepend(`\r
`, prepend(`
`, List$Empty$const))));
}
function discard_whitespace(lexer) {
  return new Lexer(lexer.original_source, lexer.source, lexer.byte_offset, false, lexer.preserve_comments, lexer.mode, lexer.newlines);
}
function discard_comments(lexer) {
  return new Lexer(lexer.original_source, lexer.source, lexer.byte_offset, lexer.preserve_whitespace, false, lexer.mode, lexer.newlines);
}
function some_token(result) {
  let lexer = result[0];
  let token$1 = result[1];
  return [lexer, new Some(token$1)];
}
function advance(lexer, source, offset) {
  return new Lexer(lexer.original_source, source, lexer.byte_offset + offset, lexer.preserve_whitespace, lexer.preserve_comments, lexer.mode, lexer.newlines);
}
function advanced(token2, lexer, source, offset) {
  return [advance(lexer, source, offset), token2];
}
function token2(lexer, token3, source, offset) {
  let _pipe = [token3, new Position(lexer.byte_offset)];
  let _pipe$1 = advanced(_pipe, lexer, source, offset);
  return some_token(_pipe$1);
}
function lex_uppercase_name(loop$lexer, loop$start, loop$slice_size) {
  while (true) {
    let lexer = loop$lexer;
    let start5 = loop$start;
    let slice_size = loop$slice_size;
    let $ = lexer.source;
    let $1 = $.charCodeAt(0);
    if ($1 === 97) {
      let source = $.slice(1);
      let _pipe = advance(lexer, source, 1);
      loop$lexer = _pipe;
      loop$start = start5;
      loop$slice_size = slice_size + 1;
    } else if ($1 === 98) {
      let source = $.slice(1);
      let _pipe = advance(lexer, source, 1);
      loop$lexer = _pipe;
      loop$start = start5;
      loop$slice_size = slice_size + 1;
    } else if ($1 === 99) {
      let source = $.slice(1);
      let _pipe = advance(lexer, source, 1);
      loop$lexer = _pipe;
      loop$start = start5;
      loop$slice_size = slice_size + 1;
    } else if ($1 === 100) {
      let source = $.slice(1);
      let _pipe = advance(lexer, source, 1);
      loop$lexer = _pipe;
      loop$start = start5;
      loop$slice_size = slice_size + 1;
    } else if ($1 === 101) {
      let source = $.slice(1);
      let _pipe = advance(lexer, source, 1);
      loop$lexer = _pipe;
      loop$start = start5;
      loop$slice_size = slice_size + 1;
    } else if ($1 === 102) {
      let source = $.slice(1);
      let _pipe = advance(lexer, source, 1);
      loop$lexer = _pipe;
      loop$start = start5;
      loop$slice_size = slice_size + 1;
    } else if ($1 === 103) {
      let source = $.slice(1);
      let _pipe = advance(lexer, source, 1);
      loop$lexer = _pipe;
      loop$start = start5;
      loop$slice_size = slice_size + 1;
    } else if ($1 === 104) {
      let source = $.slice(1);
      let _pipe = advance(lexer, source, 1);
      loop$lexer = _pipe;
      loop$start = start5;
      loop$slice_size = slice_size + 1;
    } else if ($1 === 105) {
      let source = $.slice(1);
      let _pipe = advance(lexer, source, 1);
      loop$lexer = _pipe;
      loop$start = start5;
      loop$slice_size = slice_size + 1;
    } else if ($1 === 106) {
      let source = $.slice(1);
      let _pipe = advance(lexer, source, 1);
      loop$lexer = _pipe;
      loop$start = start5;
      loop$slice_size = slice_size + 1;
    } else if ($1 === 107) {
      let source = $.slice(1);
      let _pipe = advance(lexer, source, 1);
      loop$lexer = _pipe;
      loop$start = start5;
      loop$slice_size = slice_size + 1;
    } else if ($1 === 108) {
      let source = $.slice(1);
      let _pipe = advance(lexer, source, 1);
      loop$lexer = _pipe;
      loop$start = start5;
      loop$slice_size = slice_size + 1;
    } else if ($1 === 109) {
      let source = $.slice(1);
      let _pipe = advance(lexer, source, 1);
      loop$lexer = _pipe;
      loop$start = start5;
      loop$slice_size = slice_size + 1;
    } else if ($1 === 110) {
      let source = $.slice(1);
      let _pipe = advance(lexer, source, 1);
      loop$lexer = _pipe;
      loop$start = start5;
      loop$slice_size = slice_size + 1;
    } else if ($1 === 111) {
      let source = $.slice(1);
      let _pipe = advance(lexer, source, 1);
      loop$lexer = _pipe;
      loop$start = start5;
      loop$slice_size = slice_size + 1;
    } else if ($1 === 112) {
      let source = $.slice(1);
      let _pipe = advance(lexer, source, 1);
      loop$lexer = _pipe;
      loop$start = start5;
      loop$slice_size = slice_size + 1;
    } else if ($1 === 113) {
      let source = $.slice(1);
      let _pipe = advance(lexer, source, 1);
      loop$lexer = _pipe;
      loop$start = start5;
      loop$slice_size = slice_size + 1;
    } else if ($1 === 114) {
      let source = $.slice(1);
      let _pipe = advance(lexer, source, 1);
      loop$lexer = _pipe;
      loop$start = start5;
      loop$slice_size = slice_size + 1;
    } else if ($1 === 115) {
      let source = $.slice(1);
      let _pipe = advance(lexer, source, 1);
      loop$lexer = _pipe;
      loop$start = start5;
      loop$slice_size = slice_size + 1;
    } else if ($1 === 116) {
      let source = $.slice(1);
      let _pipe = advance(lexer, source, 1);
      loop$lexer = _pipe;
      loop$start = start5;
      loop$slice_size = slice_size + 1;
    } else if ($1 === 117) {
      let source = $.slice(1);
      let _pipe = advance(lexer, source, 1);
      loop$lexer = _pipe;
      loop$start = start5;
      loop$slice_size = slice_size + 1;
    } else if ($1 === 118) {
      let source = $.slice(1);
      let _pipe = advance(lexer, source, 1);
      loop$lexer = _pipe;
      loop$start = start5;
      loop$slice_size = slice_size + 1;
    } else if ($1 === 119) {
      let source = $.slice(1);
      let _pipe = advance(lexer, source, 1);
      loop$lexer = _pipe;
      loop$start = start5;
      loop$slice_size = slice_size + 1;
    } else if ($1 === 120) {
      let source = $.slice(1);
      let _pipe = advance(lexer, source, 1);
      loop$lexer = _pipe;
      loop$start = start5;
      loop$slice_size = slice_size + 1;
    } else if ($1 === 121) {
      let source = $.slice(1);
      let _pipe = advance(lexer, source, 1);
      loop$lexer = _pipe;
      loop$start = start5;
      loop$slice_size = slice_size + 1;
    } else if ($1 === 122) {
      let source = $.slice(1);
      let _pipe = advance(lexer, source, 1);
      loop$lexer = _pipe;
      loop$start = start5;
      loop$slice_size = slice_size + 1;
    } else if ($1 === 65) {
      let source = $.slice(1);
      let _pipe = advance(lexer, source, 1);
      loop$lexer = _pipe;
      loop$start = start5;
      loop$slice_size = slice_size + 1;
    } else if ($1 === 66) {
      let source = $.slice(1);
      let _pipe = advance(lexer, source, 1);
      loop$lexer = _pipe;
      loop$start = start5;
      loop$slice_size = slice_size + 1;
    } else if ($1 === 67) {
      let source = $.slice(1);
      let _pipe = advance(lexer, source, 1);
      loop$lexer = _pipe;
      loop$start = start5;
      loop$slice_size = slice_size + 1;
    } else if ($1 === 68) {
      let source = $.slice(1);
      let _pipe = advance(lexer, source, 1);
      loop$lexer = _pipe;
      loop$start = start5;
      loop$slice_size = slice_size + 1;
    } else if ($1 === 69) {
      let source = $.slice(1);
      let _pipe = advance(lexer, source, 1);
      loop$lexer = _pipe;
      loop$start = start5;
      loop$slice_size = slice_size + 1;
    } else if ($1 === 70) {
      let source = $.slice(1);
      let _pipe = advance(lexer, source, 1);
      loop$lexer = _pipe;
      loop$start = start5;
      loop$slice_size = slice_size + 1;
    } else if ($1 === 71) {
      let source = $.slice(1);
      let _pipe = advance(lexer, source, 1);
      loop$lexer = _pipe;
      loop$start = start5;
      loop$slice_size = slice_size + 1;
    } else if ($1 === 72) {
      let source = $.slice(1);
      let _pipe = advance(lexer, source, 1);
      loop$lexer = _pipe;
      loop$start = start5;
      loop$slice_size = slice_size + 1;
    } else if ($1 === 73) {
      let source = $.slice(1);
      let _pipe = advance(lexer, source, 1);
      loop$lexer = _pipe;
      loop$start = start5;
      loop$slice_size = slice_size + 1;
    } else if ($1 === 74) {
      let source = $.slice(1);
      let _pipe = advance(lexer, source, 1);
      loop$lexer = _pipe;
      loop$start = start5;
      loop$slice_size = slice_size + 1;
    } else if ($1 === 75) {
      let source = $.slice(1);
      let _pipe = advance(lexer, source, 1);
      loop$lexer = _pipe;
      loop$start = start5;
      loop$slice_size = slice_size + 1;
    } else if ($1 === 76) {
      let source = $.slice(1);
      let _pipe = advance(lexer, source, 1);
      loop$lexer = _pipe;
      loop$start = start5;
      loop$slice_size = slice_size + 1;
    } else if ($1 === 77) {
      let source = $.slice(1);
      let _pipe = advance(lexer, source, 1);
      loop$lexer = _pipe;
      loop$start = start5;
      loop$slice_size = slice_size + 1;
    } else if ($1 === 78) {
      let source = $.slice(1);
      let _pipe = advance(lexer, source, 1);
      loop$lexer = _pipe;
      loop$start = start5;
      loop$slice_size = slice_size + 1;
    } else if ($1 === 79) {
      let source = $.slice(1);
      let _pipe = advance(lexer, source, 1);
      loop$lexer = _pipe;
      loop$start = start5;
      loop$slice_size = slice_size + 1;
    } else if ($1 === 80) {
      let source = $.slice(1);
      let _pipe = advance(lexer, source, 1);
      loop$lexer = _pipe;
      loop$start = start5;
      loop$slice_size = slice_size + 1;
    } else if ($1 === 81) {
      let source = $.slice(1);
      let _pipe = advance(lexer, source, 1);
      loop$lexer = _pipe;
      loop$start = start5;
      loop$slice_size = slice_size + 1;
    } else if ($1 === 82) {
      let source = $.slice(1);
      let _pipe = advance(lexer, source, 1);
      loop$lexer = _pipe;
      loop$start = start5;
      loop$slice_size = slice_size + 1;
    } else if ($1 === 83) {
      let source = $.slice(1);
      let _pipe = advance(lexer, source, 1);
      loop$lexer = _pipe;
      loop$start = start5;
      loop$slice_size = slice_size + 1;
    } else if ($1 === 84) {
      let source = $.slice(1);
      let _pipe = advance(lexer, source, 1);
      loop$lexer = _pipe;
      loop$start = start5;
      loop$slice_size = slice_size + 1;
    } else if ($1 === 85) {
      let source = $.slice(1);
      let _pipe = advance(lexer, source, 1);
      loop$lexer = _pipe;
      loop$start = start5;
      loop$slice_size = slice_size + 1;
    } else if ($1 === 86) {
      let source = $.slice(1);
      let _pipe = advance(lexer, source, 1);
      loop$lexer = _pipe;
      loop$start = start5;
      loop$slice_size = slice_size + 1;
    } else if ($1 === 87) {
      let source = $.slice(1);
      let _pipe = advance(lexer, source, 1);
      loop$lexer = _pipe;
      loop$start = start5;
      loop$slice_size = slice_size + 1;
    } else if ($1 === 88) {
      let source = $.slice(1);
      let _pipe = advance(lexer, source, 1);
      loop$lexer = _pipe;
      loop$start = start5;
      loop$slice_size = slice_size + 1;
    } else if ($1 === 89) {
      let source = $.slice(1);
      let _pipe = advance(lexer, source, 1);
      loop$lexer = _pipe;
      loop$start = start5;
      loop$slice_size = slice_size + 1;
    } else if ($1 === 90) {
      let source = $.slice(1);
      let _pipe = advance(lexer, source, 1);
      loop$lexer = _pipe;
      loop$start = start5;
      loop$slice_size = slice_size + 1;
    } else if ($1 === 48) {
      let source = $.slice(1);
      let _pipe = advance(lexer, source, 1);
      loop$lexer = _pipe;
      loop$start = start5;
      loop$slice_size = slice_size + 1;
    } else if ($1 === 49) {
      let source = $.slice(1);
      let _pipe = advance(lexer, source, 1);
      loop$lexer = _pipe;
      loop$start = start5;
      loop$slice_size = slice_size + 1;
    } else if ($1 === 50) {
      let source = $.slice(1);
      let _pipe = advance(lexer, source, 1);
      loop$lexer = _pipe;
      loop$start = start5;
      loop$slice_size = slice_size + 1;
    } else if ($1 === 51) {
      let source = $.slice(1);
      let _pipe = advance(lexer, source, 1);
      loop$lexer = _pipe;
      loop$start = start5;
      loop$slice_size = slice_size + 1;
    } else if ($1 === 52) {
      let source = $.slice(1);
      let _pipe = advance(lexer, source, 1);
      loop$lexer = _pipe;
      loop$start = start5;
      loop$slice_size = slice_size + 1;
    } else if ($1 === 53) {
      let source = $.slice(1);
      let _pipe = advance(lexer, source, 1);
      loop$lexer = _pipe;
      loop$start = start5;
      loop$slice_size = slice_size + 1;
    } else if ($1 === 54) {
      let source = $.slice(1);
      let _pipe = advance(lexer, source, 1);
      loop$lexer = _pipe;
      loop$start = start5;
      loop$slice_size = slice_size + 1;
    } else if ($1 === 55) {
      let source = $.slice(1);
      let _pipe = advance(lexer, source, 1);
      loop$lexer = _pipe;
      loop$start = start5;
      loop$slice_size = slice_size + 1;
    } else if ($1 === 56) {
      let source = $.slice(1);
      let _pipe = advance(lexer, source, 1);
      loop$lexer = _pipe;
      loop$start = start5;
      loop$slice_size = slice_size + 1;
    } else if ($1 === 57) {
      let source = $.slice(1);
      let _pipe = advance(lexer, source, 1);
      loop$lexer = _pipe;
      loop$start = start5;
      loop$slice_size = slice_size + 1;
    } else {
      let name = slice_bytes(lexer.original_source, start5, slice_size);
      return [lexer, name];
    }
  }
}
function lex_lowercase_name(loop$lexer, loop$start, loop$slice_size) {
  while (true) {
    let lexer = loop$lexer;
    let start5 = loop$start;
    let slice_size = loop$slice_size;
    let $ = lexer.source;
    let $1 = $.charCodeAt(0);
    if ($1 === 97) {
      let source = $.slice(1);
      let _pipe = advance(lexer, source, 1);
      loop$lexer = _pipe;
      loop$start = start5;
      loop$slice_size = slice_size + 1;
    } else if ($1 === 98) {
      let source = $.slice(1);
      let _pipe = advance(lexer, source, 1);
      loop$lexer = _pipe;
      loop$start = start5;
      loop$slice_size = slice_size + 1;
    } else if ($1 === 99) {
      let source = $.slice(1);
      let _pipe = advance(lexer, source, 1);
      loop$lexer = _pipe;
      loop$start = start5;
      loop$slice_size = slice_size + 1;
    } else if ($1 === 100) {
      let source = $.slice(1);
      let _pipe = advance(lexer, source, 1);
      loop$lexer = _pipe;
      loop$start = start5;
      loop$slice_size = slice_size + 1;
    } else if ($1 === 101) {
      let source = $.slice(1);
      let _pipe = advance(lexer, source, 1);
      loop$lexer = _pipe;
      loop$start = start5;
      loop$slice_size = slice_size + 1;
    } else if ($1 === 102) {
      let source = $.slice(1);
      let _pipe = advance(lexer, source, 1);
      loop$lexer = _pipe;
      loop$start = start5;
      loop$slice_size = slice_size + 1;
    } else if ($1 === 103) {
      let source = $.slice(1);
      let _pipe = advance(lexer, source, 1);
      loop$lexer = _pipe;
      loop$start = start5;
      loop$slice_size = slice_size + 1;
    } else if ($1 === 104) {
      let source = $.slice(1);
      let _pipe = advance(lexer, source, 1);
      loop$lexer = _pipe;
      loop$start = start5;
      loop$slice_size = slice_size + 1;
    } else if ($1 === 105) {
      let source = $.slice(1);
      let _pipe = advance(lexer, source, 1);
      loop$lexer = _pipe;
      loop$start = start5;
      loop$slice_size = slice_size + 1;
    } else if ($1 === 106) {
      let source = $.slice(1);
      let _pipe = advance(lexer, source, 1);
      loop$lexer = _pipe;
      loop$start = start5;
      loop$slice_size = slice_size + 1;
    } else if ($1 === 107) {
      let source = $.slice(1);
      let _pipe = advance(lexer, source, 1);
      loop$lexer = _pipe;
      loop$start = start5;
      loop$slice_size = slice_size + 1;
    } else if ($1 === 108) {
      let source = $.slice(1);
      let _pipe = advance(lexer, source, 1);
      loop$lexer = _pipe;
      loop$start = start5;
      loop$slice_size = slice_size + 1;
    } else if ($1 === 109) {
      let source = $.slice(1);
      let _pipe = advance(lexer, source, 1);
      loop$lexer = _pipe;
      loop$start = start5;
      loop$slice_size = slice_size + 1;
    } else if ($1 === 110) {
      let source = $.slice(1);
      let _pipe = advance(lexer, source, 1);
      loop$lexer = _pipe;
      loop$start = start5;
      loop$slice_size = slice_size + 1;
    } else if ($1 === 111) {
      let source = $.slice(1);
      let _pipe = advance(lexer, source, 1);
      loop$lexer = _pipe;
      loop$start = start5;
      loop$slice_size = slice_size + 1;
    } else if ($1 === 112) {
      let source = $.slice(1);
      let _pipe = advance(lexer, source, 1);
      loop$lexer = _pipe;
      loop$start = start5;
      loop$slice_size = slice_size + 1;
    } else if ($1 === 113) {
      let source = $.slice(1);
      let _pipe = advance(lexer, source, 1);
      loop$lexer = _pipe;
      loop$start = start5;
      loop$slice_size = slice_size + 1;
    } else if ($1 === 114) {
      let source = $.slice(1);
      let _pipe = advance(lexer, source, 1);
      loop$lexer = _pipe;
      loop$start = start5;
      loop$slice_size = slice_size + 1;
    } else if ($1 === 115) {
      let source = $.slice(1);
      let _pipe = advance(lexer, source, 1);
      loop$lexer = _pipe;
      loop$start = start5;
      loop$slice_size = slice_size + 1;
    } else if ($1 === 116) {
      let source = $.slice(1);
      let _pipe = advance(lexer, source, 1);
      loop$lexer = _pipe;
      loop$start = start5;
      loop$slice_size = slice_size + 1;
    } else if ($1 === 117) {
      let source = $.slice(1);
      let _pipe = advance(lexer, source, 1);
      loop$lexer = _pipe;
      loop$start = start5;
      loop$slice_size = slice_size + 1;
    } else if ($1 === 118) {
      let source = $.slice(1);
      let _pipe = advance(lexer, source, 1);
      loop$lexer = _pipe;
      loop$start = start5;
      loop$slice_size = slice_size + 1;
    } else if ($1 === 119) {
      let source = $.slice(1);
      let _pipe = advance(lexer, source, 1);
      loop$lexer = _pipe;
      loop$start = start5;
      loop$slice_size = slice_size + 1;
    } else if ($1 === 120) {
      let source = $.slice(1);
      let _pipe = advance(lexer, source, 1);
      loop$lexer = _pipe;
      loop$start = start5;
      loop$slice_size = slice_size + 1;
    } else if ($1 === 121) {
      let source = $.slice(1);
      let _pipe = advance(lexer, source, 1);
      loop$lexer = _pipe;
      loop$start = start5;
      loop$slice_size = slice_size + 1;
    } else if ($1 === 122) {
      let source = $.slice(1);
      let _pipe = advance(lexer, source, 1);
      loop$lexer = _pipe;
      loop$start = start5;
      loop$slice_size = slice_size + 1;
    } else if ($1 === 48) {
      let source = $.slice(1);
      let _pipe = advance(lexer, source, 1);
      loop$lexer = _pipe;
      loop$start = start5;
      loop$slice_size = slice_size + 1;
    } else if ($1 === 49) {
      let source = $.slice(1);
      let _pipe = advance(lexer, source, 1);
      loop$lexer = _pipe;
      loop$start = start5;
      loop$slice_size = slice_size + 1;
    } else if ($1 === 50) {
      let source = $.slice(1);
      let _pipe = advance(lexer, source, 1);
      loop$lexer = _pipe;
      loop$start = start5;
      loop$slice_size = slice_size + 1;
    } else if ($1 === 51) {
      let source = $.slice(1);
      let _pipe = advance(lexer, source, 1);
      loop$lexer = _pipe;
      loop$start = start5;
      loop$slice_size = slice_size + 1;
    } else if ($1 === 52) {
      let source = $.slice(1);
      let _pipe = advance(lexer, source, 1);
      loop$lexer = _pipe;
      loop$start = start5;
      loop$slice_size = slice_size + 1;
    } else if ($1 === 53) {
      let source = $.slice(1);
      let _pipe = advance(lexer, source, 1);
      loop$lexer = _pipe;
      loop$start = start5;
      loop$slice_size = slice_size + 1;
    } else if ($1 === 54) {
      let source = $.slice(1);
      let _pipe = advance(lexer, source, 1);
      loop$lexer = _pipe;
      loop$start = start5;
      loop$slice_size = slice_size + 1;
    } else if ($1 === 55) {
      let source = $.slice(1);
      let _pipe = advance(lexer, source, 1);
      loop$lexer = _pipe;
      loop$start = start5;
      loop$slice_size = slice_size + 1;
    } else if ($1 === 56) {
      let source = $.slice(1);
      let _pipe = advance(lexer, source, 1);
      loop$lexer = _pipe;
      loop$start = start5;
      loop$slice_size = slice_size + 1;
    } else if ($1 === 57) {
      let source = $.slice(1);
      let _pipe = advance(lexer, source, 1);
      loop$lexer = _pipe;
      loop$start = start5;
      loop$slice_size = slice_size + 1;
    } else if ($1 === 95) {
      let source = $.slice(1);
      let _pipe = advance(lexer, source, 1);
      loop$lexer = _pipe;
      loop$start = start5;
      loop$slice_size = slice_size + 1;
    } else {
      let name = slice_bytes(lexer.original_source, start5, slice_size);
      return [lexer, name];
    }
  }
}
function lex_string(loop$lexer, loop$start, loop$slice_size) {
  while (true) {
    let lexer = loop$lexer;
    let start5 = loop$start;
    let slice_size = loop$slice_size;
    let $ = lexer.source;
    let $1 = $.charCodeAt(0);
    if ($1 === 34) {
      let source = $.slice(1);
      let content = slice_bytes(lexer.original_source, start5 + 1, slice_size);
      let _pipe = [new String2(content), new Position(start5)];
      let _pipe$1 = advanced(_pipe, lexer, source, 1);
      return some_token(_pipe$1);
    } else if ($1 === 92) {
      let source = $.slice(1);
      let $2 = pop_grapheme(source);
      if ($2 instanceof Ok) {
        let grapheme = $2[0][0];
        let source$1 = $2[0][1];
        let offset = 1 + string_length2(grapheme);
        let _pipe = advance(lexer, source$1, offset);
        loop$lexer = _pipe;
        loop$start = start5;
        loop$slice_size = slice_size + offset;
      } else {
        let _pipe = advance(lexer, source, 1);
        loop$lexer = _pipe;
        loop$start = start5;
        loop$slice_size = slice_size + 1;
      }
    } else if ($ === "") {
      let content = slice_bytes(lexer.original_source, start5 + 1, slice_size);
      return [
        lexer,
        new Some([new UnterminatedString(content), new Position(start5)])
      ];
    } else {
      let _pipe = advance(lexer, drop_byte(lexer.source), 1);
      loop$lexer = _pipe;
      loop$start = start5;
      loop$slice_size = slice_size + 1;
    }
  }
}
function lex_number(loop$lexer, loop$mode, loop$start, loop$slice_size) {
  while (true) {
    let lexer = loop$lexer;
    let mode = loop$mode;
    let start5 = loop$start;
    let slice_size = loop$slice_size;
    let $ = lexer.source;
    let $1 = $.charCodeAt(0);
    if ($1 === 95) {
      let source = $.slice(1);
      let _pipe = advance(lexer, source, 1);
      loop$lexer = _pipe;
      loop$mode = mode;
      loop$start = start5;
      loop$slice_size = slice_size + 1;
    } else if ($1 === 48) {
      let source = $.slice(1);
      let _pipe = advance(lexer, source, 1);
      loop$lexer = _pipe;
      loop$mode = mode;
      loop$start = start5;
      loop$slice_size = slice_size + 1;
    } else if ($1 === 49) {
      let source = $.slice(1);
      let _pipe = advance(lexer, source, 1);
      loop$lexer = _pipe;
      loop$mode = mode;
      loop$start = start5;
      loop$slice_size = slice_size + 1;
    } else if ($1 === 50) {
      let source = $.slice(1);
      let _pipe = advance(lexer, source, 1);
      loop$lexer = _pipe;
      loop$mode = mode;
      loop$start = start5;
      loop$slice_size = slice_size + 1;
    } else if ($1 === 51) {
      let source = $.slice(1);
      let _pipe = advance(lexer, source, 1);
      loop$lexer = _pipe;
      loop$mode = mode;
      loop$start = start5;
      loop$slice_size = slice_size + 1;
    } else if ($1 === 52) {
      let source = $.slice(1);
      let _pipe = advance(lexer, source, 1);
      loop$lexer = _pipe;
      loop$mode = mode;
      loop$start = start5;
      loop$slice_size = slice_size + 1;
    } else if ($1 === 53) {
      let source = $.slice(1);
      let _pipe = advance(lexer, source, 1);
      loop$lexer = _pipe;
      loop$mode = mode;
      loop$start = start5;
      loop$slice_size = slice_size + 1;
    } else if ($1 === 54) {
      let source = $.slice(1);
      let _pipe = advance(lexer, source, 1);
      loop$lexer = _pipe;
      loop$mode = mode;
      loop$start = start5;
      loop$slice_size = slice_size + 1;
    } else if ($1 === 55) {
      let source = $.slice(1);
      let _pipe = advance(lexer, source, 1);
      loop$lexer = _pipe;
      loop$mode = mode;
      loop$start = start5;
      loop$slice_size = slice_size + 1;
    } else if ($1 === 56) {
      let source = $.slice(1);
      let _pipe = advance(lexer, source, 1);
      loop$lexer = _pipe;
      loop$mode = mode;
      loop$start = start5;
      loop$slice_size = slice_size + 1;
    } else if ($1 === 57) {
      let source = $.slice(1);
      let _pipe = advance(lexer, source, 1);
      loop$lexer = _pipe;
      loop$mode = mode;
      loop$start = start5;
      loop$slice_size = slice_size + 1;
    } else if ($1 === 46) {
      if (mode instanceof LexInt) {
        let source = $.slice(1);
        let _pipe = advance(lexer, source, 1);
        loop$lexer = _pipe;
        loop$mode = LexNumberMode$LexFloat$const;
        loop$start = start5;
        loop$slice_size = slice_size + 1;
      } else if (mode instanceof LexFloat) {
        let lexer$1 = new Lexer(lexer.original_source, lexer.source, lexer.byte_offset, lexer.preserve_whitespace, lexer.preserve_comments, LexerMode$CheckForMinus$const, lexer.newlines);
        let content = slice_bytes(lexer$1.original_source, start5, slice_size);
        return [
          lexer$1,
          new Some([new Float(content), new Position(start5)])
        ];
      } else {
        let lexer$1 = new Lexer(lexer.original_source, lexer.source, lexer.byte_offset, lexer.preserve_whitespace, lexer.preserve_comments, LexerMode$CheckForMinus$const, lexer.newlines);
        let content = slice_bytes(lexer$1.original_source, start5, slice_size);
        return [
          lexer$1,
          new Some([new Float(content), new Position(start5)])
        ];
      }
    } else if ($.startsWith("e-")) {
      if (mode instanceof LexInt) {
        let lexer$1 = new Lexer(lexer.original_source, lexer.source, lexer.byte_offset, lexer.preserve_whitespace, lexer.preserve_comments, LexerMode$CheckForMinus$const, lexer.newlines);
        let content = slice_bytes(lexer$1.original_source, start5, slice_size);
        return [
          lexer$1,
          new Some([new Int(content), new Position(start5)])
        ];
      } else if (mode instanceof LexFloat) {
        let source = $.slice(2);
        let _pipe = advance(lexer, source, 2);
        loop$lexer = _pipe;
        loop$mode = LexNumberMode$LexFloatExponent$const;
        loop$start = start5;
        loop$slice_size = slice_size + 2;
      } else {
        let lexer$1 = new Lexer(lexer.original_source, lexer.source, lexer.byte_offset, lexer.preserve_whitespace, lexer.preserve_comments, LexerMode$CheckForMinus$const, lexer.newlines);
        let content = slice_bytes(lexer$1.original_source, start5, slice_size);
        return [
          lexer$1,
          new Some([new Float(content), new Position(start5)])
        ];
      }
    } else if ($1 === 101) {
      if (mode instanceof LexInt) {
        let lexer$1 = new Lexer(lexer.original_source, lexer.source, lexer.byte_offset, lexer.preserve_whitespace, lexer.preserve_comments, LexerMode$CheckForMinus$const, lexer.newlines);
        let content = slice_bytes(lexer$1.original_source, start5, slice_size);
        return [
          lexer$1,
          new Some([new Int(content), new Position(start5)])
        ];
      } else if (mode instanceof LexFloat) {
        let source = $.slice(1);
        let _pipe = advance(lexer, source, 1);
        loop$lexer = _pipe;
        loop$mode = LexNumberMode$LexFloatExponent$const;
        loop$start = start5;
        loop$slice_size = slice_size + 1;
      } else {
        let lexer$1 = new Lexer(lexer.original_source, lexer.source, lexer.byte_offset, lexer.preserve_whitespace, lexer.preserve_comments, LexerMode$CheckForMinus$const, lexer.newlines);
        let content = slice_bytes(lexer$1.original_source, start5, slice_size);
        return [
          lexer$1,
          new Some([new Float(content), new Position(start5)])
        ];
      }
    } else if (mode instanceof LexInt) {
      let lexer$1 = new Lexer(lexer.original_source, lexer.source, lexer.byte_offset, lexer.preserve_whitespace, lexer.preserve_comments, LexerMode$CheckForMinus$const, lexer.newlines);
      let content = slice_bytes(lexer$1.original_source, start5, slice_size);
      return [lexer$1, new Some([new Int(content), new Position(start5)])];
    } else if (mode instanceof LexFloat) {
      let lexer$1 = new Lexer(lexer.original_source, lexer.source, lexer.byte_offset, lexer.preserve_whitespace, lexer.preserve_comments, LexerMode$CheckForMinus$const, lexer.newlines);
      let content = slice_bytes(lexer$1.original_source, start5, slice_size);
      return [
        lexer$1,
        new Some([new Float(content), new Position(start5)])
      ];
    } else {
      let lexer$1 = new Lexer(lexer.original_source, lexer.source, lexer.byte_offset, lexer.preserve_whitespace, lexer.preserve_comments, LexerMode$CheckForMinus$const, lexer.newlines);
      let content = slice_bytes(lexer$1.original_source, start5, slice_size);
      return [
        lexer$1,
        new Some([new Float(content), new Position(start5)])
      ];
    }
  }
}
function lex_hexadecimal(loop$lexer, loop$start, loop$slice_size) {
  while (true) {
    let lexer = loop$lexer;
    let start5 = loop$start;
    let slice_size = loop$slice_size;
    let $ = lexer.source;
    let $1 = $.charCodeAt(0);
    if ($1 === 95) {
      let source = $.slice(1);
      let _pipe = advance(lexer, source, 1);
      loop$lexer = _pipe;
      loop$start = start5;
      loop$slice_size = slice_size + 1;
    } else if ($1 === 48) {
      let source = $.slice(1);
      let _pipe = advance(lexer, source, 1);
      loop$lexer = _pipe;
      loop$start = start5;
      loop$slice_size = slice_size + 1;
    } else if ($1 === 49) {
      let source = $.slice(1);
      let _pipe = advance(lexer, source, 1);
      loop$lexer = _pipe;
      loop$start = start5;
      loop$slice_size = slice_size + 1;
    } else if ($1 === 50) {
      let source = $.slice(1);
      let _pipe = advance(lexer, source, 1);
      loop$lexer = _pipe;
      loop$start = start5;
      loop$slice_size = slice_size + 1;
    } else if ($1 === 51) {
      let source = $.slice(1);
      let _pipe = advance(lexer, source, 1);
      loop$lexer = _pipe;
      loop$start = start5;
      loop$slice_size = slice_size + 1;
    } else if ($1 === 52) {
      let source = $.slice(1);
      let _pipe = advance(lexer, source, 1);
      loop$lexer = _pipe;
      loop$start = start5;
      loop$slice_size = slice_size + 1;
    } else if ($1 === 53) {
      let source = $.slice(1);
      let _pipe = advance(lexer, source, 1);
      loop$lexer = _pipe;
      loop$start = start5;
      loop$slice_size = slice_size + 1;
    } else if ($1 === 54) {
      let source = $.slice(1);
      let _pipe = advance(lexer, source, 1);
      loop$lexer = _pipe;
      loop$start = start5;
      loop$slice_size = slice_size + 1;
    } else if ($1 === 55) {
      let source = $.slice(1);
      let _pipe = advance(lexer, source, 1);
      loop$lexer = _pipe;
      loop$start = start5;
      loop$slice_size = slice_size + 1;
    } else if ($1 === 56) {
      let source = $.slice(1);
      let _pipe = advance(lexer, source, 1);
      loop$lexer = _pipe;
      loop$start = start5;
      loop$slice_size = slice_size + 1;
    } else if ($1 === 57) {
      let source = $.slice(1);
      let _pipe = advance(lexer, source, 1);
      loop$lexer = _pipe;
      loop$start = start5;
      loop$slice_size = slice_size + 1;
    } else if ($1 === 97) {
      let source = $.slice(1);
      let _pipe = advance(lexer, source, 1);
      loop$lexer = _pipe;
      loop$start = start5;
      loop$slice_size = slice_size + 1;
    } else if ($1 === 65) {
      let source = $.slice(1);
      let _pipe = advance(lexer, source, 1);
      loop$lexer = _pipe;
      loop$start = start5;
      loop$slice_size = slice_size + 1;
    } else if ($1 === 98) {
      let source = $.slice(1);
      let _pipe = advance(lexer, source, 1);
      loop$lexer = _pipe;
      loop$start = start5;
      loop$slice_size = slice_size + 1;
    } else if ($1 === 66) {
      let source = $.slice(1);
      let _pipe = advance(lexer, source, 1);
      loop$lexer = _pipe;
      loop$start = start5;
      loop$slice_size = slice_size + 1;
    } else if ($1 === 99) {
      let source = $.slice(1);
      let _pipe = advance(lexer, source, 1);
      loop$lexer = _pipe;
      loop$start = start5;
      loop$slice_size = slice_size + 1;
    } else if ($1 === 67) {
      let source = $.slice(1);
      let _pipe = advance(lexer, source, 1);
      loop$lexer = _pipe;
      loop$start = start5;
      loop$slice_size = slice_size + 1;
    } else if ($1 === 100) {
      let source = $.slice(1);
      let _pipe = advance(lexer, source, 1);
      loop$lexer = _pipe;
      loop$start = start5;
      loop$slice_size = slice_size + 1;
    } else if ($1 === 68) {
      let source = $.slice(1);
      let _pipe = advance(lexer, source, 1);
      loop$lexer = _pipe;
      loop$start = start5;
      loop$slice_size = slice_size + 1;
    } else if ($1 === 101) {
      let source = $.slice(1);
      let _pipe = advance(lexer, source, 1);
      loop$lexer = _pipe;
      loop$start = start5;
      loop$slice_size = slice_size + 1;
    } else if ($1 === 69) {
      let source = $.slice(1);
      let _pipe = advance(lexer, source, 1);
      loop$lexer = _pipe;
      loop$start = start5;
      loop$slice_size = slice_size + 1;
    } else if ($1 === 102) {
      let source = $.slice(1);
      let _pipe = advance(lexer, source, 1);
      loop$lexer = _pipe;
      loop$start = start5;
      loop$slice_size = slice_size + 1;
    } else if ($1 === 70) {
      let source = $.slice(1);
      let _pipe = advance(lexer, source, 1);
      loop$lexer = _pipe;
      loop$start = start5;
      loop$slice_size = slice_size + 1;
    } else {
      let content = slice_bytes(lexer.original_source, start5, slice_size);
      return [lexer, new Some([new Int(content), new Position(start5)])];
    }
  }
}
function lex_octal(loop$lexer, loop$start, loop$slice_size) {
  while (true) {
    let lexer = loop$lexer;
    let start5 = loop$start;
    let slice_size = loop$slice_size;
    let $ = lexer.source;
    let $1 = $.charCodeAt(0);
    if ($1 === 95) {
      let source = $.slice(1);
      let _pipe = advance(lexer, source, 1);
      loop$lexer = _pipe;
      loop$start = start5;
      loop$slice_size = slice_size + 1;
    } else if ($1 === 48) {
      let source = $.slice(1);
      let _pipe = advance(lexer, source, 1);
      loop$lexer = _pipe;
      loop$start = start5;
      loop$slice_size = slice_size + 1;
    } else if ($1 === 49) {
      let source = $.slice(1);
      let _pipe = advance(lexer, source, 1);
      loop$lexer = _pipe;
      loop$start = start5;
      loop$slice_size = slice_size + 1;
    } else if ($1 === 50) {
      let source = $.slice(1);
      let _pipe = advance(lexer, source, 1);
      loop$lexer = _pipe;
      loop$start = start5;
      loop$slice_size = slice_size + 1;
    } else if ($1 === 51) {
      let source = $.slice(1);
      let _pipe = advance(lexer, source, 1);
      loop$lexer = _pipe;
      loop$start = start5;
      loop$slice_size = slice_size + 1;
    } else if ($1 === 52) {
      let source = $.slice(1);
      let _pipe = advance(lexer, source, 1);
      loop$lexer = _pipe;
      loop$start = start5;
      loop$slice_size = slice_size + 1;
    } else if ($1 === 53) {
      let source = $.slice(1);
      let _pipe = advance(lexer, source, 1);
      loop$lexer = _pipe;
      loop$start = start5;
      loop$slice_size = slice_size + 1;
    } else if ($1 === 54) {
      let source = $.slice(1);
      let _pipe = advance(lexer, source, 1);
      loop$lexer = _pipe;
      loop$start = start5;
      loop$slice_size = slice_size + 1;
    } else if ($1 === 55) {
      let source = $.slice(1);
      let _pipe = advance(lexer, source, 1);
      loop$lexer = _pipe;
      loop$start = start5;
      loop$slice_size = slice_size + 1;
    } else {
      let content = slice_bytes(lexer.original_source, start5, slice_size);
      return [lexer, new Some([new Int(content), new Position(start5)])];
    }
  }
}
function lex_binary(loop$lexer, loop$start, loop$slice_size) {
  while (true) {
    let lexer = loop$lexer;
    let start5 = loop$start;
    let slice_size = loop$slice_size;
    let $ = lexer.source;
    let $1 = $.charCodeAt(0);
    if ($1 === 95) {
      let source = $.slice(1);
      let _pipe = advance(lexer, source, 1);
      loop$lexer = _pipe;
      loop$start = start5;
      loop$slice_size = slice_size + 1;
    } else if ($1 === 48) {
      let source = $.slice(1);
      let _pipe = advance(lexer, source, 1);
      loop$lexer = _pipe;
      loop$start = start5;
      loop$slice_size = slice_size + 1;
    } else if ($1 === 49) {
      let source = $.slice(1);
      let _pipe = advance(lexer, source, 1);
      loop$lexer = _pipe;
      loop$start = start5;
      loop$slice_size = slice_size + 1;
    } else {
      let content = slice_bytes(lexer.original_source, start5, slice_size);
      return [lexer, new Some([new Int(content), new Position(start5)])];
    }
  }
}
function comment(lexer, kind, start5) {
  let $ = split_before(lexer.newlines, lexer.source);
  let prefix = $[0];
  let suffix = $[1];
  let eaten = string_length2(prefix);
  let lexer$1 = advance(lexer, suffix, eaten);
  let _block;
  if (kind instanceof RegularComment) {
    _block = new CommentNormal(prefix);
  } else if (kind instanceof DocComment) {
    _block = new CommentDoc(prefix);
  } else {
    _block = new CommentModule(prefix);
  }
  let token$1 = _block;
  return [lexer$1, new Some([token$1, new Position(start5)])];
}
function skip_comment(lexer) {
  let $ = split_before(lexer.newlines, lexer.source);
  let prefix = $[0];
  let suffix = $[1];
  let eaten = string_length2(prefix);
  let lexer$1 = advance(lexer, suffix, eaten);
  return [lexer$1, Option$None$const];
}
function whitespace(loop$lexer, loop$start, loop$slice_size) {
  while (true) {
    let lexer = loop$lexer;
    let start5 = loop$start;
    let slice_size = loop$slice_size;
    let $ = lexer.source;
    let $1 = $.charCodeAt(0);
    if ($1 === 32) {
      let source = $.slice(1);
      let _pipe = advance(lexer, source, 1);
      loop$lexer = _pipe;
      loop$start = start5;
      loop$slice_size = slice_size + 1;
    } else if ($1 === 9) {
      let source = $.slice(1);
      let _pipe = advance(lexer, source, 1);
      loop$lexer = _pipe;
      loop$start = start5;
      loop$slice_size = slice_size + 1;
    } else if ($1 === 10) {
      let source = $.slice(1);
      let _pipe = advance(lexer, source, 1);
      loop$lexer = _pipe;
      loop$start = start5;
      loop$slice_size = slice_size + 1;
    } else if ($1 === 13) {
      let source = $.slice(1);
      let _pipe = advance(lexer, source, 1);
      loop$lexer = _pipe;
      loop$start = start5;
      loop$slice_size = slice_size + 1;
    } else {
      let $2 = lexer.preserve_whitespace;
      if ($2) {
        let content = slice_bytes(lexer.original_source, start5, slice_size);
        return [
          lexer,
          new Some([new Space(content), new Position(start5)])
        ];
      } else {
        return [lexer, Option$None$const];
      }
    }
  }
}
function lex_digits(loop$lexer, loop$start, loop$slice_size) {
  while (true) {
    let lexer = loop$lexer;
    let start5 = loop$start;
    let slice_size = loop$slice_size;
    let $ = lexer.source;
    let $1 = $.charCodeAt(0);
    if ($1 === 95) {
      let source = $.slice(1);
      let _pipe = advance(lexer, source, 1);
      loop$lexer = _pipe;
      loop$start = start5;
      loop$slice_size = slice_size + 1;
    } else if ($1 === 48) {
      let source = $.slice(1);
      let _pipe = advance(lexer, source, 1);
      loop$lexer = _pipe;
      loop$start = start5;
      loop$slice_size = slice_size + 1;
    } else if ($1 === 49) {
      let source = $.slice(1);
      let _pipe = advance(lexer, source, 1);
      loop$lexer = _pipe;
      loop$start = start5;
      loop$slice_size = slice_size + 1;
    } else if ($1 === 50) {
      let source = $.slice(1);
      let _pipe = advance(lexer, source, 1);
      loop$lexer = _pipe;
      loop$start = start5;
      loop$slice_size = slice_size + 1;
    } else if ($1 === 51) {
      let source = $.slice(1);
      let _pipe = advance(lexer, source, 1);
      loop$lexer = _pipe;
      loop$start = start5;
      loop$slice_size = slice_size + 1;
    } else if ($1 === 52) {
      let source = $.slice(1);
      let _pipe = advance(lexer, source, 1);
      loop$lexer = _pipe;
      loop$start = start5;
      loop$slice_size = slice_size + 1;
    } else if ($1 === 53) {
      let source = $.slice(1);
      let _pipe = advance(lexer, source, 1);
      loop$lexer = _pipe;
      loop$start = start5;
      loop$slice_size = slice_size + 1;
    } else if ($1 === 54) {
      let source = $.slice(1);
      let _pipe = advance(lexer, source, 1);
      loop$lexer = _pipe;
      loop$start = start5;
      loop$slice_size = slice_size + 1;
    } else if ($1 === 55) {
      let source = $.slice(1);
      let _pipe = advance(lexer, source, 1);
      loop$lexer = _pipe;
      loop$start = start5;
      loop$slice_size = slice_size + 1;
    } else if ($1 === 56) {
      let source = $.slice(1);
      let _pipe = advance(lexer, source, 1);
      loop$lexer = _pipe;
      loop$start = start5;
      loop$slice_size = slice_size + 1;
    } else if ($1 === 57) {
      let source = $.slice(1);
      let _pipe = advance(lexer, source, 1);
      loop$lexer = _pipe;
      loop$start = start5;
      loop$slice_size = slice_size + 1;
    } else {
      let digits = slice_bytes(lexer.original_source, start5, slice_size);
      return [lexer, digits];
    }
  }
}
function check_for_minus(lexer) {
  let $ = lexer.source;
  if ($.charCodeAt(0) === 45) {
    let source = $.slice(1);
    let $1 = token2(lexer, Token$Minus$const, source, 1);
    let lexer$1 = $1[0];
    let token$1 = $1[1];
    return new Ok([
      new Lexer(lexer$1.original_source, lexer$1.source, lexer$1.byte_offset, lexer$1.preserve_whitespace, lexer$1.preserve_comments, LexerMode$Normal$const, lexer$1.newlines),
      token$1
    ]);
  } else {
    return new Error(undefined);
  }
}
function next(lexer) {
  let $ = lexer.mode;
  if ($ instanceof Normal2) {
    let $1 = lexer.source;
    let $2 = $1.charCodeAt(0);
    if ($2 === 32) {
      let source = $1.slice(1);
      let _pipe = advance(lexer, source, 1);
      return whitespace(_pipe, lexer.byte_offset, 1);
    } else if ($2 === 10) {
      let source = $1.slice(1);
      let _pipe = advance(lexer, source, 1);
      return whitespace(_pipe, lexer.byte_offset, 1);
    } else if ($2 === 13) {
      let source = $1.slice(1);
      let _pipe = advance(lexer, source, 1);
      return whitespace(_pipe, lexer.byte_offset, 1);
    } else if ($2 === 9) {
      let source = $1.slice(1);
      let _pipe = advance(lexer, source, 1);
      return whitespace(_pipe, lexer.byte_offset, 1);
    } else if ($1.startsWith("////")) {
      let source = $1.slice(4);
      let $3 = lexer.preserve_comments;
      if ($3) {
        let _pipe = advance(lexer, source, 4);
        return comment(_pipe, CommentKind$ModuleComment$const, lexer.byte_offset);
      } else {
        return skip_comment(lexer);
      }
    } else if ($1.startsWith("///")) {
      let source = $1.slice(3);
      let $3 = lexer.preserve_comments;
      if ($3) {
        let _pipe = advance(lexer, source, 3);
        return comment(_pipe, CommentKind$DocComment$const, lexer.byte_offset);
      } else {
        return skip_comment(lexer);
      }
    } else if ($1.startsWith("//")) {
      let source = $1.slice(2);
      let $3 = lexer.preserve_comments;
      if ($3) {
        let _pipe = advance(lexer, source, 2);
        return comment(_pipe, CommentKind$RegularComment$const, lexer.byte_offset);
      } else {
        return skip_comment(lexer);
      }
    } else if ($2 === 40) {
      let source = $1.slice(1);
      return token2(lexer, Token$LeftParen$const, source, 1);
    } else if ($2 === 41) {
      let source = $1.slice(1);
      return token2(lexer, Token$RightParen$const, source, 1);
    } else if ($2 === 123) {
      let source = $1.slice(1);
      return token2(lexer, Token$LeftBrace$const, source, 1);
    } else if ($2 === 125) {
      let source = $1.slice(1);
      return token2(lexer, Token$RightBrace$const, source, 1);
    } else if ($2 === 91) {
      let source = $1.slice(1);
      return token2(lexer, Token$LeftSquare$const, source, 1);
    } else if ($2 === 93) {
      let source = $1.slice(1);
      return token2(lexer, Token$RightSquare$const, source, 1);
    } else if ($2 === 64) {
      let source = $1.slice(1);
      return token2(lexer, Token$At$const, source, 1);
    } else if ($2 === 58) {
      let source = $1.slice(1);
      return token2(lexer, Token$Colon$const, source, 1);
    } else if ($2 === 44) {
      let source = $1.slice(1);
      return token2(lexer, Token$Comma$const, source, 1);
    } else if ($1.startsWith("..")) {
      let source = $1.slice(2);
      return token2(lexer, Token$DotDot$const, source, 2);
    } else if ($2 === 46) {
      let source = $1.slice(1);
      let $3 = token2(lexer, Token$Dot$const, source, 1);
      let lexer$1 = $3[0];
      let token$1 = $3[1];
      return [
        new Lexer(lexer$1.original_source, lexer$1.source, lexer$1.byte_offset, lexer$1.preserve_whitespace, lexer$1.preserve_comments, LexerMode$HasNestedDot$const, lexer$1.newlines),
        token$1
      ];
    } else if ($2 === 35) {
      let source = $1.slice(1);
      return token2(lexer, Token$Hash$const, source, 1);
    } else if ($1.startsWith("!=")) {
      let source = $1.slice(2);
      return token2(lexer, Token$NotEqual$const, source, 2);
    } else if ($2 === 33) {
      let source = $1.slice(1);
      return token2(lexer, Token$Bang$const, source, 1);
    } else if ($1.startsWith("==")) {
      let source = $1.slice(2);
      return token2(lexer, Token$EqualEqual$const, source, 2);
    } else if ($2 === 61) {
      let source = $1.slice(1);
      return token2(lexer, Token$Equal$const, source, 1);
    } else if ($1.startsWith("|>")) {
      let source = $1.slice(2);
      return token2(lexer, Token$Pipe$const, source, 2);
    } else if ($1.startsWith("||")) {
      let source = $1.slice(2);
      return token2(lexer, Token$VBarVBar$const, source, 2);
    } else if ($2 === 124) {
      let source = $1.slice(1);
      return token2(lexer, Token$VBar$const, source, 1);
    } else if ($1.startsWith("&&")) {
      let source = $1.slice(2);
      return token2(lexer, Token$AmperAmper$const, source, 2);
    } else if ($1.startsWith("<<")) {
      let source = $1.slice(2);
      return token2(lexer, Token$LessLess$const, source, 2);
    } else if ($1.startsWith(">>")) {
      let source = $1.slice(2);
      return token2(lexer, Token$GreaterGreater$const, source, 2);
    } else if ($1.startsWith("<-")) {
      let source = $1.slice(2);
      return token2(lexer, Token$LeftArrow$const, source, 2);
    } else if ($1.startsWith("->")) {
      let source = $1.slice(2);
      return token2(lexer, Token$RightArrow$const, source, 2);
    } else if ($1.startsWith("<>")) {
      let source = $1.slice(2);
      return token2(lexer, Token$LessGreater$const, source, 2);
    } else if ($1.startsWith("+.")) {
      let source = $1.slice(2);
      return token2(lexer, Token$PlusDot$const, source, 2);
    } else if ($1.startsWith("-.")) {
      let source = $1.slice(2);
      return token2(lexer, Token$MinusDot$const, source, 2);
    } else if ($1.startsWith("*.")) {
      let source = $1.slice(2);
      return token2(lexer, Token$StarDot$const, source, 2);
    } else if ($1.startsWith("/.")) {
      let source = $1.slice(2);
      return token2(lexer, Token$SlashDot$const, source, 2);
    } else if ($1.startsWith("<=.")) {
      let source = $1.slice(3);
      return token2(lexer, Token$LessEqualDot$const, source, 3);
    } else if ($1.startsWith("<.")) {
      let source = $1.slice(2);
      return token2(lexer, Token$LessDot$const, source, 2);
    } else if ($1.startsWith(">=.")) {
      let source = $1.slice(3);
      return token2(lexer, Token$GreaterEqualDot$const, source, 3);
    } else if ($1.startsWith(">.")) {
      let source = $1.slice(2);
      return token2(lexer, Token$GreaterDot$const, source, 2);
    } else if ($1.startsWith("0b")) {
      let source = $1.slice(2);
      let _pipe = advance(lexer, source, 2);
      return lex_binary(_pipe, lexer.byte_offset, 2);
    } else if ($1.startsWith("0o")) {
      let source = $1.slice(2);
      let _pipe = advance(lexer, source, 2);
      return lex_octal(_pipe, lexer.byte_offset, 2);
    } else if ($1.startsWith("0x")) {
      let source = $1.slice(2);
      let _pipe = advance(lexer, source, 2);
      return lex_hexadecimal(_pipe, lexer.byte_offset, 2);
    } else if ($1.startsWith("-0b")) {
      let source = $1.slice(3);
      let _pipe = advance(lexer, source, 3);
      return lex_binary(_pipe, lexer.byte_offset, 3);
    } else if ($1.startsWith("-0o")) {
      let source = $1.slice(3);
      let _pipe = advance(lexer, source, 3);
      return lex_octal(_pipe, lexer.byte_offset, 3);
    } else if ($1.startsWith("-0x")) {
      let source = $1.slice(3);
      let _pipe = advance(lexer, source, 3);
      return lex_hexadecimal(_pipe, lexer.byte_offset, 3);
    } else if ($2 === 48) {
      let source = $1.slice(1);
      let _pipe = advance(lexer, source, 1);
      return lex_number(_pipe, LexNumberMode$LexInt$const, lexer.byte_offset, 1);
    } else if ($2 === 49) {
      let source = $1.slice(1);
      let _pipe = advance(lexer, source, 1);
      return lex_number(_pipe, LexNumberMode$LexInt$const, lexer.byte_offset, 1);
    } else if ($2 === 50) {
      let source = $1.slice(1);
      let _pipe = advance(lexer, source, 1);
      return lex_number(_pipe, LexNumberMode$LexInt$const, lexer.byte_offset, 1);
    } else if ($2 === 51) {
      let source = $1.slice(1);
      let _pipe = advance(lexer, source, 1);
      return lex_number(_pipe, LexNumberMode$LexInt$const, lexer.byte_offset, 1);
    } else if ($2 === 52) {
      let source = $1.slice(1);
      let _pipe = advance(lexer, source, 1);
      return lex_number(_pipe, LexNumberMode$LexInt$const, lexer.byte_offset, 1);
    } else if ($2 === 53) {
      let source = $1.slice(1);
      let _pipe = advance(lexer, source, 1);
      return lex_number(_pipe, LexNumberMode$LexInt$const, lexer.byte_offset, 1);
    } else if ($2 === 54) {
      let source = $1.slice(1);
      let _pipe = advance(lexer, source, 1);
      return lex_number(_pipe, LexNumberMode$LexInt$const, lexer.byte_offset, 1);
    } else if ($2 === 55) {
      let source = $1.slice(1);
      let _pipe = advance(lexer, source, 1);
      return lex_number(_pipe, LexNumberMode$LexInt$const, lexer.byte_offset, 1);
    } else if ($2 === 56) {
      let source = $1.slice(1);
      let _pipe = advance(lexer, source, 1);
      return lex_number(_pipe, LexNumberMode$LexInt$const, lexer.byte_offset, 1);
    } else if ($2 === 57) {
      let source = $1.slice(1);
      let _pipe = advance(lexer, source, 1);
      return lex_number(_pipe, LexNumberMode$LexInt$const, lexer.byte_offset, 1);
    } else if ($1.startsWith("-0")) {
      let source = $1.slice(2);
      let _pipe = advance(lexer, source, 2);
      return lex_number(_pipe, LexNumberMode$LexInt$const, lexer.byte_offset, 2);
    } else if ($1.startsWith("-1")) {
      let source = $1.slice(2);
      let _pipe = advance(lexer, source, 2);
      return lex_number(_pipe, LexNumberMode$LexInt$const, lexer.byte_offset, 2);
    } else if ($1.startsWith("-2")) {
      let source = $1.slice(2);
      let _pipe = advance(lexer, source, 2);
      return lex_number(_pipe, LexNumberMode$LexInt$const, lexer.byte_offset, 2);
    } else if ($1.startsWith("-3")) {
      let source = $1.slice(2);
      let _pipe = advance(lexer, source, 2);
      return lex_number(_pipe, LexNumberMode$LexInt$const, lexer.byte_offset, 2);
    } else if ($1.startsWith("-4")) {
      let source = $1.slice(2);
      let _pipe = advance(lexer, source, 2);
      return lex_number(_pipe, LexNumberMode$LexInt$const, lexer.byte_offset, 2);
    } else if ($1.startsWith("-5")) {
      let source = $1.slice(2);
      let _pipe = advance(lexer, source, 2);
      return lex_number(_pipe, LexNumberMode$LexInt$const, lexer.byte_offset, 2);
    } else if ($1.startsWith("-6")) {
      let source = $1.slice(2);
      let _pipe = advance(lexer, source, 2);
      return lex_number(_pipe, LexNumberMode$LexInt$const, lexer.byte_offset, 2);
    } else if ($1.startsWith("-7")) {
      let source = $1.slice(2);
      let _pipe = advance(lexer, source, 2);
      return lex_number(_pipe, LexNumberMode$LexInt$const, lexer.byte_offset, 2);
    } else if ($1.startsWith("-8")) {
      let source = $1.slice(2);
      let _pipe = advance(lexer, source, 2);
      return lex_number(_pipe, LexNumberMode$LexInt$const, lexer.byte_offset, 2);
    } else if ($1.startsWith("-9")) {
      let source = $1.slice(2);
      let _pipe = advance(lexer, source, 2);
      return lex_number(_pipe, LexNumberMode$LexInt$const, lexer.byte_offset, 2);
    } else if ($2 === 43) {
      let source = $1.slice(1);
      return token2(lexer, Token$Plus$const, source, 1);
    } else if ($2 === 45) {
      let source = $1.slice(1);
      return token2(lexer, Token$Minus$const, source, 1);
    } else if ($2 === 42) {
      let source = $1.slice(1);
      return token2(lexer, Token$Star$const, source, 1);
    } else if ($2 === 47) {
      let source = $1.slice(1);
      return token2(lexer, Token$Slash$const, source, 1);
    } else if ($1.startsWith("<=")) {
      let source = $1.slice(2);
      return token2(lexer, Token$LessEqual$const, source, 2);
    } else if ($2 === 60) {
      let source = $1.slice(1);
      return token2(lexer, Token$Less$const, source, 1);
    } else if ($1.startsWith(">=")) {
      let source = $1.slice(2);
      return token2(lexer, Token$GreaterEqual$const, source, 2);
    } else if ($2 === 62) {
      let source = $1.slice(1);
      return token2(lexer, Token$Greater$const, source, 1);
    } else if ($2 === 37) {
      let source = $1.slice(1);
      return token2(lexer, Token$Percent$const, source, 1);
    } else if ($2 === 34) {
      let source = $1.slice(1);
      let _pipe = advance(lexer, source, 1);
      return lex_string(_pipe, lexer.byte_offset, 0);
    } else if ($2 === 95) {
      let source = $1.slice(1);
      let byte_offset = lexer.byte_offset;
      let _block;
      let _pipe = advance(lexer, source, 1);
      _block = lex_lowercase_name(_pipe, byte_offset + 1, 0);
      let $3 = _block;
      let lexer$1 = $3[0];
      let name = $3[1];
      return [
        lexer$1,
        new Some([new DiscardName(name), new Position(byte_offset)])
      ];
    } else if ($2 === 97) {
      let source = $1.slice(1);
      let byte_offset = lexer.byte_offset;
      let _block;
      let _pipe = advance(lexer, source, 1);
      _block = lex_lowercase_name(_pipe, byte_offset, 1);
      let $3 = _block;
      let lexer$1 = $3[0];
      let name = $3[1];
      let _block$1;
      if (name === "as") {
        _block$1 = Token$As$const;
      } else if (name === "assert") {
        _block$1 = Token$Assert$const;
      } else if (name === "auto") {
        _block$1 = Token$Auto$const;
      } else if (name === "case") {
        _block$1 = Token$Case$const;
      } else if (name === "const") {
        _block$1 = Token$Const$const;
      } else if (name === "delegate") {
        _block$1 = Token$Delegate$const;
      } else if (name === "derive") {
        _block$1 = Token$Derive$const;
      } else if (name === "echo") {
        _block$1 = Token$Echo$const;
      } else if (name === "else") {
        _block$1 = Token$Else$const;
      } else if (name === "fn") {
        _block$1 = Token$Fn$const;
      } else if (name === "if") {
        _block$1 = Token$If$const;
      } else if (name === "implement") {
        _block$1 = Token$Implement$const;
      } else if (name === "import") {
        _block$1 = Token$Import$const;
      } else if (name === "let") {
        _block$1 = Token$Let$const;
      } else if (name === "macro") {
        _block$1 = Token$Macro$const;
      } else if (name === "opaque") {
        _block$1 = Token$Opaque$const;
      } else if (name === "panic") {
        _block$1 = Token$Panic$const;
      } else if (name === "pub") {
        _block$1 = Token$Pub$const;
      } else if (name === "test") {
        _block$1 = Token$Test$const;
      } else if (name === "todo") {
        _block$1 = Token$Todo$const;
      } else if (name === "type") {
        _block$1 = Token$Type$const;
      } else if (name === "use") {
        _block$1 = Token$Use$const;
      } else {
        _block$1 = new Name(name);
      }
      let token$1 = _block$1;
      let lexer$2 = new Lexer(lexer$1.original_source, lexer$1.source, lexer$1.byte_offset, lexer$1.preserve_whitespace, lexer$1.preserve_comments, LexerMode$CheckForMinus$const, lexer$1.newlines);
      return [lexer$2, new Some([token$1, new Position(byte_offset)])];
    } else if ($2 === 98) {
      let source = $1.slice(1);
      let byte_offset = lexer.byte_offset;
      let _block;
      let _pipe = advance(lexer, source, 1);
      _block = lex_lowercase_name(_pipe, byte_offset, 1);
      let $3 = _block;
      let lexer$1 = $3[0];
      let name = $3[1];
      let _block$1;
      if (name === "as") {
        _block$1 = Token$As$const;
      } else if (name === "assert") {
        _block$1 = Token$Assert$const;
      } else if (name === "auto") {
        _block$1 = Token$Auto$const;
      } else if (name === "case") {
        _block$1 = Token$Case$const;
      } else if (name === "const") {
        _block$1 = Token$Const$const;
      } else if (name === "delegate") {
        _block$1 = Token$Delegate$const;
      } else if (name === "derive") {
        _block$1 = Token$Derive$const;
      } else if (name === "echo") {
        _block$1 = Token$Echo$const;
      } else if (name === "else") {
        _block$1 = Token$Else$const;
      } else if (name === "fn") {
        _block$1 = Token$Fn$const;
      } else if (name === "if") {
        _block$1 = Token$If$const;
      } else if (name === "implement") {
        _block$1 = Token$Implement$const;
      } else if (name === "import") {
        _block$1 = Token$Import$const;
      } else if (name === "let") {
        _block$1 = Token$Let$const;
      } else if (name === "macro") {
        _block$1 = Token$Macro$const;
      } else if (name === "opaque") {
        _block$1 = Token$Opaque$const;
      } else if (name === "panic") {
        _block$1 = Token$Panic$const;
      } else if (name === "pub") {
        _block$1 = Token$Pub$const;
      } else if (name === "test") {
        _block$1 = Token$Test$const;
      } else if (name === "todo") {
        _block$1 = Token$Todo$const;
      } else if (name === "type") {
        _block$1 = Token$Type$const;
      } else if (name === "use") {
        _block$1 = Token$Use$const;
      } else {
        _block$1 = new Name(name);
      }
      let token$1 = _block$1;
      let lexer$2 = new Lexer(lexer$1.original_source, lexer$1.source, lexer$1.byte_offset, lexer$1.preserve_whitespace, lexer$1.preserve_comments, LexerMode$CheckForMinus$const, lexer$1.newlines);
      return [lexer$2, new Some([token$1, new Position(byte_offset)])];
    } else if ($2 === 99) {
      let source = $1.slice(1);
      let byte_offset = lexer.byte_offset;
      let _block;
      let _pipe = advance(lexer, source, 1);
      _block = lex_lowercase_name(_pipe, byte_offset, 1);
      let $3 = _block;
      let lexer$1 = $3[0];
      let name = $3[1];
      let _block$1;
      if (name === "as") {
        _block$1 = Token$As$const;
      } else if (name === "assert") {
        _block$1 = Token$Assert$const;
      } else if (name === "auto") {
        _block$1 = Token$Auto$const;
      } else if (name === "case") {
        _block$1 = Token$Case$const;
      } else if (name === "const") {
        _block$1 = Token$Const$const;
      } else if (name === "delegate") {
        _block$1 = Token$Delegate$const;
      } else if (name === "derive") {
        _block$1 = Token$Derive$const;
      } else if (name === "echo") {
        _block$1 = Token$Echo$const;
      } else if (name === "else") {
        _block$1 = Token$Else$const;
      } else if (name === "fn") {
        _block$1 = Token$Fn$const;
      } else if (name === "if") {
        _block$1 = Token$If$const;
      } else if (name === "implement") {
        _block$1 = Token$Implement$const;
      } else if (name === "import") {
        _block$1 = Token$Import$const;
      } else if (name === "let") {
        _block$1 = Token$Let$const;
      } else if (name === "macro") {
        _block$1 = Token$Macro$const;
      } else if (name === "opaque") {
        _block$1 = Token$Opaque$const;
      } else if (name === "panic") {
        _block$1 = Token$Panic$const;
      } else if (name === "pub") {
        _block$1 = Token$Pub$const;
      } else if (name === "test") {
        _block$1 = Token$Test$const;
      } else if (name === "todo") {
        _block$1 = Token$Todo$const;
      } else if (name === "type") {
        _block$1 = Token$Type$const;
      } else if (name === "use") {
        _block$1 = Token$Use$const;
      } else {
        _block$1 = new Name(name);
      }
      let token$1 = _block$1;
      let lexer$2 = new Lexer(lexer$1.original_source, lexer$1.source, lexer$1.byte_offset, lexer$1.preserve_whitespace, lexer$1.preserve_comments, LexerMode$CheckForMinus$const, lexer$1.newlines);
      return [lexer$2, new Some([token$1, new Position(byte_offset)])];
    } else if ($2 === 100) {
      let source = $1.slice(1);
      let byte_offset = lexer.byte_offset;
      let _block;
      let _pipe = advance(lexer, source, 1);
      _block = lex_lowercase_name(_pipe, byte_offset, 1);
      let $3 = _block;
      let lexer$1 = $3[0];
      let name = $3[1];
      let _block$1;
      if (name === "as") {
        _block$1 = Token$As$const;
      } else if (name === "assert") {
        _block$1 = Token$Assert$const;
      } else if (name === "auto") {
        _block$1 = Token$Auto$const;
      } else if (name === "case") {
        _block$1 = Token$Case$const;
      } else if (name === "const") {
        _block$1 = Token$Const$const;
      } else if (name === "delegate") {
        _block$1 = Token$Delegate$const;
      } else if (name === "derive") {
        _block$1 = Token$Derive$const;
      } else if (name === "echo") {
        _block$1 = Token$Echo$const;
      } else if (name === "else") {
        _block$1 = Token$Else$const;
      } else if (name === "fn") {
        _block$1 = Token$Fn$const;
      } else if (name === "if") {
        _block$1 = Token$If$const;
      } else if (name === "implement") {
        _block$1 = Token$Implement$const;
      } else if (name === "import") {
        _block$1 = Token$Import$const;
      } else if (name === "let") {
        _block$1 = Token$Let$const;
      } else if (name === "macro") {
        _block$1 = Token$Macro$const;
      } else if (name === "opaque") {
        _block$1 = Token$Opaque$const;
      } else if (name === "panic") {
        _block$1 = Token$Panic$const;
      } else if (name === "pub") {
        _block$1 = Token$Pub$const;
      } else if (name === "test") {
        _block$1 = Token$Test$const;
      } else if (name === "todo") {
        _block$1 = Token$Todo$const;
      } else if (name === "type") {
        _block$1 = Token$Type$const;
      } else if (name === "use") {
        _block$1 = Token$Use$const;
      } else {
        _block$1 = new Name(name);
      }
      let token$1 = _block$1;
      let lexer$2 = new Lexer(lexer$1.original_source, lexer$1.source, lexer$1.byte_offset, lexer$1.preserve_whitespace, lexer$1.preserve_comments, LexerMode$CheckForMinus$const, lexer$1.newlines);
      return [lexer$2, new Some([token$1, new Position(byte_offset)])];
    } else if ($2 === 101) {
      let source = $1.slice(1);
      let byte_offset = lexer.byte_offset;
      let _block;
      let _pipe = advance(lexer, source, 1);
      _block = lex_lowercase_name(_pipe, byte_offset, 1);
      let $3 = _block;
      let lexer$1 = $3[0];
      let name = $3[1];
      let _block$1;
      if (name === "as") {
        _block$1 = Token$As$const;
      } else if (name === "assert") {
        _block$1 = Token$Assert$const;
      } else if (name === "auto") {
        _block$1 = Token$Auto$const;
      } else if (name === "case") {
        _block$1 = Token$Case$const;
      } else if (name === "const") {
        _block$1 = Token$Const$const;
      } else if (name === "delegate") {
        _block$1 = Token$Delegate$const;
      } else if (name === "derive") {
        _block$1 = Token$Derive$const;
      } else if (name === "echo") {
        _block$1 = Token$Echo$const;
      } else if (name === "else") {
        _block$1 = Token$Else$const;
      } else if (name === "fn") {
        _block$1 = Token$Fn$const;
      } else if (name === "if") {
        _block$1 = Token$If$const;
      } else if (name === "implement") {
        _block$1 = Token$Implement$const;
      } else if (name === "import") {
        _block$1 = Token$Import$const;
      } else if (name === "let") {
        _block$1 = Token$Let$const;
      } else if (name === "macro") {
        _block$1 = Token$Macro$const;
      } else if (name === "opaque") {
        _block$1 = Token$Opaque$const;
      } else if (name === "panic") {
        _block$1 = Token$Panic$const;
      } else if (name === "pub") {
        _block$1 = Token$Pub$const;
      } else if (name === "test") {
        _block$1 = Token$Test$const;
      } else if (name === "todo") {
        _block$1 = Token$Todo$const;
      } else if (name === "type") {
        _block$1 = Token$Type$const;
      } else if (name === "use") {
        _block$1 = Token$Use$const;
      } else {
        _block$1 = new Name(name);
      }
      let token$1 = _block$1;
      let lexer$2 = new Lexer(lexer$1.original_source, lexer$1.source, lexer$1.byte_offset, lexer$1.preserve_whitespace, lexer$1.preserve_comments, LexerMode$CheckForMinus$const, lexer$1.newlines);
      return [lexer$2, new Some([token$1, new Position(byte_offset)])];
    } else if ($2 === 102) {
      let source = $1.slice(1);
      let byte_offset = lexer.byte_offset;
      let _block;
      let _pipe = advance(lexer, source, 1);
      _block = lex_lowercase_name(_pipe, byte_offset, 1);
      let $3 = _block;
      let lexer$1 = $3[0];
      let name = $3[1];
      let _block$1;
      if (name === "as") {
        _block$1 = Token$As$const;
      } else if (name === "assert") {
        _block$1 = Token$Assert$const;
      } else if (name === "auto") {
        _block$1 = Token$Auto$const;
      } else if (name === "case") {
        _block$1 = Token$Case$const;
      } else if (name === "const") {
        _block$1 = Token$Const$const;
      } else if (name === "delegate") {
        _block$1 = Token$Delegate$const;
      } else if (name === "derive") {
        _block$1 = Token$Derive$const;
      } else if (name === "echo") {
        _block$1 = Token$Echo$const;
      } else if (name === "else") {
        _block$1 = Token$Else$const;
      } else if (name === "fn") {
        _block$1 = Token$Fn$const;
      } else if (name === "if") {
        _block$1 = Token$If$const;
      } else if (name === "implement") {
        _block$1 = Token$Implement$const;
      } else if (name === "import") {
        _block$1 = Token$Import$const;
      } else if (name === "let") {
        _block$1 = Token$Let$const;
      } else if (name === "macro") {
        _block$1 = Token$Macro$const;
      } else if (name === "opaque") {
        _block$1 = Token$Opaque$const;
      } else if (name === "panic") {
        _block$1 = Token$Panic$const;
      } else if (name === "pub") {
        _block$1 = Token$Pub$const;
      } else if (name === "test") {
        _block$1 = Token$Test$const;
      } else if (name === "todo") {
        _block$1 = Token$Todo$const;
      } else if (name === "type") {
        _block$1 = Token$Type$const;
      } else if (name === "use") {
        _block$1 = Token$Use$const;
      } else {
        _block$1 = new Name(name);
      }
      let token$1 = _block$1;
      let lexer$2 = new Lexer(lexer$1.original_source, lexer$1.source, lexer$1.byte_offset, lexer$1.preserve_whitespace, lexer$1.preserve_comments, LexerMode$CheckForMinus$const, lexer$1.newlines);
      return [lexer$2, new Some([token$1, new Position(byte_offset)])];
    } else if ($2 === 103) {
      let source = $1.slice(1);
      let byte_offset = lexer.byte_offset;
      let _block;
      let _pipe = advance(lexer, source, 1);
      _block = lex_lowercase_name(_pipe, byte_offset, 1);
      let $3 = _block;
      let lexer$1 = $3[0];
      let name = $3[1];
      let _block$1;
      if (name === "as") {
        _block$1 = Token$As$const;
      } else if (name === "assert") {
        _block$1 = Token$Assert$const;
      } else if (name === "auto") {
        _block$1 = Token$Auto$const;
      } else if (name === "case") {
        _block$1 = Token$Case$const;
      } else if (name === "const") {
        _block$1 = Token$Const$const;
      } else if (name === "delegate") {
        _block$1 = Token$Delegate$const;
      } else if (name === "derive") {
        _block$1 = Token$Derive$const;
      } else if (name === "echo") {
        _block$1 = Token$Echo$const;
      } else if (name === "else") {
        _block$1 = Token$Else$const;
      } else if (name === "fn") {
        _block$1 = Token$Fn$const;
      } else if (name === "if") {
        _block$1 = Token$If$const;
      } else if (name === "implement") {
        _block$1 = Token$Implement$const;
      } else if (name === "import") {
        _block$1 = Token$Import$const;
      } else if (name === "let") {
        _block$1 = Token$Let$const;
      } else if (name === "macro") {
        _block$1 = Token$Macro$const;
      } else if (name === "opaque") {
        _block$1 = Token$Opaque$const;
      } else if (name === "panic") {
        _block$1 = Token$Panic$const;
      } else if (name === "pub") {
        _block$1 = Token$Pub$const;
      } else if (name === "test") {
        _block$1 = Token$Test$const;
      } else if (name === "todo") {
        _block$1 = Token$Todo$const;
      } else if (name === "type") {
        _block$1 = Token$Type$const;
      } else if (name === "use") {
        _block$1 = Token$Use$const;
      } else {
        _block$1 = new Name(name);
      }
      let token$1 = _block$1;
      let lexer$2 = new Lexer(lexer$1.original_source, lexer$1.source, lexer$1.byte_offset, lexer$1.preserve_whitespace, lexer$1.preserve_comments, LexerMode$CheckForMinus$const, lexer$1.newlines);
      return [lexer$2, new Some([token$1, new Position(byte_offset)])];
    } else if ($2 === 104) {
      let source = $1.slice(1);
      let byte_offset = lexer.byte_offset;
      let _block;
      let _pipe = advance(lexer, source, 1);
      _block = lex_lowercase_name(_pipe, byte_offset, 1);
      let $3 = _block;
      let lexer$1 = $3[0];
      let name = $3[1];
      let _block$1;
      if (name === "as") {
        _block$1 = Token$As$const;
      } else if (name === "assert") {
        _block$1 = Token$Assert$const;
      } else if (name === "auto") {
        _block$1 = Token$Auto$const;
      } else if (name === "case") {
        _block$1 = Token$Case$const;
      } else if (name === "const") {
        _block$1 = Token$Const$const;
      } else if (name === "delegate") {
        _block$1 = Token$Delegate$const;
      } else if (name === "derive") {
        _block$1 = Token$Derive$const;
      } else if (name === "echo") {
        _block$1 = Token$Echo$const;
      } else if (name === "else") {
        _block$1 = Token$Else$const;
      } else if (name === "fn") {
        _block$1 = Token$Fn$const;
      } else if (name === "if") {
        _block$1 = Token$If$const;
      } else if (name === "implement") {
        _block$1 = Token$Implement$const;
      } else if (name === "import") {
        _block$1 = Token$Import$const;
      } else if (name === "let") {
        _block$1 = Token$Let$const;
      } else if (name === "macro") {
        _block$1 = Token$Macro$const;
      } else if (name === "opaque") {
        _block$1 = Token$Opaque$const;
      } else if (name === "panic") {
        _block$1 = Token$Panic$const;
      } else if (name === "pub") {
        _block$1 = Token$Pub$const;
      } else if (name === "test") {
        _block$1 = Token$Test$const;
      } else if (name === "todo") {
        _block$1 = Token$Todo$const;
      } else if (name === "type") {
        _block$1 = Token$Type$const;
      } else if (name === "use") {
        _block$1 = Token$Use$const;
      } else {
        _block$1 = new Name(name);
      }
      let token$1 = _block$1;
      let lexer$2 = new Lexer(lexer$1.original_source, lexer$1.source, lexer$1.byte_offset, lexer$1.preserve_whitespace, lexer$1.preserve_comments, LexerMode$CheckForMinus$const, lexer$1.newlines);
      return [lexer$2, new Some([token$1, new Position(byte_offset)])];
    } else if ($2 === 105) {
      let source = $1.slice(1);
      let byte_offset = lexer.byte_offset;
      let _block;
      let _pipe = advance(lexer, source, 1);
      _block = lex_lowercase_name(_pipe, byte_offset, 1);
      let $3 = _block;
      let lexer$1 = $3[0];
      let name = $3[1];
      let _block$1;
      if (name === "as") {
        _block$1 = Token$As$const;
      } else if (name === "assert") {
        _block$1 = Token$Assert$const;
      } else if (name === "auto") {
        _block$1 = Token$Auto$const;
      } else if (name === "case") {
        _block$1 = Token$Case$const;
      } else if (name === "const") {
        _block$1 = Token$Const$const;
      } else if (name === "delegate") {
        _block$1 = Token$Delegate$const;
      } else if (name === "derive") {
        _block$1 = Token$Derive$const;
      } else if (name === "echo") {
        _block$1 = Token$Echo$const;
      } else if (name === "else") {
        _block$1 = Token$Else$const;
      } else if (name === "fn") {
        _block$1 = Token$Fn$const;
      } else if (name === "if") {
        _block$1 = Token$If$const;
      } else if (name === "implement") {
        _block$1 = Token$Implement$const;
      } else if (name === "import") {
        _block$1 = Token$Import$const;
      } else if (name === "let") {
        _block$1 = Token$Let$const;
      } else if (name === "macro") {
        _block$1 = Token$Macro$const;
      } else if (name === "opaque") {
        _block$1 = Token$Opaque$const;
      } else if (name === "panic") {
        _block$1 = Token$Panic$const;
      } else if (name === "pub") {
        _block$1 = Token$Pub$const;
      } else if (name === "test") {
        _block$1 = Token$Test$const;
      } else if (name === "todo") {
        _block$1 = Token$Todo$const;
      } else if (name === "type") {
        _block$1 = Token$Type$const;
      } else if (name === "use") {
        _block$1 = Token$Use$const;
      } else {
        _block$1 = new Name(name);
      }
      let token$1 = _block$1;
      let lexer$2 = new Lexer(lexer$1.original_source, lexer$1.source, lexer$1.byte_offset, lexer$1.preserve_whitespace, lexer$1.preserve_comments, LexerMode$CheckForMinus$const, lexer$1.newlines);
      return [lexer$2, new Some([token$1, new Position(byte_offset)])];
    } else if ($2 === 106) {
      let source = $1.slice(1);
      let byte_offset = lexer.byte_offset;
      let _block;
      let _pipe = advance(lexer, source, 1);
      _block = lex_lowercase_name(_pipe, byte_offset, 1);
      let $3 = _block;
      let lexer$1 = $3[0];
      let name = $3[1];
      let _block$1;
      if (name === "as") {
        _block$1 = Token$As$const;
      } else if (name === "assert") {
        _block$1 = Token$Assert$const;
      } else if (name === "auto") {
        _block$1 = Token$Auto$const;
      } else if (name === "case") {
        _block$1 = Token$Case$const;
      } else if (name === "const") {
        _block$1 = Token$Const$const;
      } else if (name === "delegate") {
        _block$1 = Token$Delegate$const;
      } else if (name === "derive") {
        _block$1 = Token$Derive$const;
      } else if (name === "echo") {
        _block$1 = Token$Echo$const;
      } else if (name === "else") {
        _block$1 = Token$Else$const;
      } else if (name === "fn") {
        _block$1 = Token$Fn$const;
      } else if (name === "if") {
        _block$1 = Token$If$const;
      } else if (name === "implement") {
        _block$1 = Token$Implement$const;
      } else if (name === "import") {
        _block$1 = Token$Import$const;
      } else if (name === "let") {
        _block$1 = Token$Let$const;
      } else if (name === "macro") {
        _block$1 = Token$Macro$const;
      } else if (name === "opaque") {
        _block$1 = Token$Opaque$const;
      } else if (name === "panic") {
        _block$1 = Token$Panic$const;
      } else if (name === "pub") {
        _block$1 = Token$Pub$const;
      } else if (name === "test") {
        _block$1 = Token$Test$const;
      } else if (name === "todo") {
        _block$1 = Token$Todo$const;
      } else if (name === "type") {
        _block$1 = Token$Type$const;
      } else if (name === "use") {
        _block$1 = Token$Use$const;
      } else {
        _block$1 = new Name(name);
      }
      let token$1 = _block$1;
      let lexer$2 = new Lexer(lexer$1.original_source, lexer$1.source, lexer$1.byte_offset, lexer$1.preserve_whitespace, lexer$1.preserve_comments, LexerMode$CheckForMinus$const, lexer$1.newlines);
      return [lexer$2, new Some([token$1, new Position(byte_offset)])];
    } else if ($2 === 107) {
      let source = $1.slice(1);
      let byte_offset = lexer.byte_offset;
      let _block;
      let _pipe = advance(lexer, source, 1);
      _block = lex_lowercase_name(_pipe, byte_offset, 1);
      let $3 = _block;
      let lexer$1 = $3[0];
      let name = $3[1];
      let _block$1;
      if (name === "as") {
        _block$1 = Token$As$const;
      } else if (name === "assert") {
        _block$1 = Token$Assert$const;
      } else if (name === "auto") {
        _block$1 = Token$Auto$const;
      } else if (name === "case") {
        _block$1 = Token$Case$const;
      } else if (name === "const") {
        _block$1 = Token$Const$const;
      } else if (name === "delegate") {
        _block$1 = Token$Delegate$const;
      } else if (name === "derive") {
        _block$1 = Token$Derive$const;
      } else if (name === "echo") {
        _block$1 = Token$Echo$const;
      } else if (name === "else") {
        _block$1 = Token$Else$const;
      } else if (name === "fn") {
        _block$1 = Token$Fn$const;
      } else if (name === "if") {
        _block$1 = Token$If$const;
      } else if (name === "implement") {
        _block$1 = Token$Implement$const;
      } else if (name === "import") {
        _block$1 = Token$Import$const;
      } else if (name === "let") {
        _block$1 = Token$Let$const;
      } else if (name === "macro") {
        _block$1 = Token$Macro$const;
      } else if (name === "opaque") {
        _block$1 = Token$Opaque$const;
      } else if (name === "panic") {
        _block$1 = Token$Panic$const;
      } else if (name === "pub") {
        _block$1 = Token$Pub$const;
      } else if (name === "test") {
        _block$1 = Token$Test$const;
      } else if (name === "todo") {
        _block$1 = Token$Todo$const;
      } else if (name === "type") {
        _block$1 = Token$Type$const;
      } else if (name === "use") {
        _block$1 = Token$Use$const;
      } else {
        _block$1 = new Name(name);
      }
      let token$1 = _block$1;
      let lexer$2 = new Lexer(lexer$1.original_source, lexer$1.source, lexer$1.byte_offset, lexer$1.preserve_whitespace, lexer$1.preserve_comments, LexerMode$CheckForMinus$const, lexer$1.newlines);
      return [lexer$2, new Some([token$1, new Position(byte_offset)])];
    } else if ($2 === 108) {
      let source = $1.slice(1);
      let byte_offset = lexer.byte_offset;
      let _block;
      let _pipe = advance(lexer, source, 1);
      _block = lex_lowercase_name(_pipe, byte_offset, 1);
      let $3 = _block;
      let lexer$1 = $3[0];
      let name = $3[1];
      let _block$1;
      if (name === "as") {
        _block$1 = Token$As$const;
      } else if (name === "assert") {
        _block$1 = Token$Assert$const;
      } else if (name === "auto") {
        _block$1 = Token$Auto$const;
      } else if (name === "case") {
        _block$1 = Token$Case$const;
      } else if (name === "const") {
        _block$1 = Token$Const$const;
      } else if (name === "delegate") {
        _block$1 = Token$Delegate$const;
      } else if (name === "derive") {
        _block$1 = Token$Derive$const;
      } else if (name === "echo") {
        _block$1 = Token$Echo$const;
      } else if (name === "else") {
        _block$1 = Token$Else$const;
      } else if (name === "fn") {
        _block$1 = Token$Fn$const;
      } else if (name === "if") {
        _block$1 = Token$If$const;
      } else if (name === "implement") {
        _block$1 = Token$Implement$const;
      } else if (name === "import") {
        _block$1 = Token$Import$const;
      } else if (name === "let") {
        _block$1 = Token$Let$const;
      } else if (name === "macro") {
        _block$1 = Token$Macro$const;
      } else if (name === "opaque") {
        _block$1 = Token$Opaque$const;
      } else if (name === "panic") {
        _block$1 = Token$Panic$const;
      } else if (name === "pub") {
        _block$1 = Token$Pub$const;
      } else if (name === "test") {
        _block$1 = Token$Test$const;
      } else if (name === "todo") {
        _block$1 = Token$Todo$const;
      } else if (name === "type") {
        _block$1 = Token$Type$const;
      } else if (name === "use") {
        _block$1 = Token$Use$const;
      } else {
        _block$1 = new Name(name);
      }
      let token$1 = _block$1;
      let lexer$2 = new Lexer(lexer$1.original_source, lexer$1.source, lexer$1.byte_offset, lexer$1.preserve_whitespace, lexer$1.preserve_comments, LexerMode$CheckForMinus$const, lexer$1.newlines);
      return [lexer$2, new Some([token$1, new Position(byte_offset)])];
    } else if ($2 === 109) {
      let source = $1.slice(1);
      let byte_offset = lexer.byte_offset;
      let _block;
      let _pipe = advance(lexer, source, 1);
      _block = lex_lowercase_name(_pipe, byte_offset, 1);
      let $3 = _block;
      let lexer$1 = $3[0];
      let name = $3[1];
      let _block$1;
      if (name === "as") {
        _block$1 = Token$As$const;
      } else if (name === "assert") {
        _block$1 = Token$Assert$const;
      } else if (name === "auto") {
        _block$1 = Token$Auto$const;
      } else if (name === "case") {
        _block$1 = Token$Case$const;
      } else if (name === "const") {
        _block$1 = Token$Const$const;
      } else if (name === "delegate") {
        _block$1 = Token$Delegate$const;
      } else if (name === "derive") {
        _block$1 = Token$Derive$const;
      } else if (name === "echo") {
        _block$1 = Token$Echo$const;
      } else if (name === "else") {
        _block$1 = Token$Else$const;
      } else if (name === "fn") {
        _block$1 = Token$Fn$const;
      } else if (name === "if") {
        _block$1 = Token$If$const;
      } else if (name === "implement") {
        _block$1 = Token$Implement$const;
      } else if (name === "import") {
        _block$1 = Token$Import$const;
      } else if (name === "let") {
        _block$1 = Token$Let$const;
      } else if (name === "macro") {
        _block$1 = Token$Macro$const;
      } else if (name === "opaque") {
        _block$1 = Token$Opaque$const;
      } else if (name === "panic") {
        _block$1 = Token$Panic$const;
      } else if (name === "pub") {
        _block$1 = Token$Pub$const;
      } else if (name === "test") {
        _block$1 = Token$Test$const;
      } else if (name === "todo") {
        _block$1 = Token$Todo$const;
      } else if (name === "type") {
        _block$1 = Token$Type$const;
      } else if (name === "use") {
        _block$1 = Token$Use$const;
      } else {
        _block$1 = new Name(name);
      }
      let token$1 = _block$1;
      let lexer$2 = new Lexer(lexer$1.original_source, lexer$1.source, lexer$1.byte_offset, lexer$1.preserve_whitespace, lexer$1.preserve_comments, LexerMode$CheckForMinus$const, lexer$1.newlines);
      return [lexer$2, new Some([token$1, new Position(byte_offset)])];
    } else if ($2 === 110) {
      let source = $1.slice(1);
      let byte_offset = lexer.byte_offset;
      let _block;
      let _pipe = advance(lexer, source, 1);
      _block = lex_lowercase_name(_pipe, byte_offset, 1);
      let $3 = _block;
      let lexer$1 = $3[0];
      let name = $3[1];
      let _block$1;
      if (name === "as") {
        _block$1 = Token$As$const;
      } else if (name === "assert") {
        _block$1 = Token$Assert$const;
      } else if (name === "auto") {
        _block$1 = Token$Auto$const;
      } else if (name === "case") {
        _block$1 = Token$Case$const;
      } else if (name === "const") {
        _block$1 = Token$Const$const;
      } else if (name === "delegate") {
        _block$1 = Token$Delegate$const;
      } else if (name === "derive") {
        _block$1 = Token$Derive$const;
      } else if (name === "echo") {
        _block$1 = Token$Echo$const;
      } else if (name === "else") {
        _block$1 = Token$Else$const;
      } else if (name === "fn") {
        _block$1 = Token$Fn$const;
      } else if (name === "if") {
        _block$1 = Token$If$const;
      } else if (name === "implement") {
        _block$1 = Token$Implement$const;
      } else if (name === "import") {
        _block$1 = Token$Import$const;
      } else if (name === "let") {
        _block$1 = Token$Let$const;
      } else if (name === "macro") {
        _block$1 = Token$Macro$const;
      } else if (name === "opaque") {
        _block$1 = Token$Opaque$const;
      } else if (name === "panic") {
        _block$1 = Token$Panic$const;
      } else if (name === "pub") {
        _block$1 = Token$Pub$const;
      } else if (name === "test") {
        _block$1 = Token$Test$const;
      } else if (name === "todo") {
        _block$1 = Token$Todo$const;
      } else if (name === "type") {
        _block$1 = Token$Type$const;
      } else if (name === "use") {
        _block$1 = Token$Use$const;
      } else {
        _block$1 = new Name(name);
      }
      let token$1 = _block$1;
      let lexer$2 = new Lexer(lexer$1.original_source, lexer$1.source, lexer$1.byte_offset, lexer$1.preserve_whitespace, lexer$1.preserve_comments, LexerMode$CheckForMinus$const, lexer$1.newlines);
      return [lexer$2, new Some([token$1, new Position(byte_offset)])];
    } else if ($2 === 111) {
      let source = $1.slice(1);
      let byte_offset = lexer.byte_offset;
      let _block;
      let _pipe = advance(lexer, source, 1);
      _block = lex_lowercase_name(_pipe, byte_offset, 1);
      let $3 = _block;
      let lexer$1 = $3[0];
      let name = $3[1];
      let _block$1;
      if (name === "as") {
        _block$1 = Token$As$const;
      } else if (name === "assert") {
        _block$1 = Token$Assert$const;
      } else if (name === "auto") {
        _block$1 = Token$Auto$const;
      } else if (name === "case") {
        _block$1 = Token$Case$const;
      } else if (name === "const") {
        _block$1 = Token$Const$const;
      } else if (name === "delegate") {
        _block$1 = Token$Delegate$const;
      } else if (name === "derive") {
        _block$1 = Token$Derive$const;
      } else if (name === "echo") {
        _block$1 = Token$Echo$const;
      } else if (name === "else") {
        _block$1 = Token$Else$const;
      } else if (name === "fn") {
        _block$1 = Token$Fn$const;
      } else if (name === "if") {
        _block$1 = Token$If$const;
      } else if (name === "implement") {
        _block$1 = Token$Implement$const;
      } else if (name === "import") {
        _block$1 = Token$Import$const;
      } else if (name === "let") {
        _block$1 = Token$Let$const;
      } else if (name === "macro") {
        _block$1 = Token$Macro$const;
      } else if (name === "opaque") {
        _block$1 = Token$Opaque$const;
      } else if (name === "panic") {
        _block$1 = Token$Panic$const;
      } else if (name === "pub") {
        _block$1 = Token$Pub$const;
      } else if (name === "test") {
        _block$1 = Token$Test$const;
      } else if (name === "todo") {
        _block$1 = Token$Todo$const;
      } else if (name === "type") {
        _block$1 = Token$Type$const;
      } else if (name === "use") {
        _block$1 = Token$Use$const;
      } else {
        _block$1 = new Name(name);
      }
      let token$1 = _block$1;
      let lexer$2 = new Lexer(lexer$1.original_source, lexer$1.source, lexer$1.byte_offset, lexer$1.preserve_whitespace, lexer$1.preserve_comments, LexerMode$CheckForMinus$const, lexer$1.newlines);
      return [lexer$2, new Some([token$1, new Position(byte_offset)])];
    } else if ($2 === 112) {
      let source = $1.slice(1);
      let byte_offset = lexer.byte_offset;
      let _block;
      let _pipe = advance(lexer, source, 1);
      _block = lex_lowercase_name(_pipe, byte_offset, 1);
      let $3 = _block;
      let lexer$1 = $3[0];
      let name = $3[1];
      let _block$1;
      if (name === "as") {
        _block$1 = Token$As$const;
      } else if (name === "assert") {
        _block$1 = Token$Assert$const;
      } else if (name === "auto") {
        _block$1 = Token$Auto$const;
      } else if (name === "case") {
        _block$1 = Token$Case$const;
      } else if (name === "const") {
        _block$1 = Token$Const$const;
      } else if (name === "delegate") {
        _block$1 = Token$Delegate$const;
      } else if (name === "derive") {
        _block$1 = Token$Derive$const;
      } else if (name === "echo") {
        _block$1 = Token$Echo$const;
      } else if (name === "else") {
        _block$1 = Token$Else$const;
      } else if (name === "fn") {
        _block$1 = Token$Fn$const;
      } else if (name === "if") {
        _block$1 = Token$If$const;
      } else if (name === "implement") {
        _block$1 = Token$Implement$const;
      } else if (name === "import") {
        _block$1 = Token$Import$const;
      } else if (name === "let") {
        _block$1 = Token$Let$const;
      } else if (name === "macro") {
        _block$1 = Token$Macro$const;
      } else if (name === "opaque") {
        _block$1 = Token$Opaque$const;
      } else if (name === "panic") {
        _block$1 = Token$Panic$const;
      } else if (name === "pub") {
        _block$1 = Token$Pub$const;
      } else if (name === "test") {
        _block$1 = Token$Test$const;
      } else if (name === "todo") {
        _block$1 = Token$Todo$const;
      } else if (name === "type") {
        _block$1 = Token$Type$const;
      } else if (name === "use") {
        _block$1 = Token$Use$const;
      } else {
        _block$1 = new Name(name);
      }
      let token$1 = _block$1;
      let lexer$2 = new Lexer(lexer$1.original_source, lexer$1.source, lexer$1.byte_offset, lexer$1.preserve_whitespace, lexer$1.preserve_comments, LexerMode$CheckForMinus$const, lexer$1.newlines);
      return [lexer$2, new Some([token$1, new Position(byte_offset)])];
    } else if ($2 === 113) {
      let source = $1.slice(1);
      let byte_offset = lexer.byte_offset;
      let _block;
      let _pipe = advance(lexer, source, 1);
      _block = lex_lowercase_name(_pipe, byte_offset, 1);
      let $3 = _block;
      let lexer$1 = $3[0];
      let name = $3[1];
      let _block$1;
      if (name === "as") {
        _block$1 = Token$As$const;
      } else if (name === "assert") {
        _block$1 = Token$Assert$const;
      } else if (name === "auto") {
        _block$1 = Token$Auto$const;
      } else if (name === "case") {
        _block$1 = Token$Case$const;
      } else if (name === "const") {
        _block$1 = Token$Const$const;
      } else if (name === "delegate") {
        _block$1 = Token$Delegate$const;
      } else if (name === "derive") {
        _block$1 = Token$Derive$const;
      } else if (name === "echo") {
        _block$1 = Token$Echo$const;
      } else if (name === "else") {
        _block$1 = Token$Else$const;
      } else if (name === "fn") {
        _block$1 = Token$Fn$const;
      } else if (name === "if") {
        _block$1 = Token$If$const;
      } else if (name === "implement") {
        _block$1 = Token$Implement$const;
      } else if (name === "import") {
        _block$1 = Token$Import$const;
      } else if (name === "let") {
        _block$1 = Token$Let$const;
      } else if (name === "macro") {
        _block$1 = Token$Macro$const;
      } else if (name === "opaque") {
        _block$1 = Token$Opaque$const;
      } else if (name === "panic") {
        _block$1 = Token$Panic$const;
      } else if (name === "pub") {
        _block$1 = Token$Pub$const;
      } else if (name === "test") {
        _block$1 = Token$Test$const;
      } else if (name === "todo") {
        _block$1 = Token$Todo$const;
      } else if (name === "type") {
        _block$1 = Token$Type$const;
      } else if (name === "use") {
        _block$1 = Token$Use$const;
      } else {
        _block$1 = new Name(name);
      }
      let token$1 = _block$1;
      let lexer$2 = new Lexer(lexer$1.original_source, lexer$1.source, lexer$1.byte_offset, lexer$1.preserve_whitespace, lexer$1.preserve_comments, LexerMode$CheckForMinus$const, lexer$1.newlines);
      return [lexer$2, new Some([token$1, new Position(byte_offset)])];
    } else if ($2 === 114) {
      let source = $1.slice(1);
      let byte_offset = lexer.byte_offset;
      let _block;
      let _pipe = advance(lexer, source, 1);
      _block = lex_lowercase_name(_pipe, byte_offset, 1);
      let $3 = _block;
      let lexer$1 = $3[0];
      let name = $3[1];
      let _block$1;
      if (name === "as") {
        _block$1 = Token$As$const;
      } else if (name === "assert") {
        _block$1 = Token$Assert$const;
      } else if (name === "auto") {
        _block$1 = Token$Auto$const;
      } else if (name === "case") {
        _block$1 = Token$Case$const;
      } else if (name === "const") {
        _block$1 = Token$Const$const;
      } else if (name === "delegate") {
        _block$1 = Token$Delegate$const;
      } else if (name === "derive") {
        _block$1 = Token$Derive$const;
      } else if (name === "echo") {
        _block$1 = Token$Echo$const;
      } else if (name === "else") {
        _block$1 = Token$Else$const;
      } else if (name === "fn") {
        _block$1 = Token$Fn$const;
      } else if (name === "if") {
        _block$1 = Token$If$const;
      } else if (name === "implement") {
        _block$1 = Token$Implement$const;
      } else if (name === "import") {
        _block$1 = Token$Import$const;
      } else if (name === "let") {
        _block$1 = Token$Let$const;
      } else if (name === "macro") {
        _block$1 = Token$Macro$const;
      } else if (name === "opaque") {
        _block$1 = Token$Opaque$const;
      } else if (name === "panic") {
        _block$1 = Token$Panic$const;
      } else if (name === "pub") {
        _block$1 = Token$Pub$const;
      } else if (name === "test") {
        _block$1 = Token$Test$const;
      } else if (name === "todo") {
        _block$1 = Token$Todo$const;
      } else if (name === "type") {
        _block$1 = Token$Type$const;
      } else if (name === "use") {
        _block$1 = Token$Use$const;
      } else {
        _block$1 = new Name(name);
      }
      let token$1 = _block$1;
      let lexer$2 = new Lexer(lexer$1.original_source, lexer$1.source, lexer$1.byte_offset, lexer$1.preserve_whitespace, lexer$1.preserve_comments, LexerMode$CheckForMinus$const, lexer$1.newlines);
      return [lexer$2, new Some([token$1, new Position(byte_offset)])];
    } else if ($2 === 115) {
      let source = $1.slice(1);
      let byte_offset = lexer.byte_offset;
      let _block;
      let _pipe = advance(lexer, source, 1);
      _block = lex_lowercase_name(_pipe, byte_offset, 1);
      let $3 = _block;
      let lexer$1 = $3[0];
      let name = $3[1];
      let _block$1;
      if (name === "as") {
        _block$1 = Token$As$const;
      } else if (name === "assert") {
        _block$1 = Token$Assert$const;
      } else if (name === "auto") {
        _block$1 = Token$Auto$const;
      } else if (name === "case") {
        _block$1 = Token$Case$const;
      } else if (name === "const") {
        _block$1 = Token$Const$const;
      } else if (name === "delegate") {
        _block$1 = Token$Delegate$const;
      } else if (name === "derive") {
        _block$1 = Token$Derive$const;
      } else if (name === "echo") {
        _block$1 = Token$Echo$const;
      } else if (name === "else") {
        _block$1 = Token$Else$const;
      } else if (name === "fn") {
        _block$1 = Token$Fn$const;
      } else if (name === "if") {
        _block$1 = Token$If$const;
      } else if (name === "implement") {
        _block$1 = Token$Implement$const;
      } else if (name === "import") {
        _block$1 = Token$Import$const;
      } else if (name === "let") {
        _block$1 = Token$Let$const;
      } else if (name === "macro") {
        _block$1 = Token$Macro$const;
      } else if (name === "opaque") {
        _block$1 = Token$Opaque$const;
      } else if (name === "panic") {
        _block$1 = Token$Panic$const;
      } else if (name === "pub") {
        _block$1 = Token$Pub$const;
      } else if (name === "test") {
        _block$1 = Token$Test$const;
      } else if (name === "todo") {
        _block$1 = Token$Todo$const;
      } else if (name === "type") {
        _block$1 = Token$Type$const;
      } else if (name === "use") {
        _block$1 = Token$Use$const;
      } else {
        _block$1 = new Name(name);
      }
      let token$1 = _block$1;
      let lexer$2 = new Lexer(lexer$1.original_source, lexer$1.source, lexer$1.byte_offset, lexer$1.preserve_whitespace, lexer$1.preserve_comments, LexerMode$CheckForMinus$const, lexer$1.newlines);
      return [lexer$2, new Some([token$1, new Position(byte_offset)])];
    } else if ($2 === 116) {
      let source = $1.slice(1);
      let byte_offset = lexer.byte_offset;
      let _block;
      let _pipe = advance(lexer, source, 1);
      _block = lex_lowercase_name(_pipe, byte_offset, 1);
      let $3 = _block;
      let lexer$1 = $3[0];
      let name = $3[1];
      let _block$1;
      if (name === "as") {
        _block$1 = Token$As$const;
      } else if (name === "assert") {
        _block$1 = Token$Assert$const;
      } else if (name === "auto") {
        _block$1 = Token$Auto$const;
      } else if (name === "case") {
        _block$1 = Token$Case$const;
      } else if (name === "const") {
        _block$1 = Token$Const$const;
      } else if (name === "delegate") {
        _block$1 = Token$Delegate$const;
      } else if (name === "derive") {
        _block$1 = Token$Derive$const;
      } else if (name === "echo") {
        _block$1 = Token$Echo$const;
      } else if (name === "else") {
        _block$1 = Token$Else$const;
      } else if (name === "fn") {
        _block$1 = Token$Fn$const;
      } else if (name === "if") {
        _block$1 = Token$If$const;
      } else if (name === "implement") {
        _block$1 = Token$Implement$const;
      } else if (name === "import") {
        _block$1 = Token$Import$const;
      } else if (name === "let") {
        _block$1 = Token$Let$const;
      } else if (name === "macro") {
        _block$1 = Token$Macro$const;
      } else if (name === "opaque") {
        _block$1 = Token$Opaque$const;
      } else if (name === "panic") {
        _block$1 = Token$Panic$const;
      } else if (name === "pub") {
        _block$1 = Token$Pub$const;
      } else if (name === "test") {
        _block$1 = Token$Test$const;
      } else if (name === "todo") {
        _block$1 = Token$Todo$const;
      } else if (name === "type") {
        _block$1 = Token$Type$const;
      } else if (name === "use") {
        _block$1 = Token$Use$const;
      } else {
        _block$1 = new Name(name);
      }
      let token$1 = _block$1;
      let lexer$2 = new Lexer(lexer$1.original_source, lexer$1.source, lexer$1.byte_offset, lexer$1.preserve_whitespace, lexer$1.preserve_comments, LexerMode$CheckForMinus$const, lexer$1.newlines);
      return [lexer$2, new Some([token$1, new Position(byte_offset)])];
    } else if ($2 === 117) {
      let source = $1.slice(1);
      let byte_offset = lexer.byte_offset;
      let _block;
      let _pipe = advance(lexer, source, 1);
      _block = lex_lowercase_name(_pipe, byte_offset, 1);
      let $3 = _block;
      let lexer$1 = $3[0];
      let name = $3[1];
      let _block$1;
      if (name === "as") {
        _block$1 = Token$As$const;
      } else if (name === "assert") {
        _block$1 = Token$Assert$const;
      } else if (name === "auto") {
        _block$1 = Token$Auto$const;
      } else if (name === "case") {
        _block$1 = Token$Case$const;
      } else if (name === "const") {
        _block$1 = Token$Const$const;
      } else if (name === "delegate") {
        _block$1 = Token$Delegate$const;
      } else if (name === "derive") {
        _block$1 = Token$Derive$const;
      } else if (name === "echo") {
        _block$1 = Token$Echo$const;
      } else if (name === "else") {
        _block$1 = Token$Else$const;
      } else if (name === "fn") {
        _block$1 = Token$Fn$const;
      } else if (name === "if") {
        _block$1 = Token$If$const;
      } else if (name === "implement") {
        _block$1 = Token$Implement$const;
      } else if (name === "import") {
        _block$1 = Token$Import$const;
      } else if (name === "let") {
        _block$1 = Token$Let$const;
      } else if (name === "macro") {
        _block$1 = Token$Macro$const;
      } else if (name === "opaque") {
        _block$1 = Token$Opaque$const;
      } else if (name === "panic") {
        _block$1 = Token$Panic$const;
      } else if (name === "pub") {
        _block$1 = Token$Pub$const;
      } else if (name === "test") {
        _block$1 = Token$Test$const;
      } else if (name === "todo") {
        _block$1 = Token$Todo$const;
      } else if (name === "type") {
        _block$1 = Token$Type$const;
      } else if (name === "use") {
        _block$1 = Token$Use$const;
      } else {
        _block$1 = new Name(name);
      }
      let token$1 = _block$1;
      let lexer$2 = new Lexer(lexer$1.original_source, lexer$1.source, lexer$1.byte_offset, lexer$1.preserve_whitespace, lexer$1.preserve_comments, LexerMode$CheckForMinus$const, lexer$1.newlines);
      return [lexer$2, new Some([token$1, new Position(byte_offset)])];
    } else if ($2 === 118) {
      let source = $1.slice(1);
      let byte_offset = lexer.byte_offset;
      let _block;
      let _pipe = advance(lexer, source, 1);
      _block = lex_lowercase_name(_pipe, byte_offset, 1);
      let $3 = _block;
      let lexer$1 = $3[0];
      let name = $3[1];
      let _block$1;
      if (name === "as") {
        _block$1 = Token$As$const;
      } else if (name === "assert") {
        _block$1 = Token$Assert$const;
      } else if (name === "auto") {
        _block$1 = Token$Auto$const;
      } else if (name === "case") {
        _block$1 = Token$Case$const;
      } else if (name === "const") {
        _block$1 = Token$Const$const;
      } else if (name === "delegate") {
        _block$1 = Token$Delegate$const;
      } else if (name === "derive") {
        _block$1 = Token$Derive$const;
      } else if (name === "echo") {
        _block$1 = Token$Echo$const;
      } else if (name === "else") {
        _block$1 = Token$Else$const;
      } else if (name === "fn") {
        _block$1 = Token$Fn$const;
      } else if (name === "if") {
        _block$1 = Token$If$const;
      } else if (name === "implement") {
        _block$1 = Token$Implement$const;
      } else if (name === "import") {
        _block$1 = Token$Import$const;
      } else if (name === "let") {
        _block$1 = Token$Let$const;
      } else if (name === "macro") {
        _block$1 = Token$Macro$const;
      } else if (name === "opaque") {
        _block$1 = Token$Opaque$const;
      } else if (name === "panic") {
        _block$1 = Token$Panic$const;
      } else if (name === "pub") {
        _block$1 = Token$Pub$const;
      } else if (name === "test") {
        _block$1 = Token$Test$const;
      } else if (name === "todo") {
        _block$1 = Token$Todo$const;
      } else if (name === "type") {
        _block$1 = Token$Type$const;
      } else if (name === "use") {
        _block$1 = Token$Use$const;
      } else {
        _block$1 = new Name(name);
      }
      let token$1 = _block$1;
      let lexer$2 = new Lexer(lexer$1.original_source, lexer$1.source, lexer$1.byte_offset, lexer$1.preserve_whitespace, lexer$1.preserve_comments, LexerMode$CheckForMinus$const, lexer$1.newlines);
      return [lexer$2, new Some([token$1, new Position(byte_offset)])];
    } else if ($2 === 119) {
      let source = $1.slice(1);
      let byte_offset = lexer.byte_offset;
      let _block;
      let _pipe = advance(lexer, source, 1);
      _block = lex_lowercase_name(_pipe, byte_offset, 1);
      let $3 = _block;
      let lexer$1 = $3[0];
      let name = $3[1];
      let _block$1;
      if (name === "as") {
        _block$1 = Token$As$const;
      } else if (name === "assert") {
        _block$1 = Token$Assert$const;
      } else if (name === "auto") {
        _block$1 = Token$Auto$const;
      } else if (name === "case") {
        _block$1 = Token$Case$const;
      } else if (name === "const") {
        _block$1 = Token$Const$const;
      } else if (name === "delegate") {
        _block$1 = Token$Delegate$const;
      } else if (name === "derive") {
        _block$1 = Token$Derive$const;
      } else if (name === "echo") {
        _block$1 = Token$Echo$const;
      } else if (name === "else") {
        _block$1 = Token$Else$const;
      } else if (name === "fn") {
        _block$1 = Token$Fn$const;
      } else if (name === "if") {
        _block$1 = Token$If$const;
      } else if (name === "implement") {
        _block$1 = Token$Implement$const;
      } else if (name === "import") {
        _block$1 = Token$Import$const;
      } else if (name === "let") {
        _block$1 = Token$Let$const;
      } else if (name === "macro") {
        _block$1 = Token$Macro$const;
      } else if (name === "opaque") {
        _block$1 = Token$Opaque$const;
      } else if (name === "panic") {
        _block$1 = Token$Panic$const;
      } else if (name === "pub") {
        _block$1 = Token$Pub$const;
      } else if (name === "test") {
        _block$1 = Token$Test$const;
      } else if (name === "todo") {
        _block$1 = Token$Todo$const;
      } else if (name === "type") {
        _block$1 = Token$Type$const;
      } else if (name === "use") {
        _block$1 = Token$Use$const;
      } else {
        _block$1 = new Name(name);
      }
      let token$1 = _block$1;
      let lexer$2 = new Lexer(lexer$1.original_source, lexer$1.source, lexer$1.byte_offset, lexer$1.preserve_whitespace, lexer$1.preserve_comments, LexerMode$CheckForMinus$const, lexer$1.newlines);
      return [lexer$2, new Some([token$1, new Position(byte_offset)])];
    } else if ($2 === 120) {
      let source = $1.slice(1);
      let byte_offset = lexer.byte_offset;
      let _block;
      let _pipe = advance(lexer, source, 1);
      _block = lex_lowercase_name(_pipe, byte_offset, 1);
      let $3 = _block;
      let lexer$1 = $3[0];
      let name = $3[1];
      let _block$1;
      if (name === "as") {
        _block$1 = Token$As$const;
      } else if (name === "assert") {
        _block$1 = Token$Assert$const;
      } else if (name === "auto") {
        _block$1 = Token$Auto$const;
      } else if (name === "case") {
        _block$1 = Token$Case$const;
      } else if (name === "const") {
        _block$1 = Token$Const$const;
      } else if (name === "delegate") {
        _block$1 = Token$Delegate$const;
      } else if (name === "derive") {
        _block$1 = Token$Derive$const;
      } else if (name === "echo") {
        _block$1 = Token$Echo$const;
      } else if (name === "else") {
        _block$1 = Token$Else$const;
      } else if (name === "fn") {
        _block$1 = Token$Fn$const;
      } else if (name === "if") {
        _block$1 = Token$If$const;
      } else if (name === "implement") {
        _block$1 = Token$Implement$const;
      } else if (name === "import") {
        _block$1 = Token$Import$const;
      } else if (name === "let") {
        _block$1 = Token$Let$const;
      } else if (name === "macro") {
        _block$1 = Token$Macro$const;
      } else if (name === "opaque") {
        _block$1 = Token$Opaque$const;
      } else if (name === "panic") {
        _block$1 = Token$Panic$const;
      } else if (name === "pub") {
        _block$1 = Token$Pub$const;
      } else if (name === "test") {
        _block$1 = Token$Test$const;
      } else if (name === "todo") {
        _block$1 = Token$Todo$const;
      } else if (name === "type") {
        _block$1 = Token$Type$const;
      } else if (name === "use") {
        _block$1 = Token$Use$const;
      } else {
        _block$1 = new Name(name);
      }
      let token$1 = _block$1;
      let lexer$2 = new Lexer(lexer$1.original_source, lexer$1.source, lexer$1.byte_offset, lexer$1.preserve_whitespace, lexer$1.preserve_comments, LexerMode$CheckForMinus$const, lexer$1.newlines);
      return [lexer$2, new Some([token$1, new Position(byte_offset)])];
    } else if ($2 === 121) {
      let source = $1.slice(1);
      let byte_offset = lexer.byte_offset;
      let _block;
      let _pipe = advance(lexer, source, 1);
      _block = lex_lowercase_name(_pipe, byte_offset, 1);
      let $3 = _block;
      let lexer$1 = $3[0];
      let name = $3[1];
      let _block$1;
      if (name === "as") {
        _block$1 = Token$As$const;
      } else if (name === "assert") {
        _block$1 = Token$Assert$const;
      } else if (name === "auto") {
        _block$1 = Token$Auto$const;
      } else if (name === "case") {
        _block$1 = Token$Case$const;
      } else if (name === "const") {
        _block$1 = Token$Const$const;
      } else if (name === "delegate") {
        _block$1 = Token$Delegate$const;
      } else if (name === "derive") {
        _block$1 = Token$Derive$const;
      } else if (name === "echo") {
        _block$1 = Token$Echo$const;
      } else if (name === "else") {
        _block$1 = Token$Else$const;
      } else if (name === "fn") {
        _block$1 = Token$Fn$const;
      } else if (name === "if") {
        _block$1 = Token$If$const;
      } else if (name === "implement") {
        _block$1 = Token$Implement$const;
      } else if (name === "import") {
        _block$1 = Token$Import$const;
      } else if (name === "let") {
        _block$1 = Token$Let$const;
      } else if (name === "macro") {
        _block$1 = Token$Macro$const;
      } else if (name === "opaque") {
        _block$1 = Token$Opaque$const;
      } else if (name === "panic") {
        _block$1 = Token$Panic$const;
      } else if (name === "pub") {
        _block$1 = Token$Pub$const;
      } else if (name === "test") {
        _block$1 = Token$Test$const;
      } else if (name === "todo") {
        _block$1 = Token$Todo$const;
      } else if (name === "type") {
        _block$1 = Token$Type$const;
      } else if (name === "use") {
        _block$1 = Token$Use$const;
      } else {
        _block$1 = new Name(name);
      }
      let token$1 = _block$1;
      let lexer$2 = new Lexer(lexer$1.original_source, lexer$1.source, lexer$1.byte_offset, lexer$1.preserve_whitespace, lexer$1.preserve_comments, LexerMode$CheckForMinus$const, lexer$1.newlines);
      return [lexer$2, new Some([token$1, new Position(byte_offset)])];
    } else if ($2 === 122) {
      let source = $1.slice(1);
      let byte_offset = lexer.byte_offset;
      let _block;
      let _pipe = advance(lexer, source, 1);
      _block = lex_lowercase_name(_pipe, byte_offset, 1);
      let $3 = _block;
      let lexer$1 = $3[0];
      let name = $3[1];
      let _block$1;
      if (name === "as") {
        _block$1 = Token$As$const;
      } else if (name === "assert") {
        _block$1 = Token$Assert$const;
      } else if (name === "auto") {
        _block$1 = Token$Auto$const;
      } else if (name === "case") {
        _block$1 = Token$Case$const;
      } else if (name === "const") {
        _block$1 = Token$Const$const;
      } else if (name === "delegate") {
        _block$1 = Token$Delegate$const;
      } else if (name === "derive") {
        _block$1 = Token$Derive$const;
      } else if (name === "echo") {
        _block$1 = Token$Echo$const;
      } else if (name === "else") {
        _block$1 = Token$Else$const;
      } else if (name === "fn") {
        _block$1 = Token$Fn$const;
      } else if (name === "if") {
        _block$1 = Token$If$const;
      } else if (name === "implement") {
        _block$1 = Token$Implement$const;
      } else if (name === "import") {
        _block$1 = Token$Import$const;
      } else if (name === "let") {
        _block$1 = Token$Let$const;
      } else if (name === "macro") {
        _block$1 = Token$Macro$const;
      } else if (name === "opaque") {
        _block$1 = Token$Opaque$const;
      } else if (name === "panic") {
        _block$1 = Token$Panic$const;
      } else if (name === "pub") {
        _block$1 = Token$Pub$const;
      } else if (name === "test") {
        _block$1 = Token$Test$const;
      } else if (name === "todo") {
        _block$1 = Token$Todo$const;
      } else if (name === "type") {
        _block$1 = Token$Type$const;
      } else if (name === "use") {
        _block$1 = Token$Use$const;
      } else {
        _block$1 = new Name(name);
      }
      let token$1 = _block$1;
      let lexer$2 = new Lexer(lexer$1.original_source, lexer$1.source, lexer$1.byte_offset, lexer$1.preserve_whitespace, lexer$1.preserve_comments, LexerMode$CheckForMinus$const, lexer$1.newlines);
      return [lexer$2, new Some([token$1, new Position(byte_offset)])];
    } else if ($2 === 65) {
      let source = $1.slice(1);
      let byte_offset = lexer.byte_offset;
      let _block;
      let _pipe = advance(lexer, source, 1);
      _block = lex_uppercase_name(_pipe, byte_offset, 1);
      let $3 = _block;
      let lexer$1 = $3[0];
      let name = $3[1];
      return [
        lexer$1,
        new Some([new UpperName(name), new Position(byte_offset)])
      ];
    } else if ($2 === 66) {
      let source = $1.slice(1);
      let byte_offset = lexer.byte_offset;
      let _block;
      let _pipe = advance(lexer, source, 1);
      _block = lex_uppercase_name(_pipe, byte_offset, 1);
      let $3 = _block;
      let lexer$1 = $3[0];
      let name = $3[1];
      return [
        lexer$1,
        new Some([new UpperName(name), new Position(byte_offset)])
      ];
    } else if ($2 === 67) {
      let source = $1.slice(1);
      let byte_offset = lexer.byte_offset;
      let _block;
      let _pipe = advance(lexer, source, 1);
      _block = lex_uppercase_name(_pipe, byte_offset, 1);
      let $3 = _block;
      let lexer$1 = $3[0];
      let name = $3[1];
      return [
        lexer$1,
        new Some([new UpperName(name), new Position(byte_offset)])
      ];
    } else if ($2 === 68) {
      let source = $1.slice(1);
      let byte_offset = lexer.byte_offset;
      let _block;
      let _pipe = advance(lexer, source, 1);
      _block = lex_uppercase_name(_pipe, byte_offset, 1);
      let $3 = _block;
      let lexer$1 = $3[0];
      let name = $3[1];
      return [
        lexer$1,
        new Some([new UpperName(name), new Position(byte_offset)])
      ];
    } else if ($2 === 69) {
      let source = $1.slice(1);
      let byte_offset = lexer.byte_offset;
      let _block;
      let _pipe = advance(lexer, source, 1);
      _block = lex_uppercase_name(_pipe, byte_offset, 1);
      let $3 = _block;
      let lexer$1 = $3[0];
      let name = $3[1];
      return [
        lexer$1,
        new Some([new UpperName(name), new Position(byte_offset)])
      ];
    } else if ($2 === 70) {
      let source = $1.slice(1);
      let byte_offset = lexer.byte_offset;
      let _block;
      let _pipe = advance(lexer, source, 1);
      _block = lex_uppercase_name(_pipe, byte_offset, 1);
      let $3 = _block;
      let lexer$1 = $3[0];
      let name = $3[1];
      return [
        lexer$1,
        new Some([new UpperName(name), new Position(byte_offset)])
      ];
    } else if ($2 === 71) {
      let source = $1.slice(1);
      let byte_offset = lexer.byte_offset;
      let _block;
      let _pipe = advance(lexer, source, 1);
      _block = lex_uppercase_name(_pipe, byte_offset, 1);
      let $3 = _block;
      let lexer$1 = $3[0];
      let name = $3[1];
      return [
        lexer$1,
        new Some([new UpperName(name), new Position(byte_offset)])
      ];
    } else if ($2 === 72) {
      let source = $1.slice(1);
      let byte_offset = lexer.byte_offset;
      let _block;
      let _pipe = advance(lexer, source, 1);
      _block = lex_uppercase_name(_pipe, byte_offset, 1);
      let $3 = _block;
      let lexer$1 = $3[0];
      let name = $3[1];
      return [
        lexer$1,
        new Some([new UpperName(name), new Position(byte_offset)])
      ];
    } else if ($2 === 73) {
      let source = $1.slice(1);
      let byte_offset = lexer.byte_offset;
      let _block;
      let _pipe = advance(lexer, source, 1);
      _block = lex_uppercase_name(_pipe, byte_offset, 1);
      let $3 = _block;
      let lexer$1 = $3[0];
      let name = $3[1];
      return [
        lexer$1,
        new Some([new UpperName(name), new Position(byte_offset)])
      ];
    } else if ($2 === 74) {
      let source = $1.slice(1);
      let byte_offset = lexer.byte_offset;
      let _block;
      let _pipe = advance(lexer, source, 1);
      _block = lex_uppercase_name(_pipe, byte_offset, 1);
      let $3 = _block;
      let lexer$1 = $3[0];
      let name = $3[1];
      return [
        lexer$1,
        new Some([new UpperName(name), new Position(byte_offset)])
      ];
    } else if ($2 === 75) {
      let source = $1.slice(1);
      let byte_offset = lexer.byte_offset;
      let _block;
      let _pipe = advance(lexer, source, 1);
      _block = lex_uppercase_name(_pipe, byte_offset, 1);
      let $3 = _block;
      let lexer$1 = $3[0];
      let name = $3[1];
      return [
        lexer$1,
        new Some([new UpperName(name), new Position(byte_offset)])
      ];
    } else if ($2 === 76) {
      let source = $1.slice(1);
      let byte_offset = lexer.byte_offset;
      let _block;
      let _pipe = advance(lexer, source, 1);
      _block = lex_uppercase_name(_pipe, byte_offset, 1);
      let $3 = _block;
      let lexer$1 = $3[0];
      let name = $3[1];
      return [
        lexer$1,
        new Some([new UpperName(name), new Position(byte_offset)])
      ];
    } else if ($2 === 77) {
      let source = $1.slice(1);
      let byte_offset = lexer.byte_offset;
      let _block;
      let _pipe = advance(lexer, source, 1);
      _block = lex_uppercase_name(_pipe, byte_offset, 1);
      let $3 = _block;
      let lexer$1 = $3[0];
      let name = $3[1];
      return [
        lexer$1,
        new Some([new UpperName(name), new Position(byte_offset)])
      ];
    } else if ($2 === 78) {
      let source = $1.slice(1);
      let byte_offset = lexer.byte_offset;
      let _block;
      let _pipe = advance(lexer, source, 1);
      _block = lex_uppercase_name(_pipe, byte_offset, 1);
      let $3 = _block;
      let lexer$1 = $3[0];
      let name = $3[1];
      return [
        lexer$1,
        new Some([new UpperName(name), new Position(byte_offset)])
      ];
    } else if ($2 === 79) {
      let source = $1.slice(1);
      let byte_offset = lexer.byte_offset;
      let _block;
      let _pipe = advance(lexer, source, 1);
      _block = lex_uppercase_name(_pipe, byte_offset, 1);
      let $3 = _block;
      let lexer$1 = $3[0];
      let name = $3[1];
      return [
        lexer$1,
        new Some([new UpperName(name), new Position(byte_offset)])
      ];
    } else if ($2 === 80) {
      let source = $1.slice(1);
      let byte_offset = lexer.byte_offset;
      let _block;
      let _pipe = advance(lexer, source, 1);
      _block = lex_uppercase_name(_pipe, byte_offset, 1);
      let $3 = _block;
      let lexer$1 = $3[0];
      let name = $3[1];
      return [
        lexer$1,
        new Some([new UpperName(name), new Position(byte_offset)])
      ];
    } else if ($2 === 81) {
      let source = $1.slice(1);
      let byte_offset = lexer.byte_offset;
      let _block;
      let _pipe = advance(lexer, source, 1);
      _block = lex_uppercase_name(_pipe, byte_offset, 1);
      let $3 = _block;
      let lexer$1 = $3[0];
      let name = $3[1];
      return [
        lexer$1,
        new Some([new UpperName(name), new Position(byte_offset)])
      ];
    } else if ($2 === 82) {
      let source = $1.slice(1);
      let byte_offset = lexer.byte_offset;
      let _block;
      let _pipe = advance(lexer, source, 1);
      _block = lex_uppercase_name(_pipe, byte_offset, 1);
      let $3 = _block;
      let lexer$1 = $3[0];
      let name = $3[1];
      return [
        lexer$1,
        new Some([new UpperName(name), new Position(byte_offset)])
      ];
    } else if ($2 === 83) {
      let source = $1.slice(1);
      let byte_offset = lexer.byte_offset;
      let _block;
      let _pipe = advance(lexer, source, 1);
      _block = lex_uppercase_name(_pipe, byte_offset, 1);
      let $3 = _block;
      let lexer$1 = $3[0];
      let name = $3[1];
      return [
        lexer$1,
        new Some([new UpperName(name), new Position(byte_offset)])
      ];
    } else if ($2 === 84) {
      let source = $1.slice(1);
      let byte_offset = lexer.byte_offset;
      let _block;
      let _pipe = advance(lexer, source, 1);
      _block = lex_uppercase_name(_pipe, byte_offset, 1);
      let $3 = _block;
      let lexer$1 = $3[0];
      let name = $3[1];
      return [
        lexer$1,
        new Some([new UpperName(name), new Position(byte_offset)])
      ];
    } else if ($2 === 85) {
      let source = $1.slice(1);
      let byte_offset = lexer.byte_offset;
      let _block;
      let _pipe = advance(lexer, source, 1);
      _block = lex_uppercase_name(_pipe, byte_offset, 1);
      let $3 = _block;
      let lexer$1 = $3[0];
      let name = $3[1];
      return [
        lexer$1,
        new Some([new UpperName(name), new Position(byte_offset)])
      ];
    } else if ($2 === 86) {
      let source = $1.slice(1);
      let byte_offset = lexer.byte_offset;
      let _block;
      let _pipe = advance(lexer, source, 1);
      _block = lex_uppercase_name(_pipe, byte_offset, 1);
      let $3 = _block;
      let lexer$1 = $3[0];
      let name = $3[1];
      return [
        lexer$1,
        new Some([new UpperName(name), new Position(byte_offset)])
      ];
    } else if ($2 === 87) {
      let source = $1.slice(1);
      let byte_offset = lexer.byte_offset;
      let _block;
      let _pipe = advance(lexer, source, 1);
      _block = lex_uppercase_name(_pipe, byte_offset, 1);
      let $3 = _block;
      let lexer$1 = $3[0];
      let name = $3[1];
      return [
        lexer$1,
        new Some([new UpperName(name), new Position(byte_offset)])
      ];
    } else if ($2 === 88) {
      let source = $1.slice(1);
      let byte_offset = lexer.byte_offset;
      let _block;
      let _pipe = advance(lexer, source, 1);
      _block = lex_uppercase_name(_pipe, byte_offset, 1);
      let $3 = _block;
      let lexer$1 = $3[0];
      let name = $3[1];
      return [
        lexer$1,
        new Some([new UpperName(name), new Position(byte_offset)])
      ];
    } else if ($2 === 89) {
      let source = $1.slice(1);
      let byte_offset = lexer.byte_offset;
      let _block;
      let _pipe = advance(lexer, source, 1);
      _block = lex_uppercase_name(_pipe, byte_offset, 1);
      let $3 = _block;
      let lexer$1 = $3[0];
      let name = $3[1];
      return [
        lexer$1,
        new Some([new UpperName(name), new Position(byte_offset)])
      ];
    } else if ($2 === 90) {
      let source = $1.slice(1);
      let byte_offset = lexer.byte_offset;
      let _block;
      let _pipe = advance(lexer, source, 1);
      _block = lex_uppercase_name(_pipe, byte_offset, 1);
      let $3 = _block;
      let lexer$1 = $3[0];
      let name = $3[1];
      return [
        lexer$1,
        new Some([new UpperName(name), new Position(byte_offset)])
      ];
    } else {
      let $3 = pop_grapheme(lexer.source);
      if ($3 instanceof Ok) {
        let grapheme = $3[0][0];
        let source = $3[0][1];
        return token2(lexer, new UnexpectedGrapheme(grapheme), source, string_length2(grapheme));
      } else {
        return [
          lexer,
          new Some([Token$EndOfFile$const, new Position(lexer.byte_offset)])
        ];
      }
    }
  } else if ($ instanceof CheckForMinus) {
    let $1 = check_for_minus(lexer);
    if ($1 instanceof Ok) {
      let result = $1[0];
      return result;
    } else {
      return [
        new Lexer(lexer.original_source, lexer.source, lexer.byte_offset, lexer.preserve_whitespace, lexer.preserve_comments, LexerMode$Normal$const, lexer.newlines),
        Option$None$const
      ];
    }
  } else {
    let $1 = lexer.source;
    let $2 = $1.charCodeAt(0);
    if ($2 === 48) {
      let source = $1.slice(1);
      let byte_offset = lexer.byte_offset;
      let _block;
      let _pipe = advance(lexer, source, 1);
      _block = lex_digits(_pipe, byte_offset, 1);
      let $3 = _block;
      let lexer$1 = $3[0];
      let int5 = $3[1];
      let lexer$2 = new Lexer(lexer$1.original_source, lexer$1.source, lexer$1.byte_offset, lexer$1.preserve_whitespace, lexer$1.preserve_comments, LexerMode$Normal$const, lexer$1.newlines);
      return [
        lexer$2,
        new Some([new Int(int5), new Position(byte_offset)])
      ];
    } else if ($2 === 49) {
      let source = $1.slice(1);
      let byte_offset = lexer.byte_offset;
      let _block;
      let _pipe = advance(lexer, source, 1);
      _block = lex_digits(_pipe, byte_offset, 1);
      let $3 = _block;
      let lexer$1 = $3[0];
      let int5 = $3[1];
      let lexer$2 = new Lexer(lexer$1.original_source, lexer$1.source, lexer$1.byte_offset, lexer$1.preserve_whitespace, lexer$1.preserve_comments, LexerMode$Normal$const, lexer$1.newlines);
      return [
        lexer$2,
        new Some([new Int(int5), new Position(byte_offset)])
      ];
    } else if ($2 === 50) {
      let source = $1.slice(1);
      let byte_offset = lexer.byte_offset;
      let _block;
      let _pipe = advance(lexer, source, 1);
      _block = lex_digits(_pipe, byte_offset, 1);
      let $3 = _block;
      let lexer$1 = $3[0];
      let int5 = $3[1];
      let lexer$2 = new Lexer(lexer$1.original_source, lexer$1.source, lexer$1.byte_offset, lexer$1.preserve_whitespace, lexer$1.preserve_comments, LexerMode$Normal$const, lexer$1.newlines);
      return [
        lexer$2,
        new Some([new Int(int5), new Position(byte_offset)])
      ];
    } else if ($2 === 51) {
      let source = $1.slice(1);
      let byte_offset = lexer.byte_offset;
      let _block;
      let _pipe = advance(lexer, source, 1);
      _block = lex_digits(_pipe, byte_offset, 1);
      let $3 = _block;
      let lexer$1 = $3[0];
      let int5 = $3[1];
      let lexer$2 = new Lexer(lexer$1.original_source, lexer$1.source, lexer$1.byte_offset, lexer$1.preserve_whitespace, lexer$1.preserve_comments, LexerMode$Normal$const, lexer$1.newlines);
      return [
        lexer$2,
        new Some([new Int(int5), new Position(byte_offset)])
      ];
    } else if ($2 === 52) {
      let source = $1.slice(1);
      let byte_offset = lexer.byte_offset;
      let _block;
      let _pipe = advance(lexer, source, 1);
      _block = lex_digits(_pipe, byte_offset, 1);
      let $3 = _block;
      let lexer$1 = $3[0];
      let int5 = $3[1];
      let lexer$2 = new Lexer(lexer$1.original_source, lexer$1.source, lexer$1.byte_offset, lexer$1.preserve_whitespace, lexer$1.preserve_comments, LexerMode$Normal$const, lexer$1.newlines);
      return [
        lexer$2,
        new Some([new Int(int5), new Position(byte_offset)])
      ];
    } else if ($2 === 53) {
      let source = $1.slice(1);
      let byte_offset = lexer.byte_offset;
      let _block;
      let _pipe = advance(lexer, source, 1);
      _block = lex_digits(_pipe, byte_offset, 1);
      let $3 = _block;
      let lexer$1 = $3[0];
      let int5 = $3[1];
      let lexer$2 = new Lexer(lexer$1.original_source, lexer$1.source, lexer$1.byte_offset, lexer$1.preserve_whitespace, lexer$1.preserve_comments, LexerMode$Normal$const, lexer$1.newlines);
      return [
        lexer$2,
        new Some([new Int(int5), new Position(byte_offset)])
      ];
    } else if ($2 === 54) {
      let source = $1.slice(1);
      let byte_offset = lexer.byte_offset;
      let _block;
      let _pipe = advance(lexer, source, 1);
      _block = lex_digits(_pipe, byte_offset, 1);
      let $3 = _block;
      let lexer$1 = $3[0];
      let int5 = $3[1];
      let lexer$2 = new Lexer(lexer$1.original_source, lexer$1.source, lexer$1.byte_offset, lexer$1.preserve_whitespace, lexer$1.preserve_comments, LexerMode$Normal$const, lexer$1.newlines);
      return [
        lexer$2,
        new Some([new Int(int5), new Position(byte_offset)])
      ];
    } else if ($2 === 55) {
      let source = $1.slice(1);
      let byte_offset = lexer.byte_offset;
      let _block;
      let _pipe = advance(lexer, source, 1);
      _block = lex_digits(_pipe, byte_offset, 1);
      let $3 = _block;
      let lexer$1 = $3[0];
      let int5 = $3[1];
      let lexer$2 = new Lexer(lexer$1.original_source, lexer$1.source, lexer$1.byte_offset, lexer$1.preserve_whitespace, lexer$1.preserve_comments, LexerMode$Normal$const, lexer$1.newlines);
      return [
        lexer$2,
        new Some([new Int(int5), new Position(byte_offset)])
      ];
    } else if ($2 === 56) {
      let source = $1.slice(1);
      let byte_offset = lexer.byte_offset;
      let _block;
      let _pipe = advance(lexer, source, 1);
      _block = lex_digits(_pipe, byte_offset, 1);
      let $3 = _block;
      let lexer$1 = $3[0];
      let int5 = $3[1];
      let lexer$2 = new Lexer(lexer$1.original_source, lexer$1.source, lexer$1.byte_offset, lexer$1.preserve_whitespace, lexer$1.preserve_comments, LexerMode$Normal$const, lexer$1.newlines);
      return [
        lexer$2,
        new Some([new Int(int5), new Position(byte_offset)])
      ];
    } else if ($2 === 57) {
      let source = $1.slice(1);
      let byte_offset = lexer.byte_offset;
      let _block;
      let _pipe = advance(lexer, source, 1);
      _block = lex_digits(_pipe, byte_offset, 1);
      let $3 = _block;
      let lexer$1 = $3[0];
      let int5 = $3[1];
      let lexer$2 = new Lexer(lexer$1.original_source, lexer$1.source, lexer$1.byte_offset, lexer$1.preserve_whitespace, lexer$1.preserve_comments, LexerMode$Normal$const, lexer$1.newlines);
      return [
        lexer$2,
        new Some([new Int(int5), new Position(byte_offset)])
      ];
    } else {
      return [
        new Lexer(lexer.original_source, lexer.source, lexer.byte_offset, lexer.preserve_whitespace, lexer.preserve_comments, LexerMode$Normal$const, lexer.newlines),
        Option$None$const
      ];
    }
  }
}
function do_lex(loop$lexer, loop$tokens) {
  while (true) {
    let lexer = loop$lexer;
    let tokens = loop$tokens;
    let $ = next(lexer);
    let $1 = $[1];
    if ($1 instanceof Some) {
      if ($1[0][0] instanceof EndOfFile) {
        return tokens;
      } else {
        let lexer$1 = $[0];
        let token$1 = $1[0];
        loop$lexer = lexer$1;
        loop$tokens = prepend(token$1, tokens);
      }
    } else {
      let lexer$1 = $[0];
      loop$lexer = lexer$1;
      loop$tokens = tokens;
    }
  }
}
function lex(lexer) {
  let _pipe = do_lex(lexer, List$Empty$const);
  return reverse2(_pipe);
}
// build/dev/javascript/glance/glance.mjs
var FILEPATH2 = "src/glance.gleam";

class Definition extends CustomType {
  constructor(attributes, definition) {
    super();
    this.attributes = attributes;
    this.definition = definition;
  }
}
class Attribute2 extends CustomType {
  constructor(name, arguments$) {
    super();
    this.name = name;
    this.arguments = arguments$;
  }
}
class Module extends CustomType {
  constructor(imports, custom_types, type_aliases, constants, functions) {
    super();
    this.imports = imports;
    this.custom_types = custom_types;
    this.type_aliases = type_aliases;
    this.constants = constants;
    this.functions = functions;
  }
}
class Function2 extends CustomType {
  constructor(location, name, publicity, parameters, return$, body) {
    super();
    this.location = location;
    this.name = name;
    this.publicity = publicity;
    this.parameters = parameters;
    this.return = return$;
    this.body = body;
  }
}
class Span extends CustomType {
  constructor(start5, end) {
    super();
    this.start = start5;
    this.end = end;
  }
}
class Use2 extends CustomType {
  constructor(location, patterns, function$) {
    super();
    this.location = location;
    this.patterns = patterns;
    this.function = function$;
  }
}
class Assignment extends CustomType {
  constructor(location, kind, pattern, annotation, value2) {
    super();
    this.location = location;
    this.kind = kind;
    this.pattern = pattern;
    this.annotation = annotation;
    this.value = value2;
  }
}
class Assert2 extends CustomType {
  constructor(location, expression, message2) {
    super();
    this.location = location;
    this.expression = expression;
    this.message = message2;
  }
}
class Expression extends CustomType {
  constructor($0) {
    super();
    this[0] = $0;
  }
}
class Let2 extends CustomType {
}
var AssignmentKind$Let$const = new Let2;
class LetAssert extends CustomType {
  constructor(message2) {
    super();
    this.message = message2;
  }
}
class UsePattern extends CustomType {
  constructor(pattern, annotation) {
    super();
    this.pattern = pattern;
    this.annotation = annotation;
  }
}
class PatternInt extends CustomType {
  constructor(location, value2) {
    super();
    this.location = location;
    this.value = value2;
  }
}
class PatternFloat extends CustomType {
  constructor(location, value2) {
    super();
    this.location = location;
    this.value = value2;
  }
}
class PatternString extends CustomType {
  constructor(location, value2) {
    super();
    this.location = location;
    this.value = value2;
  }
}
class PatternDiscard extends CustomType {
  constructor(location, name) {
    super();
    this.location = location;
    this.name = name;
  }
}
class PatternVariable extends CustomType {
  constructor(location, name) {
    super();
    this.location = location;
    this.name = name;
  }
}
class PatternTuple extends CustomType {
  constructor(location, elements) {
    super();
    this.location = location;
    this.elements = elements;
  }
}
class PatternList extends CustomType {
  constructor(location, elements, tail) {
    super();
    this.location = location;
    this.elements = elements;
    this.tail = tail;
  }
}
class PatternAssignment extends CustomType {
  constructor(location, pattern, name) {
    super();
    this.location = location;
    this.pattern = pattern;
    this.name = name;
  }
}
class PatternConcatenate extends CustomType {
  constructor(location, prefix, prefix_name, rest_name) {
    super();
    this.location = location;
    this.prefix = prefix;
    this.prefix_name = prefix_name;
    this.rest_name = rest_name;
  }
}
class PatternBitString extends CustomType {
  constructor(location, segments) {
    super();
    this.location = location;
    this.segments = segments;
  }
}
class PatternVariant extends CustomType {
  constructor(location, module, constructor, arguments$, with_spread) {
    super();
    this.location = location;
    this.module = module;
    this.constructor$ = constructor;
    this.arguments = arguments$;
    this.with_spread = with_spread;
  }
}
class Int2 extends CustomType {
  constructor(location, value2) {
    super();
    this.location = location;
    this.value = value2;
  }
}
class Float2 extends CustomType {
  constructor(location, value2) {
    super();
    this.location = location;
    this.value = value2;
  }
}
class String3 extends CustomType {
  constructor(location, value2) {
    super();
    this.location = location;
    this.value = value2;
  }
}
class Variable extends CustomType {
  constructor(location, name) {
    super();
    this.location = location;
    this.name = name;
  }
}
class NegateInt extends CustomType {
  constructor(location, value2) {
    super();
    this.location = location;
    this.value = value2;
  }
}
class NegateBool extends CustomType {
  constructor(location, value2) {
    super();
    this.location = location;
    this.value = value2;
  }
}
class Block extends CustomType {
  constructor(location, statements) {
    super();
    this.location = location;
    this.statements = statements;
  }
}
class Panic2 extends CustomType {
  constructor(location, message2) {
    super();
    this.location = location;
    this.message = message2;
  }
}
class Todo2 extends CustomType {
  constructor(location, message2) {
    super();
    this.location = location;
    this.message = message2;
  }
}
class Tuple extends CustomType {
  constructor(location, elements) {
    super();
    this.location = location;
    this.elements = elements;
  }
}
class List2 extends CustomType {
  constructor(location, elements, rest) {
    super();
    this.location = location;
    this.elements = elements;
    this.rest = rest;
  }
}
class Fn2 extends CustomType {
  constructor(location, arguments$, return_annotation, body) {
    super();
    this.location = location;
    this.arguments = arguments$;
    this.return_annotation = return_annotation;
    this.body = body;
  }
}
class RecordUpdate extends CustomType {
  constructor(location, module, constructor, record, fields) {
    super();
    this.location = location;
    this.module = module;
    this.constructor$ = constructor;
    this.record = record;
    this.fields = fields;
  }
}
class FieldAccess extends CustomType {
  constructor(location, container, label) {
    super();
    this.location = location;
    this.container = container;
    this.label = label;
  }
}
class Call extends CustomType {
  constructor(location, function$, arguments$) {
    super();
    this.location = location;
    this.function = function$;
    this.arguments = arguments$;
  }
}
class TupleIndex extends CustomType {
  constructor(location, tuple, index5) {
    super();
    this.location = location;
    this.tuple = tuple;
    this.index = index5;
  }
}
class FnCapture extends CustomType {
  constructor(location, label, function$, arguments_before, arguments_after) {
    super();
    this.location = location;
    this.label = label;
    this.function = function$;
    this.arguments_before = arguments_before;
    this.arguments_after = arguments_after;
  }
}
class BitString extends CustomType {
  constructor(location, segments) {
    super();
    this.location = location;
    this.segments = segments;
  }
}
class Case2 extends CustomType {
  constructor(location, subjects, clauses) {
    super();
    this.location = location;
    this.subjects = subjects;
    this.clauses = clauses;
  }
}
class BinaryOperator extends CustomType {
  constructor(location, name, left, right) {
    super();
    this.location = location;
    this.name = name;
    this.left = left;
    this.right = right;
  }
}
class Echo2 extends CustomType {
  constructor(location, expression, message2) {
    super();
    this.location = location;
    this.expression = expression;
    this.message = message2;
  }
}
class Clause extends CustomType {
  constructor(patterns, guard2, body) {
    super();
    this.patterns = patterns;
    this.guard = guard2;
    this.body = body;
  }
}
class BytesOption extends CustomType {
}
var BitStringSegmentOption$BytesOption$const = new BytesOption;
class IntOption extends CustomType {
}
var BitStringSegmentOption$IntOption$const = new IntOption;
class FloatOption extends CustomType {
}
var BitStringSegmentOption$FloatOption$const = new FloatOption;
class BitsOption extends CustomType {
}
var BitStringSegmentOption$BitsOption$const = new BitsOption;
class Utf8Option extends CustomType {
}
var BitStringSegmentOption$Utf8Option$const = new Utf8Option;
class Utf16Option extends CustomType {
}
var BitStringSegmentOption$Utf16Option$const = new Utf16Option;
class Utf32Option extends CustomType {
}
var BitStringSegmentOption$Utf32Option$const = new Utf32Option;
class Utf8CodepointOption extends CustomType {
}
var BitStringSegmentOption$Utf8CodepointOption$const = new Utf8CodepointOption;
class Utf16CodepointOption extends CustomType {
}
var BitStringSegmentOption$Utf16CodepointOption$const = new Utf16CodepointOption;
class Utf32CodepointOption extends CustomType {
}
var BitStringSegmentOption$Utf32CodepointOption$const = new Utf32CodepointOption;
class SignedOption extends CustomType {
}
var BitStringSegmentOption$SignedOption$const = new SignedOption;
class UnsignedOption extends CustomType {
}
var BitStringSegmentOption$UnsignedOption$const = new UnsignedOption;
class BigOption extends CustomType {
}
var BitStringSegmentOption$BigOption$const = new BigOption;
class LittleOption extends CustomType {
}
var BitStringSegmentOption$LittleOption$const = new LittleOption;
class NativeOption extends CustomType {
}
var BitStringSegmentOption$NativeOption$const = new NativeOption;
class SizeValueOption extends CustomType {
  constructor($0) {
    super();
    this[0] = $0;
  }
}
class SizeOption extends CustomType {
  constructor($0) {
    super();
    this[0] = $0;
  }
}
class UnitOption extends CustomType {
  constructor($0) {
    super();
    this[0] = $0;
  }
}
class BitArraySizeInt extends CustomType {
  constructor(location, value2) {
    super();
    this.location = location;
    this.value = value2;
  }
}
class BitArraySizeVariable extends CustomType {
  constructor(location, name) {
    super();
    this.location = location;
    this.name = name;
  }
}
class BitArraySizeBinaryOperator extends CustomType {
  constructor(location, operator, left, right) {
    super();
    this.location = location;
    this.operator = operator;
    this.left = left;
    this.right = right;
  }
}
class BitArraySizeBlock extends CustomType {
  constructor(location, inner) {
    super();
    this.location = location;
    this.inner = inner;
  }
}
class BitArraySizeAdd extends CustomType {
}
var BitArraySizeOperator$BitArraySizeAdd$const = new BitArraySizeAdd;
class BitArraySizeSubtract extends CustomType {
}
var BitArraySizeOperator$BitArraySizeSubtract$const = new BitArraySizeSubtract;
class BitArraySizeMultiply extends CustomType {
}
var BitArraySizeOperator$BitArraySizeMultiply$const = new BitArraySizeMultiply;
class BitArraySizeDivide extends CustomType {
}
var BitArraySizeOperator$BitArraySizeDivide$const = new BitArraySizeDivide;
class BitArraySizeRemainder extends CustomType {
}
var BitArraySizeOperator$BitArraySizeRemainder$const = new BitArraySizeRemainder;
class And extends CustomType {
}
var BinaryOperator$And$const = new And;
class Or extends CustomType {
}
var BinaryOperator$Or$const = new Or;
class Eq2 extends CustomType {
}
var BinaryOperator$Eq$const = new Eq2;
class NotEq extends CustomType {
}
var BinaryOperator$NotEq$const = new NotEq;
class LtInt extends CustomType {
}
var BinaryOperator$LtInt$const = new LtInt;
class LtEqInt extends CustomType {
}
var BinaryOperator$LtEqInt$const = new LtEqInt;
class LtFloat extends CustomType {
}
var BinaryOperator$LtFloat$const = new LtFloat;
class LtEqFloat extends CustomType {
}
var BinaryOperator$LtEqFloat$const = new LtEqFloat;
class GtEqInt extends CustomType {
}
var BinaryOperator$GtEqInt$const = new GtEqInt;
class GtInt extends CustomType {
}
var BinaryOperator$GtInt$const = new GtInt;
class GtEqFloat extends CustomType {
}
var BinaryOperator$GtEqFloat$const = new GtEqFloat;
class GtFloat extends CustomType {
}
var BinaryOperator$GtFloat$const = new GtFloat;
class Pipe2 extends CustomType {
}
var BinaryOperator$Pipe$const = new Pipe2;
class AddInt extends CustomType {
}
var BinaryOperator$AddInt$const = new AddInt;
class AddFloat extends CustomType {
}
var BinaryOperator$AddFloat$const = new AddFloat;
class SubInt extends CustomType {
}
var BinaryOperator$SubInt$const = new SubInt;
class SubFloat extends CustomType {
}
var BinaryOperator$SubFloat$const = new SubFloat;
class MultInt extends CustomType {
}
var BinaryOperator$MultInt$const = new MultInt;
class MultFloat extends CustomType {
}
var BinaryOperator$MultFloat$const = new MultFloat;
class DivInt extends CustomType {
}
var BinaryOperator$DivInt$const = new DivInt;
class DivFloat extends CustomType {
}
var BinaryOperator$DivFloat$const = new DivFloat;
class RemainderInt extends CustomType {
}
var BinaryOperator$RemainderInt$const = new RemainderInt;
class Concatenate extends CustomType {
}
var BinaryOperator$Concatenate$const = new Concatenate;
class FnParameter extends CustomType {
  constructor(name, type_2) {
    super();
    this.name = name;
    this.type_ = type_2;
  }
}
class FunctionParameter extends CustomType {
  constructor(label, name, type_2) {
    super();
    this.label = label;
    this.name = name;
    this.type_ = type_2;
  }
}
class Named extends CustomType {
  constructor($0) {
    super();
    this[0] = $0;
  }
}
class Discarded extends CustomType {
  constructor($0) {
    super();
    this[0] = $0;
  }
}
class Import2 extends CustomType {
  constructor(location, module, alias, unqualified_types, unqualified_values) {
    super();
    this.location = location;
    this.module = module;
    this.alias = alias;
    this.unqualified_types = unqualified_types;
    this.unqualified_values = unqualified_values;
  }
}
class Constant extends CustomType {
  constructor(location, name, publicity, annotation, value2) {
    super();
    this.location = location;
    this.name = name;
    this.publicity = publicity;
    this.annotation = annotation;
    this.value = value2;
  }
}
class UnqualifiedImport extends CustomType {
  constructor(name, alias) {
    super();
    this.name = name;
    this.alias = alias;
  }
}
class Public extends CustomType {
}
var Publicity$Public$const = new Public;
class Private extends CustomType {
}
var Publicity$Private$const = new Private;
class TypeAlias extends CustomType {
  constructor(location, name, publicity, parameters, aliased) {
    super();
    this.location = location;
    this.name = name;
    this.publicity = publicity;
    this.parameters = parameters;
    this.aliased = aliased;
  }
}
class CustomType2 extends CustomType {
  constructor(location, name, publicity, opaque_, parameters, variants) {
    super();
    this.location = location;
    this.name = name;
    this.publicity = publicity;
    this.opaque_ = opaque_;
    this.parameters = parameters;
    this.variants = variants;
  }
}
class Variant extends CustomType {
  constructor(name, fields, attributes) {
    super();
    this.name = name;
    this.fields = fields;
    this.attributes = attributes;
  }
}
class RecordUpdateField extends CustomType {
  constructor(label, item) {
    super();
    this.label = label;
    this.item = item;
  }
}
class LabelledVariantField extends CustomType {
  constructor(item, label) {
    super();
    this.item = item;
    this.label = label;
  }
}
class UnlabelledVariantField extends CustomType {
  constructor(item) {
    super();
    this.item = item;
  }
}
class LabelledField extends CustomType {
  constructor(label, label_location, item) {
    super();
    this.label = label;
    this.label_location = label_location;
    this.item = item;
  }
}
class ShorthandField extends CustomType {
  constructor(label, location) {
    super();
    this.label = label;
    this.location = location;
  }
}
class UnlabelledField extends CustomType {
  constructor(item) {
    super();
    this.item = item;
  }
}
class NamedType extends CustomType {
  constructor(location, name, module, parameters) {
    super();
    this.location = location;
    this.name = name;
    this.module = module;
    this.parameters = parameters;
  }
}
class TupleType extends CustomType {
  constructor(location, elements) {
    super();
    this.location = location;
    this.elements = elements;
  }
}
class FunctionType extends CustomType {
  constructor(location, parameters, return$) {
    super();
    this.location = location;
    this.parameters = parameters;
    this.return = return$;
  }
}
class VariableType extends CustomType {
  constructor(location, name) {
    super();
    this.location = location;
    this.name = name;
  }
}
class HoleType extends CustomType {
  constructor(location, name) {
    super();
    this.location = location;
    this.name = name;
  }
}
class UnexpectedEndOfInput2 extends CustomType {
}
var Error$UnexpectedEndOfInput$const = new UnexpectedEndOfInput2;
class UnexpectedToken extends CustomType {
  constructor(token3, position) {
    super();
    this.token = token3;
    this.position = position;
  }
}
class UnqualifiedImports extends CustomType {
  constructor(types, values4, end, remaining_tokens) {
    super();
    this.types = types;
    this.values = values4;
    this.end = end;
    this.remaining_tokens = remaining_tokens;
  }
}

class PatternConstructorArguments extends CustomType {
  constructor(fields, spread, end, remaining_tokens) {
    super();
    this.fields = fields;
    this.spread = spread;
    this.end = end;
    this.remaining_tokens = remaining_tokens;
  }
}

class RegularExpressionUnit extends CustomType {
}
var ParseExpressionUnitContext$RegularExpressionUnit$const = new RegularExpressionUnit;

class ExpressionUnitAfterPipe extends CustomType {
}
var ParseExpressionUnitContext$ExpressionUnitAfterPipe$const = new ExpressionUnitAfterPipe;

class ParsedList extends CustomType {
  constructor(values4, spread, remaining_tokens, end) {
    super();
    this.values = values4;
    this.spread = spread;
    this.remaining_tokens = remaining_tokens;
    this.end = end;
  }
}
function precedence(operator) {
  if (operator instanceof And) {
    return 2;
  } else if (operator instanceof Or) {
    return 1;
  } else if (operator instanceof Eq2) {
    return 3;
  } else if (operator instanceof NotEq) {
    return 3;
  } else if (operator instanceof LtInt) {
    return 4;
  } else if (operator instanceof LtEqInt) {
    return 4;
  } else if (operator instanceof LtFloat) {
    return 4;
  } else if (operator instanceof LtEqFloat) {
    return 4;
  } else if (operator instanceof GtEqInt) {
    return 4;
  } else if (operator instanceof GtInt) {
    return 4;
  } else if (operator instanceof GtEqFloat) {
    return 4;
  } else if (operator instanceof GtFloat) {
    return 4;
  } else if (operator instanceof Pipe2) {
    return 6;
  } else if (operator instanceof AddInt) {
    return 7;
  } else if (operator instanceof AddFloat) {
    return 7;
  } else if (operator instanceof SubInt) {
    return 7;
  } else if (operator instanceof SubFloat) {
    return 7;
  } else if (operator instanceof MultInt) {
    return 8;
  } else if (operator instanceof MultFloat) {
    return 8;
  } else if (operator instanceof DivInt) {
    return 8;
  } else if (operator instanceof DivFloat) {
    return 8;
  } else if (operator instanceof RemainderInt) {
    return 8;
  } else {
    return 5;
  }
}
function unexpected_error(tokens) {
  if (tokens instanceof Empty) {
    return new Error(Error$UnexpectedEndOfInput$const);
  } else {
    let token3 = tokens.head[0];
    let position = tokens.head[1];
    return new Error(new UnexpectedToken(token3, position));
  }
}
function expect(expected, tokens, next2) {
  if (tokens instanceof Empty) {
    return new Error(Error$UnexpectedEndOfInput$const);
  } else {
    let token3 = tokens.head[0];
    if (isEqual(token3, expected)) {
      let tokens$1 = tokens.tail;
      let position = tokens.head[1];
      return next2(position, tokens$1);
    } else {
      let other = tokens.head[0];
      let position$1 = tokens.head[1];
      return new Error(new UnexpectedToken(other, position$1));
    }
  }
}
function list4(parser, discard, acc, tokens) {
  if (tokens instanceof Empty) {
    return try$(parser(tokens), (_use0) => {
      let element4 = _use0[0];
      let tokens$1 = _use0[1];
      let acc$1 = prepend(element4, acc);
      if (tokens$1 instanceof Empty) {
        return new Error(Error$UnexpectedEndOfInput$const);
      } else {
        let $ = tokens$1.head[0];
        if ($ instanceof RightSquare) {
          let tokens$2 = tokens$1.tail;
          let end = tokens$1.head[1].byte_offset;
          return new Ok(new ParsedList(reverse2(acc$1), Option$None$const, tokens$2, end + 1));
        } else if ($ instanceof Comma) {
          let $1 = tokens$1.tail;
          if ($1 instanceof Empty) {
            let tokens$2 = $1;
            return list4(parser, discard, acc$1, tokens$2);
          } else {
            let $2 = $1.head[0];
            if ($2 instanceof RightSquare) {
              let tokens$2 = $1.tail;
              let end = $1.head[1].byte_offset;
              return new Ok(new ParsedList(reverse2(acc$1), Option$None$const, tokens$2, end + 1));
            } else if ($2 instanceof DotDot) {
              let $3 = $1.tail;
              if ($3 instanceof Empty) {
                let tokens$2 = $3;
                return try$(parser(tokens$2), (_use02) => {
                  let rest = _use02[0];
                  let tokens$3 = _use02[1];
                  return expect(Token$RightSquare$const, tokens$3, (_use03, tokens2) => {
                    let end = _use03.byte_offset;
                    return new Ok(new ParsedList(reverse2(acc$1), new Some(rest), tokens2, end + 1));
                  });
                });
              } else if ($3.head[0] instanceof RightSquare) {
                let start5 = $1.head[1].byte_offset;
                let close = $3.head;
                let tokens$2 = $3.tail;
                let end = $3.head[1].byte_offset;
                if (discard instanceof Some) {
                  let discard$1 = discard[0];
                  let value2 = discard$1(new Span(start5, start5 + 1));
                  let parsed_list = new ParsedList(reverse2(acc$1), new Some(value2), tokens$2, end + 1);
                  return new Ok(parsed_list);
                } else {
                  return unexpected_error(prepend(close, tokens$2));
                }
              } else {
                let tokens$2 = $3;
                return try$(parser(tokens$2), (_use02) => {
                  let rest = _use02[0];
                  let tokens$3 = _use02[1];
                  return expect(Token$RightSquare$const, tokens$3, (_use03, tokens2) => {
                    let end = _use03.byte_offset;
                    return new Ok(new ParsedList(reverse2(acc$1), new Some(rest), tokens2, end + 1));
                  });
                });
              }
            } else {
              let tokens$2 = $1;
              return list4(parser, discard, acc$1, tokens$2);
            }
          }
        } else {
          let other = $;
          let position = tokens$1.head[1];
          return new Error(new UnexpectedToken(other, position));
        }
      }
    });
  } else {
    let $ = tokens.head[0];
    if ($ instanceof RightSquare) {
      let tokens$1 = tokens.tail;
      let end = tokens.head[1].byte_offset;
      return new Ok(new ParsedList(reverse2(acc), Option$None$const, tokens$1, end + 1));
    } else if ($ instanceof Comma) {
      let $1 = tokens.tail;
      if ($1 instanceof Empty) {
        return try$(parser(tokens), (_use0) => {
          let element4 = _use0[0];
          let tokens$1 = _use0[1];
          let acc$1 = prepend(element4, acc);
          if (tokens$1 instanceof Empty) {
            return new Error(Error$UnexpectedEndOfInput$const);
          } else {
            let $2 = tokens$1.head[0];
            if ($2 instanceof RightSquare) {
              let tokens$2 = tokens$1.tail;
              let end = tokens$1.head[1].byte_offset;
              return new Ok(new ParsedList(reverse2(acc$1), Option$None$const, tokens$2, end + 1));
            } else if ($2 instanceof Comma) {
              let $3 = tokens$1.tail;
              if ($3 instanceof Empty) {
                let tokens$2 = $3;
                return list4(parser, discard, acc$1, tokens$2);
              } else {
                let $4 = $3.head[0];
                if ($4 instanceof RightSquare) {
                  let tokens$2 = $3.tail;
                  let end = $3.head[1].byte_offset;
                  return new Ok(new ParsedList(reverse2(acc$1), Option$None$const, tokens$2, end + 1));
                } else if ($4 instanceof DotDot) {
                  let $5 = $3.tail;
                  if ($5 instanceof Empty) {
                    let tokens$2 = $5;
                    return try$(parser(tokens$2), (_use02) => {
                      let rest = _use02[0];
                      let tokens$3 = _use02[1];
                      return expect(Token$RightSquare$const, tokens$3, (_use03, tokens2) => {
                        let end = _use03.byte_offset;
                        return new Ok(new ParsedList(reverse2(acc$1), new Some(rest), tokens2, end + 1));
                      });
                    });
                  } else if ($5.head[0] instanceof RightSquare) {
                    let start5 = $3.head[1].byte_offset;
                    let close = $5.head;
                    let tokens$2 = $5.tail;
                    let end = $5.head[1].byte_offset;
                    if (discard instanceof Some) {
                      let discard$1 = discard[0];
                      let value2 = discard$1(new Span(start5, start5 + 1));
                      let parsed_list = new ParsedList(reverse2(acc$1), new Some(value2), tokens$2, end + 1);
                      return new Ok(parsed_list);
                    } else {
                      return unexpected_error(prepend(close, tokens$2));
                    }
                  } else {
                    let tokens$2 = $5;
                    return try$(parser(tokens$2), (_use02) => {
                      let rest = _use02[0];
                      let tokens$3 = _use02[1];
                      return expect(Token$RightSquare$const, tokens$3, (_use03, tokens2) => {
                        let end = _use03.byte_offset;
                        return new Ok(new ParsedList(reverse2(acc$1), new Some(rest), tokens2, end + 1));
                      });
                    });
                  }
                } else {
                  let tokens$2 = $3;
                  return list4(parser, discard, acc$1, tokens$2);
                }
              }
            } else {
              let other = $2;
              let position = tokens$1.head[1];
              return new Error(new UnexpectedToken(other, position));
            }
          }
        });
      } else if ($1.head[0] instanceof RightSquare && !(acc instanceof Empty)) {
        let tokens$1 = $1.tail;
        let end = $1.head[1].byte_offset;
        return new Ok(new ParsedList(reverse2(acc), Option$None$const, tokens$1, end + 1));
      } else {
        return try$(parser(tokens), (_use0) => {
          let element4 = _use0[0];
          let tokens$1 = _use0[1];
          let acc$1 = prepend(element4, acc);
          if (tokens$1 instanceof Empty) {
            return new Error(Error$UnexpectedEndOfInput$const);
          } else {
            let $2 = tokens$1.head[0];
            if ($2 instanceof RightSquare) {
              let tokens$2 = tokens$1.tail;
              let end = tokens$1.head[1].byte_offset;
              return new Ok(new ParsedList(reverse2(acc$1), Option$None$const, tokens$2, end + 1));
            } else if ($2 instanceof Comma) {
              let $3 = tokens$1.tail;
              if ($3 instanceof Empty) {
                let tokens$2 = $3;
                return list4(parser, discard, acc$1, tokens$2);
              } else {
                let $4 = $3.head[0];
                if ($4 instanceof RightSquare) {
                  let tokens$2 = $3.tail;
                  let end = $3.head[1].byte_offset;
                  return new Ok(new ParsedList(reverse2(acc$1), Option$None$const, tokens$2, end + 1));
                } else if ($4 instanceof DotDot) {
                  let $5 = $3.tail;
                  if ($5 instanceof Empty) {
                    let tokens$2 = $5;
                    return try$(parser(tokens$2), (_use02) => {
                      let rest = _use02[0];
                      let tokens$3 = _use02[1];
                      return expect(Token$RightSquare$const, tokens$3, (_use03, tokens2) => {
                        let end = _use03.byte_offset;
                        return new Ok(new ParsedList(reverse2(acc$1), new Some(rest), tokens2, end + 1));
                      });
                    });
                  } else if ($5.head[0] instanceof RightSquare) {
                    let start5 = $3.head[1].byte_offset;
                    let close = $5.head;
                    let tokens$2 = $5.tail;
                    let end = $5.head[1].byte_offset;
                    if (discard instanceof Some) {
                      let discard$1 = discard[0];
                      let value2 = discard$1(new Span(start5, start5 + 1));
                      let parsed_list = new ParsedList(reverse2(acc$1), new Some(value2), tokens$2, end + 1);
                      return new Ok(parsed_list);
                    } else {
                      return unexpected_error(prepend(close, tokens$2));
                    }
                  } else {
                    let tokens$2 = $5;
                    return try$(parser(tokens$2), (_use02) => {
                      let rest = _use02[0];
                      let tokens$3 = _use02[1];
                      return expect(Token$RightSquare$const, tokens$3, (_use03, tokens2) => {
                        let end = _use03.byte_offset;
                        return new Ok(new ParsedList(reverse2(acc$1), new Some(rest), tokens2, end + 1));
                      });
                    });
                  }
                } else {
                  let tokens$2 = $3;
                  return list4(parser, discard, acc$1, tokens$2);
                }
              }
            } else {
              let other = $2;
              let position = tokens$1.head[1];
              return new Error(new UnexpectedToken(other, position));
            }
          }
        });
      }
    } else if ($ instanceof DotDot) {
      let $1 = tokens.tail;
      if ($1 instanceof Empty) {
        let tokens$1 = $1;
        return try$(parser(tokens$1), (_use0) => {
          let rest = _use0[0];
          let tokens$2 = _use0[1];
          return expect(Token$RightSquare$const, tokens$2, (_use02, tokens2) => {
            let end = _use02.byte_offset;
            return new Ok(new ParsedList(reverse2(acc), new Some(rest), tokens2, end + 1));
          });
        });
      } else if ($1.head[0] instanceof RightSquare) {
        let start5 = tokens.head[1].byte_offset;
        let close = $1.head;
        let tokens$1 = $1.tail;
        let end = $1.head[1].byte_offset;
        if (discard instanceof Some) {
          let discard$1 = discard[0];
          let value2 = discard$1(new Span(start5, start5 + 1));
          let parsed_list = new ParsedList(reverse2(acc), new Some(value2), tokens$1, end + 1);
          return new Ok(parsed_list);
        } else {
          return unexpected_error(prepend(close, tokens$1));
        }
      } else {
        let tokens$1 = $1;
        return try$(parser(tokens$1), (_use0) => {
          let rest = _use0[0];
          let tokens$2 = _use0[1];
          return expect(Token$RightSquare$const, tokens$2, (_use02, tokens2) => {
            let end = _use02.byte_offset;
            return new Ok(new ParsedList(reverse2(acc), new Some(rest), tokens2, end + 1));
          });
        });
      }
    } else {
      return try$(parser(tokens), (_use0) => {
        let element4 = _use0[0];
        let tokens$1 = _use0[1];
        let acc$1 = prepend(element4, acc);
        if (tokens$1 instanceof Empty) {
          return new Error(Error$UnexpectedEndOfInput$const);
        } else {
          let $1 = tokens$1.head[0];
          if ($1 instanceof RightSquare) {
            let tokens$2 = tokens$1.tail;
            let end = tokens$1.head[1].byte_offset;
            return new Ok(new ParsedList(reverse2(acc$1), Option$None$const, tokens$2, end + 1));
          } else if ($1 instanceof Comma) {
            let $2 = tokens$1.tail;
            if ($2 instanceof Empty) {
              let tokens$2 = $2;
              return list4(parser, discard, acc$1, tokens$2);
            } else {
              let $3 = $2.head[0];
              if ($3 instanceof RightSquare) {
                let tokens$2 = $2.tail;
                let end = $2.head[1].byte_offset;
                return new Ok(new ParsedList(reverse2(acc$1), Option$None$const, tokens$2, end + 1));
              } else if ($3 instanceof DotDot) {
                let $4 = $2.tail;
                if ($4 instanceof Empty) {
                  let tokens$2 = $4;
                  return try$(parser(tokens$2), (_use02) => {
                    let rest = _use02[0];
                    let tokens$3 = _use02[1];
                    return expect(Token$RightSquare$const, tokens$3, (_use03, tokens2) => {
                      let end = _use03.byte_offset;
                      return new Ok(new ParsedList(reverse2(acc$1), new Some(rest), tokens2, end + 1));
                    });
                  });
                } else if ($4.head[0] instanceof RightSquare) {
                  let start5 = $2.head[1].byte_offset;
                  let close = $4.head;
                  let tokens$2 = $4.tail;
                  let end = $4.head[1].byte_offset;
                  if (discard instanceof Some) {
                    let discard$1 = discard[0];
                    let value2 = discard$1(new Span(start5, start5 + 1));
                    let parsed_list = new ParsedList(reverse2(acc$1), new Some(value2), tokens$2, end + 1);
                    return new Ok(parsed_list);
                  } else {
                    return unexpected_error(prepend(close, tokens$2));
                  }
                } else {
                  let tokens$2 = $4;
                  return try$(parser(tokens$2), (_use02) => {
                    let rest = _use02[0];
                    let tokens$3 = _use02[1];
                    return expect(Token$RightSquare$const, tokens$3, (_use03, tokens2) => {
                      let end = _use03.byte_offset;
                      return new Ok(new ParsedList(reverse2(acc$1), new Some(rest), tokens2, end + 1));
                    });
                  });
                }
              } else {
                let tokens$2 = $2;
                return list4(parser, discard, acc$1, tokens$2);
              }
            }
          } else {
            let other = $1;
            let position = tokens$1.head[1];
            return new Error(new UnexpectedToken(other, position));
          }
        }
      });
    }
  }
}
function push_function(module, attributes, function$) {
  return new Module(module.imports, module.custom_types, module.type_aliases, module.constants, prepend(new Definition(reverse2(attributes), function$), module.functions));
}
function handle_operator(loop$next, loop$operators, loop$values) {
  while (true) {
    let next2 = loop$next;
    let operators = loop$operators;
    let values4 = loop$values;
    if (next2 instanceof Some) {
      if (operators instanceof Empty) {
        let operator = next2[0];
        return [
          Option$None$const,
          prepend(operator, List$Empty$const),
          values4
        ];
      } else if (values4 instanceof Empty) {
        throw makeError("panic", FILEPATH2, "glance", 1205, "handle_operator", "parser bug, expression not full reduced", {});
      } else {
        let $ = values4.tail;
        if ($ instanceof Empty) {
          throw makeError("panic", FILEPATH2, "glance", 1205, "handle_operator", "parser bug, expression not full reduced", {});
        } else {
          let next$1 = next2[0];
          let previous = operators.head;
          let operators$1 = operators.tail;
          let a2 = values4.head;
          let b = $.head;
          let rest_values = $.tail;
          let $1 = precedence(previous) >= precedence(next$1);
          if ($1) {
            let span2 = new Span(b.location.start, a2.location.end);
            let expression$1 = new BinaryOperator(span2, previous, b, a2);
            let values$1 = prepend(expression$1, rest_values);
            loop$next = new Some(next$1);
            loop$operators = operators$1;
            loop$values = values$1;
          } else {
            return [
              Option$None$const,
              prepend(next$1, prepend(previous, operators$1)),
              values4
            ];
          }
        }
      }
    } else if (operators instanceof Empty) {
      if (values4 instanceof Empty) {
        return [Option$None$const, operators, values4];
      } else if (values4.tail instanceof Empty) {
        let expression$1 = values4.head;
        return [new Some(expression$1), operators, values4];
      } else {
        throw makeError("panic", FILEPATH2, "glance", 1205, "handle_operator", "parser bug, expression not full reduced", {});
      }
    } else if (values4 instanceof Empty) {
      throw makeError("panic", FILEPATH2, "glance", 1205, "handle_operator", "parser bug, expression not full reduced", {});
    } else {
      let $ = values4.tail;
      if ($ instanceof Empty) {
        throw makeError("panic", FILEPATH2, "glance", 1205, "handle_operator", "parser bug, expression not full reduced", {});
      } else {
        let operator = operators.head;
        let operators$1 = operators.tail;
        let a2 = values4.head;
        let b = $.head;
        let values$1 = $.tail;
        let values$2 = prepend(new BinaryOperator(new Span(b.location.start, a2.location.end), operator, b, a2), values$1);
        loop$next = Option$None$const;
        loop$operators = operators$1;
        loop$values = values$2;
      }
    }
  }
}
function binary_operator(token3) {
  if (token3 instanceof Plus) {
    return new Ok(BinaryOperator$AddInt$const);
  } else if (token3 instanceof Minus) {
    return new Ok(BinaryOperator$SubInt$const);
  } else if (token3 instanceof Star) {
    return new Ok(BinaryOperator$MultInt$const);
  } else if (token3 instanceof Slash) {
    return new Ok(BinaryOperator$DivInt$const);
  } else if (token3 instanceof Less) {
    return new Ok(BinaryOperator$LtInt$const);
  } else if (token3 instanceof Greater) {
    return new Ok(BinaryOperator$GtInt$const);
  } else if (token3 instanceof LessEqual) {
    return new Ok(BinaryOperator$LtEqInt$const);
  } else if (token3 instanceof GreaterEqual) {
    return new Ok(BinaryOperator$GtEqInt$const);
  } else if (token3 instanceof Percent) {
    return new Ok(BinaryOperator$RemainderInt$const);
  } else if (token3 instanceof PlusDot) {
    return new Ok(BinaryOperator$AddFloat$const);
  } else if (token3 instanceof MinusDot) {
    return new Ok(BinaryOperator$SubFloat$const);
  } else if (token3 instanceof StarDot) {
    return new Ok(BinaryOperator$MultFloat$const);
  } else if (token3 instanceof SlashDot) {
    return new Ok(BinaryOperator$DivFloat$const);
  } else if (token3 instanceof LessDot) {
    return new Ok(BinaryOperator$LtFloat$const);
  } else if (token3 instanceof GreaterDot) {
    return new Ok(BinaryOperator$GtFloat$const);
  } else if (token3 instanceof LessEqualDot) {
    return new Ok(BinaryOperator$LtEqFloat$const);
  } else if (token3 instanceof GreaterEqualDot) {
    return new Ok(BinaryOperator$GtEqFloat$const);
  } else if (token3 instanceof LessGreater) {
    return new Ok(BinaryOperator$Concatenate$const);
  } else if (token3 instanceof EqualEqual) {
    return new Ok(BinaryOperator$Eq$const);
  } else if (token3 instanceof NotEqual) {
    return new Ok(BinaryOperator$NotEq$const);
  } else if (token3 instanceof VBarVBar) {
    return new Ok(BinaryOperator$Or$const);
  } else if (token3 instanceof AmperAmper) {
    return new Ok(BinaryOperator$And$const);
  } else if (token3 instanceof Pipe) {
    return new Ok(BinaryOperator$Pipe$const);
  } else {
    return new Error(undefined);
  }
}
function pop_binary_operator(tokens) {
  if (tokens instanceof Empty) {
    return new Error(undefined);
  } else {
    let tokens$1 = tokens.tail;
    let token3 = tokens.head[0];
    return map4(binary_operator(token3), (op) => {
      return [op, tokens$1];
    });
  }
}
function field2(tokens, parser) {
  if (tokens instanceof Empty) {
    return try$(parser(tokens), (_use0) => {
      let t = _use0[0];
      let tokens$1 = _use0[1];
      return new Ok([new UnlabelledField(t), tokens$1]);
    });
  } else {
    let $ = tokens.tail;
    if ($ instanceof Empty) {
      return try$(parser(tokens), (_use0) => {
        let t = _use0[0];
        let tokens$1 = _use0[1];
        return new Ok([new UnlabelledField(t), tokens$1]);
      });
    } else {
      let $1 = tokens.head[0];
      if ($1 instanceof Name && $.head[0] instanceof Colon) {
        let start5 = tokens.head[1];
        let tokens$1 = $.tail;
        let end = $.head[1];
        let name$1 = $1[0];
        if (tokens$1 instanceof Empty) {
          return try$(parser(tokens$1), (_use0) => {
            let t = _use0[0];
            let tokens$2 = _use0[1];
            return new Ok([
              new LabelledField(name$1, new Span(start5.byte_offset, end.byte_offset + 1), t),
              tokens$2
            ]);
          });
        } else {
          let $2 = tokens$1.head[0];
          if ($2 instanceof RightParen) {
            return new Ok([
              new ShorthandField(name$1, new Span(start5.byte_offset, end.byte_offset + 1)),
              tokens$1
            ]);
          } else if ($2 instanceof Comma) {
            return new Ok([
              new ShorthandField(name$1, new Span(start5.byte_offset, end.byte_offset + 1)),
              tokens$1
            ]);
          } else {
            return try$(parser(tokens$1), (_use0) => {
              let t = _use0[0];
              let tokens$2 = _use0[1];
              return new Ok([
                new LabelledField(name$1, new Span(start5.byte_offset, end.byte_offset + 1), t),
                tokens$2
              ]);
            });
          }
        }
      } else {
        return try$(parser(tokens), (_use0) => {
          let t = _use0[0];
          let tokens$1 = _use0[1];
          return new Ok([new UnlabelledField(t), tokens$1]);
        });
      }
    }
  }
}
function string_offset(start5, string5) {
  return start5 + byte_size(string5);
}
function span_from_string(start5, string5) {
  return new Span(start5, start5 + byte_size(string5));
}
function comma_delimited(items, tokens, parser, final) {
  if (tokens instanceof Empty) {
    return new Error(Error$UnexpectedEndOfInput$const);
  } else {
    let token3 = tokens.head[0];
    if (isEqual(token3, final)) {
      let tokens$1 = tokens.tail;
      let token_start = tokens.head[1].byte_offset;
      return new Ok([
        reverse2(items),
        string_offset(token_start, to_source(token3)),
        tokens$1
      ]);
    } else {
      return try$(parser(tokens), (_use0) => {
        let element4 = _use0[0];
        let tokens$2 = _use0[1];
        if (tokens$2 instanceof Empty) {
          return new Error(Error$UnexpectedEndOfInput$const);
        } else {
          let $ = tokens$2.head[0];
          if ($ instanceof Comma) {
            let tokens$3 = tokens$2.tail;
            return comma_delimited(prepend(element4, items), tokens$3, parser, final);
          } else {
            let token$1 = $;
            if (isEqual(token$1, final)) {
              let tokens$3 = tokens$2.tail;
              let token_start$1 = tokens$2.head[1].byte_offset;
              let offset = string_offset(token_start$1, to_source(token$1));
              return new Ok([reverse2(prepend(element4, items)), offset, tokens$3]);
            } else {
              let other = $;
              let position = tokens$2.head[1];
              return new Error(new UnexpectedToken(other, position));
            }
          }
        }
      });
    }
  }
}
function bit_string_segment_options(size_parser, options, tokens) {
  return try$((() => {
    if (tokens instanceof Empty) {
      return new Error(Error$UnexpectedEndOfInput$const);
    } else {
      let $ = tokens.head[0];
      if ($ instanceof Name) {
        let $1 = tokens.tail;
        if ($1 instanceof Empty) {
          let $2 = $[0];
          if ($2 === "bytes") {
            let tokens$1 = $1;
            return new Ok([BitStringSegmentOption$BytesOption$const, tokens$1]);
          } else if ($2 === "binary") {
            let tokens$1 = $1;
            return new Ok([BitStringSegmentOption$BytesOption$const, tokens$1]);
          } else if ($2 === "int") {
            let tokens$1 = $1;
            return new Ok([BitStringSegmentOption$IntOption$const, tokens$1]);
          } else if ($2 === "float") {
            let tokens$1 = $1;
            return new Ok([BitStringSegmentOption$FloatOption$const, tokens$1]);
          } else if ($2 === "bits") {
            let tokens$1 = $1;
            return new Ok([BitStringSegmentOption$BitsOption$const, tokens$1]);
          } else if ($2 === "bit_string") {
            let tokens$1 = $1;
            return new Ok([BitStringSegmentOption$BitsOption$const, tokens$1]);
          } else if ($2 === "utf8") {
            let tokens$1 = $1;
            return new Ok([BitStringSegmentOption$Utf8Option$const, tokens$1]);
          } else if ($2 === "utf16") {
            let tokens$1 = $1;
            return new Ok([BitStringSegmentOption$Utf16Option$const, tokens$1]);
          } else if ($2 === "utf32") {
            let tokens$1 = $1;
            return new Ok([BitStringSegmentOption$Utf32Option$const, tokens$1]);
          } else if ($2 === "utf8_codepoint") {
            let tokens$1 = $1;
            return new Ok([BitStringSegmentOption$Utf8CodepointOption$const, tokens$1]);
          } else if ($2 === "utf16_codepoint") {
            let tokens$1 = $1;
            return new Ok([BitStringSegmentOption$Utf16CodepointOption$const, tokens$1]);
          } else if ($2 === "utf32_codepoint") {
            let tokens$1 = $1;
            return new Ok([BitStringSegmentOption$Utf32CodepointOption$const, tokens$1]);
          } else if ($2 === "signed") {
            let tokens$1 = $1;
            return new Ok([BitStringSegmentOption$SignedOption$const, tokens$1]);
          } else if ($2 === "unsigned") {
            let tokens$1 = $1;
            return new Ok([BitStringSegmentOption$UnsignedOption$const, tokens$1]);
          } else if ($2 === "big") {
            let tokens$1 = $1;
            return new Ok([BitStringSegmentOption$BigOption$const, tokens$1]);
          } else if ($2 === "little") {
            let tokens$1 = $1;
            return new Ok([BitStringSegmentOption$LittleOption$const, tokens$1]);
          } else if ($2 === "native") {
            let tokens$1 = $1;
            return new Ok([BitStringSegmentOption$NativeOption$const, tokens$1]);
          } else {
            let other = $;
            let position = tokens.head[1];
            return new Error(new UnexpectedToken(other, position));
          }
        } else if ($1.head[0] instanceof LeftParen) {
          let $2 = $[0];
          if ($2 === "size") {
            let tokens$1 = $1.tail;
            return try$(size_parser(tokens$1), (_use0) => {
              let value2 = _use0[0];
              let tokens$2 = _use0[1];
              return expect(Token$RightParen$const, tokens$2, (_, tokens2) => {
                return new Ok([new SizeValueOption(value2), tokens2]);
              });
            });
          } else if ($2 === "unit") {
            let $3 = $1.tail;
            if ($3 instanceof Empty) {
              let other = $;
              let position = tokens.head[1];
              return new Error(new UnexpectedToken(other, position));
            } else {
              let $4 = $3.tail;
              if ($4 instanceof Empty) {
                let other = $;
                let position = tokens.head[1];
                return new Error(new UnexpectedToken(other, position));
              } else {
                let $5 = $3.head[0];
                if ($5 instanceof Int && $4.head[0] instanceof RightParen) {
                  let position = tokens.head[1];
                  let tokens$1 = $4.tail;
                  let i = $5[0];
                  let $6 = parse_int(i);
                  if ($6 instanceof Ok) {
                    let i$1 = $6[0];
                    return new Ok([new UnitOption(i$1), tokens$1]);
                  } else {
                    return new Error(new UnexpectedToken(new Int(i), position));
                  }
                } else {
                  let other = $;
                  let position = tokens.head[1];
                  return new Error(new UnexpectedToken(other, position));
                }
              }
            }
          } else if ($2 === "bytes") {
            let tokens$1 = $1;
            return new Ok([BitStringSegmentOption$BytesOption$const, tokens$1]);
          } else if ($2 === "binary") {
            let tokens$1 = $1;
            return new Ok([BitStringSegmentOption$BytesOption$const, tokens$1]);
          } else if ($2 === "int") {
            let tokens$1 = $1;
            return new Ok([BitStringSegmentOption$IntOption$const, tokens$1]);
          } else if ($2 === "float") {
            let tokens$1 = $1;
            return new Ok([BitStringSegmentOption$FloatOption$const, tokens$1]);
          } else if ($2 === "bits") {
            let tokens$1 = $1;
            return new Ok([BitStringSegmentOption$BitsOption$const, tokens$1]);
          } else if ($2 === "bit_string") {
            let tokens$1 = $1;
            return new Ok([BitStringSegmentOption$BitsOption$const, tokens$1]);
          } else if ($2 === "utf8") {
            let tokens$1 = $1;
            return new Ok([BitStringSegmentOption$Utf8Option$const, tokens$1]);
          } else if ($2 === "utf16") {
            let tokens$1 = $1;
            return new Ok([BitStringSegmentOption$Utf16Option$const, tokens$1]);
          } else if ($2 === "utf32") {
            let tokens$1 = $1;
            return new Ok([BitStringSegmentOption$Utf32Option$const, tokens$1]);
          } else if ($2 === "utf8_codepoint") {
            let tokens$1 = $1;
            return new Ok([BitStringSegmentOption$Utf8CodepointOption$const, tokens$1]);
          } else if ($2 === "utf16_codepoint") {
            let tokens$1 = $1;
            return new Ok([BitStringSegmentOption$Utf16CodepointOption$const, tokens$1]);
          } else if ($2 === "utf32_codepoint") {
            let tokens$1 = $1;
            return new Ok([BitStringSegmentOption$Utf32CodepointOption$const, tokens$1]);
          } else if ($2 === "signed") {
            let tokens$1 = $1;
            return new Ok([BitStringSegmentOption$SignedOption$const, tokens$1]);
          } else if ($2 === "unsigned") {
            let tokens$1 = $1;
            return new Ok([BitStringSegmentOption$UnsignedOption$const, tokens$1]);
          } else if ($2 === "big") {
            let tokens$1 = $1;
            return new Ok([BitStringSegmentOption$BigOption$const, tokens$1]);
          } else if ($2 === "little") {
            let tokens$1 = $1;
            return new Ok([BitStringSegmentOption$LittleOption$const, tokens$1]);
          } else if ($2 === "native") {
            let tokens$1 = $1;
            return new Ok([BitStringSegmentOption$NativeOption$const, tokens$1]);
          } else {
            let other = $;
            let position = tokens.head[1];
            return new Error(new UnexpectedToken(other, position));
          }
        } else {
          let $2 = $[0];
          if ($2 === "bytes") {
            let tokens$1 = $1;
            return new Ok([BitStringSegmentOption$BytesOption$const, tokens$1]);
          } else if ($2 === "binary") {
            let tokens$1 = $1;
            return new Ok([BitStringSegmentOption$BytesOption$const, tokens$1]);
          } else if ($2 === "int") {
            let tokens$1 = $1;
            return new Ok([BitStringSegmentOption$IntOption$const, tokens$1]);
          } else if ($2 === "float") {
            let tokens$1 = $1;
            return new Ok([BitStringSegmentOption$FloatOption$const, tokens$1]);
          } else if ($2 === "bits") {
            let tokens$1 = $1;
            return new Ok([BitStringSegmentOption$BitsOption$const, tokens$1]);
          } else if ($2 === "bit_string") {
            let tokens$1 = $1;
            return new Ok([BitStringSegmentOption$BitsOption$const, tokens$1]);
          } else if ($2 === "utf8") {
            let tokens$1 = $1;
            return new Ok([BitStringSegmentOption$Utf8Option$const, tokens$1]);
          } else if ($2 === "utf16") {
            let tokens$1 = $1;
            return new Ok([BitStringSegmentOption$Utf16Option$const, tokens$1]);
          } else if ($2 === "utf32") {
            let tokens$1 = $1;
            return new Ok([BitStringSegmentOption$Utf32Option$const, tokens$1]);
          } else if ($2 === "utf8_codepoint") {
            let tokens$1 = $1;
            return new Ok([BitStringSegmentOption$Utf8CodepointOption$const, tokens$1]);
          } else if ($2 === "utf16_codepoint") {
            let tokens$1 = $1;
            return new Ok([BitStringSegmentOption$Utf16CodepointOption$const, tokens$1]);
          } else if ($2 === "utf32_codepoint") {
            let tokens$1 = $1;
            return new Ok([BitStringSegmentOption$Utf32CodepointOption$const, tokens$1]);
          } else if ($2 === "signed") {
            let tokens$1 = $1;
            return new Ok([BitStringSegmentOption$SignedOption$const, tokens$1]);
          } else if ($2 === "unsigned") {
            let tokens$1 = $1;
            return new Ok([BitStringSegmentOption$UnsignedOption$const, tokens$1]);
          } else if ($2 === "big") {
            let tokens$1 = $1;
            return new Ok([BitStringSegmentOption$BigOption$const, tokens$1]);
          } else if ($2 === "little") {
            let tokens$1 = $1;
            return new Ok([BitStringSegmentOption$LittleOption$const, tokens$1]);
          } else if ($2 === "native") {
            let tokens$1 = $1;
            return new Ok([BitStringSegmentOption$NativeOption$const, tokens$1]);
          } else {
            let other = $;
            let position = tokens.head[1];
            return new Error(new UnexpectedToken(other, position));
          }
        }
      } else if ($ instanceof Int) {
        let tokens$1 = tokens.tail;
        let position = tokens.head[1];
        let i = $[0];
        let $1 = parse_int(i);
        if ($1 instanceof Ok) {
          let i$1 = $1[0];
          return new Ok([new SizeOption(i$1), tokens$1]);
        } else {
          return new Error(new UnexpectedToken(new Int(i), position));
        }
      } else {
        let other = $;
        let position = tokens.head[1];
        return new Error(new UnexpectedToken(other, position));
      }
    }
  })(), (_use0) => {
    let option = _use0[0];
    let tokens$1 = _use0[1];
    let options$1 = prepend(option, options);
    if (tokens$1 instanceof Empty) {
      return new Ok([reverse2(options$1), tokens$1]);
    } else if (tokens$1.head[0] instanceof Minus) {
      let tokens$2 = tokens$1.tail;
      return bit_string_segment_options(size_parser, options$1, tokens$2);
    } else {
      return new Ok([reverse2(options$1), tokens$1]);
    }
  });
}
function optional_bit_string_segment_options(size_parser, tokens) {
  if (tokens instanceof Empty) {
    return new Ok([List$Empty$const, tokens]);
  } else if (tokens.head[0] instanceof Colon) {
    let tokens$1 = tokens.tail;
    return bit_string_segment_options(size_parser, List$Empty$const, tokens$1);
  } else {
    return new Ok([List$Empty$const, tokens]);
  }
}
function bit_string_segment(parser, size_parser, tokens) {
  return try$(parser(tokens), (_use0) => {
    let value2 = _use0[0];
    let tokens$1 = _use0[1];
    let result = optional_bit_string_segment_options(size_parser, tokens$1);
    return try$(result, (_use02) => {
      let options = _use02[0];
      let tokens$2 = _use02[1];
      return new Ok([[value2, options], tokens$2]);
    });
  });
}
function delimited(acc, tokens, parser, delimeter) {
  return try$(parser(tokens), (_use0) => {
    let t = _use0[0];
    let tokens$1 = _use0[1];
    let acc$1 = prepend(t, acc);
    if (tokens$1 instanceof Empty) {
      return new Ok([reverse2(acc$1), tokens$1]);
    } else {
      let token3 = tokens$1.head[0];
      if (isEqual(token3, delimeter)) {
        let tokens$2 = tokens$1.tail;
        return delimited(acc$1, tokens$2, parser, delimeter);
      } else {
        return new Ok([reverse2(acc$1), tokens$1]);
      }
    }
  });
}
function bit_array_size_precedence(operator) {
  if (operator instanceof BitArraySizeAdd) {
    return 7;
  } else if (operator instanceof BitArraySizeSubtract) {
    return 7;
  } else if (operator instanceof BitArraySizeMultiply) {
    return 8;
  } else if (operator instanceof BitArraySizeDivide) {
    return 8;
  } else {
    return 8;
  }
}
function handle_bit_array_size_operator(loop$next, loop$operators, loop$values) {
  while (true) {
    let next2 = loop$next;
    let operators = loop$operators;
    let values4 = loop$values;
    if (next2 instanceof Some) {
      if (operators instanceof Empty) {
        let operator = next2[0];
        return [
          Option$None$const,
          prepend(operator, List$Empty$const),
          values4
        ];
      } else if (values4 instanceof Empty) {
        throw makeError("panic", FILEPATH2, "glance", 1578, "handle_bit_array_size_operator", "parser bug, bit array size not fully reduced", {});
      } else {
        let $ = values4.tail;
        if ($ instanceof Empty) {
          throw makeError("panic", FILEPATH2, "glance", 1578, "handle_bit_array_size_operator", "parser bug, bit array size not fully reduced", {});
        } else {
          let next$1 = next2[0];
          let previous = operators.head;
          let operators$1 = operators.tail;
          let a2 = values4.head;
          let b = $.head;
          let rest_values = $.tail;
          let $1 = bit_array_size_precedence(previous) >= bit_array_size_precedence(next$1);
          if ($1) {
            let span2 = new Span(b.location.start, a2.location.end);
            let size3 = new BitArraySizeBinaryOperator(span2, previous, b, a2);
            let values$1 = prepend(size3, rest_values);
            loop$next = new Some(next$1);
            loop$operators = operators$1;
            loop$values = values$1;
          } else {
            return [
              Option$None$const,
              prepend(next$1, prepend(previous, operators$1)),
              values4
            ];
          }
        }
      }
    } else if (operators instanceof Empty) {
      if (values4 instanceof Empty) {
        return [Option$None$const, operators, values4];
      } else if (values4.tail instanceof Empty) {
        let size3 = values4.head;
        return [new Some(size3), operators, values4];
      } else {
        throw makeError("panic", FILEPATH2, "glance", 1578, "handle_bit_array_size_operator", "parser bug, bit array size not fully reduced", {});
      }
    } else if (values4 instanceof Empty) {
      throw makeError("panic", FILEPATH2, "glance", 1578, "handle_bit_array_size_operator", "parser bug, bit array size not fully reduced", {});
    } else {
      let $ = values4.tail;
      if ($ instanceof Empty) {
        throw makeError("panic", FILEPATH2, "glance", 1578, "handle_bit_array_size_operator", "parser bug, bit array size not fully reduced", {});
      } else {
        let operator = operators.head;
        let operators$1 = operators.tail;
        let a2 = values4.head;
        let b = $.head;
        let values$1 = $.tail;
        let values$2 = prepend(new BitArraySizeBinaryOperator(new Span(b.location.start, a2.location.end), operator, b, a2), values$1);
        loop$next = Option$None$const;
        loop$operators = operators$1;
        loop$values = values$2;
      }
    }
  }
}
function bit_array_size_operator(token3) {
  if (token3 instanceof Plus) {
    return new Ok(BitArraySizeOperator$BitArraySizeAdd$const);
  } else if (token3 instanceof Minus) {
    return new Ok(BitArraySizeOperator$BitArraySizeSubtract$const);
  } else if (token3 instanceof Star) {
    return new Ok(BitArraySizeOperator$BitArraySizeMultiply$const);
  } else if (token3 instanceof Slash) {
    return new Ok(BitArraySizeOperator$BitArraySizeDivide$const);
  } else if (token3 instanceof Percent) {
    return new Ok(BitArraySizeOperator$BitArraySizeRemainder$const);
  } else {
    return new Error(undefined);
  }
}
function pop_bit_array_size_operator(tokens) {
  if (tokens instanceof Empty) {
    return new Error(undefined);
  } else {
    let tokens$1 = tokens.tail;
    let token3 = tokens.head[0];
    return map4(bit_array_size_operator(token3), (operator) => {
      return [operator, tokens$1];
    });
  }
}
function bit_array_size_unit(tokens) {
  if (tokens instanceof Empty) {
    return new Error(Error$UnexpectedEndOfInput$const);
  } else {
    let $ = tokens.head[0];
    if ($ instanceof Name) {
      let tokens$1 = tokens.tail;
      let start5 = tokens.head[1].byte_offset;
      let name$1 = $[0];
      return new Ok([
        new BitArraySizeVariable(span_from_string(start5, name$1), name$1),
        tokens$1
      ]);
    } else if ($ instanceof Int) {
      let tokens$1 = tokens.tail;
      let start5 = tokens.head[1].byte_offset;
      let value2 = $[0];
      return new Ok([new BitArraySizeInt(span_from_string(start5, value2), value2), tokens$1]);
    } else if ($ instanceof LeftBrace) {
      let tokens$1 = tokens.tail;
      let start5 = tokens.head[1].byte_offset;
      return try$(bit_array_size(tokens$1), (_use0) => {
        let inner = _use0[0];
        let tokens$2 = _use0[1];
        return expect(Token$RightBrace$const, tokens$2, (_use02, tokens2) => {
          let end = _use02.byte_offset;
          return new Ok([new BitArraySizeBlock(new Span(start5, end + 1), inner), tokens2]);
        });
      });
    } else {
      let other = $;
      let position = tokens.head[1];
      return new Error(new UnexpectedToken(other, position));
    }
  }
}
function bit_array_size_loop(tokens, operators, values4) {
  return try$(bit_array_size_unit(tokens), (_use0) => {
    let size3 = _use0[0];
    let tokens$1 = _use0[1];
    let values$1 = prepend(size3, values4);
    let $ = pop_bit_array_size_operator(tokens$1);
    if ($ instanceof Ok) {
      let operator = $[0][0];
      let tokens$2 = $[0][1];
      let $1 = handle_bit_array_size_operator(new Some(operator), operators, values$1);
      let $2 = $1[0];
      if ($2 instanceof Some) {
        let size$1 = $2[0];
        return new Ok([size$1, tokens$2]);
      } else {
        let operators$1 = $1[1];
        let values$2 = $1[2];
        return bit_array_size_loop(tokens$2, operators$1, values$2);
      }
    } else {
      let $1 = handle_bit_array_size_operator(Option$None$const, operators, values$1)[0];
      if ($1 instanceof Some) {
        let size$1 = $1[0];
        return new Ok([size$1, tokens$1]);
      } else {
        return unexpected_error(tokens$1);
      }
    }
  });
}
function bit_array_size(tokens) {
  return bit_array_size_loop(tokens, List$Empty$const, List$Empty$const);
}
function pattern_constructor_arguments(arguments$, tokens) {
  if (tokens instanceof Empty) {
    let tokens$1 = tokens;
    return try$(field2(tokens$1, pattern), (_use0) => {
      let pattern$1 = _use0[0];
      let tokens$2 = _use0[1];
      let arguments$1 = prepend(pattern$1, arguments$);
      if (tokens$2 instanceof Empty) {
        return new Error(Error$UnexpectedEndOfInput$const);
      } else {
        let $ = tokens$2.head[0];
        if ($ instanceof RightParen) {
          let tokens$3 = tokens$2.tail;
          let end = tokens$2.head[1].byte_offset;
          return new Ok(new PatternConstructorArguments(arguments$1, false, end + 1, tokens$3));
        } else if ($ instanceof Comma) {
          let $1 = tokens$2.tail;
          if ($1 instanceof Empty) {
            let tokens$3 = $1;
            return pattern_constructor_arguments(arguments$1, tokens$3);
          } else {
            let $2 = $1.tail;
            if ($2 instanceof Empty) {
              let tokens$3 = $1;
              return pattern_constructor_arguments(arguments$1, tokens$3);
            } else if ($1.head[0] instanceof DotDot && $2.head[0] instanceof RightParen) {
              let tokens$3 = $2.tail;
              let end = $2.head[1].byte_offset;
              return new Ok(new PatternConstructorArguments(arguments$1, true, end + 1, tokens$3));
            } else {
              let tokens$3 = $1;
              return pattern_constructor_arguments(arguments$1, tokens$3);
            }
          }
        } else {
          let token3 = $;
          let position = tokens$2.head[1];
          return new Error(new UnexpectedToken(token3, position));
        }
      }
    });
  } else {
    let $ = tokens.head[0];
    if ($ instanceof RightParen) {
      let tokens$1 = tokens.tail;
      let end = tokens.head[1].byte_offset;
      return new Ok(new PatternConstructorArguments(arguments$, false, end + 1, tokens$1));
    } else if ($ instanceof DotDot) {
      let $1 = tokens.tail;
      if ($1 instanceof Empty) {
        let tokens$1 = tokens;
        return try$(field2(tokens$1, pattern), (_use0) => {
          let pattern$1 = _use0[0];
          let tokens$2 = _use0[1];
          let arguments$1 = prepend(pattern$1, arguments$);
          if (tokens$2 instanceof Empty) {
            return new Error(Error$UnexpectedEndOfInput$const);
          } else {
            let $2 = tokens$2.head[0];
            if ($2 instanceof RightParen) {
              let tokens$3 = tokens$2.tail;
              let end = tokens$2.head[1].byte_offset;
              return new Ok(new PatternConstructorArguments(arguments$1, false, end + 1, tokens$3));
            } else if ($2 instanceof Comma) {
              let $3 = tokens$2.tail;
              if ($3 instanceof Empty) {
                let tokens$3 = $3;
                return pattern_constructor_arguments(arguments$1, tokens$3);
              } else {
                let $4 = $3.tail;
                if ($4 instanceof Empty) {
                  let tokens$3 = $3;
                  return pattern_constructor_arguments(arguments$1, tokens$3);
                } else if ($3.head[0] instanceof DotDot && $4.head[0] instanceof RightParen) {
                  let tokens$3 = $4.tail;
                  let end = $4.head[1].byte_offset;
                  return new Ok(new PatternConstructorArguments(arguments$1, true, end + 1, tokens$3));
                } else {
                  let tokens$3 = $3;
                  return pattern_constructor_arguments(arguments$1, tokens$3);
                }
              }
            } else {
              let token3 = $2;
              let position = tokens$2.head[1];
              return new Error(new UnexpectedToken(token3, position));
            }
          }
        });
      } else {
        let $2 = $1.tail;
        if ($2 instanceof Empty) {
          if ($1.head[0] instanceof RightParen) {
            let tokens$1 = $2;
            let end = $1.head[1].byte_offset;
            return new Ok(new PatternConstructorArguments(arguments$, true, end + 1, tokens$1));
          } else {
            let tokens$1 = tokens;
            return try$(field2(tokens$1, pattern), (_use0) => {
              let pattern$1 = _use0[0];
              let tokens$2 = _use0[1];
              let arguments$1 = prepend(pattern$1, arguments$);
              if (tokens$2 instanceof Empty) {
                return new Error(Error$UnexpectedEndOfInput$const);
              } else {
                let $3 = tokens$2.head[0];
                if ($3 instanceof RightParen) {
                  let tokens$3 = tokens$2.tail;
                  let end = tokens$2.head[1].byte_offset;
                  return new Ok(new PatternConstructorArguments(arguments$1, false, end + 1, tokens$3));
                } else if ($3 instanceof Comma) {
                  let $4 = tokens$2.tail;
                  if ($4 instanceof Empty) {
                    let tokens$3 = $4;
                    return pattern_constructor_arguments(arguments$1, tokens$3);
                  } else {
                    let $5 = $4.tail;
                    if ($5 instanceof Empty) {
                      let tokens$3 = $4;
                      return pattern_constructor_arguments(arguments$1, tokens$3);
                    } else if ($4.head[0] instanceof DotDot && $5.head[0] instanceof RightParen) {
                      let tokens$3 = $5.tail;
                      let end = $5.head[1].byte_offset;
                      return new Ok(new PatternConstructorArguments(arguments$1, true, end + 1, tokens$3));
                    } else {
                      let tokens$3 = $4;
                      return pattern_constructor_arguments(arguments$1, tokens$3);
                    }
                  }
                } else {
                  let token3 = $3;
                  let position = tokens$2.head[1];
                  return new Error(new UnexpectedToken(token3, position));
                }
              }
            });
          }
        } else {
          let $3 = $1.head[0];
          if ($3 instanceof RightParen) {
            let tokens$1 = $2;
            let end = $1.head[1].byte_offset;
            return new Ok(new PatternConstructorArguments(arguments$, true, end + 1, tokens$1));
          } else if ($3 instanceof Comma && $2.head[0] instanceof RightParen) {
            let tokens$1 = $2.tail;
            let end = $2.head[1].byte_offset;
            return new Ok(new PatternConstructorArguments(arguments$, true, end + 1, tokens$1));
          } else {
            let tokens$1 = tokens;
            return try$(field2(tokens$1, pattern), (_use0) => {
              let pattern$1 = _use0[0];
              let tokens$2 = _use0[1];
              let arguments$1 = prepend(pattern$1, arguments$);
              if (tokens$2 instanceof Empty) {
                return new Error(Error$UnexpectedEndOfInput$const);
              } else {
                let $4 = tokens$2.head[0];
                if ($4 instanceof RightParen) {
                  let tokens$3 = tokens$2.tail;
                  let end = tokens$2.head[1].byte_offset;
                  return new Ok(new PatternConstructorArguments(arguments$1, false, end + 1, tokens$3));
                } else if ($4 instanceof Comma) {
                  let $5 = tokens$2.tail;
                  if ($5 instanceof Empty) {
                    let tokens$3 = $5;
                    return pattern_constructor_arguments(arguments$1, tokens$3);
                  } else {
                    let $6 = $5.tail;
                    if ($6 instanceof Empty) {
                      let tokens$3 = $5;
                      return pattern_constructor_arguments(arguments$1, tokens$3);
                    } else if ($5.head[0] instanceof DotDot && $6.head[0] instanceof RightParen) {
                      let tokens$3 = $6.tail;
                      let end = $6.head[1].byte_offset;
                      return new Ok(new PatternConstructorArguments(arguments$1, true, end + 1, tokens$3));
                    } else {
                      let tokens$3 = $5;
                      return pattern_constructor_arguments(arguments$1, tokens$3);
                    }
                  }
                } else {
                  let token3 = $4;
                  let position = tokens$2.head[1];
                  return new Error(new UnexpectedToken(token3, position));
                }
              }
            });
          }
        }
      }
    } else {
      let tokens$1 = tokens;
      return try$(field2(tokens$1, pattern), (_use0) => {
        let pattern$1 = _use0[0];
        let tokens$2 = _use0[1];
        let arguments$1 = prepend(pattern$1, arguments$);
        if (tokens$2 instanceof Empty) {
          return new Error(Error$UnexpectedEndOfInput$const);
        } else {
          let $1 = tokens$2.head[0];
          if ($1 instanceof RightParen) {
            let tokens$3 = tokens$2.tail;
            let end = tokens$2.head[1].byte_offset;
            return new Ok(new PatternConstructorArguments(arguments$1, false, end + 1, tokens$3));
          } else if ($1 instanceof Comma) {
            let $2 = tokens$2.tail;
            if ($2 instanceof Empty) {
              let tokens$3 = $2;
              return pattern_constructor_arguments(arguments$1, tokens$3);
            } else {
              let $3 = $2.tail;
              if ($3 instanceof Empty) {
                let tokens$3 = $2;
                return pattern_constructor_arguments(arguments$1, tokens$3);
              } else if ($2.head[0] instanceof DotDot && $3.head[0] instanceof RightParen) {
                let tokens$3 = $3.tail;
                let end = $3.head[1].byte_offset;
                return new Ok(new PatternConstructorArguments(arguments$1, true, end + 1, tokens$3));
              } else {
                let tokens$3 = $2;
                return pattern_constructor_arguments(arguments$1, tokens$3);
              }
            }
          } else {
            let token3 = $1;
            let position = tokens$2.head[1];
            return new Error(new UnexpectedToken(token3, position));
          }
        }
      });
    }
  }
}
function pattern_constructor(module, constructor, tokens, start5, name_start) {
  if (tokens instanceof Empty) {
    let span2 = new Span(start5, string_offset(name_start, constructor));
    let pattern$1 = new PatternVariant(span2, module, constructor, List$Empty$const, false);
    return new Ok([pattern$1, tokens]);
  } else if (tokens.head[0] instanceof LeftParen) {
    let tokens$1 = tokens.tail;
    let result = pattern_constructor_arguments(List$Empty$const, tokens$1);
    return try$(result, (_use0) => {
      let patterns = _use0.fields;
      let spread = _use0.spread;
      let end = _use0.end;
      let tokens$2 = _use0.remaining_tokens;
      let arguments$ = reverse2(patterns);
      let pattern$1 = new PatternVariant(new Span(start5, end), module, constructor, arguments$, spread);
      return new Ok([pattern$1, tokens$2]);
    });
  } else {
    let span2 = new Span(start5, string_offset(name_start, constructor));
    let pattern$1 = new PatternVariant(span2, module, constructor, List$Empty$const, false);
    return new Ok([pattern$1, tokens]);
  }
}
function pattern(tokens) {
  return try$((() => {
    if (tokens instanceof Empty) {
      return new Error(Error$UnexpectedEndOfInput$const);
    } else {
      let $ = tokens.head[0];
      if ($ instanceof Name) {
        let $1 = tokens.tail;
        if ($1 instanceof Empty) {
          let tokens$1 = $1;
          let start5 = tokens.head[1].byte_offset;
          let name$1 = $[0];
          return new Ok([
            new PatternVariable(span_from_string(start5, name$1), name$1),
            tokens$1
          ]);
        } else {
          let $2 = $1.tail;
          if ($2 instanceof Empty) {
            let tokens$1 = $1;
            let start5 = tokens.head[1].byte_offset;
            let name$1 = $[0];
            return new Ok([
              new PatternVariable(span_from_string(start5, name$1), name$1),
              tokens$1
            ]);
          } else if ($1.head[0] instanceof Dot) {
            let $3 = $2.head[0];
            if ($3 instanceof UpperName) {
              let start5 = tokens.head[1].byte_offset;
              let module$1 = $[0];
              let tokens$1 = $2.tail;
              let name_start = $2.head[1].byte_offset;
              let name$1 = $3[0];
              return pattern_constructor(new Some(module$1), name$1, tokens$1, start5, name_start);
            } else {
              let tokens$1 = $1;
              let start5 = tokens.head[1].byte_offset;
              let name$1 = $[0];
              return new Ok([
                new PatternVariable(span_from_string(start5, name$1), name$1),
                tokens$1
              ]);
            }
          } else {
            let tokens$1 = $1;
            let start5 = tokens.head[1].byte_offset;
            let name$1 = $[0];
            return new Ok([
              new PatternVariable(span_from_string(start5, name$1), name$1),
              tokens$1
            ]);
          }
        }
      } else if ($ instanceof UpperName) {
        let tokens$1 = tokens.tail;
        let start5 = tokens.head[1].byte_offset;
        let name$1 = $[0];
        return pattern_constructor(Option$None$const, name$1, tokens$1, start5, start5);
      } else if ($ instanceof DiscardName) {
        let tokens$1 = tokens.tail;
        let start5 = tokens.head[1].byte_offset;
        let name$1 = $[0];
        return new Ok([
          new PatternDiscard(new Span(start5, string_offset(start5, name$1) + 1), name$1),
          tokens$1
        ]);
      } else if ($ instanceof Int) {
        let tokens$1 = tokens.tail;
        let start5 = tokens.head[1].byte_offset;
        let value2 = $[0];
        return new Ok([new PatternInt(span_from_string(start5, value2), value2), tokens$1]);
      } else if ($ instanceof Float) {
        let tokens$1 = tokens.tail;
        let start5 = tokens.head[1].byte_offset;
        let value2 = $[0];
        return new Ok([new PatternFloat(span_from_string(start5, value2), value2), tokens$1]);
      } else if ($ instanceof String2) {
        let $1 = tokens.tail;
        if ($1 instanceof Empty) {
          let tokens$1 = $1;
          let start5 = tokens.head[1].byte_offset;
          let value2 = $[0];
          return new Ok([
            new PatternString(new Span(start5, string_offset(start5, value2) + 2), value2),
            tokens$1
          ]);
        } else {
          let $2 = $1.tail;
          if ($2 instanceof Empty) {
            let tokens$1 = $1;
            let start5 = tokens.head[1].byte_offset;
            let value2 = $[0];
            return new Ok([
              new PatternString(new Span(start5, string_offset(start5, value2) + 2), value2),
              tokens$1
            ]);
          } else {
            let $3 = $2.tail;
            if ($3 instanceof Empty) {
              if ($1.head[0] instanceof LessGreater) {
                let $4 = $2.head[0];
                if ($4 instanceof Name) {
                  let start5 = tokens.head[1].byte_offset;
                  let v = $[0];
                  let tokens$1 = $3;
                  let name_start = $2.head[1].byte_offset;
                  let n = $4[0];
                  let span2 = new Span(start5, string_offset(name_start, n));
                  let pattern$1 = new PatternConcatenate(span2, v, Option$None$const, new Named(n));
                  return new Ok([pattern$1, tokens$1]);
                } else if ($4 instanceof DiscardName) {
                  let start5 = tokens.head[1].byte_offset;
                  let v = $[0];
                  let tokens$1 = $3;
                  let name_start = $2.head[1].byte_offset;
                  let n = $4[0];
                  let span2 = new Span(start5, string_offset(name_start, n) + 1);
                  let pattern$1 = new PatternConcatenate(span2, v, Option$None$const, new Discarded(n));
                  return new Ok([pattern$1, tokens$1]);
                } else {
                  let tokens$1 = $1;
                  let start5 = tokens.head[1].byte_offset;
                  let value2 = $[0];
                  return new Ok([
                    new PatternString(new Span(start5, string_offset(start5, value2) + 2), value2),
                    tokens$1
                  ]);
                }
              } else {
                let tokens$1 = $1;
                let start5 = tokens.head[1].byte_offset;
                let value2 = $[0];
                return new Ok([
                  new PatternString(new Span(start5, string_offset(start5, value2) + 2), value2),
                  tokens$1
                ]);
              }
            } else {
              let $4 = $3.tail;
              if ($4 instanceof Empty) {
                if ($1.head[0] instanceof LessGreater) {
                  let $5 = $2.head[0];
                  if ($5 instanceof Name) {
                    let start5 = tokens.head[1].byte_offset;
                    let v = $[0];
                    let tokens$1 = $3;
                    let name_start = $2.head[1].byte_offset;
                    let n = $5[0];
                    let span2 = new Span(start5, string_offset(name_start, n));
                    let pattern$1 = new PatternConcatenate(span2, v, Option$None$const, new Named(n));
                    return new Ok([pattern$1, tokens$1]);
                  } else if ($5 instanceof DiscardName) {
                    let start5 = tokens.head[1].byte_offset;
                    let v = $[0];
                    let tokens$1 = $3;
                    let name_start = $2.head[1].byte_offset;
                    let n = $5[0];
                    let span2 = new Span(start5, string_offset(name_start, n) + 1);
                    let pattern$1 = new PatternConcatenate(span2, v, Option$None$const, new Discarded(n));
                    return new Ok([pattern$1, tokens$1]);
                  } else {
                    let tokens$1 = $1;
                    let start5 = tokens.head[1].byte_offset;
                    let value2 = $[0];
                    return new Ok([
                      new PatternString(new Span(start5, string_offset(start5, value2) + 2), value2),
                      tokens$1
                    ]);
                  }
                } else {
                  let tokens$1 = $1;
                  let start5 = tokens.head[1].byte_offset;
                  let value2 = $[0];
                  return new Ok([
                    new PatternString(new Span(start5, string_offset(start5, value2) + 2), value2),
                    tokens$1
                  ]);
                }
              } else {
                let $5 = $1.head[0];
                if ($5 instanceof As) {
                  let $6 = $2.head[0];
                  if ($6 instanceof Name && $3.head[0] instanceof LessGreater) {
                    let $7 = $4.head[0];
                    if ($7 instanceof Name) {
                      let start5 = tokens.head[1].byte_offset;
                      let v = $[0];
                      let tokens$1 = $4.tail;
                      let name_start = $4.head[1].byte_offset;
                      let l = $6[0];
                      let r = $7[0];
                      let span2 = new Span(start5, string_offset(name_start, r));
                      let pattern$1 = new PatternConcatenate(span2, v, new Some(new Named(l)), new Named(r));
                      return new Ok([pattern$1, tokens$1]);
                    } else if ($7 instanceof DiscardName) {
                      let start5 = tokens.head[1].byte_offset;
                      let v = $[0];
                      let tokens$1 = $4.tail;
                      let name_start = $4.head[1].byte_offset;
                      let l = $6[0];
                      let r = $7[0];
                      let span2 = new Span(start5, string_offset(name_start, r) + 1);
                      let pattern$1 = new PatternConcatenate(span2, v, new Some(new Named(l)), new Discarded(r));
                      return new Ok([pattern$1, tokens$1]);
                    } else {
                      let tokens$1 = $1;
                      let start5 = tokens.head[1].byte_offset;
                      let value2 = $[0];
                      return new Ok([
                        new PatternString(new Span(start5, string_offset(start5, value2) + 2), value2),
                        tokens$1
                      ]);
                    }
                  } else if ($6 instanceof DiscardName && $3.head[0] instanceof LessGreater) {
                    let $7 = $4.head[0];
                    if ($7 instanceof Name) {
                      let start5 = tokens.head[1].byte_offset;
                      let v = $[0];
                      let tokens$1 = $4.tail;
                      let name_start = $4.head[1].byte_offset;
                      let l = $6[0];
                      let r = $7[0];
                      let span2 = new Span(start5, string_offset(name_start, r));
                      let pattern$1 = new PatternConcatenate(span2, v, new Some(new Discarded(l)), new Named(r));
                      return new Ok([pattern$1, tokens$1]);
                    } else {
                      let tokens$1 = $1;
                      let start5 = tokens.head[1].byte_offset;
                      let value2 = $[0];
                      return new Ok([
                        new PatternString(new Span(start5, string_offset(start5, value2) + 2), value2),
                        tokens$1
                      ]);
                    }
                  } else {
                    let tokens$1 = $1;
                    let start5 = tokens.head[1].byte_offset;
                    let value2 = $[0];
                    return new Ok([
                      new PatternString(new Span(start5, string_offset(start5, value2) + 2), value2),
                      tokens$1
                    ]);
                  }
                } else if ($5 instanceof LessGreater) {
                  let $6 = $2.head[0];
                  if ($6 instanceof Name) {
                    let start5 = tokens.head[1].byte_offset;
                    let v = $[0];
                    let tokens$1 = $3;
                    let name_start = $2.head[1].byte_offset;
                    let n = $6[0];
                    let span2 = new Span(start5, string_offset(name_start, n));
                    let pattern$1 = new PatternConcatenate(span2, v, Option$None$const, new Named(n));
                    return new Ok([pattern$1, tokens$1]);
                  } else if ($6 instanceof DiscardName) {
                    let start5 = tokens.head[1].byte_offset;
                    let v = $[0];
                    let tokens$1 = $3;
                    let name_start = $2.head[1].byte_offset;
                    let n = $6[0];
                    let span2 = new Span(start5, string_offset(name_start, n) + 1);
                    let pattern$1 = new PatternConcatenate(span2, v, Option$None$const, new Discarded(n));
                    return new Ok([pattern$1, tokens$1]);
                  } else {
                    let tokens$1 = $1;
                    let start5 = tokens.head[1].byte_offset;
                    let value2 = $[0];
                    return new Ok([
                      new PatternString(new Span(start5, string_offset(start5, value2) + 2), value2),
                      tokens$1
                    ]);
                  }
                } else {
                  let tokens$1 = $1;
                  let start5 = tokens.head[1].byte_offset;
                  let value2 = $[0];
                  return new Ok([
                    new PatternString(new Span(start5, string_offset(start5, value2) + 2), value2),
                    tokens$1
                  ]);
                }
              }
            }
          }
        }
      } else if ($ instanceof LeftSquare) {
        let tokens$1 = tokens.tail;
        let start5 = tokens.head[1].byte_offset;
        let result = list4(pattern, new Some((_capture) => {
          return new PatternDiscard(_capture, "");
        }), List$Empty$const, tokens$1);
        return map4(result, (_use0) => {
          let elements = _use0.values;
          let rest = _use0.spread;
          let tokens$2 = _use0.remaining_tokens;
          let end = _use0.end;
          return [
            new PatternList(new Span(start5, end), elements, rest),
            tokens$2
          ];
        });
      } else if ($ instanceof Hash) {
        let $1 = tokens.tail;
        if ($1 instanceof Empty) {
          let other = $;
          let position = tokens.head[1];
          return new Error(new UnexpectedToken(other, position));
        } else if ($1.head[0] instanceof LeftParen) {
          let start5 = tokens.head[1].byte_offset;
          let tokens$1 = $1.tail;
          let result = comma_delimited(List$Empty$const, tokens$1, pattern, Token$RightParen$const);
          return try$(result, (_use0) => {
            let patterns = _use0[0];
            let end = _use0[1];
            let tokens$2 = _use0[2];
            return new Ok([new PatternTuple(new Span(start5, end), patterns), tokens$2]);
          });
        } else {
          let other = $;
          let position = tokens.head[1];
          return new Error(new UnexpectedToken(other, position));
        }
      } else if ($ instanceof LessLess) {
        let tokens$1 = tokens.tail;
        let start5 = tokens.head[1].byte_offset;
        let parser = (_capture) => {
          return bit_string_segment(pattern, bit_array_size, _capture);
        };
        let result = comma_delimited(List$Empty$const, tokens$1, parser, Token$GreaterGreater$const);
        return try$(result, (_use0) => {
          let segments = _use0[0];
          let end = _use0[1];
          let tokens$2 = _use0[2];
          return new Ok([new PatternBitString(new Span(start5, end), segments), tokens$2]);
        });
      } else {
        let other = $;
        let position = tokens.head[1];
        return new Error(new UnexpectedToken(other, position));
      }
    }
  })(), (_use0) => {
    let pattern$1 = _use0[0];
    let tokens$1 = _use0[1];
    if (tokens$1 instanceof Empty) {
      return new Ok([pattern$1, tokens$1]);
    } else {
      let $ = tokens$1.tail;
      if ($ instanceof Empty) {
        return new Ok([pattern$1, tokens$1]);
      } else if (tokens$1.head[0] instanceof As) {
        let $1 = $.head[0];
        if ($1 instanceof Name) {
          let tokens$2 = $.tail;
          let name_start = $.head[1].byte_offset;
          let name$1 = $1[0];
          let span2 = new Span(pattern$1.location.start, string_offset(name_start, name$1));
          let pattern$2 = new PatternAssignment(span2, pattern$1, name$1);
          return new Ok([pattern$2, tokens$2]);
        } else {
          return new Ok([pattern$1, tokens$1]);
        }
      } else {
        return new Ok([pattern$1, tokens$1]);
      }
    }
  });
}
function named_type(name, module, tokens, start5, name_start) {
  return try$((() => {
    if (tokens instanceof Empty) {
      let end = name_start + byte_size(name);
      return new Ok([List$Empty$const, end, tokens]);
    } else if (tokens.head[0] instanceof LeftParen) {
      let tokens$1 = tokens.tail;
      return comma_delimited(List$Empty$const, tokens$1, type_2, Token$RightParen$const);
    } else {
      let end = name_start + byte_size(name);
      return new Ok([List$Empty$const, end, tokens]);
    }
  })(), (_use0) => {
    let parameters = _use0[0];
    let end = _use0[1];
    let tokens$1 = _use0[2];
    let t = new NamedType(new Span(start5, end), name, module, parameters);
    return new Ok([t, tokens$1]);
  });
}
function tuple_type(start5, tokens) {
  let result = comma_delimited(List$Empty$const, tokens, type_2, Token$RightParen$const);
  return try$(result, (_use0) => {
    let types = _use0[0];
    let end = _use0[1];
    let tokens$1 = _use0[2];
    let span2 = new Span(start5, end);
    return new Ok([new TupleType(span2, types), tokens$1]);
  });
}
function fn_type(start5, tokens) {
  let result = comma_delimited(List$Empty$const, tokens, type_2, Token$RightParen$const);
  return try$(result, (_use0) => {
    let parameters = _use0[0];
    let tokens$1 = _use0[2];
    return expect(Token$RightArrow$const, tokens$1, (_, tokens2) => {
      return try$(type_2(tokens2), (_use02) => {
        let return$ = _use02[0];
        let tokens$2 = _use02[1];
        let span2 = new Span(start5, return$.location.end);
        return new Ok([new FunctionType(span2, parameters, return$), tokens$2]);
      });
    });
  });
}
function type_2(tokens) {
  if (tokens instanceof Empty) {
    return new Error(Error$UnexpectedEndOfInput$const);
  } else {
    let $ = tokens.tail;
    if ($ instanceof Empty) {
      let $1 = tokens.head[0];
      if ($1 instanceof Name) {
        let tokens$1 = $;
        let i = tokens.head[1].byte_offset;
        let name$1 = $1[0];
        let value2 = new VariableType(span_from_string(i, name$1), name$1);
        return new Ok([value2, tokens$1]);
      } else if ($1 instanceof UpperName) {
        let tokens$1 = $;
        let start5 = tokens.head[1].byte_offset;
        let name$1 = $1[0];
        return named_type(name$1, Option$None$const, tokens$1, start5, start5);
      } else if ($1 instanceof DiscardName) {
        let tokens$1 = $;
        let i = tokens.head[1].byte_offset;
        let name$1 = $1[0];
        let value2 = new HoleType(new Span(i, string_offset(i, name$1) + 1), name$1);
        return new Ok([value2, tokens$1]);
      } else {
        let token3 = $1;
        let position = tokens.head[1];
        return new Error(new UnexpectedToken(token3, position));
      }
    } else {
      let $1 = tokens.head[0];
      if ($1 instanceof Name) {
        let $2 = $.tail;
        if ($2 instanceof Empty) {
          let tokens$1 = $;
          let i = tokens.head[1].byte_offset;
          let name$1 = $1[0];
          let value2 = new VariableType(span_from_string(i, name$1), name$1);
          return new Ok([value2, tokens$1]);
        } else if ($.head[0] instanceof Dot) {
          let $3 = $2.head[0];
          if ($3 instanceof UpperName) {
            let start5 = tokens.head[1].byte_offset;
            let module$1 = $1[0];
            let tokens$1 = $2.tail;
            let end = $2.head[1].byte_offset;
            let name$1 = $3[0];
            return named_type(name$1, new Some(module$1), tokens$1, start5, end);
          } else {
            let tokens$1 = $;
            let i = tokens.head[1].byte_offset;
            let name$1 = $1[0];
            let value2 = new VariableType(span_from_string(i, name$1), name$1);
            return new Ok([value2, tokens$1]);
          }
        } else {
          let tokens$1 = $;
          let i = tokens.head[1].byte_offset;
          let name$1 = $1[0];
          let value2 = new VariableType(span_from_string(i, name$1), name$1);
          return new Ok([value2, tokens$1]);
        }
      } else if ($1 instanceof UpperName) {
        let tokens$1 = $;
        let start5 = tokens.head[1].byte_offset;
        let name$1 = $1[0];
        return named_type(name$1, Option$None$const, tokens$1, start5, start5);
      } else if ($1 instanceof DiscardName) {
        let tokens$1 = $;
        let i = tokens.head[1].byte_offset;
        let name$1 = $1[0];
        let value2 = new HoleType(new Span(i, string_offset(i, name$1) + 1), name$1);
        return new Ok([value2, tokens$1]);
      } else if ($1 instanceof Fn && $.head[0] instanceof LeftParen) {
        let i = tokens.head[1].byte_offset;
        let tokens$1 = $.tail;
        return fn_type(i, tokens$1);
      } else if ($1 instanceof Hash && $.head[0] instanceof LeftParen) {
        let i = tokens.head[1].byte_offset;
        let tokens$1 = $.tail;
        return tuple_type(i, tokens$1);
      } else {
        let token3 = $1;
        let position = tokens.head[1];
        return new Error(new UnexpectedToken(token3, position));
      }
    }
  }
}
function optional_return_annotation(end, tokens) {
  if (tokens instanceof Empty) {
    return new Ok([Option$None$const, end, tokens]);
  } else if (tokens.head[0] instanceof RightArrow) {
    let tokens$1 = tokens.tail;
    return try$(type_2(tokens$1), (_use0) => {
      let return_type = _use0[0];
      let tokens$2 = _use0[1];
      return new Ok([new Some(return_type), return_type.location.end, tokens$2]);
    });
  } else {
    return new Ok([Option$None$const, end, tokens]);
  }
}
function optional_type_annotation(tokens) {
  if (tokens instanceof Empty) {
    return new Ok([Option$None$const, tokens]);
  } else if (tokens.head[0] instanceof Colon) {
    let tokens$1 = tokens.tail;
    return map4(type_2(tokens$1), (_use0) => {
      let annotation = _use0[0];
      let tokens$2 = _use0[1];
      return [new Some(annotation), tokens$2];
    });
  } else {
    return new Ok([Option$None$const, tokens]);
  }
}
function fn_parameter(tokens) {
  return try$((() => {
    if (tokens instanceof Empty) {
      return new Error(Error$UnexpectedEndOfInput$const);
    } else {
      let $ = tokens.head[0];
      if ($ instanceof Name) {
        let tokens$1 = tokens.tail;
        let name$1 = $[0];
        return new Ok([new Named(name$1), tokens$1]);
      } else if ($ instanceof DiscardName) {
        let tokens$1 = tokens.tail;
        let name$1 = $[0];
        return new Ok([new Discarded(name$1), tokens$1]);
      } else {
        let other = $;
        let position = tokens.head[1];
        return new Error(new UnexpectedToken(other, position));
      }
    }
  })(), (_use0) => {
    let name$1 = _use0[0];
    let tokens$1 = _use0[1];
    return try$(optional_type_annotation(tokens$1), (_use02) => {
      let type_$1 = _use02[0];
      let tokens$2 = _use02[1];
      return new Ok([new FnParameter(name$1, type_$1), tokens$2]);
    });
  });
}
function use_pattern(tokens) {
  return try$(pattern(tokens), (_use0) => {
    let pattern$1 = _use0[0];
    let tokens$1 = _use0[1];
    return try$(optional_type_annotation(tokens$1), (_use02) => {
      let annotation = _use02[0];
      let tokens$2 = _use02[1];
      return new Ok([new UsePattern(pattern$1, annotation), tokens$2]);
    });
  });
}
function fn_capture(label, function$, before, after, tokens) {
  if (tokens instanceof Empty) {
    return new Error(Error$UnexpectedEndOfInput$const);
  } else if (tokens.head[0] instanceof RightParen) {
    let tokens$1 = tokens.tail;
    let end = tokens.head[1].byte_offset;
    let span2 = new Span(function$.location.start, end + 1);
    let capture = new FnCapture(span2, label, function$, before, reverse2(after));
    return after_expression(capture, tokens$1);
  } else {
    return try$(field2(tokens, expression), (_use0) => {
      let argument = _use0[0];
      let tokens$1 = _use0[1];
      let after$1 = prepend(argument, after);
      if (tokens$1 instanceof Empty) {
        return new Error(Error$UnexpectedEndOfInput$const);
      } else {
        let $ = tokens$1.head[0];
        if ($ instanceof RightParen) {
          let tokens$2 = tokens$1.tail;
          let end = tokens$1.head[1].byte_offset;
          let span2 = new Span(function$.location.start, end + 1);
          let call$1 = new FnCapture(span2, label, function$, before, reverse2(after$1));
          return after_expression(call$1, tokens$2);
        } else if ($ instanceof Comma) {
          let tokens$2 = tokens$1.tail;
          return fn_capture(label, function$, before, after$1, tokens$2);
        } else {
          let other = $;
          let position = tokens$1.head[1];
          return new Error(new UnexpectedToken(other, position));
        }
      }
    });
  }
}
function call(arguments$, function$, tokens) {
  if (tokens instanceof Empty) {
    return new Error(Error$UnexpectedEndOfInput$const);
  } else {
    let $ = tokens.head[0];
    if ($ instanceof Name) {
      let $1 = tokens.tail;
      if ($1 instanceof Empty) {
        return try$(field2(tokens, expression), (_use0) => {
          let argument = _use0[0];
          let tokens$1 = _use0[1];
          let arguments$1 = prepend(argument, arguments$);
          if (tokens$1 instanceof Empty) {
            return new Error(Error$UnexpectedEndOfInput$const);
          } else {
            let $2 = tokens$1.head[0];
            if ($2 instanceof RightParen) {
              let tokens$2 = tokens$1.tail;
              let end = tokens$1.head[1].byte_offset;
              let span2 = new Span(function$.location.start, end + 1);
              let call$1 = new Call(span2, function$, reverse2(arguments$1));
              return after_expression(call$1, tokens$2);
            } else if ($2 instanceof Comma) {
              let tokens$2 = tokens$1.tail;
              return call(arguments$1, function$, tokens$2);
            } else {
              let other = $2;
              let position = tokens$1.head[1];
              return new Error(new UnexpectedToken(other, position));
            }
          }
        });
      } else {
        let $2 = $1.tail;
        if ($2 instanceof Empty) {
          return try$(field2(tokens, expression), (_use0) => {
            let argument = _use0[0];
            let tokens$1 = _use0[1];
            let arguments$1 = prepend(argument, arguments$);
            if (tokens$1 instanceof Empty) {
              return new Error(Error$UnexpectedEndOfInput$const);
            } else {
              let $3 = tokens$1.head[0];
              if ($3 instanceof RightParen) {
                let tokens$2 = tokens$1.tail;
                let end = tokens$1.head[1].byte_offset;
                let span2 = new Span(function$.location.start, end + 1);
                let call$1 = new Call(span2, function$, reverse2(arguments$1));
                return after_expression(call$1, tokens$2);
              } else if ($3 instanceof Comma) {
                let tokens$2 = tokens$1.tail;
                return call(arguments$1, function$, tokens$2);
              } else {
                let other = $3;
                let position = tokens$1.head[1];
                return new Error(new UnexpectedToken(other, position));
              }
            }
          });
        } else {
          let $3 = $2.tail;
          if ($3 instanceof Empty) {
            if ($1.head[0] instanceof Colon) {
              let $4 = $2.head[0];
              if ($4 instanceof DiscardName && $4[0] === "") {
                let label = $[0];
                let tokens$1 = $3;
                return fn_capture(new Some(label), function$, reverse2(arguments$), List$Empty$const, tokens$1);
              } else {
                return try$(field2(tokens, expression), (_use0) => {
                  let argument = _use0[0];
                  let tokens$1 = _use0[1];
                  let arguments$1 = prepend(argument, arguments$);
                  if (tokens$1 instanceof Empty) {
                    return new Error(Error$UnexpectedEndOfInput$const);
                  } else {
                    let $5 = tokens$1.head[0];
                    if ($5 instanceof RightParen) {
                      let tokens$2 = tokens$1.tail;
                      let end = tokens$1.head[1].byte_offset;
                      let span2 = new Span(function$.location.start, end + 1);
                      let call$1 = new Call(span2, function$, reverse2(arguments$1));
                      return after_expression(call$1, tokens$2);
                    } else if ($5 instanceof Comma) {
                      let tokens$2 = tokens$1.tail;
                      return call(arguments$1, function$, tokens$2);
                    } else {
                      let other = $5;
                      let position = tokens$1.head[1];
                      return new Error(new UnexpectedToken(other, position));
                    }
                  }
                });
              }
            } else {
              return try$(field2(tokens, expression), (_use0) => {
                let argument = _use0[0];
                let tokens$1 = _use0[1];
                let arguments$1 = prepend(argument, arguments$);
                if (tokens$1 instanceof Empty) {
                  return new Error(Error$UnexpectedEndOfInput$const);
                } else {
                  let $4 = tokens$1.head[0];
                  if ($4 instanceof RightParen) {
                    let tokens$2 = tokens$1.tail;
                    let end = tokens$1.head[1].byte_offset;
                    let span2 = new Span(function$.location.start, end + 1);
                    let call$1 = new Call(span2, function$, reverse2(arguments$1));
                    return after_expression(call$1, tokens$2);
                  } else if ($4 instanceof Comma) {
                    let tokens$2 = tokens$1.tail;
                    return call(arguments$1, function$, tokens$2);
                  } else {
                    let other = $4;
                    let position = tokens$1.head[1];
                    return new Error(new UnexpectedToken(other, position));
                  }
                }
              });
            }
          } else {
            let $4 = $3.tail;
            if ($4 instanceof Empty) {
              if ($1.head[0] instanceof Colon) {
                let $5 = $2.head[0];
                if ($5 instanceof DiscardName) {
                  let $6 = $3.head[0];
                  if ($6 instanceof RightParen) {
                    if ($5[0] === "") {
                      let label = $[0];
                      let tokens$1 = $4;
                      let end = $3.head[1].byte_offset;
                      let span2 = new Span(function$.location.start, end + 1);
                      let capture = new FnCapture(span2, new Some(label), function$, reverse2(arguments$), List$Empty$const);
                      return after_expression(capture, tokens$1);
                    } else {
                      return try$(field2(tokens, expression), (_use0) => {
                        let argument = _use0[0];
                        let tokens$1 = _use0[1];
                        let arguments$1 = prepend(argument, arguments$);
                        if (tokens$1 instanceof Empty) {
                          return new Error(Error$UnexpectedEndOfInput$const);
                        } else {
                          let $7 = tokens$1.head[0];
                          if ($7 instanceof RightParen) {
                            let tokens$2 = tokens$1.tail;
                            let end = tokens$1.head[1].byte_offset;
                            let span2 = new Span(function$.location.start, end + 1);
                            let call$1 = new Call(span2, function$, reverse2(arguments$1));
                            return after_expression(call$1, tokens$2);
                          } else if ($7 instanceof Comma) {
                            let tokens$2 = tokens$1.tail;
                            return call(arguments$1, function$, tokens$2);
                          } else {
                            let other = $7;
                            let position = tokens$1.head[1];
                            return new Error(new UnexpectedToken(other, position));
                          }
                        }
                      });
                    }
                  } else if ($6 instanceof Comma) {
                    if ($5[0] === "") {
                      let label = $[0];
                      let tokens$1 = $4;
                      return fn_capture(new Some(label), function$, reverse2(arguments$), List$Empty$const, tokens$1);
                    } else {
                      return try$(field2(tokens, expression), (_use0) => {
                        let argument = _use0[0];
                        let tokens$1 = _use0[1];
                        let arguments$1 = prepend(argument, arguments$);
                        if (tokens$1 instanceof Empty) {
                          return new Error(Error$UnexpectedEndOfInput$const);
                        } else {
                          let $7 = tokens$1.head[0];
                          if ($7 instanceof RightParen) {
                            let tokens$2 = tokens$1.tail;
                            let end = tokens$1.head[1].byte_offset;
                            let span2 = new Span(function$.location.start, end + 1);
                            let call$1 = new Call(span2, function$, reverse2(arguments$1));
                            return after_expression(call$1, tokens$2);
                          } else if ($7 instanceof Comma) {
                            let tokens$2 = tokens$1.tail;
                            return call(arguments$1, function$, tokens$2);
                          } else {
                            let other = $7;
                            let position = tokens$1.head[1];
                            return new Error(new UnexpectedToken(other, position));
                          }
                        }
                      });
                    }
                  } else if ($5[0] === "") {
                    let label = $[0];
                    let tokens$1 = $3;
                    return fn_capture(new Some(label), function$, reverse2(arguments$), List$Empty$const, tokens$1);
                  } else {
                    return try$(field2(tokens, expression), (_use0) => {
                      let argument = _use0[0];
                      let tokens$1 = _use0[1];
                      let arguments$1 = prepend(argument, arguments$);
                      if (tokens$1 instanceof Empty) {
                        return new Error(Error$UnexpectedEndOfInput$const);
                      } else {
                        let $7 = tokens$1.head[0];
                        if ($7 instanceof RightParen) {
                          let tokens$2 = tokens$1.tail;
                          let end = tokens$1.head[1].byte_offset;
                          let span2 = new Span(function$.location.start, end + 1);
                          let call$1 = new Call(span2, function$, reverse2(arguments$1));
                          return after_expression(call$1, tokens$2);
                        } else if ($7 instanceof Comma) {
                          let tokens$2 = tokens$1.tail;
                          return call(arguments$1, function$, tokens$2);
                        } else {
                          let other = $7;
                          let position = tokens$1.head[1];
                          return new Error(new UnexpectedToken(other, position));
                        }
                      }
                    });
                  }
                } else {
                  return try$(field2(tokens, expression), (_use0) => {
                    let argument = _use0[0];
                    let tokens$1 = _use0[1];
                    let arguments$1 = prepend(argument, arguments$);
                    if (tokens$1 instanceof Empty) {
                      return new Error(Error$UnexpectedEndOfInput$const);
                    } else {
                      let $6 = tokens$1.head[0];
                      if ($6 instanceof RightParen) {
                        let tokens$2 = tokens$1.tail;
                        let end = tokens$1.head[1].byte_offset;
                        let span2 = new Span(function$.location.start, end + 1);
                        let call$1 = new Call(span2, function$, reverse2(arguments$1));
                        return after_expression(call$1, tokens$2);
                      } else if ($6 instanceof Comma) {
                        let tokens$2 = tokens$1.tail;
                        return call(arguments$1, function$, tokens$2);
                      } else {
                        let other = $6;
                        let position = tokens$1.head[1];
                        return new Error(new UnexpectedToken(other, position));
                      }
                    }
                  });
                }
              } else {
                return try$(field2(tokens, expression), (_use0) => {
                  let argument = _use0[0];
                  let tokens$1 = _use0[1];
                  let arguments$1 = prepend(argument, arguments$);
                  if (tokens$1 instanceof Empty) {
                    return new Error(Error$UnexpectedEndOfInput$const);
                  } else {
                    let $5 = tokens$1.head[0];
                    if ($5 instanceof RightParen) {
                      let tokens$2 = tokens$1.tail;
                      let end = tokens$1.head[1].byte_offset;
                      let span2 = new Span(function$.location.start, end + 1);
                      let call$1 = new Call(span2, function$, reverse2(arguments$1));
                      return after_expression(call$1, tokens$2);
                    } else if ($5 instanceof Comma) {
                      let tokens$2 = tokens$1.tail;
                      return call(arguments$1, function$, tokens$2);
                    } else {
                      let other = $5;
                      let position = tokens$1.head[1];
                      return new Error(new UnexpectedToken(other, position));
                    }
                  }
                });
              }
            } else if ($1.head[0] instanceof Colon) {
              let $5 = $2.head[0];
              if ($5 instanceof DiscardName) {
                let $6 = $3.head[0];
                if ($6 instanceof RightParen) {
                  if ($5[0] === "") {
                    let label = $[0];
                    let tokens$1 = $4;
                    let end = $3.head[1].byte_offset;
                    let span2 = new Span(function$.location.start, end + 1);
                    let capture = new FnCapture(span2, new Some(label), function$, reverse2(arguments$), List$Empty$const);
                    return after_expression(capture, tokens$1);
                  } else {
                    return try$(field2(tokens, expression), (_use0) => {
                      let argument = _use0[0];
                      let tokens$1 = _use0[1];
                      let arguments$1 = prepend(argument, arguments$);
                      if (tokens$1 instanceof Empty) {
                        return new Error(Error$UnexpectedEndOfInput$const);
                      } else {
                        let $7 = tokens$1.head[0];
                        if ($7 instanceof RightParen) {
                          let tokens$2 = tokens$1.tail;
                          let end = tokens$1.head[1].byte_offset;
                          let span2 = new Span(function$.location.start, end + 1);
                          let call$1 = new Call(span2, function$, reverse2(arguments$1));
                          return after_expression(call$1, tokens$2);
                        } else if ($7 instanceof Comma) {
                          let tokens$2 = tokens$1.tail;
                          return call(arguments$1, function$, tokens$2);
                        } else {
                          let other = $7;
                          let position = tokens$1.head[1];
                          return new Error(new UnexpectedToken(other, position));
                        }
                      }
                    });
                  }
                } else if ($6 instanceof Comma) {
                  if ($4.head[0] instanceof RightParen) {
                    if ($5[0] === "") {
                      let label = $[0];
                      let tokens$1 = $4.tail;
                      let end = $4.head[1].byte_offset;
                      let span2 = new Span(function$.location.start, end + 1);
                      let capture = new FnCapture(span2, new Some(label), function$, reverse2(arguments$), List$Empty$const);
                      return after_expression(capture, tokens$1);
                    } else {
                      return try$(field2(tokens, expression), (_use0) => {
                        let argument = _use0[0];
                        let tokens$1 = _use0[1];
                        let arguments$1 = prepend(argument, arguments$);
                        if (tokens$1 instanceof Empty) {
                          return new Error(Error$UnexpectedEndOfInput$const);
                        } else {
                          let $7 = tokens$1.head[0];
                          if ($7 instanceof RightParen) {
                            let tokens$2 = tokens$1.tail;
                            let end = tokens$1.head[1].byte_offset;
                            let span2 = new Span(function$.location.start, end + 1);
                            let call$1 = new Call(span2, function$, reverse2(arguments$1));
                            return after_expression(call$1, tokens$2);
                          } else if ($7 instanceof Comma) {
                            let tokens$2 = tokens$1.tail;
                            return call(arguments$1, function$, tokens$2);
                          } else {
                            let other = $7;
                            let position = tokens$1.head[1];
                            return new Error(new UnexpectedToken(other, position));
                          }
                        }
                      });
                    }
                  } else if ($5[0] === "") {
                    let label = $[0];
                    let tokens$1 = $4;
                    return fn_capture(new Some(label), function$, reverse2(arguments$), List$Empty$const, tokens$1);
                  } else {
                    return try$(field2(tokens, expression), (_use0) => {
                      let argument = _use0[0];
                      let tokens$1 = _use0[1];
                      let arguments$1 = prepend(argument, arguments$);
                      if (tokens$1 instanceof Empty) {
                        return new Error(Error$UnexpectedEndOfInput$const);
                      } else {
                        let $7 = tokens$1.head[0];
                        if ($7 instanceof RightParen) {
                          let tokens$2 = tokens$1.tail;
                          let end = tokens$1.head[1].byte_offset;
                          let span2 = new Span(function$.location.start, end + 1);
                          let call$1 = new Call(span2, function$, reverse2(arguments$1));
                          return after_expression(call$1, tokens$2);
                        } else if ($7 instanceof Comma) {
                          let tokens$2 = tokens$1.tail;
                          return call(arguments$1, function$, tokens$2);
                        } else {
                          let other = $7;
                          let position = tokens$1.head[1];
                          return new Error(new UnexpectedToken(other, position));
                        }
                      }
                    });
                  }
                } else if ($5[0] === "") {
                  let label = $[0];
                  let tokens$1 = $3;
                  return fn_capture(new Some(label), function$, reverse2(arguments$), List$Empty$const, tokens$1);
                } else {
                  return try$(field2(tokens, expression), (_use0) => {
                    let argument = _use0[0];
                    let tokens$1 = _use0[1];
                    let arguments$1 = prepend(argument, arguments$);
                    if (tokens$1 instanceof Empty) {
                      return new Error(Error$UnexpectedEndOfInput$const);
                    } else {
                      let $7 = tokens$1.head[0];
                      if ($7 instanceof RightParen) {
                        let tokens$2 = tokens$1.tail;
                        let end = tokens$1.head[1].byte_offset;
                        let span2 = new Span(function$.location.start, end + 1);
                        let call$1 = new Call(span2, function$, reverse2(arguments$1));
                        return after_expression(call$1, tokens$2);
                      } else if ($7 instanceof Comma) {
                        let tokens$2 = tokens$1.tail;
                        return call(arguments$1, function$, tokens$2);
                      } else {
                        let other = $7;
                        let position = tokens$1.head[1];
                        return new Error(new UnexpectedToken(other, position));
                      }
                    }
                  });
                }
              } else {
                return try$(field2(tokens, expression), (_use0) => {
                  let argument = _use0[0];
                  let tokens$1 = _use0[1];
                  let arguments$1 = prepend(argument, arguments$);
                  if (tokens$1 instanceof Empty) {
                    return new Error(Error$UnexpectedEndOfInput$const);
                  } else {
                    let $6 = tokens$1.head[0];
                    if ($6 instanceof RightParen) {
                      let tokens$2 = tokens$1.tail;
                      let end = tokens$1.head[1].byte_offset;
                      let span2 = new Span(function$.location.start, end + 1);
                      let call$1 = new Call(span2, function$, reverse2(arguments$1));
                      return after_expression(call$1, tokens$2);
                    } else if ($6 instanceof Comma) {
                      let tokens$2 = tokens$1.tail;
                      return call(arguments$1, function$, tokens$2);
                    } else {
                      let other = $6;
                      let position = tokens$1.head[1];
                      return new Error(new UnexpectedToken(other, position));
                    }
                  }
                });
              }
            } else {
              return try$(field2(tokens, expression), (_use0) => {
                let argument = _use0[0];
                let tokens$1 = _use0[1];
                let arguments$1 = prepend(argument, arguments$);
                if (tokens$1 instanceof Empty) {
                  return new Error(Error$UnexpectedEndOfInput$const);
                } else {
                  let $5 = tokens$1.head[0];
                  if ($5 instanceof RightParen) {
                    let tokens$2 = tokens$1.tail;
                    let end = tokens$1.head[1].byte_offset;
                    let span2 = new Span(function$.location.start, end + 1);
                    let call$1 = new Call(span2, function$, reverse2(arguments$1));
                    return after_expression(call$1, tokens$2);
                  } else if ($5 instanceof Comma) {
                    let tokens$2 = tokens$1.tail;
                    return call(arguments$1, function$, tokens$2);
                  } else {
                    let other = $5;
                    let position = tokens$1.head[1];
                    return new Error(new UnexpectedToken(other, position));
                  }
                }
              });
            }
          }
        }
      }
    } else if ($ instanceof DiscardName) {
      let $1 = tokens.tail;
      if ($1 instanceof Empty) {
        if ($[0] === "") {
          let tokens$1 = $1;
          return fn_capture(Option$None$const, function$, reverse2(arguments$), List$Empty$const, tokens$1);
        } else {
          return try$(field2(tokens, expression), (_use0) => {
            let argument = _use0[0];
            let tokens$1 = _use0[1];
            let arguments$1 = prepend(argument, arguments$);
            if (tokens$1 instanceof Empty) {
              return new Error(Error$UnexpectedEndOfInput$const);
            } else {
              let $2 = tokens$1.head[0];
              if ($2 instanceof RightParen) {
                let tokens$2 = tokens$1.tail;
                let end = tokens$1.head[1].byte_offset;
                let span2 = new Span(function$.location.start, end + 1);
                let call$1 = new Call(span2, function$, reverse2(arguments$1));
                return after_expression(call$1, tokens$2);
              } else if ($2 instanceof Comma) {
                let tokens$2 = tokens$1.tail;
                return call(arguments$1, function$, tokens$2);
              } else {
                let other = $2;
                let position = tokens$1.head[1];
                return new Error(new UnexpectedToken(other, position));
              }
            }
          });
        }
      } else {
        let $2 = $1.tail;
        if ($2 instanceof Empty) {
          let $3 = $1.head[0];
          if ($3 instanceof RightParen) {
            if ($[0] === "") {
              let tokens$1 = $2;
              let end = $1.head[1].byte_offset;
              let span2 = new Span(function$.location.start, end + 1);
              let capture = new FnCapture(span2, Option$None$const, function$, reverse2(arguments$), List$Empty$const);
              return after_expression(capture, tokens$1);
            } else {
              return try$(field2(tokens, expression), (_use0) => {
                let argument = _use0[0];
                let tokens$1 = _use0[1];
                let arguments$1 = prepend(argument, arguments$);
                if (tokens$1 instanceof Empty) {
                  return new Error(Error$UnexpectedEndOfInput$const);
                } else {
                  let $4 = tokens$1.head[0];
                  if ($4 instanceof RightParen) {
                    let tokens$2 = tokens$1.tail;
                    let end = tokens$1.head[1].byte_offset;
                    let span2 = new Span(function$.location.start, end + 1);
                    let call$1 = new Call(span2, function$, reverse2(arguments$1));
                    return after_expression(call$1, tokens$2);
                  } else if ($4 instanceof Comma) {
                    let tokens$2 = tokens$1.tail;
                    return call(arguments$1, function$, tokens$2);
                  } else {
                    let other = $4;
                    let position = tokens$1.head[1];
                    return new Error(new UnexpectedToken(other, position));
                  }
                }
              });
            }
          } else if ($3 instanceof Comma) {
            if ($[0] === "") {
              let tokens$1 = $2;
              return fn_capture(Option$None$const, function$, reverse2(arguments$), List$Empty$const, tokens$1);
            } else {
              return try$(field2(tokens, expression), (_use0) => {
                let argument = _use0[0];
                let tokens$1 = _use0[1];
                let arguments$1 = prepend(argument, arguments$);
                if (tokens$1 instanceof Empty) {
                  return new Error(Error$UnexpectedEndOfInput$const);
                } else {
                  let $4 = tokens$1.head[0];
                  if ($4 instanceof RightParen) {
                    let tokens$2 = tokens$1.tail;
                    let end = tokens$1.head[1].byte_offset;
                    let span2 = new Span(function$.location.start, end + 1);
                    let call$1 = new Call(span2, function$, reverse2(arguments$1));
                    return after_expression(call$1, tokens$2);
                  } else if ($4 instanceof Comma) {
                    let tokens$2 = tokens$1.tail;
                    return call(arguments$1, function$, tokens$2);
                  } else {
                    let other = $4;
                    let position = tokens$1.head[1];
                    return new Error(new UnexpectedToken(other, position));
                  }
                }
              });
            }
          } else if ($[0] === "") {
            let tokens$1 = $1;
            return fn_capture(Option$None$const, function$, reverse2(arguments$), List$Empty$const, tokens$1);
          } else {
            return try$(field2(tokens, expression), (_use0) => {
              let argument = _use0[0];
              let tokens$1 = _use0[1];
              let arguments$1 = prepend(argument, arguments$);
              if (tokens$1 instanceof Empty) {
                return new Error(Error$UnexpectedEndOfInput$const);
              } else {
                let $4 = tokens$1.head[0];
                if ($4 instanceof RightParen) {
                  let tokens$2 = tokens$1.tail;
                  let end = tokens$1.head[1].byte_offset;
                  let span2 = new Span(function$.location.start, end + 1);
                  let call$1 = new Call(span2, function$, reverse2(arguments$1));
                  return after_expression(call$1, tokens$2);
                } else if ($4 instanceof Comma) {
                  let tokens$2 = tokens$1.tail;
                  return call(arguments$1, function$, tokens$2);
                } else {
                  let other = $4;
                  let position = tokens$1.head[1];
                  return new Error(new UnexpectedToken(other, position));
                }
              }
            });
          }
        } else {
          let $3 = $1.head[0];
          if ($3 instanceof RightParen) {
            if ($[0] === "") {
              let tokens$1 = $2;
              let end = $1.head[1].byte_offset;
              let span2 = new Span(function$.location.start, end + 1);
              let capture = new FnCapture(span2, Option$None$const, function$, reverse2(arguments$), List$Empty$const);
              return after_expression(capture, tokens$1);
            } else {
              return try$(field2(tokens, expression), (_use0) => {
                let argument = _use0[0];
                let tokens$1 = _use0[1];
                let arguments$1 = prepend(argument, arguments$);
                if (tokens$1 instanceof Empty) {
                  return new Error(Error$UnexpectedEndOfInput$const);
                } else {
                  let $4 = tokens$1.head[0];
                  if ($4 instanceof RightParen) {
                    let tokens$2 = tokens$1.tail;
                    let end = tokens$1.head[1].byte_offset;
                    let span2 = new Span(function$.location.start, end + 1);
                    let call$1 = new Call(span2, function$, reverse2(arguments$1));
                    return after_expression(call$1, tokens$2);
                  } else if ($4 instanceof Comma) {
                    let tokens$2 = tokens$1.tail;
                    return call(arguments$1, function$, tokens$2);
                  } else {
                    let other = $4;
                    let position = tokens$1.head[1];
                    return new Error(new UnexpectedToken(other, position));
                  }
                }
              });
            }
          } else if ($3 instanceof Comma) {
            if ($2.head[0] instanceof RightParen) {
              if ($[0] === "") {
                let tokens$1 = $2.tail;
                let end = $2.head[1].byte_offset;
                let span2 = new Span(function$.location.start, end + 1);
                let capture = new FnCapture(span2, Option$None$const, function$, reverse2(arguments$), List$Empty$const);
                return after_expression(capture, tokens$1);
              } else {
                return try$(field2(tokens, expression), (_use0) => {
                  let argument = _use0[0];
                  let tokens$1 = _use0[1];
                  let arguments$1 = prepend(argument, arguments$);
                  if (tokens$1 instanceof Empty) {
                    return new Error(Error$UnexpectedEndOfInput$const);
                  } else {
                    let $4 = tokens$1.head[0];
                    if ($4 instanceof RightParen) {
                      let tokens$2 = tokens$1.tail;
                      let end = tokens$1.head[1].byte_offset;
                      let span2 = new Span(function$.location.start, end + 1);
                      let call$1 = new Call(span2, function$, reverse2(arguments$1));
                      return after_expression(call$1, tokens$2);
                    } else if ($4 instanceof Comma) {
                      let tokens$2 = tokens$1.tail;
                      return call(arguments$1, function$, tokens$2);
                    } else {
                      let other = $4;
                      let position = tokens$1.head[1];
                      return new Error(new UnexpectedToken(other, position));
                    }
                  }
                });
              }
            } else if ($[0] === "") {
              let tokens$1 = $2;
              return fn_capture(Option$None$const, function$, reverse2(arguments$), List$Empty$const, tokens$1);
            } else {
              return try$(field2(tokens, expression), (_use0) => {
                let argument = _use0[0];
                let tokens$1 = _use0[1];
                let arguments$1 = prepend(argument, arguments$);
                if (tokens$1 instanceof Empty) {
                  return new Error(Error$UnexpectedEndOfInput$const);
                } else {
                  let $4 = tokens$1.head[0];
                  if ($4 instanceof RightParen) {
                    let tokens$2 = tokens$1.tail;
                    let end = tokens$1.head[1].byte_offset;
                    let span2 = new Span(function$.location.start, end + 1);
                    let call$1 = new Call(span2, function$, reverse2(arguments$1));
                    return after_expression(call$1, tokens$2);
                  } else if ($4 instanceof Comma) {
                    let tokens$2 = tokens$1.tail;
                    return call(arguments$1, function$, tokens$2);
                  } else {
                    let other = $4;
                    let position = tokens$1.head[1];
                    return new Error(new UnexpectedToken(other, position));
                  }
                }
              });
            }
          } else if ($[0] === "") {
            let tokens$1 = $1;
            return fn_capture(Option$None$const, function$, reverse2(arguments$), List$Empty$const, tokens$1);
          } else {
            return try$(field2(tokens, expression), (_use0) => {
              let argument = _use0[0];
              let tokens$1 = _use0[1];
              let arguments$1 = prepend(argument, arguments$);
              if (tokens$1 instanceof Empty) {
                return new Error(Error$UnexpectedEndOfInput$const);
              } else {
                let $4 = tokens$1.head[0];
                if ($4 instanceof RightParen) {
                  let tokens$2 = tokens$1.tail;
                  let end = tokens$1.head[1].byte_offset;
                  let span2 = new Span(function$.location.start, end + 1);
                  let call$1 = new Call(span2, function$, reverse2(arguments$1));
                  return after_expression(call$1, tokens$2);
                } else if ($4 instanceof Comma) {
                  let tokens$2 = tokens$1.tail;
                  return call(arguments$1, function$, tokens$2);
                } else {
                  let other = $4;
                  let position = tokens$1.head[1];
                  return new Error(new UnexpectedToken(other, position));
                }
              }
            });
          }
        }
      }
    } else if ($ instanceof RightParen) {
      let tokens$1 = tokens.tail;
      let end = tokens.head[1].byte_offset;
      let span2 = new Span(function$.location.start, end + 1);
      let call$1 = new Call(span2, function$, reverse2(arguments$));
      return after_expression(call$1, tokens$1);
    } else {
      return try$(field2(tokens, expression), (_use0) => {
        let argument = _use0[0];
        let tokens$1 = _use0[1];
        let arguments$1 = prepend(argument, arguments$);
        if (tokens$1 instanceof Empty) {
          return new Error(Error$UnexpectedEndOfInput$const);
        } else {
          let $1 = tokens$1.head[0];
          if ($1 instanceof RightParen) {
            let tokens$2 = tokens$1.tail;
            let end = tokens$1.head[1].byte_offset;
            let span2 = new Span(function$.location.start, end + 1);
            let call$1 = new Call(span2, function$, reverse2(arguments$1));
            return after_expression(call$1, tokens$2);
          } else if ($1 instanceof Comma) {
            let tokens$2 = tokens$1.tail;
            return call(arguments$1, function$, tokens$2);
          } else {
            let other = $1;
            let position = tokens$1.head[1];
            return new Error(new UnexpectedToken(other, position));
          }
        }
      });
    }
  }
}
function after_expression(loop$parsed, loop$tokens) {
  while (true) {
    let parsed = loop$parsed;
    let tokens = loop$tokens;
    if (tokens instanceof Empty) {
      return new Ok([parsed, tokens]);
    } else {
      let $ = tokens.tail;
      if ($ instanceof Empty) {
        if (tokens.head[0] instanceof LeftParen) {
          let tokens$1 = $;
          return call(List$Empty$const, parsed, tokens$1);
        } else {
          return new Ok([parsed, tokens]);
        }
      } else {
        let $1 = tokens.head[0];
        if ($1 instanceof LeftParen) {
          let tokens$1 = $;
          return call(List$Empty$const, parsed, tokens$1);
        } else if ($1 instanceof Dot) {
          let $2 = $.head[0];
          if ($2 instanceof Name) {
            let tokens$1 = $.tail;
            let label_start = $.head[1].byte_offset;
            let label = $2[0];
            let span2 = new Span(parsed.location.start, string_offset(label_start, label));
            let expression$1 = new FieldAccess(span2, parsed, label);
            loop$parsed = expression$1;
            loop$tokens = tokens$1;
          } else if ($2 instanceof UpperName) {
            let tokens$1 = $.tail;
            let label_start = $.head[1].byte_offset;
            let label = $2[0];
            let span2 = new Span(parsed.location.start, string_offset(label_start, label));
            let expression$1 = new FieldAccess(span2, parsed, label);
            loop$parsed = expression$1;
            loop$tokens = tokens$1;
          } else if ($2 instanceof Int) {
            let tokens$1 = $.tail;
            let token3 = $2;
            let position = $.head[1];
            let value2 = $2[0];
            let $3 = parse_int(value2);
            if ($3 instanceof Ok) {
              let i = $3[0];
              let end = string_offset(position.byte_offset, value2);
              let span2 = new Span(parsed.location.start, end);
              let expression$1 = new TupleIndex(span2, parsed, i);
              loop$parsed = expression$1;
              loop$tokens = tokens$1;
            } else {
              return new Error(new UnexpectedToken(token3, position));
            }
          } else {
            return new Ok([parsed, tokens]);
          }
        } else {
          return new Ok([parsed, tokens]);
        }
      }
    }
  }
}
function todo_panic(tokens, constructor, start5, keyword_name) {
  if (tokens instanceof Empty) {
    let span2 = span_from_string(start5, keyword_name);
    let expression$1 = constructor(span2, Option$None$const);
    return new Ok([new Some(expression$1), tokens]);
  } else if (tokens.head[0] instanceof As) {
    let tokens$1 = tokens.tail;
    return try$(expression(tokens$1), (_use0) => {
      let reason = _use0[0];
      let tokens$2 = _use0[1];
      let span2 = new Span(start5, reason.location.end);
      let expression$1 = constructor(span2, new Some(reason));
      return new Ok([new Some(expression$1), tokens$2]);
    });
  } else {
    let span2 = span_from_string(start5, keyword_name);
    let expression$1 = constructor(span2, Option$None$const);
    return new Ok([new Some(expression$1), tokens]);
  }
}
function optional_clause_guard(tokens) {
  if (tokens instanceof Empty) {
    return new Ok([Option$None$const, tokens]);
  } else if (tokens.head[0] instanceof If) {
    let tokens$1 = tokens.tail;
    return try$(expression(tokens$1), (_use0) => {
      let expression$1 = _use0[0];
      let tokens$2 = _use0[1];
      return new Ok([new Some(expression$1), tokens$2]);
    });
  } else {
    return new Ok([Option$None$const, tokens]);
  }
}
function case_clause(tokens) {
  let multipatterns = (_capture) => {
    return delimited(List$Empty$const, _capture, pattern, Token$Comma$const);
  };
  let result = delimited(List$Empty$const, tokens, multipatterns, Token$VBar$const);
  return try$(result, (_use0) => {
    let patterns = _use0[0];
    let tokens$1 = _use0[1];
    return try$(optional_clause_guard(tokens$1), (_use02) => {
      let guard2 = _use02[0];
      let tokens$2 = _use02[1];
      return expect(Token$RightArrow$const, tokens$2, (_, tokens2) => {
        return map4(expression(tokens2), (_use03) => {
          let expression$1 = _use03[0];
          let tokens$3 = _use03[1];
          return [new Clause(patterns, guard2, expression$1), tokens$3];
        });
      });
    });
  });
}
function case_clauses(clauses, tokens) {
  return try$(case_clause(tokens), (_use0) => {
    let clause = _use0[0];
    let tokens$1 = _use0[1];
    let clauses$1 = prepend(clause, clauses);
    if (tokens$1 instanceof Empty) {
      return case_clauses(clauses$1, tokens$1);
    } else if (tokens$1.head[0] instanceof RightBrace) {
      let tokens$2 = tokens$1.tail;
      let end = tokens$1.head[1].byte_offset;
      return new Ok([reverse2(clauses$1), tokens$2, end + 1]);
    } else {
      return case_clauses(clauses$1, tokens$1);
    }
  });
}
function case_subjects(subjects, tokens) {
  return try$(expression(tokens), (_use0) => {
    let subject = _use0[0];
    let tokens$1 = _use0[1];
    let subjects$1 = prepend(subject, subjects);
    if (tokens$1 instanceof Empty) {
      return new Ok([reverse2(subjects$1), tokens$1]);
    } else if (tokens$1.head[0] instanceof Comma) {
      let tokens$2 = tokens$1.tail;
      return case_subjects(subjects$1, tokens$2);
    } else {
      return new Ok([reverse2(subjects$1), tokens$1]);
    }
  });
}
function case_(tokens, start5) {
  return try$(case_subjects(List$Empty$const, tokens), (_use0) => {
    let subjects = _use0[0];
    let tokens$1 = _use0[1];
    return expect(Token$LeftBrace$const, tokens$1, (_, tokens2) => {
      return try$(case_clauses(List$Empty$const, tokens2), (_use02) => {
        let clauses = _use02[0];
        let tokens$2 = _use02[1];
        let end = _use02[2];
        return new Ok([
          new Some(new Case2(new Span(start5, end), subjects, clauses)),
          tokens$2
        ]);
      });
    });
  });
}
function fn_(tokens, start5) {
  return expect(Token$LeftParen$const, tokens, (_, tokens2) => {
    let result = comma_delimited(List$Empty$const, tokens2, fn_parameter, Token$RightParen$const);
    return try$(result, (_use0) => {
      let parameters = _use0[0];
      let tokens$1 = _use0[2];
      return try$(optional_return_annotation(0, tokens$1), (_use02) => {
        let return$ = _use02[0];
        let tokens$2 = _use02[2];
        return expect(Token$LeftBrace$const, tokens$2, (_2, tokens3) => {
          return try$(statements(List$Empty$const, tokens3), (_use03) => {
            let body = _use03[0];
            let end = _use03[1];
            let tokens$3 = _use03[2];
            return new Ok([
              new Some(new Fn2(new Span(start5, end), parameters, return$, body)),
              tokens$3
            ]);
          });
        });
      });
    });
  });
}
function record_update_field(tokens) {
  if (tokens instanceof Empty) {
    return new Error(Error$UnexpectedEndOfInput$const);
  } else {
    let $ = tokens.tail;
    if ($ instanceof Empty) {
      let other = tokens.head[0];
      let position = tokens.head[1];
      return new Error(new UnexpectedToken(other, position));
    } else {
      let $1 = tokens.head[0];
      if ($1 instanceof Name && $.head[0] instanceof Colon) {
        let tokens$1 = $.tail;
        let name$1 = $1[0];
        if (tokens$1 instanceof Empty) {
          return try$(expression(tokens$1), (_use0) => {
            let expression$1 = _use0[0];
            let tokens$2 = _use0[1];
            return new Ok([
              new RecordUpdateField(name$1, new Some(expression$1)),
              tokens$2
            ]);
          });
        } else {
          let $2 = tokens$1.head[0];
          if ($2 instanceof RightParen) {
            return new Ok([new RecordUpdateField(name$1, Option$None$const), tokens$1]);
          } else if ($2 instanceof Comma) {
            return new Ok([new RecordUpdateField(name$1, Option$None$const), tokens$1]);
          } else {
            return try$(expression(tokens$1), (_use0) => {
              let expression$1 = _use0[0];
              let tokens$2 = _use0[1];
              return new Ok([
                new RecordUpdateField(name$1, new Some(expression$1)),
                tokens$2
              ]);
            });
          }
        }
      } else {
        let other = $1;
        let position = tokens.head[1];
        return new Error(new UnexpectedToken(other, position));
      }
    }
  }
}
function record_update(module, constructor, tokens, start5) {
  return try$(expression(tokens), (_use0) => {
    let record = _use0[0];
    let tokens$1 = _use0[1];
    if (tokens$1 instanceof Empty) {
      return new Ok([Option$None$const, tokens$1]);
    } else {
      let $ = tokens$1.head[0];
      if ($ instanceof RightParen) {
        let tokens$2 = tokens$1.tail;
        let end = tokens$1.head[1].byte_offset;
        let span2 = new Span(start5, end + 1);
        let expression$1 = new RecordUpdate(span2, module, constructor, record, List$Empty$const);
        return new Ok([new Some(expression$1), tokens$2]);
      } else if ($ instanceof Comma) {
        let tokens$2 = tokens$1.tail;
        let result = comma_delimited(List$Empty$const, tokens$2, record_update_field, Token$RightParen$const);
        return try$(result, (_use02) => {
          let fields = _use02[0];
          let end = _use02[1];
          let tokens$3 = _use02[2];
          let span2 = new Span(start5, end);
          let expression$1 = new RecordUpdate(span2, module, constructor, record, fields);
          return new Ok([new Some(expression$1), tokens$3]);
        });
      } else {
        return new Ok([Option$None$const, tokens$1]);
      }
    }
  });
}
function expression_unit(tokens, context) {
  return try$((() => {
    if (tokens instanceof Empty) {
      return new Ok([Option$None$const, tokens]);
    } else {
      let $ = tokens.tail;
      if ($ instanceof Empty) {
        let $1 = tokens.head[0];
        if ($1 instanceof Name) {
          let tokens$1 = $;
          let start5 = tokens.head[1].byte_offset;
          let name$1 = $1[0];
          let span2 = span_from_string(start5, name$1);
          return new Ok([new Some(new Variable(span2, name$1)), tokens$1]);
        } else if ($1 instanceof UpperName) {
          let tokens$1 = $;
          let start5 = tokens.head[1].byte_offset;
          let name$1 = $1[0];
          return new Ok([
            new Some(new Variable(span_from_string(start5, name$1), name$1)),
            tokens$1
          ]);
        } else if ($1 instanceof Int) {
          let tokens$1 = $;
          let start5 = tokens.head[1].byte_offset;
          let value2 = $1[0];
          let span2 = span_from_string(start5, value2);
          return new Ok([new Some(new Int2(span2, value2)), tokens$1]);
        } else if ($1 instanceof Float) {
          let tokens$1 = $;
          let start5 = tokens.head[1].byte_offset;
          let value2 = $1[0];
          let span2 = span_from_string(start5, value2);
          return new Ok([new Some(new Float2(span2, value2)), tokens$1]);
        } else if ($1 instanceof String2) {
          let tokens$1 = $;
          let start5 = tokens.head[1].byte_offset;
          let value2 = $1[0];
          let span2 = new Span(start5, string_offset(start5, value2) + 2);
          return new Ok([new Some(new String3(span2, value2)), tokens$1]);
        } else if ($1 instanceof Case) {
          let tokens$1 = $;
          let start5 = tokens.head[1].byte_offset;
          return case_(tokens$1, start5);
        } else if ($1 instanceof Echo) {
          let tokens$1 = $;
          let start5 = tokens.head[1].byte_offset;
          let _block;
          if (context instanceof RegularExpressionUnit) {
            _block = map4(expression(tokens$1), (expression_and_tokens) => {
              let expression$1 = expression_and_tokens[0];
              let tokens$2 = expression_and_tokens[1];
              let span2 = new Span(start5, expression$1.location.end);
              return [span2, new Some(expression$1), tokens$2];
            });
          } else {
            let span2 = span_from_string(start5, "echo");
            _block = new Ok([span2, Option$None$const, tokens$1]);
          }
          let result = _block;
          return try$(result, (_use0) => {
            let span2 = _use0[0];
            let echo_expression = _use0[1];
            let tokens$2 = _use0[2];
            if (tokens$2 instanceof Empty) {
              return new Ok([
                new Some(new Echo2(span2, echo_expression, Option$None$const)),
                tokens$2
              ]);
            } else if (tokens$2.head[0] instanceof As) {
              let tokens$3 = tokens$2.tail;
              return map4(expression(tokens$3), (_use02) => {
                let message2 = _use02[0];
                let tokens$4 = _use02[1];
                let span$1 = new Span(span2.start, message2.location.end);
                return [
                  new Some(new Echo2(span$1, echo_expression, new Some(message2))),
                  tokens$4
                ];
              });
            } else {
              return new Ok([
                new Some(new Echo2(span2, echo_expression, Option$None$const)),
                tokens$2
              ]);
            }
          });
        } else if ($1 instanceof Fn) {
          let tokens$1 = $;
          let start5 = tokens.head[1].byte_offset;
          return fn_(tokens$1, start5);
        } else if ($1 instanceof Panic) {
          let tokens$1 = $;
          let start5 = tokens.head[1].byte_offset;
          return todo_panic(tokens$1, (var0, var1) => {
            return new Panic2(var0, var1);
          }, start5, "panic");
        } else if ($1 instanceof Todo) {
          let tokens$1 = $;
          let start5 = tokens.head[1].byte_offset;
          return todo_panic(tokens$1, (var0, var1) => {
            return new Todo2(var0, var1);
          }, start5, "todo");
        } else if ($1 instanceof LeftBrace) {
          let tokens$1 = $;
          let start5 = tokens.head[1].byte_offset;
          return map4(statements(List$Empty$const, tokens$1), (_use0) => {
            let statements$1 = _use0[0];
            let end = _use0[1];
            let tokens$2 = _use0[2];
            return [
              new Some(new Block(new Span(start5, end), statements$1)),
              tokens$2
            ];
          });
        } else if ($1 instanceof LeftSquare) {
          let tokens$1 = $;
          let start5 = tokens.head[1].byte_offset;
          let result = list4(expression, Option$None$const, List$Empty$const, tokens$1);
          return map4(result, (_use0) => {
            let elements = _use0.values;
            let rest = _use0.spread;
            let tokens$2 = _use0.remaining_tokens;
            let end = _use0.end;
            return [
              new Some(new List2(new Span(start5, end), elements, rest)),
              tokens$2
            ];
          });
        } else if ($1 instanceof Minus) {
          let tokens$1 = $;
          let start5 = tokens.head[1].byte_offset;
          let unit = expression_unit(tokens$1, ParseExpressionUnitContext$RegularExpressionUnit$const);
          return try$(unit, (_use0) => {
            let maybe_expression = _use0[0];
            let tokens$2 = _use0[1];
            if (maybe_expression instanceof Some) {
              let expression$1 = maybe_expression[0];
              let span2 = new Span(start5, expression$1.location.end);
              return new Ok([new Some(new NegateInt(span2, expression$1)), tokens$2]);
            } else {
              return unexpected_error(tokens$2);
            }
          });
        } else if ($1 instanceof Bang) {
          let tokens$1 = $;
          let start5 = tokens.head[1].byte_offset;
          let unit = expression_unit(tokens$1, ParseExpressionUnitContext$RegularExpressionUnit$const);
          return try$(unit, (_use0) => {
            let maybe_expression = _use0[0];
            let tokens$2 = _use0[1];
            if (maybe_expression instanceof Some) {
              let expression$1 = maybe_expression[0];
              let span2 = new Span(start5, expression$1.location.end);
              return new Ok([new Some(new NegateBool(span2, expression$1)), tokens$2]);
            } else {
              return unexpected_error(tokens$2);
            }
          });
        } else if ($1 instanceof LessLess) {
          let tokens$1 = $;
          let start5 = tokens.head[1].byte_offset;
          let parser = (_capture) => {
            return bit_string_segment(expression, expression, _capture);
          };
          let result = comma_delimited(List$Empty$const, tokens$1, parser, Token$GreaterGreater$const);
          return map4(result, (_use0) => {
            let segments = _use0[0];
            let end = _use0[1];
            let tokens$2 = _use0[2];
            return [
              new Some(new BitString(new Span(start5, end), segments)),
              tokens$2
            ];
          });
        } else {
          return new Ok([Option$None$const, tokens]);
        }
      } else {
        let $1 = $.tail;
        if ($1 instanceof Empty) {
          let $2 = tokens.head[0];
          if ($2 instanceof Name) {
            let tokens$1 = $;
            let start5 = tokens.head[1].byte_offset;
            let name$1 = $2[0];
            let span2 = span_from_string(start5, name$1);
            return new Ok([new Some(new Variable(span2, name$1)), tokens$1]);
          } else if ($2 instanceof UpperName) {
            let tokens$1 = $;
            let start5 = tokens.head[1].byte_offset;
            let name$1 = $2[0];
            return new Ok([
              new Some(new Variable(span_from_string(start5, name$1), name$1)),
              tokens$1
            ]);
          } else if ($2 instanceof Int) {
            let tokens$1 = $;
            let start5 = tokens.head[1].byte_offset;
            let value2 = $2[0];
            let span2 = span_from_string(start5, value2);
            return new Ok([new Some(new Int2(span2, value2)), tokens$1]);
          } else if ($2 instanceof Float) {
            let tokens$1 = $;
            let start5 = tokens.head[1].byte_offset;
            let value2 = $2[0];
            let span2 = span_from_string(start5, value2);
            return new Ok([new Some(new Float2(span2, value2)), tokens$1]);
          } else if ($2 instanceof String2) {
            let tokens$1 = $;
            let start5 = tokens.head[1].byte_offset;
            let value2 = $2[0];
            let span2 = new Span(start5, string_offset(start5, value2) + 2);
            return new Ok([new Some(new String3(span2, value2)), tokens$1]);
          } else if ($2 instanceof Case) {
            let tokens$1 = $;
            let start5 = tokens.head[1].byte_offset;
            return case_(tokens$1, start5);
          } else if ($2 instanceof Echo) {
            let tokens$1 = $;
            let start5 = tokens.head[1].byte_offset;
            let _block;
            if (context instanceof RegularExpressionUnit) {
              _block = map4(expression(tokens$1), (expression_and_tokens) => {
                let expression$1 = expression_and_tokens[0];
                let tokens$2 = expression_and_tokens[1];
                let span2 = new Span(start5, expression$1.location.end);
                return [span2, new Some(expression$1), tokens$2];
              });
            } else {
              let span2 = span_from_string(start5, "echo");
              _block = new Ok([span2, Option$None$const, tokens$1]);
            }
            let result = _block;
            return try$(result, (_use0) => {
              let span2 = _use0[0];
              let echo_expression = _use0[1];
              let tokens$2 = _use0[2];
              if (tokens$2 instanceof Empty) {
                return new Ok([
                  new Some(new Echo2(span2, echo_expression, Option$None$const)),
                  tokens$2
                ]);
              } else if (tokens$2.head[0] instanceof As) {
                let tokens$3 = tokens$2.tail;
                return map4(expression(tokens$3), (_use02) => {
                  let message2 = _use02[0];
                  let tokens$4 = _use02[1];
                  let span$1 = new Span(span2.start, message2.location.end);
                  return [
                    new Some(new Echo2(span$1, echo_expression, new Some(message2))),
                    tokens$4
                  ];
                });
              } else {
                return new Ok([
                  new Some(new Echo2(span2, echo_expression, Option$None$const)),
                  tokens$2
                ]);
              }
            });
          } else if ($2 instanceof Fn) {
            let tokens$1 = $;
            let start5 = tokens.head[1].byte_offset;
            return fn_(tokens$1, start5);
          } else if ($2 instanceof Panic) {
            let tokens$1 = $;
            let start5 = tokens.head[1].byte_offset;
            return todo_panic(tokens$1, (var0, var1) => {
              return new Panic2(var0, var1);
            }, start5, "panic");
          } else if ($2 instanceof Todo) {
            let tokens$1 = $;
            let start5 = tokens.head[1].byte_offset;
            return todo_panic(tokens$1, (var0, var1) => {
              return new Todo2(var0, var1);
            }, start5, "todo");
          } else if ($2 instanceof LeftBrace) {
            let tokens$1 = $;
            let start5 = tokens.head[1].byte_offset;
            return map4(statements(List$Empty$const, tokens$1), (_use0) => {
              let statements$1 = _use0[0];
              let end = _use0[1];
              let tokens$2 = _use0[2];
              return [
                new Some(new Block(new Span(start5, end), statements$1)),
                tokens$2
              ];
            });
          } else if ($2 instanceof LeftSquare) {
            let tokens$1 = $;
            let start5 = tokens.head[1].byte_offset;
            let result = list4(expression, Option$None$const, List$Empty$const, tokens$1);
            return map4(result, (_use0) => {
              let elements = _use0.values;
              let rest = _use0.spread;
              let tokens$2 = _use0.remaining_tokens;
              let end = _use0.end;
              return [
                new Some(new List2(new Span(start5, end), elements, rest)),
                tokens$2
              ];
            });
          } else if ($2 instanceof Minus) {
            let tokens$1 = $;
            let start5 = tokens.head[1].byte_offset;
            let unit = expression_unit(tokens$1, ParseExpressionUnitContext$RegularExpressionUnit$const);
            return try$(unit, (_use0) => {
              let maybe_expression = _use0[0];
              let tokens$2 = _use0[1];
              if (maybe_expression instanceof Some) {
                let expression$1 = maybe_expression[0];
                let span2 = new Span(start5, expression$1.location.end);
                return new Ok([new Some(new NegateInt(span2, expression$1)), tokens$2]);
              } else {
                return unexpected_error(tokens$2);
              }
            });
          } else if ($2 instanceof Hash && $.head[0] instanceof LeftParen) {
            let start5 = tokens.head[1].byte_offset;
            let tokens$1 = $1;
            let result = comma_delimited(List$Empty$const, tokens$1, expression, Token$RightParen$const);
            return map4(result, (_use0) => {
              let expressions = _use0[0];
              let end = _use0[1];
              let tokens$2 = _use0[2];
              return [
                new Some(new Tuple(new Span(start5, end), expressions)),
                tokens$2
              ];
            });
          } else if ($2 instanceof Bang) {
            let tokens$1 = $;
            let start5 = tokens.head[1].byte_offset;
            let unit = expression_unit(tokens$1, ParseExpressionUnitContext$RegularExpressionUnit$const);
            return try$(unit, (_use0) => {
              let maybe_expression = _use0[0];
              let tokens$2 = _use0[1];
              if (maybe_expression instanceof Some) {
                let expression$1 = maybe_expression[0];
                let span2 = new Span(start5, expression$1.location.end);
                return new Ok([new Some(new NegateBool(span2, expression$1)), tokens$2]);
              } else {
                return unexpected_error(tokens$2);
              }
            });
          } else if ($2 instanceof LessLess) {
            let tokens$1 = $;
            let start5 = tokens.head[1].byte_offset;
            let parser = (_capture) => {
              return bit_string_segment(expression, expression, _capture);
            };
            let result = comma_delimited(List$Empty$const, tokens$1, parser, Token$GreaterGreater$const);
            return map4(result, (_use0) => {
              let segments = _use0[0];
              let end = _use0[1];
              let tokens$2 = _use0[2];
              return [
                new Some(new BitString(new Span(start5, end), segments)),
                tokens$2
              ];
            });
          } else {
            return new Ok([Option$None$const, tokens]);
          }
        } else {
          let $2 = $1.tail;
          if ($2 instanceof Empty) {
            let $3 = tokens.head[0];
            if ($3 instanceof Name) {
              let tokens$1 = $;
              let start5 = tokens.head[1].byte_offset;
              let name$1 = $3[0];
              let span2 = span_from_string(start5, name$1);
              return new Ok([new Some(new Variable(span2, name$1)), tokens$1]);
            } else if ($3 instanceof UpperName) {
              if ($.head[0] instanceof LeftParen && $1.head[0] instanceof DotDot) {
                let start5 = tokens.head[1].byte_offset;
                let tokens$1 = $2;
                let constructor = $3[0];
                return record_update(Option$None$const, constructor, tokens$1, start5);
              } else {
                let tokens$1 = $;
                let start5 = tokens.head[1].byte_offset;
                let name$1 = $3[0];
                return new Ok([
                  new Some(new Variable(span_from_string(start5, name$1), name$1)),
                  tokens$1
                ]);
              }
            } else if ($3 instanceof Int) {
              let tokens$1 = $;
              let start5 = tokens.head[1].byte_offset;
              let value2 = $3[0];
              let span2 = span_from_string(start5, value2);
              return new Ok([new Some(new Int2(span2, value2)), tokens$1]);
            } else if ($3 instanceof Float) {
              let tokens$1 = $;
              let start5 = tokens.head[1].byte_offset;
              let value2 = $3[0];
              let span2 = span_from_string(start5, value2);
              return new Ok([new Some(new Float2(span2, value2)), tokens$1]);
            } else if ($3 instanceof String2) {
              let tokens$1 = $;
              let start5 = tokens.head[1].byte_offset;
              let value2 = $3[0];
              let span2 = new Span(start5, string_offset(start5, value2) + 2);
              return new Ok([new Some(new String3(span2, value2)), tokens$1]);
            } else if ($3 instanceof Case) {
              let tokens$1 = $;
              let start5 = tokens.head[1].byte_offset;
              return case_(tokens$1, start5);
            } else if ($3 instanceof Echo) {
              let tokens$1 = $;
              let start5 = tokens.head[1].byte_offset;
              let _block;
              if (context instanceof RegularExpressionUnit) {
                _block = map4(expression(tokens$1), (expression_and_tokens) => {
                  let expression$1 = expression_and_tokens[0];
                  let tokens$2 = expression_and_tokens[1];
                  let span2 = new Span(start5, expression$1.location.end);
                  return [span2, new Some(expression$1), tokens$2];
                });
              } else {
                let span2 = span_from_string(start5, "echo");
                _block = new Ok([span2, Option$None$const, tokens$1]);
              }
              let result = _block;
              return try$(result, (_use0) => {
                let span2 = _use0[0];
                let echo_expression = _use0[1];
                let tokens$2 = _use0[2];
                if (tokens$2 instanceof Empty) {
                  return new Ok([
                    new Some(new Echo2(span2, echo_expression, Option$None$const)),
                    tokens$2
                  ]);
                } else if (tokens$2.head[0] instanceof As) {
                  let tokens$3 = tokens$2.tail;
                  return map4(expression(tokens$3), (_use02) => {
                    let message2 = _use02[0];
                    let tokens$4 = _use02[1];
                    let span$1 = new Span(span2.start, message2.location.end);
                    return [
                      new Some(new Echo2(span$1, echo_expression, new Some(message2))),
                      tokens$4
                    ];
                  });
                } else {
                  return new Ok([
                    new Some(new Echo2(span2, echo_expression, Option$None$const)),
                    tokens$2
                  ]);
                }
              });
            } else if ($3 instanceof Fn) {
              let tokens$1 = $;
              let start5 = tokens.head[1].byte_offset;
              return fn_(tokens$1, start5);
            } else if ($3 instanceof Panic) {
              let tokens$1 = $;
              let start5 = tokens.head[1].byte_offset;
              return todo_panic(tokens$1, (var0, var1) => {
                return new Panic2(var0, var1);
              }, start5, "panic");
            } else if ($3 instanceof Todo) {
              let tokens$1 = $;
              let start5 = tokens.head[1].byte_offset;
              return todo_panic(tokens$1, (var0, var1) => {
                return new Todo2(var0, var1);
              }, start5, "todo");
            } else if ($3 instanceof LeftBrace) {
              let tokens$1 = $;
              let start5 = tokens.head[1].byte_offset;
              return map4(statements(List$Empty$const, tokens$1), (_use0) => {
                let statements$1 = _use0[0];
                let end = _use0[1];
                let tokens$2 = _use0[2];
                return [
                  new Some(new Block(new Span(start5, end), statements$1)),
                  tokens$2
                ];
              });
            } else if ($3 instanceof LeftSquare) {
              let tokens$1 = $;
              let start5 = tokens.head[1].byte_offset;
              let result = list4(expression, Option$None$const, List$Empty$const, tokens$1);
              return map4(result, (_use0) => {
                let elements = _use0.values;
                let rest = _use0.spread;
                let tokens$2 = _use0.remaining_tokens;
                let end = _use0.end;
                return [
                  new Some(new List2(new Span(start5, end), elements, rest)),
                  tokens$2
                ];
              });
            } else if ($3 instanceof Minus) {
              let tokens$1 = $;
              let start5 = tokens.head[1].byte_offset;
              let unit = expression_unit(tokens$1, ParseExpressionUnitContext$RegularExpressionUnit$const);
              return try$(unit, (_use0) => {
                let maybe_expression = _use0[0];
                let tokens$2 = _use0[1];
                if (maybe_expression instanceof Some) {
                  let expression$1 = maybe_expression[0];
                  let span2 = new Span(start5, expression$1.location.end);
                  return new Ok([new Some(new NegateInt(span2, expression$1)), tokens$2]);
                } else {
                  return unexpected_error(tokens$2);
                }
              });
            } else if ($3 instanceof Hash && $.head[0] instanceof LeftParen) {
              let start5 = tokens.head[1].byte_offset;
              let tokens$1 = $1;
              let result = comma_delimited(List$Empty$const, tokens$1, expression, Token$RightParen$const);
              return map4(result, (_use0) => {
                let expressions = _use0[0];
                let end = _use0[1];
                let tokens$2 = _use0[2];
                return [
                  new Some(new Tuple(new Span(start5, end), expressions)),
                  tokens$2
                ];
              });
            } else if ($3 instanceof Bang) {
              let tokens$1 = $;
              let start5 = tokens.head[1].byte_offset;
              let unit = expression_unit(tokens$1, ParseExpressionUnitContext$RegularExpressionUnit$const);
              return try$(unit, (_use0) => {
                let maybe_expression = _use0[0];
                let tokens$2 = _use0[1];
                if (maybe_expression instanceof Some) {
                  let expression$1 = maybe_expression[0];
                  let span2 = new Span(start5, expression$1.location.end);
                  return new Ok([new Some(new NegateBool(span2, expression$1)), tokens$2]);
                } else {
                  return unexpected_error(tokens$2);
                }
              });
            } else if ($3 instanceof LessLess) {
              let tokens$1 = $;
              let start5 = tokens.head[1].byte_offset;
              let parser = (_capture) => {
                return bit_string_segment(expression, expression, _capture);
              };
              let result = comma_delimited(List$Empty$const, tokens$1, parser, Token$GreaterGreater$const);
              return map4(result, (_use0) => {
                let segments = _use0[0];
                let end = _use0[1];
                let tokens$2 = _use0[2];
                return [
                  new Some(new BitString(new Span(start5, end), segments)),
                  tokens$2
                ];
              });
            } else {
              return new Ok([Option$None$const, tokens]);
            }
          } else {
            let $3 = $2.tail;
            if ($3 instanceof Empty) {
              let $4 = tokens.head[0];
              if ($4 instanceof Name) {
                let tokens$1 = $;
                let start5 = tokens.head[1].byte_offset;
                let name$1 = $4[0];
                let span2 = span_from_string(start5, name$1);
                return new Ok([new Some(new Variable(span2, name$1)), tokens$1]);
              } else if ($4 instanceof UpperName) {
                if ($.head[0] instanceof LeftParen && $1.head[0] instanceof DotDot) {
                  let start5 = tokens.head[1].byte_offset;
                  let tokens$1 = $2;
                  let constructor = $4[0];
                  return record_update(Option$None$const, constructor, tokens$1, start5);
                } else {
                  let tokens$1 = $;
                  let start5 = tokens.head[1].byte_offset;
                  let name$1 = $4[0];
                  return new Ok([
                    new Some(new Variable(span_from_string(start5, name$1), name$1)),
                    tokens$1
                  ]);
                }
              } else if ($4 instanceof Int) {
                let tokens$1 = $;
                let start5 = tokens.head[1].byte_offset;
                let value2 = $4[0];
                let span2 = span_from_string(start5, value2);
                return new Ok([new Some(new Int2(span2, value2)), tokens$1]);
              } else if ($4 instanceof Float) {
                let tokens$1 = $;
                let start5 = tokens.head[1].byte_offset;
                let value2 = $4[0];
                let span2 = span_from_string(start5, value2);
                return new Ok([new Some(new Float2(span2, value2)), tokens$1]);
              } else if ($4 instanceof String2) {
                let tokens$1 = $;
                let start5 = tokens.head[1].byte_offset;
                let value2 = $4[0];
                let span2 = new Span(start5, string_offset(start5, value2) + 2);
                return new Ok([new Some(new String3(span2, value2)), tokens$1]);
              } else if ($4 instanceof Case) {
                let tokens$1 = $;
                let start5 = tokens.head[1].byte_offset;
                return case_(tokens$1, start5);
              } else if ($4 instanceof Echo) {
                let tokens$1 = $;
                let start5 = tokens.head[1].byte_offset;
                let _block;
                if (context instanceof RegularExpressionUnit) {
                  _block = map4(expression(tokens$1), (expression_and_tokens) => {
                    let expression$1 = expression_and_tokens[0];
                    let tokens$2 = expression_and_tokens[1];
                    let span2 = new Span(start5, expression$1.location.end);
                    return [span2, new Some(expression$1), tokens$2];
                  });
                } else {
                  let span2 = span_from_string(start5, "echo");
                  _block = new Ok([span2, Option$None$const, tokens$1]);
                }
                let result = _block;
                return try$(result, (_use0) => {
                  let span2 = _use0[0];
                  let echo_expression = _use0[1];
                  let tokens$2 = _use0[2];
                  if (tokens$2 instanceof Empty) {
                    return new Ok([
                      new Some(new Echo2(span2, echo_expression, Option$None$const)),
                      tokens$2
                    ]);
                  } else if (tokens$2.head[0] instanceof As) {
                    let tokens$3 = tokens$2.tail;
                    return map4(expression(tokens$3), (_use02) => {
                      let message2 = _use02[0];
                      let tokens$4 = _use02[1];
                      let span$1 = new Span(span2.start, message2.location.end);
                      return [
                        new Some(new Echo2(span$1, echo_expression, new Some(message2))),
                        tokens$4
                      ];
                    });
                  } else {
                    return new Ok([
                      new Some(new Echo2(span2, echo_expression, Option$None$const)),
                      tokens$2
                    ]);
                  }
                });
              } else if ($4 instanceof Fn) {
                let tokens$1 = $;
                let start5 = tokens.head[1].byte_offset;
                return fn_(tokens$1, start5);
              } else if ($4 instanceof Panic) {
                let tokens$1 = $;
                let start5 = tokens.head[1].byte_offset;
                return todo_panic(tokens$1, (var0, var1) => {
                  return new Panic2(var0, var1);
                }, start5, "panic");
              } else if ($4 instanceof Todo) {
                let tokens$1 = $;
                let start5 = tokens.head[1].byte_offset;
                return todo_panic(tokens$1, (var0, var1) => {
                  return new Todo2(var0, var1);
                }, start5, "todo");
              } else if ($4 instanceof LeftBrace) {
                let tokens$1 = $;
                let start5 = tokens.head[1].byte_offset;
                return map4(statements(List$Empty$const, tokens$1), (_use0) => {
                  let statements$1 = _use0[0];
                  let end = _use0[1];
                  let tokens$2 = _use0[2];
                  return [
                    new Some(new Block(new Span(start5, end), statements$1)),
                    tokens$2
                  ];
                });
              } else if ($4 instanceof LeftSquare) {
                let tokens$1 = $;
                let start5 = tokens.head[1].byte_offset;
                let result = list4(expression, Option$None$const, List$Empty$const, tokens$1);
                return map4(result, (_use0) => {
                  let elements = _use0.values;
                  let rest = _use0.spread;
                  let tokens$2 = _use0.remaining_tokens;
                  let end = _use0.end;
                  return [
                    new Some(new List2(new Span(start5, end), elements, rest)),
                    tokens$2
                  ];
                });
              } else if ($4 instanceof Minus) {
                let tokens$1 = $;
                let start5 = tokens.head[1].byte_offset;
                let unit = expression_unit(tokens$1, ParseExpressionUnitContext$RegularExpressionUnit$const);
                return try$(unit, (_use0) => {
                  let maybe_expression = _use0[0];
                  let tokens$2 = _use0[1];
                  if (maybe_expression instanceof Some) {
                    let expression$1 = maybe_expression[0];
                    let span2 = new Span(start5, expression$1.location.end);
                    return new Ok([
                      new Some(new NegateInt(span2, expression$1)),
                      tokens$2
                    ]);
                  } else {
                    return unexpected_error(tokens$2);
                  }
                });
              } else if ($4 instanceof Hash && $.head[0] instanceof LeftParen) {
                let start5 = tokens.head[1].byte_offset;
                let tokens$1 = $1;
                let result = comma_delimited(List$Empty$const, tokens$1, expression, Token$RightParen$const);
                return map4(result, (_use0) => {
                  let expressions = _use0[0];
                  let end = _use0[1];
                  let tokens$2 = _use0[2];
                  return [
                    new Some(new Tuple(new Span(start5, end), expressions)),
                    tokens$2
                  ];
                });
              } else if ($4 instanceof Bang) {
                let tokens$1 = $;
                let start5 = tokens.head[1].byte_offset;
                let unit = expression_unit(tokens$1, ParseExpressionUnitContext$RegularExpressionUnit$const);
                return try$(unit, (_use0) => {
                  let maybe_expression = _use0[0];
                  let tokens$2 = _use0[1];
                  if (maybe_expression instanceof Some) {
                    let expression$1 = maybe_expression[0];
                    let span2 = new Span(start5, expression$1.location.end);
                    return new Ok([
                      new Some(new NegateBool(span2, expression$1)),
                      tokens$2
                    ]);
                  } else {
                    return unexpected_error(tokens$2);
                  }
                });
              } else if ($4 instanceof LessLess) {
                let tokens$1 = $;
                let start5 = tokens.head[1].byte_offset;
                let parser = (_capture) => {
                  return bit_string_segment(expression, expression, _capture);
                };
                let result = comma_delimited(List$Empty$const, tokens$1, parser, Token$GreaterGreater$const);
                return map4(result, (_use0) => {
                  let segments = _use0[0];
                  let end = _use0[1];
                  let tokens$2 = _use0[2];
                  return [
                    new Some(new BitString(new Span(start5, end), segments)),
                    tokens$2
                  ];
                });
              } else {
                return new Ok([Option$None$const, tokens]);
              }
            } else {
              let $4 = tokens.head[0];
              if ($4 instanceof Name) {
                if ($.head[0] instanceof Dot) {
                  let $5 = $1.head[0];
                  if ($5 instanceof UpperName && $2.head[0] instanceof LeftParen && $3.head[0] instanceof DotDot) {
                    let start5 = tokens.head[1].byte_offset;
                    let tokens$1 = $3.tail;
                    let module$1 = $4[0];
                    let constructor = $5[0];
                    return record_update(new Some(module$1), constructor, tokens$1, start5);
                  } else {
                    let tokens$1 = $;
                    let start5 = tokens.head[1].byte_offset;
                    let name$1 = $4[0];
                    let span2 = span_from_string(start5, name$1);
                    return new Ok([new Some(new Variable(span2, name$1)), tokens$1]);
                  }
                } else {
                  let tokens$1 = $;
                  let start5 = tokens.head[1].byte_offset;
                  let name$1 = $4[0];
                  let span2 = span_from_string(start5, name$1);
                  return new Ok([new Some(new Variable(span2, name$1)), tokens$1]);
                }
              } else if ($4 instanceof UpperName) {
                if ($.head[0] instanceof LeftParen && $1.head[0] instanceof DotDot) {
                  let start5 = tokens.head[1].byte_offset;
                  let tokens$1 = $2;
                  let constructor = $4[0];
                  return record_update(Option$None$const, constructor, tokens$1, start5);
                } else {
                  let tokens$1 = $;
                  let start5 = tokens.head[1].byte_offset;
                  let name$1 = $4[0];
                  return new Ok([
                    new Some(new Variable(span_from_string(start5, name$1), name$1)),
                    tokens$1
                  ]);
                }
              } else if ($4 instanceof Int) {
                let tokens$1 = $;
                let start5 = tokens.head[1].byte_offset;
                let value2 = $4[0];
                let span2 = span_from_string(start5, value2);
                return new Ok([new Some(new Int2(span2, value2)), tokens$1]);
              } else if ($4 instanceof Float) {
                let tokens$1 = $;
                let start5 = tokens.head[1].byte_offset;
                let value2 = $4[0];
                let span2 = span_from_string(start5, value2);
                return new Ok([new Some(new Float2(span2, value2)), tokens$1]);
              } else if ($4 instanceof String2) {
                let tokens$1 = $;
                let start5 = tokens.head[1].byte_offset;
                let value2 = $4[0];
                let span2 = new Span(start5, string_offset(start5, value2) + 2);
                return new Ok([new Some(new String3(span2, value2)), tokens$1]);
              } else if ($4 instanceof Case) {
                let tokens$1 = $;
                let start5 = tokens.head[1].byte_offset;
                return case_(tokens$1, start5);
              } else if ($4 instanceof Echo) {
                let tokens$1 = $;
                let start5 = tokens.head[1].byte_offset;
                let _block;
                if (context instanceof RegularExpressionUnit) {
                  _block = map4(expression(tokens$1), (expression_and_tokens) => {
                    let expression$1 = expression_and_tokens[0];
                    let tokens$2 = expression_and_tokens[1];
                    let span2 = new Span(start5, expression$1.location.end);
                    return [span2, new Some(expression$1), tokens$2];
                  });
                } else {
                  let span2 = span_from_string(start5, "echo");
                  _block = new Ok([span2, Option$None$const, tokens$1]);
                }
                let result = _block;
                return try$(result, (_use0) => {
                  let span2 = _use0[0];
                  let echo_expression = _use0[1];
                  let tokens$2 = _use0[2];
                  if (tokens$2 instanceof Empty) {
                    return new Ok([
                      new Some(new Echo2(span2, echo_expression, Option$None$const)),
                      tokens$2
                    ]);
                  } else if (tokens$2.head[0] instanceof As) {
                    let tokens$3 = tokens$2.tail;
                    return map4(expression(tokens$3), (_use02) => {
                      let message2 = _use02[0];
                      let tokens$4 = _use02[1];
                      let span$1 = new Span(span2.start, message2.location.end);
                      return [
                        new Some(new Echo2(span$1, echo_expression, new Some(message2))),
                        tokens$4
                      ];
                    });
                  } else {
                    return new Ok([
                      new Some(new Echo2(span2, echo_expression, Option$None$const)),
                      tokens$2
                    ]);
                  }
                });
              } else if ($4 instanceof Fn) {
                let tokens$1 = $;
                let start5 = tokens.head[1].byte_offset;
                return fn_(tokens$1, start5);
              } else if ($4 instanceof Panic) {
                let tokens$1 = $;
                let start5 = tokens.head[1].byte_offset;
                return todo_panic(tokens$1, (var0, var1) => {
                  return new Panic2(var0, var1);
                }, start5, "panic");
              } else if ($4 instanceof Todo) {
                let tokens$1 = $;
                let start5 = tokens.head[1].byte_offset;
                return todo_panic(tokens$1, (var0, var1) => {
                  return new Todo2(var0, var1);
                }, start5, "todo");
              } else if ($4 instanceof LeftBrace) {
                let tokens$1 = $;
                let start5 = tokens.head[1].byte_offset;
                return map4(statements(List$Empty$const, tokens$1), (_use0) => {
                  let statements$1 = _use0[0];
                  let end = _use0[1];
                  let tokens$2 = _use0[2];
                  return [
                    new Some(new Block(new Span(start5, end), statements$1)),
                    tokens$2
                  ];
                });
              } else if ($4 instanceof LeftSquare) {
                let tokens$1 = $;
                let start5 = tokens.head[1].byte_offset;
                let result = list4(expression, Option$None$const, List$Empty$const, tokens$1);
                return map4(result, (_use0) => {
                  let elements = _use0.values;
                  let rest = _use0.spread;
                  let tokens$2 = _use0.remaining_tokens;
                  let end = _use0.end;
                  return [
                    new Some(new List2(new Span(start5, end), elements, rest)),
                    tokens$2
                  ];
                });
              } else if ($4 instanceof Minus) {
                let tokens$1 = $;
                let start5 = tokens.head[1].byte_offset;
                let unit = expression_unit(tokens$1, ParseExpressionUnitContext$RegularExpressionUnit$const);
                return try$(unit, (_use0) => {
                  let maybe_expression = _use0[0];
                  let tokens$2 = _use0[1];
                  if (maybe_expression instanceof Some) {
                    let expression$1 = maybe_expression[0];
                    let span2 = new Span(start5, expression$1.location.end);
                    return new Ok([
                      new Some(new NegateInt(span2, expression$1)),
                      tokens$2
                    ]);
                  } else {
                    return unexpected_error(tokens$2);
                  }
                });
              } else if ($4 instanceof Hash && $.head[0] instanceof LeftParen) {
                let start5 = tokens.head[1].byte_offset;
                let tokens$1 = $1;
                let result = comma_delimited(List$Empty$const, tokens$1, expression, Token$RightParen$const);
                return map4(result, (_use0) => {
                  let expressions = _use0[0];
                  let end = _use0[1];
                  let tokens$2 = _use0[2];
                  return [
                    new Some(new Tuple(new Span(start5, end), expressions)),
                    tokens$2
                  ];
                });
              } else if ($4 instanceof Bang) {
                let tokens$1 = $;
                let start5 = tokens.head[1].byte_offset;
                let unit = expression_unit(tokens$1, ParseExpressionUnitContext$RegularExpressionUnit$const);
                return try$(unit, (_use0) => {
                  let maybe_expression = _use0[0];
                  let tokens$2 = _use0[1];
                  if (maybe_expression instanceof Some) {
                    let expression$1 = maybe_expression[0];
                    let span2 = new Span(start5, expression$1.location.end);
                    return new Ok([
                      new Some(new NegateBool(span2, expression$1)),
                      tokens$2
                    ]);
                  } else {
                    return unexpected_error(tokens$2);
                  }
                });
              } else if ($4 instanceof LessLess) {
                let tokens$1 = $;
                let start5 = tokens.head[1].byte_offset;
                let parser = (_capture) => {
                  return bit_string_segment(expression, expression, _capture);
                };
                let result = comma_delimited(List$Empty$const, tokens$1, parser, Token$GreaterGreater$const);
                return map4(result, (_use0) => {
                  let segments = _use0[0];
                  let end = _use0[1];
                  let tokens$2 = _use0[2];
                  return [
                    new Some(new BitString(new Span(start5, end), segments)),
                    tokens$2
                  ];
                });
              } else {
                return new Ok([Option$None$const, tokens]);
              }
            }
          }
        }
      }
    }
  })(), (_use0) => {
    let parsed = _use0[0];
    let tokens$1 = _use0[1];
    if (parsed instanceof Some) {
      let expression$1 = parsed[0];
      let $ = after_expression(expression$1, tokens$1);
      if ($ instanceof Ok) {
        let expression$2 = $[0][0];
        let tokens$2 = $[0][1];
        return new Ok([new Some(expression$2), tokens$2]);
      } else {
        return $;
      }
    } else {
      return new Ok([Option$None$const, tokens$1]);
    }
  });
}
function expression_loop(tokens, operators, values4, context) {
  return try$(expression_unit(tokens, context), (_use0) => {
    let expression$1 = _use0[0];
    let tokens$1 = _use0[1];
    if (expression$1 instanceof Some) {
      let e = expression$1[0];
      let values$1 = prepend(e, values4);
      let $ = pop_binary_operator(tokens$1);
      if ($ instanceof Ok) {
        let operator = $[0][0];
        let tokens$2 = $[0][1];
        let $1 = handle_operator(new Some(operator), operators, values$1);
        let $2 = $1[0];
        if ($2 instanceof Some) {
          let expression$2 = $2[0];
          return new Ok([expression$2, tokens$2]);
        } else {
          let operators$1 = $1[1];
          let values$2 = $1[2];
          return expression_loop(tokens$2, operators$1, values$2, (() => {
            if (operator instanceof Pipe2) {
              return ParseExpressionUnitContext$ExpressionUnitAfterPipe$const;
            } else {
              return ParseExpressionUnitContext$RegularExpressionUnit$const;
            }
          })());
        }
      } else {
        let $1 = handle_operator(Option$None$const, operators, values$1)[0];
        if ($1 instanceof Some) {
          let expression$2 = $1[0];
          return new Ok([expression$2, tokens$1]);
        } else {
          return unexpected_error(tokens$1);
        }
      }
    } else {
      return unexpected_error(tokens$1);
    }
  });
}
function expression(tokens) {
  return expression_loop(tokens, List$Empty$const, List$Empty$const, ParseExpressionUnitContext$RegularExpressionUnit$const);
}
function assert_(tokens, start5) {
  return try$(expression(tokens), (_use0) => {
    let subject = _use0[0];
    let tokens$1 = _use0[1];
    if (tokens$1 instanceof Empty) {
      let statement$1 = new Assert2(new Span(start5, subject.location.end), subject, Option$None$const);
      return new Ok([statement$1, tokens$1]);
    } else if (tokens$1.head[0] instanceof As) {
      let tokens$2 = tokens$1.tail;
      let $ = expression(tokens$2);
      if ($ instanceof Ok) {
        let message2 = $[0][0];
        let tokens$3 = $[0][1];
        let statement$1 = new Assert2(new Span(start5, message2.location.end), subject, new Some(message2));
        return new Ok([statement$1, tokens$3]);
      } else {
        return $;
      }
    } else {
      let statement$1 = new Assert2(new Span(start5, subject.location.end), subject, Option$None$const);
      return new Ok([statement$1, tokens$1]);
    }
  });
}
function use_(tokens, start5) {
  return try$((() => {
    if (tokens instanceof Empty) {
      return delimited(List$Empty$const, tokens, use_pattern, Token$Comma$const);
    } else if (tokens.head[0] instanceof LeftArrow) {
      return new Ok([List$Empty$const, tokens]);
    } else {
      return delimited(List$Empty$const, tokens, use_pattern, Token$Comma$const);
    }
  })(), (_use0) => {
    let patterns = _use0[0];
    let tokens$1 = _use0[1];
    return expect(Token$LeftArrow$const, tokens$1, (_, tokens2) => {
      return try$(expression(tokens2), (_use02) => {
        let function$ = _use02[0];
        let tokens$2 = _use02[1];
        return new Ok([
          new Use2(new Span(start5, function$.location.end), patterns, function$),
          tokens$2
        ]);
      });
    });
  });
}
function assignment(kind, tokens, start5) {
  return try$(pattern(tokens), (_use0) => {
    let pattern$1 = _use0[0];
    let tokens$1 = _use0[1];
    return try$(optional_type_annotation(tokens$1), (_use02) => {
      let annotation = _use02[0];
      let tokens$2 = _use02[1];
      return expect(Token$Equal$const, tokens$2, (_, tokens2) => {
        return try$(expression(tokens2), (_use03) => {
          let value2 = _use03[0];
          let tokens$3 = _use03[1];
          return try$((() => {
            if (kind instanceof Let2) {
              return new Ok([kind, tokens$3, value2.location.end]);
            } else if (tokens$3 instanceof Empty) {
              return new Ok([kind, tokens$3, value2.location.end]);
            } else if (kind.message instanceof None && tokens$3.head[0] instanceof As) {
              let tokens$4 = tokens$3.tail;
              return map4(expression(tokens$4), (_use04) => {
                let message2 = _use04[0];
                let tokens$5 = _use04[1];
                return [
                  new LetAssert(new Some(message2)),
                  tokens$5,
                  message2.location.end
                ];
              });
            } else {
              return new Ok([kind, tokens$3, value2.location.end]);
            }
          })(), (_use04) => {
            let kind$1 = _use04[0];
            let tokens$4 = _use04[1];
            let end = _use04[2];
            let statement$1 = new Assignment(new Span(start5, end), kind$1, pattern$1, annotation, value2);
            return new Ok([statement$1, tokens$4]);
          });
        });
      });
    });
  });
}
function statement(tokens) {
  if (tokens instanceof Empty) {
    let tokens$1 = tokens;
    return try$(expression(tokens$1), (_use0) => {
      let expression$1 = _use0[0];
      let tokens$2 = _use0[1];
      return new Ok([new Expression(expression$1), tokens$2]);
    });
  } else {
    let $ = tokens.tail;
    if ($ instanceof Empty) {
      let $1 = tokens.head[0];
      if ($1 instanceof Assert) {
        let tokens$1 = $;
        let start5 = tokens.head[1].byte_offset;
        return assert_(tokens$1, start5);
      } else if ($1 instanceof Let) {
        let tokens$1 = $;
        let start5 = tokens.head[1].byte_offset;
        return assignment(AssignmentKind$Let$const, tokens$1, start5);
      } else if ($1 instanceof Use) {
        let tokens$1 = $;
        let start5 = tokens.head[1].byte_offset;
        return use_(tokens$1, start5);
      } else {
        let tokens$1 = tokens;
        return try$(expression(tokens$1), (_use0) => {
          let expression$1 = _use0[0];
          let tokens$2 = _use0[1];
          return new Ok([new Expression(expression$1), tokens$2]);
        });
      }
    } else {
      let $1 = tokens.head[0];
      if ($1 instanceof Assert) {
        let tokens$1 = $;
        let start5 = tokens.head[1].byte_offset;
        return assert_(tokens$1, start5);
      } else if ($1 instanceof Let) {
        if ($.head[0] instanceof Assert) {
          let start5 = tokens.head[1].byte_offset;
          let tokens$1 = $.tail;
          return assignment(new LetAssert(Option$None$const), tokens$1, start5);
        } else {
          let tokens$1 = $;
          let start5 = tokens.head[1].byte_offset;
          return assignment(AssignmentKind$Let$const, tokens$1, start5);
        }
      } else if ($1 instanceof Use) {
        let tokens$1 = $;
        let start5 = tokens.head[1].byte_offset;
        return use_(tokens$1, start5);
      } else {
        let tokens$1 = tokens;
        return try$(expression(tokens$1), (_use0) => {
          let expression$1 = _use0[0];
          let tokens$2 = _use0[1];
          return new Ok([new Expression(expression$1), tokens$2]);
        });
      }
    }
  }
}
function statements(acc, tokens) {
  if (tokens instanceof Empty) {
    return try$(statement(tokens), (_use0) => {
      let statement$1 = _use0[0];
      let tokens$1 = _use0[1];
      return statements(prepend(statement$1, acc), tokens$1);
    });
  } else if (tokens.head[0] instanceof RightBrace) {
    let tokens$1 = tokens.tail;
    let end = tokens.head[1].byte_offset;
    return new Ok([reverse2(acc), end + 1, tokens$1]);
  } else {
    return try$(statement(tokens), (_use0) => {
      let statement$1 = _use0[0];
      let tokens$1 = _use0[1];
      return statements(prepend(statement$1, acc), tokens$1);
    });
  }
}
function function_parameter(tokens) {
  return try$((() => {
    if (tokens instanceof Empty) {
      return new Error(Error$UnexpectedEndOfInput$const);
    } else {
      let $ = tokens.tail;
      if ($ instanceof Empty) {
        let $1 = tokens.head[0];
        if ($1 instanceof Name) {
          let tokens$1 = $;
          let name$1 = $1[0];
          return new Ok([Option$None$const, new Named(name$1), tokens$1]);
        } else if ($1 instanceof DiscardName) {
          let tokens$1 = $;
          let name$1 = $1[0];
          return new Ok([Option$None$const, new Discarded(name$1), tokens$1]);
        } else {
          let token3 = $1;
          let position = tokens.head[1];
          return new Error(new UnexpectedToken(token3, position));
        }
      } else {
        let $1 = tokens.head[0];
        if ($1 instanceof Name) {
          let $2 = $.head[0];
          if ($2 instanceof Name) {
            let tokens$1 = $.tail;
            let label = $1[0];
            let name$1 = $2[0];
            return new Ok([new Some(label), new Named(name$1), tokens$1]);
          } else if ($2 instanceof DiscardName) {
            let tokens$1 = $.tail;
            let label = $1[0];
            let name$1 = $2[0];
            return new Ok([new Some(label), new Discarded(name$1), tokens$1]);
          } else {
            let tokens$1 = $;
            let name$1 = $1[0];
            return new Ok([Option$None$const, new Named(name$1), tokens$1]);
          }
        } else if ($1 instanceof DiscardName) {
          let tokens$1 = $;
          let name$1 = $1[0];
          return new Ok([Option$None$const, new Discarded(name$1), tokens$1]);
        } else {
          let token3 = $1;
          let position = tokens.head[1];
          return new Error(new UnexpectedToken(token3, position));
        }
      }
    }
  })(), (_use0) => {
    let label = _use0[0];
    let parameter = _use0[1];
    let tokens$1 = _use0[2];
    return try$(optional_type_annotation(tokens$1), (_use02) => {
      let type_$1 = _use02[0];
      let tokens$2 = _use02[1];
      return new Ok([new FunctionParameter(label, parameter, type_$1), tokens$2]);
    });
  });
}
function function_definition(module, attributes, publicity, name, start5, tokens) {
  return expect(Token$LeftParen$const, tokens, (_, tokens2) => {
    let result = comma_delimited(List$Empty$const, tokens2, function_parameter, Token$RightParen$const);
    return try$(result, (_use0) => {
      let parameters = _use0[0];
      let end = _use0[1];
      let tokens$1 = _use0[2];
      let result$1 = optional_return_annotation(end, tokens$1);
      return try$(result$1, (_use02) => {
        let return_type = _use02[0];
        let end$1 = _use02[1];
        let tokens$2 = _use02[2];
        return try$((() => {
          if (tokens$2 instanceof Empty) {
            return new Ok([List$Empty$const, end$1, tokens$2]);
          } else if (tokens$2.head[0] instanceof LeftBrace) {
            let tokens$3 = tokens$2.tail;
            return statements(List$Empty$const, tokens$3);
          } else {
            return new Ok([List$Empty$const, end$1, tokens$2]);
          }
        })(), (_use03) => {
          let body = _use03[0];
          let end$2 = _use03[1];
          let tokens$3 = _use03[2];
          let location = new Span(start5, end$2);
          let function$ = new Function2(location, name, publicity, parameters, return_type, body);
          let module$1 = push_function(module, attributes, function$);
          return new Ok([module$1, tokens$3]);
        });
      });
    });
  });
}
function push_constant(module, attributes, constant) {
  return new Module(module.imports, module.custom_types, module.type_aliases, prepend(new Definition(reverse2(attributes), constant), module.constants), module.functions);
}
function expect_name(tokens, next2) {
  if (tokens instanceof Empty) {
    return new Error(Error$UnexpectedEndOfInput$const);
  } else {
    let $ = tokens.head[0];
    if ($ instanceof Name) {
      let tokens$1 = tokens.tail;
      let name$1 = $[0];
      return next2(name$1, tokens$1);
    } else {
      let other = $;
      let position = tokens.head[1];
      return new Error(new UnexpectedToken(other, position));
    }
  }
}
function const_definition(module, attributes, publicity, tokens, start5) {
  return expect_name(tokens, (name, tokens2) => {
    return try$(optional_type_annotation(tokens2), (_use0) => {
      let annotation = _use0[0];
      let tokens$1 = _use0[1];
      return expect(Token$Equal$const, tokens$1, (_, tokens3) => {
        return try$(expression(tokens3), (_use02) => {
          let expression$1 = _use02[0];
          let tokens$2 = _use02[1];
          let constant = new Constant(new Span(start5, expression$1.location.end), name, publicity, annotation, expression$1);
          let module$1 = push_constant(module, attributes, constant);
          return new Ok([module$1, tokens$2]);
        });
      });
    });
  });
}
function push_custom_type(module, attributes, custom_type) {
  let custom_type$1 = new CustomType2(custom_type.location, custom_type.name, custom_type.publicity, custom_type.opaque_, custom_type.parameters, reverse2(custom_type.variants));
  return new Module(module.imports, prepend(new Definition(reverse2(attributes), custom_type$1), module.custom_types), module.type_aliases, module.constants, module.functions);
}
function push_variant(custom_type, variant) {
  return new CustomType2(custom_type.location, custom_type.name, custom_type.publicity, custom_type.opaque_, custom_type.parameters, prepend(variant, custom_type.variants));
}
function variant_field(tokens) {
  if (tokens instanceof Empty) {
    let tokens$1 = tokens;
    return try$(type_2(tokens$1), (_use0) => {
      let type_$1 = _use0[0];
      let tokens$2 = _use0[1];
      return new Ok([new UnlabelledVariantField(type_$1), tokens$2]);
    });
  } else {
    let $ = tokens.tail;
    if ($ instanceof Empty) {
      let tokens$1 = tokens;
      return try$(type_2(tokens$1), (_use0) => {
        let type_$1 = _use0[0];
        let tokens$2 = _use0[1];
        return new Ok([new UnlabelledVariantField(type_$1), tokens$2]);
      });
    } else {
      let $1 = tokens.head[0];
      if ($1 instanceof Name && $.head[0] instanceof Colon) {
        let tokens$1 = $.tail;
        let name$1 = $1[0];
        return try$(type_2(tokens$1), (_use0) => {
          let type_$1 = _use0[0];
          let tokens$2 = _use0[1];
          return new Ok([new LabelledVariantField(type_$1, name$1), tokens$2]);
        });
      } else {
        let tokens$1 = tokens;
        return try$(type_2(tokens$1), (_use0) => {
          let type_$1 = _use0[0];
          let tokens$2 = _use0[1];
          return new Ok([new UnlabelledVariantField(type_$1), tokens$2]);
        });
      }
    }
  }
}
function expect_upper_name(tokens, next2) {
  if (tokens instanceof Empty) {
    return new Error(Error$UnexpectedEndOfInput$const);
  } else {
    let $ = tokens.head[0];
    if ($ instanceof UpperName) {
      let tokens$1 = tokens.tail;
      let end = tokens.head[1].byte_offset;
      let name$1 = $[0];
      return next2(name$1, end, tokens$1);
    } else {
      let other = $;
      let position = tokens.head[1];
      return new Error(new UnexpectedToken(other, position));
    }
  }
}
function attribute3(tokens) {
  return try$((() => {
    if (tokens instanceof Empty) {
      return new Error(Error$UnexpectedEndOfInput$const);
    } else {
      let $ = tokens.head[0];
      if ($ instanceof Name) {
        let tokens$1 = tokens.tail;
        let name$1 = $[0];
        return new Ok([name$1, tokens$1]);
      } else {
        let other = $;
        let position = tokens.head[1];
        return new Error(new UnexpectedToken(other, position));
      }
    }
  })(), (_use0) => {
    let name$1 = _use0[0];
    let tokens$1 = _use0[1];
    if (tokens$1 instanceof Empty) {
      return new Ok([new Attribute2(name$1, List$Empty$const), tokens$1]);
    } else if (tokens$1.head[0] instanceof LeftParen) {
      let tokens$2 = tokens$1.tail;
      let result = comma_delimited(List$Empty$const, tokens$2, expression, Token$RightParen$const);
      return try$(result, (_use02) => {
        let parameters = _use02[0];
        let tokens$3 = _use02[2];
        return new Ok([new Attribute2(name$1, parameters), tokens$3]);
      });
    } else {
      return new Ok([new Attribute2(name$1, List$Empty$const), tokens$1]);
    }
  });
}
function attributes(loop$accumulated_attributes, loop$tokens) {
  while (true) {
    let accumulated_attributes = loop$accumulated_attributes;
    let tokens = loop$tokens;
    if (tokens instanceof Empty) {
      return new Ok([reverse2(accumulated_attributes), tokens]);
    } else if (tokens.head[0] instanceof At) {
      let tokens$1 = tokens.tail;
      let $ = attribute3(tokens$1);
      if ($ instanceof Ok) {
        let attribute$1 = $[0][0];
        let tokens$2 = $[0][1];
        loop$accumulated_attributes = prepend(attribute$1, accumulated_attributes);
        loop$tokens = tokens$2;
      } else {
        return $;
      }
    } else {
      return new Ok([reverse2(accumulated_attributes), tokens]);
    }
  }
}
function until(loop$limit, loop$acc, loop$tokens, loop$callback) {
  while (true) {
    let limit = loop$limit;
    let acc = loop$acc;
    let tokens = loop$tokens;
    let callback = loop$callback;
    if (tokens instanceof Empty) {
      return new Error(Error$UnexpectedEndOfInput$const);
    } else {
      let token3 = tokens.head[0];
      if (isEqual(token3, limit)) {
        let tokens$1 = tokens.tail;
        let i = tokens.head[1].byte_offset;
        return new Ok([acc, string_offset(i, to_source(token3)), tokens$1]);
      } else {
        let $ = callback(acc, tokens);
        if ($ instanceof Ok) {
          let acc$1 = $[0][0];
          let tokens$2 = $[0][1];
          loop$limit = limit;
          loop$acc = acc$1;
          loop$tokens = tokens$2;
          loop$callback = callback;
        } else {
          return $;
        }
      }
    }
  }
}
function variants(ct, tokens) {
  return until(Token$RightBrace$const, ct, tokens, (ct2, tokens2) => {
    return try$(attributes(List$Empty$const, tokens2), (_use0) => {
      let attributes$1 = _use0[0];
      let tokens$1 = _use0[1];
      return expect_upper_name(tokens$1, (name, _, tokens3) => {
        return try$((() => {
          if (tokens3 instanceof Empty) {
            return new Ok([List$Empty$const, 0, tokens3]);
          } else {
            let $ = tokens3.tail;
            if ($ instanceof Empty) {
              if (tokens3.head[0] instanceof LeftParen) {
                let tokens$2 = $;
                return comma_delimited(List$Empty$const, tokens$2, variant_field, Token$RightParen$const);
              } else {
                return new Ok([List$Empty$const, 0, tokens3]);
              }
            } else if (tokens3.head[0] instanceof LeftParen) {
              if ($.head[0] instanceof RightParen) {
                let tokens$2 = $.tail;
                let i = $.head[1].byte_offset;
                return new Ok([List$Empty$const, i, tokens$2]);
              } else {
                let tokens$2 = $;
                return comma_delimited(List$Empty$const, tokens$2, variant_field, Token$RightParen$const);
              }
            } else {
              return new Ok([List$Empty$const, 0, tokens3]);
            }
          }
        })(), (_use02) => {
          let fields = _use02[0];
          let tokens$2 = _use02[2];
          let ct$1 = push_variant(ct2, new Variant(name, fields, attributes$1));
          return new Ok([ct$1, tokens$2]);
        });
      });
    });
  });
}
function custom_type(module, attributes2, name, parameters, publicity, opaque_, tokens, start5) {
  let ct = new CustomType2(new Span(0, 0), name, publicity, opaque_, parameters, List$Empty$const);
  return try$(variants(ct, tokens), (_use0) => {
    let ct$1 = _use0[0];
    let end = _use0[1];
    let tokens$1 = _use0[2];
    let ct$2 = new CustomType2(new Span(start5, end), ct$1.name, ct$1.publicity, ct$1.opaque_, ct$1.parameters, ct$1.variants);
    let module$1 = push_custom_type(module, attributes2, ct$2);
    return new Ok([module$1, tokens$1]);
  });
}
function push_type_alias(module, attributes2, type_alias) {
  return new Module(module.imports, module.custom_types, prepend(new Definition(reverse2(attributes2), type_alias), module.type_aliases), module.constants, module.functions);
}
function type_alias(module, attributes2, name, parameters, publicity, start5, tokens) {
  return try$(type_2(tokens), (_use0) => {
    let type_$1 = _use0[0];
    let tokens$1 = _use0[1];
    let span2 = new Span(start5, type_$1.location.end);
    let alias = new TypeAlias(span2, name, publicity, parameters, type_$1);
    let module$1 = push_type_alias(module, attributes2, alias);
    return new Ok([module$1, tokens$1]);
  });
}
function name(tokens) {
  if (tokens instanceof Empty) {
    return new Error(Error$UnexpectedEndOfInput$const);
  } else {
    let $ = tokens.head[0];
    if ($ instanceof Name) {
      let tokens$1 = tokens.tail;
      let name$1 = $[0];
      return new Ok([name$1, tokens$1]);
    } else {
      let token3 = $;
      let position = tokens.head[1];
      return new Error(new UnexpectedToken(token3, position));
    }
  }
}
function type_definition(module, attributes2, publicity, opaque_, tokens, start5) {
  return expect_upper_name(tokens, (name_value, name_start, tokens2) => {
    return try$((() => {
      if (tokens2 instanceof Empty) {
        return new Ok([List$Empty$const, string_offset(name_start, name_value), tokens2]);
      } else if (tokens2.head[0] instanceof LeftParen) {
        let tokens$1 = tokens2.tail;
        return comma_delimited(List$Empty$const, tokens$1, name, Token$RightParen$const);
      } else {
        return new Ok([List$Empty$const, string_offset(name_start, name_value), tokens2]);
      }
    })(), (_use0) => {
      let parameters = _use0[0];
      let end = _use0[1];
      let tokens$1 = _use0[2];
      if (tokens$1 instanceof Empty) {
        let span2 = new Span(start5, end);
        let ct = new CustomType2(span2, name_value, publicity, opaque_, parameters, List$Empty$const);
        let module$1 = push_custom_type(module, attributes2, ct);
        return new Ok([module$1, tokens$1]);
      } else {
        let $ = tokens$1.head[0];
        if ($ instanceof LeftBrace) {
          let tokens$2 = tokens$1.tail;
          let _pipe = module;
          return custom_type(_pipe, attributes2, name_value, parameters, publicity, opaque_, tokens$2, start5);
        } else if ($ instanceof Equal) {
          let tokens$2 = tokens$1.tail;
          return type_alias(module, attributes2, name_value, parameters, publicity, start5, tokens$2);
        } else {
          let span2 = new Span(start5, end);
          let ct = new CustomType2(span2, name_value, publicity, opaque_, parameters, List$Empty$const);
          let module$1 = push_custom_type(module, attributes2, ct);
          return new Ok([module$1, tokens$1]);
        }
      }
    });
  });
}
function optional_module_alias(tokens, end) {
  if (tokens instanceof Empty) {
    return [Option$None$const, end, tokens];
  } else {
    let $ = tokens.tail;
    if ($ instanceof Empty) {
      return [Option$None$const, end, tokens];
    } else if (tokens.head[0] instanceof As) {
      let $1 = $.head[0];
      if ($1 instanceof Name) {
        let tokens$1 = $.tail;
        let alias_start = $.head[1].byte_offset;
        let alias = $1[0];
        return [
          new Some(new Named(alias)),
          string_offset(alias_start, alias),
          tokens$1
        ];
      } else if ($1 instanceof DiscardName) {
        let tokens$1 = $.tail;
        let alias_start = $.head[1].byte_offset;
        let alias = $1[0];
        return [
          new Some(new Discarded(alias)),
          string_offset(alias_start, alias) + 1,
          tokens$1
        ];
      } else {
        return [Option$None$const, end, tokens];
      }
    } else {
      return [Option$None$const, end, tokens];
    }
  }
}
function unqualified_imports(loop$types, loop$values, loop$tokens) {
  while (true) {
    let types = loop$types;
    let values4 = loop$values;
    let tokens = loop$tokens;
    if (tokens instanceof Empty) {
      return new Error(Error$UnexpectedEndOfInput$const);
    } else {
      let $ = tokens.head[0];
      if ($ instanceof Name) {
        let $1 = tokens.tail;
        if ($1 instanceof Empty) {
          let other = $;
          let position = tokens.head[1];
          return new Error(new UnexpectedToken(other, position));
        } else {
          let $2 = $1.tail;
          if ($2 instanceof Empty) {
            let $3 = $1.head[0];
            if ($3 instanceof RightBrace) {
              let name$1 = $[0];
              let tokens$1 = $2;
              let end = $1.head[1].byte_offset;
              let import_ = new UnqualifiedImport(name$1, Option$None$const);
              return new Ok(new UnqualifiedImports(reverse2(types), reverse2(prepend(import_, values4)), end + 1, tokens$1));
            } else if ($3 instanceof Comma) {
              let name$1 = $[0];
              let tokens$1 = $2;
              let import_ = new UnqualifiedImport(name$1, Option$None$const);
              loop$types = types;
              loop$values = prepend(import_, values4);
              loop$tokens = tokens$1;
            } else {
              let other = $;
              let position = tokens.head[1];
              return new Error(new UnexpectedToken(other, position));
            }
          } else {
            let $3 = $2.tail;
            if ($3 instanceof Empty) {
              let $4 = $1.head[0];
              if ($4 instanceof RightBrace) {
                let name$1 = $[0];
                let tokens$1 = $2;
                let end = $1.head[1].byte_offset;
                let import_ = new UnqualifiedImport(name$1, Option$None$const);
                return new Ok(new UnqualifiedImports(reverse2(types), reverse2(prepend(import_, values4)), end + 1, tokens$1));
              } else if ($4 instanceof Comma) {
                let name$1 = $[0];
                let tokens$1 = $2;
                let import_ = new UnqualifiedImport(name$1, Option$None$const);
                loop$types = types;
                loop$values = prepend(import_, values4);
                loop$tokens = tokens$1;
              } else {
                let other = $;
                let position = tokens.head[1];
                return new Error(new UnexpectedToken(other, position));
              }
            } else {
              let $4 = $1.head[0];
              if ($4 instanceof As) {
                let $5 = $2.head[0];
                if ($5 instanceof Name) {
                  let $6 = $3.head[0];
                  if ($6 instanceof RightBrace) {
                    let name$1 = $[0];
                    let tokens$1 = $3.tail;
                    let alias = $5[0];
                    let end = $3.head[1].byte_offset;
                    let import_ = new UnqualifiedImport(name$1, new Some(alias));
                    return new Ok(new UnqualifiedImports(reverse2(types), reverse2(prepend(import_, values4)), end + 1, tokens$1));
                  } else if ($6 instanceof Comma) {
                    let name$1 = $[0];
                    let tokens$1 = $3.tail;
                    let alias = $5[0];
                    let import_ = new UnqualifiedImport(name$1, new Some(alias));
                    loop$types = types;
                    loop$values = prepend(import_, values4);
                    loop$tokens = tokens$1;
                  } else {
                    let other = $;
                    let position = tokens.head[1];
                    return new Error(new UnexpectedToken(other, position));
                  }
                } else {
                  let other = $;
                  let position = tokens.head[1];
                  return new Error(new UnexpectedToken(other, position));
                }
              } else if ($4 instanceof RightBrace) {
                let name$1 = $[0];
                let tokens$1 = $2;
                let end = $1.head[1].byte_offset;
                let import_ = new UnqualifiedImport(name$1, Option$None$const);
                return new Ok(new UnqualifiedImports(reverse2(types), reverse2(prepend(import_, values4)), end + 1, tokens$1));
              } else if ($4 instanceof Comma) {
                let name$1 = $[0];
                let tokens$1 = $2;
                let import_ = new UnqualifiedImport(name$1, Option$None$const);
                loop$types = types;
                loop$values = prepend(import_, values4);
                loop$tokens = tokens$1;
              } else {
                let other = $;
                let position = tokens.head[1];
                return new Error(new UnexpectedToken(other, position));
              }
            }
          }
        }
      } else if ($ instanceof UpperName) {
        let $1 = tokens.tail;
        if ($1 instanceof Empty) {
          let other = $;
          let position = tokens.head[1];
          return new Error(new UnexpectedToken(other, position));
        } else {
          let $2 = $1.tail;
          if ($2 instanceof Empty) {
            let $3 = $1.head[0];
            if ($3 instanceof RightBrace) {
              let name$1 = $[0];
              let tokens$1 = $2;
              let end = $1.head[1].byte_offset;
              let import_ = new UnqualifiedImport(name$1, Option$None$const);
              return new Ok(new UnqualifiedImports(reverse2(types), reverse2(prepend(import_, values4)), end + 1, tokens$1));
            } else if ($3 instanceof Comma) {
              let name$1 = $[0];
              let tokens$1 = $2;
              let import_ = new UnqualifiedImport(name$1, Option$None$const);
              loop$types = types;
              loop$values = prepend(import_, values4);
              loop$tokens = tokens$1;
            } else {
              let other = $;
              let position = tokens.head[1];
              return new Error(new UnexpectedToken(other, position));
            }
          } else {
            let $3 = $2.tail;
            if ($3 instanceof Empty) {
              let $4 = $1.head[0];
              if ($4 instanceof RightBrace) {
                let name$1 = $[0];
                let tokens$1 = $2;
                let end = $1.head[1].byte_offset;
                let import_ = new UnqualifiedImport(name$1, Option$None$const);
                return new Ok(new UnqualifiedImports(reverse2(types), reverse2(prepend(import_, values4)), end + 1, tokens$1));
              } else if ($4 instanceof Comma) {
                let name$1 = $[0];
                let tokens$1 = $2;
                let import_ = new UnqualifiedImport(name$1, Option$None$const);
                loop$types = types;
                loop$values = prepend(import_, values4);
                loop$tokens = tokens$1;
              } else {
                let other = $;
                let position = tokens.head[1];
                return new Error(new UnexpectedToken(other, position));
              }
            } else {
              let $4 = $1.head[0];
              if ($4 instanceof As) {
                let $5 = $2.head[0];
                if ($5 instanceof UpperName) {
                  let $6 = $3.head[0];
                  if ($6 instanceof RightBrace) {
                    let name$1 = $[0];
                    let tokens$1 = $3.tail;
                    let alias = $5[0];
                    let end = $3.head[1].byte_offset;
                    let import_ = new UnqualifiedImport(name$1, new Some(alias));
                    return new Ok(new UnqualifiedImports(reverse2(types), reverse2(prepend(import_, values4)), end + 1, tokens$1));
                  } else if ($6 instanceof Comma) {
                    let name$1 = $[0];
                    let tokens$1 = $3.tail;
                    let alias = $5[0];
                    let import_ = new UnqualifiedImport(name$1, new Some(alias));
                    loop$types = types;
                    loop$values = prepend(import_, values4);
                    loop$tokens = tokens$1;
                  } else {
                    let other = $;
                    let position = tokens.head[1];
                    return new Error(new UnexpectedToken(other, position));
                  }
                } else {
                  let other = $;
                  let position = tokens.head[1];
                  return new Error(new UnexpectedToken(other, position));
                }
              } else if ($4 instanceof RightBrace) {
                let name$1 = $[0];
                let tokens$1 = $2;
                let end = $1.head[1].byte_offset;
                let import_ = new UnqualifiedImport(name$1, Option$None$const);
                return new Ok(new UnqualifiedImports(reverse2(types), reverse2(prepend(import_, values4)), end + 1, tokens$1));
              } else if ($4 instanceof Comma) {
                let name$1 = $[0];
                let tokens$1 = $2;
                let import_ = new UnqualifiedImport(name$1, Option$None$const);
                loop$types = types;
                loop$values = prepend(import_, values4);
                loop$tokens = tokens$1;
              } else {
                let other = $;
                let position = tokens.head[1];
                return new Error(new UnexpectedToken(other, position));
              }
            }
          }
        }
      } else if ($ instanceof Type) {
        let $1 = tokens.tail;
        if ($1 instanceof Empty) {
          let other = $;
          let position = tokens.head[1];
          return new Error(new UnexpectedToken(other, position));
        } else {
          let $2 = $1.tail;
          if ($2 instanceof Empty) {
            let other = $;
            let position = tokens.head[1];
            return new Error(new UnexpectedToken(other, position));
          } else {
            let $3 = $2.tail;
            if ($3 instanceof Empty) {
              let $4 = $1.head[0];
              if ($4 instanceof UpperName) {
                let $5 = $2.head[0];
                if ($5 instanceof RightBrace) {
                  let tokens$1 = $3;
                  let name$1 = $4[0];
                  let end = $2.head[1].byte_offset;
                  let import_ = new UnqualifiedImport(name$1, Option$None$const);
                  return new Ok(new UnqualifiedImports(reverse2(prepend(import_, types)), reverse2(values4), end + 1, tokens$1));
                } else if ($5 instanceof Comma) {
                  let tokens$1 = $3;
                  let name$1 = $4[0];
                  let import_ = new UnqualifiedImport(name$1, Option$None$const);
                  loop$types = prepend(import_, types);
                  loop$values = values4;
                  loop$tokens = tokens$1;
                } else {
                  let other = $;
                  let position = tokens.head[1];
                  return new Error(new UnexpectedToken(other, position));
                }
              } else {
                let other = $;
                let position = tokens.head[1];
                return new Error(new UnexpectedToken(other, position));
              }
            } else {
              let $4 = $3.tail;
              if ($4 instanceof Empty) {
                let $5 = $1.head[0];
                if ($5 instanceof UpperName) {
                  let $6 = $2.head[0];
                  if ($6 instanceof RightBrace) {
                    let tokens$1 = $3;
                    let name$1 = $5[0];
                    let end = $2.head[1].byte_offset;
                    let import_ = new UnqualifiedImport(name$1, Option$None$const);
                    return new Ok(new UnqualifiedImports(reverse2(prepend(import_, types)), reverse2(values4), end + 1, tokens$1));
                  } else if ($6 instanceof Comma) {
                    let tokens$1 = $3;
                    let name$1 = $5[0];
                    let import_ = new UnqualifiedImport(name$1, Option$None$const);
                    loop$types = prepend(import_, types);
                    loop$values = values4;
                    loop$tokens = tokens$1;
                  } else {
                    let other = $;
                    let position = tokens.head[1];
                    return new Error(new UnexpectedToken(other, position));
                  }
                } else {
                  let other = $;
                  let position = tokens.head[1];
                  return new Error(new UnexpectedToken(other, position));
                }
              } else {
                let $5 = $1.head[0];
                if ($5 instanceof UpperName) {
                  let $6 = $2.head[0];
                  if ($6 instanceof As) {
                    let $7 = $3.head[0];
                    if ($7 instanceof UpperName) {
                      let $8 = $4.head[0];
                      if ($8 instanceof RightBrace) {
                        let tokens$1 = $4.tail;
                        let name$1 = $5[0];
                        let alias = $7[0];
                        let end = $4.head[1].byte_offset;
                        let import_ = new UnqualifiedImport(name$1, new Some(alias));
                        return new Ok(new UnqualifiedImports(reverse2(prepend(import_, types)), reverse2(values4), end + 1, tokens$1));
                      } else if ($8 instanceof Comma) {
                        let tokens$1 = $4.tail;
                        let name$1 = $5[0];
                        let alias = $7[0];
                        let import_ = new UnqualifiedImport(name$1, new Some(alias));
                        loop$types = prepend(import_, types);
                        loop$values = values4;
                        loop$tokens = tokens$1;
                      } else {
                        let other = $;
                        let position = tokens.head[1];
                        return new Error(new UnexpectedToken(other, position));
                      }
                    } else {
                      let other = $;
                      let position = tokens.head[1];
                      return new Error(new UnexpectedToken(other, position));
                    }
                  } else if ($6 instanceof RightBrace) {
                    let tokens$1 = $3;
                    let name$1 = $5[0];
                    let end = $2.head[1].byte_offset;
                    let import_ = new UnqualifiedImport(name$1, Option$None$const);
                    return new Ok(new UnqualifiedImports(reverse2(prepend(import_, types)), reverse2(values4), end + 1, tokens$1));
                  } else if ($6 instanceof Comma) {
                    let tokens$1 = $3;
                    let name$1 = $5[0];
                    let import_ = new UnqualifiedImport(name$1, Option$None$const);
                    loop$types = prepend(import_, types);
                    loop$values = values4;
                    loop$tokens = tokens$1;
                  } else {
                    let other = $;
                    let position = tokens.head[1];
                    return new Error(new UnexpectedToken(other, position));
                  }
                } else {
                  let other = $;
                  let position = tokens.head[1];
                  return new Error(new UnexpectedToken(other, position));
                }
              }
            }
          }
        }
      } else if ($ instanceof RightBrace) {
        let tokens$1 = tokens.tail;
        let end = tokens.head[1].byte_offset;
        return new Ok(new UnqualifiedImports(reverse2(types), reverse2(values4), end + 1, tokens$1));
      } else {
        let other = $;
        let position = tokens.head[1];
        return new Error(new UnexpectedToken(other, position));
      }
    }
  }
}
function optional_unqualified_imports(tokens, end) {
  if (tokens instanceof Empty) {
    return new Ok(new UnqualifiedImports(List$Empty$const, List$Empty$const, end, tokens));
  } else {
    let $ = tokens.tail;
    if ($ instanceof Empty) {
      return new Ok(new UnqualifiedImports(List$Empty$const, List$Empty$const, end, tokens));
    } else if (tokens.head[0] instanceof Dot && $.head[0] instanceof LeftBrace) {
      let tokens$1 = $.tail;
      return unqualified_imports(List$Empty$const, List$Empty$const, tokens$1);
    } else {
      return new Ok(new UnqualifiedImports(List$Empty$const, List$Empty$const, end, tokens));
    }
  }
}
function module_name(loop$name, loop$end, loop$tokens) {
  while (true) {
    let name2 = loop$name;
    let end = loop$end;
    let tokens = loop$tokens;
    if (tokens instanceof Empty) {
      if (name2 === "") {
        return new Error(Error$UnexpectedEndOfInput$const);
      } else {
        return new Ok([name2, end, tokens]);
      }
    } else {
      let $ = tokens.tail;
      if ($ instanceof Empty) {
        let $1 = tokens.head[0];
        if ($1 instanceof Name && name2 === "") {
          let tokens$1 = $;
          let i = tokens.head[1].byte_offset;
          let s = $1[0];
          let end$1 = i + byte_size(s);
          loop$name = s;
          loop$end = end$1;
          loop$tokens = tokens$1;
        } else if (name2 === "") {
          let other = $1;
          let position = tokens.head[1];
          return new Error(new UnexpectedToken(other, position));
        } else {
          return new Ok([name2, end, tokens]);
        }
      } else {
        let $1 = tokens.head[0];
        if ($1 instanceof Name && name2 === "") {
          let tokens$1 = $;
          let s = $1[0];
          let i = tokens.head[1].byte_offset;
          let end$1 = i + byte_size(s);
          loop$name = s;
          loop$end = end$1;
          loop$tokens = tokens$1;
        } else if ($1 instanceof Slash) {
          let $2 = $.head[0];
          if ($2 instanceof Name && name2 !== "") {
            let tokens$1 = $.tail;
            let i = $.head[1].byte_offset;
            let s = $2[0];
            let end$1 = i + byte_size(s);
            loop$name = name2 + "/" + s;
            loop$end = end$1;
            loop$tokens = tokens$1;
          } else if (name2 === "") {
            let other = $1;
            let position = tokens.head[1];
            return new Error(new UnexpectedToken(other, position));
          } else {
            return new Ok([name2, end, tokens]);
          }
        } else if (name2 === "") {
          let other = $1;
          let position = tokens.head[1];
          return new Error(new UnexpectedToken(other, position));
        } else {
          return new Ok([name2, end, tokens]);
        }
      }
    }
  }
}
function import_statement(module, attributes2, tokens, start5) {
  return try$(module_name("", 0, tokens), (_use0) => {
    let module_name$1 = _use0[0];
    let end = _use0[1];
    let tokens$1 = _use0[2];
    return try$(optional_unqualified_imports(tokens$1, end), (_use02) => {
      let ts = _use02.types;
      let vs = _use02.values;
      let end$1 = _use02.end;
      let tokens$2 = _use02.remaining_tokens;
      let $ = optional_module_alias(tokens$2, end$1);
      let alias = $[0];
      let end$2 = $[1];
      let tokens$3 = $[2];
      let span2 = new Span(start5, end$2);
      let import_ = new Import2(span2, module_name$1, alias, ts, vs);
      let definition = new Definition(reverse2(attributes2), import_);
      let module$1 = new Module(prepend(definition, module.imports), module.custom_types, module.type_aliases, module.constants, module.functions);
      return new Ok([module$1, tokens$3]);
    });
  });
}
function slurp(module, attributes2, tokens) {
  if (tokens instanceof Empty) {
    return new Ok(module);
  } else {
    let $ = tokens.head[0];
    if ($ instanceof Const) {
      let tokens$1 = tokens.tail;
      let start5 = tokens.head[1].byte_offset;
      let result = const_definition(module, attributes2, Publicity$Private$const, tokens$1, start5);
      return try$(result, (_use0) => {
        let module$1 = _use0[0];
        let tokens$2 = _use0[1];
        return slurp(module$1, List$Empty$const, tokens$2);
      });
    } else if ($ instanceof Fn) {
      let $1 = tokens.tail;
      if ($1 instanceof Empty) {
        let tokens$1 = tokens;
        return unexpected_error(tokens$1);
      } else {
        let $2 = $1.head[0];
        if ($2 instanceof Name) {
          let start5 = tokens.head[1];
          let tokens$1 = $1.tail;
          let name$1 = $2[0];
          let start$1 = start5.byte_offset;
          let result = function_definition(module, attributes2, Publicity$Private$const, name$1, start$1, tokens$1);
          return try$(result, (_use0) => {
            let module$1 = _use0[0];
            let tokens$2 = _use0[1];
            return slurp(module$1, List$Empty$const, tokens$2);
          });
        } else {
          let tokens$1 = tokens;
          return unexpected_error(tokens$1);
        }
      }
    } else if ($ instanceof Import) {
      let tokens$1 = tokens.tail;
      let start5 = tokens.head[1].byte_offset;
      let result = import_statement(module, attributes2, tokens$1, start5);
      return try$(result, (_use0) => {
        let module$1 = _use0[0];
        let tokens$2 = _use0[1];
        return slurp(module$1, List$Empty$const, tokens$2);
      });
    } else if ($ instanceof Pub) {
      let $1 = tokens.tail;
      if ($1 instanceof Empty) {
        let tokens$1 = tokens;
        return unexpected_error(tokens$1);
      } else {
        let $2 = $1.head[0];
        if ($2 instanceof Const) {
          let start5 = tokens.head[1].byte_offset;
          let tokens$1 = $1.tail;
          let result = const_definition(module, attributes2, Publicity$Public$const, tokens$1, start5);
          return try$(result, (_use0) => {
            let module$1 = _use0[0];
            let tokens$2 = _use0[1];
            return slurp(module$1, List$Empty$const, tokens$2);
          });
        } else if ($2 instanceof Fn) {
          let $3 = $1.tail;
          if ($3 instanceof Empty) {
            let tokens$1 = tokens;
            return unexpected_error(tokens$1);
          } else {
            let $4 = $3.head[0];
            if ($4 instanceof Name) {
              let start5 = tokens.head[1];
              let tokens$1 = $3.tail;
              let name$1 = $4[0];
              let start$1 = start5.byte_offset;
              let result = function_definition(module, attributes2, Publicity$Public$const, name$1, start$1, tokens$1);
              return try$(result, (_use0) => {
                let module$1 = _use0[0];
                let tokens$2 = _use0[1];
                return slurp(module$1, List$Empty$const, tokens$2);
              });
            } else {
              let tokens$1 = tokens;
              return unexpected_error(tokens$1);
            }
          }
        } else if ($2 instanceof Opaque) {
          let $3 = $1.tail;
          if ($3 instanceof Empty) {
            let tokens$1 = tokens;
            return unexpected_error(tokens$1);
          } else if ($3.head[0] instanceof Type) {
            let start5 = tokens.head[1].byte_offset;
            let tokens$1 = $3.tail;
            let result = type_definition(module, attributes2, Publicity$Public$const, true, tokens$1, start5);
            return try$(result, (_use0) => {
              let module$1 = _use0[0];
              let tokens$2 = _use0[1];
              return slurp(module$1, List$Empty$const, tokens$2);
            });
          } else {
            let tokens$1 = tokens;
            return unexpected_error(tokens$1);
          }
        } else if ($2 instanceof Type) {
          let start5 = tokens.head[1].byte_offset;
          let tokens$1 = $1.tail;
          let result = type_definition(module, attributes2, Publicity$Public$const, false, tokens$1, start5);
          return try$(result, (_use0) => {
            let module$1 = _use0[0];
            let tokens$2 = _use0[1];
            return slurp(module$1, List$Empty$const, tokens$2);
          });
        } else {
          let tokens$1 = tokens;
          return unexpected_error(tokens$1);
        }
      }
    } else if ($ instanceof Type) {
      let tokens$1 = tokens.tail;
      let start5 = tokens.head[1].byte_offset;
      let result = type_definition(module, attributes2, Publicity$Private$const, false, tokens$1, start5);
      return try$(result, (_use0) => {
        let module$1 = _use0[0];
        let tokens$2 = _use0[1];
        return slurp(module$1, List$Empty$const, tokens$2);
      });
    } else if ($ instanceof At) {
      let tokens$1 = tokens.tail;
      return try$(attribute3(tokens$1), (_use0) => {
        let attribute$1 = _use0[0];
        let tokens$2 = _use0[1];
        return slurp(module, prepend(attribute$1, attributes2), tokens$2);
      });
    } else {
      let tokens$1 = tokens;
      return unexpected_error(tokens$1);
    }
  }
}
function module(src2) {
  let _pipe = new$8(src2);
  let _pipe$1 = discard_comments(_pipe);
  let _pipe$2 = discard_whitespace(_pipe$1);
  let _pipe$3 = lex(_pipe$2);
  return ((_capture) => {
    return slurp(new Module(List$Empty$const, List$Empty$const, List$Empty$const, List$Empty$const, List$Empty$const), List$Empty$const, _capture);
  })(_pipe$3);
}
// build/dev/javascript/girard/girard/internal/reference.mjs
function value2(acc, bound, name2) {
  return guard(contains2(bound, name2), acc, () => {
    return [prepend(name2, acc[0]), acc[1]];
  });
}
function bit_array_size_refs(loop$size, loop$bound, loop$acc) {
  while (true) {
    let size3 = loop$size;
    let bound = loop$bound;
    let acc = loop$acc;
    if (size3 instanceof BitArraySizeInt) {
      return acc;
    } else if (size3 instanceof BitArraySizeVariable) {
      let name2 = size3.name;
      return value2(acc, bound, name2);
    } else if (size3 instanceof BitArraySizeBinaryOperator) {
      let left = size3.left;
      let right = size3.right;
      loop$size = right;
      loop$bound = bound;
      loop$acc = bit_array_size_refs(left, bound, acc);
    } else {
      let inner = size3.inner;
      loop$size = inner;
      loop$bound = bound;
      loop$acc = acc;
    }
  }
}
function pattern_refs(loop$pattern, loop$bound, loop$acc) {
  while (true) {
    let pattern2 = loop$pattern;
    let bound = loop$bound;
    let acc = loop$acc;
    if (pattern2 instanceof PatternTuple) {
      let elements = pattern2.elements;
      return fold2(elements, acc, (acc2, p2) => {
        return pattern_refs(p2, bound, acc2);
      });
    } else if (pattern2 instanceof PatternList) {
      let elements = pattern2.elements;
      let tail = pattern2.tail;
      let acc$1 = fold2(elements, acc, (acc2, p2) => {
        return pattern_refs(p2, bound, acc2);
      });
      if (tail instanceof Some) {
        let t = tail[0];
        loop$pattern = t;
        loop$bound = bound;
        loop$acc = acc$1;
      } else {
        return acc$1;
      }
    } else if (pattern2 instanceof PatternAssignment) {
      let pattern$1 = pattern2.pattern;
      loop$pattern = pattern$1;
      loop$bound = bound;
      loop$acc = acc;
    } else if (pattern2 instanceof PatternBitString) {
      let segments = pattern2.segments;
      return fold2(segments, acc, (acc2, segment) => {
        return fold2(segment[1], acc2, (acc3, option) => {
          if (option instanceof SizeValueOption) {
            let size3 = option[0];
            return bit_array_size_refs(size3, bound, acc3);
          } else {
            return acc3;
          }
        });
      });
    } else if (pattern2 instanceof PatternVariant) {
      let arguments$ = pattern2.arguments;
      return fold2(arguments$, acc, (acc2, field3) => {
        if (field3 instanceof LabelledField) {
          let p2 = field3.item;
          return pattern_refs(p2, bound, acc2);
        } else if (field3 instanceof ShorthandField) {
          return acc2;
        } else {
          let p2 = field3.item;
          return pattern_refs(p2, bound, acc2);
        }
      });
    } else {
      return acc;
    }
  }
}
function assignment_name(name2) {
  if (name2 instanceof Named) {
    let n = name2[0];
    return prepend(n, List$Empty$const);
  } else {
    return List$Empty$const;
  }
}
function pattern_names(pattern2) {
  if (pattern2 instanceof PatternInt) {
    return List$Empty$const;
  } else if (pattern2 instanceof PatternFloat) {
    return List$Empty$const;
  } else if (pattern2 instanceof PatternString) {
    return List$Empty$const;
  } else if (pattern2 instanceof PatternDiscard) {
    return List$Empty$const;
  } else if (pattern2 instanceof PatternVariable) {
    let name2 = pattern2.name;
    return prepend(name2, List$Empty$const);
  } else if (pattern2 instanceof PatternTuple) {
    let elements = pattern2.elements;
    return flat_map(elements, pattern_names);
  } else if (pattern2 instanceof PatternList) {
    let elements = pattern2.elements;
    let tail = pattern2.tail;
    if (tail instanceof Some) {
      let t = tail[0];
      return append(flat_map(elements, pattern_names), pattern_names(t));
    } else {
      return flat_map(elements, pattern_names);
    }
  } else if (pattern2 instanceof PatternAssignment) {
    let pattern$1 = pattern2.pattern;
    let name2 = pattern2.name;
    return prepend(name2, pattern_names(pattern$1));
  } else if (pattern2 instanceof PatternConcatenate) {
    let prefix_name = pattern2.prefix_name;
    let rest_name = pattern2.rest_name;
    return append((() => {
      if (prefix_name instanceof Some) {
        let n = prefix_name[0];
        return assignment_name(n);
      } else {
        return List$Empty$const;
      }
    })(), assignment_name(rest_name));
  } else if (pattern2 instanceof PatternBitString) {
    let segments = pattern2.segments;
    return flat_map(segments, (segment) => {
      return pattern_names(segment[0]);
    });
  } else {
    let arguments$ = pattern2.arguments;
    return flat_map(arguments$, (field3) => {
      if (field3 instanceof LabelledField) {
        let p2 = field3.item;
        return pattern_names(p2);
      } else if (field3 instanceof ShorthandField) {
        let label = field3.label;
        return prepend(label, List$Empty$const);
      } else {
        let p2 = field3.item;
        return pattern_names(p2);
      }
    });
  }
}
function qualifier(acc, bound, name2) {
  return guard(contains2(bound, name2), acc, () => {
    return [acc[0], prepend(name2, acc[1])];
  });
}
function fn_param_names(param) {
  return assignment_name(param.name);
}
function in_optional(expr, bound, acc) {
  if (expr instanceof Some) {
    let e = expr[0];
    return in_expr(e, bound, acc);
  } else {
    return acc;
  }
}
function in_exprs(exprs, bound, acc) {
  return fold2(exprs, acc, (acc2, e) => {
    return in_expr(e, bound, acc2);
  });
}
function in_fields(fields, bound, acc) {
  return fold2(fields, acc, (acc2, field3) => {
    if (field3 instanceof LabelledField) {
      let item = field3.item;
      return in_expr(item, bound, acc2);
    } else if (field3 instanceof ShorthandField) {
      let label = field3.label;
      return value2(acc2, bound, label);
    } else {
      let item = field3.item;
      return in_expr(item, bound, acc2);
    }
  });
}
function in_expr(loop$expr, loop$bound, loop$acc) {
  while (true) {
    let expr = loop$expr;
    let bound = loop$bound;
    let acc = loop$acc;
    if (expr instanceof Int2) {
      return acc;
    } else if (expr instanceof Float2) {
      return acc;
    } else if (expr instanceof String3) {
      return acc;
    } else if (expr instanceof Variable) {
      let name2 = expr.name;
      return value2(acc, bound, name2);
    } else if (expr instanceof NegateInt) {
      let v = expr.value;
      loop$expr = v;
      loop$bound = bound;
      loop$acc = acc;
    } else if (expr instanceof NegateBool) {
      let v = expr.value;
      loop$expr = v;
      loop$bound = bound;
      loop$acc = acc;
    } else if (expr instanceof Block) {
      let statements2 = expr.statements;
      return in_statements(statements2, bound, acc);
    } else if (expr instanceof Panic2) {
      let message2 = expr.message;
      return in_optional(message2, bound, acc);
    } else if (expr instanceof Todo2) {
      let message2 = expr.message;
      return in_optional(message2, bound, acc);
    } else if (expr instanceof Tuple) {
      let elements = expr.elements;
      return in_exprs(elements, bound, acc);
    } else if (expr instanceof List2) {
      let elements = expr.elements;
      let rest = expr.rest;
      return in_optional(rest, bound, in_exprs(elements, bound, acc));
    } else if (expr instanceof Fn2) {
      let arguments$ = expr.arguments;
      let body = expr.body;
      let bound$1 = union(bound, from_list2(flat_map(arguments$, fn_param_names)));
      return in_statements(body, bound$1, acc);
    } else if (expr instanceof RecordUpdate) {
      let record = expr.record;
      let fields = expr.fields;
      return fold2(fields, in_expr(record, bound, acc), (acc2, field3) => {
        return in_optional(field3.item, bound, acc2);
      });
    } else if (expr instanceof FieldAccess) {
      let $ = expr.container;
      if ($ instanceof Variable) {
        let name2 = $.name;
        return qualifier(acc, bound, name2);
      } else {
        let container = $;
        loop$expr = container;
        loop$bound = bound;
        loop$acc = acc;
      }
    } else if (expr instanceof Call) {
      let function$ = expr.function;
      let arguments$ = expr.arguments;
      return in_fields(arguments$, bound, in_expr(function$, bound, acc));
    } else if (expr instanceof TupleIndex) {
      let tuple = expr.tuple;
      loop$expr = tuple;
      loop$bound = bound;
      loop$acc = acc;
    } else if (expr instanceof FnCapture) {
      let function$ = expr.function;
      let before = expr.arguments_before;
      let after = expr.arguments_after;
      return in_fields(after, bound, in_fields(before, bound, in_expr(function$, bound, acc)));
    } else if (expr instanceof BitString) {
      let segments = expr.segments;
      return fold2(segments, acc, (acc2, segment) => {
        return in_expr(segment[0], bound, acc2);
      });
    } else if (expr instanceof Case2) {
      let subjects = expr.subjects;
      let clauses = expr.clauses;
      return fold2(clauses, in_exprs(subjects, bound, acc), (acc2, clause) => {
        let patterns = flatten(clause.patterns);
        let names = flat_map(patterns, pattern_names);
        let bound$1 = union(bound, from_list2(names));
        let acc$1 = fold2(patterns, acc2, (acc3, p2) => {
          return pattern_refs(p2, bound$1, acc3);
        });
        return in_optional(clause.guard, bound$1, in_expr(clause.body, bound$1, acc$1));
      });
    } else if (expr instanceof BinaryOperator) {
      let left = expr.left;
      let right = expr.right;
      loop$expr = right;
      loop$bound = bound;
      loop$acc = in_expr(left, bound, acc);
    } else {
      let expression2 = expr.expression;
      let message2 = expr.message;
      return in_optional(message2, bound, in_optional(expression2, bound, acc));
    }
  }
}
function in_statements(statements2, bound, acc) {
  let $ = fold2(statements2, [bound, acc], (state, statement2) => {
    let bound$1 = state[0];
    let acc$12 = state[1];
    if (statement2 instanceof Use2) {
      let patterns = statement2.patterns;
      let function$ = statement2.function;
      let acc$2 = in_expr(function$, bound$1, acc$12);
      let names = flat_map(patterns, (p2) => {
        return pattern_names(p2.pattern);
      });
      let inner = union(bound$1, from_list2(names));
      let acc$3 = fold2(patterns, acc$2, (acc2, p2) => {
        return pattern_refs(p2.pattern, inner, acc2);
      });
      return [inner, acc$3];
    } else if (statement2 instanceof Assignment) {
      let pattern2 = statement2.pattern;
      let value$1 = statement2.value;
      let acc$2 = in_expr(value$1, bound$1, acc$12);
      let inner = union(bound$1, from_list2(pattern_names(pattern2)));
      return [inner, pattern_refs(pattern2, inner, acc$2)];
    } else if (statement2 instanceof Assert2) {
      let expr = statement2.expression;
      let message2 = statement2.message;
      return [
        bound$1,
        in_optional(message2, bound$1, in_expr(expr, bound$1, acc$12))
      ];
    } else {
      let expr = statement2[0];
      return [bound$1, in_expr(expr, bound$1, acc$12)];
    }
  });
  let acc$1 = $[1];
  return acc$1;
}
function param_names(param) {
  return assignment_name(param.name);
}
function in_function(function$) {
  let bound = from_list2(flat_map(function$.parameters, param_names));
  return in_statements(function$.body, bound, [List$Empty$const, List$Empty$const]);
}
function in_constant(constant) {
  return in_expr(constant.value, new$3(), [List$Empty$const, List$Empty$const]);
}

// build/dev/javascript/girard/girard/internal/scc.mjs
class Tarjan extends CustomType {
  constructor(counter, indices, lowlinks, on_stack, stack, components) {
    super();
    this.counter = counter;
    this.indices = indices;
    this.lowlinks = lowlinks;
    this.on_stack = on_stack;
    this.stack = stack;
    this.components = components;
  }
}
function pop_component(loop$state, loop$root, loop$acc) {
  while (true) {
    let state = loop$state;
    let root2 = loop$root;
    let acc = loop$acc;
    let $ = state.stack;
    if ($ instanceof Empty) {
      return state;
    } else {
      let top = $.head;
      let rest = $.tail;
      let state$1 = new Tarjan(state.counter, state.indices, state.lowlinks, delete$2(state.on_stack, top), rest, state.components);
      let acc$1 = prepend(top, acc);
      let $1 = top === root2;
      if ($1) {
        return new Tarjan(state$1.counter, state$1.indices, state$1.lowlinks, state$1.on_stack, state$1.stack, prepend(acc$1, state$1.components));
      } else {
        loop$state = state$1;
        loop$root = root2;
        loop$acc = acc$1;
      }
    }
  }
}
function get3(d, key) {
  let $ = get(d, key);
  if ($ instanceof Ok) {
    let value3 = $[0];
    return value3;
  } else {
    return 0;
  }
}
function set_min_lowlink(state, node, candidate) {
  let current = get3(state.lowlinks, node);
  return new Tarjan(state.counter, state.indices, insert(state.lowlinks, node, min(current, candidate)), state.on_stack, state.stack, state.components);
}
function strong_connect(state, node, edges) {
  let index5 = state.counter;
  let state$1 = new Tarjan(index5 + 1, insert(state.indices, node, index5), insert(state.lowlinks, node, index5), insert3(state.on_stack, node), prepend(node, state.stack), state.components);
  let _block;
  let $ = get(edges, node);
  if ($ instanceof Ok) {
    let ns = $[0];
    _block = ns;
  } else {
    _block = List$Empty$const;
  }
  let neighbours = _block;
  let state$2 = fold2(neighbours, state$1, (state2, w) => {
    let $12 = get(state2.indices, w);
    if ($12 instanceof Ok) {
      let w_index = $12[0];
      let $2 = contains2(state2.on_stack, w);
      if ($2) {
        return set_min_lowlink(state2, node, w_index);
      } else {
        return state2;
      }
    } else {
      let state$22 = strong_connect(state2, w, edges);
      return set_min_lowlink(state$22, node, get3(state$22.lowlinks, w));
    }
  });
  let $1 = get3(state$2.lowlinks, node) === get3(state$2.indices, node);
  if ($1) {
    return pop_component(state$2, node, List$Empty$const);
  } else {
    return state$2;
  }
}
function components(nodes, edges) {
  let initial = new Tarjan(0, make(), make(), new$3(), List$Empty$const, List$Empty$const);
  let final = fold2(nodes, initial, (state, node) => {
    let $ = has(state.indices, node);
    if ($) {
      return state;
    } else {
      return strong_connect(state, node, edges);
    }
  });
  return reverse2(final.components);
}

// build/dev/javascript/girard/girard/internal/ty.mjs
class Named2 extends CustomType {
  constructor(module2, name2, arguments$, variant) {
    super();
    this.module = module2;
    this.name = name2;
    this.arguments = arguments$;
    this.variant = variant;
  }
}
class Fn3 extends CustomType {
  constructor(arguments$, return$) {
    super();
    this.arguments = arguments$;
    this.return = return$;
  }
}
class Var extends CustomType {
  constructor(id) {
    super();
    this.id = id;
  }
}
class Tuple2 extends CustomType {
  constructor(elements) {
    super();
    this.elements = elements;
  }
}
class Scheme extends CustomType {
  constructor(vars, type_3) {
    super();
    this.vars = vars;
    this.type_ = type_3;
  }
}

// build/dev/javascript/girard/girard.mjs
class Named3 extends CustomType {
  constructor(module2, name2, arguments$) {
    super();
    this.module = module2;
    this.name = name2;
    this.arguments = arguments$;
  }
}
class Fn4 extends CustomType {
  constructor(arguments$, return$) {
    super();
    this.arguments = arguments$;
    this.return = return$;
  }
}
class Var2 extends CustomType {
  constructor(id) {
    super();
    this.id = id;
  }
}
class Tuple3 extends CustomType {
  constructor(elements) {
    super();
    this.elements = elements;
  }
}
class Scheme2 extends CustomType {
  constructor(vars, type_3) {
    super();
    this.vars = vars;
    this.type_ = type_3;
  }
}
class TypeMismatch extends CustomType {
  constructor(left, right) {
    super();
    this.left = left;
    this.right = right;
  }
}
class ArityMismatch extends CustomType {
}
var Error$ArityMismatch$const = new ArityMismatch;
class RecursiveType extends CustomType {
  constructor(id, type_3) {
    super();
    this.id = id;
    this.type_ = type_3;
  }
}
class UnboundVariable extends CustomType {
  constructor(name2) {
    super();
    this.name = name2;
  }
}
class UnknownConstructor extends CustomType {
  constructor(name2) {
    super();
    this.name = name2;
  }
}
class UnknownModule extends CustomType {
  constructor(alias) {
    super();
    this.alias = alias;
  }
}
class NoSuchExport extends CustomType {
  constructor(module2, name2) {
    super();
    this.module = module2;
    this.name = name2;
  }
}
class NoSuchField extends CustomType {
  constructor(type_name, label) {
    super();
    this.type_name = type_name;
    this.label = label;
  }
}
class NotARecord extends CustomType {
}
var Error$NotARecord$const = new NotARecord;
class NotATuple extends CustomType {
}
var Error$NotATuple$const = new NotATuple;
class TupleIndexOutOfRange extends CustomType {
  constructor(index5) {
    super();
    this.index = index5;
  }
}
class UnknownLabel extends CustomType {
  constructor(label) {
    super();
    this.label = label;
  }
}
class AmbiguousCall extends CustomType {
}
var Error$AmbiguousCall$const = new AmbiguousCall;
class MissingArgument extends CustomType {
}
var Error$MissingArgument$const = new MissingArgument;
class Unsupported extends CustomType {
  constructor(feature) {
    super();
    this.feature = feature;
  }
}
class Annotation extends CustomType {
  constructor(span2, type_3) {
    super();
    this.span = span2;
    this.type_ = type_3;
  }
}
class AnnotatedModule extends CustomType {
  constructor(functions, constants, expressions, resolutions, dropped) {
    super();
    this.functions = functions;
    this.constants = constants;
    this.expressions = expressions;
    this.resolutions = resolutions;
    this.dropped = dropped;
  }
}
class Dropped extends CustomType {
  constructor(name2, span2) {
    super();
    this.name = name2;
    this.span = span2;
  }
}
class RecordField extends CustomType {
  constructor(receiver, label) {
    super();
    this.receiver = receiver;
    this.label = label;
  }
}
class ModuleFn extends CustomType {
  constructor(module2, name2) {
    super();
    this.module = module2;
    this.name = name2;
  }
}
class ModuleConstant extends CustomType {
  constructor(module2, name2) {
    super();
    this.module = module2;
    this.name = name2;
  }
}
class Constructor extends CustomType {
  constructor(module2, name2) {
    super();
    this.module = module2;
    this.name = name2;
  }
}
class LocalVariable extends CustomType {
  constructor(name2) {
    super();
    this.name = name2;
  }
}
class Unresolved extends CustomType {
  constructor(reason) {
    super();
    this.reason = reason;
  }
}
class RecordAccessUnknownType extends CustomType {
}
var UnresolvedReason$RecordAccessUnknownType$const = new RecordAccessUnknownType;
class ResolvedReference extends CustomType {
  constructor(span2, label_span, container_span, resolution) {
    super();
    this.span = span2;
    this.label_span = label_span;
    this.container_span = container_span;
    this.resolution = resolution;
  }
}
class Erlang extends CustomType {
}
var Target$Erlang$const = new Erlang;
class JavaScript extends CustomType {
}
var Target$JavaScript$const = new JavaScript;
class Options2 extends CustomType {
  constructor(resolver, target) {
    super();
    this.resolver = resolver;
    this.target = target;
  }
}
class State extends CustomType {
  constructor(next_id, subst, annotations, references, pending, rigid) {
    super();
    this.next_id = next_id;
    this.subst = subst;
    this.annotations = annotations;
    this.references = references;
    this.pending = pending;
    this.rigid = rigid;
  }
}

class PendingField extends CustomType {
  constructor(container, label, result) {
    super();
    this.container = container;
    this.label = label;
    this.result = result;
  }
}

class PendingIndex extends CustomType {
  constructor(container, index5, result) {
    super();
    this.container = container;
    this.index = index5;
    this.result = result;
  }
}

class Reference extends CustomType {
  constructor(spans, resolved) {
    super();
    this.spans = spans;
    this.resolved = resolved;
  }
}

class ResolvedField extends CustomType {
  constructor(record, label) {
    super();
    this.record = record;
    this.label = label;
  }
}

class ResolvedValue extends CustomType {
  constructor(variant) {
    super();
    this.variant = variant;
  }
}

class ResolvedDeferred extends CustomType {
}
var Resolved$ResolvedDeferred$const = new ResolvedDeferred;

class Spans extends CustomType {
  constructor(span2, label, container) {
    super();
    this.span = span2;
    this.label = label;
    this.container = container;
  }
}

class ValueConstructor extends CustomType {
  constructor(scheme, variant) {
    super();
    this.scheme = scheme;
    this.variant = variant;
  }
}

class LocalValue extends CustomType {
  constructor(name2) {
    super();
    this.name = name2;
  }
}

class FunctionValue extends CustomType {
  constructor(module2, name2, field_map) {
    super();
    this.module = module2;
    this.name = name2;
    this.field_map = field_map;
  }
}

class ConstantValue extends CustomType {
  constructor(module2, name2) {
    super();
    this.module = module2;
    this.name = name2;
  }
}

class ConstructorValue extends CustomType {
  constructor(module2, name2, field_map) {
    super();
    this.module = module2;
    this.name = name2;
    this.field_map = field_map;
  }
}

class Accessors extends CustomType {
  constructor(shared, by_variant) {
    super();
    this.shared = shared;
    this.by_variant = by_variant;
  }
}

class Env extends CustomType {
  constructor(values4, open_values, aliases, imported_aliases, accessors, local_types, current_module, modules, module_index, live) {
    super();
    this.values = values4;
    this.open_values = open_values;
    this.aliases = aliases;
    this.imported_aliases = imported_aliases;
    this.accessors = accessors;
    this.local_types = local_types;
    this.current_module = current_module;
    this.modules = modules;
    this.module_index = module_index;
    this.live = live;
  }
}

class ModuleInterface extends CustomType {
  constructor(name2, values4, types, aliases, accessors, modules, reachable) {
    super();
    this.name = name2;
    this.values = values4;
    this.types = types;
    this.aliases = aliases;
    this.accessors = accessors;
    this.modules = modules;
    this.reachable = reachable;
  }
}

class FunctionDef extends CustomType {
  constructor($0) {
    super();
    this[0] = $0;
  }
}

class ConstantDef extends CustomType {
  constructor($0) {
    super();
    this[0] = $0;
  }
}

class Inferred extends CustomType {
  constructor(functions, constants, env, st, interface$, cache, skipped, dropped) {
    super();
    this.functions = functions;
    this.constants = constants;
    this.env = env;
    this.st = st;
    this.interface = interface$;
    this.cache = cache;
    this.skipped = skipped;
    this.dropped = dropped;
  }
}

class AnnotatedDef extends CustomType {
  constructor(def, function$, params, return_type) {
    super();
    this.def = def;
    this.function = function$;
    this.params = params;
    this.return_type = return_type;
  }
}

class PlaceholderDef extends CustomType {
  constructor(def, var$) {
    super();
    this.def = def;
    this.var = var$;
  }
}

class Field extends CustomType {
  constructor(record) {
    super();
    this.record = record;
  }
}

class Export extends CustomType {
  constructor(variant) {
    super();
    this.variant = variant;
  }
}

class Deferred extends CustomType {
}
var Access$Deferred$const = new Deferred;

class Argument extends CustomType {
  constructor(expression2) {
    super();
    this.expression = expression2;
  }
}

class Implicit extends CustomType {
}
var CallSlot$Implicit$const = new Implicit;
var prelude_module = "gleam";
function disk_resolver() {
  return (_) => {
    return new Error(undefined);
  };
}
function default_options() {
  return new Options2(disk_resolver(), Target$Erlang$const);
}
function with_resolver(options, resolver) {
  return new Options2(resolver, options.target);
}
function compare_spans(a2, b) {
  let _pipe = compare3(a2.start, b.start);
  return break_tie(_pipe, compare3(a2.end, b.end));
}
function sort_references(references) {
  return sort(references, (a2, b) => {
    return compare_spans(a2.span, b.span);
  });
}
function resolve2(loop$st, loop$type_) {
  while (true) {
    let st = loop$st;
    let type_3 = loop$type_;
    if (type_3 instanceof Var) {
      let id = type_3.id;
      let $ = get(st.subst, id);
      if ($ instanceof Ok) {
        let bound = $[0];
        loop$st = st;
        loop$type_ = bound;
      } else {
        return type_3;
      }
    } else {
      return type_3;
    }
  }
}
function zonk(st, type_3) {
  let $ = resolve2(st, type_3);
  if ($ instanceof Named2) {
    let module2 = $.module;
    let name2 = $.name;
    let args = $.arguments;
    let variant = $.variant;
    return new Named2(module2, name2, map2(args, (_capture) => {
      return zonk(st, _capture);
    }), variant);
  } else if ($ instanceof Fn3) {
    let args = $.arguments;
    let ret = $.return;
    return new Fn3(map2(args, (_capture) => {
      return zonk(st, _capture);
    }), zonk(st, ret));
  } else if ($ instanceof Var) {
    return $;
  } else {
    let elements = $.elements;
    return new Tuple2(map2(elements, (_capture) => {
      return zonk(st, _capture);
    }));
  }
}
function to_public(type_3) {
  if (type_3 instanceof Named2) {
    let module2 = type_3.module;
    let name2 = type_3.name;
    let args = type_3.arguments;
    return new Named3(module2, name2, map2(args, to_public));
  } else if (type_3 instanceof Fn3) {
    let args = type_3.arguments;
    let ret = type_3.return;
    return new Fn4(map2(args, to_public), to_public(ret));
  } else if (type_3 instanceof Var) {
    let id = type_3.id;
    return new Var2(id);
  } else {
    let elements = type_3.elements;
    return new Tuple3(map2(elements, to_public));
  }
}
function publish_resolution(st, resolved) {
  if (resolved instanceof ResolvedField) {
    let receiver = resolved.record;
    let label = resolved.label;
    return new RecordField(to_public(zonk(st, receiver)), label);
  } else if (resolved instanceof ResolvedValue) {
    let $ = resolved.variant;
    if ($ instanceof LocalValue) {
      let name2 = $.name;
      return new LocalVariable(name2);
    } else if ($ instanceof FunctionValue) {
      let module2 = $.module;
      let name2 = $.name;
      return new ModuleFn(module2, name2);
    } else if ($ instanceof ConstantValue) {
      let module2 = $.module;
      let name2 = $.name;
      return new ModuleConstant(module2, name2);
    } else {
      let module2 = $.module;
      let name2 = $.name;
      return new Constructor(module2, name2);
    }
  } else {
    return new Unresolved(UnresolvedReason$RecordAccessUnknownType$const);
  }
}
function publish_reference(st, reference) {
  return new ResolvedReference(reference.spans.span, reference.spans.label, reference.spans.container, publish_resolution(st, reference.resolved));
}
function one_per_span(references) {
  return fold2(references, [List$Empty$const, new$3()], (acc, reference) => {
    let kept = acc[0];
    let seen = acc[1];
    let $ = contains2(seen, reference.spans.span);
    if ($) {
      return acc;
    } else {
      return [
        prepend(reference, kept),
        insert3(seen, reference.spans.span)
      ];
    }
  })[0];
}
function publish_references(st) {
  let _pipe = st.references;
  let _pipe$1 = one_per_span(_pipe);
  let _pipe$2 = map2(_pipe$1, (_capture) => {
    return publish_reference(st, _capture);
  });
  return sort_references(_pipe$2);
}
function sort_by_span(annotations) {
  return sort(annotations, (a2, b) => {
    return compare_spans(a2.span, b.span);
  });
}
function scheme_to_public(scheme) {
  return new Scheme2(scheme.vars, to_public(scheme.type_));
}
function lookup2(env, name2) {
  let _pipe = get(env.values, name2);
  return map4(_pipe, (entry) => {
    return entry.scheme;
  });
}
function def_name(def) {
  if (def instanceof FunctionDef) {
    let f = def[0];
    return f.name;
  } else {
    let c = def[0];
    return c.name;
  }
}
function def_span(def) {
  if (def instanceof FunctionDef) {
    let f = def[0];
    return f.location;
  } else {
    let c = def[0];
    return c.location;
  }
}
function collect_schemes(defs, env, declined) {
  let _pipe = defs;
  let _pipe$1 = sort(_pipe, (a2, b) => {
    return compare_spans(def_span(a2), def_span(b));
  });
  return filter_map(_pipe$1, (def) => {
    let name2 = def_name(def);
    let $ = contains2(declined, name2);
    if ($) {
      return new Error(undefined);
    } else {
      let $1 = lookup2(env, name2);
      if ($1 instanceof Ok) {
        let scheme = $1[0];
        return new Ok([name2, scheme_to_public(scheme)]);
      } else {
        return new Error(undefined);
      }
    }
  });
}
function render(inferred) {
  let functions = inferred.functions;
  let constants = inferred.constants;
  let env = inferred.env;
  let st = inferred.st;
  let skipped = inferred.skipped;
  let dropped = inferred.dropped;
  let declined = from_list2(map2(skipped, (entry) => {
    return entry[0];
  }));
  let expressions = map2(reverse2(st.annotations), (entry) => {
    let span$1 = entry[0];
    let type_3 = entry[1];
    return new Annotation(span$1, to_public(zonk(st, type_3)));
  });
  return new AnnotatedModule(collect_schemes(functions, env, declined), collect_schemes(constants, env, declined), sort_by_span(expressions), publish_references(st), dropped);
}
function public_accessor_type_names(module2) {
  return filter_map(module2.custom_types, (d) => {
    let $ = d.definition.publicity;
    let $1 = d.definition.opaque_;
    if ($ instanceof Public && !$1) {
      return new Ok(d.definition.name);
    } else {
      return new Error(undefined);
    }
  });
}
function public_type_names(module2) {
  let types = filter_map(module2.custom_types, (d) => {
    let $ = d.definition.publicity;
    if ($ instanceof Public) {
      return new Ok(d.definition.name);
    } else {
      return new Error(undefined);
    }
  });
  let aliases = filter_map(module2.type_aliases, (d) => {
    let $ = d.definition.publicity;
    if ($ instanceof Public) {
      return new Ok(d.definition.name);
    } else {
      return new Error(undefined);
    }
  });
  return append(types, aliases);
}
function public_value_names(module2) {
  let functions = filter_map(module2.functions, (d) => {
    let $ = d.definition.publicity;
    if ($ instanceof Public) {
      return new Ok(d.definition.name);
    } else {
      return new Error(undefined);
    }
  });
  let constants = filter_map(module2.constants, (d) => {
    let $ = d.definition.publicity;
    if ($ instanceof Public) {
      return new Ok(d.definition.name);
    } else {
      return new Error(undefined);
    }
  });
  let constructors = flat_map(module2.custom_types, (d) => {
    let ct = d.definition;
    let $ = ct.publicity;
    let $1 = ct.opaque_;
    if ($ instanceof Public && !$1) {
      return map2(ct.variants, (v) => {
        return v.name;
      });
    } else {
      return List$Empty$const;
    }
  });
  return flatten(prepend(functions, prepend(constants, prepend(constructors, List$Empty$const))));
}
function take3(d, keys2) {
  return fold2(keys2, make(), (acc, key) => {
    let $ = get(d, key);
    if ($ instanceof Ok) {
      let value3 = $[0];
      return insert(acc, key, value3);
    } else {
      return acc;
    }
  });
}
function fresh_id(st) {
  return [
    st.next_id,
    new State(st.next_id + 1, st.subst, st.annotations, st.references, st.pending, st.rigid)
  ];
}
function fresh(st) {
  let $ = fresh_id(st);
  let id = $[0];
  let st$1 = $[1];
  return [new Var(id), st$1];
}
function substitute(mapping, type_3) {
  if (type_3 instanceof Named2) {
    let module2 = type_3.module;
    let name2 = type_3.name;
    let args = type_3.arguments;
    let variant = type_3.variant;
    return new Named2(module2, name2, map2(args, (_capture) => {
      return substitute(mapping, _capture);
    }), variant);
  } else if (type_3 instanceof Fn3) {
    let args = type_3.arguments;
    let ret = type_3.return;
    return new Fn3(map2(args, (_capture) => {
      return substitute(mapping, _capture);
    }), substitute(mapping, ret));
  } else if (type_3 instanceof Var) {
    let id = type_3.id;
    let $ = get(mapping, id);
    if ($ instanceof Ok) {
      let replacement = $[0];
      return replacement;
    } else {
      return type_3;
    }
  } else {
    let elements = type_3.elements;
    return new Tuple2(map2(elements, (_capture) => {
      return substitute(mapping, _capture);
    }));
  }
}
function instantiate_alias(params, body, arguments$) {
  return substitute(from_list(zip(params, arguments$)), body);
}
function resolve_qualified_type(env, st, alias, name2, arg_types) {
  let $ = get(env.modules, alias);
  if ($ instanceof Ok) {
    let interface$ = $[0];
    let $1 = get(interface$.aliases, name2);
    if ($1 instanceof Ok) {
      let params = $1[0][0];
      let body = $1[0][1];
      return [instantiate_alias(params, body, arg_types), st];
    } else {
      let _block;
      let $2 = get(interface$.types, name2);
      if ($2 instanceof Ok) {
        let origin3 = $2[0][0];
        _block = origin3;
      } else {
        _block = alias;
      }
      let origin2 = _block;
      return [new Named2(origin2, name2, arg_types, Option$None$const), st];
    }
  } else {
    return [new Named2(alias, name2, arg_types, Option$None$const), st];
  }
}
function resolve_named_origin(env, name2, arg_types) {
  let $ = get(env.imported_aliases, name2);
  if ($ instanceof Ok) {
    let params = $[0][0];
    let body = $[0][1];
    return instantiate_alias(params, body, arg_types);
  } else {
    let $1 = get(env.local_types, name2);
    if ($1 instanceof Ok) {
      let origin2 = $1[0][0];
      let origin_name = $1[0][1];
      return new Named2(origin2, origin_name, arg_types, Option$None$const);
    } else {
      return new Named2(prelude_module, name2, arg_types, Option$None$const);
    }
  }
}
function resolve_unqualified_type(env, st, name2, arg_types) {
  let $ = get(env.aliases, name2);
  if ($ instanceof Ok) {
    let params = $[0][0];
    let aliased = $[0][1];
    let alias_names = from_list(zip(params, arg_types));
    let $1 = hydrate_with(env, alias_names, st, aliased);
    let t;
    let st$1;
    t = $1[0][0];
    st$1 = $1[0][1];
    return [t, st$1];
  } else {
    return [resolve_named_origin(env, name2, arg_types), st];
  }
}
function resolve_named_type(env, st, module2, name2, arg_types) {
  if (module2 instanceof Some) {
    let alias = module2[0];
    return resolve_qualified_type(env, st, alias, name2, arg_types);
  } else {
    return resolve_unqualified_type(env, st, name2, arg_types);
  }
}
function hydrate_with(env, names, st, ast) {
  if (ast instanceof NamedType) {
    let name2 = ast.name;
    let module2 = ast.module;
    let parameters = ast.parameters;
    let $ = fold2(parameters, [List$Empty$const, st, names], (acc, p2) => {
      let types_ = acc[0];
      let st$12 = acc[1];
      let names$12 = acc[2];
      let $12 = hydrate_with(env, names$12, st$12, p2);
      let t2;
      let st$22;
      let names$2;
      names$2 = $12[1];
      t2 = $12[0][0];
      st$22 = $12[0][1];
      return [prepend(t2, types_), st$22, names$2];
    });
    let arg_types = $[0];
    let st$1 = $[1];
    let names$1 = $[2];
    let arg_types$1 = reverse2(arg_types);
    let $1 = resolve_named_type(env, st$1, module2, name2, arg_types$1);
    let t = $1[0];
    let st$2 = $1[1];
    return [[t, st$2], names$1];
  } else if (ast instanceof TupleType) {
    let elements = ast.elements;
    let $ = fold2(elements, [List$Empty$const, st, names], (acc, e) => {
      let types_ = acc[0];
      let st$12 = acc[1];
      let names$12 = acc[2];
      let $1 = hydrate_with(env, names$12, st$12, e);
      let t;
      let st$2;
      let names$2;
      names$2 = $1[1];
      t = $1[0][0];
      st$2 = $1[0][1];
      return [prepend(t, types_), st$2, names$2];
    });
    let elem_types = $[0];
    let st$1 = $[1];
    let names$1 = $[2];
    return [[new Tuple2(reverse2(elem_types)), st$1], names$1];
  } else if (ast instanceof FunctionType) {
    let parameters = ast.parameters;
    let return$ = ast.return;
    let $ = fold2(parameters, [List$Empty$const, st, names], (acc, p2) => {
      let types_ = acc[0];
      let st$12 = acc[1];
      let names$12 = acc[2];
      let $12 = hydrate_with(env, names$12, st$12, p2);
      let t;
      let st$22;
      let names$22;
      names$22 = $12[1];
      t = $12[0][0];
      st$22 = $12[0][1];
      return [prepend(t, types_), st$22, names$22];
    });
    let param_types = $[0];
    let st$1 = $[1];
    let names$1 = $[2];
    let $1 = hydrate_with(env, names$1, st$1, return$);
    let ret;
    let st$2;
    let names$2;
    names$2 = $1[1];
    ret = $1[0][0];
    st$2 = $1[0][1];
    return [[new Fn3(reverse2(param_types), ret), st$2], names$2];
  } else if (ast instanceof VariableType) {
    let name2 = ast.name;
    let $ = get(names, name2);
    if ($ instanceof Ok) {
      let t = $[0];
      return [[t, st], names];
    } else {
      let $1 = fresh(st);
      let t = $1[0];
      let st$1 = $1[1];
      return [[t, st$1], insert(names, name2, t)];
    }
  } else {
    let $ = fresh(st);
    let t = $[0];
    let st$1 = $[1];
    return [[t, st$1], names];
  }
}
function hydrate_in(env, names, st, ast) {
  return hydrate_with(env, names, st, ast)[0];
}
function var_id(type_3) {
  if (type_3 instanceof Var) {
    let id = type_3.id;
    return new Ok(id);
  } else {
    return new Error(undefined);
  }
}
function fresh_n(st, n) {
  return guard(n <= 0, [List$Empty$const, st], () => {
    let $ = fresh(st);
    let t = $[0];
    let st$1 = $[1];
    let $1 = fresh_n(st$1, n - 1);
    let rest = $1[0];
    let st$2 = $1[1];
    return [prepend(t, rest), st$2];
  });
}
function resolve_aliases(env, st, type_names) {
  return fold2(type_names, [make(), st], (acc, name2) => {
    let resolved = acc[0];
    let st$1 = acc[1];
    let $ = get(env.aliases, name2);
    if ($ instanceof Ok) {
      let params = $[0][0];
      let body = $[0][1];
      let $1 = fresh_n(st$1, length(params));
      let param_vars = $1[0];
      let st$2 = $1[1];
      let param_ids = filter_map(param_vars, var_id);
      let names = from_list(zip(params, param_vars));
      let $2 = hydrate_in(env, names, st$2, body);
      let type_3 = $2[0];
      let st$3 = $2[1];
      return [insert(resolved, name2, [param_ids, type_3]), st$3];
    } else {
      return [resolved, st$1];
    }
  })[0];
}
function build_interface(env, st, name2, value_names, type_names, accessor_type_names) {
  return new ModuleInterface(name2, take3(env.values, value_names), take3(env.local_types, type_names), resolve_aliases(env, st, type_names), take3(env.accessors, accessor_type_names), env.modules, env.module_index);
}
function free_vars_loop(loop$type_, loop$acc) {
  while (true) {
    let type_3 = loop$type_;
    let acc = loop$acc;
    if (type_3 instanceof Named2) {
      let args = type_3.arguments;
      return fold2(args, acc, (a2, t) => {
        return free_vars_loop(t, a2);
      });
    } else if (type_3 instanceof Fn3) {
      let args = type_3.arguments;
      let ret = type_3.return;
      loop$type_ = ret;
      loop$acc = fold2(args, acc, (a2, t) => {
        return free_vars_loop(t, a2);
      });
    } else if (type_3 instanceof Var) {
      let id = type_3.id;
      let $ = contains(acc, id);
      if ($) {
        return acc;
      } else {
        return prepend(id, acc);
      }
    } else {
      let elements = type_3.elements;
      return fold2(elements, acc, (a2, t) => {
        return free_vars_loop(t, a2);
      });
    }
  }
}
function free_vars(st, type_3) {
  return free_vars_loop(zonk(st, type_3), List$Empty$const);
}
function scheme_free_vars(loop$st, loop$type_, loop$bound, loop$acc) {
  while (true) {
    let st = loop$st;
    let type_3 = loop$type_;
    let bound = loop$bound;
    let acc = loop$acc;
    if (type_3 instanceof Named2) {
      let args = type_3.arguments;
      return fold2(args, acc, (a2, t) => {
        return scheme_free_vars(st, t, bound, a2);
      });
    } else if (type_3 instanceof Fn3) {
      let args = type_3.arguments;
      let ret = type_3.return;
      loop$st = st;
      loop$type_ = ret;
      loop$bound = bound;
      loop$acc = fold2(args, acc, (a2, t) => {
        return scheme_free_vars(st, t, bound, a2);
      });
    } else if (type_3 instanceof Var) {
      let id = type_3.id;
      let $ = contains(bound, id);
      if ($) {
        return acc;
      } else {
        let $1 = resolve2(st, type_3);
        if ($1 instanceof Var) {
          let resolved = $1.id;
          let $2 = contains(acc, resolved);
          if ($2) {
            return acc;
          } else {
            return prepend(resolved, acc);
          }
        } else {
          let other = $1;
          loop$st = st;
          loop$type_ = other;
          loop$bound = bound;
          loop$acc = acc;
        }
      }
    } else {
      let elements = type_3.elements;
      return fold2(elements, acc, (a2, t) => {
        return scheme_free_vars(st, t, bound, a2);
      });
    }
  }
}
function env_free_vars(st, env) {
  return fold(env.open_values, List$Empty$const, (acc, _, scheme) => {
    return scheme_free_vars(st, scheme.type_, scheme.vars, acc);
  });
}
function erase_all(type_3) {
  if (type_3 instanceof Named2) {
    let module2 = type_3.module;
    let name2 = type_3.name;
    let args = type_3.arguments;
    return new Named2(module2, name2, map2(args, erase_all), Option$None$const);
  } else if (type_3 instanceof Fn3) {
    let args = type_3.arguments;
    let ret = type_3.return;
    return new Fn3(map2(args, erase_all), erase_all(ret));
  } else if (type_3 instanceof Var) {
    return type_3;
  } else {
    let elements = type_3.elements;
    return new Tuple2(map2(elements, erase_all));
  }
}
function generalize(st, env, type_3) {
  let zonked = erase_all(zonk(st, type_3));
  let env_vars = env_free_vars(st, env);
  let quantified = filter(free_vars(st, zonked), (id) => {
    return !contains(env_vars, id);
  });
  return new Scheme(quantified, zonked);
}
function field_map_of(labels) {
  return guard(all(labels, (l) => {
    return l instanceof None;
  }), Option$None$const, () => {
    return new Some(labels);
  });
}
function def_variant(env, def) {
  if (def instanceof FunctionDef) {
    let f = def[0];
    return new FunctionValue(env.current_module, f.name, field_map_of(map2(f.parameters, (p2) => {
      return p2.label;
    })));
  } else {
    let c = def[0];
    return new ConstantValue(env.current_module, c.name);
  }
}
function all_vars_bound(type_3, bound) {
  if (type_3 instanceof Named2) {
    let args = type_3.arguments;
    return all(args, (_capture) => {
      return all_vars_bound(_capture, bound);
    });
  } else if (type_3 instanceof Fn3) {
    let args = type_3.arguments;
    let ret = type_3.return;
    return all(args, (_capture) => {
      return all_vars_bound(_capture, bound);
    }) && all_vars_bound(ret, bound);
  } else if (type_3 instanceof Var) {
    let id = type_3.id;
    return contains2(bound, id);
  } else {
    let elements = type_3.elements;
    return all(elements, (_capture) => {
      return all_vars_bound(_capture, bound);
    });
  }
}
function scheme_is_closed(scheme) {
  let bound = from_list2(scheme.vars);
  return all_vars_bound(scheme.type_, bound);
}
function install_entry(env, name2, entry) {
  return new Env(insert(env.values, name2, entry), (() => {
    let $ = scheme_is_closed(entry.scheme);
    if ($) {
      return delete$(env.open_values, name2);
    } else {
      return insert(env.open_values, name2, entry.scheme);
    }
  })(), env.aliases, env.imported_aliases, env.accessors, env.local_types, env.current_module, env.modules, env.module_index, env.live);
}
function install(env, name2, scheme, variant) {
  return install_entry(env, name2, new ValueConstructor(scheme, variant));
}
function define_def(env, def, scheme) {
  return install(env, def_name(def), scheme, def_variant(env, def));
}
function function_scheme(env, st, param_types, return_type) {
  return generalize(st, env, new Fn3(param_types, return_type));
}
function type_mismatch(left, right) {
  return new TypeMismatch(to_public(left), to_public(right));
}
function erase_variant(type_3) {
  if (type_3 instanceof Named2) {
    let module2 = type_3.module;
    let name2 = type_3.name;
    let args = type_3.arguments;
    return new Named2(module2, name2, args, Option$None$const);
  } else if (type_3 instanceof Fn3) {
    let args = type_3.arguments;
    let ret = type_3.return;
    return new Fn3(map2(args, erase_variant), erase_variant(ret));
  } else if (type_3 instanceof Var) {
    return type_3;
  } else {
    let elements = type_3.elements;
    return new Tuple2(map2(elements, erase_variant));
  }
}
function recursive_type(id, type_3) {
  return new RecursiveType(id, to_public(type_3));
}
function occurs(st, id, type_3) {
  return contains(free_vars(st, type_3), id);
}
function bind_var(st, id, type_3) {
  return lazy_guard(occurs(st, id, type_3), () => {
    return new Error(recursive_type(id, type_3));
  }, () => {
    return new Ok(new State(st.next_id, insert(st.subst, id, erase_variant(type_3)), st.annotations, st.references, st.pending, st.rigid));
  });
}
function is_rigid(st, id) {
  return contains2(st.rigid, id);
}
function unify_many(st, left, right) {
  if (left instanceof Empty) {
    if (right instanceof Empty) {
      return new Ok(st);
    } else {
      return new Error(Error$ArityMismatch$const);
    }
  } else if (right instanceof Empty) {
    return new Error(Error$ArityMismatch$const);
  } else {
    let x = left.head;
    let xs = left.tail;
    let y = right.head;
    let ys = right.tail;
    return try$(unify(st, x, y), (st2) => {
      return unify_many(st2, xs, ys);
    });
  }
}
function unify(st, left, right) {
  let left$1 = resolve2(st, left);
  let right$1 = resolve2(st, right);
  if (left$1 instanceof Named2) {
    if (right$1 instanceof Named2) {
      let m1 = left$1.module;
      let n1 = left$1.name;
      let m2 = right$1.module;
      let n2 = right$1.name;
      if (m1 === m2 && n1 === n2) {
        let a1 = left$1.arguments;
        let a2 = right$1.arguments;
        return unify_many(st, a1, a2);
      } else {
        return new Error(type_mismatch(left$1, right$1));
      }
    } else if (right$1 instanceof Var) {
      let other = left$1;
      let j = right$1.id;
      let $ = is_rigid(st, j);
      if ($) {
        return new Error(type_mismatch(left$1, right$1));
      } else {
        return bind_var(st, j, other);
      }
    } else {
      return new Error(type_mismatch(left$1, right$1));
    }
  } else if (left$1 instanceof Fn3) {
    if (right$1 instanceof Fn3) {
      let args1 = left$1.arguments;
      let r1 = left$1.return;
      let args2 = right$1.arguments;
      let r2 = right$1.return;
      return try$(unify_many(st, args1, args2), (st2) => {
        return unify(st2, r1, r2);
      });
    } else if (right$1 instanceof Var) {
      let other = left$1;
      let j = right$1.id;
      let $ = is_rigid(st, j);
      if ($) {
        return new Error(type_mismatch(left$1, right$1));
      } else {
        return bind_var(st, j, other);
      }
    } else {
      return new Error(type_mismatch(left$1, right$1));
    }
  } else if (left$1 instanceof Var) {
    if (right$1 instanceof Var) {
      let i = left$1.id;
      let j = right$1.id;
      if (i === j) {
        return new Ok(st);
      } else {
        let i$1 = left$1.id;
        let j$1 = right$1.id;
        let $ = is_rigid(st, i$1);
        let $1 = is_rigid(st, j$1);
        if ($) {
          if ($1) {
            return new Error(type_mismatch(left$1, right$1));
          } else {
            return bind_var(st, j$1, left$1);
          }
        } else {
          return bind_var(st, i$1, right$1);
        }
      }
    } else {
      let other = right$1;
      let i = left$1.id;
      let $ = is_rigid(st, i);
      if ($) {
        return new Error(type_mismatch(left$1, right$1));
      } else {
        return bind_var(st, i, other);
      }
    }
  } else if (right$1 instanceof Var) {
    let other = left$1;
    let j = right$1.id;
    let $ = is_rigid(st, j);
    if ($) {
      return new Error(type_mismatch(left$1, right$1));
    } else {
      return bind_var(st, j, other);
    }
  } else if (right$1 instanceof Tuple2) {
    let e1 = left$1.elements;
    let e2 = right$1.elements;
    return unify_many(st, e1, e2);
  } else {
    return new Error(type_mismatch(left$1, right$1));
  }
}
function list_at(loop$items, loop$index) {
  while (true) {
    let items = loop$items;
    let index5 = loop$index;
    if (items instanceof Empty) {
      return new Error(undefined);
    } else if (index5 === 0) {
      let x = items.head;
      return new Ok(x);
    } else {
      let n = index5;
      if (n > 0) {
        let rest = items.tail;
        loop$items = rest;
        loop$index = n - 1;
      } else {
        return new Error(undefined);
      }
    }
  }
}
function instantiate(st, scheme) {
  let $ = fold2(scheme.vars, [make(), st], (acc, old) => {
    let mapping2 = acc[0];
    let st$12 = acc[1];
    let $1 = fresh(st$12);
    let fresh_type = $1[0];
    let st$2 = $1[1];
    return [insert(mapping2, old, fresh_type), st$2];
  });
  let mapping = $[0];
  let st$1 = $[1];
  return [substitute(mapping, scheme.type_), st$1];
}
function accessors_for_variant(accessors, variant) {
  if (variant instanceof Some) {
    let index5 = variant[0];
    return unwrap2(list_at(accessors.by_variant, index5), accessors.shared);
  } else {
    return accessors.shared;
  }
}
function accessors_of_module(env, module2) {
  let $ = module2 === env.current_module;
  if ($) {
    return env.accessors;
  } else {
    let $1 = get(env.module_index, module2);
    if ($1 instanceof Ok) {
      let interface$ = $1[0];
      return interface$.accessors;
    } else {
      return env.accessors;
    }
  }
}
function accessor(env, record, label) {
  if (record instanceof Named2) {
    let module2 = record.module;
    let name2 = record.name;
    let variant = record.variant;
    let accessors = accessors_of_module(env, module2);
    let $ = get(accessors, name2);
    if ($ instanceof Ok) {
      let found = $[0];
      let $1 = get(accessors_for_variant(found, variant), label);
      if ($1 instanceof Ok) {
        return $1;
      } else {
        return new Error(new NoSuchField(name2, label));
      }
    } else {
      return new Error(new NoSuchField(name2, label));
    }
  } else {
    return new Error(Error$NotARecord$const);
  }
}
function resolve_one(env, st, item) {
  if (item instanceof PendingField) {
    let container = item.container;
    let label = item.label;
    let field3 = item.result;
    let $ = resolve2(st, container);
    if ($ instanceof Named2) {
      let record$1 = $;
      return try$(accessor(env, record$1, label), (scheme) => {
        let $1 = instantiate(st, scheme);
        let accessor_type = $1[0];
        let st$1 = $1[1];
        return try$(unify(st$1, accessor_type, new Fn3(prepend(container, List$Empty$const), field3)), (st2) => {
          return new Ok([st2, true]);
        });
      });
    } else if ($ instanceof Var) {
      return new Ok([st, false]);
    } else {
      return new Error(Error$NotARecord$const);
    }
  } else {
    let container = item.container;
    let index5 = item.index;
    let result = item.result;
    let $ = resolve2(st, container);
    if ($ instanceof Var) {
      return new Ok([st, false]);
    } else if ($ instanceof Tuple2) {
      let elements = $.elements;
      let $1 = list_at(elements, index5);
      if ($1 instanceof Ok) {
        let element4 = $1[0];
        return try$(unify(st, element4, result), (st2) => {
          return new Ok([st2, true]);
        });
      } else {
        return new Error(new TupleIndexOutOfRange(index5));
      }
    } else {
      return new Error(Error$NotATuple$const);
    }
  }
}
function resolve_pending_loop(env, st, pending, fuel) {
  let $ = fuel <= 0;
  if (pending instanceof Empty) {
    return new Ok(st);
  } else if ($) {
    return new Error(Error$NotARecord$const);
  } else {
    return try$(try_fold(pending, [st, List$Empty$const, false], (acc, item) => {
      let st$1 = acc[0];
      let remaining = acc[1];
      let progressed = acc[2];
      return try$(resolve_one(env, st$1, item), (_use0) => {
        let st$2 = _use0[0];
        let resolved = _use0[1];
        if (resolved) {
          return new Ok([st$2, remaining, true]);
        } else {
          return new Ok([st$2, prepend(item, remaining), progressed]);
        }
      });
    }), (_use0) => {
      let st$1 = _use0[0];
      let remaining = _use0[1];
      let progressed = _use0[2];
      if (progressed) {
        return resolve_pending_loop(env, st$1, reverse2(remaining), fuel - 1);
      } else {
        return new Error(Error$NotARecord$const);
      }
    });
  }
}
function resolve_pending(env, st) {
  let pending = reverse2(st.pending);
  return resolve_pending_loop(env, new State(st.next_id, st.subst, st.annotations, st.references, List$Empty$const, st.rigid), pending, length(pending));
}
function hydrate(env, st, ast) {
  return hydrate_with(env, make(), st, ast)[0];
}
function span2(expr) {
  if (expr instanceof Int2) {
    let s = expr.location;
    return s;
  } else if (expr instanceof Float2) {
    let s = expr.location;
    return s;
  } else if (expr instanceof String3) {
    let s = expr.location;
    return s;
  } else if (expr instanceof Variable) {
    let s = expr.location;
    return s;
  } else if (expr instanceof NegateInt) {
    let s = expr.location;
    return s;
  } else if (expr instanceof NegateBool) {
    let s = expr.location;
    return s;
  } else if (expr instanceof Block) {
    let s = expr.location;
    return s;
  } else if (expr instanceof Panic2) {
    let s = expr.location;
    return s;
  } else if (expr instanceof Todo2) {
    let s = expr.location;
    return s;
  } else if (expr instanceof Tuple) {
    let s = expr.location;
    return s;
  } else if (expr instanceof List2) {
    let s = expr.location;
    return s;
  } else if (expr instanceof Fn2) {
    let s = expr.location;
    return s;
  } else if (expr instanceof RecordUpdate) {
    let s = expr.location;
    return s;
  } else if (expr instanceof FieldAccess) {
    let s = expr.location;
    return s;
  } else if (expr instanceof Call) {
    let s = expr.location;
    return s;
  } else if (expr instanceof TupleIndex) {
    let s = expr.location;
    return s;
  } else if (expr instanceof FnCapture) {
    let s = expr.location;
    return s;
  } else if (expr instanceof BitString) {
    let s = expr.location;
    return s;
  } else if (expr instanceof Case2) {
    let s = expr.location;
    return s;
  } else if (expr instanceof BinaryOperator) {
    let s = expr.location;
    return s;
  } else {
    let s = expr.location;
    return s;
  }
}
function record(st, span3, type_3) {
  return new State(st.next_id, st.subst, prepend([span3, type_3], st.annotations), st.references, st.pending, st.rigid);
}
function prelude_bit_array() {
  return new Named2(prelude_module, "BitArray", List$Empty$const, Option$None$const);
}
function prelude_int() {
  return new Named2(prelude_module, "Int", List$Empty$const, Option$None$const);
}
function prelude_nil() {
  return new Named2(prelude_module, "Nil", List$Empty$const, Option$None$const);
}
function prelude_bool() {
  return new Named2(prelude_module, "Bool", List$Empty$const, Option$None$const);
}
function reference(st, spans, resolved) {
  return new State(st.next_id, st.subst, st.annotations, prepend(new Reference(spans, resolved), st.references), st.pending, st.rigid);
}
function is_upper(name2) {
  let $ = first2(name2);
  if ($ instanceof Ok) {
    let c = $[0];
    return uppercase(c) === c && lowercase(c) !== c;
  } else {
    return false;
  }
}
function subject_of(loop$expr) {
  while (true) {
    let expr = loop$expr;
    if (expr instanceof Variable) {
      let name2 = expr.name;
      let $ = is_upper(name2);
      if ($) {
        return Option$None$const;
      } else {
        return new Some(name2);
      }
    } else if (expr instanceof Echo2) {
      let $ = expr.expression;
      if ($ instanceof Some) {
        let inner = $[0];
        loop$expr = inner;
      } else {
        return Option$None$const;
      }
    } else {
      return Option$None$const;
    }
  }
}
function subject_variable(subject, bound) {
  let $ = subject_of(subject);
  if ($ instanceof Some) {
    let name2 = $[0];
    let $1 = contains(bound, name2);
    if ($1) {
      return Option$None$const;
    } else {
      return new Some(name2);
    }
  } else {
    return $;
  }
}
function check_bit_array_size(loop$env, loop$st, loop$size) {
  while (true) {
    let env = loop$env;
    let st = loop$st;
    let size3 = loop$size;
    if (size3 instanceof BitArraySizeInt) {
      return new Ok(st);
    } else if (size3 instanceof BitArraySizeVariable) {
      let name2 = size3.name;
      let $ = lookup2(env, name2);
      if ($ instanceof Ok) {
        let scheme = $[0];
        let $1 = instantiate(st, scheme);
        let t = $1[0];
        let st$1 = $1[1];
        return unify(st$1, t, prelude_int());
      } else {
        return new Error(new UnboundVariable(name2));
      }
    } else if (size3 instanceof BitArraySizeBinaryOperator) {
      let left = size3.left;
      let right = size3.right;
      return try$(check_bit_array_size(env, st, left), (st2) => {
        return check_bit_array_size(env, st2, right);
      });
    } else {
      let inner = size3.inner;
      loop$env = env;
      loop$st = st;
      loop$size = inner;
    }
  }
}
function with_env(env, st) {
  return map4(st, (st2) => {
    return [env, st2];
  });
}
function prelude_utf_codepoint() {
  return new Named2(prelude_module, "UtfCodepoint", List$Empty$const, Option$None$const);
}
function prelude_string() {
  return new Named2(prelude_module, "String", List$Empty$const, Option$None$const);
}
function prelude_float() {
  return new Named2(prelude_module, "Float", List$Empty$const, Option$None$const);
}
function segment_value_type(options, default$) {
  return fold2(options, default$, (acc, option) => {
    if (option instanceof BytesOption) {
      return prelude_bit_array();
    } else if (option instanceof IntOption) {
      return prelude_int();
    } else if (option instanceof FloatOption) {
      return prelude_float();
    } else if (option instanceof BitsOption) {
      return prelude_bit_array();
    } else if (option instanceof Utf8Option) {
      return prelude_string();
    } else if (option instanceof Utf16Option) {
      return prelude_string();
    } else if (option instanceof Utf32Option) {
      return prelude_string();
    } else if (option instanceof Utf8CodepointOption) {
      return prelude_utf_codepoint();
    } else if (option instanceof Utf16CodepointOption) {
      return prelude_utf_codepoint();
    } else if (option instanceof Utf32CodepointOption) {
      return prelude_utf_codepoint();
    } else {
      return acc;
    }
  });
}
function field_map(variant) {
  if (variant instanceof LocalValue) {
    return Option$None$const;
  } else if (variant instanceof FunctionValue) {
    let field_map$1 = variant.field_map;
    return field_map$1;
  } else if (variant instanceof ConstantValue) {
    return Option$None$const;
  } else {
    let field_map$1 = variant.field_map;
    return field_map$1;
  }
}
function positional_labels(variant) {
  return unwrap(field_map(variant), List$Empty$const);
}
function indices_loop(i, acc) {
  return guard(i < 0, acc, () => {
    return indices_loop(i - 1, prepend(i, acc));
  });
}
function indices(n) {
  return indices_loop(n - 1, List$Empty$const);
}
function label_index(index_of, label) {
  let $ = get(index_of, label);
  if ($ instanceof Ok) {
    return $;
  } else {
    return new Error(new UnknownLabel(label));
  }
}
function label_indices(labels) {
  return index_fold(labels, make(), (acc, label, index5) => {
    if (label instanceof Some) {
      let name2 = label[0];
      return insert(acc, name2, index5);
    } else {
      return acc;
    }
  });
}
function order_pattern_args(labels, arguments$, arity) {
  let index_of = label_indices(labels);
  return try$(try_fold(arguments$, make(), (placed, field3) => {
    if (field3 instanceof LabelledField) {
      let label = field3.label;
      let item = field3.item;
      return try$(label_index(index_of, label), (index5) => {
        return new Ok(insert(placed, index5, item));
      });
    } else if (field3 instanceof ShorthandField) {
      let label = field3.label;
      let location = field3.location;
      return try$(label_index(index_of, label), (index5) => {
        return new Ok(insert(placed, index5, new PatternVariable(location, label)));
      });
    } else {
      return new Ok(placed);
    }
  }), (labelled) => {
    let positional = filter_map(arguments$, (field3) => {
      if (field3 instanceof UnlabelledField) {
        let item = field3.item;
        return new Ok(item);
      } else {
        return new Error(undefined);
      }
    });
    let free = filter(indices(arity), (i) => {
      return !has(labelled, i);
    });
    let placed = fold2(zip(free, positional), labelled, (placed2, pair) => {
      return insert(placed2, pair[0], pair[1]);
    });
    return new Ok(map2(indices(arity), (index5) => {
      let $ = get(placed, index5);
      if ($ instanceof Ok) {
        let pattern2 = $[0];
        return pattern2;
      } else {
        return new PatternDiscard(new Span(0, 0), "_");
      }
    }));
  });
}
function stamp(st, type_3, variant) {
  let $ = resolve2(st, type_3);
  if ($ instanceof Named2) {
    let module2 = $.module;
    let name2 = $.name;
    let args = $.arguments;
    return new Named2(module2, name2, args, new Some(variant));
  } else {
    return $;
  }
}
function narrow(env, st, name2, variant) {
  let $ = get(env.values, name2);
  if ($ instanceof Ok) {
    let value3 = $[0].variant;
    let vars = $[0].scheme.vars;
    let type_3 = $[0].scheme.type_;
    let $1 = stamp(st, type_3, variant);
    if ($1 instanceof Named2) {
      let stamped = $1;
      return install(env, name2, new Scheme(vars, stamped), value3);
    } else {
      return env;
    }
  } else {
    return env;
  }
}
function variant_of(type_3) {
  if (type_3 instanceof Named2) {
    let variant = type_3.variant;
    return variant;
  } else {
    return Option$None$const;
  }
}
function constructor_entry(env, module2, constructor) {
  if (module2 instanceof Some) {
    let alias = module2[0];
    let $ = get(env.modules, alias);
    if ($ instanceof Ok) {
      let interface$ = $[0];
      let _pipe = get(interface$.values, constructor);
      return replace_error(_pipe, new NoSuchExport(alias, constructor));
    } else {
      return new Error(new UnknownModule(alias));
    }
  } else {
    let _pipe = get(env.values, constructor);
    return replace_error(_pipe, new UnknownConstructor(constructor));
  }
}
function bind_local(env, name2, scheme) {
  return install(env, name2, scheme, new LocalValue(name2));
}
function prelude_list(element4) {
  return new Named2(prelude_module, "List", prepend(element4, List$Empty$const), Option$None$const);
}
function tuple_elements(st, expected, arity) {
  let _block;
  let $ = resolve2(st, expected);
  if ($ instanceof Tuple2) {
    let elements = $.elements;
    let $1 = length(elements) === arity;
    if ($1) {
      _block = new Ok(elements);
    } else {
      _block = new Error(undefined);
    }
  } else {
    _block = new Error(undefined);
  }
  let destructured = _block;
  if (destructured instanceof Ok) {
    let elements = destructured[0];
    return new Ok([elements, st]);
  } else {
    let $1 = fresh_n(st, arity);
    let elem_types = $1[0];
    let st$1 = $1[1];
    return try$(unify(st$1, expected, new Tuple2(elem_types)), (st2) => {
      return new Ok([elem_types, st2]);
    });
  }
}
function typed(env, type_3, st) {
  return map4(st, (st2) => {
    return [env, type_3, st2];
  });
}
function infer_bit_pattern_segment(env, st, segment) {
  let pattern2 = segment[0];
  let options = segment[1];
  let _block;
  if (pattern2 instanceof PatternFloat) {
    _block = prelude_float();
  } else if (pattern2 instanceof PatternString) {
    _block = prelude_string();
  } else {
    _block = prelude_int();
  }
  let default$ = _block;
  return try$(infer_pattern(env, st, pattern2, segment_value_type(options, default$), Option$None$const), (_use0) => {
    let env$1 = _use0[0];
    let st$1 = _use0[2];
    return try_fold(options, [env$1, st$1], (acc, option) => {
      let env$2 = acc[0];
      let st$2 = acc[1];
      if (option instanceof SizeValueOption) {
        let size3 = option[0];
        return with_env(env$2, check_bit_array_size(env$2, st$2, size3));
      } else {
        return new Ok([env$2, st$2]);
      }
    });
  });
}
function infer_pattern(env, st, pattern2, expected, subject) {
  if (pattern2 instanceof PatternInt) {
    return typed(env, prelude_int(), unify(st, expected, prelude_int()));
  } else if (pattern2 instanceof PatternFloat) {
    return typed(env, prelude_float(), unify(st, expected, prelude_float()));
  } else if (pattern2 instanceof PatternString) {
    return typed(env, prelude_string(), unify(st, expected, prelude_string()));
  } else if (pattern2 instanceof PatternDiscard) {
    return new Ok([env, expected, st]);
  } else if (pattern2 instanceof PatternVariable) {
    let name2 = pattern2.name;
    return new Ok([
      bind_local(env, name2, new Scheme(List$Empty$const, expected)),
      expected,
      st
    ]);
  } else if (pattern2 instanceof PatternTuple) {
    let elements = pattern2.elements;
    return try$(tuple_elements(st, expected, length(elements)), (_use0) => {
      let elem_types = _use0[0];
      let st$1 = _use0[1];
      return try$(try_fold(zip(elements, elem_types), [env, List$Empty$const, st$1], (acc, pair) => {
        let env$1 = acc[0];
        let types_ = acc[1];
        let st$2 = acc[2];
        let pattern$1 = pair[0];
        let t = pair[1];
        return map4(infer_pattern(env$1, st$2, pattern$1, t, Option$None$const), (_use02) => {
          let env$2 = _use02[0];
          let t$1 = _use02[1];
          let st$3 = _use02[2];
          return [env$2, prepend(t$1, types_), st$3];
        });
      }), (_use02) => {
        let env$1 = _use02[0];
        let rev_types = _use02[1];
        let st$2 = _use02[2];
        return new Ok([env$1, new Tuple2(reverse2(rev_types)), st$2]);
      });
    });
  } else if (pattern2 instanceof PatternList) {
    let elements = pattern2.elements;
    let tail = pattern2.tail;
    let $ = fresh(st);
    let elem = $[0];
    let st$1 = $[1];
    return try$(unify(st$1, expected, prelude_list(elem)), (st2) => {
      return try$(try_fold(elements, [env, st2], (acc, p2) => {
        let env$1 = acc[0];
        let st$2 = acc[1];
        return map4(infer_pattern(env$1, st$2, p2, elem, Option$None$const), (_use0) => {
          let env$2 = _use0[0];
          let st$3 = _use0[2];
          return [env$2, st$3];
        });
      }), (_use0) => {
        let env$1 = _use0[0];
        let st$2 = _use0[1];
        return try$((() => {
          if (tail instanceof Some) {
            let t = tail[0];
            return map4(infer_pattern(env$1, st$2, t, prelude_list(elem), Option$None$const), (_use02) => {
              let env$2 = _use02[0];
              let st$3 = _use02[2];
              return [env$2, st$3];
            });
          } else {
            return new Ok([env$1, st$2]);
          }
        })(), (_use02) => {
          let env$2 = _use02[0];
          let st$3 = _use02[1];
          return new Ok([env$2, prelude_list(elem), st$3]);
        });
      });
    });
  } else if (pattern2 instanceof PatternAssignment) {
    let pattern$1 = pattern2.pattern;
    let name2 = pattern2.name;
    return try$(infer_pattern(env, st, pattern$1, expected, subject), (_use0) => {
      let env$1 = _use0[0];
      let type_3 = _use0[1];
      let st$1 = _use0[2];
      return new Ok([
        bind_local(env$1, name2, new Scheme(List$Empty$const, type_3)),
        type_3,
        st$1
      ]);
    });
  } else if (pattern2 instanceof PatternConcatenate) {
    let prefix_name = pattern2.prefix_name;
    let rest_name = pattern2.rest_name;
    return try$(unify(st, expected, prelude_string()), (st2) => {
      let bind_name = (env2, name2) => {
        if (name2 instanceof Named) {
          let n = name2[0];
          return bind_local(env2, n, new Scheme(List$Empty$const, prelude_string()));
        } else {
          return env2;
        }
      };
      let _block;
      if (prefix_name instanceof Some) {
        let name2 = prefix_name[0];
        _block = bind_name(env, name2);
      } else {
        _block = env;
      }
      let env$1 = _block;
      return new Ok([bind_name(env$1, rest_name), prelude_string(), st2]);
    });
  } else if (pattern2 instanceof PatternBitString) {
    let segments = pattern2.segments;
    return try$(unify(st, expected, prelude_bit_array()), (st2) => {
      return try$(try_fold(segments, [env, st2], (acc, segment) => {
        let env$1 = acc[0];
        let st$1 = acc[1];
        return infer_bit_pattern_segment(env$1, st$1, segment);
      }), (_use0) => {
        let env$1 = _use0[0];
        let st$1 = _use0[1];
        return new Ok([env$1, prelude_bit_array(), st$1]);
      });
    });
  } else {
    let module2 = pattern2.module;
    let constructor = pattern2.constructor$;
    let arguments$ = pattern2.arguments;
    return try$(constructor_entry(env, module2, constructor), (entry) => {
      let $ = instantiate(st, entry.scheme);
      let ctor_type = $[0];
      let st$1 = $[1];
      let _block;
      if (ctor_type instanceof Fn3) {
        let args = ctor_type.arguments;
        let ret2 = ctor_type.return;
        _block = [args, ret2];
      } else {
        let other = ctor_type;
        _block = [List$Empty$const, other];
      }
      let $1 = _block;
      let field_types = $1[0];
      let ret = $1[1];
      return try$(unify(st$1, expected, ret), (st2) => {
        let _block$1;
        let $2 = variant_of(ret);
        if (subject instanceof Some && $2 instanceof Some) {
          let name2 = subject[0];
          let index5 = $2[0];
          _block$1 = narrow(env, st2, name2, index5);
        } else {
          _block$1 = env;
        }
        let env$1 = _block$1;
        return try$(order_pattern_args(positional_labels(entry.variant), arguments$, length(field_types)), (arg_patterns) => {
          return try$(try_fold(zip(arg_patterns, field_types), [env$1, st2], (acc, pair) => {
            let env$2 = acc[0];
            let st$2 = acc[1];
            let pattern$1 = pair[0];
            let t = pair[1];
            return map4(infer_pattern(env$2, st$2, pattern$1, t, Option$None$const), (_use0) => {
              let env$3 = _use0[0];
              let st$3 = _use0[2];
              return [env$3, st$3];
            });
          }), (_use0) => {
            let env$2 = _use0[0];
            let st$2 = _use0[1];
            return new Ok([env$2, ret, st$2]);
          });
        });
      });
    });
  }
}
function generalize_over(st, env, type_3, candidate_ids) {
  let zonked = zonk(st, type_3);
  let env_vars = env_free_vars(st, env);
  let free = free_vars(st, zonked);
  let reps = filter_map(candidate_ids, (id) => {
    let $ = zonk(st, new Var(id));
    if ($ instanceof Var) {
      let rep = $.id;
      return new Ok(rep);
    } else {
      return new Error(undefined);
    }
  });
  let quantified = unique(filter(reps, (id) => {
    return contains(free, id) && !contains(env_vars, id);
  }));
  return new Scheme(quantified, zonked);
}
function type_var_names(ast) {
  if (ast instanceof NamedType) {
    let parameters = ast.parameters;
    return flat_map(parameters, type_var_names);
  } else if (ast instanceof TupleType) {
    let elements = ast.elements;
    return flat_map(elements, type_var_names);
  } else if (ast instanceof FunctionType) {
    let parameters = ast.parameters;
    let return$ = ast.return;
    return append(flat_map(parameters, type_var_names), type_var_names(return$));
  } else if (ast instanceof VariableType) {
    let name2 = ast.name;
    return prepend(name2, List$Empty$const);
  } else {
    return List$Empty$const;
  }
}
function fn_annotation_var_names(params, return_annotation) {
  let from_params = flat_map(params, (p2) => {
    let $ = p2.type_;
    if ($ instanceof Some) {
      let t = $[0];
      return type_var_names(t);
    } else {
      return List$Empty$const;
    }
  });
  if (return_annotation instanceof Some) {
    let t = return_annotation[0];
    return append(from_params, type_var_names(t));
  } else {
    return from_params;
  }
}
function annotation_var_names(st, params, return_annotation) {
  return fold2(unique(fn_annotation_var_names(params, return_annotation)), [make(), List$Empty$const, st], (acc, nm) => {
    let names = acc[0];
    let ids = acc[1];
    let st$1 = acc[2];
    let $ = fresh_id(st$1);
    let id = $[0];
    let st$2 = $[1];
    return [
      insert(names, nm, new Var(id)),
      prepend(id, ids),
      st$2
    ];
  });
}
function expected_fn(st, expected, arity) {
  let $ = resolve2(st, expected);
  if ($ instanceof Fn3) {
    let params = $.arguments;
    let return$ = $.return;
    let $1 = length(params) === arity;
    if ($1) {
      return new Ok([params, return$]);
    } else {
      return new Error(undefined);
    }
  } else {
    return new Error(undefined);
  }
}
function call_return(st, callee, hole) {
  let $ = resolve2(st, callee);
  if ($ instanceof Fn3) {
    let return$ = $.return;
    return return$;
  } else {
    return hole;
  }
}
function reorder(fields, labels, shorthand) {
  let index_of = label_indices(labels);
  return try$(try_fold(fields, make(), (placed, field3) => {
    if (field3 instanceof LabelledField) {
      let label = field3.label;
      let item = field3.item;
      return try$(label_index(index_of, label), (index5) => {
        return new Ok(insert(placed, index5, item));
      });
    } else if (field3 instanceof ShorthandField) {
      let label = field3.label;
      let location = field3.location;
      return try$(label_index(index_of, label), (index5) => {
        return new Ok(insert(placed, index5, shorthand(label, location)));
      });
    } else {
      return new Ok(placed);
    }
  }), (labelled) => {
    let positional = filter_map(fields, (field3) => {
      if (field3 instanceof UnlabelledField) {
        let item = field3.item;
        return new Ok(item);
      } else {
        return new Error(undefined);
      }
    });
    let free = filter(indices(length(labels)), (i) => {
      return !has(labelled, i);
    });
    let placed = fold2(zip(free, positional), labelled, (placed2, pair) => {
      return insert(placed2, pair[0], pair[1]);
    });
    return try_map(indices(length(labels)), (index5) => {
      let $ = get(placed, index5);
      if ($ instanceof Ok) {
        return $;
      } else {
        return new Error(Error$MissingArgument$const);
      }
    });
  });
}
function is_unlabelled(field3) {
  if (field3 instanceof UnlabelledField) {
    return true;
  } else {
    return false;
  }
}
function order_fields(labels, fields, shorthand) {
  return lazy_guard(all(fields, is_unlabelled), () => {
    return new Ok(filter_map(fields, (field3) => {
      if (field3 instanceof UnlabelledField) {
        let item = field3.item;
        return new Ok(item);
      } else {
        return new Error(undefined);
      }
    }));
  }, () => {
    if (labels instanceof Some) {
      let labels$1 = labels[0];
      return reorder(fields, labels$1, shorthand);
    } else {
      return new Error(Error$AmbiguousCall$const);
    }
  });
}
function place_arguments(st, fn_type2, labels, slots, wrap, check_slot) {
  return try$(order_fields(labels, slots, (label, location) => {
    return wrap(new Variable(location, label));
  }), (ordered) => {
    let $ = fresh_n(st, length(ordered));
    let holes = $[0];
    let st$1 = $[1];
    let $1 = fresh(st$1);
    let result = $1[0];
    let st$2 = $1[1];
    return try$(unify(st$2, fn_type2, new Fn3(holes, result)), (st2) => {
      return try$(try_fold(zip(ordered, holes), st2, (st3, pair) => {
        return check_slot(st3, pair[0], pair[1]);
      }), (st3) => {
        return new Ok([call_return(st3, fn_type2, result), st3]);
      });
    });
  });
}
function map_field(field3, wrap) {
  if (field3 instanceof LabelledField) {
    let label = field3.label;
    let location = field3.label_location;
    let item = field3.item;
    return new LabelledField(label, location, wrap(item));
  } else if (field3 instanceof ShorthandField) {
    return field3;
  } else {
    let item = field3.item;
    return new UnlabelledField(wrap(item));
  }
}
function instantiate_in(env, st, name2, scheme) {
  let $ = contains2(env.live, name2);
  if ($) {
    return instantiate(st, new Scheme(scheme.vars, zonk(st, scheme.type_)));
  } else {
    return instantiate(st, scheme);
  }
}
function record_access(st, spans, label, access) {
  if (access instanceof Field) {
    let record$1 = access.record;
    return reference(st, spans, new ResolvedField(record$1, label));
  } else if (access instanceof Export) {
    let variant = access.variant;
    return reference(st, spans, new ResolvedValue(variant));
  } else {
    return reference(st, spans, Resolved$ResolvedDeferred$const);
  }
}
function pending_field(st, container_type, label) {
  let $ = fresh(st);
  let field3 = $[0];
  let st$1 = $[1];
  let st$2 = new State(st$1.next_id, st$1.subst, st$1.annotations, st$1.references, prepend(new PendingField(container_type, label, field3), st$1.pending), st$1.rigid);
  return new Ok([field3, Access$Deferred$const, st$2]);
}
function field_type(env, st, record2, label) {
  return try$(accessor(env, resolve2(st, record2), label), (accessor_scheme) => {
    let $ = instantiate(st, accessor_scheme);
    let accessor_type = $[0];
    let st$1 = $[1];
    let $1 = fresh(st$1);
    let field3 = $1[0];
    let st$2 = $1[1];
    return try$(unify(st$2, accessor_type, new Fn3(prepend(record2, List$Empty$const), field3)), (st2) => {
      return new Ok([field3, st2]);
    });
  });
}
function module_export(st, entry) {
  let $ = instantiate(st, entry.scheme);
  let type_3 = $[0];
  let st$1 = $[1];
  return new Ok([type_3, new Export(entry.variant), st$1]);
}
function module_access(env, name2, label) {
  let $ = get(env.modules, name2);
  if ($ instanceof Ok) {
    let interface$ = $[0];
    return from_result(get(interface$.values, label));
  } else {
    return Option$None$const;
  }
}
function access_spans(access, container, label) {
  return new Spans(access, new Span(access.end - byte_size(label), access.end), span2(container));
}
function erase_binding(st, env, name2) {
  let $ = get(env.values, name2);
  if ($ instanceof Ok) {
    let variant = $[0].variant;
    let vars = $[0].scheme.vars;
    let type_3 = $[0].scheme.type_;
    return install(env, name2, new Scheme(vars, erase_variant(resolve2(st, type_3))), variant);
  } else {
    return env;
  }
}
function bound_variant(st, env, name2) {
  let $ = lookup2(env, name2);
  if ($ instanceof Ok) {
    let scheme = $[0];
    return variant_of(resolve2(st, scheme.type_));
  } else {
    return Option$None$const;
  }
}
function agree_bindings(st, envs, names) {
  return fold2(names, envs, (envs2, name2) => {
    let $ = unique(map2(envs2, (_capture) => {
      return bound_variant(st, _capture, name2);
    }));
    if ($ instanceof Empty) {
      return envs2;
    } else if ($.tail instanceof Empty) {
      return envs2;
    } else {
      return map2(envs2, (_capture) => {
        return erase_binding(st, _capture, name2);
      });
    }
  });
}
function agree_subjects(st, envs, names) {
  return fold2(names, envs, (envs2, name2) => {
    let variants2 = map2(envs2, (_capture) => {
      return bound_variant(st, _capture, name2);
    });
    let _block;
    if (variants2 instanceof Empty) {
      _block = Option$None$const;
    } else {
      let first3 = variants2.head;
      let rest = variants2.tail;
      let $ = any(rest, (v) => {
        return !(v instanceof None) && !isEqual(v, first3);
      });
      if ($) {
        _block = Option$None$const;
      } else {
        _block = first3;
      }
    }
    let agreed = _block;
    return map2(envs2, (env) => {
      if (agreed instanceof Some) {
        let index5 = agreed[0];
        return narrow(env, st, name2, index5);
      } else {
        return erase_binding(st, env, name2);
      }
    });
  });
}
function bind_alternative(env, st, patterns, subjects, subject_types) {
  let bound = flat_map(patterns, pattern_names);
  return try_fold(zip(patterns, zip(subjects, subject_types)), [env, st], (acc, pair) => {
    let env$1 = acc[0];
    let st$1 = acc[1];
    let pattern2;
    let subject;
    let subject_type;
    pattern2 = pair[0];
    subject = pair[1][0];
    subject_type = pair[1][1];
    return map4(infer_pattern(env$1, st$1, pattern2, subject_type, subject_variable(subject, bound)), (_use0) => {
      let env$2 = _use0[0];
      let st$2 = _use0[2];
      return [env$2, st$2];
    });
  });
}
function field_item(field3) {
  if (field3 instanceof LabelledField) {
    let item = field3.item;
    return item;
  } else if (field3 instanceof ShorthandField) {
    let label = field3.label;
    let location = field3.location;
    return new Variable(location, label);
  } else {
    let item = field3.item;
    return item;
  }
}
function infer_expr_assignment(env, st, pattern2, annotation, value3) {
  return try$(infer_expr(env, st, value3), (_use0) => {
    let value_type = _use0[0];
    let st$1 = _use0[1];
    return try$((() => {
      if (annotation instanceof Some) {
        let ann = annotation[0];
        let $ = hydrate(env, st$1, ann);
        let t = $[0];
        let st$2 = $[1];
        return unify(st$2, value_type, t);
      } else {
        return new Ok(st$1);
      }
    })(), (st2) => {
      return try$(infer_pattern(env, st2, pattern2, value_type, subject_variable(value3, pattern_names(pattern2))), (_use02) => {
        let env$1 = _use02[0];
        let st$2 = _use02[2];
        return new Ok([value_type, env$1, st$2]);
      });
    });
  });
}
function infer_statement(env, st, statement2) {
  if (statement2 instanceof Use2) {
    return new Error(new Unsupported("use in non-tail position"));
  } else if (statement2 instanceof Assignment) {
    let $ = statement2.annotation;
    if ($ instanceof None) {
      let $1 = statement2.pattern;
      if ($1 instanceof PatternVariable) {
        let $2 = statement2.value;
        if ($2 instanceof Fn2) {
          let pattern2 = $1;
          let value3 = $2;
          let name2 = $1.name;
          let fspan = $2.location;
          let fparams = $2.arguments;
          let freturn = $2.return_annotation;
          let fbody = $2.body;
          let $3 = fn_annotation_var_names(fparams, freturn);
          if ($3 instanceof Empty) {
            return infer_expr_assignment(env, st, pattern2, Option$None$const, value3);
          } else {
            let $4 = annotation_var_names(st, fparams, freturn);
            let names = $4[0];
            let ann_ids = $4[1];
            let st$1 = $4[2];
            let $5 = fresh_n(st$1, length(fparams));
            let seeds = $5[0];
            let st$2 = $5[1];
            return try$(infer_lambda(env, st$2, fparams, freturn, fbody, seeds, Option$None$const, names), (_use0) => {
              let value_type = _use0[0];
              let st$3 = _use0[1];
              let st$4 = record(st$3, fspan, value_type);
              let scheme = generalize_over(st$4, env, value_type, ann_ids);
              return new Ok([value_type, bind_local(env, name2, scheme), st$4]);
            });
          }
        } else {
          let pattern2 = $1;
          let annotation = $;
          let value3 = $2;
          return infer_expr_assignment(env, st, pattern2, annotation, value3);
        }
      } else {
        let pattern2 = $1;
        let annotation = $;
        let value3 = statement2.value;
        return infer_expr_assignment(env, st, pattern2, annotation, value3);
      }
    } else {
      let pattern2 = statement2.pattern;
      let annotation = $;
      let value3 = statement2.value;
      return infer_expr_assignment(env, st, pattern2, annotation, value3);
    }
  } else if (statement2 instanceof Assert2) {
    let expression2 = statement2.expression;
    return try$(check(env, st, expression2, prelude_bool()), (st2) => {
      return new Ok([prelude_nil(), env, st2]);
    });
  } else {
    let expr = statement2[0];
    return try$(infer_expr(env, st, expr), (_use0) => {
      let t = _use0[0];
      let st$1 = _use0[1];
      return new Ok([t, env, st$1]);
    });
  }
}
function check_callback(env, st, use_patterns, rest, expected) {
  let _block;
  let $1 = expected_fn(st, expected, length(use_patterns));
  if ($1 instanceof Ok) {
    let params = $1[0][0];
    _block = [params, st];
  } else {
    _block = fresh_n(st, length(use_patterns));
  }
  let $ = _block;
  let seeds = $[0];
  let st$1 = $[1];
  return try$(try_fold(zip(use_patterns, seeds), [env, st$1], (acc, pair) => {
    let env$1 = acc[0];
    let st$2 = acc[1];
    let use_pattern2 = pair[0];
    let seed = pair[1];
    return try$((() => {
      let $2 = use_pattern2.annotation;
      if ($2 instanceof Some) {
        let ann = $2[0];
        let $3 = hydrate(env$1, st$2, ann);
        let annotated = $3[0];
        let st$3 = $3[1];
        return unify(st$3, annotated, seed);
      } else {
        return new Ok(st$2);
      }
    })(), (st2) => {
      return try$(infer_pattern(env$1, st2, use_pattern2.pattern, seed, Option$None$const), (_use0) => {
        let env$2 = _use0[0];
        let st$3 = _use0[2];
        return new Ok([env$2, st$3]);
      });
    });
  }), (_use0) => {
    let callback_env = _use0[0];
    let st$2 = _use0[1];
    return try$(infer_statements(callback_env, st$2, rest), (_use02) => {
      let body_type = _use02[0];
      let st$3 = _use02[1];
      return unify(st$3, new Fn3(seeds, body_type), expected);
    });
  });
}
function module_or_record(env, st, container, label, export$) {
  if (export$ instanceof Some) {
    let export$1 = export$[0];
    return module_export(st, export$1);
  } else {
    return try$(infer_expr(env, st, container), (_use0) => {
      let container_type = _use0[0];
      let st$1 = _use0[1];
      let $ = resolve2(st$1, container_type);
      if ($ instanceof Named2) {
        let record$1 = $;
        return try$(field_type(env, st$1, record$1, label), (_use02) => {
          let field3 = _use02[0];
          let st$2 = _use02[1];
          return new Ok([field3, new Field(record$1), st$2]);
        });
      } else if ($ instanceof Var) {
        return pending_field(st$1, container_type, label);
      } else {
        return new Error(Error$NotARecord$const);
      }
    });
  }
}
function value_field(env, st, container, label, export$) {
  return try$(infer_expr(env, st, container), (_use0) => {
    let container_type = _use0[0];
    let st$1 = _use0[1];
    let $ = resolve2(st$1, container_type);
    if ($ instanceof Named2) {
      let record$1 = $;
      let $1 = accessor(env, record$1, label);
      if ($1 instanceof Ok) {
        return try$(field_type(env, st$1, record$1, label), (_use02) => {
          let field3 = _use02[0];
          let st$2 = _use02[1];
          return new Ok([field3, new Field(record$1), st$2]);
        });
      } else {
        let field_error = $1[0];
        if (export$ instanceof Some) {
          let export$1 = export$[0];
          return module_export(st$1, export$1);
        } else {
          return new Error(field_error);
        }
      }
    } else if ($ instanceof Var) {
      if (export$ instanceof Some) {
        let export$1 = export$[0];
        return module_export(st$1, export$1);
      } else {
        return pending_field(st$1, container_type, label);
      }
    } else {
      if (export$ instanceof Some) {
        let export$1 = export$[0];
        return module_export(st$1, export$1);
      } else {
        return new Error(Error$NotARecord$const);
      }
    }
  });
}
function infer_field_access(env, st, access, container, label) {
  let spans = access_spans(access, container, label);
  return try$((() => {
    if (container instanceof Variable) {
      let name2 = container.name;
      let export$ = module_access(env, name2, label);
      let $ = has(env.values, name2);
      if ($) {
        return value_field(env, st, container, label, export$);
      } else {
        return module_or_record(env, st, container, label, export$);
      }
    } else {
      return module_or_record(env, st, container, label, Option$None$const);
    }
  })(), (_use0) => {
    let type_3 = _use0[0];
    let branch = _use0[1];
    let st$1 = _use0[2];
    return new Ok([type_3, branch, record_access(st$1, spans, label, branch)]);
  });
}
function infer_callee(env, st, function$) {
  if (function$ instanceof Variable) {
    let name_span = function$.location;
    let name2 = function$.name;
    let $ = get(env.values, name2);
    if ($ instanceof Ok) {
      let entry = $[0];
      let $1 = instantiate_in(env, st, name2, entry.scheme);
      let type_3 = $1[0];
      let st$1 = $1[1];
      let st$2 = record(st$1, name_span, type_3);
      let spans = new Spans(name_span, name_span, name_span);
      return new Ok([
        type_3,
        field_map(entry.variant),
        reference(st$2, spans, new ResolvedValue(entry.variant))
      ]);
    } else {
      return new Error(new UnboundVariable(name2));
    }
  } else if (function$ instanceof FieldAccess) {
    let access_span = function$.location;
    let container = function$.container;
    let label = function$.label;
    return try$(infer_field_access(env, st, access_span, container, label), (_use0) => {
      let type_3 = _use0[0];
      let access = _use0[1];
      let st$1 = _use0[2];
      let _block;
      if (access instanceof Field) {
        _block = Option$None$const;
      } else if (access instanceof Export) {
        let variant = access.variant;
        _block = field_map(variant);
      } else {
        _block = Option$None$const;
      }
      let labels = _block;
      return new Ok([type_3, labels, record(st$1, span2(function$), type_3)]);
    });
  } else {
    return try$(infer_expr(env, st, function$), (_use0) => {
      let type_3 = _use0[0];
      let st$1 = _use0[1];
      return new Ok([type_3, Option$None$const, st$1]);
    });
  }
}
function infer_use(env, st, use_patterns, function$, rest) {
  let _block;
  if (function$ instanceof Call) {
    let callee2 = function$.function;
    let arguments$2 = function$.arguments;
    _block = [callee2, arguments$2];
  } else {
    let other = function$;
    _block = [other, List$Empty$const];
  }
  let $ = _block;
  let callee = $[0];
  let arguments$ = $[1];
  return try$(infer_callee(env, st, callee), (_use0) => {
    let callee_type = _use0[0];
    let labels = _use0[1];
    let st$1 = _use0[2];
    let slots = append(map2(arguments$, (_capture) => {
      return map_field(_capture, (var0) => {
        return new Argument(var0);
      });
    }), prepend(new UnlabelledField(CallSlot$Implicit$const), List$Empty$const));
    return place_arguments(st$1, callee_type, labels, slots, (var0) => {
      return new Argument(var0);
    }, (st2, slot2, hole) => {
      if (slot2 instanceof Argument) {
        let expression2 = slot2.expression;
        return check(env, st2, expression2, hole);
      } else {
        return check_callback(env, st2, use_patterns, rest, hole);
      }
    });
  });
}
function infer_statements(env, st, statements2) {
  if (statements2 instanceof Empty) {
    return new Ok([prelude_nil(), st]);
  } else {
    let $ = statements2.head;
    if ($ instanceof Use2) {
      let rest = statements2.tail;
      let patterns = $.patterns;
      let function$ = $.function;
      return infer_use(env, st, patterns, function$, rest);
    } else {
      let $1 = statements2.tail;
      if ($1 instanceof Empty) {
        let last2 = $;
        return try$(infer_statement(env, st, last2), (_use0) => {
          let t = _use0[0];
          let st$1 = _use0[2];
          return new Ok([t, st$1]);
        });
      } else {
        let first3 = $;
        let rest = $1;
        return try$(infer_statement(env, st, first3), (_use0) => {
          let env$1 = _use0[1];
          let st$1 = _use0[2];
          return infer_statements(env$1, st$1, rest);
        });
      }
    }
  }
}
function infer_lambda(env, st, params, return_annotation, body, seed_params, expected_return, names) {
  return try$(try_fold(zip(params, seed_params), [List$Empty$const, env, st], (acc, pair) => {
    let types_ = acc[0];
    let env$1 = acc[1];
    let st$1 = acc[2];
    let param = pair[0];
    let seed = pair[1];
    return try$((() => {
      let $ = param.type_;
      if ($ instanceof Some) {
        let ann = $[0];
        let $1 = hydrate_in(env$1, names, st$1, ann);
        let annotated = $1[0];
        let st$2 = $1[1];
        return try$(unify(st$2, annotated, seed), (st2) => {
          return new Ok([seed, st2]);
        });
      } else {
        return new Ok([seed, st$1]);
      }
    })(), (_use0) => {
      let t = _use0[0];
      let st$2 = _use0[1];
      let _block;
      let $ = param.name;
      if ($ instanceof Named) {
        let name2 = $[0];
        _block = bind_local(env$1, name2, new Scheme(List$Empty$const, t));
      } else {
        _block = env$1;
      }
      let env$2 = _block;
      return new Ok([prepend(t, types_), env$2, st$2]);
    });
  }), (_use0) => {
    let rev_param_types = _use0[0];
    let body_env = _use0[1];
    let st$1 = _use0[2];
    let param_types = reverse2(rev_param_types);
    return try$(infer_statements(body_env, st$1, body), (_use02) => {
      let body_type = _use02[0];
      let st$2 = _use02[1];
      return try$((() => {
        if (return_annotation instanceof Some) {
          let ann = return_annotation[0];
          let $ = hydrate_in(env, names, st$2, ann);
          let t = $[0];
          let st$3 = $[1];
          return unify(st$3, body_type, t);
        } else {
          return new Ok(st$2);
        }
      })(), (st2) => {
        return try$((() => {
          if (expected_return instanceof Some) {
            let expected = expected_return[0];
            return unify(st2, body_type, expected);
          } else {
            return new Ok(st2);
          }
        })(), (st3) => {
          return new Ok([new Fn3(param_types, body_type), st3]);
        });
      });
    });
  });
}
function infer_seeded_lambda(env, st, span3, params, return_annotation, body, seeds, expected_return) {
  let $ = annotation_var_names(st, params, return_annotation);
  let names = $[0];
  let st$1 = $[2];
  return try$(infer_lambda(env, st$1, params, return_annotation, body, seeds, expected_return, names), (_use0) => {
    let fn_type2 = _use0[0];
    let st$2 = _use0[1];
    return new Ok([fn_type2, record(st$2, span3, fn_type2)]);
  });
}
function check(env, st, expr, expected) {
  let _block;
  if (expr instanceof Fn2) {
    let params = expr.arguments;
    _block = expected_fn(st, expected, length(params));
  } else {
    _block = new Error(undefined);
  }
  let seeded = _block;
  if (seeded instanceof Ok && expr instanceof Fn2) {
    let seeds = seeded[0][0];
    let ret = seeded[0][1];
    let span$1 = expr.location;
    let params = expr.arguments;
    let return_annotation = expr.return_annotation;
    let body = expr.body;
    return try$(infer_seeded_lambda(env, st, span$1, params, return_annotation, body, seeds, new Some(ret)), (_use0) => {
      let fn_type2 = _use0[0];
      let st$1 = _use0[1];
      return unify(st$1, fn_type2, expected);
    });
  } else {
    return try$(infer_expr(env, st, expr), (_use0) => {
      let t = _use0[0];
      let st$1 = _use0[1];
      return unify(st$1, t, expected);
    });
  }
}
function infer_bit_segment(env, st, segment) {
  let value3 = segment[0];
  let options = segment[1];
  let _block;
  if (value3 instanceof Float2) {
    _block = prelude_float();
  } else if (value3 instanceof String3) {
    _block = prelude_string();
  } else {
    _block = prelude_int();
  }
  let default$ = _block;
  return try$(check(env, st, value3, segment_value_type(options, default$)), (st2) => {
    return try_fold(options, st2, (st3, option) => {
      if (option instanceof SizeValueOption) {
        let size3 = option[0];
        return check(env, st3, size3, prelude_int());
      } else {
        return new Ok(st3);
      }
    });
  });
}
function update_field(env, st, field3, label_types, type_name) {
  return try$((() => {
    let $ = field3.item;
    if ($ instanceof Some) {
      let value3 = $[0];
      return infer_expr(env, st, value3);
    } else {
      let $1 = lookup2(env, field3.label);
      if ($1 instanceof Ok) {
        let scheme = $1[0];
        return new Ok(instantiate(st, scheme));
      } else {
        return new Error(new UnboundVariable(field3.label));
      }
    }
  })(), (_use0) => {
    let value_type = _use0[0];
    let st$1 = _use0[1];
    let $ = get(label_types, field3.label);
    if ($ instanceof Ok) {
      let expected = $[0];
      return unify(st$1, value_type, expected);
    } else {
      return new Error(new NoSuchField(type_name, field3.label));
    }
  });
}
function infer_record_update(env, st, module2, constructor, record2, fields) {
  return try$(constructor_entry(env, module2, constructor), (entry) => {
    let $ = instantiate(st, entry.scheme);
    let ctor_type = $[0];
    let st$1 = $[1];
    let _block;
    if (ctor_type instanceof Fn3) {
      let arguments$ = ctor_type.arguments;
      let return$ = ctor_type.return;
      _block = [arguments$, return$];
    } else {
      let other = ctor_type;
      _block = [List$Empty$const, other];
    }
    let $1 = _block;
    let field_types = $1[0];
    let return_type = $1[1];
    if (return_type instanceof Named2) {
      let type_module = return_type.module;
      let type_name = return_type.name;
      let type_parameters = return_type.arguments;
      let variant = return_type.variant;
      let labels = positional_labels(entry.variant);
      let label_types = fold2(zip(labels, field_types), make(), (acc, pair) => {
        let $22 = pair[0];
        if ($22 instanceof Some) {
          let label = $22[0];
          return insert(acc, label, pair[1]);
        } else {
          return acc;
        }
      });
      let updated = map2(fields, (field3) => {
        return field3.label;
      });
      let $2 = fresh_n(st$1, length(type_parameters));
      let record_parameters = $2[0];
      let st$2 = $2[1];
      return try$(infer_expr(env, st$2, record2), (_use0) => {
        let record_type = _use0[0];
        let st$3 = _use0[1];
        return try$(unify(st$3, record_type, new Named2(type_module, type_name, record_parameters, variant)), (st2) => {
          return try$(try_fold(fields, st2, (st3, field3) => {
            return update_field(env, st3, field3, label_types, type_name);
          }), (st3) => {
            let to_record_params = from_list(zip(filter_map(type_parameters, var_id), record_parameters));
            return try$(try_fold(to_list(label_types), st3, (st4, pair) => {
              let label = pair[0];
              let expected = pair[1];
              let $3 = contains(updated, label);
              if ($3) {
                return new Ok(st4);
              } else {
                return unify(st4, substitute(to_record_params, expected), expected);
              }
            }), (st4) => {
              return new Ok([return_type, st4]);
            });
          });
        });
      });
    } else {
      return new Error(Error$NotARecord$const);
    }
  });
}
function infer_clause(env, st, clause, subjects, subject_types, result) {
  return try$(try_fold(clause.patterns, [List$Empty$const, st], (acc, patterns) => {
    let envs = acc[0];
    let st$1 = acc[1];
    return try$(bind_alternative(env, st$1, patterns, subjects, subject_types), (_use0) => {
      let clause_env = _use0[0];
      let st$2 = _use0[1];
      return new Ok([prepend(clause_env, envs), st$2]);
    });
  }), (_use0) => {
    let rev_envs = _use0[0];
    let st$1 = _use0[1];
    let _block;
    if (rev_envs instanceof Empty) {
      _block = reverse2(rev_envs);
    } else if (rev_envs.tail instanceof Empty) {
      _block = reverse2(rev_envs);
    } else {
      let _block$1;
      let $ = clause.patterns;
      if ($ instanceof Empty) {
        _block$1 = $;
      } else {
        let first3 = $.head;
        _block$1 = flat_map(first3, pattern_names);
      }
      let bound = _block$1;
      let subjects$1 = values(map2(subjects, (_capture) => {
        return subject_variable(_capture, bound);
      }));
      let envs2 = agree_subjects(st$1, reverse2(rev_envs), subjects$1);
      _block = agree_bindings(st$1, envs2, bound);
    }
    let envs = _block;
    return try_fold(envs, st$1, (st2, clause_env) => {
      return try$((() => {
        let $ = clause.guard;
        if ($ instanceof Some) {
          let guard2 = $[0];
          return check(clause_env, st2, guard2, prelude_bool());
        } else {
          return new Ok(st2);
        }
      })(), (st3) => {
        return try$(infer_expr(clause_env, st3, clause.body), (_use02) => {
          let body_type = _use02[0];
          let st$2 = _use02[1];
          return unify(st$2, body_type, result);
        });
      });
    });
  });
}
function infer_each(env, st, exprs) {
  return try$(try_fold(exprs, [List$Empty$const, st], (acc, e) => {
    let types_ = acc[0];
    let st$1 = acc[1];
    return try$(infer_expr(env, st$1, e), (_use0) => {
      let t = _use0[0];
      let st$2 = _use0[1];
      return new Ok([prepend(t, types_), st$2]);
    });
  }), (_use0) => {
    let rev = _use0[0];
    let st$1 = _use0[1];
    return new Ok([reverse2(rev), st$1]);
  });
}
function infer_case(env, st, subjects, clauses) {
  return try$(infer_each(env, st, subjects), (_use0) => {
    let subject_types = _use0[0];
    let st$1 = _use0[1];
    let $ = fresh(st$1);
    let result = $[0];
    let st$2 = $[1];
    return try$(try_fold(clauses, st$2, (st2, clause) => {
      return infer_clause(env, st2, clause, subjects, subject_types, result);
    }), (st2) => {
      return new Ok([result, st2]);
    });
  });
}
function speculate(env, st, arguments$) {
  let $ = infer_each(env, st, arguments$);
  if ($ instanceof Ok) {
    let types_ = $[0][0];
    let spent = $[0][1];
    return [
      types_,
      new State(spent.next_id, spent.subst, st.annotations, st.references, st.pending, spent.rigid)
    ];
  } else {
    return fresh_n(st, length(arguments$));
  }
}
function infer_applied_lambda(env, st, span3, params, return_annotation, body, arguments$) {
  let $ = speculate(env, st, map2(arguments$, field_item));
  let seeds = $[0];
  let st$1 = $[1];
  return try$(infer_seeded_lambda(env, st$1, span3, params, return_annotation, body, seeds, Option$None$const), (_use0) => {
    let fn_type2 = _use0[0];
    let st$2 = _use0[1];
    return new Ok([fn_type2, Option$None$const, st$2]);
  });
}
function infer_call(env, st, span3, function$, arguments$) {
  return try$((() => {
    if (function$ instanceof Fn2) {
      let fn_span = function$.location;
      let params = function$.arguments;
      let return_annotation = function$.return_annotation;
      let body = function$.body;
      let $ = length(params) === length(arguments$);
      if ($) {
        return infer_applied_lambda(env, st, fn_span, params, return_annotation, body, arguments$);
      } else {
        return infer_callee(env, st, function$);
      }
    } else {
      return infer_callee(env, st, function$);
    }
  })(), (_use0) => {
    let fn_type2 = _use0[0];
    let labels = _use0[1];
    let st$1 = _use0[2];
    return try$(place_arguments(st$1, fn_type2, labels, arguments$, (expression2) => {
      return expression2;
    }, (st2, argument, hole) => {
      return check(env, st2, argument, hole);
    }), (_use02) => {
      let return$ = _use02[0];
      let st$2 = _use02[1];
      return new Ok([return$, record(st$2, span3, return$)]);
    });
  });
}
function infer_pipe(env, st, span3, left, right) {
  if (right instanceof Call) {
    let call_span = right.location;
    let function$ = right.function;
    let arguments$ = right.arguments;
    return try$(infer_expr(env, st, function$), (_use0) => {
      let ft = _use0[0];
      let probe = _use0[1];
      let _block;
      let $ = resolve2(probe, ft);
      if ($ instanceof Fn3) {
        let params = $.arguments;
        _block = length(params) === length(arguments$);
      } else {
        _block = false;
      }
      let saturated = _block;
      if (saturated) {
        return try$(infer_call(env, st, call_span, function$, arguments$), (_use02) => {
          let call_type = _use02[0];
          let st$1 = _use02[1];
          return try$(infer_expr(env, st$1, left), (_use03) => {
            let lt = _use03[0];
            let st$2 = _use03[1];
            let $1 = fresh(st$2);
            let result = $1[0];
            let st$3 = $1[1];
            return try$(unify(st$3, call_type, new Fn3(prepend(lt, List$Empty$const), result)), (st2) => {
              let return$ = call_return(st2, call_type, result);
              return new Ok([return$, record(st2, span3, return$)]);
            });
          });
        });
      } else {
        return infer_call(env, st, call_span, function$, prepend(new UnlabelledField(left), arguments$));
      }
    });
  } else {
    return try$(infer_expr(env, st, left), (_use0) => {
      let lt = _use0[0];
      let st$1 = _use0[1];
      let $ = fresh(st$1);
      let result = $[0];
      let st$2 = $[1];
      let piped = new Fn3(prepend(lt, List$Empty$const), result);
      return try$((() => {
        if (right instanceof Fn2) {
          return check(env, st$2, right, piped);
        } else {
          return try$(infer_callee(env, st$2, right), (_use02) => {
            let ft = _use02[0];
            let st$3 = _use02[2];
            return unify(st$3, ft, piped);
          });
        }
      })(), (st2) => {
        return new Ok([result, record(st2, span3, result)]);
      });
    });
  }
}
function infer_binop(env, st, span3, op, left, right) {
  if (op instanceof And) {
    return try$(check(env, st, left, prelude_bool()), (st2) => {
      return try$(check(env, st2, right, prelude_bool()), (st3) => {
        return new Ok([prelude_bool(), st3]);
      });
    });
  } else if (op instanceof Or) {
    return try$(check(env, st, left, prelude_bool()), (st2) => {
      return try$(check(env, st2, right, prelude_bool()), (st3) => {
        return new Ok([prelude_bool(), st3]);
      });
    });
  } else if (op instanceof Eq2) {
    return try$(infer_expr(env, st, left), (_use0) => {
      let lt = _use0[0];
      let st$1 = _use0[1];
      return try$(infer_expr(env, st$1, right), (_use02) => {
        let rt = _use02[0];
        let st$2 = _use02[1];
        return try$(unify(st$2, lt, rt), (st2) => {
          return new Ok([prelude_bool(), st2]);
        });
      });
    });
  } else if (op instanceof NotEq) {
    return try$(infer_expr(env, st, left), (_use0) => {
      let lt = _use0[0];
      let st$1 = _use0[1];
      return try$(infer_expr(env, st$1, right), (_use02) => {
        let rt = _use02[0];
        let st$2 = _use02[1];
        return try$(unify(st$2, lt, rt), (st2) => {
          return new Ok([prelude_bool(), st2]);
        });
      });
    });
  } else if (op instanceof LtInt) {
    return try$(check(env, st, left, prelude_int()), (st2) => {
      return try$(check(env, st2, right, prelude_int()), (st3) => {
        return new Ok([prelude_bool(), st3]);
      });
    });
  } else if (op instanceof LtEqInt) {
    return try$(check(env, st, left, prelude_int()), (st2) => {
      return try$(check(env, st2, right, prelude_int()), (st3) => {
        return new Ok([prelude_bool(), st3]);
      });
    });
  } else if (op instanceof LtFloat) {
    return try$(check(env, st, left, prelude_float()), (st2) => {
      return try$(check(env, st2, right, prelude_float()), (st3) => {
        return new Ok([prelude_bool(), st3]);
      });
    });
  } else if (op instanceof LtEqFloat) {
    return try$(check(env, st, left, prelude_float()), (st2) => {
      return try$(check(env, st2, right, prelude_float()), (st3) => {
        return new Ok([prelude_bool(), st3]);
      });
    });
  } else if (op instanceof GtEqInt) {
    return try$(check(env, st, left, prelude_int()), (st2) => {
      return try$(check(env, st2, right, prelude_int()), (st3) => {
        return new Ok([prelude_bool(), st3]);
      });
    });
  } else if (op instanceof GtInt) {
    return try$(check(env, st, left, prelude_int()), (st2) => {
      return try$(check(env, st2, right, prelude_int()), (st3) => {
        return new Ok([prelude_bool(), st3]);
      });
    });
  } else if (op instanceof GtEqFloat) {
    return try$(check(env, st, left, prelude_float()), (st2) => {
      return try$(check(env, st2, right, prelude_float()), (st3) => {
        return new Ok([prelude_bool(), st3]);
      });
    });
  } else if (op instanceof GtFloat) {
    return try$(check(env, st, left, prelude_float()), (st2) => {
      return try$(check(env, st2, right, prelude_float()), (st3) => {
        return new Ok([prelude_bool(), st3]);
      });
    });
  } else if (op instanceof Pipe2) {
    return infer_pipe(env, st, span3, left, right);
  } else if (op instanceof AddInt) {
    return try$(check(env, st, left, prelude_int()), (st2) => {
      return try$(check(env, st2, right, prelude_int()), (st3) => {
        return new Ok([prelude_int(), st3]);
      });
    });
  } else if (op instanceof AddFloat) {
    return try$(check(env, st, left, prelude_float()), (st2) => {
      return try$(check(env, st2, right, prelude_float()), (st3) => {
        return new Ok([prelude_float(), st3]);
      });
    });
  } else if (op instanceof SubInt) {
    return try$(check(env, st, left, prelude_int()), (st2) => {
      return try$(check(env, st2, right, prelude_int()), (st3) => {
        return new Ok([prelude_int(), st3]);
      });
    });
  } else if (op instanceof SubFloat) {
    return try$(check(env, st, left, prelude_float()), (st2) => {
      return try$(check(env, st2, right, prelude_float()), (st3) => {
        return new Ok([prelude_float(), st3]);
      });
    });
  } else if (op instanceof MultInt) {
    return try$(check(env, st, left, prelude_int()), (st2) => {
      return try$(check(env, st2, right, prelude_int()), (st3) => {
        return new Ok([prelude_int(), st3]);
      });
    });
  } else if (op instanceof MultFloat) {
    return try$(check(env, st, left, prelude_float()), (st2) => {
      return try$(check(env, st2, right, prelude_float()), (st3) => {
        return new Ok([prelude_float(), st3]);
      });
    });
  } else if (op instanceof DivInt) {
    return try$(check(env, st, left, prelude_int()), (st2) => {
      return try$(check(env, st2, right, prelude_int()), (st3) => {
        return new Ok([prelude_int(), st3]);
      });
    });
  } else if (op instanceof DivFloat) {
    return try$(check(env, st, left, prelude_float()), (st2) => {
      return try$(check(env, st2, right, prelude_float()), (st3) => {
        return new Ok([prelude_float(), st3]);
      });
    });
  } else if (op instanceof RemainderInt) {
    return try$(check(env, st, left, prelude_int()), (st2) => {
      return try$(check(env, st2, right, prelude_int()), (st3) => {
        return new Ok([prelude_int(), st3]);
      });
    });
  } else {
    return try$(check(env, st, left, prelude_string()), (st2) => {
      return try$(check(env, st2, right, prelude_string()), (st3) => {
        return new Ok([prelude_string(), st3]);
      });
    });
  }
}
function infer_capture(env, st, span3, label, function$, before, after) {
  return try$(infer_callee(env, st, function$), (_use0) => {
    let fn_type2 = _use0[0];
    let labels = _use0[1];
    let st$1 = _use0[2];
    let $ = fresh(st$1);
    let hole = $[0];
    let st$2 = $[1];
    let _block;
    if (label instanceof Some) {
      let name2 = label[0];
      _block = new LabelledField(name2, span3, CallSlot$Implicit$const);
    } else {
      _block = new UnlabelledField(CallSlot$Implicit$const);
    }
    let hole_field = _block;
    let slots = flatten(prepend(map2(before, (_capture) => {
      return map_field(_capture, (var0) => {
        return new Argument(var0);
      });
    }), prepend(prepend(hole_field, List$Empty$const), prepend(map2(after, (_capture) => {
      return map_field(_capture, (var0) => {
        return new Argument(var0);
      });
    }), List$Empty$const))));
    return try$(place_arguments(st$2, fn_type2, labels, slots, (var0) => {
      return new Argument(var0);
    }, (st2, slot2, slot_type) => {
      if (slot2 instanceof Argument) {
        let expression2 = slot2.expression;
        return check(env, st2, expression2, slot_type);
      } else {
        return unify(st2, hole, slot_type);
      }
    }), (_use02) => {
      let return$ = _use02[0];
      let st$3 = _use02[1];
      let captured = new Fn3(prepend(hole, List$Empty$const), return$);
      return new Ok([captured, record(st$3, span3, captured)]);
    });
  });
}
function infer_fn(env, st, params, return_annotation, body) {
  let $ = annotation_var_names(st, params, return_annotation);
  let names = $[0];
  let st$1 = $[2];
  let $1 = fresh_n(st$1, length(params));
  let seeds = $1[0];
  let st$2 = $1[1];
  return infer_lambda(env, st$2, params, return_annotation, body, seeds, Option$None$const, names);
}
function infer_expr_inner(env, st, expr) {
  if (expr instanceof Int2) {
    return new Ok([prelude_int(), st]);
  } else if (expr instanceof Float2) {
    return new Ok([prelude_float(), st]);
  } else if (expr instanceof String3) {
    return new Ok([prelude_string(), st]);
  } else if (expr instanceof Variable) {
    let name2 = expr.name;
    let $ = lookup2(env, name2);
    if ($ instanceof Ok) {
      let scheme = $[0];
      return new Ok(instantiate_in(env, st, name2, scheme));
    } else {
      return new Error(new UnboundVariable(name2));
    }
  } else if (expr instanceof NegateInt) {
    let value3 = expr.value;
    return try$(infer_expr(env, st, value3), (_use0) => {
      let t = _use0[0];
      let st$1 = _use0[1];
      return try$(unify(st$1, t, prelude_int()), (st2) => {
        return new Ok([prelude_int(), st2]);
      });
    });
  } else if (expr instanceof NegateBool) {
    let value3 = expr.value;
    return try$(infer_expr(env, st, value3), (_use0) => {
      let t = _use0[0];
      let st$1 = _use0[1];
      return try$(unify(st$1, t, prelude_bool()), (st2) => {
        return new Ok([prelude_bool(), st2]);
      });
    });
  } else if (expr instanceof Block) {
    let statements2 = expr.statements;
    return infer_statements(env, st, statements2);
  } else if (expr instanceof Panic2) {
    let message2 = expr.message;
    if (message2 instanceof Some) {
      let m = message2[0];
      return try$(check(env, st, m, prelude_string()), (st2) => {
        return new Ok(fresh(st2));
      });
    } else {
      return new Ok(fresh(st));
    }
  } else if (expr instanceof Todo2) {
    let message2 = expr.message;
    if (message2 instanceof Some) {
      let m = message2[0];
      return try$(check(env, st, m, prelude_string()), (st2) => {
        return new Ok(fresh(st2));
      });
    } else {
      return new Ok(fresh(st));
    }
  } else if (expr instanceof Tuple) {
    let elements = expr.elements;
    return try$(infer_each(env, st, elements), (_use0) => {
      let elem_types = _use0[0];
      let st$1 = _use0[1];
      return new Ok([new Tuple2(elem_types), st$1]);
    });
  } else if (expr instanceof List2) {
    let elements = expr.elements;
    let rest = expr.rest;
    let $ = fresh(st);
    let elem = $[0];
    let st$1 = $[1];
    return try$(try_fold(elements, st$1, (st2, e) => {
      return try$(infer_expr(env, st2, e), (_use0) => {
        let t = _use0[0];
        let st$2 = _use0[1];
        return unify(st$2, t, elem);
      });
    }), (st2) => {
      return try$((() => {
        if (rest instanceof Some) {
          let r = rest[0];
          return try$(infer_expr(env, st2, r), (_use0) => {
            let t = _use0[0];
            let st$2 = _use0[1];
            return unify(st$2, t, prelude_list(elem));
          });
        } else {
          return new Ok(st2);
        }
      })(), (st3) => {
        return new Ok([prelude_list(elem), st3]);
      });
    });
  } else if (expr instanceof Fn2) {
    let params = expr.arguments;
    let return_annotation = expr.return_annotation;
    let body = expr.body;
    return infer_fn(env, st, params, return_annotation, body);
  } else if (expr instanceof RecordUpdate) {
    let module2 = expr.module;
    let constructor = expr.constructor$;
    let record$1 = expr.record;
    let fields = expr.fields;
    return infer_record_update(env, st, module2, constructor, record$1, fields);
  } else if (expr instanceof FieldAccess) {
    let access = expr.location;
    let container = expr.container;
    let label = expr.label;
    return try$(infer_field_access(env, st, access, container, label), (_use0) => {
      let type_3 = _use0[0];
      let st$1 = _use0[2];
      return new Ok([type_3, st$1]);
    });
  } else if (expr instanceof Call) {
    let span$1 = expr.location;
    let function$ = expr.function;
    let arguments$ = expr.arguments;
    return infer_call(env, st, span$1, function$, arguments$);
  } else if (expr instanceof TupleIndex) {
    let tuple = expr.tuple;
    let index5 = expr.index;
    return try$(infer_expr(env, st, tuple), (_use0) => {
      let t = _use0[0];
      let st$1 = _use0[1];
      let $ = resolve2(st$1, t);
      if ($ instanceof Var) {
        let $1 = fresh(st$1);
        let element4 = $1[0];
        let st$2 = $1[1];
        let st$3 = new State(st$2.next_id, st$2.subst, st$2.annotations, st$2.references, prepend(new PendingIndex(t, index5, element4), st$2.pending), st$2.rigid);
        return new Ok([element4, st$3]);
      } else if ($ instanceof Tuple2) {
        let elements = $.elements;
        let $1 = list_at(elements, index5);
        if ($1 instanceof Ok) {
          let element4 = $1[0];
          return new Ok([element4, st$1]);
        } else {
          return new Error(new TupleIndexOutOfRange(index5));
        }
      } else {
        return new Error(Error$NotATuple$const);
      }
    });
  } else if (expr instanceof FnCapture) {
    let span$1 = expr.location;
    let label = expr.label;
    let function$ = expr.function;
    let before = expr.arguments_before;
    let after = expr.arguments_after;
    return infer_capture(env, st, span$1, label, function$, before, after);
  } else if (expr instanceof BitString) {
    let segments = expr.segments;
    return try$(try_fold(segments, st, (st2, segment) => {
      return infer_bit_segment(env, st2, segment);
    }), (st2) => {
      return new Ok([prelude_bit_array(), st2]);
    });
  } else if (expr instanceof Case2) {
    let subjects = expr.subjects;
    let clauses = expr.clauses;
    return infer_case(env, st, subjects, clauses);
  } else if (expr instanceof BinaryOperator) {
    let span$1 = expr.location;
    let op = expr.name;
    let left = expr.left;
    let right = expr.right;
    return infer_binop(env, st, span$1, op, left, right);
  } else {
    let expression2 = expr.expression;
    if (expression2 instanceof Some) {
      let e = expression2[0];
      return infer_expr(env, st, e);
    } else {
      return new Ok([prelude_nil(), st]);
    }
  }
}
function infer_expr(env, st, expr) {
  return try$(infer_expr_inner(env, st, expr), (_use0) => {
    let type_3 = _use0[0];
    let st$1 = _use0[1];
    return new Ok([type_3, record(st$1, span2(expr), type_3)]);
  });
}
function infer_constant(env, st, constant) {
  return try$(infer_expr(env, st, constant.value), (_use0) => {
    let value_type = _use0[0];
    let st$1 = _use0[1];
    let $ = constant.annotation;
    if ($ instanceof Some) {
      let ann = $[0];
      let $1 = hydrate(env, st$1, ann);
      let t = $1[0];
      let st$2 = $1[1];
      return try$(unify(st$2, value_type, t), (st2) => {
        return new Ok([value_type, st2]);
      });
    } else {
      return new Ok([value_type, st$1]);
    }
  });
}
function hydrate_threaded(env, names, st, ast) {
  let $ = hydrate_with(env, names, st, ast);
  let t;
  let st$1;
  let names$1;
  names$1 = $[1];
  t = $[0][0];
  st$1 = $[0][1];
  return [t, st$1, names$1];
}
function infer_function(env, st, function$) {
  let $ = fold2(function$.parameters, [List$Empty$const, env, st, make()], (acc, param) => {
    let types_ = acc[0];
    let env$1 = acc[1];
    let st$12 = acc[2];
    let names2 = acc[3];
    let _block;
    let $2 = param.type_;
    if ($2 instanceof Some) {
      let ann = $2[0];
      _block = hydrate_threaded(env$1, names2, st$12, ann);
    } else {
      let $32 = fresh(st$12);
      let t2 = $32[0];
      let st$22 = $32[1];
      _block = [t2, st$22, names2];
    }
    let $12 = _block;
    let t = $12[0];
    let st$2 = $12[1];
    let names$1 = $12[2];
    let _block$1;
    let $3 = param.name;
    if ($3 instanceof Named) {
      let name2 = $3[0];
      _block$1 = bind_local(env$1, name2, new Scheme(List$Empty$const, t));
    } else {
      _block$1 = env$1;
    }
    let env$2 = _block$1;
    return [prepend(t, types_), env$2, st$2, names$1];
  });
  let rev_param_types = $[0];
  let body_env = $[1];
  let st$1 = $[2];
  let names = $[3];
  let param_types = reverse2(rev_param_types);
  let $1 = function$.body;
  if ($1 instanceof Empty) {
    let _block;
    let $3 = function$.return;
    if ($3 instanceof Some) {
      let ann = $3[0];
      let $4 = hydrate_threaded(env, names, st$1, ann);
      let t = $4[0];
      let st$22 = $4[1];
      _block = [t, st$22];
    } else {
      _block = fresh(st$1);
    }
    let $2 = _block;
    let return_type = $2[0];
    let st$2 = $2[1];
    return new Ok([new Fn3(param_types, return_type), st$2]);
  } else {
    return try$(infer_statements(body_env, st$1, function$.body), (_use0) => {
      let body_type = _use0[0];
      let st$2 = _use0[1];
      return try$((() => {
        let $2 = function$.return;
        if ($2 instanceof Some) {
          let ann = $2[0];
          let $3 = hydrate_threaded(env, names, st$2, ann);
          let t = $3[0];
          let st$3 = $3[1];
          return unify(st$3, body_type, t);
        } else {
          return new Ok(st$2);
        }
      })(), (st2) => {
        return new Ok([new Fn3(param_types, body_type), st2]);
      });
    });
  }
}
function infer_def(env, st, def) {
  if (def instanceof FunctionDef) {
    let f = def[0];
    return infer_function(env, st, f);
  } else {
    let c = def[0];
    return infer_constant(env, st, c);
  }
}
function check_body(env, st, function$, return_type) {
  let $ = function$.body;
  if ($ instanceof Empty) {
    return new Ok(st);
  } else {
    return try$(infer_statements(env, st, function$.body), (_use0) => {
      let body_type = _use0[0];
      let st$1 = _use0[1];
      return unify(st$1, body_type, return_type);
    });
  }
}
function rigid_self_scheme(param_types, return_type) {
  return new Scheme(List$Empty$const, new Fn3(param_types, return_type));
}
function bind_params(env, function$, param_types) {
  return fold2(zip(function$.parameters, param_types), env, (env2, pair) => {
    let param = pair[0];
    let t = pair[1];
    let $ = param.name;
    if ($ instanceof Named) {
      let name2 = $[0];
      return bind_local(env2, name2, new Scheme(List$Empty$const, t));
    } else {
      return env2;
    }
  });
}
function mark_live(env, names) {
  return new Env(env.values, env.open_values, env.aliases, env.imported_aliases, env.accessors, env.local_types, env.current_module, env.modules, env.module_index, from_list2(names));
}
function rigid_scheme(rigid_ids, param_types, return_type) {
  return new Scheme(rigid_ids, new Fn3(param_types, return_type));
}
function mark_rigid(st, ids) {
  return new State(st.next_id, st.subst, st.annotations, st.references, st.pending, fold2(ids, st.rigid, insert3));
}
function function_annotation_var_names(function$) {
  let from_params = flat_map(function$.parameters, (p2) => {
    let $2 = p2.type_;
    if ($2 instanceof Some) {
      let t = $2[0];
      return type_var_names(t);
    } else {
      return List$Empty$const;
    }
  });
  let $ = function$.return;
  if ($ instanceof Some) {
    let t = $[0];
    return append(from_params, type_var_names(t));
  } else {
    return from_params;
  }
}
function signature_skeleton(env, st, function$) {
  let $ = fold2(unique(function_annotation_var_names(function$)), [make(), List$Empty$const, st], (acc, name2) => {
    let names2 = acc[0];
    let ids = acc[1];
    let st$12 = acc[2];
    let $12 = fresh_id(st$12);
    let id = $12[0];
    let st$22 = $12[1];
    return [
      insert(names2, name2, new Var(id)),
      prepend(id, ids),
      st$22
    ];
  });
  let names = $[0];
  let rigid_ids = $[1];
  let st$1 = $[2];
  let st$2 = mark_rigid(st$1, rigid_ids);
  let $1 = fold2(function$.parameters, [List$Empty$const, st$2], (acc, param) => {
    let types_ = acc[0];
    let st$32 = acc[1];
    let _block2;
    let $32 = param.type_;
    if ($32 instanceof Some) {
      let ann = $32[0];
      _block2 = hydrate_in(env, names, st$32, ann);
    } else {
      _block2 = fresh(st$32);
    }
    let $22 = _block2;
    let t = $22[0];
    let st$42 = $22[1];
    return [prepend(t, types_), st$42];
  });
  let rev_param_types = $1[0];
  let st$3 = $1[1];
  let _block;
  let $3 = function$.return;
  if ($3 instanceof Some) {
    let ann = $3[0];
    _block = hydrate_in(env, names, st$3, ann);
  } else {
    _block = fresh(st$3);
  }
  let $2 = _block;
  let return_type = $2[0];
  let st$4 = $2[1];
  return [reverse2(rev_param_types), return_type, rigid_ids, st$4];
}
function fresh_var(st) {
  return fresh(st);
}
function placeholder2(env, items, st, def) {
  let $ = fresh_var(st);
  let var$ = $[0];
  let st$1 = $[1];
  return [
    define_def(env, def, new Scheme(List$Empty$const, var$)),
    prepend(new PlaceholderDef(def, var$), items),
    st$1
  ];
}
function has_annotation_vars(function$) {
  return !(function_annotation_var_names(function$) instanceof Empty);
}
function prereg_def(env, items, st, def) {
  let _block;
  if (def instanceof FunctionDef) {
    let f = def[0];
    let $ = has_annotation_vars(f);
    if ($) {
      _block = new Ok(f);
    } else {
      _block = new Error(undefined);
    }
  } else {
    _block = new Error(undefined);
  }
  let annotated = _block;
  if (annotated instanceof Ok) {
    let f = annotated[0];
    let $ = signature_skeleton(env, st, f);
    let params = $[0];
    let return_type = $[1];
    let rigid_ids = $[2];
    let st$1 = $[3];
    return [
      define_def(env, def, rigid_scheme(rigid_ids, params, return_type)),
      prepend(new AnnotatedDef(def, f, params, return_type), items),
      st$1
    ];
  } else {
    return placeholder2(env, items, st, def);
  }
}
function infer_group(env, st, group3) {
  let $ = fold2(group3, [env, List$Empty$const, st], (acc, def) => {
    let env$1 = acc[0];
    let items2 = acc[1];
    let st$12 = acc[2];
    return prereg_def(env$1, items2, st$12, def);
  });
  let group_env = $[0];
  let rev_items = $[1];
  let st$1 = $[2];
  let group_env$1 = mark_live(group_env, map2(group3, def_name));
  let items = reverse2(rev_items);
  let $1 = partition(items, (item) => {
    if (item instanceof AnnotatedDef) {
      let f = item.function;
      return f.return instanceof None || any(f.parameters, (p2) => {
        return p2.type_ instanceof None;
      });
    } else {
      return false;
    }
  });
  let providers = $1[0];
  let consumers = $1[1];
  return try$(try_fold(append(providers, consumers), st$1, (st2, item) => {
    if (item instanceof AnnotatedDef) {
      let def = item.def;
      let f = item.function;
      let params = item.params;
      let return_type = item.return_type;
      let body_env = bind_params(define_def(group_env$1, def, rigid_self_scheme(params, return_type)), f, params);
      return check_body(body_env, st2, f, return_type);
    } else {
      let def = item.def;
      let var$ = item.var;
      return try$(infer_def(group_env$1, st2, def), (_use0) => {
        let inferred = _use0[0];
        let st$2 = _use0[1];
        return unify(st$2, var$, inferred);
      });
    }
  }), (st2) => {
    return try$(resolve_pending(group_env$1, st2), (st3) => {
      let env$1 = fold2(items, env, (env2, item) => {
        if (item instanceof AnnotatedDef) {
          let def = item.def;
          let params = item.params;
          let return_type = item.return_type;
          return define_def(env2, def, function_scheme(env2, st3, params, return_type));
        } else {
          let def = item.def;
          let var$ = item.var;
          return define_def(env2, def, generalize(st3, env2, var$));
        }
      });
      return new Ok([env$1, st3]);
    });
  });
}
function best_effort_group(acc, group3) {
  let env;
  let st;
  let skipped;
  skipped = acc[1];
  env = acc[0][0];
  st = acc[0][1];
  let $ = infer_group(env, st, group3);
  if ($ instanceof Ok) {
    let env_st = $[0];
    return [env_st, skipped];
  } else {
    let error = $[0];
    let entries = map2(group3, (d) => {
      return [def_name(d), error];
    });
    return [[env, st], append(skipped, entries)];
  }
}
function def_refs(def) {
  if (def instanceof FunctionDef) {
    let f = def[0];
    return in_function(f);
  } else {
    let c = def[0];
    return in_constant(c);
  }
}
function infer_defs(env, st, module_aliases, defs, best_effort) {
  let by_name = from_list(map2(defs, (d) => {
    return [def_name(d), d];
  }));
  let names = map2(defs, def_name);
  let name_set = from_list2(names);
  let edges = from_list(map2(defs, (d) => {
    let $ = def_refs(d);
    let values4 = $[0];
    let qualifiers = $[1];
    let kept_qualifiers = filter(qualifiers, (name2) => {
      return !contains2(module_aliases, name2);
    });
    let refs = filter(append(values4, kept_qualifiers), (_capture) => {
      return contains2(name_set, _capture);
    });
    return [def_name(d), refs];
  }));
  let groups = map2(components(names, edges), (group3) => {
    return filter_map(group3, (_capture) => {
      return get(by_name, _capture);
    });
  });
  if (best_effort) {
    return new Ok(fold2(groups, [[env, st], List$Empty$const], best_effort_group));
  } else {
    return map4(try_fold(groups, [env, st], (acc, group3) => {
      let env$1 = acc[0];
      let st$1 = acc[1];
      return infer_group(env$1, st$1, group3);
    }), (_use0) => {
      let env$1 = _use0[0];
      let st$1 = _use0[1];
      return [[env$1, st$1], List$Empty$const];
    });
  }
}
function last_segment(path) {
  let $ = last(split2(path, "/"));
  if ($ instanceof Ok) {
    let segment = $[0];
    return segment;
  } else {
    return path;
  }
}
function qualified_alias(import_) {
  let $ = import_.alias;
  if ($ instanceof Some) {
    let $1 = $[0];
    if ($1 instanceof Named) {
      let alias = $1[0];
      return new Ok(alias);
    } else {
      return new Error(undefined);
    }
  } else {
    return new Ok(last_segment(import_.module));
  }
}
function variant_accessors(fields, param_ids, return_type) {
  return fold2(fields, make(), (accessors, field3) => {
    let $ = field3[0];
    if ($ instanceof Some) {
      let field_type$1 = field3[1];
      let label = $[0];
      return insert(accessors, label, new Scheme(param_ids, new Fn3(prepend(return_type, List$Empty$const), field_type$1)));
    } else {
      return accessors;
    }
  });
}
function shared_accessors(variants2, param_ids, return_type) {
  if (variants2 instanceof Empty) {
    return make();
  } else {
    let first3 = variants2.head;
    let rest = variants2.tail;
    return index_fold(first3, make(), (accessors, field3, index5) => {
      let shared = all(rest, (variant) => {
        return isEqual(list_at(variant, index5), new Ok(field3));
      });
      if (shared) {
        let $ = field3[0];
        if ($ instanceof Some) {
          let field_type$1 = field3[1];
          let label = $[0];
          return insert(accessors, label, new Scheme(param_ids, new Fn3(prepend(return_type, List$Empty$const), field_type$1)));
        } else {
          return accessors;
        }
      } else {
        return accessors;
      }
    });
  }
}
function variant_field_type(field3) {
  if (field3 instanceof LabelledVariantField) {
    let item = field3.item;
    return item;
  } else {
    let item = field3.item;
    return item;
  }
}
function declare_type(env, name2, arity) {
  return new Env(env.values, env.open_values, env.aliases, env.imported_aliases, env.accessors, insert(env.local_types, name2, [env.current_module, name2, arity]), env.current_module, env.modules, env.module_index, env.live);
}
function register_custom_type(env, st, custom_type2) {
  let env$1 = declare_type(env, custom_type2.name, length(custom_type2.parameters));
  let $ = fold2(custom_type2.parameters, [List$Empty$const, st], (acc, _) => {
    let ids = acc[0];
    let st$12 = acc[1];
    let $12 = fresh_id(st$12);
    let id = $12[0];
    let st$22 = $12[1];
    return [prepend(id, ids), st$22];
  });
  let rev_param_ids = $[0];
  let st$1 = $[1];
  let param_ids = reverse2(rev_param_ids);
  let param_vars = map2(param_ids, (var0) => {
    return new Var(var0);
  });
  let names = from_list(zip(custom_type2.parameters, param_vars));
  let return_type = new Named2(env$1.current_module, custom_type2.name, param_vars, Option$None$const);
  let $1 = index_fold(custom_type2.variants, [env$1, st$1, List$Empty$const], (acc, variant, index5) => {
    let env$22 = acc[0];
    let st$22 = acc[1];
    let variant_fields2 = acc[2];
    let $2 = fold2(variant.fields, [List$Empty$const, st$22], (acc2, field3) => {
      let fields2 = acc2[0];
      let st$32 = acc2[1];
      let $32 = hydrate_in(env$22, names, st$32, variant_field_type(field3));
      let t = $32[0];
      let st$4 = $32[1];
      let _block2;
      if (field3 instanceof LabelledVariantField) {
        let label2 = field3.label;
        _block2 = new Some(label2);
      } else {
        _block2 = Option$None$const;
      }
      let label = _block2;
      return [prepend([label, t], fields2), st$4];
    });
    let rev_fields = $2[0];
    let st$3 = $2[1];
    let fields = reverse2(rev_fields);
    let $3 = unzip(fields);
    let labels = $3[0];
    let field_types = $3[1];
    let built = stamp(st$3, return_type, index5);
    let _block;
    if (field_types instanceof Empty) {
      _block = built;
    } else {
      _block = new Fn3(field_types, built);
    }
    let ctor_type = _block;
    let env$32 = install(env$22, variant.name, new Scheme(param_ids, ctor_type), new ConstructorValue(env$22.current_module, variant.name, field_map_of(labels)));
    return [env$32, st$3, prepend(fields, variant_fields2)];
  });
  let env$2 = $1[0];
  let st$2 = $1[1];
  let rev_variant_fields = $1[2];
  let variant_fields = reverse2(rev_variant_fields);
  let shared = shared_accessors(variant_fields, param_ids, return_type);
  let accessors = new Accessors(shared, (() => {
    if (variant_fields instanceof Empty) {
      return map2(variant_fields, (_capture) => {
        return variant_accessors(_capture, param_ids, return_type);
      });
    } else if (variant_fields.tail instanceof Empty) {
      return prepend(shared, List$Empty$const);
    } else {
      return map2(variant_fields, (_capture) => {
        return variant_accessors(_capture, param_ids, return_type);
      });
    }
  })());
  let env$3 = new Env(env$2.values, env$2.open_values, env$2.aliases, env$2.imported_aliases, insert(env$2.accessors, custom_type2.name, accessors), env$2.local_types, env$2.current_module, env$2.modules, env$2.module_index, env$2.live);
  return [env$3, st$2];
}
function register_type_alias(env, alias) {
  return new Env(env.values, env.open_values, insert(env.aliases, alias.name, [alias.parameters, alias.aliased]), env.imported_aliases, env.accessors, env.local_types, env.current_module, env.modules, env.module_index, env.live);
}
function import_type(env, local, interface$, original) {
  let _block;
  let $ = get(interface$.types, original);
  if ($ instanceof Ok) {
    let info = $[0];
    _block = new Env(env.values, env.open_values, env.aliases, env.imported_aliases, env.accessors, insert(env.local_types, local, info), env.current_module, env.modules, env.module_index, env.live);
  } else {
    _block = env;
  }
  let env$1 = _block;
  let _block$1;
  let $1 = get(interface$.aliases, original);
  if ($1 instanceof Ok) {
    let alias = $1[0];
    _block$1 = new Env(env$1.values, env$1.open_values, env$1.aliases, insert(env$1.imported_aliases, local, alias), env$1.accessors, env$1.local_types, env$1.current_module, env$1.modules, env$1.module_index, env$1.live);
  } else {
    _block$1 = env$1;
  }
  let env$2 = _block$1;
  let $2 = get(interface$.accessors, original);
  if ($2 instanceof Ok) {
    let accessors = $2[0];
    return new Env(env$2.values, env$2.open_values, env$2.aliases, env$2.imported_aliases, insert(env$2.accessors, local, accessors), env$2.local_types, env$2.current_module, env$2.modules, env$2.module_index, env$2.live);
  } else {
    return env$2;
  }
}
function import_value(env, local, interface$, original) {
  let $ = get(interface$.values, original);
  if ($ instanceof Ok) {
    let entry = $[0];
    return install_entry(env, local, entry);
  } else {
    return env;
  }
}
function index_interface(index5, interface$) {
  return guard(has(index5, interface$.name), index5, () => {
    let index$1 = insert(index5, interface$.name, interface$);
    return fold(interface$.reachable, index$1, (acc, name2, nested) => {
      let $ = has(acc, name2);
      if ($) {
        return acc;
      } else {
        return insert(acc, name2, nested);
      }
    });
  });
}
function import_qualified(env, alias, interface$) {
  let modules = fold(env.modules, interface$.modules, (acc, alias2, interface$2) => {
    return insert(acc, alias2, interface$2);
  });
  return new Env(env.values, env.open_values, env.aliases, env.imported_aliases, env.accessors, env.local_types, env.current_module, insert(modules, alias, interface$), index_interface(env.module_index, interface$), env.live);
}
function import_items(env, import_, interface$) {
  let _block;
  let $ = qualified_alias(import_);
  if ($ instanceof Ok) {
    let alias = $[0];
    _block = import_qualified(env, alias, interface$);
  } else {
    _block = new Env(env.values, env.open_values, env.aliases, env.imported_aliases, env.accessors, env.local_types, env.current_module, env.modules, index_interface(env.module_index, interface$), env.live);
  }
  let env$1 = _block;
  let env$2 = fold2(import_.unqualified_values, env$1, (env2, u) => {
    return import_value(env2, unwrap(u.alias, u.name), interface$, u.name);
  });
  return fold2(import_.unqualified_types, env$2, (env2, u) => {
    return import_type(env2, unwrap(u.alias, u.name), interface$, u.name);
  });
}
function new_state() {
  return new State(0, make(), List$Empty$const, List$Empty$const, List$Empty$const, new$3());
}
function prelude_result(ok, error) {
  return new Named2(prelude_module, "Result", prepend(ok, prepend(error, List$Empty$const)), Option$None$const);
}
function prelude_values(st) {
  let $ = fresh_id(st);
  let ok_a = $[0];
  let st$1 = $[1];
  let $1 = fresh_id(st$1);
  let ok_e = $1[0];
  let st$2 = $1[1];
  let ok = new Scheme(prepend(ok_a, prepend(ok_e, List$Empty$const)), new Fn3(prepend(new Var(ok_a), List$Empty$const), stamp(st$2, prelude_result(new Var(ok_a), new Var(ok_e)), 0)));
  let $2 = fresh_id(st$2);
  let err_a = $2[0];
  let st$3 = $2[1];
  let $3 = fresh_id(st$3);
  let err_e = $3[0];
  let st$4 = $3[1];
  let error = new Scheme(prepend(err_a, prepend(err_e, List$Empty$const)), new Fn3(prepend(new Var(err_e), List$Empty$const), stamp(st$4, prelude_result(new Var(err_a), new Var(err_e)), 1)));
  let values4 = map2(prepend(["True", new Scheme(List$Empty$const, prelude_bool())], prepend(["False", new Scheme(List$Empty$const, prelude_bool())], prepend(["Nil", new Scheme(List$Empty$const, prelude_nil())], prepend(["Ok", ok], prepend(["Error", error], List$Empty$const))))), (value3) => {
    let name2 = value3[0];
    let scheme = value3[1];
    return [
      name2,
      new ValueConstructor(scheme, new ConstructorValue(prelude_module, name2, Option$None$const))
    ];
  });
  return [values4, st$4];
}
function prelude_interface() {
  let module2 = prelude_module;
  let $ = prelude_values(new_state());
  let values4 = $[0];
  let types_ = from_list(prepend(["Int", [module2, "Int", 0]], prepend(["Float", [module2, "Float", 0]], prepend(["String", [module2, "String", 0]], prepend(["Bool", [module2, "Bool", 0]], prepend(["Nil", [module2, "Nil", 0]], prepend(["BitArray", [module2, "BitArray", 0]], prepend(["UtfCodepoint", [module2, "UtfCodepoint", 0]], prepend(["List", [module2, "List", 1]], prepend(["Result", [module2, "Result", 2]], List$Empty$const))))))))));
  return new ModuleInterface(module2, from_list(values4), types_, make(), make(), make(), make());
}
function set_module(env, name2) {
  return new Env(env.values, env.open_values, env.aliases, env.imported_aliases, env.accessors, env.local_types, name2, env.modules, env.module_index, env.live);
}
function new_env() {
  return new Env(make(), make(), make(), make(), make(), make(), "", make(), make(), new$3());
}
function prelude18() {
  let $ = prelude_values(new_state());
  let values4 = $[0];
  let st = $[1];
  let env = fold2(values4, new_env(), (env2, value3) => {
    return install_entry(env2, value3[0], value3[1]);
  });
  return [env, st];
}
function sort_dropped(dropped) {
  return sort(dropped, (a2, b) => {
    return compare_spans(a2.span, b.span);
  });
}
function on_target(definition, target) {
  let _block;
  if (target instanceof Erlang) {
    _block = "erlang";
  } else {
    _block = "javascript";
  }
  let active = _block;
  return all(definition.attributes, (attr) => {
    let $ = attr.name;
    let $1 = attr.arguments;
    if ($1 instanceof Empty) {
      return true;
    } else if ($1.tail instanceof Empty) {
      let $2 = $1.head;
      if ($2 instanceof Variable && $ === "target") {
        let t = $2.name;
        return t === active;
      } else {
        return true;
      }
    } else {
      return true;
    }
  });
}
function for_target(module2, target) {
  let $ = partition(module2.functions, (_capture) => {
    return on_target(_capture, target);
  });
  let functions = $[0];
  let dropped_functions = $[1];
  let $1 = partition(module2.constants, (_capture) => {
    return on_target(_capture, target);
  });
  let constants = $1[0];
  let dropped_constants = $1[1];
  let module$1 = new Module(filter(module2.imports, (_capture) => {
    return on_target(_capture, target);
  }), filter(module2.custom_types, (_capture) => {
    return on_target(_capture, target);
  }), filter(module2.type_aliases, (_capture) => {
    return on_target(_capture, target);
  }), constants, functions);
  let dropped = append(map2(dropped_functions, (d) => {
    return new Dropped(d.definition.name, d.definition.location);
  }), map2(dropped_constants, (d) => {
    return new Dropped(d.definition.name, d.definition.location);
  }));
  return [module$1, sort_dropped(dropped)];
}
function resolve_uncached(options, loading, cache, path, best_effort) {
  let $ = options.resolver(path);
  if ($ instanceof Ok) {
    let source = $[0];
    let $1 = module(source);
    if ($1 instanceof Ok) {
      let module2 = $1[0];
      return try$(infer_module(options, insert3(loading, path), cache, path, module2, best_effort), (inferred) => {
        return new Ok([
          new Some(inferred.interface),
          insert(inferred.cache, path, inferred.interface)
        ]);
      });
    } else {
      return new Ok([Option$None$const, cache]);
    }
  } else {
    return new Ok([Option$None$const, cache]);
  }
}
function resolve_interface(options, loading, cache, path, best_effort) {
  return lazy_guard(path === prelude_module, () => {
    return new Ok([new Some(prelude_interface()), cache]);
  }, () => {
    let $ = get(cache, path);
    if ($ instanceof Ok) {
      let interface$ = $[0];
      return new Ok([new Some(interface$), cache]);
    } else {
      return resolve_uncached(options, loading, cache, path, best_effort);
    }
  });
}
function process_imports(options, loading, cache, env, imports, best_effort) {
  return try_fold(imports, [env, cache], (acc, definition) => {
    let env$1 = acc[0];
    let cache$1 = acc[1];
    let import_ = definition.definition;
    let path = import_.module;
    return guard(contains2(loading, path), new Ok([env$1, cache$1]), () => {
      return try$(resolve_interface(options, loading, cache$1, path, best_effort), (_use0) => {
        let maybe_interface = _use0[0];
        let cache$2 = _use0[1];
        if (maybe_interface instanceof Some) {
          let interface$ = maybe_interface[0];
          return new Ok([import_items(env$1, import_, interface$), cache$2]);
        } else {
          return new Ok([env$1, cache$2]);
        }
      });
    });
  });
}
function infer_module(options, loading, cache, module_name2, module2, best_effort) {
  let $ = for_target(module2, options.target);
  let module$1 = $[0];
  let dropped = $[1];
  let $1 = prelude18();
  let prelude_env = $1[0];
  let st = $1[1];
  let env = set_module(prelude_env, module_name2);
  return try$(process_imports(options, loading, cache, env, module$1.imports, best_effort), (_use0) => {
    let env$1 = _use0[0];
    let cache$1 = _use0[1];
    let env$2 = fold2(module$1.custom_types, env$1, (env2, d) => {
      let ct = d.definition;
      return declare_type(env2, ct.name, length(ct.parameters));
    });
    let env$3 = fold2(module$1.type_aliases, env$2, (env2, d) => {
      return register_type_alias(env2, d.definition);
    });
    let $2 = fold2(module$1.custom_types, [env$3, st], (acc, d) => {
      let env$42 = acc[0];
      let st$12 = acc[1];
      return register_custom_type(env$42, st$12, d.definition);
    });
    let env$4 = $2[0];
    let st$1 = $2[1];
    let functions = map2(module$1.functions, (d) => {
      return new FunctionDef(d.definition);
    });
    let constants = map2(module$1.constants, (d) => {
      return new ConstantDef(d.definition);
    });
    let defs = append(functions, constants);
    let module_aliases = from_list2(filter_map(module$1.imports, (d) => {
      return qualified_alias(d.definition);
    }));
    return try$(infer_defs(env$4, st$1, module_aliases, defs, best_effort), (_use02) => {
      let final_env;
      let st$2;
      let skipped;
      skipped = _use02[1];
      final_env = _use02[0][0];
      st$2 = _use02[0][1];
      let interface$ = build_interface(final_env, st$2, module_name2, public_value_names(module$1), public_type_names(module$1), public_accessor_type_names(module$1));
      return new Ok(new Inferred(functions, constants, final_env, st$2, interface$, cache$1, skipped, dropped));
    });
  });
}
function annotate_module(module2, options) {
  return try$(infer_module(options, new$3(), make(), "", module2, false), (inferred) => {
    return new Ok(render(inferred));
  });
}
// build/dev/javascript/shared/canonical.mjs
class Entry extends CustomType {
  constructor(kind, canonical, start_pos, end_pos) {
    super();
    this.kind = kind;
    this.canonical = canonical;
    this.start_pos = start_pos;
    this.end_pos = end_pos;
  }
}
function number_parameters(names) {
  let _pipe = names;
  let _pipe$1 = index_map(_pipe, (name2, index5) => {
    return [name2, index5];
  });
  return from_list(_pipe$1);
}
function render_list(types, params) {
  let _pipe = types;
  let _pipe$1 = map2(_pipe, (_capture) => {
    return render_type(_capture, params);
  });
  return join(_pipe$1, ",");
}
function render_type(type_3, params) {
  if (type_3 instanceof NamedType) {
    let name2 = type_3.name;
    let args = type_3.parameters;
    if (args instanceof Empty) {
      return name2;
    } else {
      return name2 + "(" + render_list(args, params) + ")";
    }
  } else if (type_3 instanceof TupleType) {
    let elements = type_3.elements;
    return "#(" + render_list(elements, params) + ")";
  } else if (type_3 instanceof FunctionType) {
    let args = type_3.parameters;
    let return$ = type_3.return;
    return "fn(" + render_list(args, params) + ")->" + render_type(return$, params);
  } else if (type_3 instanceof VariableType) {
    let name2 = type_3.name;
    let $ = get(params, name2);
    if ($ instanceof Ok) {
      let number = $[0];
      return "$" + to_string(number);
    } else {
      return "$" + name2;
    }
  } else {
    return "_";
  }
}
function render_option(type_3, params) {
  if (type_3 instanceof Some) {
    let type_$1 = type_3[0];
    return render_type(type_$1, params);
  } else {
    return "_";
  }
}
function render_function(param_types, return_type, params) {
  let _block;
  let _pipe = param_types;
  let _pipe$1 = map2(_pipe, (_capture) => {
    return render_option(_capture, params);
  });
  _block = sort(_pipe$1, compare2);
  let rendered = _block;
  return "[" + join(rendered, ",") + "]->" + render_option(return_type, params);
}
function type_variables(type_3) {
  if (type_3 instanceof NamedType) {
    let args = type_3.parameters;
    return flat_map(args, type_variables);
  } else if (type_3 instanceof TupleType) {
    let elements = type_3.elements;
    return flat_map(elements, type_variables);
  } else if (type_3 instanceof FunctionType) {
    let args = type_3.parameters;
    let return$ = type_3.return;
    return append(flat_map(args, type_variables), type_variables(return$));
  } else if (type_3 instanceof VariableType) {
    let name2 = type_3.name;
    return prepend(name2, List$Empty$const);
  } else {
    return List$Empty$const;
  }
}
function option_variables(type_3) {
  if (type_3 instanceof Some) {
    let type_$1 = type_3[0];
    return type_variables(type_$1);
  } else {
    return List$Empty$const;
  }
}
function canonical_signature(param_types, return_type) {
  let _block;
  let _pipe = append(flat_map(param_types, option_variables), option_variables(return_type));
  _block = unique(_pipe);
  let names = _block;
  let _block$1;
  let _pipe$1 = names;
  let _pipe$2 = permutations(_pipe$1);
  let _pipe$3 = map2(_pipe$2, (order2) => {
    return render_function(param_types, return_type, number_parameters(order2));
  });
  let _pipe$4 = sort(_pipe$3, compare2);
  let _pipe$5 = first(_pipe$4);
  _block$1 = unwrap2(_pipe$5, "");
  let body = _block$1;
  return "fn:" + body;
}
function canonical_function(function$) {
  let param_types = map2(function$.parameters, (parameter) => {
    return parameter.type_;
  });
  return canonical_signature(param_types, function$.return);
}
function fully_annotated(function$) {
  return is_some(function$.return) && all(function$.parameters, (parameter) => {
    return is_some(parameter.type_);
  });
}
function field_type2(field3) {
  if (field3 instanceof LabelledVariantField) {
    let item = field3.item;
    return item;
  } else {
    let item = field3.item;
    return item;
  }
}
function render_variant(variant, params) {
  let _block;
  let _pipe = variant.fields;
  let _pipe$1 = map2(_pipe, (field3) => {
    return render_type(field_type2(field3), params);
  });
  _block = sort(_pipe$1, compare2);
  let fields = _block;
  return "[" + join(fields, ",") + "]";
}
function render_variants(variants2, params) {
  let _block;
  let _pipe = variants2;
  let _pipe$1 = map2(_pipe, (_capture) => {
    return render_variant(_capture, params);
  });
  _block = sort(_pipe$1, compare2);
  let rendered = _block;
  return "[" + join(rendered, ",") + "]";
}
function canonical_type(custom_type2) {
  let arity = length(custom_type2.parameters);
  let _block;
  let _pipe = custom_type2.parameters;
  let _pipe$1 = permutations(_pipe);
  let _pipe$2 = map2(_pipe$1, (names) => {
    return render_variants(custom_type2.variants, number_parameters(names));
  });
  let _pipe$3 = sort(_pipe$2, compare2);
  let _pipe$4 = first(_pipe$3);
  _block = unwrap2(_pipe$4, "");
  let body = _block;
  return to_string(arity) + ":" + body;
}
function from_girard(type_3) {
  let span3 = new Span(0, 0);
  if (type_3 instanceof Named3) {
    let name2 = type_3.name;
    let arguments$ = type_3.arguments;
    return new NamedType(span3, name2, Option$None$const, map2(arguments$, from_girard));
  } else if (type_3 instanceof Fn4) {
    let arguments$ = type_3.arguments;
    let return$ = type_3.return;
    return new FunctionType(span3, map2(arguments$, from_girard), from_girard(return$));
  } else if (type_3 instanceof Var2) {
    let id = type_3.id;
    return new VariableType(span3, "v" + to_string(id));
  } else {
    let elements = type_3.elements;
    return new TupleType(span3, map2(elements, from_girard));
  }
}
function infer_signatures(module2) {
  let _block;
  let _pipe = default_options();
  _block = with_resolver(_pipe, (_) => {
    return new Error(undefined);
  });
  let options = _block;
  let $ = annotate_module(module2, options);
  if ($ instanceof Ok) {
    let annotated = $[0];
    let _pipe$1 = annotated.functions;
    let _pipe$2 = filter_map(_pipe$1, (entry) => {
      let name2 = entry[0];
      let scheme = entry[1];
      let $1 = scheme.type_;
      if ($1 instanceof Fn4) {
        let arguments$ = $1.arguments;
        let return$ = $1.return;
        return new Ok([
          name2,
          canonical_signature(map2(arguments$, (argument) => {
            return new Some(from_girard(argument));
          }), new Some(from_girard(return$)))
        ]);
      } else {
        return new Error(undefined);
      }
    });
    return from_list(_pipe$2);
  } else {
    return make();
  }
}
function parse4(source) {
  return try$(module(source), (parsed) => {
    let needs_inference = any(parsed.functions, (definition) => {
      return !fully_annotated(definition.definition);
    });
    let _block;
    if (needs_inference) {
      _block = infer_signatures(parsed);
    } else {
      _block = make();
    }
    let inferred = _block;
    let types = map2(parsed.custom_types, (definition) => {
      let custom_type2 = definition.definition;
      return new Entry(0, canonical_type(custom_type2), custom_type2.location.start, custom_type2.location.end);
    });
    let functions = map2(parsed.functions, (definition) => {
      let function$ = definition.definition;
      return new Entry(1, (() => {
        let $ = fully_annotated(function$);
        if ($) {
          return canonical_function(function$);
        } else {
          let $1 = get(inferred, function$.name);
          if ($1 instanceof Ok) {
            let form = $1[0];
            return form;
          } else {
            return canonical_function(function$);
          }
        }
      })(), function$.location.start, function$.location.end);
    });
    return new Ok(append(types, functions));
  });
}

// build/dev/javascript/shared/storage.mjs
class Package extends CustomType {
  constructor(name2, description, repository, updated_at, owners, total_downloads, recent_downloads, latest_version) {
    super();
    this.name = name2;
    this.description = description;
    this.repository = repository;
    this.updated_at = updated_at;
    this.owners = owners;
    this.total_downloads = total_downloads;
    this.recent_downloads = recent_downloads;
    this.latest_version = latest_version;
  }
}
// build/dev/javascript/timeago/timeago.mjs
class TimeAgo extends CustomType {
  constructor(now, locale) {
    super();
    this.now = now;
    this.locale = locale;
  }
}

class Past extends CustomType {
}
var Tense$Past$const = new Past;
class Future extends CustomType {
}
var Tense$Future$const = new Future;
function replace_percent_d_with_int(s, i) {
  return replace(s, "%d", to_string(i));
}
function en_us(tense, unit, amount) {
  if (unit instanceof Nanosecond) {
    return "just now";
  } else if (unit instanceof Microsecond) {
    return "just now";
  } else if (unit instanceof Millisecond) {
    return "just now";
  } else if (unit instanceof Second) {
    if (tense instanceof Past) {
      if (amount === 1) {
        return "1 second ago";
      } else {
        let a2 = amount;
        let _pipe = "%d seconds ago";
        return replace_percent_d_with_int(_pipe, a2);
      }
    } else if (amount === 1) {
      return "in 1 second";
    } else {
      let a2 = amount;
      let _pipe = "in %d seconds";
      return replace_percent_d_with_int(_pipe, a2);
    }
  } else if (unit instanceof Minute) {
    if (tense instanceof Past) {
      if (amount === 1) {
        return "1 minute ago";
      } else {
        let a2 = amount;
        let _pipe = "%d minutes ago";
        return replace_percent_d_with_int(_pipe, a2);
      }
    } else if (amount === 1) {
      return "in 1 minute";
    } else {
      let a2 = amount;
      let _pipe = "in %d minutes";
      return replace_percent_d_with_int(_pipe, a2);
    }
  } else if (unit instanceof Hour) {
    if (tense instanceof Past) {
      if (amount === 1) {
        return "1 hour ago";
      } else {
        let a2 = amount;
        let _pipe = "%d hours ago";
        return replace_percent_d_with_int(_pipe, a2);
      }
    } else if (amount === 1) {
      return "in 1 hour";
    } else {
      let a2 = amount;
      let _pipe = "in %d hours";
      return replace_percent_d_with_int(_pipe, a2);
    }
  } else if (unit instanceof Day) {
    if (tense instanceof Past) {
      if (amount === 1) {
        return "1 day ago";
      } else {
        let a2 = amount;
        let _pipe = "%d days ago";
        return replace_percent_d_with_int(_pipe, a2);
      }
    } else if (amount === 1) {
      return "in 1 day";
    } else {
      let a2 = amount;
      let _pipe = "in %d days";
      return replace_percent_d_with_int(_pipe, a2);
    }
  } else if (unit instanceof Week) {
    if (tense instanceof Past) {
      if (amount === 1) {
        return "1 week ago";
      } else {
        let a2 = amount;
        let _pipe = "%d weeks ago";
        return replace_percent_d_with_int(_pipe, a2);
      }
    } else if (amount === 1) {
      return "in 1 week";
    } else {
      let a2 = amount;
      let _pipe = "in %d weeks";
      return replace_percent_d_with_int(_pipe, a2);
    }
  } else if (unit instanceof Month) {
    if (tense instanceof Past) {
      if (amount === 1) {
        return "1 month ago";
      } else {
        let a2 = amount;
        let _pipe = "%d months ago";
        return replace_percent_d_with_int(_pipe, a2);
      }
    } else if (amount === 1) {
      return "in 1 month";
    } else {
      let a2 = amount;
      let _pipe = "in %d months";
      return replace_percent_d_with_int(_pipe, a2);
    }
  } else if (tense instanceof Past) {
    if (amount === 1) {
      return "1 year ago";
    } else {
      let a2 = amount;
      let _pipe = "%d years ago";
      return replace_percent_d_with_int(_pipe, a2);
    }
  } else if (amount === 1) {
    return "in 1 year";
  } else {
    let a2 = amount;
    let _pipe = "in %d years";
    return replace_percent_d_with_int(_pipe, a2);
  }
}
function new$9() {
  return new TimeAgo(system_time2(), en_us);
}
function format(time_ago, timestamp) {
  let $ = approximate(difference(timestamp, time_ago.now));
  let amount = $[0];
  let unit = $[1];
  let magnitude = absolute_value(amount);
  let _block;
  let $1 = amount > 0;
  if ($1) {
    _block = Tense$Past$const;
  } else {
    _block = Tense$Future$const;
  }
  let tense = _block;
  return time_ago.locale(tense, unit, magnitude);
}
// build/dev/javascript/jooc/sql.mjs
var all2 = `SELECT
  p.name, p.description, p.repository, p.updated_at, p.owners,
  p.total_downloads, p.recent_downloads, p.latest_version,
  NULL AS module, NULL AS snippet
FROM packages p`;
var all_pkgs_by_downloaded = all2 + " ORDER BY p.recent_downloads DESC, p.id";
var all_pkgs_by_recent = all2 + " ORDER BY p.updated_at DESC, p.id;";
var all_pkgs_by_small = all2 + ` LEFT JOIN modules m ON m.package_id = p.id
GROUP BY p.id
ORDER BY COALESCE(SUM(length(m.source)), 0) ASC, p.id;`;
var all_pkgs_by_big = all2 + ` LEFT JOIN modules m ON m.package_id = p.id
GROUP BY p.id
ORDER BY COALESCE(SUM(length(m.source)), 0) DESC, p.id;`;
var info_only = all2 + ` WHERE instr(lower(p.name), lower(?)) > 0
   OR instr(lower(p.description), lower(?)) > 0
   OR instr(lower(p.owners), lower(?)) > 0
ORDER BY p.recent_downloads DESC, p.id`;
var code_and_package = `WITH pkg AS (
  SELECT rowid AS id, rank AS score, 999999 AS pos
  FROM packages_fts
  WHERE packages_fts MATCH ?2 AND rank < ?4

  UNION

  SELECT p.id, 0, CAST(j.key AS INTEGER)
  FROM json_each(?3) j
  JOIN packages p ON lower(p.name) = lower(j.value)
),
fuzzy AS (
  SELECT rowid AS id FROM modules_fts
  WHERE modules_fts MATCH ?2
    AND rank < ?4
    AND length(source) < 200000
    AND rowid NOT IN (
      SELECT rowid FROM modules_fts
      WHERE modules_fts MATCH ('"' || replace(?1, '"', '""') || '"')
    )
)
SELECT name, description, repository, updated_at, owners,
  total_downloads, recent_downloads, latest_version, module, snippet FROM (
  SELECT p.name, p.description, p.repository, p.updated_at, p.owners,
    p.total_downloads, p.recent_downloads, p.latest_version,
    NULL AS module, NULL AS snippet,
    0 AS kind, pkg.score AS score, pkg.pos AS pos
  FROM pkg
  JOIN packages p ON p.id = pkg.id

  UNION ALL

  SELECT p.name, p.description, p.repository, p.updated_at, p.owners,
    p.total_downloads, p.recent_downloads, p.latest_version,
    m.name,
    snippet(modules_fts, 1, char(2), char(3), '', 64),
    1, f.rank, 999999
  FROM modules_fts f
  JOIN modules m ON m.id = f.rowid
  JOIN packages p ON p.id = m.package_id
  WHERE modules_fts MATCH ('"' || replace(?1, '"', '""') || '"')
    AND p.id NOT IN (SELECT id FROM pkg)

  UNION ALL

  SELECT p.name, p.description, p.repository, p.updated_at, p.owners,
    p.total_downloads, p.recent_downloads, p.latest_version,
    m.name,
    snippet(modules_fts, 1, char(2), char(3), '', 64),
    2, f.rank, 999999
  FROM modules_fts f
  JOIN modules m ON m.id = f.rowid
  JOIN packages p ON p.id = m.package_id
  WHERE modules_fts MATCH ?2 AND f.rowid IN (SELECT id FROM fuzzy)
    AND p.id NOT IN (SELECT id FROM pkg)
)
ORDER BY pos, kind, score`;
var canonical = `SELECT
  p.name, p.description, p.repository, p.updated_at, p.owners,
  p.total_downloads, p.recent_downloads, p.latest_version,
  m.name AS module,
  char(2) || CAST(
    substr(CAST(m.source AS BLOB), d.start_pos + 1, d.end_pos - d.start_pos)
    AS TEXT
  ) || char(3) AS snippet
FROM canonical_forms c
JOIN definitions d ON d.canonical_id = c.id
JOIN modules m ON m.id = d.module_id
JOIN packages p ON p.id = m.package_id
WHERE c.canonical = ?1
ORDER BY p.recent_downloads DESC, p.id, m.name, d.start_pos`;

// build/dev/javascript/jooc/sqlite_ffi.mjs
var CACHE_NAME = "sqlite-db";
var KEY = "/data.sqlite";
async function check_cached_etag() {
  try {
    const cache = await caches.open(CACHE_NAME);
    const response = await cache.match(KEY);
    const etag = response?.headers.get("x-etag");
    return etag ? new Ok(etag) : new Error(undefined);
  } catch {
    return new Error(undefined);
  }
}
async function load_cached() {
  try {
    const cache = await caches.open(CACHE_NAME);
    const response = await cache.match(KEY);
    if (!response)
      return new Error(undefined);
    const bytes = new Uint8Array(await response.arrayBuffer());
    return new Ok(new BitArray(bytes));
  } catch {
    return new Error(undefined);
  }
}
async function save_cached(etag, bits2) {
  try {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(KEY, new Response(bits2.rawBuffer, { headers: { "x-etag": etag } }));
    return new Ok(undefined);
  } catch (e) {
    return new Error(String(e));
  }
}
async function open(bits2) {
  let worker2;
  try {
    worker2 = new Worker("/static/jooc/sqlite-loader.js");
    const failed = new Promise((_, reject) => {
      worker2.onerror = (e) => reject(e.message);
    });
    const loading = globalThis.sqlite3Worker1Promiser.v2({ worker: worker2 });
    worker2.postMessage(bits2.rawBuffer);
    const promiser = await Promise.race([loading, failed]);
    const { dbId } = await promiser("open", { filename: "/data.sqlite" });
    return new Ok({ promiser, dbId });
  } catch (e) {
    worker2?.terminate();
    return new Error(e?.result?.message ?? String(e));
  }
}
async function query(db, sql, bind) {
  try {
    const response = await db.promiser({
      type: "exec",
      dbId: db.dbId,
      args: {
        sql,
        bind: bind.toArray(),
        rowMode: "array",
        resultRows: []
      }
    });
    return new Ok(response.result.resultRows);
  } catch (e) {
    return new Error(e?.result?.message ?? String(e));
  }
}

// build/dev/javascript/jooc/sqlite.mjs
function perform2(task, to_msg) {
  return from2((dispatch2) => {
    let _block;
    let _pipe = task();
    let _pipe$1 = map_promise(_pipe, to_msg);
    _block = tap(_pipe$1, dispatch2);
    let $ = _block;
    return;
  });
}
function open2(bytes, to_msg) {
  return perform2(() => {
    return open(bytes);
  }, to_msg);
}
function query2(db, sql, bind, to_msg) {
  return perform2(() => {
    return query(db, sql, bind);
  }, to_msg);
}
function check_cached_etag2(to_msg) {
  return perform2(check_cached_etag, to_msg);
}
function load_cached2(to_msg) {
  return perform2(load_cached, to_msg);
}
function save_cached2(etag, bits2) {
  return from2((_) => {
    let $ = save_cached(etag, bits2);
    return;
  });
}

// build/dev/javascript/jooc/jooc.mjs
var FILEPATH3 = "src/jooc.gleam";

class Model extends CustomType {
  constructor(database, search_result, lucy, all_pkg_names, search_text, query_from_initial_uri) {
    super();
    this.database = database;
    this.search_result = search_result;
    this.lucy = lucy;
    this.all_pkg_names = all_pkg_names;
    this.search_text = search_text;
    this.query_from_initial_uri = query_from_initial_uri;
  }
}

class SearchResult extends CustomType {
  constructor(package$, snippet) {
    super();
    this.package = package$;
    this.snippet = snippet;
  }
}

class ModuleSnippet extends CustomType {
  constructor(module_name2, snippet) {
    super();
    this.module_name = module_name2;
    this.snippet = snippet;
  }
}

class FuzzyMatch extends CustomType {
  constructor(before, match, after) {
    super();
    this.before = before;
    this.match = match;
    this.after = after;
  }
}

class Canonical extends CustomType {
  constructor(definitions) {
    super();
    this.definitions = definitions;
  }
}

class DbLoadingFromCache extends CustomType {
}
var Db$DbLoadingFromCache$const = new DbLoadingFromCache;

class DbLoadingFromServer extends CustomType {
}
var Db$DbLoadingFromServer$const = new DbLoadingFromServer;

class DbLoaded extends CustomType {
  constructor(db, animation) {
    super();
    this.db = db;
    this.animation = animation;
  }
}

class DbError extends CustomType {
  constructor($0) {
    super();
    this[0] = $0;
  }
}

class Finishing extends CustomType {
}
var Animation$Finishing$const = new Finishing;

class Done extends CustomType {
}
var Animation$Done$const = new Done;

class Searching extends CustomType {
}
var Search$Searching$const = new Searching;

class NotSearching extends CustomType {
}
var Search$NotSearching$const = new NotSearching;

class CacheReturnedEtag extends CustomType {
  constructor($0) {
    super();
    this[0] = $0;
  }
}

class ServerReturnedEtag extends CustomType {
  constructor(cached, result) {
    super();
    this.cached = cached;
    this.result = result;
  }
}

class CacheLoaded extends CustomType {
  constructor($0) {
    super();
    this[0] = $0;
  }
}

class ServerReturnedData extends CustomType {
  constructor($0) {
    super();
    this[0] = $0;
  }
}

class SqliteReturnedOpen extends CustomType {
  constructor($0) {
    super();
    this[0] = $0;
  }
}

class SpinFinished extends CustomType {
}
var Msg$SpinFinished$const = new SpinFinished;

class SqliteReturnedQuery extends CustomType {
  constructor(query_was, search_text_was, got) {
    super();
    this.query_was = query_was;
    this.search_text_was = search_text_was;
    this.got = got;
  }
}

class UserTypedQuery extends CustomType {
  constructor($0) {
    super();
    this[0] = $0;
  }
}

class UserClickedButton extends CustomType {
  constructor($0) {
    super();
    this[0] = $0;
  }
}

class QueryFuzzy extends CustomType {
}
var Query$QueryFuzzy$const = new QueryFuzzy;

class QueryCanonical extends CustomType {
}
var Query$QueryCanonical$const = new QueryCanonical;
var data_src = "https://bucket.correctarity.com/packages.sqlite";
function btn(text4, premade_query) {
  return button(prepend(on_click(new UserClickedButton(premade_query)), prepend(style("margin", "5px"), prepend(style("padding", "5px 10px"), prepend(style("color", "var(--text)"), prepend(style("cursor", "pointer"), List$Empty$const))))), prepend(text3(text4), List$Empty$const));
}
function link(href2, label) {
  return a(prepend(href(href2), prepend(styles(prepend(["white-space", "nowrap"], List$Empty$const)), List$Empty$const)), prepend(text3(label), List$Empty$const));
}
function code_block(elts) {
  return pre(prepend(styles(prepend(["margin", "0"], prepend(["margin-bottom", "0.5rem"], prepend(["padding", "0.5rem 0.75rem"], prepend(["background", "rgba(128, 128, 128, 0.15)"], prepend(["border-radius", "0.3rem"], prepend(["white-space", "pre-wrap"], prepend(["overflow-x", "auto"], List$Empty$const)))))))), List$Empty$const), prepend(code(List$Empty$const, elts), List$Empty$const));
}
function code_snippet(snippet) {
  return div(prepend(styles(prepend(["margin", "0.75rem 0 0.75rem 1rem"], List$Empty$const)), List$Empty$const), prepend(p(prepend(styles(prepend(["margin", "0 0 0.25rem"], prepend(["font-weight", "600"], List$Empty$const))), List$Empty$const), prepend(text3(snippet.module_name), List$Empty$const)), (() => {
    let $ = snippet.snippet;
    if ($ instanceof FuzzyMatch) {
      let before = $.before;
      let match = $.match;
      let after = $.after;
      return prepend(code_block(prepend(text3(before), prepend(mark(prepend(style("background-color", "#ffaff3"), List$Empty$const), prepend(text3(match), List$Empty$const)), prepend(text3(after), List$Empty$const)))), List$Empty$const);
    } else {
      let definitions = $.definitions;
      return map2(definitions, (source) => {
        return code_block(prepend(text3(source), List$Empty$const));
      });
    }
  })()));
}
function td2(children) {
  return td(prepend(styles(prepend(["padding", "0.75rem 1rem 0 0"], prepend(["vertical-align", "top"], prepend(["overflow-wrap", "anywhere"], List$Empty$const)))), List$Empty$const), children);
}
function view_result(result, time_ago) {
  let package$ = result.package;
  return tbody(List$Empty$const, prepend(tr(List$Empty$const, prepend(td2(prepend(span(prepend(style("font-size", "1.25rem"), List$Empty$const), prepend(text3(package$.name), prepend(wbr(List$Empty$const), prepend(text3("@" + package$.latest_version), List$Empty$const)))), List$Empty$const)), prepend(td2(prepend(text3(join(package$.owners, ", ")), List$Empty$const)), prepend(td2(prepend(div(prepend(styles(prepend(["display", "flex"], prepend(["flex-wrap", "wrap"], prepend(["gap", "0.25rem 0.75rem"], List$Empty$const)))), List$Empty$const), prepend(link("https://" + replace(package$.name, "_", "-") + ".hexdocs.pm", "docs"), prepend((() => {
    let $ = package$.repository;
    if ($ instanceof Some) {
      let url = $[0];
      return link(url, "repo");
    } else {
      return none2();
    }
  })(), prepend(link("https://hex.pm/packages/" + package$.name, "hex"), List$Empty$const)))), List$Empty$const)), prepend(td2(prepend(text3(format(time_ago, package$.updated_at)), List$Empty$const)), prepend(td2(prepend(text3(to_string(package$.total_downloads)), List$Empty$const)), List$Empty$const)))))), prepend(tr(List$Empty$const, prepend(td(prepend(colspan(5), prepend(styles(prepend(["padding", "0.25rem 0 0.75rem"], prepend(["border-bottom", "1px solid #3a3a3a"], List$Empty$const))), List$Empty$const)), prepend(p(prepend(style("margin", "0"), List$Empty$const), prepend(text3(package$.description), List$Empty$const)), map2(result.snippet, code_snippet))), List$Empty$const)), List$Empty$const)));
}
function th2(label) {
  return th(prepend(styles(prepend(["text-align", "left"], prepend(["padding", "0.5rem 1rem 0.5rem 0"], prepend(["border-bottom", "1px solid #3a3a3a"], List$Empty$const)))), List$Empty$const), prepend(text3(label), List$Empty$const));
}
function view_results(model, time_ago) {
  let $ = model.database;
  if ($ instanceof DbLoaded) {
    let $1 = $.animation;
    if ($1 instanceof Some) {
      if ($1[0] instanceof Done) {
        return div(List$Empty$const, prepend((() => {
          let $2 = model.search_result;
          if ($2 instanceof Empty) {
            return p(prepend(style("margin", "0"), List$Empty$const), prepend(text3("No matching packages found here, but this is not a complete index of all gleam packages. Maybe try "), prepend(link("https://packages.gleam.run?search=" + model.search_text, "https://packages.gleam.run?search=" + model.search_text), List$Empty$const)));
          } else {
            let search_results = $2;
            return table(prepend(styles(prepend(["width", "100%"], prepend(["table-layout", "fixed"], prepend(["border-collapse", "collapse"], List$Empty$const)))), List$Empty$const), prepend(colgroup(List$Empty$const, prepend(col(prepend(style("width", "30%"), List$Empty$const)), prepend(col(prepend(style("width", "20%"), List$Empty$const)), prepend(col(prepend(style("width", "20%"), List$Empty$const)), prepend(col(prepend(style("width", "17%"), List$Empty$const)), prepend(col(prepend(style("width", "13%"), List$Empty$const)), List$Empty$const)))))), prepend(thead(List$Empty$const, prepend(tr(List$Empty$const, prepend(th2("package"), prepend(th2("author"), prepend(th2("links"), prepend(th2("updated"), prepend(th2("downloads"), List$Empty$const)))))), List$Empty$const)), map2(search_results, (search_result) => {
              return view_result(search_result, time_ago);
            }))));
          }
        })(), prepend(footer(prepend(style("padding-top", "10px"), prepend(style("padding-bottom", "10px"), List$Empty$const)), toList([
          text3("This includes only Gleam packages that spark joy for me, i.e. not all packages are included. This package list is "),
          strong(List$Empty$const, prepend(text3("not maintained by the Gleam team"), List$Empty$const)),
          text3(", it is not official or objective or anything. "),
          link("https://packages.gleam.run", "packages.gleam.run"),
          text3(" Is Gleam's official site for seeing all packages. Thanks also to "),
          link("https://hex.pm/", "hex.pm"),
          text3(" and "),
          link("https://gloogle.run", "gloogle.run"),
          text3(".  Gleam Lucy starfish mascot © 2026 Louis Pilfold."),
          br(List$Empty$const),
          text3("See all packages ordered by: "),
          btn("new", all_pkgs_by_recent),
          btn("popular", all_pkgs_by_downloaded),
          btn("big", all_pkgs_by_big),
          btn("small", all_pkgs_by_small)
        ])), List$Empty$const)));
      } else {
        return none2();
      }
    } else {
      return div(List$Empty$const, prepend((() => {
        let $2 = model.search_result;
        if ($2 instanceof Empty) {
          return p(prepend(style("margin", "0"), List$Empty$const), prepend(text3("No matching packages found here, but this is not a complete index of all gleam packages. Maybe try "), prepend(link("https://packages.gleam.run?search=" + model.search_text, "https://packages.gleam.run?search=" + model.search_text), List$Empty$const)));
        } else {
          let search_results = $2;
          return table(prepend(styles(prepend(["width", "100%"], prepend(["table-layout", "fixed"], prepend(["border-collapse", "collapse"], List$Empty$const)))), List$Empty$const), prepend(colgroup(List$Empty$const, prepend(col(prepend(style("width", "30%"), List$Empty$const)), prepend(col(prepend(style("width", "20%"), List$Empty$const)), prepend(col(prepend(style("width", "20%"), List$Empty$const)), prepend(col(prepend(style("width", "17%"), List$Empty$const)), prepend(col(prepend(style("width", "13%"), List$Empty$const)), List$Empty$const)))))), prepend(thead(List$Empty$const, prepend(tr(List$Empty$const, prepend(th2("package"), prepend(th2("author"), prepend(th2("links"), prepend(th2("updated"), prepend(th2("downloads"), List$Empty$const)))))), List$Empty$const)), map2(search_results, (search_result) => {
            return view_result(search_result, time_ago);
          }))));
        }
      })(), prepend(footer(prepend(style("padding-top", "10px"), prepend(style("padding-bottom", "10px"), List$Empty$const)), toList([
        text3("This includes only Gleam packages that spark joy for me, i.e. not all packages are included. This package list is "),
        strong(List$Empty$const, prepend(text3("not maintained by the Gleam team"), List$Empty$const)),
        text3(", it is not official or objective or anything. "),
        link("https://packages.gleam.run", "packages.gleam.run"),
        text3(" Is Gleam's official site for seeing all packages. Thanks also to "),
        link("https://hex.pm/", "hex.pm"),
        text3(" and "),
        link("https://gloogle.run", "gloogle.run"),
        text3(".  Gleam Lucy starfish mascot © 2026 Louis Pilfold."),
        br(List$Empty$const),
        text3("See all packages ordered by: "),
        btn("new", all_pkgs_by_recent),
        btn("popular", all_pkgs_by_downloaded),
        btn("big", all_pkgs_by_big),
        btn("small", all_pkgs_by_small)
      ])), List$Empty$const)));
    }
  } else if ($ instanceof DbError) {
    let message2 = $[0];
    return p(prepend(style("margin", "0"), List$Empty$const), prepend(text3(message2), List$Empty$const));
  } else {
    return none2();
  }
}
function star_image(name2, src2) {
  return img(prepend(class$(name2), prepend(src(src2), prepend(styles(prepend(["position", "absolute"], prepend(["width", "100%"], prepend(["height", "100%"], List$Empty$const)))), List$Empty$const))));
}
function view_star(done, animated, spin_events, model) {
  let _block;
  if (done) {
    _block = prepend(["top", "3.75rem"], prepend(["left", "calc(max(0px, 50% - var(--w) / 2) + 1.2rem + 24px)"], prepend(["width", "32px"], prepend(["height", "32px"], List$Empty$const))));
  } else {
    _block = prepend(["top", "50%"], prepend(["left", "50%"], prepend(["width", "min(400px, 70vmin)"], prepend(["height", "min(400px, 70vmin)"], List$Empty$const))));
  }
  let position = _block;
  return div(prepend(class$("mover"), prepend(styles(prepend(["position", "absolute"], prepend(["z-index", "1"], prepend(["transform", "translate(-50%, -50%)"], prepend([
    "transition",
    "top var(--move) ease-in-out, width var(--move) ease-in-out, height var(--move) ease-in-out"
  ], position))))), List$Empty$const)), prepend(div(prepend(classes(prepend(["spin", animated], List$Empty$const)), prepend(styles(prepend(["position", "relative"], prepend(["width", "100%"], prepend(["height", "100%"], List$Empty$const)))), spin_events)), prepend((() => {
    let _block$1;
    let $ = model.lucy;
    if ($ instanceof Searching) {
      _block$1 = "/static/jooc/lucyhappy.svg";
    } else {
      let $1 = model.search_result;
      let $2 = model.all_pkg_names;
      if ($2 instanceof Empty) {
        _block$1 = "/static/jooc/lucy.svg";
      } else if ($1 instanceof Empty) {
        _block$1 = "/static/jooc/lucydebugfail.svg";
      } else {
        _block$1 = "/static/jooc/lucy.svg";
      }
    }
    let svg = _block$1;
    return star_image((() => {
      if (animated) {
        return "normal";
      } else {
        return "";
      }
    })(), svg);
  })(), prepend((() => {
    if (animated) {
      return star_image("happy", "/static/jooc/lucyhappy.svg");
    } else {
      return none2();
    }
  })(), List$Empty$const))), List$Empty$const));
}
function main_view(model) {
  let _block;
  let $1 = model.database;
  if ($1 instanceof DbLoaded) {
    let $22 = $1.animation;
    if ($22 instanceof Some) {
      if ($22[0] instanceof Done) {
        _block = [true, true];
      } else {
        _block = [false, true];
      }
    } else {
      _block = [true, false];
    }
  } else {
    _block = [false, true];
  }
  let $ = _block;
  let done = $[0];
  let animated = $[1];
  let _block$1;
  let $2 = model.database;
  if ($2 instanceof DbLoaded) {
    let $3 = $2.animation;
    if ($3 instanceof Some && $3[0] instanceof Finishing) {
      _block$1 = prepend(on("animationiteration", field("animationName", string2, (name2) => {
        if (name2 === "spin") {
          return success(Msg$SpinFinished$const);
        } else {
          return failure(Msg$SpinFinished$const, "spin");
        }
      })), List$Empty$const);
    } else {
      _block$1 = List$Empty$const;
    }
  } else {
    _block$1 = List$Empty$const;
  }
  let spin_events = _block$1;
  return div(prepend(classes(prepend(["done", done && animated], List$Empty$const)), prepend(styles(prepend(["--w", "770px"], prepend(["box-sizing", "border-box"], prepend(["max-width", "var(--w)"], prepend(["margin", "0 auto"], prepend(["padding", "2rem 1.2rem 0"], List$Empty$const)))))), List$Empty$const)), prepend(view_star(done, animated, spin_events, model), prepend(input(prepend(value(model.search_text), prepend(type_("search"), prepend(placeholder("search package by name, code, type, fn"), prepend(disabled(!done), prepend((() => {
    let _pipe = on_input((var0) => {
      return new UserTypedQuery(var0);
    });
    return debounce(_pipe, 200);
  })(), prepend(styles(toList([
    ["box-sizing", "border-box"],
    ["width", "100%"],
    ["height", "3.5rem"],
    ["margin", "0 0 1rem"],
    ["padding", "0 1rem 0 3rem"],
    ["font-size", "1rem"],
    ["border", "1px solid #3a3a3a"],
    ["border-radius", "1.75rem"],
    ["background", "var(--bg)"],
    ["color", "var(--text)"],
    ["transition", "opacity 1s"],
    [
      "opacity",
      (() => {
        if (done) {
          return "1";
        } else {
          return "0";
        }
      })()
    ],
    [
      "pointer-events",
      (() => {
        if (done) {
          return "auto";
        } else {
          return "none";
        }
      })()
    ]
  ])), List$Empty$const))))))), prepend(view_results(model, new$9()), List$Empty$const))));
}
function view2(model) {
  let $ = model.database;
  if ($ instanceof DbLoadingFromCache) {
    return none2();
  } else if ($ instanceof DbLoadingFromServer) {
    return main_view(model);
  } else if ($ instanceof DbLoaded) {
    return main_view(model);
  } else {
    let err = $[0];
    return text3(err);
  }
}
function similar_pkg_names(query3, pkgs) {
  let $ = string_length(query3);
  let n = $;
  if (n < 50) {
    let _block;
    {
      let n$1 = n;
      if (n$1 <= 4) {
        _block = 1;
      } else {
        let n$2 = n;
        if (n$2 <= 11) {
          _block = 2;
        } else {
          let n$3 = n;
          if (n$3 <= 20) {
            _block = 3;
          } else {
            let n$4 = n;
            if (n$4 <= 50) {
              _block = 4;
            } else {
              throw makeError("panic", FILEPATH3, "jooc", 528, "similar_pkg_names", "xdd", {});
            }
          }
        }
      }
    }
    let acceptable_distance = _block;
    return filter(pkgs, (pkg) => {
      return levenshtein(query3, pkg) <= acceptable_distance;
    });
  } else {
    return List$Empty$const;
  }
}
function query_to_trigrams(query3) {
  let _pipe = query3;
  let _pipe$1 = lowercase(_pipe);
  let _pipe$2 = graphemes(_pipe$1);
  let _pipe$3 = window2(_pipe$2, 3);
  let _pipe$4 = map2(_pipe$3, (w) => {
    return '"' + replace(concat2(w), '"', '""') + '"';
  });
  let _pipe$5 = unique(_pipe$4);
  return join(_pipe$5, " OR ");
}
function parse_type_or_fn(query_chars) {
  let _block;
  if (query_chars instanceof Empty) {
    _block = new Error(undefined);
  } else {
    let $ = query_chars.tail;
    if ($ instanceof Empty) {
      if (query_chars.head === "{") {
        let rest = $;
        _block = new Ok(prepend("t", prepend("y", prepend("p", prepend("e", prepend(" ", prepend("W", prepend("{", rest))))))));
      } else {
        _block = new Error(undefined);
      }
    } else {
      let $1 = $.tail;
      if ($1 instanceof Empty) {
        let $2 = query_chars.head;
        if ($2 === "{") {
          let rest = $;
          _block = new Ok(prepend("t", prepend("y", prepend("p", prepend("e", prepend(" ", prepend("W", prepend("{", rest))))))));
        } else if ($2 === "f" && $.head === "n") {
          _block = new Ok(query_chars);
        } else {
          _block = new Error(undefined);
        }
      } else {
        let $2 = query_chars.head;
        if ($2 === "f" && $.head === "n") {
          let $3 = $1.head;
          if ($3 === "(") {
            let rest = $1.tail;
            _block = new Ok(prepend("f", prepend("n", prepend(" ", prepend("w", prepend("(", rest))))));
          } else if ($3 === " ") {
            let $4 = $1.tail;
            if ($4 instanceof Empty) {
              _block = new Ok(query_chars);
            } else {
              let $5 = $4.head;
              if ($5 === "(") {
                let rest = $4.tail;
                _block = new Ok(prepend("f", prepend("n", prepend(" ", prepend("w", prepend("(", rest))))));
              } else if ($5 === " ") {
                let $6 = $4.tail;
                if ($6 instanceof Empty) {
                  _block = new Ok(query_chars);
                } else if ($6.head === "(") {
                  let rest = $6.tail;
                  _block = new Ok(prepend("f", prepend("n", prepend(" ", prepend("w", prepend("(", rest))))));
                } else {
                  _block = new Ok(query_chars);
                }
              } else {
                _block = new Ok(query_chars);
              }
            }
          } else {
            _block = new Ok(query_chars);
          }
        } else if ($2 === "{") {
          let rest = $;
          _block = new Ok(prepend("t", prepend("y", prepend("p", prepend("e", prepend(" ", prepend("W", prepend("{", rest))))))));
        } else if ($2 === "p") {
          let $3 = $1.tail;
          if ($3 instanceof Empty) {
            _block = new Error(undefined);
          } else {
            let $4 = $3.tail;
            if ($4 instanceof Empty) {
              _block = new Error(undefined);
            } else {
              let $5 = $4.tail;
              if ($5 instanceof Empty) {
                _block = new Error(undefined);
              } else if ($.head === "u" && $1.head === "b" && $3.head === " ") {
                let $6 = $4.head;
                if ($6 === "f" && $5.head === "n") {
                  _block = new Ok(query_chars);
                } else if ($6 === "t") {
                  let $7 = $5.tail;
                  if ($7 instanceof Empty) {
                    _block = new Error(undefined);
                  } else {
                    let $8 = $7.tail;
                    if ($8 instanceof Empty) {
                      _block = new Error(undefined);
                    } else if ($5.head === "y" && $7.head === "p" && $8.head === "e") {
                      _block = new Ok(query_chars);
                    } else {
                      _block = new Error(undefined);
                    }
                  }
                } else {
                  _block = new Error(undefined);
                }
              } else {
                _block = new Error(undefined);
              }
            }
          }
        } else if ($2 === "t") {
          let $3 = $1.tail;
          if ($3 instanceof Empty) {
            _block = new Error(undefined);
          } else if ($.head === "y" && $1.head === "p" && $3.head === "e") {
            _block = new Ok(query_chars);
          } else {
            _block = new Error(undefined);
          }
        } else {
          _block = new Error(undefined);
        }
      }
    }
  }
  let query_chars$1 = _block;
  let _block$1;
  if (query_chars$1 instanceof Ok) {
    let query_chars$2 = query_chars$1[0];
    let $ = (() => {
      let _pipe = query_chars$2;
      let _pipe$1 = concat2(_pipe);
      return parse4(_pipe$1);
    })();
    if ($ instanceof Ok) {
      _block$1 = $;
    } else {
      _block$1 = new Error(undefined);
    }
  } else {
    _block$1 = query_chars$1;
  }
  let parsed = _block$1;
  if (parsed instanceof Ok) {
    let $ = parsed[0];
    if ($ instanceof Empty) {
      return new Error(undefined);
    } else if ($.tail instanceof Empty) {
      let parsed$1 = $.head;
      return new Ok(parsed$1.canonical);
    } else {
      return new Error(undefined);
    }
  } else {
    return new Error(undefined);
  }
}
function text_to_query(text4, model) {
  let push_url = push("", new Some(percent_encode(text4)), Option$None$const);
  let model$1 = new Model(model.database, model.search_result, model.lucy, model.all_pkg_names, text4, model.query_from_initial_uri);
  let text$1 = trim(text4);
  let _block;
  let $ = model$1.database;
  if ($ instanceof DbLoaded) {
    let db = $.db;
    let chars = graphemes(text$1);
    if (chars instanceof Empty) {
      _block = query2(db, all_pkgs_by_recent, List$Empty$const, (_capture) => {
        return new SqliteReturnedQuery(Query$QueryFuzzy$const, model$1.search_text, _capture);
      });
    } else {
      let $1 = chars.tail;
      if ($1 instanceof Empty) {
        _block = query2(db, info_only, prepend(text$1, prepend(text$1, prepend(text$1, List$Empty$const))), (_capture) => {
          return new SqliteReturnedQuery(Query$QueryFuzzy$const, model$1.search_text, _capture);
        });
      } else if ($1.tail instanceof Empty) {
        _block = query2(db, info_only, prepend(text$1, prepend(text$1, prepend(text$1, List$Empty$const))), (_capture) => {
          return new SqliteReturnedQuery(Query$QueryFuzzy$const, model$1.search_text, _capture);
        });
      } else {
        let $2 = parse_type_or_fn(chars);
        if ($2 instanceof Ok) {
          let canonical2 = $2[0];
          _block = query2(db, canonical, prepend(canonical2, List$Empty$const), (_capture) => {
            return new SqliteReturnedQuery(Query$QueryCanonical$const, model$1.search_text, _capture);
          });
        } else {
          let _block$1;
          let _pipe = text$1;
          let _pipe$1 = string_length(_pipe);
          _block$1 = identity(_pipe$1);
          let bm25_threshold = _block$1;
          let bm25_threshold$1 = float_to_string(-0.75 * bm25_threshold - 4);
          _block = query2(db, code_and_package, prepend(text$1, prepend(query_to_trigrams(text$1), prepend((() => {
            let _pipe$2 = text$1;
            let _pipe$3 = similar_pkg_names(_pipe$2, model$1.all_pkg_names);
            let _pipe$4 = array2(_pipe$3, string3);
            return to_string3(_pipe$4);
          })(), prepend(bm25_threshold$1, List$Empty$const)))), (_capture) => {
            return new SqliteReturnedQuery(Query$QueryFuzzy$const, model$1.search_text, _capture);
          });
        }
      }
    }
  } else {
    _block = none();
  }
  let exec = _block;
  let effect = batch(prepend(exec, prepend(push_url, List$Empty$const)));
  let model$2 = new Model(model$1.database, model$1.search_result, Search$Searching$const, model$1.all_pkg_names, model$1.search_text, model$1.query_from_initial_uri);
  return [model$2, effect];
}
function merge_modules_by_package(results) {
  let groups = group2(results, (r) => {
    return r.package.name;
  });
  let _pipe = results;
  let _pipe$1 = map2(_pipe, (r) => {
    return r.package.name;
  });
  let _pipe$2 = unique(_pipe$1);
  return filter_map(_pipe$2, (name2) => {
    return try$(get(groups, name2), (group3) => {
      return map4(first(group3), (first3) => {
        return new SearchResult(first3.package, flat_map(group3, (r) => {
          return r.snippet;
        }));
      });
    });
  });
}
function handle_query_result(model, query_result, decoder) {
  let _block;
  let _block$1;
  if (query_result instanceof Ok) {
    let query_resp2 = query_result[0];
    let $2 = run(query_resp2, decoder);
    if ($2 instanceof Ok) {
      let resp = $2[0];
      _block$1 = resp;
    } else {
      let err = $2[0];
      echo(err, undefined, "src/jooc.gleam", 252);
      _block$1 = List$Empty$const;
    }
  } else {
    let err = query_result[0];
    echo(err, undefined, "src/jooc.gleam", 257);
    _block$1 = List$Empty$const;
  }
  let _pipe = _block$1;
  let _pipe$1 = values3(_pipe);
  _block = merge_modules_by_package(_pipe$1);
  let query_resp = _block;
  let $ = model.all_pkg_names;
  if ($ instanceof Empty) {
    let all_pkg_names = map2(query_resp, (pkg) => {
      return pkg.package.name;
    });
    let model$1 = new Model(model.database, model.search_result, model.lucy, all_pkg_names, model.search_text, model.query_from_initial_uri);
    let $1 = model$1.query_from_initial_uri;
    if ($1 instanceof Some) {
      let text4 = $1[0];
      return text_to_query(text4, model$1);
    } else {
      let model$2 = new Model(model$1.database, query_resp, Search$NotSearching$const, model$1.all_pkg_names, model$1.search_text, model$1.query_from_initial_uri);
      return [model$2, none()];
    }
  } else {
    let model$1 = new Model(model.database, query_resp, Search$NotSearching$const, model.all_pkg_names, model.search_text, model.query_from_initial_uri);
    return [model$1, none()];
  }
}
function canonical_result_decoder() {
  return field(0, string2, (name2) => {
    return field(1, string2, (description) => {
      return field(2, optional(string2), (repository) => {
        return field(3, int2, (updated_at) => {
          return field(4, string2, (owners) => {
            return field(5, int2, (total_downloads) => {
              return field(6, int2, (recent_downloads) => {
                return field(7, string2, (latest_version) => {
                  return field(8, optional(string2), (module_name2) => {
                    return field(9, optional(string2), (code2) => {
                      let package$ = new Package(name2, description, repository, from_unix_seconds(updated_at), (() => {
                        let _pipe = owners;
                        let _pipe$1 = split2(_pipe, " ");
                        return filter(_pipe$1, (o) => {
                          return o !== "";
                        });
                      })(), total_downloads, recent_downloads, latest_version);
                      let _block;
                      if (module_name2 instanceof Some && code2 instanceof Some) {
                        let module_name$1 = module_name2[0];
                        let code$1 = code2[0];
                        _block = prepend(new ModuleSnippet(module_name$1, new Canonical(prepend(code$1, List$Empty$const))), List$Empty$const);
                      } else {
                        _block = List$Empty$const;
                      }
                      let snippet = _block;
                      return success(new Ok(new SearchResult(package$, snippet)));
                    });
                  });
                });
              });
            });
          });
        });
      });
    });
  });
}
function parse_code_loop(seen, rest, search_text, acceptable_distance) {
  return try$(split_once(rest, "\x02"), (_use0) => {
    let before = _use0[0];
    let rest$1 = _use0[1];
    let seen$1 = seen + replace(before, "\x03", "");
    let _block;
    let _pipe = rest$1;
    let _pipe$1 = replace(_pipe, "\x02", "");
    _block = replace(_pipe$1, "\x03", "");
    let text4 = _block;
    let match = slice(text4, 0, string_length(search_text));
    let $ = levenshtein(lowercase(match), search_text);
    let d = $;
    if (d <= acceptable_distance) {
      return new Ok(new FuzzyMatch(seen$1, match, drop_start(text4, string_length(match))));
    } else {
      return parse_code_loop(seen$1, rest$1, search_text, acceptable_distance);
    }
  });
}
function parse_code(code2, search_text) {
  let _block;
  let $ = string_length(search_text);
  {
    let n = $;
    if (n <= 4) {
      _block = 0;
    } else {
      let n$1 = $;
      if (n$1 <= 9) {
        _block = 1;
      } else {
        let n$2 = $;
        if (n$2 <= 13) {
          _block = 2;
        } else {
          let n$3 = $;
          if (n$3 <= 20) {
            _block = 3;
          } else {
            let n$4 = $;
            if (n$4 <= 50) {
              _block = 4;
            } else {
              _block = 5;
            }
          }
        }
      }
    }
  }
  let acceptable_distance = _block;
  return parse_code_loop("", code2, lowercase(search_text), acceptable_distance);
}
function search_result_decoder(search_text) {
  return field(0, string2, (name2) => {
    return field(1, string2, (description) => {
      return field(2, optional(string2), (repository) => {
        return field(3, int2, (updated_at) => {
          return field(4, string2, (owners) => {
            return field(5, int2, (total_downloads) => {
              return field(6, int2, (recent_downloads) => {
                return field(7, string2, (latest_version) => {
                  return field(8, optional(string2), (module_name2) => {
                    return field(9, optional(string2), (code2) => {
                      let package$ = new Package(name2, description, repository, from_unix_seconds(updated_at), (() => {
                        let _pipe = owners;
                        let _pipe$1 = split2(_pipe, " ");
                        return filter(_pipe$1, (o) => {
                          return o !== "";
                        });
                      })(), total_downloads, recent_downloads, latest_version);
                      if (module_name2 instanceof Some && code2 instanceof Some) {
                        let module_name$1 = module_name2[0];
                        let code$1 = code2[0];
                        let $ = parse_code(code$1, search_text);
                        if ($ instanceof Ok) {
                          let match = $[0];
                          return success(new Ok(new SearchResult(package$, prepend(new ModuleSnippet(module_name$1, match), List$Empty$const))));
                        } else {
                          return success(new Error(undefined));
                        }
                      } else {
                        return success(new Ok(new SearchResult(package$, List$Empty$const)));
                      }
                    });
                  });
                });
              });
            });
          });
        });
      });
    });
  });
}
function open_db(model, sqlite_db) {
  return [
    model,
    open2(sqlite_db, (var0) => {
      return new SqliteReturnedOpen(var0);
    })
  ];
}
function download_server_db(model) {
  let model$1 = new Model(Db$DbLoadingFromServer$const, model.search_result, model.lucy, model.all_pkg_names, model.search_text, model.query_from_initial_uri);
  let $ = to(data_src);
  let req;
  if ($ instanceof Ok) {
    req = $[0];
  } else {
    throw makeError("let_assert", FILEPATH3, "jooc", 296, "download_server_db", "Pattern match failed, no pattern matched the value.", {
      value: $,
      start: 8241,
      end: 8282,
      pattern_start: 8252,
      pattern_end: 8259
    });
  }
  let _block;
  let _pipe = req;
  let _pipe$1 = set_body(_pipe, toBitArray([]));
  _block = send_bits2(_pipe$1, expect_ok_response((var0) => {
    return new ServerReturnedData(var0);
  }));
  let download_effect = _block;
  return [model$1, download_effect];
}
function update2(model, msg) {
  if (msg instanceof CacheReturnedEtag) {
    let cached_etag = msg[0];
    if (cached_etag instanceof Ok) {
      let cached_etag$1 = cached_etag[0];
      let $ = to(data_src);
      let req;
      if ($ instanceof Ok) {
        req = $[0];
      } else {
        throw makeError("let_assert", FILEPATH3, "jooc", 135, "update", "Pattern match failed, no pattern matched the value.", {
          value: $,
          start: 2920,
          end: 2961,
          pattern_start: 2931,
          pattern_end: 2938
        });
      }
      let _block;
      let _pipe = req;
      let _pipe$1 = set_method(_pipe, Method$Head$const);
      _block = send3(_pipe$1, expect_ok_response((result) => {
        return new ServerReturnedEtag(cached_etag$1, result);
      }));
      let get_server_etag = _block;
      return [model, get_server_etag];
    } else {
      return download_server_db(model);
    }
  } else if (msg instanceof ServerReturnedEtag) {
    let cached_etag = msg.cached;
    let server_response = msg.result;
    if (server_response instanceof Ok) {
      let server_response$1 = server_response[0];
      let $ = (() => {
        let _pipe = server_response$1;
        return get_header(_pipe, "etag");
      })();
      if ($ instanceof Ok) {
        let server_etag = $[0];
        let $1 = server_etag === cached_etag;
        if ($1) {
          return [
            model,
            load_cached2((var0) => {
              return new CacheLoaded(var0);
            })
          ];
        } else {
          return download_server_db(model);
        }
      } else {
        return download_server_db(model);
      }
    } else {
      return download_server_db(model);
    }
  } else if (msg instanceof CacheLoaded) {
    let $ = msg[0];
    if ($ instanceof Ok) {
      let cache_data = $[0];
      return open_db(model, cache_data);
    } else {
      return download_server_db(model);
    }
  } else if (msg instanceof ServerReturnedData) {
    let load_result = msg[0];
    if (load_result instanceof Ok) {
      let resp = load_result[0];
      let _block;
      let $ = get_header(resp, "etag");
      if ($ instanceof Ok) {
        let etag = $[0];
        _block = save_cached2(etag, resp.body);
      } else {
        _block = none();
      }
      let save = _block;
      let $1 = open_db(model, resp.body);
      let model$1 = $1[0];
      let open3 = $1[1];
      return [
        model$1,
        batch(prepend(save, prepend(open3, List$Empty$const)))
      ];
    } else {
      let model$1 = new Model(new DbError("could not load data from " + data_src), model.search_result, model.lucy, model.all_pkg_names, model.search_text, model.query_from_initial_uri);
      return [model$1, none()];
    }
  } else if (msg instanceof SqliteReturnedOpen) {
    let load_result = msg[0];
    let _block;
    if (load_result instanceof Ok) {
      let db = load_result[0];
      _block = [
        (() => {
          let $1 = model.database;
          if ($1 instanceof DbLoadingFromCache) {
            return new DbLoaded(db, Option$None$const);
          } else if ($1 instanceof DbLoadingFromServer) {
            return new DbLoaded(db, new Some(Animation$Finishing$const));
          } else if ($1 instanceof DbLoaded) {
            throw makeError("panic", FILEPATH3, "jooc", 189, "update", "xd", {});
          } else {
            throw makeError("panic", FILEPATH3, "jooc", 190, "update", "xdd", {});
          }
        })(),
        query2(db, all_pkgs_by_recent, List$Empty$const, (_capture) => {
          return new SqliteReturnedQuery(Query$QueryCanonical$const, model.search_text, _capture);
        })
      ];
    } else {
      let err = load_result[0];
      _block = [new DbError(err), none()];
    }
    let $ = _block;
    let database = $[0];
    let exec = $[1];
    let model$1 = new Model(database, model.search_result, Search$Searching$const, model.all_pkg_names, model.search_text, model.query_from_initial_uri);
    return [model$1, exec];
  } else if (msg instanceof SpinFinished) {
    let _block;
    let $ = model.database;
    if ($ instanceof DbLoaded) {
      let database = $.db;
      _block = new Model(new DbLoaded(database, new Some(Animation$Done$const)), model.search_result, model.lucy, model.all_pkg_names, model.search_text, model.query_from_initial_uri);
    } else {
      _block = model;
    }
    let model$1 = _block;
    return [model$1, none()];
  } else if (msg instanceof SqliteReturnedQuery) {
    let query_was = msg.query_was;
    let search_text_was = msg.search_text_was;
    let got = msg.got;
    let $ = search_text_was === model.search_text;
    if ($) {
      let _block;
      if (query_was instanceof QueryFuzzy) {
        _block = list2(search_result_decoder(search_text_was));
      } else {
        _block = list2(canonical_result_decoder());
      }
      let decoder = _block;
      return handle_query_result(model, got, decoder);
    } else {
      return [model, none()];
    }
  } else if (msg instanceof UserTypedQuery) {
    let text4 = msg[0];
    return text_to_query(text4, model);
  } else {
    let premade_query = msg[0];
    let _block;
    let $ = model.database;
    if ($ instanceof DbLoaded) {
      let db = $.db;
      _block = query2(db, premade_query, List$Empty$const, (_capture) => {
        return new SqliteReturnedQuery(Query$QueryFuzzy$const, "", _capture);
      });
    } else {
      _block = none();
    }
    let exec = _block;
    let model$1 = new Model(model.database, model.search_result, Search$Searching$const, model.all_pkg_names, "", model.query_from_initial_uri);
    return [model$1, exec];
  }
}
function init(_) {
  let _block;
  let $ = do_initial_uri();
  if ($ instanceof Ok) {
    let initial_uri = $[0];
    let $1 = initial_uri.query;
    if ($1 instanceof Some) {
      let initial_uri_query = $1[0];
      let $2 = percent_decode(initial_uri_query);
      if ($2 instanceof Ok) {
        let initial_uri_query$1 = $2[0];
        _block = new Some(initial_uri_query$1);
      } else {
        _block = Option$None$const;
      }
    } else {
      _block = $1;
    }
  } else {
    _block = Option$None$const;
  }
  let query_from_initial_uri = _block;
  return [
    new Model(Db$DbLoadingFromCache$const, List$Empty$const, Search$NotSearching$const, List$Empty$const, unwrap(query_from_initial_uri, ""), query_from_initial_uri),
    check_cached_etag2((var0) => {
      return new CacheReturnedEtag(var0);
    })
  ];
}
function main() {
  let app = application(init, update2, view2);
  let $ = start4(app, "#app", undefined);
  if (!($ instanceof Ok)) {
    throw makeError("let_assert", FILEPATH3, "jooc", 33, "main", "Pattern match failed, no pattern matched the value.", { value: $, start: 727, end: 776, pattern_start: 738, pattern_end: 743 });
  }
  return;
}
function echo(value3, message2, file, line) {
  const grey = "\x1B[90m";
  const reset_color = "\x1B[39m";
  const file_line = `${file}:${line}`;
  const inspector = new Echo$Inspector;
  const string_value = inspector.inspect(value3);
  const string_message = message2 === undefined ? "" : " " + message2;
  if (globalThis.process?.stderr?.write) {
    const string5 = `${grey}${file_line}${reset_color}${string_message}
${string_value}
`;
    globalThis.process.stderr.write(string5);
  } else if (globalThis.Deno) {
    const string5 = `${grey}${file_line}${reset_color}${string_message}
${string_value}
`;
    globalThis.Deno.stderr.writeSync(new TextEncoder().encode(string5));
  } else {
    const string5 = `${file_line}${string_message}
${string_value}`;
    globalThis.console.log(string5);
  }
  return value3;
}

class Echo$Inspector {
  #references = new globalThis.Set;
  #isDict(value3) {
    try {
      const empty_dict = make();
      const dict_class = empty_dict.constructor;
      return value3 instanceof dict_class;
    } catch {
      return false;
    }
  }
  #float(float3) {
    const string5 = float3.toString().replace("+", "");
    if (string5.indexOf(".") >= 0) {
      return string5;
    } else {
      const index5 = string5.indexOf("e");
      if (index5 >= 0) {
        return string5.slice(0, index5) + ".0" + string5.slice(index5);
      } else if (globalThis.Number.isInteger(float3)) {
        return string5 + ".0";
      } else {
        return "//js(" + string5 + ")";
      }
    }
  }
  inspect(v) {
    const t = typeof v;
    if (v === true)
      return "True";
    if (v === false)
      return "False";
    if (v === null)
      return "//js(null)";
    if (v === undefined)
      return "Nil";
    if (t === "string")
      return this.#string(v);
    if (t === "bigint" || globalThis.Number.isSafeInteger(v))
      return v.toString();
    if (t === "number")
      return this.#float(v);
    if (v instanceof UtfCodepoint)
      return this.#utfCodepoint(v);
    if (v instanceof BitArray)
      return this.#bit_array(v);
    if (v instanceof globalThis.RegExp)
      return `//js(${v})`;
    if (v instanceof globalThis.Date)
      return `//js(Date("${v.toISOString()}"))`;
    if (v instanceof globalThis.Error)
      return `//js(${v.toString()})`;
    if (v instanceof globalThis.Function) {
      const args = [];
      for (const i of globalThis.Array(v.length).keys())
        args.push(globalThis.String.fromCharCode(i + 97));
      return `//fn(${args.join(", ")}) { ... }`;
    }
    if (this.#references.size === this.#references.add(v).size) {
      return "//js(circular reference)";
    }
    let printed;
    if (globalThis.Array.isArray(v)) {
      printed = `#(${v.map((v2) => this.inspect(v2)).join(", ")})`;
    } else if (v instanceof List) {
      printed = this.#list(v);
    } else if (v instanceof CustomType) {
      printed = this.#customType(v);
    } else if (this.#isDict(v)) {
      printed = this.#dict(v);
    } else if (v instanceof Set) {
      return `//js(Set(${[...v].map((v2) => this.inspect(v2)).join(", ")}))`;
    } else {
      printed = this.#object(v);
    }
    this.#references.delete(v);
    return printed;
  }
  #object(v) {
    const name2 = globalThis.Object.getPrototypeOf(v)?.constructor?.name || "Object";
    const props = [];
    for (const k of globalThis.Object.keys(v)) {
      props.push(`${this.inspect(k)}: ${this.inspect(v[k])}`);
    }
    const body = props.length ? " " + props.join(", ") + " " : "";
    const head = name2 === "Object" ? "" : name2 + " ";
    return `//js(${head}{${body}})`;
  }
  #dict(map10) {
    let body = "dict.from_list([";
    let first3 = true;
    let key_value_pairs = fold(map10, [], (pairs, key, value3) => {
      pairs.push([key, value3]);
      return pairs;
    });
    key_value_pairs.sort();
    key_value_pairs.forEach(([key, value3]) => {
      if (!first3)
        body = body + ", ";
      body = body + "#(" + this.inspect(key) + ", " + this.inspect(value3) + ")";
      first3 = false;
    });
    return body + "])";
  }
  #customType(record2) {
    const props = globalThis.Object.keys(record2).map((label) => {
      const value3 = this.inspect(record2[label]);
      return isNaN(parseInt(label)) ? `${label}: ${value3}` : value3;
    }).join(", ");
    return props ? `${record2.constructor.name}(${props})` : record2.constructor.name;
  }
  #list(list5) {
    if (list5 instanceof Empty) {
      return "[]";
    }
    let char_out = 'charlist.from_string("';
    let list_out = "[";
    let current = list5;
    while (current instanceof NonEmpty) {
      let element4 = current.head;
      current = current.tail;
      if (list_out !== "[") {
        list_out += ", ";
      }
      list_out += this.inspect(element4);
      if (char_out) {
        if (globalThis.Number.isInteger(element4) && element4 >= 32 && element4 <= 126) {
          char_out += globalThis.String.fromCharCode(element4);
        } else {
          char_out = null;
        }
      }
    }
    if (char_out) {
      return char_out + '")';
    } else {
      return list_out + "]";
    }
  }
  #string(str) {
    let new_str = '"';
    for (let i = 0;i < str.length; i++) {
      const char = str[i];
      switch (char) {
        case `
`:
          new_str += "\\n";
          break;
        case "\r":
          new_str += "\\r";
          break;
        case "\t":
          new_str += "\\t";
          break;
        case "\f":
          new_str += "\\f";
          break;
        case "\\":
          new_str += "\\\\";
          break;
        case '"':
          new_str += "\\\"";
          break;
        default:
          if (char < " " || char > "~" && char < " ") {
            new_str += "\\u{" + char.charCodeAt(0).toString(16).toUpperCase().padStart(4, "0") + "}";
          } else {
            new_str += char;
          }
      }
    }
    new_str += '"';
    return new_str;
  }
  #utfCodepoint(codepoint2) {
    return `//utfcodepoint(${globalThis.String.fromCodePoint(codepoint2.value)})`;
  }
  #bit_array(bits2) {
    if (bits2.bitSize === 0) {
      return "<<>>";
    }
    let acc = "<<";
    for (let i = 0;i < bits2.byteSize - 1; i++) {
      acc += bits2.byteAt(i).toString();
      acc += ", ";
    }
    if (bits2.byteSize * 8 === bits2.bitSize) {
      acc += bits2.byteAt(bits2.byteSize - 1).toString();
    } else {
      const trailingBitsCount = bits2.bitSize % 8;
      acc += bits2.byteAt(bits2.byteSize - 1) >> 8 - trailingBitsCount;
      acc += `:size(${trailingBitsCount})`;
    }
    acc += ">>";
    return acc;
  }
}

// .lustre/build/jooc.mjs
main();
