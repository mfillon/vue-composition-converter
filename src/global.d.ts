declare global {
  interface String {
    insert: (index: number, string: string) => string;
  }
}
export {};
