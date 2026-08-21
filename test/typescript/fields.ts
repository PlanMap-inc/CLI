class Svc {
  private handler = (x: string) => {
    if (!x) throw new Error('a');
    return x.toUpperCase();
  };

  public other = function(y: number) {
    return y * 3;
  };

  public extra = (z: boolean) => {
    return !z;
  };
}

function standalone(x: string): string {
  return x;
}
