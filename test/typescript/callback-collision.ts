function test(name: string, callback: () => void) {}

test("first test", () => {
  function Page() {
    return 1;
  }
});

test("second test", () => {
  function Page() {
    return 2;
  }
});
