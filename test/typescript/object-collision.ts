function createA() {
  return {
    then() {
      return 10;
    },
    catch() {
      return 2;
    }
  };
}

function createB() {
  return {
    then() {
      return 3;
    },
    catch() {
      return 4;
    }
  };
}
