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

abstract class Base {
  run(x: number) {
    return x;
  }
}

abstract class Other {
  run(y: string) {
    throw new Error("o");
  }
}

class Normal {
  run(z: boolean) {
    return z;
  }
}
