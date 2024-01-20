export default class Pointer extends Number {
    toString(): string {
        return `0x${super.toString(16)}`;
    }
}
