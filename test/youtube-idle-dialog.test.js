const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const preloadPath = path.resolve(__dirname, "..", "preload-view.js");
const preloadSource = fs.readFileSync(preloadPath, "utf8");

function extractFunction(name) {
  const signature = `function ${name}(`;
  const start = preloadSource.indexOf(signature);
  assert.notEqual(start, -1, `${name} must exist in preload-view.js`);

  const openingBrace = preloadSource.indexOf("{", start);
  let depth = 0;
  for (let index = openingBrace; index < preloadSource.length; index += 1) {
    if (preloadSource[index] === "{") depth += 1;
    if (preloadSource[index] === "}") depth -= 1;
    if (depth === 0) return preloadSource.slice(start, index + 1);
  }

  throw new Error(`Could not extract ${name}`);
}

const context = vm.createContext({
  console: { log() {} },
});
vm.runInContext(
  [
    extractFunction("isYouTubeIdleDialogText"),
    extractFunction("findYouTubeIdleDialogAction"),
    extractFunction("dismissYouTubeIdleDialog"),
  ].join("\n"),
  context,
);

function createAction({ disabled = false, ariaDisabled = null } = {}) {
  return {
    disabled,
    clicks: 0,
    getAttribute(name) {
      return name === "aria-disabled" ? ariaDisabled : null;
    },
    click() {
      this.clicks += 1;
    },
  };
}

function createContainer({ textContent = "", action = null } = {}) {
  return {
    textContent,
    querySelector() {
      return action;
    },
  };
}

function createRoot({ renderer = null, dialogs = [] } = {}) {
  return {
    querySelector(selector) {
      assert.equal(selector, "ytmusic-you-there-renderer");
      return renderer;
    },
    querySelectorAll() {
      return dialogs;
    },
  };
}

test("dismisses the dedicated YouTube Music idle renderer", () => {
  const action = createAction();
  const renderer = createContainer({
    textContent: "Localized prompt text",
    action,
  });

  assert.equal(
    context.dismissYouTubeIdleDialog(createRoot({ renderer })),
    true,
  );
  assert.equal(action.clicks, 1);
});

test("dismisses a recognized generic idle confirmation dialog", () => {
  const action = createAction();
  const dialog = createContainer({
    textContent: "Video interrupted. Continue to watch?",
    action,
  });

  assert.equal(
    context.dismissYouTubeIdleDialog(createRoot({ dialogs: [dialog] })),
    true,
  );
  assert.equal(action.clicks, 1);
});

test("does not click unrelated or disabled dialog actions", () => {
  const unrelatedAction = createAction();
  const disabledAction = createAction({ ariaDisabled: "true" });
  const dialogs = [
    createContainer({
      textContent: "Delete this playlist?",
      action: unrelatedAction,
    }),
    createContainer({
      textContent: "Are you still listening?",
      action: disabledAction,
    }),
  ];

  assert.equal(
    context.dismissYouTubeIdleDialog(createRoot({ dialogs })),
    false,
  );
  assert.equal(unrelatedAction.clicks, 0);
  assert.equal(disabledAction.clicks, 0);
});

test("installs the watcher only for the YouTube Music wrapper", () => {
  assert.match(
    preloadSource,
    /const IS_YOUTUBE_MUSIC = window\.location\.hostname === 'music\.youtube\.com'/,
  );
  assert.match(
    preloadSource,
    /if \(!IS_YOUTUBE_MUSIC \|\| window\.__spiceYouTubeIdleDialogAutoDismissInstalled\) return/,
  );
  assert.match(preloadSource, /observer = new MutationObserver\(dismissIdleDialog\)/);
  assert.match(preloadSource, /window\.setInterval\(dismissIdleDialog, 2000\)/);
});
