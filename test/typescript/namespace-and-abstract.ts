namespace Format {
    export function upper(value: string): string {
        return value.toUpperCase();
    }
}

abstract class Shape {
    abstract area(): number;

    describe(): string {
        return "shape";
    }
}
