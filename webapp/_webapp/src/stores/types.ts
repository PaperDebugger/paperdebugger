export type Setter<T> = {
  [K in keyof T as `set${Capitalize<string & K>}`]: (value: T[K]) => void;
};

export type Resetter<T> = {
  [K in keyof T as `reset${Capitalize<string & K>}`]: () => void;
};

export type Updater<T> = {
  [K in keyof T as `update${Capitalize<string & K>}`]: (updater: (prev: T[K]) => T[K]) => void;
};

export type SetterResetterStore<T> = T & Setter<T> & Resetter<T> & Updater<T>;
export type SetterStore<T> = T & Setter<T>;
