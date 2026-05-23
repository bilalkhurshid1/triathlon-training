declare module "better-sqlite3" {
  export type DatabaseOptions = {
    readonly?: boolean;
    fileMustExist?: boolean;
  };

  export type RunResult = {
    changes: number;
    lastInsertRowid: number | bigint;
  };

  export interface Statement<T = unknown> {
    all(...params: unknown[]): T[];
    get(...params: unknown[]): T | undefined;
    run(...params: unknown[]): RunResult;
  }

  export default class Database {
    constructor(filename: string, options?: DatabaseOptions);
    prepare<T = unknown>(source: string): Statement<T>;
    exec(source: string): void;
    close(): void;
  }
}
