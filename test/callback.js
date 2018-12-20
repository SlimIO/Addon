// Require Third-party Dependencies
const avaTest = require("ava");

// Require Internal Depedencies
const Addon = require("../index");

avaTest("Callback name should be typeof string", (assert) => {
    assert.throws(() => {
        new Addon.Callback(10);
    }, { instanceOf: TypeError, message: "name should be typeof string!" });
});

avaTest("Callback callback should be typeof Function", (assert) => {
    assert.throws(() => {
        new Addon.Callback("handler", void 0);
    }, { instanceOf: TypeError, message: "callback should be typeof function!" });
});

avaTest("Callback perfTrigger should be typeof function", (assert) => {
    assert.throws(() => {
        Addon.Callback.observePerformance(void 0);
    }, { instanceOf: TypeError, message: "perfTrigger should be typeof function!" });
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
