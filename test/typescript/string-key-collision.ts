const first = {
  "=== INVALID"() {
    return 1;
  },
  "arktype (instanceof)"() {
    return 2;
  }
};

const second = {
  "=== INVALID"() {
    return 3;
  },
  "arktype (instanceof)"() {
    return 4;
  }
};
// BRANCH_SWITCH_TEST
// PLANMAP_BRANCH_DISCARD_TEST
// PLANMAP_BRANCH_DISCARD_TEST_2
// DISCARD_ME
// ASYNC_GIT_TEST
// RACE_TEST_1
// RACE_FLUSH_TEST
// RACE_FLUSH_TEST_2
// RACE_FLUSH_TEST_3
// FINAL_SESSION_TEST
