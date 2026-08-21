class C {
  static handler = (x: number) => {
    return x;
  };

  handler = (y: string) => {
    throw new Error('a');
  };
}

namespace A {
  export function boot(): number {
    return 1;
  }
}

namespace B {
  export function boot(): number {
    return 2;
  }
}
