// Require Third-party Dependencies
const avaTest = require("ava");

// Require Internal Depedencies
const Addon = require("../index");

avaTest("Callback name should be typeof string", (assert) => {
    const { message } = assert.throws(() => {
        new Addon.Callback(10);
    }, TypeError);
    assert.is(message, "name should be typeof string!");
});

avaTest("Callback callback should be typeof Function", (assert) => {
    const { message } = assert.throws(() => {
        new Addon.Callback("handler", void 0);
    }, TypeError);
    assert.is(message, "callback should be typeof function!");
});

avaTest("Callback perfTrigger should be typeof function", (assert) => {
    const { message } = assert.throws(() => {
        Addon.Callback.observePerformance(void 0);
    }, TypeError);
    assert.is(message, "perfTrigger should be typeof function!");
});

avaTest("Callback hooks", async(assert) => {
    assert.plan(4);
    const hook = Addon.Callback.createHook();
    hook.enable();

    Addon.Callback.observePerformance((perfEntry) => {
        if (/hook/.test(perfEntry.name)) {
            assert.pass();
        }
    });

    // eslint-disable-next-line
    new Addon.Callback("hook1", async() => {
        assert.pass();
    }).execute();

    // eslint-disable-next-line
    new Addon.Callback("hook2", async() => {
        assert.pass();
    }).execute();

    await new Promise((resolve) => setTimeout(resolve, 50));
    hook.disable();
});
